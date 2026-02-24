'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Stethoscope, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/lib/validations/auth'
import { cn } from '@/lib/utils'

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) })

  async function onSubmit(values: ForgotPasswordInput) {
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) throw error
      setSent(true)
      toast.success('Email de recuperacao enviado!')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar email'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)] flex items-center justify-center mb-4">
            <Stethoscope className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Recuperar senha</h1>
        </div>

        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-[var(--color-success)]/20 flex items-center justify-center mx-auto">
                <span className="text-2xl">✓</span>
              </div>
              <p className="text-[var(--color-text)]">Email enviado com sucesso!</p>
              <p className="text-sm text-[var(--color-text-muted)]">
                Verifique sua caixa de entrada e siga as instrucoes para redefinir sua senha.
              </p>
              <a
                href="/auth/login"
                className="inline-flex items-center gap-2 text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar ao login
              </a>
            </div>
          ) : (
            <>
              <p className="text-sm text-[var(--color-text-muted)] mb-6">
                Informe seu email e enviaremos um link para redefinir sua senha.
              </p>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1.5">
                    Email
                  </label>
                  <input
                    {...register('email')}
                    type="email"
                    placeholder="voce@dedicare.com.br"
                    className={cn(
                      'w-full px-3.5 py-2.5 rounded-lg bg-[var(--color-surface)] border text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] text-sm',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                      errors.email ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'
                    )}
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.email.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={cn(
                    'w-full py-2.5 rounded-lg font-medium text-sm text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {loading ? 'Enviando...' : 'Enviar link de recuperacao'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <a
                  href="/auth/login"
                  className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                >
                  <ArrowLeft className="w-4 h-4" /> Voltar ao login
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
