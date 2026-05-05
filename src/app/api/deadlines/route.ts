import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// GET - List deadlines
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const controlId = searchParams.get('controlId')
    const assignedTo = searchParams.get('assignedTo')
    const userId = searchParams.get('userId')

    const where: any = {}
    if (status) where.status = status
    if (controlId) where.control_id = controlId

    // If userId is provided, show deadlines they created OR are assigned to
    if (userId) {
      where.OR = [
        { created_by: userId },
        { assignees: { some: { id: userId } } }
      ]
    }

    // Filter by assignee
    if (assignedTo) {
      where.assignees = { some: { id: assignedTo } }
    }

    const deadlines = await prisma.scheduleDeadline.findMany({
      where,
      include: {
        control: { select: { id: true, control_id: true, title: true } },
        assignees: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, email: true } }
      },
      orderBy: { due_date: 'asc' }
    })
    return NextResponse.json({ deadlines })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to fetch deadlines', details: e?.message }, { status: 500 })
  }
}

// POST - Create deadline
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, due_date, control_id, assignee_ids, priority, created_by } = body

    if (!title || !due_date) {
      return NextResponse.json({ error: 'Title and due date required' }, { status: 400 })
    }

    // Auto-detect overdue
    const now = new Date()
    const due = new Date(due_date)
    let status = 'Scheduled'
    if (due < now) status = 'Overdue'

    const deadline = await prisma.scheduleDeadline.create({
      data: {
        title,
        description: description || null,
        due_date: due,
        control_id: control_id || null,
        priority: priority || 'Medium',
        created_by: created_by,
        status: status as any,
        assignees: assignee_ids && assignee_ids.length > 0
          ? { connect: assignee_ids.map((id: string) => ({ id })) }
          : undefined
      },
      include: {
        assignees: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } }
      }
    })

    // Create notifications for assignees
    if (assignee_ids && assignee_ids.length > 0) {
      for (const uid of assignee_ids) {
        await prisma.notification.create({
          data: {
            user_id: uid,
            type: 'Schedule',
            title: `Assigned to schedule: ${title}`,
            body: `You were assigned to "${title}" due ${due.toLocaleDateString()}`,
            link: '/deadlines',
            deadline_id: deadline.id
          }
        })
      }
    }

    return NextResponse.json({ deadline })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create deadline' }, { status: 500 })
  }
}

// PATCH - Update deadline
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, title, description, due_date, status, assignee_ids, priority } = body

    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

    const update: any = {}
    if (title !== undefined) update.title = title
    if (description !== undefined) update.description = description
    if (due_date !== undefined) update.due_date = new Date(due_date)
    if (status !== undefined) update.status = status
    if (priority !== undefined) update.priority = priority
    if (assignee_ids !== undefined) {
      update.assignees = { set: assignee_ids.map((id: string) => ({ id })) }
    }

    const deadline = await prisma.scheduleDeadline.update({
      where: { id },
      data: update,
      include: {
        assignees: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } }
      }
    })

    return NextResponse.json({ deadline })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update' }, { status: 500 })
  }
}

// DELETE - Remove deadline
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

    await prisma.scheduleDeadline.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete' }, { status: 500 })
  }
}
