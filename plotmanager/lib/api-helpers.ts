import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ZodError } from 'zod'

export interface AuthResult {
  userId: string
  role: 'super_admin' | 'admin'
  userName: string
  adminClient: ReturnType<typeof createAdminClient>
}

/**
 * Authenticate the request and return user info + admin client.
 * Returns null if unauthorized — caller should return the error response.
 */
export async function authenticateRequest(): Promise<
  | { auth: AuthResult; error?: never }
  | { auth?: never; error: NextResponse }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return { error: NextResponse.json({ error: 'Profile not found' }, { status: 404 }) }
  }

  return {
    auth: {
      userId: user.id,
      role: profile.role as 'super_admin' | 'admin',
      userName: profile.full_name,
      adminClient: createAdminClient(),
    },
  }
}

/**
 * Require super_admin role. Returns a 403 response if not authorized.
 */
export function requireSuperAdmin(auth: AuthResult): NextResponse | null {
  if (auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden: super admin access required' }, { status: 403 })
  }
  return null
}

/**
 * Return a standardized validation error response from a Zod error.
 */
export function validationError(zodError: ZodError): NextResponse {
  return NextResponse.json(
    { error: 'Validation failed', details: zodError.flatten().fieldErrors },
    { status: 400 }
  )
}

/**
 * Log error server-side and return a generic message to the client.
 */
export function serverError(err: unknown, context?: string): NextResponse {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[ServerError]${context ? ` ${context}:` : ''}`, message)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

/**
 * Sanitize a search string for use in Supabase .or() / .ilike() filters.
 * Strips characters that could alter PostgREST filter syntax.
 */
export function sanitizeSearch(input: string): string {
  return input.replace(/[%_\\(),.*]/g, '').trim().slice(0, 100)
}
