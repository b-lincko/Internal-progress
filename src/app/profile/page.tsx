"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/AppLayout"

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setUser(d.user))
  }, [])

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setMessage("")

    if (!currentPassword || !newPassword) {
      setError("All fields are required")
      return
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setSaving(true)
    const res = await fetch("/api/users/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, currentPassword, newPassword })
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(data.error || "Failed to change password")
      return
    }

    setMessage("Password changed successfully!")
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
  }

  if (!user) return <AppLayout><div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-violet-600 border-t-transparent rounded-full"/></div></AppLayout>

  return (
    <AppLayout>
      <div className="max-w-xl">
        <h1 className="text-3xl font-bold text-white mb-8">My Profile</h1>

        <div className="glass-card rounded-xl  p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">Account Info</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-violet-500/10 rounded-full flex items-center justify-center text-violet-400 text-xl font-bold">
                {user.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div>
                <div className="font-medium text-white">{user.name}</div>
                <div className="text-sm text-gray-500">{user.email}</div>
              </div>
            </div>
            <div className="text-sm text-gray-400">
              <span className="font-medium">Role:</span> {user.role}
            </div>
          </div>
        </div>

        <div className="glass-card rounded-xl  p-6">
          <h2 className="text-lg font-bold text-white mb-4">Change Password</h2>
          {message && <div className="bg-emerald-500/10 text-emerald-400 p-3 rounded-lg mb-4 text-sm animate-fade-in">{message}</div>}
          {error && <div className="bg-red-500/10 text-red-400 p-3 rounded-lg mb-4 text-sm">{error}</div>}
          <form onSubmit={changePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Current Password</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500" required />
            </div>
            <button type="submit" disabled={saving} className="bg-violet-600 hover:bg-violet-500/100 text-white px-6 py-2.5 rounded-lg font-medium disabled:opacity-50">
              {saving ? "Changing..." : "Change Password"}
            </button>
          </form>
        </div>
      </div>
    </AppLayout>
  )
}
