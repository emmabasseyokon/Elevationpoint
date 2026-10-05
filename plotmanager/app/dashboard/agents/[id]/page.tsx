import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import {
  ArrowLeft,
  Mail,
  Phone,
  Building,
  DollarSign,
  Users,
} from 'lucide-react'
import {
  AGENT_STATUS_COLORS,
  AGENT_STATUS_LABELS,
  COMMISSION_TYPE_LABELS,
} from '@/lib/constants'
import { CommissionStatusToggle } from '@/components/CommissionStatusToggle'

export default async function AgentDetailPage({
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

  const { data: agentRaw } = await supabase
    .from('agents')
    .select('*')
    .eq('id', id)
    .single()

  if (!agentRaw) redirect('/dashboard/agents')

  const agent = agentRaw as {
    id: string
    first_name: string
    last_name: string
    email: string | null
    phone: string | null
    bank_name: string | null
    bank_account_number: string | null
    bank_account_name: string | null
    commission_type: string
    commission_rate: number
    status: string
    notes: string | null
    created_at: string
  }

  // Fetch commissions for this agent with buyer & estate info
  const { data: commissionsRaw } = await supabase
    .from('commissions')
    .select('*, buyers(first_name, last_name, estate_id, estates(name))')
    .eq('agent_id', id)
    .order('created_at', { ascending: false })

  const commissions = (commissionsRaw || []) as Array<{
    id: string
    buyer_id: string
    commission_amount: number
    amount_paid: number
    status: string
    created_at: string
    buyers: {
      first_name: string
      last_name: string
      estate_id: string | null
      estates: { name: string } | null
    } | null
  }>

  // Compute summary figures
  const totalReferrals = commissions.length
  const totalCommission = commissions.reduce((sum, c) => sum + (c.commission_amount || 0), 0)
  const totalPaidOut = commissions
    .filter(c => c.status === 'paid')
    .reduce((sum, c) => sum + (c.commission_amount || 0), 0)
  const totalUnpaid = commissions
    .filter(c => c.status !== 'paid')
    .reduce((sum, c) => sum + (c.commission_amount || 0), 0)

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Link href="/dashboard/agents">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900">
              {agent.first_name} {agent.last_name}
            </h1>
          </div>
        </div>
        <Link href={`/dashboard/agents/${id}/edit`}>
          <Button>Edit Agent</Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-sm text-gray-500">Total Referrals</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalReferrals}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-sm text-gray-500">Total Commission</p>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{formatCurrency(totalCommission)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-sm text-gray-500">Paid Out</p>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-green-600 truncate">{formatCurrency(totalPaidOut)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-sm text-gray-500">Unpaid</p>
            </div>
            <p className={`text-lg sm:text-2xl font-bold truncate ${totalUnpaid > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(totalUnpaid)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Two-column grid: Contact Info + Bank Details / Commission Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {agent.email && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Mail className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="text-sm text-gray-900">{agent.email}</p>
                </div>
              </div>
            )}
            {agent.phone && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
                  <Phone className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Phone</p>
                  <p className="text-sm text-gray-900">{agent.phone}</p>
                </div>
              </div>
            )}
            {!agent.email && !agent.phone && (
              <p className="text-sm text-gray-400">No contact information provided.</p>
            )}
            <div className="border-t border-gray-100 pt-4 mt-2">
              <p className="text-xs text-gray-500 mb-1">Status</p>
              <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${AGENT_STATUS_COLORS[agent.status] || AGENT_STATUS_COLORS.active}`}>
                {AGENT_STATUS_LABELS[agent.status] || 'Active'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Bank Details + Commission Settings */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Bank Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {agent.bank_name || agent.bank_account_number || agent.bank_account_name ? (
                <>
                  {agent.bank_name && (
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center">
                        <Building className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Bank Name</p>
                        <p className="text-sm text-gray-900">{agent.bank_name}</p>
                      </div>
                    </div>
                  )}
                  {agent.bank_account_number && (
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-cyan-50 rounded-lg flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-cyan-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Account Number</p>
                        <p className="text-sm text-gray-900">{agent.bank_account_number}</p>
                      </div>
                    </div>
                  )}
                  {agent.bank_account_name && (
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-teal-50 rounded-lg flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-teal-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Account Name</p>
                        <p className="text-sm text-gray-900">{agent.bank_account_name}</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-400">No bank details provided.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Commission Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Commission Type</p>
                  <p className="text-sm text-gray-900">
                    {COMMISSION_TYPE_LABELS[agent.commission_type] || agent.commission_type}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-rose-50 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-rose-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Commission Rate</p>
                  <p className="text-sm text-gray-900">
                    {agent.commission_type === 'percentage'
                      ? `${agent.commission_rate}%`
                      : formatCurrency(agent.commission_rate)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Notes */}
      {agent.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{agent.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Referred Buyers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Referred Buyers</CardTitle>
        </CardHeader>
        <CardContent>
          {commissions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-3 font-medium text-gray-600">Buyer Name</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-600">Estate</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-600">Commission Amount</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-600">Paid</th>
                    <th className="text-center py-3 px-3 font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {commissions.map((commission) => (
                    <tr key={commission.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-3">
                        <Link
                          href={`/dashboard/buyers/${commission.buyer_id}`}
                          className="text-primary-600 hover:underline font-medium"
                        >
                          {commission.buyers
                            ? `${commission.buyers.first_name} ${commission.buyers.last_name}`
                            : 'Unknown Buyer'}
                        </Link>
                      </td>
                      <td className="py-3 px-3 text-gray-700">
                        {commission.buyers?.estates?.name || '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-gray-900">
                        {formatCurrency(commission.commission_amount)}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-gray-900">
                        {formatCurrency(commission.amount_paid)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <CommissionStatusToggle
                          commissionId={commission.id}
                          currentStatus={commission.status}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">
              No referred buyers yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
