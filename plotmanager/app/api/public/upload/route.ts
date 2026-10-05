import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, getRateLimitKey } from '@/lib/rate-limit'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

// Magic bytes for validating actual file content
const FILE_SIGNATURES: Record<string, number[]> = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 uploads per minute per IP
    const rateLimitKey = getRateLimitKey(request, 'upload')
    const { allowed, retryAfterSeconds } = await checkRateLimit(rateLimitKey, { maxRequests: 10, windowSeconds: 60 })
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many uploads. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const slug = formData.get('slug') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!slug) {
      return NextResponse.json({ error: 'Company slug is required' }, { status: 400 })
    }

    const ext = ALLOWED_TYPES[file.type]
    if (!ext) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Verify company exists
    const { data: company } = await adminClient
      .from('companies')
      .select('id')
      .eq('slug', slug)
      .single()

    if (!company) {
      return NextResponse.json({ error: 'Invalid company' }, { status: 404 })
    }

    const fileName = `${randomUUID()}.${ext}`
    const filePath = fileName

    const buffer = Buffer.from(await file.arrayBuffer())

    // Validate actual file content via magic bytes (not just MIME type which can be spoofed)
    const signature = FILE_SIGNATURES[file.type]
    if (signature) {
      const fileHeader = Array.from(buffer.subarray(0, signature.length))
      if (!signature.every((byte, i) => fileHeader[i] === byte)) {
        return NextResponse.json(
          { error: 'File content does not match its type. Upload rejected.' },
          { status: 400 }
        )
      }
    }

    const { error: uploadError } = await adminClient.storage
      .from('buyer-documents')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }

    const { data: { publicUrl } } = adminClient.storage
      .from('buyer-documents')
      .getPublicUrl(filePath)

    return NextResponse.json({ url: publicUrl })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
