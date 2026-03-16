<?php
namespace API\Controllers;

use API\Models\Historic;
use API\Models\Appointment;
use API\Helpers\Response;
use API\Helpers\Validator;
use API\Middleware\AuthMiddleware;

class HistoricController
{
    private $historicModel;
    private $appointmentModel;
    private $auth;
    private $uploadDir = '/home2/consult6/public_html/storage/historic/';

    public function __construct()
    {
        $this->historicModel = new Historic();
        $this->appointmentModel = new Appointment();
        $this->auth = new AuthMiddleware();
        
        // Criar diretório se não existir
        if (!is_dir($this->uploadDir)) {
            mkdir($this->uploadDir, 0755, true);
        }
    }

    /**
     * POST /historic
     * Upload de documento (encaminhamento médico)
     */
    public function upload($data)
    {
        $validator = new Validator($data);
        $validator->required('company')
                  ->required('patient')
                  ->required('patient_name')
                  ->required('user');
    
        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }
    
        $apiKeyData = $this->auth->validate($data['company']);
        if (!$apiKeyData) {
            return Response::error('Unauthorized', 401);
        }
    
        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            return Response::error('No file uploaded', 400);
        }
        
        $file = $_FILES['file'];
        $maxSize = 10 * 1024 * 1024;
        
        if ($file['size'] > $maxSize) {
            return Response::error('File too large. Max 10MB', 400);
        }
        
        try {
            // Buscar sub_of via query direta
            $db = \API\Config\Database::getInstance();
            $stmt = $db->getConnection()->prepare("SELECT sub_of FROM users WHERE id = ? LIMIT 1");
            $stmt->execute([$data['user']]);
            $professional = $stmt->fetch(\PDO::FETCH_ASSOC);
            
            if (!$professional || !$professional['sub_of']) {
                return Response::error('Professional not found', 404);
            }
            
            $statusAuthor = $professional['sub_of'];
        
            // Buscar admins
            $stmt = $db->getConnection()->prepare("SELECT id FROM users WHERE level >= 9 AND active = 'yes'");
            $stmt->execute();
            $admins = $stmt->fetchAll(\PDO::FETCH_ASSOC);
            
            $adminIds = array_column($admins, 'id');
            
            $openViewWith = $data['user'];
            if (!empty($adminIds)) {
                $openViewWith .= ',' . implode(',', $adminIds);
            }
        
            // Detecta MIME real
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mimeType = finfo_file($finfo, $file['tmp_name']);
            finfo_close($finfo);
        
            $mimeMap = [
                'application/pdf' => ['ext' => 'pdf', 'type' => 'file'],
                'image/jpeg' => ['ext' => 'jpg', 'type' => 'image'],
                'image/png' => ['ext' => 'png', 'type' => 'image']
            ];
        
            if (!isset($mimeMap[$mimeType])) {
                return Response::error('Invalid file type: ' . $mimeType, 400);
            }
        
            $extension = $mimeMap[$mimeType]['ext'];
            $type = $mimeMap[$mimeType]['type'];
        
            $yearMonth = date('Y/m');
            $uploadPath = $this->uploadDir . $yearMonth . '/';
            
            if (!is_dir($uploadPath)) {
                mkdir($uploadPath, 0755, true);
            }
        
            $fileName = 'encaminhamento_' . time() . '.' . $extension;
            $filePath = $uploadPath . $fileName;
        
            if (!move_uploaded_file($file['tmp_name'], $filePath)) {
                return Response::error('Failed to save file', 500);
            }
    
            $historicData = [
                'company' => $data['company'],
                'patient' => $data['patient'],
                'user' => $data['user'],
                'type' => $type,
                'title' => 'Encaminhamento de ' . $data['patient_name'],
                'content' => 'Encaminhamento enviado por B-IA Ia da Dedicare, em ' . date('d/m/Y H:i'),
                'file' => 'historic/' . $yearMonth . '/' . $fileName,
                'url' => '/storage/historic/' . $yearMonth . '/' . $fileName,
                'open_view' => 'yes',
                'open_view_with' => $openViewWith,
                'hash' => bin2hex(random_bytes(12)),
                'password' => $this->generatePassword(6),
                'status' => 'active',
                'status_author' => $statusAuthor,
                'share_patient' => 'no'
            ];
    
            $historicId = $this->historicModel->insert($historicData);
    
            if (!$historicId) {
                unlink($filePath);
                return Response::error('Failed to create record', 500);
            }
    
            return Response::success([
                'historic_id' => $historicId,
                'type' => $type,
                'file_name' => $fileName,
                'message' => 'Encaminhamento salvo com sucesso'
            ], 201);
    
        } catch (\Exception $e) {
            return Response::error('Error: ' . $e->getMessage(), 500);
        }
    }
    
        public function uploadBase64($data)
    {
        $validator = new Validator($data);
        $validator->required('company')
                  ->required('patient')
                  ->required('patient_name')
                  ->required('user')
                  ->required('file_base64')
                  ->required('file_name');
    
        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }
    
        // Decodifica base64
        $fileData = base64_decode($data['file_base64']);
        if (!$fileData) {
            return Response::error('Invalid base64', 400);
        }
    
        // Salva temporariamente para detectar MIME
        $tmpFile = tempnam(sys_get_temp_dir(), 'upload_');
        file_put_contents($tmpFile, $fileData);
    
        // Simula $_FILES
        $_FILES['file'] = [
            'tmp_name' => $tmpFile,
            'name' => $data['file_name'],
            'size' => strlen($fileData),
            'error' => UPLOAD_ERR_OK
        ];
    
        // Chama método upload() existente
        $result = $this->upload($data);
    
        // Limpa
        unlink($tmpFile);
    
        return $result;
    }
    
    private function generatePassword($length = 6)
    {
        $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        return substr(str_shuffle($chars), 0, $length);
    }

    /**
     * GET /historic/{id}
     * Buscar documento com ACL
     */
    public function show($id)
    {
        $params = array_merge($_GET, ['id' => $id]);
        
        $validator = new Validator($params);
        $validator->required('id')->required('company')->required('user_id');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        $apiKeyData = $this->auth->validate($params['company']);
        if (!$apiKeyData) {
            return Response::error('Unauthorized', 401);
        }

        try {
            $historic = $this->historicModel->find($id);

            if (!$historic || $historic['company'] != $params['company']) {
                return Response::error('Document not found', 404);
            }

            // ACL: verificar se usuário pode acessar
            $canAccess = $this->checkAccess($historic, $params['user_id'], $params['company']);

            if (!$canAccess) {
                return Response::error('Access denied', 403);
            }

            return Response::success(['historic' => $historic]);

        } catch (\Exception $e) {
            return Response::error('Error: ' . $e->getMessage(), 500);
        }
    }

    /**
     * GET /historic/by-appointment/{appointment_id}
     */
    public function getByAppointment($appointmentId)
    {
        $params = array_merge($_GET, ['appointment_id' => $appointmentId]);
        
        $validator = new Validator($params);
        $validator->required('appointment_id')->required('company');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        $apiKeyData = $this->auth->validate($params['company']);
        if (!$apiKeyData) {
            return Response::error('Unauthorized', 401);
        }

        try {
            $documents = $this->historicModel->getByAppointment($appointmentId);

            return Response::success([
                'documents' => $documents,
                'total' => count($documents)
            ]);

        } catch (\Exception $e) {
            return Response::error('Error: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Verifica se usuário pode acessar documento
     */
    private function checkAccess($historic, $userId, $companyId)
    {
        // Buscar dados do usuário
        $userSql = "SELECT role FROM users WHERE id = ? AND company_id = ?";
        $user = $this->historicModel->fetchOne($userSql, [$userId, $companyId]);

        if (!$user) {
            return false;
        }

        // Recepção tem acesso total
        if (in_array($user['role'], ['admin', 'receptionist', 'manager'])) {
            return true;
        }

        // Profissional só acessa se for dele
        if ($user['role'] === 'professional' && $historic['user'] == $userId) {
            return true;
        }

        return false;
    }

    /**
     * Vincula documento ao agendamento
     */
    private function linkToAppointment($historicId, $appointmentId)
    {
        // Atualiza campo content com metadado
        $sql = "UPDATE app_historic 
                SET content = CONCAT(content, ' [appointment_id:', ?, ']')
                WHERE id = ?";
        
        $this->historicModel->query($sql, [$appointmentId, $historicId]);
    }
    
    public function saveDriveDocument($data)
    {
        $validator = new Validator($data);
        $validator->required('company')
                  ->required('patient')
                  ->required('patient_name')
                  ->required('user')
                  ->required('drive_url')
                  ->required('drive_id')
                  ->required('thumbnail');
    
        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }
    
        $apiKeyData = $this->auth->validate($data['company']);
        if (!$apiKeyData) {
            return Response::error('Unauthorized', 401);
        }
    
        try {
            // Buscar sub_of
            $db = \API\Config\Database::getInstance();
            $stmt = $db->getConnection()->prepare("SELECT sub_of FROM users WHERE id = ? LIMIT 1");
            $stmt->execute([$data['user']]);
            $professional = $stmt->fetch(\PDO::FETCH_ASSOC);
            
            if (!$professional || !$professional['sub_of']) {
                return Response::error('Professional not found', 404);
            }
            
            $statusAuthor = $professional['sub_of'];
        
            // Buscar admins
            $stmt = $db->getConnection()->prepare("SELECT id FROM users WHERE level >= 9 AND active = 'yes'");
            $stmt->execute();
            $admins = $stmt->fetchAll(\PDO::FETCH_ASSOC);
            
            $adminIds = array_column($admins, 'id');
            
            $openViewWith = $data['user'];
            if (!empty($adminIds)) {
                $openViewWith .= ',' . implode(',', $adminIds);
            }
    
            // Baixar thumbnail
            $thumbnailData = file_get_contents($data['thumbnail']);
            if (!$thumbnailData) {
                return Response::error('Failed to download thumbnail', 500);
            }
    
            // Detectar MIME
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mimeType = finfo_buffer($finfo, $thumbnailData);
            finfo_close($finfo);
    
            $mimeMap = [
                'image/jpeg' => 'jpg',
                'image/png' => 'png',
                'image/webp' => 'webp'
            ];
    
            if (!isset($mimeMap[$mimeType])) {
                return Response::error('Invalid thumbnail type', 400);
            }
    
            $extension = $mimeMap[$mimeType];
            $yearMonth = date('Y/m');
            $uploadPath = $this->uploadDir . $yearMonth . '/';
            
            if (!is_dir($uploadPath)) {
                mkdir($uploadPath, 0755, true);
            }
    
            $fileName = 'encaminhamento_' . time() . '.' . $extension;
            $filePath = $uploadPath . $fileName;
    
            if (!file_put_contents($filePath, $thumbnailData)) {
                return Response::error('Failed to save thumbnail', 500);
            }
    
            // Dados completos
            $historicData = [
                'company' => $data['company'],
                'patient' => $data['patient'],
                'user' => $data['user'],
                'type' => 'image',
                'title' => 'Encaminhamento de ' . $data['patient_name'],
                'content' => 'Encaminhamento via Google Drive em ' . date('d/m/Y H:i') . "\nDrive: " . $data['drive_url'],
                'file' => 'historic/' . $yearMonth . '/' . $fileName,
                'url' => '/storage/historic/' . $yearMonth . '/' . $fileName,
                'open_view' => 'yes',
                'open_view_with' => $openViewWith,
                'hash' => bin2hex(random_bytes(12)),
                'password' => $this->generatePassword(6),
                'status' => 'active',
                'status_author' => $statusAuthor,
                'share_patient' => 'no'
            ];
    
            $historicId = $this->historicModel->insert($historicData);
    
            if (!$historicId) {
                unlink($filePath);
                return Response::error('Failed to create record', 500);
            }
    
            return Response::success([
                'historic_id' => $historicId,
                'file_name' => $fileName,
                'drive_id' => $data['drive_id'],
                'message' => 'Encaminhamento salvo com sucesso'
            ], 201);
    
        } catch (\Exception $e) {
            return Response::error('Error: ' . $e->getMessage(), 500);
        }
    }
    
}