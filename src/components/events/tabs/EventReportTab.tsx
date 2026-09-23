import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useApp } from "@/contexts/AppContext"
import { isEventBeforeStart } from "@/lib/dateFormat"
import { exportEventReportPdf } from "@/lib/eventReportPdf"
import { loadMailingLists } from "@/lib/mailingApi"
import { fullName, occupancyPercent } from "@/lib/utils"
import type { Contact, Event, EventAttendance, EventRegistration, Organization } from "@/lib/types"

const normalize = (value?: string) => (value || "").trim().toLocaleLowerCase("pt-BR")
const pct = (part: number, total: number) => total ? Math.round((part / total) * 100) : 0

export default function EventReportTab({ event }: { event: Event }) {
  const { state } = useApp()
  const navigate = useNavigate()
  const [audienceCount, setAudienceCount] = useState(0)
  const [audienceError, setAudienceError] = useState("")
  const [exportError, setExportError] = useState("")

  useEffect(() => {
    let cancelled = false
    loadMailingLists(event.id)
      .then((lists) => {
        if (cancelled) return
        setAudienceCount(new Set(lists.flatMap((list) => list.contactIds)).size)
      })
      .catch((cause) => { if (!cancelled) setAudienceError(cause instanceof Error ? cause.message : "Não foi possível calcular o público selecionado.") })
    return () => { cancelled = true }
  }, [event.id])

  const contactsById = useMemo(() => new Map(state.contacts.map((contact) => [contact.id, contact])), [state.contacts])
  const organizationsById = useMemo(() => new Map(state.organizations.map((organization) => [organization.id, organization])), [state.organizations])
  const organizationsByName = useMemo(() => new Map(state.organizations.map((organization) => [normalize(organization.name), organization])), [state.organizations])
  const segmentsById = useMemo(() => new Map(state.segments.map((segment) => [segment.id, segment])), [state.segments])
  const subsegmentsById = useMemo(() => new Map(state.subsegments.map((subsegment) => [subsegment.id, subsegment])), [state.subsegments])

  const registrations = state.registrations[event.id] || []
  const lumaRegistrations = registrations.filter((registration) => registration.source === "luma")
  const confirmed = registrations.filter((registration) => registration.approvalStatus === "approved")
  const attendances = (state.attendances[event.id] || []).filter((attendance) => !attendance.undoneAt)
  const invites = state.invites[event.id] || []

  const attendanceForRegistration = (registration: EventRegistration) => attendances.some((attendance) =>
    attendance.registrationId === registration.id || Boolean(registration.contactId && attendance.contactId === registration.contactId),
  )
  const noShows = confirmed.filter((registration) => !attendanceForRegistration(registration))
  const walkIns = attendances.filter((attendance) => attendance.source === "walk_in")
  const beforeStart = isEventBeforeStart(event.date, event.startTime)
  const occupancy = occupancyPercent(beforeStart ? confirmed.length : attendances.length, event.capacity)

  const organizationForContact = (contact?: Contact) => {
    if (!contact) return undefined
    if (contact.organizationId) return organizationsById.get(contact.organizationId)
    return organizationsByName.get(normalize(contact.organization))
  }

  const contactForAttendance = (attendance: EventAttendance) => {
    if (attendance.contactId) return contactsById.get(attendance.contactId)
    const registration = attendance.registrationId ? registrations.find((item) => item.id === attendance.registrationId) : undefined
    return registration?.contactId ? contactsById.get(registration.contactId) : undefined
  }

  const newContacts = useMemo(() => {
    const ids = new Set<string>()
    for (const attendance of attendances) {
      const contact = contactForAttendance(attendance)
      if (contact?.origin === "walk_in") ids.add(contact.id)
    }
    for (const registration of registrations) {
      if (!registration.contactId) continue
      const contact = contactsById.get(registration.contactId)
      if (!contact || contact.origin !== "luma") continue
      const firstRegistration = Object.values(state.registrations).flat().filter((item) => item.contactId === contact.id)
        .sort((a, b) => a.registeredAt.localeCompare(b.registeredAt))[0]
      if (firstRegistration?.eventId === event.id) ids.add(contact.id)
    }
    return [...ids].map((id) => contactsById.get(id)).filter(Boolean) as Contact[]
  }, [attendances, registrations, contactsById, state.registrations, event.id])

  const presentContactIds = new Set(attendances.map((attendance) => attendance.contactId).filter(Boolean) as string[])
  const registeredContactIds = new Set(registrations.map((registration) => registration.contactId).filter(Boolean) as string[])
  const invitedPresentWithoutLuma = invites.filter((invite) => Boolean(invite.contactId && presentContactIds.has(invite.contactId) && !registeredContactIds.has(invite.contactId)))

  const breakdown = (getter: (attendance: EventAttendance, contact?: Contact, organization?: Organization) => string | string[] | undefined) => {
    const map = new Map<string, number>()
    for (const attendance of attendances) {
      const contact = contactForAttendance(attendance)
      const organization = organizationForContact(contact) || organizationsByName.get(normalize(attendance.company))
      const raw = getter(attendance, contact, organization)
      const values = Array.isArray(raw) ? raw : raw ? [raw] : []
      for (const value of values.map((item) => item.trim()).filter(Boolean)) map.set(value, (map.get(value) || 0) + 1)
    }
    return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"))
  }

  const sectorBreakdown = breakdown((_attendance, contact, organization) => {
    const contactSegments = contact ? state.contactSegmentations.filter((item) => item.contactId === contact.id).map((item) => segmentsById.get(item.segmentId)?.name).filter(Boolean) as string[] : []
    return contactSegments.length ? contactSegments : organization?.sector
  })
  const subsectorBreakdown = breakdown((_attendance, contact, organization) => {
    const values = contact ? state.contactSegmentations.filter((item) => item.contactId === contact.id && item.subsegmentId).map((item) => subsegmentsById.get(item.subsegmentId!)?.name).filter(Boolean) as string[] : []
    return values.length ? values : organization?.subsector
  })
  const orgTypeBreakdown = breakdown((_attendance, _contact, organization) => organization?.type)
  const institutionalBreakdown = breakdown((_attendance, _contact, organization) => organization?.institutionalCategoryId)
  const positionBreakdown = breakdown((attendance, contact) => contact?.position || attendance.position)
  const seniorityBreakdown = breakdown((_attendance, contact) => contact?.seniority)
  const organizationBreakdown = breakdown((attendance, contact) => contact?.organization || attendance.company)
  const locationBreakdown = breakdown((_attendance, contact, organization) => [contact?.city || organization?.city, contact?.state || organization?.state].filter(Boolean).join(" / ") || undefined)
  const originBreakdown = breakdown((_attendance, contact) => contact?.origin)

  const funnel = [
    { label: "Público selecionado", value: audienceCount },
    { label: "Convites enviados", value: invites.length },
    { label: "Inscrições", value: lumaRegistrations.length },
    { label: "Presenças", value: attendances.length },
  ]

  const metrics = [
    ["Público selecionado", audienceCount], ["Convites enviados", invites.length], ["Inscritos Luma", lumaRegistrations.length],
    ["Confirmados", confirmed.length], ["Presentes", attendances.length], ["No-show", noShows.length],
    ["Walk-ins", walkIns.length], ["Novos contatos", newContacts.length], ["Capacidade", event.capacity], ["Ocupação", `${occupancy}%`],
  ] as Array<[string, number | string]>

  const rates = [
    { label: "Público → Convite", value: pct(invites.length, audienceCount) },
    { label: "Convite → Inscrição", value: pct(lumaRegistrations.length, invites.length) },
    { label: "Inscrição → Presença", value: pct(attendances.length, lumaRegistrations.length) },
    { label: "No-show", value: pct(noShows.length, confirmed.length) },
    { label: "Walk-in share", value: pct(walkIns.length, attendances.length) },
  ]

  const breakdownSections = [
    { title: "Organizações com maior presença", rows: organizationBreakdown },
    { title: "Setores com maior presença", rows: sectorBreakdown },
    { title: "Subsetores", rows: subsectorBreakdown },
    { title: "Tipo de organização", rows: orgTypeBreakdown },
    { title: "Categoria institucional", rows: institutionalBreakdown },
    { title: "Cargo", rows: positionBreakdown },
    { title: "Senioridade", rows: seniorityBreakdown },
    { title: "Cidade / Estado", rows: locationBreakdown },
    { title: "Origem do contato", rows: originBreakdown },
  ]

  const personLists = [
    { title: "Convidados presentes sem Luma", items: invitedPresentWithoutLuma.map((invite) => invite.contactId ? contactsById.get(invite.contactId) : undefined).filter(Boolean).map((contact) => fullName(contact!)), empty: "Nenhum caso identificado." },
    { title: "Inscritos que não compareceram", items: noShows.map((registration) => registration.name), empty: "Nenhum no-show identificado." },
    { title: "Participantes espontâneos", items: walkIns.map((attendance) => attendance.name), empty: "Nenhum walk-in identificado." },
    { title: "Novos contatos originados pelo evento", items: newContacts.map(fullName), empty: "Nenhum novo contato identificado com vínculo seguro ao evento." },
  ]

  const handleExportPdf = () => {
    setExportError("")
    try {
      exportEventReportPdf({
        event,
        metrics: metrics.map(([label, value]) => ({ label, value })),
        funnel: funnel.map((item, index) => ({
          ...item,
          rateFromPrevious: index > 0 ? pct(item.value, funnel[index - 1].value) : undefined,
        })),
        rates,
        breakdowns: breakdownSections,
        lists: personLists,
      })
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : "Não foi possível gerar o PDF do relatório.")
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-neutral/40">
      <div className="max-w-[1500px] mx-auto p-5 space-y-5">
        {audienceError && <div className="rounded-xl bg-light-yellow px-4 py-3 text-xs font-semibold text-[#9B6E00]">{audienceError}</div>}
        {exportError && <div className="rounded-xl bg-light-magenta px-4 py-3 text-xs font-semibold text-magenta">{exportError}</div>}
        <section className="bg-white rounded-2xl border border-carbon-20 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div><p className="text-[11px] uppercase tracking-wide font-bold text-carbon-60">Dados reais do evento</p><h2 className="text-lg font-bold text-carbon mt-1">Relatório do evento</h2><p className="text-xs text-carbon-60 mt-1">Indicadores calculados a partir de público salvo, convites, inscrições e presenças registradas no Supabase.</p></div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <button type="button" onClick={handleExportPdf} className="px-4 py-2.5 rounded-xl bg-green text-white text-sm font-bold hover:opacity-90 transition-fast">↓ Exportar PDF</button>
            <button type="button" onClick={() => navigate(`/relatorios?event=${event.id}`)} className="px-4 py-2.5 rounded-xl border border-green text-green text-sm font-bold">Abrir relatórios gerais ↗</button>
          </div>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">{metrics.map(([label, value]) => <Metric key={label} label={label} value={value} />)}</section>

        <section className="bg-white rounded-2xl border border-carbon-20 p-5">
          <h3 className="font-bold text-carbon">Funil do evento</h3><p className="text-xs text-carbon-60 mt-1 mb-5">Público → convite → inscrição → presença</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">{funnel.map((item, index) => <div key={item.label} className="rounded-xl bg-neutral/60 border border-carbon-20 p-4"><p className="text-xs font-bold text-carbon-60">{item.label}</p><p className="text-2xl font-bold text-carbon mt-1">{item.value}</p>{index > 0 && <p className="text-[11px] text-green mt-1">{pct(item.value, funnel[index - 1].value)}% da etapa anterior</p>}</div>)}</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
            {rates.map((rate) => <Rate key={rate.label} label={rate.label} value={rate.value} />)}
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {breakdownSections.map((section) => <Breakdown key={section.title} title={section.title} rows={section.rows} />)}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {personLists.map((section) => <PersonList key={section.title} title={section.title} items={section.items} empty={section.empty} />)}
        </section>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number | string }) { return <div className="bg-white rounded-xl border border-carbon-20 px-4 py-3"><p className="text-[10px] uppercase tracking-wide font-bold text-carbon-60">{label}</p><p className="text-xl font-bold text-carbon mt-1">{value}</p></div> }
