export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { APP_NAME, APP_COMPANY_SLUG } from '@/lib/config'
import { MapPin, Phone, Mail, ArrowRight, CheckCircle2, Quote } from 'lucide-react'
import { LandingNav } from '@/components/LandingNav'
import Image from 'next/image'
import Link from 'next/link'

function formatPrice(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default async function LandingPage() {
  const adminClient = createAdminClient()

  // Fetch company info
  const { data: company } = await adminClient
    .from('companies')
    .select('*')
    .limit(1)
    .single()

  // Fetch estates (active + sold_out)
  const { data: estates } = await adminClient
    .from('estates')
    .select('id, name, location, description, total_plots, available_plots, price_per_plot, status, image_url, plot_sizes')
    .in('status', ['active', 'sold_out'])
    .order('created_at', { ascending: false })

  interface Estate {
    id: string
    name: string
    location: string | null
    description: string | null
    total_plots: number
    available_plots: number
    price_per_plot: number | null
    status: string
    image_url: string | null
    plot_sizes: Array<{ size: string; price: number; is_default?: boolean }> | null
  }

  const companyName = company?.name || APP_NAME

  return (
    <div className="min-h-screen bg-white">
      <LandingNav companyName={companyName} />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary-50 via-white to-secondary-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight">
              Own Your Land,{' '}
              <span className="text-primary-600">Build Your Future</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 leading-relaxed">
              Explore our premium estates and secure your plot today.
              Flexible payment plans available.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="#estates"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/20"
              >
                View Estates
                <ArrowRight className="w-5 h-5 ml-2" />
              </a>
              {company?.form_enabled && APP_COMPANY_SLUG && (
                <Link
                  href={`/form/${APP_COMPANY_SLUG}`}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 bg-white text-primary-700 font-semibold rounded-xl border-2 border-primary-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
                >
                  Secure a Plot
                </Link>
              )}
            </div>
          </div>
        </div>
        {/* Decorative blobs */}
        <div className="absolute top-0 left-0 w-72 h-72 bg-primary-200/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary-200/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />
      </section>

      {/* Estates Section */}
      <section id="estates" className="py-16 sm:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900">
              Our Estates
            </h2>
            <p className="mt-3 text-gray-600 text-lg">
              Browse available properties and find the perfect plot for you
            </p>
          </div>

          {(!estates || estates.length === 0) ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">No estates available yet</h3>
              <p className="text-gray-500">Check back soon for new listings.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {(estates as Estate[]).map((estate) => {
                const isSoldOut = estate.status === 'sold_out' || estate.available_plots === 0
                const soldPercentage = estate.total_plots > 0
                  ? Math.round(((estate.total_plots - estate.available_plots) / estate.total_plots) * 100)
                  : 0

                return (
                  <Link
                    key={estate.id}
                    href={`/estates/${estate.id}`}
                    className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-lg transition-shadow group block"
                  >
                    {/* Image */}
                    <div className="relative h-96 bg-gradient-to-br from-primary-100 to-primary-50 overflow-hidden">
                      {estate.image_url ? (
                        <Image
                          src={estate.image_url}
                          alt={estate.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <MapPin className="w-12 h-12 text-primary-300" />
                        </div>
                      )}
                      {/* Status badge */}
                      <div className="absolute top-3 right-3">
                        {isSoldOut ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                            Sold Out
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary-100 text-primary-700">
                            {estate.available_plots} plots left
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-5">
                      <h3 className="font-display text-xl font-bold text-gray-900 mb-1">
                        {estate.name}
                      </h3>
                      {estate.location && (
                        <p className="text-sm text-gray-500 flex items-center gap-1 mb-3">
                          <MapPin className="w-3.5 h-3.5" />
                          {estate.location}
                        </p>
                      )}
                      {estate.description && (
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                          {estate.description}
                        </p>
                      )}

                      {/* Progress bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{soldPercentage}% sold</span>
                          <span>{estate.total_plots} total plots</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              isSoldOut ? 'bg-red-500' : 'bg-primary-500'
                            }`}
                            style={{ width: `${soldPercentage}%` }}
                          />
                        </div>
                      </div>

                      {/* Price */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500">
                            {estate.plot_sizes && estate.plot_sizes.length > 1 ? 'Starting from' : 'Price per plot'}
                          </p>
                          <p className="text-lg font-bold text-gray-900">
                            {estate.price_per_plot ? formatPrice(estate.price_per_plot) : 'Contact us'}
                          </p>
                        </div>
                        {!isSoldOut && (
                          <span className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg">
                            View Details
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900">
              Why Choose {companyName}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: 'Verified Properties', desc: 'All estates are properly surveyed with verified documentation and government approvals.' },
              { title: 'Flexible Payment', desc: 'Pay outright or spread payments over months with our installment plans.' },
              { title: 'Transparent Process', desc: 'Track your payments, get receipts, and stay updated every step of the way.' },
            ].map((item) => (
              <div key={item.title} className="text-center p-6">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-6 h-6 text-primary-600" />
                </div>
                <h3 className="font-display text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Client Testimonials */}
      <section className="py-16 sm:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-gray-900">
              Client Testimonials
            </h2>
            <p className="mt-3 text-gray-600 text-lg">
              Hear from our satisfied clients
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                name: 'Miss Sarah',
                text: "I'm so happy to have bought a property from Elevation Point. They took care of me during the inspection and gave me my allocation in less than one month! I wasn't expecting so much, but they proved to be in for serious business. I recommend them to anyone who is starting their investment Journey.",
              },
              {
                name: 'Mr. David',
                text: "I got to know EPIS through a friend who bought from them. To be honest, at first, I was sceptical about the investment but I just took the risk, I went for the inspection and they treated me well. I eventually paid for the land after all my questions were answered and I have been allocated.",
              },
            ].map((testimonial) => (
              <div
                key={testimonial.name}
                className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm"
              >
                <Quote className="w-8 h-8 text-primary-300 mb-4" />
                <p className="text-gray-600 leading-relaxed mb-6">
                  &ldquo;{testimonial.text}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-700 font-bold text-sm">
                      {testimonial.name.split(' ').pop()?.charAt(0)}
                    </span>
                  </div>
                  <p className="font-display font-bold text-gray-900">{testimonial.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact / Footer */}
      <footer id="contact" className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                <span className="font-display text-xl font-bold">{companyName}</span>
              </div>
              <p className="text-gray-400 text-sm max-w-md">
                Your trusted partner in land acquisition. We help you find, purchase, and manage your property investments with ease.
              </p>
            </div>
            <div>
              <h3 className="font-display text-lg font-bold mb-4">Contact Us</h3>
              <div className="space-y-3">
                {company?.phone && (
                  <a href={`tel:${company.phone}`} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
                    <Phone className="w-4 h-4" />
                    {company.phone}
                  </a>
                )}
                {company?.email && (
                  <a href={`mailto:${company.email}`} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
                    <Mail className="w-4 h-4" />
                    {company.email}
                  </a>
                )}
                {company?.address && (
                  <p className="flex items-center gap-2 text-gray-400 text-sm">
                    <MapPin className="w-4 h-4 shrink-0" />
                    {company.address}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} {companyName}. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
