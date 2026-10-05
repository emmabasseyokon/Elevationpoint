import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, validationError, serverError } from '@/lib/api-helpers'
import { reminderSchema } from '@/lib/validations'
import { logActivity } from '@/lib/activity-log'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { paymentReminderHtml, broadcastEmailHtml } from '@/lib/email-templates'
import { formatCurrency, formatDate } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const result = await authenticateRequest()
    if (result.error) return result.error
    const { adminClient } = result.auth

    const url = new URL(request.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1') || 1)
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50') || 50))
    const offset = (page - 1) * limit

    const { data: reminders, error, count } = await adminClient
      .from('reminders')
      .select('*, buyers(first_name, last_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return serverError(error, 'GET /api/reminders')
    }

    return NextResponse.json({ reminders: reminders || [], total: count || 0 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await authenticateRequest()
    if (result.error) return result.error
    const { userId, adminClient } = result.auth

    const body = await request.json()
    const parsed = reminderSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    // Verify buyer belongs to company
    const { data: buyer } = await adminClient
      .from('buyers')
      .select('id, first_name, last_name, email, total_amount, amount_paid, next_payment_date, payment_status')
      .eq('id', parsed.data.buyer_id)
      .single()

    if (!buyer) {
      return NextResponse.json({ error: 'Buyer not found' }, { status: 404 })
    }

    if (!buyer.email) {
      return NextResponse.json({ error: 'Buyer has no email address' }, { status: 400 })
    }

    // Get company name
    const { data: company } = await adminClient
      .from('companies')
      .select('name, phone, email')
      .limit(1)
      .single()

    const companyName = company?.name || 'Your Real Estate Company'
    const isOverdue = buyer.payment_status === 'overdue'

    // Get the next unpaid/partial/overdue installment amount instead of total outstanding
    const { data: nextSchedule } = await adminClient
      .from('payment_schedules')
      .select('expected_amount, paid_amount, due_date')
      .eq('buyer_id', parsed.data.buyer_id)
      .in('status', ['unpaid', 'partial', 'overdue'])
      .order('due_date', { ascending: true })
      .limit(1)
      .single()

    const amountDue = nextSchedule
      ? nextSchedule.expected_amount - nextSchedule.paid_amount
      : (buyer.total_amount || 0) - (buyer.amount_paid || 0)
    const dueDate = nextSchedule?.due_date || buyer.next_payment_date

    let emailSent = false
    let emailError: string | null = null

    const isCustom = parsed.data.reminder_type === 'custom'
    const emailSubject = isCustom
      ? `Message from ${companyName}`
      : `Payment Reminder from ${companyName}`
    const emailHtml = isCustom
      ? broadcastEmailHtml({
          buyerFirstName: buyer.first_name,
          companyName,
          subject: emailSubject,
          messageBody: parsed.data.message,
        })
      : paymentReminderHtml({
          buyerFirstName: buyer.first_name,
          companyName,
          companyPhone: company?.phone,
          companyEmail: company?.email,
          amountDue: formatCurrency(amountDue),
          dueDate: dueDate ? formatDate(dueDate) : 'N/A',
          isOverdue,
        })

    try {
      await getResend().emails.send({
        from: FROM_EMAIL,
        to: buyer.email,
        subject: emailSubject,
        html: emailHtml,
      })
      emailSent = true
    } catch (err: unknown) {
      emailError = err instanceof Error ? err.message : 'Failed to send email'
    }

    // Record reminder
    const { data: reminder, error: insertError } = await adminClient
      .from('reminders')
      .insert({
        buyer_id: parsed.data.buyer_id,
        reminder_type: parsed.data.reminder_type,
        message: parsed.data.message,
        sent_via: 'email',
        sent_at: new Date().toISOString(),
        sent_by: userId,
      })
      .select()
      .single()

    if (insertError) {
      return serverError(insertError, 'POST /api/reminders')
    }

    logActivity({
      userId,
      userName: result.auth.userName,
      action: 'created',
      entityType: 'reminder',
      entityId: reminder?.id,
      entityLabel: `Reminder to ${buyer.first_name} ${buyer.last_name}`,
      details: { reminder_type: parsed.data.reminder_type, email_sent: emailSent },
    })

    return NextResponse.json({ reminder, emailSent, emailError }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
