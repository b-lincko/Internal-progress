"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { AppLayout } from "@/components/AppLayout"

export default function ControlsPage() {
  const [controls, setControls] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState("")
  const [domainFilter, setDomainFilter] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [domains, setDomains] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams()
    if (statusFilter) params.set("status", statusFilter)
    if (domainFilter) params.set("domain", domainFilter)
    fetch(`/api/controls?${params}`).then(r => r.json()).then(d => {
      setControls(d.controls || [])
      if (domains.length === 0) {
        const allDomains = Array.from(new Set((d.controls || []).map((c: any) => c.domain))) as string[]
        setDomains(allDomains)
      }
      setLoading(false)
    })
  }, [statusFilter, domainFilter])

  const filteredControls = controls.filter(c =>
    searchQuery === "" ||
    c.control_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  function statusColor(status: string) {
    switch (status) {
      case "Implemented": return "bg-emerald-100 text-emerald-700 border-emerald-200"
      case "In_Progress": return "bg-amber-100 text-amber-700 border-amber-200"
      default: return "bg-slate-100 text-slate-600 border-slate-200"
    }
  }

  function statusDot(status: string) {
    switch (status) {
      case "Implemented": return "bg-emerald-500"
      case "In_Progress": return "bg-amber-500"
      default: return "bg-slate-400"
    }
  }

  return (
    <AppLayout>
      <div className="max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Controls</h1>
          <p className="text-slate-500 mt-1">{filteredControls.length} of {controls.length} controls</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search controls..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Statuses</option>
              <option value="Not_Started">Not Started</option>
              <option value="In_Progress">In Progress</option>
              <option value="Implemented">Implemented</option>
            </select>
            <select
              value={domainFilter}
              onChange={e => setDomainFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Domains</option>
              {domains.map(d => <option key={d} value={d}>{d}</option>)}
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
                    <th className="text-left p-4 text-sm font-semibold text-slate-500">Status</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-500">Control ID</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-500">Domain</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-500">Title</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-500">Owner</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-500">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredControls.map((c, idx) => (
                    <tr
                      key={c.id}
                      className={`border-b border-slate-50 hover:bg-slate-50/80 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${statusDot(c.status)}`} />
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusColor(c.status)}`}>
                            {c.status.replace("_", " ")}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <Link href={`/controls/${c.id}`} className="font-mono text-sm text-primary-600 hover:text-primary-800 font-medium">
                          {c.control_id}
                        </Link>
                      </td>
                      <td className="p-4 text-sm text-slate-600">{c.domain}</td>
                      <td className="p-4">
                        <Link href={`/controls/${c.id}`} className="text-sm text-slate-800 hover:text-primary-600 font-medium transition-colors">
                          {c.title}
                        </Link>
                      </td>
                      <td className="p-4 text-sm text-slate-500">{c.owner?.name || "—"}</td>
                      <td className="p-4">
                        {c._count?.evidence > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded-md text-xs font-medium">
                            📎 {c._count.evidence}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-sm">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredControls.length === 0 && (
              <div className="p-12 text-center text-slate-400">No controls match your filters</div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
