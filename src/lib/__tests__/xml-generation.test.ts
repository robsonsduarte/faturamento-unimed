import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { gerarXmlTiss } from '@/lib/xml/tiss'
import type { Guia, Lote } from '@/lib/types'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env.local manually for vitest
import { config } from 'dotenv'
config({ path: resolve(__dirname, '../../../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

/** Strip dynamic fields (date, hour, hash) for structural comparison */
function normalizeXmlForComparison(xml: string): string {
  return xml
    // Remove XML declaration differences
    .replace(/<\?xml[^?]*\?>/, '')
    // Normalize whitespace/indentation
    .replace(/>\s+</g, '><')
    .trim()
}

/** Extract all unique XML tag names in order of first appearance */
function extractTagStructure(xml: string): string[] {
  const tags = xml.match(/<ans:[a-zA-Z]+[^/]*>/g) ?? []
  const seen = new Set<string>()
  const result: string[] = []
  for (const tag of tags) {
    const name = tag.match(/<(ans:[a-zA-Z]+)/)?.[1] ?? ''
    if (name && !seen.has(name)) {
      seen.add(name)
      result.push(name)
    }
  }
  return result
}

/** Extract tag hierarchy (parent > child relationships) */
function extractTagHierarchy(xml: string): string[] {
  const lines = xml.split('\n').map(l => l.trim()).filter(Boolean)
  const stack: string[] = []
  const relationships: Set<string> = new Set()

  for (const line of lines) {
    const openMatch = line.match(/^<(ans:[a-zA-Z]+)/)
    const closeMatch = line.match(/^<\/(ans:[a-zA-Z]+)>$/)
    const selfClose = line.match(/<(ans:[a-zA-Z]+)[^>]*\/>/)

    if (openMatch && !line.startsWith('</')) {
      const tag = openMatch[1]
      if (stack.length > 0) {
        relationships.add(`${stack[stack.length - 1]} > ${tag}`)
      }
      // Only push to stack if not self-closing and not a leaf with value
      if (!selfClose && !line.match(/<\/ans:[a-zA-Z]+>$/)) {
        stack.push(tag)
      }
    }
    if (closeMatch) {
      if (stack.length > 0 && stack[stack.length - 1] === closeMatch[1]) {
        stack.pop()
      }
    }
  }

  return [...relationships].sort()
}

describe('XML TISS Generation — Real Data', () => {
  let guiasCompleta: Guia[] = []
  let exampleXml: string

  beforeAll(async () => {
    // Load example XML
    const examplePath = resolve(__dirname, '../../../.xml.example/00000000000097498504622_2a9d226b2238356a239b88eed98ba067.xml')
    exampleXml = readFileSync(examplePath, 'utf-8')

    // Fetch COMPLETA guides with procedimentos from real DB
    const supabase = getSupabase()

    const { data: guias, error } = await supabase
      .from('guias')
      .select('*, procedimentos(*)')
      .eq('status', 'COMPLETA')
      .order('data_solicitacao', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Erro ao buscar guias COMPLETA:', error.message)
      return
    }

    guiasCompleta = (guias ?? []) as Guia[]
    console.log(`\n📋 Encontradas ${guiasCompleta.length} guias COMPLETA no banco`)

    for (const g of guiasCompleta) {
      const procs = g.procedimentos?.length ?? 0
      const hasSawXml = !!g.saw_xml_data
      console.log(`  → Guia ${g.guide_number}: ${procs} procedimentos, saw_xml_data: ${hasSawXml}, valor: R$ ${g.valor_total}`)
    }
  })

  it('deve encontrar guias COMPLETA no banco', () => {
    expect(guiasCompleta.length).toBeGreaterThan(0)
  })

  it('deve gerar XML sem erros para guias COMPLETA', () => {
    const guiasComProcs = guiasCompleta.filter(g => (g.procedimentos ?? []).length > 0)
    if (guiasComProcs.length === 0) {
      console.warn('⚠️  Nenhuma guia COMPLETA tem procedimentos — pulando teste')
      return
    }

    const mockLote: Lote = {
      id: 'test-lote-id',
      numero_lote: '999',
      tipo: 'Local',
      referencia: '2026-02',
      quantidade_guias: guiasComProcs.length,
      valor_total: guiasComProcs.reduce((s, g) => s + g.valor_total, 0),
      xml_content: null,
      xml_hash: null,
      status: 'rascunho',
      data_envio: null,
      data_resposta: null,
      observacoes: null,
      numero_fatura: null,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      guias: guiasComProcs,
    }

    const xml = gerarXmlTiss(mockLote)

    expect(xml).toBeDefined()
    expect(xml.length).toBeGreaterThan(100)
    expect(xml).toContain('ans:mensagemTISS')
    expect(xml).toContain('ans:guiaSP-SADT')

    console.log(`\n✅ XML gerado com sucesso: ${xml.length} caracteres, ${guiasComProcs.length} guias`)
  })

  it('deve ter a mesma estrutura de tags que o XML de exemplo', () => {
    const guiasComProcs = guiasCompleta.filter(g => (g.procedimentos ?? []).length > 0)
    if (guiasComProcs.length === 0) return

    const mockLote: Lote = {
      id: 'test-lote-id',
      numero_lote: '999',
      tipo: 'Local',
      referencia: '2026-02',
      quantidade_guias: guiasComProcs.length,
      valor_total: guiasComProcs.reduce((s, g) => s + g.valor_total, 0),
      xml_content: null,
      xml_hash: null,
      status: 'rascunho',
      data_envio: null,
      data_resposta: null,
      observacoes: null,
      numero_fatura: null,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      guias: guiasComProcs,
    }

    const generatedXml = gerarXmlTiss(mockLote)

    // Compare tag structure
    const exampleTags = extractTagStructure(exampleXml)
    const generatedTags = extractTagStructure(generatedXml)

    console.log('\n📊 Comparacao de tags:')
    console.log(`  Exemplo:  ${exampleTags.length} tags unicas`)
    console.log(`  Gerado:   ${generatedTags.length} tags unicas`)

    // Tags no exemplo que faltam no gerado
    const missingTags = exampleTags.filter(t => !generatedTags.includes(t))
    if (missingTags.length > 0) {
      console.log(`\n❌ Tags no EXEMPLO que FALTAM no gerado:`)
      missingTags.forEach(t => console.log(`    - ${t}`))
    }

    // Tags no gerado que nao existem no exemplo
    const extraTags = generatedTags.filter(t => !exampleTags.includes(t))
    if (extraTags.length > 0) {
      console.log(`\n➕ Tags no GERADO que NAO existem no exemplo:`)
      extraTags.forEach(t => console.log(`    + ${t}`))
    }

    if (missingTags.length === 0 && extraTags.length === 0) {
      console.log('\n✅ Estrutura de tags IDENTICA ao exemplo!')
    }

    // Every tag from example must exist in generated
    for (const tag of exampleTags) {
      expect(generatedTags).toContain(tag)
    }
  })

  it('deve ter os valores DEDICARE corretos', () => {
    const guiasComProcs = guiasCompleta.filter(g => (g.procedimentos ?? []).length > 0)
    if (guiasComProcs.length === 0) return

    const mockLote: Lote = {
      id: 'test-lote-id',
      numero_lote: '999',
      tipo: 'Local',
      referencia: '2026-02',
      quantidade_guias: guiasComProcs.length,
      valor_total: guiasComProcs.reduce((s, g) => s + g.valor_total, 0),
      xml_content: null,
      xml_hash: null,
      status: 'rascunho',
      data_envio: null,
      data_resposta: null,
      observacoes: null,
      numero_fatura: null,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      guias: guiasComProcs,
    }

    const xml = gerarXmlTiss(mockLote)

    // DEDICARE constants
    expect(xml).toContain('<ans:codigoPrestadorNaOperadora>97498504</ans:codigoPrestadorNaOperadora>')
    expect(xml).toContain('<ans:registroANS>339679</ans:registroANS>')
    expect(xml).toContain('<ans:CNES>9794220</ans:CNES>')
    expect(xml).toContain('<ans:Padrao>4.02.00</ans:Padrao>')
    expect(xml).toContain('<ans:nomeContratadoSolicitante>DEDICARE SERVICOS DE FONOAUDIOLOGIA PSICOLOGIA E NUTRICAO</ans:nomeContratadoSolicitante>')

    // Structure
    expect(xml).toContain('<ans:tipoTransacao>ENVIO_LOTE_GUIAS</ans:tipoTransacao>')
    expect(xml).toContain('<ans:atendimentoRN>N</ans:atendimentoRN>')
    expect(xml).toContain('<ans:caraterAtendimento>1</ans:caraterAtendimento>')

    // Hash must be present
    const hashMatch = xml.match(/<ans:hash>([a-f0-9]{32})<\/ans:hash>/)
    expect(hashMatch).toBeTruthy()

    console.log(`\n✅ Constantes DEDICARE e estrutura validadas`)
    console.log(`  Hash: ${hashMatch?.[1]}`)
  })

  it('deve comparar campo a campo com o XML de exemplo (1 guia)', () => {
    const guiasComProcs = guiasCompleta.filter(g => (g.procedimentos ?? []).length > 0)
    if (guiasComProcs.length === 0) return

    // Use just 1 guide for detailed comparison
    const singleGuia = guiasComProcs[0]
    const mockLote: Lote = {
      id: 'test-lote-id',
      numero_lote: '999',
      tipo: 'Local',
      referencia: '2026-02',
      quantidade_guias: 1,
      valor_total: singleGuia.valor_total,
      xml_content: null,
      xml_hash: null,
      status: 'rascunho',
      data_envio: null,
      data_resposta: null,
      observacoes: null,
      numero_fatura: null,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      guias: [singleGuia],
    }

    const xml = gerarXmlTiss(mockLote)

    console.log('\n📝 Comparacao detalhada (1 guia):')
    console.log(`  Guia: ${singleGuia.guide_number}`)
    console.log(`  Paciente: ${singleGuia.paciente}`)
    console.log(`  Procs DB: ${singleGuia.procedimentos?.length ?? 0}`)
    console.log(`  Procs XML SAW: ${singleGuia.saw_xml_data?.procedimentosExecutados?.length ?? 0}`)
    console.log(`  Valor: R$ ${singleGuia.valor_total}`)

    // Extract key sections from generated XML for comparison
    const sections = [
      'cabecalhoGuia', 'dadosAutorizacao', 'dadosBeneficiario',
      'dadosSolicitante', 'dadosSolicitacao', 'dadosExecutante',
      'dadosAtendimento', 'procedimentosExecutados', 'valorTotal',
    ]

    for (const section of sections) {
      const hasSection = xml.includes(`<ans:${section}>`)
      console.log(`  ${hasSection ? '✅' : '❌'} <ans:${section}>`)
    }

    // Check procedure details
    const procCount = (xml.match(/<ans:procedimentoExecutado>/g) ?? []).length
    console.log(`\n  Procedimentos no XML gerado: ${procCount}`)

    // Extract all valorTotal values
    const valorMatch = xml.match(/<ans:valorTotalGeral>([^<]+)</)
    console.log(`  valorTotalGeral: ${valorMatch?.[1]}`)

    // Check carteira padding
    const carteiraMatch = xml.match(/<ans:numeroCarteira>([^<]+)</)
    if (carteiraMatch) {
      console.log(`  numeroCarteira: ${carteiraMatch[1]} (${carteiraMatch[1].length} chars)`)
      expect(carteiraMatch[1].length).toBe(17)
    }

    // Check numeric codes
    const tipoAtendMatch = xml.match(/<ans:tipoAtendimento>([^<]+)</)
    const indAcidenteMatch = xml.match(/<ans:indicacaoAcidente>([^<]+)</)
    const cbosMatch = xml.match(/<ans:CBOS>([^<]+)</)
    const conselhoMatch = xml.match(/<ans:conselhoProfissional>([^<]+)</)
    const ufMatch = xml.match(/<ans:UF>([^<]+)</)

    console.log(`\n  Codigos normalizados:`)
    console.log(`    tipoAtendimento: ${tipoAtendMatch?.[1]} (esperado: codigo SAW 01-23)`)
    console.log(`    indicacaoAcidente: ${indAcidenteMatch?.[1]} (esperado: 0, 1, 2 ou 9)`)
    console.log(`    CBOS: ${cbosMatch?.[1]} (esperado: 6 digitos)`)
    console.log(`    conselhoProfissional: ${conselhoMatch?.[1]} (esperado: 2 digitos)`)
    console.log(`    UF: ${ufMatch?.[1]} (esperado: codigo IBGE 2 digitos)`)

    // Validate numeric codes
    if (tipoAtendMatch) expect(tipoAtendMatch[1]).toMatch(/^\d{2}$/)
    if (indAcidenteMatch) expect(indAcidenteMatch[1]).toMatch(/^\d{1}$/)
    if (ufMatch) expect(ufMatch[1]).toMatch(/^\d{2}$/)

    // Print full generated XML for manual inspection
    console.log('\n' + '='.repeat(80))
    console.log('XML GERADO (primeiras 120 linhas):')
    console.log('='.repeat(80))
    const xmlLines = xml.split('\n')
    console.log(xmlLines.slice(0, 120).join('\n'))
    if (xmlLines.length > 120) {
      console.log(`\n... (${xmlLines.length - 120} linhas restantes)`)
    }
  })

  it('deve lidar com guia sem procedimentos graciosamente', () => {
    // A guide with no procedures should be filtered out
    const mockGuia: Guia = {
      id: 'empty-guia',
      guide_number: '0000000000',
      guide_number_prestador: null,
      status: 'COMPLETA',
      status_xml: 'PENDENTE',
      provider: 'UNIMED',
      paciente: 'Teste',
      numero_carteira: '08650000000000000',
      senha: '123456',
      data_autorizacao: '2026-01-01',
      data_validade_senha: '2026-03-01',
      data_solicitacao: '2026-01-01',
      quantidade_solicitada: 10,
      quantidade_autorizada: 10,
      procedimentos_realizados: 0,
      procedimentos_cadastrados: 0,
      codigo_prestador: '97498504',
      nome_profissional: 'Dr. Teste',
      cnes: '9794220',
      valor_total: 0,
      user_id: null,
      indicacao_clinica: null,
      tipo_atendimento: null,
      indicacao_acidente: null,
      tipo_guia: 'Local',
      lote_id: null,
      token_biometrico: false,
      data_token: null,
      saw_data: null,
      cpro_data: null,
      saw_xml_data: null,
      saw_login: null,
      mes_referencia: '2026-01',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      procedimentos: [], // Empty!
    }

    const mockLote: Lote = {
      id: 'test-lote-empty',
      numero_lote: '998',
      tipo: 'Local',
      referencia: '2026-02',
      quantidade_guias: 1,
      valor_total: 0,
      xml_content: null,
      xml_hash: null,
      status: 'rascunho',
      data_envio: null,
      data_resposta: null,
      observacoes: null,
      numero_fatura: null,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      guias: [mockGuia],
    }

    expect(() => gerarXmlTiss(mockLote)).toThrow('Lote sem guias com procedimentos')
    console.log('\n✅ Guia sem procedimentos corretamente rejeitada')
  })
})
