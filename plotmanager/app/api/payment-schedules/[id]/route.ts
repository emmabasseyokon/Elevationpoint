import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, serverError } from '@/lib/api-helpers'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await authenticateRequest()
    if (result.error) return result.error
    const { adminClient } = result.auth

    // Verify ownership
    const { data: existing } = await adminClient
      .from('payment_schedules')
      .select('id')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Schedule entry not found' }, { status: 404 })
    }

    const body = await request.json()
    const allowedFields: Record<string, unknown> = {}
    if (body.due_date) allowedFields.due_date = body.due_date
    if (body.expected_amount !== undefined) allowedFields.expected_amount = body.expected_amount

    const { data: entry, error } = await adminClient
      .from('payment_schedules')
      .update(allowedFields)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return serverError(error, 'PUT /api/payment-schedules/[id]')
    }

    return NextResponse.json({ entry })
  } catch (err) {
    return serverError(err, 'PUT /api/payment-schedules/[id]')
  }
}
