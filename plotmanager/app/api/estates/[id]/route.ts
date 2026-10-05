import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, validationError, serverError } from '@/lib/api-helpers'
import { estateSchema } from '@/lib/validations'
import { logActivity } from '@/lib/activity-log'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await authenticateRequest()
    if (result.error) return result.error
    const { adminClient } = result.auth

    const { data: estate, error } = await adminClient
      .from('estates')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !estate) {
      return NextResponse.json({ error: 'Estate not found' }, { status: 404 })
    }

    return NextResponse.json({ estate })
  } catch (err) {
    return serverError(err, 'estates/[id]')
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
    const parsed = estateSchema.partial().safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    const { data: existing } = await adminClient
      .from('estates')
      .select('id')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Estate not found' }, { status: 404 })
    }

    // Set price_per_plot from the default plot size, or fallback to minimum
    const updateData: any = { ...parsed.data }
    if (updateData.plot_sizes && updateData.plot_sizes.length > 0) {
      const defaultSize = updateData.plot_sizes.find((ps: any) => ps.is_default)
      updateData.price_per_plot = defaultSize
        ? defaultSize.price
        : Math.min(...updateData.plot_sizes.map((ps: any) => ps.price))
    }

    const { data: estate, error } = await adminClient
      .from('estates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return serverError(error, `estates/${id}`)
    }

    if (estate) {
      logActivity({
        userId: result.auth.userId,
        userName: result.auth.userName,
        action: 'updated',
        entityType: 'estate',
        entityId: id,
        entityLabel: estate.name,
      })
    }

    return NextResponse.json({ estate })
  } catch (err) {
    return serverError(err, 'estates/[id]')
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await authenticateRequest()
    if (result.error) return result.error
    const { adminClient } = result.auth

    const { data: existing } = await adminClient
      .from('estates')
      .select('id, name')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Estate not found' }, { status: 404 })
    }

    const { error } = await adminClient
      .from('estates')
      .delete()
      .eq('id', id)

    if (error) {
      return serverError(error, `estates/${id}`)
    }

    logActivity({
      userId: result.auth.userId,
      userName: result.auth.userName,
      action: 'deleted',
      entityType: 'estate',
      entityId: id,
      entityLabel: existing.name,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return serverError(err, 'estates/[id]')
  }
}
