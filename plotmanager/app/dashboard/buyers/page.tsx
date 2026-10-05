import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { Plus, Search, Users } from 'lucide-react'
import { BUYER_STATUS_COLORS, BUYER_STATUS_LABELS, ALLOCATION_STATUS_COLORS, ALLOCATION_STATUS_LABELS } from '@/lib/constants'

export default async function BuyersPage({
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
    .from('buyers')
    .select('id, first_name, last_name, email, phone, plot_location, plot_number, payment_status, allocation_status, total_amount, amount_paid, estates(name)')
    .order('created_at', { ascending: false })

  if (params.status && params.status !== 'all') {
    query = query.eq('payment_status', params.status)
  }

  if (params.search) {
    query = query.or(
      `first_name.ilike.%${params.search}%,last_name.ilike.%${params.search}%,email.ilike.%${params.search}%,plot_location.ilike.%${params.search}%`
    )
  }

  const { data: buyersRaw } = await query

  const buyers = (buyersRaw || []) as Array<{
    id: string
    first_name: string
    last_name: string
    email: string | null
    phone: string | null
    plot_location: string | null
    plot_number: string | null
    payment_status: string
    allocation_status: string
    total_amount: number
    amount_paid: number
    estates: { name: string } | null
  }>

  const activeStatus = params.status || 'all'

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900">Buyers</h1>
          <p className="text-gray-500 mt-1">Manage your land buyers</p>
        </div>
        <Link href="/dashboard/buyers/new">
          <Button className="w-full sm:w-auto">
            <Plus className="w-5 h-5 mr-2" />
            Add New Buyer
          </Button>
        </Link>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <form className="flex-1" action="/dashboard/buyers" method="GET">
              {activeStatus !== 'all' && (
                <input type="hidden" name="status" value={activeStatus} />
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  name="search"
                  defaultValue={params.search || ''}
                  placeholder="Search by name, email, or location..."
                  className="flex h-11 w-full rounded-lg border-2 border-gray-200 bg-white pl-10 pr-4 py-2 text-base text-gray-900 transition-colors placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
            </form>
            <div className="flex gap-2 flex-wrap">
              {['all', 'installment', 'overdue', 'fully_paid'].map((status) => (
                <Link
                  key={status}
                  href={`/dashboard/buyers?status=${status}${params.search ? `&search=${params.search}` : ''}`}
                >
                  <button
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeStatus === status
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {status === 'all' ? 'All' : BUYER_STATUS_LABELS[status]}
                  </button>
                </Link>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Buyers List */}
      {buyers.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-sm font-medium text-gray-500 px-6 py-4">Name</th>
                    <th className="text-left text-sm font-medium text-gray-500 px-6 py-4">Estate</th>
                    <th className="text-left text-sm font-medium text-gray-500 px-6 py-4">Status</th>
                    <th className="text-left text-sm font-medium text-gray-500 px-6 py-4">Allocation</th>
                    <th className="text-right text-sm font-medium text-gray-500 px-6 py-4">Total Amount</th>
                    <th className="text-right text-sm font-medium text-gray-500 px-6 py-4">Amount Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {buyers.map((buyer) => (
                    <tr key={buyer.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <Link href={`/dashboard/buyers/${buyer.id}`} className="block">
                          <p className="font-medium text-gray-900">{buyer.first_name} {buyer.last_name}</p>
                          <p className="text-sm text-gray-500">{buyer.email || buyer.phone || 'No contact'}</p>
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {buyer.estates?.name || 'N/A'}
                        {buyer.plot_number && <span className="text-gray-400"> (Plot {buyer.plot_number})</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${BUYER_STATUS_COLORS[buyer.payment_status] || BUYER_STATUS_COLORS.installment}`}>
                          {BUYER_STATUS_LABELS[buyer.payment_status] || 'Installment'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${ALLOCATION_STATUS_COLORS[buyer.allocation_status] || ALLOCATION_STATUS_COLORS.not_allocated}`}>
                          {ALLOCATION_STATUS_LABELS[buyer.allocation_status] || 'Not Allocated'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">
                        {formatCurrency(buyer.total_amount || 0)}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">
                        {formatCurrency(buyer.amount_paid || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {buyers.map((buyer) => (
                <Link
                  key={buyer.id}
                  href={`/dashboard/buyers/${buyer.id}`}
                  className="block p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900">
                      {buyer.first_name} {buyer.last_name}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ALLOCATION_STATUS_COLORS[buyer.allocation_status] || ALLOCATION_STATUS_COLORS.not_allocated}`}>
                        {ALLOCATION_STATUS_LABELS[buyer.allocation_status] || 'Not Allocated'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${BUYER_STATUS_COLORS[buyer.payment_status] || BUYER_STATUS_COLORS.installment}`}>
                        {BUYER_STATUS_LABELS[buyer.payment_status] || 'Installment'}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mb-2">
                    {buyer.estates?.name || 'No estate'}
                    {buyer.plot_number && ` - Plot ${buyer.plot_number}`}
                  </p>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total: {formatCurrency(buyer.total_amount || 0)}</span>
                    <span className="text-gray-900 font-medium">Paid: {formatCurrency(buyer.amount_paid || 0)}</span>
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
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No buyers found</h3>
            <p className="text-gray-500 mb-6">
              {params.search || params.status
                ? 'Try adjusting your search or filter criteria.'
                : 'Get started by adding your first buyer.'}
            </p>
            {!params.search && !params.status && (
              <Link href="/dashboard/buyers/new">
                <Button>
                  <Plus className="w-5 h-5 mr-2" />
                  Add First Buyer
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
