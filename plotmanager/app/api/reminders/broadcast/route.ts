import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, validationError } from '@/lib/api-helpers'
import { broadcastSchema } from '@/lib/validations'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { broadcastEmailHtml } from '@/lib/email-templates'

export async function POST(request: NextRequest) {
  try {
    const result = await authenticateRequest()
    if (result.error) return result.error
    const { userId, adminClient } = result.auth

    const body = await request.json()
    const parsed = broadcastSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    // Verify estate belongs to company
    const { data: estate } = await adminClient
      .from('estates')
      .select('id, name')
      .eq('id', parsed.data.estate_id)
      .single()

    if (!estate) {
      return NextResponse.json({ error: 'Estate not found' }, { status: 404 })
    }

    // Fetch selected buyers with email in this estate
    const { data: buyers } = await adminClient
      .from('buyers')
      .select('id, email, first_name, last_name')
      .eq('estate_id', parsed.data.estate_id)
      .in('id', parsed.data.buyer_ids)
      .not('email', 'is', null)
      .neq('email', '')

    if (!buyers || buyers.length === 0) {
      return NextResponse.json(
        { error: 'No buyers with email addresses in this estate' },
        { status: 400 }
      )
    }

    // Get company name
    const { data: company } = await adminClient
      .from('companies')
      .select('name')
      .limit(1)
      .single()

    const companyName = company?.name || 'Your Real Estate Company'

    let sent = 0
    let failed = 0

    // Send in batches of 50
    const batchSize = 50
    for (let i = 0; i < buyers.length; i += batchSize) {
      const batch = buyers.slice(i, i + batchSize)

      const emails = batch.map((buyer) => ({
        from: FROM_EMAIL,
        to: buyer.email!,
        subject: parsed.data.subject,
        html: broadcastEmailHtml({
          buyerFirstName: buyer.first_name,
          companyName,
          subject: parsed.data.subject,
          messageBody: parsed.data.message,
        }),
      }))

      try {
        await getResend().batch.send(emails)
        sent += batch.length
      } catch {
        failed += batch.length
      }
    }

    // Record reminders for all buyers
    const reminderRows = buyers.map((buyer) => ({
      buyer_id: buyer.id,
      reminder_type: 'custom' as const,
      message: `[Broadcast: ${parsed.data.subject}] ${parsed.data.message}`.slice(0, 1024),
      sent_via: 'email' as const,
      sent_at: new Date().toISOString(),
      sent_by: userId,
    }))

    await adminClient.from('reminders').insert(reminderRows)

    return NextResponse.json({ sent, failed, total: buyers.length }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
