"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { AppLayout } from "@/components/AppLayout"

interface Stats {
  total: number
  implemented: number
  inProgress: number
  notStarted: number
  openPoams: number
  highCriticalPoams: number
  deadlines: number
  overdueDeadlines: number
  documents: number
  users: number
}

function StatCard({ title, value, subtitle, href, gradient, icon, change }: any) {
  return (
    <Link href={href} className="glass-card rounded-2xl p-6 hover:bg-white/5 transition-all group relative overflow-hidden">
      <div className="absolute top-4 right-4 text-sm font-medium">
        {change && (
          <span className={change.startsWith("+") ? "text-emerald-400" : "text-red-400"}>
            {change}
          </span>
        )}
      </div>
      <div className={`w-12 h-12 rounded-2xl ${gradient} flex items-center justify-center text-white text-xl mb-4`}>
        {icon}
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className="text-sm text-gray-400 mt-1">{title}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>}
    </Link>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/controls").then(r => r.json()),
      fetch("/api/poam").then(r => r.json()),
      fetch("/api/deadlines").then(r => r.json()),
      fetch("/api/documents").then(r => r.json()),
      fetch("/api/users").then(r => r.json())
    ]).then(([controlsData, poamData, deadlineData, docData, userData]) => {
      const controls = controlsData.controls || []
      const poams = poamData.poams || []
      const deadlines = deadlineData.deadlines || []
      const now = new Date()
      setStats({
        total: controls.length,
        implemented: controls.filter((c: any) => c.status === "Implemented").length,
        inProgress: controls.filter((c: any) => c.status === "In_Progress").length,
        notStarted: controls.filter((c: any) => c.status === "Not_Started").length,
        openPoams: poams.filter((p: any) => p.status !== "Completed").length,
        highCriticalPoams: poams.filter((p: any) => p.status !== "Completed" && ["High", "Critical"].includes(p.severity)).length,
        deadlines: deadlines.length,
        overdueDeadlines: deadlines.filter((d: any) => new Date(d.due_date) < now && d.status !== "Completed").length,
        documents: (docData.documents || []).length,
        users: (userData.users || []).length
      })
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <AppLayout title="Dashboard" subtitle="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full" />
        </div>
      </AppLayout>
    )
  }

  const implPct = stats && stats.total > 0 ? Math.round((stats.implemented / stats.total) * 100) : 0

  return (
    <AppLayout 
      title="Dashboard" 
      subtitle="CMMC Level 2 compliance overview"
      action={
        <Link href="/deadlines" className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-cyan-500 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          Create Task
        </Link>
      }
    >
      <div className="max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <StatCard title="Total Controls" value={stats?.total || 0} subtitle={`${implPct}% implemented`} href="/controls" gradient="bg-gradient-to-br from-emerald-500 to-teal-400" icon="🛡️" change="+12%" />
          <StatCard title="In Progress" value={stats?.inProgress || 0} subtitle="Active work" href="/controls?status=In_Progress" gradient="bg-gradient-to-br from-violet-500 to-purple-400" icon="🔄" change="+5%" />
          <StatCard title="Completed" value={stats?.implemented || 0} subtitle="Done & verified" href="/controls?status=Implemented" gradient="bg-gradient-to-br from-cyan-500 to-blue-400" icon="✅" change="+18%" />
          <StatCard title="Open POA&Ms" value={stats?.openPoams || 0} subtitle={`${stats?.highCriticalPoams || 0} high/critical`} href="/poam" gradient="bg-gradient-to-br from-orange-500 to-red-400" icon="⚠️" change="-25%" />
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/controls" className="px-4 py-2 bg-violet-500/10 text-violet-400 rounded-xl font-medium hover:bg-violet-500/20 transition-colors border border-violet-500/20">Browse Controls</Link>
            <Link href="/api/ssp" className="px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-xl font-medium hover:bg-emerald-500/20 transition-colors border border-emerald-500/20">📄 Export SSP</Link>
            <Link href="/chat" className="px-4 py-2 bg-cyan-500/10 text-cyan-400 rounded-xl font-medium hover:bg-cyan-500/20 transition-colors border border-cyan-500/20">💬 Team Chat</Link>
            <Link href="/deadlines" className="px-4 py-2 bg-blue-500/10 text-blue-400 rounded-xl font-medium hover:bg-blue-500/20 transition-colors border border-blue-500/20">📅 Add Deadline</Link>
            <Link href="/documents" className="px-4 py-2 bg-white/5 text-gray-300 rounded-xl font-medium hover:bg-white/10 transition-colors border border-white/10">📁 Upload Document</Link>
            <Link href="/users" className="px-4 py-2 bg-amber-500/10 text-amber-400 rounded-xl font-medium hover:bg-amber-500/20 transition-colors border border-amber-500/20">👥 Manage Users</Link>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
