import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, validationError, serverError, sanitizeSearch } from '@/lib/api-helpers'
import { buyerSchema } from '@/lib/validations'
import { generateInstallmentSchedule } from '@/lib/schedule'
import { logActivity } from '@/lib/activity-log'
import type { TablesInsert } from '@/types/database.types'

export async function GET(request: NextRequest) {
  try {
    const result = await authenticateRequest()
    if (result.error) return result.error
    const { adminClient } = result.auth

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    let query = adminClient
      .from('buyers')
      .select('*')
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('payment_status', status)
    }

    if (search) {
      const safe = sanitizeSearch(search)
      if (safe) {
        query = query.or(
          `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%`
        )
      }
    }

    const { data: buyers, error } = await query

    if (error) {
      return serverError(error, 'GET /api/buyers')
    }

    return NextResponse.json({ buyers })
  } catch (err) {
    return serverError(err, 'GET /api/buyers')
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await authenticateRequest()
    if (result.error) return result.error
    const { adminClient } = result.auth

    const body = await request.json()
    const parsed = buyerSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    const { installment_plan, ...buyerFields } = parsed.data
    const insertData: Partial<TablesInsert<'buyers'>> = { ...buyerFields }
    if (!insertData.estate_id) delete insertData.estate_id

    // Convert empty strings to null for DB compatibility
    for (const key of Object.keys(insertData)) {
      const k = key as keyof typeof insertData
      if (insertData[k] === '') (insertData[k] as unknown) = null
    }

    // Add installment plan metadata to buyer if enabled
    if (installment_plan?.enabled && installment_plan.duration_months && installment_plan.start_date) {
      insertData.has_installment_plan = true
      insertData.plan_duration_months = installment_plan.duration_months
      insertData.plan_start_date = installment_plan.start_date
      insertData.initial_deposit = installment_plan.initial_deposit || 0
      insertData.next_payment_date = installment_plan.start_date
    }

    const { data: buyer, error } = await adminClient
      .from('buyers')
      .insert(insertData as TablesInsert<'buyers'>)
      .select()
      .single()

    if (error) {
      return serverError(error, 'POST /api/buyers')
    }

    // Decrement available_plots if buyer paid outright and has an estate
    if (insertData.payment_status === 'fully_paid' && insertData.estate_id) {
      const plotCount = insertData.number_of_plots || 1
      const { data: estate } = await adminClient
        .from('estates')
        .select('available_plots')
        .eq('id', insertData.estate_id)
        .single()
      if (estate && estate.available_plots > 0) {
        const newAvailable = Math.max(0, estate.available_plots - plotCount)
        await adminClient
          .from('estates')
          .update({ available_plots: newAvailable })
          .eq('id', insertData.estate_id)
      }
    }

    // Auto-create payment record for initial amount paid (outright or initial deposit)
    if (buyer && insertData.amount_paid && insertData.amount_paid > 0) {
      const today = new Date().toISOString().split('T')[0]
      await adminClient.from('payments').insert({
        buyer_id: buyer.id,
        amount: insertData.amount_paid,
        payment_date: insertData.purchase_date || today,
        payment_method: 'bank_transfer',
        reference: null,
        notes: insertData.payment_status === 'fully_paid' ? 'Outright payment' : 'Initial deposit',
        recorded_by: result.auth.userId,
      })
    }

    // Generate installment schedule if plan is enabled
    if (installment_plan?.enabled && installment_plan.duration_months && installment_plan.start_date && buyer) {
      const schedule = generateInstallmentSchedule({
        total_amount: buyerFields.total_amount,
        initial_deposit: installment_plan.initial_deposit || 0,
        duration_months: installment_plan.duration_months,
        start_date: installment_plan.start_date,
      })

      const scheduleEntries = schedule.map((entry) => ({
        buyer_id: buyer.id,
        installment_number: entry.installment_number,
        due_date: entry.due_date,
        expected_amount: entry.expected_amount,
      }))

      await adminClient.from('payment_schedules').insert(scheduleEntries)
    }

    // Auto-create commission if buyer has an agent
    // For outright: commission on full amount. For installment: commission on initial deposit only.
    // Subsequent installment payments will add to the commission via the payments API.
    if (buyer && insertData.agent_id) {
      const { data: agent } = await adminClient
        .from('agents')
        .select('id, commission_type, commission_rate')
        .eq('id', insertData.agent_id)
        .single()

      if (agent && agent.commission_rate > 0) {
        const isOutright = insertData.payment_status === 'fully_paid'
        const commissionBase = isOutright ? buyerFields.total_amount : (insertData.amount_paid || 0)
        const commissionAmount = agent.commission_type === 'percentage'
          ? (commissionBase * agent.commission_rate) / 100
          : agent.commission_rate

        await adminClient.from('commissions').insert({
          agent_id: agent.id,
          buyer_id: buyer.id,
          commission_amount: commissionAmount,
          amount_paid: 0,
          status: 'pending',
        })
      }
    }

    logActivity({
      userId: result.auth.userId,
      userName: result.auth.userName,
      action: 'created',
      entityType: 'buyer',
      entityId: buyer.id,
      entityLabel: `${buyerFields.first_name} ${buyerFields.last_name}`,
      details: { estate_id: insertData.estate_id, total_amount: buyerFields.total_amount },
    })

    return NextResponse.json({ buyer }, { status: 201 })
  } catch (err) {
    return serverError(err, 'POST /api/buyers')
  }
}
