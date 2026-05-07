import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Get audit log for a document
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const docId = searchParams.get('docId')
    if (!docId) return NextResponse.json({ error: 'Missing docId' }, { status: 400 })

    const logs = await prisma.documentAuditLog.findMany({
      where: { document_id: docId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { created_at: 'desc' },
      take: 100
    })
    return NextResponse.json({ logs })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
