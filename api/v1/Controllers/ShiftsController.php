<?php

class ShiftsController
{
    private $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    // ═══ TURNOS ═══

    /** GET /shifts?user_id=X&month=YYYY-MM */
    public function listShifts(): void
    {
        header('Content-Type: application/json');
        $userId = (int)($_GET['user_id'] ?? 0);
        $month  = $_GET['month'] ?? '';

        if (!$userId || !$month) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'user_id e month obrigatórios']);
            return;
        }

        $start = $month . '-01';
        $end   = date('Y-m-t', strtotime($start));

        $stmt = $this->pdo->prepare("
            SELECT id, user_id, day_of_week, period, modality, shift_value, valid_from, valid_until, active
            FROM sublocation_shifts
            WHERE user_id = :uid
              AND active = 1
              AND valid_from <= :end
              AND (valid_until IS NULL OR valid_until >= :start)
            ORDER BY day_of_week, period
        ");
        $stmt->execute([':uid' => $userId, ':start' => $start, ':end' => $end]);
        $shifts = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $dayNames = [1=>'Segunda',2=>'Terça',3=>'Quarta',4=>'Quinta',5=>'Sexta',6=>'Sábado',7=>'Domingo'];
        foreach ($shifts as &$s) {
            $s['day_name'] = $dayNames[(int)$s['day_of_week']] ?? '?';
            $s['shift_value'] = (float)$s['shift_value'];
        }

        echo json_encode(['success' => true, 'data' => $shifts]);
    }

    /** POST /shifts — body: {user_id, day_of_week, period, modality, shift_value, valid_from, valid_until?} */
    public function createShift(): void
    {
        header('Content-Type: application/json');
        $body = json_decode(file_get_contents('php://input'), true);

        $userId    = (int)($body['user_id'] ?? 0);
        $dow       = (int)($body['day_of_week'] ?? 0);
        $period    = $body['period'] ?? 'manha';
        $modality  = $body['modality'] ?? 'presencial';
        $value     = (float)($body['shift_value'] ?? 0);
        $validFrom = $body['valid_from'] ?? date('Y-m-01');
        $validUntil = $body['valid_until'] ?? null;

        if (!$userId || $dow < 1 || $dow > 7 || !in_array($period, ['manha','tarde']) || !in_array($modality, ['presencial','online'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Dados inválidos']);
            return;
        }

        // Se value=0, usa o valor padrão da config
        if ($value <= 0) {
            $cfg = $this->getConfig();
            $value = $modality === 'online' ? $cfg['shift_online'] : $cfg['shift_presencial'];
        }

        // Verifica duplicidade
        $check = $this->pdo->prepare("
            SELECT id FROM sublocation_shifts
            WHERE user_id = :uid AND day_of_week = :dow AND period = :p AND active = 1
              AND valid_from <= :vf AND (valid_until IS NULL OR valid_until >= :vf)
        ");
        $check->execute([':uid' => $userId, ':dow' => $dow, ':p' => $period, ':vf' => $validFrom]);
        if ($check->fetch()) {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'Turno já cadastrado para este dia/período']);
            return;
        }

        $stmt = $this->pdo->prepare("
            INSERT INTO sublocation_shifts (user_id, day_of_week, period, modality, shift_value, valid_from, valid_until, active)
            VALUES (:uid, :dow, :period, :modality, :value, :vfrom, :vuntil, 1)
        ");
        $stmt->execute([
            ':uid'      => $userId,
            ':dow'      => $dow,
            ':period'   => $period,
            ':modality' => $modality,
            ':value'    => $value,
            ':vfrom'    => $validFrom,
            ':vuntil'   => $validUntil,
        ]);

        echo json_encode(['success' => true, 'id' => (int)$this->pdo->lastInsertId()]);
    }

    /** PUT /shifts/{id} — body: {modality?, shift_value?, valid_until?, active?} */
    public function updateShift(int $id): void
    {
        header('Content-Type: application/json');
        $body = json_decode(file_get_contents('php://input'), true);

        $fields = [];
        $params = [':id' => $id];

        if (isset($body['modality']) && in_array($body['modality'], ['presencial','online'])) {
            $fields[] = 'modality = :mod';
            $params[':mod'] = $body['modality'];
        }
        if (isset($body['shift_value'])) {
            $fields[] = 'shift_value = :val';
            $params[':val'] = (float)$body['shift_value'];
        }
        if (array_key_exists('valid_until', $body)) {
            $fields[] = 'valid_until = :vu';
            $params[':vu'] = $body['valid_until'];
        }
        if (isset($body['active'])) {
            $fields[] = 'active = :act';
            $params[':act'] = (int)$body['active'];
        }

        if (empty($fields)) {
            echo json_encode(['success' => false, 'error' => 'Nada para atualizar']);
            return;
        }

        $sql = "UPDATE sublocation_shifts SET " . implode(', ', $fields) . " WHERE id = :id";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        echo json_encode(['success' => true, 'updated' => $id]);
    }

    /** DELETE /shifts/{id} */
    public function deleteShift(int $id): void
    {
        header('Content-Type: application/json');
        $stmt = $this->pdo->prepare("UPDATE sublocation_shifts SET active = 0 WHERE id = :id");
        $stmt->execute([':id' => $id]);
        echo json_encode(['success' => true, 'deleted' => $id]);
    }

    /** POST /shifts/bulk — body: {user_id, month, shifts: [{day_of_week, period, modality, shift_value}]} */
    public function bulkCreateShifts(): void
    {
        header('Content-Type: application/json');
        $body = json_decode(file_get_contents('php://input'), true);

        $userId = (int)($body['user_id'] ?? 0);
        $month  = $body['month'] ?? '';
        $shifts = $body['shifts'] ?? [];

        if (!$userId || !$month || empty($shifts)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'user_id, month e shifts obrigatórios']);
            return;
        }

        $validFrom = $month . '-01';
        $validUntil = date('Y-m-t', strtotime($validFrom));
        $cfg = $this->getConfig();
        $created = 0;
        $skipped = 0;

        foreach ($shifts as $s) {
            $dow      = (int)($s['day_of_week'] ?? 0);
            $period   = $s['period'] ?? 'manha';
            $modality = $s['modality'] ?? 'presencial';
            $value    = (float)($s['shift_value'] ?? 0);

            if ($value <= 0) {
                $value = $modality === 'online' ? $cfg['shift_online'] : $cfg['shift_presencial'];
            }

            if ($dow < 1 || $dow > 7) { $skipped++; continue; }

            // Verifica duplicidade
            $check = $this->pdo->prepare("
                SELECT id FROM sublocation_shifts
                WHERE user_id = :uid AND day_of_week = :dow AND period = :p AND active = 1
                  AND valid_from = :vf
            ");
            $check->execute([':uid' => $userId, ':dow' => $dow, ':p' => $period, ':vf' => $validFrom]);
            if ($check->fetch()) { $skipped++; continue; }

            $stmt = $this->pdo->prepare("
                INSERT INTO sublocation_shifts (user_id, day_of_week, period, modality, shift_value, valid_from, valid_until, active)
                VALUES (:uid, :dow, :period, :modality, :value, :vfrom, :vuntil, 1)
            ");
            $stmt->execute([
                ':uid'      => $userId,
                ':dow'      => $dow,
                ':period'   => $period,
                ':modality' => $modality,
                ':value'    => $value,
                ':vfrom'    => $validFrom,
                ':vuntil'   => $validUntil,
            ]);
            $created++;
        }

        echo json_encode(['success' => true, 'created' => $created, 'skipped' => $skipped]);
    }

    /** GET /shifts/infer?user_id=X&month=YYYY-MM — infere turnos dos atendimentos */
    public function inferShifts(): void
    {
        header('Content-Type: application/json');
        $userId = (int)($_GET['user_id'] ?? 0);
        $month  = $_GET['month'] ?? '';

        if (!$userId || !$month) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'user_id e month obrigatórios']);
            return;
        }

        $start = $month . '-01';
        $end   = date('Y-m-t', strtotime($start));

        // Conta semanas possíveis por dia da semana no mês
        $weeksPerDow = [];
        $d = new DateTime($start);
        $lastDay = new DateTime($end);
        while ($d <= $lastDay) {
            $dow = (int)$d->format('N');
            $weeksPerDow[$dow] = ($weeksPerDow[$dow] ?? 0) + 1;
            $d->modify('+1 day');
        }

        // Busca atendimentos realizados (regra correta)
        $stmt = $this->pdo->prepare("
            SELECT
                DAYOFWEEK(a.day) as mysql_dow,
                DATE(a.day) as data,
                CASE WHEN TIME(a.day) < '12:00:00' THEN 'manha' ELSE 'tarde' END as period,
                a.online
            FROM app_appointment a
            WHERE a.user = :uid
              AND DATE(a.day) BETWEEN :start AND :end
              AND NOT (
                  COALESCE(a.canceled, 'no') = 'yes'
                  AND COALESCE(a.status, '') = 'close'
              )
            ORDER BY a.day
        ");
        $stmt->execute([':uid' => $userId, ':start' => $start, ':end' => $end]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Agrupa por dia_semana + período + data_específica
        $combos = [];
        foreach ($rows as $r) {
            // MySQL DAYOFWEEK: 1=Sun,2=Mon,...,7=Sat → converter para ISO N: 1=Mon,...,7=Sun
            $mysqlDow = (int)$r['mysql_dow'];
            $isoDow = $mysqlDow === 1 ? 7 : $mysqlDow - 1;

            $key = "{$isoDow}|{$r['period']}";
            if (!isset($combos[$key])) {
                $combos[$key] = ['day_of_week' => $isoDow, 'period' => $r['period'], 'dates' => [], 'online' => 0, 'presencial' => 0];
            }
            $combos[$key]['dates'][$r['data']] = true;
            if ($r['online'] === 'yes') {
                $combos[$key]['online']++;
            } else {
                $combos[$key]['presencial']++;
            }
        }

        $dayNames = [1=>'Segunda',2=>'Terça',3=>'Quarta',4=>'Quinta',5=>'Sexta',6=>'Sábado',7=>'Domingo'];
        $cfg = $this->getConfig();
        $inferred = [];

        foreach ($combos as $combo) {
            $dow = $combo['day_of_week'];
            $totalWeeks = $weeksPerDow[$dow] ?? 4;
            $weeksWorked = count($combo['dates']);
            $pct = $totalWeeks > 0 ? ($weeksWorked / $totalWeeks) : 0;

            // Regra: precisa ter atendido em pelo menos 50% das semanas
            if ($pct < 0.5) continue;

            $isOnline = $combo['online'] > $combo['presencial'];
            $modality = $isOnline ? 'online' : 'presencial';
            $value = $isOnline ? $cfg['shift_online'] : $cfg['shift_presencial'];

            $inferred[] = [
                'day_of_week'    => $dow,
                'day_name'       => $dayNames[$dow] ?? '?',
                'period'         => $combo['period'],
                'modality'       => $modality,
                'shift_value'    => $value,
                'weeks_worked'   => $weeksWorked,
                'weeks_possible' => $totalWeeks,
                'pct'            => round($pct * 100),
                'total_appts'    => $combo['online'] + $combo['presencial'],
            ];
        }

        usort($inferred, function($a, $b) {
            if ($a['day_of_week'] !== $b['day_of_week']) return $a['day_of_week'] - $b['day_of_week'];
            return $a['period'] === 'manha' ? -1 : 1;
        });

        echo json_encode(['success' => true, 'data' => $inferred, 'month' => $month, 'user_id' => $userId]);
    }

    // ═══ CONFIG ═══

    /** GET /config */
    public function getConfigEndpoint(): void
    {
        header('Content-Type: application/json');
        echo json_encode(['success' => true, 'data' => $this->getConfig()]);
    }

    /** PUT /config — body: {tax_rate?, shift_presencial?, shift_online?} */
    public function updateConfig(): void
    {
        header('Content-Type: application/json');
        $body = json_decode(file_get_contents('php://input'), true);
        $allowed = ['tax_rate', 'shift_presencial', 'shift_online'];
        $updated = 0;

        foreach ($allowed as $key) {
            if (isset($body[$key])) {
                $stmt = $this->pdo->prepare("
                    INSERT INTO sublocation_config (config_key, config_value) VALUES (:k, :v)
                    ON DUPLICATE KEY UPDATE config_value = :v2
                ");
                $stmt->execute([':k' => $key, ':v' => (string)$body[$key], ':v2' => (string)$body[$key]]);
                $updated++;
            }
        }

        echo json_encode(['success' => true, 'updated' => $updated, 'config' => $this->getConfig()]);
    }

    private function getConfig(): array
    {
        $stmt = $this->pdo->query("SELECT config_key, config_value FROM sublocation_config");
        $rows = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
        return [
            'tax_rate'         => isset($rows['tax_rate']) ? (float)$rows['tax_rate'] : 15.0,
            'shift_presencial' => isset($rows['shift_presencial']) ? (float)$rows['shift_presencial'] : 450.0,
            'shift_online'     => isset($rows['shift_online']) ? (float)$rows['shift_online'] : 350.0,
        ];
    }
}
