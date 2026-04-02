import https from 'https'

export interface CproResult {
  procedimentosCadastrados: number
  userId: string | null
  /** Raw numeric value (e.g. 60.72) for DB storage */
  valorTotal: number | null
  /** Formatted value for display (e.g. "R$ 60,72") */
  valorTotalFormatado: string | null
  /** Professional data from /by-guide-number endpoint (for TISS) */
  profissional: {
    cpf: string | null
    nome: string | null
    conselho: string | null
    numeroConselho: string | null
    uf: string | null
    cbos: string | null
  } | null
}

export interface CproConfig {
  api_url: string
  api_key: string
  company: string
}

/** Max retries for transient CPro API failures (404, 502, 503, timeout) */
const CPRO_MAX_RETRIES = 2
const CPRO_RETRY_DELAY_MS = 1500

/**
 * Makes an HTTPS GET request to ConsultorioPro API.
 * The server uses a self-signed cert on a private IP (same VPS network).
 * TLS verification is disabled because the cert is self-signed — acceptable
 * only because the API runs on the same trusted infrastructure (VPS 157.173.120.60).
 * TODO: Replace with proper CA-pinned cert when CPro migrates to a public domain.
 *
 * Includes automatic retry for transient errors (404, 5xx, timeout, connection errors).
 */
function cproGet(
  config: CproConfig,
  path: string
): Promise<{ status: number; body: string } | null> {
  const url = `${config.api_url}${path}`

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    console.error('[CPRO] URL invalida:', url)
    return Promise.resolve(null)
  }

  const requestPath = parsed.pathname + parsed.search

  const doRequest = (): Promise<{ status: number; body: string } | null> =>
    new Promise((resolve) => {
      const options: https.RequestOptions = {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: requestPath,
        method: 'GET',
        headers: {
          'X-API-Key': config.api_key,
          Host: 'consultoriopro.com.br',
          Accept: 'application/json',
        },
        rejectUnauthorized: false,
        timeout: 15000,
      }

      const req = https.request(options, (res) => {
        let body = ''
        res.on('data', (chunk: Buffer) => {
          body += chunk.toString()
        })
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, body })
        })
      })

      req.on('error', (err) => {
        console.error(`[CPRO] Erro de conexao (${requestPath}):`, err.message)
        resolve(null)
      })

      req.on('timeout', () => {
        console.error(`[CPRO] Timeout apos 15s (${requestPath})`)
        req.destroy()
        resolve(null)
      })

      req.end()
    })

  const isRetryable = (res: { status: number } | null): boolean => {
    if (!res) return true // connection error or timeout
    // 404 from CPro can be transient (nginx misconfiguration, service restart)
    // 5xx are server errors, always retryable
    return res.status === 404 || res.status >= 500
  }

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

  const execute = async (): Promise<{ status: number; body: string } | null> => {
    for (let attempt = 0; attempt <= CPRO_MAX_RETRIES; attempt++) {
      const res = await doRequest()

      if (res && !isRetryable(res)) {
        return res
      }

      if (attempt < CPRO_MAX_RETRIES && isRetryable(res)) {
        const delay = CPRO_RETRY_DELAY_MS * (attempt + 1)
        console.warn(
          `[CPRO] Tentativa ${attempt + 1}/${CPRO_MAX_RETRIES + 1} falhou` +
          ` (status=${res?.status ?? 'null'}, path=${requestPath}).` +
          ` Retrying em ${delay}ms...`
        )
        await sleep(delay)
        continue
      }

      return res
    }
    return null
  }

  return execute()
}

/**
 * Makes an HTTPS POST request to ConsultorioPro API.
 * Same TLS rationale as cproGet — self-signed cert on private VPS.
 */
