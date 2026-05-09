"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { AppLayout } from "@/components/AppLayout"

export default function PoamDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [poam, setPoam] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [weakness, setWeakness] = useState("")
  const [remediation, setRemediation] = useState("")
  const [severity, setSeverity] = useState("Medium")
  const [status, setStatus] = useState("Open")
  const [dueDate, setDueDate] = useState("")

  useEffect(() => {
    if (!id) return
    fetch(`/api/poam?id=${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.poam) {
          setPoam(d.poam)
          setWeakness(d.poam.weakness || "")
          setRemediation(d.poam.remediation_plan || "")
          setSeverity(d.poam.severity || "Medium")
          setStatus(d.poam.status || "Open")
          setDueDate(d.poam.due_date ? d.poam.due_date.split("T")[0] : "")
        }
        setLoading(false)
      })
  }, [id])

  async function savePoam() {
    setSaving(true)
    await fetch("/api/poam", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, weakness, remediation_plan: remediation, severity, status, due_date: dueDate })
    })
    setSaving(false)
    setEditing(false)
    window.location.reload()
  }

  async function deletePoam() {
    if (!confirm("Delete this POA&M permanently?")) return
    setDeleting(true)
    await fetch(`/api/poam?id=${id}`, { method: "DELETE" })
    router.push("/poam")
  }

  function downloadPDF() {
    if (!poam) return
    const { jsPDF } = require("jspdf")
    const doc = new jsPDF()

    doc.setFontSize(20)
    doc.text("POA&M Report", 14, 20)
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28)

    doc.setFontSize(12)
    doc.text(`Control: ${poam.control?.control_id || "N/A"} - ${poam.control?.title || ""}`, 14, 40)

    let y = 55
    const addSection = (title: string, value: string) => {
      doc.setFontSize(11)
      doc.setFont(undefined, "bold")
      doc.text(title, 14, y)
      doc.setFont(undefined, "normal")
      doc.setFontSize(10)
      const lines = doc.splitTextToSize(value || "N/A", 180)
      doc.text(lines, 14, y + 6)
      y += 6 + lines.length * 5 + 8
    }

    addSection("Weakness / Finding:", poam.weakness)
    addSection("Remediation Plan:", poam.remediation_plan)
    addSection("Severity:", poam.severity)
    addSection("Status:", poam.status)
    addSection("Due Date:", new Date(poam.due_date).toLocaleDateString())

    doc.save(`POAM-${poam.control?.control_id || "report"}.pdf`)
  }

  function severityConfig(severity: string) {
    switch (severity) {
      case "Critical": return "bg-red-500/10 text-red-400 border-red-500/20"
      case "High": return "bg-orange-500/10 text-orange-400 border-orange-500/20"
      case "Medium": return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
      default: return "glass-card/5 text-gray-400 border-white/10"
    }
  }

  function statusConfig(status: string) {
    switch (status) {
      case "Completed": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      case "In_Progress": return "bg-blue-500/10 text-blue-400 border-blue-500/20"
      default: return "glass-card/5 text-gray-400 border-white/10"
    }
  }

  if (loading) return <AppLayout><div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-violet-600 border-t-transparent rounded-full"/></div></AppLayout>
  if (!poam) return <AppLayout><div className="text-center py-12 text-gray-500">POA&M not found</div></AppLayout>

  const isOverdue = new Date(poam.due_date) < new Date() && poam.status !== "Completed"

  return (
    <AppLayout>
      <div className="max-w-4xl">
        <div className="mb-6">
          <Link href="/poam" className="text-sm text-gray-500 hover:text-violet-400 transition-colors flex items-center gap-1">
            ← Back to POA&M Tracker
          </Link>
        </div>

        <div className="glass-card rounded-xl  p-8 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">
                Control: <Link href={`/controls/${poam.control_id}`} className="text-violet-400 hover:text-violet-300">{poam.control?.control_id}</Link>
              </div>
              <h1 className="text-2xl font-bold text-white">{poam.control?.title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-4 py-2 rounded-full text-sm font-bold border ${severityConfig(poam.severity)}`}>
                {poam.severity}
              </span>
              <span className={`px-4 py-2 rounded-full text-sm font-bold border ${statusConfig(poam.status)}`}>
                {poam.status?.replace("_", " ")}
              </span>
              {isOverdue && (
                <span className="px-4 py-2 rounded-full text-sm font-bold bg-red-500/10 text-red-400 border border-red-200">
                  ⚠️ OVERDUE
                </span>
              )}
            </div>
          </div>

          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Weakness / Finding</label>
                <textarea value={weakness} onChange={e => setWeakness(e.target.value)} className="w-full border border-white/10 rounded-lg px-4 py-2.5 h-24 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Remediation Plan</label>
                <textarea value={remediation} onChange={e => setRemediation(e.target.value)} className="w-full border border-white/10 rounded-lg px-4 py-2.5 h-24 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Severity</label>
                  <select value={severity} onChange={e => setSeverity(e.target.value)} className="w-full border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value)} className="w-full border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <option value="Open">Open</option>
                    <option value="In_Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Due Date</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={savePoam} disabled={saving} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-500/100 transition-colors disabled:opacity-50">
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button onClick={() => setEditing(false)} className="px-4 py-2 glass-card/10 text-gray-400 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-2">Weakness / Finding</h3>
                <p className="text-gray-400 leading-relaxed">{poam.weakness}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-2">Remediation Plan</h3>
                <p className="text-gray-400 leading-relaxed">{poam.remediation_plan}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card/5 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">Severity</div>
                  <div className="font-medium text-gray-400">{poam.severity}</div>
                </div>
                <div className="glass-card/5 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">Status</div>
                  <div className="font-medium text-gray-400">{poam.status?.replace("_", " ")}</div>
                </div>
                <div className={`rounded-lg p-4 ${isOverdue ? "bg-red-500/10" : "glass-card/5"}`}>
                  <div className="text-xs text-gray-500 mb-1">Due Date</div>
                  <div className={`font-medium ${isOverdue ? "text-red-400" : "text-gray-400"}`}>
                    {new Date(poam.due_date).toLocaleDateString()}
                    {isOverdue && " (Overdue)"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          {!editing && (
            <>
              <button onClick={() => setEditing(true)} className="px-4 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-500/100 transition-colors">
                ✏️ Edit
              </button>
              <button onClick={downloadPDF} className="px-4 py-2.5 glass-card/10 text-gray-400 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors border border-white/10">
                📄 Download PDF
              </button>
            </>
          )}
          <button onClick={deletePoam} disabled={deleting} className="px-4 py-2.5 bg-red-500/10 text-red-400 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors border border-red-200 ml-auto">
            {deleting ? "Deleting..." : "🗑️ Delete"}
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
