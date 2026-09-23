import type { AppState, Contact, Organization } from "@/lib/types"
import type { SegmentationsCatalog } from "@/lib/segmentationsCatalogApi"
import type { MailingFilters } from "@/lib/mailingApi"

export type MailingCandidate = {
  contact: Contact
  organization?: Organization
  name: string
  email: string
  position: string
  organizationName: string
  sector: string
  subsector: string
  attendedEvents: number
}

export type MailingOption = { value: string; label: string }

export type MailingFilterOptions = {
  segmentTypes: MailingOption[]
  segments: MailingOption[]
  subsegments: MailingOption[]
  organizations: MailingOption[]
  organizationTypes: MailingOption[]
  institutionalCategories: MailingOption[]
  institutionalSubcategories: MailingOption[]
  specialCategories: MailingOption[]
  scopes: MailingOption[]
  governmentSpheres: MailingOption[]
  countries: MailingOption[]
  states: MailingOption[]
  positions: MailingOption[]
  events: MailingOption[]
  eventStatuses: MailingOption[]
  classifications: MailingOption[]
  involvementTypes: MailingOption[]
  relationshipLevels: MailingOption[]
  accountManagers: MailingOption[]
  origins: MailingOption[]
  seniorities: MailingOption[]
  relationshipTypes: MailingOption[]
  communicationStatuses: MailingOption[]
  tags: MailingOption[]
  cities: MailingOption[]
}

function norm(value?: string | null) {
  return (value || "").trim().toLocaleLowerCase("pt-BR")
}

function uniqueOptions(values: Array<string | undefined | null>): MailingOption[] {
  const map = new Map<string, string>()
  for (const value of values) {
    const clean = (value || "").trim()
    if (!clean) continue
    const key = norm(clean)
    if (!map.has(key)) map.set(key, clean)
  }
  return [...map.values()]
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map((value) => ({ value, label: value }))
}

function matches(selected: string[], values: Array<string | undefined | null>) {
  if (selected.length === 0) return true
  const normalized = new Set(values.filter(Boolean).map((value) => norm(value)))
  return selected.some((value) => normalized.has(norm(value)))
}

function matchesIds(selected: string[], values: Array<string | undefined | null>) {
  if (selected.length === 0) return true
  const available = new Set(values.filter(Boolean) as string[])
  return selected.some((value) => available.has(value))
}

function contactName(contact: Contact) {
  return `${contact.firstName || ""} ${contact.lastName || ""}`.replace(/\s+/g, " ").trim()
}

function contactEmails(contact: Contact) {
  return [contact.email, contact.emailSecondary].filter(Boolean).map((value) => norm(value))
}

