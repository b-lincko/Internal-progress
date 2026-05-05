import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - List projects
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const userId = searchParams.get('userId')

    const where: any = {}
    if (status) where.status = status

    // If userId provided, filter to projects they are a member of or created
    if (userId) {
      where.OR = [
        { created_by: userId },
        { members: { some: { user_id: userId } } }
      ]
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true } } }
        },
        tasks: {
          orderBy: { created_at: 'desc' },
          include: { project: { select: { id: true } } }
        }
      },
      orderBy: { created_at: 'desc' }
    })

    return NextResponse.json({ projects })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to fetch projects', details: e?.message }, { status: 500 })
  }
}

// POST - Create project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, status, priority, start_date, end_date, created_by, member_ids } = body

    if (!name || !created_by) {
      return NextResponse.json({ error: 'Name and created_by required' }, { status: 400 })
    }

    const project = await prisma.project.create({
      data: {
        name,
        description: description || null,
        status: status || 'Planning',
        priority: priority || 'Medium',
        start_date: start_date ? new Date(start_date) : null,
        end_date: end_date ? new Date(end_date) : null,
        created_by,
        members: member_ids && member_ids.length > 0
          ? {
              create: member_ids.map((uid: string) => ({
                user_id: uid,
                role: uid === created_by ? 'Lead' : 'Member'
              }))
            }
          : undefined
      },
      include: {
        creator: { select: { id: true, name: true } },
        members: { include: { user: { select: { id: true, name: true } } } }
      }
    })

    // Notify members
    if (member_ids && member_ids.length > 0) {
      for (const uid of member_ids) {
        if (uid !== created_by) {
          await prisma.notification.create({
            data: {
              user_id: uid,
              type: 'Project',
              title: `Added to project: ${name}`,
              body: `You were added to project "${name}"`,
              link: `/projects`
            }
          })
        }
      }
    }

    return NextResponse.json({ project }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create project' }, { status: 500 })
  }
}

// PATCH - Update project
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, description, status, priority, start_date, end_date, progress, member_ids } = body

    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

    const update: any = {}
    if (name !== undefined) update.name = name
    if (description !== undefined) update.description = description
    if (status !== undefined) update.status = status
    if (priority !== undefined) update.priority = priority
    if (start_date !== undefined) update.start_date = start_date ? new Date(start_date) : null
    if (end_date !== undefined) update.end_date = end_date ? new Date(end_date) : null
    if (progress !== undefined) update.progress = progress
    update.updated_at = new Date()

    const project = await prisma.project.update({
      where: { id },
      data: update,
      include: {
        creator: { select: { id: true, name: true } },
        members: { include: { user: { select: { id: true, name: true } } } },
        tasks: true
      }
    })

    // Update members if provided
    if (member_ids && Array.isArray(member_ids)) {
      // Remove existing members not in list
      await prisma.projectMember.deleteMany({
        where: { project_id: id, user_id: { notIn: member_ids } }
      })
      // Add new members
      const existing = await prisma.projectMember.findMany({ where: { project_id: id }, select: { user_id: true } })
      const existingIds = existing.map((m: any) => m.user_id)
      const newIds = member_ids.filter((uid: string) => !existingIds.includes(uid))
      for (const uid of newIds) {
        await prisma.projectMember.create({
          data: { project_id: id, user_id: uid, role: 'Member' }
        })
        await prisma.notification.create({
          data: {
            user_id: uid,
            type: 'Project',
            title: `Added to project: ${project.name}`,
            body: `You were added to project "${project.name}"`,
            link: `/projects`
          }
        })
      }
    }

    return NextResponse.json({ project })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update' }, { status: 500 })
  }
}

// DELETE - Remove project
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

    await prisma.project.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete' }, { status: 500 })
  }
}
