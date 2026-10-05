import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, serverError } from '@/lib/api-helpers'
import { logActivity } from '@/lib/activity-log'
import { z } from 'zod'

const updatePaymentSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payment_method: z.enum(['cash', 'bank_transfer', 'pos', 'online']),
  reference: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await authenticateRequest()
    if (result.error) return result.error
    const { userId, adminClient } = result.auth

    const { id } = await params
    const body = await request.json()
    const parsed = updatePaymentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // Fetch the existing payment
    const { data: existingPayment, error: fetchError } = await adminClient
      .from('payments')
      .select('id, amount, buyer_id')
      .eq('id', id)
      .single()

    if (fetchError || !existingPayment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    const amountDiff = parsed.data.amount - existingPayment.amount

    // Update the payment record
    const { data: updatedPayment, error: updateError } = await adminClient
      .from('payments')
      .update({
        amount: parsed.data.amount,
        payment_date: parsed.data.payment_date,
        payment_method: parsed.data.payment_method,
        reference: parsed.data.reference || null,
        notes: parsed.data.notes || null,
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      return serverError(updateError, 'PUT /api/payments/[id]')
    }

    // Recalculate buyer's amount_paid and payment_status
    if (amountDiff !== 0) {
      const { data: buyer } = await adminClient
        .from('buyers')
        .select('id, first_name, last_name, amount_paid, total_amount, payment_status, estate_id, number_of_plots')
        .eq('id', existingPayment.buyer_id)
        .single()

      if (buyer) {
        const newAmountPaid = Math.max(0, (buyer.amount_paid || 0) + amountDiff)
        const totalAmount = buyer.total_amount || 0
        const wasFullyPaid = buyer.payment_status === 'fully_paid'
        const newPaymentStatus = newAmountPaid >= totalAmount ? 'fully_paid' : 'installment'

        await adminClient
          .from('buyers')
          .update({ amount_paid: newAmountPaid, payment_status: newPaymentStatus })
          .eq('id', buyer.id)

        // Handle estate available_plots if status changed
        if (buyer.estate_id) {
          const plotCount = buyer.number_of_plots || 1
          if (wasFullyPaid && newPaymentStatus !== 'fully_paid') {
            // Was fully paid, now not — restore plots
            const { data: estate } = await adminClient
              .from('estates')
              .select('available_plots, total_plots')
              .eq('id', buyer.estate_id)
              .single()
            if (estate) {
              const restored = Math.min(estate.available_plots + plotCount, estate.total_plots)
              await adminClient
                .from('estates')
                .update({ available_plots: restored })
                .eq('id', buyer.estate_id)
            }
          } else if (!wasFullyPaid && newPaymentStatus === 'fully_paid') {
            // Newly fully paid — claim plots
            const { data: estate } = await adminClient
              .from('estates')
              .select('available_plots')
              .eq('id', buyer.estate_id)
              .single()
            if (estate && estate.available_plots >= plotCount) {
              await adminClient
                .from('estates')
                .update({ available_plots: estate.available_plots - plotCount })
                .eq('id', buyer.estate_id)
            }
          }
        }
      }
    }

    logActivity({
      userId,
      userName: result.auth.userName,
      action: 'updated',
      entityType: 'payment',
      entityId: id,
      entityLabel: `Payment updated`,
      details: { amount: parsed.data.amount, previous_amount: existingPayment.amount },
    })

    return NextResponse.json({ payment: updatedPayment })
  } catch (err) {
    return serverError(err, 'PUT /api/payments/[id]')
  }
}
