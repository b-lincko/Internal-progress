import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendNotification, broadcastNotification } from './stream/route'

// GET notifications
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const unreadOnly = searchParams.get('unread') === 'true'

    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

    const where: any = { user_id: userId }
    if (unreadOnly) where.is_read = false

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 50
    })

    const unreadCount = await prisma.notification.count({
      where: { user_id: userId, is_read: false }
    })

    return NextResponse.json({ notifications, unreadCount })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// POST create notification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, type, title, body: msgBody, link, deadline_id } = body
    if (!userId || !title) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const notif = await prisma.notification.create({
      data: {
        user_id: userId,
        type: (type || 'System') as any,
        title,
        body: msgBody || null,
        link: link || null,
        deadline_id: deadline_id || null
      }
    })

    // Send real-time notification via SSE
    sendNotification(userId, {
      type: 'new_notification',
      notification: notif
    })

    return NextResponse.json({ notification: notif }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// PATCH mark as read
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids, userId } = body

    if (ids && Array.isArray(ids)) {
      await prisma.notification.updateMany({ where: { id: { in: ids } }, data: { is_read: true } })
    } else if (userId) {
      await prisma.notification.updateMany({ where: { user_id: userId }, data: { is_read: true } })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// Helper function to create notifications for multiple users
export async function createNotificationForUsers(
  userIds: string[],
  notification: { type: string; title: string; body?: string; link?: string; deadline_id?: string }
) {
  const created = []
  for (const userId of userIds) {
    try {
      const notif = await prisma.notification.create({
        data: {
          user_id: userId,
          type: notification.type as any,
          title: notification.title,
          body: notification.body || null,
          link: notification.link || null,
          deadline_id: notification.deadline_id || null
        }
      })
      
      // Send real-time
      sendNotification(userId, {
        type: 'new_notification',
        notification: notif
      })
      
      created.push(notif)
    } catch (e) {
      console.error(`Failed to create notification for user ${userId}:`, e)
    }
  }
  return created
}
