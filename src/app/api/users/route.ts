import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { verifyToken } from '@/lib/auth'

// Verify admin from cookie
async function getAuth(request: NextRequest) {
  const token = request.cookies.get('token')?.value
  if (!token) return null
  return verifyToken(token)
}

// GET - List users
export async function GET(request: NextRequest) {
  try {
    const payload = await getAuth(request)
    const isAdmin = payload?.role === 'Admin'

    const users = await prisma.user.findMany({
      select: isAdmin
        ? { id: true, name: true, email: true, role: true, created_at: true }
        : { id: true, name: true, email: true, created_at: true },
      orderBy: { name: 'asc' }
    })
    return NextResponse.json({ users })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

// POST - Create user (admin only)
export async function POST(request: NextRequest) {
  try {
    const payload = await getAuth(request)
    if (payload?.role !== 'Admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const { name, email, password, role } = body

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email and password required' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
    }

    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { name, email, password_hash: hash, role: role || 'Viewer' }
    })
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create user' }, { status: 500 })
  }
}

// PATCH - Update user (admin only: name, email, role)
export async function PATCH(request: NextRequest) {
  try {
    const payload = await getAuth(request)
    if (payload?.role !== 'Admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const { id, name, email, role } = body
    if (!id) return NextResponse.json({ error: 'Missing user ID' }, { status: 400 })

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) {
      // Check email isn't taken by another user
      const existing = await prisma.user.findFirst({
        where: { email, id: { not: id } }
      })
      if (existing) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
      }
      updateData.email = email
    }
    if (role !== undefined) updateData.role = role

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, created_at: true }
    })
    return NextResponse.json({ user: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update' }, { status: 500 })
  }
}

// DELETE - Remove user (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const payload = await getAuth(request)
    if (payload?.role !== 'Admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to delete' }, { status: 500 })
  }
}
