<?php
class SublocationReport{
    private $pdo;
    private const SPECIALTY_MAP = [
        158 => '%psicolog%',
        160 => '%psicolog%',
        159 => '%psicomotricidade%',
        65  => '%fonoaudio%',
        148 => '%nutricion%',
    ];
    private const UNIMED_NO_DOUBLE = [159];
    private const TURNO_START = '2025-07-01';

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function generateReport(int $userId, string $yearMonth): array
    {
        $professional = $this->getProfessional($userId);
        if (!$professional) {
            return ['success' => false, 'error' => 'Profissional nao encontrado'];
        }

        $start = $yearMonth . '-01';
        $end   = date('Y-m-t', strtotime($start));
        $label = $this->getMonthLabel($yearMonth);

        $occupationId  = (int)$professional['occupation'];
        $specialtyTerm = self::SPECIALTY_MAP[$occupationId] ?? null;

        $operatorOverrides = $this->getOperatorOverrides($userId);

        $appointments = $this->getAppointments($userId, $start, $end);
        $revenueData  = $this->calculateRevenue($appointments, $occupationId, $specialtyTerm, $operatorOverrides);
        $shiftsData   = $this->calculateShifts($userId, $appointments, $start, $end);

        $config = $this->getConfigForUser($userId);

        $grossRevenue = $revenueData['total'];
        $taxRate      = $config['tax_rate'] / 100;
        $taxAmount    = round($grossRevenue * $taxRate, 2);
        $shiftsTotal  = $shiftsData['total_value'];
        $netValue     = round($grossRevenue - $taxAmount - $shiftsTotal, 2);

        $totalAppointments = count($revenueData['appointments']);

        return [
            'success' => true,
            'data' => [
                'report' => [
                    'professional' => [
                        'id'        => $professional['id'],
                        'name'      => trim($professional['first_name'] . ' ' . $professional['last_name']),
                        'specialty' => $professional['specialty'],
                        'email'     => $professional['email'],
                    ],
                    'period' => [
                        'year_month' => $yearMonth,
                        'start'      => $start,
                        'end'        => $end,
                        'label'      => $label,
                    ],
                    'summary' => [
                        'revenue' => [
                            'total'       => $grossRevenue,
                            'by_operator' => $revenueData['by_operator'],
                        ],
                        'tax' => [
                            'rate'   => $config['tax_rate'],
                            'amount' => $taxAmount,
                        ],
                        'shifts'             => $shiftsData,
                        'net_value'          => $netValue,
                        'total_appointments' => $totalAppointments,
                    ],
                    'appointments' => $revenueData['appointments'],
                    'shifts_detail' => $shiftsData['detail'] ?? [],
                ],
            ],
        ];
    }

