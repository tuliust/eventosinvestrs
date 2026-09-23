import type { Event } from "@/lib/types"

export interface EventReportPdfMetric {
  label: string
  value: number | string
}

export interface EventReportPdfFunnelItem {
  label: string
  value: number
  rateFromPrevious?: number
}

export interface EventReportPdfRate {
  label: string
  value: number
}

export interface EventReportPdfBreakdown {
  title: string
  rows: Array<{ label: string; count: number }>
}

export interface EventReportPdfList {
  title: string
  items: string[]
  empty: string
}

export interface EventReportPdfPayload {
  event: Event
  metrics: EventReportPdfMetric[]
  funnel: EventReportPdfFunnelItem[]
  rates: EventReportPdfRate[]
  breakdowns: EventReportPdfBreakdown[]
  lists: EventReportPdfList[]
  generatedAt?: Date
}

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const MARGIN = 40
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const FOOTER_Y = 22
const MIN_CONTENT_Y = 42

const GREEN = [0, 0.612, 0.388] as const
const CARBON = [0.235, 0.235, 0.231] as const
const MUTED = [0.45, 0.45, 0.44] as const
const LIGHT = [0.965, 0.965, 0.95] as const
const BORDER = [0.88, 0.88, 0.86] as const
const WHITE = [1, 1, 1] as const

type Rgb = readonly [number, number, number]

const WIN_ANSI_SPECIAL: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  "ƒ": 0x83,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  "ˆ": 0x88,
  "‰": 0x89,
  "Š": 0x8a,
  "‹": 0x8b,
  "Œ": 0x8c,
  "Ž": 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "˜": 0x98,
  "™": 0x99,
  "š": 0x9a,
  "›": 0x9b,
  "œ": 0x9c,
  "ž": 0x9e,
  "Ÿ": 0x9f,
}

function n(value: number) {
  return Number(value.toFixed(3)).toString()
}

function rgb(color: Rgb) {
  return `${n(color[0])} ${n(color[1])} ${n(color[2])}`
}

