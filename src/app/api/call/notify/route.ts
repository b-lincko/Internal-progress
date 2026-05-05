import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendNotification } from '../../notifications/stream/route'

// POST - Send call notification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { from, to, type, mode } = body

    if (!from || !to || !type) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const fromUser = await prisma.user.findUnique({
      where: { id: from },
      select: { name: true }
    })

    if (!fromUser) {
      return NextResponse.json({ error: 'Caller not found' }, { status: 404 })
    }

    const title = type === 'incoming' 
      ? `📞 Incoming ${mode || 'voice'} call`
      : type === 'missed'
      ? `📞 Missed call`
      : `📞 Call ended`

    const notif = await prisma.notification.create({
      data: {
        user_id: to,
        type: 'Call',
        title,
        body: type === 'incoming' 
          ? `${fromUser.name} is calling you`
          : type === 'missed'
          ? `Missed call from ${fromUser.name}`
          : `Call with ${fromUser.name}`,
        link: '/chat'
      }
    })

    // Send real-time notification
    sendNotification(to, {
      type: 'new_notification',
      notification: notif
    })

    return NextResponse.json({ success: true, notification: notif })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
