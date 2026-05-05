import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeFile } from 'fs/promises'
import { mkdir } from 'fs/promises'
import { join } from 'path'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const controlId = formData.get('control_id') as string
    const userId = formData.get('user_id') as string

    if (!file || !controlId || !userId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const uploadDir = join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadDir, { recursive: true })

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const fileName = `${Date.now()}_${safeName}`
    const filePath = join(uploadDir, fileName)
    await writeFile(filePath, buffer)

    const evidence = await prisma.evidence.create({
      data: {
        control_id: controlId,
        file_name: file.name,
        file_path: `/uploads/${fileName}`,
        uploaded_by: userId
      }
    })

    return NextResponse.json({ evidence })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Upload failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const controlId = searchParams.get('control_id')
    const evidence = await prisma.evidence.findMany({
      where: controlId ? { control_id: controlId } : {},
      include: { user: { select: { name: true } } },
      orderBy: { uploaded_at: 'desc' }
    })
    return NextResponse.json({ evidence })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
