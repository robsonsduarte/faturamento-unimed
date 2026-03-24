import { chromium } from 'playwright'
import type { Browser, BrowserContext, Page, Cookie } from 'playwright'

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

class SawClient {
  private browser: Browser | null = null
  private contexts: Map<string, UserContext> = new Map()
  private locks: Map<string, Promise<void>> = new Map()

  // ─── Browser lifecycle ──────────────────────────────────────
  async getBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) return this.browser

    const wsUrl = process.env.PLAYWRIGHT_WS_URL
    if (wsUrl) {
      console.log(`[SAW] Connecting to remote browser at ${wsUrl}`)
      this.browser = await chromium.connect(wsUrl)
    } else {
      console.log('[SAW] Launching local Chromium (headless)')
      this.browser = await chromium.launch({ headless: true })
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
    console.log(`[SAW] Context destroyed for user ${userId.slice(0, 8)}...`)
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

        // Check if redirected to token page (MantemTokenDeAtendimento.do)
        // This means the guide requires biometric token BEFORE it can be viewed
        const currentUrl = page.url()
        if (currentUrl.includes('MantemTokenDeAtendimento') || currentUrl.includes('TokenDeAtendimento')) {
          console.log(`[SAW] Guia ${numeroGuia}: redirecionada para tela de token biometrico`)
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

            const tabelaProcedimentos = document.querySelector('#procedimentos table')
            if (tabelaProcedimentos) {
              const linhas = tabelaProcedimentos.querySelectorAll('tr')
              for (let i = 1; i < linhas.length; i++) {
                const colunas = linhas[i].querySelectorAll('td')
                if (colunas.length >= 5) {
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

        console.log(`[SAW] Guia ${numeroGuia}: ${procRealizados} realizados, ${procDetalhes.length} detalhes extraidos`)

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
              console.log(`[SAW] XML da guia ${numeroGuia} baixado: ${xmlContent.length} bytes`)
            } else {
              console.log(`[SAW] XML da guia ${numeroGuia}: conteudo invalido (${xmlContent?.length ?? 0} bytes)`)
              xmlContent = null
            }
          } catch (xmlErr) {
            console.log(`[SAW] XML da guia ${numeroGuia}: erro ao baixar (${xmlErr instanceof Error ? xmlErr.message : 'erro'})`)
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

  // ─── Force reconnect for a specific user ────────────────────
  async forceReconnect(userId: string): Promise<void> {
    console.log(`[SAW] Force reconnecting for user ${userId.slice(0, 8)}...`)
    await this.destroyContext(userId)
    // If browser is dead, next getContext() will relaunch it
    if (this.browser && !this.browser.isConnected()) {
      this.browser = null
      this.contexts.clear()
    }
    console.log(`[SAW] Reconnected for user ${userId.slice(0, 8)}`)
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
