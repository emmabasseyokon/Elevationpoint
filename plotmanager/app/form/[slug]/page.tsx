import { createAdminClient } from '@/lib/supabase/admin'
import { PublicBuyerForm } from '@/components/PublicBuyerForm'
import { MapPin } from 'lucide-react'
import Link from 'next/link'

interface FormPageProps {
  params: Promise<{ slug: string }>
}

export default async function PublicFormPage({ params }: FormPageProps) {
  const { slug } = await params
  const adminClient = createAdminClient()

  // Fetch company
  const { data: company } = await adminClient
    .from('companies')
    .select('id, name, slug, form_enabled')
    .eq('slug', slug)
    .single()

  if (!company) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Form Not Found</h1>
          <p className="text-gray-500">This registration form does not exist.</p>
        </div>
      </div>
    )
  }

  if (!company.form_enabled) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Form Unavailable</h1>
          <p className="text-gray-500">This registration form is currently not available. Please contact {company.name} directly.</p>
        </div>
      </div>
    )
  }

  // Fetch active estates
  const { data: estatesRaw } = await adminClient
    .from('estates')
    .select('id, name, location, price_per_plot, plot_sizes')
    .eq('status', 'active')
    .gt('available_plots', 0)
    .order('name')

  const estates = (estatesRaw || []).map((e) => ({
    id: e.id,
    name: e.name,
    location: e.location || '',
    price_per_plot: e.price_per_plot || 0,
    plot_sizes: (e.plot_sizes || []) as Array<{ size: string; price: number }>,
  }))

  // Fetch active agents for referral selection
  const { data: agentsRaw } = await adminClient
    .from('agents')
    .select('id, first_name, last_name')
    .eq('status', 'active')
    .order('first_name')

  return (
    <div>
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-gray-900">{company.name}</h1>
              <p className="text-sm text-gray-500">Land Subscription Form</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <PublicBuyerForm
          companySlug={company.slug}
          companyName={company.name}
          estates={estates}
          agents={agentsRaw || []}
        />
      </div>
    </div>
  )
}
