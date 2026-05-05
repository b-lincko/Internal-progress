import { NextRequest } from 'next/server'

const clients = new Map<string, ReadableStreamDefaultController>()

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  
  if (!userId) {
    return new Response('Missing userId', { status: 400 })
  }

  const stream = new ReadableStream({
    start(controller) {
      clients.set(userId, controller)
      
      // Send initial connection message
      controller.enqueue(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
      
      // Keep-alive
      const keepAlive = setInterval(() => {
        controller.enqueue(`data: ${JSON.stringify({ type: 'ping' })}\n\n`)
      }, 30000)
      
      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(keepAlive)
        clients.delete(userId)
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

// Function to send notification to a specific user
export function sendNotification(userId: string, data: any) {
  const controller = clients.get(userId)
  if (controller) {
    try {
      controller.enqueue(`data: ${JSON.stringify(data)}\n\n`)
    } catch (e) {
      clients.delete(userId)
    }
  }
}

// Function to broadcast to all users
export function broadcastNotification(data: any) {
  clients.forEach((controller, userId) => {
    try {
      controller.enqueue(`data: ${JSON.stringify(data)}\n\n`)
    } catch (e) {
      clients.delete(userId)
    }
  })
}
