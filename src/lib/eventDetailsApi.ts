import { mapEvent } from "@/lib/api"
import { supabase } from "@/lib/supabase"
import type { Event } from "@/lib/types"

export interface EventDetails {
  eventId: string
  onlineUrl?: string
  cardUrl?: string
  cardPath?: string
  createdAt?: string
  updatedAt?: string
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

function mapDetails(row: Record<string, any> | null): EventDetails | null {
  if (!row) return null
  return {
    eventId: row.event_id,
    onlineUrl: row.online_url || undefined,
    cardUrl: row.card_url || undefined,
    cardPath: row.card_path || undefined,
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined,
  }
}

export async function loadEventDetails(eventId: string): Promise<EventDetails | null> {
  const { data, error } = await supabase
    .from("event_details")
    .select("*")
    .eq("event_id", eventId)
    .maybeSingle()

  throwIfError(error)
  return mapDetails(data)
}

export async function saveEventDetails(
  eventId: string,
  details: Pick<EventDetails, "onlineUrl" | "cardUrl" | "cardPath">,
): Promise<EventDetails> {
  const { data, error } = await supabase
    .from("event_details")
    .upsert(
      {
        event_id: eventId,
        online_url: details.onlineUrl?.trim() || null,
        card_url: details.cardUrl || null,
        card_path: details.cardPath || null,
      },
      { onConflict: "event_id" },
    )
    .select("*")
    .single()

  throwIfError(error)
  const mapped = mapDetails(data)
  if (!mapped) throw new Error("O servidor não confirmou os detalhes do evento.")
  return mapped
}

export async function updateEventCore(event: Event): Promise<Event> {
  const { data, error } = await supabase
    .from("events")
    .update({
      title: event.title,
      description: event.description || null,
      status: event.status,
      type: event.type,
      format: event.format,
      date: event.date,
      start_time: event.startTime,
      end_time: event.endTime,
      venue: event.venue || null,
      address: event.address || null,
      city: event.city || null,
      state: event.state || null,
      capacity: event.capacity,
      organizations: event.organizations,
      sectors: event.sectors || [],
      sector_ids: event.sectorIds || [],
      subsectors: event.subsectors || [],
      subsegment_ids: event.subsegmentIds || [],
      responsavel: event.responsavel || null,
      luma_url: event.lumaUrl || null,
      parent_event: event.parentEvent || null,
    })
    .eq("id", event.id)
    .select("*")
    .single()

  throwIfError(error)
  return mapEvent(data)
}

export async function uploadEventCard(
  eventId: string,
  file: File,
): Promise<{ path: string; url: string }> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
  const path = `${eventId}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from("event-cards").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  })
  throwIfError(error)

  const { data } = supabase.storage.from("event-cards").getPublicUrl(path)
  if (!data.publicUrl) throw new Error("Não foi possível obter a URL pública do card.")
  return { path, url: data.publicUrl }
}

export async function removeEventCard(path?: string): Promise<void> {
  if (!path) return
  const { error } = await supabase.storage.from("event-cards").remove([path])
  throwIfError(error)
}

export function isValidOnlineUrl(value: string): boolean {
  if (!value.trim()) return false
  try {
    const url = new URL(value.trim())
    return url.protocol === "https:" || url.protocol === "http:"
  } catch {
    return false
  }
}
