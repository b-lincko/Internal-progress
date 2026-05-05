import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const controlId = formData.get('control_id') as string | null
    const uploaded_by = formData.get('uploaded_by') as string | null
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    const uploadDir = join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadDir, { recursive: true })
    
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const timestamp = Date.now()
    const fileName = `${timestamp}_${safeName}`
    const filePath = join(uploadDir, fileName)
    
    await writeFile(filePath, buffer)

    // Create upload record
    if (uploaded_by) {
      await prisma.upload.create({
        data: {
          file_name: safeName,
          file_path: `/uploads/${fileName}`,
          file_type: file.type || null,
          file_size: file.size,
          uploaded_by,
          related_to: controlId ? 'control' : null,
          related_id: controlId || null
        }
      })

      // Create notification for file upload
      const allUsers = await prisma.user.findMany({ select: { id: true } })
      for (const u of allUsers) {
        if (u.id !== uploaded_by) {
          await prisma.notification.create({
            data: {
              user_id: u.id,
              type: 'Upload',
              title: `File uploaded: ${safeName}`,
              body: `New file uploaded by a team member`,
              link: '/documents'
            }
          })
        }
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      file_name: safeName,
      file_path: `/uploads/${fileName}`,
      size: file.size 
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Upload failed' }, { status: 500 })
  }
}
