<?php
namespace API\Helpers;

/**
 * Helper para validação e sanitização de dados TISS
 * 
 * Regras ANS:
 * - numeroCarteira: exatamente 17 dígitos
 * - reducaoAcrescimo: entre 0.01 e 9.99
 * - valorTotal = valorUnitario × quantidadeExecutada × reducaoAcrescimo
 * - Sem caracteres especiais (&, <, >) em campos texto
 * - Carteiras que começam com prefixo diferente de 0865 = intercâmbio
 */
class TissValidator
{
    // Prefixo padrão Unimed local (ajustar conforme operadora)
    const PREFIXO_LOCAL = '0865';
    
    // Tamanho obrigatório da carteira
    const CARTEIRA_LENGTH = 17;

    /**
     * Valida e corrige uma guia completa
     * Retorna array com 'guia' corrigida e 'erros' encontrados
     */
    public static function validarGuia(array $guia): array
    {
        $erros = [];
        $avisos = [];

        // 1. Número da Carteira - pad com zeros à esquerda
        if (!empty($guia['numeroCarteira'])) {
            $carteira = self::sanitizeNumeros($guia['numeroCarteira']);
            $carteiraPadded = self::padCarteira($carteira);
            
            if ($carteira !== $carteiraPadded) {
                $avisos[] = "numeroCarteira ajustado de {$carteira} para {$carteiraPadded}";
            }
            
            $guia['numeroCarteira'] = $carteiraPadded;
            
            // Detectar se é intercâmbio
            $guia['_isIntercambio'] = self::isIntercambio($carteiraPadded);
        }

        // 2. Senha - apenas números, sem truncar
        if (!empty($guia['senha'])) {
            $guia['senha'] = self::sanitizeNumeros($guia['senha']);
        }

        // 3. reducaoAcrescimo - validar range
        $reducao = isset($guia['reducaoAcrescimo']) ? (float)$guia['reducaoAcrescimo'] : 0;
        if ($reducao <= 0 || $reducao > 9.99) {
            $avisos[] = "reducaoAcrescimo ajustado de {$reducao} para 1.00";
            $guia['reducaoAcrescimo'] = '1.00';
        } else {
            $guia['reducaoAcrescimo'] = number_format($reducao, 2, '.', '');
        }

        // 4. Recalcular valorTotal
        $valorUnitario = (float)($guia['valorUnitario'] ?? 0);
        $quantidade = (int)($guia['quantidadeExecutada'] ?? 1);
        $fator = (float)$guia['reducaoAcrescimo'];
        
        $valorCalculado = $valorUnitario * $quantidade * $fator;
        $valorInformado = (float)($guia['valorTotal'] ?? 0);
        
        // Se diferença > 0.01, recalcula
        if (abs($valorCalculado - $valorInformado) > 0.01) {
            $avisos[] = "valorTotal recalculado de {$valorInformado} para {$valorCalculado}";
            $guia['valorTotal'] = number_format($valorCalculado, 2, '.', '');
        }

        // 5. Sanitizar campos texto (remover &, <, >)
        $camposTexto = [
            'nomeBeneficiario',
            'nomeContratadoSolicitante',
            'profissionalSolicitanteNomeProfissional',
            'indicacaoClinica',
            'descricaoProcedimento',
            'equipeSadtNomeProf'
        ];

        foreach ($camposTexto as $campo) {
            if (!empty($guia[$campo])) {
                $original = $guia[$campo];
                $guia[$campo] = self::sanitizeTexto($guia[$campo]);
                
                if ($original !== $guia[$campo]) {
                    $avisos[] = "{$campo} sanitizado (caracteres especiais removidos)";
                }
            }
        }

        // 6. Validar campos obrigatórios
        $obrigatorios = [
            'numeroGuiaOperadora',
            'numeroCarteira',
            'nomeBeneficiario',
            'codigoProcedimento'
        ];

        foreach ($obrigatorios as $campo) {
            if (empty($guia[$campo])) {
                $erros[] = "Campo obrigatório vazio: {$campo}";
            }
        }

        // 7. Validar datas
        $camposData = ['dataAutorizacao', 'dataValidadeSenha', 'dataSolicitacao', 'dataExecucao'];
        foreach ($camposData as $campo) {
            if (!empty($guia[$campo])) {
                $guia[$campo] = self::formatarData($guia[$campo]);
            }
        }

        // 8. Validar horas
        if (!empty($guia['horaInicial'])) {
            $guia['horaInicial'] = self::formatarHora($guia['horaInicial']);
        }
        if (!empty($guia['horaFinal'])) {
            $guia['horaFinal'] = self::formatarHora($guia['horaFinal']);
        }

        return [
            'guia' => $guia,
            'erros' => $erros,
            'avisos' => $avisos,
            'valida' => empty($erros)
        ];
    }

