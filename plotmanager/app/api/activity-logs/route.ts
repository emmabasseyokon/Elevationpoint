import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, requireSuperAdmin, serverError, sanitizeSearch } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const result = await authenticateRequest()
    if (result.error) return result.error
    const { adminClient } = result.auth

    const forbidden = requireSuperAdmin(result.auth)
    if (forbidden) return forbidden

    const searchParams = request.nextUrl.searchParams
    const entityType = searchParams.get('entity_type')
    const action = searchParams.get('action')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = 50
    const offset = (page - 1) * limit

    let query = adminClient
      .from('activity_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (entityType && entityType !== 'all') query = query.eq('entity_type', entityType)
    if (action && action !== 'all') query = query.eq('action', action)
    if (search) {
      const safe = sanitizeSearch(search)
      if (safe) query = query.or(`entity_label.ilike.%${safe}%,user_name.ilike.%${safe}%`)
    }

    const { data: logs, count, error } = await query

    if (error) return serverError(error, 'GET /api/activity-logs')

    return NextResponse.json({ logs, total: count })
  } catch (err) {
    return serverError(err, 'GET /api/activity-logs')
  }
}
