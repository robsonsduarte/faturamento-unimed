<?php
namespace API\Models;

/**
 * Model para tabela app_xml_guide
 *
 * ESTRUTURA NOVA:
 * - 1 linha = 1 guia (dados do beneficiário, autorização, solicitante, executante)
 * - Procedimentos ficam em app_xml_lote (TissProcedimento)
 * 
 * VERSÃO: 2.0 (BUG CORRIGIDO)
 * DATA: 04/12/2025
 * CORREÇÃO: Linha 388 - Alias 'g' inconsistente
 */
class TissGuide extends BaseModel
{
    protected $table = 'app_xml_guide';
    protected $primaryKey = 'id';

    protected $fillable = [
        'company',
        'registroANS',
        'numeroGuiaPrestador',
        'numeroGuiaOperadora',
        'dataAutorizacao',
        'senha',
        'dataValidadeSenha',
        'numeroCarteira',
        'atendimentoRN',
        'nomeBeneficiario',
        'codigoPrestadorSolicitante',
        'nomeContratadoSolicitante',
        'nomeProfissionalSolicitante',
        'conselhoProfissionalSolicitante',
        'numeroConselhoSolicitante',
        'ufSolicitante',
        'cbosSolicitante',
        'dataSolicitacao',
        'caraterAtendimento',
        'indicacaoClinica',
        'codigoPrestadorExecutante',
        'cnesExecutante',
        'tipoAtendimento',
        'indicacaoAcidente',
        'tipoConsulta',
        'regimeAtendimento',
        'type',
        'numeroLote',
        'lote_header_id',
        'status',
        'erro_validacao',
        'created_at',
        'updated_at'
    ];

    // =========================================================================
    // VALIDAÇÃO E SANITIZAÇÃO
    // =========================================================================

