import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const control = await prisma.control.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true } },
        evidence: { include: { user: { select: { name: true } } } },
        poams: true,
        subcontrols: { orderBy: [{ type: 'asc' }, { name: 'asc' }] }
      }
    })
    if (!control) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ control })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const control = await prisma.control.update({
      where: { id },
      data: {
        status: body.status,
        implementation_notes: body.implementation_notes,
        owner_id: body.owner_id || null
      }
    })

    // Notify users when control status changes
    if (body.status) {
      const allUsers = await prisma.user.findMany({ select: { id: true } })
      for (const u of allUsers) {
        await prisma.notification.create({
          data: {
            user_id: u.id,
            type: 'Alert',
            title: `Control ${control.control_id} updated`,
            body: `Status changed to "${body.status}"`,
            link: `/controls/${id}`
          }
        })
      }
    }

    return NextResponse.json({ control })
  } catch {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
