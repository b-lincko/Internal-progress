import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

async function getAuth(request: NextRequest) {
  const token = request.cookies.get('token')?.value
  if (!token) return null
  return verifyToken(token)
}

// GET - List folders (optionally with parent_id)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parentId = searchParams.get('parentId')

    const where: any = { parent_id: parentId || null }
    const folders = await prisma.documentFolder.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' }
    })

    // Count documents in each folder
    const folderIds = folders.map(f => f.id)
    const docCounts = await prisma.document.groupBy({
      by: ['folder_id'],
      where: { folder_id: { in: folderIds } },
      _count: { id: true }
    })

    const countsMap = new Map(docCounts.map(d => [d.folder_id, d._count.id]))

    const foldersWithCounts = folders.map(f => ({
      ...f,
      documentCount: countsMap.get(f.id) || 0
    }))

    return NextResponse.json({ folders: foldersWithCounts })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

// POST - Create folder
export async function POST(request: NextRequest) {
  try {
    const payload = await getAuth(request)
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { name, parent_id } = body
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    const folder = await prisma.documentFolder.create({
      data: {
        name,
        parent_id: parent_id || null,
        created_by: payload.userId
      },
      include: { user: { select: { id: true, name: true } } }
    })
    return NextResponse.json({ folder }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

// PATCH - Rename folder
export async function PATCH(request: NextRequest) {
  try {
    const payload = await getAuth(request)
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { id, name } = body
    if (!id || !name) return NextResponse.json({ error: 'ID and name required' }, { status: 400 })

    const folder = await prisma.documentFolder.update({
      where: { id },
      data: { name, updated_at: new Date() }
    })
    return NextResponse.json({ folder })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

// DELETE - Delete folder
export async function DELETE(request: NextRequest) {
  try {
    const payload = await getAuth(request)
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

    await prisma.documentFolder.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
