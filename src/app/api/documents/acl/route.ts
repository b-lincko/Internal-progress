import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

async function getAuth(request: NextRequest) {
  const token = request.cookies.get('token')?.value
  if (!token) return null
  return verifyToken(token)
}

// GET - Get ACL for a document
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const docId = searchParams.get('docId')
    if (!docId) return NextResponse.json({ error: 'Missing docId' }, { status: 400 })

    const access = await prisma.documentAccess.findMany({
      where: { document_id: docId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { granted_at: 'desc' }
    })
    return NextResponse.json({ access })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

// POST - Grant access
export async function POST(request: NextRequest) {
  try {
    const payload = await getAuth(request)
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { document_id, user_id, access_level } = body
    if (!document_id || !user_id || !access_level) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const doc = await prisma.document.findUnique({ where: { id: document_id } })
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    // Only owner or admin can grant
    if (doc.uploaded_by !== payload.userId && payload.role !== 'Admin') {
      return NextResponse.json({ error: 'Admin or owner only' }, { status: 403 })
    }

    const acl = await prisma.documentAccess.upsert({
      where: { document_id_user_id: { document_id, user_id } },
      update: { access_level, granted_by: payload.userId },
      create: { document_id, user_id, access_level, granted_by: payload.userId }
    })

    // Log
    await prisma.documentAuditLog.create({
      data: { document_id, user_id: payload.userId, action: 'Share', details: `Granted ${access_level} to user` }
    })

    return NextResponse.json({ access: acl })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

// DELETE - Revoke access
export async function DELETE(request: NextRequest) {
  try {
    const payload = await getAuth(request)
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const docId = searchParams.get('docId')
    const userId = searchParams.get('userId')
    if (!docId || !userId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const doc = await prisma.document.findUnique({ where: { id: docId } })
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    if (doc.uploaded_by !== payload.userId && payload.role !== 'Admin') {
      return NextResponse.json({ error: 'Admin or owner only' }, { status: 403 })
    }

    await prisma.documentAccess.delete({
      where: { document_id_user_id: { document_id: docId, user_id: userId } }
    })

    await prisma.documentAuditLog.create({
      data: { document_id: docId, user_id: payload.userId, action: 'Revoke', details: `Revoked access for user` }
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
