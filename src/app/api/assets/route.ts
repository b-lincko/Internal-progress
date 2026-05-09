import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

async function getAuth(request: NextRequest) {
  const token = request.cookies.get('token')?.value
  if (!token) return null
  return verifyToken(token)
}

// GET - List assets
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    const where: any = {}
    if (type) where.asset_type = type
    if (status) where.status = status
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { ip_address: { contains: search, mode: 'insensitive' } },
        { os: { contains: search, mode: 'insensitive' } },
        { owner: { contains: search, mode: 'insensitive' } }
      ]
    }

    const assets = await prisma.asset.findMany({
      where,
      orderBy: { created_at: 'desc' }
    })
    return NextResponse.json({ assets })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

// POST - Create asset
export async function POST(request: NextRequest) {
  try {
    const payload = await getAuth(request)
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { name, asset_type, ip_address, mac_address, os, os_version, location, owner, criticality, notes } = body
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    const asset = await prisma.asset.create({
      data: {
        name,
        asset_type: asset_type || 'Workstation',
        ip_address: ip_address || null,
        mac_address: mac_address || null,
        os: os || null,
        os_version: os_version || null,
        location: location || null,
        owner: owner || null,
        criticality: criticality || 'Medium',
        notes: notes || null
      }
    })
    return NextResponse.json({ asset }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

// PATCH - Update asset
export async function PATCH(request: NextRequest) {
  try {
    const payload = await getAuth(request)
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { id, ...data } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const asset = await prisma.asset.update({ where: { id }, data })
    return NextResponse.json({ asset })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

// DELETE - Delete asset
export async function DELETE(request: NextRequest) {
  try {
    const payload = await getAuth(request)
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    await prisma.asset.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
