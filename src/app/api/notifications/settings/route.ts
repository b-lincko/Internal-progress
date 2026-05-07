import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

    const settings = await prisma.userNotificationSettings.findUnique({
      where: { user_id: userId }
    })

    if (!settings) {
      // Create default settings
      const newSettings = await prisma.userNotificationSettings.create({
        data: { user_id: userId }
      })
      return NextResponse.json({ settings: newSettings })
    }

    return NextResponse.json({ settings })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, ...data } = body
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

    const settings = await prisma.userNotificationSettings.upsert({
      where: { user_id: userId },
      update: data,
      create: { user_id: userId, ...data }
    })

    return NextResponse.json({ settings })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
