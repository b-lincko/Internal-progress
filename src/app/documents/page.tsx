"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/AppLayout"

type DocType = "File" | "Text" | "Link"

interface Document {
  id: string
  title: string
  content: string | null
  file_name: string | null
  file_path: string | null
  doc_type: DocType
  uploaded_at: string
  updated_at: string
  is_global: boolean
  user: { name: string; email: string }
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [docType, setDocType] = useState<DocType>("File")
  const [uploading, setUploading] = useState(false)
  const [editDoc, setEditDoc] = useState<Document | null>(null)

  // Form states
  const [title, setTitle] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [content, setContent] = useState("")
  const [isGlobal, setIsGlobal] = useState(false)

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setCurrentUser(d.user))
    loadDocs()
  }, [])

  async function loadDocs() {
    const res = await fetch("/api/documents")
    const data = await res.json()
    setDocs(data.documents || [])
    setLoading(false)
  }

  async function createDocument(e: React.FormEvent) {
    e.preventDefault()
    if (!title || !currentUser) return
    setUploading(true)

    let fileName = null
    let filePath = null

    if (docType === "File" && file) {
      const formData = new FormData()
      formData.append("file", file)
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) {
        alert("Upload failed: " + (uploadData.error || "Unknown"))
        setUploading(false)
        return
      }
      fileName = uploadData.file_name
      filePath = uploadData.file_path
    }

    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        content: docType === "Text" ? content : null,
        file_name: fileName,
        file_path: filePath,
        uploaded_by: currentUser.id,
        is_global: isGlobal,
        doc_type: docType
      })
    })
    const data = await res.json()
    setUploading(false)

    if (!res.ok) {
      alert("Failed: " + (data.error || "Unknown"))
      return
    }

    resetForm()
    setShowForm(false)
    loadDocs()
  }

  async function updateDocument(e: React.FormEvent) {
    e.preventDefault()
    if (!editDoc || !title) return
    setUploading(true)

    const res = await fetch("/api/documents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editDoc.id,
        title,
        content: docType === "Text" ? content : null,
        is_global: isGlobal,
        doc_type: docType
      })
    })
    setUploading(false)
    if (res.ok) {
      setEditDoc(null)
      resetForm()
      loadDocs()
    }
  }

  function resetForm() {
    setTitle("")
    setContent("")
    setFile(null)
    setIsGlobal(false)
    setDocType("File")
  }

  function startEdit(doc: Document) {
    setEditDoc(doc)
    setTitle(doc.title)
    setContent(doc.content || "")
    setIsGlobal(doc.is_global)
    setDocType(doc.doc_type)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function deleteDoc(id: string) {
    if (!confirm("Delete this document?")) return
    await fetch(`/api/documents?id=${id}`, { method: "DELETE" })
    loadDocs()
  }

  const isAdmin = currentUser?.role === "Admin"
  const isManager = currentUser?.role === "Manager" || isAdmin

  const filtered = docs

  return (
    <AppLayout>
      <div className="max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Documents</h1>
            <p className="text-slate-500 mt-1">{docs.length} documents</p>
          </div>
          {isManager && (
            <button
              onClick={() => { setShowForm(!showForm); if (editDoc) { setEditDoc(null); resetForm(); } }}
              className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
            >
              {showForm ? "Cancel" : "+ New Document"}
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={editDoc ? updateDocument : createDocument} className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">{editDoc ? "Edit Document" : "New Document"}</h2>

            <div className="flex gap-2 mb-4">
              {["File", "Text", "Link"].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDocType(t as DocType)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${docType === t ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Title</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>

              {docType === "File" && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">File{editDoc?.file_name && ` (current: ${editDoc.file_name})`}</label>
                  <input
                    type="file"
                    onChange={e => setFile(e.target.files?.[0] || null)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
                    required={!editDoc}
                  />
                </div>
              )}

              {docType === "Text" && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Content</label>
                  <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 h-40 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    placeholder="Enter document content..."
                    required
                  />
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isGlobal}
                  onChange={e => setIsGlobal(e.target.checked)}
                  className="w-4 h-4 accent-primary-600"
                />
                <span className="text-sm text-slate-600">Make available to all users</span>
              </label>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                type="submit"
                disabled={uploading}
                className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-2.5 rounded-lg font-medium disabled:opacity-50"
              >
                {uploading ? "Saving..." : (editDoc ? "Save Changes" : "Create Document")}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditDoc(null); resetForm(); }}
                className="text-slate-500 hover:text-slate-700 px-4 py-2.5"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((d) => (
              <div key={d.id} className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-900">{d.title}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        d.doc_type === "Text" ? "bg-purple-100 text-purple-700" :
                        d.doc_type === "Link" ? "bg-blue-100 text-blue-700" :
                        "bg-emerald-100 text-emerald-700"
                      }`}>
                        {d.doc_type}
                      </span>
                      {d.is_global && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-600">Global</span>}
                    </div>
                    <div className="text-xs text-slate-400 mb-2">
                      by {d.user?.name || "—"} • {new Date(d.uploaded_at).toLocaleDateString()}
                    </div>

                    {d.doc_type === "Text" && d.content && (
                      <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 max-h-32 overflow-y-auto">
                        {d.content}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {d.file_path && (
                      <>
                        <a
                          href={`/api${d.file_path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition-colors"
                        >
                          👁 View
                        </a>
                        <a
                          href={`/api${d.file_path}`}
                          download={d.file_name || "download"}
                          className="px-3 py-1.5 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-lg text-xs font-medium transition-colors"
                        >
                          ⬇ Download
                        </a>
                      </>
                    )}
                    {isManager && (
                      <>
                        <button
                          onClick={() => startEdit(d)}
                          className="text-slate-400 hover:text-slate-600 text-sm p-1"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deleteDoc(d.id)}
                          className="text-red-400 hover:text-red-600 text-sm p-1"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center text-slate-400">No documents yet</div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