function cproPost(
  config: CproConfig,
  path: string,
  body: unknown,
  method: 'POST' | 'PUT' = 'POST'
): Promise<{ status: number; body: string } | null> {
  const url = `${config.api_url}${path}`

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    console.error('[CPRO] URL invalida:', url)
    return Promise.resolve(null)
  }

  const requestPath = parsed.pathname + parsed.search
  const bodyStr = JSON.stringify(body)

  return new Promise((resolve) => {
    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: requestPath,
      method,
      headers: {
        'X-API-Key': config.api_key,
        Host: 'consultoriopro.com.br',
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
      rejectUnauthorized: false,
      timeout: 30000,
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk: Buffer) => {
        data += chunk.toString()
      })
      res.on('end', () => {
        resolve({ status: res.statusCode ?? 0, body: data })
      })
    })

    req.on('error', (err) => {
      console.error(`[CPRO] Erro de conexao POST (${requestPath}):`, err.message)
      resolve(null)
    })

    req.on('timeout', () => {
      console.error(`[CPRO] Timeout apos 30s POST (${requestPath})`)
      req.destroy()
      resolve(null)
    })

    req.write(bodyStr)
    req.end()
  })
}

/**
 * Fetches list of professionals registered in CPro for a company.
 */
export interface CproProfissional {
  id: number
  name: string
  council_code: string | null
  council_number: string | null
  council_uf: string | null
  cbos: string | null
  occupation_name: string | null
}

export async function buscarProfissionaisCpro(
  config: CproConfig
): Promise<CproProfissional[]> {
  const res = await cproGet(
    config,
    `/service/api/v1/professionals/${config.company}`
  )

  if (!res || res.status >= 400) {
    console.error(
      `[CPRO] buscarProfissionaisCpro retornou status ${res?.status ?? 'null'}` +
      ` (company=${config.company})`
    )
    return []
  }

  try {
    const json = JSON.parse(res.body)
    const list = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : [])
    return list.map((p: Record<string, unknown>) => ({
      id: Number(p.id),
      name: (p.name as string) ?? '',
      council_code: (p.council as Record<string, unknown>)?.code as string ?? null,
      council_number: (p.council as Record<string, unknown>)?.number as string ?? null,
      council_uf: (p.council as Record<string, unknown>)?.uf as string ?? null,
      cbos: (p.occupation as Record<string, unknown>)?.cbos as string ?? null,
      occupation_name: (p.occupation as Record<string, unknown>)?.name as string ?? null,
    }))
  } catch (err) {
    console.error('[CPRO] Erro ao parsear profissionais:', err)
    return []
  }
}

/**
 * Searches for a patient in CPro by document (carteira number).
 */
export async function buscarPatientCpro(
  config: CproConfig,
  carteira: string
): Promise<{ id: number; name: string } | null> {
  const res = await cproGet(
    config,
    `/service/api/v1/patients/search?document=${encodeURIComponent(carteira)}&company=${config.company}`
  )

  if (!res || res.status >= 400) {
    console.error(
      `[CPRO] buscarPatientCpro retornou status ${res?.status ?? 'null'}` +
      ` (carteira=${carteira})`
    )
    return null
  }

  try {
    const json = JSON.parse(res.body)
    const patient = json?.data ?? json
    if (patient && typeof patient.id === 'number' && typeof patient.name === 'string') {
      return { id: patient.id, name: patient.name }
    }
    return null
  } catch (err) {
    console.error('[CPRO] Erro ao parsear paciente:', err)
    return null
  }
}

interface CproAgreement {
  id: number
  title: string
  value: number | null
  parent_name: string | null
}

/**
 * Fetches all Unimed agreements from CPro.
 */
async function fetchAgreementsUnimed(
  config: CproConfig
): Promise<CproAgreement[]> {
  const res = await cproGet(
    config,
    `/service/api/v1/executions/agreements?company=${config.company}`
  )

  if (!res || res.status >= 400) {
    console.error(`[CPRO] fetchAgreementsUnimed status ${res?.status ?? 'null'}`)
    return []
  }

  try {
    const json = JSON.parse(res.body)
    const agreements = json?.data?.agreements ?? json?.agreements ?? []
    if (!Array.isArray(agreements)) return []

    return agreements
      .filter((ag: { title?: string; parent_name?: string }) => {
        const title = (ag.title ?? '').toLowerCase()
        const parent = (ag.parent_name ?? '').toLowerCase()
        return title.includes('unimed') || parent.includes('unimed')
      })
      .map((ag: { id: string | number; title: string; value?: string | number | null; parent_name?: string }) => ({
        id: Number(ag.id),
        title: ag.title ?? '',
        value: ag.value != null ? Number(ag.value) : null,
        parent_name: ag.parent_name ?? null,
      }))
  } catch (err) {
    console.error('[CPRO] Erro ao parsear agreements:', err)
    return []
  }
}

