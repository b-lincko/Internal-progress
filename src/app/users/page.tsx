"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/AppLayout"

interface User {
  id: string
  name: string
  email: string
  role?: string
  created_at: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [showPwForm, setShowPwForm] = useState(false)
  const [pwTarget, setPwTarget] = useState<User | null>(null)
  const [newPw, setNewPw] = useState("")
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState("")
  const [pwSuccess, setPwSuccess] = useState("")
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("Viewer")
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setCurrentUser(d.user))
    loadUsers()
  }, [])

  async function loadUsers() {
    const res = await fetch("/api/users")
    const data = await res.json()
    setUsers(data.users || [])
    setLoading(false)
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role })
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(data.error || "Failed to create user")
      return
    }
    setShowForm(false)
    setName(""); setEmail(""); setPassword(""); setRole("Viewer")
    loadUsers()
  }

  async function deleteUser(id: string) {
    if (!confirm("Delete this user?")) return
    await fetch(`/api/users?id=${id}`, { method: "DELETE" })
    loadUsers()
  }

  function openPwForm(u: User) {
    setPwTarget(u)
    setNewPw("")
    setPwError("")
    setPwSuccess("")
    setShowPwForm(true)
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!pwTarget || !newPw) return
    if (newPw.length < 6) {
      setPwError("Password must be at least 6 characters")
      return
    }
    setPwSaving(true)
    setPwError("")
    const res = await fetch("/api/users/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: pwTarget.id, newPassword: newPw })
    })
    const data = await res.json()
    setPwSaving(false)
    if (!res.ok) {
      setPwError(data.error || "Failed to reset password")
      return
    }
    setPwSuccess(`Password reset for ${pwTarget.name}`)
    setNewPw("")
  }

  const isAdmin = currentUser?.role === "Admin"
  const isManager = currentUser?.role === "Manager" || isAdmin

  function roleBadge(role?: string) {
    switch (role) {
      case "Admin": return "bg-red-100 text-red-700 border-red-200"
      case "Manager": return "bg-blue-100 text-blue-700 border-blue-200"
      default: return "bg-slate-100 text-slate-600 border-slate-200"
    }
  }

  return (
    <AppLayout>
      <div className="max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Users</h1>
            <p className="text-slate-500 mt-1">{users.length} team members</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <span>+</span> Add User
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={createUser} className="bg-white rounded-xl shadow-sm p-6 mb-6 animate-fade-in">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Add New User</h2>
            {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">{error}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Name</label>
                <input value={name} onChange={e => setName(e.target.value)} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Role</label>
                <select value={role} onChange={e => setRole(e.target.value)} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="Viewer">Viewer</option>
                  <option value="Manager">Manager</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-2.5 rounded-lg font-medium disabled:opacity-500">{saving ? "Creating..." : "Create User"}</button>
              <button type="button" onClick={() => setShowForm(false)} className="text-slate-500 hover:text-slate-700 px-4 py-2.5">Cancel</button>
            </div>
          </form>
        )}

        {showPwForm && pwTarget && (
          <form onSubmit={resetPassword} className="bg-white rounded-xl shadow-sm p-6 mb-6 animate-fade-in border-2 border-amber-200">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Reset Password: {pwTarget.name}</h2>
            {pwError && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">{pwError}</div>}
            {pwSuccess && <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg mb-4 text-sm">{pwSuccess}</div>}
            <div className="flex gap-3">
              <input
                type="password"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="New password (min 6 chars)"
                className="flex-1 border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
              <button type="submit" disabled={pwSaving} className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2.5 rounded-lg font-medium disabled:opacity-50">{pwSaving ? "Saving..." : "Reset Password"}</button>
              <button type="button" onClick={() => setShowPwForm(false)} className="text-slate-500 hover:text-slate-700 px-4 py-2.5">Cancel</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"/></div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left p-4 text-sm font-semibold text-slate-500">Name</th>
                  <th className="text-left p-4 text-sm font-semibold text-slate-500">Email</th>
                  {isAdmin && <th className="text-left p-4 text-sm font-semibold text-slate-500">Role</th>}
                  <th className="text-left p-4 text-sm font-semibold text-slate-500">Joined</th>
                  <th className="text-left p-4 text-sm font-semibold text-slate-500"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/80">
                    <td className="p-4">
                      <div className="font-medium text-slate-800">{u.name}</div>
                    </td>
                    <td className="p-4 text-sm text-slate-600 font-mono">{u.email}</td>
                    {isAdmin && (
                      <td className="p-4">
                        {u.role ? (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${roleBadge(u.role)}`}>{u.role}</span>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </td>
                    )}
                    <td className="p-4 text-sm text-slate-500">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {isAdmin && u.id !== currentUser?.id && (
                          <>
                            <button onClick={() => openPwForm(u)} className="text-amber-500 hover:text-amber-700 text-sm font-medium" title="Reset password">🔑</button>
                            <button onClick={() => deleteUser(u.id)} className="text-red-400 hover:text-red-600 text-sm" title="Delete">🗑️</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className="p-12 text-center text-slate-400">No users found</div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
