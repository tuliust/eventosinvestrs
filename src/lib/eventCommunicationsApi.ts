import { supabase } from "./supabase"
import type { Contact, EventInvite } from "./types"
import { isValidEmail, normalizeEmail } from "./utils"

export type CommunicationChannel = "email" | "beehiiv" | "luma" | "whatsapp" | "individual" | "other"
export type CommunicationRecipientMatch = "found" | "unmatched" | "blocked"

export type EventCommunicationRecipient = {
  id: string
  communicationId: string
  contactId?: string
  email: string
  matchStatus: CommunicationRecipientMatch
  deliveryStatus: string
  createdAt: string
}

export type EventCommunication = {
  id: string
  eventId: string
  title: string
  subject?: string
  channel: CommunicationChannel
  origin: string
  sentAt: string
  createdBy: string
  recipientCount: number
  contentSummary?: string
  externalCampaignId?: string
  externalStatus?: string
  notes?: string
  isInvitation: boolean
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
  recipients: EventCommunicationRecipient[]
}

export type RecipientAnalysisRow = {
  email: string
  valid: boolean
  duplicate: boolean
  contact?: Contact
  blocked: boolean
  alreadyRegistered: boolean
}

export type RecipientAnalysis = {
  rows: RecipientAnalysisRow[]
  found: number
  unmatched: number
  duplicates: number
  invalid: number
  blocked: number
  alreadyRegistered: number
  eligibleCount: number
}

function mapCommunication(row: Record<string, any>, recipients: EventCommunicationRecipient[] = []): EventCommunication {
  return {
    id: row.id,
    eventId: row.event_id,
    title: row.title,
    subject: row.subject || undefined,
    channel: row.channel,
    origin: row.origin,
    sentAt: row.sent_at,
    createdBy: row.created_by,
    recipientCount: row.recipient_count || 0,
    contentSummary: row.content_summary || undefined,
    externalCampaignId: row.external_campaign_id || undefined,
    externalStatus: row.external_status || undefined,
    notes: row.notes || undefined,
    isInvitation: Boolean(row.is_invitation),
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    recipients,
  }
}

function mapRecipient(row: Record<string, any>): EventCommunicationRecipient {
  return {
    id: row.id,
    communicationId: row.communication_id,
    contactId: row.contact_id || undefined,
    email: String(row.email || ""),
    matchStatus: row.match_status,
    deliveryStatus: row.delivery_status,
    createdAt: row.created_at,
  }
}

export async function loadEventCommunications(eventId: string): Promise<EventCommunication[]> {
  const { data: communicationRows, error: communicationError } = await supabase
    .from("event_communications")
    .select("*")
    .eq("event_id", eventId)
    .order("sent_at", { ascending: false })

  if (communicationError) throw new Error(communicationError.message)
  const ids = (communicationRows || []).map((row) => row.id)
  if (!ids.length) return []

  const { data: recipientRows, error: recipientError } = await supabase
    .from("event_communication_recipients")
    .select("*")
    .in("communication_id", ids)
    .order("created_at")

  if (recipientError) throw new Error(recipientError.message)
  const recipientsByCommunication = new Map<string, EventCommunicationRecipient[]>()
  for (const row of recipientRows || []) {
    const recipient = mapRecipient(row)
    recipientsByCommunication.set(recipient.communicationId, [
      ...(recipientsByCommunication.get(recipient.communicationId) || []),
      recipient,
    ])
  }

  return (communicationRows || []).map((row) => mapCommunication(row, recipientsByCommunication.get(row.id) || []))
}

export function analyzeCommunicationRecipients(
  raw: string,
  contacts: Contact[],
  alreadyRegisteredEmails: Iterable<string> = [],
): RecipientAnalysis {
  const existing = new Set([...alreadyRegisteredEmails].map(normalizeEmail))
  const seen = new Set<string>()
  const tokens = raw.split(/[\n,;\t\r]+/).map((item) => item.trim()).filter(Boolean)
  const rows: RecipientAnalysisRow[] = []

  for (const token of tokens) {
    const email = normalizeEmail(token)
    const duplicate = seen.has(email)
    if (!duplicate) seen.add(email)
    const valid = isValidEmail(email)
    const matches = valid ? contacts.filter((contact) =>
      [contact.email, contact.emailSecondary].filter(Boolean).some((value) => normalizeEmail(value || "") === email),
    ) : []
    const contact = matches.length === 1 ? matches[0] : undefined
    const blocked = Boolean(contact && contact.communicationStatus !== "active")
    rows.push({
      email,
      valid,
      duplicate,
      contact,
      blocked,
      alreadyRegistered: existing.has(email),
    })
  }

  const uniqueRows = rows.filter((row) => !row.duplicate)
  return {
    rows,
    found: uniqueRows.filter((row) => row.valid && Boolean(row.contact)).length,
    unmatched: uniqueRows.filter((row) => row.valid && !row.contact).length,
    duplicates: rows.filter((row) => row.duplicate).length,
    invalid: uniqueRows.filter((row) => !row.valid).length,
    blocked: uniqueRows.filter((row) => row.valid && row.blocked).length,
    alreadyRegistered: uniqueRows.filter((row) => row.valid && row.alreadyRegistered).length,
    eligibleCount: uniqueRows.filter((row) => row.valid).length,
  }
}

export async function recordEventCommunication(input: {
  eventId: string
  title: string
  subject?: string
  channel: CommunicationChannel
  origin?: string
  sentAt: string
  contentSummary?: string
  externalCampaignId?: string
  externalStatus?: string
  notes?: string
  isInvitation: boolean
  metadata?: Record<string, unknown>
  recipients: RecipientAnalysisRow[]
}): Promise<string> {
  const recipients = input.recipients
    .filter((row) => row.valid && !row.duplicate)
    .map((row) => ({
      email: row.email,
      contact_id: row.contact?.id || null,
      match_status: row.blocked ? "blocked" : row.contact ? "found" : "unmatched",
      delivery_status: "registered",
    }))

  const { data, error } = await supabase.rpc("record_event_communication", {
    p_event_id: input.eventId,
    p_title: input.title,
    p_subject: input.subject || "",
    p_channel: input.channel,
    p_origin: input.origin || "manual",
    p_sent_at: input.sentAt,
    p_content_summary: input.contentSummary || "",
    p_external_campaign_id: input.externalCampaignId || "",
    p_external_status: input.externalStatus || "",
    p_notes: input.notes || "",
    p_is_invitation: input.isInvitation,
    p_metadata: input.metadata || {},
    p_recipients: recipients,
  })

  if (error) throw new Error(error.message)
  return String(data)
}

export async function loadEventInvites(eventId: string): Promise<EventInvite[]> {
  const { data, error } = await supabase
    .from("event_invites")
    .select("*")
    .eq("event_id", eventId)
    .order("invited_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data || []).map((row) => ({
    id: row.id,
    eventId: row.event_id,
    contactId: row.contact_id || undefined,
    email: String(row.email || ""),
    invitedAt: row.invited_at,
    invitedBy: row.invited_by,
    status: row.status,
  }))
}
