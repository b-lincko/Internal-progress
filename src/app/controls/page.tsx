import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { AppLayout } from "@/components/AppLayout"

export const dynamic = "force-dynamic"

export default async function ControlsPage() {
  const controls = await prisma.control.findMany({
    include: {
      owner: { select: { name: true } },
      _count: { select: { evidence: true, poams: true } }
    },
    orderBy: { control_id: "asc" }
  })

  return (
    <AppLayout title="Controls" subtitle={`${controls.length} controls`}>
      <div className="max-w-7xl">
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-sm font-semibold text-gray-500">Status</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-500">Control ID</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-500">Domain</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-500">Title</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-500">Owner</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-500">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {controls.map((c: any, idx: number) => (
                  <tr
                    key={c.id}
                    className={`border-b border-white/5 hover:bg-white/5 transition-colors ${idx % 2 === 0 ? "bg-white/[0.02]" : ""}`}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          c.status === "Implemented" ? "bg-emerald-500" :
                          c.status === "In_Progress" ? "bg-amber-500" : "bg-gray-500"
                        }`} />
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                          c.status === "Implemented" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                          c.status === "In_Progress" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
                          "bg-gray-500/10 text-gray-400 border-gray-500/30"
                        }`}>
                          {c.status?.replace("_", " ")}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <Link href={`/controls/${c.id}`} className="font-mono text-sm text-violet-400 hover:text-cyan-400 font-medium transition-colors">
                        {c.control_id}
                      </Link>
                    </td>
                    <td className="p-4 text-sm text-gray-400">{c.domain}</td>
                    <td className="p-4">
                      <Link href={`/controls/${c.id}`} className="text-sm text-gray-200 hover:text-white font-medium transition-colors">
                        {c.title}
                      </Link>
                    </td>
                    <td className="p-4 text-sm text-gray-500">{c.owner?.name || "—"}</td>
                    <td className="p-4">
                      {c._count?.evidence > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-violet-500/10 text-violet-400 rounded-md text-xs font-medium border border-violet-500/20">
                          📎 {c._count.evidence}
                        </span>
                      ) : (
                        <span className="text-gray-600 text-sm">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
