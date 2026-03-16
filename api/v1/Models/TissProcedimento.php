<?php
namespace API\Models;

/**
 * Model para tabela app_xml_lote (NOVA ESTRUTURA)
 * 
 * Armazena PROCEDIMENTOS (N linhas por guia)
 * Cada procedimento está vinculado a uma guia em app_xml_guide
 */
class TissProcedimento extends BaseModel
{
    protected $table = 'app_xml_lote';
    protected $primaryKey = 'id';

    protected $fillable = [
        'guide_id',
        'sequencialItem',
        'dataExecucao',
        'horaInicial',
        'horaFinal',
        'codigoTabela',
        'codigoProcedimento',
        'descricaoProcedimento',
        'quantidadeExecutada',
        'viaAcesso',
        'tecnicaUtilizada',
        'reducaoAcrescimo',
        'valorUnitario',
        'valorTotal',
        'grauParticipacao',
        'cpfExecutante',
        'nomeExecutante',
        'conselhoExecutante',
        'numeroConselhoExecutante',
        'ufExecutante',
        'cbosExecutante'
    ];

    // =========================================================================
    // VALIDAÇÃO E SANITIZAÇÃO
    // =========================================================================

    /**
     * Valida e sanitiza dados do procedimento
     * 
     * @param array $data Dados do procedimento
     * @param string $dataAutorizacao Data de autorização da guia (para validar dataExecucao)
     * @return array ['valid' => bool, 'data' => array sanitizado, 'errors' => array, 'warnings' => array]
     */
    public function validarESanitizar(array $data, $dataAutorizacao)
    {
        $errors = [];
        $warnings = [];
        $sanitized = $data;

        // 1. Data de execução - validação especial
        if (!empty($data['dataExecucao'])) {
            $dataExec = $this->formatarData($data['dataExecucao']);
            $dataAuth = $this->formatarData($dataAutorizacao);
            
            // Se execução < autorização, corrige
            if ($dataExec < $dataAuth) {
                $dataCorrigida = $this->corrigirDataExecucao($dataExec, $dataAuth);
                $warnings['dataExecucao'] = "Corrigida de {$dataExec} para {$dataCorrigida} (autorização: {$dataAuth})";
                $sanitized['dataExecucao'] = $dataCorrigida;
            } else {
                $sanitized['dataExecucao'] = $dataExec;
            }
        }

        // 2. Horários
        $sanitized['horaInicial'] = $this->formatarHora($data['horaInicial'] ?? '00:00');
        $sanitized['horaFinal'] = $this->formatarHora($data['horaFinal'] ?? '00:30');
        
        // Se hora final <= hora inicial, adiciona 30 minutos
        if ($sanitized['horaFinal'] <= $sanitized['horaInicial']) {
            $sanitized['horaFinal'] = date('H:i:s', strtotime($sanitized['horaInicial']) + 1800);
        }

        // 3. Código do procedimento (apenas números)
        $sanitized['codigoProcedimento'] = preg_replace('/[^0-9]/', '', $data['codigoProcedimento'] ?? '');
        if (empty($sanitized['codigoProcedimento'])) {
            $errors['codigoProcedimento'] = 'Código do procedimento é obrigatório';
        }

        // 4. Descrição do procedimento (limpa caracteres especiais)
        $sanitized['descricaoProcedimento'] = $this->sanitizarDescricao($data['descricaoProcedimento'] ?? '');
        if (empty($sanitized['descricaoProcedimento'])) {
            $errors['descricaoProcedimento'] = 'Descrição do procedimento é obrigatória';
        }

        // 5. Valores numéricos
        $sanitized['valorUnitario'] = (float)($data['valorUnitario'] ?? 0);
        $sanitized['valorTotal'] = (float)($data['valorTotal'] ?? 0);
        $sanitized['quantidadeExecutada'] = (int)($data['quantidadeExecutada'] ?? 1);
        
        if ($sanitized['valorTotal'] == 0 && $sanitized['valorUnitario'] > 0) {
            $sanitized['valorTotal'] = $sanitized['valorUnitario'] * $sanitized['quantidadeExecutada'];
        }

        // 6. Código tabela (padrão 22 = TUSS)
        $sanitized['codigoTabela'] = $data['codigoTabela'] ?? '22';

        // 7. Dados do profissional executante
        $sanitized['cpfExecutante'] = str_pad(
            preg_replace('/[^0-9]/', '', $data['cpfExecutante'] ?? ''),
            11, '0', STR_PAD_LEFT
        );
        
        $sanitized['nomeExecutante'] = $this->sanitizarNome($data['nomeExecutante'] ?? '');
        if (empty($sanitized['nomeExecutante'])) {
            $errors['nomeExecutante'] = 'Nome do executante é obrigatório';
        }
        
        $sanitized['conselhoExecutante'] = str_pad(
            preg_replace('/[^0-9]/', '', $data['conselhoExecutante'] ?? '06'),
            2, '0', STR_PAD_LEFT
        );
        
        $sanitized['numeroConselhoExecutante'] = preg_replace('/[^0-9]/', '', $data['numeroConselhoExecutante'] ?? '');
        
        $sanitized['ufExecutante'] = strtoupper(substr(
            preg_replace('/[^A-Za-z]/', '', $data['ufExecutante'] ?? ''),
            0, 2
        ));
        
        $sanitized['cbosExecutante'] = preg_replace('/[^0-9]/', '', $data['cbosExecutante'] ?? '');

        // 8. Valores padrão
        $sanitized['viaAcesso'] = $data['viaAcesso'] ?? '1';
        $sanitized['tecnicaUtilizada'] = $data['tecnicaUtilizada'] ?? '1';
        $sanitized['reducaoAcrescimo'] = (float)($data['reducaoAcrescimo'] ?? 1.0);
        $sanitized['grauParticipacao'] = $data['grauParticipacao'] ?? '11';
        $sanitized['sequencialItem'] = (int)($data['sequencialItem'] ?? 1);

        return [
            'valid' => empty($errors),
            'data' => $sanitized,
            'errors' => $errors,
            'warnings' => $warnings
        ];
    }

