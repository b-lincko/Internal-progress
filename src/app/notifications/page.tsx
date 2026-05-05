"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { AppLayout } from "@/components/AppLayout"

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      setUser(d.user)
      if (d.user) loadNotifications(d.user.id)
    })
  }, [])

  async function loadNotifications(userId: string) {
    const res = await fetch(`/api/notifications?userId=${userId}`)
    const data = await res.json()
    setNotifications(data.notifications || [])
    setLoading(false)
  }

  async function markAllRead() {
    if (!user) return
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id })
    })
    loadNotifications(user.id)
  }

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] })
    })
    if (user) loadNotifications(user.id)
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <AppLayout>
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Notifications</h1>
            <p className="text-slate-500 mt-1">{unreadCount} unread • {notifications.length} total</p>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2.5 rounded-lg font-medium transition-colors">Mark All Read</button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"/></div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div key={n.id} className={`bg-white rounded-xl shadow-sm p-5 flex items-start gap-4 transition-all ${!n.is_read ? "border-l-4 border-l-primary-500 bg-primary-50/30" : "border-l-4 border-l-transparent"}`}>
                <div className="flex-shrink-0 mt-1">
                  {n.type === "Chat" && <span className="text-xl">💬</span>}
                  {n.type === "Alert" && <span className="text-xl">⚠️</span>}
                  {n.type === "System" && <span className="text-xl">ℹ️</span>}
                  {n.type === "Mention" && <span className="text-xl">👤</span>}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-slate-900">{n.title}</span>
                    {!n.is_read && <span className="w-2 h-2 bg-primary-500 rounded-full"></span>}
                  </div>
                  {n.body && <p className="text-sm text-slate-600 mb-2">{n.body}</p>}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">{new Date(n.created_at).toLocaleString()}</span>
                    {n.link && <Link href={n.link} className="text-xs text-primary-600 hover:text-primary-800 font-medium">View →</Link>}
                    {!n.is_read && <button onClick={() => markRead(n.id)} className="text-xs text-slate-500 hover:text-slate-700">Mark read</button>}
                  </div>
                </div>
              </div>
            ))}
            {notifications.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center text-slate-400">No notifications yet</div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
