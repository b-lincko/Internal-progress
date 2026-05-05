"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { AppLayout } from "@/components/AppLayout"

interface SubControl {
  id: string
  name: string
  description: string | null
  status: string
  type: string
  notes: string | null
  created_at: string
}

export default function ControlDetailPage() {
  const { id } = useParams()
  const [control, setControl] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState("")
  const [ownerId, setOwnerId] = useState("")
  const [saving, setSaving] = useState(false)

  // Subcontrols
  const [subcontrols, setSubcontrols] = useState<SubControl[]>([])
  const [showSubForm, setShowSubForm] = useState(false)
  const [subName, setSubName] = useState("")
  const [subType, setSubType] = useState("AD")
  const [subDesc, setSubDesc] = useState("")
  const [subStatus, setSubStatus] = useState("Not_Started")
  const [subNotes, setSubNotes] = useState("")
  const [savingSub, setSavingSub] = useState(false)
  const [editingSub, setEditingSub] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/controls/${id}`).then(r => r.json()).then(d => {
      setControl(d.control)
      setNotes(d.control?.implementation_notes || "")
      setStatus(d.control?.status || "")
      setOwnerId(d.control?.owner_id || "")
      setLoading(false)
    })
    fetch("/api/users").then(r => r.json()).then(d => setUsers(d.users || []))
    loadSubcontrols()
  }, [id])

  async function loadSubcontrols() {
    if (!id) return
    const res = await fetch(`/api/subcontrols?controlId=${id}`)
    const data = await res.json()
    setSubcontrols(data.subcontrols || [])
  }

  async function updateControl() {
    setSaving(true)
    await fetch(`/api/controls/${id}`, {
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
    formData.append("control_id", id as string)
    const me = await fetch("/api/auth/me").then(r => r.json())
    formData.append("user_id", me.user?.id || "")
    await fetch("/api/evidence", { method: "POST", body: formData })
    alert("Uploaded!")
    window.location.reload()
  }

  async function createPOAM(e: React.FormEvent) {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const fd = new FormData(form)
    await fetch("/api/poam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        control_id: id,
        weakness: fd.get("weakness"),
        remediation_plan: fd.get("remediation_plan"),
        severity: fd.get("severity"),
        due_date: fd.get("due_date"),
        status: "Open"
      })
    })
    alert("POA&M created!")
    window.location.reload()
  }

  async function createSubcontrol(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    setSavingSub(true)
    await fetch("/api/subcontrols", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        control_id: id,
        name: subName,
        type: subType,
        description: subDesc,
        status: subStatus
      })
    })
    setSavingSub(false)
    setSubName("")
    setSubDesc("")
    setSubStatus("Not_Started")
    setShowSubForm(false)
    loadSubcontrols()
  }

  async function updateSubcontrol(subId: string) {
    await fetch("/api/subcontrols", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: subId, status: subStatus, notes: subNotes })
    })
    setEditingSub(null)
    setSubNotes("")
    loadSubcontrols()
  }

  async function deleteSubcontrol(subId: string) {
    if (!confirm("Delete this subcontrol?")) return
    await fetch(`/api/subcontrols?id=${subId}`, { method: "DELETE" })
    loadSubcontrols()
  }

  if (loading) return <AppLayout><div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"/></div></AppLayout>
  if (!control) return <AppLayout><div className="text-center py-12 text-slate-400">Control not found</div></AppLayout>

  const statusConfig = {
    Implemented: { color: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
    In_Progress: { color: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
    Not_Started: { color: "bg-slate-400", text: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200" }
  }
  const s = statusConfig[control.status as keyof typeof statusConfig] || statusConfig.Not_Started

  const subTypes = ["AD", "Firewall", "Router", "Switch", "Endpoint", "Server", "Cloud", "Database", "Application", "Network", "Other"]

  const typeColors: Record<string, string> = {
    AD: "bg-blue-100 text-blue-700",
    Firewall: "bg-red-100 text-red-700",
    Router: "bg-orange-100 text-orange-700",
    Switch: "bg-green-100 text-green-700",
    Endpoint: "bg-purple-100 text-purple-700",
    Server: "bg-slate-100 text-slate-700",
    Cloud: "bg-sky-100 text-sky-700",
    Database: "bg-pink-100 text-pink-700",
    Application: "bg-indigo-100 text-indigo-700",
    Network: "bg-teal-100 text-teal-700",
    Other: "bg-gray-100 text-gray-700"
  }

  // Group subcontrols by type
  const grouped = subcontrols.reduce((acc: Record<string, SubControl[]>, sub) => {
    acc[sub.type] = acc[sub.type] || []
    acc[sub.type].push(sub)
    return acc
  }, {})

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
              {control.status.replace("_", " ")}
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
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
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

        {/* Subcontrols Section */}
        <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center text-violet-600">🧩</span>
              Subcontrols
              <span className="text-sm font-normal text-slate-400">({subcontrols.length})</span>
            </h2>
            <button onClick={() => setShowSubForm(!showSubForm)} className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              {showSubForm ? "Cancel" : "+ Add Subcontrol"}
            </button>
          </div>

          {showSubForm && (
            <form onSubmit={createSubcontrol} className="bg-slate-50 rounded-xl p-5 mb-5 border border-slate-200">
              <h3 className="font-medium text-slate-700 mb-3">New Subcontrol</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <input
                  value={subName}
                  onChange={e => setSubName(e.target.value)}
                  placeholder="Name (e.g. Domain Policy)"
                  className="border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  required
                />
                <select value={subType} onChange={e => setSubType(e.target.value)} className="border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500">
                  {subTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <textarea
                value={subDesc}
                onChange={e => setSubDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 h-20 mb-3 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              />
              <select value={subStatus} onChange={e => setSubStatus(e.target.value)} className="border border-slate-200 rounded-lg px-4 py-2.5 mb-3 focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="Not_Started">Not Started</option>
                <option value="In_Progress">In Progress</option>
                <option value="Implemented">Implemented</option>
              </select>
              <div className="flex gap-3">
                <button type="submit" disabled={savingSub} className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50">
                  {savingSub ? "Saving..." : "Save"}
                </button>
                <button type="button" onClick={() => setShowSubForm(false)} className="text-slate-500 hover:text-slate-700 px-4 py-2">Cancel</button>
              </div>
            </form>
          )}

          {subcontrols.length === 0 ? (
            <p className="text-slate-400 text-sm">No subcontrols yet. Add subcontrols like AD, Firewall, Router, Switch, etc.</p>
          ) : (
            <div className="space-y-5">
              {Object.entries(grouped).map(([type, items]) => (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${typeColors[type] || typeColors.Other}`}>{type}</span>
                    <span className="text-xs text-slate-400">{items.length} item{items.length > 1 ? "s" : ""}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {items.map((sub) => {
                      const subStatusCfg = statusConfig[sub.status as keyof typeof statusConfig] || statusConfig.Not_Started
                      const isEditing = editingSub === sub.id
                      return (
                        <div key={sub.id} className="border border-slate-100 rounded-lg p-4 hover:border-violet-200 transition-colors">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="font-medium text-slate-800">{sub.name}</div>
                              {sub.description && <div className="text-xs text-slate-500 mt-0.5">{sub.description}</div>}
                            </div>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${subStatusCfg.bg} ${subStatusCfg.text}`}>
                              {sub.status.replace("_", " ")}
                            </span>
                          </div>
                          {isEditing ? (
                            <div className="mt-3 space-y-2">
                              <select
                                value={subStatus}
                                onChange={e => setSubStatus(e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                              >
                                <option value="Not_Started">Not Started</option>
                                <option value="In_Progress">In Progress</option>
                                <option value="Implemented">Implemented</option>
                              </select>
                              <textarea
                                value={subNotes}
                                onChange={e => setSubNotes(e.target.value)}
                                placeholder="Notes"
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm h-16 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                              />
                              <div className="flex gap-2">
                                <button onClick={() => updateSubcontrol(sub.id)} className="bg-violet-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-violet-500">Save</button>
                                <button onClick={() => { setEditingSub(null); setSubNotes("") }} className="text-slate-500 hover:text-slate-700 text-xs">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between mt-2">
                              {sub.notes ? <span className="text-xs text-slate-500 italic">{sub.notes}</span> : <span />}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => { setEditingSub(sub.id); setSubStatus(sub.status); setSubNotes(sub.notes || "") }}
                                  className="text-violet-600 hover:text-violet-800 text-xs font-medium"
                                >
                                  Edit
                                </button>
                                <button onClick={() => deleteSubcontrol(sub.id)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center text-orange-600">⚠️</span>
            POA&M
          </h2>
          {control.poams?.length > 0 ? (
            <div className="space-y-3 mb-6">
              {control.poams.map((p: any) => (
                <div key={p.id} className="border border-slate-100 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-slate-800">{p.weakness}</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      p.severity === "Critical" ? "bg-red-100 text-red-700" :
                      p.severity === "High" ? "bg-orange-100 text-orange-700" :
                      p.severity === "Medium" ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>{p.severity}</span>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">{p.remediation_plan}</p>
                  <div className="text-xs text-slate-400 flex gap-4">
                    <span>Due: {new Date(p.due_date).toLocaleDateString()}</span>
                    <span>Status: {p.status}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-slate-400 text-sm mb-4">No POA&Ms for this control.</p>}

          <form onSubmit={createPOAM} className="border-t pt-4 space-y-3">
            <h3 className="font-medium text-slate-700">Create POA&M</h3>
            <input name="weakness" placeholder="Weakness / Finding" className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500" required />
            <textarea name="remediation_plan" placeholder="Remediation plan" className="w-full border border-slate-200 rounded-lg px-4 py-2.5 h-20 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" required />
            <div className="flex gap-2">
              <select name="severity" className="border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500" required>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
              <input name="due_date" type="date" className="border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500" required />
            </div>
            <button type="submit" className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Create POA&M</button>
          </form>
        </div>
      </div>
    </AppLayout>
  )
}
