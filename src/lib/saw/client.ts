import { chromium } from 'playwright'
import type { Browser, BrowserContext, Page, Cookie } from 'playwright'
import { appendFileSync } from 'fs'

function sawLog(msg: string) {
  const ts = new Date().toISOString()
  const line = `[${ts}] ${msg}\n`
  console.log(`[SAW] ${msg}`)
  try { appendFileSync('/tmp/saw-debug.log', line) } catch { /* */ }
}

export type SawCookie = Cookie

export interface SawLoginConfig {
  login_url: string
  usuario: string
  senha: string
}

export interface SawLoginResult {
  success: boolean
  cookies: SawCookie[]
  error?: string
}

export interface SawReadGuideResult {
  success: boolean
  data?: Record<string, unknown>
  error?: string
}

const SAW_BASE = 'https://saw.trixti.com.br'
const CONTEXT_TTL_MS = 30 * 60 * 1000 // 30 min idle cleanup
const MAX_CONTEXTS = 20

interface UserContext {
  context: BrowserContext
  lastUsed: number
  cleanupTimer: ReturnType<typeof setTimeout>
}

interface TokenPageEntry {
  page: Page
  numeroGuia: string
  createdAt: number
}

class SawClient {
  private browser: Browser | null = null
  private contexts: Map<string, UserContext> = new Map()
  private tokenPages: Map<string, TokenPageEntry> = new Map()
  private locks: Map<string, Promise<void>> = new Map()

