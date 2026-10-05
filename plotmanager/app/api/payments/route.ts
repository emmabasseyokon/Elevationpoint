import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, validationError, serverError } from '@/lib/api-helpers'
import { paymentSchema } from '@/lib/validations'
import { logActivity } from '@/lib/activity-log'
import type { Tables } from '@/types/database.types'

type BuyerPaymentInfo = Pick<Tables<'buyers'>, 'id' | 'first_name' | 'last_name' | 'total_amount' | 'amount_paid' | 'payment_status' | 'estate_id' | 'number_of_plots'>
type ScheduleEntry = Pick<Tables<'payment_schedules'>, 'id' | 'expected_amount' | 'paid_amount'>

export async function POST(request: NextRequest) {
  try {
    const result = await authenticateRequest()
    if (result.error) return result.error
    const { userId, adminClient } = result.auth

    const body = await request.json()
    const parsed = paymentSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    // Verify the buyer belongs to this company
    const { data: buyer, error: buyerError } = await adminClient
      .from('buyers')
      .select('id, first_name, last_name, total_amount, amount_paid, payment_status, estate_id, number_of_plots')
      .eq('id', parsed.data.buyer_id)
      .single()

    if (buyerError || !buyer) {
      return NextResponse.json({ error: 'Buyer not found' }, { status: 404 })
    }

    const typedBuyer = buyer as BuyerPaymentInfo

    // Record the payment
    const { data: payment, error: paymentError } = await adminClient
      .from('payments')
      .insert({
        buyer_id: parsed.data.buyer_id,
        amount: parsed.data.amount,
        payment_date: parsed.data.payment_date,
        payment_method: parsed.data.payment_method,
        reference: parsed.data.reference || null,
        notes: parsed.data.notes || null,
        recorded_by: userId,
      })
      .select()
      .single()

    if (paymentError) {
      return serverError(paymentError, 'POST /api/payments')
    }

    // Update buyer's amount_paid and payment_status
    const newAmountPaid = (typedBuyer.amount_paid || 0) + parsed.data.amount
    const totalAmount = typedBuyer.total_amount || 0
    const newPaymentStatus = newAmountPaid >= totalAmount ? 'fully_paid' : 'installment'

    const { error: updateError } = await adminClient
      .from('buyers')
      .update({ amount_paid: newAmountPaid, payment_status: newPaymentStatus })
      .eq('id', parsed.data.buyer_id)

    if (updateError) {
      return serverError(updateError, 'POST /api/payments')
    }

    // Decrement available_plots when buyer transitions to fully_paid
    if (newPaymentStatus === 'fully_paid' && typedBuyer.payment_status !== 'fully_paid' && typedBuyer.estate_id) {
      const plotCount = typedBuyer.number_of_plots || 1
      const { data: estate } = await adminClient
        .from('estates')
        .select('available_plots')
        .eq('id', typedBuyer.estate_id)
        .single()
      if (estate && estate.available_plots >= plotCount) {
        await adminClient
          .from('estates')
          .update({ available_plots: estate.available_plots - plotCount })
          .eq('id', typedBuyer.estate_id)
      }
    }

    // Link payment to installment schedule if buyer has a plan
    if (typedBuyer.payment_status !== 'fully_paid') {
      const { data: buyerPlan } = await adminClient
        .from('buyers')
        .select('has_installment_plan')
        .eq('id', parsed.data.buyer_id)
        .single()

      if (buyerPlan && buyerPlan.has_installment_plan) {
        // If buyer is now fully paid, mark all remaining schedule entries as paid
        if (newPaymentStatus === 'fully_paid') {
          const { data: unpaidEntries } = await adminClient
            .from('payment_schedules')
            .select('id, expected_amount')
            .eq('buyer_id', parsed.data.buyer_id)
            .in('status', ['unpaid', 'partial', 'overdue'])

          if (unpaidEntries && unpaidEntries.length > 0) {
            for (const entry of unpaidEntries) {
              await adminClient
                .from('payment_schedules')
                .update({
                  paid_amount: entry.expected_amount,
                  status: 'paid',
                  payment_id: payment.id,
                })
                .eq('id', entry.id)
            }
          }

          // Clear next_payment_date since fully paid
          await adminClient
            .from('buyers')
            .update({ next_payment_date: null })
            .eq('id', parsed.data.buyer_id)
        } else {
          let remainingAmount = parsed.data.amount

          // If a specific schedule entry was provided, start there
          if (parsed.data.schedule_entry_id) {
            const { data: targetEntry } = await adminClient
              .from('payment_schedules')
              .select('*')
              .eq('id', parsed.data.schedule_entry_id)
              .single()

            if (targetEntry) {
              const entry: ScheduleEntry = targetEntry
              const entryRemaining = entry.expected_amount - entry.paid_amount
              const applyAmount = Math.min(remainingAmount, entryRemaining)
              const newPaidAmount = entry.paid_amount + applyAmount
              const entryStatus = newPaidAmount >= entry.expected_amount ? 'paid' : 'partial'

              await adminClient
                .from('payment_schedules')
                .update({
                  paid_amount: newPaidAmount,
                  status: entryStatus,
                  payment_id: payment.id,
                })
                .eq('id', entry.id)

              remainingAmount -= applyAmount
            }
          }

          // Apply remaining amount to next unpaid entries (cascade overflow)
          while (remainingAmount > 0) {
            const { data: nextEntry } = await adminClient
              .from('payment_schedules')
              .select('*')
              .eq('buyer_id', parsed.data.buyer_id)
              .in('status', ['unpaid', 'partial', 'overdue'])
              .order('installment_number', { ascending: true })
              .limit(1)
              .single()

            if (!nextEntry) break

            const entry: ScheduleEntry = nextEntry
            const entryRemaining = entry.expected_amount - entry.paid_amount
            const applyAmount = Math.min(remainingAmount, entryRemaining)
            const newPaidAmount = entry.paid_amount + applyAmount
            const entryStatus = newPaidAmount >= entry.expected_amount ? 'paid' : 'partial'

            await adminClient
              .from('payment_schedules')
              .update({
                paid_amount: newPaidAmount,
                status: entryStatus,
                payment_id: payment.id,
              })
              .eq('id', entry.id)

            remainingAmount -= applyAmount
          }

          // Update buyer's next_payment_date to next unpaid installment
          const { data: nextDue } = await adminClient
            .from('payment_schedules')
            .select('due_date')
            .eq('buyer_id', parsed.data.buyer_id)
            .in('status', ['unpaid', 'partial', 'overdue'])
            .order('installment_number', { ascending: true })
            .limit(1)
            .single()

          if (nextDue) {
            await adminClient
              .from('buyers')
              .update({ next_payment_date: nextDue.due_date })
              .eq('id', parsed.data.buyer_id)
          }
        }
      }
    }

    // Auto-add commission for this payment if buyer has an agent (installment commission accrual)
    const { data: buyerAgent } = await adminClient
      .from('buyers')
      .select('agent_id')
      .eq('id', parsed.data.buyer_id)
      .single()

    if (buyerAgent?.agent_id) {
      const { data: agent } = await adminClient
        .from('agents')
        .select('id, commission_type, commission_rate')
        .eq('id', buyerAgent.agent_id)
        .single()

      if (agent && agent.commission_rate > 0) {
        const paymentCommission = agent.commission_type === 'percentage'
          ? (parsed.data.amount * agent.commission_rate) / 100
          : 0 // Flat rate is already fully applied at buyer creation

        if (paymentCommission > 0) {
          // Find existing commission record for this buyer-agent pair and increment
          const { data: existingCommission } = await adminClient
            .from('commissions')
            .select('id, commission_amount')
            .eq('buyer_id', parsed.data.buyer_id)
            .eq('agent_id', agent.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (existingCommission) {
            await adminClient
              .from('commissions')
              .update({
                commission_amount: existingCommission.commission_amount + paymentCommission,
              })
              .eq('id', existingCommission.id)
          } else {
            // No existing commission — create one (edge case: agent assigned after initial purchase)
            await adminClient.from('commissions').insert({
              agent_id: agent.id,
              buyer_id: parsed.data.buyer_id,
              commission_amount: paymentCommission,
              amount_paid: 0,
              status: 'pending',
            })
          }
        }
      }
    }

    logActivity({
      userId,
      userName: result.auth.userName,
      action: 'created',
      entityType: 'payment',
      entityId: payment.id,
      entityLabel: `Payment for ${typedBuyer.first_name} ${typedBuyer.last_name}`,
      details: { amount: parsed.data.amount, buyer_id: parsed.data.buyer_id },
    })

    return NextResponse.json({ payment, newAmountPaid, newPaymentStatus }, { status: 201 })
  } catch (err) {
    return serverError(err, 'POST /api/payments')
  }
}
