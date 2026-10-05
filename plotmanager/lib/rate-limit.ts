import { createAdminClient } from '@/lib/supabase/admin'

interface RateLimitConfig {
  maxRequests: number
  windowSeconds: number
}

// Counts live in Postgres (check_rate_limit) so limits hold across serverless instances.
// Fails open: if the check itself errors, the request is allowed rather than blocking real users.
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  try {
    const { data, error } = await createAdminClient().rpc('check_rate_limit', {
      p_key: key,
      p_max: config.maxRequests,
      p_window_seconds: config.windowSeconds,
    })

    const row = data?.[0]
    if (error || !row) {
      console.error('[RateLimit] check failed:', error?.message)
      return { allowed: true, retryAfterSeconds: 0 }
    }

    return { allowed: row.allowed, retryAfterSeconds: row.retry_after_seconds }
  } catch (err) {
    console.error('[RateLimit] check failed:', err)
    return { allowed: true, retryAfterSeconds: 0 }
  }
}

export function getRateLimitKey(request: Request, prefix: string): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
  return `${prefix}:${ip}`
}
