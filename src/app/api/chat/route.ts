import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { sendNotification } from '../notifications/stream/route'

// GET - List chat messages
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const room = searchParams.get('room') || 'global'
    const userId = searchParams.get('userId')
    const partnerId = searchParams.get('partnerId')
    const limit = parseInt(searchParams.get('limit') || '100')

    let messages
    if (userId && partnerId) {
      // Private messages between two users
      messages = await prisma.chatMessage.findMany({
        where: {
          room_id: 'private',
          OR: [
            { user_id: userId, recipient_id: partnerId },
            { user_id: partnerId, recipient_id: userId }
          ]
        },
        orderBy: { created_at: 'asc' },
        take: limit,
        include: {
          user: { select: { id: true, name: true, role: true } },
          recipient: { select: { id: true, name: true } }
        }
      })
    } else {
      messages = await prisma.chatMessage.findMany({
        where: { room_id: room },
        orderBy: { created_at: 'asc' },
        take: limit,
        include: {
          user: { select: { id: true, name: true, role: true } },
          recipient: { select: { id: true, name: true } }
        }
      })
    }

    return NextResponse.json({ messages })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch messages' }, { status: 500 })
  }
}

// POST - Send message
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const user_id = formData.get('user_id') as string
    const room_id = formData.get('room_id') as string || 'global'
    const message = formData.get('message') as string || ''
    const recipient_id = formData.get('recipient_id') as string || null
    const file = formData.get('file') as File | null

    if (!user_id || !room_id) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    let file_name = null
    let file_path = null
    let file_type = null

    if (file && file.size > 0) {
      // Save file to uploads
      const fs = require('fs')
      const path = require('path')
      const crypto = require('crypto')
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'chat')
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

      const ext = path.extname(file.name)
      const fileName = `${crypto.randomUUID()}${ext}`
      const filePath = path.join(uploadDir, fileName)
      const bytes = await file.arrayBuffer()
      fs.writeFileSync(filePath, Buffer.from(bytes))
      file_name = file.name
      file_path = `/uploads/chat/${fileName}`
      file_type = file.type
    }

    const msg = await prisma.chatMessage.create({
      data: {
        user_id,
        room_id,
        recipient_id,
        message,
        file_name,
        file_path,
        file_type
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
        recipient: { select: { id: true, name: true } }
      }
    })

    // Create notifications for mentioned users or recipients
    if (recipient_id) {
      const notif = await prisma.notification.create({
        data: {
          user_id: recipient_id,
          type: 'Chat',
          title: file_name ? `New file from ${msg.user.name}` : 'New message',
          body: file_name 
            ? `File: ${file_name}`
            : message?.substring(0, 100) || 'You received a new private message',
          link: '/chat'
        }
      })

      // Send real-time notification
      sendNotification(recipient_id, {
        type: 'new_notification',
        notification: notif
      })
    }

    // For global messages, notify all users except sender
    if (room_id === 'global') {
      const allUsers = await prisma.user.findMany({ 
        where: { id: { not: user_id } },
        select: { id: true } 
      })
      
      for (const u of allUsers) {
        const notif = await prisma.notification.create({
          data: {
            user_id: u.id,
            type: 'Chat',
            title: file_name ? `New file in Team Chat` : 'New message in Team Chat',
            body: file_name
              ? `${msg.user.name} shared a file: ${file_name}`
              : `${msg.user.name}: ${message?.substring(0, 100) || 'New message'}`,
            link: '/chat'
          }
        })

        // Send real-time notification
        sendNotification(u.id, {
          type: 'new_notification',
          notification: notif
        })
      }
    }

    return NextResponse.json({ message: msg })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to send' }, { status: 500 })
  }
}

// PATCH - Mark messages as read
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids, userId, partnerId } = body

    if (ids && Array.isArray(ids)) {
      await prisma.chatMessage.updateMany({
        where: { id: { in: ids } },
        data: { is_read: true }
      })
    } else if (userId && partnerId) {
      // Mark all private messages as read
      await prisma.chatMessage.updateMany({
        where: {
          room_id: 'private',
          user_id: partnerId,
          recipient_id: userId,
          is_read: false
        },
        data: { is_read: true }
      })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

// DELETE - Clear messages (admin only for global, self for private)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const room = searchParams.get('room') || 'global'
    const userId = searchParams.get('userId')
    const partnerId = searchParams.get('partnerId')

    // Verify user is admin for global clear
    const authHeader = request.headers.get('authorization')
    let isAdmin = false
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1]
      const payload = await verifyToken(token)
      if (payload?.role === 'Admin') isAdmin = true
    }

    if (room === 'global' && !isAdmin) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    if (userId && partnerId) {
      // Clear private chat
      await prisma.chatMessage.deleteMany({
        where: {
          room_id: 'private',
          OR: [
            { user_id: userId, recipient_id: partnerId },
            { user_id: partnerId, recipient_id: userId }
          ]
        }
      })
    } else {
      // Clear global chat (keep room entry)
      await prisma.chatMessage.deleteMany({ where: { room_id: 'global' } })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
