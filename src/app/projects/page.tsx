"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { AppLayout } from "@/components/AppLayout"

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    priority: "Medium",
    status: "Planning",
    start_date: "",
    end_date: ""
  })
  const [memberIds, setMemberIds] = useState<string[]>([])

  useEffect(() => {
    loadProjects()
    fetch("/api/auth/me").then(r => r.json()).then(d => setMe(d.user))
    fetch("/api/users").then(r => r.json()).then(d => setUsers(d.users || []))
  }, [])

  async function loadProjects() {
    const res = await fetch("/api/projects")
    const data = await res.json()
    setProjects(data.projects || [])
    setLoading(false)
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault()
    if (!me) return
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formData,
        created_by: me.id,
        member_ids: memberIds
      })
    })
    if (res.ok) {
      setShowForm(false)
      setFormData({ name: "", description: "", priority: "Medium", status: "Planning", start_date: "", end_date: "" })
      setMemberIds([])
      loadProjects()
    }
  }

  async function deleteProject(id: string) {
    if (!confirm("Delete this project?")) return
    await fetch(`/api/projects/${id}`, { method: "DELETE" })
    loadProjects()
  }

  const statusColors: Record<string, string> = {
    Planning: "bg-slate-100 text-slate-700",
    Active: "bg-blue-100 text-blue-700",
    On_Hold: "bg-amber-100 text-amber-700",
    Completed: "bg-emerald-100 text-emerald-700",
    Cancelled: "bg-red-100 text-red-700"
  }

  const priorityColors: Record<string, string> = {
    Low: "bg-gray-100 text-gray-600",
    Medium: "bg-yellow-100 text-yellow-700",
    High: "bg-orange-100 text-orange-700",
    Critical: "bg-red-100 text-red-700"
  }

  return (
    <AppLayout>
      <div className="max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Projects</h1>
            <p className="text-slate-500 mt-1">{projects.length} projects</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            {showForm ? "Cancel" : "+ New Project"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={createProject} className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="font-bold text-slate-900 mb-4">Create Project</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                placeholder="Project name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
              <select
                value={formData.priority}
                onChange={e => setFormData({ ...formData, priority: e.target.value })}
                className="border border-slate-200 rounded-lg px-4 py-2.5"
              >
                <option value="Low">Low Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="High">High Priority</option>
                <option value="Critical">Critical</option>
              </select>
              <input
                type="date"
                value={formData.start_date}
                onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                className="border border-slate-200 rounded-lg px-4 py-2.5"
                placeholder="Start date"
              />
              <input
                type="date"
                value={formData.end_date}
                onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                className="border border-slate-200 rounded-lg px-4 py-2.5"
                placeholder="End date"
              />
            </div>
            <textarea
              placeholder="Description"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 mt-4 h-20 resize-none"
            />
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-600 mb-2">Assign Members</label>
              <div className="flex flex-wrap gap-2">
                {users.map(u => (
                  <label key={u.id} className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={memberIds.includes(u.id)}
                      onChange={e => {
                        if (e.target.checked) setMemberIds([...memberIds, u.id])
                        else setMemberIds(memberIds.filter(id => id !== u.id))
                      }}
                    />
                    <span className="text-sm">{u.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="mt-4 bg-primary-600 text-white px-6 py-2.5 rounded-lg font-medium">
              Create Project
            </button>
          </form>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"/></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map(p => (
              <div key={p.id} className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-slate-900 text-lg">{p.name}</h3>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[p.status] || "bg-slate-100"}`}>
                    {p.status.replace("_", " ")}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mb-3 line-clamp-2">{p.description || "No description"}</p>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColors[p.priority] || "bg-gray-100"}`}>
                    {p.priority}
                  </span>
                  <span className="text-xs text-slate-400">
                    {p.progress || 0}% complete
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {(p.members || []).slice(0, 3).map((m: any) => (
                      <div key={m.id} className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center text-xs text-primary-700 border-2 border-white" title={m.user?.name}>
                        {m.user?.name?.charAt(0).toUpperCase() || "?"}
                      </div>
                    ))}
                    {(p.members || []).length > 3 && (
                      <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-xs text-slate-500 border-2 border-white">
                        +{(p.members || []).length - 3}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/projects/${p.id}`} className="text-primary-600 hover:text-primary-800 text-sm font-medium">
                      View →
                    </Link>
                    {(me?.role === "Admin" || p.created_by === me?.id) && (
                      <button onClick={() => deleteProject(p.id)} className="text-red-400 hover:text-red-600 text-sm">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
