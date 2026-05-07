import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const severity = searchParams.get('severity')
    const status = searchParams.get('status')
    const id = searchParams.get('id')

    if (id) {
      const poam = await prisma.pOAM.findUnique({
        where: { id },
        include: { control: { select: { id: true, control_id: true, title: true } } }
      })
      if (!poam) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ poam })
    }

    const where: any = {}
    if (severity) where.severity = severity
    if (status) where.status = status

    const poams = await prisma.pOAM.findMany({
      where,
      include: { control: { select: { id: true, control_id: true, title: true } } },
      orderBy: { due_date: 'asc' }
    })

    return NextResponse.json({ poams })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const poam = await prisma.pOAM.create({
      data: {
        control_id: body.control_id,
        weakness: body.weakness,
        remediation_plan: body.remediation_plan,
        severity: body.severity,
        due_date: new Date(body.due_date),
        status: body.status || 'Open'
      }
    })
    return NextResponse.json({ poam })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...data } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const poam = await prisma.pOAM.update({
      where: { id },
      data: {
        ...data,
        due_date: data.due_date ? new Date(data.due_date) : undefined
      }
    })
    return NextResponse.json({ poam })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    await prisma.pOAM.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
