"use client"

import { Sidebar } from "@/components/Sidebar"
import { NotificationBell } from "@/components/NotificationBell"
import { useState, useEffect } from "react"

export function AppLayout({ children, title, subtitle, action }: { 
  children: React.ReactNode
  title?: string
  subtitle?: string
  action?: React.ReactNode
}) {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      setUser(d.user)
    })
  }, [])

  return (
    <div className="min-h-screen bg-[#0f0f1a]">
      <Sidebar />
      <div className="ml-64">
        <header className="px-8 py-5 flex items-center justify-between sticky top-0 z-40 bg-[#0f0f1a]/80 backdrop-blur-md border-b border-white/5">
          <div>
            {title && <h1 className="text-xl font-bold text-white">{title}</h1>}
            {subtitle && <p className="text-gray-400 text-sm mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-4">
            {action}
            {user && <NotificationBell userId={user.id} />}
          </div>
        </header>
        <main className="p-8">{children}</main>
      </div>
    </div>
  )
}
