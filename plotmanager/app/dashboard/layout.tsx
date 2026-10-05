import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/Sidebar'
import type { Tables } from '@/types/database.types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  console.log('[DashboardLayout] user:', user?.id ?? 'null', 'error:', userError?.message ?? 'none')

  if (!user) {
    console.log('[DashboardLayout] No user, redirecting to /login')
    redirect('/login')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  console.log('[DashboardLayout] profile:', profile?.id ?? 'null', 'error:', profileError?.message ?? 'none')

  if (!profile) {
    console.log('[DashboardLayout] No profile found, redirecting to /login')
    redirect('/login')
  }

  const typedProfile = profile as Tables<'profiles'>

  console.log('[DashboardLayout] Auth OK — rendering dashboard for', typedProfile.email)

  return (
    <div className="flex min-h-screen">
      <Sidebar
        userRole={typedProfile.role as 'super_admin' | 'admin'}
        userName={typedProfile.full_name}
      />
      <main className="flex-1 lg:ml-0">
        <div className="p-6 lg:p-8 pt-20 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  )
}
