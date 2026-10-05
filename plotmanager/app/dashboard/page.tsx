import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent } from '@/components/ui/Card'
import { Users, Wallet, AlertTriangle, CheckCircle, CalendarClock } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }


  const { count: totalBuyers } = await supabase
    .from('buyers')
    .select('*', { count: 'exact', head: true })

  const { data: buyersRaw } = await supabase
    .from('buyers')
    .select('total_amount, amount_paid, payment_status')

  const buyers = (buyersRaw || []) as Array<{ total_amount: number; amount_paid: number; payment_status: string }>

  const totalRevenue = buyers.reduce((sum, b) => sum + (b.amount_paid || 0), 0)
  const totalOutstanding = buyers.reduce((sum, b) => sum + ((b.total_amount || 0) - (b.amount_paid || 0)), 0)
  const overdueBuyers = buyers.filter(b => b.payment_status === 'overdue').length
  const fullyPaidBuyers = buyers.filter(b => b.payment_status === 'fully_paid').length

  const stats = [
    { label: 'Total Buyers', value: totalBuyers || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Total Revenue', value: formatCurrency(totalRevenue), icon: Wallet, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Outstanding Balance', value: formatCurrency(totalOutstanding), icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Fully Paid', value: fullyPaidBuyers, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ]

  const { data: recentBuyersRaw } = await supabase
    .from('buyers')
    .select('id, first_name, last_name, plot_location, payment_status, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  const recentBuyers = (recentBuyersRaw || []) as Array<{
    id: string; first_name: string; last_name: string;
    plot_location: string | null; payment_status: string; created_at: string
  }>

  // Fetch upcoming installment payments (next 30 days)
  const adminClient = createAdminClient()
  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: upcomingRaw } = await adminClient
    .from('payment_schedules')
    .select('id, due_date, expected_amount, paid_amount, status, installment_number, buyer_id, buyers(id, first_name, last_name, estates(name))')
    .in('status', ['unpaid', 'partial', 'overdue'])
    .lte('due_date', thirtyDaysFromNow)
    .order('due_date', { ascending: true })
    .limit(10)

  const upcomingPayments = (upcomingRaw || []) as Array<{
    id: string
    due_date: string
    expected_amount: number
    paid_amount: number
    status: string
    installment_number: number
    buyer_id: string
    buyers: { id: string; first_name: string; last_name: string; estates: { name: string } | null } | null
  }>

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview of your land sales</p>
        </div>
        <Link href="/dashboard/buyers/new">
          <Button className="w-full sm:w-auto">
            <Users className="w-5 h-5 mr-2" />
            Add New Buyer
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-500">{stat.label}</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {overdueBuyers > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-700">
            <strong>{overdueBuyers} buyer{overdueBuyers > 1 ? 's' : ''}</strong> have overdue payments.{' '}
            <Link href="/dashboard/buyers?status=overdue" className="underline font-medium">
              View overdue buyers
            </Link>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardContent className="p-6">
          <h2 className="font-display text-xl font-bold text-gray-900 mb-4">Recent Buyers</h2>
          {recentBuyers && recentBuyers.length > 0 ? (
            <div className="space-y-3">
              {recentBuyers.map((buyer) => {
                const statusColors: Record<string, string> = {
                  fully_paid: 'bg-green-100 text-green-700',
                  installment: 'bg-blue-100 text-blue-700',
                  overdue: 'bg-red-100 text-red-700',
                  pending: 'bg-gray-100 text-gray-700',
                }
                return (
                  <Link
                    key={buyer.id}
                    href={`/dashboard/buyers/${buyer.id}`}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {buyer.first_name} {buyer.last_name}
                      </p>
                      <p className="text-sm text-gray-500">{buyer.plot_location || 'No location set'}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[buyer.payment_status] || statusColors.pending}`}>
                      {buyer.payment_status?.replace('_', ' ')}
                    </span>
                  </Link>
                )
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No buyers yet. Add your first buyer to get started.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock className="w-5 h-5 text-blue-600" />
            <h2 className="font-display text-xl font-bold text-gray-900">Upcoming Payments</h2>
          </div>
          {upcomingPayments.length > 0 ? (
            <div className="space-y-3">
              {upcomingPayments.map((entry) => {
                const remaining = entry.expected_amount - entry.paid_amount
                const isOverdue = entry.due_date < today
                return (
                  <Link
                    key={entry.id}
                    href={`/dashboard/buyers/${entry.buyer_id}`}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {entry.buyers?.first_name} {entry.buyers?.last_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {entry.buyers?.estates?.name || 'No estate'} — Installment #{entry.installment_number}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className={`text-sm font-semibold ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                        {formatCurrency(remaining)}
                      </p>
                      <p className={`text-xs ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
                        {isOverdue ? 'Overdue' : `Due ${formatDate(entry.due_date)}`}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No upcoming installment payments.</p>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
