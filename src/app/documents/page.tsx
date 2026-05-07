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
  folder_id: string | null
  user: { id: string; name: string; email: string }
  folder?: { id: string; name: string } | null
  access?: { id: string; user_id: string; access_level: string; user: { name: string } }[]
  _count?: { auditLogs: number }
}

interface Folder {
  id: string
  name: string
  parent_id: string | null
  created_at: string
  user: { id: string; name: string }
  documentCount: number
}

interface AuditLog {
  id: string
  action: string
  details: string | null
  created_at: string
  user: { id: string; name: string }
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [folderPath, setFolderPath] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)

  // Create forms
  const [showDocForm, setShowDocForm] = useState(false)
  const [showFolderForm, setShowFolderForm] = useState(false)
  const [docType, setDocType] = useState<DocType>("File")
  const [uploading, setUploading] = useState(false)
  const [editDoc, setEditDoc] = useState<Document | null>(null)

  // Form states
  const [title, setTitle] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [content, setContent] = useState("")
  const [isGlobal, setIsGlobal] = useState(false)
  const [folderName, setFolderName] = useState("")
  const [formError, setFormError] = useState("")

  // ACL panel
  const [aclDoc, setAclDoc] = useState<Document | null>(null)
  const [aclUsers, setAclUsers] = useState<any[]>([])
  const [aclList, setAclList] = useState<any[]>([])
  const [aclUserId, setAclUserId] = useState("")
  const [aclLevel, setAclLevel] = useState("Read")

  // Audit panel
  const [auditDoc, setAuditDoc] = useState<Document | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setCurrentUser(d.user))
    loadFolders()
    loadDocs()
  }, [currentFolderId])

  async function loadFolders() {
    const res = await fetch(`/api/documents/folders?parentId=${currentFolderId || ""}`)
    const data = await res.json()
    setFolders(data.folders || [])
  }

  async function loadDocs() {
    const res = await fetch(`/api/documents?folderId=${currentFolderId || ""}`)
    const data = await res.json()
    setDocs(data.documents || [])
    setLoading(false)
  }

  async function createFolder(e: React.FormEvent) {
    e.preventDefault()
    if (!folderName) return
    const res = await fetch("/api/documents/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: folderName, parent_id: currentFolderId })
    })
    if (res.ok) {
      setFolderName("")
      setShowFolderForm(false)
      loadFolders()
    }
  }

  async function deleteFolder(id: string) {
    if (!confirm("Delete this folder and all its contents?")) return
    await fetch(`/api/documents/folders?id=${id}`, { method: "DELETE" })
    loadFolders()
    loadDocs()
  }

  function enterFolder(folder: Folder) {
    setCurrentFolderId(folder.id)
    setFolderPath([...folderPath, folder])
    setLoading(true)
  }

  function navigateToFolder(index: number) {
    if (index === -1) {
      setCurrentFolderId(null)
      setFolderPath([])
    } else {
      const newPath = folderPath.slice(0, index + 1)
      setFolderPath(newPath)
      setCurrentFolderId(newPath[newPath.length - 1].id)
    }
    setLoading(true)
  }

  async function createDocument(e: React.FormEvent) {
    e.preventDefault()
    if (!title || !currentUser) return
    setUploading(true)
    setFormError("")

    let fileName = null
    let filePath = null

    if (docType === "File" && file) {
      const formData = new FormData()
      formData.append("file", file)
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) {
        setFormError("Upload failed: " + (uploadData.error || "Unknown"))
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
        doc_type: docType,
        folder_id: currentFolderId
      })
    })
    const data = await res.json()
    setUploading(false)

    if (!res.ok) {
      setFormError(data.error || "Failed")
      return
    }

    resetDocForm()
    setShowDocForm(false)
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
        doc_type: docType,
        folder_id: currentFolderId
      })
    })
    setUploading(false)
    if (res.ok) {
      setEditDoc(null)
      resetDocForm()
      loadDocs()
    }
  }

  function resetDocForm() {
    setTitle("")
    setContent("")
    setFile(null)
    setIsGlobal(false)
    setDocType("File")
    setFormError("")
  }

  function startEdit(doc: Document) {
    setEditDoc(doc)
    setTitle(doc.title)
    setContent(doc.content || "")
    setIsGlobal(doc.is_global)
    setDocType(doc.doc_type)
    setShowDocForm(true)
  }

  async function deleteDoc(id: string) {
    if (!confirm("Delete this document?")) return
    await fetch(`/api/documents?id=${id}`, { method: "DELETE" })
    loadDocs()
  }

  async function openAcl(doc: Document) {
    setAclDoc(doc)
    const [usersRes, aclRes] = await Promise.all([
      fetch("/api/users"),
      fetch(`/api/documents/acl?docId=${doc.id}`)
    ])
    const usersData = await usersRes.json()
    const aclData = await aclRes.json()
    setAclUsers((usersData.users || []).filter((u: any) => u.id !== currentUser?.id && u.id !== doc.user?.id))
    setAclList(aclData.access || [])
  }

  async function grantAccess(e: React.FormEvent) {
    e.preventDefault()
    if (!aclDoc || !aclUserId) return
    const res = await fetch("/api/documents/acl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: aclDoc.id, user_id: aclUserId, access_level: aclLevel })
    })
    if (res.ok) {
      setAclUserId("")
      openAcl(aclDoc)
    }
  }

  async function revokeAccess(userId: string) {
    if (!aclDoc) return
    await fetch(`/api/documents/acl?docId=${aclDoc.id}&userId=${userId}`, { method: "DELETE" })
    openAcl(aclDoc)
  }

  async function openAudit(doc: Document) {
    setAuditDoc(doc)
    const res = await fetch(`/api/documents/audit?docId=${doc.id}`)
    const data = await res.json()
    setAuditLogs(data.logs || [])
  }

  const isAdmin = currentUser?.role === "Admin"
  const isManager = currentUser?.role === "Manager" || isAdmin

  const docTypeIcon = (type: DocType) => {
    switch (type) {
      case "File": return "📄"
      case "Text": return "📝"
      case "Link": return "🔗"
    }
  }

  const accessLevelColor = (level: string) => {
    switch (level) {
      case "Admin": return "bg-red-100 text-red-700 border-red-200"
      case "Write": return "bg-blue-100 text-blue-700 border-blue-200"
      default: return "bg-slate-100 text-slate-600 border-slate-200"
    }
  }

  return (
    <AppLayout>
      <div className="max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Documents</h1>
            <p className="text-slate-500 mt-1">{folders.length} folders, {docs.length} files</p>
          </div>
          {isManager && (
            <div className="flex gap-2">
              <button onClick={() => { setShowFolderForm(!showFolderForm); setShowDocForm(false) }} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2">
                📁 {showFolderForm ? "Cancel" : "New Folder"}
              </button>
              <button onClick={() => { setShowDocForm(!showDocForm); setShowFolderForm(false); if (editDoc) { setEditDoc(null); resetDocForm(); } }} className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2">
                📄 {showDocForm ? "Cancel" : "New Document"}
              </button>
            </div>
          )}
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4 text-sm">
          <button onClick={() => navigateToFolder(-1)} className="text-primary-600 hover:text-primary-800 font-medium">📂 Home</button>
          {folderPath.map((f, i) => (
            <span key={f.id} className="flex items-center gap-2">
              <span className="text-slate-400">/</span>
              <button onClick={() => navigateToFolder(i)} className="text-primary-600 hover:text-primary-800 font-medium">{f.name}</button>
            </span>
          ))}
        </div>

        {/* New Folder Form */}
        {showFolderForm && (
          <form onSubmit={createFolder} className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-slate-200 animate-fade-in">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Create New Folder</h2>
            <div className="flex gap-3">
              <input value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="Folder name" className="flex-1 border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white" required />
              <button type="submit" className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-2.5 rounded-lg font-medium">Create</button>
              <button type="button" onClick={() => setShowFolderForm(false)} className="text-slate-500 hover:text-slate-700 px-4 py-2.5">Cancel</button>
            </div>
          </form>
        )}

        {/* Document Form */}
        {showDocForm && (
          <form onSubmit={editDoc ? updateDocument : createDocument} className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-slate-200 animate-fade-in">
            <h2 className="text-lg font-bold text-slate-900 mb-4">{editDoc ? "Edit Document" : "New Document"}</h2>
            {formError && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">{formError}</div>}

            <div className="flex gap-2 mb-4">
              {["File", "Text", "Link"].map(t => (
                <button key={t} type="button" onClick={() => setDocType(t as DocType)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${docType === t ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{t}</button>
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white" required />
              </div>
              {docType === "File" && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">File{editDoc?.file_name && ` (current: ${editDoc.file_name})`}</label>
                  <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2" required={!editDoc} />
                </div>
              )}
              {docType === "Text" && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Content</label>
                  <textarea value={content} onChange={e => setContent(e.target.value)} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 h-40 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none bg-white" placeholder="Enter document content..." required />
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isGlobal} onChange={e => setIsGlobal(e.target.checked)} className="w-4 h-4 accent-primary-600" />
                <span className="text-sm text-slate-600">Make available to all users</span>
              </label>
            </div>
            <div className="flex gap-3 mt-4">
              <button type="submit" disabled={uploading} className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-2.5 rounded-lg font-medium disabled:opacity-50">{uploading ? "Saving..." : (editDoc ? "Save Changes" : "Create")}</button>
              <button type="button" onClick={() => { setShowDocForm(false); setEditDoc(null); resetDocForm(); }} className="text-slate-500 hover:text-slate-700 px-4 py-2.5">Cancel</button>
            </div>
          </form>
        )}

        {/* ACL Panel */}
        {aclDoc && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-slate-200 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Access Control: {aclDoc.title}</h2>
              <button onClick={() => setAclDoc(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={grantAccess} className="flex gap-3 mb-4">
              <select value={aclUserId} onChange={e => setAclUserId(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-4 py-2.5 bg-white" required>
                <option value="">Select user...</option>
                {aclUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
              </select>
              <select value={aclLevel} onChange={e => setAclLevel(e.target.value)} className="border border-slate-200 rounded-lg px-4 py-2.5 bg-white">
                <option value="Read">Read</option>
                <option value="Write">Write</option>
                <option value="Admin">Admin</option>
              </select>
              <button type="submit" className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2.5 rounded-lg font-medium">Grant</button>
            </form>

            <div className="space-y-2">
              {aclList.length === 0 && <p className="text-sm text-slate-400">No explicit access grants yet. Owner has full control.</p>}
              {aclList.map(a => (
                <div key={a.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm text-slate-700">{a.user.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${accessLevelColor(a.access_level)}`}>{a.access_level}</span>
                  </div>
                  <button onClick={() => revokeAccess(a.user_id)} className="text-red-400 hover:text-red-600 text-sm">Revoke</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audit Panel */}
        {auditDoc && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-slate-200 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Audit Trail: {auditDoc.title}</h2>
              <button onClick={() => setAuditDoc(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {auditLogs.length === 0 && <p className="text-sm text-slate-400">No audit history yet.</p>}
              {auditLogs.map(log => (
                <div key={log.id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-2 text-sm">
                  <span className="font-medium text-slate-700 min-w-[80px]">{log.action}</span>
                  <span className="text-slate-500">by {log.user.name}</span>
                  <span className="text-slate-400 text-xs ml-auto">{new Date(log.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" /></div>
        ) : (
          <div>
            {/* Folders Grid */}
            {folders.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Folders</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {folders.map(f => (
                    <div key={f.id} className="group bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-all cursor-pointer relative" onClick={() => enterFolder(f)}>
                      <div className="text-3xl mb-2">📁</div>
                      <div className="font-medium text-slate-800 text-sm truncate">{f.name}</div>
                      <div className="text-xs text-slate-400 mt-1">{f.documentCount} items</div>
                      {isManager && (
                        <button onClick={e => { e.stopPropagation(); deleteFolder(f.id) }} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs p-1">🗑️</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Files Grid */}
            {docs.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Files</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {docs.map(d => (
                    <div key={d.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{docTypeIcon(d.doc_type)}</span>
                          <div>
                            <div className="font-medium text-slate-800 text-sm truncate max-w-[180px]">{d.title}</div>
                            <div className="text-xs text-slate-400">by {d.user?.name || "—"}</div>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {d.is_global && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-600">Global</span>}
                        </div>
                      </div>

                      <div className="text-xs text-slate-400 mb-3">
                        {new Date(d.updated_at).toLocaleDateString()} • {d.doc_type}
                        {d._count?.auditLogs ? ` • ${d._count.auditLogs} audit entries` : ""}
                      </div>

                      {d.doc_type === "Text" && d.content && (
                        <div className="bg-slate-50 rounded-lg p-2 text-xs text-slate-600 max-h-20 overflow-y-auto mb-3">{d.content.substring(0, 100)}{d.content.length > 100 ? "..." : ""}</div>
                      )}

                      <div className="flex items-center gap-2 flex-wrap">
                        {d.file_path && (
                          <a href={`/api${d.file_path}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition-colors">👁 View</a>
                        )}
                        <button onClick={() => openAcl(d)} className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-medium transition-colors" title="ACL">🔐 ACL</button>
                        <button onClick={() => openAudit(d)} className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-medium transition-colors" title="Audit">📋 Audit</button>
                        {isManager && (
                          <>
                            <button onClick={() => startEdit(d)} className="text-slate-400 hover:text-slate-600 text-xs p-1" title="Edit">✏️</button>
                            <button onClick={() => deleteDoc(d.id)} className="text-red-400 hover:text-red-600 text-xs p-1" title="Delete">🗑️</button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {folders.length === 0 && docs.length === 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
                <div className="text-4xl mb-3">📁</div>
                <p>This folder is empty</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
