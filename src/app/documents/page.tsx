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
  const [refreshKey, setRefreshKey] = useState(0)

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
  }, [currentFolderId, refreshKey])

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
    setRefreshKey(prev => prev + 1)
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
    setRefreshKey(prev => prev + 1)
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
      case "Admin": return "bg-red-500/10 text-red-400 border-red-500/20"
      case "Write": return "bg-blue-500/10 text-blue-400 border-blue-500/20"
      default: return "bg-white/5 text-gray-400 border-white/10"
    }
  }

  return (
    <AppLayout title="Documents" subtitle="Compliance documents">
      <div className="max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Documents</h1>
            <p className="text-gray-500 mt-1">{folders.length} folders, {docs.length} files</p>
          </div>
          {isManager && (
            <div className="flex gap-2">
              <button onClick={() => { setShowFolderForm(!showFolderForm); setShowDocForm(false) }} className="bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 border border-white/10">
                📁 {showFolderForm ? "Cancel" : "New Folder"}
              </button>
              <button onClick={() => { setShowDocForm(!showDocForm); setShowFolderForm(false); if (editDoc) { setEditDoc(null); resetDocForm(); } }} className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2">
                📄 {showDocForm ? "Cancel" : "New Document"}
              </button>
            </div>
          )}
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4 text-sm">
          <button onClick={() => navigateToFolder(-1)} className="text-violet-400 hover:text-violet-300 font-medium">📂 Home</button>
          {folderPath.map((f, i) => (
            <span key={f.id} className="flex items-center gap-2">
              <span className="text-gray-500">/</span>
              <button onClick={() => navigateToFolder(i)} className="text-violet-400 hover:text-violet-300 font-medium">{f.name}</button>
            </span>
          ))}
        </div>

        {/* New Folder Form */}
        {showFolderForm && (
          <form onSubmit={createFolder} className="glass-card rounded-xl p-6 mb-6 border border-white/10 animate-fade-in">
            <h2 className="text-lg font-bold text-white mb-4">Create New Folder</h2>
            <div className="flex gap-3">
              <input value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="Folder name" className="flex-1 border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white" required />
              <button type="submit" className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-2.5 rounded-lg font-medium">Create</button>
              <button type="button" onClick={() => setShowFolderForm(false)} className="text-gray-500 hover:text-gray-300 px-4 py-2.5">Cancel</button>
            </div>
          </form>
        )}

        {/* Document Form */}
        {showDocForm && (
          <form onSubmit={editDoc ? updateDocument : createDocument} className="glass-card rounded-xl p-6 mb-6 border border-white/10 animate-fade-in">
            <h2 className="text-lg font-bold text-white mb-4">{editDoc ? "Edit Document" : "New Document"}</h2>
            {formError && <div className="bg-red-500/10 text-red-400 p-3 rounded-lg mb-4 text-sm">{formError}</div>}

            <div className="flex gap-2 mb-4">
              {["File", "Text", "Link"].map(t => (
                <button key={t} type="button" onClick={() => setDocType(t as DocType)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${docType === t ? "bg-violet-600 text-white" : "bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10"}`}>{t}</button>
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)} className="w-full border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white" required />
              </div>
              {docType === "File" && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">File{editDoc?.file_name && ` (current: ${editDoc.file_name})`}</label>
                  <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-sm border border-white/10 rounded-lg px-3 py-2 text-white" required={!editDoc} />
                </div>
              )}
              {docType === "Text" && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Content</label>
                  <textarea value={content} onChange={e => setContent(e.target.value)} className="w-full border border-white/10 rounded-lg px-4 py-2.5 h-40 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none bg-white/5 text-white" placeholder="Enter document content..." required />
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isGlobal} onChange={e => setIsGlobal(e.target.checked)} className="w-4 h-4 accent-violet-600" />
                <span className="text-sm text-gray-400">Make available to all users</span>
              </label>
            </div>
            <div className="flex gap-3 mt-4">
              <button type="submit" disabled={uploading} className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-2.5 rounded-lg font-medium disabled:opacity-50">{uploading ? "Saving..." : (editDoc ? "Save Changes" : "Create")}</button>
              <button type="button" onClick={() => { setShowDocForm(false); setEditDoc(null); resetDocForm(); }} className="text-gray-500 hover:text-gray-300 px-4 py-2.5">Cancel</button>
            </div>
          </form>
        )}

        {/* ACL Panel */}
        {aclDoc && (
          <div className="glass-card rounded-xl p-6 mb-6 border border-white/10 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Access Control: {aclDoc.title}</h2>
              <button onClick={() => setAclDoc(null)} className="text-gray-500 hover:text-gray-400">✕</button>
            </div>

            <form onSubmit={grantAccess} className="flex gap-3 mb-4">
              <select value={aclUserId} onChange={e => setAclUserId(e.target.value)} className="flex-1 border border-white/10 rounded-lg px-4 py-2.5 bg-white/5 text-white" required>
                <option value="">Select user...</option>
                {aclUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
              </select>
              <select value={aclLevel} onChange={e => setAclLevel(e.target.value)} className="border border-white/10 rounded-lg px-4 py-2.5 bg-white/5 text-white">
                <option value="Read">Read</option>
                <option value="Write">Write</option>
                <option value="Admin">Admin</option>
              </select>
              <button type="submit" className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-lg font-medium">Grant</button>
            </form>

            <div className="space-y-2">
              {aclList.length === 0 && <p className="text-sm text-gray-500">No explicit access grants yet. Owner has full control.</p>}
              {aclList.map(a => (
                <div key={a.id} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-2">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm text-gray-300">{a.user.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${accessLevelColor(a.access_level)}`}>{a.access_level}</span>
                  </div>
                  <button onClick={() => revokeAccess(a.user_id)} className="text-red-400 hover:text-red-300 text-sm">Revoke</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audit Panel */}
        {auditDoc && (
          <div className="glass-card rounded-xl p-6 mb-6 border border-white/10 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Audit Trail: {auditDoc.title}</h2>
              <button onClick={() => setAuditDoc(null)} className="text-gray-500 hover:text-gray-400">✕</button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {auditLogs.length === 0 && <p className="text-sm text-gray-500">No audit history yet.</p>}
              {auditLogs.map(log => (
                <div key={log.id} className="flex items-center gap-3 bg-white/5 rounded-lg px-4 py-2 text-sm">
                  <span className="font-medium text-gray-300 min-w-[80px]">{log.action}</span>
                  <span className="text-gray-500">by {log.user.name}</span>
                  <span className="text-gray-500 text-xs ml-auto">{new Date(log.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-violet-600 border-t-transparent rounded-full" /></div>
        ) : (
          <div>
            {/* Folders Grid */}
            {folders.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Folders</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {folders.map(f => (
                    <div key={f.id} className="group glass-card rounded-xl border border-white/10 p-4 hover:shadow-md transition-all cursor-pointer relative" onClick={() => enterFolder(f)}>
                      <div className="text-3xl mb-2">📁</div>
                      <div className="font-medium text-gray-200 text-sm truncate">{f.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{f.documentCount} items</div>
                      {isManager && (
                        <button onClick={e => { e.stopPropagation(); deleteFolder(f.id) }} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs p-1">🗑️</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Files Grid */}
            {docs.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Files</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {docs.map(d => (
                    <div key={d.id} className="glass-card rounded-xl border border-white/10 p-4 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{docTypeIcon(d.doc_type)}</span>
                          <div>
                            <div className="font-medium text-gray-200 text-sm truncate max-w-[180px]">{d.title}</div>
                            <div className="text-xs text-gray-500">by {d.user?.name || "—"}</div>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {d.is_global && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400">Global</span>}
                        </div>
                      </div>

                      <div className="text-xs text-gray-500 mb-3">
                        {new Date(d.updated_at).toLocaleDateString()} • {d.doc_type}
                        {d._count?.auditLogs ? ` • ${d._count.auditLogs} audit entries` : ""}
                      </div>

                      {d.doc_type === "Text" && d.content && (
                        <div className="bg-white/5 rounded-lg p-2 text-xs text-gray-400 max-h-20 overflow-y-auto mb-3">{d.content.substring(0, 100)}{d.content.length > 100 ? "..." : ""}</div>
                      )}

                      <div className="flex items-center gap-2 flex-wrap">
                        {d.file_path && (
                          <a href={`/api${d.file_path}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium transition-colors">👁 View</a>
                        )}
                        <button onClick={() => openAcl(d)} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-xs font-medium transition-colors" title="ACL">🔐 ACL</button>
                        <button onClick={() => openAudit(d)} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-xs font-medium transition-colors" title="Audit">📋 Audit</button>
                        {isManager && (
                          <>
                            <button onClick={() => startEdit(d)} className="text-gray-500 hover:text-gray-300 text-xs p-1" title="Edit">✏️</button>
                            <button onClick={() => deleteDoc(d.id)} className="text-red-400 hover:text-red-300 text-xs p-1" title="Delete">🗑️</button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {folders.length === 0 && docs.length === 0 && (
              <div className="glass-card rounded-xl border border-white/10 p-12 text-center text-gray-500">
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
