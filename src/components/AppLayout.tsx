"use client"

import { Sidebar } from "@/components/Sidebar"
import { NotificationBell } from "@/components/NotificationBell"
import Link from "next/link"
import { useState, useEffect } from "react"

export function AppLayout({ children }: { children: React.ReactNode }) {
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
            <h1 className="text-2xl font-bold text-white">Welcome back, {user?.name || "User"}</h1>
            <p className="text-gray-400 text-sm mt-0.5">Here&apos;s what&apos;s happening with your compliance today</p>
          </div>
          <div className="flex items-center gap-4">
            {user && <NotificationBell userId={user.id} />}
            <Link href="/notifications/settings" className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-cyan-500 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              Create Task
            </Link>
          </div>
        </header>
        <main className="p-8">{children}</main>
      </div>
    </div>
  )
}
