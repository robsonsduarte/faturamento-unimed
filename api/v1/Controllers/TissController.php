<?php
namespace API\Controllers;

use API\Models\TissLote;
use API\Models\TissGuide;
use API\Models\TissProcedimento;
use API\Helpers\Response;
use API\Helpers\Validator;
use API\Helpers\TissXmlGenerator;
use API\Middleware\AuthMiddleware;
use API\Config\Database;

/**
 * Controller TISS - Nova Estrutura
 * 
 * Usa:
 * - app_xml_guide: 1 linha = 1 guia
 * - app_xml_lote: N linhas = N procedimentos por guia
 * - app_xml_lote_header: cabeçalho do lote
 */
class TissController
{
    private $auth;
    private $loteModel;
    private $guideModel;
    private $procedimentoModel;
    private $db;

    const MAX_GUIAS_POR_LOTE = 100;
    const XML_PATH = '/home/consult6/public_html/xmlUnimed';

    public function __construct()
    {
        $this->auth = new AuthMiddleware();
        $this->loteModel = new TissLote();
        $this->guideModel = new TissGuide();
        $this->procedimentoModel = new TissProcedimento();
        $this->db = Database::getInstance();
    }

    // =========================================================================
    // GUIAS PENDENTES
    // =========================================================================

    /**
     * GET /tiss/guias/pendentes
     * Lista guias pendentes (não faturadas)
     */
    public function guiasPendentes($params)
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
            $limit = isset($params['limit']) ? min((int)$params['limit'], self::MAX_GUIAS_POR_LOTE) : 50;
            $type = $params['type'] ?? null;

            $guias = $this->guideModel->getPendentes($params['company'], $type, $limit);
            $total = $this->guideModel->countPendentes($params['company'], $type);

