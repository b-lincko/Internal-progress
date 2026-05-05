"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/controls", label: "Controls", icon: "🛡️" },
  { href: "/deadlines", label: "Schedules", icon: "📅" },
  { href: "/projects", label: "Projects", icon: "🚀" },
  { href: "/documents", label: "Documents", icon: "📁" },
  { href: "/poam", label: "POA&M", icon: "⚠️" },
  { href: "/chat", label: "Team Chat", icon: "💬" },
  { href: "/users", label: "Users", icon: "👥" },
]

export function Sidebar() {
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      setUser(d.user)
      if (d.user) loadUnread(d.user.id)
    })
    const interval = setInterval(() => {
      fetch("/api/auth/me").then(r => r.json()).then(d => {
        if (d.user) loadUnread(d.user.id)
      })
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  async function loadUnread(userId: string) {
    try {
      const res = await fetch(`/api/notifications?userId=${userId}&unread=true`)
      const data = await res.json()
      setUnreadCount(data.unreadCount || 0)
    } catch {
      setUnreadCount(0)
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.href = "/login"
  }

  return (
    <div className={`fixed left-0 top-0 h-screen bg-slate-900 text-white transition-all duration-300 z-50 flex flex-col ${collapsed ? "w-16" : "w-64"}`}>
      <div className="p-4 flex items-center justify-between border-b border-slate-700">
        {!collapsed && <Link href="/dashboard" className="font-bold text-xl tracking-tight">CMMC</Link>}
        <button onClick={() => setCollapsed(!collapsed)} className="p-1 hover:bg-slate-700 rounded">
          {collapsed ? "→" : "←"}
        </button>
      </div>

      <nav className="flex-1 py-4">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-all ${
              pathname === item.href || pathname?.startsWith(item.href + "/")
                ? "bg-primary-600 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
            title={collapsed ? item.label : undefined}
          >
            <span className="text-lg">{item.icon}</span>
            {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
          </Link>
        ))}
        <Link
          href="/notifications"
          className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-all mt-1 ${
            pathname === "/notifications"
              ? "bg-primary-600 text-white"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
          title={collapsed ? "Notifications" : undefined}
        >
          <span className="text-lg relative">
            🔔
            {unreadCount > 0 && !collapsed && (
              <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center">{unreadCount > 99 ? "99+" : unreadCount}</span>
            )}
          </span>
          {!collapsed && <span className="text-sm font-medium">Notifications</span>}
          {!collapsed && unreadCount > 0 && (
            <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
          )}
        </Link>
      </nav>

      <div className="p-4 border-t border-slate-700">
        {!collapsed && user && (
          <div className="mb-3">
            <Link href="/profile" className="block">
              <div className="text-sm font-medium text-white hover:text-primary-300 transition-colors">{user.name}</div>
              <div className="text-xs text-slate-400">{user.role}</div>
            </Link>
          </div>
        )}
        <button
          onClick={logout}
          className={`flex items-center gap-2 text-sm text-slate-400 hover:text-red-400 transition-colors ${collapsed ? "justify-center" : ""}`}
          title="Logout"
        >
          <span>🚪</span>
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  )
}
