import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, validationError, serverError } from '@/lib/api-helpers'
import { commissionPaymentSchema } from '@/lib/validations'
import type { TablesInsert } from '@/types/database.types'

export async function GET(request: NextRequest) {
  try {
    const result = await authenticateRequest()
    if (result.error) return result.error
    const { adminClient } = result.auth

    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agent_id')
    const status = searchParams.get('status')

    let query = adminClient
      .from('commissions')
      .select('*, agents(first_name, last_name), buyers(first_name, last_name)')
      .order('created_at', { ascending: false })

    if (agentId) {
      query = query.eq('agent_id', agentId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: commissions, error } = await query

    if (error) {
      return serverError(error, 'GET /api/commissions')
    }

    return NextResponse.json(commissions)
  } catch (err) {
    return serverError(err, 'GET /api/commissions')
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await authenticateRequest()
    if (result.error) return result.error
    const { userId, adminClient } = result.auth

    const body = await request.json()
    const parsed = commissionPaymentSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    // Verify the commission belongs to this company
    const { data: commission, error: commissionError } = await adminClient
      .from('commissions')
      .select('id, commission_amount, amount_paid, status')
      .eq('id', parsed.data.commission_id)
      .single()

    if (commissionError || !commission) {
      return NextResponse.json({ error: 'Commission not found' }, { status: 404 })
    }

    // Record the commission payment
    const insertData: TablesInsert<'commission_payments'> = {
      commission_id: parsed.data.commission_id,
      amount: parsed.data.amount,
      payment_date: parsed.data.payment_date,
      payment_method: parsed.data.payment_method,
      reference: parsed.data.reference || null,
      notes: parsed.data.notes || null,
      recorded_by: userId,
    }

    const { data: payment, error: paymentError } = await adminClient
      .from('commission_payments')
      .insert(insertData)
      .select()
      .single()

    if (paymentError) {
      return serverError(paymentError, 'POST /api/commissions')
    }

    // Update commission amount_paid and status
    const newAmountPaid = (commission.amount_paid || 0) + parsed.data.amount
    const commissionAmount = commission.commission_amount || 0
    let newStatus: string

    if (newAmountPaid >= commissionAmount) {
      newStatus = 'paid'
    } else if (newAmountPaid > 0) {
      newStatus = 'partially_paid'
    } else {
      newStatus = 'pending'
    }

    const { error: updateError } = await adminClient
      .from('commissions')
      .update({ amount_paid: newAmountPaid, status: newStatus })
      .eq('id', commission.id)

    if (updateError) {
      return serverError(updateError, 'POST /api/commissions')
    }

    return NextResponse.json({ payment, newAmountPaid, newStatus }, { status: 201 })
  } catch (err) {
    return serverError(err, 'POST /api/commissions')
  }
}
