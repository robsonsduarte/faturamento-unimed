<?php
namespace API\Controllers;

use API\Models\Appointment;
use API\Helpers\Response;
use API\Helpers\Validator;
use API\Middleware\AuthMiddleware;

class AppointmentController
{
    private $appointmentModel;
    private $auth;

    public function __construct()
    {
        $this->appointmentModel = new Appointment();
        $this->auth = new AuthMiddleware();
    }

    public function create($data)
    {
        $validator = new Validator($data);
        $validator->required('company')->required('user')->required('patient')->required('day');
        
        $validator = new Validator($data);
        $validator->required('company')->required('user')->required('patient')->required('day');
        
        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }
        
        $validStatuses = ['scheduled', 'alarm-clock', 'ti-thought', 'face-smile', 'face-sad', 'check-box', 'close', 'cut', 'help-alt', 'confirmed', 'completed', 'canceled'];
        if (isset($data['status']) && !in_array($data['status'], $validStatuses)) {
            return Response::error([
                'status' => 'Status must be one of: ' . implode(', ', $validStatuses)
            ], 400);
        }
        
        // Continua o c贸digo normal (linha 31)...
        $apiKeyData = $this->auth->validate($data['company']);

        $apiKeyData = $this->auth->validate($data['company']);
        if (!$apiKeyData) {
            return;
        }

