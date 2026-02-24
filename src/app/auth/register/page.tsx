'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Stethoscope } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { registerSchema, type RegisterInput } from '@/lib/validations/auth'
import { cn } from '@/lib/utils'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) })

  async function onSubmit(values: RegisterInput) {
    setLoading(true)
    try {
      const INVITE_CODE = process.env.NEXT_PUBLIC_INVITE_CODE ?? 'DEDICARE2026'
      if (values.invite_code !== INVITE_CODE) {
        throw new Error('Codigo de convite invalido')
      }
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { full_name: values.full_name },
        },
      })
      if (error) throw error
      toast.success('Conta criada! Verifique seu email para confirmar.')
      router.push('/auth/login')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar conta'
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
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Criar conta</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Acesso mediante convite</p>
        </div>

        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {[
              { name: 'full_name' as const, label: 'Nome completo', type: 'text', placeholder: 'Seu nome' },
              { name: 'email' as const, label: 'Email', type: 'email', placeholder: 'voce@dedicare.com.br' },
              { name: 'password' as const, label: 'Senha', type: 'password', placeholder: '••••••••' },
              { name: 'invite_code' as const, label: 'Codigo de convite', type: 'text', placeholder: 'DEDICARE2026' },
            ].map(({ name, label, type, placeholder }) => (
              <div key={name}>
                <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1.5">
                  {label}
                </label>
                <input
                  {...register(name)}
                  type={type}
                  placeholder={placeholder}
                  className={cn(
                    'w-full px-3.5 py-2.5 rounded-lg bg-[var(--color-surface)] border text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] text-sm',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                    errors[name] ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'
                  )}
                />
                {errors[name] && (
                  <p className="mt-1 text-xs text-[var(--color-danger)]">{errors[name]?.message}</p>
                )}
              </div>
            ))}

            <button
              type="submit"
              disabled={loading}
              className={cn(
                'w-full py-2.5 rounded-lg font-medium text-sm text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] transition-colors mt-2',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-card)]',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {loading ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
            Ja tem conta?{' '}
            <a
              href="/auth/login"
              className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:underline"
            >
              Entrar
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
