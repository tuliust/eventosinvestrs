import { describe, expect, it } from "vitest"
import {
  buildLumaRegistrations,
  createLumaMappings,
  matchLumaRows,
  parseCsv,
} from "@/lib/lumaImport"
import { contact, registration } from "../fixtures/domain"

describe("CSV Luma", () => {
  it("parseia BOM, CRLF, vírgulas entre aspas e aspas escapadas", () => {
    const csv = '\uFEFFname,email,company,notes\r\n"Ana, Maria",ana@example.com,"Empresa, SA","disse ""sim"""\r\n'
    const parsed = parseCsv(csv)

    expect(parsed.headers).toEqual(["name", "email", "company", "notes"])
    expect(parsed.rows).toEqual([
      {
        name: "Ana, Maria",
        email: "ana@example.com",
        company: "Empresa, SA",
        notes: 'disse "sim"',
      },
    ])
  })

  it("mapeia coluna desconhecida como campo personalizado", () => {
    const mappings = createLumaMappings(["name", "email", "Pergunta específica do evento"])
    expect(mappings.find((item) => item.originalName === "Pergunta específica do evento")).toMatchObject({
      mappedTo: "custom",
      isCustom: true,
    })
  })
})

describe("matching e construção das inscrições Luma", () => {
  const contacts = [
    contact({ id: "email-match", email: "ana@example.com", phone: undefined }),
    contact({ id: "phone-match", email: "outro@example.com", phone: "+55 51 99999-2222" }),
    contact({ id: "name-org", firstName: "Carlos", lastName: "Souza", email: "carlos@outra.com", organization: "Empresa Beta" }),
  ]

  const headers = ["name", "email", "phone", "company", "external_id", "Pergunta livre"]
  const mappings = createLumaMappings(headers)

  it("classifica e-mail e telefone exatos como seguros, nome+empresa como possível e linhas sem nome/e-mail como incompletas", () => {
    const rows = [
      { name: "Ana Silva", email: "ANA@EXAMPLE.COM", phone: "", company: "", external_id: "g-1", "Pergunta livre": "A" },
      { name: "Pessoa Telefone", email: "", phone: "(51) 99999-2222", company: "", external_id: "g-2", "Pergunta livre": "B" },
      { name: "Carlos Souza", email: "", phone: "", company: "Empresa Beta", external_id: "g-3", "Pergunta livre": "C" },
      { name: "", email: "", phone: "", company: "Empresa Z", external_id: "g-4", "Pergunta livre": "D" },
    ]

    const matched = matchLumaRows(rows, mappings, contacts)
    expect(matched.map((item) => item.matchResult)).toEqual(["safe", "safe", "possible", "incomplete"])
    expect(matched[0].contact?.id).toBe("email-match")
    expect(matched[1].contact?.id).toBe("phone-match")
    expect(matched[2].contact?.id).toBe("name-org")
  })

  it("preserva customData e rawImportData sem descartar colunas desconhecidas", () => {
    const row = {
      name: "Ana Silva",
      email: "ana@example.com",
      phone: "",
      company: "Empresa A",
      external_id: "g-custom",
      "Pergunta livre": "Resposta importante",
    }
    const matched = matchLumaRows([row], mappings, contacts)
    const built = buildLumaRegistrations("event-1", matched)

    expect(built).toHaveLength(1)
    expect(built[0].customData).toMatchObject({ "Pergunta livre": "Resposta importante" })
    expect(built[0].rawImportData).toEqual(row)
  })

  it("previne duplicidade pelo identificador externo do Luma", () => {
    const row = {
      name: "Ana Silva",
      email: "ana@example.com",
      phone: "",
      company: "Empresa A",
      external_id: "guest-existing",
      "Pergunta livre": "X",
    }
    const matched = matchLumaRows([row, row], mappings, contacts)
    const existing = [registration({ lumaGuestId: "guest-existing" })]

    expect(buildLumaRegistrations("event-1", matched, existing)).toEqual([])
  })
})
