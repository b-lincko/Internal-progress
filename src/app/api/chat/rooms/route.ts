import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const rooms = await prisma.chatRoom.findMany({
      orderBy: { created_at: "asc" }
    })
    return NextResponse.json({ rooms })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 })
  }
}
