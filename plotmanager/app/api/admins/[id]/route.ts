import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, requireSuperAdmin, serverError } from '@/lib/api-helpers'
import { logActivity } from '@/lib/activity-log'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await authenticateRequest()
    if (result.error) return result.error
    const { auth } = result

    const forbidden = requireSuperAdmin(auth)
    if (forbidden) return forbidden

    // Prevent self-deletion
    if (id === auth.userId) {
      return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })
    }

    // Verify target is not a super_admin
    const { data: targetProfile } = await auth.adminClient
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', id)
      .single()

    if (!targetProfile) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    if (targetProfile.role === 'super_admin') {
      return NextResponse.json({ error: 'Cannot remove a super admin' }, { status: 403 })
    }

    // Delete profile then auth user
    await auth.adminClient.from('profiles').delete().eq('id', id)
    await auth.adminClient.auth.admin.deleteUser(id)

    logActivity({
      userId: auth.userId,
      userName: auth.userName,
      action: 'deleted',
      entityType: 'admin',
      entityId: id,
      entityLabel: targetProfile.full_name,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return serverError(err, 'DELETE /api/admins/[id]')
  }
}
