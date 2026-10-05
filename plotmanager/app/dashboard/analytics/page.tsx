import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent } from '@/components/ui/Card'
import { BarChart3, TrendingUp, Award } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { REFERRAL_OPTIONS } from '@/lib/constants'

export default async function AnalyticsPage() {
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

  const adminClient = createAdminClient()

  const { data: buyersRaw } = await adminClient
    .from('buyers')
    .select('referral_source, total_amount, amount_paid, number_of_plots, payment_status')

  const buyers = (buyersRaw || []) as Array<{
    referral_source: string | null
    total_amount: number
    amount_paid: number
    number_of_plots: number | null
    payment_status: string
  }>

  // Group by referral source
  const sourceMap: Record<string, { buyers: number; plots: number; revenue: number; collected: number }> = {}

  for (const buyer of buyers) {
    const source = buyer.referral_source || 'Unknown'
    if (!sourceMap[source]) {
      sourceMap[source] = { buyers: 0, plots: 0, revenue: 0, collected: 0 }
    }
    sourceMap[source].buyers += 1
    sourceMap[source].plots += buyer.number_of_plots || 0
    sourceMap[source].revenue += buyer.total_amount || 0
    sourceMap[source].collected += buyer.amount_paid || 0
  }

  // Sort by plots sold (descending)
  const orderedSources = Object.keys(sourceMap).sort(
    (a, b) => sourceMap[b].plots - sourceMap[a].plots
  )

  const tableData = orderedSources.map(source => {
    const d = sourceMap[source]
    return {
      source,
      ...d,
      pctRevenue: buyers.reduce((s, b) => s + (b.total_amount || 0), 0) > 0
        ? (d.revenue / buyers.reduce((s, b) => s + (b.total_amount || 0), 0)) * 100
        : 0,
    }
  })

  const totalSales = buyers.length
  const totalRevenue = buyers.reduce((s, b) => s + (b.total_amount || 0), 0)
  const totalPlots = buyers.reduce((s, b) => s + (b.number_of_plots || 0), 0)
  const topSource = orderedSources.length > 0
    ? orderedSources.reduce((top, s) => sourceMap[s].plots > sourceMap[top].plots ? s : top, orderedSources[0])
    : 'N/A'

  const stats = [
    { label: 'Total Sales', value: totalSales, icon: BarChart3, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Total Revenue', value: formatCurrency(totalRevenue), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Top Source', value: topSource, icon: Award, color: 'text-purple-600', bg: 'bg-purple-50' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-gray-900">Sales Analytics</h1>
        <p className="text-gray-500 mt-1">Track sales performance by referral source</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

      <Card>
        <CardContent className="p-6">
          <h2 className="font-display text-xl font-bold text-gray-900 mb-4">Breakdown by Source</h2>
          {tableData.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-3 font-medium text-gray-600">Source</th>
                      <th className="text-right py-3 px-3 font-medium text-gray-600">Buyers</th>
                      <th className="text-right py-3 px-3 font-medium text-gray-600">Plots Sold</th>
                      <th className="text-right py-3 px-3 font-medium text-gray-600">Revenue</th>
                      <th className="text-right py-3 px-3 font-medium text-gray-600">Collected</th>
                      <th className="text-right py-3 px-3 font-medium text-gray-600">% of Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tableData.map((row) => (
                      <tr key={row.source} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-3 font-medium text-gray-900">{row.source}</td>
                        <td className="py-3 px-3 text-right text-gray-700">{row.buyers}</td>
                        <td className="py-3 px-3 text-right text-gray-700">{row.plots}</td>
                        <td className="py-3 px-3 text-right font-medium text-gray-900">{formatCurrency(row.revenue)}</td>
                        <td className="py-3 px-3 text-right text-gray-700">{formatCurrency(row.collected)}</td>
                        <td className="py-3 px-3 text-right text-gray-700">{row.pctRevenue.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-gray-50">
                      <td className="py-3 px-3 font-bold text-gray-900">Total</td>
                      <td className="py-3 px-3 text-right font-bold text-gray-900">{totalSales}</td>
                      <td className="py-3 px-3 text-right font-bold text-gray-900">{totalPlots}</td>
                      <td className="py-3 px-3 text-right font-bold text-gray-900">{formatCurrency(totalRevenue)}</td>
                      <td className="py-3 px-3 text-right font-bold text-gray-900">{formatCurrency(buyers.reduce((s, b) => s + (b.amount_paid || 0), 0))}</td>
                      <td className="py-3 px-3 text-right font-bold text-gray-900">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-gray-100">
                {tableData.map((row) => (
                  <div key={row.source} className="py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900">{row.source}</p>
                      <span className="text-xs text-gray-500">{row.pctRevenue.toFixed(1)}% of revenue</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Buyers</p>
                        <p className="font-medium text-gray-700">{row.buyers}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Plots Sold</p>
                        <p className="font-medium text-gray-700">{row.plots}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Revenue</p>
                        <p className="font-medium text-gray-900">{formatCurrency(row.revenue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Collected</p>
                        <p className="font-medium text-gray-700">{formatCurrency(row.collected)}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="py-3 bg-gray-50 -mx-6 px-6 mt-2">
                  <p className="font-bold text-gray-900 mb-2">Total</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Buyers</p>
                      <p className="font-bold text-gray-900">{totalSales}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Plots</p>
                      <p className="font-bold text-gray-900">{totalPlots}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Revenue</p>
                      <p className="font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Collected</p>
                      <p className="font-bold text-gray-900">{formatCurrency(buyers.reduce((s, b) => s + (b.amount_paid || 0), 0))}</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No sales data yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
