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

function StatCard({ title, value, subtitle, href, color, icon }: any) {
  const colorClasses = {
    blue: "bg-blue-500",
    green: "bg-emerald-500",
    yellow: "bg-amber-500",
    orange: "bg-orange-500",
    red: "bg-red-500",
    gray: "bg-slate-500"
  }
  return (
    <Link href={href} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all p-6 group">
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 ${colorClasses[color as keyof typeof colorClasses]} rounded-lg flex items-center justify-center text-white text-xl shadow-sm`}>
          {icon}
        </div>
        <span className="text-xs font-medium text-slate-400 group-hover:text-primary-600 transition-colors">View →</span>
      </div>
      <div className="mt-4">
        <div className="text-3xl font-bold text-slate-900">{value}</div>
        <div className="text-sm font-medium text-slate-500 mt-1">{title}</div>
        {subtitle && <div className="text-xs text-slate-400 mt-1">{subtitle}</div>}
      </div>
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

  if (loading) return <AppLayout><div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"/></div></AppLayout>

  const implPct = stats && stats.total > 0 ? Math.round((stats.implemented / stats.total) * 100) : 0

  return (
    <AppLayout>
      <div className="max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">CMMC Level 2 compliance overview</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          <StatCard title="Total Controls" value={stats?.total || 0} subtitle={`${implPct}% implemented`} href="/controls" color="blue" icon="🛡️" />
          <StatCard title="Implemented" value={`${implPct}%`} subtitle={`${stats?.implemented} controls`} href="/controls?status=Implemented" color="green" icon="✅" />
          <StatCard title="In Progress" value={stats?.inProgress || 0} subtitle="Active work" href="/controls?status=In_Progress" color="yellow" icon="🔄" />
          <StatCard title="Open POA&Ms" value={stats?.openPoams || 0} subtitle="Needs attention" href="/poam" color="orange" icon="⚠️" />
          <StatCard title="High/Critical" value={stats?.highCriticalPoams || 0} subtitle="Priority items" href="/poam?severity=High" color="red" icon="🔥" />
          <StatCard title="Not Started" value={stats?.notStarted || 0} subtitle="Pending review" href="/controls?status=Not_Started" color="gray" icon="⏳" />
          <StatCard title="Deadlines" value={stats?.deadlines || 0} subtitle={`${stats?.overdueDeadlines} overdue`} href="/deadlines" color="blue" icon="📅" />
          <StatCard title="Documents" value={stats?.documents || 0} subtitle="Files uploaded" href="/documents" color="purple" icon="📁" />
          <StatCard title="Team" value={stats?.users || 0} subtitle="Members" href="/users" color="green" icon="👥" />
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/controls" className="px-4 py-2 bg-primary-50 text-primary-700 rounded-lg font-medium hover:bg-primary-100 transition-colors">Browse Controls</Link>
            <Link href="/api/ssp" className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg font-medium hover:bg-emerald-100 transition-colors">📄 Export SSP</Link>
            <Link href="/chat" className="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg font-medium hover:bg-purple-100 transition-colors">💬 Team Chat</Link>
            <Link href="/deadlines" className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100 transition-colors">📅 Add Deadline</Link>
            <Link href="/documents" className="px-4 py-2 bg-slate-50 text-slate-700 rounded-lg font-medium hover:bg-slate-100 transition-colors">📁 Upload Document</Link>
            <Link href="/users" className="px-4 py-2 bg-amber-50 text-amber-700 rounded-lg font-medium hover:bg-amber-100 transition-colors">👥 Manage Users</Link>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
