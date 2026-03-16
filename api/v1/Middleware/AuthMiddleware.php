<?php
namespace API\Middleware;

use API\Config\Database;
use API\Helpers\Response;
use API\Helpers\DateHelper;

class AuthMiddleware
{
    private $db;
    private $apiKey;
    private $apiKeyData;
    
    public function __construct()
    {
        $this->db = Database::getInstance();
    }
    
    public function validate($requiredCompanyId = null)
    {
        $this->apiKey = Response::getHeader('X-API-Key');
        
        if (empty($this->apiKey)) {
            Response::unauthorized('API Key não fornecida. Inclua o header X-API-Key');
            return null;
        }
        
        if (strlen($this->apiKey) < 32) {
            Response::unauthorized('Formato de API Key inválido');
            return null;
        }
        
        $this->apiKeyData = $this->getApiKeyData($this->apiKey);
        
        if (!$this->apiKeyData) {
            Response::unauthorized('API Key inválida');
            return null;
        }
        
        if ($this->apiKeyData['status'] !== 'active') {
            Response::unauthorized('API Key inativa');
            return null;
        }
        
        if ($this->isExpired()) {
            Response::unauthorized('API Key expirada');
            return null;
        }
        
        if ($requiredCompanyId !== null) {
            if ((int) $this->apiKeyData['company_id'] !== (int) $requiredCompanyId) {
                Response::forbidden('Você não tem acesso a esta empresa');
                return null;
            }
        }
        
        $this->updateLastUsed();
        
        return $this->apiKeyData;
    }
    
    private function getApiKeyData($apiKey)
    {
        $sql = "SELECT 
                    ak.*,
                    c.corporate_name,
                    c.title as company_name,
                    c.url as company_url
                FROM `api_keys` ak
                INNER JOIN `app_company` c ON ak.company_id = c.id
                WHERE ak.api_key = ?
                LIMIT 1";
        
        return $this->db->fetchOne($sql, [$apiKey]);
    }
    
    private function isExpired()
    {
        if (empty($this->apiKeyData['expires_at'])) {
            return false;
        }
        
        return DateHelper::isPast($this->apiKeyData['expires_at']);
    }
    
    private function updateLastUsed()
    {
        $sql = "UPDATE `api_keys` SET `last_used` = ? WHERE `id` = ?";
        $this->db->execute($sql, [
            DateHelper::now(),
            $this->apiKeyData['id']
        ]);
    }
    
    public function hasPermission($permission)
    {
        if (!$this->apiKeyData) {
            return false;
        }
        
        if (empty($this->apiKeyData['permissions'])) {
            return true;
        }
        
        $permissions = json_decode($this->apiKeyData['permissions'], true);
        
        if (!is_array($permissions)) {
            return true;
        }
        
        foreach ($permissions as $key => $value) {
            if (strpos($permission, $key) === 0) {
                if ($value === 'write' || $value === $permission) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    public function getCompanyId()
    {
        return isset($this->apiKeyData['company_id']) 
            ? (int) $this->apiKeyData['company_id'] 
            : null;
    }
    
    public function getCompanyData()
    {
        if (!$this->apiKeyData) {
            return null;
        }
        
        return [
            'id' => (int) $this->apiKeyData['company_id'],
            'corporate_name' => $this->apiKeyData['corporate_name'] ?? null,
            'name' => $this->apiKeyData['company_name'] ?? null,
            'url' => $this->apiKeyData['company_url'] ?? null
        ];
    }
    
    public static function generateApiKey($companyId, $name, $permissions = null, $expiresAt = null)
    {
        $db = Database::getInstance();
        
        $apiKey = bin2hex(random_bytes(32));
        
        $permissionsJson = $permissions ? json_encode($permissions) : null;
        
        $sql = "INSERT INTO `api_keys` 
                (`company_id`, `api_key`, `name`, `permissions`, `status`, `expires_at`)
                VALUES (?, ?, ?, ?, 'active', ?)";
        
        $result = $db->execute($sql, [
            $companyId,
            $apiKey,
            $name,
            $permissionsJson,
            $expiresAt
        ]);
        
        return $result ? $apiKey : false;
    }
    
    public static function revokeApiKey($apiKey)
    {
        $db = Database::getInstance();
        
        $sql = "UPDATE `api_keys` SET `status` = 'inactive' WHERE `api_key` = ?";
        return $db->execute($sql, [$apiKey]);
    }
    
    public static function listApiKeys($companyId)
    {
        $db = Database::getInstance();
        
        $sql = "SELECT 
                    `id`,
                    `api_key`,
                    `name`,
                    `permissions`,
                    `status`,
                    `last_used`,
                    `expires_at`,
                    `created_at`
                FROM `api_keys`
                WHERE `company_id` = ?
                ORDER BY `created_at` DESC";
        
        return $db->query($sql, [$companyId]);
    }
}