/**
 * Fetches Unimed child agreements (with value) for display in the modal.
 */
export async function buscarAgreementsUnimed(
  config: CproConfig
): Promise<Array<{ id: number; title: string; value: number | null }>> {
  const all = await fetchAgreementsUnimed(config)
  // Return only children with parent_name (actual procedures, not parent "Unimed")
  return all
    .filter((ag) => ag.parent_name)
    .map((ag) => ({ id: ag.id, title: ag.title, value: ag.value }))
}

/**
 * Searches for a patient by name in CPro.
 */
export async function buscarPatientByName(
  config: CproConfig,
  nome: string
): Promise<{ id: number; name: string } | null> {
  const res = await cproGet(
    config,
    `/service/api/v1/patients/search?company=${config.company}&query=${encodeURIComponent(nome)}&limit=5`
  )

  if (!res || res.status >= 400) {
    console.error(`[CPRO] buscarPatientByName status ${res?.status ?? 'null'} (nome=${nome})`)
    return null
  }

  try {
    const json = JSON.parse(res.body)
    const patients = json?.data?.patients ?? json?.patients ?? []
    if (!Array.isArray(patients) || patients.length === 0) return null

    const p = patients[0]
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.name || ''
    return { id: Number(p.id), name }
  } catch (err) {
    console.error('[CPRO] Erro ao parsear paciente por nome:', err)
    return null
  }
}

export interface CproExecucaoPayload {
  company: string | number
  user: number
  user_attendant: number
  patient: number
  agreement: number
  guide_number: string
  appointment_day?: string
  attendance_day: string
  attendance_start: string
  value: number
  type?: string
  status_guide?: string
  status?: string
  authorization_date?: string | null
  password?: string | null
  validate_password?: string | null
  clinical_indication?: string | null
  author?: number
}

export interface CproExecucaoResult {
  success: boolean
  id?: number
  error?: string
}

/**
 * Creates a single execution in CPro via POST /executions.
 */
export async function criarExecucaoCpro(
  config: CproConfig,
  payload: CproExecucaoPayload
): Promise<CproExecucaoResult> {
  const res = await cproPost(
    config,
    '/service/api/v1/executions',
    payload
  )

  if (!res) {
    return { success: false, error: 'Sem resposta do CPro (timeout ou erro de conexao)' }
  }

  try {
    const json = JSON.parse(res.body)

    if (res.status >= 400) {
      const errMsg = json?.message ?? json?.error ?? `HTTP ${res.status}`
      console.error('[CPRO] criarExecucaoCpro erro:', res.status, res.body.slice(0, 300))
      return { success: false, error: errMsg }
    }

    return {
      success: json?.success === true,
      id: typeof json?.data?.id === 'number' ? json.data.id : undefined,
      error: json?.success !== true ? (json?.message ?? 'Resposta inesperada do CPro') : undefined,
    }
  } catch (err) {
    console.error('[CPRO] Erro ao parsear resposta criarExecucaoCpro:', err)
    return { success: false, error: 'Erro ao parsear resposta do CPro' }
  }
}

export interface CproPendingExec {
  id: number
  data: string       // DD/MM/YYYY
  horaInicial: string
  horaFinal: string
}

/**
 * Fetches pending (not yet realized) executions for a guide from CPro.
 */
export async function buscarExecucoesPendentes(
  config: CproConfig,
  guideNumber: string
): Promise<CproPendingExec[]> {
  const res = await cproGet(
    config,
    `/service/api/v1/executions/pending/${guideNumber}?company=${config.company}`
  )

  if (!res || res.status >= 400) {
    console.error(`[CPRO] buscarExecucoesPendentes status ${res?.status ?? 'null'} (guide=${guideNumber})`)
    return []
  }

  try {
    const json = JSON.parse(res.body)
    const procs = json?.data?.procedimentos ?? []
    if (!Array.isArray(procs)) return []
    return procs as CproPendingExec[]
  } catch (err) {
    console.error('[CPRO] Erro ao parsear pendentes:', err)
    return []
  }
}

