"use client"

import { useState } from "react"
import Link from "next/link"
import { AppLayout } from "@/components/AppLayout"

interface SubControl {
  id: string
  name: string
  description: string | null
  status: string
  type: string
  notes: string | null
}

export function ControlDetailClient({ control, users }: { control: any; users: any[] }) {
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState(control.implementation_notes || "")
  const [status, setStatus] = useState(control.status)
  const [ownerId, setOwnerId] = useState(control.owner_id || "")
  const [saving, setSaving] = useState(false)

  const statusConfig: Record<string, any> = {
    Implemented: { color: "bg-emerald-500", text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    In_Progress: { color: "bg-amber-500", text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
    Not_Started: { color: "bg-gray-500", text: "text-gray-400", bg: "bg-gray-500/10", border: "border-gray-500/20" }
  }
  const s = statusConfig[control.status] || statusConfig.Not_Started

  async function updateControl() {
    setSaving(true)
    await fetch(`/api/controls/${control.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, implementation_notes: notes, owner_id: ownerId || null })
    })
    setSaving(false)
    alert("Updated!")
    window.location.reload()
  }

  async function uploadEvidence() {
    if (!file) return
    const formData = new FormData()
    formData.append("file", file)
    formData.append("control_id", control.id)
    const me = await fetch("/api/auth/me").then(r => r.json())
    formData.append("user_id", me.user?.id || "")
    await fetch("/api/evidence", { method: "POST", body: formData })
    alert("Uploaded!")
    window.location.reload()
  }

  return (
    <AppLayout>
      <div className="max-w-5xl">
        <div className="mb-6">
          <Link href="/controls" className="text-sm text-gray-500 hover:text-violet-400 transition-colors flex items-center gap-1">
            ← Back to Controls
          </Link>
        </div>

        <div className="glass-card rounded-xl p-8 mb-6 border border-white/10">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">{control.domain}</div>
              <h1 className="text-2xl font-bold text-white">{control.control_id} — {control.title}</h1>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-bold ${s.bg} ${s.text} border ${s.border}`}>
              {control.status?.replace("_", " ")}
            </span>
          </div>
          <p className="text-gray-400 leading-relaxed">{control.description}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-violet-500/10 rounded-lg flex items-center justify-center text-violet-400">✏️</span>
              Update Control
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)} className="w-full border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white">
                  <option value="Not_Started">Not Started</option>
                  <option value="In_Progress">In Progress</option>
                  <option value="Implemented">Implemented</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Implementation Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full border border-white/10 rounded-lg px-4 py-2.5 h-32 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none bg-white/5 text-white placeholder-gray-500" placeholder="Add implementation details..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Assign Owner</label>
                <select value={ownerId} onChange={e => setOwnerId(e.target.value)} className="w-full border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white">
                  <option value="">Unassigned</option>
                  {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <button onClick={updateControl} disabled={saving} className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium py-2.5 rounded-lg transition-all disabled:opacity-50">
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          <div className="glass-card rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-cyan-500/10 rounded-lg flex items-center justify-center text-cyan-400">📎</span>
              Evidence
            </h2>
            {control.evidence?.length > 0 ? (
              <div className="space-y-2 mb-4">
                {control.evidence.map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📄</span>
                      <span className="text-sm font-medium text-gray-300">{e.file_name}</span>
                    </div>
                    <span className="text-xs text-gray-500">by {e.user?.name}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-gray-500 text-sm mb-4">No evidence uploaded yet.</p>}
            <div className="flex gap-2">
              <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="flex-1 text-sm border border-white/10 rounded-lg px-3 py-2 bg-white/5 text-gray-300 file:text-gray-400 file:bg-transparent" />
              <button onClick={uploadEvidence} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Upload</button>
            </div>
          </div>

          {/* Subcontrols */}
          {control.subcontrols?.length > 0 && (
            <div className="glass-card rounded-xl p-6 border border-white/10">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center text-amber-400">📋</span>
                Subcontrols ({control.subcontrols.length})
              </h2>
              <div className="space-y-2">
                {control.subcontrols.map((sub: any) => (
                  <div key={sub.id} className="bg-white/5 rounded-lg p-3 border border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-200 text-sm">{sub.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        sub.status === "Implemented" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                        sub.status === "In_Progress" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                        "bg-white/10 text-gray-400 border-white/10"
                      }`}>{sub.status?.replace("_", " ")}</span>
                    </div>
                    {sub.description && <p className="text-xs text-gray-500 mt-1">{sub.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* POA&M Section */}
          <div className="glass-card rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center text-red-400">⚠️</span>
              POA&M Tracker
            </h2>
            {control.poams?.length > 0 ? (
              <div className="space-y-2 mb-4">
                {control.poams.map((poam: any) => (
                  <Link key={poam.id} href={`/poam/${poam.id}`} className="block bg-white/5 rounded-lg p-3 border border-white/5 hover:bg-white/10 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-200 text-sm">{poam.weakness?.substring(0, 60) || "POA&M"}...</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        poam.severity === "Critical" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                        poam.severity === "High" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                        poam.severity === "Medium" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                        "bg-white/10 text-gray-400 border-white/10"
                      }`}>{poam.severity}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Status: {poam.status?.replace("_", " ")} | Due: {new Date(poam.due_date).toLocaleDateString()}</div>
                  </Link>
                ))}
              </div>
            ) : <p className="text-gray-500 text-sm mb-4">No POA&Ms linked to this control.</p>}
            <Link href={`/poam?controlId=${control.id}`} className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              ⚠️ Create POA&M
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
