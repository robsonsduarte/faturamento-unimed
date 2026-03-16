<?php
namespace API\Controllers;

use API\Middleware\AuthMiddleware;
use API\Helpers\Response;

class BiometryController
{
    private $auth;
    
    public function __construct()
    {
        $this->auth = new AuthMiddleware();
    }
    
    /**
     * Retorna conexão PDO padrão
     */
    private function getConnection()
    {
        $config = require __DIR__ . '/../../../../biometria/config/database.php';
        
        return new \PDO(
            "mysql:host={$config['host']};dbname={$config['database']};charset={$config['charset']}",
            $config['username'],
            $config['password'],
            $config['options']
        );
    }
    
    /**
     * GET /biometry/photo/{guide_number}?company={id}
     * Busca foto e dados de consentimento de uma guia
     */
    public function getPhoto($params)
    {
        try {
            // Validar API Key
            $company = $_GET['company'] ?? null;
            $apiKeyData = $this->auth->validate($company);
            if (!$apiKeyData) {
                return;
            }
            
            $guideNumber = $params['guide_number'] ?? null;
            
            if (!$guideNumber) {
                Response::error('GUIDE_REQUIRED', 'Número da guia é obrigatório', 400);
                return;
            }
            
            $pdo = $this->getConnection();
            
            // ✅ TABELA CORRETA: app_biometry_sessions
            // ✅ COLUNA CORRETA: status (não biometry_status)
            // ✅ STATUS CORRETO: photo_received (não photo_captured)
            $sql = "
                SELECT 
                    id,
                    guide_number,
                    photo_path,
                    consent_timestamp,
                    consent_ip,
                    status,
                    photo_captured_at,
                    patient_name
                FROM app_biometry_sessions
                WHERE guide_number = ?
                  AND company = ?
                  AND status IN ('photo_received', 'analyzing_photo', 'executing_saw', 'completed')
                  AND photo_path IS NOT NULL
                ORDER BY created_at DESC
                LIMIT 1
            ";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$guideNumber, $company]);
            $data = $stmt->fetch(\PDO::FETCH_ASSOC);
            
            if (!$data) {
                Response::error('PHOTO_NOT_FOUND', 'Foto não encontrada ou biometria não realizada', 404);
                return;
            }
            
            // Construir caminho completo do arquivo
            // photo_path vem como: "/biometria/uploads/biometry/guia_X_timestamp.jpg"
            $photoPath = $_SERVER['DOCUMENT_ROOT'] . $data['photo_path'];
            
            if (!file_exists($photoPath)) {
                error_log("Arquivo não encontrado: {$photoPath}");
                Response::error('FILE_NOT_FOUND', 'Arquivo de foto não encontrado no servidor', 404);
                return;
            }
            
            $photoBase64 = base64_encode(file_get_contents($photoPath));
            
            Response::success([
                'guide_number' => $data['guide_number'],
                'photo_base64' => $photoBase64,
                'photo_path' => $data['photo_path'],
                'patient_name' => $data['patient_name'],
                'consent_data' => [
                    'consent_timestamp' => $data['consent_timestamp'],
                    'consent_ip' => $data['consent_ip'],
                    'status' => $data['status'],
                    'photo_captured_at' => $data['photo_captured_at']
                ]
            ]);
            
            error_log("Foto recuperada com sucesso - Guia: {$guideNumber}");
            
        } catch (\Exception $e) {
            error_log("Erro ao buscar foto: " . $e->getMessage());
            Response::error('INTERNAL_ERROR', $e->getMessage(), 500);
        }
    }
    
