<?php
namespace API\Helpers;

/**
 * Gerador de XML TISS 4.01.00 - Versão Simplificada
 * 
 * Usa a nova estrutura:
 * - app_xml_guide: 1 linha = 1 guia
 * - app_xml_lote: N linhas = N procedimentos por guia
 */
class TissXmlGenerator
{
    private $dom;
    private $mensagemTISS;
    private $company;
    private $loteNumber;
    private $hash = '';

    const TISS_VERSION = '4.01.00';

    /**
     * @param array $company Dados da empresa (registroANS, codigoPrestadorNaOperadora, CNES)
     * @param int $loteNumber Número do lote
     */
    public function __construct(array $company, $loteNumber)
    {
        $this->company = $company;
        $this->loteNumber = (int)$loteNumber;
        $this->initDocument();
    }

    /**
     * Inicializa documento XML
     */
    private function initDocument()
    {
        $this->dom = new \DOMDocument('1.0', 'ISO-8859-1');
        $this->dom->formatOutput = true;

        $this->mensagemTISS = $this->dom->createElement('ans:mensagemTISS');
        $this->mensagemTISS->setAttribute('xmlns:ans', 'http://www.ans.gov.br/padroes/tiss/schemas');
        $this->dom->appendChild($this->mensagemTISS);
    }

    /**
     * Gera XML completo a partir de guias com procedimentos
     * 
     * @param array $guias Array de guias, cada uma com array 'procedimentos'
     * @return string XML gerado
     */
    public function gerar(array $guias)
    {
        // Cabeçalho
        $this->buildCabecalho();
        
        // Lote de guias
        $this->buildLoteGuias($guias);
        
        // Epílogo com hash
        $this->buildEpilogo();
        
        return $this->dom->saveXML();
    }

    /**
     * Salva XML em arquivo
     * 
     * @param string $path Diretório de destino
     * @return string Nome do arquivo gerado
     */
    public function salvar($path)
    {
        $lotePadded = str_pad($this->loteNumber, 20, '0', STR_PAD_LEFT);
        $filename = "{$lotePadded}_{$this->hash}.xml";
        $fullPath = rtrim($path, '/') . '/' . $filename;

        $this->dom->save($fullPath);

        return $filename;
    }

    /**
     * @return string
     */
    public function getHash()
    {
        return $this->hash;
    }

    // =========================================================================
    // CONSTRUÇÃO DO XML
    // =========================================================================

    private function buildCabecalho()
    {
        $cabecalho = $this->dom->createElement('ans:cabecalho');
        $this->mensagemTISS->appendChild($cabecalho);

        // Identificação da Transação
        $identificacao = $this->dom->createElement('ans:identificacaoTransacao');
        $cabecalho->appendChild($identificacao);
        
        $this->addElement($identificacao, 'ans:tipoTransacao', 'ENVIO_LOTE_GUIAS');
        $this->addElement($identificacao, 'ans:sequencialTransacao', $this->loteNumber);
        $this->addElement($identificacao, 'ans:dataRegistroTransacao', date('Y-m-d'));
        $this->addElement($identificacao, 'ans:horaRegistroTransacao', date('H:i:s'));

        // Origem (Prestador)
        $origem = $this->dom->createElement('ans:origem');
        $cabecalho->appendChild($origem);
        
        $idPrestador = $this->dom->createElement('ans:identificacaoPrestador');
        $origem->appendChild($idPrestador);
        $this->addElement($idPrestador, 'ans:codigoPrestadorNaOperadora', 
            $this->onlyNumbers($this->company['codigoPrestadorNaOperadora']));

        // Destino (Operadora)
        $destino = $this->dom->createElement('ans:destino');
        $cabecalho->appendChild($destino);
        $this->addElement($destino, 'ans:registroANS', 
            str_pad($this->onlyNumbers($this->company['registroANS']), 6, '0', STR_PAD_LEFT));

        // Versão do Padrão
        $this->addElement($cabecalho, 'ans:Padrao', self::TISS_VERSION);
    }

    private function buildLoteGuias(array $guias)
    {
        $prestadorParaOperadora = $this->dom->createElement('ans:prestadorParaOperadora');
        $this->mensagemTISS->appendChild($prestadorParaOperadora);

        $loteGuias = $this->dom->createElement('ans:loteGuias');
        $prestadorParaOperadora->appendChild($loteGuias);

        $this->addElement($loteGuias, 'ans:numeroLote', $this->loteNumber);

        $guiasTISS = $this->dom->createElement('ans:guiasTISS');
        $loteGuias->appendChild($guiasTISS);

        foreach ($guias as $guia) {
            $this->buildGuiaSPSADT($guiasTISS, $guia);
        }
    }

