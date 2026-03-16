<?php
namespace API\Controllers;

use API\Models\Schedule;
use API\Models\User;
use API\Models\Appointment;
use API\Models\GoogleCalendar;
use API\Helpers\Response;
use API\Helpers\Validator;
use API\Middleware\AuthMiddleware;
use API\Helpers\HolidayHelper;


class ScheduleController
{
    private $scheduleModel;
    private $userModel;
    private $appointmentModel;
    private $googleCalendarModel;
    private $auth;

    public function __construct()
    {
        $this->scheduleModel = new Schedule();
        $this->userModel = new User();
        $this->appointmentModel = new Appointment();
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

    /**
     * MODIFICADO: Retorna disponibilidade do profissional
     * - SEM date: retorna todos os dias da semana que atende
     * - COM date: retorna dia específico (compatibilidade)
     */
    public function availability($companyId, $userId)
    {
        $apiKeyData = $this->auth->validate($companyId);
        if (!$apiKeyData) {
            return;
        }

        $date = Response::getQueryParam('date');
        
        // Validar se profissional existe
        if (!$this->userModel->isActive($userId, $companyId)) {
            Response::notFound('Profissional');
            return;
        }

        // SEM date: retorna grade semanal completa
        if (empty($date)) {
            $this->getWeeklyAvailability($companyId, $userId);
            return;
        }

        // COM date: retorna dia específico (mantém compatibilidade)
        $validator = new Validator(['date' => $date]);
        $validator->required('date')->date('date');

        if ($validator->fails()) {
            Response::validationError($validator->getErrors());
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

    /**
     * NOVO: Retorna grade semanal completa do profissional
     */
    private function getWeeklyAvailability($companyId, $userId)
    {
        $user = $this->userModel->getFullInfo($userId, $companyId);
        $schedules = $this->scheduleModel->getFormattedSchedule($userId, $companyId);
        $workDays = $this->scheduleModel->getWorkDays($userId, $companyId);

        $weeklySchedule = [];

        foreach ($workDays as $dayNumber) {
            $dayName = \API\Config\Config::DAY_MAP[$dayNumber];
            $daySchedules = $schedules[$dayName] ?? [];

            if (empty($daySchedules)) {
                continue;
            }

            // Determinar períodos
            $periods = [];
            foreach ($daySchedules as $schedule) {
                $startHour = (int) substr($schedule['inicio'], 0, 2);
                if ($startHour < 12) {
                    $periods[] = 'manhã';
                } else {
                    $periods[] = 'tarde';
                }
            }
            $periods = array_unique($periods);

            $weeklySchedule[] = [
                'day_of_week' => (int) $dayNumber,
                'day_name' => $dayName,
                'periods' => array_values($periods),
                'schedules' => $daySchedules
            ];
        }

        Response::success([
            'professional' => [
                'id' => (int) $userId,
                'name' => User::getFullName($user),
                'occupation' => $user['occupation_name'] ?? null
            ],
            'weekly_schedule' => $weeklySchedule
        ]);
    }

    /**
     * Calcula próximas N ocorrências de um dia da semana
     */
    private function getNextDatesForDayOfWeek($dayOfWeek, $weeks)
    {
        $dates = [];
        $currentDate = new \DateTime();
        $found = 0;

        // Buscar até encontrar N ocorrências do dia da semana
        while ($found < $weeks) {
            $currentDayOfWeek = (int) $currentDate->format('N');
            
            if ($currentDayOfWeek == $dayOfWeek) {
                $dates[] = $currentDate->format('Y-m-d');
                $found++;
            }
            
            $currentDate->modify('+1 day');
        }

        return $dates;
    }
    
    /**
     * NOVO: Retorna slots disponíveis em datas específicas
     * GET /schedules/{company_id}/available-slots/{user_id}?day_of_week=4&weeks=2&duration=45&period=tarde
     */
    public function availableSlots($companyId, $userId)
    {
        $apiKeyData = $this->auth->validate($companyId);
        if (!$apiKeyData) {
            return;
        }
        
        // Buscar cidade/estado da empresa
        $companyData = $this->scheduleModel->getCompanyLocation($companyId);
        $city = $companyData['address_city'] ?? 'São Paulo';
        $state = $companyData['address_state'] ?? 'SP';
    
        // Validar parâmetros
        $dayOfWeek = Response::getQueryParam('day_of_week');
        $weeks = Response::getQueryParam('weeks', 2); // Padrão: 2 semanas
        $duration = Response::getQueryParam('duration', 45); // Padrão: 45 min
        $period = Response::getQueryParam('period', ''); // NOVO: período (manhã/tarde/noite)
    
        $validator = new Validator([
            'day_of_week' => $dayOfWeek,
            'weeks' => $weeks,
            'duration' => $duration
        ]);
        $validator->required('day_of_week');
    
        if ($validator->fails()) {
            Response::validationError($validator->getErrors());
            return;
        }
    
        // Validar profissional
        $user = $this->userModel->getFullInfo($userId, $companyId);
        if (!$user) {
            Response::notFound('Profissional');
            return;
        }
    
        // Verificar se profissional trabalha neste dia
        if (!$this->scheduleModel->worksOnDay($userId, $companyId, $dayOfWeek)) {
            Response::success([
                'professional' => [
                    'id' => (int) $userId,
                    'name' => User::getFullName($user)
                ],
                'message' => 'Profissional não trabalha neste dia da semana',
                'available_dates' => []
            ]);
            return;
        }
    
        // Buscar horários de trabalho
        $schedules = $this->scheduleModel->getFormattedSchedule($userId, $companyId);
        $dayName = \API\Config\Config::DAY_MAP[$dayOfWeek];
        $workSchedules = $schedules[$dayName] ?? [];
    
        if (empty($workSchedules)) {
            Response::success([
                'professional' => [
                    'id' => (int) $userId,
                    'name' => User::getFullName($user)
                ],
                'message' => 'Nenhum horário configurado para este dia',
                'available_dates' => []
            ]);
            return;
        }
    
        // Calcular próximas datas
        $dates = $this->getNextDatesForDayOfWeek($dayOfWeek, $weeks);
    
        // Para cada data, calcular slots disponíveis
        // Para cada data, calcular slots disponíveis
        $availableDates = [];
        foreach ($dates as $date) {
            // NOVO: Verificar se é feriado
            if (\API\Helpers\HolidayHelper::isHoliday($date, 'Itabuna', 'BA')) {
                continue; // Pula feriados
            }
            
            $slots = $this->calculateAvailableSlots(
                $userId,
                $companyId,
                $date,
                $workSchedules,
                $duration,
                $period
            );
        
            if (!empty($slots)) {
                $availableDates[] = [
                    'date' => $date,
                    'formatted_date' => date('d/m/Y', strtotime($date)),
                    'day_name' => $dayName,
                    'available_slots' => $slots,
                    'total' => count($slots)
                ];
            }
        }
    
        Response::success([
            'professional' => [
                'id' => (int) $userId,
                'name' => User::getFullName($user),
                'occupation' => $user['occupation_name'] ?? null
            ],
            'day_of_week' => (int) $dayOfWeek,
            'day_name' => $dayName,
            'period' => $period, // NOVO: retorna período aplicado
            'duration_minutes' => (int) $duration,
            'weeks_ahead' => (int) $weeks,
            'available_dates' => $availableDates,
            'total_dates' => count($availableDates)
        ]);
    }

    /**
     * Calcula slots disponíveis em uma data específica
     * ATUALIZADO: Agora aceita filtro de período
     */
    private function calculateAvailableSlots($userId, $companyId, $date, $workSchedules, $duration, $period = '')
    {
        // Buscar agendamentos existentes nesta data
        $existingAppointments = $this->appointmentModel->getByUserAndDate($userId, $companyId, $date);
        
        // Criar array de horários ocupados
        $occupiedTimes = [];
        foreach ($existingAppointments as $apt) {
            $occupiedTimes[] = date('H:i', strtotime($apt['day']));
        }
    
        // Gerar todos os slots possíveis
        $allSlots = [];
        foreach ($workSchedules as $schedule) {
            $slots = $this->generateTimeSlots(
                $schedule['inicio'],
                $schedule['fim'],
                $duration
            );
            $allSlots = array_merge($allSlots, $slots);
        }
    
        // Filtrar slots ocupados E por período
        $availableSlots = [];
        foreach ($allSlots as $slot) {
            // Verificar se está ocupado
            if (in_array($slot, $occupiedTimes)) {
                continue;
            }
    
            // NOVO: Filtrar por período se especificado
            if (!empty($period)) {
                $hour = (int) substr($slot, 0, 2);
                $periodLower = strtolower($period);
                
                // Manhã: antes das 12h
                if (strpos($periodLower, 'manhã') !== false || strpos($periodLower, 'manha') !== false) {
                    if ($hour >= 12) continue;
                }
                // Tarde: 12h até 18h
                elseif (strpos($periodLower, 'tarde') !== false) {
                    if ($hour < 12 || $hour >= 18) continue;
                }
                // Noite: após 18h
                elseif (strpos($periodLower, 'noite') !== false) {
                    if ($hour < 18) continue;
                }
            }
    
            $endTime = date('H:i', strtotime($slot) + ($duration * 60));
            $availableSlots[] = [
                'time' => $slot,
                'formatted' => $slot . ' - ' . $endTime
            ];
        }
    
        return $availableSlots;
    }

    /**
     * Gera slots de horários a cada N minutos
     */
    private function generateTimeSlots($start, $end, $duration)
    {
        $slots = [];
        $current = strtotime($start);
        $endTime = strtotime($end);

        while ($current < $endTime) {
            $slots[] = date('H:i', $current);
            $current += ($duration * 60);
        }

        return $slots;
    }
}
