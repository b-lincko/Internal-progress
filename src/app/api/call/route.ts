import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Store signals in memory (for demo; in production use Redis/WebSocket)
const signalStore = new Map<string, any[]>()

function getKey(from: string, to: string) {
  return `${from}:${to}`
}

// GET - retrieve signals for a user (from a specific sender)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!from || !to) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

    const key = getKey(from, to)
    const signals = signalStore.get(key) || []
    // Clear after reading
    signalStore.delete(key)
    return NextResponse.json({ signals })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// POST - send a signal
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { from, to, type, data } = body

    if (!from || !to || !type) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const key = getKey(from, to)
    const signals = signalStore.get(key) || []
    signals.push({ type, from, to, data, created_at: new Date().toISOString() })
    signalStore.set(key, signals)

    // Auto-cleanup after 30 seconds
    setTimeout(() => {
      signalStore.delete(key)
    }, 30000)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// DELETE - clear signals
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    if (from && to) {
      signalStore.delete(getKey(from, to))
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
