"use client"

import { AppLayout } from "@/components/AppLayout"

export default function NetworkPage() {
  return (
    <AppLayout title="Network" subtitle="Network topology & monitoring">
      <div className="max-w-5xl">
        <div className="glass-card rounded-xl p-8 text-center border border-white/10">
          <div className="text-6xl mb-4">🌐</div>
          <h1 className="text-3xl font-bold text-white mb-4">Network Management</h1>
          <p className="text-gray-400 mb-8 max-w-lg mx-auto">Monitor network topology, VLANs, IP ranges, and connected devices.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 text-left">
            {[
              { label: "Total Subnets", value: "0", icon: "📡" },
              { label: "Active Hosts", value: "0", icon: "💻" },
              { label: "VLANs", value: "0", icon: "🔀" },
              { label: "Open Ports", value: "0", icon: "🔓" },
            ].map(item => (
              <div key={item.label} className="glass-card rounded-lg p-5 border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-2xl font-bold text-white">{item.value}</span>
                </div>
                <div className="text-sm text-gray-400 mt-2">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
