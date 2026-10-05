import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, validationError, serverError } from '@/lib/api-helpers'
import { buyerSchema } from '@/lib/validations'
import { generateInstallmentSchedule } from '@/lib/schedule'
import { logActivity } from '@/lib/activity-log'
import type { TablesUpdate } from '@/types/database.types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await authenticateRequest()
    if (result.error) return result.error
    const { adminClient } = result.auth

    const { data: buyer, error } = await adminClient
      .from('buyers')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !buyer) {
      return NextResponse.json({ error: 'Buyer not found' }, { status: 404 })
    }

    return NextResponse.json({ buyer })
  } catch (err) {
    return serverError(err, 'buyers/[id]')
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await authenticateRequest()
    if (result.error) return result.error
    const { adminClient } = result.auth

    const body = await request.json()
    const parsed = buyerSchema.partial().safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    // Get existing buyer with estate info
    const { data: existing } = await adminClient
      .from('buyers')
      .select('id, estate_id')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Buyer not found' }, { status: 404 })
    }

    const oldEstateId = existing.estate_id
    const { installment_plan, ...updateFields } = parsed.data
    // Only include fields that were actually sent in the request body
    // to avoid .default() values overwriting existing data
    const sentKeys = new Set(Object.keys(body))
    const filteredFields: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(updateFields)) {
      if (sentKeys.has(key)) filteredFields[key] = value
    }
    const updateData: TablesUpdate<'buyers'> = { ...filteredFields }
    if (updateData.estate_id === '') delete updateData.estate_id

    // Convert empty strings to null for DB compatibility
    for (const key of Object.keys(updateData)) {
      const k = key as keyof typeof updateData
      if (updateData[k] === '') (updateData[k] as unknown) = null
    }

    // Handle installment plan changes
    if (installment_plan !== undefined) {
      if (installment_plan?.enabled && installment_plan.duration_months && installment_plan.start_date) {
        updateData.has_installment_plan = true
        updateData.plan_duration_months = installment_plan.duration_months
        updateData.plan_start_date = installment_plan.start_date
        updateData.initial_deposit = installment_plan.initial_deposit || 0
      } else if (installment_plan && !installment_plan.enabled) {
        updateData.has_installment_plan = false
      }
    }

    const { data: buyer, error } = await adminClient
      .from('buyers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return serverError(error, 'buyers/[id]')
    }

    const newEstateId = updateData.estate_id as string | undefined

    // If estate changed and buyer is fully_paid, adjust available_plots
    const { data: fullBuyer } = await adminClient
      .from('buyers').select('payment_status').eq('id', id).single()

    if (newEstateId !== undefined && newEstateId !== oldEstateId && fullBuyer && fullBuyer.payment_status === 'fully_paid') {
      const plotCount = buyer?.number_of_plots || 1
      // Increment old estate (plots freed up)
      if (oldEstateId) {
        const { data: oldEstate } = await adminClient
          .from('estates').select('available_plots, total_plots').eq('id', oldEstateId).single()
        if (oldEstate) {
          const restored = Math.min(oldEstate.available_plots + plotCount, oldEstate.total_plots)
          await adminClient.from('estates')
            .update({ available_plots: restored })
            .eq('id', oldEstateId)
        }
      }
      // Decrement new estate (plots claimed)
      if (newEstateId) {
        const { data: newEstate } = await adminClient
          .from('estates').select('available_plots').eq('id', newEstateId).single()
        if (newEstate) {
          const newAvailable = Math.max(0, newEstate.available_plots - plotCount)
          await adminClient.from('estates')
            .update({ available_plots: newAvailable })
            .eq('id', newEstateId)
        }
      }
    }

    // Regenerate schedule if plan params changed
    if (installment_plan?.enabled && installment_plan.duration_months && installment_plan.start_date && buyer) {
      const totalAmount = updateFields.total_amount ?? buyer.total_amount

      // Delete only pending entries (preserve paid/partial)
      await adminClient
        .from('payment_schedules')
        .delete()
        .eq('buyer_id', id)
        .in('status', ['unpaid', 'overdue'])

      const schedule = generateInstallmentSchedule({
        total_amount: totalAmount,
        initial_deposit: installment_plan.initial_deposit || 0,
        duration_months: installment_plan.duration_months,
        start_date: installment_plan.start_date,
      })

      // Check which installment numbers already exist (paid/partial)
      const { data: existingEntries } = await adminClient
        .from('payment_schedules')
        .select('installment_number')
        .eq('buyer_id', id)

      const existingNumbers = new Set((existingEntries || []).map((e) => e.installment_number))

      const newEntries = schedule
        .filter((entry) => !existingNumbers.has(entry.installment_number))
        .map((entry) => ({
          buyer_id: id,
          installment_number: entry.installment_number,
          due_date: entry.due_date,
          expected_amount: entry.expected_amount,
        }))

      if (newEntries.length > 0) {
        await adminClient.from('payment_schedules').insert(newEntries)
      }
    }

    if (buyer) {
      logActivity({
        userId: result.auth.userId,
        userName: result.auth.userName,
        action: 'updated',
        entityType: 'buyer',
        entityId: id,
        entityLabel: `${buyer.first_name} ${buyer.last_name}`,
      })
    }

    return NextResponse.json({ buyer })
  } catch (err) {
    return serverError(err, 'buyers/[id]')
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await authenticateRequest()
    if (result.error) return result.error
    const { adminClient } = result.auth

    // Get buyer with estate and payment info before deleting
    const { data: existing } = await adminClient
      .from('buyers')
      .select('id, first_name, last_name, estate_id, payment_status, number_of_plots')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Buyer not found' }, { status: 404 })
    }

    const buyerLabel = `${existing.first_name} ${existing.last_name}`
    const estateId = existing.estate_id
    const wasFullyPaid = existing.payment_status === 'fully_paid'

    const { error } = await adminClient
      .from('buyers')
      .delete()
      .eq('id', id)

    if (error) {
      return serverError(error, 'buyers/[id]')
    }

    // Increment available_plots if buyer had fully paid (plots were claimed)
    if (estateId && wasFullyPaid) {
      const plotCount = existing.number_of_plots || 1
      const { data: estate } = await adminClient
        .from('estates').select('available_plots, total_plots').eq('id', estateId).single()
      if (estate) {
        const restored = Math.min(estate.available_plots + plotCount, estate.total_plots)
        await adminClient.from('estates')
          .update({ available_plots: restored })
          .eq('id', estateId)
      }
    }

    logActivity({
      userId: result.auth.userId,
      userName: result.auth.userName,
      action: 'deleted',
      entityType: 'buyer',
      entityId: id,
      entityLabel: buyerLabel,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return serverError(err, 'buyers/[id]')
  }
}
