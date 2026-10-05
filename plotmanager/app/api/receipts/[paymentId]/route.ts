import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, serverError } from '@/lib/api-helpers'
import { generateReceiptPdf } from '@/lib/generate-receipt-pdf'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { paymentId } = await params
    const result = await authenticateRequest()
    if (result.error) return result.error
    const { adminClient } = result.auth

    // Fetch payment scoped to company
    const { data: payment, error: paymentError } = await adminClient
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single()

    if (paymentError || !payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Fetch buyer with estate name
    const { data: buyer } = await adminClient
      .from('buyers')
      .select('*, estates(name)')
      .eq('id', payment.buyer_id)
      .single()

    if (!buyer) {
      return NextResponse.json({ error: 'Buyer not found' }, { status: 404 })
    }

    // Fetch company info
    const { data: company } = await adminClient
      .from('companies')
      .select('name, email, phone, address')
      .limit(1)
      .single()

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const estate = buyer.estates as { name: string } | null
    const outstandingBalance = Math.max(buyer.total_amount - buyer.amount_paid, 0)

    const pdfBuffer = generateReceiptPdf({
      companyName: company.name,
      companyEmail: company.email,
      companyPhone: company.phone,
      companyAddress: company.address,
      buyerName: `${buyer.first_name} ${buyer.last_name}`,
      buyerEmail: buyer.email,
      buyerPhone: buyer.phone,
      estateName: estate?.name || null,
      plotNumber: buyer.plot_number,
      plotSize: buyer.plot_size,
      numberOfPlots: buyer.number_of_plots,
      paymentId: payment.id,
      amount: payment.amount,
      paymentDate: payment.payment_date,
      paymentMethod: payment.payment_method,
      reference: payment.reference,
      notes: payment.notes,
      totalAmount: buyer.total_amount,
      amountPaid: buyer.amount_paid,
      outstandingBalance,
    })

    const safeRef = payment.reference
      ? payment.reference.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 50)
      : payment.id.slice(0, 8)
    const filename = `receipt-${safeRef}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    return serverError(err, 'GET /api/receipts/[paymentId]')
  }
}
