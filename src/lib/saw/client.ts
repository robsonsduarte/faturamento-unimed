import puppeteer from 'puppeteer-core'
import type { Browser, Page, CookieParam } from 'puppeteer-core'

export type SawCookie = CookieParam

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

class SawClient {
  private browser: Browser | null = null

  /**
   * Returns a healthy browser connection. Verifies the WebSocket is alive
   * with a real health check (browser.version()), not just the .connected flag.
   * Automatically reconnects if the connection is stale or dead.
   */
  async getBrowser(): Promise<Browser> {
    if (this.browser) {
      try {
        // Real health check — .connected flag is unreliable
        await Promise.race([
          this.browser.version(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Health check timeout')), 5000)
          ),
        ])
      } catch {
        console.log('[SAW] Browser connection stale, reconnecting...')
        try { this.browser.disconnect() } catch { /* already dead */ }
        this.browser = null
      }
    }

    if (!this.browser) {
      const wsEndpoint = process.env.BROWSERLESS_WS_URL || 'ws://browserless:3000'
      console.log(`[SAW] Connecting to Browserless at ${wsEndpoint}`)
      this.browser = await puppeteer.connect({
        browserWSEndpoint: wsEndpoint,
      })

      // Proactively null reference on unexpected disconnect
      this.browser.on('disconnected', () => {
        console.log('[SAW] Browser disconnected unexpectedly')
        this.browser = null
      })
    }
    return this.browser
  }

