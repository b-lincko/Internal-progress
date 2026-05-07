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
    Implemented: { color: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
    In_Progress: { color: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
    Not_Started: { color: "bg-slate-400", text: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200" }
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
          <Link href="/controls" className="text-sm text-slate-500 hover:text-primary-600 transition-colors flex items-center gap-1">
            ← Back to Controls
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="text-sm font-medium text-slate-400 mb-1">{control.domain}</div>
              <h1 className="text-2xl font-bold text-slate-900">{control.control_id} — {control.title}</h1>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-bold ${s.bg} ${s.text} border ${s.border}`}>
              {control.status?.replace("_", " ")}
            </span>
          </div>
          <p className="text-slate-600 leading-relaxed">{control.description}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center text-primary-600">✏️</span>
              Update Control
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="Not_Started">Not Started</option>
                  <option value="In_Progress">In Progress</option>
                  <option value="Implemented">Implemented</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Implementation Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 h-32 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" placeholder="Add implementation details..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Assign Owner</label>
                <select value={ownerId} onChange={e => setOwnerId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">Unassigned</option>
                  {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <button onClick={updateControl} disabled={saving} className="w-full bg-primary-600 hover:bg-primary-500 text-white font-medium py-2.5 rounded-lg transition-all disabled:opacity-50">
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">📎</span>
              Evidence
            </h2>
            {control.evidence?.length > 0 ? (
              <div className="space-y-2 mb-4">
                {control.evidence.map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📄</span>
                      <span className="text-sm font-medium text-slate-700">{e.file_name}</span>
                    </div>
                    <span className="text-xs text-slate-400">by {e.user?.name}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-slate-400 text-sm mb-4">No evidence uploaded yet.</p>}
            <div className="flex gap-2">
              <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2" />
              <button onClick={uploadEvidence} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Upload</button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
