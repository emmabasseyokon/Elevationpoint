import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/Card'
import { ActivityLogFilters } from '@/components/ActivityLogFilters'
import { ScrollText } from 'lucide-react'
import Link from 'next/link'

const ACTION_STYLES: Record<string, string> = {
  created: 'bg-green-100 text-green-700',
  updated: 'bg-blue-100 text-blue-700',
  deleted: 'bg-red-100 text-red-700',
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  buyer: 'Buyer',
  estate: 'Estate',
  agent: 'Agent',
  payment: 'Payment',
  commission: 'Commission',
  admin: 'Admin',
  reminder: 'Reminder',
  settings: 'Settings',
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function ActivityLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; entity_type?: string; action?: string; page?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (profile.role !== 'super_admin') redirect('/dashboard')

  const page = parseInt(params.page || '1')
  const limit = 50
  const offset = (page - 1) * limit

  let query = supabase
    .from('activity_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (params.entity_type && params.entity_type !== 'all') {
    query = query.eq('entity_type', params.entity_type)
  }
  if (params.action && params.action !== 'all') {
    query = query.eq('action', params.action)
  }
  if (params.search) {
    query = query.or(
      `entity_label.ilike.%${params.search}%,user_name.ilike.%${params.search}%`
    )
  }

  const { data: logsRaw, count } = await query
  const logs = (logsRaw || []) as Array<{
    id: string
    user_name: string
    action: string
    entity_type: string
    entity_label: string | null
    created_at: string
  }>

  const totalPages = Math.ceil((count || 0) / limit)

  // Build pagination params helper
  function pageUrl(p: number) {
    const sp = new URLSearchParams()
    if (params.search) sp.set('search', params.search)
    if (params.entity_type) sp.set('entity_type', params.entity_type)
    if (params.action) sp.set('action', params.action)
    if (p > 1) sp.set('page', String(p))
    const qs = sp.toString()
    return `/dashboard/activity-logs${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-gray-900">Activity Logs</h1>
        <p className="text-gray-500 mt-1">Track all changes made by your team</p>
      </div>

      <Card>
        <CardContent className="p-4 md:p-6">
          <ActivityLogFilters />
        </CardContent>
      </Card>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ScrollText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No activity logs yet</h3>
            <p className="text-gray-500">Activity will appear here as your team makes changes.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-sm font-medium text-gray-500 px-6 py-4">Date/Time</th>
                    <th className="text-left text-sm font-medium text-gray-500 px-6 py-4">Admin</th>
                    <th className="text-left text-sm font-medium text-gray-500 px-6 py-4">Action</th>
                    <th className="text-left text-sm font-medium text-gray-500 px-6 py-4">Type</th>
                    <th className="text-left text-sm font-medium text-gray-500 px-6 py-4">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {log.user_name}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize ${ACTION_STYLES[log.action] || 'bg-gray-100 text-gray-700'}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {ENTITY_TYPE_LABELS[log.entity_type] || log.entity_type}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {log.entity_label || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {logs.map((log) => (
              <Card key={log.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize ${ACTION_STYLES[log.action] || 'bg-gray-100 text-gray-700'}`}>
                      {log.action}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDateTime(log.created_at)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    {log.user_name}
                  </p>
                  <p className="text-sm text-gray-600">
                    {log.action} {ENTITY_TYPE_LABELS[log.entity_type]?.toLowerCase() || log.entity_type}
                    {log.entity_label ? `: ${log.entity_label}` : ''}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages} ({count} total)
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={pageUrl(page - 1)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={pageUrl(page + 1)}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
