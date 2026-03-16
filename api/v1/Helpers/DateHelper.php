<?php
namespace API\Helpers;

use DateTime;
use DateTimeZone;
use API\Config\Config;

class DateHelper
{
    const DB_DATE_FORMAT = 'Y-m-d';
    const DB_TIME_FORMAT = 'H:i:s';
    const DB_DATETIME_FORMAT = 'Y-m-d H:i:s';
    const API_DATE_FORMAT = 'Y-m-d';
    const API_TIME_FORMAT = 'H:i';
    const API_DATETIME_FORMAT = 'Y-m-d H:i:s';
    
    public static function now($format = self::DB_DATETIME_FORMAT)
    {
        $tz = new DateTimeZone(Config::TIMEZONE);
        $now = new DateTime('now', $tz);
        return $now->format($format);
    }
    
    public static function formatTime($time)
    {
        if (empty($time)) {
            return '';
        }
        
        if (strlen($time) === 5 && strpos($time, ':') === 2) {
            return $time;
        }
        
        if (strlen($time) === 8) {
            return substr($time, 0, 5);
        }
        
        try {
            $dt = new DateTime($time);
            return $dt->format(self::API_TIME_FORMAT);
        } catch (\Exception $e) {
            return $time;
        }
    }
    
    public static function dayNumberToName($dayNumber)
    {
        return Config::DAY_MAP[$dayNumber] ?? 'invalido';
    }
    
    public static function dayNameToNumber($dayName)
    {
        $flipped = array_flip(Config::DAY_MAP);
        return $flipped[strtolower($dayName)] ?? null;
    }
    
    public static function createEmptyWeek()
    {
        return [
            'segunda' => [],
            'terça' => [],
            'quarta' => [],
            'quinta' => [],
            'sexta' => [],
            'sabado' => [],
            'domingo' => []
        ];
    }
    
    public static function isTimeBetween($time, $start, $end)
    {
        $time = strtotime($time);
        $start = strtotime($start);
        $end = strtotime($end);
        
        return ($time >= $start && $time <= $end);
    }
    
    public static function addMinutes($time, $minutes)
    {
        try {
            $dt = new DateTime($time);
            $dt->modify("+{$minutes} minutes");
            return $dt->format(self::API_TIME_FORMAT);
        } catch (\Exception $e) {
            return $time;
        }
    }
    
    public static function diffInMinutes($start, $end)
    {
        try {
            $startDt = new DateTime($start);
            $endDt = new DateTime($end);
            $diff = $startDt->diff($endDt);
            
            return ($diff->h * 60) + $diff->i;
        } catch (\Exception $e) {
            return 0;
        }
    }
    
    public static function isToday($date)
    {
        return $date === self::now(self::DB_DATE_FORMAT);
    }
    
    public static function isPast($date)
    {
        return $date < self::now(self::DB_DATE_FORMAT);
    }
    
    public static function isFuture($date)
    {
        return $date > self::now(self::DB_DATE_FORMAT);
    }
    
    public static function formatDateBR($date)
    {
        try {
            $dt = new DateTime($date);
            return $dt->format('d/m/Y');
        } catch (\Exception $e) {
            return $date;
        }
    }
    
    public static function brDateToDb($dateBR)
    {
        try {
            $dt = DateTime::createFromFormat('d/m/Y', $dateBR);
            return $dt ? $dt->format(self::DB_DATE_FORMAT) : false;
        } catch (\Exception $e) {
            return false;
        }
    }
    
    public static function getDayOfWeekName($date)
    {
        try {
            $dt = new DateTime($date);
            $dayNum = (int) $dt->format('N');
            return self::dayNumberToName($dayNum);
        } catch (\Exception $e) {
            return '';
        }
    }
    
    public static function timestamp($datetime = null)
    {
        if ($datetime === null) {
            return time();
        }
        
        try {
            $dt = new DateTime($datetime);
            return $dt->getTimestamp();
        } catch (\Exception $e) {
            return 0;
        }
    }
}
