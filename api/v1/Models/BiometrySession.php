<?php
namespace API\Models;

class BiometrySession extends BaseModel
{
    protected $table = 'app_biometry_sessions';
    protected $primaryKey = 'id';
    
    protected $fillable = [
        'company',
        'patient',
        'chat_id',
        'token',
        'operator_id',
        'operator_name',
        'guide_number',
        'patient_name',
        'validation_type',
        'appointment_id',
        'execution_id',
        'professional_name',
        'appointment_date',
        'biometry_link',
        'photo_path',
        'status',
        'photo_attempts',
        'max_attempts',
        'saw_attempts',
        'error_message',
        'saw_result',
        'validation_result',
        'validation_message',
        'validated_at',
        'allow_reuse',
        'reused_from_session_id',
        'photo_captured_at',
        'consent_accepted',
        'consent_text',
        'consent_ip',
        'consent_timestamp',
        'consent_user_agent',
        'expires_at',
        'completed_at'
    ];
    
    protected $hidden = [];
    
    /**
     * Busca sessão ativa por guide_number
     */
    public function findActiveByGuideNumber($guideNumber, $company = null)
    {
        $where = [
            'guide_number' => $guideNumber,
            'status' => ['NOT IN', "('completed', 'failed', 'timeout', 'cancelled')"]
        ];
        
        if ($company) {
            $where['company'] = $company;
        }
        
        $sql = "SELECT * FROM `{$this->table}` 
                WHERE `guide_number` = ? 
                AND `status` NOT IN ('completed', 'failed', 'timeout', 'cancelled')";
        
        $params = [$guideNumber];
        
        if ($company) {
            $sql .= " AND `company` = ?";
            $params[] = $company;
        }
        
        $sql .= " ORDER BY created_at DESC LIMIT 1";
        
        return $this->fetchOne($sql, $params);
    }
    
    /**
     * Busca sessão ativa por chat_id
     */
    public function findActiveByChatId($chatId)
    {
        $sql = "SELECT * FROM `{$this->table}` 
                WHERE `chat_id` = ? 
                AND `status` NOT IN ('completed', 'failed', 'timeout', 'cancelled')
                ORDER BY created_at DESC 
                LIMIT 1";
        
        return $this->fetchOne($sql, [$chatId]);
    }
    
    /**
     * Busca sessão por appointment_id
     */
    public function findByAppointment($appointmentId, $company = null)
    {
        $sql = "SELECT * FROM `{$this->table}` 
                WHERE `appointment_id` = ?";
        
        $params = [$appointmentId];
        
        if ($company) {
            $sql .= " AND `company` = ?";
            $params[] = $company;
        }
        
        $sql .= " ORDER BY created_at DESC LIMIT 1";
        
        return $this->fetchOne($sql, $params);
    }
    
    /**
     * Busca sessão por execution_id
     */
    public function findByExecution($executionId, $company = null)
    {
        $sql = "SELECT * FROM `{$this->table}` 
                WHERE `execution_id` = ?";
        
        $params = [$executionId];
        
        if ($company) {
            $sql .= " AND `company` = ?";
            $params[] = $company;
        }
        
        $sql .= " ORDER BY created_at DESC LIMIT 1";
        
        return $this->fetchOne($sql, $params);
    }
    
    /**
     * Lista sessões pendentes por empresa
     */
    public function listPending($company, $limit = 50)
    {
        $sql = "SELECT * FROM `{$this->table}` 
                WHERE `company` = ? 
                AND `status` IN ('started', 'link_sent', 'waiting_photo', 'photo_received')
                AND (`expires_at` IS NULL OR `expires_at` > NOW())
                ORDER BY created_at ASC
                LIMIT ?";
        
        return $this->query($sql, [$company, $limit]);
    }
    