/**
 * Marks a single CPro execution as realized via PUT /executions/{id}/mark-realized.
 */
export async function marcarExecucaoRealizada(
  config: CproConfig,
  executionId: number,
  data: { attendance_day: string; attendance_start: string; attendance_end: string }
): Promise<{ success: boolean; error?: string }> {
  const res = await cproPost(
    config,
    `/service/api/v1/executions/${executionId}/mark-realized?company=${config.company}`,
    { realized: true, ...data },
    'PUT'
  )

  if (!res) return { success: false, error: 'Sem resposta do CPro' }

  try {
    const json = JSON.parse(res.body)
    if (res.status >= 400) {
      return { success: false, error: json?.message ?? json?.error ?? `HTTP ${res.status}` }
    }
    return { success: json?.success === true }
  } catch {
    return { success: false, error: 'Erro ao parsear resposta' }
  }
}

/**
 * Fetches guide data from ConsultorioPro API.
 *
 * Uses the /executions/by-guide-number/{guia} endpoint which returns:
 *   - totals.count → procedimentosCadastrados
 *   - totals.value_formatted → valorTotal
 *   - attendances[0].professional → professional data (id, cpf, name)
 */
export async function fetchCproData(
  guideNumber: string,
  config: CproConfig
): Promise<CproResult | null> {
  const res = await cproGet(
    config,
    `/service/api/v1/executions/by-guide-number/${guideNumber}?company=${config.company}`
  )

  if (!res || res.status >= 400) {
    console.error(
      `[CPRO] Endpoint retornou status ${res?.status ?? 'null'}` +
      ` para guia ${guideNumber}` +
      ` (url=${config.api_url}, company=${config.company})` +
      ` body=${res?.body?.slice(0, 200) ?? 'null'}`
    )
    return null
  }

  try {
    const json = JSON.parse(res.body)

    if (json?.success !== true || !json?.data) {
      console.error('[CPRO] Resposta sem success/data:', JSON.stringify(json).slice(0, 200))
      return null
    }

    const data = json.data

    // totals.count = number of attendances registered for this guide
    const procedimentosCadastrados = typeof data.totals?.count === 'number'
      ? data.totals.count
      : 0

    // totals.value = raw numeric (e.g. 60.72)
    const valorTotal = typeof data.totals?.value === 'number'
      ? data.totals.value
      : null

    // totals.value_formatted = "60,72" → "R$ 60,72"
    const valorTotalFormatado = data.totals?.value_formatted
      ? `R$ ${data.totals.value_formatted}`
      : null

    // Professional data comes from the first attendance
    let userId: string | null = null
    let profissional: CproResult['profissional'] = null

    const attendances = data.attendances
    if (Array.isArray(attendances) && attendances.length > 0) {
      const prof = attendances[0]?.professional
      if (prof) {
        console.log('[CPRO] professional completo:', JSON.stringify(prof))

        userId = prof.id?.toString() ?? null

        // Fields match the CPro PHP endpoint: council, council_number, council_uf, cbos
        const str = (v: unknown): string | null =>
          typeof v === 'string' && v.trim() !== '' ? v.trim() : null

        profissional = {
          cpf: str(prof.cpf),
          nome: str(prof.name),
          conselho: str(prof.council),
          numeroConselho: str(prof.council_number),
          uf: str(prof.council_uf),
          cbos: str(prof.cbos),
        }
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[CPRO] Result: cadastrados=${procedimentosCadastrados}, userId=${userId}, valor=${valorTotal},` +
        ` prof=${profissional?.nome ?? 'null'}, conselho=${profissional?.conselho ?? 'null'},` +
        ` numeroConselho=${profissional?.numeroConselho ?? 'null'}, uf=${profissional?.uf ?? 'null'},` +
        ` cbos=${profissional?.cbos ?? 'null'}`
      )
    }

    return {
      procedimentosCadastrados,
      userId,
      valorTotal,
      valorTotalFormatado,
      profissional,
    }
  } catch (err) {
    console.error('[CPRO] Erro ao parsear resposta:', err)
    return null
  }
}