    /**
     * Valida array de guias e separa por type (local/intercambio)
     */
    public static function validarLote(array $guias): array
    {
        $guiasLocal = [];
        $guiasIntercambio = [];
        $guiasInvalidas = [];
        $todosAvisos = [];

        foreach ($guias as $guia) {
            $resultado = self::validarGuia($guia);
            
            if (!$resultado['valida']) {
                $guiasInvalidas[] = [
                    'guia' => $guia,
                    'erros' => $resultado['erros']
                ];
                continue;
            }

            $guiaValidada = $resultado['guia'];
            
            if (!empty($resultado['avisos'])) {
                $todosAvisos[$guia['numeroGuiaOperadora'] ?? 'N/A'] = $resultado['avisos'];
            }

            // Separar por type baseado na carteira
            if ($guiaValidada['_isIntercambio'] ?? false) {
                $guiaValidada['type'] = 'intercambio';
                $guiasIntercambio[] = $guiaValidada;
            } else {
                $guiaValidada['type'] = 'local';
                $guiasLocal[] = $guiaValidada;
            }

            // Remove flag interno
            unset($guiaValidada['_isIntercambio']);
        }

        return [
            'local' => $guiasLocal,
            'intercambio' => $guiasIntercambio,
            'invalidas' => $guiasInvalidas,
            'avisos' => $todosAvisos,
            'resumo' => [
                'total_recebidas' => count($guias),
                'total_local' => count($guiasLocal),
                'total_intercambio' => count($guiasIntercambio),
                'total_invalidas' => count($guiasInvalidas)
            ]
        ];
    }

    /**
     * Pad carteira com zeros à esquerda para 17 dígitos
     */
    public static function padCarteira(string $carteira): string
    {
        $carteira = self::sanitizeNumeros($carteira);
        return str_pad($carteira, self::CARTEIRA_LENGTH, '0', STR_PAD_LEFT);
    }

    /**
     * Detecta se carteira é de intercâmbio
     * Regra: se NÃO começa com prefixo local (0865), é intercâmbio
     */
    public static function isIntercambio(string $carteira): bool
    {
        $carteira = self::padCarteira($carteira);
        return substr($carteira, 0, 4) !== self::PREFIXO_LOCAL;
    }

    /**
     * Remove caracteres não numéricos
     */
    public static function sanitizeNumeros(string $valor): string
    {
        return preg_replace('/[^0-9]/', '', $valor);
    }

