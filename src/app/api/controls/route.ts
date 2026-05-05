import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const domain = searchParams.get('domain')

    const where: any = {}
    if (status) where.status = status
    if (domain) where.domain = domain

    const controls = await prisma.control.findMany({
      where,
      include: { owner: { select: { name: true } }, _count: { select: { evidence: true, poams: true } } },
      orderBy: { control_id: 'asc' }
    })

    return NextResponse.json({ controls })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch controls' }, { status: 500 })
  }
}
