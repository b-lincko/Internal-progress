"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/AppLayout"

export default function AdminPage() {
  const [user, setUser] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [controls, setControls] = useState<any[]>([])
  const [deadlines, setDeadlines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      setUser(d.user)
      if (d.user?.role === "Admin") loadData()
    })
  }, [])

  async function loadData() {
    const [uRes, cRes, dRes] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/controls"),
      fetch("/api/deadlines")
    ])
    const [uData, cData, dData] = await Promise.all([uRes.json(), cRes.json(), dRes.json()])
    setUsers(uData.users || [])
    setControls(cData.controls || [])
    setDeadlines(dData.deadlines || [])
    setLoading(false)
  }

  async function changeRole(userId: string, newRole: string) {
    await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: userId, role: newRole })
    })
    loadData()
  }

  if (!user) return <AppLayout><div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"/></div></AppLayout>
  if (user.role !== "Admin") return (
    <AppLayout>
      <div className="max-w-xl bg-red-50 border border-red-200 rounded-xl p-8 text-center">
        <div className="text-4xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-red-800 mb-2">Access Denied</h1>
        <p className="text-red-600">This page is restricted to Admin users only.</p>
      </div>
    </AppLayout>
  )

  const implPct = controls.length > 0 ? Math.round((controls.filter((c: any) => c.status === "Implemented").length / controls.length) * 100) : 0
  const overdue = deadlines.filter((d: any) => new Date(d.due_date) < new Date() && d.status !== "Completed").length

  return (
    <AppLayout>
      <div className="max-w-5xl">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Admin Control Panel</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-3xl font-bold text-slate-900">{users.length}</div>
            <div className="text-sm text-slate-500 mt-1">Total Users</div>
            <div className="text-xs text-slate-400 mt-1">{users.filter((u: any) => u.role === "Admin").length} Admins, {users.filter((u: any) => u.role === "Manager").length} Managers</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-3xl font-bold text-slate-900">{controls.length}</div>
            <div className="text-sm text-slate-500 mt-1">Controls</div>
            <div className="text-xs text-slate-400 mt-1">{implPct}% Implemented</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-3xl font-bold text-slate-900">{deadlines.length}</div>
            <div className="text-sm text-slate-500 mt-1">Deadlines</div>
            <div className="text-xs text-red-500 mt-1">{overdue} Overdue</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-3xl font-bold text-slate-900">{users.filter((u: any) => {
              const d = new Date(u.created_at)
              const now = new Date()
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
            }).length}</div>
            <div className="text-sm text-slate-500 mt-1">New This Month</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">User Role Management</h2>
          {loading ? (
            <div className="flex items-center justify-center h-32"><div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"/></div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left p-4 text-sm font-semibold text-slate-500">Name</th>
                  <th className="text-left p-4 text-sm font-semibold text-slate-500">Email</th>
                  <th className="text-left p-4 text-sm font-semibold text-slate-500">Role</th>
                  <th className="text-left p-4 text-sm font-semibold text-slate-500">Change Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id} className="border-b border-slate-50">
                    <td className="p-4 font-medium text-slate-800">{u.name}</td>
                    <td className="p-4 text-sm text-slate-600">{u.email}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                        u.role === "Admin" ? "bg-red-100 text-red-700 border-red-200" :
                        u.role === "Manager" ? "bg-blue-100 text-blue-700 border-blue-200" :
                        "bg-slate-100 text-slate-600 border-slate-200"
                      }`}>{u.role}</span>
                    </td>
                    <td className="p-4">
                      {u.id !== user.id && (
                        <select
                          value={u.role}
                          onChange={e => changeRole(u.id, e.target.value)}
                          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="Viewer">Viewer</option>
                          <option value="Manager">Manager</option>
                          <option value="Admin">Admin</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Access Control Reference</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { role: "Admin", color: "border-red-300", bg: "bg-red-50", perms: ["Full access", "Create/delete users", "Reset passwords", "Edit all controls", "Upload/delete documents", "Admin panel"] },
              { role: "Manager", color: "border-blue-300", bg: "bg-blue-50", perms: ["Edit controls", "Create deadlines", "Upload documents", "View all pages", "Cannot delete users"] },
              { role: "Viewer", color: "border-slate-300", bg: "bg-slate-50", perms: ["View only", "Cannot edit controls", "Cannot upload files", "Can chat", "Cannot access admin"] },
            ].map(r => (
              <div key={r.role} className={`border ${r.color} ${r.bg} rounded-xl p-4`}>
                <div className="font-bold text-slate-900 mb-2">{r.role}</div>
                <ul className="space-y-1">
                  {r.perms.map((p, i) => <li key={i} className="text-sm text-slate-600 flex items-center gap-2"><span>✓</span>{p}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
