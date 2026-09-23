import { useNavigate } from "react-router-dom"
import { useApp } from "@/contexts/AppContext"
import { occupancyPercent } from "@/lib/utils"
import { formatDateBR, isEventBeforeStart } from "@/lib/dateFormat"
import { EVENT_STATUS_LABELS, EVENT_FORMAT_LABELS } from "@/lib/constants"
import type { EventStatus } from "@/lib/types"

const statusColors: Record<EventStatus, { bg: string; color: string }> = {
  draft: { bg: "#F4F4F1", color: "#7A7A78" },
  upcoming: { bg: "#FFF4D6", color: "#9B6E00" },
  live: { bg: "#E8F4EF", color: "#009C63" },
  completed: { bg: "#E8F4EF", color: "#009C63" },
  cancelled: { bg: "#FCE7EF", color: "#E60456" },
}

export default function EventsPage() {
  const { state } = useApp()
  const navigate = useNavigate()

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-carbon-60 mb-1">
              Módulo
            </p>
            <h1 className="text-2xl font-bold text-carbon">Eventos</h1>
          </div>
          {state.user?.role === "admin" && (
            <button
              onClick={() => navigate("/eventos/novo")}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-green hover:opacity-90 transition-fast"
            >
              + Novo evento
            </button>
          )}
        </div>

        <div className="space-y-3">
          {state.events.map((ev) => {
            const regs = state.registrations[ev.id] || []
            const att = (state.attendances[ev.id] || []).filter((a) => !a.undoneAt)
            const invites = state.invites[ev.id] || []
            const confirmed = regs.filter((r) => r.approvalStatus === "approved").length
            const present = att.length
            const beforeStart = isEventBeforeStart(ev.date, ev.startTime)
            const pct = occupancyPercent(beforeStart ? confirmed : present, ev.capacity)
            const colors = statusColors[ev.status]

            return (
              <article
                key={ev.id}
                className="bg-white rounded-2xl border border-carbon-20 overflow-hidden hover:border-green/40 hover:shadow-sm transition-fast cursor-pointer"
                onClick={() => navigate(`/eventos/${ev.id}`)}
              >
                <div className="h-1 bg-green" />

                <div className="p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: colors.bg, color: colors.color }}
                        >
                          {EVENT_STATUS_LABELS[ev.status]}
                        </span>
                        <span className="text-xs text-carbon-60">
                          {ev.type} · {EVENT_FORMAT_LABELS[ev.format]}
                        </span>
                      </div>
                      <h2 className="font-bold text-carbon text-lg leading-snug">
                        {ev.title}
                      </h2>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5 text-sm">
                    <MetaItem label="Data" value={formatDateBR(ev.date)} />
                    <MetaItem label="Horário" value={`${ev.startTime}–${ev.endTime}`} />
                    <MetaItem
                      label={ev.format === "online" ? "Acesso" : "Local"}
                      value={ev.format === "online" ? "Online" : ev.venue || "—"}
                    />
                  </div>

                  {beforeStart ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <StatPill label="Convidados" value={invites.length} />
                      <StatPill label="Capacidade" value={ev.capacity} />
                      <StatPill label="Confirmados" value={confirmed} color="green" />
                      <StatPill label="Ocupação" value={`${pct}%`} highlight={pct >= 80} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <StatPill label="Confirmados" value={confirmed} />
                      <StatPill label="Convidados" value={invites.length} />
                      <StatPill label="Presentes" value={present} color="green" />
                      <StatPill label="Capacidade" value={ev.capacity} />
                      <StatPill label="Ocupação" value={`${pct}%`} highlight={pct >= 80} />
                    </div>
                  )}
                </div>

                <div
                  className="px-6 py-3 flex items-center justify-between border-t border-carbon-20/50 text-xs text-carbon-60"
                  style={{ background: "#FAFAFA" }}
                >
                  <span>{ev.organizations.join(" · ")}</span>
                  <span className="font-semibold text-green">Ver evento →</span>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-carbon-60 uppercase tracking-wide font-semibold mb-0.5">
        {label}
      </p>
      <p className="text-sm text-carbon font-medium truncate">{value}</p>
    </div>
  )
}

function StatPill({
  label,
  value,
  color = "carbon",
  highlight = false,
}: {
  label: string
  value: number | string
  color?: "green" | "carbon"
  highlight?: boolean
}) {
  return (
    <div
      className="rounded-xl p-3 text-center"
      style={{ background: highlight ? "#FFF4D6" : "#F4F4F1" }}
    >
      <p
        className={`text-xl font-bold ${
          color === "green"
            ? "text-green"
            : highlight
              ? "text-yellow-600"
              : "text-carbon"
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-carbon-60 font-medium mt-0.5 leading-tight">
        {label}
      </p>
    </div>
  )
}
