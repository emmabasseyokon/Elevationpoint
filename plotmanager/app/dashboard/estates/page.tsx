import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { Plus, Search, Building } from 'lucide-react'
import { ESTATE_STATUS_COLORS, ESTATE_STATUS_LABELS } from '@/lib/constants'

export default async function EstatesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  let query = supabase
    .from('estates')
    .select('id, name, location, total_plots, available_plots, price_per_plot, status, plot_sizes')
    .order('created_at', { ascending: false })

  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status)
  }

  if (params.search) {
    query = query.or(
      `name.ilike.%${params.search}%,location.ilike.%${params.search}%`
    )
  }

  const { data: estatesRaw } = await query

  const estates = (estatesRaw || []) as Array<{
    id: string
    name: string
    location: string | null
    total_plots: number
    available_plots: number
    price_per_plot: number
    status: string
    plot_sizes: Array<{ size: string; price: number; is_default?: boolean }> | null
  }>

  const activeStatus = params.status || 'all'

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900">Estates</h1>
          <p className="text-gray-500 mt-1">Manage your estate portfolio</p>
        </div>
        <Link href="/dashboard/estates/new">
          <Button className="w-full sm:w-auto">
            <Plus className="w-5 h-5 mr-2" />
            Add New Estate
          </Button>
        </Link>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <form className="flex-1" action="/dashboard/estates" method="GET">
              {activeStatus !== 'all' && (
                <input type="hidden" name="status" value={activeStatus} />
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  name="search"
                  defaultValue={params.search || ''}
                  placeholder="Search by name or location..."
                  className="flex h-11 w-full rounded-lg border-2 border-gray-200 bg-white pl-10 pr-4 py-2 text-base text-gray-900 transition-colors placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
            </form>
            <div className="flex gap-2 flex-wrap">
              {['all', 'active', 'sold_out', 'coming_soon'].map((status) => (
                <Link
                  key={status}
                  href={`/dashboard/estates?status=${status}${params.search ? `&search=${params.search}` : ''}`}
                >
                  <button
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeStatus === status
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {status === 'all' ? 'All' : ESTATE_STATUS_LABELS[status]}
                  </button>
                </Link>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estates List */}
      {estates.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-sm font-medium text-gray-500 px-6 py-4">Name</th>
                    <th className="text-left text-sm font-medium text-gray-500 px-6 py-4">Location</th>
                    <th className="text-left text-sm font-medium text-gray-500 px-6 py-4">Plots</th>
                    <th className="text-right text-sm font-medium text-gray-500 px-6 py-4">Price per Plot</th>
                    <th className="text-left text-sm font-medium text-gray-500 px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {estates.map((estate) => (
                    <tr key={estate.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <Link href={`/dashboard/estates/${estate.id}`} className="block">
                          <p className="font-medium text-gray-900">{estate.name}</p>
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {estate.location || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        <span className="font-medium text-gray-900">{estate.available_plots}</span>
                        <span className="text-gray-400"> / {estate.total_plots}</span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">
                        {estate.plot_sizes && estate.plot_sizes.length > 1 ? 'From ' : ''}{formatCurrency(estate.price_per_plot || 0)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${ESTATE_STATUS_COLORS[estate.status] || ESTATE_STATUS_COLORS.active}`}>
                          {ESTATE_STATUS_LABELS[estate.status] || 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {estates.map((estate) => (
                <Link
                  key={estate.id}
                  href={`/dashboard/estates/${estate.id}`}
                  className="block p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900">{estate.name}</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${ESTATE_STATUS_COLORS[estate.status] || ESTATE_STATUS_COLORS.active}`}>
                      {ESTATE_STATUS_LABELS[estate.status] || 'Active'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mb-2">{estate.location || 'No location'}</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      Plots: {estate.available_plots}/{estate.total_plots}
                    </span>
                    <span className="text-gray-900 font-medium">
                      {estate.plot_sizes && estate.plot_sizes.length > 1 ? 'From ' : ''}{formatCurrency(estate.price_per_plot || 0)}/plot
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Building className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No estates found</h3>
            <p className="text-gray-500 mb-6">
              {params.search || params.status
                ? 'Try adjusting your search or filter criteria.'
                : 'Get started by adding your first estate.'}
            </p>
            {!params.search && !params.status && (
              <Link href="/dashboard/estates/new">
                <Button>
                  <Plus className="w-5 h-5 mr-2" />
                  Add First Estate
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
