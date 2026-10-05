import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database.types'

export type ActivityAction = 'created' | 'updated' | 'deleted'
export type EntityType = 'buyer' | 'estate' | 'agent' | 'payment' | 'commission' | 'admin' | 'reminder' | 'settings'

interface LogActivityParams {
  userId: string
  userName: string
  action: ActivityAction
  entityType: EntityType
  entityId?: string
  entityLabel?: string
  details?: Record<string, Json | undefined>
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    const adminClient = createAdminClient()
    await adminClient.from('activity_logs').insert({
      user_id: params.userId,
      user_name: params.userName,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      entity_label: params.entityLabel ?? null,
      details: params.details ?? {},
    })
  } catch (err) {
    console.error('[ActivityLog] Failed to log activity:', err)
  }
}