  // ─── Browser lifecycle ──────────────────────────────────────
  async getBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) return this.browser

    const wsUrl = process.env.PLAYWRIGHT_WS_URL
    if (wsUrl) {
      sawLog(`Connecting to remote browser at ${wsUrl}`)
      this.browser = await chromium.connect(wsUrl)
    } else {
      console.log('[SAW] Launching local Chromium (headless)')
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--use-fake-ui-for-media-stream',
          '--use-fake-device-for-media-stream',
        ],
      })
    }

    this.browser.on('disconnected', () => {
      console.log('[SAW] Browser disconnected unexpectedly')
      this.browser = null
      this.contexts.clear()
    })

    return this.browser
  }

  // ─── Per-user BrowserContext pool ───────────────────────────
  async getContext(userId: string, cookies?: SawCookie[]): Promise<BrowserContext> {
    const existing = this.contexts.get(userId)
    if (existing) {
      existing.lastUsed = Date.now()
      clearTimeout(existing.cleanupTimer)
      existing.cleanupTimer = setTimeout(() => this.destroyContext(userId), CONTEXT_TTL_MS)
      return existing.context
    }

    // Evict oldest context if at capacity
    if (this.contexts.size >= MAX_CONTEXTS) {
      let oldestKey: string | null = null
      let oldestTime = Infinity
      for (const [key, entry] of this.contexts) {
        if (entry.lastUsed < oldestTime) {
          oldestTime = entry.lastUsed
          oldestKey = key
        }
      }
      if (oldestKey) await this.destroyContext(oldestKey)
    }

    const browser = await this.getBrowser()
    const context = await browser.newContext({
      viewport: { width: 1400, height: 900 },
      ignoreHTTPSErrors: true,
    })

    if (cookies?.length) {
      await context.addCookies(cookies)
    }

    const cleanupTimer = setTimeout(() => this.destroyContext(userId), CONTEXT_TTL_MS)

    this.contexts.set(userId, {
      context,
      lastUsed: Date.now(),
      cleanupTimer,
    })

    return context
  }

  async destroyContext(userId: string): Promise<void> {
    const entry = this.contexts.get(userId)
    if (!entry) return
    clearTimeout(entry.cleanupTimer)
    this.contexts.delete(userId)
    try { await entry.context.close() } catch { /* already closed */ }
    sawLog(`Context destroyed for user ${userId.slice(0, 8)}...`)
  }

  // ─── Per-user mutex ─────────────────────────────────────────
  private async withLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(userId) ?? Promise.resolve()
    let resolve: () => void
    const current = new Promise<void>((r) => { resolve = r })
    this.locks.set(userId, current)

    await prev
    try {
      return await fn()
    } finally {
      resolve!()
    }
  }

  // ─── Login ──────────────────────────────────────────────────
  async login(userId: string, config: SawLoginConfig): Promise<SawLoginResult> {
    return this.withLock(userId, async () => {
      // Destroy stale context before login
      await this.destroyContext(userId)
      const context = await this.getContext(userId)
      const page = await context.newPage()

      try {
        page.setDefaultTimeout(60_000)

        await page.goto(config.login_url, {
          waitUntil: 'networkidle',
          timeout: 60_000,
        })

        await page.waitForLoadState('domcontentloaded')

        // Check if already logged in: no login inputs = session active
        const hasLoginInputs = await page.evaluate(() => {
          const u = document.querySelector('input[id="login"], input[name="login"]')
          const p = document.querySelector('input[type="password"]')
          return !!(u && p)
        })

        if (!hasLoginInputs) {
          const cookies = await context.cookies()
          return { success: true, cookies }
        }

        // Fill login form
        await page.locator('#login').waitFor({ state: 'visible', timeout: 15_000 })
        await page.locator('#login').fill('')
        await page.locator('#login').pressSequentially(config.usuario, { delay: 80 })

        await page.locator('#password').waitFor({ state: 'visible', timeout: 15_000 })
        await page.locator('#password').fill('')
        await page.locator('#password').pressSequentially(config.senha, { delay: 80 })

        // Submit
        await page.locator('#submitForm').waitFor({ state: 'visible', timeout: 15_000 })
        const urlBefore = page.url()
        await page.locator('#submitForm').click()

        try {
          await Promise.race([
            page.waitForURL((url) => url.toString() !== urlBefore, { timeout: 60_000 }),
            page.waitForLoadState('networkidle', { timeout: 60_000 }),
          ])
        } catch {
          // Navigation race finished
        }

        await page.waitForLoadState('domcontentloaded').catch(() => {})

        // Validate login: check for #topoBarraPrincipal or URL change
        let loginValid = false
        try {
          await page.locator('#topoBarraPrincipal').waitFor({ state: 'visible', timeout: 15_000 })
          loginValid = true
        } catch {
          const postUrl = page.url()
          loginValid = !postUrl.includes('Logar.do') && !postUrl.includes('login.jsp')
        }

        if (!loginValid) {
          return { success: false, cookies: [], error: 'Login falhou - verifique credenciais' }
        }

        // Close any popup (entendi, ok, confirmar)
        try {
          await page.evaluate(() => {
            const botoes = Array.from(document.querySelectorAll('button, input[type="button"], a'))
            const botao = botoes.find((btn) => {
              const text = (btn.textContent ?? '').toLowerCase()
              return text.includes('entendi') || text.includes('ok') || text.includes('confirmar')
            })
            if (botao) (botao as HTMLElement).click()
          })
          await page.waitForLoadState('domcontentloaded').catch(() => {})
        } catch {
          // No popup
        }

        const cookies = await context.cookies()
        return { success: true, cookies }
      } catch (err) {
        return {
          success: false,
          cookies: [],
          error: err instanceof Error ? err.message : 'Erro desconhecido no login',
        }
      } finally {
        await page.close().catch(() => {})
      }
    })
  }

  // ─── Session validation ─────────────────────────────────────
  async validateSession(userId: string, cookies: SawCookie[]): Promise<boolean> {
    return this.withLock(userId, async () => {
      let page: Page | null = null
      try {
        const context = await this.getContext(userId, cookies)
        page = await context.newPage()
        page.setDefaultTimeout(20_000)

        await page.goto(`${SAW_BASE}/saw/Logar.do?method=abrirSAW`, {
          waitUntil: 'domcontentloaded',
          timeout: 20_000,
        })

        await page.waitForTimeout(1000)

        // No login inputs = session active
        const hasLoginInputs = await page.evaluate(() => {
          const u = document.querySelector('input[id="login"], input[name="login"]')
          const p = document.querySelector('input[type="password"]')
          return !!(u && p)
        })

        return !hasLoginInputs
      } catch {
        return false
      } finally {
        if (page) await page.close().catch(() => {})
      }
    })
  }

  // ─── Read guide ─────────────────────────────────────────────
  async readGuide(
    userId: string,
    cookies: SawCookie[],
    numeroGuia: string
  ): Promise<SawReadGuideResult> {
    return this.withLock(userId, async () => {
      let page: Page | null = null

      try {
        const context = await this.getContext(userId, cookies)
        page = await context.newPage()
        page.setDefaultTimeout(30_000)

        const url = `${SAW_BASE}/saw/tiss/SolicitacaoDeSPSADT40.do?method=consultarGuiaDeSPSADT&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.numeroDaGuia=${encodeURIComponent(numeroGuia)}&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.isConsultaNaGuia=true`

        await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })

        // Wait for possible JS redirects
        await page.waitForTimeout(2000)

        // Check if redirected to token page (MantemTokenDeAtendimento.do)
        // This means the guide requires biometric token BEFORE it can be viewed
        const currentUrl = page.url()
        const pageText = await page.evaluate(() => document.body?.innerText ?? '')
        const isTokenPage = currentUrl.includes('MantemTokenDeAtendimento') ||
          currentUrl.includes('TokenDeAtendimento') ||
          pageText.includes('informe um token para continuar o atendimento')
        if (isTokenPage) {
          sawLog(`Guia ${numeroGuia}: redirecionada para tela de token biometrico`)
          return {
            success: true,
            data: {
              sucesso: true,
              numeroGuia,
              status: null,
              tokenMessage: 'Realize o check-in do Paciente',
              tokenRedirect: true,
              // Minimal data — guide page was not accessible
              dataAutorizacao: null,
              senha: null,
              dataValidadeSenha: null,
              nomeBeneficiario: null,
              numeroGuiaOperadora: null,
              numeroGuiaPrestador: null,
              numeroCarteira: null,
              quantidadeSolicitada: 0,
              quantidadeAutorizada: 0,
              codigoProcedimentoSolicitado: '',
              procedimentosRealizados: 0,
              procedimentosDetalhes: [],
              chave: null,
              temXML: false,
              xmlContent: null,
            },
          }
        }

        // Check session expiry
        const hasLoginInputs = await page.evaluate(() => {
          const u = document.querySelector('input[id="login"], input[name="login"]')
          const p = document.querySelector('input[type="password"]')
          return !!(u && p)
        })
        if (hasLoginInputs) {
          return { success: false, error: 'Sessao SAW expirou. Refaca o login.' }
        }

        // Wait for page JS to settle
        await page.waitForTimeout(1500)

        // ─── Scrape via page.evaluate ───────────────────────
        const resultado = await page.evaluate((numGuia: string) => {
          try {
            /* Helper: text after a label (div.caixaVerde/caixaBranca/div) */
            const extrairTextoDepoisDeLabel = (labelText: string): string | null => {
              const divs = document.querySelectorAll('div.caixaVerde, div.caixaBranca, div')
              for (const div of divs) {
                const label = div.querySelector('label')
                if (label && label.textContent && label.textContent.includes(labelText)) {
                  const textoCompleto = (div as HTMLElement).textContent ?? (div as HTMLElement).innerText
                  const textoSemLabel = textoCompleto.replace(label.textContent, '')
                  return textoSemLabel.trim().replace(/\s+/g, ' ').replace(/\u00a0/g, '') || null
                }
              }
              return null
            }

            /* STATUS (red bold text) */
            const statusElement = document.querySelector('b[style*="color: red"]') as HTMLElement | null
            const status = statusElement ? statusElement.textContent?.trim() ?? null : null

            /* BASIC FIELDS */
            const dataAutorizacao = extrairTextoDepoisDeLabel('4-Data da Autoriza')
            const senha = extrairTextoDepoisDeLabel('5-Senha')
            const dataValidadeSenha = extrairTextoDepoisDeLabel('6-Data Validade da Senha')
            const nomeBeneficiario = extrairTextoDepoisDeLabel('10-Nome')

            /* GUIA OPERADORA (span bold) */
            let numeroGuiaOperadora: string | null = null
            const divNumeroGuia = Array.from(document.querySelectorAll('div.caixaBranca')).find(
              (div) => (div as HTMLElement).textContent?.includes('7-N')
            )
            if (divNumeroGuia) {
              const span = divNumeroGuia.querySelector('span[style*="font-weight: bold"]') as HTMLElement | null
              if (span) numeroGuiaOperadora = span.textContent?.trim().replace(/\u00a0/g, '') ?? null
            }

            /* GUIA PRESTADOR (span bold) */
            let numeroGuiaPrestador: string | null = null
            const divGuiaPrestador = Array.from(document.querySelectorAll('div.caixaBrancaSemBorda')).find(
              (div) => (div as HTMLElement).textContent?.includes('2-N')
            )
            if (divGuiaPrestador) {
              const span = divGuiaPrestador.querySelector('span[style*="font-weight: bold"]') as HTMLElement | null
              if (span) numeroGuiaPrestador = span.textContent?.trim().replace(/\u00a0/g, '') ?? null
            }

            /* NUMERO CARTEIRA */
            let numeroCarteira = extrairTextoDepoisDeLabel('8-N')
            if (numeroCarteira) {
              numeroCarteira = numeroCarteira.replace(/\D/g, '') || null
            }

            /* CONTRATADO / PROFISSIONAL */
            const codigoPrestador = extrairTextoDepoisDeLabel('13-C')
            const nomeContratado = extrairTextoDepoisDeLabel('14-Nome do Contratado')

            /* ─── CAMPOS 15-19 via innerText (mais confiavel que label/div) ─── */
            const bodyText = document.body?.innerText ?? ''

            const extractAfterLabel = (text: string, labelRegex: RegExp): string | null => {
              const match = labelRegex.exec(text)
              if (!match) return null
              const after = text.substring(match.index + match[0].length).trim()
              const lines = after.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0)
              if (lines.length === 0) return null
              const val = lines[0]
              // Se bate com proximo label, nao e o valor
              if (/^\d+-/.test(val)) return null
              return val
            }

            const nomeProfissional = extractAfterLabel(bodyText, /15-Nome do Profissional Solicitante\s*/i)
              ?? extrairTextoDepoisDeLabel('15-Nome do Profissional')

            /* CONSELHO PROFISSIONAL (w/ TISS mapping) */
            let conselhoProfissional = extractAfterLabel(bodyText, /16-Conselho Profissional\s*/i)
              ?? extrairTextoDepoisDeLabel('16-Conselho')
            if (conselhoProfissional) {
              if (conselhoProfissional.includes('Psicologia')) conselhoProfissional = '09'
              else if (conselhoProfissional.includes('Fonoaudiologia')) conselhoProfissional = '08'
              else if (conselhoProfissional.includes('Nutri')) conselhoProfissional = '07'
              else if (conselhoProfissional.includes('Medicina')) conselhoProfissional = '06'
            }

            const numeroConselhoProfissional = extractAfterLabel(bodyText, /17-N[uú]mero no Conselho\s*/i)
              ?? extrairTextoDepoisDeLabel('17-N')

            const ufProfissional = extractAfterLabel(bodyText, /18-UF\s*/i)
              ?? extrairTextoDepoisDeLabel('18-UF')

            /* CBO PROFISSIONAL (w/ TISS mapping) */
            let cbosProfissional = extractAfterLabel(bodyText, /19-C[oó]digo CBO\s*/i)
              ?? extrairTextoDepoisDeLabel('19-C')
            if (cbosProfissional) {
              const lower = cbosProfissional.toLowerCase()
              if (lower.includes('psicopedagog')) cbosProfissional = '239425'
              else if (lower.includes('psicanalista')) cbosProfissional = '251545'
              else if (lower.includes('psicomotric')) cbosProfissional = '239440'
              else if (lower.includes('logo cl') || lower.includes('psicologo') || lower.includes('psicólogo')) cbosProfissional = '251510'
              else if (lower.includes('fonoaudi')) cbosProfissional = '223810'
              else if (lower.includes('nutri')) cbosProfissional = '223505'
              else if (lower.includes('terapeuta ocup')) cbosProfissional = '223905'
              else if (lower.includes('fisioterapeut')) cbosProfissional = '223605'
            }

            /* SOLICITACAO E ATENDIMENTO */
            let dataSolicitacao = extrairTextoDepoisDeLabel('22-Data')
            if (dataSolicitacao && dataSolicitacao.includes(' - ')) {
              dataSolicitacao = dataSolicitacao.split(' - ')[0].trim()
            }

            const indicacaoClinica = extractAfterLabel(bodyText, /23-Indica[cç][aã]o Cl[ií]nica\s*/i)
              ?? extrairTextoDepoisDeLabel('23-Indica')

            const cnes = extrairTextoDepoisDeLabel('31-CNES')

            let tipoAtendimento = extrairTextoDepoisDeLabel('32-Tipo Atendimento')
            if (tipoAtendimento && tipoAtendimento.includes('Outras Terapias')) tipoAtendimento = '03'

            let indicacaoAcidente = extrairTextoDepoisDeLabel('33-Indica')
            if (indicacaoAcidente) {
              const lowerAcid = indicacaoAcidente.toLowerCase()
              if (lowerAcid.includes('trabalho')) indicacaoAcidente = '0'
              else if (lowerAcid.includes('trânsito') || lowerAcid.includes('transito')) indicacaoAcidente = '1'
              else indicacaoAcidente = '9'
            }

            /* QUANTITIES FROM #procedimentos table (FIRST ROW) */
            let quantidadeSolicitada = 0
            let quantidadeAutorizada = 0
            let codigoProcedimentoSolicitado = ''

            const tabelaProcedimentos = document.querySelector('#procedimentos table')
            if (tabelaProcedimentos) {
              const linhas = tabelaProcedimentos.querySelectorAll('tr')
              for (let i = 1; i < linhas.length; i++) {
                const colunas = linhas[i].querySelectorAll('td')
                if (colunas.length >= 5) {
                  codigoProcedimentoSolicitado = (colunas[1].textContent ?? '').trim().replace(/\u00a0/g, '')
                  const qtdSolic = (colunas[3].textContent ?? '').trim().replace(/\u00a0/g, '')
                  const qtdAutor = (colunas[4].textContent ?? '').trim().replace(/\u00a0/g, '')
                  if (qtdSolic && !isNaN(Number(qtdSolic))) quantidadeSolicitada = parseInt(qtdSolic)
                  if (qtdAutor && !isNaN(Number(qtdAutor))) quantidadeAutorizada = parseInt(qtdAutor)
                  break
                }
              }
            }

            /* PROCEDIMENTOS REALIZADOS */
            let procedimentosRealizados = 0
            const todasTabelas = document.querySelectorAll('table.caixaBranca')
            for (const tabela of todasTabelas) {
              const headers = tabela.querySelectorAll('tr:first-child td label')
              const temData36 = Array.from(headers).some(
                (label) => label.textContent?.includes('36-Data') ?? false
              )
              if (temData36) {
                const textoTabela = (tabela as HTMLElement).textContent ?? (tabela as HTMLElement).innerText
                if (textoTabela.includes('Nenhum procedimento realizado cadastrado')) {
                  procedimentosRealizados = 0
                } else {
                  procedimentosRealizados = tabela.querySelectorAll('tr').length - 1
                }
                break
              }
            }

            /* PROCEDURE DETAILS */
            const procedimentosDetalhes: Array<{
              sequencia: number
              data: string
              horaInicio: string
              horaFim: string
              tabela: string
              codigoProcedimento: string
              descricao: string
              quantidade: number
              via: string
              tecnica: string
              reducaoAcrescimo: number
              valorUnitario: number
              valorTotal: number
              execucaoId: number | null
            }> = []

            for (const tabela of todasTabelas) {
              const headers = tabela.querySelectorAll('tr:first-child td label')
              const temData36 = Array.from(headers).some(
                (label) => label.textContent?.includes('36-Data') ?? false
              )
              if (!temData36) continue

              const textoTabela = (tabela as HTMLElement).textContent ?? ''
              if (textoTabela.includes('Nenhum procedimento realizado cadastrado')) break

              const trs = tabela.querySelectorAll('tr')
              for (let i = 1; i < trs.length; i++) {
                const td = trs[i].querySelectorAll('td')
                if (td.length < 12) continue

                const dataRaw = (td[0].textContent ?? '').trim()
                const seqMatch = dataRaw.match(/^(\d+)/)
                const dataMatch = dataRaw.match(/(\d{2}\/\d{2}\/\d{4})/)

                const horaRaw = (td[1].textContent ?? '').trim()
                const horaParts = horaRaw.split(/\s*à\s*/)

                // execucaoId: extrair do onclick="excluirProcedimentoRealizado(NNN)" na linha
                const rowHtml = (trs[i] as HTMLElement).innerHTML ?? ''
                const execIdMatch = rowHtml.match(/excluirProcedimentoRealizado\((\d+)\)/)
                const execucaoId = execIdMatch ? parseInt(execIdMatch[1], 10) : null

                procedimentosDetalhes.push({
                  sequencia: seqMatch ? parseInt(seqMatch[1]) : i,
                  data: dataMatch ? dataMatch[1] : '',
                  horaInicio: horaParts[0]?.trim() ?? '',
                  horaFim: horaParts[1]?.trim() ?? '',
                  tabela: (td[2].textContent ?? '').trim(),
                  codigoProcedimento: (td[3].textContent ?? '').trim(),
                  descricao: (td[5].textContent ?? '').trim(),
                  quantidade: parseInt((td[6].textContent ?? '').replace(/\D/g, '')) || 1,
                  via: (td[7].textContent ?? '').trim(),
                  tecnica: (td[8].textContent ?? '').trim(),
                  reducaoAcrescimo: parseFloat((td[9].textContent ?? '').replace(',', '.')) || 1,
                  valorUnitario: parseFloat((td[10].textContent ?? '').replace(/\./g, '').replace(',', '.')) || 0,
                  valorTotal: parseFloat((td[11].textContent ?? '').replace(/\./g, '').replace(',', '.')) || 0,
                  execucaoId,
                })
              }
              break
            }

            /* TOKEN / CHECK-IN */
            const tokenMessage = bodyText.includes('Realize o check-in do Paciente')
              ? 'Realize o check-in do Paciente'
              : ''

            /* CHAVE DA GUIA (para download XML) */
            let chave: string | null = null

            const chaveInput = document.querySelector('input[name="manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.chave"]') as HTMLInputElement | null
            if (chaveInput?.value) chave = chaveInput.value

            if (!chave) {
              const xmlLink = document.querySelector('a[href*="gerarXMLTISSDeGuia"]') as HTMLAnchorElement | null
              if (xmlLink) {
                const m = xmlLink.href.match(/chave=(\d+)/)
                if (m) chave = m[1]
              }
            }

            if (!chave) {
              const hiddenInputs = document.querySelectorAll('input[type="hidden"]')
              for (const hi of hiddenInputs) {
                const val = (hi as HTMLInputElement).value
                if (val && /^\d{10,}$/.test(val)) {
                  chave = val
                  break
                }
              }
            }

            const temXML = !!document.querySelector('a[href*="gerarXMLTISSDeGuia"]')

            return {
              sucesso: true,
              status,
              dataAutorizacao,
              senha,
              dataValidadeSenha,
              numeroGuiaOperadora,
              numeroGuiaPrestador,
              numeroCarteira,
              nomeBeneficiario,
              codigoPrestador,
              nomeContratado,
              nomeProfissional,
              conselhoProfissional,
              numeroConselhoProfissional,
              ufProfissional,
              cbosProfissional,
              dataSolicitacao,
              indicacaoClinica,
              cnes,
              tipoAtendimento,
              indicacaoAcidente,
              quantidadeSolicitada,
              quantidadeAutorizada,
              codigoProcedimentoSolicitado,
              procedimentosRealizados,
              procedimentosDetalhes,
              tokenMessage,
              chave,
              temXML,
            }
          } catch (e) {
            return { sucesso: false, erro: (e as Error).message }
          }
        }, numeroGuia)

        if (!resultado.sucesso) {
          return {
            success: false,
            error: (resultado as { erro?: string }).erro ?? 'Erro ao extrair dados da guia',
          }
        }

        // Validation: procedures reported but not extracted
        const procRealizados = (resultado as Record<string, unknown>).procedimentosRealizados as number
        const procDetalhes = ((resultado as Record<string, unknown>).procedimentosDetalhes as unknown[]) ?? []

        if (procRealizados > 0 && procDetalhes.length === 0) {
          console.error(`[SAW] ALERTA: Guia ${numeroGuia} — ${procRealizados} procedimentos reportados mas 0 extraidos`)
        }

        sawLog(`Guia ${numeroGuia}: ${procRealizados} realizados, ${procDetalhes.length} detalhes extraidos`)

        // Download XML while still on the guide page
        let xmlContent: string | null = null
        const resData = resultado as Record<string, unknown>

        if (resData.chave) {
          try {
            const xmlUrl = `${SAW_BASE}/saw/tiss/SolicitacaoDeSPSADT40.do?method=gerarXMLTISSDeGuia&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.chave=${resData.chave}`
            xmlContent = await page.evaluate(async (fetchUrl: string) => {
              const resp = await fetch(fetchUrl, { credentials: 'include' })
              return await resp.text()
            }, xmlUrl)

            if (xmlContent && (xmlContent.includes('ctmSpSadtGuia') || xmlContent.includes('mensagemTISS'))) {
              sawLog(`XML da guia ${numeroGuia} baixado: ${xmlContent.length} bytes`)
            } else {
              sawLog(`XML da guia ${numeroGuia}: conteudo invalido (${xmlContent?.length ?? 0} bytes)`)
              xmlContent = null
            }
          } catch (xmlErr) {
            sawLog(`XML da guia ${numeroGuia}: erro ao baixar (${xmlErr instanceof Error ? xmlErr.message : 'erro'})`)
            xmlContent = null
          }
        }

        return { success: true, data: { ...resultado, numeroGuia, xmlContent } as Record<string, unknown> }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Erro ao ler guia no SAW',
        }
      } finally {
        if (page) await page.close().catch(() => {})
      }
    })
  }

  // ─── Resolve biometric token (técnica do workflow n8n funcional) ───
  async resolveToken(
    userId: string,
    cookies: SawCookie[],
    numeroGuia: string,
    photoBase64: string,
    onProgress?: (step: string, message: string) => void | Promise<void>,
  ): Promise<{ success: boolean; error?: string; fallbackToToken?: boolean }> {
    return this.withLock(userId, async () => {
      let page: Page | null = null
      let biofacePage: Page | null = null

      try {
        const context = await this.getContext(userId, cookies)
        page = await context.newPage()
        page.setDefaultTimeout(30_000)

        const guiaUrl = `${SAW_BASE}/saw/tiss/SolicitacaoDeSPSADT40.do?method=consultarGuiaDeSPSADT&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.numeroDaGuia=${encodeURIComponent(numeroGuia)}&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.isConsultaNaGuia=true`

        await onProgress?.("3/9", ` Navegando para guia ${numeroGuia}`)
        await page.goto(guiaUrl, { waitUntil: 'networkidle', timeout: 30_000 })
        await page.waitForTimeout(2000)

        const currentUrl = page.url()

        // Se redirecionou para tela de token numerico, biometria nao esta disponivel
        if (currentUrl.includes('MantemTokenDeAtendimento') || currentUrl.includes('TokenDeAtendimento')) {
          sawLog(`resolveToken: guia requer token numerico, nao biometria facial`)
          return { success: false, fallbackToToken: true, error: 'Guia requer token numerico (App/SMS), nao biometria facial.' }
        }

        // === STEP 1: Verificar se biometria ja autenticada ===
        const alreadyAuth = await page.$('img[src*="biometriaAutenticadaface"]')
        if (alreadyAuth) {
          await onProgress?.("3/9", ` Biometria ja autenticada!`)
          return { success: true }
        }

        // === STEP 2: Clicar check-in e extrair URL BioFace ===
        await onProgress?.("4/9", ` Clicando check-in para gerar URL BioFace...`)

        // Clicar usando a funcao JS do SAW ou o link
        await page.evaluate(() => {
          if (typeof (window as unknown as Record<string, unknown>).gravarDadosGuiaBiometriaFacial === 'function') {
            ((window as unknown as Record<string, unknown>).gravarDadosGuiaBiometriaFacial as () => void)()
          } else {
            const link = document.querySelector('#linkCheckInPacienteBiometriaFacial a') as HTMLElement
            if (link) link.click()
          }
        }).catch(() => {})

        await page.waitForTimeout(5000)
        await page.screenshot({ path: '/tmp/debug-resolvetoken-1-after-checkin.png', fullPage: false }).catch(() => {})

        // Extrair URL do BioFace do iframe
        const biofaceUrl = await page.evaluate(() => {
          const iframe = document.querySelector('iframe#iframeBioFacial') as HTMLIFrameElement
          return iframe?.src ?? null
        })

        if (!biofaceUrl || !biofaceUrl.includes('bioface')) {
          // Verificar se caiu na tela de token numerico apos clicar
          const newUrl = page.url()
          const newText = await page.evaluate(() => document.body?.innerText ?? '')
          if (newUrl.includes('MantemTokenDeAtendimento') || newText.includes('Selecione uma forma de envio')) {
            return { success: false, fallbackToToken: true, error: 'Biometria nao disponivel. Guia requer token numerico.' }
          }
          return { success: false, error: `URL BioFace nao encontrada. URL atual: ${newUrl.substring(0, 80)}` }
        }

        await onProgress?.("4/9", ` BioFace URL extraida: ${biofaceUrl.substring(0, 100)}`)

        // === STEP 3: Abrir BioFace em pagina separada (tecnica do workflow n8n) ===
        biofacePage = await context.newPage()
        biofacePage.setDefaultTimeout(30_000)

        await onProgress?.("5/9", ` Abrindo BioFace em pagina separada...`)
        await biofacePage.goto(biofaceUrl, { waitUntil: 'networkidle', timeout: 30_000 })
        await biofacePage.waitForTimeout(3000)
        await biofacePage.screenshot({ path: '/tmp/debug-resolvetoken-2-bioface-open.png', fullPage: false }).catch(() => {})

        // === STEP 4: Clicar "Capturar Foto" via mouse.click com boundingBox ===
        await onProgress?.("6/9", ` STEP 6 — clicando Capturar Foto...`)
        const btnCapturar = await biofacePage.$('#id-botao-capturar')
        if (btnCapturar) {
          const box = await btnCapturar.boundingBox()
          if (box) {
            await biofacePage.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
            await onProgress?.("6/9", ` Capturar Foto clicado via mouse.click`)
          }
        } else {
          // Fallback: clicar por texto
          await biofacePage.evaluate(() => {
            const els = Array.from(document.querySelectorAll('button, a, div, span'))
            const btn = els.find((e) => /capturar|iniciar captura/i.test((e as HTMLElement).textContent ?? ''))
            if (btn) (btn as HTMLElement).click()
          })
        }
        await biofacePage.waitForTimeout(2000)
        await biofacePage.screenshot({ path: '/tmp/debug-resolvetoken-3-after-capture.png', fullPage: false }).catch(() => {})

        // === STEP 5: Injetar foto no DOM (tecnica exata do workflow n8n) ===
        await onProgress?.("7/9", ` STEP 7 — injetando foto...`)
        const injected = await biofacePage.evaluate((b64: string) => {
          const results = document.getElementById('results')
          if (results) {
            results.innerHTML = '<img id="id-imagem-resultado" width="565px" height="317px" src="data:image/jpeg;base64,' + b64 + '"/>'
            return { success: true }
          }
          return { success: false, error: 'Container #results nao encontrado' }
        }, photoBase64)

        if (!injected.success) {
          return { success: false, error: (injected as { error?: string }).error ?? 'Falha ao injetar foto' }
        }

        await biofacePage.waitForTimeout(1000)
        await biofacePage.screenshot({ path: '/tmp/debug-resolvetoken-4-after-inject.png', fullPage: false }).catch(() => {})
        await onProgress?.("7/9", ` Foto injetada com sucesso`)

        // === STEP 6: Mostrar e clicar "Autenticar Foto" via mouse.down/up ===
        await onProgress?.("8/9", ` STEP 8 — clicando Autenticar...`)

        // Force display do botao
        await biofacePage.evaluate(() => {
          const btn = document.getElementById('id-botao-autenticar')
          if (btn) {
            btn.style.display = 'inline-block'
            btn.style.visibility = 'visible'
            btn.style.opacity = '1'
          }
        })
        await biofacePage.waitForTimeout(500)

        const btnAutenticar = await biofacePage.$('#id-botao-autenticar')
        let authClicked = false

        if (btnAutenticar) {
          const box = await btnAutenticar.boundingBox()
          if (box) {
            await biofacePage.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
            await biofacePage.waitForTimeout(200)
            await biofacePage.mouse.down()
            await biofacePage.waitForTimeout(100)
            await biofacePage.mouse.up()
            authClicked = true
            await onProgress?.("8/9", ` Autenticar clicado via mouse.down/up`)
          }
        }

        // Fallback: clicar qualquer botao confirmar/autenticar
        if (!authClicked) {
          authClicked = await biofacePage.evaluate(() => {
            const els = Array.from(document.querySelectorAll('button, a, input[type="button"], div[onclick]'))
            const btn = els.find((e) => {
              const t = ((e as HTMLElement).textContent ?? '').toLowerCase()
              return t.includes('autenticar') || t.includes('confirmar')
            })
            if (btn) { (btn as HTMLElement).click(); return true }
            return false
          })
        }

        if (!authClicked) {
          await biofacePage.screenshot({ path: '/tmp/debug-resolvetoken-5-no-auth.png', fullPage: false }).catch(() => {})
          return { success: false, error: 'Botao Autenticar/Confirmar nao encontrado no BioFace.' }
        }

        // === STEP 7: Aguardar TRIX processar (12s como no workflow) ===
        await onProgress?.("8/9", ` Aguardando TRIX processar (12s)...`)
        await biofacePage.waitForTimeout(12_000)
        await biofacePage.screenshot({ path: '/tmp/debug-resolvetoken-5-after-auth.png', fullPage: false }).catch(() => {})

        // Fechar pagina BioFace
        await biofacePage.close().catch(() => {})
        biofacePage = null

        // === STEP 8: Validar resultado no SAW (navegar de volta a guia) ===
        await onProgress?.("9/9", ` Validando resultado no SAW...`)
        await page.goto(guiaUrl, { waitUntil: 'networkidle', timeout: 30_000 })
        await page.waitForTimeout(3000)
        await page.screenshot({ path: '/tmp/debug-resolvetoken-6-validation.png', fullPage: false }).catch(() => {})

        const validacao = await page.evaluate(() => {
          const icone = document.querySelector('img[src*="biometriaAutenticadaface"]') as HTMLElement | null
          const btnCheckin = document.querySelector('#linkCheckInPacienteBiometriaFacial a') as HTMLElement | null
          const iconeVisivel = icone ? icone.offsetParent !== null : false
          const btnVisivel = btnCheckin ? btnCheckin.offsetParent !== null : false
          return { iconeVisivel, btnVisivel, texto: document.body?.innerText?.substring(0, 300) ?? '' }
        })

        sawLog(`resolveToken: validacao — icone=${validacao.iconeVisivel}, btnCheckin=${validacao.btnVisivel}`)

        if (validacao.iconeVisivel && !validacao.btnVisivel) {
          await onProgress?.("9/9", ` SUCESSO — biometria confirmada no SAW!`)
          return { success: true }
        }

        // Verificar se caiu na tela de token (fallback do SAW apos falha biometrica)
        if (page.url().includes('MantemTokenDeAtendimento') || validacao.texto.includes('Selecione uma forma de envio')) {
          sawLog(`resolveToken: biometria falhou, SAW ofereceu token numerico como fallback`)
          return { success: false, fallbackToToken: true, error: 'Biometria nao aceita pelo TRIX. Use token numerico.' }
        }

        // Se botao check-in ainda visivel, biometria nao confirmou
        if (validacao.btnVisivel) {
          return { success: false, error: 'Biometria processada mas nao confirmada no SAW. Tente novamente com outra foto.' }
        }

        // Inconclusivo — assumir sucesso
        sawLog(`resolveToken: resultado inconclusivo, assumindo sucesso`)
        return { success: true }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Erro ao resolver token no SAW',
        }
      } finally {
        if (biofacePage) await biofacePage.close().catch(() => {})
        if (page) await page.close().catch(() => {})
      }
    })
  }

  // ─── Executar procedimentos (cobrar atendimentos no SAW) ─────
  async executarProcedimentos(
    userId: string,
    cookies: SawCookie[],
    numeroGuia: string,
    photoBase64: string,
    procedimentos: Array<{
      data: string       // DDMMYYYY
      horaInicial: string // HHMM
      horaFinal: string  // HHMM
      quantidade: string
      viaAcesso: string
      tecnica: string
      redAcresc: string
    }>,
    onProgress?: (step: string, msg: string) => void | Promise<void>,
  ): Promise<{
    success: boolean
    totalExecutado: number
    totalEsperado: number
    execucoes: Array<{ data: string; success: boolean; error?: string }>
    error?: string
  }> {
    return this.withLock(userId, async () => {
      let page: Page | null = null
      const execucoes: Array<{ data: string; success: boolean; error?: string }> = []
      let totalExecutado = 0

      try {
        const context = await this.getContext(userId, cookies)
        page = await context.newPage()
        page.setDefaultTimeout(30_000)

        // Auto-accept dialogs
        page.on('dialog', async (dialog) => {
          sawLog(`cobrar: dialog: ${dialog.message().substring(0, 80)}`)
          await dialog.accept()
        })

        const guiaUrl = `${SAW_BASE}/saw/tiss/SolicitacaoDeSPSADT40.do?method=consultarGuiaDeSPSADT&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.numeroDaGuia=${encodeURIComponent(numeroGuia)}&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.isConsultaNaGuia=true`

        await onProgress?.('1', `Navegando para guia ${numeroGuia}...`)
        await page.goto(guiaUrl, { waitUntil: 'networkidle', timeout: 30_000 })
        await page.waitForTimeout(2000)

        // Verificar sessao
        const hasLogin = await page.evaluate(() => {
          const u = document.querySelector('input[id="login"]')
          const p = document.querySelector('input[type="password"]')
          return !!(u && p)
        }).catch(() => false)

        if (hasLogin) {
          return { success: false, totalExecutado: 0, totalEsperado: procedimentos.length, execucoes, error: 'Sessao SAW expirou.' }
        }

        await onProgress?.('1', `Guia aberta. ${procedimentos.length} procedimento(s) para cobrar.`)
        await page.screenshot({ path: '/tmp/debug-cobrar-0-guia.png', fullPage: false }).catch(() => {})

        for (let i = 0; i < procedimentos.length; i++) {
          const proc = procedimentos[i]
          const stepLabel = `${i + 1}/${procedimentos.length}`
          await onProgress?.(stepLabel, `Procedimento ${proc.data} — clicando "Realizar"...`)

          try {
            // Step A: Clicar PRIMEIRO botao "Realizar" disponivel na lista de procedimentos
            // Apos cada cobranca a pagina recarrega e o proximo pendente vira o primeiro
            const realizarBtns = await page.$$('img[title*="Realizar"]')
            // O [0] pode ser icone do header — pegar o primeiro da area de procedimentos
            // Tentar clicar no primeiro que esta dentro da tabela de procedimentos
            let btnToClick = realizarBtns.length >= 2 ? realizarBtns[1] : realizarBtns[0]
            // Se so tem 1 botao, usar ele
            if (!btnToClick || realizarBtns.length === 0) {
              await onProgress?.(stepLabel, `Botao "Realizar" nao disponivel — pode ja estar realizado.`)
              execucoes.push({ data: proc.data, success: false, error: 'Botao Realizar nao encontrado' })
              break
            }

            await btnToClick.click()
            await page.waitForTimeout(3000)
            await page.screenshot({ path: `/tmp/debug-cobrar-${i + 1}-apos-realizar.png`, fullPage: false }).catch(() => {})

            // Step B: Autenticar biometria no iframe BioFace
            await onProgress?.(stepLabel, `Autenticando biometria...`)

            const bioFrameHandle = await page.$('iframe#iframeBioFacial, iframe[src*="bioface"]')
            const bioFrame = bioFrameHandle ? await bioFrameHandle.contentFrame() : null

            if (bioFrame) {
              // Injetar foto
              await bioFrame.evaluate((b64: string) => {
                const results = document.getElementById('results')
                if (results) {
                  results.innerHTML = '<img id="id-imagem-resultado" width="565px" height="317px" src="data:image/jpeg;base64,' + b64 + '"/>'
                }
                const btn = document.getElementById('id-botao-autenticar')
                if (btn) {
                  btn.style.display = 'inline-block'
                  btn.style.visibility = 'visible'
                }
              }, photoBase64)

              await page.waitForTimeout(1000)

              // Clicar autenticar
              await bioFrame.evaluate(() => {
                const btn = document.getElementById('id-botao-autenticar')
                if (btn) btn.click()
                // Fallback: funcao aut() se existir
                if (typeof (window as unknown as Record<string, unknown>).aut === 'function') {
                  ((window as unknown as Record<string, unknown>).aut as () => void)()
                }
              })

              // Aguardar SAW processar biometria e abrir form
              await page.waitForTimeout(3000)
            } else {
              await onProgress?.(stepLabel, `Iframe BioFace nao encontrado. Tentando continuar...`)
            }

            // Step C: Aguardar formulario (nova pagina/popup) — polling tolerante
            await onProgress?.(stepLabel, `Aguardando formulario de realizacao...`)

            let formPage: Page | null = null
            const waitDeadline = Date.now() + 12_000
            let lastProgressAt = Date.now()

            while (Date.now() < waitDeadline) {
              for (const p of context.pages()) {
                const pUrl = p.url()
                if (pUrl.includes('abrirTelaDeRealizarProcedimento') || pUrl.includes('RealizarProcedimento')) {
                  formPage = p
                  break
                }
              }

              if (!formPage) {
                const hasForm = await page.evaluate(() => !!document.getElementById('dataSolicitacaoProcedimento')).catch(() => false)
                if (hasForm) formPage = page
              }

              if (formPage) break

              if (Date.now() - lastProgressAt >= 3000) {
                const elapsed = Math.round((Date.now() - (waitDeadline - 12_000)) / 1000)
                await onProgress?.(stepLabel, `Aguardando formulario... (${elapsed}s)`)
                lastProgressAt = Date.now()
              }
              await page.waitForTimeout(500)
            }

            if (!formPage) {
              await onProgress?.(stepLabel, `Formulario de realizacao nao abriu apos 12s.`)
              await page.screenshot({ path: `/tmp/debug-cobrar-${i + 1}-sem-form.png`, fullPage: true }).catch(() => {})
              execucoes.push({ data: proc.data, success: false, error: 'Formulario nao abriu' })
              await page.goto(guiaUrl, { waitUntil: 'networkidle', timeout: 30_000 }).catch(() => {})
              await page.waitForTimeout(2000)
              continue
            }

            // Step D: Preencher formulario
            await onProgress?.(stepLabel, `Preenchendo formulario...`)
            await formPage.screenshot({ path: `/tmp/debug-cobrar-${i + 1}-form.png`, fullPage: false }).catch(() => {})

            // Formatar valores
            const dataFormatada = `${proc.data.slice(0, 2)}/${proc.data.slice(2, 4)}/${proc.data.slice(4, 8)}`
            const horaIni = proc.horaInicial.length === 4 ? `${proc.horaInicial.slice(0, 2)}:${proc.horaInicial.slice(2, 4)}` : proc.horaInicial
            const horaFim = proc.horaFinal.length === 4 ? `${proc.horaFinal.slice(0, 2)}:${proc.horaFinal.slice(2, 4)}` : proc.horaFinal
            sawLog(`cobrar: proc.data="${proc.data}" → dataFormatada="${dataFormatada}" hora="${horaIni}-${horaFim}"`)

            // Setar data via jQuery datepicker API (setDate sincroniza estado interno + input)
            // Setar hora/quantidade via nativeInputValueSetter (contorna protecoes do input)
            await formPage.evaluate(`
              (function() {
                var day = ${parseInt(proc.data.slice(0, 2))};
                var month = ${parseInt(proc.data.slice(2, 4)) - 1};
                var year = ${parseInt(proc.data.slice(4, 8))};

                // DATA: usar jQuery datepicker setDate se disponivel
                var $ = window.jQuery || window.$;
                var dateEl = document.getElementById('dataSolicitacaoProcedimento');
                if ($ && dateEl) {
                  try {
                    var dp = $(dateEl);
                    if (dp.datepicker) {
                      dp.datepicker('setDate', new Date(year, month, day));
                      dp.datepicker('hide');
                    }
                  } catch(e) {
                    // Fallback: setar direto
                    dateEl.value = '${dataFormatada}';
                  }
                } else if (dateEl) {
                  dateEl.value = '${dataFormatada}';
                }

                // HORA e QUANTIDADE: setar via nativeInputValueSetter (sem disparar blur/validacao)
                var nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
                function setNative(id, val) {
                  var el = document.getElementById(id);
                  if (el && nativeSetter) {
                    nativeSetter.call(el, val);
                    el.dispatchEvent(new Event('input', {bubbles:true}));
                  }
                }
                setNative('horarioInicial', '${horaIni}');
                setNative('horarioFinal', '${horaFim}');
                setNative('quantidadeSolicitada', '${proc.quantidade || '1'}');
              })()
            `)
            await formPage.waitForTimeout(300)

            // Verificar se a data foi realmente setada
            const dataNoInput = await formPage.evaluate(`document.getElementById('dataSolicitacaoProcedimento')?.value || ''`)
            sawLog(`cobrar: valor no input apos setar: "${dataNoInput}"`)

            // Selects
            await formPage.selectOption('#viaDeAcesso', proc.viaAcesso || '1').catch(() => {})
            await formPage.evaluate((tecVal) => {
              const sel = document.querySelector('select[name*="tecnicaUtilizada"]') as HTMLSelectElement
              if (sel) { sel.value = tecVal; sel.dispatchEvent(new Event('change', { bubbles: true })) }
            }, proc.tecnica || '1').catch(() => {})
            await formPage.selectOption('#porcentagemReducaoAcrescimo', proc.redAcresc || '1.0').catch(() => {})

            await formPage.screenshot({ path: `/tmp/debug-cobrar-${i + 1}-form-filled.png`, fullPage: false }).catch(() => {})

            // Step E: Executar servico
            await onProgress?.(stepLabel, `Executando servico...`)
            await formPage.evaluate(() => {
              if (typeof (window as unknown as Record<string, unknown>).executarServico === 'function') {
                ((window as unknown as Record<string, unknown>).executarServico as () => void)()
              }
            })

            await page.waitForTimeout(2000)

            // Step F: Recarregar pagina principal
            await onProgress?.(stepLabel, `Procedimento executado! Recarregando...`)
            await page.reload({ waitUntil: 'networkidle' }).catch(() => {})
            await page.waitForTimeout(1000)

            // Fechar popup se abriu
            if (formPage !== page) {
              await formPage.close().catch(() => {})
            }

            execucoes.push({ data: proc.data, success: true })
            totalExecutado++
            await onProgress?.(stepLabel, `Procedimento ${proc.data} cobrado com sucesso!`)

          } catch (procErr) {
            const msg = procErr instanceof Error ? procErr.message : 'Erro desconhecido'
            await onProgress?.(stepLabel, `Erro no procedimento ${proc.data}: ${msg}`)
            execucoes.push({ data: proc.data, success: false, error: msg })

            // Tentar voltar para a guia para continuar com o proximo
            try {
              await page.goto(guiaUrl, { waitUntil: 'networkidle', timeout: 30_000 })
              await page.waitForTimeout(2000)
            } catch { /* */ }
          }
        }

        await page.screenshot({ path: '/tmp/debug-cobrar-final.png', fullPage: false }).catch(() => {})

        return {
          success: totalExecutado > 0,
          totalExecutado,
          totalEsperado: procedimentos.length,
          execucoes,
        }
      } catch (err) {
        return {
          success: false,
          totalExecutado,
          totalEsperado: procedimentos.length,
          execucoes,
          error: err instanceof Error ? err.message : 'Erro ao executar procedimentos',
        }
      } finally {
        if (page) await page.close().catch(() => {})
      }
    })
  }

  // ─── Excluir execucoes (cobrancas) ───────────────────────────
  /**
   * Exclui execucoes/cobrancas no SAW.
   *
   * modo='all':       1 chamada a removerProcedimentosExecutados() (remove todos)
   * modo='individual': loop chamando excluirProcedimentoRealizado(execucaoId) um a um
   *
   * Lida com SweetAlert2 confirm (DOM .swal2-confirm) + native dialog.
   */
  async excluirExecucoes(
    userId: string,
    cookies: SawCookie[],
    numeroGuia: string,
    modo: 'all' | 'individual',
    execucaoIds: number[] | undefined,
    onProgress?: (step: string, msg: string) => void | Promise<void>,
  ): Promise<{
    success: boolean
    totalExcluido: number
    totalEsperado: number
    resultados: Array<{ execucaoId: number | 'all'; success: boolean; error?: string }>
    error?: string
  }> {
    return this.withLock(userId, async () => {
      let page: Page | null = null
      const resultados: Array<{ execucaoId: number | 'all'; success: boolean; error?: string }> = []
      let totalExcluido = 0
      const ids = modo === 'individual' ? (execucaoIds ?? []) : []
      const totalEsperado = modo === 'all' ? 1 : ids.length

      try {
        const context = await this.getContext(userId, cookies)
        page = await context.newPage()
        page.setDefaultTimeout(30_000)

        // Auto-accept native dialogs (confirm/alert)
        page.on('dialog', async (dialog) => {
          sawLog(`excluir: dialog native: ${dialog.message().substring(0, 80)}`)
          await dialog.accept().catch(() => {})
        })

        const guiaUrl = `${SAW_BASE}/saw/tiss/SolicitacaoDeSPSADT40.do?method=consultarGuiaDeSPSADT&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.numeroDaGuia=${encodeURIComponent(numeroGuia)}&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.isConsultaNaGuia=true`

        await onProgress?.('1', `Navegando para guia ${numeroGuia}...`)
        await page.goto(guiaUrl, { waitUntil: 'networkidle', timeout: 30_000 })
        await page.waitForTimeout(1500)

        // Verificar sessao
        const hasLogin = await page.evaluate(() => {
          const u = document.querySelector('input[id="login"]')
          const p = document.querySelector('input[type="password"]')
          return !!(u && p)
        }).catch(() => false)

        if (hasLogin) {
          return { success: false, totalExcluido: 0, totalEsperado, resultados, error: 'Sessao SAW expirou.' }
        }

        /**
         * Aguarda e confirma um SweetAlert2 confirm se aparecer.
         * Retorna true se clicou em confirm, false se nao apareceu.
         */
        const confirmSweetAlertIfPresent = async (p: Page, timeoutMs = 4000): Promise<boolean> => {
          try {
            const confirmBtn = await p.waitForSelector('button.swal2-confirm:not([disabled])', { timeout: timeoutMs, state: 'visible' })
            if (confirmBtn) {
              await confirmBtn.click()
              sawLog(`excluir: swal2-confirm clicado`)
              await p.waitForTimeout(500)
              // Alguns fluxos disparam um segundo swal (sucesso) — confirmar tambem
              try {
                const secondBtn = await p.waitForSelector('button.swal2-confirm:not([disabled])', { timeout: 2000, state: 'visible' })
                if (secondBtn) {
                  await secondBtn.click()
                  sawLog(`excluir: swal2-confirm (sucesso) clicado`)
                }
              } catch { /* nao tem segundo */ }
              return true
            }
          } catch { /* swal nao apareceu — provavelmente usou native dialog, ja tratado */ }
          return false
        }

        if (modo === 'all') {
          await onProgress?.('1', `Removendo todas as execucoes...`)
          try {
            await page.evaluate(() => {
              const fn = (window as unknown as Record<string, unknown>).removerProcedimentosExecutados
              if (typeof fn === 'function') {
                (fn as () => void)()
              } else {
                // Fallback: clicar no link
                const link = document.querySelector('#linkRemoverExecucao a') as HTMLAnchorElement | null
                if (link) link.click()
              }
            })

            await confirmSweetAlertIfPresent(page, 5000)
            await page.waitForTimeout(2500)
            await page.reload({ waitUntil: 'networkidle' }).catch(() => {})
            await page.waitForTimeout(1000)

            totalExcluido = 1
            resultados.push({ execucaoId: 'all', success: true })
            await onProgress?.('1', `Todas as execucoes removidas!`)
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erro desconhecido'
            await onProgress?.('1', `Erro ao remover todas: ${msg}`)
            resultados.push({ execucaoId: 'all', success: false, error: msg })
          }
        } else {
          // modo individual
          for (let i = 0; i < ids.length; i++) {
            const execId = ids[i]
            const stepLabel = `${i + 1}/${ids.length}`
            await onProgress?.(stepLabel, `Excluindo execucao ${execId}...`)

            try {
              const existsBefore = await page.evaluate((id: number) => {
                const html = document.body?.innerHTML ?? ''
                return html.includes(`excluirProcedimentoRealizado(${id})`)
              }, execId)

              if (!existsBefore) {
                await onProgress?.(stepLabel, `Execucao ${execId} nao encontrada na pagina (ja removida?).`)
                resultados.push({ execucaoId: execId, success: false, error: 'Nao encontrada no DOM' })
                continue
              }

              await page.evaluate((id: number) => {
                const fn = (window as unknown as Record<string, unknown>).excluirProcedimentoRealizado
                if (typeof fn === 'function') {
                  (fn as (x: number) => void)(id)
                }
              }, execId)

              await confirmSweetAlertIfPresent(page, 5000)
              await page.waitForTimeout(2000)
              await page.reload({ waitUntil: 'networkidle' }).catch(() => {})
              await page.waitForTimeout(800)

              // Verificar se o id saiu do DOM
              const stillExists = await page.evaluate((id: number) => {
                const html = document.body?.innerHTML ?? ''
                return html.includes(`excluirProcedimentoRealizado(${id})`)
              }, execId)

              if (stillExists) {
                await onProgress?.(stepLabel, `Execucao ${execId} ainda presente apos exclusao.`)
                resultados.push({ execucaoId: execId, success: false, error: 'Ainda presente no DOM' })
              } else {
                totalExcluido++
                resultados.push({ execucaoId: execId, success: true })
                await onProgress?.(stepLabel, `Execucao ${execId} removida!`)
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Erro desconhecido'
              await onProgress?.(stepLabel, `Erro ao excluir ${execId}: ${msg}`)
              resultados.push({ execucaoId: execId, success: false, error: msg })

              // Tentar voltar para a guia para continuar
              try {
                await page.goto(guiaUrl, { waitUntil: 'networkidle', timeout: 30_000 })
                await page.waitForTimeout(1500)
              } catch { /* */ }
            }
          }
        }

        return {
          success: totalExcluido > 0,
          totalExcluido,
          totalEsperado,
          resultados,
        }
      } catch (err) {
        return {
          success: false,
          totalExcluido,
          totalEsperado,
          resultados,
          error: err instanceof Error ? err.message : 'Erro ao excluir execucoes',
        }
      } finally {
        if (page) await page.close().catch(() => {})
      }
    })
  }

  // ─── Interactive token resolution (WhatsApp flow) ────────────
  /**
   * Opens the token page on SAW, extracts available methods/phones,
   * selects the chosen method, and returns a session ID.
   * The page stays open waiting for the token to be submitted via submitToken().
   */
  async openTokenPage(
    userId: string,
    cookies: SawCookie[],
    numeroGuia: string,
    dataNascimento?: string, // YYYY-MM-DD para calcular idade
  ): Promise<{
    success: boolean
    sessionId?: string
    methods?: { aplicativo: boolean; email: boolean; sms: boolean }
    tokenAlreadyResolved?: boolean
    error?: string
  }> {
    const context = await this.getContext(userId, cookies)
    let page = await context.newPage()
    page.setDefaultTimeout(30_000)

    try {
      const guiaUrl = `${SAW_BASE}/saw/tiss/SolicitacaoDeSPSADT40.do?method=consultarGuiaDeSPSADT&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.numeroDaGuia=${encodeURIComponent(numeroGuia)}&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.isConsultaNaGuia=true`

      sawLog(`openTokenPage: navegando para guia ${numeroGuia}`)
      await page.goto(guiaUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      // Wait for page to settle (SAW may do JS redirects)
      await page.waitForTimeout(3000)

      // Check if session expired (redirected to login)
      const hasLoginInputs = await page.evaluate(() => {
        const u = document.querySelector('input[id="login"], input[name="login"]')
        const p = document.querySelector('input[type="password"]')
        return !!(u && p)
      }).catch(() => false)

      if (hasLoginInputs) {
        await page.close().catch(() => {})
        return { success: false, error: 'Sessao SAW expirou. Tente novamente.' }
      }

      // Verify we're on the token page or detected token indicators
      const currentUrl = page.url()
      const pageText = await page.evaluate(() => document.body?.innerText ?? '')

      sawLog(`openTokenPage: URL=${currentUrl.substring(0, 80)}, texto=${pageText.substring(0, 100)}`)

      const isTokenMethodPage = currentUrl.includes('MantemTokenDeAtendimento') ||
        currentUrl.includes('TokenDeAtendimento') ||
        pageText.includes('informe um token para continuar o atendimento') ||
        pageText.includes('Selecione uma forma de envio')

      const isGuiaPage = pageText.includes('GUIA DE SERVI') || pageText.includes('SP/SADT') || pageText.includes('guia no prestador')

      if (isGuiaPage) {
        // Guia abriu normalmente — verificar icones
        const icons = await page.evaluate(() => {
          const text = document.body?.innerText ?? ''
          const hasTokenValidado = /Token\s*Atendimento/i.test(text)
          const hasCheckIn = /Check-?in/i.test(text)
          const hasCheckInMsg = text.includes('Realize o check-in do Paciente')
          return { hasTokenValidado, hasCheckIn, hasCheckInMsg }
        }).catch(() => ({ hasTokenValidado: false, hasCheckIn: false, hasCheckInMsg: false }))

        sawLog(`openTokenPage: guia aberta — tokenValidado=${icons.hasTokenValidado}, checkIn=${icons.hasCheckIn}`)

        if (icons.hasTokenValidado && !icons.hasCheckIn && !icons.hasCheckInMsg) {
          await page.close().catch(() => {})
          return {
            success: true,
            sessionId: undefined,
            methods: undefined,
            tokenAlreadyResolved: true,
          }
        }

        if (icons.hasCheckIn || icons.hasCheckInMsg) {
          // ─── Check-in via gravarDadosGuiaBiometriaFacial() ───
          sawLog(`openTokenPage: chamando gravarDadosGuiaBiometriaFacial()...`)
          await page.evaluate(() => {
            if (typeof (window as unknown as Record<string, unknown>).gravarDadosGuiaBiometriaFacial === 'function') {
              ((window as unknown as Record<string, unknown>).gravarDadosGuiaBiometriaFacial as () => void)()
            }
          })

          // Esperar iframe BioFace receber src OU redirect para token page
          sawLog(`openTokenPage: aguardando BioFace iframe ou redirect...`)
          let bioFaceUrl = ''
          for (let attempt = 0; attempt < 15; attempt++) {
            await page.waitForTimeout(2000)
            // Verificar se iframe BioFace recebeu src
            bioFaceUrl = await page.evaluate(() => {
              const iframe = document.getElementById('iframeBioFacial') as HTMLIFrameElement
              return iframe?.src ?? ''
            })
            if (bioFaceUrl && bioFaceUrl.includes('bioface')) {
              sawLog(`openTokenPage: BioFace URL obtida (attempt ${attempt + 1}): ${bioFaceUrl.substring(0, 100)}`)
              break
            }
            // Verificar se foi direto para token page (guia sem BioFace)
            if (page.url().includes('MantemTokenDeAtendimento')) {
              sawLog(`openTokenPage: check-in redirecionou direto para token page`)
              break
            }
          }

          if (bioFaceUrl && bioFaceUrl.includes('bioface')) {
            // ═══ FLUXO A: BioFace — abrir em pagina separada, pular, confirmar ═══
            sawLog(`openTokenPage: ROTA BioFace`)
            let age = 99 // default = adulto = Recusou
            if (dataNascimento && dataNascimento !== '0000-00-00') {
              const born = new Date(dataNascimento + 'T12:00:00Z')
              const today = new Date()
              age = today.getFullYear() - born.getFullYear()
              if (today.getMonth() < born.getMonth() || (today.getMonth() === born.getMonth() && today.getDate() < born.getDate())) age--
            }
            sawLog(`openTokenPage: dataNascimento=${dataNascimento}, idade=${age}, justificativa=${age <= 14 ? 'TEA' : 'Recusou'}`)

            const bioPage = await context.newPage()
            bioPage.setDefaultTimeout(30_000)
            await bioPage.goto(bioFaceUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
            await bioPage.waitForTimeout(3000)

            // Pular captura
            sawLog(`openTokenPage: [A1] pular(false)...`)
            await bioPage.evaluate(() => {
              if (typeof (window as unknown as Record<string, unknown>).pular === 'function') {
                ((window as unknown as Record<string, unknown>).pular as (v: boolean) => void)(false)
              } else {
                const btn = document.getElementById('id-botao-atendimento-sem-captura') as HTMLElement
                if (btn) btn.click()
              }
            })
            await bioPage.waitForTimeout(2000)

            // Selecionar justificativa: TEA se <= 14 anos, senao Recusou
            const selectValue = age <= 14 ? '2' : '5'
            sawLog(`openTokenPage: [A2] justificativa=${selectValue === '2' ? 'TEA' : 'Recusou'}...`)
            await bioPage.evaluate((val) => {
              const sel = document.getElementById('idSelectMotivo') as HTMLSelectElement
              if (sel) {
                sel.value = val
                sel.dispatchEvent(new Event('change', { bubbles: true }))
                if (typeof (window as unknown as Record<string, unknown>).carregarDivSubMotivo === 'function') {
                  ((window as unknown as Record<string, unknown>).carregarDivSubMotivo as () => void)()
                }
              }
              const btn = document.getElementById('id-botao-confirmar-pular') as HTMLButtonElement
              if (btn) btn.disabled = false
            }, selectValue)
            await bioPage.waitForTimeout(1000)

            // Confirmar
            sawLog(`openTokenPage: [A3] confirmPular()...`)
            await bioPage.evaluate(() => {
              if (typeof (window as unknown as Record<string, unknown>).confirmPular === 'function') {
                ((window as unknown as Record<string, unknown>).confirmPular as () => void)()
              } else {
                const btn = document.getElementById('id-botao-confirmar-pular') as HTMLElement
                if (btn) btn.click()
              }
            })
            await bioPage.waitForTimeout(3000)
            await bioPage.close().catch(() => {})

            // Fechar pagina da guia e reabrir (SAW nao redireciona automaticamente)
            sawLog(`openTokenPage: [A4] Reabrindo guia apos BioFace...`)
            await page.close().catch(() => {})
             
            page = await context.newPage()
            page.setDefaultTimeout(30_000)
            await page.goto(guiaUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
            await page.waitForTimeout(3000)
            sawLog(`openTokenPage: URL apos reabrir: ${page.url().substring(0, 80)}`)
          } else if (!page.url().includes('MantemTokenDeAtendimento')) {
            sawLog(`openTokenPage: check-in nao gerou BioFace nem token page`)
            await page.close().catch(() => {})
            return { success: false, error: 'Check-in realizado mas SAW nao redirecionou. Tente novamente.' }
          }
        } else {
          await page.close().catch(() => {})
          return { success: false, error: 'Guia abriu sem Check-in ou Token. Reimporte a guia.' }
        }
      } else if (!isTokenMethodPage) {
        await page.close().catch(() => {})
        return { success: false, error: `Pagina inesperada: ${currentUrl.substring(0, 100)}` }
      }
      // ═══ CAMINHO B: Token direto (ou apos Check-in + BioFace) ═══

      // Atualizar texto (pode ter mudado)
      const finalPageText = await page.evaluate(() => document.body?.innerText ?? '')

      // Extract available methods
      const textForMethods = finalPageText || pageText
      const hasAplicativo = /aplicativo/i.test(textForMethods)
      const hasEmail = /\bemail\b/i.test(textForMethods)
      const hasSms = /\bsms\b/i.test(textForMethods)

      const info = { hasAplicativo, hasEmail, hasSms }

      // Store page reference with a session ID
      const sessionId = `token-${userId}-${numeroGuia}-${Date.now()}`
      this.tokenPages.set(sessionId, { page, numeroGuia, createdAt: Date.now() })

      // Auto-cleanup after 10 minutes (token expires in 4:30 on SAW)
      setTimeout(() => {
        const entry = this.tokenPages.get(sessionId)
        if (entry) {
          entry.page.close().catch(() => {})
          this.tokenPages.delete(sessionId)
          sawLog(`openTokenPage: session ${sessionId} expired and cleaned up`)
        }
      }, 10 * 60 * 1000)

      sawLog(`openTokenPage: token page open for guia ${numeroGuia} (session=${sessionId}, methods: app=${info.hasAplicativo} email=${info.hasEmail} sms=${info.hasSms})`)

      return {
        success: true,
        sessionId,
        methods: {
          aplicativo: info.hasAplicativo,
          email: info.hasEmail,
          sms: info.hasSms,
        },
      }
    } catch (err) {
      await page.close().catch(() => {})
      return { success: false, error: err instanceof Error ? err.message : 'Erro ao abrir pagina de token' }
    }
  }

  /**
   * Select a method (aplicativo or SMS) on an already-open token page.
   * For SMS: selects phone and clicks "Enviar".
   */
  async selectTokenMethod(
    sessionId: string,
    method: 'aplicativo' | 'sms',
    phone?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const entry = this.tokenPages.get(sessionId)
    if (!entry) return { success: false, error: 'Sessao de token nao encontrada ou expirada' }

    const { page } = entry

    try {
      if (method === 'aplicativo') {
        // Click the Aplicativo radio button
        await page.evaluate(() => {
          const radios = document.querySelectorAll('input[type="radio"]')
          for (const radio of radios) {
            const parent = radio.closest('td, div, label')
            if (parent && /aplicativo/i.test(parent.textContent ?? '')) {
              (radio as HTMLInputElement).click()
              break
            }
          }
        })
        await page.waitForTimeout(1000)
        sawLog(`selectTokenMethod: selected Aplicativo`)
      } else if (method === 'sms') {
        // 1. Clicar radio SMS
        await page.evaluate(() => {
          const radios = document.querySelectorAll('input[type="radio"]')
          for (const radio of radios) {
            const parent = radio.closest('td, div, label')
            if (parent && /sms/i.test(parent.textContent ?? '')) {
              (radio as HTMLInputElement).click()
              break
            }
          }
        })
        await page.waitForTimeout(1500)

        // 2. Selecionar telefone no select do SAW (usando value = numero real)
        if (phone) {
          sawLog(`selectTokenMethod: selecionando telefone ${phone} no SAW`)
          await page.evaluate((phoneValue: string) => {
            // getElementById funciona com dots no ID (querySelector falha)
            const sel = document.getElementById('tokenDeAtendimento.telefoneDeEnvio.numero') as HTMLSelectElement
              ?? document.querySelector('select[name*="telefoneDeEnvio"]') as HTMLSelectElement
            if (sel) {
              // Tentar por value exato
              for (let i = 0; i < sel.options.length; i++) {
                if (sel.options[i].value === phoneValue || sel.options[i].value.includes(phoneValue)) {
                  sel.selectedIndex = i
                  sel.dispatchEvent(new Event('change', { bubbles: true }))
                  break
                }
              }
            }
          }, phone)
          await page.waitForTimeout(500)
        }

        // 3. Clicar botao "Enviar" do SAW (#botaoSMS ou enviarTokenDeAtendimento())
        sawLog(`selectTokenMethod: clicando Enviar SMS no SAW`)
        await page.evaluate(() => {
          const btn = document.getElementById('botaoSMS') as HTMLElement
          if (btn) { btn.click(); return }
          // Fallback: chamar funcao JS
          if (typeof (window as unknown as Record<string, unknown>).enviarTokenDeAtendimento === 'function') {
            ((window as unknown as Record<string, unknown>).enviarTokenDeAtendimento as () => void)()
            return
          }
          // Fallback: qualquer botao Enviar
          const btns = Array.from(document.querySelectorAll('button'))
          const enviar = btns.find((b) => /enviar/i.test(b.textContent ?? ''))
          if (enviar) enviar.click()
        })
        await page.waitForTimeout(3000)

        // 4. Verificar se SMS foi enviado
        const pageText = await page.evaluate(() => document.body?.innerText ?? '')
        if (pageText.includes('Token de Atendimento enviado com sucesso')) {
          sawLog(`selectTokenMethod: SMS enviado com sucesso pelo SAW`)
        } else {
          sawLog(`selectTokenMethod: resposta SAW: ${pageText.substring(0, 200)}`)
        }
      }

      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Erro ao selecionar metodo' }
    }
  }

  /**
   * Submit a 6-digit token on an already-open token page.
   * Fills the 6 input fields and clicks "Validar".
   */
  async submitToken(
    sessionId: string,
    token: string,
  ): Promise<{ success: boolean; error?: string }> {
    const entry = this.tokenPages.get(sessionId)
    if (!entry) {
      return { success: false, error: 'Sessao do SAW expirou. O operador precisa reiniciar o processo de token.' }
    }

    const { page, numeroGuia } = entry

    // Verify page is still alive
    try {
      await page.evaluate(() => true)
    } catch {
      this.tokenPages.delete(sessionId)
      return { success: false, error: 'A pagina do SAW foi fechada. O operador precisa reiniciar o processo.' }
    }

    const digits = token.replace(/\D/g, '')
    if (digits.length !== 6) {
      return { success: false, error: `Token deve ter 6 digitos. Recebido: "${token}". Envie apenas os 6 numeros.` }
    }

    try {
      sawLog(`submitToken: preenchendo token ${digits} na guia ${numeroGuia}`)

      // Debug: log what inputs exist on the page
      const debugInfo = await page.evaluate(() => {
        const allInputs = document.querySelectorAll('input')
        const info = Array.from(allInputs).map((inp) => ({
          type: inp.type,
          name: inp.name,
          id: inp.id,
          maxLength: inp.maxLength,
          size: inp.size,
          className: inp.className,
          value: inp.value,
        }))
        return { total: allInputs.length, inputs: info.slice(0, 20), bodyText: (document.body?.innerText ?? '').substring(0, 300) }
      }).catch(() => ({ total: 0, inputs: [], bodyText: 'evaluate failed' }))

      sawLog(`submitToken: DEBUG — ${debugInfo.total} inputs na pagina. Body: ${debugInfo.bodyText.substring(0, 150)}`)
      sawLog(`submitToken: DEBUG inputs: ${JSON.stringify(debugInfo.inputs.slice(0, 10))}`)

      // Fill the 6 input fields — try multiple strategies
      const filled = await page.evaluate((d: string) => {
        // Strategy 1: maxlength=1 inputs
        let inputs = Array.from(document.querySelectorAll('input[type="text"][maxlength="1"], input[type="tel"][maxlength="1"], input[size="1"]'))

        // Strategy 2: inputs inside token container
        if (inputs.length < 6) {
          const tokenContainer = document.querySelector('.token, [class*="token"], [id*="token"], [class*="codigo"]')
          if (tokenContainer) {
            inputs = Array.from(tokenContainer.querySelectorAll('input'))
          }
        }

        // Strategy 3: small text inputs (maxlength <= 2)
        if (inputs.length < 6) {
          inputs = Array.from(document.querySelectorAll('input[type="text"]')).filter((inp) => {
            const el = inp as HTMLInputElement
            return el.maxLength <= 2 && el.maxLength > 0
          })
        }

        // Strategy 4: all visible text inputs that are not hidden/large
        if (inputs.length < 6) {
          inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="tel"], input[type="number"]')).filter((inp) => {
            const el = inp as HTMLInputElement
            const style = window.getComputedStyle(el)
            const width = parseInt(style.width)
            return style.display !== 'none' && style.visibility !== 'hidden' && (width < 80 || el.maxLength <= 6)
          })
        }

        if (inputs.length < 6) {
          return { ok: false, count: inputs.length, strategy: 'none' }
        }

        for (let i = 0; i < 6; i++) {
          const inp = inputs[i] as HTMLInputElement
          inp.value = d[i]
          inp.dispatchEvent(new Event('input', { bubbles: true }))
          inp.dispatchEvent(new Event('change', { bubbles: true }))
          inp.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }))
        }

        return { ok: true, count: inputs.length }
      }, digits)

      if (!filled || !filled.ok) {
        // Nao fechar page — permitir retry
        return { success: false, error: 'Campos de token nao encontrados na pagina do SAW. Tente reiniciar o processo.' }
      }

      sawLog(`submitToken: preencheu ${filled.count} campos, clicando Validar`)
      await page.waitForTimeout(500)

      // Click "Validar"
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a'))
        const validar = btns.find((b) => /validar/i.test((b as HTMLElement).textContent ?? '') || /validar/i.test((b as HTMLInputElement).value ?? ''))
        if (validar) (validar as HTMLElement).click()
      })

      await page.waitForTimeout(5000)

      // Check result
      const result = await page.evaluate(() => {
        const body = document.body?.innerText ?? ''
        return {
          texto: body.substring(0, 500),
          sucesso: /sucesso|validado|autenticado|confirmado/i.test(body),
          erro: /erro|invalido|expirado|incorreto|falha/i.test(body),
          tokenExpirado: /expirado|solicitar novo/i.test(body),
        }
      })

      if (result.sucesso) {
        // Sucesso — cleanup
        this.tokenPages.delete(sessionId)
        await page.close().catch(() => {})
        sawLog(`submitToken: token validado com sucesso para guia ${numeroGuia}`)
        return { success: true }
      }

      if (result.tokenExpirado) {
        // Token expirou — manter page aberta para novo token
        return { success: false, error: 'Token expirado no SAW. Solicite um novo token e envie novamente.' }
      }

      if (result.erro) {
        // Token incorreto — manter page aberta para retry
        return { success: false, error: 'Token incorreto. Verifique o numero e tente novamente.' }
      }

      // Sem mensagem clara do SAW — pode ter dado certo ou nao
      // Cleanup e considerar sucesso (SAW nem sempre mostra mensagem)
      this.tokenPages.delete(sessionId)
      await page.close().catch(() => {})
      sawLog(`submitToken: resultado inconclusivo para guia ${numeroGuia}, assumindo sucesso`)
      return { success: true }
    } catch (err) {
      // Nao fechar page em caso de erro — pode ser transitorio
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      console.error(`[SAW] submitToken: erro para guia ${numeroGuia}: ${msg}`)
      return { success: false, error: `Erro ao validar token no SAW: ${msg}` }
    }
  }

  /**
   * Close a token session (cleanup).
   */
  /**
   * Extract phone numbers from an open token page (after SMS radio is selected).
   * Retries up to 3 times with 1s delay to handle slow SAW rendering.
   */
  /**
   * Get a token page session entry (for direct page access).
   */
  getTokenSession(sessionId: string): TokenPageEntry | undefined {
    return this.tokenPages.get(sessionId)
  }

  async getTokenPagePhones(sessionId: string): Promise<{ value: string; text: string }[]> {
    const entry = this.tokenPages.get(sessionId)
    if (!entry) return []

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const phonesJson = await entry.page.evaluate(() => {
          const sel = document.getElementById('tokenDeAtendimento.telefoneDeEnvio.numero') as HTMLSelectElement | null
          if (!sel) return '[]'
          const result: { value: string; text: string }[] = []
          for (const opt of sel.options) {
            const v = opt.value?.trim()
            const t = opt.text?.trim()
            if (v && v !== '' && !/escolha/i.test(t ?? '')) {
              result.push({ value: v, text: t ?? v })
            }
          }
          return JSON.stringify(result)
        }) as string

        let phones: { value: string; text: string }[] = []
        try { phones = JSON.parse(phonesJson || '[]') } catch { /* */ }

        if (phones.length > 0) {
          sawLog(`getTokenPagePhones: ${phones.length} telefone(s) — ${phones.map((p) => p.text).join(', ')} (attempt ${attempt + 1})`)
          return phones
        }
      } catch (err) {
        sawLog(`getTokenPagePhones: evaluate falhou (attempt ${attempt + 1}): ${err instanceof Error ? err.message : err}`)
      }

      await new Promise((r) => setTimeout(r, 1500))
    }

    sawLog(`getTokenPagePhones: nenhum telefone encontrado apos 3 tentativas`)
    return []
  }

  async closeTokenSession(sessionId: string): Promise<void> {
    const entry = this.tokenPages.get(sessionId)
    if (entry) {
      await entry.page.close().catch(() => {})
      this.tokenPages.delete(sessionId)
    }
  }

  // ─── Create guide (SP/SADT 4.0) ─────────────────────────────
  async createGuide(
    userId: string,
    cookies: SawCookie[],
    data: {
      carteira: string
      profissional: {
        nome: string
        conselho: string
        numeroConselho: string
        uf: string
        cbo: string
      }
      procedimentoCodigo: string
      quantidade: number
      indicacaoClinica?: string
    },
    onProgress?: (step: string, message: string) => void | Promise<void>,
  ): Promise<{ success: boolean; guideNumber?: string; paciente?: string; formData?: Record<string, unknown>; error?: string }> {
    return this.withLock(userId, async () => {
      let page: Page | null = null
      let nomeBeneficiario = ''

      try {
        const context = await this.getContext(userId, cookies)
        page = await context.newPage()
        page.setDefaultTimeout(30_000)

        sawLog(`createGuide: iniciando para carteira ${data.carteira}`)

        // ─── Step 1: Dialog handler ──────────────────────────────
        page.on('dialog', async (dialog) => {
          const msg = dialog.message()
          sawLog(`createGuide: dialog [${dialog.type()}]: ${msg.substring(0, 120)}`)
          if (/profissional.*n[aã]o encontrado/i.test(msg)) {
            sawLog('createGuide: dialog "Profissional nao encontrado" — aceitando')
          }
          await dialog.accept()
        })

        // ─── Step 2: Navigate to form ────────────────────────────
        await onProgress?.('1', 'Abrindo formulario de nova guia...')
        await page.goto(
          `${SAW_BASE}/saw/tiss/SolicitacaoDeSPSADT40.do?method=abrirTelaDeSolicitacaoDeSPSADT`,
          { waitUntil: 'networkidle', timeout: 60_000 },
        )

        // ─── Step 3: Wait for form ───────────────────────────────
        await page.waitForFunction(
          () => !!document.getElementById('tissSolicitacaoDeSPSADT40Form'),
          { timeout: 30_000 },
        )
        sawLog('createGuide: formulario carregado')

        // ─── Step 4: Fill unimed "0865" + carteira ────────────────
        await onProgress?.('2', `Preenchendo carteira ${data.carteira}...`)
        const unimedField = page.locator('input[name*="beneficiario.unimed.codigo"]').first()
        await unimedField.fill('0865')
        await unimedField.press('Tab')
        await page.waitForTimeout(1000)

        const cartField = page.locator('input[name*="beneficiario.codigo"]').first()
        await cartField.fill(data.carteira)
        await page.waitForTimeout(500)

        // ─── Step 5: CRITICAL HOOK — override presenca + trigger AJAX ────
        await page.evaluate(() => {
          ;(window as unknown as Record<string, unknown>).abrirProcessoBeneficiarioPresente = function () {
            ;(window as unknown as Record<string, unknown>).beneficiarioPresente = true
            const win = window as unknown as Record<string, unknown>
            if (typeof win.abrirTelaBiometria === 'function') {
              (win.abrirTelaBiometria as () => void)()
            }
          }
          ;(window as unknown as Record<string, unknown>).operadoraPossuiTamanhoCodigoBenefVariavel = true
          const acaoBtn = document.getElementById('acao')
          if (acaoBtn) acaoBtn.click()
        })
        sawLog('createGuide: AJAX disparado, aguardando 10s...')
        await onProgress?.('2', 'Consultando beneficiario no SAW (aguardando AJAX)...')
        await page.waitForTimeout(10_000)

        nomeBeneficiario = await page.evaluate(() => {
          return (
            (document.querySelector('input[name="manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.beneficiario.nome"]') as HTMLInputElement | null)?.value ||
            (document.querySelector('input[name*="beneficiario.nomeAbreviado"]') as HTMLInputElement | null)?.value ||
            ''
          )
        })
        sawLog(`createGuide: beneficiario="${nomeBeneficiario}"`)

        // ─── Step 6: Handle biometria modal ─────────────────────
        await onProgress?.('3', 'Processando biometria...')
        let hasBio = await page.evaluate(() => {
          const divs = document.querySelectorAll('div')
          for (const d of divs) {
            if (d.offsetHeight > 0 && /Pular Autentica/i.test(d.textContent ?? '')) return true
          }
          return false
        })

        if (!hasBio) {
          sawLog('createGuide: modal biometria nao visivel, forcando exibicao...')
          await page.evaluate(() => {
            const allDivs = document.querySelectorAll('div')
            for (const d of allDivs) {
              if (/Pular Autentica/i.test(d.innerHTML) && d.innerHTML.length < 5000) {
                ;(d as HTMLElement).style.display = 'block'
                ;(d as HTMLElement).style.visibility = 'visible'
                ;(d as HTMLElement).style.position = 'fixed'
                ;(d as HTMLElement).style.top = '50px'
                ;(d as HTMLElement).style.left = '50px'
                ;(d as HTMLElement).style.zIndex = '99999'
                return
              }
            }
            const motivo = document.getElementById('codigoDoMotivoDeUtilizacaoDaBiometria') as HTMLSelectElement | null
            if (motivo) motivo.value = '5'
            const win = window as unknown as Record<string, unknown>
            if (typeof win.pularBiometria === 'function') (win.pularBiometria as () => void)()
            if (typeof win.pularAutenticacao === 'function') (win.pularAutenticacao as () => void)()
          })
          await page.waitForTimeout(3000)
          hasBio = await page.evaluate(() => {
            const divs = document.querySelectorAll('div')
            for (const d of divs) {
              if (d.offsetHeight > 0 && /Pular Autentica/i.test(d.textContent ?? '')) return true
            }
            return false
          })
        }

        if (hasBio) {
          sawLog('createGuide: modal biometria visivel — selecionando Pre-autorizacao + Pular')
          await page.evaluate(() => {
            const selects = document.querySelectorAll('select')
            for (const sel of selects) {
              for (const opt of sel.options) {
                if (/pr[eé].?autoriz/i.test(opt.text)) {
                  sel.value = opt.value
                  sel.dispatchEvent(new Event('change', { bubbles: true }))
                  break
                }
              }
            }
          })
          await page.waitForTimeout(1000)
          await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, input[type="button"]'))
            const pularBtn = btns.find((b) => /pular/i.test((b as HTMLElement).textContent ?? (b as HTMLInputElement).value ?? ''))
            if (pularBtn) (pularBtn as HTMLElement).click()
          })
          await page.waitForTimeout(5000)
          sawLog('createGuide: biometria pulada OK')
        } else {
          sawLog('createGuide: modal nao apareceu — setando campos hidden diretamente')
          await page.evaluate(() => {
            const motivo = document.querySelector('input[name*="codigoDoMotivoDeUtilizacaoDaBiometria"]') as HTMLInputElement | null
            if (motivo) motivo.value = '5'
            const auth = document.querySelector('input[name*="biometriaBeneficiarioAutenticada"]') as HTMLInputElement | null
            if (auth) auth.value = 'true'
            const posterior = document.querySelector('input[name*="autenticacaoPosteriorViaTokenDeAtendimento"]') as HTMLInputElement | null
            if (posterior) posterior.value = 'true'
          })
          sawLog('createGuide: campos hidden setados')
        }

        // ─── Step 7: Fill carater = "1" (Eletiva) ───────────────
        await onProgress?.('4', 'Preenchendo dados clinicos...')
        await page.evaluate(() => {
          const s = document.querySelector('select[name*="caraterDeSolicitacao"]') as HTMLSelectElement | null
          if (s) { s.value = '1'; s.dispatchEvent(new Event('change', { bubbles: true })) }
        })

        // ─── Step 8: Fill executante = "97498504" ───────────────
        await page.evaluate(() => {
          const s = document.querySelector('select[name*="contratadoExecutante.codigo"]') as HTMLSelectElement | null
          if (s) { s.value = '97498504'; s.dispatchEvent(new Event('change', { bubbles: true })) }
        })
        await page.waitForTimeout(1000)

        // ─── Step 9: Fill procedimento (AFTER executante, field is readonly) ─────
        await onProgress?.('5', `Preenchendo procedimento ${data.procedimentoCodigo}...`)
        await page.evaluate(() => {
          const t = document.querySelector('select[name*="procedimentosSolicitados[0].tipoTabela"]') as HTMLSelectElement | null
          if (t) { t.value = '22'; t.dispatchEvent(new Event('change', { bubbles: true })) }
        })
        await page.waitForTimeout(500)

        await page.evaluate((codigo: string) => {
          const el = document.querySelector('input[name="procedimentosSolicitados[0].codigo"]') as HTMLInputElement | null
          if (el) {
            el.readOnly = false
            el.value = codigo
            el.readOnly = true
          }
          const win = window as unknown as Record<string, unknown>
          if (typeof win.capturarProcedimentoSolicitadoEValidar0 === 'function') {
            (win.capturarProcedimentoSolicitadoEValidar0 as () => void)()
          }
        }, data.procedimentoCodigo)
        await page.waitForTimeout(5000)

        await page.evaluate((qtd: number) => {
          const el = document.querySelector('input[name="procedimentosSolicitados[0].quantidade"]') as HTMLInputElement | null
          if (el) { el.value = String(qtd); el.dispatchEvent(new Event('change', { bubbles: true })) }
        }, data.quantidade)

        const procDesc = await page.evaluate(() => {
          return (document.querySelector('input[name*="procedimentosSolicitados[0].descricao"]') as HTMLInputElement | null)?.value ?? ''
        })
        sawLog(`createGuide: procedimento descricao="${procDesc}"`)

        // ─── Step 10: Fill tipo/regime (AFTER procedimento) ─────
        await onProgress?.('6', 'Preenchendo tipo/regime/indicacao...')
        await page.evaluate(() => {
          const set = (n: string, v: string) => {
            const s = document.querySelector(`select[name*="${n}"]`) as HTMLSelectElement | null
            if (s) { s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })) }
          }
          set('tipoDeAtendimento', '03')
          set('regimeDeAtendimento', '01')
          set('tipoDeConsulta', '2')
          // IMPORTANT: field name is indicacaoDeAcidente (NOT indicadorDeAcidente)
          set('indicacaoDeAcidente', '9')
        })

        // ─── Step 11: Fill indicacao clinica + data solicitacao ──
        // SAW exige minimo 2 palavras — usar fallback baseado no procedimento
        const indicacaoTexto = data.indicacaoClinica?.trim() || 'Tratamento clinico'
        await page.evaluate((indicacao: string) => {
          const el = document.querySelector('textarea[name*="indicacaoClinica"], input[name*="indicacaoClinica"]') as HTMLInputElement | HTMLTextAreaElement | null
          if (el) el.value = indicacao
        }, indicacaoTexto)

        const hoje = new Date()
        const dd = String(hoje.getDate()).padStart(2, '0')
        const mm = String(hoje.getMonth() + 1).padStart(2, '0')
        const yyyy = hoje.getFullYear()
        const dataHoje = `${dd}/${mm}/${yyyy}`
        await page.evaluate((dt: string) => {
          const el = document.querySelector('input[name*="dataDeSolicitacao"]') as HTMLInputElement | null
          if (el) el.value = dt
        }, dataHoje)

        // ─── Step 12: Fill contratado solicitante ────────────────
        await onProgress?.('7', 'Preenchendo profissional solicitante...')
        await page.evaluate(() => {
          const set = (s: string, v: string) => {
            const el = document.querySelector(s) as HTMLInputElement | null
            if (el) { el.readOnly = false; el.value = v }
          }
          set('input[name*="contratadoSolicitante.codigo"]', '97498504')
          set('input[name*="contratadoSolicitante.nome"]', 'DEDICARE SERVICOS DE FONOAUDIOLOGIA PSICOLOGIA E NUTRICAO')
        })

        // ─── Step 13: Fill profissional ──────────────────────────
        const profField = page.locator('input[name*="profissionalSolicitante.nome"]')
        await profField.fill(data.profissional.nome)
        await page.waitForTimeout(500)
        await page.click('body')
        await page.waitForTimeout(500)

        // CPro council codes = TISS/SAW codes (pad to 2 digits)
        // SAW: 04=CREFONO, 05=CREFITO, 06=CRM, 07=CRN, 09=CRP, 13=CREF
        const conselhoMap: Record<string, string> = {
          '4': '04',  '04': '04',  // CREFONO (Fonoaudiologia)
          '5': '05',  '05': '05',  // CREFITO (Fisio/TO/Psicomotricidade)
          '6': '06',  '06': '06',  // CRM (Medicina)
          '7': '07',  '07': '07',  // CRN (Nutrição)
          '9': '09',  '09': '09',  // CRP (Psicologia/Psicopedagogia)
          '13': '13',              // CREF (Educação Física)
        }
        const conselhoSaw = conselhoMap[data.profissional.conselho] ?? data.profissional.conselho

        await page.evaluate(
          (prof: { conselho: string; numeroConselho: string; uf: string; cbo: string }) => {
            const set = (s: string, v: string) => {
              const el = document.querySelector(s) as HTMLInputElement | HTMLSelectElement | null
              if (el) {
                ;(el as HTMLInputElement).readOnly = false
                el.value = v
                el.dispatchEvent(new Event('change', { bubbles: true }))
              }
            }
            set('select[name*="profissionalSolicitante.conselhoProfissional"]', prof.conselho)
            set('input[name*="profissionalSolicitante.crm"]', prof.numeroConselho)
            // UF for BA = "29" (NOT "05")
            set('select[name*="profissionalSolicitante.ufDoCrm"]', prof.uf)

            const cboSelect = document.querySelector('select[name*="profissionalSolicitante.cbos"]') as HTMLSelectElement | null
            if (cboSelect) {
              let found = false
              // Tentar por value (código numérico ex: "251510")
              for (const opt of cboSelect.options) {
                if (opt.value === prof.cbo) { cboSelect.value = opt.value; found = true; break }
              }
              // Tentar por texto (ex: "psicólogo clínico") — preferir match exato de palavra
              if (!found) {
                const cboLower = prof.cbo.toLowerCase()
                // Primeiro: match exato (texto começa com o termo ou é igual)
                for (const opt of cboSelect.options) {
                  const txt = opt.text.toLowerCase().trim()
                  if (txt === cboLower || txt.startsWith(cboLower + ' ') || txt.startsWith(cboLower + ',')) {
                    cboSelect.value = opt.value; found = true; break
                  }
                }
                // Depois: match parcial via regex (pode pegar substrings)
                if (!found) {
                  const cboRegex = new RegExp(prof.cbo, 'i')
                  for (const opt of cboSelect.options) {
                    if (cboRegex.test(opt.text) || cboRegex.test(opt.value)) { cboSelect.value = opt.value; found = true; break }
                  }
                }
              }
              // Fallback: mapear codigos numericos conhecidos para texto
              if (!found) {
                const cboMap: Record<string, string> = {
                  '251510': 'psicólogo clínico', '251505': 'psicólogo',
                  '223810': 'fonoaudiólogo', '223710': 'nutricionista',
                  '226305': 'musicoterapeut', '223915': 'psicomotricist',
                  '239425': 'psicopedagog', '239440': 'neuropsicopedag',
                  '226310': 'arteterapeut', '251605': 'assistente social',
                }
                const mapped = cboMap[prof.cbo]
                if (mapped) {
                  const mapRegex = new RegExp(mapped, 'i')
                  for (const opt of cboSelect.options) {
                    if (mapRegex.test(opt.text)) { cboSelect.value = opt.value; found = true; break }
                  }
                }
              }
              if (found) cboSelect.dispatchEvent(new Event('change', { bubbles: true }))
            }
          },
          { ...data.profissional, conselho: conselhoSaw },
        )

        // ─── Step 14: Fill contato ───────────────────────────────
        await onProgress?.('8', 'Preenchendo contato...')
        await page.evaluate(() => {
          const email = document.querySelector('input[name="emailContatoBeneficiario"]') as HTMLInputElement | null
          if (email && (!email.value || email.value.includes('sememail'))) email.value = 'paciente@email.com'
          const ddd = document.querySelector('select[name*="numeroDDDTelefoneContatoBeneficiario"]') as HTMLSelectElement | null
          if (ddd) { ddd.value = '73'; ddd.dispatchEvent(new Event('change', { bubbles: true })) }
          const tel = document.querySelector('input[name*="numeroTelefoneContatoBeneficiario"]') as HTMLInputElement | null
          if (tel) tel.value = '999999999'
        })

        // ─── Step 14b: Capture form data BEFORE submit (readGuide may hit token page) ──
        const preSubmitFormData = await page.evaluate(() => {
          const val = (sel: string): string | null => {
            const el = document.querySelector(sel) as HTMLInputElement | HTMLSelectElement | null
            return el?.value?.trim() || null
          }
          const txt = (sel: string): string | null => {
            const el = document.querySelector(sel) as HTMLElement | null
            return el?.textContent?.trim() || null
          }
          return {
            senha: val('input[name*="senha"]'),
            dataAutorizacao: val('input[name*="dataDeAutorizacao"]'),
            dataValidadeSenha: val('input[name*="validadeDaSenha"]'),
            dataSolicitacao: val('input[name*="dataDaSolicitacao"]'),
            nomeProfissional: val('input[name*="profissionalSolicitante.nome"]'),
            numeroCarteira: val('input[name*="beneficiario.codigo"]') || val('input[name*="numeroDaCarteira"]'),
            codigoPrestador: val('input[name*="contratadoSolicitante.codigo"]'),
            cnes: val('input[name*="codigoCNES"]'),
            nomeBeneficiario: txt('#nomeBeneficiario') || val('input[name*="nomeDoBeneficiario"]'),
            quantidadeSolicitada: Number(val('input[name*="quantidadeSolicitada"]')) || 0,
            quantidadeAutorizada: Number(val('input[name*="quantidadeAutorizada"]')) || 0,
            codigoProcedimentoSolicitado: val('input[name*="procedimentosSolicitados"][name*="codigo"]')
              || val('input[name*="codigoDoProcedimento"]'),
          }
        }).catch(() => null)

        sawLog(`createGuide: formData pre-submit capturado: ${JSON.stringify(preSubmitFormData ?? {}).substring(0, 200)}`)

        // ─── Step 15: Response interceptor before gravarGuia ────
        await onProgress?.('9', 'Gravando guia no SAW...')
        let guideNumber = ''

        page.on('response', async (response) => {
          const url = response.url()
          if (url.includes('SolicitacaoDeSPSADT40') || url.includes('MantemToken')) {
            try {
              const text = await response.text().catch(() => '')
              const matchGuia = text.match(/numeroDaGuia[^>]*value="(\d{8,})"/)
              if (matchGuia) guideNumber = matchGuia[1]
              const matchChave = text.match(/chave[^>]*value="(\d{5,})"/)
              if (matchChave && !guideNumber) guideNumber = `chave:${matchChave[1]}`
            } catch { /* */ }
          }
        })

        // ─── Step 16: Call gravarGuia() ──────────────────────────
        await page.evaluate(() => {
          const win = window as unknown as Record<string, unknown>
          if (typeof win.gravarGuia === 'function') (win.gravarGuia as () => void)()
        })

        // ─── Step 17: Wait for navigation ───────────────────────
        try {
          await page.waitForURL(/MantemTokenDeAtendimento|consultarGuia|abrirTela/, { timeout: 30_000 })
        } catch {
          // If navigation did not happen, re-fill profissional and retry
          sawLog('createGuide: nao navegou, re-preenchendo profissional e tentando novamente...')
          await onProgress?.('9', 'Guia nao salva, re-tentando apos dialog...')
          await page.evaluate(
            (prof: { nome: string; conselho: string; numeroConselho: string; uf: string; cbo: string }) => {
              const set = (s: string, v: string) => {
                const el = document.querySelector(s) as HTMLInputElement | HTMLSelectElement | null
                if (el) {
                  ;(el as HTMLInputElement).readOnly = false
                  el.value = v
                  el.dispatchEvent(new Event('change', { bubbles: true }))
                }
              }
              set('input[name*="contratadoSolicitante.codigo"]', '97498504')
              set('input[name*="contratadoSolicitante.nome"]', 'DEDICARE SERVICOS DE FONOAUDIOLOGIA PSICOLOGIA E NUTRICAO')
              set('input[name*="profissionalSolicitante.nome"]', prof.nome)
              set('input[name*="profissionalSolicitante.crm"]', prof.numeroConselho)
              set('select[name*="profissionalSolicitante.ufDoCrm"]', prof.uf)
              set('select[name*="profissionalSolicitante.conselhoProfissional"]', prof.conselho)
              set('select[name*="indicacaoDeAcidente"]', '9')
              const cboSelect = document.querySelector('select[name*="profissionalSolicitante.cbos"]') as HTMLSelectElement | null
              if (cboSelect) {
                let found = false
                for (const opt of cboSelect.options) {
                  if (opt.value === prof.cbo) { cboSelect.value = opt.value; found = true; break }
                }
                if (!found) {
                  const cboRegex = new RegExp(prof.cbo, 'i')
                  for (const opt of cboSelect.options) {
                    if (cboRegex.test(opt.text) || cboRegex.test(opt.value)) { cboSelect.value = opt.value; found = true; break }
                  }
                }
                if (!found) {
                  const cboMap: Record<string, string> = {
                    '251510': 'psicólogo', '251505': 'psicólogo', '223810': 'fonoaudiólogo',
                    '223710': 'nutricionista', '226310': 'arteterapeuta', '251605': 'assistente social',
                  }
                  const mapped = cboMap[prof.cbo]
                  if (mapped) {
                    const mapRegex = new RegExp(mapped, 'i')
                    for (const opt of cboSelect.options) {
                      if (mapRegex.test(opt.text)) { cboSelect.value = opt.value; found = true; break }
                    }
                  }
                }
                if (found) cboSelect.dispatchEvent(new Event('change', { bubbles: true }))
              }
            },
            { ...data.profissional, conselho: conselhoSaw },
          )
          await page.waitForTimeout(1000)
          await page.evaluate(() => {
            const win = window as unknown as Record<string, unknown>
            if (typeof win.gravarGuia === 'function') (win.gravarGuia as () => void)()
          })
          try {
            await page.waitForURL(/MantemTokenDeAtendimento|consultarGuia|abrirTela/, { timeout: 30_000 })
          } catch { /* */ }
        }

        await page.waitForTimeout(3000)

        // ─── Step 18: Extract guide number from page ─────────────
        const postUrl = page.url()
        sawLog(`createGuide: URL apos gravar: ${postUrl.substring(0, 100)}`)
        await page.screenshot({ path: '/tmp/debug-createguide-post.png' }).catch(() => {})

        // Buscar numero da guia — pode estar no campo numeroDaGuia ou no texto da pagina
        if (!guideNumber) {
          guideNumber = await page.evaluate(() => {
            // Buscar todos os inputs com numeroDaGuia (pode ter mais de um)
            const inputs = document.querySelectorAll('input[name*="numeroDaGuia"]')
            for (const el of inputs) {
              const v = (el as HTMLInputElement).value?.trim()
              if (v && v.length > 5 && /^\d+$/.test(v)) return v
            }
            // Buscar no campo de senha (se tem senha, guia foi criada)
            const senha = document.querySelector('input[name*="senha"]') as HTMLInputElement | null
            if (senha?.value && senha.value.length > 3) {
              // Guia criada — buscar numero no texto
              const text = document.body?.innerText ?? ''
              const m = text.match(/(?:Guia|N[°º.]?\s*da\s*Guia)[^0-9]*(\d{8,})/)
              if (m) return m[1]
            }
            // Buscar por numero longo no campo de prestador
            const prestador = document.querySelector('input[name*="numeroDaGuiaDoPrestador"]') as HTMLInputElement | null
            if (prestador?.value) return 'prestador:' + prestador.value
            return ''
          }).catch(() => '')
        }

        // Remover prefixo prestador: se existir
        if (guideNumber?.startsWith('prestador:')) {
          sawLog(`createGuide: numero prestador encontrado: ${guideNumber}`)
          guideNumber = '' // nao e o numero da operadora
        }

        if (guideNumber) {
          sawLog(`createGuide: numero da guia capturado: ${guideNumber}`)
          await onProgress?.('10', `Guia criada com sucesso: ${guideNumber}`)
          return { success: true, guideNumber, paciente: nomeBeneficiario || undefined, formData: preSubmitFormData ?? undefined }
        }

        // Se nao encontrou numero mas nao houve alerts de erro — provavelmente criou
        // Verificar se a pagina tem dados de guia gravada (senha preenchida = guia criada)
        const hasSenha = await page.evaluate(() => {
          const s = document.querySelector('input[name*="senha"]') as HTMLInputElement | null
          return !!(s?.value && s.value.length > 3)
        }).catch(() => false)

        if (hasSenha) {
          sawLog('createGuide: guia gravada (senha encontrada) mas numero nao capturado')
          await onProgress?.('10', 'Guia gravada com sucesso (numero sera capturado na importacao)')
          return { success: true, guideNumber: undefined, paciente: nomeBeneficiario || undefined, formData: preSubmitFormData ?? undefined }
        }

        // Verificar se o SAW ficou no form vazio (erro real) ou se recarregou com dados
        const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 200) ?? '').catch(() => '')
        sawLog(`createGuide: texto pos-gravar: ${pageText.substring(0, 150)}`)

        return { success: false, error: 'Guia nao foi gravada — formulario permaneceu aberto' }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido ao criar guia'
        sawLog(`createGuide: erro — ${msg}`)
        return { success: false, error: msg }
      } finally {
        if (page) await page.close().catch(() => {})
      }
    })
  }


  async forceReconnect(userId: string): Promise<void> {
    sawLog(`Force reconnecting for user ${userId.slice(0, 8)}...`)
    await this.destroyContext(userId)
    // If browser is dead, next getContext() will relaunch it
    if (this.browser && !this.browser.isConnected()) {
      this.browser = null
      this.contexts.clear()
    }
    sawLog(`Reconnected for user ${userId.slice(0, 8)}`)
  }

  async close(): Promise<void> {
    for (const [userId] of this.contexts) {
      await this.destroyContext(userId)
    }
    if (this.browser) {
      await this.browser.close().catch(() => {})
      this.browser = null
    }
  }
}

let instance: SawClient | null = null

export function getSawClient(): SawClient {
  if (!instance) instance = new SawClient()
  return instance
}
