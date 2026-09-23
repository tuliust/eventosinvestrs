import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect"
import { useApp } from "@/contexts/AppContext"
import { ORG_TYPE_LABELS } from "@/lib/constants"
import { exportRows, type ExportFormat, type ExportRow } from "@/lib/exportUtils"
import { loadMailingLists, type MailingList } from "@/lib/mailingApi"
import { fullName } from "@/lib/utils"
import type { Contact, Event, EventAttendance, EventInvite, EventRegistration, Organization, OrgType } from "@/lib/types"

const normalize = (value?: string) => (value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR")
const dateOnly = (value?: string) => value ? value.slice(0, 10) : ""
const formatDateTime = (value?: string) => value ? new Date(value).toLocaleString("pt-BR") : "—"
const organizationLocation = (organization?: Organization) => organization ? [organization.city, organization.state, organization.country].filter(Boolean).join(" · ") : ""
const eventLocation = (event: Event) => [event.city, event.state].filter(Boolean).join(" · ")

type DetailKind =
  | "events"
  | "contacts"
  | "organizations"
  | "participants"
  | "invites"
  | "registrations"
  | "presence"
  | "noShow"
  | "newContacts"
  | "participantOrganizations"

type DetailRecord = {
  id: string
  title: string
  subtitle?: string
  route?: string
}

type PersonRecord = {
  key: string
  name: string
  email?: string
  phone?: string
  organization?: string
  position?: string
  contact?: Contact
  eventIds: Set<string>
  invited: boolean
  registered: boolean
  present: boolean
}

function option(value: string, label = value): SelectOption {
  return { value, label }
}

export default function ReportsPage() {
  const { state } = useApp()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [detail, setDetail] = useState<DetailKind>("events")
  const [mailingLists, setMailingLists] = useState<MailingList[]>([])
  const [selectedMailingId, setSelectedMailingId] = useState("")
  const [mailingError, setMailingError] = useState("")

  const from = searchParams.get("from") || ""
  const to = searchParams.get("to") || ""
  const selectedEventId = searchParams.get("event") || ""
  const eventType = searchParams.get("eventType") || ""
  const sectorId = searchParams.get("sector") || ""
  const subsegmentId = searchParams.get("subsegment") || ""
  const organizationId = searchParams.get("organization") || ""
  const organizationType = searchParams.get("organizationType") || ""
  const locality = searchParams.get("locality") || ""

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  const clearFilters = () => setSearchParams({}, { replace: true })

  useEffect(() => {
    let cancelled = false
    void loadMailingLists()
      .then((lists) => {
        if (cancelled) return
        setMailingLists(lists)
        if (!selectedMailingId && lists[0]) setSelectedMailingId(lists[0].id)
      })
      .catch((cause) => {
        if (!cancelled) setMailingError(cause instanceof Error ? cause.message : "Não foi possível carregar os mailings salvos.")
      })
    return () => { cancelled = true }
  }, [])

  const contactsById = useMemo(() => new Map(state.contacts.map((item) => [item.id, item])), [state.contacts])
  const organizationsById = useMemo(() => new Map(state.organizations.map((item) => [item.id, item])), [state.organizations])
  const organizationsByName = useMemo(() => new Map(state.organizations.map((item) => [normalize(item.name), item])), [state.organizations])
  const eventsById = useMemo(() => new Map(state.events.map((item) => [item.id, item])), [state.events])
  const selectedSector = state.segments.find((item) => item.id === sectorId)
  const selectedSubsegment = state.subsegments.find((item) => item.id === subsegmentId)
  const selectedOrganization = organizationsById.get(organizationId)

  const organizationForContact = (contact?: Contact) => {
    if (!contact) return undefined
    if (contact.organizationId) return organizationsById.get(contact.organizationId)
    return organizationsByName.get(normalize(contact.organization))
  }

  const eventOrganizationNames = (event: Event) => {
    const names = new Set(event.organizations.filter(Boolean))
    for (const registration of state.registrations[event.id] || []) if (registration.company) names.add(registration.company)
    for (const attendance of (state.attendances[event.id] || []).filter((item) => !item.undoneAt)) if (attendance.company) names.add(attendance.company)
    for (const invite of state.invites[event.id] || []) {
      const contact = invite.contactId ? contactsById.get(invite.contactId) : undefined
      if (contact?.organization) names.add(contact.organization)
    }
    return [...names]
  }

  const eventOrganizations = (event: Event) => eventOrganizationNames(event)
    .map((name) => organizationsByName.get(normalize(name)))
    .filter(Boolean) as Organization[]

  const eventMatchesSector = (event: Event) => {
    if (!sectorId) return true
    if (event.sectorIds?.includes(sectorId)) return true
    if (selectedSector && event.sectors?.some((name) => normalize(name) === normalize(selectedSector.name))) return true
    return eventOrganizations(event).some((organization) => organization.primarySegmentId === sectorId || normalize(organization.sector) === normalize(selectedSector?.name))
  }

  const eventMatchesSubsegment = (event: Event) => {
    if (!subsegmentId) return true
    if (event.subsegmentIds?.includes(subsegmentId)) return true
    if (selectedSubsegment && event.subsectors?.some((name) => normalize(name) === normalize(selectedSubsegment.name))) return true
    return eventOrganizations(event).some((organization) => organization.primarySubsegmentId === subsegmentId || normalize(organization.subsector) === normalize(selectedSubsegment?.name))
  }

  const eventMatchesOrganization = (event: Event) => {
    if (!selectedOrganization) return true
    return eventOrganizationNames(event).some((name) => normalize(name) === normalize(selectedOrganization.name))
  }

  const eventMatchesOrganizationType = (event: Event) => {
    if (!organizationType) return true
    return eventOrganizations(event).some((organization) => organization.type === organizationType)
  }

  const eventMatchesLocality = (event: Event) => {
    if (!locality) return true
    if (normalize(eventLocation(event)) === normalize(locality)) return true
    return eventOrganizations(event).some((organization) => normalize(organizationLocation(organization)) === normalize(locality))
  }

  const filteredEvents = useMemo(() => state.events.filter((event) => {
    if (from && event.date < from) return false
    if (to && event.date > to) return false
    if (selectedEventId && event.id !== selectedEventId) return false
    if (eventType && normalize(event.type) !== normalize(eventType)) return false
    if (!eventMatchesSector(event)) return false
    if (!eventMatchesSubsegment(event)) return false
    if (!eventMatchesOrganization(event)) return false
    if (!eventMatchesOrganizationType(event)) return false
    if (!eventMatchesLocality(event)) return false
    return true
  }), [state.events, state.registrations, state.attendances, state.invites, state.organizations, state.contacts, from, to, selectedEventId, eventType, sectorId, subsegmentId, organizationId, organizationType, locality, selectedSector?.name, selectedSubsegment?.name])

  const filteredEventIds = useMemo(() => new Set(filteredEvents.map((event) => event.id)), [filteredEvents])
  const registrations = useMemo(() => filteredEvents.flatMap((event) => state.registrations[event.id] || []), [filteredEvents, state.registrations])
  const approvedRegistrations = useMemo(() => registrations.filter((item) => item.approvalStatus === "approved"), [registrations])
  const attendances = useMemo(() => filteredEvents.flatMap((event) => (state.attendances[event.id] || []).filter((item) => !item.undoneAt)), [filteredEvents, state.attendances])
  const invites = useMemo(() => filteredEvents.flatMap((event) => state.invites[event.id] || []), [filteredEvents, state.invites])

  const attendanceMatchesRegistration = (registration: EventRegistration) => {
    const eventAttendances = (state.attendances[registration.eventId] || []).filter((item) => !item.undoneAt)
    return eventAttendances.some((attendance) =>
      attendance.registrationId === registration.id ||
      Boolean(registration.contactId && attendance.contactId === registration.contactId),
    )
  }

  const noShows = useMemo(() => approvedRegistrations.filter((registration) => !attendanceMatchesRegistration(registration)), [approvedRegistrations, state.attendances])
  const walkIns = useMemo(() => attendances.filter((attendance) => attendance.source === "walk_in"), [attendances])

  const participantMap = useMemo(() => {
    const map = new Map<string, PersonRecord>()
    const keyFor = (contactId?: string, email?: string, name?: string, company?: string) => {
      if (contactId) return `contact:${contactId}`
      if (email) return `email:${normalize(email)}`
      return `person:${normalize(name)}:${normalize(company)}`
    }
    const ensure = (params: { contactId?: string; email?: string; name?: string; company?: string; position?: string; eventId: string }) => {
      const contact = params.contactId ? contactsById.get(params.contactId) : undefined
      const key = keyFor(params.contactId, params.email || contact?.email, params.name || (contact ? fullName(contact) : ""), params.company || contact?.organization)
      const current = map.get(key) || {
        key,
        name: contact ? fullName(contact) : params.name || params.email || "Participante",
        email: contact?.email || params.email,
        phone: contact?.whatsapp || contact?.phone,
        organization: contact?.organization || params.company,
        position: contact?.position || params.position,
        contact,
        eventIds: new Set<string>(),
        invited: false,
        registered: false,
        present: false,
      }
      current.eventIds.add(params.eventId)
      map.set(key, current)
      return current
    }
    for (const invite of invites) {
      const contact = invite.contactId ? contactsById.get(invite.contactId) : undefined
      const person = ensure({ contactId: invite.contactId, email: invite.email, name: contact ? fullName(contact) : invite.email, company: contact?.organization, position: contact?.position, eventId: invite.eventId })
      person.invited = true
    }
    for (const registration of registrations) {
      const person = ensure({ contactId: registration.contactId, email: registration.email, name: registration.name, company: registration.company, position: registration.position, eventId: registration.eventId })
      person.registered = true
    }
    for (const attendance of attendances) {
      const registration = attendance.registrationId ? registrations.find((item) => item.id === attendance.registrationId) : undefined
      const person = ensure({ contactId: attendance.contactId || registration?.contactId, email: registration?.email, name: attendance.name, company: attendance.company || registration?.company, position: attendance.position || registration?.position, eventId: attendance.eventId })
      person.present = true
    }
    return map
  }, [invites, registrations, attendances, contactsById])

  const participantRecords = useMemo(() => [...participantMap.values()], [participantMap])
  const scopedContactIds = useMemo(() => new Set(participantRecords.map((person) => person.contact?.id).filter(Boolean) as string[]), [participantRecords])
  const scopedContacts = useMemo(() => state.contacts.filter((contact) => scopedContactIds.has(contact.id)), [state.contacts, scopedContactIds])

  const scopedOrganizations = useMemo(() => {
    const ids = new Set<string>()
    for (const event of filteredEvents) {
      for (const organization of eventOrganizations(event)) ids.add(organization.id)
    }
    for (const person of participantRecords) {
      const organization = organizationForContact(person.contact) || organizationsByName.get(normalize(person.organization))
      if (organization) ids.add(organization.id)
    }
    return state.organizations.filter((organization) => ids.has(organization.id))
  }, [filteredEvents, participantRecords, state.organizations, organizationsByName, organizationsById])

  const newContacts = useMemo(() => scopedContacts.filter((contact) => {
    const created = dateOnly(contact.createdAt)
    if (from && created < from) return false
    if (to && created > to) return false
    return true
  }), [scopedContacts, from, to])

  const participantOrganizations = useMemo(() => {
    const ids = new Set<string>()
    const names = new Set<string>()
    for (const attendance of attendances) {
      const contact = attendance.contactId ? contactsById.get(attendance.contactId) : undefined
      const organization = organizationForContact(contact) || organizationsByName.get(normalize(attendance.company))
      if (organization) ids.add(organization.id)
      else if (attendance.company) names.add(normalize(attendance.company))
    }
    return { known: state.organizations.filter((organization) => ids.has(organization.id)), unknownCount: names.size }
  }, [attendances, state.organizations, contactsById, organizationsByName])

  const averageConversion = useMemo(() => {
    const values = filteredEvents.map((event) => {
      const approved = (state.registrations[event.id] || []).filter((item) => item.approvalStatus === "approved").length
      if (!approved) return null
      const present = (state.attendances[event.id] || []).filter((item) => !item.undoneAt).length
      return Math.min(100, (present / approved) * 100)
    }).filter((value): value is number => value !== null)
    if (!values.length) return 0
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
  }, [filteredEvents, state.registrations, state.attendances])

  const eventRanking = useMemo(() => filteredEvents
    .map((event) => ({ event, count: (state.attendances[event.id] || []).filter((item) => !item.undoneAt).length }))
    .sort((a, b) => b.count - a.count || a.event.title.localeCompare(b.event.title, "pt-BR"))
    .slice(0, 8), [filteredEvents, state.attendances])

  const recurringContacts = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const attendance of attendances) {
      if (!attendance.contactId) continue
      const events = map.get(attendance.contactId) || new Set<string>()
      events.add(attendance.eventId)
      map.set(attendance.contactId, events)
    }
    return [...map.entries()]
      .map(([contactId, eventIds]) => ({ contact: contactsById.get(contactId), count: eventIds.size }))
      .filter((item): item is { contact: Contact; count: number } => Boolean(item.contact))
      .sort((a, b) => b.count - a.count || fullName(a.contact).localeCompare(fullName(b.contact), "pt-BR"))
      .slice(0, 8)
  }, [attendances, contactsById])

  const recurringOrganizations = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const attendance of attendances) {
      const contact = attendance.contactId ? contactsById.get(attendance.contactId) : undefined
      const organization = organizationForContact(contact) || organizationsByName.get(normalize(attendance.company))
      if (!organization) continue
      const events = map.get(organization.id) || new Set<string>()
      events.add(attendance.eventId)
      map.set(organization.id, events)
    }
    return [...map.entries()]
      .map(([organizationId, eventIds]) => ({ organization: organizationsById.get(organizationId), count: eventIds.size }))
      .filter((item): item is { organization: Organization; count: number } => Boolean(item.organization))
      .sort((a, b) => b.count - a.count || a.organization.name.localeCompare(b.organization.name, "pt-BR"))
      .slice(0, 8)
  }, [attendances, contactsById, organizationsById, organizationsByName])

  const eventOptions = useMemo<SelectOption[]>(() => [...state.events].sort((a, b) => b.date.localeCompare(a.date)).map((event) => option(event.id, `${event.date.split("-").reverse().join("/")} · ${event.title}`)), [state.events])
  const eventTypeOptions = useMemo<SelectOption[]>(() => [...new Set(state.events.map((event) => event.type).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")).map((value) => option(value)), [state.events])
  const sectorOptions = useMemo<SelectOption[]>(() => state.segments.filter((item) => item.active).map((item) => option(item.id, item.name)), [state.segments])
  const subsegmentOptions = useMemo<SelectOption[]>(() => state.subsegments.filter((item) => item.active && (!sectorId || item.segmentId === sectorId)).map((item) => option(item.id, item.name)), [state.subsegments, sectorId])
  const organizationOptions = useMemo<SelectOption[]>(() => state.organizations.map((organization) => option(organization.id, organization.name)), [state.organizations])
  const organizationTypeOptions = useMemo<SelectOption[]>(() => (Object.entries(ORG_TYPE_LABELS) as Array<[OrgType, string]>).map(([value, label]) => option(value, label)), [])
  const localityOptions = useMemo<SelectOption[]>(() => {
    const values = new Set<string>()
    state.events.forEach((event) => { const value = eventLocation(event); if (value) values.add(value) })
    state.organizations.forEach((organization) => { const value = organizationLocation(organization); if (value) values.add(value) })
    return [...values].sort((a, b) => a.localeCompare(b, "pt-BR")).map((value) => option(value))
  }, [state.events, state.organizations])

  const openDetail = (kind: DetailKind) => {
    setDetail(kind)
    window.setTimeout(() => document.getElementById("detalhamento-relatorio")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0)
  }

  const detailRecords = useMemo<DetailRecord[]>(() => {
    if (detail === "events") return filteredEvents.map((event) => ({ id: event.id, title: event.title, subtitle: `${event.date.split("-").reverse().join("/")} · ${event.type}`, route: `/eventos/${event.id}` }))
    if (detail === "contacts") return scopedContacts.map((contact) => ({ id: contact.id, title: fullName(contact), subtitle: [contact.position, contact.organization, contact.email].filter(Boolean).join(" · "), route: `/contatos/${contact.id}` }))
    if (detail === "organizations") return scopedOrganizations.map((organization) => ({ id: organization.id, title: organization.name, subtitle: [ORG_TYPE_LABELS[organization.type], organization.sector, organizationLocation(organization)].filter(Boolean).join(" · "), route: `/organizacoes/${organization.id}` }))
    if (detail === "participants") return participantRecords.map((person) => ({ id: person.key, title: person.name, subtitle: [`${person.eventIds.size} evento(s)`, person.organization, person.email].filter(Boolean).join(" · "), route: person.contact ? `/contatos/${person.contact.id}` : undefined }))
    if (detail === "invites") return invites.map((invite) => { const contact = invite.contactId ? contactsById.get(invite.contactId) : undefined; const event = eventsById.get(invite.eventId); return { id: invite.id, title: contact ? fullName(contact) : invite.email, subtitle: [event?.title, invite.status, invite.email].filter(Boolean).join(" · "), route: contact ? `/contatos/${contact.id}` : event ? `/eventos/${event.id}` : undefined } })
    if (detail === "registrations") return registrations.map((registration) => ({ id: registration.id, title: registration.name, subtitle: [eventsById.get(registration.eventId)?.title, registration.company, registration.email].filter(Boolean).join(" · "), route: registration.contactId ? `/contatos/${registration.contactId}` : `/eventos/${registration.eventId}` }))
    if (detail === "presence") return attendances.map((attendance) => ({ id: attendance.id, title: attendance.name, subtitle: [eventsById.get(attendance.eventId)?.title, attendance.company, formatDateTime(attendance.checkedInAt)].filter(Boolean).join(" · "), route: attendance.contactId ? `/contatos/${attendance.contactId}` : `/eventos/${attendance.eventId}` }))
    if (detail === "noShow") return noShows.map((registration) => ({ id: registration.id, title: registration.name, subtitle: [eventsById.get(registration.eventId)?.title, registration.company, registration.email].filter(Boolean).join(" · "), route: registration.contactId ? `/contatos/${registration.contactId}` : `/eventos/${registration.eventId}` }))
    if (detail === "newContacts") return newContacts.map((contact) => ({ id: contact.id, title: fullName(contact), subtitle: [contact.organization, contact.email, `Criado em ${dateOnly(contact.createdAt).split("-").reverse().join("/")}`].filter(Boolean).join(" · "), route: `/contatos/${contact.id}` }))
    return participantOrganizations.known.map((organization) => ({ id: organization.id, title: organization.name, subtitle: [ORG_TYPE_LABELS[organization.type], organization.sector].filter(Boolean).join(" · "), route: `/organizacoes/${organization.id}` }))
  }, [detail, filteredEvents, scopedContacts, scopedOrganizations, participantRecords, invites, registrations, attendances, noShows, newContacts, participantOrganizations.known, contactsById, eventsById])

  const exportData = useMemo(() => {
    const publicRows: ExportRow[] = participantRecords.map((person) => ({
      "Nome": person.name,
      "E-mail": person.email || "",
      "Telefone": person.phone || "",
      "Organização": person.organization || "",
      "Cargo": person.position || "",
      "Eventos no recorte": person.eventIds.size,
      "Situação": person.present ? "Presente" : person.registered ? "Inscrito" : person.invited ? "Convidado" : "Público",
    }))
    const inviteRows: ExportRow[] = invites.map((invite) => {
      const contact = invite.contactId ? contactsById.get(invite.contactId) : undefined
      return {
        "Evento": eventsById.get(invite.eventId)?.title || "",
        "Nome": contact ? fullName(contact) : "",
        "E-mail": invite.email,
        "Organização": contact?.organization || "",
        "Status do convite": invite.status,
        "Enviado em": formatDateTime(invite.invitedAt),
      }
    })
    const registrationRows: ExportRow[] = registrations.map((registration) => ({
      "Evento": eventsById.get(registration.eventId)?.title || "",
      "Nome": registration.name,
      "E-mail": registration.email || "",
      "Telefone": registration.phone || "",
      "Organização": registration.company || "",
      "Cargo": registration.position || "",
      "Status da inscrição": registration.approvalStatus,
      "Origem": registration.source,
      "Inscrito em": formatDateTime(registration.registeredAt),
    }))
    const presenceRows: ExportRow[] = attendances.map((attendance) => {
      const registration = attendance.registrationId ? registrations.find((item) => item.id === attendance.registrationId) : undefined
      const contact = attendance.contactId ? contactsById.get(attendance.contactId) : undefined
      return {
        "Evento": eventsById.get(attendance.eventId)?.title || "",
        "Nome": attendance.name,
        "E-mail": contact?.email || registration?.email || "",
        "Organização": attendance.company || contact?.organization || registration?.company || "",
        "Cargo": attendance.position || contact?.position || registration?.position || "",
        "Check-in em": formatDateTime(attendance.checkedInAt),
        "Origem": attendance.source,
      }
    })
    const noShowRows: ExportRow[] = noShows.map((registration) => ({
      "Evento": eventsById.get(registration.eventId)?.title || "",
      "Nome": registration.name,
      "E-mail": registration.email || "",
      "Telefone": registration.phone || "",
      "Organização": registration.company || "",
      "Cargo": registration.position || "",
      "Status da inscrição": registration.approvalStatus,
    }))
    const walkInRows = presenceRows.filter((_, index) => attendances[index]?.source === "walk_in")
    const consolidatedRows: ExportRow[] = filteredEvents.map((event) => {
      const eventRegistrations = state.registrations[event.id] || []
      const eventApproved = eventRegistrations.filter((item) => item.approvalStatus === "approved")
      const eventPresence = (state.attendances[event.id] || []).filter((item) => !item.undoneAt)
      const eventNoShow = eventApproved.filter((registration) => !attendanceMatchesRegistration(registration)).length
      return {
        "Evento": event.title,
        "Data": event.date.split("-").reverse().join("/"),
        "Tipo": event.type,
        "Formato": event.format,
        "Localidade": eventLocation(event),
        "Convites": (state.invites[event.id] || []).length,
        "Inscrições": eventRegistrations.length,
        "Inscrições aprovadas": eventApproved.length,
        "Presentes": eventPresence.length,
        "No-show": eventNoShow,
        "Walk-ins": eventPresence.filter((item) => item.source === "walk_in").length,
        "Conversão (%)": eventApproved.length ? Math.round((eventPresence.length / eventApproved.length) * 100) : 0,
      }
    })
    return { publicRows, inviteRows, registrationRows, presenceRows, noShowRows, walkInRows, consolidatedRows }
  }, [participantRecords, invites, registrations, attendances, noShows, filteredEvents, contactsById, eventsById, state.registrations, state.attendances, state.invites])

  const selectedMailing = mailingLists.find((list) => list.id === selectedMailingId)
  const mailingRows = useMemo<ExportRow[]>(() => {
    if (!selectedMailing) return []
    if (selectedMailing.eventId && !filteredEventIds.has(selectedMailing.eventId)) return []
    return selectedMailing.contactIds
      .map((id) => contactsById.get(id))
      .filter((contact): contact is Contact => Boolean(contact))
      .filter((contact) => {
        const organization = organizationForContact(contact)
        if (organizationId && organization?.id !== organizationId) return false
        if (organizationType && organization?.type !== organizationType) return false
        if (sectorId && organization?.primarySegmentId !== sectorId && normalize(organization?.sector) !== normalize(selectedSector?.name)) return false
        if (subsegmentId && organization?.primarySubsegmentId !== subsegmentId && normalize(organization?.subsector) !== normalize(selectedSubsegment?.name)) return false
        if (locality && normalize(organizationLocation(organization)) !== normalize(locality) && normalize([contact.city, contact.state, contact.country].filter(Boolean).join(" · ")) !== normalize(locality)) return false
        return true
      })
      .map((contact) => ({
        "Nome": fullName(contact),
        "E-mail": contact.email || "",
        "Telefone": contact.whatsapp || contact.phone || "",
        "Organização": contact.organization || "",
        "Cargo": contact.position || "",
        "Status de comunicação": contact.communicationStatus,
      }))
  }, [selectedMailing, filteredEventIds, contactsById, organizationId, organizationType, sectorId, subsegmentId, locality, selectedSector?.name, selectedSubsegment?.name, organizationsById, organizationsByName])

  const doExport = (rows: ExportRow[], name: string, format: ExportFormat) => {
    exportRows(rows, name, format, name.replace(/-/g, " "))
  }

  return (
    <div className="h-full overflow-y-auto bg-neutral">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-5 space-y-5">
        <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-carbon-60">Visão geral da plataforma</p>
            <h1 className="text-2xl font-bold text-carbon mt-1">Relatórios</h1>
            <p className="text-sm text-carbon-60 mt-1">Indicadores, recorrência, funil de participação e exportações respeitando o recorte atual.</p>
          </div>
          <button type="button" onClick={clearFilters} className="px-4 py-2.5 rounded-xl border border-carbon-20 bg-white text-sm font-bold text-carbon hover:border-green/40">Limpar filtros</button>
        </header>

        <section className="bg-white rounded-2xl border border-carbon-20 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <Field label="Período — início"><input type="date" value={from} onChange={(event) => setParam("from", event.target.value)} className={inputClass} /></Field>
            <Field label="Período — fim"><input type="date" value={to} onChange={(event) => setParam("to", event.target.value)} className={inputClass} /></Field>
            <SearchableSelect id="report-filter-event" label="Evento" value={selectedEventId} options={eventOptions} onChange={(value) => setParam("event", value)} />
            <SearchableSelect id="report-filter-event-type" label="Tipo de evento" value={eventType} options={eventTypeOptions} onChange={(value) => setParam("eventType", value)} />
            <SearchableSelect id="report-filter-sector" label="Setor" value={sectorId} options={sectorOptions} onChange={(value) => { const next = new URLSearchParams(searchParams); if (value) next.set("sector", value); else next.delete("sector"); next.delete("subsegment"); setSearchParams(next, { replace: true }) }} />
            <SearchableSelect id="report-filter-subsegment" label="Subsetor" value={subsegmentId} options={subsegmentOptions} disabled={!sectorId} placeholder={sectorId ? "Selecionar" : "Selecione um setor"} onChange={(value) => setParam("subsegment", value)} />
            <SearchableSelect id="report-filter-organization" label="Organização" value={organizationId} options={organizationOptions} onChange={(value) => setParam("organization", value)} />
            <SearchableSelect id="report-filter-organization-type" label="Tipo de organização" value={organizationType} options={organizationTypeOptions} onChange={(value) => setParam("organizationType", value)} />
            <div className="sm:col-span-2 xl:col-span-4"><SearchableSelect id="report-filter-locality" label="Localidade" value={locality} options={localityOptions} onChange={(value) => setParam("locality", value)} /></div>
          </div>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-3">
          <MetricCard label="Total de eventos" value={filteredEvents.length} hint="eventos no recorte" onClick={() => openDetail("events")} />
          <MetricCard label="Total de contatos" value={scopedContacts.length} hint="contatos vinculados ao recorte" onClick={() => openDetail("contacts")} />
          <MetricCard label="Total de organizações" value={scopedOrganizations.length} hint="organizações relacionadas" onClick={() => openDetail("organizations")} />
          <MetricCard label="Total de participantes" value={participantRecords.length} hint="pessoas únicas com interação" onClick={() => openDetail("participants")} />
          <MetricCard label="Total de convites" value={invites.length} onClick={() => openDetail("invites")} />
          <MetricCard label="Total de inscrições" value={registrations.length} onClick={() => openDetail("registrations")} />
          <MetricCard label="Presença" value={attendances.length} tone="green" onClick={() => openDetail("presence")} />
          <MetricCard label="No-show" value={noShows.length} tone="magenta" onClick={() => openDetail("noShow")} />
          <MetricCard label="Novos contatos" value={newContacts.length} hint="criados no período do recorte" onClick={() => openDetail("newContacts")} />
          <MetricCard label="Organizações participantes" value={participantOrganizations.known.length + participantOrganizations.unknownCount} hint="com presença registrada" onClick={() => openDetail("participantOrganizations")} />
          <MetricCard label="Taxa média de conversão" value={`${averageConversion}%`} hint="presença ÷ inscrições aprovadas" />
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <RankingCard title="Eventos com maior presença" rows={eventRanking.map(({ event, count }) => ({ id: event.id, label: event.title, value: `${count} presente(s)`, onClick: () => navigate(`/eventos/${event.id}`) }))} empty="Nenhum evento no recorte." />
          <RankingCard title="Contatos mais recorrentes" rows={recurringContacts.map(({ contact, count }) => ({ id: contact.id, label: fullName(contact), value: `${count} evento(s)`, onClick: () => navigate(`/contatos/${contact.id}`) }))} empty="Nenhum contato recorrente no recorte." />
          <RankingCard title="Organizações mais recorrentes" rows={recurringOrganizations.map(({ organization, count }) => ({ id: organization.id, label: organization.name, value: `${count} evento(s)`, onClick: () => navigate(`/organizacoes/${organization.id}`) }))} empty="Nenhuma organização recorrente no recorte." />
        </section>

        <section id="detalhamento-relatorio" className="bg-white rounded-2xl border border-carbon-20 overflow-hidden scroll-mt-4">
          <div className="px-5 py-4 border-b border-carbon-20 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div><h2 className="font-bold text-carbon">Registros correspondentes</h2><p className="text-xs text-carbon-60 mt-0.5">{detailRecords.length} registro(s). Clique em um item para abrir o cadastro quando houver vínculo.</p></div>
            <select value={detail} onChange={(event) => setDetail(event.target.value as DetailKind)} className="px-3 py-2 rounded-xl border border-carbon-20 text-xs font-bold text-carbon bg-white">
              <option value="events">Eventos</option><option value="contacts">Contatos</option><option value="organizations">Organizações</option><option value="participants">Participantes</option><option value="invites">Convites</option><option value="registrations">Inscrições</option><option value="presence">Presentes</option><option value="noShow">No-show</option><option value="newContacts">Novos contatos</option><option value="participantOrganizations">Organizações participantes</option>
            </select>
          </div>
          <div className="max-h-[520px] overflow-y-auto divide-y divide-carbon-20/60">
            {detailRecords.map((record) => (
              <button key={record.id} type="button" disabled={!record.route} onClick={() => record.route && navigate(record.route)} className="w-full px-5 py-3.5 flex items-center gap-4 text-left hover:bg-neutral/60 disabled:hover:bg-white disabled:cursor-default transition-fast">
                <div className="flex-1 min-w-0"><p className="text-sm font-bold text-carbon truncate">{record.title}</p>{record.subtitle && <p className="text-xs text-carbon-60 mt-0.5 truncate">{record.subtitle}</p>}</div>{record.route && <span className="text-xs font-bold text-green">Abrir →</span>}
              </button>
            ))}
            {detailRecords.length === 0 && <p className="px-5 py-10 text-center text-sm text-carbon-60">Nenhum registro corresponde aos filtros atuais.</p>}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-carbon-20 p-5">
          <div className="mb-4"><h2 className="font-bold text-carbon">Exportações</h2><p className="text-xs text-carbon-60 mt-1">CSV usa UTF-8 e colunas em português. XLSX é gerado localmente no navegador; IDs internos, notas e dados administrativos não são incluídos.</p></div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <ExportAction label="Público" count={exportData.publicRows.length} onExport={(format) => doExport(exportData.publicRows, "publico", format)} />
            <ExportAction label="Convidados" count={exportData.inviteRows.length} onExport={(format) => doExport(exportData.inviteRows, "convidados", format)} />
            <ExportAction label="Inscritos" count={exportData.registrationRows.length} onExport={(format) => doExport(exportData.registrationRows, "inscritos", format)} />
            <ExportAction label="Presentes" count={exportData.presenceRows.length} onExport={(format) => doExport(exportData.presenceRows, "presentes", format)} />
            <ExportAction label="No-show" count={exportData.noShowRows.length} onExport={(format) => doExport(exportData.noShowRows, "no-show", format)} />
            <ExportAction label="Walk-ins" count={exportData.walkInRows.length} onExport={(format) => doExport(exportData.walkInRows, "walk-ins", format)} />
            <ExportAction label="Relatório consolidado" count={exportData.consolidatedRows.length} onExport={(format) => doExport(exportData.consolidatedRows, "relatorio-consolidado", format)} />
            <div className="rounded-xl border border-carbon-20 p-4">
              <p className="text-sm font-bold text-carbon">Mailing salvo</p>
              <p className="text-xs text-carbon-60 mt-1 mb-3">{mailingRows.length} contato(s) após o recorte atual</p>
              {mailingError ? <p className="text-xs text-magenta">{mailingError}</p> : <>
                <select value={selectedMailingId} onChange={(event) => setSelectedMailingId(event.target.value)} className="w-full px-2.5 py-2 rounded-lg border border-carbon-20 text-xs text-carbon bg-white mb-2"><option value="">Selecionar mailing</option>{mailingLists.map((list) => <option key={list.id} value={list.id}>{list.title}</option>)}</select>
                <div className="grid grid-cols-2 gap-2"><button disabled={!selectedMailing || mailingRows.length === 0} onClick={() => doExport(mailingRows, `mailing-${selectedMailing?.title || "salvo"}`, "csv")} className="px-3 py-2 rounded-lg border border-green text-green text-xs font-bold disabled:opacity-40">CSV</button><button disabled={!selectedMailing || mailingRows.length === 0} onClick={() => doExport(mailingRows, `mailing-${selectedMailing?.title || "salvo"}`, "xlsx")} className="px-3 py-2 rounded-lg bg-green text-white text-xs font-bold disabled:opacity-40">XLSX</button></div>
              </>}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

const inputClass = "w-full px-3.5 py-2.5 rounded-xl border border-carbon-20 bg-white text-sm text-carbon focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-xs font-bold text-carbon mb-1.5">{label}</span>{children}</label>
}

function MetricCard({ label, value, hint, tone = "carbon", onClick }: { label: string; value: number | string; hint?: string; tone?: "carbon" | "green" | "magenta"; onClick?: () => void }) {
  const valueClass = tone === "green" ? "text-green" : tone === "magenta" ? "text-magenta" : "text-carbon"
  return <button type="button" onClick={onClick} disabled={!onClick} className="rounded-2xl border border-carbon-20 bg-white p-4 text-left hover:border-green/40 hover:shadow-sm disabled:hover:border-carbon-20 disabled:hover:shadow-none transition-fast"><p className="text-[11px] font-bold uppercase tracking-wide text-carbon-60">{label}</p><p className={`text-2xl font-bold mt-2 ${valueClass}`}>{value}</p>{hint && <p className="text-[11px] text-carbon-60 mt-1 leading-4">{hint}</p>}{onClick && <p className="text-[11px] font-bold text-green mt-2">Ver registros →</p>}</button>
}

function RankingCard({ title, rows, empty }: { title: string; rows: Array<{ id: string; label: string; value: string; onClick: () => void }>; empty: string }) {
  return <section className="rounded-2xl border border-carbon-20 bg-white overflow-hidden"><div className="px-4 py-3.5 border-b border-carbon-20"><h2 className="text-sm font-bold text-carbon">{title}</h2></div><div className="divide-y divide-carbon-20/60">{rows.map((row, index) => <button type="button" key={row.id} onClick={row.onClick} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-neutral/60"><span className="w-6 text-center text-xs font-bold text-carbon-40">{index + 1}</span><span className="flex-1 min-w-0 text-xs font-semibold text-carbon truncate">{row.label}</span><span className="text-[11px] font-bold text-green whitespace-nowrap">{row.value}</span></button>)}{rows.length === 0 && <p className="px-4 py-8 text-center text-xs text-carbon-60">{empty}</p>}</div></section>
}

function ExportAction({ label, count, onExport }: { label: string; count: number; onExport: (format: ExportFormat) => void }) {
  return <div className="rounded-xl border border-carbon-20 p-4"><p className="text-sm font-bold text-carbon">{label}</p><p className="text-xs text-carbon-60 mt-1 mb-3">{count} registro(s)</p><div className="grid grid-cols-2 gap-2"><button disabled={!count} onClick={() => onExport("csv")} className="px-3 py-2 rounded-lg border border-green text-green text-xs font-bold disabled:opacity-40">CSV</button><button disabled={!count} onClick={() => onExport("xlsx")} className="px-3 py-2 rounded-lg bg-green text-white text-xs font-bold disabled:opacity-40">XLSX</button></div></div>
}