    /**
     * PUT /biometry/status/{guide_number}?company={id}
     * Atualiza status da biometria
     */
    public function updateStatus($params)
    {
        try {
            // Validar API Key
            $company = $_GET['company'] ?? null;
            $apiKeyData = $this->auth->validate($company);
            if (!$apiKeyData) {
                return;
            }
            
            $guideNumber = $params['guide_number'] ?? null;
            $body = json_decode(file_get_contents('php://input'), true);
            
            if (!$guideNumber) {
                Response::error('GUIDE_REQUIRED', 'Número da guia é obrigatório', 400);
                return;
            }
            
            $status = $body['status'] ?? null;
            $attempts = $body['attempts'] ?? null;
            
            if (!$status) {
                Response::error('STATUS_REQUIRED', 'Status é obrigatório', 400);
                return;
            }
            
            $pdo = $this->getConnection();
            
            $sets = ["biometry_status = ?"];
            $values = [$status];
            
            if ($attempts !== null) {
                $sets[] = "biometry_attempts = ?";
                $values[] = $attempts;
            }
            
            if ($status === 'success') {
                $sets[] = "biometry_validated_at = NOW()";
            }
            
            $sets[] = "biometry_last_attempt = NOW()";
            $values[] = $guideNumber;
            $values[] = $company;
            
            $sql = "UPDATE app_executions SET " . implode(", ", $sets) . " WHERE guide_number = ? AND company = ?";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute($values);
            
            Response::success([
                'guide_number' => $guideNumber,
                'status' => $status,
                'updated' => true
            ]);
            
        } catch (\Exception $e) {
            Response::error('INTERNAL_ERROR', $e->getMessage(), 500);
        }
    }
    

    /**
     * GET /biometry/link/{guide_number}?company={id}
     * Gera URL de captura biométrica para o paciente
     */
    public function generateLink($params)
    {
        try {
            // Validar API Key
            $company = $_GET['company'] ?? null;
            $apiKeyData = $this->auth->validate($company);
            if (!$apiKeyData) {
                return;
            }
            
            $guideNumber = $params['guide_number'] ?? null;
            
            if (!$guideNumber) {
                Response::error('GUIDE_REQUIRED', 'Número da guia é obrigatório', 400);
                return;
            }
            
            $pdo = $this->getConnection();
            
            // Buscar guia e token (hash do appointment)
            $sql = "
                SELECT 
                    e.id as execution_id,
                    e.guide_number,
                    e.biometry_status,
                    a.hash as token,
                    a.day as appointment_date,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    p.mobile as patient_mobile
                FROM app_executions e
                INNER JOIN app_appointment a ON (
                    a.patient = e.patient 
                    AND a.user = e.user 
                    AND DATE(a.day) = DATE(e.appointment_day)
                    AND a.company = e.company
                )
                INNER JOIN app_patient p ON p.id = e.patient
                WHERE e.guide_number = ?
                  AND e.company = ?
                  AND e.deleted IS NULL
                  AND a.deleted IS NULL
                ORDER BY a.day DESC
                LIMIT 1
            ";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$guideNumber, $company]);
            $data = $stmt->fetch(\PDO::FETCH_ASSOC);
            
            if (!$data) {
                Response::error('GUIDE_NOT_FOUND', 'Guia não encontrada ou sem agendamento vinculado', 404);
                return;
            }
            
            if (!$data['token']) {
                Response::error('TOKEN_NOT_FOUND', 'Token de agendamento não encontrado', 404);
                return;
            }
            
            // Gerar URL
            $baseUrl = 'https://consultoriopro.com.br/biometria';
            $url = "{$baseUrl}/?guia={$guideNumber}&token={$data['token']}";
            
            Response::success([
                'guide_number' => $guideNumber,
                'token' => $data['token'],
                'url' => $url,
                'patient_name' => trim($data['patient_first_name'] . ' ' . $data['patient_last_name']),
                'patient_mobile' => $data['patient_mobile'],
                'appointment_date' => $data['appointment_date'],
                'biometry_status' => $data['biometry_status']
            ]);
            
        } catch (\Exception $e) {
            Response::error('INTERNAL_ERROR', $e->getMessage(), 500);
        }
    }

    /**
     * POST /biometry/session
     * Cria nova sessão de biometria
     */
    public function createSession($params)
    {
        try {
            // Validar API Key (sem company obrigatório para sessões)
            $company = $_GET['company'] ?? null;
            $apiKeyData = $this->auth->validate($company);
            if (!$apiKeyData) {
                return;
            }

            // Pegar dados do body
            $input = json_decode(file_get_contents('php://input'), true);

            if (!$input || empty($input['chat_id'])) {
                Response::error('MISSING_PARAM', 'chat_id é obrigatório', 400);
                return;
            }

            $pdo = $this->getConnection();

            // Inserir nova sessão
            $sql = "INSERT INTO app_biometry_sessions 
                    (chat_id, operator_id, operator_name, guide_number, status)
                    VALUES (?, ?, ?, ?, 'started')";

            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                $input['chat_id'],
                $input['operator_id'] ?? null,
                $input['operator_name'] ?? null,
                $input['guide_number'] ?? null
            ]);

