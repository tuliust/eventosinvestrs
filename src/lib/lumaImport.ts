import { LUMA_SKIP_COLUMNS } from "./constants"
import type {
  CanonicalField,
  Contact,
  CsvColumnMapping,
  EventRegistration,
  MatchedImportRow,
} from "./types"
import {
  generateId,
  matchContactByEmail,
  matchContactByNameOrg,
  matchContactByPhone,
  normalizeEmail,
  normalizePhone,
  suggestCanonicalField,
} from "./utils"

export function parseCsv(
  text: string,
): {
  headers: string[]
  rows: Record<string, string>[]
} {
  const records: string[][] = []
  let record: string[] = []
  let field = ""
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]

    if (character === '"') {
      if (inQuotes && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (character === "," && !inQuotes) {
      record.push(field.trim())
      field = ""
      continue
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && text[index + 1] === "\n") index += 1
      record.push(field.trim())
      if (record.some((value) => value.length > 0)) records.push(record)
      record = []
      field = ""
      continue
    }

    field += character
  }

  record.push(field.trim())
  if (record.some((value) => value.length > 0)) records.push(record)
  if (records.length === 0) return { headers: [], rows: [] }

  const headers = records[0].map((header) => header.replace(/^\uFEFF/, ""))
  const rows = records.slice(1).map((values) => {
    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = values[index] || ""
    })
    return row
  })

  return { headers, rows }
}

export function createLumaMappings(headers: string[]): CsvColumnMapping[] {
  return headers.map((header) => {
    const suggested = suggestCanonicalField(header)
    const isKnownSkip = LUMA_SKIP_COLUMNS.includes(header.toLowerCase())
    return {
      originalName: header,
      mappedTo: isKnownSkip
        ? "skip"
        : suggested === "custom"
          ? "custom"
          : suggested as CanonicalField,
      isCustom: !isKnownSkip && suggested === "custom",
    }
  })
}

export function matchLumaRows(
  rows: Record<string, string>[],
  mappings: CsvColumnMapping[],
  contacts: Contact[],
): MatchedImportRow[] {
  return rows.map((row) => {
    const canonical: MatchedImportRow["canonicalData"] = {}
    const customData: Record<string, string> = {}

    for (const mapping of mappings) {
      const value = row[mapping.originalName]?.trim()
      if (!value || mapping.mappedTo === "skip") continue
      if (mapping.isCustom || mapping.mappedTo === "custom") {
        customData[mapping.originalName] = value
        continue
      }

      switch (mapping.mappedTo) {
        case "name":
          canonical.name = value
          break
        case "firstName":
          canonical.name = canonical.name || value
          break
        case "lastName":
          canonical.name = canonical.name ? `${canonical.name} ${value}` : value
          break
        case "email":
          canonical.email = normalizeEmail(value)
          break
        case "phone":
          canonical.phone = normalizePhone(value)
          break
        case "company":
          canonical.company = value
          break
        case "position":
          canonical.position = value
          break
        case "externalId":
          canonical.externalId = value
          break
        case "registeredAt":
          canonical.registeredAt = value
          break
        case "approvalStatus":
          canonical.approvalStatus = value
          break
        case "qrCode":
          canonical.qrCode = value
          break
      }
    }

    let contact: Contact | undefined
    let matchResult: MatchedImportRow["matchResult"] = "new"
    const conflicts: string[] = []

    if (canonical.email) {
      contact = matchContactByEmail(contacts, canonical.email)
      if (contact) matchResult = "safe"
    }
    if (!contact && canonical.phone && canonical.phone.length >= 8) {
      contact = matchContactByPhone(contacts, canonical.phone)
      if (contact) matchResult = "safe"
    }
    if (!contact && canonical.name && canonical.company) {
      contact = matchContactByNameOrg(
        contacts,
        canonical.name,
        canonical.company,
      )
      if (contact) {
        matchResult = "possible"
        conflicts.push("Correspondência por nome+empresa — revisar manualmente")
      }
    }
    if (!canonical.name && !canonical.email) matchResult = "incomplete"

    return {
      row,
      matchResult,
      contact,
      conflicts,
      canonicalData: canonical,
      customData,
    }
  })
}

export function buildLumaRegistrations(
  eventId: string,
  rows: MatchedImportRow[],
  existing: EventRegistration[] = [],
): EventRegistration[] {
  const externalIds = new Set(
    existing.map((registration) => registration.lumaGuestId).filter(Boolean),
  )

  return rows.flatMap((matchedRow) => {
    if (matchedRow.matchResult === "error") return []
    const data = matchedRow.canonicalData
    if (data.externalId && externalIds.has(data.externalId)) return []
    if (data.externalId) externalIds.add(data.externalId)

    return [
      {
        id: generateId(),
        eventId,
        contactId:
          matchedRow.matchResult === "safe"
            ? matchedRow.contact?.id
            : undefined,
        lumaGuestId: data.externalId,
        name: data.name || "(sem nome)",
        email: data.email,
        phone: data.phone,
        company:
          data.company ||
          matchedRow.customData["Para qual empresa você trabalha?"] ||
          matchedRow.customData["para qual empresa você trabalha?"],
        position:
          data.position ||
          matchedRow.customData["Qual é o seu cargo?"] ||
          matchedRow.customData["qual é o seu cargo?"],
        registeredAt: data.registeredAt || new Date().toISOString(),
        approvalStatus:
          data.approvalStatus === "approved" || !data.approvalStatus
            ? "approved"
            : "pending",
        source: "luma",
        qrCodeUrl: data.qrCode,
        customData: matchedRow.customData,
        rawImportData: matchedRow.row,
      },
    ]
  })
}