    private function buildGuiaSPSADT($parent, array $guia)
    {
        $guiaSPSADT = $this->dom->createElement('ans:guiaSP-SADT');
        $parent->appendChild($guiaSPSADT);

        // Cabeçalho da Guia
        $cabecalhoGuia = $this->dom->createElement('ans:cabecalhoGuia');
        $guiaSPSADT->appendChild($cabecalhoGuia);
        $this->addElement($cabecalhoGuia, 'ans:registroANS', 
            str_pad($this->onlyNumbers($guia['registroANS']), 6, '0', STR_PAD_LEFT));
        $this->addElement($cabecalhoGuia, 'ans:numeroGuiaPrestador', $guia['numeroGuiaPrestador']);

        // Dados Autorização
        $dadosAutorizacao = $this->dom->createElement('ans:dadosAutorizacao');
        $guiaSPSADT->appendChild($dadosAutorizacao);
        $this->addElement($dadosAutorizacao, 'ans:numeroGuiaOperadora', $guia['numeroGuiaOperadora']);
        $this->addElement($dadosAutorizacao, 'ans:dataAutorizacao', $this->formatDate($guia['dataAutorizacao']));
        $this->addElement($dadosAutorizacao, 'ans:senha', $this->onlyNumbers($guia['senha']));
        $this->addElement($dadosAutorizacao, 'ans:dataValidadeSenha', $this->formatDate($guia['dataValidadeSenha']));

        // Dados Beneficiário
        $dadosBeneficiario = $this->dom->createElement('ans:dadosBeneficiario');
        $guiaSPSADT->appendChild($dadosBeneficiario);
        $this->addElement($dadosBeneficiario, 'ans:numeroCarteira', 
            substr($this->onlyNumbers($guia['numeroCarteira']), 0, 17));
        $this->addElement($dadosBeneficiario, 'ans:atendimentoRN', 
            $this->formatSimNao($guia['atendimentoRN']));

        // Dados Solicitante
        $dadosSolicitante = $this->dom->createElement('ans:dadosSolicitante');
        $guiaSPSADT->appendChild($dadosSolicitante);
        
        $contratadoSolicitante = $this->dom->createElement('ans:contratadoSolicitante');
        $dadosSolicitante->appendChild($contratadoSolicitante);
        $this->addElement($contratadoSolicitante, 'ans:codigoPrestadorNaOperadora', 
            $this->onlyNumbers($guia['codigoPrestadorSolicitante']));
        
        $this->addElement($dadosSolicitante, 'ans:nomeContratadoSolicitante', 
            $this->sanitizeText($guia['nomeContratadoSolicitante']));
        
        $profissionalSolicitante = $this->dom->createElement('ans:profissionalSolicitante');
        $dadosSolicitante->appendChild($profissionalSolicitante);
        $this->addElement($profissionalSolicitante, 'ans:nomeProfissional', 
            $this->sanitizeText($guia['nomeProfissionalSolicitante']));
        $this->addElement($profissionalSolicitante, 'ans:conselhoProfissional', 
            str_pad($this->onlyNumbers($guia['conselhoProfissionalSolicitante']), 2, '0', STR_PAD_LEFT));
        $this->addElement($profissionalSolicitante, 'ans:numeroConselhoProfissional', 
            $this->onlyNumbers($guia['numeroConselhoSolicitante']));
        $this->addElement($profissionalSolicitante, 'ans:UF', 
            strtoupper(substr($guia['ufSolicitante'], 0, 2)));
        $this->addElement($profissionalSolicitante, 'ans:CBOS', 
            $this->onlyNumbers($guia['cbosSolicitante']));

        // Dados Solicitação
        $dadosSolicitacao = $this->dom->createElement('ans:dadosSolicitacao');
        $guiaSPSADT->appendChild($dadosSolicitacao);
        $this->addElement($dadosSolicitacao, 'ans:dataSolicitacao', 
            $this->formatDate($guia['dataSolicitacao']));
        $this->addElement($dadosSolicitacao, 'ans:caraterAtendimento', 
            !empty($guia['caraterAtendimento']) ? $guia['caraterAtendimento'] : '1');
        $this->addElement($dadosSolicitacao, 'ans:indicacaoClinica', 
            $this->sanitizeText($guia['indicacaoClinica'], 500));

        // Dados Executante
        $dadosExecutante = $this->dom->createElement('ans:dadosExecutante');
        $guiaSPSADT->appendChild($dadosExecutante);
        
        $contratadoExecutante = $this->dom->createElement('ans:contratadoExecutante');
        $dadosExecutante->appendChild($contratadoExecutante);
        $this->addElement($contratadoExecutante, 'ans:codigoPrestadorNaOperadora', 
            $this->onlyNumbers($guia['codigoPrestadorExecutante']));
        
        $this->addElement($dadosExecutante, 'ans:CNES', 
            $this->onlyNumbers($guia['cnesExecutante']));

        // Dados Atendimento
        $dadosAtendimento = $this->dom->createElement('ans:dadosAtendimento');
        $guiaSPSADT->appendChild($dadosAtendimento);
        $this->addElement($dadosAtendimento, 'ans:tipoAtendimento', 
            str_pad(!empty($guia['tipoAtendimento']) ? $guia['tipoAtendimento'] : '03', 2, '0', STR_PAD_LEFT));
        $this->addElement($dadosAtendimento, 'ans:indicacaoAcidente', 
            !empty($guia['indicacaoAcidente']) ? $guia['indicacaoAcidente'] : '9');
        $this->addElement($dadosAtendimento, 'ans:tipoConsulta', 
            !empty($guia['tipoConsulta']) ? $guia['tipoConsulta'] : '2');
        $this->addElement($dadosAtendimento, 'ans:regimeAtendimento', 
            str_pad(!empty($guia['regimeAtendimento']) ? $guia['regimeAtendimento'] : '01', 2, '0', STR_PAD_LEFT));

        // Procedimentos Executados
        $procedimentosExecutados = $this->dom->createElement('ans:procedimentosExecutados');
        $guiaSPSADT->appendChild($procedimentosExecutados);

        foreach ($guia['procedimentos'] as $proc) {
            $this->buildProcedimento($procedimentosExecutados, $proc);
        }

        // Valor Total
        $valorTotal = $this->dom->createElement('ans:valorTotal');
        $guiaSPSADT->appendChild($valorTotal);
        
        $valorProcedimentos = 0;
        foreach ($guia['procedimentos'] as $proc) {
            $valorProcedimentos += (float)$proc['valorTotal'];
        }
        
        $this->addElement($valorTotal, 'ans:valorProcedimentos', number_format($valorProcedimentos, 2, '.', ''));
        $this->addElement($valorTotal, 'ans:valorDiarias', '0.00');
        $this->addElement($valorTotal, 'ans:valorTaxasAlugueis', '0.00');
        $this->addElement($valorTotal, 'ans:valorMateriais', '0.00');
        $this->addElement($valorTotal, 'ans:valorMedicamentos', '0.00');
        $this->addElement($valorTotal, 'ans:valorOPME', '0');
        $this->addElement($valorTotal, 'ans:valorGasesMedicinais', '0.00');
        $this->addElement($valorTotal, 'ans:valorTotalGeral', number_format($valorProcedimentos, 2, '.', ''));
    }

