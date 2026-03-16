<?php
namespace API\Controllers;

use API\Models\User;
use API\Models\GoogleCalendar;
use API\Helpers\Response;
use API\Middleware\AuthMiddleware;

/**
 * Controller de Profissionais
 * 
 * Gerencia profissionais da empresa (level = 6)
 * Inclui integração com Google Calendar e dados TISS
 * 
 * Rotas:
 * - GET /professionals/{company_id}
 * - GET /professionals/{company_id}/{user_id}
 * - GET /professionals/{company_id}/{user_id}/tiss
 * - GET /professionals/{company_id}/occupations
 * 
 * @version 2.0.0 - Refatorado em 04/12/2025
 * @bugfix Corrigido campo 'office' → 'occupation'
 */
class ProfessionalController
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
    
    /**
     * Lista todos os profissionais da empresa
     * 
     * GET /professionals/{company_id}
     * 
     * Query Params:
     * - search: Busca por nome (opcional)
     * - status: confirmed (default), pending, etc
     * - occupation: ID da ocupação (filtro)
     * - with_calendar: true/false (apenas com Google Calendar)
     * - limit: Limite de resultados (opcional)
     * 
     * @param int $companyId ID da empresa
     * @param string|null $search Termo de busca (opcional)
     * @param int $limit Limite de resultados (opcional, default: 50)
     * @return void
     */
    public function index($companyId, $search = null, $limit = 50)
    {
        // Validar autenticação
        $apiKeyData = $this->auth->validate($companyId);
        if (!$apiKeyData) {
            return;
        }
        
        // Obter parâmetros da query string
        $status = Response::getQueryParam('status', 'confirmed');
        $occupationId = Response::getQueryParam('occupation');
        $withCalendar = Response::getQueryParam('with_calendar', 'false');
        
        // Se search não veio como parâmetro, tentar pegar da query string
        if ($search === null) {
            $search = Response::getQueryParam('search');
        }
        
        // Se limit não foi especificado, pegar da query string
        if ($limit === 50) {
            $limitParam = Response::getQueryParam('limit');
            if ($limitParam !== null) {
                $limit = (int) $limitParam;
            }
        }
        
        // Buscar profissionais
        if ($withCalendar === 'true') {
            // Busca apenas profissionais com Google Calendar
            $professionals = $this->userModel->getWithGoogleCalendar($companyId);
            
            // Se tem busca, filtrar manualmente (getWithGoogleCalendar não aceita search)
            if ($search) {
                $professionals = $this->filterBySearch($professionals, $search);
            }
        } else {
            // Busca normal (com ou sem search)
            if ($search) {
                $professionals = $this->userModel->searchByCompany($companyId, $search, $status);
            } else {
                $professionals = $this->userModel->getByCompany($companyId, $status);
            }
        }
        
        // Filtrar por ocupação se especificado
        if ($occupationId) {
            $professionals = $this->filterByOccupation($professionals, $occupationId);
        }
        
        // Aplicar limite se especificado
        if ($limit > 0) {
            $professionals = array_slice($professionals, 0, $limit);
        }
        
        // Formatar resposta usando o formatador do Model
        $formatted = array_map(function($prof) {
            return $this->userModel->formatForAPI($prof);
        }, $professionals);
        
        // Retornar resposta
        Response::success($formatted, 200, [
            'total' => count($formatted),
            'company_id' => $companyId,
            'search' => $search,
            'limit' => $limit > 0 ? $limit : null
        ]);
    }
    
    /**
     * Busca profissional específico por ID
     * 
     * GET /professionals/{company_id}/{user_id}
     * 
     * @param int $companyId ID da empresa
     * @param int $userId ID do profissional
     * @return void
     */
    public function show($companyId, $userId)
    {
        // Validar autenticação
        $apiKeyData = $this->auth->validate($companyId);
        if (!$apiKeyData) {
            return;
        }
        
        // Buscar profissional com informações completas
        $user = $this->userModel->getFullInfo($userId, $companyId);
        
        if (!$user) {
            Response::notFound('Profissional');
            return;
        }
        
        // Formatar e retornar
        $formatted = $this->userModel->formatForAPI($user);
        Response::success($formatted);
    }
    
    /**
     * Busca dados do profissional para XML TISS
     * 
     * GET /professionals/{company_id}/{user_id}/tiss
     * 
     * Uso: Geração de XML TISS 4.01.00
     * Retorna: Estrutura equipe_sadt pronta para XML
     * 
     * @param int $companyId ID da empresa
     * @param int $userId ID do profissional
     * @return void
     */
    public function getTissData($companyId, $userId)
    {
        // Validar autenticação
        $apiKeyData = $this->auth->validate($companyId);
        if (!$apiKeyData) {
            return;
        }
        
        // Buscar dados formatados para TISS
        $tissData = $this->userModel->getForTiss($userId, $companyId);
        
        if (!$tissData) {
            Response::notFound('Profissional');
            return;
        }
        
        // Retornar estrutura TISS padrão ANS
        Response::success([
            'professional_id' => $tissData['id'],
            'equipe_sadt' => [
                'grauPart' => '12', // Fixo: Clínico/Profissional SADT
                'cpfContratado' => $tissData['cpf'],
                'nomeProf' => $tissData['nome'],
                'conselho' => $tissData['conselho'],
                'numeroConselhoProfissional' => $tissData['numeroConselho'],
                'UF' => $tissData['uf'],
                'CBOS' => $tissData['cbos']
            ]
        ]);
    }
    
    /**
     * Lista ocupações/especialidades da empresa
     * 
     * GET /professionals/{company_id}/occupations
     * 
     * @param int $companyId ID da empresa
     * @return void
     */
    public function occupations($companyId)
    {
        // Validar autenticação
        $apiKeyData = $this->auth->validate($companyId);
        if (!$apiKeyData) {
            return;
        }
        
        // Buscar ocupações
        $occupations = $this->userModel->getOccupations($companyId);
        
        Response::success($occupations, 200, [
            'total' => count($occupations),
            'company_id' => $companyId
        ]);
    }
    
    // ===================================================================
    // MÉTODOS PRIVADOS (HELPERS)
    // ===================================================================
    
    /**
     * Filtra profissionais por busca textual
     * 
     * Usado quando with_calendar=true (busca manual necessária)
     * 
     * @param array $professionals Lista de profissionais
     * @param string $search Termo de busca
     * @return array Profissionais filtrados
     */
    private function filterBySearch($professionals, $search)
    {
        $searchLower = mb_strtolower(trim($search), 'UTF-8');
        
        $filtered = array_filter($professionals, function($prof) use ($searchLower) {
            $fullName = mb_strtolower(
                trim(($prof['first_name'] ?? '') . ' ' . ($prof['last_name'] ?? '')), 
                'UTF-8'
            );
            return strpos($fullName, $searchLower) !== false;
        });
        
        return array_values($filtered);
    }
    
    /**
     * Filtra profissionais por ocupação
     * 
     * @param array $professionals Lista de profissionais
     * @param int $occupationId ID da ocupação
     * @return array Profissionais filtrados
     */
    private function filterByOccupation($professionals, $occupationId)
    {
        $filtered = array_filter($professionals, function($prof) use ($occupationId) {
            // BUGFIX: Corrigido de 'office' para 'occupation'
            // O campo correto na tabela users é 'occupation'
            return (int) $prof['occupation'] === (int) $occupationId;
        });
        
        return array_values($filtered);
    }
}