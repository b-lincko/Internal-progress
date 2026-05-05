"use client"

import { Sidebar } from "@/components/Sidebar"
import { NotificationBell } from "@/components/NotificationBell"
import { useState, useEffect } from "react"

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      setUser(d.user)
    })
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-64 transition-all">
        {/* Top Header with Notifications */}
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-40">
          <h2 className="text-lg font-semibold text-slate-700">CMMC Level 2 Compliance</h2>
          <div className="flex items-center gap-4">
            {user && <NotificationBell userId={user.id} />}
          </div>
        </header>
        <main className="p-8">{children}</main>
      </div>
    </div>
  )
}
