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

/**
 * Makes an HTTPS GET request to ConsultorioPro API.
 * The server uses a self-signed cert on a private IP (same VPS network).
 * TLS verification is disabled because the cert is self-signed — acceptable
 * only because the API runs on the same trusted infrastructure (VPS 157.173.120.60).
 * TODO: Replace with proper CA-pinned cert when CPro migrates to a public domain.
 */
function cproGet(
  config: CproConfig,
  path: string
): Promise<{ status: number; body: string } | null> {
  const url = `${config.api_url}${path}`

  return new Promise((resolve) => {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      console.error('[CPRO] URL invalida:', url)
      resolve(null)
      return
    }

    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'X-API-Key': config.api_key,
        Host: 'consultoriopro.com.br',
        Accept: 'application/json',
      },
      rejectUnauthorized: false,
      timeout: 15000,
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[CPRO] GET ${parsed.hostname}:${parsed.port || 443}${parsed.pathname}${parsed.search}`)
    }

    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', (chunk: Buffer) => {
        body += chunk.toString()
      })
      res.on('end', () => {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[CPRO] Status: ${res.statusCode}, Body: ${body.slice(0, 300)}`)
        }
        resolve({ status: res.statusCode ?? 0, body })
      })
    })

    req.on('error', (err) => {
      console.error('[CPRO] Erro de conexao:', err.message)
      resolve(null)
    })

    req.on('timeout', () => {
      console.error('[CPRO] Timeout apos 15s')
      req.destroy()
      resolve(null)
    })

    req.end()
  })
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
    console.error(`[CPRO] Endpoint retornou status ${res?.status ?? 'null'}`)
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
