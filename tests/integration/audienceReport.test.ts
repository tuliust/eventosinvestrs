import { describe, expect, it } from "vitest"
import { calculateEventMetrics } from "@/lib/eventMetrics"
import { filterMailingContacts } from "@/lib/mailingFilter"
import { DEFAULT_MAILING_FILTERS } from "@/lib/mailingApi"
import { appState, attendance, catalog, contact, event, invite, organization, registration } from "../fixtures/domain"

describe("mailing → evento → relatório", () => {
  it("mantém público selecionado, convite, inscrição e presença como etapas distintas", () => {
    const contacts = [
      contact({ id: "c1", firstName: "Ana", email: "ana@example.com", organizationId: "o1", position: "Diretora" }),
      contact({ id: "c2", firstName: "Bruno", email: "bruno@example.com", organizationId: "o1", position: "Diretor" }),
      contact({ id: "c3", firstName: "Carla", email: "carla@example.com", organizationId: "o2", position: "Analista" }),
    ]
    const organizations = [
      organization({ id: "o1", name: "Empresa A" }),
      organization({ id: "o2", name: "Empresa B" }),
    ]
    const state = appState({ contacts, organizations })
    const selected = filterMailingContacts(
      state,
      catalog(),
      { ...DEFAULT_MAILING_FILTERS, positions: ["Diretora", "Diretor"] },
    )

    expect(selected.map((item) => item.contact.id)).toEqual(["c1", "c2"])

    const metrics = calculateEventMetrics({
      event: event({ capacity: 10 }),
      audienceCount: selected.length,
      invites: [invite({ contactId: "c1", email: "ana@example.com" })],
      registrations: [registration({ contactId: "c1", id: "r1" })],
      attendances: [attendance({ contactId: "c1", registrationId: "r1" })],
    })

    expect(metrics.audience).toBe(2)
    expect(metrics.invites).toBe(1)
    expect(metrics.lumaRegistrations).toBe(1)
    expect(metrics.present).toBe(1)
    expect(metrics.rates).toMatchObject({
      audienceToInvite: 50,
      inviteToRegistration: 100,
      registrationToPresence: 100,
    })
  })
})
