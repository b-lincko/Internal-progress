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

function TaskCard({ title, desc, tags, progress, date, members, priority }: any) {
  const priorityColors: Record<string, string> = {
    high: "bg-red-500/20 text-red-300 border-red-500/30",
    medium: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    low: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
  }

  return (
    <div className="glass-card rounded-2xl p-5 hover:bg-white/5 transition-all">
      <div className="flex gap-2 mb-3">
        {tags.map((tag: string) => (
          <span key={tag} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/10 text-gray-300 border border-white/10">
            {tag}
          </span>
        ))}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-400 mb-4 line-clamp-2">{desc}</p>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500">Progress</span>
          <span className="text-xs font-medium text-white">{progress}%</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs text-gray-500">{date}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${priorityColors[priority] || priorityColors.low}`}>
            {priority}
          </span>
          <div className="flex -space-x-2">
            {members.map((m: string, i: number) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-white text-[10px] font-bold border-2 border-[#0f0f1a]"
              >
                {m}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
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
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full" />
        </div>
      </AppLayout>
    )
  }

  const implPct = stats && stats.total > 0 ? Math.round((stats.implemented / stats.total) * 100) : 0

  return (
    <AppLayout>
      <div className="max-w-7xl">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <StatCard
            title="Total Controls"
            value={stats?.total || 0}
            subtitle={`${implPct}% implemented`}
            href="/controls"
            gradient="bg-gradient-to-br from-emerald-500 to-teal-400"
            icon="🛡️"
            change="+12%"
          />
          <StatCard
            title="In Progress"
            value={stats?.inProgress || 0}
            subtitle="Active work"
            href="/controls?status=In_Progress"
            gradient="bg-gradient-to-br from-violet-500 to-purple-400"
            icon="🔄"
            change="+5%"
          />
          <StatCard
            title="Completed"
            value={stats?.implemented || 0}
            subtitle="Done & verified"
            href="/controls?status=Implemented"
            gradient="bg-gradient-to-br from-cyan-500 to-blue-400"
            icon="✅"
            change="+18%"
          />
          <StatCard
            title="Open POA&Ms"
            value={stats?.openPoams || 0}
            subtitle={`${stats?.highCriticalPoams || 0} high/critical`}
            href="/poam"
            gradient="bg-gradient-to-br from-orange-500 to-red-400"
            icon="⚠️"
            change="-25%"
          />
        </div>

        {/* Search & Filters */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search tasks..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-12 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent"
            />
          </div>
          <button className="flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-300 hover:bg-white/10 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
            Filter
          </button>
          <button className="flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-300 hover:bg-white/10 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Sort by Date
          </button>
        </div>

        {/* Task Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <TaskCard
            title="Design System Update"
            desc="Refactor color tokens and component library for better consistency across the compliance dashboard"
            tags={["Design", "UI"]}
            progress={75}
            date="2024-01-15"
            members={["JD", "SK", "ML"]}
            priority="high"
          />
          <TaskCard
            title="API Integration"
            desc="Connect payment gateway and user authentication endpoints for secure document access"
            tags={["Backend", "API"]}
            progress={40}
            date="2024-01-18"
            members={["RB"]}
            priority="medium"
          />
          <TaskCard
            title="User Testing Session"
            desc="Conduct usability testing with 5 participants for new compliance features and reporting"
            tags={["Research", "UX"]}
            progress={20}
            date="2024-01-20"
            members={["JD", "ML"]}
            priority="low"
          />
        </div>
      </div>
    </AppLayout>
  )
}
