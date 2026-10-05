import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { paymentReminderHtml } from '@/lib/email-templates'
import { formatCurrency, formatDate } from '@/lib/utils'
// This route is called daily by Vercel Cron (see vercel.json), which sends GET with `Authorization: Bearer $CRON_SECRET`.
// POST is also accepted for other schedulers.
// It checks whether auto_reminders_enabled is set on the company, finds installments due within reminder_days_before,
// and sends reminder emails to buyers who haven't been reminded for this installment yet.

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    const { data: company } = await adminClient
      .from('companies')
      .select('name, phone, email, auto_reminders_enabled, reminder_days_before')
      .limit(1)
      .maybeSingle()

    if (!company || company.auto_reminders_enabled !== true) {
      return NextResponse.json({ sent: 0, skipped: 0 })
    }

    let totalSent = 0
    let totalSkipped = 0

    const daysBefore = company.reminder_days_before || 3

    // Calculate the target date (X days from now)
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + daysBefore)
    const targetDateStr = targetDate.toISOString().split('T')[0]

    // Find pending/partial installments due on the target date
    const { data: entries } = await adminClient
      .from('payment_schedules')
      .select('id, buyer_id, installment_number, due_date, expected_amount, paid_amount, status')
      .eq('due_date', targetDateStr)
      .in('status', ['unpaid', 'partial'])

    if (!entries || entries.length === 0) {
      return NextResponse.json({ sent: totalSent, skipped: totalSkipped })
    }

    // Get unique buyer IDs
    const buyerIds = [...new Set(entries.map((e) => e.buyer_id))]

    // Fetch buyers with emails
    const { data: buyers } = await adminClient
      .from('buyers')
      .select('id, first_name, last_name, email, total_amount, amount_paid, next_payment_date, payment_status')
      .in('id', buyerIds)
      .not('email', 'is', null)
      .neq('email', '')

    if (!buyers || buyers.length === 0) {
      totalSkipped += entries.length
      return NextResponse.json({ sent: totalSent, skipped: totalSkipped })
    }

    const buyerMap = new Map(buyers.map((b) => [b.id, b]))

    // Check which installments already have reminders sent today
    const today = new Date().toISOString().split('T')[0]
    const { data: existingReminders } = await adminClient
      .from('reminders')
      .select('buyer_id, message')
      .eq('reminder_type', 'payment_due')
      .gte('sent_at', `${today}T00:00:00`)

    const alreadyReminded = new Set(
      (existingReminders || []).map((r) => r.buyer_id)
    )

    for (const entry of entries) {
      const buyer = buyerMap.get(entry.buyer_id)
      if (!buyer || alreadyReminded.has(entry.buyer_id)) {
        totalSkipped++
        continue
      }

      const remaining = entry.expected_amount - entry.paid_amount
      const isOverdue = entry.status === 'overdue'

      try {
        await getResend().emails.send({
          from: FROM_EMAIL,
          to: buyer.email!,
          subject: `Payment Reminder from ${company.name}`,
          html: paymentReminderHtml({
            buyerFirstName: buyer.first_name,
            companyName: company.name,
            companyPhone: company.phone,
            companyEmail: company.email,
            amountDue: formatCurrency(remaining),
            dueDate: formatDate(entry.due_date),
            isOverdue,
          }),
        })

        // Record reminder
        await adminClient.from('reminders').insert({
          buyer_id: entry.buyer_id,
          reminder_type: 'payment_due',
          message: `Auto-reminder: Installment #${entry.installment_number} of ${formatCurrency(remaining)} due on ${formatDate(entry.due_date)}`,
          sent_via: 'email',
          sent_at: new Date().toISOString(),
          sent_by: null,
        })

        totalSent++
      } catch {
        totalSkipped++
      }
    }

    return NextResponse.json({ sent: totalSent, skipped: totalSkipped })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