  private extractCookies(rawCookies: Awaited<ReturnType<Page['cookies']>>): SawCookie[] {
    return rawCookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expires: c.expires,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite as SawCookie['sameSite'],
    }))
  }

  private async injectCookies(page: Page, cookies: SawCookie[]): Promise<void> {
    await page.goto(SAW_BASE, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.setCookie(...cookies)
  }

  /**
   * Login flow — mirrors production login.js
   */
  async login(config: SawLoginConfig): Promise<SawLoginResult> {
    // getBrowser() handles stale connection detection via health check.
    // Do NOT call this.close() here — it kills connections that
    // forceReconnect() just created, causing the retry loop to fail.
    const browser = await this.getBrowser()
    const page: Page = await browser.newPage()

    try {
      page.setDefaultTimeout(60000)
      await page.setViewport({ width: 1280, height: 720 })

      await page.goto(config.login_url, {
        waitUntil: 'networkidle2',
        timeout: 60000,
      })

      // Wait for document.readyState === 'complete'
      await page.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 }).catch(() => {})

      // Check if already logged in
      const alreadyLogged = await page.evaluate(() => !!document.querySelector('#topoBarraPrincipal'))
      if (alreadyLogged) {
        const rawCookies = await page.cookies()
        return { success: true, cookies: this.extractCookies(rawCookies) }
      }

      // Fill login form
      await page.waitForSelector('#login', { visible: true, timeout: 15000 })
      await page.$eval('#login', (el) => ((el as HTMLInputElement).value = ''))
      await page.click('#login')
      await page.type('#login', config.usuario, { delay: 100 })

      await page.waitForSelector('#password', { visible: true, timeout: 15000 })
      await page.$eval('#password', (el) => ((el as HTMLInputElement).value = ''))
      await page.click('#password')
      await page.type('#password', config.senha, { delay: 100 })

      // Submit — use Promise.race like production login.js
      await page.waitForSelector('#submitForm', { visible: true, timeout: 15000 })
      const urlBeforeLogin = page.url()
      await page.click('#submitForm')

      try {
        await Promise.race([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
          page.waitForFunction(
            (oldUrl: string) => window.location.href !== oldUrl,
            { timeout: 60000 },
            urlBeforeLogin
          ),
        ])
      } catch {
        // Navigation race finished
      }

      await page.waitForFunction(() => document.readyState === 'complete', { timeout: 15000 }).catch(() => {})

      // Validate login — primary: selector, fallback: URL change
      let loginValid = false
      try {
        await page.waitForSelector('#topoBarraPrincipal', { visible: true, timeout: 15000 })
        loginValid = true
      } catch {
        const postLoginUrl = page.url()
        loginValid = !postLoginUrl.includes('Logar.do') && !postLoginUrl.includes('login.jsp')
      }

      if (!loginValid) {
        return { success: false, cookies: [], error: 'Login falhou - verifique credenciais' }
      }

      // Close any popup (entendi, ok, confirmar) — matches production
      try {
        await page.evaluate(() => {
          const botoes = Array.from(document.querySelectorAll('button, input[type="button"], a'))
          const botao = botoes.find((btn) => {
            const text = (btn.textContent ?? '').toLowerCase()
            return text.includes('entendi') || text.includes('ok') || text.includes('confirmar')
          })
          if (botao) (botao as HTMLElement).click()
        })
        await page.waitForFunction(() => document.readyState === 'complete', { timeout: 3000 }).catch(() => {})
      } catch {
        // No popup to close
      }

      const rawCookies = await page.cookies()
      return { success: true, cookies: this.extractCookies(rawCookies) }
    } catch (err) {
      return {
        success: false,
        cookies: [],
        error: err instanceof Error ? err.message : 'Erro desconhecido no login',
      }
    } finally {
      await page.close().catch(() => {})
    }
  }

  /**
   * Session validation — mirrors production testarSessao.js
   * Navigates to login page and checks if #topoBarraPrincipal appears
   */
  async validateSession(cookies: SawCookie[]): Promise<boolean> {
    let page: Page | null = null

    try {
      const browser = await this.getBrowser()
      page = await browser.newPage()
      page.setDefaultTimeout(20000)
      await this.injectCookies(page, cookies)

      await page.goto(`${SAW_BASE}/saw/Logar.do?method=abrirSAW`, {
        waitUntil: 'networkidle2',
        timeout: 20000,
      })

      return await page.evaluate(() => !!document.querySelector('#topoBarraPrincipal'))
    } catch {
      return false
    } finally {
      if (page) await page.close().catch(() => {})
    }
  }

  /**
   * Read guide data — mirrors production lerGuias.js EXACTLY
   * 1. Navigate directly to SP/SADT 4.0 detail using numeroDaGuia + isConsultaNaGuia=true
   * 2. Scrape using textoDepois helper (div.caixaVerde/caixaBranca/div + label)
   * 3. Extract quantities from #procedimentos table (FIRST ROW)
   * 4. Count realized procedures from table.caixaBranca with "36-Data" header
   * 5. Apply TISS code mappings (conselho, CBO, tipoAtendimento, indicacaoAcidente)
   */
  async readGuide(
    cookies: SawCookie[],
    numeroGuia: string
  ): Promise<SawReadGuideResult> {
    let page: Page | null = null

    try {
      const browser = await this.getBrowser()
      page = await browser.newPage()
      await page.setDefaultTimeout(30000)
      await page.setViewport({ width: 1400, height: 900 })
      await this.injectCookies(page, cookies)

      // Navigate directly using numeroDaGuia + isConsultaNaGuia (matches production)
      const url = `${SAW_BASE}/saw/tiss/SolicitacaoDeSPSADT40.do?method=consultarGuiaDeSPSADT&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.numeroDaGuia=${encodeURIComponent(numeroGuia)}&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.isConsultaNaGuia=true`

      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

      // Check for session expiry (both patterns, like production)
      if (page.url().includes('Logar.do') || page.url().includes('login.jsp')) {
        return { success: false, error: 'Sessao SAW expirou. Refaca o login.' }
      }

      // Wait 1.5s for page JS to settle (matches production)
      await new Promise<void>((r) => setTimeout(r, 1500))

      // Scrape data — mirrors production lerGuias.js evaluate block
      const resultado = await page.evaluate((numGuia) => {
        try {
          /* ===========================
             HELPER: text after a label
             Searches div.caixaVerde, div.caixaBranca AND generic div
          =========================== */
          function extrairTextoDepoisDeLabel(labelText: string): string | null {
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

          /* ===========================
             STATUS (red bold text)
          =========================== */
          const statusElement = document.querySelector('b[style*="color: red"]') as HTMLElement | null
          const status = statusElement ? statusElement.textContent?.trim() ?? null : null

          /* ===========================
             BASIC FIELDS
          =========================== */
          const dataAutorizacao = extrairTextoDepoisDeLabel('4-Data da Autoriza')
          const senha = extrairTextoDepoisDeLabel('5-Senha')
          const dataValidadeSenha = extrairTextoDepoisDeLabel('6-Data Validade da Senha')
          const nomeBeneficiario = extrairTextoDepoisDeLabel('10-Nome')

          /* ===========================
             GUIA OPERADORA (span bold)
          =========================== */
          let numeroGuiaOperadora: string | null = null
          const divNumeroGuia = Array.from(document.querySelectorAll('div.caixaBranca')).find(
            (div) => (div as HTMLElement).textContent?.includes('7-N')
          )
          if (divNumeroGuia) {
            const span = divNumeroGuia.querySelector('span[style*="font-weight: bold"]') as HTMLElement | null
            if (span) numeroGuiaOperadora = span.textContent?.trim().replace(/\u00a0/g, '') ?? null
          }

          /* ===========================
             GUIA PRESTADOR (span bold)
          =========================== */
          let numeroGuiaPrestador: string | null = null
          const divGuiaPrestador = Array.from(document.querySelectorAll('div.caixaBrancaSemBorda')).find(
            (div) => (div as HTMLElement).textContent?.includes('2-N')
          )
          if (divGuiaPrestador) {
            const span = divGuiaPrestador.querySelector('span[style*="font-weight: bold"]') as HTMLElement | null
            if (span) numeroGuiaPrestador = span.textContent?.trim().replace(/\u00a0/g, '') ?? null
          }

          /* ===========================
             NUMERO CARTEIRA (keep only digits)
             SAW format: "865 - 0057941759008" or "0865 0057941759008"
          =========================== */
          let numeroCarteira = extrairTextoDepoisDeLabel('8-N')
          if (numeroCarteira) {
            numeroCarteira = numeroCarteira.replace(/\D/g, '') || null
          }

          /* ===========================
             CONTRATADO / PROFISSIONAL
          =========================== */
          const codigoPrestador = extrairTextoDepoisDeLabel('13-C')
          const nomeContratado = extrairTextoDepoisDeLabel('14-Nome do Contratado')
          const nomeProfissional = extrairTextoDepoisDeLabel('15-Nome do Profissional')

          /* ===========================
             CONSELHO PROFISSIONAL (w/ TISS mapping)
          =========================== */
          let conselhoProfissional = extrairTextoDepoisDeLabel('16-Conselho')
          if (conselhoProfissional) {
            if (conselhoProfissional.includes('Psicologia')) conselhoProfissional = '09'
            else if (conselhoProfissional.includes('Fonoaudiologia')) conselhoProfissional = '08'
            else if (conselhoProfissional.includes('Nutri')) conselhoProfissional = '07'
            else if (conselhoProfissional.includes('Medicina')) conselhoProfissional = '06'
          }

          const numeroConselhoProfissional = extrairTextoDepoisDeLabel('17-N')
          const ufProfissional = extrairTextoDepoisDeLabel('18-UF')

          /* ===========================
             CBO PROFISSIONAL (w/ TISS mapping)
          =========================== */
          let cbosProfissional = extrairTextoDepoisDeLabel('19-C')
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

          /* ===========================
             SOLICITACAO E ATENDIMENTO
          =========================== */
          let dataSolicitacao = extrairTextoDepoisDeLabel('22-Data')
          if (dataSolicitacao && dataSolicitacao.includes(' - ')) {
            dataSolicitacao = dataSolicitacao.split(' - ')[0].trim()
          }

          const indicacaoClinica = extrairTextoDepoisDeLabel('23-Indica')
          const cnes = extrairTextoDepoisDeLabel('31-CNES')

          let tipoAtendimento = extrairTextoDepoisDeLabel('32-Tipo Atendimento')
          if (tipoAtendimento && tipoAtendimento.includes('Outras Terapias')) tipoAtendimento = '03'

          let indicacaoAcidente = extrairTextoDepoisDeLabel('33-Indica')
          if (indicacaoAcidente) {
            const lowerAcid = indicacaoAcidente.toLowerCase()
            if (lowerAcid.includes('trabalho')) indicacaoAcidente = '0'
            else if (lowerAcid.includes('trânsito') || lowerAcid.includes('transito')) indicacaoAcidente = '1'
            else indicacaoAcidente = '9' // Não acidente (default para clínica terapêutica)
          }

          /* ===========================
             QUANTITIES FROM #procedimentos table
             FIRST ROW ONLY (matches production break)
          =========================== */
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

          /* =====================================================
             PROCEDIMENTOS REALIZADOS
             Search table.caixaBranca with "36-Data" header
             (matches production exactly)
          ===================================================== */
          let procedimentosRealizados = 0

          const todasTabelas = document.querySelectorAll('table.caixaBranca')
          // Diagnostic logging (appears in Puppeteer console)
          console.log('[SAW-SCRAPE] Total table.caixaBranca encontradas:', todasTabelas.length)
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

          console.log('[SAW-SCRAPE] procedimentosRealizados:', procedimentosRealizados)

          /* ===========================
             PROCEDURE DETAILS (for DB)
          =========================== */
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

          // Find the realized procedures table and extract row details
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
              if (td.length < 12) {
                console.log('[SAW-SCRAPE] Row', i, 'ignorada: apenas', td.length, 'colunas (esperado >= 12)')
                continue
              }

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

          /* ===========================
             TOKEN / CHECK-IN MESSAGE
          =========================== */
          const bodyText = document.body?.innerText ?? ''
          const tokenMessage = bodyText.includes('Realize o check-in do Paciente')
            ? 'Realize o check-in do Paciente'
            : ''

          /* ===========================
             CHAVE DA GUIA (para download XML)
          =========================== */
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

      // Validacao de mismatch: procedimentos reportados mas nao extraidos
      const procRealizados = (resultado as Record<string, unknown>).procedimentosRealizados as number
      const procDetalhes = ((resultado as Record<string, unknown>).procedimentosDetalhes as unknown[]) ?? []

      if (procRealizados > 0 && procDetalhes.length === 0) {
        console.error(`[SAW] ALERTA: Guia ${numeroGuia} — ${procRealizados} procedimentos reportados mas 0 extraidos (possivel mudanca na estrutura HTML SAW)`)
      }

      console.log(`[SAW] Guia ${numeroGuia}: ${procRealizados} realizados, ${procDetalhes.length} detalhes extraidos`)

      // Download XML while still on the guide page (SAW requires server-side session context)
      let xmlContent: string | null = null
      const resData = resultado as Record<string, unknown>

      if (resData.temXML && resData.chave) {
        try {
          const xmlUrl = `${SAW_BASE}/saw/tiss/SolicitacaoDeSPSADT40.do?method=gerarXMLTISSDeGuia&manterTISSSPSADT40DTO.tissSolicitacaoDeSPSADTDTO.chave=${resData.chave}`
          xmlContent = await page.evaluate(async (url: string) => {
            const resp = await fetch(url, { credentials: 'include' })
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
  }

  /**
   * Force reconnect — disconnect current browser and create a fresh connection.
   * Used after "session closed" errors from Browserless.
   */
  async forceReconnect(): Promise<void> {
    console.log('[SAW] Force reconnecting to Browserless...')
    if (this.browser) {
      try { this.browser.disconnect() } catch { /* ignore */ }
      this.browser = null
    }
    await this.getBrowser()
    console.log('[SAW] Reconnected to Browserless successfully')
  }

  async close(): Promise<void> {
    if (this.browser) {
      this.browser.disconnect()
      this.browser = null
    }
  }
}

let instance: SawClient | null = null

export function getSawClient(): SawClient {
  if (!instance) instance = new SawClient()
  return instance
}
