import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { authenticateRequest, serverError } from '@/lib/api-helpers'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const ALLOWED_BUCKETS = ['estates', 'buyer-documents']

export async function POST(request: NextRequest) {
  try {
    const result = await authenticateRequest()
    if (result.error) return result.error

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const bucket = (formData.get('bucket') as string) || 'estates'

    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return NextResponse.json({ error: 'Invalid bucket' }, { status: 400 })
    }

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
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

    const fileName = `${randomUUID()}.${ext}`
    const filePath = fileName

    const adminClient = createAdminClient()
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await adminClient.storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      return serverError(uploadError, 'POST /api/upload')
    }

    const { data: { publicUrl } } = adminClient.storage
      .from(bucket)
      .getPublicUrl(filePath)

    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    return serverError(err, 'POST /api/upload')
  }
}
