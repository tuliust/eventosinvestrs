import { describe, expect, it } from "vitest"
import { DEFAULT_MAILING_FILTERS } from "@/lib/mailingApi"
import { filterMailingContacts } from "@/lib/mailingFilter"
import { appState, attendance, catalog, contact, event, organization } from "../fixtures/domain"

function filters(overrides: Partial<typeof DEFAULT_MAILING_FILTERS> = {}) {
  return {
    ...DEFAULT_MAILING_FILTERS,
    ...overrides,
    segmentTypes: overrides.segmentTypes || [],
    segmentIds: overrides.segmentIds || [],
    subsegmentIds: overrides.subsegmentIds || [],
    organizationIds: overrides.organizationIds || [],
    organizationTypeIds: overrides.organizationTypeIds || [],
    institutionalCategoryIds: overrides.institutionalCategoryIds || [],
    institutionalSubcategoryIds: overrides.institutionalSubcategoryIds || [],
    specialCategoryIds: overrides.specialCategoryIds || [],
    scopeIds: overrides.scopeIds || [],
    governmentSphereIds: overrides.governmentSphereIds || [],
    countries: overrides.countries || [],
    states: overrides.states || [],
    positions: overrides.positions || [],
    eventIds: overrides.eventIds || [],
    eventStatuses: overrides.eventStatuses || ["present"],
    classifications: overrides.classifications || [],
    involvementTypes: overrides.involvementTypes || [],
    relationshipLevels: overrides.relationshipLevels || [],
    accountManagers: overrides.accountManagers || [],
    origins: overrides.origins || [],
    seniorities: overrides.seniorities || [],
    relationshipTypes: overrides.relationshipTypes || [],
    communicationStatuses: overrides.communicationStatuses || ["active"],
    tags: overrides.tags || [],
    cities: overrides.cities || [],
    onlyWithEmail: overrides.onlyWithEmail ?? true,
  }
}

const orgA = organization({ id: "org-a", name: "Org A", primarySegmentId: "seg-agro", city: "Porto Alegre", state: "RS" })
const orgB = organization({ id: "org-b", name: "Org B", primarySegmentId: "seg-tech", city: "Caxias do Sul", state: "RS" })
const ana = contact({ id: "ana", firstName: "Ana", lastName: "Agro", organizationId: "org-a", organization: "Org A", position: "Diretora", tags: ["stakeholder"] })
const bruno = contact({ id: "bruno", firstName: "Bruno", lastName: "Tech", email: "bruno@example.com", organizationId: "org-b", organization: "Org B", position: "Gerente", tags: ["investidor"] })
const blocked = contact({ id: "blocked", firstName: "Bloqueado", lastName: "Teste", email: "blocked@example.com", organizationId: "org-a", communicationStatus: "unsubscribed" })
const noEmail = contact({ id: "no-email", firstName: "Sem", lastName: "Email", email: undefined, organizationId: "org-a" })

const state = appState({
  contacts: [ana, bruno, blocked, noEmail],
  organizations: [orgA, orgB],
  segments: [
    { id: "seg-agro", name: "Agro", type: "priority", color: "#009C63", active: true, sortOrder: 1, createdAt: "x", updatedAt: "x" },
    { id: "seg-tech", name: "Tecnologia", type: "priority", color: "#009C63", active: true, sortOrder: 2, createdAt: "x", updatedAt: "x" },
  ],
  events: [event({ id: "event-history" })],
  attendances: {
    "event-history": [attendance({ id: "att-history", eventId: "event-history", contactId: "ana", registrationId: undefined })],
  },
})

describe("filterMailingContacts", () => {
  it("aplica OR dentro do mesmo filtro", () => {
    const result = filterMailingContacts(state, catalog(), filters({ positions: ["Diretora", "Gerente"] }))
    expect(result.map((item) => item.contact.id)).toEqual(["ana", "bruno"])
  })

  it("aplica AND entre filtros diferentes", () => {
    const result = filterMailingContacts(state, catalog(), filters({ segmentIds: ["seg-agro"], positions: ["Diretora"] }))
    expect(result.map((item) => item.contact.id)).toEqual(["ana"])
  })

  it("exclui descadastrados e contatos sem e-mail no padrão operacional", () => {
    const result = filterMailingContacts(state, catalog(), filters())
    expect(result.map((item) => item.contact.id)).toEqual(["ana", "bruno"])
  })

  it("filtra por histórico de presença em evento", () => {
    const result = filterMailingContacts(state, catalog(), filters({ eventIds: ["event-history"], eventStatuses: ["present"] }))
    expect(result.map((item) => item.contact.id)).toEqual(["ana"])
  })

  it("combina tag e organização como condições AND", () => {
    const result = filterMailingContacts(state, catalog(), filters({ organizationIds: ["org-b"], tags: ["investidor", "stakeholder"] }))
    expect(result.map((item) => item.contact.id)).toEqual(["bruno"])
  })
})
