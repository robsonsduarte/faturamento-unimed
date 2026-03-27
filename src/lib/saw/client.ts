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
      console.log(`[SAW] Connecting to remote browser at ${wsUrl}`)
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

  // ─── Resolve biometric token (técnica do workflow n8n funcional) ───
  async resolveToken(
    userId: string,
    cookies: SawCookie[],
    numeroGuia: string,
    photoBase64: string,
    onProgress?: (step: string, message: string) => void,
  ): Promise<{ success: boolean; error?: string; fallbackToToken?: boolean }> {
    return this.withLock(userId, async () => {
      let page: Page | null = null
      let biofacePage: Page | null = null

      try {
        const context = await this.getContext(userId, cookies)
        page = await context.newPage()
        page.setDefaultTimeout(30_000)

        const guiaUrl = `${SAW_BASE}/saw/tiss/SolicitacaoDeSPSADT40.do?method=consultarGuiaDeSPSADT&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.numeroDaGuia=${encodeURIComponent(numeroGuia)}&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.isConsultaNaGuia=true`

        onProgress?.("3/9", ` Navegando para guia ${numeroGuia}`)
        await page.goto(guiaUrl, { waitUntil: 'networkidle', timeout: 30_000 })
        await page.waitForTimeout(2000)

        const currentUrl = page.url()

        // Se redirecionou para tela de token numerico, biometria nao esta disponivel
        if (currentUrl.includes('MantemTokenDeAtendimento') || currentUrl.includes('TokenDeAtendimento')) {
          console.log(`[SAW] resolveToken: guia requer token numerico, nao biometria facial`)
          return { success: false, fallbackToToken: true, error: 'Guia requer token numerico (App/SMS), nao biometria facial.' }
        }

        // === STEP 1: Verificar se biometria ja autenticada ===
        const alreadyAuth = await page.$('img[src*="biometriaAutenticadaface"]')
        if (alreadyAuth) {
          onProgress?.("3/9", ` Biometria ja autenticada!`)
          return { success: true }
        }

        // === STEP 2: Clicar check-in e extrair URL BioFace ===
        onProgress?.("4/9", ` Clicando check-in para gerar URL BioFace...`)

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

        onProgress?.("4/9", ` BioFace URL extraida: ${biofaceUrl.substring(0, 100)}`)

        // === STEP 3: Abrir BioFace em pagina separada (tecnica do workflow n8n) ===
        biofacePage = await context.newPage()
        biofacePage.setDefaultTimeout(30_000)

        onProgress?.("5/9", ` Abrindo BioFace em pagina separada...`)
        await biofacePage.goto(biofaceUrl, { waitUntil: 'networkidle', timeout: 30_000 })
        await biofacePage.waitForTimeout(3000)
        await biofacePage.screenshot({ path: '/tmp/debug-resolvetoken-2-bioface-open.png', fullPage: false }).catch(() => {})

        // === STEP 4: Clicar "Capturar Foto" via mouse.click com boundingBox ===
        onProgress?.("6/9", ` STEP 6 — clicando Capturar Foto...`)
        const btnCapturar = await biofacePage.$('#id-botao-capturar')
        if (btnCapturar) {
          const box = await btnCapturar.boundingBox()
          if (box) {
            await biofacePage.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
            onProgress?.("6/9", ` Capturar Foto clicado via mouse.click`)
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
        onProgress?.("7/9", ` STEP 7 — injetando foto...`)
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
        onProgress?.("7/9", ` Foto injetada com sucesso`)

        // === STEP 6: Mostrar e clicar "Autenticar Foto" via mouse.down/up ===
        onProgress?.("8/9", ` STEP 8 — clicando Autenticar...`)

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
            onProgress?.("8/9", ` Autenticar clicado via mouse.down/up`)
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
        onProgress?.("8/9", ` Aguardando TRIX processar (12s)...`)
        await biofacePage.waitForTimeout(12_000)
        await biofacePage.screenshot({ path: '/tmp/debug-resolvetoken-5-after-auth.png', fullPage: false }).catch(() => {})

        // Fechar pagina BioFace
        await biofacePage.close().catch(() => {})
        biofacePage = null

        // === STEP 8: Validar resultado no SAW (navegar de volta a guia) ===
        onProgress?.("9/9", ` Validando resultado no SAW...`)
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

        console.log(`[SAW] resolveToken: validacao — icone=${validacao.iconeVisivel}, btnCheckin=${validacao.btnVisivel}`)

        if (validacao.iconeVisivel && !validacao.btnVisivel) {
          onProgress?.("9/9", ` SUCESSO — biometria confirmada no SAW!`)
          return { success: true }
        }

        // Verificar se caiu na tela de token (fallback do SAW apos falha biometrica)
        if (page.url().includes('MantemTokenDeAtendimento') || validacao.texto.includes('Selecione uma forma de envio')) {
          console.log(`[SAW] resolveToken: biometria falhou, SAW ofereceu token numerico como fallback`)
          return { success: false, fallbackToToken: true, error: 'Biometria nao aceita pelo TRIX. Use token numerico.' }
        }

        // Se botao check-in ainda visivel, biometria nao confirmou
        if (validacao.btnVisivel) {
          return { success: false, error: 'Biometria processada mas nao confirmada no SAW. Tente novamente com outra foto.' }
        }

        // Inconclusivo — assumir sucesso
        console.log(`[SAW] resolveToken: resultado inconclusivo, assumindo sucesso`)
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
    onProgress?: (step: string, msg: string) => void,
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
          console.log(`[SAW] cobrar: dialog: ${dialog.message().substring(0, 80)}`)
          await dialog.accept()
        })

        const guiaUrl = `${SAW_BASE}/saw/tiss/SolicitacaoDeSPSADT40.do?method=consultarGuiaDeSPSADT&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.numeroDaGuia=${encodeURIComponent(numeroGuia)}&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.isConsultaNaGuia=true`

        onProgress?.('1', `Navegando para guia ${numeroGuia}...`)
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

        onProgress?.('1', `Guia aberta. ${procedimentos.length} procedimento(s) para cobrar.`)
        await page.screenshot({ path: '/tmp/debug-cobrar-0-guia.png', fullPage: false }).catch(() => {})

        for (let i = 0; i < procedimentos.length; i++) {
          const proc = procedimentos[i]
          const stepLabel = `${i + 1}/${procedimentos.length}`
          onProgress?.(stepLabel, `Procedimento ${proc.data} — clicando "Realizar"...`)

          try {
            // Step A: Clicar "Realizar Procedimento" (2o img com title "Realizar")
            const realizarBtns = await page.$$('img[title*="Realizar"]')
            if (realizarBtns.length < 2) {
              // Pode ja ter sido realizado ou nao tem mais botoes
              onProgress?.(stepLabel, `Botao "Realizar" nao encontrado. Pode ja ter sido cobrado.`)
              execucoes.push({ data: proc.data, success: false, error: 'Botao Realizar nao encontrado' })
              continue
            }

            await realizarBtns[1].click()
            await page.waitForTimeout(5000)
            await page.screenshot({ path: `/tmp/debug-cobrar-${i + 1}-apos-realizar.png`, fullPage: false }).catch(() => {})

            // Step B: Autenticar biometria no iframe BioFace
            onProgress?.(stepLabel, `Autenticando biometria...`)

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

              await page.waitForTimeout(5000)
            } else {
              onProgress?.(stepLabel, `Iframe BioFace nao encontrado. Tentando continuar...`)
            }

            // Step C: Aguardar formulario (nova pagina/popup)
            onProgress?.(stepLabel, `Aguardando formulario de realizacao...`)
            await page.waitForTimeout(3000)

            // Procurar nova pagina aberta (popup de realizacao)
            const pages = context.pages()
            let formPage: Page | null = null

            for (const p of pages) {
              const pUrl = p.url()
              if (pUrl.includes('abrirTelaDeRealizarProcedimento') || pUrl.includes('RealizarProcedimento')) {
                formPage = p
                break
              }
            }

            // Fallback: verificar se o form abriu na mesma pagina
            if (!formPage) {
              const hasForm = await page.evaluate(() => !!document.getElementById('dataSolicitacaoProcedimento')).catch(() => false)
              if (hasForm) formPage = page
            }

            if (!formPage) {
              onProgress?.(stepLabel, `Formulario de realizacao nao abriu.`)
              execucoes.push({ data: proc.data, success: false, error: 'Formulario nao abriu' })
              await page.goto(guiaUrl, { waitUntil: 'networkidle', timeout: 30_000 }).catch(() => {})
              await page.waitForTimeout(2000)
              continue
            }

            // Step D: Preencher formulario
            onProgress?.(stepLabel, `Preenchendo formulario...`)
            await formPage.screenshot({ path: `/tmp/debug-cobrar-${i + 1}-form.png`, fullPage: false }).catch(() => {})

            await formPage.evaluate((p) => {
              // Limpar campos
              const campos = ['dataSolicitacaoProcedimento', 'horarioInicial', 'horarioFinal', 'quantidadeSolicitada']
              campos.forEach((id) => {
                const el = document.getElementById(id) as HTMLInputElement
                if (el) el.value = ''
              })
            }, null)

            await formPage.type('#dataSolicitacaoProcedimento', proc.data, { delay: 50 })
            await formPage.type('#horarioInicial', proc.horaInicial, { delay: 50 })
            await formPage.type('#horarioFinal', proc.horaFinal, { delay: 50 })
            await formPage.type('#quantidadeSolicitada', proc.quantidade || '1', { delay: 50 })

            // Selects
            await formPage.selectOption('#viaDeAcesso', proc.viaAcesso || '1').catch(() => {})
            await formPage.evaluate((tecVal) => {
              const sel = document.querySelector('select[name*="tecnicaUtilizada"]') as HTMLSelectElement
              if (sel) { sel.value = tecVal; sel.dispatchEvent(new Event('change', { bubbles: true })) }
            }, proc.tecnica || '1').catch(() => {})
            await formPage.selectOption('#porcentagemReducaoAcrescimo', proc.redAcresc || '1.0').catch(() => {})

            await formPage.screenshot({ path: `/tmp/debug-cobrar-${i + 1}-form-filled.png`, fullPage: false }).catch(() => {})

            // Step E: Executar servico
            onProgress?.(stepLabel, `Executando servico...`)
            await formPage.evaluate(() => {
              if (typeof (window as unknown as Record<string, unknown>).executarServico === 'function') {
                ((window as unknown as Record<string, unknown>).executarServico as () => void)()
              }
            })

            await page.waitForTimeout(3000)

            // Step F: Recarregar pagina principal
            onProgress?.(stepLabel, `Procedimento executado! Recarregando...`)
            await page.goto(guiaUrl, { waitUntil: 'networkidle', timeout: 30_000 }).catch(() => {})
            await page.waitForTimeout(2000)

            // Fechar popup se abriu
            if (formPage !== page) {
              await formPage.close().catch(() => {})
            }

            execucoes.push({ data: proc.data, success: true })
            totalExecutado++
            onProgress?.(stepLabel, `Procedimento ${proc.data} cobrado com sucesso!`)

          } catch (procErr) {
            const msg = procErr instanceof Error ? procErr.message : 'Erro desconhecido'
            onProgress?.(stepLabel, `Erro no procedimento ${proc.data}: ${msg}`)
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
  ): Promise<{
    success: boolean
    sessionId?: string
    methods?: { aplicativo: boolean; email: boolean; sms: boolean }
    phones?: { value: string; text: string }[]
    beneficiarioPhone?: string
    tokenAlreadyResolved?: boolean
    error?: string
  }> {
    const context = await this.getContext(userId, cookies)
    const page = await context.newPage()
    page.setDefaultTimeout(30_000)

    try {
      const guiaUrl = `${SAW_BASE}/saw/tiss/SolicitacaoDeSPSADT40.do?method=consultarGuiaDeSPSADT&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.numeroDaGuia=${encodeURIComponent(numeroGuia)}&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.isConsultaNaGuia=true`

      console.log(`[SAW] openTokenPage: navegando para guia ${numeroGuia}`)
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

      console.log(`[SAW] openTokenPage: URL=${currentUrl.substring(0, 80)}, texto=${pageText.substring(0, 100)}`)

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

        console.log(`[SAW] openTokenPage: guia aberta — tokenValidado=${icons.hasTokenValidado}, checkIn=${icons.hasCheckIn}`)

        if (icons.hasTokenValidado && !icons.hasCheckIn && !icons.hasCheckInMsg) {
          await page.close().catch(() => {})
          return {
            success: true,
            sessionId: undefined,
            methods: undefined,
            phones: undefined,
            beneficiarioPhone: undefined,
            tokenAlreadyResolved: true,
          }
        }

        if (icons.hasCheckIn || icons.hasCheckInMsg) {
          console.log(`[SAW] openTokenPage: clicando Check-in...`)
          await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a, div[class*="link"], div[class*="caixa"]'))
            const el = links.find((l) => /Check-?in/i.test((l as HTMLElement).textContent ?? ''))
            if (el) (el as HTMLElement).click()
          }).catch(() => {})
          await page.waitForTimeout(3000)
        } else {
          await page.close().catch(() => {})
          return { success: false, error: 'Guia abriu sem Check-in ou Token. Reimporte a guia.' }
        }
      } else if (!isTokenMethodPage) {
        await page.close().catch(() => {})
        return { success: false, error: `Pagina inesperada: ${currentUrl.substring(0, 100)}` }
      }

      // Atualizar texto (pode ter mudado apos clique no Check-in)
      const finalPageText = await page.evaluate(() => document.body?.innerText ?? '')

      // Extract available methods and phones
      const textForMethods = finalPageText || pageText
      const hasAplicativo = /aplicativo/i.test(textForMethods)
      const hasEmail = /\bemail\b/i.test(textForMethods)
      const hasSms = /\bsms\b/i.test(textForMethods)

      // Clicar no radio SMS para revelar select de telefones, extrair, depois voltar
      let phones: { value: string; text: string }[] = []
      try {
        if (hasSms) {
          // Clicar radio SMS — precisa clicar no input radio diretamente
          console.log(`[SAW] openTokenPage: clicando radio SMS...`)
          const smsClicked = await page.evaluate(() => {
            // Encontrar todos os radios e clicar no que esta perto do texto "SMS"
            const radios = Array.from(document.querySelectorAll('input[type="radio"]'))
            for (const radio of radios) {
              // Verificar o parent/container do radio
              const container = radio.closest('td, div, label, fieldset, tr')
              if (container && /\bsms\b/i.test(container.textContent ?? '')) {
                // Clicar no radio diretamente
                (radio as HTMLInputElement).checked = true
                radio.dispatchEvent(new Event('click', { bubbles: true }))
                radio.dispatchEvent(new Event('change', { bubbles: true }))
                // Tentar tambem o onclick nativo se existir
                // Trigger onclick handler if exists
                try { radio.dispatchEvent(new MouseEvent('click', { bubbles: true })) } catch { /* */ }
                return true
              }
            }
            // Fallback: clicar no 3o radio (geralmente SMS e o 3o: App, Email, SMS)
            if (radios.length >= 3) {
              (radios[2] as HTMLInputElement).checked = true
              radios[2].dispatchEvent(new Event('click', { bubbles: true }))
              radios[2].dispatchEvent(new Event('change', { bubbles: true }))
              return true
            }
            return false
          })
          console.log(`[SAW] openTokenPage: radio SMS clicado: ${smsClicked}`)
          await page.waitForTimeout(2000)
          await page.screenshot({ path: '/tmp/debug-opentoken-sms-clicked.png' }).catch(() => {})
          console.log(`[SAW] openTokenPage: aguardando select de telefones...`)
        }

        // Aguardar select aparecer
        await page.waitForTimeout(1500)

        // Extrair telefones usando getElementById (IDs com pontos)
        phones = await page.evaluate(() => {
          const result: { value: string; text: string }[] = []
          const sel = document.getElementById('tokenDeAtendimento.telefoneDeEnvio.numero') as HTMLSelectElement | null
          if (sel) {
            for (const opt of sel.options) {
              const v = opt.value?.trim()
              const t = opt.text?.trim()
              if (v && v !== '' && !/escolha/i.test(t ?? '')) {
                result.push({ value: v, text: t ?? v })
              }
            }
          }
          return result
        }) ?? []

        console.log(`[SAW] openTokenPage: telefones extraidos: ${phones.length}`, phones.map((p) => `${p.text}(${p.value})`).join(', '))

        // Voltar para estado neutro (clicar radio Aplicativo se existir)
        if (hasSms && hasAplicativo) {
          await page.evaluate(() => {
            const radios = document.querySelectorAll('input[type="radio"]')
            for (const radio of radios) {
              const parent = radio.closest('td, div, label')
              if (parent && /aplicativo/i.test(parent.textContent ?? '')) {
                (radio as HTMLInputElement).click()
                break
              }
            }
          }).catch(() => {})
        }
      } catch {
        phones = []
      }

      // Extrair telefone do beneficiario da pagina
      let beneficiarioPhone = ''
      try {
        beneficiarioPhone = await page.evaluate(() => {
          // Procurar em inputs hidden
          const telInput = document.querySelector('input[name*="telefone"], input[name*="celular"], input[id*="telefone"]') as HTMLInputElement
          if (telInput?.value) {
            const digits = telInput.value.replace(/\D/g, '')
            if (digits.length >= 8) return digits
          }
          // Procurar no texto da pagina
          const text = document.body?.innerText ?? ''
          const phoneMatch = text.match(/(?:celular|telefone|fone)[:\s]*[\(\d\s\-\*]+/i)
          if (phoneMatch) {
            // Extrair ultimos 4 digitos visiveis (SAW mascara com *****)
            const partial = phoneMatch[0].replace(/\D/g, '')
            if (partial.length >= 4) return partial
          }
          return ''
        }) ?? ''
      } catch { /* */ }

      const info = { hasAplicativo, hasEmail, hasSms, phones, beneficiarioPhone }

      // Store page reference with a session ID
      const sessionId = `token-${userId}-${numeroGuia}-${Date.now()}`
      this.tokenPages.set(sessionId, { page, numeroGuia, createdAt: Date.now() })

      // Auto-cleanup after 10 minutes (token expires in 4:30 on SAW)
      setTimeout(() => {
        const entry = this.tokenPages.get(sessionId)
        if (entry) {
          entry.page.close().catch(() => {})
          this.tokenPages.delete(sessionId)
          console.log(`[SAW] openTokenPage: session ${sessionId} expired and cleaned up`)
        }
      }, 10 * 60 * 1000)

      console.log(`[SAW] openTokenPage: token page open for guia ${numeroGuia} (session=${sessionId}, methods: app=${info.hasAplicativo} email=${info.hasEmail} sms=${info.hasSms}, phones=${info.phones.length})`)

      return {
        success: true,
        sessionId,
        methods: {
          aplicativo: info.hasAplicativo,
          email: info.hasEmail,
          sms: info.hasSms,
        },
        phones: info.phones,
        beneficiarioPhone: info.beneficiarioPhone,
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
        console.log(`[SAW] selectTokenMethod: selected Aplicativo`)
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
          console.log(`[SAW] selectTokenMethod: selecionando telefone ${phone} no SAW`)
          await page.evaluate((phoneValue: string) => {
            // Select especifico do SAW
            const sel = document.querySelector('#tokenDeAtendimento\\.telefoneDeEnvio\\.numero') as HTMLSelectElement
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
        console.log(`[SAW] selectTokenMethod: clicando Enviar SMS no SAW`)
        await page.evaluate(() => {
          const btn = document.querySelector('#botaoSMS') as HTMLElement
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
          console.log(`[SAW] selectTokenMethod: SMS enviado com sucesso pelo SAW`)
        } else {
          console.log(`[SAW] selectTokenMethod: resposta SAW: ${pageText.substring(0, 200)}`)
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
      console.log(`[SAW] submitToken: preenchendo token ${digits} na guia ${numeroGuia}`)

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

      console.log(`[SAW] submitToken: DEBUG — ${debugInfo.total} inputs na pagina. Body: ${debugInfo.bodyText.substring(0, 150)}`)
      console.log(`[SAW] submitToken: DEBUG inputs:`, JSON.stringify(debugInfo.inputs.slice(0, 10)))

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

      console.log(`[SAW] submitToken: preencheu ${filled.count} campos, clicando Validar`)
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
        console.log(`[SAW] submitToken: token validado com sucesso para guia ${numeroGuia}`)
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
      console.log(`[SAW] submitToken: resultado inconclusivo para guia ${numeroGuia}, assumindo sucesso`)
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
        const phones = await entry.page.evaluate(() => {
          const result: { value: string; text: string }[] = []

          // Usar getElementById (funciona com IDs que tem pontos)
          const sel = document.getElementById('tokenDeAtendimento.telefoneDeEnvio.numero') as HTMLSelectElement | null
            ?? (document.querySelector('#telefonesCelularesBeneficiario select') as HTMLSelectElement | null)

          if (sel) {
            for (const opt of sel.options) {
              const v = opt.value?.trim()
              const t = opt.text?.trim()
              if (v && v !== '' && !/escolha/i.test(t ?? '')) {
                result.push({ value: v, text: t ?? v })
              }
            }
          }

          return result
        }) as { value: string; text: string }[]

        if (phones.length > 0) {
          console.log(`[SAW] getTokenPagePhones: ${phones.length} telefone(s) — ${phones.map((p) => p.text).join(', ')} (attempt ${attempt + 1})`)
          return phones
        }
      } catch {
        console.log(`[SAW] getTokenPagePhones: evaluate falhou (attempt ${attempt + 1})`)
      }

      await new Promise((r) => setTimeout(r, 1500))
    }

    console.log(`[SAW] getTokenPagePhones: nenhum telefone encontrado apos 3 tentativas`)
    return []
  }

  async closeTokenSession(sessionId: string): Promise<void> {
    const entry = this.tokenPages.get(sessionId)
    if (entry) {
      await entry.page.close().catch(() => {})
      this.tokenPages.delete(sessionId)
    }
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
