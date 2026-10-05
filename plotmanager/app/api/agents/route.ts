import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, validationError, serverError, sanitizeSearch } from '@/lib/api-helpers'
import { agentSchema } from '@/lib/validations'
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
      .from('agents')
      .select('*')
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (search) {
      const safe = sanitizeSearch(search)
      if (safe) {
        query = query.or(
          `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`
        )
      }
    }

    const { data: agents, error } = await query

    if (error) {
      return serverError(error, 'GET /api/agents')
    }

    return NextResponse.json({ agents })
  } catch (err) {
    return serverError(err, 'GET /api/agents')
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await authenticateRequest()
    if (result.error) return result.error
    const { adminClient } = result.auth

    const body = await request.json()
    const parsed = agentSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    const insertData: Partial<TablesInsert<'agents'>> = {
      ...parsed.data,
    }

    // Convert empty strings to null for DB compatibility
    for (const key of Object.keys(insertData)) {
      const k = key as keyof typeof insertData
      if (insertData[k] === '') (insertData[k] as unknown) = null
    }

    const { data: agent, error } = await adminClient
      .from('agents')
      .insert(insertData as TablesInsert<'agents'>)
      .select()
      .single()

    if (error) {
      return serverError(error, 'POST /api/agents')
    }

    logActivity({
      userId: result.auth.userId,
      userName: result.auth.userName,
      action: 'created',
      entityType: 'agent',
      entityId: agent.id,
      entityLabel: `${parsed.data.first_name} ${parsed.data.last_name}`,
    })

    return NextResponse.json({ agent }, { status: 201 })
  } catch (err) {
    return serverError(err, 'POST /api/agents')
  }
}
