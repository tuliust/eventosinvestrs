import type { Contact } from "./types"

export {}

declare module "./types" {
  export type CanonicalField =
    | "name"
    | "firstName"
    | "lastName"
    | "email"
    | "phone"
    | "company"
    | "position"
    | "externalId"
    | "registeredAt"
    | "approvalStatus"
    | "qrCode"
    | "checkedInAt"
    | "skip"
    | "custom"

  export interface CsvColumnMapping {
    originalName: string
    mappedTo: CanonicalField
    isCustom: boolean
  }

  export type ImportMatchResult = "safe" | "possible" | "new" | "incomplete" | "error"

  export interface MatchedImportRow {
    row: Record<string, string>
    matchResult: ImportMatchResult
    contact?: Contact
    conflicts: string[]
    canonicalData: {
      name?: string
      email?: string
      phone?: string
      company?: string
      position?: string
      externalId?: string
      registeredAt?: string
      approvalStatus?: string
      qrCode?: string
      checkedInAt?: string
    }
    customData: Record<string, string>
  }

  export type CheckinCase =
    | "luma"
    | "invited_no_luma"
    | "mailing_not_invited"
    | "not_found"
}