    private function buildProcedimento($parent, array $proc)
    {
        $procedimentoExecutado = $this->dom->createElement('ans:procedimentoExecutado');
        $parent->appendChild($procedimentoExecutado);

        $this->addElement($procedimentoExecutado, 'ans:sequencialItem', $proc['sequencialItem']);
        $this->addElement($procedimentoExecutado, 'ans:dataExecucao', $this->formatDate($proc['dataExecucao']));
        $this->addElement($procedimentoExecutado, 'ans:horaInicial', $this->formatTime($proc['horaInicial']));
        $this->addElement($procedimentoExecutado, 'ans:horaFinal', $this->formatTime($proc['horaFinal']));

        // Procedimento
        $procedimento = $this->dom->createElement('ans:procedimento');
        $procedimentoExecutado->appendChild($procedimento);
        $this->addElement($procedimento, 'ans:codigoTabela', !empty($proc['codigoTabela']) ? $proc['codigoTabela'] : '22');
        $this->addElement($procedimento, 'ans:codigoProcedimento', $this->onlyNumbers($proc['codigoProcedimento']));
        $this->addElement($procedimento, 'ans:descricaoProcedimento', $this->sanitizeText($proc['descricaoProcedimento'], 150));

        $this->addElement($procedimentoExecutado, 'ans:quantidadeExecutada', !empty($proc['quantidadeExecutada']) ? $proc['quantidadeExecutada'] : '1');
        $this->addElement($procedimentoExecutado, 'ans:viaAcesso', !empty($proc['viaAcesso']) ? $proc['viaAcesso'] : '1');
        $this->addElement($procedimentoExecutado, 'ans:tecnicaUtilizada', !empty($proc['tecnicaUtilizada']) ? $proc['tecnicaUtilizada'] : '1');
        $this->addElement($procedimentoExecutado, 'ans:reducaoAcrescimo', !empty($proc['reducaoAcrescimo']) ? $proc['reducaoAcrescimo'] : '1.0');
        $this->addElement($procedimentoExecutado, 'ans:valorUnitario', number_format((float)$proc['valorUnitario'], 2, '.', ''));
        $this->addElement($procedimentoExecutado, 'ans:valorTotal', number_format((float)$proc['valorTotal'], 2, '.', ''));

        // Equipe SADT
        $equipeSadt = $this->dom->createElement('ans:equipeSadt');
        $procedimentoExecutado->appendChild($equipeSadt);
        
        $this->addElement($equipeSadt, 'ans:grauPart', !empty($proc['grauParticipacao']) ? $proc['grauParticipacao'] : '11');
        
        $codProfissional = $this->dom->createElement('ans:codProfissional');
        $equipeSadt->appendChild($codProfissional);
        $this->addElement($codProfissional, 'ans:cpfContratado', 
            str_pad($this->onlyNumbers($proc['cpfExecutante']), 11, '0', STR_PAD_LEFT));
        
        $this->addElement($equipeSadt, 'ans:nomeProf', $this->sanitizeText($proc['nomeExecutante'], 70));
        $this->addElement($equipeSadt, 'ans:conselho', 
            str_pad($this->onlyNumbers($proc['conselhoExecutante']), 2, '0', STR_PAD_LEFT));
        $this->addElement($equipeSadt, 'ans:numeroConselhoProfissional', 
            $this->onlyNumbers($proc['numeroConselhoExecutante']));
        $this->addElement($equipeSadt, 'ans:UF', strtoupper(substr($proc['ufExecutante'], 0, 2)));
        $this->addElement($equipeSadt, 'ans:CBOS', $this->onlyNumbers($proc['cbosExecutante']));
    }

