<?php
namespace API\Controllers;

use API\Models\User;
use API\Models\GoogleCalendar;
use API\Helpers\Response;
use API\Helpers\Validator;
use API\Middleware\AuthMiddleware;

class SyncController
{
    private $userModel;
    private $googleCalendarModel;
    private $auth;
    
    public function __construct()
    {
        $this->userModel = new User();
        $this->googleCalendarModel = new GoogleCalendar();
        $this->auth = new AuthMiddleware();
    }
    
    public function create()
    {
        $data = Response::getRequestBody();
        
        if (!$data) {
            Response::error('INVALID_JSON', 'Corpo da requisição está vazio ou não é um JSON válido', 400);
            return;
        }
        
        $validator = new Validator($data);
        $validator
            ->required('company_id', 'ID da empresa')
            ->integer('company_id')
            ->required('user_id', 'ID do usuário')
            ->integer('user_id')
            ->required('google_calendar_id', 'Google Calendar ID')
            ->googleCalendarId('google_calendar_id');
        
        if ($validator->fails()) {
            Response::validationError($validator->getErrors());
            return;
        }
        
        $companyId = (int) $data['company_id'];
        $userId = (int) $data['user_id'];
        $googleCalendarId = $data['google_calendar_id'];
        $syncEnabled = isset($data['sync_enabled']) ? (bool) $data['sync_enabled'] : true;
        
        $apiKeyData = $this->auth->validate($companyId);
        if (!$apiKeyData) {
            return;
        }
        
        if (!$this->userModel->isActive($userId, $companyId)) {
            Response::notFound('Usuário');
            return;
        }
        
        if ($this->googleCalendarModel->isCalendarIdInUse($googleCalendarId, $userId, $companyId)) {
            Response::error(
                'VALIDATION_ERROR',
                'Este Google Calendar ID já está em uso por outro profissional',
                422
            );
            return;
        }
        
        $result = $this->googleCalendarModel->createOrUpdate(
            $userId,
            $companyId,
            $googleCalendarId,
            $syncEnabled
        );
        
        if (!$result) {
            Response::error('SYNC_FAILED', 'Falha ao criar sincronização', 500);
            return;
        }
        
        $sync = $this->googleCalendarModel->getByUser($userId, $companyId);
        
        Response::created([
            'id' => (int) $sync['id'],
            'user_id' => $userId,
            'company_id' => $companyId,
            'google_calendar_id' => $googleCalendarId,
            'sync_enabled' => $syncEnabled,
            'created_at' => $sync['created_at'] ?? date('Y-m-d H:i:s')
        ], [
            'message' => 'Google Calendar sincronizado com sucesso'
        ]);
    }
    
    public function index($companyId)
    {
        $apiKeyData = $this->auth->validate($companyId);
        if (!$apiKeyData) {
            return;
        }
        
        $onlyEnabled = Response::getQueryParam('only_enabled', 'true') === 'true';
        
        $syncs = $this->googleCalendarModel->getByCompany($companyId, $onlyEnabled);
        
        $formatted = array_map(function($sync) {
            return $this->googleCalendarModel->formatForAPI($sync);
        }, $syncs);
        
        Response::success($formatted, 200, [
            'total' => count($formatted),
            'company_id' => $companyId
        ]);
    }
    
    public function toggle($companyId, $userId)
    {
        $apiKeyData = $this->auth->validate($companyId);
        if (!$apiKeyData) {
            return;
        }
        
        $data = Response::getRequestBody();
        
        if (!isset($data['sync_enabled'])) {
            Response::error('MISSING_REQUIRED_FIELD', 'Campo "sync_enabled" é obrigatório', 400);
            return;
        }
        
        $syncEnabled = (bool) $data['sync_enabled'];
        
        $sync = $this->googleCalendarModel->getByUser($userId, $companyId);
        
        if (!$sync) {
            Response::notFound('Sincronização');
            return;
        }
        
        $result = $this->googleCalendarModel->toggleSync($userId, $companyId, $syncEnabled);
        
        if (!$result) {
            Response::error('OPERATION_FAILED', 'Falha ao atualizar sincronização', 500);
            return;
        }
        
        Response::success([
            'user_id' => $userId,
            'company_id' => $companyId,
            'sync_enabled' => $syncEnabled,
            'message' => $syncEnabled ? 'Sincronização habilitada' : 'Sincronização desabilitada'
        ]);
    }
    
    public function delete($companyId, $userId)
    {
        $apiKeyData = $this->auth->validate($companyId);
        if (!$apiKeyData) {
            return;
        }
        
        $sync = $this->googleCalendarModel->getByUser($userId, $companyId);
        
        if (!$sync) {
            Response::notFound('Sincronização');
            return;
        }
        
        $result = $this->googleCalendarModel->deleteByUser($userId, $companyId);
        
        if (!$result) {
            Response::error('OPERATION_FAILED', 'Falha ao remover sincronização', 500);
            return;
        }
        
        Response::success([
            'message' => 'Sincronização removida com sucesso',
            'user_id' => $userId,
            'company_id' => $companyId
        ]);
    }
}
