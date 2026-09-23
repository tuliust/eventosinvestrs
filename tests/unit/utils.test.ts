import { describe, expect, it } from "vitest"
import {
  matchContactByEmail,
  matchContactByNameOrg,
  matchContactByPhone,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  parseEmailList,
} from "@/lib/utils"
import { contact } from "../fixtures/domain"

describe("normalização e parser de listas", () => {
  it("normaliza e-mail removendo espaços e caixa", () => {
    expect(normalizeEmail("  Nome.Pessoa@EXAMPLE.COM ")).toBe("nome.pessoa@example.com")
  })

  it("normaliza telefone mantendo apenas dígitos", () => {
    expect(normalizePhone("+55 (51) 99999-0000")).toBe("5551999990000")
  })

  it("normaliza texto com acentos e caixa", () => {
    expect(normalizeName("  José D'Ávila  ")).toBe("jose d'avila")
  })

  it("parseia lista por linha, vírgula, ponto e vírgula e tab e remove duplicados", () => {
    expect(parseEmailList("A@EXAMPLE.COM\nb@example.com; a@example.com\tc@example.com, D@example.com")).toEqual([
      "a@example.com",
      "b@example.com",
      "c@example.com",
      "d@example.com",
    ])
  })
})

describe("matching de contatos", () => {
  const contacts = [
    contact({
      id: "ana",
      firstName: "Ana",
      lastName: "Silva",
      email: "ana@example.com",
      emailSecondary: "ana.sec@example.com",
      phone: "+55 (51) 99999-0000",
      organization: "Empresa Alfa",
    }),
    contact({
      id: "jose-a",
      firstName: "José",
      lastName: "Silva",
      email: "jose.a@example.com",
      organization: "Empresa A",
    }),
    contact({
      id: "jose-b",
      firstName: "José",
      lastName: "Silva",
      email: "jose.b@example.com",
      organization: "Empresa B",
    }),
  ]

  it("encontra pelo e-mail principal ou secundário normalizado", () => {
    expect(matchContactByEmail(contacts, " ANA.SEC@EXAMPLE.COM ")?.id).toBe("ana")
  })

  it("encontra pelo telefone normalizado", () => {
    expect(matchContactByPhone(contacts, "55 51 99999-0000")?.id).toBe("ana")
  })

  it("não considera números curtos como matching seguro", () => {
    expect(matchContactByPhone(contacts, "12345")).toBeUndefined()
  })

  it("usa organização para distinguir homônimos", () => {
    expect(matchContactByNameOrg(contacts, "Jose Silva", "Empresa B")?.id).toBe("jose-b")
  })
})