    private function buildEpilogo()
    {
        // Calcula hash ANTES de adicionar epílogo
        $this->hash = md5($this->dom->textContent);

        $epilogo = $this->dom->createElement('ans:epilogo');
        $this->mensagemTISS->appendChild($epilogo);
        $this->addElement($epilogo, 'ans:hash', $this->hash);
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private function addElement($parent, $name, $value)
    {
        $element = $this->dom->createElement($name);
        $text = $this->convertToIso88591((string)$value);
        $element->appendChild($this->dom->createTextNode($text));
        $parent->appendChild($element);
    }

    private function onlyNumbers($value)
    {
        return preg_replace('/[^0-9]/', '', (string)$value);
    }

    private function sanitizeText($value, $maxLen = 150)
    {
        $text = strip_tags((string)$value);
        $text = mb_strtoupper($text, 'UTF-8');
        $text = preg_replace('/[^\p{L}\p{N}\s\-.,;:()\/]/u', '', $text);
        $text = preg_replace('/\s+/', ' ', $text);
        $text = $this->removeAccents($text);
        return substr(trim($text), 0, $maxLen);
    }

    private function removeAccents($str)
    {
        $map = [
            'À'=>'A','Á'=>'A','Â'=>'A','Ã'=>'A','Ä'=>'A','Å'=>'A',
            'Ç'=>'C',
            'È'=>'E','É'=>'E','Ê'=>'E','Ë'=>'E',
            'Ì'=>'I','Í'=>'I','Î'=>'I','Ï'=>'I',
            'Ñ'=>'N',
            'Ò'=>'O','Ó'=>'O','Ô'=>'O','Õ'=>'O','Ö'=>'O',
            'Ù'=>'U','Ú'=>'U','Û'=>'U','Ü'=>'U',
            'Ý'=>'Y'
        ];
        return strtr($str, $map);
    }

    private function formatDate($value)
    {
        if (empty($value)) return date('Y-m-d');
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) return $value;
        if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $value, $m)) return "{$m[3]}-{$m[2]}-{$m[1]}";
        $ts = strtotime($value);
        return $ts ? date('Y-m-d', $ts) : date('Y-m-d');
    }

    private function formatTime($value)
    {
        if (empty($value)) return '00:00:00';
        if (preg_match('/^\d{2}:\d{2}:\d{2}$/', $value)) return $value;
        if (preg_match('/^\d{2}:\d{2}$/', $value)) return $value . ':00';
        return '00:00:00';
    }

    private function formatSimNao($value)
    {
        $v = strtoupper(trim((string)$value));
        return in_array($v, ['S', 'SIM', '1', 'YES', 'Y']) ? 'S' : 'N';
    }

    private function convertToIso88591($str)
    {
        if (mb_detect_encoding($str, 'UTF-8', true)) {
            return mb_convert_encoding($str, 'ISO-8859-1', 'UTF-8');
        }
        return $str;
    }
}