    /**
     * Remove caracteres especiais que quebram XML
     * - Substitui & por E
     * - Substitui travessão Unicode (–) por hífen (-)
     * - Remove < >
     * - Remove acentos
     * - Remove entidades HTML
     */
    public static function sanitizeTexto(string $texto): string
    {
        // 1. Decodifica entidades HTML primeiro (&#8211; → –)
        $texto = html_entity_decode($texto, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        
        // 2. Substitui travessões Unicode por hífen simples
        $texto = str_replace(['–', '—', '‒', '―'], '-', $texto);
        
        // 3. Substitui & por E
        $texto = str_replace('&', 'E', $texto);
        
        // 4. Remove < >
        $texto = str_replace(['<', '>'], '', $texto);
        
        // 5. Remove acentos
        $texto = self::removerAcentos($texto);
        
        // 6. Remove caracteres não-ASCII restantes (emojis, etc)
        $texto = preg_replace('/[^\x20-\x7E]/', '', $texto);
        
        return trim($texto);
    }

    /**
     * Remove acentos de uma string
     */
    public static function removerAcentos(string $texto): string
    {
        $acentos = [
            'á' => 'a', 'à' => 'a', 'ã' => 'a', 'â' => 'a', 'ä' => 'a',
            'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e',
            'í' => 'i', 'ì' => 'i', 'î' => 'i', 'ï' => 'i',
            'ó' => 'o', 'ò' => 'o', 'õ' => 'o', 'ô' => 'o', 'ö' => 'o',
            'ú' => 'u', 'ù' => 'u', 'û' => 'u', 'ü' => 'u',
            'ç' => 'c', 'ñ' => 'n',
            'Á' => 'A', 'À' => 'A', 'Ã' => 'A', 'Â' => 'A', 'Ä' => 'A',
            'É' => 'E', 'È' => 'E', 'Ê' => 'E', 'Ë' => 'E',
            'Í' => 'I', 'Ì' => 'I', 'Î' => 'I', 'Ï' => 'I',
            'Ó' => 'O', 'Ò' => 'O', 'Õ' => 'O', 'Ô' => 'O', 'Ö' => 'O',
            'Ú' => 'U', 'Ù' => 'U', 'Û' => 'U', 'Ü' => 'U',
            'Ç' => 'C', 'Ñ' => 'N'
        ];
        
        return strtr($texto, $acentos);
    }

    /**
     * Formata data para YYYY-MM-DD
     */
    public static function formatarData(string $data): string
    {
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

        return $data;
    }

    /**
     * Formata hora para HH:MM
     */
    public static function formatarHora(string $hora): string
    {
        // Remove texto extra como "08:00 à 08:30"
        if (strpos($hora, ' ') !== false) {
            $hora = explode(' ', $hora)[0];
        }

        // Se já está no formato HH:MM ou HH:MM:SS
        if (preg_match('/^(\d{2}):(\d{2})/', $hora, $m)) {
            return "{$m[1]}:{$m[2]}";
        }

        return '00:00';
    }

    /**
     * Gera relatório de validação para debug
     */
    public static function gerarRelatorio(array $resultadoValidacao): string
    {
        $linhas = [];
        $linhas[] = "=== RELATÓRIO DE VALIDAÇÃO TISS ===";
        $linhas[] = "";
        $linhas[] = "RESUMO:";
        $linhas[] = "- Total recebidas: " . $resultadoValidacao['resumo']['total_recebidas'];
        $linhas[] = "- Guias locais: " . $resultadoValidacao['resumo']['total_local'];
        $linhas[] = "- Guias intercâmbio: " . $resultadoValidacao['resumo']['total_intercambio'];
        $linhas[] = "- Guias inválidas: " . $resultadoValidacao['resumo']['total_invalidas'];
        $linhas[] = "";

        if (!empty($resultadoValidacao['invalidas'])) {
            $linhas[] = "GUIAS INVÁLIDAS:";
            foreach ($resultadoValidacao['invalidas'] as $inv) {
                $numGuia = $inv['guia']['numeroGuiaOperadora'] ?? 'N/A';
                $linhas[] = "- Guia {$numGuia}: " . implode('; ', $inv['erros']);
            }
            $linhas[] = "";
        }

        if (!empty($resultadoValidacao['avisos'])) {
            $linhas[] = "AVISOS (correções automáticas):";
            foreach ($resultadoValidacao['avisos'] as $numGuia => $avisos) {
                $linhas[] = "- Guia {$numGuia}:";
                foreach ($avisos as $aviso) {
                    $linhas[] = "  • {$aviso}";
                }
            }
        }

        return implode("\n", $linhas);
    }
}