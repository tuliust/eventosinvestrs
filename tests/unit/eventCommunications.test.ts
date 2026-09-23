import { describe, expect, it } from "vitest"
import { analyzeCommunicationRecipients } from "@/lib/eventCommunicationsApi"
import { contact } from "../fixtures/domain"

describe("analyzeCommunicationRecipients", () => {
  it("classifica encontrados, não encontrados, duplicados, inválidos, impedidos e já registrados", () => {
    const contacts = [
      contact({ id: "active", email: "ativo@example.com", communicationStatus: "active" }),
      contact({ id: "blocked", email: "bloqueado@example.com", communicationStatus: "unsubscribed" }),
    ]

    const analysis = analyzeCommunicationRecipients(
      "ATIVO@example.com\nnovo@example.com\nativo@example.com\ninvalido\nbloqueado@example.com\nja@example.com",
      contacts,
      ["ja@example.com"],
    )

    expect(analysis.found).toBe(2)
    expect(analysis.unmatched).toBe(2)
    expect(analysis.duplicates).toBe(1)
    expect(analysis.invalid).toBe(1)
    expect(analysis.blocked).toBe(1)
    expect(analysis.alreadyRegistered).toBe(1)
  })

  it("não vincula automaticamente e-mail compartilhado por dois contatos", () => {
    const contacts = [
      contact({ id: "one", email: "central@example.com" }),
      contact({ id: "two", email: "central@example.com", firstName: "Bruno" }),
    ]

    const analysis = analyzeCommunicationRecipients("central@example.com", contacts)
    expect(analysis.found).toBe(0)
    expect(analysis.unmatched).toBe(1)
    expect(analysis.rows[0].contact).toBeUndefined()
  })
})