    /**
     * Valida e sanitiza todos os campos da guia
     *
     * @param array $data Dados da guia
     * @return array ['valid' => bool, 'data' => array, 'errors' => array, 'warnings' => array]
     */
    public function validarESanitizar(array $data)
    {
        $errors = [];
        $warnings = [];
        $sanitized = [];

        // Campos obrigatórios
        $obrigatorios = ['numeroGuiaOperadora', 'company'];
        foreach ($obrigatorios as $campo) {
            if (empty($data[$campo])) {
                $errors[$campo] = "Campo obrigatório";
            }
        }

        // registroANS - 6 dígitos
        $sanitized['registroANS'] = str_pad(
            preg_replace('/[^0-9]/', '', $data['registroANS'] ?? ''),
            6, '0', STR_PAD_LEFT
        );

        // Números de guia
        $sanitized['numeroGuiaOperadora'] = preg_replace('/[^0-9]/', '', $data['numeroGuiaOperadora'] ?? '');
        $sanitized['numeroGuiaPrestador'] = substr($data['numeroGuiaPrestador'] ?? '', 0, 20);

        // ✅ NOVA VERSÃO: Sanitiza E valida carteira com DV
        $resultadoCarteira = $this->sanitizarEValidarCarteira($data['numeroCarteira'] ?? '');
        $sanitized['numeroCarteira'] = $resultadoCarteira['carteira'];

        // Adiciona warnings se houver
        if (!empty($resultadoCarteira['warnings'])) {
            foreach ($resultadoCarteira['warnings'] as $warning) {
                $warnings['numeroCarteira'] = ($warnings['numeroCarteira'] ?? '') . ' ' . $warning;
            }
        }

        // Datas
        $sanitized['dataAutorizacao'] = $this->formatarData($data['dataAutorizacao'] ?? '');
        $sanitized['dataValidadeSenha'] = $this->formatarData($data['dataValidadeSenha'] ?? '');
        $sanitized['dataSolicitacao'] = $this->formatarData($data['dataSolicitacao'] ?? '');

        // Senha - só números
        $sanitized['senha'] = preg_replace('/[^0-9]/', '', $data['senha'] ?? '');

        // atendimentoRN - S ou N
        $sanitized['atendimentoRN'] = $this->sanitizarSimNao($data['atendimentoRN'] ?? '');

        // Nomes - sanitizar e maiúsculo
        $sanitized['nomeBeneficiario'] = $this->sanitizarNome($data['nomeBeneficiario'] ?? '', 70);
        $sanitized['nomeContratadoSolicitante'] = $this->sanitizarNome($data['nomeContratadoSolicitante'] ?? '', 70);
        $sanitized['nomeProfissionalSolicitante'] = $this->sanitizarNome($data['nomeProfissionalSolicitante'] ?? '', 70);

        // Códigos numéricos
        $sanitized['codigoPrestadorSolicitante'] = preg_replace('/[^0-9]/', '', $data['codigoPrestadorSolicitante'] ?? '');
        $sanitized['codigoPrestadorExecutante'] = preg_replace('/[^0-9]/', '', $data['codigoPrestadorExecutante'] ?? '');
        $sanitized['cnesExecutante'] = preg_replace('/[^0-9]/', '', $data['cnesExecutante'] ?? '');
        $sanitized['numeroConselhoSolicitante'] = preg_replace('/[^0-9]/', '', $data['numeroConselhoSolicitante'] ?? '');

        // Conselho - 2 dígitos
        $sanitized['conselhoProfissionalSolicitante'] = str_pad(
            preg_replace('/[^0-9]/', '', $data['conselhoProfissionalSolicitante'] ?? '06'),
            2, '0', STR_PAD_LEFT
        );

        // UF - 2 letras
        $uf = strtoupper(preg_replace('/[^A-Za-z]/', '', $data['ufSolicitante'] ?? 'BA'));
        $sanitized['ufSolicitante'] = substr($uf, 0, 2);

        // CBOS - 6 dígitos
        $sanitized['cbosSolicitante'] = preg_replace('/[^0-9]/', '', $data['cbosSolicitante'] ?? '');

        // Indicação clínica - texto livre, sanitizar
        $sanitized['indicacaoClinica'] = $this->sanitizarTexto($data['indicacaoClinica'] ?? '', 500);

        // Códigos de atendimento
        $sanitized['caraterAtendimento'] = $data['caraterAtendimento'] ?? '1';
        $sanitized['tipoAtendimento'] = str_pad($data['tipoAtendimento'] ?? '03', 2, '0', STR_PAD_LEFT);
        $sanitized['indicacaoAcidente'] = $data['indicacaoAcidente'] ?? '9';
        $sanitized['tipoConsulta'] = $data['tipoConsulta'] ?? '2';
        $sanitized['regimeAtendimento'] = str_pad($data['regimeAtendimento'] ?? '01', 2, '0', STR_PAD_LEFT);

        // Campos de controle
        $sanitized['company'] = (int)($data['company'] ?? 1);
        $sanitized['type'] = in_array($data['type'] ?? '', ['local', 'intercambio']) ? $data['type'] : 'local';
        $sanitized['status'] = $data['status'] ?? 'pendente';
        $sanitized['numeroLote'] = (int)($data['numeroLote'] ?? 0);

        return [
            'valid' => empty($errors),
            'data' => $sanitized,
            'errors' => $errors,
            'warnings' => $warnings
        ];
    }

    /**
     * Valida carteira Unimed
     * Regra: deve começar com 0865 (nunca 00865, 865, 8650)
     *
     * @param string $carteira
     * @return bool True se válida, false se inválida
     */
    public function validarCarteira($carteira)
    {
        // Remove tudo que não é número
        $numeros = preg_replace('/[^0-9]/', '', $carteira);

        // Verifica padrão Unimed (começa com 865 ou 0865)
        if (preg_match('/^0*865/', $numeros)) {
            // Remove zeros à esquerda e o 865, depois adiciona 0865
            $resto = preg_replace('/^0*865/', '', $numeros);
            $formatada = '0865' . $resto;

            // Verifica tamanho (máximo 17 dígitos ANS)
            if (strlen($formatada) <= 17) {
                return true;
            }
        }

        return false;
    }

