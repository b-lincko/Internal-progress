"use client"

import { AppLayout } from "@/components/AppLayout"

export default function ADPage() {
  return (
    <AppLayout title="Active Directory" subtitle="Users, groups & policies">
      <div className="max-w-5xl">
        <div className="glass-card rounded-xl p-8 text-center border border-white/10">
          <div className="text-6xl mb-4">👥</div>
          <h1 className="text-3xl font-bold text-white mb-4">Active Directory</h1>
          <p className="text-gray-400 mb-8 max-w-lg mx-auto">Sync and manage AD users, groups, OU structure, and group policies.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            {[
              { label: "AD Users", value: "0", icon: "👤" },
              { label: "Groups", value: "0", icon: "👥" },
              { label: "Group Policies", value: "0", icon: "📋" },
            ].map(item => (
              <div key={item.label} className="glass-card rounded-lg p-5 border border-white/5">
                <div className="text-3xl mb-2">{item.icon}</div>
                <div className="text-2xl font-bold text-white">{item.value}</div>
                <div className="text-sm text-gray-400">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
