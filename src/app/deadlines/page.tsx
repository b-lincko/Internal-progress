"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/AppLayout"

interface Deadline {
  id: string
  title: string
  description: string | null
  due_date: string
  status: string
  priority: string
  control: { id: string; control_id: string; title: string } | null
  assignees: { id: string; name: string }[]
  creator: { id: string; name: string }
}

interface User {
  id: string
  name: string
  email: string
}

export default function DeadlinesPage() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [controls, setControls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState("")

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [controlId, setControlId] = useState("")
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [priority, setPriority] = useState("Medium")
  const [editId, setEditId] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setCurrentUser(d.user))
    loadData()
  }, [])

  async function loadData() {
    const [dRes, uRes, cRes] = await Promise.all([
      fetch("/api/deadlines"),
      fetch("/api/users"),
      fetch("/api/controls")
    ])
    const [dData, uData, cData] = await Promise.all([dRes.json(), uRes.json(), cRes.json()])
    setDeadlines(dData.deadlines || [])
    setUsers(uData.users || [])
    setControls(cData.controls || [])
    setLoading(false)
  }

  async function createDeadline(e: React.FormEvent) {
    e.preventDefault()
    if (!title || !dueDate || !currentUser) return
    setSaving(true)
    const res = await fetch("/api/deadlines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        due_date: dueDate,
        control_id: controlId || null,
        assignee_ids: assigneeIds,
        priority,
        created_by: currentUser.id
      })
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json()
      alert("Failed: " + (data.error || "Unknown"))
      return
    }
    resetForm()
    setShowForm(false)
    loadData()
  }

  async function updateDeadline(e: React.FormEvent) {
    e.preventDefault()
    if (!editId || !title || !dueDate) return
    setSaving(true)
    const res = await fetch("/api/deadlines", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editId,
        title,
        description,
        due_date: dueDate,
        control_id: controlId || null,
        assignee_ids: assigneeIds,
        priority
      })
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json()
      alert("Failed: " + (data.error || "Unknown"))
      return
    }
    resetForm()
    setEditId(null)
    setShowForm(false)
    loadData()
  }

  function resetForm() {
    setTitle("")
    setDescription("")
    setDueDate("")
    setControlId("")
    setAssigneeIds([])
    setPriority("Medium")
  }

  function startEdit(d: Deadline) {
    setEditId(d.id)
    setTitle(d.title)
    setDescription(d.description || "")
    setDueDate(new Date(d.due_date).toISOString().split("T")[0])
    setControlId(d.control?.id || "")
    setAssigneeIds(d.assignees.map(a => a.id))
    setPriority(d.priority)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch("/api/deadlines", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status })
    })
    if (res.ok) loadData()
  }

  async function deleteDeadline(id: string) {
    if (!confirm("Delete this deadline?")) return
    await fetch(`/api/deadlines?id=${id}`, { method: "DELETE" })
    loadData()
  }

  const isAdmin = currentUser?.role === "Admin"
  const isManager = currentUser?.role === "Manager" || isAdmin

  function statusBadge(status: string) {
    switch (status) {
      case "Completed": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      case "In_Progress": return "bg-blue-500/10 text-blue-400 border-blue-500/20"
      case "Overdue": return "bg-red-500/10 text-red-400 border-red-500/20"
      default: return "bg-white/10 text-gray-400 border-white/10"
    }
  }

  const now = new Date()
  const filtered = filter ? deadlines.filter(d => d.status === filter) : deadlines

  const upcoming = filtered.filter(d => new Date(d.due_date) >= now && d.status !== "Completed")
  const past = filtered.filter(d => new Date(d.due_date) < now || d.status === "Completed")
  const sorted = [...upcoming, ...past]

  return (
    <AppLayout>
      <div className="max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Schedules & Deadlines</h1>
            <p className="text-gray-500 mt-1">{deadlines.length} items</p>
          </div>
          <div className="flex gap-3">
            <select value={filter} onChange={e => setFilter(e.target.value)} className="border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm bg-white/5 text-white">
              <option value="">All Statuses</option>
              <option value="Scheduled">Scheduled</option>
              <option value="In_Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Overdue">Overdue</option>
            </select>
            {isManager && (
              <button onClick={() => { setShowForm(!showForm); if (editId) { resetForm(); setEditId(null); } }} className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2">
                <span>+</span> {showForm ? "Cancel" : "Add Deadline"}
              </button>
            )}
          </div>
        </div>

        {showForm && (
          <form onSubmit={editId ? updateDeadline : createDeadline} className="glass-card rounded-xl p-6 mb-6 animate-fade-in border border-white/10">
            <h2 className="text-lg font-bold text-white mb-4">{editId ? "Edit Schedule" : "Add Schedule / Deadline"}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)} className="w-full border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Due Date</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white" required />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full border border-white/10 rounded-lg px-4 py-2.5 h-20 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none bg-white/5 text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Linked Control (optional)</label>
                <select value={controlId} onChange={e => setControlId(e.target.value)} className="w-full border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white">
                  <option value="">None</option>
                  {controls.map((c: any) => <option key={c.id} value={c.id}>{c.control_id} — {c.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Priority</label>
                <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white">
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-400 mb-2">Assign To (multiple allowed)</label>
                <div className="flex flex-wrap gap-2">
                  {users.map(u => (
                    <label key={u.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm border transition-colors ${assigneeIds.includes(u.id) ? "bg-violet-500/10 border-violet-500/30 text-violet-400" : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"}`}>
                      <input
                        type="checkbox"
                        checked={assigneeIds.includes(u.id)}
                        onChange={e => {
                          if (e.target.checked) setAssigneeIds([...assigneeIds, u.id])
                          else setAssigneeIds(assigneeIds.filter(id => id !== u.id))
                        }}
                        className="w-4 h-4 accent-violet-600"
                      />
                      <span>{u.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-2.5 rounded-lg font-medium disabled:opacity-50">{saving ? "Saving..." : (editId ? "Save Changes" : "Add Deadline")}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); resetForm(); }} className="text-gray-500 hover:text-gray-300 px-4 py-2.5">Cancel</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-violet-600 border-t-transparent rounded-full"/></div>
        ) : (
          <div className="space-y-3">
            {sorted.map((d) => {
              const isOverdue = d.status === "Overdue" || (new Date(d.due_date) < now && d.status !== "Completed")
              const isAssigned = d.assignees.some(a => a.id === currentUser?.id)
              const canEditDeadline = isAdmin || d.creator.id === currentUser?.id
              return (
                <div key={d.id} className={`glass-card rounded-xl p-5 flex flex-col md:flex-row md:items-center gap-4 border border-white/10 ${isOverdue ? "border-l-4 border-l-red-500" : "border-l-4 border-l-violet-500"}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-white">{d.title}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge(d.status)}`}>{d.status.replace("_", " ")}</span>
                      {isAssigned && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">Assigned to You</span>}
                    </div>
                    {d.description && <p className="text-sm text-gray-400 mb-1">{d.description}</p>}
                    <div className="text-xs text-gray-500 flex flex-wrap gap-3 items-center">
                      <span>📅 Due: {new Date(d.due_date).toLocaleDateString()}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${d.priority === "Critical" ? "bg-red-500/10 text-red-400" : d.priority === "High" ? "bg-orange-500/10 text-orange-400" : d.priority === "Medium" ? "bg-yellow-500/10 text-yellow-400" : "bg-gray-500/10 text-gray-400"}`}>{d.priority}</span>
                      {d.control && <span>🔗 {d.control.control_id}</span>}
                    {d.control && <span>— {d.control.title}</span>}
                      {d.assignees.length > 0 && (
                        <span className="flex items-center gap-1">
                          👤 {d.assignees.map(a => a.name).join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select
                      value={d.status}
                      onChange={e => updateStatus(d.id, e.target.value)}
                      className="text-xs border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white"
                    >
                      <option value="Scheduled">Scheduled</option>
                      <option value="In_Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Overdue">Overdue</option>
                    </select>
                    {canEditDeadline && (
                      <>
                        <button onClick={() => startEdit(d)} className="text-gray-500 hover:text-gray-300 text-sm p-1" title="Edit">✏️</button>
                        <button onClick={() => deleteDeadline(d.id)} className="text-red-400 hover:text-red-300 text-sm p-1" title="Delete">🗑️</button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
            {sorted.length === 0 && (
              <div className="glass-card rounded-xl p-12 text-center text-gray-500 border border-white/10">
                No deadlines scheduled
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
