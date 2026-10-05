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
  MapPin,
  Calendar,
  FileText,
  DollarSign,
  CalendarDays,
  Download,
} from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { BuyerActions } from '@/components/BuyerActions'
import { RecordPayment } from '@/components/RecordPayment'
import { EditPayment } from '@/components/EditPayment'
import { ScheduleReminder } from '@/components/ScheduleReminder'
import { SendReminder } from '@/components/SendReminder'
import { AllocationToggle } from '@/components/AllocationToggle'
import { BUYER_STATUS_COLORS, BUYER_STATUS_LABELS, SCHEDULE_STATUS_COLORS, SCHEDULE_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/constants'

export default async function BuyerDetailPage({
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

  const { data: buyerRaw } = await supabase
    .from('buyers')
    .select('*, estates(name), agents(first_name, last_name)')
    .eq('id', id)
    .single()

  if (!buyerRaw) redirect('/dashboard/buyers')

  const buyer = buyerRaw as unknown as {
    id: string
    first_name: string
    last_name: string
    email: string | null
    phone: string | null
    gender: string | null
    home_address: string | null
    city: string | null
    state: string | null
    plot_size: string | null
    plot_location: string | null
    plot_number: string | null
    number_of_plots: number | null
    purchase_date: string | null
    total_amount: number
    amount_paid: number
    next_payment_date: string | null
    payment_status: string
    allocation_status: string
    payment_proof_url: string | null
    documents: any
    notes: string | null
    created_at: string
    has_installment_plan: boolean | null
    plan_duration_months: number | null
    plan_start_date: string | null
    initial_deposit: number | null
    next_of_kin_name: string | null
    next_of_kin_phone: string | null
    next_of_kin_address: string | null
    next_of_kin_relationship: string | null
    agent_id: string | null
    referral_source: string | null
    referral_phone: string | null
    estates: { name: string } | null
    agents: { first_name: string; last_name: string } | null
  }

  const { data: paymentsRaw } = await supabase
    .from('payments')
    .select('*')
    .eq('buyer_id', id)
    .order('payment_date', { ascending: false })

  const payments = (paymentsRaw || []) as Array<{
    id: string
    amount: number
    payment_date: string
    payment_method: string
    reference: string | null
    notes: string | null
    recorded_by: string | null
    created_at: string
  }>

  // Fetch payment schedule if buyer has an installment plan
  let scheduleEntries: Array<{
    id: string
    installment_number: number
    due_date: string
    expected_amount: number
    paid_amount: number
    status: string
    payment_id: string | null
  }> = []
  let nextInstallment: typeof scheduleEntries[0] | null = null

  if (buyer.has_installment_plan) {
    const adminClient = createAdminClient()
    const { data: scheduleRaw } = await adminClient
      .from('payment_schedules')
      .select('*')
      .eq('buyer_id', id)
      .order('installment_number', { ascending: true })

    const today = new Date().toISOString().split('T')[0]
    scheduleEntries = ((scheduleRaw || []) as typeof scheduleEntries).map((entry) => {
      if ((entry.status === 'unpaid' || entry.status === 'partial') && entry.due_date < today) {
        return { ...entry, status: 'overdue' }
      }
      return entry
    })

    nextInstallment = scheduleEntries.find(
      (e) => e.status === 'unpaid' || e.status === 'partial' || e.status === 'overdue'
    ) || null
  }

  const outstanding = (buyer.total_amount || 0) - (buyer.amount_paid || 0)
  const paidPercentage = buyer.total_amount > 0
    ? Math.round((buyer.amount_paid / buyer.total_amount) * 100)
    : 0

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Link href="/dashboard/buyers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900">
              {buyer.first_name} {buyer.last_name}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SendReminder
            buyerId={buyer.id}
            buyerName={`${buyer.first_name} ${buyer.last_name}`}
            buyerEmail={buyer.email}
            paymentStatus={buyer.payment_status}
            outstandingBalance={Math.max(outstanding, 0)}
            nextPaymentDate={buyer.next_payment_date}
          />
          <BuyerActions buyerId={buyer.id} buyerName={`${buyer.first_name} ${buyer.last_name}`} />
        </div>
      </div>

      {/* Financial Summary */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${buyer.has_installment_plan ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500 mb-1">Total Amount</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 break-all">
              {formatCurrency(buyer.total_amount || 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500 mb-1">Amount Paid</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600 break-all">
              {formatCurrency(buyer.amount_paid || 0)}
            </p>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(paidPercentage, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{paidPercentage}% paid</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500 mb-1">Outstanding Balance</p>
            <p className={`text-xl sm:text-2xl font-bold break-all ${outstanding > 0 ? 'text-amber-600' : 'text-green-600'}`}>
              {formatCurrency(Math.max(outstanding, 0))}
            </p>
          </CardContent>
        </Card>
        {buyer.has_installment_plan && (
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-500 mb-1">Next Installment</p>
              {nextInstallment ? (
                <>
                  <p className="text-xl sm:text-2xl font-bold text-blue-600 break-all">
                    {formatCurrency(nextInstallment.expected_amount - nextInstallment.paid_amount)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Due {formatDate(nextInstallment.due_date)} (#{nextInstallment.installment_number})
                  </p>
                </>
              ) : (
                <p className="text-2xl font-bold text-green-600">All Paid</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact & Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {buyer.email && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Mail className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="text-sm text-gray-900">{buyer.email}</p>
                </div>
              </div>
            )}
            {buyer.phone && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
                  <Phone className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Phone</p>
                  <p className="text-sm text-gray-900">{buyer.phone}</p>
                </div>
              </div>
            )}
            {buyer.gender && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-pink-50 rounded-lg flex items-center justify-center">
                  <Mail className="w-4 h-4 text-pink-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Gender</p>
                  <p className="text-sm text-gray-900 capitalize">{buyer.gender}</p>
                </div>
              </div>
            )}
            {buyer.home_address && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Home Address</p>
                  <p className="text-sm text-gray-900">{buyer.home_address}</p>
                </div>
              </div>
            )}
            {(buyer.city || buyer.state) && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-cyan-50 rounded-lg flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-cyan-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">City / State</p>
                  <p className="text-sm text-gray-900">{[buyer.city, buyer.state].filter(Boolean).join(', ')}</p>
                </div>
              </div>
            )}
            {!buyer.email && !buyer.phone && !buyer.home_address && (
              <p className="text-sm text-gray-400">No contact information provided.</p>
            )}
          </CardContent>
        </Card>

        {/* Plot Info */}
        <Card>
          <CardHeader>
            <CardTitle>Plot Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {buyer.estates?.name && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Estate</p>
                  <p className="text-sm text-gray-900">{buyer.estates.name}</p>
                </div>
              </div>
            )}
            {buyer.plot_location && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Location</p>
                  <p className="text-sm text-gray-900">{buyer.plot_location}</p>
                </div>
              </div>
            )}
            {buyer.plot_number && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Plot Number</p>
                  <p className="text-sm text-gray-900">{buyer.plot_number}</p>
                </div>
              </div>
            )}
            {buyer.plot_size && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-teal-50 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-teal-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Plot Size</p>
                  <p className="text-sm text-gray-900">{buyer.plot_size}</p>
                </div>
              </div>
            )}
            {buyer.purchase_date && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-rose-50 rounded-lg flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-rose-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Purchase Date</p>
                  <p className="text-sm text-gray-900">{formatDate(buyer.purchase_date)}</p>
                </div>
              </div>
            )}
            {buyer.next_payment_date && buyer.payment_status !== 'fully_paid' && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Next Payment Date</p>
                  <p className="text-sm text-gray-900">{formatDate(buyer.next_payment_date)}</p>
                </div>
              </div>
            )}
            {(buyer.payment_proof_url || (Array.isArray(buyer.documents) && buyer.documents.length > 0)) && (
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-violet-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-violet-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Proof of Payment</p>
                  <div className="flex flex-wrap gap-2">
                    {buyer.payment_proof_url && (
                      <a href={buyer.payment_proof_url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={buyer.payment_proof_url}
                          alt="Payment proof"
                          className="h-24 w-auto rounded-lg border border-gray-200 object-cover hover:border-primary-500 transition-colors"
                        />
                      </a>
                    )}
                    {Array.isArray(buyer.documents) && buyer.documents.map((doc: any, idx: number) => (
                      doc?.url && (
                        <a key={idx} href={doc.url} target="_blank" rel="noopener noreferrer" title={doc.label || `Proof ${idx + 2}`}>
                          <img
                            src={doc.url}
                            alt={doc.label || `Payment proof ${idx + 2}`}
                            className="h-24 w-auto rounded-lg border border-gray-200 object-cover hover:border-primary-500 transition-colors"
                          />
                        </a>
                      )
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="border-t border-gray-100 pt-4 mt-2 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Payment Status</p>
                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${BUYER_STATUS_COLORS[buyer.payment_status] || BUYER_STATUS_COLORS.installment}`}>
                  {BUYER_STATUS_LABELS[buyer.payment_status] || 'Installment'}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Allocation Status</p>
                <AllocationToggle buyerId={buyer.id} currentStatus={buyer.allocation_status || 'not_allocated'} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent & Referral & Next of Kin */}
      {(buyer.agents || buyer.next_of_kin_name || buyer.referral_source) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {buyer.agents && (
            <Card>
              <CardHeader>
                <CardTitle>Referring Agent</CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/dashboard/agents/${buyer.agent_id}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  {buyer.agents.first_name} {buyer.agents.last_name}
                  <span className="text-xs text-gray-400">View agent &rarr;</span>
                </Link>
              </CardContent>
            </Card>
          )}
          {buyer.next_of_kin_name && (
            <Card>
              <CardHeader>
                <CardTitle>Next of Kin</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Name</p>
                  <p className="text-sm text-gray-900">
                    {buyer.next_of_kin_name}
                    {buyer.next_of_kin_relationship && (
                      <span className="text-gray-500"> ({buyer.next_of_kin_relationship})</span>
                    )}
                  </p>
                </div>
                {buyer.next_of_kin_phone && (
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="text-sm text-gray-900">{buyer.next_of_kin_phone}</p>
                  </div>
                )}
                {buyer.next_of_kin_address && (
                  <div>
                    <p className="text-xs text-gray-500">Address</p>
                    <p className="text-sm text-gray-900">{buyer.next_of_kin_address}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          {buyer.referral_source && (
            <Card>
              <CardHeader>
                <CardTitle>Referral</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Source</p>
                  <p className="text-sm text-gray-900">{buyer.referral_source}</p>
                </div>
                {buyer.referral_phone && (
                  <div>
                    <p className="text-xs text-gray-500">Referrer Phone</p>
                    <p className="text-sm text-gray-900">{buyer.referral_phone}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Notes */}
      {buyer.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{buyer.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Payment Schedule */}
      {buyer.has_installment_plan && scheduleEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              Payment Schedule
              <span className="text-sm font-normal text-gray-500">
                ({buyer.plan_duration_months} months)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-3 font-medium text-gray-600">#</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-600">Due Date</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-600">Expected</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-600">Paid</th>
                    <th className="text-center py-3 px-3 font-medium text-gray-600">Status</th>
                    <th className="text-center py-3 px-3 font-medium text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {scheduleEntries.map((entry) => {
                    const rowBg = entry.status === 'paid'
                      ? 'bg-green-50/50'
                      : entry.status === 'overdue'
                        ? 'bg-red-50/50'
                        : entry.status === 'partial'
                          ? 'bg-yellow-50/50'
                          : ''
                    const isNext = nextInstallment?.id === entry.id
                    return (
                      <tr key={entry.id} className={`${rowBg} ${isNext ? 'ring-2 ring-blue-200 ring-inset' : ''}`}>
                        <td className="py-3 px-3 text-gray-700">{entry.installment_number}</td>
                        <td className="py-3 px-3 text-gray-700">{formatDate(entry.due_date)}</td>
                        <td className="py-3 px-3 text-right font-medium text-gray-900">{formatCurrency(entry.expected_amount)}</td>
                        <td className="py-3 px-3 text-right font-medium text-gray-900">{formatCurrency(entry.paid_amount)}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${SCHEDULE_STATUS_COLORS[entry.status] || SCHEDULE_STATUS_COLORS.unpaid}`}>
                            {SCHEDULE_STATUS_LABELS[entry.status] || 'Unpaid'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <ScheduleReminder
                            buyerId={buyer.id}
                            buyerName={`${buyer.first_name} ${buyer.last_name}`}
                            buyerEmail={buyer.email}
                            installmentNumber={entry.installment_number}
                            dueDate={entry.due_date}
                            expectedAmount={entry.expected_amount}
                            paidAmount={entry.paid_amount}
                            status={entry.status}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payment History</CardTitle>
            <RecordPayment
              buyerId={buyer.id}
              outstandingBalance={Math.max(outstanding, 0)}
              nextInstallment={nextInstallment ? {
                id: nextInstallment.id,
                installment_number: nextInstallment.installment_number,
                due_date: nextInstallment.due_date,
                expected_amount: nextInstallment.expected_amount,
                paid_amount: nextInstallment.paid_amount,
              } : undefined}
            />
          </div>
        </CardHeader>
        <CardContent>
          {payments.length > 0 ? (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">
                        {formatCurrency(payment.amount)}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {formatDate(payment.payment_date)} via {PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-13 sm:ml-0">
                    {payment.reference && (
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Ref</p>
                        <p className="text-sm text-gray-600">{payment.reference}</p>
                      </div>
                    )}
                    <EditPayment payment={{
                      id: payment.id,
                      amount: payment.amount,
                      payment_date: payment.payment_date,
                      payment_method: payment.payment_method,
                      reference: payment.reference,
                      notes: payment.notes,
                    }} />
                    <a
                      href={`/api/receipts/${payment.id}`}
                      title="Download Receipt"
                      className="p-2 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">
              No payments recorded yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

