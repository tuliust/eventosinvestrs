import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  useApp,
  useEvent,
  useEventRegistrations,
  useEventAttendances,
  useEventInvites,
} from "@/contexts/AppContext"
import { occupancyPercent } from "@/lib/utils"
import { formatDateBR, isEventBeforeStart } from "@/lib/dateFormat"
import { loadEventDetails, type EventDetails } from "@/lib/eventDetailsApi"
import { EVENT_FORMAT_LABELS, EVENT_STATUS_LABELS } from "@/lib/constants"
import ReceptionMode from "@/components/checkin/ReceptionMode"
import OverviewTab from "@/components/events/tabs/OverviewTab"
import AudienceTab from "@/components/events/tabs/AudienceTab"
import GuestsTab from "@/components/events/tabs/GuestsTab"
import LumaTab from "@/components/events/tabs/LumaTab"
import CheckinTab from "@/components/events/tabs/CheckinTab"
import ParticipantsTab from "@/components/events/tabs/ParticipantsTab"
import CommunicationsTab from "@/components/events/tabs/CommunicationsTab"
import EventReportTab from "@/components/events/tabs/EventReportTab"

type Tab =
  | "visao_geral"
  | "publico"
  | "convidados"
  | "luma"
  | "checkin"
  | "participantes"
  | "comunicacoes"
  | "relatorio"

const TABS: { id: Tab; label: string }[] = [
  { id: "visao_geral", label: "Visão Geral" },
  { id: "publico", label: "Público" },
  { id: "convidados", label: "Convidados" },
  { id: "luma", label: "Luma" },
  { id: "checkin", label: "Check-in" },
  { id: "participantes", label: "Participantes" },
  { id: "comunicacoes", label: "Comunicações" },
  { id: "relatorio", label: "Relatório" },
]

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { state } = useApp()
  const event = useEvent(id!)
  const registrations = useEventRegistrations(id!)
  const attendances = useEventAttendances(id!)
  const invites = useEventInvites(id!)
  const [activeTab, setActiveTab] = useState<Tab>("visao_geral")
  const [receptionMode, setReceptionMode] = useState(false)
  const [details, setDetails] = useState<EventDetails | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    void loadEventDetails(id)
      .then((result) => { if (!cancelled) setDetails(result) })
      .catch(() => { if (!cancelled) setDetails(null) })
    return () => { cancelled = true }
  }, [id])

  if (!event) {
    return (
      <div className="flex items-center justify-center h-full text-carbon-60">
        <div className="text-center">
          <p className="text-4xl mb-2 opacity-30">◈</p>
          <p>Evento não encontrado</p>
          <button onClick={() => navigate("/eventos")} className="mt-3 text-green text-sm font-semibold">← Voltar</button>
        </div>
      </div>
    )
  }

  if (receptionMode) {
    return <ReceptionMode event={event} onClose={() => setReceptionMode(false)} />
  }

  const confirmed = registrations.filter((r) => r.approvalStatus === "approved").length
  const present = attendances.filter((attendance) => !attendance.undoneAt).length
  const beforeStart = isEventBeforeStart(event.date, event.startTime)
  const pct = occupancyPercent(beforeStart ? confirmed : present, event.capacity)
  const isOnline = event.format === "online"
  const isHybrid = event.format === "hibrido"

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 bg-white border-b border-carbon-20">
        <div className="px-6 pt-5 pb-0">
          <div className="flex items-center gap-2 text-xs text-carbon-60 mb-3">
            <button onClick={() => navigate("/eventos")} className="hover:text-green transition-fast">Eventos</button>
            <span>/</span><span className="text-carbon font-medium truncate">{event.title}</span>
          </div>

          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: event.status === "upcoming" ? "#FFF4D6" : "#E8F4EF", color: event.status === "upcoming" ? "#9B6E00" : "#009C63" }}>{EVENT_STATUS_LABELS[event.status]}</span>
                <span className="text-xs text-carbon-60 font-medium">{event.type} · {EVENT_FORMAT_LABELS[event.format]}</span>
              </div>
              <h1 className="text-xl font-bold text-carbon leading-snug">{event.title}</h1>
              <div className="text-sm text-carbon-60 mt-1 flex flex-wrap items-center gap-x-1">
                <span>{formatDateBR(event.date)}</span><span>·</span><span>{event.startTime}–{event.endTime}</span>
                {isOnline ? (
                  details?.onlineUrl ? <><span>·</span><a href={details.onlineUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-green hover:underline">Acessar evento ↗</a></> : <><span>·</span><span>Online</span></>
                ) : event.venue ? <><span>·</span><span>{event.venue}</span></> : null}
                {isHybrid && details?.onlineUrl && <><span>·</span><a href={details.onlineUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-green hover:underline">Acesso online ↗</a></>}
              </div>
            </div>

            <div className="flex-shrink-0 flex items-center gap-2">
              {state.user?.role === "admin" && <button onClick={() => navigate(`/eventos/${event.id}/editar`)} className="px-4 py-2.5 rounded-xl text-sm font-bold border border-carbon-20 bg-white text-carbon hover:border-green/50 hover:text-green transition-fast">Editar informações</button>}
              <button onClick={() => setReceptionMode(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-fast hover:opacity-90 active:scale-95" style={{ background: "#009C63" }}><span>▶</span>Iniciar Modo Recepção</button>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm pb-4 border-b border-carbon-20/50 overflow-x-auto">
            {beforeStart ? <><Metric label="Convidados" value={invites.length} /><Metric label="Capacidade" value={event.capacity} /><Metric label="Confirmados" value={confirmed} color="green" /><Metric label="Ocupação" value={`${pct}%`} /></> : <><Metric label="Confirmados" value={confirmed} /><Metric label="Convidados" value={invites.length} /><Metric label="Presentes" value={present} color="green" /><Metric label="Capacidade" value={event.capacity} /><Metric label="Ocupação" value={`${pct}%`} /></>}
            {event.lumaUrl && <a href={event.lumaUrl} target="_blank" rel="noopener noreferrer" className="text-green text-xs font-semibold hover:underline" onClick={(e) => e.stopPropagation()}>Luma ↗</a>}
          </div>

          <nav className="flex gap-0 -mb-px overflow-x-auto">
            {TABS.map((tab) => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-fast ${activeTab === tab.id ? "border-green text-green" : "border-transparent text-carbon-60 hover:text-carbon"}`}>{tab.label}</button>)}
          </nav>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === "visao_geral" && <OverviewTab event={event} details={details} />}
        {activeTab === "publico" && <AudienceTab event={event} />}
        {activeTab === "convidados" && <GuestsTab event={event} />}
        {activeTab === "luma" && <LumaTab event={event} />}
        {activeTab === "checkin" && <CheckinTab event={event} />}
        {activeTab === "participantes" && <ParticipantsTab event={event} />}
        {activeTab === "comunicacoes" && <CommunicationsTab event={event} />}
        {activeTab === "relatorio" && <EventReportTab event={event} />}
      </div>
    </div>
  )
}

function Metric({ label, value, color = "carbon" }: { label: string; value: number | string; color?: "green" | "carbon" }) {
  return <span className="flex items-baseline gap-1 whitespace-nowrap"><span className={`font-bold text-base ${color === "green" ? "text-green" : "text-carbon"}`}>{value}</span><span className="text-carbon-60 text-xs">{label}</span></span>
}