function Rate({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-carbon-20 p-3 text-center"><p className="text-lg font-bold text-green">{value}%</p><p className="text-[10px] text-carbon-60 mt-1">{label}</p></div> }
function Breakdown({ title, rows }: { title: string; rows: Array<{ label: string; count: number }> }) { return <div className="bg-white rounded-2xl border border-carbon-20 p-5"><h3 className="font-bold text-sm text-carbon mb-3">{title}</h3>{rows.length ? <div className="space-y-2">{rows.slice(0, 10).map((row) => <div key={row.label} className="flex items-center gap-3"><p className="flex-1 min-w-0 text-xs text-carbon truncate">{row.label}</p><div className="w-32 h-2 rounded-full bg-neutral overflow-hidden"><div className="h-full bg-green" style={{ width: `${Math.max(6, pct(row.count, rows[0]?.count || 1))}%` }} /></div><span className="w-8 text-right text-xs font-bold text-carbon">{row.count}</span></div>)}</div> : <p className="text-xs text-carbon-60">Sem dados suficientes.</p>}</div> }
function PersonList({ title, items, empty }: { title: string; items: string[]; empty: string }) { return <div className="bg-white rounded-2xl border border-carbon-20 p-5"><h3 className="font-bold text-sm text-carbon mb-3">{title}</h3>{items.length ? <div className="max-h-56 overflow-y-auto divide-y divide-carbon-20/60">{items.slice(0, 100).map((item, index) => <p key={`${item}-${index}`} className="py-2 text-xs text-carbon">{item}</p>)}</div> : <p className="text-xs text-carbon-60">{empty}</p>}</div> }
