import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET tasks for a project
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const tasks = await prisma.projectTask.findMany({
      where: { project_id: id },
      orderBy: { created_at: 'desc' }
    })
    return NextResponse.json({ tasks })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

// POST create task
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title, description, status, priority, assigned_to, due_date } = body

    if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 })

    const task = await prisma.projectTask.create({
      data: {
        project_id: id,
        title,
        description: description || null,
        status: status || 'Todo',
        priority: priority || 'Medium',
        assigned_to: assigned_to || null,
        due_date: due_date ? new Date(due_date) : null
      }
    })

    if (assigned_to) {
      await prisma.notification.create({
        data: {
          user_id: assigned_to,
          type: 'Project',
          title: 'New task assigned',
          body: `Task "${title}" assigned to you`,
          link: `/projects`
        }
      })
    }

    return NextResponse.json({ task }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

// PATCH - Update task
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { taskId, status, assigned_to, due_date, title, description, priority } = body

    if (!taskId) return NextResponse.json({ error: 'Missing taskId' }, { status: 400 })

    const update: any = {}
    if (status !== undefined) update.status = status
    if (assigned_to !== undefined) update.assigned_to = assigned_to
    if (due_date !== undefined) update.due_date = due_date ? new Date(due_date) : null
    if (title !== undefined) update.title = title
    if (description !== undefined) update.description = description
    if (priority !== undefined) update.priority = priority
    if (status === 'Done') update.completed_at = new Date()

    const task = await prisma.projectTask.update({
      where: { id: taskId, project_id: id },
      data: update
    })
    return NextResponse.json({ task })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

// DELETE - Remove task
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')
    if (!taskId) return NextResponse.json({ error: 'Missing taskId' }, { status: 400 })

    await prisma.projectTask.delete({
      where: { id: taskId, project_id: id }
    })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
