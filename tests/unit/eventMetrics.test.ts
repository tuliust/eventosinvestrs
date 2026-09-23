import { describe, expect, it } from "vitest"
import { calculateEventMetrics, percent } from "@/lib/eventMetrics"
import { attendance, event, invite, registration } from "../fixtures/domain"

describe("eventMetrics", () => {
  it("calcula percentuais com denominador zero", () => {
    expect(percent(5, 0)).toBe(0)
    expect(percent(1, 3)).toBe(33)
  })

  it("calcula funil, no-show, walk-in e ocupação com presenças ativas", () => {
    const registrations = [
      registration({ id: "r1", contactId: "c1", lumaGuestId: "g1", name: "Pessoa 1" }),
      registration({ id: "r2", contactId: "c2", lumaGuestId: "g2", name: "Pessoa 2" }),
      registration({ id: "r3", contactId: "c3", source: "invited", name: "Pessoa 3", approvalStatus: "pending" }),
    ]
    const attendances = [
      attendance({ id: "a1", contactId: "c1", registrationId: "r1", name: "Pessoa 1" }),
      attendance({ id: "a2", contactId: "walk", registrationId: undefined, name: "Walk In", source: "walk_in" }),
      attendance({ id: "a3", contactId: "old", name: "Desfeito", undoneAt: "2026-09-01T13:10:00Z" }),
    ]
    const invites = [
      invite({ id: "i1", contactId: "c1", email: "1@example.com" }),
      invite({ id: "i2", contactId: "c2", email: "2@example.com" }),
      invite({ id: "i3", contactId: "c4", email: "4@example.com" }),
      invite({ id: "i4", contactId: "c5", email: "5@example.com" }),
    ]

    const result = calculateEventMetrics({
      event: event({ capacity: 10 }),
      audienceCount: 8,
      registrations,
      attendances,
      invites,
      newContactsCount: 1,
    })

    expect(result).toMatchObject({
      audience: 8,
      invites: 4,
      lumaRegistrations: 2,
      confirmed: 2,
      present: 2,
      noShow: 1,
      walkIns: 1,
      newContacts: 1,
      capacity: 10,
      occupancy: 20,
      rates: {
        audienceToInvite: 50,
        inviteToRegistration: 50,
        registrationToPresence: 100,
        noShow: 50,
        walkInShare: 50,
      },
    })
  })

  it("antes do início calcula ocupação pelos confirmados", () => {
    const result = calculateEventMetrics({
      event: event({ capacity: 20 }),
      audienceCount: 0,
      registrations: [registration({ id: "r1" }), registration({ id: "r2", contactId: "c2" })],
      attendances: [],
      invites: [],
      beforeStart: true,
    })

    expect(result.occupancy).toBe(10)
  })
})
