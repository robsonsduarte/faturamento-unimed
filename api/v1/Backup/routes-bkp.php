<?php

use API\Controllers\ScheduleController;
use API\Controllers\ProfessionalController;
use API\Controllers\SyncController;
use API\Controllers\AppointmentController;
use API\Controllers\PatientController;
use API\Controllers\NotificationController;
use API\Helpers\Response;

class Router
{
    private $method;
    private $path;
    private $pathParts;

    public function __construct()
    {
        $this->method = $_SERVER['REQUEST_METHOD'];
        $this->path = $this->getPath();
        $this->pathParts = explode('/', trim($this->path, '/'));
    }

    private function getPath()
    {
        $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        $path = preg_replace('#^/service/api/v1#', '', $path);
        return $path ?: '/';
    }

    public function dispatch()
    {
        // ========================================================================
        // SCHEDULES (Horários)
        // ========================================================================
        
        if ($this->matches('GET', '/schedules/{company_id}/available-slots/{user_id}')) {
            $controller = new ScheduleController();
            $controller->availableSlots($this->getParam(1), $this->getParam(3));
            return;
        }

        if ($this->matches('GET', '/schedules/{company_id}/availability/{user_id}')) {
            $controller = new ScheduleController();
            $controller->availability($this->getParam(1), $this->getParam(3));
            return;
        }

        if ($this->matches('GET', '/schedules/{company_id}/{user_id}')) {
            $controller = new ScheduleController();
            $controller->show($this->getParam(1), $this->getParam(2));
            return;
        }

        if ($this->matches('GET', '/schedules/{company_id}')) {
            $controller = new ScheduleController();
            $controller->index($this->getParam(1));
            return;
        }

        // ========================================================================
        // PROFESSIONALS (Profissionais)
        // ========================================================================

        if ($this->matches('GET', '/professionals/{company_id}/occupations')) {
            $controller = new ProfessionalController();
            $controller->occupations($this->getParam(1));
            return;
        }

        if ($this->matches('GET', '/professionals/{company_id}/{user_id}')) {
            $controller = new ProfessionalController();
            $controller->show($this->getParam(1), $this->getParam(2));
            return;
        }

        if ($this->matches('GET', '/professionals/{company_id}')) {
            $controller = new ProfessionalController();
            $controller->index($this->getParam(1));
            return;
        }

        // ========================================================================
        // SYNC (Sincronização Google Calendar)
        // ========================================================================

        if ($this->matches('POST', '/sync/google-calendar')) {
            $controller = new SyncController();
            $controller->create();
            return;
        }

        if ($this->matches('PUT', '/sync/google-calendar/{company_id}/{user_id}/toggle')) {
            $controller = new SyncController();
            $controller->toggle($this->getParam(2), $this->getParam(3));
            return;
        }

        if ($this->matches('DELETE', '/sync/google-calendar/{company_id}/{user_id}')) {
            $controller = new SyncController();
            $controller->delete($this->getParam(2), $this->getParam(3));
            return;
        }

        if ($this->matches('GET', '/sync/google-calendar/{company_id}')) {
            $controller = new SyncController();
            $controller->index($this->getParam(2));
            return;
        }

        // ========================================================================
        // APPOINTMENTS (Agendamentos)
        // ⚠️ IMPORTANTE: Rotas específicas ANTES de rotas genéricas
        // ========================================================================

        // POST /appointments - Criar agendamento
        if ($this->matches('POST', '/appointments')) {
            $controller = new AppointmentController();
            $data = json_decode(file_get_contents('php://input'), true);
            $controller->create($data);
            return;
        }

        // GET /appointments/check-availability
        if ($this->matches('GET', '/appointments/check-availability')) {
            $controller = new AppointmentController();
            $controller->checkAvailability($_GET);
            return;
        }

        // POST /appointments/search-by-patient
        if ($this->matches('POST', '/appointments/search-by-patient')) {
            $controller = new AppointmentController();
            $data = json_decode(file_get_contents('php://input'), true);
            $controller->searchByPatient($data);
            return;
        }

        // GET /appointments/by-google-event/{google_event_id}
        if ($this->matches('GET', '/appointments/by-google-event/{google_event_id}')) {
            $controller = new AppointmentController();
            $controller->findByGoogleEvent($this->getParam(2));
            return;
        }

        // GET /appointments/{id} - Buscar agendamento específico
        if ($this->matches('GET', '/appointments/{id}')) {
            $controller = new AppointmentController();
            $controller->show($this->getParam(1));
            return;
        }

        // GET /appointments - Listar agendamentos
        if ($this->matches('GET', '/appointments') && count($this->pathParts) === 1) {
            $controller = new AppointmentController();
            $controller->list($_GET);
            return;
        }

        // PUT /appointments/{id} - Atualizar agendamento
        if ($this->matches('PUT', '/appointments/{id}')) {
            $controller = new AppointmentController();
            $data = json_decode(file_get_contents('php://input'), true);
            $controller->update($this->getParam(1), $data);
            return;
        }

        // DELETE /appointments/{id} - Cancelar agendamento
        if ($this->matches('DELETE', '/appointments/{id}')) {
            $controller = new AppointmentController();
            $data = json_decode(file_get_contents('php://input'), true) ?: [];
            $controller->cancel($this->getParam(1), $data);
            return;
        }

        // ========================================================================
        // PATIENTS (Pacientes)
        // ========================================================================

        // POST /patients/find-or-create
        if ($this->matches('POST', '/patients/find-or-create')) {
            $controller = new PatientController();
            $data = json_decode(file_get_contents('php://input'), true);
            $controller->findOrCreate($data);
            return;
        }

        // GET /patients/search
        if ($this->matches('GET', '/patients/search')) {
            $controller = new PatientController();
            $controller->search($_GET);
            return;
        }

        // GET /patients/{id}
        if ($this->matches('GET', '/patients/{id}')) {
            $controller = new PatientController();
            $controller->show($this->getParam(1));
            return;
        }

        // GET /patients
        if ($this->matches('GET', '/patients') && count($this->pathParts) === 1) {
            $controller = new PatientController();
            $controller->list($_GET);
            return;
        }

        // PUT /patients/{id}
        if ($this->matches('PUT', '/patients/{id}')) {
            $controller = new PatientController();
            $data = json_decode(file_get_contents('php://input'), true);
            $controller->update($this->getParam(1), $data);
            return;
        }

        // ========================================================================
        // NOTIFICATIONS (Notificações WhatsApp)
        // ========================================================================

        // POST /notifications/send-whatsapp
        if ($this->matches('POST', '/notifications/send-whatsapp')) {
            $controller = new NotificationController();
            $data = json_decode(file_get_contents('php://input'), true);
            $controller->sendWhatsApp($data);
            return;
        }

        // POST /notifications/send-batch
        if ($this->matches('POST', '/notifications/send-batch')) {
            $controller = new NotificationController();
            $data = json_decode(file_get_contents('php://input'), true);
            $controller->sendBatch($data);
            return;
        }

        // GET /notifications/check-whatsapp/{phone}
        if ($this->matches('GET', '/notifications/check-whatsapp/{phone}')) {
            $controller = new NotificationController();
            $controller->checkWhatsApp($this->getParam(2));
            return;
        }

        // GET /notifications/status
        if ($this->matches('GET', '/notifications/status')) {
            $controller = new NotificationController();
            $controller->getStatus();
            return;
        }

        // ========================================================================
        // UTILITY (Health Check & Docs)
        // ========================================================================

        if ($this->matches('GET', '/health')) {
            Response::success([
                'status' => 'healthy',
                'version' => \API\Config\Config::API_VERSION,
                'timestamp' => date('c'),
                'features' => [
                    'appointments_api' => 'enabled',
                    'patients_api' => 'enabled',
                    'notifications_api' => 'enabled'
                ]
            ]);
            return;
        }

        if ($this->matches('GET', '/')) {
            Response::success([
                'name' => 'ConsultorioPro REST API',
                'version' => \API\Config\Config::API_VERSION,
                'documentation' => 'https://consultoriopro.com.br/api/docs',
                'endpoints' => [
                    'schedules' => [
                        'GET /schedules/{company_id}',
                        'GET /schedules/{company_id}/{user_id}',
                        'GET /schedules/{company_id}/availability/{user_id}',
                        'GET /schedules/{company_id}/available-slots/{user_id}'
                    ],
                    'professionals' => [
                        'GET /professionals/{company_id}',
                        'GET /professionals/{company_id}/{user_id}',
                        'GET /professionals/{company_id}/occupations'
                    ],
                    'sync' => [
                        'POST /sync/google-calendar',
                        'GET /sync/google-calendar/{company_id}',
                        'PUT /sync/google-calendar/{company_id}/{user_id}/toggle',
                        'DELETE /sync/google-calendar/{company_id}/{user_id}'
                    ],
                    'appointments' => [
                        'POST /appointments',
                        'GET /appointments',
                        'GET /appointments/{id}',
                        'PUT /appointments/{id}',
                        'DELETE /appointments/{id}',
                        'GET /appointments/check-availability',
                        'GET /appointments/by-patient-name',
                        'GET /appointments/by-google-event/{google_event_id}'
                    ],
                    'patients' => [
                        'POST /patients/find-or-create',
                        'GET /patients',
                        'GET /patients/{id}',
                        'GET /patients/search',
                        'PUT /patients/{id}'
                    ],
                    'notifications' => [
                        'POST /notifications/send-whatsapp',
                        'POST /notifications/send-batch',
                        'GET /notifications/check-whatsapp/{phone}',
                        'GET /notifications/status'
                    ]
                ]
            ]);
            return;
        }

        Response::notFound('Endpoint');
    }

    private function matches($method, $pattern)
    {
        if ($this->method !== $method) {
            return false;
        }

        $patternParts = explode('/', trim($pattern, '/'));

        if (count($this->pathParts) !== count($patternParts)) {
            return false;
        }

        foreach ($patternParts as $index => $part) {
            if (strpos($part, '{') === 0) {
                continue;
            }

            if ($part !== $this->pathParts[$index]) {
                return false;
            }
        }

        return true;
    }

    private function getParam($index)
    {
        return $this->pathParts[$index] ?? null;
    }
}

$router = new Router();
$router->dispatch();