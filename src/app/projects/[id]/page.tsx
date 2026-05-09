"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { AppLayout } from "@/components/AppLayout"

export default function ProjectDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [project, setProject] = useState<any>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [taskData, setTaskData] = useState({ title: "", description: "", priority: "Medium", status: "Todo", assigned_to: "", due_date: "" })
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState<any>({})
  const [memberIds, setMemberIds] = useState<string[]>([])

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setMe(d.user))
    loadProject()
    fetch("/api/users").then(r => r.json()).then(d => setUsers(d.users || []))
  }, [id])

  async function loadProject() {
    const res = await fetch(`/api/projects/${id}`)
    const data = await res.json()
    if (res.ok) {
      setProject(data.project)
      setTasks(data.project?.tasks || [])
      setEditData(data.project)
      setMemberIds(data.project?.members?.map((m: any) => m.user_id) || [])
    }
    setLoading(false)
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault()
    await fetch(`/api/projects/${id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(taskData)
    })
    setShowTaskForm(false)
    setTaskData({ title: "", description: "", priority: "Medium", status: "Todo", assigned_to: "", due_date: "" })
    loadProject()
  }

  async function updateProject(e: React.FormEvent) {
    e.preventDefault()
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editData, member_ids: memberIds })
    })
    setEditMode(false)
    loadProject()
  }

  async function deleteProject() {
    if (!confirm("Delete this project?")) return
    await fetch(`/api/projects/${id}`, { method: "DELETE" })
    router.push("/projects")
  }

  async function deleteTask(taskId: string) {
    if (!confirm("Delete this task?")) return
    await fetch(`/api/projects/${id}/tasks?taskId=${taskId}`, { method: "DELETE" })
    loadProject()
  }

  async function updateTask(taskId: string, status: string) {
    await fetch(`/api/projects/${id}/tasks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, status })
    })
    loadProject()
  }

  const isAdmin = me?.role === "Admin"
  const isCreator = project?.created_by === me?.id
  const isMember = project?.members?.some((m: any) => m.user_id === me?.id)
  const canEdit = isAdmin || isCreator

  const statusColors: Record<string, string> = {
    Planning: "glass-card/10 text-gray-400",
    Active: "bg-blue-500/10 text-blue-400",
    On_Hold: "bg-amber-100 text-amber-400",
    Completed: "bg-emerald-100 text-emerald-400",
    Cancelled: "bg-red-100 text-red-400"
  }

  const taskStatusColors: Record<string, string> = {
    Todo: "glass-card/10 text-gray-400",
    In_Progress: "bg-blue-500/10 text-blue-400",
    Review: "bg-purple-100 text-purple-700",
    Done: "bg-emerald-100 text-emerald-400"
  }

  const priorityColors: Record<string, string> = {
    Low: "bg-white/10 text-gray-400",
    Medium: "bg-yellow-100 text-yellow-700",
    High: "bg-orange-100 text-orange-700",
    Critical: "bg-red-100 text-red-400"
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-violet-600 border-t-transparent rounded-full" />
        </div>
      </AppLayout>
    )
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="text-center py-12 text-gray-500">Project not found</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-white">{project.name}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[project.status] || "glass-card/10"}`}>
                {project.status?.replace("_", " ")}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${priorityColors[project.priority] || "bg-gray-100"}`}>
                {project.priority}
              </span>
            </div>
            <p className="text-gray-500">{project.description || "No description"}</p>
          </div>
          <div className="flex gap-2">
            {canEdit && (
              <>
                <button onClick={() => setEditMode(!editMode)} className="text-gray-500 hover:text-gray-400 px-3 py-2">
                  {editMode ? "Cancel" : "Edit"}
                </button>
                <button onClick={deleteProject} className="text-red-400 hover:text-red-400 px-3 py-2">
                  Delete
                </button>
              </>
            )}
          </div>
        </div>

        {editMode && (
          <form onSubmit={updateProject} className="glass-card rounded-xl  p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <input
                value={editData.name}
                onChange={e => setEditData({ ...editData, name: e.target.value })}
                className="border border-white/10 rounded-lg px-4 py-2.5"
                placeholder="Project name"
              />
              <select
                value={editData.status}
                onChange={e => setEditData({ ...editData, status: e.target.value })}
                className="border border-white/10 rounded-lg px-4 py-2.5"
              >
                <option value="Planning">Planning</option>
                <option value="Active">Active</option>
                <option value="On_Hold">On Hold</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <select
                value={editData.priority}
                onChange={e => setEditData({ ...editData, priority: e.target.value })}
                className="border border-white/10 rounded-lg px-4 py-2.5"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
              <input
                type="date"
                value={editData.start_date?.split("T")[0] || ""}
                onChange={e => setEditData({ ...editData, start_date: e.target.value })}
                className="border border-white/10 rounded-lg px-4 py-2.5"
              />
              <input
                type="date"
                value={editData.end_date?.split("T")[0] || ""}
                onChange={e => setEditData({ ...editData, end_date: e.target.value })}
                className="border border-white/10 rounded-lg px-4 py-2.5"
              />
            </div>
            <textarea
              value={editData.description || ""}
              onChange={e => setEditData({ ...editData, description: e.target.value })}
              className="w-full border border-white/10 rounded-lg px-4 py-2.5 h-20 resize-none mb-4"
              placeholder="Description"
            />
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-400 mb-2">Members</label>
              <div className="flex flex-wrap gap-2">
                {users.map(u => (
                  <label key={u.id} className="flex items-center gap-2 glass-card/5 px-3 py-1.5 rounded-lg cursor-pointer">
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
            <button type="submit" className="bg-violet-600 text-white px-6 py-2.5 rounded-lg font-medium">
              Save Changes
            </button>
          </form>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="glass-card rounded-xl  p-5">
            <div className="text-sm text-gray-500 mb-1">Progress</div>
            <div className="text-2xl font-bold text-white">{project.progress || 0}%</div>
            <div className="w-full glass-card/10 rounded-full h-2 mt-2">
              <div className="bg-violet-600 h-2 rounded-full transition-all" style={{ width: `${project.progress || 0}%` }} />
            </div>
          </div>
          <div className="glass-card rounded-xl  p-5">
            <div className="text-sm text-gray-500 mb-1">Tasks</div>
            <div className="text-2xl font-bold text-white">{tasks.length}</div>
            <div className="text-sm text-gray-500">{tasks.filter((t: any) => t.status === "Done").length} completed</div>
          </div>
          <div className="glass-card rounded-xl  p-5">
            <div className="text-sm text-gray-500 mb-1">Members</div>
            <div className="flex -space-x-2 mt-2">
              {project.members?.map((m: any) => (
                <div key={m.id} className="w-8 h-8 bg-violet-500/10 rounded-full flex items-center justify-center text-xs text-violet-400 border-2 border-white" title={m.user?.name}>
                  {m.user?.name?.charAt(0).toUpperCase() || "?"}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-card rounded-xl ">
          <div className="flex items-center justify-between p-5 border-b border-white/5">
            <h2 className="font-bold text-white">Tasks</h2>
            {(canEdit || isMember) && (
              <button onClick={() => setShowTaskForm(!showTaskForm)} className="bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                {showTaskForm ? "Cancel" : "+ Add Task"}
              </button>
            )}
          </div>

          {showTaskForm && (
            <form onSubmit={createTask} className="p-5 border-b border-white/5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input
                  placeholder="Task title"
                  value={taskData.title}
                  onChange={e => setTaskData({ ...taskData, title: e.target.value })}
                  className="border border-white/10 rounded-lg px-4 py-2.5"
                  required
                />
                <select
                  value={taskData.priority}
                  onChange={e => setTaskData({ ...taskData, priority: e.target.value })}
                  className="border border-white/10 rounded-lg px-4 py-2.5"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
                <select
                  value={taskData.assigned_to}
                  onChange={e => setTaskData({ ...taskData, assigned_to: e.target.value })}
                  className="border border-white/10 rounded-lg px-4 py-2.5"
                >
                  <option value="">Unassigned</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <input
                  type="date"
                  value={taskData.due_date}
                  onChange={e => setTaskData({ ...taskData, due_date: e.target.value })}
                  className="border border-white/10 rounded-lg px-4 py-2.5"
                />
              </div>
              <textarea
                placeholder="Description"
                value={taskData.description}
                onChange={e => setTaskData({ ...taskData, description: e.target.value })}
                className="w-full border border-white/10 rounded-lg px-4 py-2.5 h-20 resize-none mb-4"
              />
              <button type="submit" className="bg-violet-600 text-white px-6 py-2.5 rounded-lg font-medium">
                Create Task
              </button>
            </form>
          )}

          <div className="divide-y divide-white/5">
            {tasks.length === 0 && (
              <div className="p-8 text-center text-gray-500">No tasks yet</div>
            )}
            {tasks.map((task: any) => (
              <div key={task.id} className="p-5 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-white">{task.title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${taskStatusColors[task.status] || "glass-card/10"}`}>
                      {task.status?.replace("_", " ")}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${priorityColors[task.priority] || "bg-gray-100"}`}>
                      {task.priority}
                    </span>
                  </div>
                  {task.description && <p className="text-sm text-gray-500 mb-1">{task.description}</p>}
                  <div className="text-xs text-gray-500 flex gap-3">
                    {task.assigned_to && (
                      <span>👤 {users.find(u => u.id === task.assigned_to)?.name || "Unknown"}</span>
                    )}
                    {task.due_date && <span>📅 {new Date(task.due_date).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={task.status}
                    onChange={e => updateTask(task.id, e.target.value)}
                    className="text-xs border border-white/10 rounded-lg px-3 py-2"
                  >
                    <option value="Todo">Todo</option>
                    <option value="In_Progress">In Progress</option>
                    <option value="Review">Review</option>
                    <option value="Done">Done</option>
                  </select>
                  {canEdit && (
                    <button onClick={() => deleteTask(task.id)} className="text-red-400 hover:text-red-400 text-sm p-1">
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
