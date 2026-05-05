import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PATCH update task
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, title, description, status, priority, assigned_to, due_date, completed_at } = body

    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

    const update: any = {}
    if (title !== undefined) update.title = title
    if (description !== undefined) update.description = description
    if (status !== undefined) update.status = status
    if (priority !== undefined) update.priority = priority
    if (assigned_to !== undefined) update.assigned_to = assigned_to || null
    if (due_date !== undefined) update.due_date = due_date ? new Date(due_date) : null
    if (completed_at !== undefined) update.completed_at = completed_at ? new Date(completed_at) : null
    update.updated_at = new Date()

    const task = await prisma.projectTask.update({
      where: { id },
      data: update
    })

    return NextResponse.json({ task })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

// DELETE remove task
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

    await prisma.projectTask.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
