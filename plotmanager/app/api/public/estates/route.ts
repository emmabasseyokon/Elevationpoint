import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { serverError } from '@/lib/api-helpers'

export async function GET() {
  try {
    const adminClient = createAdminClient()

    const { data: estates, error } = await adminClient
      .from('estates')
      .select('id, name, location, description, total_plots, available_plots, price_per_plot, plot_sizes, status, image_url')
      .in('status', ['active', 'sold_out'])
      .order('created_at', { ascending: false })

    if (error) {
      return serverError(error, 'GET /api/public/estates')
    }

    return NextResponse.json({ estates: estates || [] })
  } catch (err) {
    return serverError(err, 'GET /api/public/estates')
  }
}
