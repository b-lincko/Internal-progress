import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET single project
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true } } }
        },
        tasks: {
          orderBy: { created_at: 'desc' }
        }
      }
    })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ project })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

// PATCH - Update project
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, description, status, priority, start_date, end_date, progress, member_ids } = body

    const update: any = {}
    if (name !== undefined) update.name = name
    if (description !== undefined) update.description = description
    if (status !== undefined) update.status = status
    if (priority !== undefined) update.priority = priority
    if (start_date !== undefined) update.start_date = start_date ? new Date(start_date) : null
    if (end_date !== undefined) update.end_date = end_date ? new Date(end_date) : null
    if (progress !== undefined) update.progress = progress

    // Update members if provided
    if (member_ids !== undefined) {
      update.members = {
        deleteMany: {},
        create: member_ids.map((uid: string) => ({ user_id: uid }))
      }
    }

    const project = await prisma.project.update({
      where: { id },
      data: update,
      include: {
        creator: { select: { id: true, name: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true } } }
        },
        tasks: { orderBy: { created_at: 'desc' } }
      }
    })
    return NextResponse.json({ project })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

// DELETE - Remove project
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.project.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
