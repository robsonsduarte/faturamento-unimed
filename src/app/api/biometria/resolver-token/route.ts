import { NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { resolverTokenSchema } from '@/lib/validations/biometria'
import { buscarFotoBase64, buscarFotoBase64PorSequence } from '@/lib/services/biometria'
import { getSawClient } from '@/lib/saw/client'
import type { SawCookie } from '@/lib/saw/client'
import type { SawCredentials } from '@/lib/types'
import { fetchCproData, buscarAgreementsUnimed, buscarPatientCpro, buscarPatientByName } from '@/lib/saw/cpro-client'
import { computeGuideStatus } from '@/lib/guide-status'
import { classifyGuia } from '@/lib/carteira'

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function sseEvent(type: string, message: string): string {
  return `data: ${JSON.stringify({ type, message, timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }) })}\n\n`
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, 'biometria-resolver', 5, 60_000)
  if (limited) return limited

  const auth = await requireAuth()
  if (isAuthError(auth)) {
    return new Response(JSON.stringify({ error: 'Nao autenticado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const { user } = auth

  const body = await request.json().catch(() => ({})) as unknown
  const parsed = resolverTokenSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0]?.message ?? 'Dados invalidos' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (type: string, message: string) => {
        controller.enqueue(enc.encode(sseEvent(type, message)))
      }

      const streamTimeout = setTimeout(() => {
        try {
          send('error', 'Timeout: resolucao excedeu 5 minutos')
          controller.close()
        } catch { /* already closed */ }
      }, 5 * 60 * 1000)

      const db = getServiceClient()

      try {
        // Buscar guia
        send('processing', 'Buscando dados da guia...')
        const { data: guia, error: guiaErr } = await db
          .from('guias')
          .select('id, guide_number, paciente, numero_carteira')
          .eq('id', parsed.data.guia_id)
          .single()

        if (guiaErr || !guia) {
          send('error', 'Guia nao encontrada')
          controller.close()
          return
        }

        if (!guia.numero_carteira) {
          send('error', 'Guia sem numero de carteira')
          controller.close()
          return
        }

        // Buscar foto do paciente (pela sequence escolhida ou aleatoria)
        const chosenSequence = parsed.data.photo_sequence ?? null
        send('processing', `[1/9] Buscando foto do paciente${chosenSequence ? ` (foto ${chosenSequence})` : ''}...`)
        const photoBase64 = chosenSequence
          ? await buscarFotoBase64PorSequence(guia.numero_carteira, chosenSequence)
          : await buscarFotoBase64(guia.numero_carteira)

        if (!photoBase64) {
          send('error', 'Foto do paciente nao encontrada. Capture a foto primeiro.')
          controller.close()
          return
        }

        send('success', `[1/9] Foto encontrada para ${guia.paciente?.split(' ')[0] ?? 'paciente'}`)

        // Buscar credenciais SAW do usuario
        send('processing', '[2/9] Verificando sessao SAW...')
        const { data: sawCred } = await db
          .from('saw_credentials')
          .select('*')
          .eq('user_id', user.id)
          .eq('ativo', true)
          .single()

        let loginUrl: string
        let usuario: string
        let senha: string

        if (sawCred) {
          const cred = sawCred as SawCredentials
          loginUrl = cred.login_url
          usuario = cred.usuario
          senha = cred.senha
        } else {
          const { data: integ } = await db
            .from('integracoes')
            .select('config, ativo')
            .eq('slug', 'saw')
            .single()

          if (!integ?.ativo) {
            send('error', 'Credenciais SAW nao configuradas.')
            controller.close()
            return
          }
          const cfg = integ.config as Record<string, string>
          loginUrl = cfg.login_url
          usuario = cfg.usuario
          senha = cfg.senha
        }

        // Verificar/criar sessao SAW
        const { data: existingSession } = await db
          .from('saw_sessions')
          .select('cookies')
          .eq('user_id', user.id)
          .eq('valida', true)
          .gte('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        let cookies: SawCookie[] | null = existingSession?.cookies
          ? (existingSession.cookies as SawCookie[])
          : null

        if (cookies) {
          const valid = await getSawClient().validateSession(user.id, cookies)
          if (!valid) {
            send('info', '[2/9] Sessao expirou. Refazendo login...')
            cookies = null
            await db.from('saw_sessions').update({ valida: false }).eq('user_id', user.id).eq('valida', true)
          }
        }

        if (!cookies) {
          send('processing', '[2/9] Fazendo login no SAW...')
          const loginResult = await getSawClient().login(user.id, {
            login_url: loginUrl,
            usuario,
            senha,
          })

          if (!loginResult.success) {
            send('error', `Login SAW falhou: ${loginResult.error}`)
            controller.close()
            return
          }

          cookies = loginResult.cookies
          await db.from('saw_sessions').insert({
            user_id: user.id,
            cookies,
            valida: true,
            expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          })

          send('success', '[2/9] Login SAW realizado.')
        } else {
          send('success', '[2/9] Sessao SAW ativa.')
        }

        // Resolver token via Playwright (com progresso SSE)
        send('processing', `[3/9] Abrindo guia ${guia.guide_number}...`)
        const result = await getSawClient().resolveToken(
          user.id,
          cookies,
          guia.guide_number,
          photoBase64,
          (step, msg) => {
            const isError = msg.toLowerCase().includes('erro') || msg.toLowerCase().includes('falha') || msg.toLowerCase().includes('nao encontrad')
            send(isError ? 'error' : 'processing', `[${step}] ${msg.trim()}`)
          }
        )

        if (!result.success) {
          send('error', `Falha ao resolver token: ${result.error}`)
          controller.close()
          return
        }

        send('success', '[9/9] Biometria autenticada com sucesso!')

        // Marcar guia
        await db
          .from('guias')
          .update({
            token_biometrico: true,
            data_token: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', guia.id)

        // Marcar foto usada com token_used_at
        if (chosenSequence) {
          await db
            .from('biometria_fotos')
            .update({ token_used_at: new Date().toISOString() })
            .eq('numero_carteira', guia.numero_carteira)
            .eq('sequence', chosenSequence)
        }

        // Reimportar guia: SAW readGuide + CPro fetch + DB save (inline)
        send('processing', '[9/9] Reimportando guia (SAW + CPro)...')
        try {
          // 1. Ler guia do SAW
          const readResult = await getSawClient().readGuide(user.id, cookies, guia.guide_number)
          if (!readResult.success || !readResult.data) {
            send('info', `Reimportacao SAW falhou (${readResult.error}). Reimporte manualmente.`)
          } else {
            const sawData = readResult.data as Record<string, unknown>
            send('info', `SAW lido: ${typeof sawData['procedimentosRealizados'] === 'number' ? sawData['procedimentosRealizados'] : 0} procedimentos realizados`)

            // 2. Buscar CPro
            let cproData: Record<string, unknown> | null = null
            const { data: integ } = await db.from('integracoes').select('config, ativo').eq('slug', 'cpro').single()
            const cproConfig = integ?.ativo ? (integ.config as Record<string, string>) : null

            if (cproConfig?.api_url && cproConfig?.api_key) {
              try {
                send('processing', 'Buscando dados CPro...')
                const cproCfg = { api_url: cproConfig.api_url, api_key: cproConfig.api_key, company: cproConfig.company ?? '1' }
                const cproResult = await fetchCproData(guia.guide_number, cproCfg)

                if (cproResult) {
                  cproData = {
                    procedimentosCadastrados: cproResult.procedimentosCadastrados,
                    userId: cproResult.userId,
                    valorTotal: cproResult.valorTotal,
                    valorTotalFormatado: cproResult.valorTotalFormatado,
                    profissional: cproResult.profissional,
                  }

                  const codigoProc = typeof sawData['codigoProcedimentoSolicitado'] === 'string' ? sawData['codigoProcedimentoSolicitado'] as string : ''
                  const rawNome = sawData['nomeBeneficiario']
                  const pacienteNome = (typeof rawNome === 'string' && rawNome.trim() !== '' ? rawNome.trim() : null) as string | null
                  const rawCarteira = sawData['numeroCarteira']
                  const carteiraBusca = (typeof rawCarteira === 'string' && rawCarteira.trim() !== '' ? rawCarteira.trim().replace(/^0?865/, '') : null) as string | null

                  const [agreements, patientByDoc, patientByName] = await Promise.all([
                    buscarAgreementsUnimed(cproCfg),
                    carteiraBusca ? buscarPatientCpro(cproCfg, carteiraBusca) : Promise.resolve(null),
                    pacienteNome ? buscarPatientByName(cproCfg, pacienteNome) : Promise.resolve(null),
                  ])
                  const patient = patientByDoc ?? patientByName
                  const matchedAg = codigoProc ? agreements.find((ag) => ag.title.startsWith(codigoProc)) : null

                  if (matchedAg) { cproData.agreement_id = matchedAg.id; cproData.agreement_value = matchedAg.value; cproData.agreement_title = matchedAg.title }
                  if (patient) { cproData.patient_id = patient.id; cproData.patient_name = patient.name }
                  if (cproResult.userId) { cproData.user_id = Number(cproResult.userId) }
                  send('info', `CPro: ${cproResult.procedimentosCadastrados} procedimento(s) cadastrado(s)`)
                } else {
                  send('info', 'CPro: guia nao encontrada na API')
                }
              } catch (cproErr) {
                send('info', `CPro falhou (${cproErr instanceof Error ? cproErr.message : 'erro'}) — continuando sem CPro`)
              }
            }

            // 3. Helpers
            const orNull = (v: unknown): unknown => typeof v === 'string' && v.trim() === '' ? null : (v ?? null)
            const parseDate = (v: unknown): string | null => {
              if (typeof v !== 'string' || !v.trim()) return null
              const match = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
              return match ? `${match[3]}-${match[2]}-${match[1]}` : null
            }

            // 4. Compute status
            const procedimentosRealizados = typeof sawData['procedimentosRealizados'] === 'number' ? sawData['procedimentosRealizados'] as number : 0
            const quantidadeAutorizada = typeof sawData['quantidadeAutorizada'] === 'number' ? sawData['quantidadeAutorizada'] as number : null
            const procedimentosCadastrados = typeof cproData?.['procedimentosCadastrados'] === 'number' ? cproData['procedimentosCadastrados'] as number : null
            const tokenMessage = typeof sawData['tokenMessage'] === 'string' ? sawData['tokenMessage'] as string : ''
            const senhaRaw = typeof sawData['senha'] === 'string' ? sawData['senha'] as string : null
            const dataAutorizacaoRaw = typeof sawData['dataAutorizacao'] === 'string' ? sawData['dataAutorizacao'] as string : null
            const sawStatus = typeof sawData['status'] === 'string' ? sawData['status'] as string : null

            const status = computeGuideStatus(procedimentosCadastrados, procedimentosRealizados, quantidadeAutorizada, tokenMessage, senhaRaw, dataAutorizacaoRaw, sawStatus)

            // Preserve FATURADA/PROCESSADA
            const PRESERVED = ['FATURADA', 'PROCESSADA']
            const { data: existingGuia } = await db.from('guias').select('status').eq('guide_number', guia.guide_number).single()
            const finalStatus = existingGuia && PRESERVED.includes(existingGuia.status) ? existingGuia.status : status

            const numeroCarteira = orNull(sawData['numeroCarteira']) as string | null

            // 5. Build payload
            const guiaPayload: Record<string, unknown> = {
              guide_number: guia.guide_number,
              guide_number_prestador: orNull(sawData['numeroGuiaPrestador']),
              paciente: orNull(sawData['nomeBeneficiario']) ?? null,
              numero_carteira: numeroCarteira,
              senha: orNull(sawData['senha']),
              data_autorizacao: parseDate(sawData['dataAutorizacao']),
              data_validade_senha: parseDate(sawData['dataValidadeSenha']),
              data_solicitacao: parseDate(sawData['dataSolicitacao']),
              quantidade_solicitada: typeof sawData['quantidadeSolicitada'] === 'number' ? sawData['quantidadeSolicitada'] : null,
              quantidade_autorizada: quantidadeAutorizada,
              procedimentos_realizados: procedimentosRealizados,
              codigo_prestador: orNull(sawData['codigoPrestador']),
              nome_profissional: orNull(sawData['nomeProfissional']),
              cnes: orNull(sawData['cnes']),
              tipo_atendimento: orNull(sawData['tipoAtendimento']),
              indicacao_acidente: orNull(sawData['indicacaoAcidente']),
              indicacao_clinica: orNull(sawData['indicacaoClinica']),
              tipo_guia: classifyGuia(numeroCarteira),
              token_biometrico: true,
              saw_data: sawData,
              status: finalStatus,
              updated_at: new Date().toISOString(),
            }

            // CPro data
            if (cproData !== null) {
              guiaPayload.cpro_data = cproData
              guiaPayload.procedimentos_cadastrados = procedimentosCadastrados ?? 0
              const agValue = typeof cproData['agreement_value'] === 'number' ? cproData['agreement_value'] as number : null
              const qtdAut = quantidadeAutorizada ?? 0
              if (agValue && agValue > 0 && qtdAut > 0) {
                guiaPayload.valor_total = agValue * qtdAut
              } else {
                guiaPayload.valor_total = typeof cproData['valorTotal'] === 'number' ? cproData['valorTotal'] : null
              }
            }

            // 6. Upsert
            const { error: upsertErr } = await db.from('guias').upsert(guiaPayload, { onConflict: 'guide_number' }).select('id').single()
            if (upsertErr) {
              send('error', `Falha ao salvar: ${upsertErr.message}`)
            } else {
              send('success', `[9/9] Guia reimportada com sucesso! Status: ${finalStatus}`)
            }
          }
        } catch (importErr) {
          const importMsg = importErr instanceof Error ? importErr.message : 'Erro desconhecido'
          send('info', `Reimportacao falhou (${importMsg}). Reimporte manualmente.`)
        }

        send('success', 'Processo concluido!')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro inesperado'
        send('error', `Erro fatal: ${msg}`)
      } finally {
        clearTimeout(streamTimeout)
        try { controller.close() } catch { /* already closed */ }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
