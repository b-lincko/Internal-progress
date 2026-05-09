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

  async function clearAll() {
    if (!user) return
    if (!confirm("Clear all notifications? This cannot be undone.")) return
    await fetch(`/api/notifications?userId=${user.id}`, { method: "DELETE" })
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
    <AppLayout title="Notifications" subtitle="Alerts and messages">
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Notifications</h1>
            <p className="text-gray-500 mt-1">{unreadCount} unread • {notifications.length} total</p>
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-lg font-medium transition-colors">Mark All Read</button>
            )}
            {notifications.length > 0 && (
              <button onClick={clearAll} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2.5 rounded-lg font-medium transition-colors border border-red-500/20">Clear All</button>
            )}
            <Link href="/notifications/settings" className="bg-white/5 hover:bg-white/10 text-gray-400 px-4 py-2.5 rounded-lg font-medium transition-colors border border-white/10">⚙️ Settings</Link>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-violet-600 border-t-transparent rounded-full"/></div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div key={n.id} className={`glass-card rounded-xl p-5 flex items-start gap-4 transition-all ${!n.is_read ? "border-l-4 border-l-violet-500 bg-violet-500/5" : "border-l-4 border-l-transparent"} border border-white/10`}>
                <div className="flex-shrink-0 mt-1">
                  {n.type === "Chat" && <span className="text-xl">💬</span>}
                  {n.type === "Alert" && <span className="text-xl">⚠️</span>}
                  {n.type === "System" && <span className="text-xl">ℹ️</span>}
                  {n.type === "Mention" && <span className="text-xl">👤</span>}
                  {n.type === "Schedule" && <span className="text-xl">📅</span>}
                  {n.type === "Document" && <span className="text-xl">📄</span>}
                  {n.type === "Project" && <span className="text-xl">📊</span>}
                  {n.type === "Call" && <span className="text-xl">📞</span>}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-white">{n.title}</span>
                    {!n.is_read && <span className="w-2 h-2 bg-violet-500 rounded-full"></span>}
                  </div>
                  {n.body && <p className="text-sm text-gray-400 mb-2">{n.body}</p>}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">{new Date(n.created_at).toLocaleString()}</span>
                    {n.link && <Link href={n.link} className="text-xs text-violet-400 hover:text-violet-300 font-medium">View →</Link>}
                    {!n.is_read && <button onClick={() => markRead(n.id)} className="text-xs text-gray-500 hover:text-gray-300">Mark read</button>}
                  </div>
                </div>
              </div>
            ))}
            {notifications.length === 0 && (
              <div className="glass-card rounded-xl p-12 text-center text-gray-500 border border-white/10">No notifications yet</div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