    private function getProfessional(int $userId): ?array
    {
        $sql = "
            SELECT u.id, u.first_name, u.last_name, u.email, u.occupation,
                   o.title AS specialty
            FROM users u
            LEFT JOIN app_occupations o ON o.id = u.occupation
            WHERE u.id = :uid
            LIMIT 1
        ";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':uid' => $userId]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    private function getAppointments(int $userId, string $start, string $end): array
    {
        $sql = "
            SELECT
                a.id,
                DATE(a.day)       AS appointment_date,
                TIME(a.day)       AS appointment_time,
                a.online,
                a.status,
                a.canceled,
                a.patient         AS patient_id,
                CONCAT(pt.first_name, ' ', pt.last_name) AS patient_name,
                pt.agreement      AS patient_agreement_id,
                CASE
                    WHEN ag.sub_of IS NOT NULL THEN ag.sub_of
                    ELSE pt.agreement
                END AS operator_id,
                CASE
                    WHEN pag.title IS NOT NULL THEN pag.title
                    ELSE ag.title
                END AS operator_name
            FROM app_appointment a
            JOIN app_patient pt ON pt.id = a.patient
            LEFT JOIN app_agreement ag ON ag.id = pt.agreement
            LEFT JOIN app_agreement pag ON pag.id = ag.sub_of
            WHERE a.user = :uid
              AND DATE(a.day) BETWEEN :start AND :end
              AND NOT (
                  COALESCE(a.canceled, 'no') = 'yes'
                  AND COALESCE(a.status, '') = 'close'
              )
              AND COALESCE(a.status, '') != 'cut'
              AND COALESCE(a.deleted, 'no') != 'yes'
              AND pt.agreement IS NOT NULL
              AND pt.agreement > 0
              AND pt.agreement != 1
            ORDER BY a.day ASC
        ";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':uid' => $userId, ':start' => $start, ':end' => $end]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function calculateRevenue(array $appointments, int $occupationId, ?string $specialtyTerm, array $operatorOverrides = []): array
    {
        // Normaliza chaves dos overrides para match case-insensitive
        $normalizedOverrides = [];
        foreach ($operatorOverrides as $name => $val) {
            $normalizedOverrides[mb_strtolower(trim($name), 'UTF-8')] = $val;
        }

        $byOperator      = [];
        $appointmentList = [];
        $total           = 0.0;
        $valueCache      = [];

        foreach ($appointments as $appt) {
            $operatorId   = $appt['operator_id'];
            $operatorName = $appt['operator_name'] ?? 'Sem operadora';
            $normalizedName = mb_strtolower(trim($operatorName), 'UTF-8');

            if (!$operatorId) {
                // Particular — verifica se tem override
                $particularValue = 0;
                if (isset($normalizedOverrides['particular'])) {
                    $particularValue = $normalizedOverrides['particular'];
                }
                $total += $particularValue;

                if ($particularValue > 0) {
                    $key = '0|Particular';
                    if (!isset($byOperator[$key])) {
                        $byOperator[$key] = [
                            'operator_name'  => 'Particular',
                            'procedure_name' => 'Repasse configurado',
                            'appointments'   => 0,
                            'unit_value'     => round($particularValue, 2),
                            'base_value'     => round($particularValue, 2),
                            'doubled'        => false,
                            'subtotal'       => 0.0,
                            'override'       => true,
                        ];
                    }
                    $byOperator[$key]['appointments']++;
                    $byOperator[$key]['subtotal'] += $particularValue;
                }

                $appointmentList[] = $this->formatAppointment($appt, 'Particular', null, $particularValue);
                continue;
            }

            // Verifica override por nome da operadora (case-insensitive)
            $hasOverride = isset($normalizedOverrides[$normalizedName]);

            if ($hasOverride) {
                $unitValue     = $normalizedOverrides[$normalizedName];
                $procedureName = 'Repasse configurado';
                $doubled       = false;
            } else {
                if (!isset($valueCache[$operatorId])) {
                    $valueCache[$operatorId] = $this->getOperatorValue($operatorId, $specialtyTerm);
                }

                $valueInfo     = $valueCache[$operatorId];
                $unitValue     = $valueInfo['value'] ?? 0;
                $procedureName = $valueInfo['procedure_name'] ?? 'N/A';

                $doubled = false;
                if ($this->isUnimed($operatorName) && !in_array($occupationId, self::UNIMED_NO_DOUBLE)) {
                    $unitValue = $unitValue * 2;
                    $doubled = true;
                }
            }

            $total += $unitValue;

            $key = $operatorId . '|' . $procedureName;
            if (!isset($byOperator[$key])) {
                $byOperator[$key] = [
                    'operator_name'  => $operatorName,
                    'procedure_name' => $procedureName,
                    'appointments'   => 0,
                    'unit_value'     => round($unitValue, 2),
                    'base_value'     => round($unitValue, 2),
                    'doubled'        => $doubled,
                    'subtotal'       => 0.0,
                    'override'       => $hasOverride,
                ];
            }
            $byOperator[$key]['appointments']++;
            $byOperator[$key]['subtotal'] += $unitValue;

            $appointmentList[] = $this->formatAppointment($appt, $operatorName, $procedureName, $unitValue);
        }

        foreach ($byOperator as &$op) {
            $op['subtotal'] = round($op['subtotal'], 2);
        }
        unset($op);

        return [
            'total'        => round($total, 2),
            'by_operator'  => array_values($byOperator),
            'appointments' => $appointmentList,
        ];
    }

    private function getOperatorValue(int $operatorId, ?string $specialtyTerm): array
    {
        if (!$specialtyTerm) {
            return ['value' => 0, 'procedure_name' => 'Especialidade sem mapeamento'];
        }

        $sql = "
            SELECT ag.id, ag.title, ag.value
            FROM app_agreement ag
            WHERE ag.sub_of = :opId
              AND ag.title LIKE :term
              AND ag.value IS NOT NULL
              AND ag.value > 0
            ORDER BY ag.value DESC
            LIMIT 1
        ";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':opId' => $operatorId, ':term' => $specialtyTerm]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($result) {
            return [
                'value'          => (float)$result['value'],
                'procedure_name' => $result['title'],
            ];
        }

        $sql2 = "SELECT id, title, value FROM app_agreement WHERE id = :opId AND value IS NOT NULL AND value > 0 LIMIT 1";
        $stmt2 = $this->pdo->prepare($sql2);
        $stmt2->execute([':opId' => $operatorId]);
        $result2 = $stmt2->fetch(PDO::FETCH_ASSOC);

        if ($result2) {
            return [
                'value'          => (float)$result2['value'],
                'procedure_name' => $result2['title'],
            ];
        }

        return ['value' => 0, 'procedure_name' => 'Procedimento nao encontrado'];
    }

    private function isUnimed(string $operatorName): bool
    {
        return stripos($operatorName, 'unimed') !== false;
    }

    private function formatAppointment(array $appt, string $operatorName, ?string $procedureName, float $value): array
    {
        return [
            'id'             => $appt['id'],
            'date'           => $appt['appointment_date'],
            'time'           => $appt['appointment_time'],
            'patient_name'   => $appt['patient_name'],
            'operator_name'  => $operatorName,
            'procedure_name' => $procedureName ?? '',
            'value'          => round($value, 2),
            'online'         => ($appt['online'] === 'yes'),
            'status'         => $appt['status'] ?? 'check-box',
        ];
    }

    private function calculateShifts(int $userId, array $appointments, string $monthStart, string $monthEnd): array
    {
        $config = $this->getConfigForUser($userId);
        $presencialValue = $config['shift_presencial'];
        $onlineValue     = $config['shift_online'];

        if ($monthStart < self::TURNO_START) {
            return [
                'presencial'  => ['count' => 0, 'unit_value' => $presencialValue, 'total' => 0],
                'online'      => ['count' => 0, 'unit_value' => $onlineValue, 'total' => 0],
                'total_count' => 0,
                'total_value' => 0,
                'detail'      => [],
                'source'      => 'disabled',
                'note'        => 'Sistema de turnos nao aplicavel antes de Jul/2025',
            ];
        }

        $fixedShifts = $this->getFixedShifts($userId, $monthStart, $monthEnd);

        if (!empty($fixedShifts)) {
            return $this->buildShiftsFromFixed($fixedShifts, $presencialValue, $onlineValue);
        }

        return $this->inferShiftsFromAppointments($appointments, $presencialValue, $onlineValue);
    }

    private function getFixedShifts(int $userId, string $monthStart, string $monthEnd): array
    {
        $sql = "
            SELECT id, day_of_week, period, modality, shift_value
            FROM sublocation_shifts
            WHERE user_id = :uid
              AND active = 1
              AND valid_from <= :monthEnd
              AND (valid_until IS NULL OR valid_until >= :monthStart)
            ORDER BY day_of_week, period
        ";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':uid'        => $userId,
            ':monthStart' => $monthStart,
            ':monthEnd'   => $monthEnd,
        ]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function buildShiftsFromFixed(array $fixedShifts, float $presencialValue, float $onlineValue): array
    {
        $dayNames = [1=>'Segunda',2=>'Terca',3=>'Quarta',4=>'Quinta',5=>'Sexta',6=>'Sabado',7=>'Domingo'];

        $presencialCount = 0;
        $onlineCount     = 0;
        $presencialTotal = 0;
        $onlineTotal     = 0;
        $detail          = [];

        foreach ($fixedShifts as $shift) {
            $modality   = $shift['modality'];
            $shiftValue = (float)$shift['shift_value'];

            if ($shiftValue <= 0) {
                $shiftValue = ($modality === 'online') ? $onlineValue : $presencialValue;
            }

            if ($modality === 'online') {
                $onlineCount++;
                $onlineTotal += $shiftValue;
            } else {
                $presencialCount++;
                $presencialTotal += $shiftValue;
            }

            $detail[] = [
                'id'          => isset($shift['id']) ? (int)$shift['id'] : null,
                'day_of_week' => (int)$shift['day_of_week'],
                'day_name'    => $dayNames[(int)$shift['day_of_week']] ?? '?',
                'period'      => $shift['period'],
                'modality'    => $modality,
                'value'       => $shiftValue,
            ];
        }

        return [
            'presencial'  => ['count' => $presencialCount, 'unit_value' => $presencialValue, 'total' => $presencialTotal],
            'online'      => ['count' => $onlineCount, 'unit_value' => $onlineValue, 'total' => $onlineTotal],
            'total_count' => $presencialCount + $onlineCount,
            'total_value' => $presencialTotal + $onlineTotal,
            'detail'      => $detail,
            'source'      => 'fixed',
        ];
    }

    private function inferShiftsFromAppointments(array $appointments, float $presencialValue, float $onlineValue): array
    {
        $dayNames = [1=>'Segunda',2=>'Terca',3=>'Quarta',4=>'Quinta',5=>'Sexta',6=>'Sabado',7=>'Domingo'];

        $combos = [];

        foreach ($appointments as $appt) {
            $date      = $appt['appointment_date'];
            $time      = $appt['appointment_time'];
            $isOnline  = ($appt['online'] === 'yes');
            $period    = ($time < '12:00:00') ? 'manha' : 'tarde';
            $dayOfWeek = (int)date('N', strtotime($date));

            $key = $dayOfWeek . '|' . $period;
            if (!isset($combos[$key])) {
                $combos[$key] = ['day_of_week' => $dayOfWeek, 'period' => $period, 'online' => 0, 'presencial' => 0];
            }

            if ($isOnline) {
                $combos[$key]['online']++;
            } else {
                $combos[$key]['presencial']++;
            }
        }

        uksort($combos, function($a, $b) {
            $partsA = explode('|', $a);
            $partsB = explode('|', $b);
            if ($partsA[0] !== $partsB[0]) return $partsA[0] - $partsB[0];
            return ($partsA[1] === 'manha') ? -1 : 1;
        });

        $presencialCount = 0;
        $onlineCount     = 0;
        $presencialTotal = 0;
        $onlineTotal     = 0;
        $detail          = [];

        foreach ($combos as $combo) {
            $isOnlineShift = $combo['online'] > $combo['presencial'];
            $modality      = $isOnlineShift ? 'online' : 'presencial';
            $shiftValue    = $isOnlineShift ? $onlineValue : $presencialValue;

            if ($isOnlineShift) {
                $onlineCount++;
                $onlineTotal += $shiftValue;
            } else {
                $presencialCount++;
                $presencialTotal += $shiftValue;
            }

            $detail[] = [
                'id'                      => null,
                'day_of_week'             => $combo['day_of_week'],
                'day_name'                => $dayNames[$combo['day_of_week']] ?? '?',
                'period'                  => $combo['period'],
                'modality'                => $modality,
                'value'                   => $shiftValue,
                'appointments_online'     => $combo['online'],
                'appointments_presencial' => $combo['presencial'],
            ];
        }

        return [
            'presencial'  => ['count' => $presencialCount, 'unit_value' => $presencialValue, 'total' => $presencialTotal],
            'online'      => ['count' => $onlineCount, 'unit_value' => $onlineValue, 'total' => $onlineTotal],
            'total_count' => $presencialCount + $onlineCount,
            'total_value' => $presencialTotal + $onlineTotal,
            'detail'      => $detail,
            'source'      => 'inferred',
        ];
    }

    private $configCache = null;
    private $userConfigCache = [];

    private function getConfig(): array
    {
        if ($this->configCache) return $this->configCache;

        $stmt = $this->pdo->query("SELECT config_key, config_value FROM sublocation_config");
        $rows = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

        $this->configCache = [
            'tax_rate'         => isset($rows['tax_rate']) ? (float)$rows['tax_rate'] : 15.0,
            'shift_presencial' => isset($rows['shift_presencial']) ? (float)$rows['shift_presencial'] : 450.0,
            'shift_online'     => isset($rows['shift_online']) ? (float)$rows['shift_online'] : 350.0,
        ];
        return $this->configCache;
    }

    /**
     * Config com fallback: professional_config > sublocation_config > defaults
     * @param int $userId
     * @return array
     */
    private function getConfigForUser(int $userId): array
    {
        if (isset($this->userConfigCache[$userId])) {
            return $this->userConfigCache[$userId];
        }

        $global = $this->getConfig();

        // Busca config especifica do profissional
        $stmt = $this->pdo->prepare(
            "SELECT config_key, config_value FROM professional_config WHERE api_professional_id = :uid"
        );
        $stmt->execute([':uid' => $userId]);
        $profRows = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

        $this->userConfigCache[$userId] = [
            'tax_rate'         => isset($profRows['tax_rate']) ? (float)$profRows['tax_rate'] : $global['tax_rate'],
            'shift_presencial' => isset($profRows['shift_presencial']) ? (float)$profRows['shift_presencial'] : $global['shift_presencial'],
            'shift_online'     => isset($profRows['shift_online']) ? (float)$profRows['shift_online'] : $global['shift_online'],
        ];

        return $this->userConfigCache[$userId];
    }

    /**
     * Retorna overrides de valor por operadora para o profissional
     * @param int $userId
     * @return array  ['NomeOperadora' => valor, ...]
     */
    private function getOperatorOverrides(int $userId): array
    {
        $stmt = $this->pdo->prepare(
            "SELECT config_key, config_value FROM professional_config
             WHERE api_professional_id = :uid AND (config_key LIKE 'op_%' OR config_key LIKE 'operator_%')"
        );
        $stmt->execute([':uid' => $userId]);
        $rows = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

        $result = [];
        foreach ($rows as $key => $value) {
            if (strpos($key, 'op_') === 0) {
                // Novo formato: op_<base64>
                $encoded = substr($key, 3);
                $opName = base64_decode($encoded);
            } else {
                // Formato antigo: operator_NomeOperadora
                $opName = str_replace('_', ' ', substr($key, 9));
            }
            if ($opName !== false && (float)$value > 0) {
                $result[$opName] = (float)$value;
            }
        }
        return $result;
    }

    public function listProfessionals(): array
    {
        $sql = "
            SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) AS name,
                   o.title AS specialty
            FROM users u
            LEFT JOIN app_occupations o ON o.id = u.occupation
            WHERE u.level = 6 AND u.active = 'yes'
            ORDER BY u.first_name, u.last_name
        ";
        $stmt = $this->pdo->query($sql);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function getMonthLabel(string $yearMonth): string
    {
        $months = [
            '01' => 'Janeiro', '02' => 'Fevereiro', '03' => 'Marco',
            '04' => 'Abril',   '05' => 'Maio',      '06' => 'Junho',
            '07' => 'Julho',   '08' => 'Agosto',     '09' => 'Setembro',
            '10' => 'Outubro', '11' => 'Novembro',  '12' => 'Dezembro',
        ];
        $parts = explode('-', $yearMonth);
        return ($months[$parts[1]] ?? $parts[1]) . '/' . $parts[0];
    }
}