    /**
     * CORREÇÃO DE DATA DE EXECUÇÃO
     * 
     * Regra: Se dataExecucao < dataAutorizacao, corrige pegando o DIA da execução
     * e colocando no primeiro dia >= autorização com o mesmo dígito final.
     * 
     * Exemplos:
     * - Exec: 2025-11-01, Auth: 2025-11-10 → Corrigido: 2025-11-11 (dia 01 → 11)
     * - Exec: 2025-11-04, Auth: 2025-11-10 → Corrigido: 2025-11-14 (dia 04 → 14)
     * - Exec: 2025-11-02, Auth: 2025-11-15 → Corrigido: 2025-11-22 (dia 02 → 22)
     * 
     * @param string $dataExecucao Data de execução errada (Y-m-d)
     * @param string $dataAutorizacao Data de autorização (Y-m-d)
     * @return string Data corrigida (Y-m-d)
     */
    public function corrigirDataExecucao($dataExecucao, $dataAutorizacao)
    {
        $diaExec = (int)date('d', strtotime($dataExecucao));
        $diaAuth = (int)date('d', strtotime($dataAutorizacao));
        $mesAuth = date('Y-m', strtotime($dataAutorizacao));
        
        // Pega o dígito da unidade do dia da execução
        $unidadeDia = $diaExec % 10;
        
        // Encontra o primeiro dia >= autorização que termina com o mesmo dígito
        $novoDia = $diaAuth;
        
        // Se o dia da autorização já termina com o mesmo dígito, usa ele
        if (($diaAuth % 10) == $unidadeDia && $diaAuth >= $diaAuth) {
            $novoDia = $diaAuth;
        } else {
            // Calcula próximo dia que termina com a mesma unidade
            $proximoComMesmaUnidade = $diaAuth + (10 - ($diaAuth % 10) + $unidadeDia) % 10;
            
            // Se ficou menor que autorização, adiciona 10
            if ($proximoComMesmaUnidade < $diaAuth) {
                $proximoComMesmaUnidade += 10;
            }
            
            $novoDia = $proximoComMesmaUnidade;
        }
        
        // Verifica se o dia é válido para o mês
        $ultimoDiaMes = (int)date('t', strtotime($dataAutorizacao));
        
        if ($novoDia > $ultimoDiaMes) {
            // Se passou do último dia do mês, usa dia seguinte à autorização
            $novoDia = $diaAuth + 1;
            if ($novoDia > $ultimoDiaMes) {
                // Se autorização é no último dia, usa o mesmo dia
                $novoDia = $diaAuth;
            }
        }
        
        return $mesAuth . '-' . str_pad($novoDia, 2, '0', STR_PAD_LEFT);
    }

