<?php
namespace API\Controllers;

use API\Models\Execution;
use API\Helpers\Response;
use API\Helpers\Validator;
use API\Middleware\AuthMiddleware;

class ExecutionController
{
    private $executionModel;
    private $auth;

    public function __construct()
    {
        $this->executionModel = new Execution();
        $this->auth = new AuthMiddleware();
    }

    /**
     * GET /executions
     * Lista todas as guias/execuções da empresa
     */
    public function list($params)
    {
        $validator = new Validator($params);
        $validator->required('company');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        $apiKeyData = $this->auth->validate($params['company']);
        if (!$apiKeyData) {
            return;
        }

        try {
            $limit = isset($params['limit']) ? (int)$params['limit'] : 50;
            $offset = isset($params['offset']) ? (int)$params['offset'] : 0;
            $limit = min($limit, 200);

            $filters = [];
            $filterFields = [
                'agreement', 'agreement_name', 'agreement_parent_id', 
                'user', 'patient', 'guide_number', 'guide_number_provider', 
                'status_guide', 'status', 'attendance_date_start', 
                'attendance_date_end', 'authorization_date_start',
                'authorization_date_end', 'password', 'checkin', 'type',
                'order_by', 'order_dir'
            ];

            foreach ($filterFields as $field) {
                if (!empty($params[$field])) {
                    $filters[$field] = $params[$field];
                }
            }

            $executions = $this->executionModel->getByCompany(
                $params['company'], 
                $filters, 
                $limit, 
                $offset
            );

            $total = $this->executionModel->countByFilters($params['company'], $filters);

            $formattedExecutions = array_map(function($exec) {
                return $this->formatExecution($exec);
            }, $executions);

            return Response::success([
                'executions' => $formattedExecutions,
                'total' => $total,
                'limit' => $limit,
                'offset' => $offset,
                'filters' => $filters,
                'has_more' => ($offset + $limit) < $total
            ]);

        } catch (\Exception $e) {
            return Response::error('Error: ' . $e->getMessage(), 500);
        }
    }

