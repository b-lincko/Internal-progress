import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/auth"
import { sendNotification } from "../notifications/stream/route"

// GET - List chat messages
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const room = searchParams.get("room") || "global"
    const userId = searchParams.get("userId")
    const partnerId = searchParams.get("partnerId")
    const limit = parseInt(searchParams.get("limit") || "200")

    // Resolve room_id from room name
    let roomId = room
    if (room === "global" || room === "private") {
      const dbRoom = await prisma.chatRoom.findFirst({
        where: { name: room === "global" ? "global" : "private" }
      })
      if (dbRoom) roomId = dbRoom.id
    }

    // When userId + partnerId provided, always use the private room
    let privateRoomId = roomId
    if (userId && partnerId) {
      const dbPrivateRoom = await prisma.chatRoom.findFirst({
        where: { name: "private" }
      })
      if (dbPrivateRoom) privateRoomId = dbPrivateRoom.id
    }

    let messages
    if (userId && partnerId) {
      messages = await prisma.chatMessage.findMany({
        where: {
          room_id: privateRoomId,
          OR: [
            { user_id: userId, recipient_id: partnerId },
            { user_id: partnerId, recipient_id: userId }
          ]
        },
        orderBy: { created_at: "asc" },
        take: limit,
        include: {
          user: { select: { id: true, name: true, role: true } },
          recipient: { select: { id: true, name: true } }
        }
      })
    } else {
      messages = await prisma.chatMessage.findMany({
        where: { room_id: roomId },
        orderBy: { created_at: "asc" },
        take: limit,
        include: {
          user: { select: { id: true, name: true, role: true } },
          recipient: { select: { id: true, name: true } }
        }
      })
    }

    return NextResponse.json({ messages })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to fetch messages" }, { status: 500 })
  }
}

// POST - Send message
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const user_id = formData.get("user_id") as string
    const room_id = formData.get("room_id") as string || "global"
    const message = formData.get("message") as string || ""
    const recipient_id = formData.get("recipient_id") as string || null
    const file = formData.get("file") as File | null

    if (!user_id || !room_id) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    // Resolve room_id to UUID
    let resolvedRoomId = room_id
    if (room_id === "global" || room_id === "private") {
      const dbRoom = await prisma.chatRoom.findFirst({
        where: { name: room_id === "global" ? "global" : "private" }
      })
      if (dbRoom) resolvedRoomId = dbRoom.id
    }

    let file_name = null
    let file_path = null
    let file_type = null

    if (file && file.size > 0) {
      const fs = require("fs")
      const path = require("path")
      const crypto = require("crypto")
      const uploadDir = path.join(process.cwd(), "public", "uploads", "chat")
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
        room_id: resolvedRoomId,
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

    // Create notifications
    if (recipient_id) {
      const notif = await prisma.notification.create({
        data: {
          user_id: recipient_id,
          type: "Chat",
          title: file_name ? `New file from ${msg.user.name}` : "New message",
          body: file_name
            ? `File: ${file_name}`
            : message?.substring(0, 100) || "You received a new private message",
          link: "/chat"
        }
      })
      sendNotification(recipient_id, { type: "new_notification", notification: notif })
    }

    if (room_id === "global") {
      const allUsers = await prisma.user.findMany({
        where: { id: { not: user_id } },
        select: { id: true }
      })

      for (const u of allUsers) {
        const notif = await prisma.notification.create({
          data: {
            user_id: u.id,
            type: "Chat",
            title: file_name ? "New file in Team Chat" : "New message in Team Chat",
            body: file_name
              ? `${msg.user.name} shared a file: ${file_name}`
              : `${msg.user.name}: ${message?.substring(0, 100) || "New message"}`,
            link: "/chat"
          }
        })
        sendNotification(u.id, { type: "new_notification", notification: notif })
      }
    }

    return NextResponse.json({ message: msg })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to send" }, { status: 500 })
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
      await prisma.chatMessage.updateMany({
        where: {
          room_id: { not: undefined },
          user_id: partnerId,
          recipient_id: userId,
          is_read: false
        },
        data: { is_read: true }
      })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 })
  }
}

// DELETE - Clear messages
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const room = searchParams.get("room") || "global"
    const userId = searchParams.get("userId")
    const partnerId = searchParams.get("partnerId")

    const authHeader = request.headers.get("authorization")
    let isAdmin = false
    let currentUserId: string | null = null
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1]
      const payload = await verifyToken(token)
      if (payload?.role === "Admin") isAdmin = true
      if (payload?.userId) currentUserId = payload.userId
    }

    // Also check cookie token (used by frontend)
    const cookieToken = request.cookies.get("token")?.value
    if (cookieToken) {
      const payload = await verifyToken(cookieToken)
      if (payload?.role === "Admin") isAdmin = true
      if (payload?.userId) currentUserId = payload.userId
    }

    if (room === "global" && !isAdmin) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 })
    }

    // Resolve room_id
    let roomId = room
    if (room === "global" || room === "private") {
      const dbRoom = await prisma.chatRoom.findFirst({
        where: { name: room === "global" ? "global" : "private" }
      })
      if (dbRoom) roomId = dbRoom.id
    }

    if (userId && partnerId) {
      await prisma.chatMessage.deleteMany({
        where: {
          room_id: roomId,
          OR: [
            { user_id: userId, recipient_id: partnerId },
            { user_id: partnerId, recipient_id: userId }
          ]
        }
      })
    } else {
      await prisma.chatMessage.deleteMany({ where: { room_id: roomId } })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 })
  }
}
