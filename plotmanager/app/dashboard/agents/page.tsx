import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { Plus, Search, UserPlus } from 'lucide-react'
import { AGENT_STATUS_COLORS, AGENT_STATUS_LABELS } from '@/lib/constants'

export default async function AgentsPage({
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
    .from('agents')
    .select('id, first_name, last_name, email, phone, commission_type, commission_rate, status')
    .order('created_at', { ascending: false })

  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status)
  }

  if (params.search) {
    query = query.or(
      `first_name.ilike.%${params.search}%,last_name.ilike.%${params.search}%,email.ilike.%${params.search}%,phone.ilike.%${params.search}%`
    )
  }

  const { data: agentsRaw } = await query

  const agents = (agentsRaw || []) as Array<{
    id: string
    first_name: string
    last_name: string
    email: string | null
    phone: string | null
    commission_type: string
    commission_rate: number
    status: string
  }>

  // Fetch referral counts per agent
  const agentIds = agents.map(a => a.id)
  const referralCounts: Record<string, number> = {}
  if (agentIds.length > 0) {
    const { data: commissionsRaw } = await supabase
      .from('commissions')
      .select('agent_id')
      .in('agent_id', agentIds)

    for (const c of commissionsRaw || []) {
      referralCounts[c.agent_id] = (referralCounts[c.agent_id] || 0) + 1
    }
  }

  const activeStatus = params.status || 'all'

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900">Agents</h1>
          <p className="text-gray-500 mt-1">Manage your sales agents</p>
        </div>
        <Link href="/dashboard/agents/new">
          <Button className="w-full sm:w-auto">
            <Plus className="w-5 h-5 mr-2" />
            Add New Agent
          </Button>
        </Link>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <form className="flex-1" action="/dashboard/agents" method="GET">
              {activeStatus !== 'all' && (
                <input type="hidden" name="status" value={activeStatus} />
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  name="search"
                  defaultValue={params.search || ''}
                  placeholder="Search by name, email, or phone..."
                  className="flex h-11 w-full rounded-lg border-2 border-gray-200 bg-white pl-10 pr-4 py-2 text-base text-gray-900 transition-colors placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
            </form>
            <div className="flex gap-2 flex-wrap">
              {['all', 'active', 'inactive'].map((status) => (
                <Link
                  key={status}
                  href={`/dashboard/agents?status=${status}${params.search ? `&search=${params.search}` : ''}`}
                >
                  <button
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeStatus === status
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {status === 'all' ? 'All' : AGENT_STATUS_LABELS[status]}
                  </button>
                </Link>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agents List */}
      {agents.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-sm font-medium text-gray-500 px-6 py-4">Name</th>
                    <th className="text-left text-sm font-medium text-gray-500 px-6 py-4">Phone</th>
                    <th className="text-left text-sm font-medium text-gray-500 px-6 py-4">Commission</th>
                    <th className="text-center text-sm font-medium text-gray-500 px-6 py-4">Referrals</th>
                    <th className="text-left text-sm font-medium text-gray-500 px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => (
                    <tr key={agent.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <Link href={`/dashboard/agents/${agent.id}`} className="block">
                          <p className="font-medium text-gray-900">{agent.first_name} {agent.last_name}</p>
                          <p className="text-sm text-gray-500">{agent.email || 'No email'}</p>
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {agent.phone || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {agent.commission_type === 'percentage'
                          ? `${agent.commission_rate}%`
                          : formatCurrency(agent.commission_rate)}
                      </td>
                      <td className="px-6 py-4 text-center text-gray-600">
                        {referralCounts[agent.id] || 0}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${AGENT_STATUS_COLORS[agent.status] || AGENT_STATUS_COLORS.active}`}>
                          {AGENT_STATUS_LABELS[agent.status] || 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {agents.map((agent) => (
                <Link
                  key={agent.id}
                  href={`/dashboard/agents/${agent.id}`}
                  className="block p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900">
                      {agent.first_name} {agent.last_name}
                    </p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${AGENT_STATUS_COLORS[agent.status] || AGENT_STATUS_COLORS.active}`}>
                      {AGENT_STATUS_LABELS[agent.status] || 'Active'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mb-1">
                    {agent.email || agent.phone || 'No contact'}
                  </p>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{agent.phone || 'No phone'}</span>
                    <span className="text-gray-500">Referrals: {referralCounts[agent.id] || 0}</span>
                    <span className="text-gray-900 font-medium">
                      {agent.commission_type === 'percentage'
                        ? `${agent.commission_rate}%`
                        : formatCurrency(agent.commission_rate)}
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
              <UserPlus className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No agents found</h3>
            <p className="text-gray-500 mb-6">
              {params.search || params.status
                ? 'Try adjusting your search or filter criteria.'
                : 'Get started by adding your first agent.'}
            </p>
            {!params.search && !params.status && (
              <Link href="/dashboard/agents/new">
                <Button>
                  <Plus className="w-5 h-5 mr-2" />
                  Add First Agent
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
