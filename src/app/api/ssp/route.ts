import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsPDF } from 'jspdf'

export async function GET(request: NextRequest) {
  try {
    const controls = await prisma.control.findMany({
      include: { poams: true },
      orderBy: { control_id: 'asc' }
    })

    const doc = new jsPDF()
    let y = 20

    doc.setFontSize(18)
    doc.text('System Security Plan (SSP)', 20, y)
    y += 15
    doc.setFontSize(12)
    doc.text(`Organization: Internal CMMC Compliance`, 20, y)
    y += 10
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, y)
    y += 20

    const total = controls.length
    const implemented = controls.filter(c => c.status === 'Implemented').length
    const inProgress = controls.filter(c => c.status === 'In_Progress').length
    const openPOAMs = controls.reduce((sum, c) => sum + c.poams.filter(p => p.status !== 'Completed').length, 0)

    doc.setFontSize(14)
    doc.text('Summary', 20, y)
    y += 10
    doc.setFontSize(10)
    doc.text(`Total Controls: ${total}`, 20, y)
    y += 7
    doc.text(`Implemented: ${implemented} (${Math.round(implemented/total*100)}%)`, 20, y)
    y += 7
    doc.text(`In Progress: ${inProgress}`, 20, y)
    y += 7
    doc.text(`Open POA&Ms: ${openPOAMs}`, 20, y)
    y += 20

    doc.setFontSize(14)
    doc.text('Controls', 20, y)
    y += 10

    for (const control of controls) {
      if (y > 260) { doc.addPage(); y = 20 }
      doc.setFontSize(11)
      doc.text(`${control.control_id} - ${control.title}`, 20, y)
      y += 7
      doc.setFontSize(9)
      doc.text(`Status: ${control.status}`, 25, y)
      y += 5
      if (control.implementation_notes) {
        const notes = doc.splitTextToSize(control.implementation_notes, 160)
        doc.text(notes, 25, y)
        y += notes.length * 5
      }
      if (control.poams.length > 0) {
        doc.text(`Open POA&Ms: ${control.poams.filter(p => p.status !== 'Completed').length}`, 25, y)
        y += 5
      }
      y += 8
    }

    const pdfBuffer = doc.output('arraybuffer')
    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=ssp.pdf'
      }
    })
  } catch {
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
