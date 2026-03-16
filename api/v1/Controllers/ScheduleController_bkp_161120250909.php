<?php
namespace API\Controllers;

use API\Models\Schedule;
use API\Models\User;
use API\Models\GoogleCalendar;
use API\Helpers\Response;
use API\Helpers\Validator;
use API\Middleware\AuthMiddleware;

class ScheduleController
{
    private $scheduleModel;
    private $userModel;
    private $googleCalendarModel;
    private $auth;
    
    public function __construct()
    {
        $this->scheduleModel = new Schedule();
        $this->userModel = new User();
        $this->googleCalendarModel = new GoogleCalendar();
        $this->auth = new AuthMiddleware();
    }
    
    public function index($companyId)
    {
        $apiKeyData = $this->auth->validate($companyId);
        if (!$apiKeyData) {
            return;
        }
        
        $schedules = $this->scheduleModel->getByCompany($companyId);
        
        if (empty($schedules)) {
            Response::success([], 200, [
                'total_professionals' => 0,
                'company_id' => $companyId,
                'message' => 'Nenhum horário configurado'
            ]);
            return;
        }
        
        $formatted = $this->scheduleModel->convertToGoogleCalendarFormat($schedules);
        
        $uniqueProfessionals = count(array_unique(array_column($schedules, 'user')));
        
        Response::success($formatted, 200, [
            'total_professionals' => $uniqueProfessionals,
            'company_id' => $companyId
        ]);
    }
    
    public function show($companyId, $userId)
    {
        $apiKeyData = $this->auth->validate($companyId);
        if (!$apiKeyData) {
            return;
        }
        
        $user = $this->userModel->getFullInfo($userId, $companyId);
        
        if (!$user) {
            Response::notFound('Profissional');
            return;
        }
        
        if (empty($user['google_calendar_id'])) {
            Response::error(
                'SYNC_FAILED',
                'Profissional não possui Google Calendar configurado',
                404
            );
            return;
        }
        
        $schedules = $this->scheduleModel->getFormattedSchedule($userId, $companyId);
        
        Response::success([
            'user_id' => (int) $userId,
            'google_calendar_id' => $user['google_calendar_id'],
            'professional' => [
                'name' => User::getFullName($user),
                'occupation' => $user['occupation_name'] ?? null
            ],
            'schedules' => $schedules
        ]);
    }
    
    public function availability($companyId, $userId)
    {
        $apiKeyData = $this->auth->validate($companyId);
        if (!$apiKeyData) {
            return;
        }
        
        $date = Response::getQueryParam('date');
        
        if (!$date) {
            Response::error('MISSING_REQUIRED_FIELD', 'Parâmetro "date" é obrigatório', 400);
            return;
        }
        
        $validator = new Validator(['date' => $date]);
        $validator->required('date')->date('date');
        
        if ($validator->fails()) {
            Response::validationError($validator->getErrors());
            return;
        }
        
        if (!$this->userModel->isActive($userId, $companyId)) {
            Response::notFound('Profissional');
            return;
        }
        
        $dayOfWeek = (int) date('N', strtotime($date));
        
        $worksOnDay = $this->scheduleModel->worksOnDay($userId, $companyId, $dayOfWeek);
        
        if (!$worksOnDay) {
            Response::success([
                'date' => $date,
                'day_of_week' => $dayOfWeek,
                'available' => false,
                'message' => 'Profissional não trabalha neste dia da semana',
                'schedules' => []
            ]);
            return;
        }
        
        $schedules = $this->scheduleModel->getFormattedSchedule($userId, $companyId);
        $dayName = \API\Config\Config::DAY_MAP[$dayOfWeek];
        
        Response::success([
            'date' => $date,
            'day_of_week' => $dayOfWeek,
            'day_name' => $dayName,
            'available' => true,
            'schedules' => $schedules[$dayName] ?? []
        ]);
    }
}
