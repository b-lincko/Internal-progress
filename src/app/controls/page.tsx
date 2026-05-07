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

  const domains = Array.from(new Set(controls.map(c => c.domain)))

  return (
    <AppLayout>
      <div className="max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Controls</h1>
          <p className="text-slate-500 mt-1">{controls.length} controls</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left p-4 text-sm font-semibold text-slate-500">Status</th>
                  <th className="text-left p-4 text-sm font-semibold text-slate-500">Control ID</th>
                  <th className="text-left p-4 text-sm font-semibold text-slate-500">Domain</th>
                  <th className="text-left p-4 text-sm font-semibold text-slate-500">Title</th>
                  <th className="text-left p-4 text-sm font-semibold text-slate-500">Owner</th>
                  <th className="text-left p-4 text-sm font-semibold text-slate-500">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {controls.map((c: any, idx: number) => (
                  <tr
                    key={c.id}
                    className={`border-b border-slate-50 hover:bg-slate-50/80 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          c.status === "Implemented" ? "bg-emerald-500" :
                          c.status === "In_Progress" ? "bg-amber-500" : "bg-slate-400"
                        }`} />
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                          c.status === "Implemented" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                          c.status === "In_Progress" ? "bg-amber-100 text-amber-700 border-amber-200" :
                          "bg-slate-100 text-slate-600 border-slate-200"
                        }`}>
                          {c.status?.replace("_", " ")}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <Link href={`/controls/${c.id}`} className="font-mono text-sm text-primary-600 hover:text-primary-800 font-medium">
                        {c.control_id}
                      </Link>
                    </td>
                    <td className="p-4 text-sm text-slate-600">{c.domain}</td>
                    <td className="p-4">
                      <Link href={`/controls/${c.id}`} className="text-sm text-slate-800 hover:text-primary-600 font-medium transition-colors">
                        {c.title}
                      </Link>
                    </td>
                    <td className="p-4 text-sm text-slate-500">{c.owner?.name || "—"}</td>
                    <td className="p-4">
                      {c._count?.evidence > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded-md text-xs font-medium">
                          📎 {c._count.evidence}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-sm">—</span>
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