            $sessionId = $pdo->lastInsertId();

            Response::success([
                'created' => true,
                'session_id' => (int)$sessionId,
                'chat_id' => $input['chat_id'],
                'status' => 'started'
            ]);

        } catch (\Exception $e) {
            Response::error('INTERNAL_ERROR', $e->getMessage(), 500);
        }
    }

    /**
     * GET /biometry/session/{guide_number}
     * Busca sessão ativa de biometria por número da guia
     */
    public function getSession($params)
    {
        try {
            // Validar API Key
            $company = $_GET['company'] ?? null;
            $apiKeyData = $this->auth->validate($company);
            if (!$apiKeyData) {
                return;
            }

            $guideNumber = $params['guide_number'] ?? null;

            if (!$guideNumber) {
                Response::error('MISSING_PARAM', 'guide_number é obrigatório', 400);
                return;
            }

            $pdo = $this->getConnection();

            $sql = "SELECT 
                        id,
                        chat_id,
                        operator_id,
                        operator_name,
                        guide_number,
                        patient_name,
                        professional_name,
                        appointment_date,
                        biometry_link,
                        status,
                        photo_attempts,
                        saw_attempts,
                        error_message,
                        created_at,
                        updated_at,
                        photo_captured_at
                    FROM app_biometry_sessions
                    WHERE guide_number = ?
                    AND status IN ('started', 'waiting_guide', 'validating_guide', 
                                   'link_sent', 'waiting_photo', 'photo_received',
                                   'analyzing_photo', 'photo_invalid', 'executing_saw',
                                   'verifying_result')
                    ORDER BY created_at DESC
                    LIMIT 1";

            $stmt = $pdo->prepare($sql);
            $stmt->execute([$guideNumber]);
            $session = $stmt->fetch(\PDO::FETCH_ASSOC);

            if (!$session) {
                Response::error('SESSION_NOT_FOUND', 'Nenhuma sessão ativa encontrada para esta guia', 404);
                return;
            }

            Response::success([
                'session' => $session
            ]);

        } catch (\Exception $e) {
            Response::error('INTERNAL_ERROR', $e->getMessage(), 500);
        }
    }

    /**
     * PUT /biometry/session/{guide_number}
     * Atualiza status e dados da sessão
     */
    public function updateSession($params)
    {
        try {
            // Validar API Key
            $company = $_GET['company'] ?? null;
            $apiKeyData = $this->auth->validate($company);
            if (!$apiKeyData) {
                return;
            }

            $guideNumber = $params['guide_number'] ?? null;

            if (!$guideNumber) {
                Response::error('MISSING_PARAM', 'guide_number é obrigatório', 400);
                return;
            }

            // Pegar dados do body
            $input = json_decode(file_get_contents('php://input'), true);

            if (!$input || empty($input['status'])) {
                Response::error('MISSING_PARAM', 'status é obrigatório no body', 400);
                return;
            }

            // Validar status permitido
            $allowedStatus = [
                'started', 'waiting_guide', 'validating_guide', 'link_sent',
                'waiting_photo', 'photo_received', 'analyzing_photo', 'photo_invalid',
                'executing_saw', 'verifying_result', 'completed', 'failed', 
                'timeout', 'cancelled'
            ];

            if (!in_array($input['status'], $allowedStatus)) {
                Response::error('INVALID_STATUS', 'Status inválido: ' . $input['status'], 400);
                return;
            }

            $pdo = $this->getConnection();

            // Montar query dinâmica baseada nos campos enviados
            $updates = ['status = ?'];
            $values = [$input['status']];

            // Campos opcionais
            $optionalFields = [
                'patient_name' => 'patient_name',
                'professional_name' => 'professional_name',
                'appointment_date' => 'appointment_date',
                'biometry_link' => 'biometry_link',
                'photo_path' => 'photo_path',
                'error_message' => 'error_message',
                'saw_result' => 'saw_result'
            ];

            foreach ($optionalFields as $inputKey => $dbField) {
                if (isset($input[$inputKey])) {
                    $updates[] = "{$dbField} = ?";
                    $values[] = $input[$inputKey];
                }
            }

            // Incrementar contadores se solicitado
            if (!empty($input['increment_photo_attempts'])) {
                $updates[] = "photo_attempts = photo_attempts + 1";
            }
            if (!empty($input['increment_saw_attempts'])) {
                $updates[] = "saw_attempts = saw_attempts + 1";
            }

            // Timestamps especiais
            if ($input['status'] === 'photo_received') {
                $updates[] = "photo_captured_at = NOW()";
            }
            if (in_array($input['status'], ['completed', 'failed', 'timeout', 'cancelled'])) {
                $updates[] = "completed_at = NOW()";
            }

            // Adicionar guide_number ao final dos values
            $values[] = $guideNumber;

            $sql = "UPDATE app_biometry_sessions 
                    SET " . implode(', ', $updates) . "
                    WHERE guide_number = ?
                    AND status NOT IN ('completed', 'failed', 'timeout', 'cancelled')
                    ORDER BY created_at DESC
                    LIMIT 1";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($values);

            $affected = $stmt->rowCount();

            if ($affected === 0) {
                Response::error('SESSION_NOT_FOUND', 'Nenhuma sessão ativa encontrada para atualizar', 404);
                return;
            }

            Response::success([
                'updated' => true,
                'guide_number' => $guideNumber,
                'new_status' => $input['status']
            ]);

        } catch (\Exception $e) {
            Response::error('INTERNAL_ERROR', $e->getMessage(), 500);
        }
    }
    
    /**
     * PUT /biometry/session/chat/{chat_id}
     * Atualiza sessão por chat_id (quando ainda não tem guide_number)
     */
    public function updateSessionByChat($params)
    {
        try {
            // Validar API Key
            $company = $_GET['company'] ?? null;
            $apiKeyData = $this->auth->validate($company);
            if (!$apiKeyData) {
                return;
            }

            $chatId = $params['chat_id'] ?? null;

            if (!$chatId) {
                Response::error('MISSING_PARAM', 'chat_id é obrigatório', 400);
                return;
            }

            // Pegar dados do body
            $input = json_decode(file_get_contents('php://input'), true);

            if (!$input) {
                Response::error('MISSING_PARAM', 'Body JSON é obrigatório', 400);
                return;
            }

            $pdo = $this->getConnection();

            // Montar query dinâmica
            $updates = [];
            $values = [];

            // Campos permitidos
            $allowedFields = [
                'status', 'guide_number', 'patient_name', 'professional_name',
                'appointment_date', 'biometry_link', 'photo_path', 
                'error_message', 'saw_result'
            ];

            foreach ($allowedFields as $field) {
                if (isset($input[$field])) {
                    $updates[] = "{$field} = ?";
                    $values[] = $input[$field];
                }
            }

            if (empty($updates)) {
                Response::error('MISSING_PARAM', 'Nenhum campo para atualizar', 400);
                return;
            }

            // Incrementar contadores se solicitado
            if (!empty($input['increment_photo_attempts'])) {
                $updates[] = "photo_attempts = photo_attempts + 1";
            }
            if (!empty($input['increment_saw_attempts'])) {
                $updates[] = "saw_attempts = saw_attempts + 1";
            }

            // Timestamps especiais
            if (isset($input['status'])) {
                if ($input['status'] === 'photo_received') {
                    $updates[] = "photo_captured_at = NOW()";
                }
                if (in_array($input['status'], ['completed', 'failed', 'timeout', 'cancelled'])) {
                    $updates[] = "completed_at = NOW()";
                }
            }

            $values[] = $chatId;

            $sql = "UPDATE app_biometry_sessions 
                    SET " . implode(', ', $updates) . "
                    WHERE chat_id = ?
                    AND status NOT IN ('completed', 'failed', 'timeout', 'cancelled')
                    ORDER BY created_at DESC
                    LIMIT 1";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($values);

            $affected = $stmt->rowCount();

            if ($affected === 0) {
                Response::error('SESSION_NOT_FOUND', 'Nenhuma sessão ativa encontrada para este chat', 404);
                return;
            }

            Response::success([
                'updated' => true,
                'chat_id' => $chatId,
                'fields_updated' => array_keys(array_intersect_key($input, array_flip($allowedFields)))
            ]);

        } catch (\Exception $e) {
            Response::error('INTERNAL_ERROR', $e->getMessage(), 500);
        }
    }
    
    // ============================================================
    // NOVOS MÉTODOS - Estrutura Evoluída (validation_type, LGPD, etc)
    // ============================================================
    
    /**
     * POST /biometry/v2/sessions
     * Cria sessão com estrutura completa (validation_type, company, patient, etc)
     */
    public function createSessionV2($params)
    {
        try {
            $company = $_GET['company'] ?? null;
            $apiKeyData = $this->auth->validate($company);
            if (!$apiKeyData) {
                return;
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            
            // Validações obrigatórias
            if (!$input || empty($input['company']) || empty($input['patient'])) {
                Response::error('MISSING_PARAMS', 'company e patient são obrigatórios', 400);
                return;
            }
            
            if (empty($input['validation_type']) || !in_array($input['validation_type'], ['pre_authorization', 'billing_validation'])) {
                Response::error('INVALID_VALIDATION_TYPE', 'validation_type deve ser pre_authorization ou billing_validation', 400);
                return;
            }
            
            // Gerar token único
            $token = bin2hex(random_bytes(16));
            
            // Calcular expires_at (2 dias padrão)
            $expiresAt = date('Y-m-d H:i:s', strtotime('+2 days'));
            
            $model = new \API\Models\BiometrySession();
            
            $data = [
                'company' => $input['company'],
                'patient' => $input['patient'],
                'validation_type' => $input['validation_type'],
                'chat_id' => $input['chat_id'] ?? null,
                'token' => $token,
                'operator_id' => $input['operator_id'] ?? null,
                'operator_name' => $input['operator_name'] ?? null,
                'guide_number' => $input['guide_number'] ?? null,
                'patient_name' => $input['patient_name'] ?? null,
                'professional_name' => $input['professional_name'] ?? null,
                'appointment_date' => $input['appointment_date'] ?? null,
                'appointment_id' => $input['appointment_id'] ?? null,
                'execution_id' => $input['execution_id'] ?? null,
                'max_attempts' => $input['max_attempts'] ?? 3,
                'expires_at' => $expiresAt,
                'status' => 'started'
            ];
            
            // Gerar biometry_link se tiver guide_number
            if (!empty($input['guide_number'])) {
                $baseUrl = 'https://consultoriopro.com.br/biometria';
                $data['biometry_link'] = "{$baseUrl}/?guia={$input['guide_number']}&token={$token}";
            }
            
            $result = $model->insert($data);
            
            if (!$result) {
                Response::error('INSERT_FAILED', 'Erro ao criar sessão', 500);
                return;
            }
            
            $sessionId = $model->getLastInsertId();
            
            Response::success([
                'created' => true,
                'session_id' => (int)$sessionId,
                'token' => $token,
                'validation_type' => $input['validation_type'],
                'biometry_link' => $data['biometry_link'] ?? null,
                'expires_at' => $expiresAt
            ], 201);
            
        } catch (\Exception $e) {
            Response::error('INTERNAL_ERROR', $e->getMessage(), 500);
        }
    }
    
    /**
     * POST /biometry/v2/sessions/{id}/consent
     * Registra consentimento LGPD
     */
    public function recordConsent($params)
    {
        try {
            $company = $_GET['company'] ?? null;
            $apiKeyData = $this->auth->validate($company);
            if (!$apiKeyData) {
                return;
            }
            
            $sessionId = $params['id'] ?? null;
            
            if (!$sessionId) {
                Response::error('MISSING_PARAM', 'session_id é obrigatório', 400);
                return;
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!$input || empty($input['consent_text'])) {
                Response::error('MISSING_PARAM', 'consent_text é obrigatório', 400);
                return;
            }
            
            $model = new \API\Models\BiometrySession();
            
            // Verificar se sessão existe
            $session = $model->find($sessionId);
            if (!$session) {
                Response::error('SESSION_NOT_FOUND', 'Sessão não encontrada', 404);
                return;
            }
            
            $consentData = [
                'text' => $input['consent_text'],
                'ip' => $_SERVER['REMOTE_ADDR'] ?? $input['ip'] ?? null,
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? $input['user_agent'] ?? null
            ];
            
            $result = $model->recordConsent($sessionId, $consentData);
            
            if (!$result) {
                Response::error('UPDATE_FAILED', 'Erro ao registrar consentimento', 500);
                return;
            }
            
            Response::success([
                'consent_recorded' => true,
                'session_id' => (int)$sessionId,
                'timestamp' => date('Y-m-d H:i:s')
            ]);
            
        } catch (\Exception $e) {
            Response::error('INTERNAL_ERROR', $e->getMessage(), 500);
        }
    }
    
    /**
     * PUT /biometry/v2/sessions/{id}/validation
     * Atualiza resultado de validação (approved/rejected/error)
     */
    public function updateValidation($params)
    {
        try {
            $company = $_GET['company'] ?? null;
            $apiKeyData = $this->auth->validate($company);
            if (!$apiKeyData) {
                return;
            }
            
            $sessionId = $params['id'] ?? null;
            
            if (!$sessionId) {
                Response::error('MISSING_PARAM', 'session_id é obrigatório', 400);
                return;
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!$input || empty($input['validation_result'])) {
                Response::error('MISSING_PARAM', 'validation_result é obrigatório', 400);
                return;
            }
            
            if (!in_array($input['validation_result'], ['approved', 'rejected', 'error'])) {
                Response::error('INVALID_RESULT', 'validation_result deve ser approved, rejected ou error', 400);
                return;
            }
            
            $model = new \API\Models\BiometrySession();
            
            // Verificar se sessão existe
            $session = $model->find($sessionId);
            if (!$session) {
                Response::error('SESSION_NOT_FOUND', 'Sessão não encontrada', 404);
                return;
            }
            
            $result = $model->recordValidation(
                $sessionId, 
                $input['validation_result'],
                $input['validation_message'] ?? null
            );
            
            if (!$result) {
                Response::error('UPDATE_FAILED', 'Erro ao atualizar validação', 500);
                return;
            }
            
            Response::success([
                'validation_updated' => true,
                'session_id' => (int)$sessionId,
                'validation_result' => $input['validation_result'],
                'status' => $input['validation_result'] === 'approved' ? 'completed' : 'failed'
            ]);
            
        } catch (\Exception $e) {
            Response::error('INTERNAL_ERROR', $e->getMessage(), 500);
        }
    }
    
    /**
     * GET /biometry/v2/sessions/reusable-photo?company={id}&patient={id}
     * Busca foto reutilizável de sessão anterior
     */
    public function getReusablePhoto($params)
    {
        try {
            $company = $_GET['company'] ?? null;
            $patient = $_GET['patient'] ?? null;
            $maxDays = $_GET['max_days'] ?? 30;
            
            $apiKeyData = $this->auth->validate($company);
            if (!$apiKeyData) {
                return;
            }
            
            if (!$patient) {
                Response::error('MISSING_PARAM', 'patient é obrigatório', 400);
                return;
            }
            
            $model = new \API\Models\BiometrySession();
            $session = $model->findReusablePhoto($patient, $company, $maxDays);
            
            if (!$session) {
                Response::error('PHOTO_NOT_FOUND', 'Nenhuma foto reutilizável encontrada', 404);
                return;
            }
            
            Response::success([
                'reusable' => true,
                'session_id' => (int)$session['id'],
                'photo_path' => $session['photo_path'],
                'photo_captured_at' => $session['photo_captured_at'],
                'validated_at' => $session['validated_at'],
                'validation_type' => $session['validation_type']
            ]);
            
        } catch (\Exception $e) {
            Response::error('INTERNAL_ERROR', $e->getMessage(), 500);
        }
    }
    
    /**
     * GET /biometry/v2/sessions/pending?company={id}
     * Lista sessões pendentes por empresa
     */
    public function listPendingSessions($params)
    {
        try {
            $company = $_GET['company'] ?? null;
            $limit = $_GET['limit'] ?? 50;
            
            $apiKeyData = $this->auth->validate($company);
            if (!$apiKeyData) {
                return;
            }
            
            $model = new \API\Models\BiometrySession();
            $sessions = $model->listPending($company, $limit);
            
            Response::success([
                'sessions' => $sessions,
                'total' => count($sessions),
                'company' => (int)$company
            ]);
            
        } catch (\Exception $e) {
            Response::error('INTERNAL_ERROR', $e->getMessage(), 500);
        }
    }
    
    /**
     * GET /biometry/v2/stats?company={id}
     * Estatísticas de taxa de sucesso
     */
    public function getStats($params)
    {
        try {
            $company = $_GET['company'] ?? null;
            $validationType = $_GET['validation_type'] ?? null;
            
            $apiKeyData = $this->auth->validate($company);
            if (!$apiKeyData) {
                return;
            }
            
            $model = new \API\Models\BiometrySession();
            $stats = $model->getSuccessRate($company, $validationType);
            
            Response::success([
                'statistics' => $stats,
                'company' => (int)$company,
                'validation_type' => $validationType
            ]);
            
        } catch (\Exception $e) {
            Response::error('INTERNAL_ERROR', $e->getMessage(), 500);
        }
    }
    
    /**
     * GET /biometry/v2/sessions/by-appointment/{appointment_id}?company={id}
     * Busca sessão por appointment_id
     */
    public function getSessionByAppointment($params)
    {
        try {
            $company = $_GET['company'] ?? null;
            $appointmentId = $params['appointment_id'] ?? null;
            
            $apiKeyData = $this->auth->validate($company);
            if (!$apiKeyData) {
                return;
            }
            
            if (!$appointmentId) {
                Response::error('MISSING_PARAM', 'appointment_id é obrigatório', 400);
                return;
            }
            
            $model = new \API\Models\BiometrySession();
            $session = $model->findByAppointment($appointmentId, $company);
            
            if (!$session) {
                Response::error('SESSION_NOT_FOUND', 'Sessão não encontrada', 404);
                return;
            }
            
            Response::success([
                'session' => $session
            ]);
            
        } catch (\Exception $e) {
            Response::error('INTERNAL_ERROR', $e->getMessage(), 500);
        }
    }
    
    /**
     * GET /biometry/v2/sessions/by-execution/{execution_id}?company={id}
     * Busca sessão por execution_id
     */
    public function getSessionByExecution($params)
    {
        try {
            $company = $_GET['company'] ?? null;
            $executionId = $params['execution_id'] ?? null;
            
            $apiKeyData = $this->auth->validate($company);
            if (!$apiKeyData) {
                return;
            }
            
            if (!$executionId) {
                Response::error('MISSING_PARAM', 'execution_id é obrigatório', 400);
                return;
            }
            
            $model = new \API\Models\BiometrySession();
            $session = $model->findByExecution($executionId, $company);
            
            if (!$session) {
                Response::error('SESSION_NOT_FOUND', 'Sessão não encontrada', 404);
                return;
            }
            
            Response::success([
                'session' => $session
            ]);
            
        } catch (\Exception $e) {
            Response::error('INTERNAL_ERROR', $e->getMessage(), 500);
        }
    }
    
    /**
     * GET /biometry/session/chat/{chat_id}?company={id}
     * Busca sessão de biometria por chat_id
     */
    public function getSessionByChat($request)
    {
        try {
            // Validar API Key
            $company = $request['company'] ?? $_GET['company'] ?? null;
            $apiKeyData = $this->auth->validate($company);
            if (!$apiKeyData) {
                return;
            }
    
            $chatId = $request['chat_id'] ?? null;
    
            if (!$chatId) {
                Response::error('MISSING_PARAM', 'chat_id é obrigatório', 400);
                return;
            }
    
            $pdo = $this->getConnection();
    
            // Buscar todas as colunas disponíveis
            $sql = "SELECT *
                    FROM app_biometry_sessions
                    WHERE chat_id = ?
                      AND company = ?
                    ORDER BY updated_at DESC
                    LIMIT 1";
    
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$chatId, $company]);
            $session = $stmt->fetch(\PDO::FETCH_ASSOC);
    
            if (!$session) {
                Response::success([
                    'success' => false,
                    'message' => 'Nenhuma sessão encontrada para este chat',
                    'chat_id' => $chatId
                ]);
                return;
            }
    
            // Remover photo_base64 se existir (campo muito grande)
            unset($session['photo_base64']);
    
            Response::success([
                'success' => true,
                'data' => $session
            ]);
    
        } catch (\Exception $e) {
            error_log("Erro ao buscar sessão por chat_id: " . $e->getMessage());
            Response::error('INTERNAL_ERROR', $e->getMessage(), 500);
        }
    }
}