import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminList } from '@/components/AdminList'

export default async function AdminsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const { data: adminsRaw } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, created_at')
    .order('created_at', { ascending: true })

  const admins = (adminsRaw || []) as Array<{
    id: string
    full_name: string
    email: string
    role: string
    created_at: string
  }>

  return (
    <div className="space-y-8">
      <AdminList
        admins={admins}
        currentUserId={user.id}
        userRole={profile.role}
      />
    </div>
  )
}
