import { useEventRegistrations, useEventAttendances, useEventInvites } from "@/contexts/AppContext"
import { occupancyPercent } from "@/lib/utils"
import { formatDateBR, isEventBeforeStart } from "@/lib/dateFormat"
import type { EventDetails } from "@/lib/eventDetailsApi"
import type { Event } from "@/lib/types"

interface Props {
  event: Event
  details?: EventDetails | null
}

export default function OverviewTab({ event, details }: Props) {
  const registrations = useEventRegistrations(event.id)
  const attendances = useEventAttendances(event.id)
  const invites = useEventInvites(event.id)

  const confirmed = registrations.filter((r) => r.approvalStatus === "approved").length
  const present = attendances.length
  const walkIns = attendances.filter((a) => a.source === "walk_in").length
  const lumaCheckIns = attendances.filter((a) => a.source === "luma").length
  const noShow = confirmed - present
  const beforeStart = isEventBeforeStart(event.date, event.startTime)
  const occupancyBase = beforeStart ? confirmed : present
  const pct = occupancyPercent(occupancyBase, event.capacity)
  const isOnline = event.format === "online"
  const isHybrid = event.format === "hibrido"

  const funnelSteps = [
    { label: "Público selecionado", value: "—", note: "módulo futuro" },
    { label: "Convites enviados", value: invites.length },
    { label: "Confirmados (Luma)", value: confirmed },
    { label: "Presentes", value: present },
  ]

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-6">
        {beforeStart ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KPICard label="Convidados" value={invites.length} />
            <KPICard label="Capacidade" value={event.capacity} />
            <KPICard label="Confirmados" value={confirmed} color="green" />
            <KPICard label="Ocupação" value={`${pct}%`} highlight={pct >= 80} />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KPICard label="Confirmados" value={confirmed} />
            <KPICard label="Presentes" value={present} color="green" />
            <KPICard label="Capacidade" value={event.capacity} />
            <KPICard label="Ocupação" value={`${pct}%`} highlight={pct >= 80} />
            <KPICard label="No-show" value={Math.max(0, noShow)} color="magenta" />
            <KPICard label="Walk-ins" value={walkIns} />
            <KPICard label="Via Luma" value={lumaCheckIns} />
            <KPICard label="Convites" value={invites.length} />
          </div>
        )}

        <div className="bg-white rounded-2xl border border-carbon-20 p-5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-carbon">Ocupação</span>
            <span className="text-sm font-bold text-carbon">{occupancyBase} / {event.capacity}</span>
          </div>
          <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: "#F4F4F1" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, pct)}%`,
                background: pct >= 90 ? "#E60456" : pct >= 70 ? "#F8B51E" : "#009C63",
              }}
            />
          </div>
          <p className="text-xs text-carbon-60 mt-1.5">
            {beforeStart
              ? `${pct}% da capacidade já confirmada`
              : `${pct}% da capacidade utilizada`}
          </p>
        </div>

        {!beforeStart && (
          <div className="bg-white rounded-2xl border border-carbon-20 p-5 mb-6">
            <h3 className="text-sm font-bold text-carbon mb-4 uppercase tracking-wide">Funil do evento</h3>
            <div className="space-y-3">
              {funnelSteps.map((step, i) => {
                const next = funnelSteps[i + 1]
                const width =
                  typeof step.value === "number" && typeof next?.value === "number"
                    ? typeof funnelSteps[0].value === "number" && funnelSteps[0].value > 0
                      ? Math.min(100, (step.value / funnelSteps[0].value) * 100)
                      : 100
                    : 100

                return (
                  <div key={step.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-carbon-60 uppercase tracking-wide">
                        {step.label}
                      </span>
                      <span className="text-sm font-bold text-carbon">
                        {step.value}
                        {step.note && (
                          <span className="text-xs font-normal text-carbon-60 ml-1">({step.note})</span>
                        )}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "#F4F4F1" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${typeof step.value === "number" ? width : 20}%`,
                          background:
                            i === 0 ? "#3C3C3B" : i === 1 ? "#F8B51E" : "#009C63",
                          opacity: typeof step.value === "number" ? 1 : 0.3,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-carbon-20 p-5">
          <h3 className="text-sm font-bold text-carbon mb-4 uppercase tracking-wide">Informações do evento</h3>

          {details?.cardUrl && (
            <div className="mb-5 rounded-xl border border-carbon-20 bg-neutral/40 p-3">
              <img
                src={details.cardUrl}
                alt={`Card do evento ${event.title}`}
                className="w-full max-h-96 object-contain rounded-lg bg-white"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <InfoRow label="Título" value={event.title} />
            <InfoRow label="Tipo" value={event.type} />
            <InfoRow label="Formato" value={event.format} />
            <InfoRow label="Data" value={formatDateBR(event.date)} />
            <InfoRow label="Horário" value={`${event.startTime} – ${event.endTime}`} />

            {!isOnline && <InfoRow label="Local" value={event.venue || "—"} />}
            {!isOnline && (
              <InfoRow
                label="Cidade/UF"
                value={event.city && event.state ? `${event.city}/${event.state}` : "—"}
              />
            )}

            {(isOnline || isHybrid) && (
              <InfoLink
                label="Acesso online"
                value={details?.onlineUrl || "—"}
                href={details?.onlineUrl}
              />
            )}

            <InfoRow label="Capacidade" value={String(event.capacity)} />
            <InfoRow label="Responsável" value={event.responsavel || "—"} />
            <InfoRow label="Organizações" value={event.organizations.join(", ") || "—"} />
          </div>

          {event.description && (
            <div className="mt-4 pt-4 border-t border-carbon-20">
              <p className="text-xs font-semibold text-carbon-60 uppercase tracking-wide mb-2">Descrição</p>
              <p className="text-sm text-carbon leading-relaxed whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function KPICard({
  label,
  value,
  color = "carbon",
  highlight = false,
}: {
  label: string
  value: number | string
  color?: "green" | "magenta" | "carbon"
  highlight?: boolean
}) {
  const colors = {
    green: { bg: "#E8F4EF", text: "#009C63" },
    magenta: { bg: "#FCE7EF", text: "#E60456" },
    carbon: {
      bg: highlight ? "#FFF4D6" : "#F4F4F1",
      text: highlight ? "#9B6E00" : "#3C3C3B",
    },
  }
  const c = colors[color]
  return (
    <div className="rounded-xl p-4 text-center" style={{ background: c.bg }}>
      <p className="text-2xl font-bold" style={{ color: c.text }}>{value}</p>
      <p className="text-xs text-carbon-60 font-medium mt-0.5">{label}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-carbon-60 uppercase tracking-wide">{label}</dt>
      <dd className="text-carbon font-medium mt-0.5">{value}</dd>
    </div>
  )
}

function InfoLink({
  label,
  value,
  href,
}: {
  label: string
  value: string
  href?: string
}) {
  return (
    <div>
      <dt className="text-xs font-semibold text-carbon-60 uppercase tracking-wide">{label}</dt>
      <dd className="text-carbon font-medium mt-0.5 break-all">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green hover:underline"
          >
            {value} ↗
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  )
}
