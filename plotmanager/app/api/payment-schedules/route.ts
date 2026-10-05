import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, serverError } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const result = await authenticateRequest()
    if (result.error) return result.error
    const { adminClient } = result.auth

    const buyerId = request.nextUrl.searchParams.get('buyer_id')
    if (!buyerId) {
      return NextResponse.json({ error: 'buyer_id is required' }, { status: 400 })
    }

    const { data: entries, error } = await adminClient
      .from('payment_schedules')
      .select('*')
      .eq('buyer_id', buyerId)
      .order('installment_number', { ascending: true })

    if (error) {
      return serverError(error, 'GET /api/payment-schedules')
    }

    // Mark overdue entries on read
    const today = new Date().toISOString().split('T')[0]
    const updatedEntries = []
    for (const entry of entries || []) {
      if ((entry.status === 'unpaid' || entry.status === 'partial') && entry.due_date < today) {
        await adminClient
          .from('payment_schedules')
          .update({ status: 'overdue' })
          .eq('id', entry.id)
        updatedEntries.push({ ...entry, status: 'overdue' })
      } else {
        updatedEntries.push(entry)
      }
    }

    return NextResponse.json({ entries: updatedEntries })
  } catch (err) {
    return serverError(err, 'GET /api/payment-schedules')
  }
}
