<?php
namespace API\Models;

class Appointment extends BaseModel
{
    protected $table = 'app_appointment';
    protected $primaryKey = 'id';

    protected $fillable = [
        'company', 'user', 'patient', 'day', 'period', 'project', 'payment',
        'agreement', 'guide_number', 'status_guide', 'value', 'absence',
        'num_absence', 'justified', 'realized', 'aboned', 'canceled',
        'confirmed', 'deleted', 'status', 'status_color', 'standby', 'hash',
        'online', 'google_meet', 'calendar_event', 'calendar_id', 'zoom_url',
        'zoom_id', 'zoom_password', 'observation', 'type', 'author', 'message_id',
        'sent_at', 'sent_mail', 'sent_whats', 'sent_professional', 'sent_cut_patient'
    ];

    protected $hidden = [];

    public function getByCompany($companyId, $filters = [], $limit = 50, $offset = 0)
    {
        $sql = "SELECT a.*, 
                u.first_name as professional_first_name, 
                u.last_name as professional_last_name,
                p.first_name as patient_first_name,
                p.last_name as patient_last_name,
                p.mobile as patient_mobile
                FROM `{$this->table}` a
                INNER JOIN `users` u ON a.user = u.id
                INNER JOIN `app_patient` p ON a.patient = p.id
                WHERE a.company = ?";
        
        $params = [$companyId];

        if (!empty($filters['user'])) {
            $sql .= " AND a.user = ?";
            $params[] = $filters['user'];
        }
        if (!empty($filters['patient'])) {
            $sql .= " AND a.patient = ?";
            $params[] = $filters['patient'];
        }
        if (!empty($filters['date'])) {
            $sql .= " AND DATE(a.day) = ?";
            $params[] = $filters['date'];
        }
        if (!empty($filters['status'])) {
            $sql .= " AND a.status = ?";
            $params[] = $filters['status'];
        }
        if (!empty($filters['confirmed'])) {
            $sql .= " AND a.confirmed = ?";
            $params[] = $filters['confirmed'];
        }

        $sql .= " ORDER BY a.day ASC LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;

        return $this->query($sql, $params);
    }

    public function getByUserAndDate($userId, $companyId, $date)
    {
        $sql = "SELECT a.*, 
                p.first_name as patient_first_name,
                p.last_name as patient_last_name,
                p.mobile as patient_mobile
                FROM `{$this->table}` a
                INNER JOIN `app_patient` p ON a.patient = p.id
                WHERE a.user = ? AND a.company = ? AND DATE(a.day) = ?
                AND a.deleted IS NULL
                ORDER BY a.day ASC";

        return $this->query($sql, [$userId, $companyId, $date]);
    }

    public function checkAvailability($userId, $day, $excludeId = null)
    {
        $sql = "SELECT COUNT(*) as total FROM `{$this->table}` 
                WHERE `user` = ? AND `day` = ? 
                AND `deleted` IS NULL AND `canceled` IS NULL";
        
        $params = [$userId, $day];

        if ($excludeId) {
            $sql .= " AND `id` != ?";
            $params[] = $excludeId;
        }

        $result = $this->fetchOne($sql, $params);
        return (int)($result['total'] ?? 0) === 0;
    }

    public function findWithDetails($id)
    {
        $sql = "SELECT a.*, 
                u.first_name as professional_first_name, 
                u.last_name as professional_last_name,
                u.email as professional_email,
                p.first_name as patient_first_name,
                p.last_name as patient_last_name,
                p.mobile as patient_mobile,
                p.email as patient_email,
                gc.google_calendar_id
                FROM `{$this->table}` a
                INNER JOIN `users` u ON a.user = u.id
                INNER JOIN `app_patient` p ON a.patient = p.id
                LEFT JOIN `users_google_calendar` gc ON (a.user = gc.user_id AND a.company = gc.company_id)
                WHERE a.id = ? LIMIT 1";

        return $this->fetchOne($sql, [$id]);
    }

    public function cancel($id, $reason = null)
    {
        return $this->update($id, [
            'canceled' => 'yes',
            'status' => 'canceled',
            'observation' => $reason
        ]);
    }

    public function confirm($id)
    {
        return $this->update($id, ['confirmed' => 'yes']);
    }

    public function countByFilters($companyId, $filters = [])
    {
        $sql = "SELECT COUNT(*) as total FROM `{$this->table}` WHERE company = ?";
        $params = [$companyId];

        if (!empty($filters['user'])) {
            $sql .= " AND user = ?";
            $params[] = $filters['user'];
        }
        if (!empty($filters['date'])) {
            $sql .= " AND DATE(day) = ?";
            $params[] = $filters['date'];
        }
        if (!empty($filters['status'])) {
            $sql .= " AND status = ?";
            $params[] = $filters['status'];
        }

        $result = $this->fetchOne($sql, $params);
        return (int)($result['total'] ?? 0);
    }

    public function getUpcomingByPatient($patientId, $companyId, $limit = 5)
    {
        $sql = "SELECT a.*, 
                u.first_name as professional_first_name, 
                u.last_name as professional_last_name
                FROM `{$this->table}` a
                INNER JOIN `users` u ON a.user = u.id
                WHERE a.patient = ? AND a.company = ? 
                AND a.day >= NOW()
                AND a.deleted IS NULL AND a.canceled IS NULL
                ORDER BY a.day ASC LIMIT ?";

        return $this->query($sql, [$patientId, $companyId, $limit]);
    }
    
    public function getCalendarData($userId, $companyId)
    {
        $sql = "SELECT google_calendar_id FROM users_google_calendar
               WHERE user_id = ? AND company_id = ? AND sync_enabled = 1 LIMIT 1";
        
        return $this->fetchOne($sql, [$userId, $companyId]);
    }
    
}
