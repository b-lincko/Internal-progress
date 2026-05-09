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
  const [currentUser, setCurrentUser] = useState<any>(null)

  // Create form
  const [showForm, setShowForm] = useState(false)
  const [controls, setControls] = useState<any[]>([])
  const [controlId, setControlId] = useState("")
  const [weakness, setWeakness] = useState("")
  const [remediation, setRemediation] = useState("")
  const [severity, setSeverity] = useState("Medium")
  const [dueDate, setDueDate] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setCurrentUser(d.user))
    loadPoams()
    fetch("/api/controls").then(r => r.json()).then(d => setControls(d.controls || []))
  }, [severityFilter, statusFilter])

  function isOverdue(dueDate: string) {
    return new Date(dueDate) < new Date()
  }

  function severityConfig(severity: string) {
    switch (severity) {
      case "Critical": return { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", dot: "bg-red-500", badge: "bg-red-500/10 text-red-400 border-red-500/20" }
      case "High": return { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20", dot: "bg-orange-500", badge: "bg-orange-500/10 text-orange-400 border-orange-500/20" }
      case "Medium": return { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/20", dot: "bg-yellow-500", badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" }
      default: return { bg: "bg-white/5", text: "text-gray-400", border: "border-white/10", dot: "bg-gray-400", badge: "bg-white/5 text-gray-400 border-white/10" }
    }
  }

  function statusConfig(status: string) {
    switch (status) {
      case "Completed": return { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" }
      case "In_Progress": return { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-500", badge: "bg-blue-500/10 text-blue-400 border-blue-500/20" }
      default: return { bg: "bg-white/5", text: "text-gray-400", dot: "bg-gray-400", badge: "bg-white/5 text-gray-400 border-white/10" }
    }
  }

  async function loadPoams() {
    const params = new URLSearchParams()
    if (severityFilter) params.set("severity", severityFilter)
    if (statusFilter) params.set("status", statusFilter)
    const res = await fetch(`/api/poam?${params}`)
    const data = await res.json()
    setPoams(data.poams || [])
    setLoading(false)
  }

  async function createPoam(e: React.FormEvent) {
    e.preventDefault()
    if (!controlId || !weakness || !dueDate) return
    setSaving(true)
    const res = await fetch("/api/poam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        control_id: controlId,
        weakness,
        remediation_plan: remediation,
        severity,
        due_date: dueDate,
        status: "Open"
      })
    })
    setSaving(false)
    if (res.ok) {
      resetForm()
      setShowForm(false)
      loadPoams()
    } else {
      const data = await res.json()
      alert(data.error || "Failed to create POA&M")
    }
  }

  function resetForm() {
    setControlId("")
    setWeakness("")
    setRemediation("")
    setSeverity("Medium")
    setDueDate("")
  }

  const isManager = currentUser?.role === "Manager" || currentUser?.role === "Admin"

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
    <AppLayout title="POA&amp;M" subtitle="Plan of Action &amp; Milestones">
      <div className="max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">POA&amp;M Tracker</h1>
              <p className="text-gray-500 mt-1">{poams.length} items • {overdueCount} overdue • {criticalCount} critical</p>
            </div>
            <div className="flex gap-2">
              {isManager && (
                <button onClick={() => setShowForm(!showForm)} className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2">
                  ⚠️ {showForm ? "Cancel" : "Create POA&M"}
                </button>
              )}
              {criticalCount > 0 && (
                <div className="bg-red-500/10 text-red-400 px-4 py-2 rounded-lg text-sm font-medium border border-red-500/20">
                  🚨 {criticalCount} critical
                </div>
              )}
              {overdueCount > 0 && (
                <div className="bg-orange-500/10 text-orange-400 px-4 py-2 rounded-lg text-sm font-medium border border-orange-500/20">
                  ⚠️ {overdueCount} overdue
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-4 mb-6 border border-white/10">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search POA&amp;Ms..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white/5 text-white"
              />
            </div>
            <select
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
              className="border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white"
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
              className="border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white"
            >
              <option value="">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In_Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>

        {showForm && (
          <form onSubmit={createPoam} className="glass-card rounded-xl p-6 mb-6 border border-white/10 animate-fade-in">
            <h2 className="text-lg font-bold text-white mb-4">Create POA&M</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Linked Control</label>
                <select value={controlId} onChange={e => setControlId(e.target.value)} className="w-full border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white" required>
                  <option value="">Select a control...</option>
                  {controls.map((c: any) => <option key={c.id} value={c.id}>{c.control_id} — {c.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Severity</label>
                <select value={severity} onChange={e => setSeverity(e.target.value)} className="w-full border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white">
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-400 mb-1">Weakness / Finding</label>
                <textarea value={weakness} onChange={e => setWeakness(e.target.value)} className="w-full border border-white/10 rounded-lg px-4 py-2.5 h-24 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none bg-white/5 text-white placeholder-gray-500" placeholder="Describe the weakness or finding..." required />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-400 mb-1">Remediation Plan</label>
                <textarea value={remediation} onChange={e => setRemediation(e.target.value)} className="w-full border border-white/10 rounded-lg px-4 py-2.5 h-24 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none bg-white/5 text-white placeholder-gray-500" placeholder="Describe the remediation steps..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Due Date</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white" required />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-2.5 rounded-lg font-medium disabled:opacity-50">{saving ? "Creating..." : "Create POA&M"}</button>
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-500 hover:text-gray-300 px-4 py-2.5">Cancel</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-violet-600 border-t-transparent rounded-full"/></div>
        ) : (
          <div className="glass-card rounded-xl overflow-hidden border border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left p-4 text-sm font-semibold text-gray-500">Severity</th>
                    <th className="text-left p-4 text-sm font-semibold text-gray-500">Control</th>
                    <th className="text-left p-4 text-sm font-semibold text-gray-500">Weakness</th>
                    <th className="text-left p-4 text-sm font-semibold text-gray-500">Remediation</th>
                    <th className="text-left p-4 text-sm font-semibold text-gray-500">Due Date</th>
                    <th className="text-left p-4 text-sm font-semibold text-gray-500">Status</th>
                    <th className="text-left p-4 text-sm font-semibold text-gray-500">Actions</th>
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
                        className={`border-b border-white/5 transition-colors ${overdue ? "bg-red-500/5" : idx % 2 === 0 ? "bg-transparent" : "bg-white/5"} hover:bg-white/5`}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${sev.dot}`} />
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${sev.badge}`}>{p.severity}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <Link href={`/controls/${p.control_id}`} className="font-mono text-sm text-violet-400 hover:text-violet-300 font-medium">
                            {p.control?.control_id}
                          </Link>
                          <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{p.control?.title}</div>
                        </td>
                        <td className="p-4 text-sm text-gray-300 max-w-xs truncate">{p.weakness}</td>
                        <td className="p-4 text-sm text-gray-400 max-w-xs truncate">{p.remediation_plan}</td>
                        <td className="p-4">
                          <span className={`text-sm ${overdue ? "text-red-400 font-bold" : "text-gray-400"}`}>
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
                              className="px-3 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-500 transition-colors"
                            >
                              View
                            </Link>
                            <button
                              onClick={() => deletePoam(p.id)}
                              className="px-3 py-1.5 bg-red-500/10 text-red-400 text-xs font-medium rounded-lg hover:bg-red-500/20 transition-colors border border-red-500/20"
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
              <div className="p-12 text-center text-gray-500">No POA&amp;Ms found. Create one above.</div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
