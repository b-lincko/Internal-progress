import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - List documents
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const isGlobal = searchParams.get('global')
    const docType = searchParams.get('type')

    const where: any = {}
    if (isGlobal === 'true') {
      where.is_global = true
    } else if (isGlobal === 'false') {
      where.is_global = false
    }
    if (userId) {
      where.OR = [
        { uploaded_by: userId },
        { is_global: true }
      ]
    }
    if (docType) where.doc_type = docType

    const documents = await prisma.document.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { uploaded_at: 'desc' }
    })
    return NextResponse.json({ documents })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to fetch documents', details: e?.message }, { status: 500 })
  }
}

// POST - Create document (file or text)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, content, file_name, file_path, uploaded_by, is_global, doc_type } = body

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
        is_global: is_global || false
      },
      include: { user: { select: { id: true, name: true } } }
    })

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
    const body = await request.json()
    const { id, title, content, file_name, file_path, is_global, doc_type } = body

    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

    const update: any = {}
    if (title !== undefined) update.title = title
    if (content !== undefined) update.content = content
    if (file_name !== undefined) update.file_name = file_name
    if (file_path !== undefined) update.file_path = file_path
    if (is_global !== undefined) update.is_global = is_global
    if (doc_type !== undefined) update.doc_type = doc_type
    update.updated_at = new Date()

    const doc = await prisma.document.update({
      where: { id },
      data: update,
      include: { user: { select: { id: true, name: true } } }
    })
    return NextResponse.json({ document: doc })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update' }, { status: 500 })
  }
}

// DELETE - Remove document
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

    await prisma.document.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete' }, { status: 500 })
  }
}
