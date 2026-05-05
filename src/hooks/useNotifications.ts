"use client"

import { useState, useEffect, useCallback, useRef } from "react"

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const loadNotifications = useCallback(async () => {
    if (!userId) return
    try {
      const res = await fetch(`/api/notifications?userId=${userId}`)
      const data = await res.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch (e) {
      console.error("Failed to load notifications:", e)
    }
  }, [userId])

  const connectSSE = useCallback(() => {
    if (!userId || eventSourceRef.current) return

    const es = new EventSource(`/api/notifications/stream?userId=${userId}`)
    eventSourceRef.current = es

    es.onopen = () => {
      setIsConnected(true)
      console.log("[SSE] Connected")
    }

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === "new_notification") {
          setNotifications((prev) => [data.notification, ...prev])
          setUnreadCount((prev) => prev + 1)
          
          // Show browser notification if permitted
          if (Notification.permission === "granted") {
            new Notification(data.notification.title, {
              body: data.notification.body || "",
              icon: "/favicon.ico",
            })
          }
        } else if (data.type === "ping") {
          // keep-alive, ignore
        }
      } catch (e) {
        console.error("[SSE] Parse error:", e)
      }
    }

    es.onerror = () => {
      setIsConnected(false)
      eventSourceRef.current?.close()
      eventSourceRef.current = null
      
      // Reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connectSSE()
      }, 5000)
    }
  }, [userId])

  const markAsRead = useCallback(async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    })
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }, [])

  const markAllAsRead = useCallback(async () => {
    if (!userId) return
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }, [userId])

  useEffect(() => {
    if (!userId) return

    // Request browser notification permission
    if (typeof window !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission()
    }

    loadNotifications()
    connectSSE()

    // Also poll every 30 seconds as fallback
    const interval = setInterval(loadNotifications, 30000)

    return () => {
      clearInterval(interval)
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      eventSourceRef.current?.close()
      eventSourceRef.current = null
    }
  }, [userId, loadNotifications, connectSSE])

  return {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    refresh: loadNotifications,
  }
}
