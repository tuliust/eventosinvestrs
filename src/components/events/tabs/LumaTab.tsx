import { useState } from "react"
import { useApp, useEventRegistrations } from "@/contexts/AppContext"
import LumaCsvImporter from "@/components/import/LumaCsvImporter"
import { formatDateTime } from "@/lib/utils"
import type { Event } from "@/lib/types"

interface Props { event: Event }

export default function LumaTab({ event }: Props) {
  const registrations = useEventRegistrations(event.id)
  const [showImporter, setShowImporter] = useState(false)
  const { state } = useApp()
  const canImport = state.user?.role === "admin"

  const approved = registrations.filter(r => r.approvalStatus === "approved")
  const pending = registrations.filter(r => r.approvalStatus === "pending")

  if (showImporter) {
    return <LumaCsvImporter event={event} onClose={() => setShowImporter(false)} />
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-carbon-20 bg-white/60">
        <div>
          <h3 className="font-bold text-carbon text-sm">Inscrições Luma</h3>
          <p className="text-xs text-carbon-60 mt-0.5">
            {registrations.length} inscrição{registrations.length !== 1 ? "ões" : ""} importada{registrations.length !== 1 ? "s" : ""}
            {" · "}
            <a href={event.lumaUrl} target="_blank" rel="noopener noreferrer" className="text-green hover:underline">
              Ver no Luma ↗
            </a>
          </p>
        </div>
        {canImport && (
          <button
            onClick={() => setShowImporter(true)}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-green hover:opacity-90 transition-fast"
          >
            Importar CSV Luma
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="flex-shrink-0 flex gap-px bg-carbon-20/40 border-b border-carbon-20">
        {[
          { label: "Aprovados", value: approved.length, color: "#009C63" },
          { label: "Pendentes", value: pending.length, color: "#9B6E00" },
          { label: "Total", value: registrations.length, color: "#3C3C3B" },
        ].map(s => (
          <div key={s.label} className="flex-1 px-4 py-3 bg-white text-center">
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-carbon-60">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {registrations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-3xl mb-3 opacity-30">⬆</p>
            <p className="text-carbon-60 font-medium text-sm">Nenhuma inscrição importada</p>
            <p className="text-xs text-carbon-60 opacity-70 mt-1">
              {canImport
                ? "Use o botão acima para importar o CSV exportado pelo Luma"
                : "A importação deve ser realizada por um administrador"}
            </p>
            {canImport && (
              <button onClick={() => setShowImporter(true)} className="mt-4 px-4 py-2 rounded-lg text-sm font-bold text-white bg-green hover:opacity-90 transition-fast">
                Importar CSV Luma
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-carbon-20 text-left">
                <th className="pb-2 text-xs font-semibold text-carbon-60 uppercase tracking-wide pr-4">Nome</th>
                <th className="pb-2 text-xs font-semibold text-carbon-60 uppercase tracking-wide pr-4">Empresa</th>
                <th className="pb-2 text-xs font-semibold text-carbon-60 uppercase tracking-wide pr-4">Cargo</th>
                <th className="pb-2 text-xs font-semibold text-carbon-60 uppercase tracking-wide pr-4">E-mail</th>
                <th className="pb-2 text-xs font-semibold text-carbon-60 uppercase tracking-wide pr-4">Inscrito em</th>
                <th className="pb-2 text-xs font-semibold text-carbon-60 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-carbon-20/50">
              {registrations.map(reg => {
                const contact = reg.contactId ? state.contacts.find(c => c.id === reg.contactId) : null
                return (
                  <tr key={reg.id} className="hover:bg-white/60 transition-fast">
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-carbon">{reg.name}</p>
                      {contact && (
                        <p className="text-xs text-green">✓ vinculado ao contato</p>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-carbon-60 max-w-[160px] truncate">{reg.company || "—"}</td>
                    <td className="py-3 pr-4 text-carbon-60 max-w-[140px] truncate">{reg.position || "—"}</td>
                    <td className="py-3 pr-4 text-carbon-60 text-xs">{reg.email || "—"}</td>
                    <td className="py-3 pr-4 text-carbon-60 text-xs">{formatDateTime(reg.registeredAt)}</td>
                    <td className="py-3">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: reg.approvalStatus === "approved" ? "#E8F4EF" : "#FFF4D6",
                          color: reg.approvalStatus === "approved" ? "#009C63" : "#9B6E00",
                        }}
                      >
                        {reg.approvalStatus === "approved" ? "Aprovado" : "Pendente"}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