        try {
            $isAvailable = $this->appointmentModel->checkAvailability($data['user'], $data['day']);

            if (!$isAvailable) {
                return Response::error('Time slot already booked', 409);
            }

            $calendarData = $this->appointmentModel->getCalendarData($data['user'], $data['company']);

            $appointmentData = [
                'company' => $data['company'],
                'user' => $data['user'],
                'patient' => $data['patient'],
                'day' => $data['day'],
                'period' => $data['period'] ?? null,
                'project' => $data['project'] ?? 'no',
                'payment' => $data['payment'] ?? null,
                'agreement' => $data['agreement'] ?? null,
                'value' => $data['value'] ?? null,
                'confirmed' => $data['confirmed'] ?? 'no',
                'status' => $data['status'] ?? 'scheduled',
                'online' => $data['online'] ?? 'no',
                'observation' => $data['observation'] ?? null,
                'type' => $data['type'] ?? null,
                'author' => $data['author'] ?? 1,
                'calendar_id' => $calendarData['google_calendar_id'] ?? null
            ];

            $appointmentId = $this->appointmentModel->insert($appointmentData);

            if (!$appointmentId) {
                return Response::error('Failed to create appointment', 500);
            }

            $appointment = $this->appointmentModel->findWithDetails($appointmentId);

            return Response::success([
                'appointment' => $appointment,
                'message' => 'Appointment created successfully'
            ], 201);

        } catch (\Exception $e) {
            return Response::error('Error: ' . $e->getMessage(), 500);
        }
    }

    public function list($params)
    {
        $validator = new Validator($params);
        $validator->required('company');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        $apiKeyData = $this->auth->validate($params['company']);
        if (!$apiKeyData) {
            return;
        }

        try {
            $limit = isset($params['limit']) ? (int)$params['limit'] : 50;
            $offset = isset($params['offset']) ? (int)$params['offset'] : 0;

            $filters = [];
            if (!empty($params['user'])) $filters['user'] = $params['user'];
            if (!empty($params['patient'])) $filters['patient'] = $params['patient'];
            if (!empty($params['date'])) $filters['date'] = $params['date'];
            if (!empty($params['status'])) $filters['status'] = $params['status'];
            if (!empty($params['confirmed'])) $filters['confirmed'] = $params['confirmed'];

            $appointments = $this->appointmentModel->getByCompany($params['company'], $filters, $limit, $offset);
            $total = $this->appointmentModel->countByFilters($params['company'], $filters);

            return Response::success([
                'appointments' => $appointments,
                'total' => $total,
                'limit' => $limit,
                'offset' => $offset,
                'filters' => $filters
            ]);

        } catch (\Exception $e) {
            return Response::error('Error: ' . $e->getMessage(), 500);
        }
    }

    public function show($id)
    {
        $params = array_merge($_GET, ['id' => $id]);
        
        $validator = new Validator($params);
        $validator->required('id')->required('company');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        $apiKeyData = $this->auth->validate($params['company']);
        if (!$apiKeyData) {
            return;
        }

        try {
            $appointment = $this->appointmentModel->findWithDetails($params['id']);

            if (!$appointment) {
                return Response::error('Appointment not found', 404);
            }

            if ($appointment['company'] != $params['company']) {
                return Response::error('Unauthorized access', 403);
            }

            return Response::success(['appointment' => $appointment]);

        } catch (\Exception $e) {
            return Response::error('Error: ' . $e->getMessage(), 500);
        }
    }

    public function update($id, $data)
    {
        $params = array_merge($data, ['id' => $id]);
        
        $validator = new Validator($params);
        $validator->required('id')->required('company');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }
        
        $validStatuses = ['scheduled', 'alarm-clock', 'ti-thought', 'face-smile', 'face-sad', 'check-box', 'close', 'cut', 'help-alt', 'confirmed', 'completed', 'canceled'];
        
        if (isset($data['status']) && !in_array($data['status'], $validStatuses)) {
            return Response::error([
                'status' => 'Status must be one of: ' . implode(', ', $validStatuses)
            ], 400);
        }


        $apiKeyData = $this->auth->validate($params['company']);
        if (!$apiKeyData) {
            return;
        }

        try {
            $appointment = $this->appointmentModel->find($params['id']);

            if (!$appointment) {
                return Response::error('Appointment not found', 404);
            }

            if ($appointment['company'] != $params['company']) {
                return Response::error('Unauthorized access', 403);
            }

            if (isset($params['day']) && $params['day'] != $appointment['day']) {
                $isAvailable = $this->appointmentModel->checkAvailability(
                    $appointment['user'],
                    $params['day'],
                    $appointment['id']
                );

                if (!$isAvailable) {
                    return Response::error('New time slot already booked', 409);
                }
            }

            $updateData = $params;
            unset($updateData['id']);
            unset($updateData['company']);
            unset($updateData['created_at']);

            $updated = $this->appointmentModel->update($appointment['id'], $updateData);

            if (!$updated) {
                return Response::error('Failed to update appointment', 500);
            }

            $updatedAppointment = $this->appointmentModel->findWithDetails($appointment['id']);

            return Response::success([
                'appointment' => $updatedAppointment,
                'message' => 'Appointment updated successfully'
            ]);

        } catch (\Exception $e) {
            return Response::error('Error: ' . $e->getMessage(), 500);
        }
    }

    public function cancel($id, $data = [])
    {
        $params = array_merge($data, ['id' => $id], $_GET);
        
        $validator = new Validator($params);
        $validator->required('id')->required('company');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        $apiKeyData = $this->auth->validate($params['company']);
        if (!$apiKeyData) {
            return;
        }

        try {
            $appointment = $this->appointmentModel->find($params['id']);

            if (!$appointment) {
                return Response::error('Appointment not found', 404);
            }

            if ($appointment['company'] != $params['company']) {
                return Response::error('Unauthorized access', 403);
            }

            $reason = $params['reason'] ?? 'Canceled via API';
            $canceled = $this->appointmentModel->cancel($appointment['id'], $reason);

            if (!$canceled) {
                return Response::error('Failed to cancel appointment', 500);
            }

            return Response::success([
                'message' => 'Appointment canceled successfully',
                'appointment_id' => $appointment['id']
            ]);

        } catch (\Exception $e) {
            return Response::error('Error: ' . $e->getMessage(), 500);
        }
    }

    public function checkAvailability($params)
    {
        $validator = new Validator($params);
        $validator->required('user')->required('day');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        try {
            $isAvailable = $this->appointmentModel->checkAvailability($params['user'], $params['day']);

            return Response::success([
                'available' => $isAvailable,
                'user' => $params['user'],
                'day' => $params['day']
            ]);

        } catch (\Exception $e) {
            return Response::error('Error: ' . $e->getMessage(), 500);
        }
    }

    public function findByGoogleEvent($googleEventId)
    {
        $params = array_merge($_GET, ['google_event_id' => $googleEventId]);
        
        $validator = new Validator($params);
        $validator->required('company');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        $apiKeyData = $this->auth->validate($params['company']);
        if (!$apiKeyData) {
            return;
        }

        try {
            $sql = "SELECT * FROM app_appointment WHERE calendar_event = ? AND company = ? LIMIT 1";
            $appointment = $this->appointmentModel->fetchOne($sql, [$googleEventId, $params['company']]);

            if (!$appointment) {
                return Response::error('Appointment not found', 404);
            }

            return Response::success(['appointment' => $appointment]);

        } catch (\Exception $e) {
            return Response::error('Error: ' . $e->getMessage(), 500);
        }
    }
    
    public function searchByPatient(array $data = [])
    {
        header('Content-Type: application/json; charset=utf-8');
    
        try {
            // ═══════════════════════════════════════════════════════════════════
            // 1. VALIDAÇÃO DE CAMPOS
            // ═══════════════════════════════════════════════════════════════════
            
            foreach (['company', 'first_name', 'last_name'] as $field) {
                if (empty($data[$field])) {
                    Response::validationError([$field => 'Campo obrigatório']);
                    return;
                }
            }
    
            $company   = (int) $data['company'];
            $firstName = trim($data['first_name']);
            $lastName  = trim($data['last_name']);
            $bornAt    = isset($data['born_at']) ? trim($data['born_at']) : null;
            $mobile    = isset($data['mobile']) ? trim($data['mobile']) : null;
            $limit     = isset($data['limit']) ? max(1, min(20, (int)$data['limit'])) : 10;
    
            // ═══════════════════════════════════════════════════════════════════
            // 2. AUTENTICAÇÃO
            // ═══════════════════════════════════════════════════════════════════
            
            if (!$this->auth->validate($company)) {
                return;
            }
    
            // ═══════════════════════════════════════════════════════════════════
            // 3. BUSCAR PACIENTES (SEM FILTRO DE STATUS!)
            // ═══════════════════════════════════════════════════════════════════
            
            $db = \API\Config\Database::getInstance();
            
            $searchTerm = '%' . $firstName . '%';
            
            // ✅ REMOVIDO: AND status = 'active'
            // Agora busca TODOS os pacientes, independente do status
            $sqlPatients = "SELECT id, first_name, last_name, born_at, mobile, email, status
                            FROM app_patient
                            WHERE company = ?
                              AND CONCAT(first_name, ' ', last_name) LIKE ?
                            LIMIT 20";
            
            $stmtPatients = $db->getConnection()->prepare($sqlPatients);
            $stmtPatients->execute([$company, $searchTerm]);
            $patients = $stmtPatients->fetchAll(\PDO::FETCH_ASSOC);
    
            if (empty($patients)) {
                Response::success([
                    'found' => false,
                    'message' => 'Nenhum paciente encontrado com esse nome.'
                ]);
                return;
            }
    
            // ═══════════════════════════════════════════════════════════════════
            // 4. VERIFICAR NECESSIDADE DE VALIDAÇÃO LGPD
            // ═══════════════════════════════════════════════════════════════════
            
            if (empty($bornAt) || empty($mobile)) {
                Response::success([
                    'found' => false,
                    'needs_validation' => true,
                    'patients_count' => count($patients),
                    'message' => 'É necessário informar data de nascimento e telefone para validação LGPD.'
                ]);
                return;
            }
    
            // ═══════════════════════════════════════════════════════════════════
            // 5. VALIDAÇÃO LGPD (INLINE)
            // ═══════════════════════════════════════════════════════════════════
            
            // Função de normalização
            $normalize = function($text) {
                $text = mb_strtoupper(trim($text), 'UTF-8');
                $accents = [
                    'Á' => 'A', 'À' => 'A', 'Â' => 'A', 'Ã' => 'A', 'Ä' => 'A',
                    'É' => 'E', 'È' => 'E', 'Ê' => 'E', 'Ë' => 'E',
                    'Í' => 'I', 'Ì' => 'I', 'Î' => 'I', 'Ï' => 'I',
                    'Ó' => 'O', 'Ò' => 'O', 'Ô' => 'O', 'Õ' => 'O', 'Ö' => 'O',
                    'Ú' => 'U', 'Ù' => 'U', 'Û' => 'U', 'Ü' => 'U',
                    'Ç' => 'C', 'Ñ' => 'N'
                ];
                return strtr($text, $accents);
            };
    
            // Normalizar dados informados
            $normalizedFirstName = $normalize($firstName);
            $normalizedLastName  = $normalize($lastName);
    
            // Converter data se vier DD/MM/YYYY
            if (strpos($bornAt, '/') !== false) {
                $parts = explode('/', $bornAt);
                if (count($parts) === 3) {
                    $bornAt = sprintf('%04d-%02d-%02d', $parts[2], $parts[1], $parts[0]);
                }
            }
    
            // Últimos 4 dígitos do telefone
            $mobileDigits = preg_replace('/[^0-9]/', '', $mobile);
            $mobileLast4  = substr($mobileDigits, -4);
    
            // Validar cada paciente
            $validPatient = null;
    
            foreach ($patients as $patient) {
                
                // VALIDAÇÃO 1: Primeiro nome
                $patientFirstNormalized = $normalize($patient['first_name'] ?? '');
                $firstNameMatches = (strpos($patientFirstNormalized, $normalizedFirstName) === 0);
    
                // VALIDAÇÃO 2: Último sobrenome
                $lastNameParts = explode(' ', trim($patient['last_name'] ?? ''));
                $patientLastNormalized = $normalize(end($lastNameParts) ?: '');
                $lastNameMatches = ($patientLastNormalized === $normalizedLastName);
    
                // VALIDAÇÃO 3: Data de nascimento
                $bornAtMatches = true;
                if (!empty($patient['born_at']) && !empty($bornAt)) {
                    $bornAtMatches = ($patient['born_at'] === $bornAt);
                }
    
                // VALIDAÇÃO 4: Telefone (últimos 4 dígitos)
                $patientMobileDigits = preg_replace('/[^0-9]/', '', $patient['mobile'] ?? '');
                $patientMobileLast4  = substr($patientMobileDigits, -4);
                $mobileMatches = ($patientMobileLast4 === $mobileLast4);
    
                // TODAS as validações devem passar
                if ($firstNameMatches && $lastNameMatches && $bornAtMatches && $mobileMatches) {
                    $validPatient = $patient;
                    break;
                }
            }
    
            if (!$validPatient) {
                Response::success([
                    'found' => false,
                    'validation_failed' => true,
                    'message' => 'Os dados informados não conferem com nenhum paciente cadastrado.'
                ]);
                return;
            }
    
            $patientId   = (int) $validPatient['id'];
            $patientName = trim($validPatient['first_name'] . ' ' . $validPatient['last_name']);
            $patientStatus = $validPatient['status'] ?? 'active'; // Para informar no retorno
    
            // ═══════════════════════════════════════════════════════════════════
            // 6. BUSCAR AGENDAMENTOS
            // ═══════════════════════════════════════════════════════════════════
            
            $today      = date('Y-m-d 00:00:00');
            $threeWeeks = date('Y-m-d 23:59:59', strtotime('+3 weeks'));
    
            $sqlAppointments = "SELECT 
                                    a.id,
                                    a.day,
                                    DATE_FORMAT(a.day, '%d/%m/%Y') AS date_formatted,
                                    DATE_FORMAT(a.day, '%H:%i') AS time_formatted,
                                    DATE_FORMAT(a.day, '%W') AS day_of_week_en,
                                    CONCAT(u.first_name, ' ', u.last_name) AS professional_name,
                                    a.status,
                                    a.confirmed
                                FROM app_appointment a
                                INNER JOIN users u ON u.id = a.user
                                WHERE a.patient = ?
                                  AND a.company = ?
                                  AND a.day >= ?
                                  AND a.day <= ?
                                ORDER BY a.day ASC
                                LIMIT ?";
    
            $stmtAppointments = $db->getConnection()->prepare($sqlAppointments);
            $stmtAppointments->execute([
                $patientId,
                $company,
                $today,
                $threeWeeks,
                $limit
            ]);
    
            $appointments = $stmtAppointments->fetchAll(\PDO::FETCH_ASSOC);
            
            // Filtrar manualmente agendamentos cancelados
            if (!empty($appointments)) {
                $appointments = array_filter($appointments, function($apt) {
                    $status = strtolower($apt['status'] ?? '');
                    return !in_array($status, ['canceled', 'cancelled', 'deleted', 'cut', 'close']);
                });
                $appointments = array_values($appointments);
            }
    
            // ═══════════════════════════════════════════════════════════════════
            // 7. FORMATAR AGENDAMENTOS
            // ═══════════════════════════════════════════════════════════════════
            
            $daysTranslation = [
                'Monday'    => 'Segunda-feira',
                'Tuesday'   => 'Terça-feira',
                'Wednesday' => 'Quarta-feira',
                'Thursday'  => 'Quinta-feira',
                'Friday'    => 'Sexta-feira',
                'Saturday'  => 'Sábado',
                'Sunday'    => 'Domingo'
            ];
    
            $formatted = [];
    
            foreach ($appointments as $index => $appointment) {
                $dayOfWeekEn = $appointment['day_of_week_en'] ?? '';
                $dayOfWeekPt = $daysTranslation[$dayOfWeekEn] ?? $dayOfWeekEn;
    
                $formatted[] = [
                    'index' => $index + 1,
                    'id' => (int) $appointment['id'],
                    'date' => $appointment['date_formatted'],
                    'time' => $appointment['time_formatted'],
                    'day_of_week' => $dayOfWeekPt,
                    'professional' => $appointment['professional_name'],
                    'status' => $appointment['status'],
                    'confirmed' => $appointment['confirmed']
                ];
            }
    
            // ═══════════════════════════════════════════════════════════════════
            // 8. RESPOSTA FINAL
            // ═══════════════════════════════════════════════════════════════════
            
            $count = count($formatted);
    
            Response::success([
                'found' => true,
                'validated' => true,
                'patient' => [
                    'id' => $patientId,
                    'name' => $patientName,
                    'status' => $patientStatus  // ✅ Inclui status do paciente
                ],
                'appointments_count' => $count,
                'appointments' => $formatted,
                'message' => $count === 0 
                    ? 'Não há consultas agendadas nas próximas 3 semanas.'
                    : "Encontrei {$count} consulta(s) agendada(s)."
            ]);
    
        } catch (\Exception $e) {
            Response::error(
                'SEARCH_ERROR',
                'Erro ao buscar agendamentos: ' . $e->getMessage(),
                500
            );
        }
    }


    private function validatePatientByLGPDSafe(
        array $patients,
        string $firstName,
        string $lastName,
        ?string $bornAt,
        ?string $mobile
    ): ?array {
    
        $normalize = function ($v) {
            $v = trim(mb_strtoupper($v ?? '', 'UTF-8'));
            return iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $v);
        };
    
        $firstNameNorm = $normalize($firstName);
        $lastNameNorm  = $normalize($lastName);
    
        $bornAtNorm = null;
        if ($bornAt) {
            $bornAtNorm = date('Y-m-d', strtotime(str_replace('/', '-', $bornAt)));
        }
    
        $mobileLast4 = null;
        if ($mobile) {
            $mobileLast4 = substr(preg_replace('/\D/', '', $mobile), -4);
        }
    
        foreach ($patients as $p) {
    
            $pFirst = $normalize($p['first_name'] ?? '');
            $pLast  = $normalize(
                preg_replace('/\s+.*/', '', $p['last_name'] ?? '')
            );
    
            $firstOk = strpos($pFirst, $firstNameNorm) === 0;
            $lastOk  = strpos($pLast, $lastNameNorm) === 0;
    
            $bornOk = true;
            if ($bornAtNorm && !empty($p['born_at'])) {
                $bornOk =
                    date('Y-m-d', strtotime($p['born_at'])) === $bornAtNorm;
            }
    
            $mobileOk = true;
            if ($mobileLast4 && !empty($p['mobile'])) {
                $pMobile4 = substr(
                    preg_replace('/\D/', '', $p['mobile']),
                    -4
                );
                $mobileOk = $pMobile4 === $mobileLast4;
            }
    
            if ($firstOk && $lastOk && $bornOk && $mobileOk) {
                return $p;
            }
        }
    
        return null;
    }
    
    private function formatAppointmentsSafe(array $appointments): array
    {
        $days = [
            'Monday'    => 'Segunda-feira',
            'Tuesday'   => 'Terça-feira',
            'Wednesday' => 'Quarta-feira',
            'Thursday'  => 'Quinta-feira',
            'Friday'    => 'Sexta-feira',
            'Saturday'  => 'Sábado',
            'Sunday'    => 'Domingo'
        ];
    
        $result = [];
    
        foreach ($appointments as $i => $a) {
            $result[] = [
                'index'        => $i + 1,
                'id'           => (int)($a['id'] ?? 0),
                'date'         => $a['date_formatted'] ?? null,
                'time'         => $a['time_formatted'] ?? null,
                'day_of_week'  => $days[$a['day_of_week_en'] ?? ''] ?? null,
                'professional' => $a['professional_name'] ?? null,
                'status'       => $a['status'] ?? null,
                'confirmed'    => $a['confirmed'] ?? null
            ];
        }
    
        return $result;
    }
}
