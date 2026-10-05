import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, validationError, serverError } from '@/lib/api-helpers'
import { agentSchema } from '@/lib/validations'
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

    const { data: agent, error } = await adminClient
      .from('agents')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Fetch related commissions count and total
    const { count: commissionsCount } = await adminClient
      .from('commissions')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', id)

    const { data: commissionTotal } = await adminClient
      .from('commissions')
      .select('commission_amount')
      .eq('agent_id', id)

    const totalCommission = (commissionTotal || []).reduce(
      (sum, c) => sum + (c.commission_amount || 0),
      0
    )

    return NextResponse.json({
      agent,
      commissions_count: commissionsCount ?? 0,
      total_commission: totalCommission,
    })
  } catch (err) {
    return serverError(err, 'agents/[id]')
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
    const parsed = agentSchema.partial().safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    // Only include fields that were actually sent in the request body
    // to avoid .default() values overwriting existing data
    const sentKeys = new Set(Object.keys(body))
    const filteredFields: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(parsed.data)) {
      if (sentKeys.has(key)) filteredFields[key] = value
    }
    const updateData: TablesUpdate<'agents'> = { ...filteredFields }

    // Convert empty strings to null for DB compatibility
    for (const key of Object.keys(updateData)) {
      const k = key as keyof typeof updateData
      if (updateData[k] === '') (updateData[k] as unknown) = null
    }

    const { data: agent, error } = await adminClient
      .from('agents')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return serverError(error, 'agents/[id]')
    }

    if (agent) {
      logActivity({
        userId: result.auth.userId,
        userName: result.auth.userName,
        action: 'updated',
        entityType: 'agent',
        entityId: id,
        entityLabel: `${agent.first_name} ${agent.last_name}`,
      })
    }

    return NextResponse.json({ agent })
  } catch (err) {
    return serverError(err, 'agents/[id]')
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

    // Get agent name before deleting
    const { data: existing } = await adminClient
      .from('agents')
      .select('first_name, last_name')
      .eq('id', id)
      .single()

    const { error } = await adminClient
      .from('agents')
      .delete()
      .eq('id', id)

    if (error) {
      return serverError(error, 'agents/[id]')
    }

    logActivity({
      userId: result.auth.userId,
      userName: result.auth.userName,
      action: 'deleted',
      entityType: 'agent',
      entityId: id,
      entityLabel: existing ? `${existing.first_name} ${existing.last_name}` : undefined,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return serverError(err, 'agents/[id]')
  }
}
