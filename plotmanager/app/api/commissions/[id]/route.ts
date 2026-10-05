import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, serverError } from '@/lib/api-helpers'
import { logActivity } from '@/lib/activity-log'

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

    // Only allow updating status
    const allowedStatuses = ['paid', 'unpaid']
    if (!body.status || !allowedStatuses.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const { data: commission, error } = await adminClient
      .from('commissions')
      .update({ status: body.status })
      .eq('id', id)
      .select()
      .single()

    if (error || !commission) {
      return NextResponse.json({ error: 'Commission not found' }, { status: 404 })
    }

    logActivity({
      userId: result.auth.userId,
      userName: result.auth.userName,
      action: 'updated',
      entityType: 'commission',
      entityId: id,
      entityLabel: `Commission status → ${body.status}`,
      details: { status: body.status },
    })

    return NextResponse.json({ commission })
  } catch (err) {
    return serverError(err, 'PUT /api/commissions/[id]')
  }
}
