import { NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { getSawClient } from '@/lib/saw/client'
import type { SawCookie } from '@/lib/saw/client'
import type { SawCredentials } from '@/lib/types'
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

/**
 * POST /api/biometria/excluir-cobrancas
 * SSE — exclui execucoes/cobrancas no SAW com verificacao e retry
 *
 * Body: { guia_id, modo: 'all' | 'individual', execucao_ids?: number[] }
 */
export async function POST(request: NextRequest) {
  const limited = rateLimit(request, 'biometria-excluir', 5, 60_000)
  if (limited) return limited

  const auth = await requireAuth()
  if (isAuthError(auth)) {
    return new Response(JSON.stringify({ error: 'Nao autenticado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const { user } = auth

  const body = await request.json().catch(() => ({})) as {
    guia_id?: string
    modo?: 'all' | 'individual'
    execucao_ids?: number[]
  }

  if (!body.guia_id) {
    return new Response(JSON.stringify({ error: 'guia_id obrigatorio' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (body.modo !== 'all' && body.modo !== 'individual') {
    return new Response(JSON.stringify({ error: 'modo invalido (all | individual)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (body.modo === 'individual' && (!body.execucao_ids || body.execucao_ids.length === 0)) {
    return new Response(JSON.stringify({ error: 'execucao_ids obrigatorio no modo individual' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      controller.enqueue(enc.encode(':' + ' '.repeat(8192) + '\n\n'))
      const heartbeat = setInterval(() => {
        try { controller.enqueue(enc.encode(`: hb${' '.repeat(2048)}\n\n`)) } catch { /* closed */ }
      }, 1000)
      const send = async (type: string, message: string) => {
        controller.enqueue(enc.encode(':' + ' '.repeat(2048) + '\n\n' + sseEvent(type, message)))
        await new Promise<void>((r) => setImmediate(r))
      }

      // Timeout proporcional: 3min base + 2min por item
      const numItems = body.modo === 'all' ? 1 : (body.execucao_ids?.length ?? 1)
      const timeoutMs = (3 + numItems * 2) * 60 * 1000
      const timeout = setTimeout(() => {
        try {
          controller.enqueue(enc.encode(':' + ' '.repeat(2048) + '\n\n' + sseEvent('error', `Timeout: operacao excedeu ${Math.round(timeoutMs / 60000)} minutos`)))
          controller.close()
        } catch { /**/ }
      }, timeoutMs)

      const db = getServiceClient()
      const MAX_RETRIES = 2

      try {
        // 1. Buscar guia
        await send('processing', '[1/5] Buscando dados da guia...')
        const { data: guia } = await db
          .from('guias')
          .select('id, guide_number, paciente, numero_carteira, procedimentos_realizados, quantidade_autorizada')
          .eq('id', body.guia_id)
          .single()

        if (!guia) { await send('error', 'Guia nao encontrada'); controller.close(); return }

        // 2. Credenciais SAW
        await send('processing', '[2/5] Verificando sessao SAW...')
        const { data: sawCred } = await db.from('saw_credentials').select('*').eq('user_id', user.id).eq('ativo', true).single()

        let loginUrl: string, usuario: string, senha: string
        if (sawCred) {
          const cred = sawCred as SawCredentials
          loginUrl = cred.login_url; usuario = cred.usuario; senha = cred.senha
        } else {
          const { data: integ } = await db.from('integracoes').select('config, ativo').eq('slug', 'saw').single()
          if (!integ?.ativo) { await send('error', 'Credenciais SAW nao configuradas'); controller.close(); return }
          const cfg = integ.config as Record<string, string>
          loginUrl = cfg.login_url; usuario = cfg.usuario; senha = cfg.senha
        }

        // 3. Reuso de sessao ou login
        const { data: session } = await db.from('saw_sessions').select('cookies')
          .eq('user_id', user.id).eq('valida', true)
          .gte('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false }).limit(1).single()

        let cookies: SawCookie[] | null = session?.cookies as SawCookie[] | null

        if (!cookies) {
          await send('processing', '[2/5] Fazendo login no SAW...')
          const loginResult = await getSawClient().login(user.id, { login_url: loginUrl, usuario, senha })
          if (!loginResult.success) { await send('error', `Login falhou: ${loginResult.error}`); controller.close(); return }
          cookies = loginResult.cookies
          await db.from('saw_sessions').insert({
            user_id: user.id, cookies, valida: true,
            expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          })
          await send('success', '[2/5] Login SAW realizado.')
        } else {
          await send('success', '[2/5] Sessao SAW ativa.')
        }

        // 4. readGuide inicial — ler estado atual do SAW
        await send('processing', '[3/5] Lendo estado atual da guia no SAW...')
        const readInicial = await getSawClient().readGuide(user.id, cookies, guia.guide_number)
        if (!readInicial.success || !readInicial.data) {
          await send('error', `Falha ao ler guia inicial: ${readInicial.error ?? 'sem detalhes'}`)
          controller.close(); return
        }

        let realizadosAntes = typeof readInicial.data['procedimentosRealizados'] === 'number'
          ? readInicial.data['procedimentosRealizados'] as number
          : (guia.procedimentos_realizados ?? 0)

        if (realizadosAntes === 0) {
          await send('info', 'Guia nao possui cobrancas para excluir.')
          controller.close(); return
        }

        await send('success', `[3/5] ${realizadosAntes} cobranca(s) atualmente no SAW`)

        let lastReadData: Record<string, unknown> | null = readInicial.data
        let totalExcluidos = 0
        let pipelineAbortado = false

        if (body.modo === 'all') {
          // ─── Modo all: 1 call + verificacao ──────────────
          await send('processing', `[4/5] Removendo todas as ${realizadosAntes} cobranca(s)...`)

          const result = await getSawClient().excluirExecucoes(
            user.id, cookies, guia.guide_number, 'all', undefined,
            async (_step, msg) => { await send('processing', `[4/5] ${msg}`) },
          )

          if (!result.success) {
            await send('error', `Falha ao remover todas: ${result.error ?? 'sem detalhes'}`)
            pipelineAbortado = true
          } else {
            // Verificar via readGuide
            await send('processing', `[4/5] Verificando remocao...`)
            const readAfter = await getSawClient().readGuide(user.id, cookies, guia.guide_number)
            if (readAfter.success && readAfter.data) {
              lastReadData = readAfter.data
              const realizadosDepois = typeof readAfter.data['procedimentosRealizados'] === 'number'
                ? readAfter.data['procedimentosRealizados'] as number
                : realizadosAntes

              if (realizadosDepois === 0) {
                totalExcluidos = realizadosAntes
                await send('success', `[4/5] Todas as ${realizadosAntes} cobranca(s) removidas com sucesso!`)
              } else {
                await send('error', `[4/5] Remocao nao confirmada. Ainda restam ${realizadosDepois} cobranca(s) no SAW.`)
                pipelineAbortado = true
                totalExcluidos = realizadosAntes - realizadosDepois
              }
            } else {
              await send('error', `[4/5] Falha ao verificar estado apos remocao: ${readAfter.error ?? 'erro'}`)
              pipelineAbortado = true
            }
          }
        } else {
          // ─── Modo individual: loop com retry 2x ──────────
          const ids = body.execucao_ids ?? []
          await send('processing', `[4/5] Excluindo ${ids.length} cobranca(s) individualmente...`)

          for (let i = 0; i < ids.length; i++) {
            const execId = ids[i]
            const stepLabel = `[${i + 1}/${ids.length}]`

            let excluidoComSucesso = false

            for (let retry = 0; retry <= MAX_RETRIES; retry++) {
              const tentativaLabel = retry > 0 ? ` (tentativa ${retry + 1}/3)` : ''
              await send('processing', `${stepLabel} Excluindo execucao ${execId}${tentativaLabel}...`)

              const result = await getSawClient().excluirExecucoes(
                user.id, cookies, guia.guide_number, 'individual', [execId],
                async (_step, msg) => { await send('processing', `${stepLabel} ${msg}`) },
              )

              if (!result.success && result.totalExcluido === 0) {
                await send('info', `${stepLabel} Exclusao retornou erro: ${result.error ?? result.resultados[0]?.error ?? 'sem detalhes'}`)
                if (retry < MAX_RETRIES) {
                  await send('info', `${stepLabel} Tentando novamente...`)
                  continue
                }
              }

              // Verificar via readGuide: procedimentosRealizados diminuiu?
              await send('processing', `${stepLabel} Verificando exclusao...`)
              const readAfter = await getSawClient().readGuide(user.id, cookies, guia.guide_number)

              if (readAfter.success && readAfter.data) {
                lastReadData = readAfter.data
                const realizadosDepois = typeof readAfter.data['procedimentosRealizados'] === 'number'
                  ? readAfter.data['procedimentosRealizados'] as number
                  : realizadosAntes

                if (realizadosDepois < realizadosAntes) {
                  realizadosAntes = realizadosDepois
                  totalExcluidos++
                  excluidoComSucesso = true
                  await send('success', `${stepLabel} Execucao ${execId} removida! (realizados: ${realizadosDepois})`)
                  break
                } else {
                  if (retry < MAX_RETRIES) {
                    await send('info', `${stepLabel} Remocao nao confirmada (realizados: ${realizadosDepois}, esperado: <${realizadosAntes}). Tentando novamente...`)
                  } else {
                    await send('error', `${stepLabel} Remocao de ${execId} nao confirmada apos ${MAX_RETRIES + 1} tentativas. Pipeline encerrado.`)
                  }
                }
              } else {
                if (retry < MAX_RETRIES) {
                  await send('info', `${stepLabel} Falha ao verificar guia: ${readAfter.error ?? 'erro'}. Tentando novamente...`)
                } else {
                  await send('error', `${stepLabel} Falha ao verificar guia apos ${MAX_RETRIES + 1} tentativas. Pipeline encerrado.`)
                }
              }
            }

            if (!excluidoComSucesso) {
              pipelineAbortado = true
              break
            }
          }
        }

        // 5. Reimportacao real: salvar dados atualizados no banco
        if (lastReadData) {
          await send('processing', '[5/5] Salvando dados atualizados no banco...')

          const sawData = lastReadData
          const orNull = (v: unknown): unknown =>
            typeof v === 'string' && v.trim() === '' ? null : (v ?? null)
          const parseDate = (v: unknown): string | null => {
            if (typeof v !== 'string' || !v.trim()) return null
            const match = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
            if (match) return `${match[3]}-${match[2]}-${match[1]}`
            return null
          }

          const procedimentosRealizados = typeof sawData['procedimentosRealizados'] === 'number'
            ? sawData['procedimentosRealizados'] as number : 0
          const quantidadeAutorizada = typeof sawData['quantidadeAutorizada'] === 'number'
            ? sawData['quantidadeAutorizada'] as number : guia.quantidade_autorizada ?? 0
          const quantidadeSolicitada = typeof sawData['quantidadeSolicitada'] === 'number'
            ? sawData['quantidadeSolicitada'] as number : null
          const tokenMessage = typeof sawData['tokenMessage'] === 'string'
            ? sawData['tokenMessage'] as string : ''
          const senhaRaw = typeof sawData['senha'] === 'string' ? sawData['senha'] as string : null
          const dataAutorizacaoRaw = typeof sawData['dataAutorizacao'] === 'string' ? sawData['dataAutorizacao'] as string : null
          const sawStatus = typeof sawData['status'] === 'string' ? sawData['status'] as string : null

          const { data: guiaAtual } = await db
            .from('guias')
            .select('procedimentos_cadastrados, cpro_data, mes_referencia')
            .eq('id', guia.id)
            .single()

          const procedimentosCadastrados = guiaAtual?.procedimentos_cadastrados ?? 0
          const cproDataExisting = guiaAtual?.cpro_data as Record<string, unknown> | null
          const agreementValuePerSession = typeof cproDataExisting?.['agreement_value'] === 'number'
            ? cproDataExisting['agreement_value'] as number : null

          const status = computeGuideStatus(
            procedimentosCadastrados,
            procedimentosRealizados,
            quantidadeAutorizada,
            tokenMessage,
            senhaRaw,
            dataAutorizacaoRaw,
            sawStatus
          )

          // Preservar FATURADA/PROCESSADA
          const { data: existingGuia } = await db.from('guias').select('status').eq('id', guia.id).single()
          const PRESERVED_STATUSES = ['FATURADA', 'PROCESSADA']
          const finalStatus = existingGuia && PRESERVED_STATUSES.includes(existingGuia.status)
            ? existingGuia.status : status

          const numeroCarteira = orNull(sawData['numeroCarteira']) as string | null
          const tipoGuia = classifyGuia(numeroCarteira)

          await db.from('guias').update({
            paciente: orNull(sawData['nomeBeneficiario']) ?? guia.paciente,
            numero_carteira: numeroCarteira ?? guia.numero_carteira,
            senha: orNull(sawData['senha']),
            data_autorizacao: parseDate(sawData['dataAutorizacao']),
            data_validade_senha: parseDate(sawData['dataValidadeSenha']),
            data_solicitacao: parseDate(sawData['dataSolicitacao']),
            quantidade_solicitada: quantidadeSolicitada,
            quantidade_autorizada: quantidadeAutorizada,
            procedimentos_realizados: procedimentosRealizados,
            codigo_prestador: orNull(sawData['codigoPrestador']),
            nome_profissional: orNull(sawData['nomeProfissional']),
            cnes: orNull(sawData['cnes']),
            tipo_atendimento: orNull(sawData['tipoAtendimento']),
            indicacao_acidente: orNull(sawData['indicacaoAcidente']),
            indicacao_clinica: orNull(sawData['indicacaoClinica']),
            tipo_guia: tipoGuia,
            token_biometrico: tokenMessage === 'Realize o check-in do Paciente',
            saw_data: sawData,
            status: finalStatus,
            updated_at: new Date().toISOString(),
          }).eq('id', guia.id)

          // Reinserir procedimentos realizados com dados fresh
          const sawProcDetalhes = (sawData['procedimentosDetalhes'] ?? []) as Array<Record<string, string>>

          // Sempre deletar os antigos (ate mesmo se lista nova esta vazia)
          await db.from('procedimentos').delete().eq('guia_id', guia.id)

          if (sawProcDetalhes.length > 0) {
            const profNome = orNull(sawData['nomeProfissional']) as string | null
            const profConselho = orNull(sawData['conselhoProfissional']) as string | null
            const profNumConselho = orNull(sawData['numeroConselhoProfissional']) as string | null
            const profUf = orNull(sawData['ufProfissional']) as string | null
            const profCbos = orNull(sawData['cbosProfissional']) as string | null

            const procRows = sawProcDetalhes.map((p, idx) => ({
              guia_id: guia.id,
              chave: `${guia.id}-${p.sequencia ?? idx + 1}`,
              sequencia: parseInt(p.sequencia ?? String(idx + 1), 10),
              codigo_tabela: p.tabela || null,
              codigo_procedimento: p.codigoProcedimento || null,
              descricao: p.descricao || null,
              data_execucao: parseDate(p.data),
              hora_inicio: p.horaInicio || null,
              hora_fim: p.horaFim || null,
              quantidade_executada: parseInt(p.quantidade ?? '1', 10) || 1,
              via_acesso: p.via || null,
              tecnica_utilizada: p.tecnica || null,
              reducao_acrescimo: parseFloat(p.reducaoAcrescimo ?? '1') || 1,
              valor_unitario: agreementValuePerSession ?? (p.valorUnitario ? parseFloat(p.valorUnitario) : null),
              valor_total: agreementValuePerSession ?? (p.valorTotal ? parseFloat(p.valorTotal) : null),
              nome_profissional: profNome,
              conselho: profConselho,
              numero_conselho: profNumConselho,
              uf: profUf,
              cbos: profCbos,
              status: 'Importado' as const,
            }))

            const { error: procError } = await db.from('procedimentos').insert(procRows)
            if (procError) {
              await send('info', `Falha ao salvar procedimentos: ${procError.message}`)
            } else {
              await send('success', `${procRows.length} procedimento(s) restante(s) salvos no banco`)
            }
          } else {
            await send('success', 'Nenhum procedimento restante no banco')
          }

          await send('success', `Guia atualizada: status=${finalStatus}, realizados=${procedimentosRealizados}`)
        }

        if (pipelineAbortado) {
          await send('error', `Pipeline encerrado: ${totalExcluidos} cobranca(s) excluida(s). Verifique o restante manualmente.`)
        } else {
          await send('success', `Concluido: ${totalExcluidos} cobranca(s) excluida(s) com sucesso!`)
        }
      } catch (err) {
        await send('error', `Erro fatal: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
      } finally {
        clearTimeout(timeout)
        clearInterval(heartbeat)
        try { controller.close() } catch { /**/ }
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
