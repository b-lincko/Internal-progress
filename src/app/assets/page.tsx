"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/AppLayout"

interface Asset {
  id: string
  name: string
  asset_type: string
  ip_address: string | null
  mac_address: string | null
  os: string | null
  os_version: string | null
  location: string | null
  owner: string | null
  status: string
  criticality: string
  last_scan: string | null
  notes: string | null
  created_at: string
}

const assetTypes = ["Server", "Workstation", "Laptop", "Mobile", "Network_Device", "Security_Appliance", "IoT_Device", "Printer", "Other"]
const statuses = ["Active", "Inactive", "Decommissioned", "Lost", "Under_Maintenance"]
const criticalities = ["Low", "Medium", "High", "Critical"]

const typeIcons: Record<string, string> = {
  Server: "🖥️", Workstation: "💻", Laptop: "💻", Mobile: "📱",
  Network_Device: "📡", Security_Appliance: "🔒", IoT_Device: "🌐", Printer: "🖨️", Other: "📦"
}

const statusColors: Record<string, string> = {
  Active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Inactive: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  Decommissioned: "bg-red-500/10 text-red-400 border-red-500/20",
  Lost: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Under_Maintenance: "bg-amber-500/10 text-amber-400 border-amber-500/20"
}

const criticalityColors: Record<string, string> = {
  Low: "bg-gray-500/10 text-gray-400",
  Medium: "bg-yellow-500/10 text-yellow-400",
  High: "bg-orange-500/10 text-orange-400",
  Critical: "bg-red-500/10 text-red-400"
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [editAsset, setEditAsset] = useState<Asset | null>(null)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  // Form fields
  const [name, setName] = useState("")
  const [assetType, setAssetType] = useState("Workstation")
  const [ipAddress, setIpAddress] = useState("")
  const [macAddress, setMacAddress] = useState("")
  const [os, setOs] = useState("")
  const [osVersion, setOsVersion] = useState("")
  const [location, setLocation] = useState("")
  const [owner, setOwner] = useState("")
  const [criticality, setCriticality] = useState("Medium")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setCurrentUser(d.user))
    loadAssets()
  }, [typeFilter, statusFilter])

  async function loadAssets() {
    setLoading(true)
    const params = new URLSearchParams()
    if (typeFilter) params.set("type", typeFilter)
    if (statusFilter) params.set("status", statusFilter)
    if (searchQuery) params.set("search", searchQuery)
    const res = await fetch(`/api/assets?${params}`)
    const data = await res.json()
    setAssets(data.assets || [])
    setLoading(false)
  }

  function resetForm() {
    setName("")
    setAssetType("Workstation")
    setIpAddress("")
    setMacAddress("")
    setOs("")
    setOsVersion("")
    setLocation("")
    setOwner("")
    setCriticality("Medium")
    setNotes("")
    setEditAsset(null)
  }

  async function createAsset(e: React.FormEvent) {
    e.preventDefault()
    if (!name) return
    setSaving(true)
    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, asset_type: assetType, ip_address: ipAddress, mac_address: macAddress,
        os, os_version: osVersion, location, owner, criticality, notes
      })
    })
    setSaving(false)
    if (res.ok) {
      resetForm()
      setShowForm(false)
      loadAssets()
    }
  }

  async function updateAsset(e: React.FormEvent) {
    e.preventDefault()
    if (!editAsset || !name) return
    setSaving(true)
    const res = await fetch("/api/assets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editAsset.id, name, asset_type: assetType, ip_address: ipAddress,
        mac_address: macAddress, os, os_version: osVersion, location, owner, criticality, notes
      })
    })
    setSaving(false)
    if (res.ok) {
      resetForm()
      setShowForm(false)
      loadAssets()
    }
  }

  async function deleteAsset(id: string) {
    if (!confirm("Delete this asset?")) return
    await fetch(`/api/assets?id=${id}`, { method: "DELETE" })
    loadAssets()
  }

  function startEdit(asset: Asset) {
    setEditAsset(asset)
    setName(asset.name)
    setAssetType(asset.asset_type)
    setIpAddress(asset.ip_address || "")
    setMacAddress(asset.mac_address || "")
    setOs(asset.os || "")
    setOsVersion(asset.os_version || "")
    setLocation(asset.location || "")
    setOwner(asset.owner || "")
    setCriticality(asset.criticality)
    setNotes(asset.notes || "")
    setShowForm(true)
  }

  const isAdmin = currentUser?.role === "Admin"
  const isManager = currentUser?.role === "Manager" || isAdmin

  const counts = {
    total: assets.length,
    active: assets.filter(a => a.status === "Active").length,
    servers: assets.filter(a => a.asset_type === "Server").length,
    critical: assets.filter(a => a.criticality === "Critical").length
  }

  return (
    <AppLayout title="Assets" subtitle="IT & Security asset inventory">
      <div className="max-w-6xl">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Assets", value: counts.total, color: "text-white" },
            { label: "Active", value: counts.active, color: "text-emerald-400" },
            { label: "Servers", value: counts.servers, color: "text-blue-400" },
            { label: "Critical", value: counts.critical, color: "text-red-400" },
          ].map(item => (
            <div key={item.label} className="glass-card rounded-xl p-5 border border-white/10">
              <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
              <div className="text-sm text-gray-500 mt-1">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Filters + Create */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <input
            type="text"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && loadAssets()}
            className="flex-1 min-w-[200px] border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white placeholder-gray-500"
          />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white">
            <option value="">All Types</option>
            {assetTypes.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white">
            <option value="">All Statuses</option>
            {statuses.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          {isManager && (
            <button onClick={() => { setShowForm(!showForm); if (!showForm) resetForm(); }} className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2">
              🖥️ {showForm ? "Cancel" : "Add Asset"}
            </button>
          )}
        </div>

        {/* Form */}
        {showForm && (
          <form onSubmit={editAsset ? updateAsset : createAsset} className="glass-card rounded-xl p-6 mb-6 border border-white/10 animate-fade-in">
            <h2 className="text-lg font-bold text-white mb-4">{editAsset ? "Edit Asset" : "Add New Asset"}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} className="w-full border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Type</label>
                <select value={assetType} onChange={e => setAssetType(e.target.value)} className="w-full border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white">
                  {assetTypes.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Criticality</label>
                <select value={criticality} onChange={e => setCriticality(e.target.value)} className="w-full border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white">
                  {criticalities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">IP Address</label>
                <input value={ipAddress} onChange={e => setIpAddress(e.target.value)} placeholder="192.168.1.1" className="w-full border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white placeholder-gray-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">MAC Address</label>
                <input value={macAddress} onChange={e => setMacAddress(e.target.value)} placeholder="00:00:00:00:00:00" className="w-full border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white placeholder-gray-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">OS</label>
                <input value={os} onChange={e => setOs(e.target.value)} placeholder="Windows, Linux, etc." className="w-full border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white placeholder-gray-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">OS Version</label>
                <input value={osVersion} onChange={e => setOsVersion(e.target.value)} placeholder="11, Ubuntu 22.04" className="w-full border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white placeholder-gray-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Location</label>
                <input value={location} onChange={e => setLocation(e.target.value)} placeholder="HQ, Datacenter 1" className="w-full border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white placeholder-gray-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Owner</label>
                <input value={owner} onChange={e => setOwner(e.target.value)} placeholder="IT Team" className="w-full border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white placeholder-gray-500" />
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-400 mb-1">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full border border-white/10 rounded-lg px-4 py-2.5 h-20 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none bg-white/5 text-white placeholder-gray-500" />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-2.5 rounded-lg font-medium disabled:opacity-50">{saving ? "Saving..." : (editAsset ? "Save Changes" : "Add Asset")}</button>
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-500 hover:text-gray-300 px-4 py-2.5">Cancel</button>
            </div>
          </form>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-violet-600 border-t-transparent rounded-full"/></div>
        ) : (
          <div className="glass-card rounded-xl overflow-hidden border border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left p-4 text-sm font-semibold text-gray-500">Asset</th>
                    <th className="text-left p-4 text-sm font-semibold text-gray-500">Type</th>
                    <th className="text-left p-4 text-sm font-semibold text-gray-500">Network</th>
                    <th className="text-left p-4 text-sm font-semibold text-gray-500">OS</th>
                    <th className="text-left p-4 text-sm font-semibold text-gray-500">Status</th>
                    <th className="text-left p-4 text-sm font-semibold text-gray-500">Criticality</th>
                    <th className="text-left p-4 text-sm font-semibold text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset, idx) => (
                    <tr key={asset.id} className={`border-b border-white/5 ${idx % 2 === 0 ? "bg-transparent" : "bg-white/5"} hover:bg-white/5 transition-colors`}>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{typeIcons[asset.asset_type] || "📦"}</span>
                          <div>
                            <div className="font-medium text-gray-200">{asset.name}</div>
                            <div className="text-xs text-gray-500">{asset.location || "—"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-gray-400">{asset.asset_type.replace("_", " ")}</td>
                      <td className="p-4 text-sm text-gray-400">
                        {asset.ip_address && <div>{asset.ip_address}</div>}
                        {asset.mac_address && <div className="text-xs text-gray-500">{asset.mac_address}</div>}
                      </td>
                      <td className="p-4 text-sm text-gray-400">
                        {asset.os || "—"}
                        {asset.os_version && <div className="text-xs text-gray-500">{asset.os_version}</div>}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[asset.status] || statusColors.Inactive}`}>{asset.status.replace("_", " ")}</span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${criticalityColors[asset.criticality] || criticalityColors.Medium}`}>{asset.criticality}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {isManager && (
                            <button onClick={() => startEdit(asset)} className="text-gray-500 hover:text-gray-300 text-sm p-1" title="Edit">✏️</button>
                          )}
                          {isManager && (
                            <button onClick={() => deleteAsset(asset.id)} className="text-red-400 hover:text-red-300 text-sm p-1" title="Delete">🗑️</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {assets.length === 0 && (
              <div className="p-12 text-center text-gray-500">{isManager ? "No assets found. Add one above." : "No assets found."}</div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
