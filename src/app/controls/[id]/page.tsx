import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { AppLayout } from "@/components/AppLayout"
import { ControlDetailClient } from "./ControlDetailClient"

export const dynamic = "force-dynamic"

export default async function ControlDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const control = await prisma.control.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true } },
      evidence: {
        include: { user: { select: { name: true } } },
        orderBy: { uploaded_at: "desc" }
      },
      poams: true,
      subcontrols: true
    }
  })

  if (!control) {
    return (
      <AppLayout>
        <div className="max-w-5xl">
          <div className="text-center py-12 text-slate-400">Control not found</div>
        </div>
      </AppLayout>
    )
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" }
  })

  return <ControlDetailClient control={control} users={users} />
}
