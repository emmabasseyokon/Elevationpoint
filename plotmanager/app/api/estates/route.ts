import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, validationError, serverError, sanitizeSearch } from '@/lib/api-helpers'
import { estateSchema } from '@/lib/validations'
import { logActivity } from '@/lib/activity-log'

export async function GET(request: NextRequest) {
  try {
    const result = await authenticateRequest()
    if (result.error) return result.error
    const { adminClient } = result.auth

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    let query = adminClient
      .from('estates')
      .select('*')
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (search) {
      const safe = sanitizeSearch(search)
      if (safe) {
        query = query.or(
          `name.ilike.%${safe}%,location.ilike.%${safe}%`
        )
      }
    }

    const { data: estates, error } = await query

    if (error) {
      return serverError(error, 'GET /api/estates')
    }

    return NextResponse.json({ estates })
  } catch (err) {
    return serverError(err, 'GET /api/estates')
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await authenticateRequest()
    if (result.error) return result.error
    const { adminClient } = result.auth

    const body = await request.json()
    const parsed = estateSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    // Set price_per_plot from the default plot size, or fallback to minimum
    const insertData: any = { ...parsed.data }
    if (insertData.plot_sizes && insertData.plot_sizes.length > 0) {
      const defaultSize = insertData.plot_sizes.find((ps: any) => ps.is_default)
      insertData.price_per_plot = defaultSize
        ? defaultSize.price
        : Math.min(...insertData.plot_sizes.map((ps: any) => ps.price))
    }

    const { data: estate, error } = await adminClient
      .from('estates')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      return serverError(error, 'POST /api/estates')
    }

    logActivity({
      userId: result.auth.userId,
      userName: result.auth.userName,
      action: 'created',
      entityType: 'estate',
      entityId: estate.id,
      entityLabel: parsed.data.name,
      details: { total_plots: parsed.data.total_plots, location: parsed.data.location },
    })

    return NextResponse.json({ estate }, { status: 201 })
  } catch (err) {
    return serverError(err, 'POST /api/estates')
  }
}
