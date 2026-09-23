import { describe, expect, it } from "vitest"
import { buildEventReportPdf } from "@/lib/eventReportPdf"
import { event } from "../fixtures/domain"

function pdfText(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes)
}

describe("eventReportPdf", () => {
  it("gera um PDF A4 válido com métricas e seções do evento", () => {
    const bytes = buildEventReportPdf({
      event: event({
        title: "Painel Inovação e Desenvolvimento",
        description: "Relatório consolidado com informações do evento.",
        venue: "Auditório Invest RS",
        city: "Porto Alegre",
        state: "RS",
        organizations: ["Invest RS"],
        sectors: ["Produtos e serviços digitais"],
      }),
      metrics: [
        { label: "Público selecionado", value: 1040 },
        { label: "Confirmados", value: 64 },
        { label: "Presentes", value: 31 },
        { label: "Ocupação", value: "31%" },
      ],
      funnel: [
        { label: "Público selecionado", value: 1040 },
        { label: "Convites enviados", value: 1040, rateFromPrevious: 100 },
        { label: "Inscrições", value: 64, rateFromPrevious: 6 },
        { label: "Presenças", value: 31, rateFromPrevious: 48 },
      ],
      rates: [
        { label: "Convite → Inscrição", value: 6 },
        { label: "Inscrição → Presença", value: 48 },
      ],
      breakdowns: [
        { title: "Setores com maior presença", rows: [{ label: "Produtos e serviços digitais", count: 12 }] },
      ],
      lists: [
        { title: "Inscritos que não compareceram", items: ["Pessoa A", "Pessoa B"], empty: "Nenhum no-show identificado." },
      ],
      generatedAt: new Date("2026-09-05T12:00:00-03:00"),
    })

    const text = pdfText(bytes)
    expect(text.startsWith("%PDF-1.4")).toBe(true)
    expect(text).toContain("/MediaBox [0 0 595 842]")
    expect(text).toContain("/BaseFont /Helvetica-Bold")
    expect(text).toContain("xref")
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true)
    expect(bytes.length).toBeGreaterThan(1500)
  })

  it("pagina listas extensas sem cortar o conteúdo do documento", () => {
    const names = Array.from({ length: 180 }, (_, index) => `Participante ${index + 1} da lista completa`)
    const text = pdfText(buildEventReportPdf({
      event: event(),
      metrics: [{ label: "Presentes", value: 180 }],
      funnel: [{ label: "Presenças", value: 180 }],
      rates: [],
      breakdowns: [],
      lists: [{ title: "Participantes", items: names, empty: "Sem participantes." }],
      generatedAt: new Date("2026-09-05T12:00:00-03:00"),
    }))

    const count = Number(text.match(/\/Type \/Pages \/Kids \[[^\]]+\] \/Count (\d+)/)?.[1] || 0)
    expect(count).toBeGreaterThan(1)
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true)
  })
})