    /**
     * Lista sessões expiradas não finalizadas
     */
    public function listExpired($limit = 100)
    {
        $sql = "SELECT * FROM `{$this->table}` 
                WHERE `expires_at` < NOW()
                AND `status` NOT IN ('completed', 'failed', 'cancelled', 'timeout')
                ORDER BY expires_at ASC
                LIMIT ?";
        
        return $this->query($sql, [$limit]);
    }
    
    /**
     * Busca foto reutilizável de paciente
     */
    public function findReusablePhoto($patientId, $company, $maxDays = 30)
    {
        $sql = "SELECT * FROM `{$this->table}` 
                WHERE `patient` = ? 
                AND `company` = ?
                AND `validation_result` = 'approved'
                AND `allow_reuse` = 1
                AND `photo_path` IS NOT NULL
                AND `photo_captured_at` > DATE_SUB(NOW(), INTERVAL ? DAY)
                ORDER BY validated_at DESC
                LIMIT 1";
        
        return $this->fetchOne($sql, [$patientId, $company, $maxDays]);
    }
    
    /**
     * Marca sessões expiradas como timeout
     */
    public function markExpiredAsTimeout()
    {
        $sql = "UPDATE `{$this->table}` 
                SET `status` = 'timeout'
                WHERE `expires_at` < NOW()
                AND `status` NOT IN ('completed', 'failed', 'cancelled', 'timeout')";
        
        return $this->execute($sql);
    }
    
    /**
     * Incrementa tentativas de foto
     */
    public function incrementPhotoAttempts($id)
    {
        $sql = "UPDATE `{$this->table}` 
                SET `photo_attempts` = `photo_attempts` + 1
                WHERE `{$this->primaryKey}` = ?";
        
        return $this->execute($sql, [$id]);
    }
    
    /**
     * Incrementa tentativas SAW
     */
    public function incrementSawAttempts($id)
    {
        $sql = "UPDATE `{$this->table}` 
                SET `saw_attempts` = `saw_attempts` + 1
                WHERE `{$this->primaryKey}` = ?";
        
        return $this->execute($sql, [$id]);
    }
    
    /**
     * Registra consentimento LGPD
     */
    public function recordConsent($id, $consentData)
    {
        $data = [
            'consent_accepted' => 1,
            'consent_text' => $consentData['text'] ?? null,
            'consent_ip' => $consentData['ip'] ?? null,
            'consent_timestamp' => date('Y-m-d H:i:s'),
            'consent_user_agent' => $consentData['user_agent'] ?? null
        ];
        
        return $this->update($id, $data);
    }
    
    /**
     * Atualiza resultado de validação
     */
    public function recordValidation($id, $result, $message = null)
    {
        $data = [
            'validation_result' => $result,
            'validation_message' => $message,
            'validated_at' => date('Y-m-d H:i:s'),
            'status' => $result === 'approved' ? 'completed' : 'failed',
            'completed_at' => date('Y-m-d H:i:s')
        ];
        
        return $this->update($id, $data);
    }
    
    /**
     * Estatísticas de taxa de sucesso
     */
    public function getSuccessRate($company, $validationType = null)
    {
        $sql = "SELECT 
                    validation_type,
                    COUNT(*) as total,
                    SUM(CASE WHEN validation_result = 'approved' THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN validation_result = 'rejected' THEN 1 ELSE 0 END) as rejected,
                    SUM(CASE WHEN validation_result = 'error' THEN 1 ELSE 0 END) as errors,
                    ROUND(SUM(CASE WHEN validation_result = 'approved' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as success_rate
                FROM `{$this->table}`
                WHERE `company` = ?
                AND `validation_result` IS NOT NULL";
        
        $params = [$company];
        
        if ($validationType) {
            $sql .= " AND `validation_type` = ?";
            $params[] = $validationType;
        }
        
        $sql .= " GROUP BY validation_type";
        
        return $this->query($sql, $params);
    }
    
    /**
     * Retorna último ID inserido
     */
    public function getLastInsertId()
    {
        return $this->conn->lastInsertId();
    }
}