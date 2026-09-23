import { mapAttendance, mapContact, saveContact } from "@/lib/api"
import { supabase } from "@/lib/supabase"
import type { Contact, EventAttendance } from "@/lib/types"
import {
  listOfflineOperations,
  removeOfflineOperation,
  updateOfflineOperation,
} from "@/lib/offlineStore"

export type CheckinPersistenceResult = EventAttendance & {
  syncState?: "synced" | "pending"
  idempotencyKey?: string
}

export async function saveAttendanceIdempotent(
  attendance: EventAttendance,
  idempotencyKey: string,
  offlineSync: boolean,
): Promise<EventAttendance> {
  const { data, error } = await supabase.rpc("check_in_event_idempotent", {
    p_attendance_id: attendance.id,
    p_event_id: attendance.eventId,
    p_contact_id: attendance.contactId || null,
    p_registration_id: attendance.registrationId || null,
    p_name: attendance.name,
    p_company: attendance.company || null,
    p_position: attendance.position || null,
    p_source: attendance.source,
    p_idempotency_key: idempotencyKey,
    p_offline: offlineSync,
  })

  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error("O servidor não confirmou o check-in.")
  return mapAttendance(row)
}

async function findContactById(id: string): Promise<Contact | null> {
  const { data, error } = await supabase.from("contacts").select("*").eq("id", id).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapContact(data) : null
}

async function findContactByEmail(email: string): Promise<Contact | null> {
  const normalized = email.trim()
  if (!normalized) return null
  const { data, error } = await supabase.from("contacts").select("*").eq("email", normalized).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapContact(data) : null
}

export async function resolveWalkinContact(
  contact: Contact,
  createdBy: string,
): Promise<Contact> {
  const byId = await findContactById(contact.id)
  if (byId) return byId

  if (contact.email) {
    const byEmail = await findContactByEmail(contact.email)
    if (byEmail) return byEmail
  }

  try {
    return await saveContact(contact, createdBy)
  } catch (error) {
    const retriedById = await findContactById(contact.id)
    if (retriedById) return retriedById
    if (contact.email) {
      const retriedByEmail = await findContactByEmail(contact.email)
      if (retriedByEmail) return retriedByEmail
    }
    throw error
  }
}

export async function synchronizeOfflineCheckins(userId: string) {
  const operations = await listOfflineOperations(undefined, userId)
  let synced = 0
  let failed = 0
  let lastError = ""

  for (const operation of operations) {
    if (typeof navigator !== "undefined" && !navigator.onLine) break

    await updateOfflineOperation(operation.idempotencyKey, {
      status: "syncing",
      attempts: operation.attempts + 1,
      lastError: undefined,
    })

    try {
      let attendance = operation.attendance
      if (operation.kind === "walkin_checkin") {
        if (!operation.walkinContact) throw new Error("Contato temporário do walk-in não foi encontrado.")
        const persistedContact = await resolveWalkinContact(operation.walkinContact, operation.userId)
        attendance = { ...attendance, contactId: persistedContact.id }
      }

      await saveAttendanceIdempotent(
        attendance,
        operation.idempotencyKey,
        true,
      )
      await removeOfflineOperation(operation.idempotencyKey)
      synced += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida ao sincronizar."
      await updateOfflineOperation(operation.idempotencyKey, {
        status: "failed",
        lastError: message,
      })
      failed += 1
      lastError = message
    }
  }

  return { synced, failed, lastError }
}
