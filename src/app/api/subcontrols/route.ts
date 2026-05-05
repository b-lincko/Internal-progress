import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET subcontrols for a control
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const controlId = searchParams.get('controlId')
    if (!controlId) return NextResponse.json({ error: 'Missing controlId' }, { status: 400 })

    const subcontrols = await prisma.subControl.findMany({
      where: { control_id: controlId },
      orderBy: [{ type: 'asc' }, { name: 'asc' }]
    })
    return NextResponse.json({ subcontrols })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// POST create subcontrol
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { control_id, name, description, type } = body
    if (!control_id || !name || !type) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const subcontrol = await prisma.subControl.create({
      data: { control_id, name, description: description || '', type }
    })
    return NextResponse.json({ subcontrol }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}

// PATCH update subcontrol
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, notes } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const updated = await prisma.subControl.update({
      where: { id },
      data: { status, notes }
    })
    return NextResponse.json({ subcontrol: updated })
  } catch {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

// DELETE subcontrol
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    await prisma.subControl.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