    /**
     * GET /executions/unimed
     * Lista guias Unimed com estatísticas
     */
    public function listUnimed($params)
    {
        $validator = new Validator($params);
        $validator->required('company');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        $apiKeyData = $this->auth->validate($params['company']);
        if (!$apiKeyData) {
            return;
        }

        try {
            $limit = isset($params['limit']) ? (int)$params['limit'] : 50;
            $offset = isset($params['offset']) ? (int)$params['offset'] : 0;
            $limit = min($limit, 200);

            $filters = [];
            $filterFields = [
                'user', 'patient', 'guide_number', 'guide_number_provider',
                'status_guide', 'status', 'attendance_date_start',
                'attendance_date_end', 'authorization_date_start',
                'authorization_date_end', 'password', 'checkin', 'type',
                'order_by', 'order_dir'
            ];

            foreach ($filterFields as $field) {
                if (!empty($params[$field])) {
                    $filters[$field] = $params[$field];
                }
            }

            $executions = $this->executionModel->getUnimedGuides(
                $params['company'],
                $filters,
                $limit,
                $offset
            );

            $total = $this->executionModel->countUnimedGuides($params['company'], $filters);
            $stats = $this->executionModel->getStatistics($params['company'], ['agreement_name' => 'unimed']);

            $formattedExecutions = array_map(function($exec) {
                return $this->formatExecution($exec);
            }, $executions);

            return Response::success([
                'executions' => $formattedExecutions,
                'total' => $total,
                'limit' => $limit,
                'offset' => $offset,
                'filters' => $filters,
                'has_more' => ($offset + $limit) < $total,
                'statistics' => [
                    'total_guides' => (int)($stats['total_guides'] ?? 0),
                    'total_value' => (float)($stats['total_value'] ?? 0),
                    'formatted_total_value' => 'R$ ' . number_format((float)($stats['total_value'] ?? 0), 2, ',', '.'),
                    'by_status' => [
                        'authorized' => (int)($stats['authorized'] ?? 0),
                        'pending' => (int)($stats['pending'] ?? 0),
                        'denied' => (int)($stats['denied'] ?? 0)
                    ],
                    'by_type' => [
                        'local' => (int)($stats['type_local'] ?? 0),
                        'intercambio' => (int)($stats['type_intercambio'] ?? 0)
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            return Response::error('Error: ' . $e->getMessage(), 500);
        }
    }

    /**
     * GET /executions/{id}
     */
    public function show($id)
    {
        $params = array_merge($_GET, ['id' => $id]);
        
        $validator = new Validator($params);
        $validator->required('id')->required('company');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        $apiKeyData = $this->auth->validate($params['company']);
        if (!$apiKeyData) {
            return;
        }

        try {
            $execution = $this->executionModel->findWithDetails($params['id']);

            if (!$execution) {
                return Response::error('Guia não encontrada', 404);
            }

            if ($execution['company'] != $params['company']) {
                return Response::error('Acesso não autorizado', 403);
            }

            return Response::success([
                'execution' => $this->formatExecutionDetailed($execution)
            ]);

        } catch (\Exception $e) {
            return Response::error('Error: ' . $e->getMessage(), 500);
        }
    }

                                                                                                              
    ⏺ /**                                                                                                         
    * GET /executions/by-guide-number/{guide_number}                                                           
    *                                                                                                          
    * Busca dados da GUIA/EXECUÇÃO por número                                                                  
    *                                                                                                          
    * Retorna dados completos da guia para:                                                                    
    * - Verificação de divergências (workflow n8n)                                                             
    * - Auditoria de faturamento                                                                               
    * - Conferência de dados                                                                                   
    * - Geração XML TISS (equipeSADT)                                                                          
    *                                                                                                          
    * @param string $guideNumber - Número da guia (interno ou operadora)                                       
    * @return void                                                                                             
    */                                                                                                         
   public function findByGuideNumber($guideNumber)                                                             
   {                                                                                                           
       $params = $_GET;                                                                                        
       $params['guide_number'] = $guideNumber;                                                                 
                                                                                                               
       $validator = new Validator($params);                                                                    
       $validator->required('company', 'company');                                                             
                                                                                                               
       if ($validator->fails()) {                                                                              
           return Response::error($validator->getErrors(), 400);                                               
       }
 
       $apiKeyData = $this->auth->validate($params['company']);
       if (!$apiKeyData) {
           return;
       }
 
       $companyId = $apiKeyData['company_id'];
 
       try {
           // Buscar TODAS as execuções da guia
           $executions = $this->executionModel->findByGuideNumber($guideNumber, $companyId);
 
           if (empty($executions)) {
               return Response::error('Guia não encontrada', 404);
           }
 
           // Pegar primeiro registro para dados únicos da guia
           $first = $executions[0];
 
           // Montar array de atendimentos (pode ter múltiplos!)
           $attendances = [];
           foreach ($executions as $exec) {
               $attendances[] = [
                   'id' => (int)$exec['id'],
                   'date' => $exec['attendance_day'],
                   'start' => $exec['attendance_start'],
                   'end' => $exec['attendance_end'],
                   'first_consultation' => $exec['first_consultation'],
 
                   // Profissional — inclui dados para TISS equipeSADT
                   'professional' => [
                       'id' => (int)$exec['user'],
                       'name' => trim($exec['professional_first_name'] . ' ' .
   $exec['professional_last_name']),
                       'cpf' => $exec['professional_cpf'] ?? null,
                       'rg' => $exec['professional_rg'] ?? null,
                       'council' => $exec['professional_council'] ?? null,
                       'council_number' => $exec['professional_council_number'] ?? null,
                       'council_uf' => $exec['professional_council_uf'] ?? null,
                       'cbos' => $exec['professional_cbos'] ?? null,
                   ],
 
                   // Procedimento pode variar por atendimento
                   'procedure' => [
                       'table_tuss_id' => $exec['table_tuss'] ? (int)$exec['table_tuss'] : null,
                       'code' => $exec['tuss_code'] ?? null,
                       'description' => $exec['tuss_description'] ?? null
                   ],
 
                   'value' => $exec['value'] ? (float)$exec['value'] : null,
                   'value_formatted' => $exec['value'] ? number_format((float)$exec['value'], 2, ',', '.') :
   null,
                   'status_guide' => $exec['status_guide'],
                   'status' => $exec['status'],
                   'type' => $exec['type'],
                   'checkin' => $exec['checkin'],
                   'observation' => $exec['observation'] ?? null,
 
                   // Flags úteis
                   'is_authorized' => $exec['status_guide'] === 'AUTORIZADA',
                   'has_checkin' => $exec['checkin'] === 'yes',
                   'is_active' => $exec['status'] === 'active'
               ];
           }
 
           // Calcular totais
           $totalValue = 0;
           $totalAuthorized = 0;
           $totalPending = 0;
           $totalCheckin = 0;
 
           foreach ($executions as $exec) {
               $totalValue += (float)($exec['value'] ?? 0);
               if ($exec['status_guide'] === 'AUTORIZADA') $totalAuthorized++;
               if ($exec['status_guide'] === 'PENDENTE') $totalPending++;
               if ($exec['checkin'] === 'yes') $totalCheckin++;
           }
 
           // Formatar resposta
           $response = [
               // Dados únicos da guia
               'guide_number' => $first['guide_number'],
               'guide_number_provider' => $first['guide_number_provider'],
 
               // Paciente (único)
               'patient' => [
                   'id' => (int)$first['patient'],
                   'name' => trim($first['patient_first_name'] . ' ' . $first['patient_last_name']),
                   'document' => $first['patient_document'] ?? null,
                   'mobile' => $first['patient_mobile'] ?? null,
                   'email' => $first['patient_email'] ?? null,
                   'born_at' => $first['patient_born_at'] ?? null
               ],
 
               // Autorização (única)
               'authorization' => [
                   'date' => $first['authorization_date'],
                   'password' => $first['password'],
                   'password_valid_until' => $first['validate_password'],
                   'request_date' => $first['request_date']
               ],
 
               // Convênio (único)
               'agreement' => [
                   'id' => isset($first['agreement']) ? (int)$first['agreement'] : null,
                   'name' => $first['agreement_name'] ?? null,
                   'type' => $first['agreement_type'] ?? null,
                   'parent_id' => isset($first['agreement_parent_id']) && $first['agreement_parent_id'] ?
   (int)$first['agreement_parent_id'] : null,
                   'parent_name' => $first['agreement_parent_name'] ?? null
               ],
 
               // 🎯 ARRAY DE ATENDIMENTOS (múltiplos!)
               'attendances' => $attendances,
 
               // Totais
               'totals' => [
                   'count' => count($executions),
                   'value' => $totalValue,
                   'value_formatted' => number_format($totalValue, 2, ',', '.'),
                   'authorized' => $totalAuthorized,
                   'pending' => $totalPending,
                   'with_checkin' => $totalCheckin
               ],
 
               // Metadados
               'saw_consulta_at' => $first['saw_consulta_at'] ?? null,
               'created_at' => $first['created_at'],
               'updated_at' => $first['updated_at']
           ];
 
           return Response::success($response);
 
       } catch (\Exception $e) {
           return Response::error('Error: ' . $e->getMessage(), 500);
       }
   }

    /**
     * GET /executions/agreements
     * Lista convênios disponíveis
     */
    public function listAgreements($params)
    {
        $validator = new Validator($params);
        $validator->required('company');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        $apiKeyData = $this->auth->validate($params['company']);
        if (!$apiKeyData) {
            return;
        }

        try {
            $agreements = $this->executionModel->listAgreements($params['company']);
            $parentAgreements = $this->executionModel->listParentAgreements($params['company']);

            return Response::success([
                'agreements' => $agreements,
                'parent_agreements' => $parentAgreements
            ]);

        } catch (\Exception $e) {
            return Response::error('Error: ' . $e->getMessage(), 500);
        }
    }

    /**
     * GET /executions/statistics
     * Estatísticas das guias
     */
    public function statistics($params)
    {
        $validator = new Validator($params);
        $validator->required('company');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        $apiKeyData = $this->auth->validate($params['company']);
        if (!$apiKeyData) {
            return;
        }

        try {
            $filters = [];
            $filterFields = [
                'agreement_name', 'agreement_parent_id', 'user', 'patient',
                'attendance_date_start', 'attendance_date_end',
                'authorization_date_start', 'authorization_date_end',
                'status_guide', 'type'
            ];

            foreach ($filterFields as $field) {
                if (!empty($params[$field])) {
                    $filters[$field] = $params[$field];
                }
            }

            $stats = $this->executionModel->getStatistics($params['company'], $filters);

            return Response::success([
                'statistics' => [
                    'total_guides' => (int)($stats['total_guides'] ?? 0),
                    'total_value' => (float)($stats['total_value'] ?? 0),
                    'formatted_total_value' => 'R$ ' . number_format((float)($stats['total_value'] ?? 0), 2, ',', '.'),
                    'unique_patients' => (int)($stats['unique_patients'] ?? 0),
                    'unique_professionals' => (int)($stats['unique_professionals'] ?? 0),
                    'by_status' => [
                        'authorized' => (int)($stats['authorized'] ?? 0),
                        'pending' => (int)($stats['pending'] ?? 0),
                        'denied' => (int)($stats['denied'] ?? 0)
                    ],
                    'by_type' => [
                        'local' => (int)($stats['type_local'] ?? 0),
                        'intercambio' => (int)($stats['type_intercambio'] ?? 0)
                    ],
                    'with_checkin' => (int)($stats['with_checkin'] ?? 0)
                ],
                'filters' => $filters
            ]);

        } catch (\Exception $e) {
            return Response::error('Error: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Formata dados da execução para resposta da API
     */
    private function formatExecution($exec)
    {
        return [
            'id' => (int)$exec['id'],
            'guide_number' => $exec['guide_number'],
            'guide_number_provider' => $exec['guide_number_provider'],
            'patient' => [
                'id' => (int)$exec['patient'],
                'name' => trim($exec['patient_first_name'] . ' ' . $exec['patient_last_name']),
                'document' => $exec['patient_document'] ?? null,
                'mobile' => $exec['patient_mobile'] ?? null
            ],
            'professional' => [
                'id' => (int)$exec['user'],
                'name' => trim($exec['professional_first_name'] . ' ' . $exec['professional_last_name'])
            ],
            'agreement' => [
                'id' => $exec['agreement'] ? (int)$exec['agreement'] : null,
                'name' => $exec['agreement_name'] ?? null,
                'parent_id' => $exec['agreement_parent_id'] ? (int)$exec['agreement_parent_id'] : null,
                'parent_name' => $exec['agreement_parent_name'] ?? null
            ],
            'authorization' => [
                'date' => $exec['authorization_date'],
                'password' => $exec['password'],
                'password_valid_until' => $exec['validate_password']
            ],
            'attendance' => [
                'date' => $exec['attendance_day'],
                'start' => $exec['attendance_start'],
                'end' => $exec['attendance_end']
            ],
            'value' => $exec['value'] ? (float)$exec['value'] : null,
            'status_guide' => $exec['status_guide'],
            'status' => $exec['status'],
            'type' => $exec['type'],
            'checkin' => $exec['checkin'],
            'observation' => $exec['observation'] ?? null,
            'created_at' => $exec['created_at'],
            'updated_at' => $exec['updated_at']
        ];
    }

    /**
     * Formata dados detalhados da execução
     */
    private function formatExecutionDetailed($exec)
    {
        $formatted = $this->formatExecution($exec);
        
        // Adicionar campos extras do detalhamento
        $formatted['patient']['email'] = $exec['patient_email'] ?? null;
        $formatted['patient']['born_at'] = $exec['patient_born_at'] ?? null;
        $formatted['professional']['rg'] = $exec['professional_rg'] ?? null;
        $formatted['table_tuss'] = [
            'id' => $exec['table_tuss'] ? (int)$exec['table_tuss'] : null,
            'name' => $exec['table_tuss_name'] ?? null
        ];
        
        return $formatted;
    }
    
    /**
     * GET /executions/pending/{guide_number}
     * Busca procedimentos pendentes de cobrança no SAW
     */
    public function getPending($params)
    {
        $guideNumber = $params['guide_number'] ?? null;
        $queryParams = $_GET;
        $queryParams['guide_number'] = $guideNumber;
        
        $validator = new Validator($queryParams);
        $validator->required('company');
    
        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }
    
        if (!$guideNumber) {
            return Response::error('guide_number é obrigatório', 400);
        }
    
        $apiKeyData = $this->auth->validate($queryParams['company']);
        if (!$apiKeyData) {
            return;
        }
    
        try {
            $result = $this->executionModel->getPendingByGuideNumber(
                $guideNumber, 
                $queryParams['company']
            );
            
            return Response::success([
                'guide_number' => $guideNumber,
                'paciente' => $result['paciente'],
                'procedimentos' => $result['procedimentos'],
                'total' => count($result['procedimentos'])
            ]);
    
        } catch (\Exception $e) {
            return Response::error('Error: ' . $e->getMessage(), 500);
        }
    }
    
    /**
     * NOVO MÉTODO - Marca uma execução individual como realizada
     * Rota: PUT /api/v1/executions/{id}/mark-realized?company=1
     */
    public function markExecutionRealized($params)
    {
        $executionId = $params['id'] ?? null;
        $queryParams = $_GET;
        
        // Validar parâmetros obrigatórios
        $validator = new Validator(array_merge($queryParams, ['id' => $executionId]));
        $validator->required('company');
        $validator->required('id');
    
        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }
    
        // Autenticar
        $apiKeyData = $this->auth->validate($queryParams['company']);
        if (!$apiKeyData) {
            return;
        }
    
        try {
            // Parse do body
            $body = json_decode(file_get_contents('php://input'), true);
            
            if (!$body) {
                return Response::error('Body JSON inválido', 400);
            }
            
            // Validar se a execução existe
            $execution = $this->executionModel->getExecutionById(
                $executionId,
                $queryParams['company']
            );
            
            if (!$execution) {
                return Response::error('Execução não encontrada', 404);
            }
            
            // Atualizar execução
            $success = $this->executionModel->markExecutionAsRealized(
                $executionId,
                $queryParams['company'],
                $body
            );
            
            if (!$success) {
                return Response::error('Falha ao atualizar execução', 500);
            }
            
            return Response::success([
                'id' => $executionId,
                'guide_number' => $execution['guide_number'],
                'realized' => !empty($body['realized']),
                'updated_at' => date('Y-m-d H:i:s')
            ]);
    
        } catch (\Exception $e) {
            error_log('Erro em markExecutionRealized: ' . $e->getMessage());
            return Response::error('Erro ao processar requisição: ' . $e->getMessage(), 500);
        }
    }
    
    /**
     * MÉTODO ANTIGO - MANTÉM PARA COMPATIBILIDADE (DEPRECATED)
     * Rota: PUT /api/v1/executions/mark-realized/{guide_number}?company=1
     */
    public function markRealized($params)
    {
        $guideNumber = $params['guide_number'] ?? null;
        $queryParams = $_GET;
        $queryParams['guide_number'] = $guideNumber;
        
        $validator = new Validator($queryParams);
        $validator->required('company');
    
        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }
    
        if (!$guideNumber) {
            return Response::error('guide_number é obrigatório', 400);
        }
    
        $apiKeyData = $this->auth->validate($queryParams['company']);
        if (!$apiKeyData) {
            return;
        }
    
        try {
            $body = json_decode(file_get_contents('php://input'), true);
            
            $execucoes = $body['execucoes'] ?? [];
            $totalExecutado = $body['total_executado'] ?? 0;
            
            $updated = $this->executionModel->markAsRealized(
                $guideNumber,
                $queryParams['company'],
                $execucoes
            );
            
            return Response::success([
                'guide_number' => $guideNumber,
                'updated' => $updated,
                'total_executado' => $totalExecutado,
                'deprecated' => true,
                'message' => 'Use PUT /api/v1/executions/{id}/mark-realized para atualizar execuções individuais'
            ]);
    
        } catch (\Exception $e) {
            return Response::error('Error: ' . $e->getMessage(), 500);
        }
    }
}