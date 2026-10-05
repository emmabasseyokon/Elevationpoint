import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { Bell, Mail } from 'lucide-react'
import { ReminderActions } from './ReminderActions'
import { ReminderSettings } from '@/components/ReminderSettings'

const typeLabels: Record<string, string> = {
  payment_due: 'Payment Reminder',
  custom: 'Broadcast',
}

const typeColors: Record<string, string> = {
  payment_due: 'bg-blue-100 text-blue-700',
  custom: 'bg-purple-100 text-purple-700',
}

export default async function RemindersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const adminClient = createAdminClient()

  // Fetch reminders
  const { data: remindersRaw } = await adminClient
    .from('reminders')
    .select('*, buyers(first_name, last_name, email)')
    .order('created_at', { ascending: false })
    .limit(50)

  const reminders = (remindersRaw || []) as Array<{
    id: string
    buyer_id: string
    reminder_type: string
    message: string
    sent_via: string
    sent_at: string | null
    created_at: string | null
    buyers: { first_name: string; last_name: string; email: string | null } | null
  }>

  // Fetch estates for broadcast
  const { data: estatesRaw } = await adminClient
    .from('estates')
    .select('id, name')
    .order('name')

  const estates = (estatesRaw || []) as Array<{ id: string; name: string }>

  // Fetch buyers for broadcast preview
  const { data: buyersRaw } = await adminClient
    .from('buyers')
    .select('id, first_name, last_name, email, estate_id, payment_status, allocation_status')
    .order('first_name')

  const buyers = (buyersRaw || []) as Array<{
    id: string
    first_name: string
    last_name: string
    email: string | null
    estate_id: string | null
    payment_status: string
    allocation_status: string
  }>

  // Fetch company reminder settings
  const { data: companySettings } = await adminClient
    .from('companies')
    .select('auto_reminders_enabled, reminder_days_before')
    .limit(1)
    .single()

  const autoRemindersEnabled = companySettings?.auto_reminders_enabled ?? false
  const reminderDaysBefore = companySettings?.reminder_days_before ?? 3

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Reminders</h1>
          <p className="text-gray-500 mt-1">Send payment reminders and broadcast announcements</p>
        </div>
        <ReminderActions estates={estates} buyers={buyers} canBroadcast={true} />
      </div>

      {/* Auto-Reminder Settings */}
      <ReminderSettings
        initialEnabled={autoRemindersEnabled}
        initialDays={reminderDaysBefore}
      />

      {/* Reminder History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-gray-400" />
            Reminder History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reminders.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-500">No reminders sent yet.</p>
              <p className="text-sm text-gray-400 mt-1">
                Send your first reminder from a buyer&apos;s detail page.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reminders.map((reminder) => {
                const buyerName = reminder.buyers
                  ? `${reminder.buyers.first_name} ${reminder.buyers.last_name}`
                  : 'Unknown buyer'
                return (
                  <div
                    key={reminder.id}
                    className="p-4 bg-gray-50 rounded-xl space-y-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/buyers/${reminder.buyer_id}`}
                        className="text-sm font-medium text-gray-900 hover:text-primary-600 transition-colors"
                      >
                        {buyerName}
                      </Link>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[reminder.reminder_type] || typeColors.payment_due}`}>
                        {typeLabels[reminder.reminder_type] || 'Reminder'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        {reminder.sent_via}
                      </span>
                      <span className="text-xs text-gray-400 ml-auto">
                        {formatDate(reminder.sent_at || reminder.created_at || '')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2">{reminder.message}</p>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