    /**
     * Sanitiza carteira para formato correto
     * Força formato 0865... mesmo se inválida
     *
     * @param string $carteira
     * @return string Carteira formatada
     */
    public function sanitizarCarteira($carteira)
    {
        $numeros = preg_replace('/[^0-9]/', '', $carteira);

        // Se começa com variação de 865
        if (preg_match('/^0*865/', $numeros)) {
            $resto = preg_replace('/^0*865/', '', $numeros);
            return substr('0865' . $resto, 0, 17);
        }

        // Outras operadoras - apenas limita tamanho
        return substr($numeros, 0, 17);
    }

    /**
     * Sanitiza campo S/N
     *
     * @param string $valor
     * @return string 'S' ou 'N'
     */
    public function sanitizarSimNao($valor)
    {
        if (empty($valor)) {
            return 'N';
        }

        $valor = strtoupper(trim($valor));

        // Aceita variações
        $sim = ['S', 'SIM', '1', 'YES', 'Y', 'TRUE'];

        return in_array($valor, $sim) ? 'S' : 'N';
    }

    /**
     * Formata data para Y-m-d
     *
     * @param string $data
     * @return string Data formatada ou string vazia
     */
    public function formatarData($data)
    {
        if (empty($data)) {
            return '';
        }

        // Se já está no formato correto
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $data)) {
            return $data;
        }

        // Formato DD/MM/YYYY
        if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $data, $m)) {
            return "{$m[3]}-{$m[2]}-{$m[1]}";
        }

        // Tenta converter
        $timestamp = strtotime($data);
        if ($timestamp) {
            return date('Y-m-d', $timestamp);
        }

        return '';
    }

    /**
     * Sanitiza texto removendo caracteres problemáticos
     *
     * @param string $texto
     * @param int $maxLen
     * @return string
     */
    public function sanitizarTexto($texto, $maxLen = 150)
    {
        if (empty($texto)) {
            return '';
        }

        $result = $texto;

        // Remove caracteres problemáticos
        $result = str_replace(['–', '—', '‒', '―'], '-', $result);
        $result = preg_replace('/&#\d+;/', '-', $result);
        $result = str_replace('&', 'E', $result);
        $result = str_replace(['<', '>'], '', $result);

        // Remove acentos
        $result = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $result);

        // Remove caracteres não-ASCII restantes
        $result = preg_replace('/[^\x20-\x7E]/', '', $result);

        return substr(trim($result), 0, $maxLen);
    }

    /**
     * Sanitiza nome (maiúsculo, sem acentos problemáticos)
     *
     * @param string $nome
     * @param int $maxLen
     * @return string
     */
    public function sanitizarNome($nome, $maxLen = 70)
    {
        $nome = $this->sanitizarTexto($nome, $maxLen);
        return strtoupper($nome);
    }

    // =========================================================================
    // CONSULTAS
    // =========================================================================

    /**
     * Lista guias pendentes (não faturadas) para uma empresa
     *
     * @param int $companyId
     * @param string|null $type 'local' ou 'intercambio'
     * @param int $limit
     * @return array
     */
    public function getPendentes($companyId, $type = null, $limit = 100)
    {
        $sql = "SELECT g.*
                FROM `{$this->table}` g
                WHERE g.company = ?
                AND (g.numeroLote = 0 OR g.numeroLote IS NULL)
                AND g.status IN ('pendente', 'completa')";

        $params = [$companyId];

        if ($type) {
            $sql .= " AND g.type = ?";
            $params[] = $type;
        }

        $sql .= " ORDER BY g.created_at ASC LIMIT ?";
        $params[] = $limit;

        return $this->query($sql, $params);
    }

    /**
     * Conta guias pendentes
     * 
     * BUGFIX 04/12/2025: Corrigido alias 'g' inconsistente na linha 388
     *
     * @param int $companyId
     * @param string|null $type
     * @return int
     */
    public function countPendentes($companyId, $type = null)
    {
        // ✅ CORRIGIDO: Adicionado alias 'g' no FROM
        $sql = "SELECT COUNT(*) as total FROM `{$this->table}` g
                WHERE g.company = ?
                AND (g.numeroLote = 0 OR g.numeroLote IS NULL)
                AND g.status IN ('pendente', 'completa')";

        $params = [$companyId];

        if ($type) {
            $sql .= " AND g.type = ?";
            $params[] = $type;
        }

        $result = $this->fetchOne($sql, $params);
        return (int)($result['total'] ?? 0);
    }

    /**
     * Busca guia com seus procedimentos
     *
     * @param int $id
     * @return array|null
     */
    public function findComProcedimentos($id)
    {
        $guia = $this->find($id);

        if (!$guia) {
            return null;
        }

        // Busca procedimentos
        $sql = "SELECT * FROM app_xml_lote WHERE guide_id = ? ORDER BY sequencialItem ASC";
        $procedimentos = $this->query($sql, [$id]);

        $guia['procedimentos'] = $procedimentos;

        return $guia;
    }

    /**
     * Busca guia por número da operadora
     *
     * @param string $numeroGuia
     * @param int $companyId
     * @return array|null
     */
    public function findByNumeroGuia($numeroGuia, $companyId)
    {
        $sql = "SELECT * FROM `{$this->table}`
                WHERE numeroGuiaOperadora = ? AND company = ?
                LIMIT 1";

        return $this->fetchOne($sql, [$numeroGuia, $companyId]);
    }

    /**
     * Marca guias como faturadas (vincula ao lote)
     *
     * @param array $guideIds Array de IDs
     * @param int $loteNumber Número do lote
     * @param int $loteHeaderId ID do header do lote
     * @return bool
     */
    public function marcarComoFaturadas(array $guideIds, $loteNumber, $loteHeaderId)
    {
        if (empty($guideIds)) {
            return false;
        }

        $placeholders = implode(',', array_fill(0, count($guideIds), '?'));
        $params = array_merge(
            [$loteNumber, $loteHeaderId, date('Y-m-d H:i:s')],
            $guideIds
        );

        $sql = "UPDATE `{$this->table}`
                SET numeroLote = ?, lote_header_id = ?, status = 'faturada', updated_at = ?
                WHERE id IN ({$placeholders})";

        return $this->execute($sql, $params);
    }

    /**
     * Importa/Atualiza guia (upsert)
     *
     * @param array $data
     * @return array ['action' => string, 'id' => int]
     */
    public function upsert(array $data)
    {
        // Valida e sanitiza
        $resultado = $this->validarESanitizar($data);

        if (!$resultado['valid']) {
            throw new \Exception("Dados inválidos: " . json_encode($resultado['errors']));
        }

        $dadosSanitizados = $resultado['data'];

        // Verifica se já existe
        $existing = $this->findByNumeroGuia(
            $dadosSanitizados['numeroGuiaOperadora'],
            $dadosSanitizados['company']
        );

        if ($existing) {
            // Não atualiza se já foi faturada
            if ($existing['status'] === 'faturada' || $existing['numeroLote'] > 0) {
                return ['action' => 'skipped', 'id' => $existing['id'], 'reason' => 'ja_faturada'];
            }

            $this->update($existing['id'], $dadosSanitizados);
            return ['action' => 'updated', 'id' => $existing['id']];
        }

        $id = $this->insert($dadosSanitizados);
        return ['action' => 'created', 'id' => $id];
    }

    /**
     * VALIDAÇÃO DE CARTEIRA UNIMED COM DÍGITO VERIFICADOR
     *
     * Adicionar ao TissGuide.php
     */

    /**
     * Calcula dígito verificador da carteira Unimed
     * Algoritmo módulo 11
     *
     * @param string $carteira Carteira sem DV (16 dígitos)
     * @return string Dígito verificador (1 dígito)
     */
    public function calcularDVUnimed($carteira)
    {
        // Remove não-numéricos
        $nums = preg_replace('/[^0-9]/', '', $carteira);

        // Pega primeiros 16 dígitos (sem o DV)
        $base = substr($nums, 0, 16);

        // Multiplicadores (de 2 a 9, repetindo)
        $multiplicadores = [2, 3, 4, 5, 6, 7, 8, 9];
        $soma = 0;

        // Percorre de trás pra frente
        for ($i = strlen($base) - 1, $m = 0; $i >= 0; $i--, $m++) {
            $mult = $multiplicadores[$m % 8];
            $digito = (int)$base[$i];
            $soma += $digito * $mult;
        }

        // Calcula módulo 11
        $resto = $soma % 11;

        // DV = 11 - resto, mas se der 10 ou 11, usa 0
        $dv = 11 - $resto;
        if ($dv >= 10) {
            $dv = 0;
        }

        return (string)$dv;
    }

    /**
     * Valida se carteira Unimed tem DV correto
     *
     * @param string $carteira Carteira completa (17 dígitos)
     * @return bool True se válida
     */
    public function validarDVUnimed($carteira)
    {
        $nums = preg_replace('/[^0-9]/', '', $carteira);

        // Precisa ter exatamente 17 dígitos
        if (strlen($nums) != 17) {
            return false;
        }

        // Se não é Unimed (não começa com 0865), não valida DV
        if (!preg_match('/^0865/', $nums)) {
            return true; // Outras operadoras não validamos
        }

        // Pega os 16 primeiros (sem DV)
        $base = substr($nums, 0, 16);

        // Pega o DV informado (último dígito)
        $dvInformado = substr($nums, 16, 1);

        // Calcula DV correto
        $dvCalculado = $this->calcularDVUnimed($base);

        // Compara
        return $dvInformado == $dvCalculado;
    }

    /**
     * Corrige DV da carteira Unimed se necessário
     *
     * @param string $carteira Carteira possivelmente com DV errado
     * @return string Carteira com DV correto
     */
    public function corrigirDVUnimed($carteira)
    {
        $nums = preg_replace('/[^0-9]/', '', $carteira);

        // Se não é Unimed, retorna sem mudanças
        if (!preg_match('/^0865/', $nums)) {
            return $this->sanitizarCarteira($carteira);
        }

        // Pega base (16 primeiros)
        $base = substr($nums, 0, 16);

        // Calcula DV correto
        $dvCorreto = $this->calcularDVUnimed($base);

        // Monta carteira com DV correto
        return $base . $dvCorreto;
    }

    /**
     * Sanitiza E valida carteira (versão melhorada)
     *
     * @param string $carteira
     * @return array ['carteira' => string, 'warnings' => array]
     */
    public function sanitizarEValidarCarteira($carteira)
    {
        $warnings = [];
        $nums = preg_replace('/[^0-9]/', '', $carteira);

        // Unimed
        if (preg_match('/^0*865/', $nums)) {
            $resto = preg_replace('/^0*865/', '', $nums);
            $formatada = '0865' . $resto;

            // Ajusta tamanho
            if (strlen($formatada) < 17) {
                $formatada = str_pad($formatada, 17, '0', STR_PAD_RIGHT);
                $warnings[] = 'Carteira completada com zeros à direita';
            } elseif (strlen($formatada) > 17) {
                $formatada = substr($formatada, 0, 17);
                $warnings[] = 'Carteira truncada para 17 dígitos';
            }

            // Valida DV
            if (!$this->validarDVUnimed($formatada)) {
                $carteiraOriginal = $formatada;
                $formatada = $this->corrigirDVUnimed($formatada);
                $warnings[] = "DV corrigido: {$carteiraOriginal} → {$formatada}";
            }

            return [
                'carteira' => $formatada,
                'warnings' => $warnings
            ];
        }

        // Outras operadoras
        $formatada = str_pad(substr($nums, 0, 17), 17, '0', STR_PAD_RIGHT);

        return [
            'carteira' => $formatada,
            'warnings' => $warnings
        ];
    }
}