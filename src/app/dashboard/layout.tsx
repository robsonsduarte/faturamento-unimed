import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { ValidacaoDuplicatasModal } from '@/components/shared/validacao-duplicatas-modal'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex h-screen bg-[var(--color-background)] overflow-hidden">
      <Sidebar role={profile?.role} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header profile={profile} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
      <ValidacaoDuplicatasModal />
    </div>
  )
}
