import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft, MapPin, Building, Users, Calendar } from 'lucide-react'
import { EstateActions } from '@/components/EstateActions'

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  sold_out: 'bg-red-100 text-red-700',
  coming_soon: 'bg-amber-100 text-amber-700',
}

const statusLabels: Record<string, string> = {
  active: 'Active',
  sold_out: 'Sold Out',
  coming_soon: 'Coming Soon',
}

export default async function EstateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const { data: estateRaw } = await supabase
    .from('estates')
    .select('*')
    .eq('id', id)
    .single()

  if (!estateRaw) redirect('/dashboard/estates')

  const estate = estateRaw as {
    id: string
    name: string
    location: string | null
    description: string | null
    total_plots: number
    available_plots: number
    price_per_plot: number
    plot_sizes: Array<{ size: string; price: number }> | null
    status: string
    created_at: string
  }

  // Get buyers associated with this estate
  const { data: buyersRaw } = await supabase
    .from('buyers')
    .select('id, first_name, last_name, email, payment_status')
    .eq('estate_id', id)
    .order('created_at', { ascending: false })

  const buyers = (buyersRaw || []) as Array<{
    id: string
    first_name: string
    last_name: string
    email: string | null
    payment_status: string
  }>

  const soldPlots = estate.total_plots - estate.available_plots
  const soldPercentage = estate.total_plots > 0
    ? Math.round((soldPlots / estate.total_plots) * 100)
    : 0

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Link href="/dashboard/estates">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900">
              {estate.name}
            </h1>
          </div>
        </div>
        <EstateActions estateId={estate.id} estateName={estate.name} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500 mb-1">Total Plots</p>
            <p className="text-2xl font-bold text-gray-900">{estate.total_plots}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500 mb-1">Available Plots</p>
            <p className="text-2xl font-bold text-green-600">{estate.available_plots}</p>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(soldPercentage, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{soldPercentage}% sold</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            {estate.plot_sizes && estate.plot_sizes.length > 0 ? (
              <>
                <p className="text-sm text-gray-500 mb-2">Plot Sizes</p>
                <div className="space-y-1.5">
                  {estate.plot_sizes.map((ps) => (
                    <div key={ps.size} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{ps.size}</span>
                      <span className="font-bold text-gray-900">{formatCurrency(ps.price)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-1">Price per Plot</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(estate.price_per_plot || 0)}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Estate Info */}
        <Card>
          <CardHeader>
            <CardTitle>Estate Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {estate.location && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Location</p>
                  <p className="text-sm text-gray-900">{estate.location}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                <Building className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Value</p>
                <p className="text-sm text-gray-900">
                  {formatCurrency((estate.price_per_plot || 0) * estate.total_plots)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
                <Building className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${statusColors[estate.status] || statusColors.active}`}>
                  {statusLabels[estate.status] || 'Active'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center">
                <Calendar className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Created Date</p>
                <p className="text-sm text-gray-900">{formatDate(estate.created_at)}</p>
              </div>
            </div>
            {estate.description && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Description</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{estate.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Associated Buyers */}
        <Card>
          <CardHeader>
            <CardTitle>Buyers in this Estate ({buyers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {buyers.length > 0 ? (
              <div className="space-y-3">
                {buyers.map((buyer) => (
                  <Link
                    key={buyer.id}
                    href={`/dashboard/buyers/${buyer.id}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center">
                        <Users className="w-4 h-4 text-primary-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {buyer.first_name} {buyer.last_name}
                        </p>
                        <p className="text-xs text-gray-500">{buyer.email || 'No email'}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">
                No buyers associated with this estate yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