            return Response::success([
                'guias' => $guias,
                'total' => $total,
                'limit' => $limit,
                'max_por_lote' => self::MAX_GUIAS_POR_LOTE
            ]);

        } catch (\Exception $e) {
            return Response::error('Erro ao buscar guias: ' . $e->getMessage(), 500);
        }
    }

    // =========================================================================
    // IMPORTAR GUIA COMPLETA (guia + procedimentos em uma chamada)
    // =========================================================================

    /**
     * POST /tiss/guias/importar-completa
     * Importa UMA guia com seus procedimentos
     * 
     * Formato esperado:
     * {
     *   "guia": { dados da guia },
     *   "procedimentos": [ array de procedimentos ]
     * }
     */
    public function importarGuiaCompleta($data)
    {
        $validator = new Validator($data);
        $validator->required('guia')->required('procedimentos');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        $guiaData = $data['guia'];
        $procedimentos = $data['procedimentos'];

        if (empty($guiaData['company'])) {
            $guiaData['company'] = 1;
        }

        $apiKeyData = $this->auth->validate($guiaData['company']);
        if (!$apiKeyData) {
            return;
        }

        if (empty($guiaData['numeroGuiaOperadora'])) {
            return Response::error('numeroGuiaOperadora é obrigatório', 400);
        }

        if (!is_array($procedimentos) || empty($procedimentos)) {
            return Response::error('Array de procedimentos inválido ou vazio', 400);
        }

        try {
            $this->db->beginTransaction();

            // Insere/atualiza guia
            $resultGuia = $this->guideModel->upsert($guiaData);

            if ($resultGuia['action'] === 'skipped') {
                $this->db->rollback();
                return Response::success([
                    'message' => 'Guia já faturada, não foi alterada',
                    'guide_id' => $resultGuia['id'],
                    'action' => 'skipped'
                ]);
            }

            $guideId = $resultGuia['id'];
            $dataAutorizacao = $guiaData['dataAutorizacao'] ?? date('Y-m-d');

            // Se guia foi atualizada, remove procedimentos antigos
            if ($resultGuia['action'] === 'updated') {
                $this->procedimentoModel->deleteByGuide($guideId);
            }

            // Insere procedimentos
            $procedimentosIds = [];
            $warnings = [];

            foreach ($procedimentos as $seq => $proc) {
                $proc['guide_id'] = $guideId;
                
                // Garante sequencial correto
                if (empty($proc['sequencialItem'])) {
                    $proc['sequencialItem'] = $seq + 1;
                }

                $resultProc = $this->procedimentoModel->inserirComValidacao($proc, $dataAutorizacao);

                if ($resultProc['success']) {
                    $procedimentosIds[] = $resultProc['id'];
                }

                if (!empty($resultProc['warnings'])) {
                    foreach ($resultProc['warnings'] as $campo => $msg) {
                        $warnings[] = "Proc " . ($seq + 1) . ": {$msg}";
                    }
                }
            }

            // Atualiza status da guia se todos procedimentos foram inseridos
            if (count($procedimentosIds) === count($procedimentos)) {
                $this->guideModel->update($guideId, ['status' => 'pendente']);
            } else {
                $this->guideModel->update($guideId, ['status' => 'erro']);
            }

            $this->db->commit();

            return Response::success([
                'message' => 'Guia importada com sucesso',
                'guide_id' => $guideId,
                'action' => $resultGuia['action'],
                'procedimentos_ids' => $procedimentosIds,
                'qtd_procedimentos' => count($procedimentosIds),
                'warnings' => $warnings
            ], 201);

        } catch (\Exception $e) {
            $this->db->rollback();
            return Response::error('Erro ao importar guia: ' . $e->getMessage(), 500);
        }
    }

    // =========================================================================
    // IMPORTAR GUIAS (batch)
    // =========================================================================

    /**
     * POST /tiss/guias/importar
     * Importa guias com procedimentos
     * 
     * Formato esperado:
     * {
     *   "company": 1,
     *   "guias": [
     *     {
     *       "numeroGuiaOperadora": "123456",
     *       "dataAutorizacao": "2025-11-01",
     *       ... outros campos da guia ...
     *       "procedimentos": [
     *         {
     *           "dataExecucao": "2025-11-05",
     *           "codigoProcedimento": "50000470",
     *           ... outros campos do procedimento ...
     *         }
     *       ]
     *     }
     *   ]
     * }
     */
    public function importarGuias($data)
    {
        $validator = new Validator($data);
        $validator->required('company')->required('guias');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        $apiKeyData = $this->auth->validate($data['company']);
        if (!$apiKeyData) {
            return;
        }

        if (!is_array($data['guias']) || empty($data['guias'])) {
            return Response::error('Array de guias inválido ou vazio', 400);
        }

        try {
            $results = [
                'guias_created' => 0,
                'guias_updated' => 0,
                'guias_skipped' => 0,
                'procedimentos_created' => 0,
                'errors' => [],
                'warnings' => []
            ];

            $this->db->beginTransaction();

            foreach ($data['guias'] as $index => $guiaData) {
                try {
                    if (empty($guiaData['numeroGuiaOperadora'])) {
                        $results['errors'][] = "Guia {$index}: numeroGuiaOperadora obrigatório";
                        continue;
                    }

                    // Prepara dados da guia
                    $guiaData['company'] = $data['company'];
                    $procedimentos = $guiaData['procedimentos'] ?? [];
                    unset($guiaData['procedimentos']);

                    // Insere/atualiza guia
                    $resultGuia = $this->guideModel->upsert($guiaData);

                    if ($resultGuia['action'] === 'skipped') {
                        $results['guias_skipped']++;
                        continue;
                    }

                    $results['guias_' . $resultGuia['action']]++;
                    $guideId = $resultGuia['id'];

                    if (!empty($resultGuia['errors'])) {
                        $results['warnings'][] = "Guia {$guiaData['numeroGuiaOperadora']}: " . 
                            implode(', ', $resultGuia['errors']);
                    }

                    // Insere procedimentos
                    if (!empty($procedimentos) && $resultGuia['action'] === 'created') {
                        $dataAutorizacao = $guiaData['dataAutorizacao'] ?? date('Y-m-d');
                        
                        foreach ($procedimentos as $seq => $proc) {
                            $proc['guide_id'] = $guideId;
                            $proc['sequencialItem'] = $seq + 1;
                            
                            $resultProc = $this->procedimentoModel->inserirComValidacao(
                                $proc, 
                                $dataAutorizacao
                            );
                            
                            if ($resultProc['success']) {
                                $results['procedimentos_created']++;
                            }
                            
                            if (!empty($resultProc['warnings'])) {
                                foreach ($resultProc['warnings'] as $campo => $msg) {
                                    $results['warnings'][] = "Guia {$guiaData['numeroGuiaOperadora']}, Proc " . ($seq + 1) . ": {$msg}";
                                }
                            }
                        }
                    }

                } catch (\Exception $e) {
                    $results['errors'][] = "Guia {$index}: " . $e->getMessage();
                }
            }

            $this->db->commit();

            return Response::success([
                'message' => 'Importação concluída',
                'results' => $results
            ], 201);

        } catch (\Exception $e) {
            $this->db->rollback();
            return Response::error('Erro na importação: ' . $e->getMessage(), 500);
        }
    }

    // =========================================================================
    // LISTAR LOTES
    // =========================================================================

    /**
     * GET /tiss/lotes
     */
    public function listarLotes($params)
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

            $lotes = $this->loteModel->getByCompany($params['company'], $limit, $offset);
            $total = $this->loteModel->countByCompany($params['company']);

            return Response::success([
                'lotes' => $lotes,
                'total' => $total,
                'limit' => $limit,
                'offset' => $offset
            ]);

        } catch (\Exception $e) {
            return Response::error('Erro ao buscar lotes: ' . $e->getMessage(), 500);
        }
    }

    // =========================================================================
    // DETALHES DO LOTE
    // =========================================================================

    /**
     * GET /tiss/lotes/{id}
     */
    public function showLote($id, $params)
    {
        $params['id'] = $id;

        $validator = new Validator($params);
        $validator->required('company')->required('id');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        $apiKeyData = $this->auth->validate($params['company']);
        if (!$apiKeyData) {
            return;
        }

        try {
            $lote = $this->loteModel->findWithGuias($id, $params['company']);

            if (!$lote) {
                return Response::error('Lote não encontrado', 404);
            }

            // Busca guias do lote com procedimentos
            $guias = $this->getGuiasComProcedimentosByLote($lote['id']);

            return Response::success([
                'lote' => $lote,
                'guias' => $guias
            ]);

        } catch (\Exception $e) {
            return Response::error('Erro ao buscar lote: ' . $e->getMessage(), 500);
        }
    }

    // =========================================================================
    // GERAR LOTE
    // =========================================================================

    /**
     * POST /tiss/lotes
     * Gera novo lote de faturamento
     * 
     * Parâmetros:
     * - company: ID da empresa (obrigatório)
     * - type: 'local' ou 'intercambio' (opcional, default: 'local')
     * - limit: máximo de guias (opcional, default: 100)
     */
    public function gerarLote($data)
    {
        $validator = new Validator($data);
        $validator->required('company');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        $apiKeyData = $this->auth->validate($data['company']);
        if (!$apiKeyData) {
            return;
        }

        try {
            $type = $data['type'] ?? 'local';
            $limit = min((int)($data['limit'] ?? self::MAX_GUIAS_POR_LOTE), self::MAX_GUIAS_POR_LOTE);

            // Busca dados da empresa
            $companyData = $this->getCompanyData($data['company']);
            if (!$companyData) {
                return Response::error('Empresa não encontrada', 404);
            }

            // Busca guias pendentes (já com procedimentos)
            $guias = $this->guideModel->getPendentes($data['company'], $type, $limit);
            
            // ✅ FIX: VALIDAÇÃO ANTI-MISTURA + AUTO-CORREÇÃO
            $guiasValidadas = [];
            $guiasCorrigidas = 0;
            $avisos = [];
            
            foreach ($guias as $guia) {
                // Detecta tipo REAL pela carteira
                $numeroCarteira = $guia['numeroCarteira'] ?? '';
                $typeReal = (strpos($numeroCarteira, '0865') === 0) ? 'local' : 'intercambio';
                
                // Se type do banco está diferente do real, CORRIGE
                if ($guia['type'] !== $typeReal) {
                    // Atualiza no banco
                    $this->guideModel->update($guia['id'], ['type' => $typeReal]);
                    
                    $avisos[] = "Guia {$guia['numeroGuiaOperadora']}: type corrigido de '{$guia['type']}' para '{$typeReal}'";
                    $guiasCorrigidas++;
                    
                    // Atualiza no array
                    $guia['type'] = $typeReal;
                }
                
                // ❌ Se tipo real é diferente do solicitado, PULA
                if ($typeReal !== $type) {
                    $avisos[] = "Guia {$guia['numeroGuiaOperadora']}: pulada (carteira {$numeroCarteira} é {$typeReal}, mas lote é {$type})";
                    continue;
                }
                
                // ✅ Guia válida
                $guiasValidadas[] = $guia;
            }
            
            // Substitui array de guias pelo validado
            $guias = $guiasValidadas;
            
            // Se não sobrou nenhuma guia válida
            if (empty($guias)) {
                $mensagemErro = "Nenhuma guia {$type} pendente encontrada";
                
                // Adiciona informações extras se houver
                $detalhes = [];
                
                if ($guiasCorrigidas > 0) {
                    $mensagemErro .= " ({$guiasCorrigidas} guias foram reclassificadas)";
                    $detalhes['guias_corrigidas'] = $guiasCorrigidas;
                }
                
                if (!empty($avisos)) {
                    $detalhes['avisos'] = $avisos;
                }
                
                // ✅ CORRETO - ordem: ($message, $httpCode, $details)
                return Response::error($mensagemErro, 404, $detalhes);
            }

            
            // Se houve correções, avisa
            if ($guiasCorrigidas > 0) {
                error_log("TISS: {$guiasCorrigidas} guias tiveram o tipo corrigido automaticamente");
            }

            // Busca procedimentos de cada guia
            $guiasCompletas = [];
            $guiasIds = [];
            $valorTotalLote = 0;
            $qtdProcedimentos = 0;

            foreach ($guias as $guia) {
                $procedimentos = $this->procedimentoModel->getByGuide($guia['id']);
                
                if (empty($procedimentos)) {
                    continue;
                }
            
                // Calcula valor_total a partir dos procedimentos (fix: undefined index)
                $valorTotalGuia = 0;
                foreach ($procedimentos as $proc) {
                    $valorTotalGuia += (float)($proc['valorTotal'] ?? 0);
                }
            
                $guia['procedimentos'] = $procedimentos;
                $guia['valor_total'] = $valorTotalGuia; // Define valor calculado
                
                $guiasCompletas[] = $guia;
                $guiasIds[] = $guia['id'];
                $valorTotalLote += $valorTotalGuia; // Usa variável ao invés do índice
                $qtdProcedimentos += count($procedimentos);
            }

            if (empty($guiasCompletas)) {
                return Response::error('Nenhuma guia com procedimentos encontrada', 404);
            }

            // Obtém número do lote (usa informado ou gera próximo)
            if (!empty($data['numero_lote'])) {
                $numeroLote = (int)$data['numero_lote'];
                
                // Verifica se número já existe
                $loteExistente = $this->db->fetchOne(
                    "SELECT id FROM app_xml_lote_header WHERE company = ? AND numero_lote = ?",
                    [$data['company'], $numeroLote]
                );
                
                if ($loteExistente) {
                    return Response::error("Número de lote {$numeroLote} já existe", 400);
                }
            } else {
                // Gera próximo número automaticamente
                $numeroLote = $this->loteModel->getNextLoteNumber($data['company']);
            }
            
            $this->db->beginTransaction();

            // Cria header do lote
            $loteHeaderId = $this->loteModel->insert([
                'company' => $data['company'],
                'numero_lote' => $numeroLote,
                'hash' => '',
                'qtd_guias' => count($guiasCompletas),
                'valor_total' => $valorTotalLote,
                'status' => 'gerado',
                'created_at' => date('Y-m-d H:i:s')
            ]);

            if (!$loteHeaderId) {
                throw new \Exception('Falha ao criar lote');
            }

            // Gera XML
            $xmlGenerator = new TissXmlGenerator($companyData, $numeroLote);
            $xml = $xmlGenerator->gerar($guiasCompletas);
            $hash = $xmlGenerator->getHash();

            // Salva arquivo
            $xmlPath = $data['xml_path'] ?? self::XML_PATH;
            if (!is_dir($xmlPath)) {
                mkdir($xmlPath, 0755, true);
            }
            
            $filename = $xmlGenerator->salvar($xmlPath);

            // Atualiza header com hash e arquivo
            $this->loteModel->update($loteHeaderId, [
                'hash' => $hash,
                'arquivo' => $filename,
                'updated_at' => date('Y-m-d H:i:s')
            ]);

            // Marca guias como faturadas
            $this->guideModel->marcarComoFaturadas($guiasIds, $numeroLote, $loteHeaderId);

            $this->db->commit();

            return Response::success([
                'message' => 'Lote gerado com sucesso',
                'lote' => [
                    'id' => $loteHeaderId,
                    'numero_lote' => $numeroLote,
                    'hash' => $hash,
                    'qtd_guias' => count($guiasCompletas),
                    'qtd_procedimentos' => $qtdProcedimentos,
                    'valor_total' => $valorTotalLote,
                    'arquivo' => $filename,
                    'status' => 'gerado'
                ],
                'xml_path' => $xmlPath . '/' . $filename,
                'download_url' => $this->getDownloadUrl($filename)
            ], 201);

        } catch (\Exception $e) {
            // Só faz rollback se há transação ativa (fix: rollback sem transação)
            if ($this->db->inTransaction()) {
                $this->db->rollback();
            }
            
            return Response::error('Erro ao gerar lote: ' . $e->getMessage(), 500);
        }
    }

    // =========================================================================
    // DOWNLOAD XML
    // =========================================================================

    /**
     * GET /tiss/lotes/{id}/xml
     */
    public function downloadXml($id, $params)
    {
        $params['id'] = $id;

        $validator = new Validator($params);
        $validator->required('company')->required('id');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        $apiKeyData = $this->auth->validate($params['company']);
        if (!$apiKeyData) {
            return;
        }

        try {
            $lote = $this->loteModel->findWithGuias($id, $params['company']);

            if (!$lote) {
                return Response::error('Lote não encontrado', 404);
            }

            if (empty($lote['arquivo'])) {
                return Response::error('Arquivo XML não encontrado', 404);
            }

            $xmlPath = ($params['xml_path'] ?? self::XML_PATH) . '/' . $lote['arquivo'];

            if (!file_exists($xmlPath)) {
                return Response::error('Arquivo XML não existe no servidor', 404);
            }

            $xmlContent = file_get_contents($xmlPath);

            return Response::success([
                'lote_id' => $lote['id'],
                'numero_lote' => $lote['numero_lote'],
                'arquivo' => $lote['arquivo'],
                'xml' => base64_encode($xmlContent),
                'download_url' => $this->getDownloadUrl($lote['arquivo'])
            ]);

        } catch (\Exception $e) {
            return Response::error('Erro ao buscar XML: ' . $e->getMessage(), 500);
        }
    }

    // =========================================================================
    // ATUALIZAR STATUS
    // =========================================================================

    /**
     * PUT /tiss/lotes/{id}/status
     */
    public function updateStatus($id, $data)
    {
        $data['id'] = $id;

        $validator = new Validator($data);
        $validator->required('company')->required('id')->required('status');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        $validStatuses = ['gerado', 'enviado', 'aceito', 'rejeitado'];
        if (!in_array($data['status'], $validStatuses)) {
            return Response::error('Status inválido. Valores: ' . implode(', ', $validStatuses), 400);
        }

        $apiKeyData = $this->auth->validate($data['company']);
        if (!$apiKeyData) {
            return;
        }

        try {
            $lote = $this->loteModel->findWithGuias($id, $data['company']);

            if (!$lote) {
                return Response::error('Lote não encontrado', 404);
            }

            $updateData = [
                'status' => $data['status'],
                'updated_at' => date('Y-m-d H:i:s')
            ];

            if ($data['status'] === 'enviado') {
                $updateData['data_envio'] = date('Y-m-d H:i:s');
            }

            $this->loteModel->update($id, $updateData);

            return Response::success([
                'message' => 'Status atualizado',
                'lote_id' => $id,
                'status' => $data['status']
            ]);

        } catch (\Exception $e) {
            return Response::error('Erro ao atualizar status: ' . $e->getMessage(), 500);
        }
    }

    // =========================================================================
    // MÉTODOS ADICIONAIS
    // =========================================================================

    /**
     * GET /tiss/guias/resumo
     * Resumo de guias pendentes por type
     */
    public function resumoPendentes($params)
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
            $sql = "SELECT 
                        type,
                        COUNT(*) as total_guias,
                        SUM((SELECT COUNT(*) FROM app_xml_lote p WHERE p.guide_id = g.id)) as total_procedimentos,
                        SUM((SELECT COALESCE(SUM(valorTotal), 0) FROM app_xml_lote p WHERE p.guide_id = g.id)) as valor_total
                    FROM app_xml_guide g
                    WHERE g.company = ? 
                    AND g.numeroLote = 0
                    AND g.status IN ('pendente', 'completa')
                    GROUP BY g.type";

            $resumo = $this->db->query($sql, [$params['company']]);

            $totais = [
                'total_guias' => 0,
                'total_procedimentos' => 0,
                'valor_total' => 0
            ];

            foreach ($resumo as $item) {
                $totais['total_guias'] += (int)$item['total_guias'];
                $totais['total_procedimentos'] += (int)$item['total_procedimentos'];
                $totais['valor_total'] += (float)$item['valor_total'];
            }

            return Response::success([
                'por_tipo' => $resumo,
                'totais' => $totais
            ]);

        } catch (\Exception $e) {
            return Response::error('Erro ao buscar resumo: ' . $e->getMessage(), 500);
        }
    }

    /**
     * GET /tiss/guias/{id}
     * Detalhes de uma guia com seus procedimentos
     */
    public function getGuia($id, $params)
    {
        $params['id'] = $id;

        $validator = new Validator($params);
        $validator->required('company')->required('id');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        $apiKeyData = $this->auth->validate($params['company']);
        if (!$apiKeyData) {
            return;
        }

        try {
            $guia = $this->guideModel->find($id);

            if (!$guia) {
                return Response::error('Guia não encontrada', 404);
            }

            if ($guia['company'] != $params['company']) {
                return Response::error('Acesso não autorizado', 403);
            }

            // Busca procedimentos
            $procedimentos = $this->procedimentoModel->getByGuide($id);
            $guia['procedimentos'] = $procedimentos;
            $guia['qtd_procedimentos'] = count($procedimentos);
            
            // Calcula valor total
            $valorTotal = 0;
            foreach ($procedimentos as $proc) {
                $valorTotal += (float)$proc['valorTotal'];
            }
            $guia['valor_total'] = $valorTotal;

            return Response::success(['guia' => $guia]);

        } catch (\Exception $e) {
            return Response::error('Erro ao buscar guia: ' . $e->getMessage(), 500);
        }
    }

    /**
     * POST /tiss/guias - LEGADO
     * Insere uma guia (mantido para compatibilidade)
     */
    public function inserirGuia($data)
    {
        $validator = new Validator($data);
        $validator->required('company')->required('numeroGuiaOperadora');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        $apiKeyData = $this->auth->validate($data['company']);
        if (!$apiKeyData) {
            return;
        }

        try {
            // Usa upsert do model
            $resultado = $this->guideModel->upsert($data);

            return Response::success([
                'message' => 'Guia processada',
                'action' => $resultado['action'],
                'guide_id' => $resultado['id'],
                'reason' => $resultado['reason'] ?? null
            ], $resultado['action'] === 'created' ? 201 : 200);

        } catch (\Exception $e) {
            return Response::error('Erro ao inserir guia: ' . $e->getMessage(), 500);
        }
    }

    /**
     * GET /tiss/lotes/{numeroLote}
     * Busca guias de um lote específico
     */
    public function getLote($numeroLote, $params)
    {
        $params['numeroLote'] = $numeroLote;

        $validator = new Validator($params);
        $validator->required('company')->required('numeroLote');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        $apiKeyData = $this->auth->validate($params['company']);
        if (!$apiKeyData) {
            return;
        }

        try {
            // Busca header do lote
            $sql = "SELECT * FROM app_xml_lote_header 
                    WHERE numero_lote = ? AND company = ? 
                    LIMIT 1";
            
            $lote = $this->db->fetchOne($sql, [$numeroLote, $params['company']]);

            if (!$lote) {
                return Response::error('Lote não encontrado', 404);
            }

            // Busca guias do lote
            $sql = "SELECT g.*, 
                    (SELECT COUNT(*) FROM app_xml_lote p WHERE p.guide_id = g.id) as qtd_procedimentos,
                    (SELECT COALESCE(SUM(valorTotal), 0) FROM app_xml_lote p WHERE p.guide_id = g.id) as valor_total
                    FROM app_xml_guide g
                    WHERE g.lote_header_id = ?
                    ORDER BY g.id";

            $guias = $this->db->query($sql, [$lote['id']]);

            return Response::success([
                'lote' => $lote,
                'guias' => $guias,
                'total_guias' => count($guias)
            ]);

        } catch (\Exception $e) {
            return Response::error('Erro ao buscar lote: ' . $e->getMessage(), 500);
        }
    }

    /**
     * POST /tiss/lotes/{numeroLote}/reverter
     * Reverte um lote para pendente
     */
    public function reverterLote($numeroLote, $data)
    {
        $data['numeroLote'] = $numeroLote;

        $validator = new Validator($data);
        $validator->required('company')->required('numeroLote');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        $apiKeyData = $this->auth->validate($data['company']);
        if (!$apiKeyData) {
            return;
        }

        try {
            // Busca header do lote
            $sql = "SELECT * FROM app_xml_lote_header 
                    WHERE numero_lote = ? AND company = ? 
                    LIMIT 1";
            
            $lote = $this->db->fetchOne($sql, [$numeroLote, $data['company']]);

            if (!$lote) {
                return Response::error('Lote não encontrado', 404);
            }

            // Não permite reverter lotes já enviados/aceitos
            if (in_array($lote['status'], ['enviado', 'aceito'])) {
                return Response::error('Não é possível reverter lote com status: ' . $lote['status'], 400);
            }

            $this->guideModel->beginTransaction();

            // Reverte guias para pendente
            $sql = "UPDATE app_xml_guide 
                    SET numeroLote = 0, lote_header_id = NULL, status = 'pendente', updated_at = NOW()
                    WHERE lote_header_id = ?";
            $this->db->execute($sql, [$lote['id']]);

            // Atualiza status do lote
            $sql = "UPDATE app_xml_lote_header 
                    SET status = 'revertido', updated_at = NOW()
                    WHERE id = ?";
            $this->db->execute($sql, [$lote['id']]);

            $this->guideModel->commit();

            return Response::success([
                'message' => 'Lote revertido com sucesso',
                'numero_lote' => $numeroLote,
                'guias_revertidas' => $lote['qtd_guias']
            ]);

        } catch (\Exception $e) {
            $this->guideModel->rollback();
            return Response::error('Erro ao reverter lote: ' . $e->getMessage(), 500);
        }
    }

    // =========================================================================
    // HELPERS PRIVADOS
    // =========================================================================

    private function getCompanyData($companyId)
    {
        $sql = "SELECT 
                    id,
                    corporate_name,
                    registroANS,
                    codigoPrestadorNaOperadora,
                    CNES
                FROM app_company 
                WHERE id = ? 
                LIMIT 1";

        return $this->db->fetchOne($sql, [$companyId]);
    }

    private function getGuiasComProcedimentosByLote($loteHeaderId)
    {
        $sql = "SELECT g.* FROM app_xml_guide g
                WHERE g.lote_header_id = ?
                ORDER BY g.id";

        $guias = $this->db->query($sql, [$loteHeaderId]);

        foreach ($guias as &$guia) {
            $guia['procedimentos'] = $this->procedimentoModel->getByGuide($guia['id']);
        }

        return $guias;
    }

    private function getDownloadUrl($filename)
    {
        return 'https://consultoriopro.com.br/xmlUnimed/' . $filename;
    }
}