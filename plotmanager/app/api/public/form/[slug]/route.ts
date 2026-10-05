import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { publicBuyerFormSchema } from '@/lib/validations'
import { generateInstallmentSchedule } from '@/lib/schedule'
import { checkRateLimit, getRateLimitKey } from '@/lib/rate-limit'
import type { TablesInsert } from '@/types/database.types'

type PlotSizeEntry = { size: string; price: number; is_default?: boolean }

async function getCompanyBySlug(slug: string) {
  const adminClient = createAdminClient()

  const { data: company } = await adminClient
    .from('companies')
    .select('name, slug, form_enabled')
    .eq('slug', slug)
    .single()

  return company
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const company = await getCompanyBySlug(slug)

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    if (!company.form_enabled) {
      return NextResponse.json({ error: 'Form is not enabled' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    const { data: estates } = await adminClient
      .from('estates')
      .select('id, name, location, price_per_plot, plot_sizes')
      .eq('status', 'active')
      .gt('available_plots', 0)
      .order('name')

    return NextResponse.json({
      company: { name: company.name, slug: company.slug },
      estates: (estates || []).map((e) => ({
        id: e.id,
        name: e.name,
        location: e.location,
        price_per_plot: e.price_per_plot,
        plot_sizes: e.plot_sizes || [],
      })),
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    // Rate limit: 5 submissions per minute per IP
    const rateLimitKey = getRateLimitKey(request, 'public-form')
    const { allowed, retryAfterSeconds } = await checkRateLimit(rateLimitKey, { maxRequests: 5, windowSeconds: 60 })
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
      )
    }

    const { slug } = await params
    const company = await getCompanyBySlug(slug)

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    if (!company.form_enabled) {
      return NextResponse.json({ error: 'Form is not available' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = publicBuyerFormSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data
    const adminClient = createAdminClient()

    // Verify estate belongs to company and has available plots
    const { data: estate } = await adminClient
      .from('estates')
      .select('id, name, location, price_per_plot, available_plots, plot_sizes')
      .eq('id', data.estate_id)
      .single()

    if (!estate) {
      return NextResponse.json({ error: 'Estate not found' }, { status: 404 })
    }

    if (estate.available_plots < (data.number_of_plots || 1)) {
      return NextResponse.json({ error: 'Not enough available plots in this estate' }, { status: 400 })
    }

    // Calculate total amount for new plots — support "2x 250sqm, 3x 600sqm" format
    const plotSizes = (estate.plot_sizes || []) as PlotSizeEntry[]
    const numberOfPlots = data.number_of_plots || 1
    let newPlotsTotalAmount: number

    if (data.plot_size && plotSizes.length > 0) {
      const entries = data.plot_size.split(',').map((s: string) => s.trim()).filter(Boolean)
      newPlotsTotalAmount = entries.reduce((sum: number, entry: string) => {
        const qtyMatch = entry.match(/^(\d+)x\s+(.+)$/)
        const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1
        const sizeName = qtyMatch ? qtyMatch[2] : entry
        const matched = plotSizes.find((ps) => ps.size === sizeName)
        return sum + (matched ? matched.price * qty : 0)
      }, 0)
      if (newPlotsTotalAmount === 0) {
        newPlotsTotalAmount = (estate.price_per_plot || 0) * numberOfPlots
      }
    } else {
      newPlotsTotalAmount = (estate.price_per_plot || 0) * numberOfPlots
    }

    const today = new Date().toISOString().split('T')[0]
    const isOutright = data.payment_type === 'outright'
    const initialDeposit = data.initial_deposit || 0

    // Duplicate check: same email + estate (skip if adding another plot)
    if (!data.add_another) {
      const { data: existing } = await adminClient
        .from('buyers')
        .select('id, first_name, last_name, email, phone, plot_size, plot_number, number_of_plots, total_amount, amount_paid, payment_status, purchase_date, created_at')
        .eq('email', data.email)
        .eq('estate_id', data.estate_id)
        .limit(1)

      if (existing && existing.length > 0) {
        return NextResponse.json(
          {
            error: 'duplicate_buyer',
            message: 'You already have a plot in this estate.',
            existingBuyer: existing[0],
          },
          { status: 409 }
        )
      }
    }

    // ── ADD ANOTHER PLOT: merge into existing buyer record ──
    if (data.add_another && data.existing_buyer_id) {
      const { data: existingBuyer } = await adminClient
        .from('buyers')
        .select('*')
        .eq('id', data.existing_buyer_id)
        .eq('estate_id', data.estate_id)
        .single()

      if (!existingBuyer) {
        return NextResponse.json({ error: 'Existing buyer not found' }, { status: 404 })
      }

      // Merge plot sizes: parse existing + new into combined quantities
      const mergedQuantities: Record<string, number> = {}

      // Parse existing plot_size string
      if (existingBuyer.plot_size) {
        const existingEntries = existingBuyer.plot_size.split(',').map((s: string) => s.trim()).filter(Boolean)
        for (const entry of existingEntries) {
          const match = entry.match(/^(\d+)x\s+(.+)$/)
          if (match) {
            mergedQuantities[match[2]] = (mergedQuantities[match[2]] || 0) + parseInt(match[1])
          } else {
            mergedQuantities[entry] = (mergedQuantities[entry] || 0) + 1
          }
        }
      }

      // Parse new plot_size string and add to merged
      if (data.plot_size) {
        const newEntries = data.plot_size.split(',').map((s: string) => s.trim()).filter(Boolean)
        for (const entry of newEntries) {
          const match = entry.match(/^(\d+)x\s+(.+)$/)
          if (match) {
            mergedQuantities[match[2]] = (mergedQuantities[match[2]] || 0) + parseInt(match[1])
          } else {
            mergedQuantities[entry] = (mergedQuantities[entry] || 0) + 1
          }
        }
      }

      // Build merged plot_size string
      const mergedPlotSize = Object.entries(mergedQuantities)
        .map(([size, qty]) => `${qty}x ${size}`)
        .join(', ')

      const mergedPlotCount = Object.values(mergedQuantities).reduce((sum, qty) => sum + qty, 0)
      const mergedTotalAmount = existingBuyer.total_amount + newPlotsTotalAmount
      const newAmountPaid = isOutright ? newPlotsTotalAmount : initialDeposit
      const mergedAmountPaid = existingBuyer.amount_paid + newAmountPaid

      // Determine merged payment status
      let mergedPaymentStatus = existingBuyer.payment_status
      if (mergedAmountPaid >= mergedTotalAmount) {
        mergedPaymentStatus = 'fully_paid'
      } else if (mergedAmountPaid > 0) {
        mergedPaymentStatus = 'installment'
      }

      // Append note about new plots
      const plotNote = `Added ${numberOfPlots} plot(s) on ${today}: ${data.plot_size || 'N/A'}`
      const mergedNotes = existingBuyer.notes
        ? `${existingBuyer.notes}\n${plotNote}`
        : plotNote

      // Append new payment proof to documents array
      const existingDocs = Array.isArray(existingBuyer.documents) ? existingBuyer.documents : []
      const updatedDocs = data.payment_proof_url
        ? [...existingDocs, { url: data.payment_proof_url, label: `Proof - ${data.plot_size || 'Additional plot'}`, date: today }]
        : existingDocs

      // Build update payload
      const updatePayload: Record<string, unknown> = {
        plot_size: mergedPlotSize,
        number_of_plots: mergedPlotCount,
        total_amount: mergedTotalAmount,
        amount_paid: mergedAmountPaid,
        payment_status: mergedPaymentStatus,
        notes: mergedNotes,
        documents: updatedDocs,
      }

      // Update installment plan fields if new plots are on installment
      const planStartDate = data.plan_start_date || today
      if (!isOutright && data.installment_duration) {
        updatePayload.has_installment_plan = true
        updatePayload.plan_duration_months = data.installment_duration
        updatePayload.plan_start_date = planStartDate
        updatePayload.initial_deposit = (existingBuyer.initial_deposit || 0) + initialDeposit
      }

      const { data: updatedBuyer, error: updateError } = await adminClient
        .from('buyers')
        .update(updatePayload)
        .eq('id', existingBuyer.id)
        .select()
        .single()

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      // Record payment for the new plots
      if (newAmountPaid > 0) {
        await adminClient.from('payments').insert({
          buyer_id: existingBuyer.id,
          amount: newAmountPaid,
          payment_date: data.purchase_date || today,
          payment_method: 'bank_transfer',
          reference: null,
          notes: `Additional plots: ${data.plot_size || numberOfPlots + ' plot(s)'}`,
        })
      }

      // Generate installment schedule for the new plots
      if (!isOutright && data.installment_duration) {
        const schedule = generateInstallmentSchedule({
          total_amount: newPlotsTotalAmount,
          initial_deposit: initialDeposit,
          duration_months: data.installment_duration,
          start_date: planStartDate,
        })

        // Get the highest existing installment number to continue numbering
        const { data: existingSchedules } = await adminClient
          .from('payment_schedules')
          .select('installment_number')
          .eq('buyer_id', existingBuyer.id)
          .order('installment_number', { ascending: false })
          .limit(1)

        const lastNumber = existingSchedules?.[0]?.installment_number || 0

        const scheduleEntries = schedule.map((entry) => ({
          buyer_id: existingBuyer.id,
          installment_number: lastNumber + entry.installment_number,
          due_date: entry.due_date,
          expected_amount: entry.expected_amount,
        }))

        if (scheduleEntries.length > 0) {
          await adminClient.from('payment_schedules').insert(scheduleEntries)
        }
      }

      // Decrement available plots
      if (isOutright) {
        const newAvailable = Math.max(0, estate.available_plots - numberOfPlots)
        await adminClient
          .from('estates')
          .update({ available_plots: newAvailable })
          .eq('id', data.estate_id)
      }

      // Auto-create commission for the new plots if agent is set
      // For outright: commission on full amount. For installment: commission on initial deposit only.
      const agentId = data.agent_id || existingBuyer.agent_id
      if (agentId) {
        const { data: agent } = await adminClient
          .from('agents')
          .select('id, commission_type, commission_rate')
          .eq('id', agentId)
          .single()

        if (agent && agent.commission_rate > 0) {
          const commissionBase = isOutright ? newPlotsTotalAmount : initialDeposit
          const commissionAmount = agent.commission_type === 'percentage'
            ? (commissionBase * agent.commission_rate) / 100
            : agent.commission_rate

          await adminClient.from('commissions').insert({
            agent_id: agent.id,
            buyer_id: existingBuyer.id,
            commission_amount: commissionAmount,
            amount_paid: 0,
            status: 'pending',
          })
        }
      }

      return NextResponse.json({ success: true }, { status: 201 })
    }

    // ── NEW BUYER: insert fresh record ──
    const insertData: TablesInsert<'buyers'> = {
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone,
      gender: data.gender || null,
      home_address: data.home_address || null,
      city: data.city || null,
      state: data.state || null,
      estate_id: data.estate_id,
      plot_location: estate.location || null,
      plot_size: data.plot_size || null,
      number_of_plots: numberOfPlots,
      purchase_date: data.purchase_date || today,
      total_amount: newPlotsTotalAmount,
      amount_paid: isOutright ? newPlotsTotalAmount : initialDeposit,
      payment_status: isOutright ? 'fully_paid' : 'installment',
      next_of_kin_name: data.next_of_kin_name || null,
      next_of_kin_phone: data.next_of_kin_phone || null,
      next_of_kin_address: data.next_of_kin_address || null,
      next_of_kin_relationship: data.next_of_kin_relationship || null,
      referral_source: data.referral_source || null,
      agent_id: data.agent_id || null,
      notes: data.notes || null,
      payment_proof_url: data.payment_proof_url || null,
    }

    // Installment plan metadata
    if (!isOutright && data.installment_duration) {
      insertData.has_installment_plan = true
      insertData.plan_duration_months = data.installment_duration
      insertData.plan_start_date = data.plan_start_date || today
      insertData.initial_deposit = initialDeposit
      insertData.next_payment_date = data.plan_start_date || today
    }

    // Convert empty dates to null
    const dateFields = ['purchase_date', 'next_payment_date', 'plan_start_date'] as const
    for (const field of dateFields) {
      if (insertData[field] === '') insertData[field] = null
    }

    const { data: buyer, error: buyerError } = await adminClient
      .from('buyers')
      .insert(insertData)
      .select()
      .single()

    if (buyerError) {
      return NextResponse.json({ error: buyerError.message }, { status: 500 })
    }

    // Auto-create payment record for initial amount paid (outright or initial deposit)
    if (buyer && (insertData.amount_paid ?? 0) > 0) {
      await adminClient.from('payments').insert({
        buyer_id: buyer.id,
        amount: insertData.amount_paid ?? 0,
        payment_date: insertData.purchase_date || today,
        payment_method: 'bank_transfer',
        reference: null,
        notes: isOutright ? 'Outright payment' : 'Initial deposit',
      })
    }

    // Decrement plots if outright
    if (isOutright) {
      const newAvailable = Math.max(0, estate.available_plots - numberOfPlots)
      await adminClient
        .from('estates')
        .update({ available_plots: newAvailable })
        .eq('id', data.estate_id)
    }

    // Generate installment schedule
    if (!isOutright && data.installment_duration && buyer) {
      const schedule = generateInstallmentSchedule({
        total_amount: newPlotsTotalAmount,
        initial_deposit: initialDeposit,
        duration_months: data.installment_duration,
        start_date: data.plan_start_date || today,
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
    if (buyer && insertData.agent_id) {
      const { data: agent } = await adminClient
        .from('agents')
        .select('id, commission_type, commission_rate')
        .eq('id', insertData.agent_id)
        .single()

      if (agent && agent.commission_rate > 0) {
        const commissionBase = isOutright ? newPlotsTotalAmount : initialDeposit
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

    return NextResponse.json({ success: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
