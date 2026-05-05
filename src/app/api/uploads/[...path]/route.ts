import { NextRequest, NextResponse } from 'next/server'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { join } from 'path'

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params
    if (!path || path.length === 0) {
      return new NextResponse('Not found', { status: 404 })
    }

    // Validate path segments — only allow safe characters
    const safePath = path.map(p => p.replace(/[^a-zA-Z0-9._-]/g, '_')).join('/')
    const filePath = join(process.cwd(), 'public', 'uploads', safePath)

    // Prevent path traversal
    const uploadRoot = join(process.cwd(), 'public', 'uploads')
    if (!filePath.startsWith(uploadRoot)) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    const stats = await stat(filePath)
    if (!stats.isFile()) {
      return new NextResponse('Not found', { status: 404 })
    }

    const stream = createReadStream(filePath)

    // Guess content type from extension
    const ext = safePath.split('.').pop()?.toLowerCase() || ''
    const contentTypes: Record<string, string> = {
      pdf: 'application/pdf',
      csv: 'text/csv',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
      txt: 'text/plain',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
    }
    const contentType = contentTypes[ext] || 'application/octet-stream'

    // Inline for images/PDFs, attachment for others
    const disposition = contentType.startsWith('image/') || ext === 'pdf'
      ? 'inline'
      : `attachment; filename="${path[path.length - 1]}"`

    return new NextResponse(stream as any, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition,
        'Content-Length': String(stats.size),
      },
    })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}
