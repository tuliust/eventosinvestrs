import { HEADER_CANONICAL_MAP } from "./constants"
import type { Contact, CanonicalField } from "./types"

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "")
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return ""
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
  } catch {
    return dateStr
  }
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return ""
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  } catch {
    return dateStr
  }
}

export function formatTime(dateStr: string): string {
  if (!dateStr) return ""
  try {
    const d = new Date(dateStr)
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  } catch {
    return dateStr
  }
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

export function fullName(contact: Contact): string {
  return `${contact.firstName} ${contact.lastName}`.trim()
}

export function matchContactByEmail(contacts: Contact[], email: string): Contact | undefined {
  const norm = normalizeEmail(email)
  return contacts.find(c =>
    (c.email && normalizeEmail(c.email) === norm) ||
    (c.emailSecondary && normalizeEmail(c.emailSecondary) === norm)
  )
}

function phoneEquivalent(left: string, right: string): boolean {
  if (left === right) return true
  const shortest = Math.min(left.length, right.length)
  if (shortest < 10) return false
  return left.endsWith(right) || right.endsWith(left)
}

export function matchContactByPhone(contacts: Contact[], phone: string): Contact | undefined {
  const norm = normalizePhone(phone)
  if (!norm || norm.length < 6) return undefined
  return contacts.find(c =>
    [c.phone, c.whatsapp, c.phoneSecondary]
      .filter(Boolean)
      .map(value => normalizePhone(value || ""))
      .some(value => phoneEquivalent(value, norm))
  )
}

function organizationEquivalent(left: string, right: string): boolean {
  const a = normalizeName(left)
  const b = normalizeName(right)
  if (!a || !b) return false
  if (a === b) return true
  if (Math.min(a.length, b.length) < 6) return false
  return a.includes(b) || b.includes(a)
}

export function matchContactByNameOrg(
  contacts: Contact[], name: string, org?: string
): Contact | undefined {
  const normName = normalizeName(name)
  const nameMatches = contacts.filter(c => normalizeName(fullName(c)) === normName)
  if (!org) return nameMatches.length === 1 ? nameMatches[0] : undefined

  const organizationMatches = nameMatches.filter(c =>
    Boolean(c.organization && organizationEquivalent(c.organization, org))
  )
  return organizationMatches.length === 1 ? organizationMatches[0] : undefined
}

export function suggestCanonicalField(header: string): CanonicalField | "custom" {
  const key = header.trim().toLowerCase()
  const mapped = HEADER_CANONICAL_MAP[key]
  return (mapped as CanonicalField) ?? "custom"
}

export function parseEmailList(raw: string): string[] {
  return raw
    .split(/[\n,;\t\r]+/)
    .map(e => e.trim().toLowerCase())
    .filter(e => e.length > 0)
    .filter((e, i, arr) => arr.indexOf(e) === i)
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function occupancyPercent(present: number, capacity: number): number {
  if (capacity === 0) return 0
  return Math.round((present / capacity) * 100)
}

export function searchContacts(
  contacts: Contact[],
  query: string
): Contact[] {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return contacts

  const normalizedQuery = normalizeName(trimmedQuery)
  const emailQuery = trimmedQuery.toLowerCase()
  const phoneQuery = normalizePhone(trimmedQuery)

  return contacts.filter(c => {
    const name = normalizeName(fullName(c))
    const org = normalizeName(c.organization || "")
    const email = (c.email || "").toLowerCase()
    const secondaryEmail = (c.emailSecondary || "").toLowerCase()
    const phones = [c.phone, c.whatsapp, c.phoneSecondary]
      .filter(Boolean)
      .map(value => normalizePhone(value || ""))

    return (
      name.includes(normalizedQuery) ||
      org.includes(normalizedQuery) ||
      email.includes(emailQuery) ||
      secondaryEmail.includes(emailQuery) ||
      (phoneQuery.length > 0 && phones.some(phone => phone.includes(phoneQuery)))
    )
  })
}
