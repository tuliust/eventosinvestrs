import { supabase } from "./supabase"

export type PendingLumaContactImport = {
  eventId: string
  eventTitle: string
  pendingCount: number
  latestRegistration: string
}

export type LumaContactImportResult = {
  success: true
  eventId: string
  eventTitle: string
  created: number
  existing: number
  linked: number
}

function throwIf(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function loadPendingLumaContactImport(): Promise<PendingLumaContactImport | null> {
  const { data, error } = await supabase.rpc("get_pending_luma_contact_import")
  throwIf(error)

  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null

  return {
    eventId: row.event_id,
    eventTitle: row.event_title,
    pendingCount: Number(row.pending_count || 0),
    latestRegistration: row.latest_registration,
  }
}

export async function importLumaContacts(eventId: string): Promise<LumaContactImportResult> {
  const { data, error } = await supabase.rpc("import_luma_contacts_admin", {
    p_event_id: eventId,
  })
  throwIf(error)

  if (!data?.success) {
    throw new Error("O servidor não confirmou a importação dos contatos do Luma.")
  }

  return {
    success: true,
    eventId: data.event_id,
    eventTitle: data.event_title,
    created: Number(data.created || 0),
    existing: Number(data.existing || 0),
    linked: Number(data.linked || 0),
  }
}
