import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FormSettingsClient } from './FormSettingsClient'

export default async function FormSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  if (profile.role !== 'super_admin') redirect('/dashboard')

  const adminClient = createAdminClient()

  const { data: company } = await adminClient
    .from('companies')
    .select('slug, form_enabled')
    .limit(1)
    .single()

  const slug = company?.slug || ''
  const formEnabled = company?.form_enabled ?? false

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://plotmanager.com'
  const formUrl = `${baseUrl}/form/${slug}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-gray-900">Form Integration</h1>
        <p className="text-gray-500 mt-1">Let buyers register directly from your website</p>
      </div>

      <FormSettingsClient
        formEnabled={formEnabled}
        formUrl={formUrl}
        slug={slug}
      />
    </div>
  )
}
