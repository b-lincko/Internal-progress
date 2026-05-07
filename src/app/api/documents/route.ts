import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

async function getAuth(request: NextRequest) {
  const token = request.cookies.get('token')?.value
  if (!token) return null
  return verifyToken(token)
}

async function canAccessDocument(docId: string, userId: string, requiredLevel: string = 'Read') {
  const doc = await prisma.document.findUnique({
    where: { id: docId },
    include: {
      access: { where: { user_id: userId } },
      user: { select: { id: true } }
    }
  })
  if (!doc) return { can: false, doc: null }

  // Owner or admin always has access
  if (doc.uploaded_by === userId) return { can: true, doc, level: 'Admin' }

  // Global documents - anyone can read
  if (doc.is_global && requiredLevel === 'Read') return { can: true, doc, level: 'Read' }

  // Check ACL
  const access = doc.access[0]
  if (!access) return { can: false, doc }

  const levels = ['Read', 'Write', 'Admin']
  const userIdx = levels.indexOf(access.access_level)
  const reqIdx = levels.indexOf(requiredLevel)
  if (userIdx >= reqIdx) return { can: true, doc, level: access.access_level }

  return { can: false, doc }
}

async function logAction(docId: string, userId: string, action: string, details?: string) {
  try {
    await prisma.documentAuditLog.create({
      data: { document_id: docId, user_id: userId, action, details }
    })
  } catch {}
}

// GET - List documents in folder or all
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get('folderId')
    const docType = searchParams.get('type')

    const where: any = {}
    if (folderId) {
      where.folder_id = folderId
    } else {
      where.folder_id = null
    }
    if (docType) where.doc_type = docType

    const documents = await prisma.document.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        folder: { select: { id: true, name: true } },
        access: {
          include: { user: { select: { id: true, name: true } } }
        },
        _count: { select: { auditLogs: true } }
      },
      orderBy: { updated_at: 'desc' }
    })
    return NextResponse.json({ documents })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to fetch documents', details: e?.message }, { status: 500 })
  }
}

// POST - Create document
export async function POST(request: NextRequest) {
  try {
    const payload = await getAuth(request)
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { title, content, file_name, file_path, uploaded_by, is_global, doc_type, folder_id } = body

    if (!title || !uploaded_by) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const type = doc_type || (file_name ? 'File' : content ? 'Text' : 'File')

    const doc = await prisma.document.create({
      data: {
        title,
        content: content || null,
        file_name: file_name || null,
        file_path: file_path || null,
        doc_type: type,
        uploaded_by,
        is_global: is_global || false,
        folder_id: folder_id || null
      },
      include: { user: { select: { id: true, name: true } } }
    })

    // Log creation
    await logAction(doc.id, uploaded_by, 'Create', `Created ${type} document`)

    // Create notifications for global documents
    if (is_global) {
      const allUsers = await prisma.user.findMany({ select: { id: true } })
      for (const u of allUsers) {
        if (u.id !== uploaded_by) {
          await prisma.notification.create({
            data: {
              user_id: u.id,
              type: 'Document',
              title: `New document: ${title}`,
              body: type === 'File' ? `File uploaded: ${file_name || title}` : `Text document created`,
              link: '/documents'
            }
          })
        }
      }
    }

    return NextResponse.json({ document: doc })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create document' }, { status: 500 })
  }
}

// PATCH - Update document
export async function PATCH(request: NextRequest) {
  try {
    const payload = await getAuth(request)
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { id, title, content, file_name, file_path, is_global, doc_type, folder_id } = body

    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

    // Check write access
    const access = await canAccessDocument(id, payload.userId, 'Write')
    if (!access.can) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const update: any = {}
    if (title !== undefined) update.title = title
    if (content !== undefined) update.content = content
    if (file_name !== undefined) update.file_name = file_name
    if (file_path !== undefined) update.file_path = file_path
    if (is_global !== undefined) update.is_global = is_global
    if (doc_type !== undefined) update.doc_type = doc_type
    if (folder_id !== undefined) update.folder_id = folder_id
    update.updated_at = new Date()

    const doc = await prisma.document.update({
      where: { id },
      data: update,
      include: { user: { select: { id: true, name: true } } }
    })

    await logAction(id, payload.userId, 'Update', `Updated document`)
    return NextResponse.json({ document: doc })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update' }, { status: 500 })
  }
}

// DELETE - Remove document
export async function DELETE(request: NextRequest) {
  try {
    const payload = await getAuth(request)
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

    const access = await canAccessDocument(id, payload.userId, 'Admin')
    if (!access.can) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    await prisma.document.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete' }, { status: 500 })
  }
}
