import { createClient } from '@/lib/supabase/server'

export interface UserProfile {
  userId: string
  email: string
  role: 'super_admin' | 'admin'
  fullName: string
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  const typedProfile = profile as { role: string; full_name: string }

  return {
    userId: user.id,
    email: user.email || '',
    role: typedProfile.role as 'super_admin' | 'admin',
    fullName: typedProfile.full_name || '',
  }
}