function safeText(value: unknown) {
  return String(value ?? "")
    .replace(/→/g, "->")
    .replace(/↗/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function winAnsiHex(value: string) {
  let hex = ""
  for (const char of Array.from(safeText(value))) {
    const mapped = WIN_ANSI_SPECIAL[char]
    const codePoint = char.codePointAt(0) || 0x3f
    const byte = mapped ?? (codePoint <= 0xff && !(codePoint >= 0x80 && codePoint <= 0x9f) ? codePoint : 0x3f)
    hex += byte.toString(16).padStart(2, "0")
  }
  return `<${hex}>`
}

function estimatedWidth(text: string, size: number, bold = false) {
  return Array.from(text).reduce((sum, char) => {
    if (" ilI.,:;'|!".includes(char)) return sum + size * 0.25
    if ("MW@%&".includes(char)) return sum + size * 0.82
    return sum + size * (bold ? 0.56 : 0.52)
  }, 0)
}

function splitWord(word: string, maxWidth: number, size: number, bold: boolean) {
  const chunks: string[] = []
  let current = ""
  for (const char of Array.from(word)) {
    const next = current + char
    if (current && estimatedWidth(next, size, bold) > maxWidth) {
      chunks.push(current)
      current = char
    } else {
      current = next
    }
  }
  if (current) chunks.push(current)
  return chunks
}

function wrapText(value: string, maxWidth: number, size: number, bold = false) {
  const text = safeText(value)
  if (!text) return [""]
  const words = text.split(" ").flatMap((word) => estimatedWidth(word, size, bold) > maxWidth
    ? splitWord(word, maxWidth, size, bold)
    : [word])
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (current && estimatedWidth(next, size, bold) > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : [""]
}

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "relatorio-evento"
}

class ReportLayout {
  private pages: string[][] = []
  private current: string[] = []
  private y = PAGE_HEIGHT - 58

  constructor(private readonly eventTitle: string) {
    this.newPage()
  }

  private newPage() {
    this.current = []
    this.pages.push(this.current)
    this.current.push(`${rgb(GREEN)} rg 0 ${PAGE_HEIGHT - 30} ${PAGE_WIDTH} 30 re f`)
    this.textAt("INVEST RS | RELATORIO DE EVENTO", MARGIN, PAGE_HEIGHT - 19, 9, true, WHITE)
    this.y = PAGE_HEIGHT - 54
  }

  private ensureSpace(height: number) {
    if (this.y - height < MIN_CONTENT_Y) this.newPage()
  }

  private textAt(text: string, x: number, y: number, size: number, bold = false, color: Rgb = CARBON) {
    if (!safeText(text)) return
    this.current.push(`BT /${bold ? "F2" : "F1"} ${n(size)} Tf ${rgb(color)} rg 1 0 0 1 ${n(x)} ${n(y)} Tm ${winAnsiHex(text)} Tj ET`)
  }

  private line(x1: number, y1: number, x2: number, y2: number, color: Rgb = BORDER, width = 0.6) {
    this.current.push(`${rgb(color)} RG ${n(width)} w ${n(x1)} ${n(y1)} m ${n(x2)} ${n(y2)} l S`)
  }

  private fillRect(x: number, y: number, width: number, height: number, color: Rgb) {
    this.current.push(`${rgb(color)} rg ${n(x)} ${n(y)} ${n(width)} ${n(height)} re f`)
  }

  private strokeRect(x: number, y: number, width: number, height: number, color: Rgb = BORDER) {
    this.current.push(`${rgb(color)} RG 0.6 w ${n(x)} ${n(y)} ${n(width)} ${n(height)} re S`)
  }

  gap(height = 8) {
    this.y -= height
  }

  paragraph(text: string, options?: { size?: number; bold?: boolean; color?: Rgb; indent?: number; maxWidth?: number; lineHeight?: number }) {
    const size = options?.size ?? 9.5
    const bold = options?.bold ?? false
    const color = options?.color ?? CARBON
    const indent = options?.indent ?? 0
    const maxWidth = options?.maxWidth ?? CONTENT_WIDTH - indent
    const lineHeight = options?.lineHeight ?? size * 1.35
    const lines = wrapText(text, maxWidth, size, bold)
    this.ensureSpace(lines.length * lineHeight + 2)
    for (const line of lines) {
      this.textAt(line, MARGIN + indent, this.y, size, bold, color)
      this.y -= lineHeight
    }
    return lines.length
  }

  title(text: string) {
    const lines = wrapText(text, CONTENT_WIDTH, 18, true)
    this.ensureSpace(lines.length * 23 + 4)
    for (const line of lines) {
      this.textAt(line, MARGIN, this.y, 18, true, CARBON)
      this.y -= 23
    }
  }

  sectionTitle(text: string) {
    this.ensureSpace(28)
    this.y -= 7
    this.fillRect(MARGIN, this.y + 3, 18, 2.5, GREEN)
    this.textAt(text, MARGIN + 26, this.y, 11.5, true, CARBON)
    this.y -= 17
  }

  metadata(rows: Array<[string, string]>) {
    for (const [label, value] of rows) {
      if (!safeText(value)) continue
      const labelWidth = 92
      const lines = wrapText(value, CONTENT_WIDTH - labelWidth, 9, false)
      this.ensureSpace(Math.max(15, lines.length * 12))
      this.textAt(label, MARGIN, this.y, 8.5, true, MUTED)
      lines.forEach((line, index) => this.textAt(line, MARGIN + labelWidth, this.y - index * 12, 9, false, CARBON))
      this.y -= Math.max(15, lines.length * 12)
    }
  }

  metricCards(metrics: EventReportPdfMetric[]) {
    const gap = 10
    const width = (CONTENT_WIDTH - gap) / 2
    const height = 48
    for (let index = 0; index < metrics.length; index += 2) {
      this.ensureSpace(height + gap)
      const top = this.y
      for (let column = 0; column < 2; column += 1) {
        const metric = metrics[index + column]
        if (!metric) continue
        const x = MARGIN + column * (width + gap)
        const bottom = top - height
        this.fillRect(x, bottom, width, height, LIGHT)
        this.strokeRect(x, bottom, width, height)
        this.textAt(metric.label.toLocaleUpperCase("pt-BR"), x + 10, top - 16, 7.5, true, MUTED)
        this.textAt(String(metric.value), x + 10, top - 36, 16, true, CARBON)
      }
      this.y -= height + gap
    }
  }

  funnel(items: EventReportPdfFunnelItem[]) {
    items.forEach((item, index) => {
      this.ensureSpace(34)
      const top = this.y
      this.fillRect(MARGIN, top - 28, CONTENT_WIDTH, 28, LIGHT)
      this.textAt(item.label, MARGIN + 10, top - 18, 9, true, CARBON)
      const valueText = String(item.value)
      const valueX = PAGE_WIDTH - MARGIN - estimatedWidth(valueText, 12, true) - 10
      this.textAt(valueText, valueX, top - 18, 12, true, GREEN)
      if (index > 0 && item.rateFromPrevious != null) {
        const detail = `${item.rateFromPrevious}% da etapa anterior`
        const detailX = PAGE_WIDTH - MARGIN - estimatedWidth(detail, 7.5, false) - 10
        this.textAt(detail, detailX, top - 27, 7.5, false, MUTED)
      }
      this.y -= 34
    })
  }

  rates(items: EventReportPdfRate[]) {
    for (const item of items) {
      this.ensureSpace(17)
      this.textAt(item.label, MARGIN, this.y, 9, false, CARBON)
      const value = `${item.value}%`
      this.textAt(value, PAGE_WIDTH - MARGIN - estimatedWidth(value, 9.5, true), this.y, 9.5, true, GREEN)
      this.line(MARGIN, this.y - 5, PAGE_WIDTH - MARGIN, this.y - 5)
      this.y -= 17
    }
  }

  breakdown(section: EventReportPdfBreakdown) {
    this.sectionTitle(section.title)
    if (!section.rows.length) {
      this.paragraph("Sem dados suficientes.", { color: MUTED })
      return
    }
    section.rows.forEach((row) => {
      this.ensureSpace(16)
      const labelLines = wrapText(row.label, CONTENT_WIDTH - 48, 8.5, false)
      const rowHeight = Math.max(15, labelLines.length * 11)
      this.ensureSpace(rowHeight)
      labelLines.forEach((line, index) => this.textAt(line, MARGIN, this.y - index * 11, 8.5, false, CARBON))
      const count = String(row.count)
      this.textAt(count, PAGE_WIDTH - MARGIN - estimatedWidth(count, 9, true), this.y, 9, true, CARBON)
      this.y -= rowHeight
    })
  }

  personList(section: EventReportPdfList) {
    this.sectionTitle(section.title)
    if (!section.items.length) {
      this.paragraph(section.empty, { color: MUTED })
      return
    }
    section.items.forEach((item) => {
      const lines = wrapText(item, CONTENT_WIDTH - 16, 8.7, false)
      const rowHeight = Math.max(14, lines.length * 11)
      this.ensureSpace(rowHeight)
      this.textAt("-", MARGIN, this.y, 8.7, true, GREEN)
      lines.forEach((line, index) => this.textAt(line, MARGIN + 12, this.y - index * 11, 8.7, false, CARBON))
      this.y -= rowHeight
    })
  }

  build() {
    this.pages.forEach((commands, index) => {
      const pageNumber = `Pagina ${index + 1} de ${this.pages.length}`
      commands.push(`${rgb(BORDER)} RG 0.5 w ${MARGIN} 34 m ${PAGE_WIDTH - MARGIN} 34 l S`)
      commands.push(`BT /F1 7 Tf ${rgb(MUTED)} rg 1 0 0 1 ${MARGIN} ${FOOTER_Y} Tm ${winAnsiHex(this.eventTitle)} Tj ET`)
      const width = estimatedWidth(pageNumber, 7, false)
      commands.push(`BT /F1 7 Tf ${rgb(MUTED)} rg 1 0 0 1 ${n(PAGE_WIDTH - MARGIN - width)} ${FOOTER_Y} Tm ${winAnsiHex(pageNumber)} Tj ET`)
    })
    return createPdf(this.pages.map((commands) => commands.join("\n")))
  }
}

function createPdf(pageStreams: string[]) {
  const encoder = new TextEncoder()
  const pageCount = pageStreams.length
  const firstPageObject = 3
  const fontNormalObject = firstPageObject + pageCount * 2
  const fontBoldObject = fontNormalObject + 1
  const maxObject = fontBoldObject
  const objects: string[] = new Array(maxObject + 1).fill("")

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>"
  const pageRefs = pageStreams.map((_, index) => `${firstPageObject + index * 2} 0 R`).join(" ")
  objects[2] = `<< /Type /Pages /Kids [${pageRefs}] /Count ${pageCount} >>`

  pageStreams.forEach((stream, index) => {
    const pageObject = firstPageObject + index * 2
    const contentObject = pageObject + 1
    objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontNormalObject} 0 R /F2 ${fontBoldObject} 0 R >> >> /Contents ${contentObject} 0 R >>`
    objects[contentObject] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  })

  objects[fontNormalObject] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
  objects[fontBoldObject] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"

  let pdf = "%PDF-1.4\n% Invest RS\n"
  const offsets = new Array(maxObject + 1).fill(0)
  for (let objectNumber = 1; objectNumber <= maxObject; objectNumber += 1) {
    offsets[objectNumber] = pdf.length
    pdf += `${objectNumber} 0 obj\n${objects[objectNumber]}\nendobj\n`
  }

  const xrefOffset = pdf.length
  pdf += `xref\n0 ${maxObject + 1}\n0000000000 65535 f \n`
  for (let objectNumber = 1; objectNumber <= maxObject; objectNumber += 1) {
    pdf += `${String(offsets[objectNumber]).padStart(10, "0")} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${maxObject + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return encoder.encode(pdf)
}

function formatEventDate(date: string) {
  const [year, month, day] = date.split("-")
  return year && month && day ? `${day}/${month}/${year}` : date
}

function eventFormatLabel(format: Event["format"]) {
  return format === "presencial" ? "Presencial" : format === "hibrido" ? "Hibrido" : "Online"
}

function eventStatusLabel(status: Event["status"]) {
  return ({ draft: "Rascunho", upcoming: "Agendado", live: "Em andamento", completed: "Concluido", cancelled: "Cancelado" } as const)[status]
}

export function buildEventReportPdf(payload: EventReportPdfPayload) {
  const { event } = payload
  const generatedAt = payload.generatedAt || new Date()
  const report = new ReportLayout(event.title)

  report.title(event.title)
  report.paragraph("Relatorio consolidado do evento", { size: 10, bold: true, color: GREEN })
  report.gap(6)
  report.metadata([
    ["Data", formatEventDate(event.date)],
    ["Horario", `${event.startTime} - ${event.endTime}`],
    ["Status", eventStatusLabel(event.status)],
    ["Tipo / formato", `${event.type} / ${eventFormatLabel(event.format)}`],
    ["Local", [event.venue, event.address, event.city, event.state].filter(Boolean).join(" - ") || "Online"],
    ["Responsavel", event.responsavel || "Nao informado"],
    ["Organizacoes", event.organizations.join(", ") || "Nao informadas"],
    ["Setores-alvo", event.sectors?.join(", ") || "Nao informados"],
  ])
  if (event.description) {
    report.sectionTitle("Descricao")
    report.paragraph(event.description, { size: 9 })
  }
  report.paragraph(`Gerado em ${generatedAt.toLocaleString("pt-BR")}. Dados consolidados a partir do Supabase.`, { size: 7.5, color: MUTED })

  report.sectionTitle("Resumo executivo")
  report.metricCards(payload.metrics)

  report.sectionTitle("Funil do evento")
  report.funnel(payload.funnel)
  report.gap(2)
  report.rates(payload.rates)

  payload.breakdowns.forEach((section) => report.breakdown(section))
  payload.lists.forEach((section) => report.personList(section))

  return report.build()
}

export function exportEventReportPdf(payload: EventReportPdfPayload) {
  const bytes = buildEventReportPdf(payload)
  const blob = new Blob([bytes], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `${safeFileName(`relatorio-${payload.event.date}-${payload.event.title}`)}.pdf`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}
