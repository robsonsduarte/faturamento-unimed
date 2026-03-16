<?php
namespace API\Models;

use API\Helpers\DateHelper;
use API\Config\Config;

class Schedule extends BaseModel
{
    protected $table = 'app_schedule';
    
    protected $fillable = [
        'user',
        'occupation',
        'company',
        'day',
        'start',
        'lapse',
        'end',
        'interval_start',
        'interval_end',
        'author',
        'status'
    ];
    
    protected $hidden = [];
    
    public function getByUser($userId, $companyId)
    {
        $sql = "SELECT * FROM `{$this->table}` 
                WHERE `user` = ? AND `company` = ? AND `status` = 'active'
                ORDER BY `day` ASC";
        
        return $this->query($sql, [$userId, $companyId]);
    }
    
    public function getByCompany($companyId)
    {
        $sql = "SELECT s.*, u.first_name, u.last_name, gc.google_calendar_id
                FROM `{$this->table}` s
                INNER JOIN `users` u ON s.user = u.id
                LEFT JOIN `users_google_calendar` gc ON (s.user = gc.user_id AND s.company = gc.company_id)
                WHERE s.company = ? AND s.status = 'active' AND u.status = 'confirmed'
                ORDER BY s.user ASC, s.day ASC";
        
        return $this->query($sql, [$companyId]);
    }
    
    public function convertToGoogleCalendarFormat($schedules)
    {
        $result = [];
        
        foreach ($schedules as $schedule) {
            if (empty($schedule['google_calendar_id'])) {
                continue;
            }
            
            $calendarId = $schedule['google_calendar_id'];
            $day = Config::DAY_MAP[$schedule['day']] ?? null;
            
            if (!$day) {
                continue;
            }
            
            if (!isset($result[$calendarId])) {
                $result[$calendarId] = DateHelper::createEmptyWeek();
            }
            
            $turnos = $this->calculateShifts($schedule);
            
            foreach ($turnos as $turno) {
                $result[$calendarId][$day][] = $turno;
            }
        }
        
        return $result;
    }
    
    private function calculateShifts($schedule)
    {
        $turnos = [];
        
        if (!empty($schedule['start']) && !empty($schedule['interval_start'])) {
            $turno1Start = DateHelper::formatTime($schedule['start']);
            $turno1End = DateHelper::formatTime($schedule['interval_start']);
            
            if ($turno1Start !== $turno1End) {
                $turnos[] = [
                    'inicio' => $turno1Start,
                    'fim' => $turno1End
                ];
            }
        }
        
        if (!empty($schedule['interval_end']) && !empty($schedule['end'])) {
            $turno2Start = DateHelper::formatTime($schedule['interval_end']);
            $turno2End = DateHelper::formatTime($schedule['end']);
            
            if ($turno2Start !== $turno2End) {
                $turnos[] = [
                    'inicio' => $turno2Start,
                    'fim' => $turno2End
                ];
            }
        }
        
        return $turnos;
    }
    
    public function getFormattedSchedule($userId, $companyId)
    {
        $schedules = $this->getByUser($userId, $companyId);
        $result = DateHelper::createEmptyWeek();
        
        foreach ($schedules as $schedule) {
            $day = Config::DAY_MAP[$schedule['day']] ?? null;
            
            if (!$day) {
                continue;
            }
            
            $turnos = $this->calculateShifts($schedule);
            
            foreach ($turnos as $turno) {
                $result[$day][] = $turno;
            }
        }
        
        return $result;
    }
    
    public function worksOnDay($userId, $companyId, $dayNumber)
    {
        return $this->exists([
            'user' => $userId,
            'company' => $companyId,
            'day' => $dayNumber,
            'status' => 'active'
        ]);
    }
    
    public function getWorkDays($userId, $companyId)
    {
        $sql = "SELECT DISTINCT `day` FROM `{$this->table}` 
                WHERE `user` = ? AND `company` = ? AND `status` = 'active'
                ORDER BY `day` ASC";
        
        $results = $this->query($sql, [$userId, $companyId]);
        
        return array_column($results, 'day');
    }
    
    /**
     * Busca cidade e estado da empresa
     */
    public function getCompanyLocation($companyId)
    {
        $sql = "SELECT city, state FROM address_company WHERE company = ? AND status = 'active' LIMIT 1";
        $result = $this->fetchOne($sql, [$companyId]);
        
        // Fallback se não encontrar
        if (!$result) {
            return ['city' => 'Itabuna', 'state' => 'BA'];
        }
        
        return [
            'city' => $result['city'] ?? 'Itabuna',
            'state' => $result['state'] ?? 'BA'
        ];
    }
}
