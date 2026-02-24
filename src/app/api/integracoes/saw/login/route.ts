import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSawClient } from '@/lib/saw/client'
import type { SawConfig } from '@/lib/types'

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const { data: integracao, error: integracaoError } = await supabase
      .from('integracoes')
      .select('config, ativo')
      .eq('slug', 'saw')
      .single()

    if (integracaoError || !integracao) {
      return NextResponse.json({ error: 'Configuracao SAW nao encontrada' }, { status: 500 })
    }

    if (!integracao.ativo) {
      return NextResponse.json({ error: 'Integracao SAW esta desativada' }, { status: 400 })
    }

    const config = integracao.config as SawConfig

    if (!config.login_url || !config.usuario || !config.senha) {
      return NextResponse.json(
        { error: 'Configuracao SAW incompleta: login_url, usuario e senha sao obrigatorios' },
        { status: 500 }
      )
    }

    const result = await getSawClient().login({
      login_url: config.login_url,
      usuario: config.usuario,
      senha: config.senha,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? 'Falha no login SAW' },
        { status: 502 }
      )
    }

    await supabase.from('saw_sessions').insert({
      cookies: result.cookies,
      valida: true,
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
