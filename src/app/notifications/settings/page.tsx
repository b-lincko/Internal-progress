"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/AppLayout"

export default function NotificationSettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d.user) {
        setUser(d.user)
        loadSettings(d.user.id)
      }
    })
  }, [])

  async function loadSettings(userId: string) {
    const res = await fetch(`/api/notifications/settings?userId=${userId}`)
    const data = await res.json()
    setSettings(data.settings || {})
    setLoading(false)
  }

  async function saveSettings() {
    if (!user) return
    setSaving(true)
    await fetch("/api/notifications/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, ...settings })
    })
    setSaving(false)
    alert("Settings saved!")
  }

  function toggle(key: string) {
    setSettings((prev: any) => ({ ...prev, [key]: !prev?.[key] }))
  }

  const options = [
    { key: "email_notifications", label: "Email Notifications", desc: "Receive notifications via email" },
    { key: "push_notifications", label: "Push Notifications", desc: "Browser push notifications" },
    { key: "notify_chat", label: "Chat Messages", desc: "New messages in team chat" },
    { key: "notify_schedules", label: "Schedules & Deadlines", desc: "Deadline reminders and schedule updates" },
    { key: "notify_documents", label: "Documents", desc: "New documents and file uploads" },
    { key: "notify_projects", label: "Projects", desc: "Project updates and task assignments" },
    { key: "notify_mentions", label: "Mentions", desc: "When someone mentions you" },
    { key: "notify_alerts", label: "Security Alerts", desc: "Critical security alerts and warnings" },
    { key: "notify_calls", label: "Calls", desc: "Incoming voice/video calls" },
    { key: "notify_system", label: "System Messages", desc: "System maintenance and general announcements" },
  ]

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-2xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Notification Settings</h1>
            <p className="text-slate-500 mt-1">Choose what you want to be notified about</p>
          </div>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Notification Settings</h1>
          <p className="text-slate-500 mt-1">Choose what you want to be notified about</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="p-4 bg-slate-50 border-b border-slate-100">
            <h2 className="font-semibold text-slate-700">Notification Channels</h2>
          </div>
          {options.slice(0, 2).map(opt => (
            <div key={opt.key} className="p-4 border-b border-slate-100 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
              <div>
                <div className="font-medium text-slate-800">{opt.label}</div>
                <div className="text-sm text-slate-400">{opt.desc}</div>
              </div>
              <button
                onClick={() => toggle(opt.key)}
                className={`w-12 h-6 rounded-full transition-colors relative ${settings?.[opt.key] ? "bg-primary-600" : "bg-slate-200"}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${settings?.[opt.key] ? "translate-x-6" : "translate-x-0.5"}`} />
              </button>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="p-4 bg-slate-50 border-b border-slate-100">
            <h2 className="font-semibold text-slate-700">Notification Types</h2>
          </div>
          {options.slice(2).map(opt => (
            <div key={opt.key} className="p-4 border-b border-slate-100 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
              <div>
                <div className="font-medium text-slate-800">{opt.label}</div>
                <div className="text-sm text-slate-400">{opt.desc}</div>
              </div>
              <button
                onClick={() => toggle(opt.key)}
                className={`w-12 h-6 rounded-full transition-colors relative ${settings?.[opt.key] ? "bg-primary-600" : "bg-slate-200"}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${settings?.[opt.key] ? "translate-x-6" : "translate-x-0.5"}`} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-500 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
