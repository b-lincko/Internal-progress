"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { AppLayout } from "@/components/AppLayout"

export default function PoamPage() {
  const [poams, setPoams] = useState<any[]>([])
  const [severityFilter, setSeverityFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams()
    if (severityFilter) params.set("severity", severityFilter)
    if (statusFilter) params.set("status", statusFilter)
    fetch(`/api/poam?${params}`).then(r => r.json()).then(d => {
      setPoams(d.poams || [])
      setLoading(false)
    })
  }, [severityFilter, statusFilter])

  function isOverdue(dueDate: string) {
    return new Date(dueDate) < new Date()
  }

  function severityConfig(severity: string) {
    switch (severity) {
      case "Critical": return { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500", badge: "bg-red-100 text-red-700 border-red-200" }
      case "High": return { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", dot: "bg-orange-500", badge: "bg-orange-100 text-orange-700 border-orange-200" }
      case "Medium": return { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", dot: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-700 border-yellow-200" }
      default: return { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", dot: "bg-slate-400", badge: "bg-slate-100 text-slate-600 border-slate-200" }
    }
  }

  function statusConfig(status: string) {
    switch (status) {
      case "Completed": return { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" }
      case "In_Progress": return { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", badge: "bg-blue-100 text-blue-700 border-blue-200" }
      default: return { bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-400", badge: "bg-slate-100 text-slate-600 border-slate-200" }
    }
  }

  async function deletePoam(id: string) {
    if (!confirm("Delete this POA&M? This cannot be undone.")) return
    await fetch(`/api/poam?id=${id}`, { method: "DELETE" })
    setPoams(prev => prev.filter(p => p.id !== id))
  }

  const filteredPoams = poams.filter(p =>
    searchQuery === "" ||
    p.weakness?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.remediation_plan?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.control?.control_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.control?.title?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const overdueCount = poams.filter(p => isOverdue(p.due_date) && p.status !== "Completed").length
  const criticalCount = poams.filter(p => p.severity === "Critical" && p.status !== "Completed").length

  return (
    <AppLayout>
      <div className="max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">POA&M Tracker</h1>
              <p className="text-slate-500 mt-1">{poams.length} items • {overdueCount} overdue • {criticalCount} critical</p>
            </div>
            <div className="flex gap-2">
              {criticalCount > 0 && (
                <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm font-medium border border-red-200">
                  🚨 {criticalCount} critical
                </div>
              )}
              {overdueCount > 0 && (
                <div className="bg-orange-50 text-orange-700 px-4 py-2 rounded-lg text-sm font-medium border border-orange-200">
                  ⚠️ {overdueCount} overdue
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search POA&Ms..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <select
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Severities</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In_Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"/></div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left p-4 text-sm font-semibold text-slate-500">Severity</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-500">Control</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-500">Weakness</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-500">Remediation</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-500">Due Date</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-500">Status</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPoams.map((p, idx) => {
                    const sev = severityConfig(p.severity)
                    const stat = statusConfig(p.status)
                    const overdue = isOverdue(p.due_date) && p.status !== "Completed"
                    return (
                      <tr
                        key={p.id}
                        className={`border-b border-slate-50 transition-colors ${overdue ? "bg-red-50/50" : idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"} hover:bg-slate-50/80`}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${sev.dot}`} />
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${sev.badge}`}>{p.severity}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <Link href={`/controls/${p.control_id}`} className="font-mono text-sm text-primary-600 hover:text-primary-800 font-medium">
                            {p.control?.control_id}
                          </Link>
                          <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">{p.control?.title}</div>
                        </td>
                        <td className="p-4 text-sm text-slate-700 max-w-xs truncate">{p.weakness}</td>
                        <td className="p-4 text-sm text-slate-600 max-w-xs truncate">{p.remediation_plan}</td>
                        <td className="p-4">
                          <span className={`text-sm ${overdue ? "text-red-600 font-bold" : "text-slate-600"}`}>
                            {new Date(p.due_date).toLocaleDateString()}
                            {overdue && " ⚠️"}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${stat.badge}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${stat.dot}`} />
                            {p.status?.replace("_", " ")}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/poam/${p.id}`}
                              className="px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-500 transition-colors"
                            >
                              View
                            </Link>
                            <button
                              onClick={() => deletePoam(p.id)}
                              className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100 transition-colors border border-red-200"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {filteredPoams.length === 0 && (
              <div className="p-12 text-center text-slate-400">No POA&Ms found. Create one from a control detail page.</div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