    /**
     * Formata data para Y-m-d
     * 
     * @param mixed $data
     * @return string
     */
    public function formatarData($data)
    {
        if (empty($data)) {
            return date('Y-m-d');
        }
        
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $data)) {
            return $data;
        }
        
        if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $data, $m)) {
            return "{$m[3]}-{$m[2]}-{$m[1]}";
        }
        
        $timestamp = strtotime($data);
        return $timestamp ? date('Y-m-d', $timestamp) : date('Y-m-d');
    }

    /**
     * Formata hora para H:i:s
     * 
     * @param mixed $hora
     * @return string
     */
    public function formatarHora($hora)
    {
        if (empty($hora)) {
            return '00:00:00';
        }
        
        if (preg_match('/^\d{2}:\d{2}:\d{2}$/', $hora)) {
            return $hora;
        }
        
        if (preg_match('/^\d{2}:\d{2}$/', $hora)) {
            return $hora . ':00';
        }
        
        return '00:00:00';
    }

    /**
     * Sanitiza descrição do procedimento
     * Remove caracteres que podem quebrar XML ISO-8859-1
     * 
     * @param string $descricao
     * @return string
     */
    public function sanitizarDescricao($descricao)
    {
        // Remove tags HTML
        $descricao = strip_tags($descricao);
        
        // Converte para maiúsculo
        $descricao = mb_strtoupper($descricao, 'UTF-8');
        
        // Remove caracteres especiais mantendo apenas letras, números e pontuação básica
        $descricao = preg_replace('/[^\p{L}\p{N}\s\-.,;:()\/]/u', '', $descricao);
        
        // Remove acentos problemáticos para ISO-8859-1
        $descricao = $this->removerAcentos($descricao);
        
        // Remove espaços múltiplos
        $descricao = preg_replace('/\s+/', ' ', $descricao);
        
        // Trim e limita tamanho
        return substr(trim($descricao), 0, 150);
    }

    /**
     * Remove acentos convertendo para ASCII
     * 
     * @param string $str
     * @return string
     */
    public function removerAcentos($str)
    {
        $acentos = [
            'À' => 'A', 'Á' => 'A', 'Â' => 'A', 'Ã' => 'A', 'Ä' => 'A', 'Å' => 'A',
            'Ç' => 'C',
            'È' => 'E', 'É' => 'E', 'Ê' => 'E', 'Ë' => 'E',
            'Ì' => 'I', 'Í' => 'I', 'Î' => 'I', 'Ï' => 'I',
            'Ñ' => 'N',
            'Ò' => 'O', 'Ó' => 'O', 'Ô' => 'O', 'Õ' => 'O', 'Ö' => 'O',
            'Ù' => 'U', 'Ú' => 'U', 'Û' => 'U', 'Ü' => 'U',
            'Ý' => 'Y',
            'à' => 'a', 'á' => 'a', 'â' => 'a', 'ã' => 'a', 'ä' => 'a', 'å' => 'a',
            'ç' => 'c',
            'è' => 'e', 'é' => 'e', 'ê' => 'e', 'ë' => 'e',
            'ì' => 'i', 'í' => 'i', 'î' => 'i', 'ï' => 'i',
            'ñ' => 'n',
            'ò' => 'o', 'ó' => 'o', 'ô' => 'o', 'õ' => 'o', 'ö' => 'o',
            'ù' => 'u', 'ú' => 'u', 'û' => 'u', 'ü' => 'u',
            'ý' => 'y', 'ÿ' => 'y'
        ];
        
        return strtr($str, $acentos);
    }

    /**
     * Sanitiza nome
     * 
     * @param string $nome
     * @return string
     */
    public function sanitizarNome($nome)
    {
        $nome = strip_tags($nome);
        $nome = mb_strtoupper($nome, 'UTF-8');
        $nome = preg_replace('/[^\p{L}\p{N}\s\-.,]/u', '', $nome);
        $nome = $this->removerAcentos($nome);
        $nome = preg_replace('/\s+/', ' ', $nome);
        return substr(trim($nome), 0, 70);
    }

    // =========================================================================
    // CONSULTAS
    // =========================================================================

    /**
     * Busca procedimentos de uma guia
     * 
     * @param int $guideId
     * @return array
     */
    public function getByGuide($guideId)
    {
        $sql = "SELECT * FROM {$this->table} WHERE guide_id = ? ORDER BY sequencialItem";
        return $this->query($sql, [$guideId]);
    }

    /**
     * Conta procedimentos de uma guia
     * 
     * @param int $guideId
     * @return int
     */
    public function countByGuide($guideId)
    {
        $sql = "SELECT COUNT(*) as total FROM {$this->table} WHERE guide_id = ?";
        $result = $this->fetchOne($sql, [$guideId]);
        return (int)($result['total'] ?? 0);
    }

    /**
     * Soma valor total de uma guia
     * 
     * @param int $guideId
     * @return float
     */
    public function somarValorGuia($guideId)
    {
        $sql = "SELECT SUM(valorTotal) as total FROM {$this->table} WHERE guide_id = ?";
        $result = $this->fetchOne($sql, [$guideId]);
        return (float)($result['total'] ?? 0);
    }

    /**
     * Insere procedimento com validação
     * 
     * @param array $data
     * @param string $dataAutorizacao
     * @return array
     */
    public function inserirComValidacao(array $data, $dataAutorizacao)
    {
        $resultado = $this->validarESanitizar($data, $dataAutorizacao);
        
        if (!$resultado['valid']) {
            return [
                'success' => false,
                'errors' => $resultado['errors'],
                'warnings' => $resultado['warnings']
            ];
        }
        
        $id = $this->insert($resultado['data']);
        
        return [
            'success' => (bool)$id,
            'id' => $id,
            'warnings' => $resultado['warnings']
        ];
    }

    /**
     * Atualiza sequencial item para todos os procedimentos de uma guia
     * 
     * @param int $guideId
     * @return bool
     */
    public function reordenarSequencial($guideId)
    {
        $procedimentos = $this->getByGuide($guideId);
        
        foreach ($procedimentos as $index => $proc) {
            $this->update($proc['id'], ['sequencialItem' => $index + 1]);
        }
        
        return true;
    }

    /**
     * Remove todos os procedimentos de uma guia
     * 
     * @param int $guideId
     * @return bool
     */
    public function deleteByGuide($guideId)
    {
        $sql = "DELETE FROM {$this->table} WHERE guide_id = ?";
        return $this->execute($sql, [$guideId]) !== false;
    }
}