import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET rooms
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    const rooms = await prisma.chatRoom.findMany({
      include: { members: { include: { user: { select: { id: true, name: true } } } }, messages: { orderBy: { created_at: 'desc' }, take: 1 } },
      orderBy: { updated_at: 'desc' }
    })

    // Also get private message partners
    let privatePartners: any[] = []
    if (userId) {
      const sent = await prisma.chatMessage.findMany({ where: { user_id: userId, recipient_id: { not: null } }, select: { recipient_id: true }, distinct: ['recipient_id'] })
      const received = await prisma.chatMessage.findMany({ where: { recipient_id: userId }, select: { user_id: true }, distinct: ['user_id'] })
      const partnerIds = [...new Set([...sent.map(s => s.recipient_id!), ...received.map(r => r.user_id)])]
      if (partnerIds.length > 0) {
        privatePartners = await prisma.user.findMany({
          where: { id: { in: partnerIds } },
          select: { id: true, name: true, role: true }
        })
      }
    }

    return NextResponse.json({ rooms, privatePartners })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// POST create private room
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, userIds } = body
    const room = await prisma.chatRoom.create({
      data: {
        name: name || 'Private Chat',
        type: 'Private',
        members: { create: userIds.map((uid: string) => ({ user_id: uid })) }
      }
    })
    return NextResponse.json({ room })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
