import { useApp, useCurrentUser } from "@/contexts/AppContext"
import { useNavigate } from "react-router-dom"
import { formatDate, occupancyPercent } from "@/lib/utils"
import { EVENT_STATUS_LABELS, ORG_TYPE_LABELS } from "@/lib/constants"

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function normalizeEmail(value?: string) {
  return (value || "").trim().toLowerCase()
}

function normalizeText(value?: string) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function isManagerialPosition(value?: string) {
  const position = normalizeText(value)
  if (!position) return false

  return [
    "gerent",
    "diretor",
    "president",
    "vice-president",
    "vice president",
    "coordenador",
    "superintendent",
    "chief",
    "ceo",
    "cfo",
    "cto",
    "coo",
    "head",
    "socio",
    "partner",
    "founder",
    "fundador",
    "chefe",
    "lider",
    "lead",
    "secretar",
    "reitor",
    "pro-reitor",
  ].some((term) => position.includes(term))
}

function formatNumber(value: number) {
  return value.toLocaleString("pt-BR")
}

export default function DashboardPage() {
  const { state } = useApp()
  const user = useCurrentUser()
  const navigate = useNavigate()

  const today = localDateKey()
  const mailingTotal = state.contacts.filter(
    (contact) => contact.communicationStatus === "active" && Boolean(normalizeEmail(contact.email)),
  ).length

  const prioritySegments = state.segments.filter(
    (segment) => segment.active && segment.type === "priority",
  )
  const secondarySegments = state.segments.filter(
    (segment) => segment.active && segment.type === "secondary",
  )
  const prioritySegmentIds = new Set(prioritySegments.map((segment) => segment.id))
  const secondarySegmentIds = new Set(secondarySegments.map((segment) => segment.id))
  const prioritySubsegments = state.subsegments.filter(
    (subsegment) => subsegment.active && prioritySegmentIds.has(subsegment.segmentId),
  ).length
  const secondarySubsegments = state.subsegments.filter(
    (subsegment) => subsegment.active && secondarySegmentIds.has(subsegment.segmentId),
  ).length
  const managerialPositions = state.contacts.filter((contact) => isManagerialPosition(contact.position)).length

  const futureEvents = state.events.filter(
    (event) =>
      event.status !== "draft" &&
      event.status !== "cancelled" &&
      event.status !== "completed" &&
      event.date >= today,
  )
  const previousEvents = state.events.filter(
    (event) =>
      event.status !== "draft" &&
      event.status !== "cancelled" &&
      (event.status === "completed" || event.date < today),
  )
  const futureEventIds = new Set(futureEvents.map((event) => event.id))
  const previousEventIds = new Set(previousEvents.map((event) => event.id))

  const futureInvites = Object.values(state.invites)
    .flat()
    .filter((invite) => futureEventIds.has(invite.eventId))
  const uniqueInvitedContacts = new Set(
    futureInvites
      .map((invite) =>
        invite.contactId
          ? `contact:${invite.contactId}`
          : `email:${normalizeEmail(invite.email)}`,
      )
      .filter((key) => key !== "email:"),
  ).size

  const approvedRegistrations = Object.values(state.registrations)
    .flat()
    .filter((registration) => registration.approvalStatus === "approved")

  const futureApprovedRegistrations = approvedRegistrations.filter((registration) =>
    futureEventIds.has(registration.eventId),
  )
  const uniqueConfirmedContacts = new Set(
    futureApprovedRegistrations.map((registration) => {
      if (registration.contactId) return `contact:${registration.contactId}`
      const email = normalizeEmail(registration.email)
      return email ? `email:${email}` : `registration:${registration.id}`
    }),
  ).size

  const previousApprovedRegistrations = approvedRegistrations.filter((registration) =>
    previousEventIds.has(registration.eventId),
  )
  const activePreviousAttendances = Object.values(state.attendances)
    .flat()
    .filter((attendance) => previousEventIds.has(attendance.eventId) && !attendance.undoneAt)
  const attendanceRegistrationIds = new Set(
    activePreviousAttendances
      .map((attendance) => attendance.registrationId)
      .filter((id): id is string => Boolean(id)),
  )
  const attendanceContactIds = new Set(
    activePreviousAttendances
      .map((attendance) => attendance.contactId)
      .filter((id): id is string => Boolean(id)),
  )
  const confirmedParticipantsPresent = previousApprovedRegistrations.filter(
    (registration) =>
      attendanceRegistrationIds.has(registration.id) ||
      Boolean(registration.contactId && attendanceContactIds.has(registration.contactId)),
  ).length
  const participationRate = previousApprovedRegistrations.length
    ? Math.round((confirmedParticipantsPresent / previousApprovedRegistrations.length) * 100)
    : 0

  const summaryCards = [
    {
      label: "Mailing Total",
      value: mailingTotal,
      note: "contatos ativos com e-mail",
      color: "green" as const,
    },
    {
      label: "Setores Prioritários",
      value: prioritySegments.length,
      note: `${formatNumber(prioritySubsegments)} subsetores`,
    },
    {
      label: "Setores Secundários",
      value: secondarySegments.length,
      note: `${formatNumber(secondarySubsegments)} subsetores secundários`,
    },
    {
      label: "Tipos de Organização",
      value: Object.keys(ORG_TYPE_LABELS).length,
      note: "empresas, entidades, órgãos etc",
    },
    {
      label: "Cargos",
      value: managerialPositions,
      note: "funções gerenciais",
    },
    {
      label: "Organizações",
      value: state.organizations.length,
      note: "empresas e outras entidades",
    },
    {
      label: "Eventos Futuros",
      value: futureEvents.length,
      note: "agendados ou em andamento",
      color: "green" as const,
    },
    {
      label: "Contatos Convidados",
      value: uniqueInvitedContacts,
      note: "convidados para próximos eventos",
    },
    {
      label: "Contatos Confirmados",
      value: uniqueConfirmedContacts,
      note: "pessoas que garantiram presença",
      color: "green" as const,
    },
    {
      label: "Eventos Anteriores",
      value: previousEvents.length,
      note: "eventos já realizados",
    },
    {
      label: "Taxa de Participação",
      value: `${participationRate}%`,
      note: "taxa de presença nos últimos eventos",
      color: "green" as const,
    },
  ]

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-carbon-60 mb-1">
            Bem-vindo
          </p>
          <h1 className="text-2xl font-bold text-carbon">
            {user?.name}
          </h1>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 mb-8">
          {summaryCards.map((card) => (
            <StatCard
              key={card.label}
              label={card.label}
              value={card.value}
              note={card.note}
              color={card.color}
            />
          ))}
        </div>

        {/* Events list */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-carbon-60 mb-4">
            Eventos
          </h2>
          <div className="space-y-3">
            {state.events.map(ev => {
              const regs = state.registrations[ev.id] || []
              const att = (state.attendances[ev.id] || []).filter(a => !a.undoneAt)
              const confirmed = regs.filter(r => r.approvalStatus === "approved").length
              const present = att.length
              const pct = occupancyPercent(present, ev.capacity)

              return (
                <button
                  key={ev.id}
                  onClick={() => navigate(`/eventos/${ev.id}`)}
                  className="w-full text-left bg-white rounded-xl p-4 sm:p-5 border border-carbon-20 hover:border-green/40 hover:shadow-sm transition-fast group"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-carbon text-sm group-hover:text-green transition-fast sm:truncate">
                        {ev.title}
                      </h3>
                      <p className="text-carbon-60 text-xs mt-0.5 leading-relaxed">
                        {formatDate(ev.date)} · {ev.startTime}–{ev.endTime}{ev.venue ? ` · ${ev.venue}` : ""}
                      </p>
                    </div>
                    <span
                      className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{
                        background: ev.status === "upcoming" ? "#FFF4D6" : ev.status === "live" ? "#E8F4EF" : "#F4F4F1",
                        color: ev.status === "upcoming" ? "#9B6E00" : ev.status === "live" ? "#009C63" : "#7A7A78",
                      }}
                    >
                      {EVENT_STATUS_LABELS[ev.status]}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                    <Metric label="Confirmados" value={confirmed} />
                    <Metric label="Presentes" value={present} color="green" />
                    <Metric label="Capacidade" value={ev.capacity} />
                    <Metric label="Ocupação" value={`${pct}%`} />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  note,
  color = "carbon",
}: {
  label: string
  value: number | string
  note?: string
  color?: "green" | "carbon"
}) {
  const displayValue = typeof value === "number" ? formatNumber(value) : value

  return (
    <div className="bg-white rounded-xl p-4 sm:p-5 border border-carbon-20 min-w-0">
      <p className="text-[10px] sm:text-xs text-carbon-60 font-semibold uppercase tracking-wide mb-2 leading-4 min-h-8">
        {label}
      </p>
      <p className={`text-2xl sm:text-3xl font-bold ${color === "green" ? "text-green" : "text-carbon"}`}>
        {displayValue}
      </p>
      {note && (
        <p className="text-[10px] sm:text-[11px] text-carbon-60 mt-1.5 leading-4">
          {note}
        </p>
      )}
    </div>
  )
}

function Metric({ label, value, color = "carbon" }: { label: string; value: number | string; color?: "green" | "carbon" }) {
  const displayValue = typeof value === "number" ? formatNumber(value) : value

  return (
    <span>
      <span className={`font-bold ${color === "green" ? "text-green" : "text-carbon"}`}>{displayValue}</span>
      <span className="text-carbon-60 ml-1">{label}</span>
    </span>
  )
}
