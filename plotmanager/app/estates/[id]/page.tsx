export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { APP_NAME, APP_COMPANY_SLUG } from '@/lib/config'
import { MapPin, ArrowLeft, Phone, Mail } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

function formatPrice(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

interface EstateDetailProps {
  params: Promise<{ id: string }>
}

export default async function EstateDetailPage({ params }: EstateDetailProps) {
  const { id } = await params
  const adminClient = createAdminClient()

  const { data: estate } = await adminClient
    .from('estates')
    .select('*')
    .eq('id', id)
    .in('status', ['active', 'sold_out'])
    .single()

  if (!estate) notFound()

  const plotSizes = (estate as unknown as { plot_sizes?: Array<{ size: string; price: number; is_default?: boolean }> | null }).plot_sizes ?? null

  const { data: company } = await adminClient
    .from('companies')
    .select('name, phone, email')
    .limit(1)
    .single()

  const isSoldOut = estate.status === 'sold_out' || estate.available_plots === 0
  const soldPercentage = estate.total_plots > 0
    ? Math.round(((estate.total_plots - estate.available_plots) / estate.total_plots) * 100)
    : 0
  const companyName = company?.name || APP_NAME

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <Link href="/" className="font-display text-xl font-bold text-gray-900">
                {companyName}
              </Link>
            </div>
            <Link
              href="/login"
              className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              Admin
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <Link
          href="/#estates"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to all estates
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image */}
          <div className="relative h-80 sm:h-[500px] lg:h-full min-h-[500px] bg-gradient-to-br from-primary-100 to-primary-50 rounded-2xl overflow-hidden">
            {estate.image_url ? (
              <Image
                src={estate.image_url}
                alt={estate.name}
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <MapPin className="w-16 h-16 text-primary-300" />
              </div>
            )}
            <div className="absolute top-4 right-4">
              {isSoldOut ? (
                <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-red-100 text-red-700">
                  Sold Out
                </span>
              ) : (
                <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-primary-100 text-primary-700">
                  {estate.available_plots} plots left
                </span>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-gray-900">
                {estate.name}
              </h1>
              {estate.location && (
                <p className="mt-2 text-gray-500 flex items-center gap-1.5 text-lg">
                  <MapPin className="w-5 h-5" />
                  {estate.location}
                </p>
              )}
            </div>

            {estate.description && (
              <p className="text-gray-600 leading-relaxed">{estate.description}</p>
            )}

            {/* Stats */}
            <div className="space-y-4">
              {plotSizes && plotSizes.length > 0 ? (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500 mb-3">Plot Sizes & Pricing</p>
                  <div className="space-y-2">
                    {plotSizes.map((ps) => (
                      <div key={ps.size} className="flex items-center justify-between">
                        <span className="text-gray-700 font-medium">{ps.size}</span>
                        <span className="text-lg font-bold text-gray-900">{formatPrice(ps.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Price per plot</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {estate.price_per_plot ? formatPrice(estate.price_per_plot) : 'Contact us'}
                  </p>
                </div>
              )}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-500">Available plots</p>
                <p className="text-2xl font-bold text-gray-900">
                  {estate.available_plots} <span className="text-base font-normal text-gray-500">/ {estate.total_plots}</span>
                </p>
              </div>
            </div>

            {/* Progress */}
            <div>
              <div className="flex justify-between text-sm text-gray-500 mb-2">
                <span>{soldPercentage}% sold</span>
                <span>{estate.total_plots} total plots</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${isSoldOut ? 'bg-red-500' : 'bg-primary-500'}`}
                  style={{ width: `${soldPercentage}%` }}
                />
              </div>
            </div>

            {/* CTA */}
            {!isSoldOut && APP_COMPANY_SLUG && (
              <Link
                href={`/form/${APP_COMPANY_SLUG}`}
                className="w-full inline-flex items-center justify-center px-8 py-4 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/20 text-lg"
              >
                Secure a Plot
              </Link>
            )}

            {/* Contact */}
            {(company?.phone || company?.email) && (
              <div className="border-t border-gray-100 pt-6">
                <p className="text-sm font-semibold text-gray-900 mb-3">Have questions? Contact us</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  {company.phone && (
                    <a
                      href={`tel:${company.phone}`}
                      className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-primary-600 transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      {company.phone}
                    </a>
                  )}
                  {company.email && (
                    <a
                      href={`mailto:${company.email}`}
                      className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-primary-600 transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      {company.email}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
