"use client"

import { AppLayout } from "@/components/AppLayout"

export default function FirewallPage() {
  return (
    <AppLayout title="Firewall" subtitle="Rules & traffic monitoring">
      <div className="max-w-5xl">
        <div className="glass-card rounded-xl p-8 text-center border border-white/10">
          <div className="text-6xl mb-4">🔥</div>
          <h1 className="text-3xl font-bold text-white mb-4">Firewall Management</h1>
          <p className="text-gray-400 mb-8 max-w-lg mx-auto">Manage firewall rules, monitor traffic, and track blocked/threat events.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            {[
              { label: "Total Rules", value: "0", color: "text-white" },
              { label: "Allowed", value: "0", color: "text-emerald-400" },
              { label: "Blocked", value: "0", color: "text-red-400" },
            ].map(item => (
              <div key={item.label} className="glass-card rounded-lg p-5 border border-white/5">
                <div className={`text-3xl font-bold ${item.color}`}>{item.value}</div>
                <div className="text-sm text-gray-400 mt-1">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
