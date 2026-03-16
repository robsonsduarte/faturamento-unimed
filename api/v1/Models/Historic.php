<?php
namespace API\Models;

class Historic extends BaseModel
{
    protected $table = 'app_historic';
    protected $primaryKey = 'id';

    protected $fillable = [
        'company', 'patient', 'user', 'cid', 'type', 'title', 
        'content', 'file', 'url', 'open_view', 'open_view_with',
        'share_patient', 'hash', 'password', 'status', 'status_author'
    ];

    protected $hidden = ['password'];

    /**
     * Busca documentos por agendamento (via metadata no content)
     */
    public function getByAppointment($appointmentId)
    {
        $sql = "SELECT * FROM `{$this->table}` 
                WHERE `content` LIKE ? 
                AND `status` != 'deleted'
                ORDER BY `created_at` DESC";
        
        return $this->query($sql, ['%[appointment_id:' . $appointmentId . ']%']);
    }

    /**
     * Busca documentos por paciente
     */
    public function getByPatient($patientId, $companyId, $limit = 50)
    {
        $sql = "SELECT * FROM `{$this->table}` 
                WHERE `patient` = ? AND `company` = ?
                AND `status` != 'deleted'
                ORDER BY `created_at` DESC
                LIMIT ?";
        
        return $this->query($sql, [$patientId, $companyId, $limit]);
    }

    /**
     * Busca documentos por tipo
     */
    public function getByType($type, $companyId, $limit = 50)
    {
        $sql = "SELECT * FROM `{$this->table}` 
                WHERE `type` = ? AND `company` = ?
                AND `status` != 'deleted'
                ORDER BY `created_at` DESC
                LIMIT ?";
        
        return $this->query($sql, [$type, $companyId, $limit]);
    }

    /**
     * Busca documentos por profissional
     */
    public function getByUser($userId, $companyId, $limit = 50)
    {
        $sql = "SELECT h.*, 
                p.first_name as patient_first_name,
                p.last_name as patient_last_name
                FROM `{$this->table}` h
                LEFT JOIN `app_patient` p ON h.patient = p.id
                WHERE h.user = ? AND h.company = ?
                AND h.status != 'deleted'
                ORDER BY h.created_at DESC
                LIMIT ?";
        
        return $this->query($sql, [$userId, $companyId, $limit]);
    }

    /**
     * Soft delete
     */
    public function softDelete($id)
    {
        return $this->update($id, ['status' => 'deleted']);
    }

    /**
     * Verifica se arquivo existe fisicamente
     */
    public function fileExists($fileName)
    {
        $uploadDir = '/home2/consult6/public_html/storage/historic/';
        return file_exists($uploadDir . $fileName);
    }

    /**
     * Deleta arquivo físico
     */
    public function deleteFile($fileName)
    {
        $uploadDir = '/home2/consult6/public_html/storage/historic/';
        $filePath = $uploadDir . $fileName;
        
        if (file_exists($filePath)) {
            return unlink($filePath);
        }
        
        return false;
    }
    
    private function getDocumentType($mimeType)
    {
        $typeMap = [
            'image/png' => 'image',
            'image/jpeg' => 'image',
            'image/jpg' => 'image',
            'application/pdf' => 'file',
            'default' => 'file'
        ];
        
        return $typeMap[$mimeType] ?? $typeMap['default'];
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