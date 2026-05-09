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
    Planning: "bg-white/5 text-gray-300",
    Active: "bg-blue-500/10 text-blue-400",
    On_Hold: "bg-amber-500/10 text-amber-400",
    Completed: "bg-emerald-500/10 text-emerald-400",
    Cancelled: "bg-red-500/10 text-red-400"
  }

  const priorityColors: Record<string, string> = {
    Low: "bg-white/5 text-gray-400",
    Medium: "bg-yellow-500/10 text-yellow-400",
    High: "bg-orange-500/10 text-orange-400",
    Critical: "bg-red-500/10 text-red-400"
  }

  return (
    <AppLayout title="Projects" subtitle="Active projects">
      <div className="max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Projects</h1>
            <p className="text-gray-500 mt-1">{projects.length} projects</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            {showForm ? "Cancel" : "+ New Project"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={createProject} className="glass-card rounded-xl p-6 mb-6 border border-white/10">
            <h3 className="font-bold text-white mb-4">Create Project</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                placeholder="Project name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white"
                required
              />
              <select
                value={formData.priority}
                onChange={e => setFormData({ ...formData, priority: e.target.value })}
                className="border border-white/10 rounded-lg px-4 py-2.5 bg-white/5 text-white"
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
                className="border border-white/10 rounded-lg px-4 py-2.5 bg-white/5 text-white"
                placeholder="Start date"
              />
              <input
                type="date"
                value={formData.end_date}
                onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                className="border border-white/10 rounded-lg px-4 py-2.5 bg-white/5 text-white"
                placeholder="End date"
              />
            </div>
            <textarea
              placeholder="Description"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-white/10 rounded-lg px-4 py-2.5 mt-4 h-20 resize-none bg-white/5 text-white"
            />
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-400 mb-2">Assign Members</label>
              <div className="flex flex-wrap gap-2">
                {users.map(u => (
                  <label key={u.id} className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg cursor-pointer border border-white/10">
                    <input
                      type="checkbox"
                      checked={memberIds.includes(u.id)}
                      onChange={e => {
                        if (e.target.checked) setMemberIds([...memberIds, u.id])
                        else setMemberIds(memberIds.filter(id => id !== u.id))
                      }}
                    />
                    <span className="text-sm text-gray-300">{u.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="mt-4 bg-violet-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-violet-500">
              Create Project
            </button>
          </form>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-violet-600 border-t-transparent rounded-full"/></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map(p => (
              <div key={p.id} className="glass-card rounded-xl p-5 hover:shadow-md transition-all border border-white/10">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-white text-lg">{p.name}</h3>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[p.status] || "bg-white/5 text-gray-300"}`}>
                    {p.status.replace("_", " ")}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mb-3 line-clamp-2">{p.description || "No description"}</p>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColors[p.priority] || "bg-white/5"}`}>
                    {p.priority}
                  </span>
                  <span className="text-xs text-gray-500">
                    {p.progress || 0}% complete
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {(p.members || []).slice(0, 3).map((m: any) => (
                      <div key={m.id} className="w-7 h-7 bg-violet-500/20 rounded-full flex items-center justify-center text-xs text-violet-300 border-2 border-[#0f0f1a]" title={m.user?.name}>
                        {m.user?.name?.charAt(0).toUpperCase() || "?"}
                      </div>
                    ))}
                    {(p.members || []).length > 3 && (
                      <div className="w-7 h-7 bg-white/5 rounded-full flex items-center justify-center text-xs text-gray-500 border-2 border-[#0f0f1a]">
                        +{(p.members || []).length - 3}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/projects/${p.id}`} className="text-violet-400 hover:text-violet-300 text-sm font-medium">
                      View →
                    </Link>
                    {(me?.role === "Admin" || p.created_by === me?.id) && (
                      <button onClick={() => deleteProject(p.id)} className="text-red-400 hover:text-red-300 text-sm">
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
