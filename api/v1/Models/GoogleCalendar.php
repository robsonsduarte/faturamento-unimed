<?php
namespace API\Models;

use API\Helpers\DateHelper;

class GoogleCalendar extends BaseModel
{
    protected $table = 'users_google_calendar';
    
    protected $fillable = [
        'user_id',
        'company_id',
        'google_calendar_id',
        'sync_enabled',
        'last_sync'
    ];
    
    protected $hidden = [];
    
    public function getByUser($userId, $companyId)
    {
        return $this->findWhere([
            'user_id' => $userId,
            'company_id' => $companyId
        ]);
    }
    
    public function getByCalendarId($googleCalendarId)
    {
        return $this->findWhere([
            'google_calendar_id' => $googleCalendarId
        ]);
    }
    
    public function getByCompany($companyId, $onlyEnabled = true)
    {
        $where = ['company_id' => $companyId];
        
        if ($onlyEnabled) {
            $where['sync_enabled'] = 1;
        }
        
        $sql = "SELECT gc.*, u.first_name, u.last_name, u.email
                FROM `{$this->table}` gc
                INNER JOIN `users` u ON gc.user_id = u.id
                WHERE gc.company_id = ?";
        
        if ($onlyEnabled) {
            $sql .= " AND gc.sync_enabled = 1";
        }
        
        $sql .= " ORDER BY u.first_name ASC";
        
        return $this->query($sql, [$companyId]);
    }
    
    public function createOrUpdate($userId, $companyId, $googleCalendarId, $syncEnabled = true)
    {
        $existing = $this->getByUser($userId, $companyId);
        
        $data = [
            'user_id' => $userId,
            'company_id' => $companyId,
            'google_calendar_id' => $googleCalendarId,
            'sync_enabled' => $syncEnabled ? 1 : 0
        ];
        
        if ($existing) {
            return $this->update($existing['id'], $data);
        } else {
            return $this->insert($data);
        }
    }
    
    public function updateLastSync($userId, $companyId)
    {
        $sync = $this->getByUser($userId, $companyId);
        
        if (!$sync) {
            return false;
        }
        
        $sql = "UPDATE `{$this->table}` 
                SET `last_sync` = ? 
                WHERE `user_id` = ? AND `company_id` = ?";
        
        return $this->execute($sql, [
            DateHelper::now(),
            $userId,
            $companyId
        ]);
    }
    
    public function toggleSync($userId, $companyId, $enabled)
    {
        $sync = $this->getByUser($userId, $companyId);
        
        if (!$sync) {
            return false;
        }
        
        return $this->update($sync['id'], [
            'sync_enabled' => $enabled ? 1 : 0
        ]);
    }
    
    public function hasGoogleCalendar($userId, $companyId)
    {
        return $this->exists([
            'user_id' => $userId,
            'company_id' => $companyId
        ]);
    }
    
    public function isCalendarIdInUse($googleCalendarId, $exceptUserId = null, $exceptCompanyId = null)
    {
        $sql = "SELECT COUNT(*) as total FROM `{$this->table}` 
                WHERE `google_calendar_id` = ?";
        $params = [$googleCalendarId];
        
        if ($exceptUserId && $exceptCompanyId) {
            $sql .= " AND NOT (`user_id` = ? AND `company_id` = ?)";
            $params[] = $exceptUserId;
            $params[] = $exceptCompanyId;
        }
        
        $result = $this->fetchOne($sql, $params);
        return (int) $result['total'] > 0;
    }
    
    public function deleteByUser($userId, $companyId)
    {
        return $this->deleteWhere([
            'user_id' => $userId,
            'company_id' => $companyId
        ]);
    }
    
    public function formatForAPI($sync)
    {
        return [
            'id' => (int) $sync['id'],
            'user_id' => (int) $sync['user_id'],
            'user_name' => trim(($sync['first_name'] ?? '') . ' ' . ($sync['last_name'] ?? '')),
            'google_calendar_id' => $sync['google_calendar_id'],
            'sync_enabled' => (bool) $sync['sync_enabled'],
            'last_sync' => $sync['last_sync'],
            'created_at' => $sync['created_at'] ?? null
        ];
    }
}