export function buildMailingFilterOptions(
  state: AppState,
  catalog: SegmentationsCatalog,
  excludeEventId?: string,
): MailingFilterOptions {
  return {
    segmentTypes: [
      { value: "priority", label: "Prioritário" },
      { value: "secondary", label: "Secundário" },
    ],
    segments: state.segments.filter((item) => item.active).map((item) => ({ value: item.id, label: item.name })),
    subsegments: state.subsegments.filter((item) => item.active).map((item) => ({ value: item.id, label: item.name })),
    organizations: [...state.organizations]
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .map((item) => ({ value: item.id, label: item.name })),
    organizationTypes: catalog.organizationTypes.filter((item) => item.active).map((item) => ({ value: item.id, label: item.name })),
    institutionalCategories: catalog.institutionalCategories.filter((item) => item.active).map((item) => ({ value: item.id, label: item.name })),
    institutionalSubcategories: catalog.institutionalSubcategories.filter((item) => item.active).map((item) => ({ value: item.id, label: item.name })),
    specialCategories: catalog.specialCategories.filter((item) => item.active).map((item) => ({ value: item.id, label: item.name })),
    scopes: catalog.scopes.filter((item) => item.active).map((item) => ({ value: item.id, label: item.name })),
    governmentSpheres: catalog.governmentSpheres.filter((item) => item.active).map((item) => ({ value: item.id, label: item.name })),
    countries: uniqueOptions([
      ...catalog.countries.filter((item) => item.active).map((item) => item.name),
      ...state.organizations.map((item) => item.country),
      ...state.contacts.map((item) => item.country),
    ]),
    states: uniqueOptions([
      ...catalog.states.filter((item) => item.active).flatMap((item) => [item.name, item.code]),
      ...state.organizations.map((item) => item.state),
      ...state.contacts.map((item) => item.state),
    ]),
    positions: uniqueOptions(state.contacts.map((item) => item.position)),
    events: state.events
      .filter((event) => event.id !== excludeEventId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((event) => ({ value: event.id, label: `${event.title} · ${event.date.split("-").reverse().join("/")}` })),
    eventStatuses: [
      { value: "present", label: "Presente" },
      { value: "confirmed", label: "Confirmado" },
      { value: "registered", label: "Inscrito" },
      { value: "invited", label: "Convidado" },
    ],
    classifications: uniqueOptions(state.organizations.map((item) => item.classificationType)),
    involvementTypes: uniqueOptions(state.organizations.map((item) => item.involvementType)),
    relationshipLevels: uniqueOptions(state.organizations.map((item) => item.relationshipLevel?.toString())),
    accountManagers: uniqueOptions(state.organizations.map((item) => item.accountManager)),
    origins: uniqueOptions(state.contacts.map((item) => item.origin)),
    seniorities: uniqueOptions(state.contacts.map((item) => item.seniority)),
    relationshipTypes: uniqueOptions(state.contacts.map((item) => item.relationshipType)),
    communicationStatuses: [
      { value: "active", label: "Ativo" },
      { value: "unsubscribed", label: "Descadastrado" },
      { value: "bounced", label: "Bounce" },
      { value: "invalid", label: "Inválido" },
    ],
    tags: uniqueOptions(state.contacts.flatMap((item) => item.tags || [])),
    cities: uniqueOptions([
      ...state.contacts.map((item) => item.city),
      ...state.organizations.map((item) => item.city),
    ]),
  }
}

export function filterMailingContacts(
  state: AppState,
  catalog: SegmentationsCatalog,
  filters: MailingFilters,
): MailingCandidate[] {
  const organizationById = new Map(state.organizations.map((item) => [item.id, item]))
  const segmentById = new Map(state.segments.map((item) => [item.id, item]))
  const subsegmentById = new Map(state.subsegments.map((item) => [item.id, item]))
  const countryById = new Map(catalog.countries.map((item) => [item.id, item.name]))
  const stateById = new Map(catalog.states.map((item) => [item.id, item]))

  const contactSegmentations = new Map<string, typeof state.contactSegmentations>()
  for (const item of state.contactSegmentations) {
    const current = contactSegmentations.get(item.contactId) || []
    current.push(item)
    contactSegmentations.set(item.contactId, current)
  }

  const organizationSpecials = new Map<string, Set<string>>()
  for (const link of catalog.organizationSpecialCategories) {
    const current = organizationSpecials.get(link.organizationId) || new Set<string>()
    current.add(link.specialCategoryId)
    organizationSpecials.set(link.organizationId, current)
  }

  const contactSpecials = new Map<string, Set<string>>()
  for (const link of catalog.contactSpecialCategories) {
    const current = contactSpecials.get(link.contactId) || new Set<string>()
    current.add(link.specialCategoryId)
    contactSpecials.set(link.contactId, current)
  }

  const contactInstitutional = new Map<string, Set<string>>()
  for (const link of catalog.contactInstitutionalCategories) {
    const current = contactInstitutional.get(link.contactId) || new Set<string>()
    current.add(link.institutionalCategoryId)
    contactInstitutional.set(link.contactId, current)
  }

  const eventStatusSets = new Map<string, Record<string, Set<string>>>()
  for (const event of state.events) {
    const present = new Set<string>()
    const confirmed = new Set<string>()
    const registered = new Set<string>()
    const invited = new Set<string>()

    for (const item of state.attendances[event.id] || []) {
      if (!item.undoneAt && item.contactId) present.add(item.contactId)
    }
    for (const item of state.registrations[event.id] || []) {
      if (item.contactId) {
        registered.add(item.contactId)
        if (item.approvalStatus === "approved") confirmed.add(item.contactId)
      }
    }
    for (const item of state.invites[event.id] || []) {
      if (item.contactId) invited.add(item.contactId)
    }

    eventStatusSets.set(event.id, { present, confirmed, registered, invited })
  }

  const eventEmailSets = new Map<string, Record<string, Set<string>>>()
  for (const event of state.events) {
    const confirmed = new Set<string>()
    const registered = new Set<string>()
    const invited = new Set<string>()
    for (const item of state.registrations[event.id] || []) {
      const email = norm(item.email)
      if (!email) continue
      registered.add(email)
      if (item.approvalStatus === "approved") confirmed.add(email)
    }
    for (const item of state.invites[event.id] || []) {
      const email = norm(item.email)
      if (email) invited.add(email)
    }
    eventEmailSets.set(event.id, { present: new Set<string>(), confirmed, registered, invited })
  }

  const candidates: MailingCandidate[] = []

  for (const contact of state.contacts) {
    const organization = contact.organizationId ? organizationById.get(contact.organizationId) : undefined
    const ownSegmentations = contactSegmentations.get(contact.id) || []
    const segmentIds = [organization?.primarySegmentId, ...ownSegmentations.map((item) => item.segmentId)].filter(Boolean) as string[]
    const subsegmentIds = [organization?.primarySubsegmentId, ...ownSegmentations.map((item) => item.subsegmentId)].filter(Boolean) as string[]
    const segmentTypes = segmentIds.map((id) => segmentById.get(id)?.type).filter(Boolean) as string[]
    const institutionalIds = [
      organization?.institutionalCategoryId,
      ...(contactInstitutional.get(contact.id) || new Set<string>()),
    ].filter(Boolean) as string[]
    const specialIds = [
      ...(organization ? organizationSpecials.get(organization.id) || new Set<string>() : new Set<string>()),
      ...(contactSpecials.get(contact.id) || new Set<string>()),
    ]
    const countries = [
      organization?.countryId ? countryById.get(organization.countryId) : undefined,
      organization?.country,
      contact.country,
    ]
    const stateCatalogItem = organization?.stateId ? stateById.get(organization.stateId) : undefined
    const states = [stateCatalogItem?.name, stateCatalogItem?.code, organization?.state, contact.state]
    const cities = [contact.city, organization?.city]
    const email = contact.email || contact.emailSecondary || ""

    if (filters.onlyWithEmail && !email) continue
    if (!matchesIds(filters.segmentTypes, segmentTypes)) continue
    if (!matchesIds(filters.segmentIds, segmentIds)) continue
    if (!matchesIds(filters.subsegmentIds, subsegmentIds)) continue
    if (!matchesIds(filters.organizationIds, [organization?.id])) continue
    if (!matchesIds(filters.organizationTypeIds, [organization?.organizationTypeId])) continue
    if (!matchesIds(filters.institutionalCategoryIds, institutionalIds)) continue
    if (!matchesIds(filters.institutionalSubcategoryIds, [organization?.institutionalSubcategoryId])) continue
    if (!matchesIds(filters.specialCategoryIds, specialIds)) continue
    if (!matchesIds(filters.scopeIds, [organization?.scopeId])) continue
    if (!matchesIds(filters.governmentSphereIds, [organization?.governmentSphereId])) continue
    if (!matches(filters.countries, countries)) continue
    if (!matches(filters.states, states)) continue
    if (!matches(filters.positions, [contact.position])) continue
    if (!matches(filters.classifications, [organization?.classificationType])) continue
    if (!matches(filters.involvementTypes, [organization?.involvementType])) continue
    if (!matches(filters.relationshipLevels, [organization?.relationshipLevel?.toString()])) continue
    if (!matches(filters.accountManagers, [organization?.accountManager])) continue
    if (!matches(filters.origins, [contact.origin])) continue
    if (!matches(filters.seniorities, [contact.seniority])) continue
    if (!matches(filters.relationshipTypes, [contact.relationshipType])) continue
    if (!matches(filters.communicationStatuses, [contact.communicationStatus])) continue
    if (!matches(filters.tags, contact.tags || [])) continue
    if (!matches(filters.cities, cities)) continue

    if (filters.eventIds.length > 0) {
      const statuses = filters.eventStatuses.length > 0
        ? filters.eventStatuses
        : ["present", "confirmed", "registered", "invited"]
      const emails = contactEmails(contact)
      const eventMatch = filters.eventIds.some((eventId) => {
        const statusSets = eventStatusSets.get(eventId)
        const emailSets = eventEmailSets.get(eventId)
        if (!statusSets || !emailSets) return false
        return statuses.some((status) => {
          if (statusSets[status]?.has(contact.id)) return true
          return emails.some((contactEmail) => emailSets[status]?.has(contactEmail))
        })
      })
      if (!eventMatch) continue
    }

    const displaySegmentId = organization?.primarySegmentId || ownSegmentations[0]?.segmentId
    const displaySubsegmentId = organization?.primarySubsegmentId || ownSegmentations[0]?.subsegmentId
    const attendedEvents = [...eventStatusSets.values()].filter((sets) => sets.present.has(contact.id)).length

    candidates.push({
      contact,
      organization,
      name: contactName(contact),
      email,
      position: contact.position || "—",
      organizationName: organization?.name || contact.organization || "—",
      sector: displaySegmentId ? segmentById.get(displaySegmentId)?.name || organization?.sector || "—" : organization?.sector || "—",
      subsector: displaySubsegmentId ? subsegmentById.get(displaySubsegmentId)?.name || organization?.subsector || "—" : organization?.subsector || "—",
      attendedEvents,
    })
  }

  return candidates.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
}
