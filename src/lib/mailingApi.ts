import { supabase } from "@/lib/supabase"

export type MailingFilters = {
  segmentTypes: string[]
  segmentIds: string[]
  subsegmentIds: string[]
  organizationIds: string[]
  organizationTypeIds: string[]
  institutionalCategoryIds: string[]
  institutionalSubcategoryIds: string[]
  specialCategoryIds: string[]
  scopeIds: string[]
  governmentSphereIds: string[]
  countries: string[]
  states: string[]
  positions: string[]
  eventIds: string[]
  eventStatuses: string[]
  classifications: string[]
  involvementTypes: string[]
  relationshipLevels: string[]
  accountManagers: string[]
  origins: string[]
  seniorities: string[]
  relationshipTypes: string[]
  communicationStatuses: string[]
  tags: string[]
  cities: string[]
  onlyWithEmail: boolean
}

export const DEFAULT_MAILING_FILTERS: MailingFilters = {
  segmentTypes: [],
  segmentIds: [],
  subsegmentIds: [],
  organizationIds: [],
  organizationTypeIds: [],
  institutionalCategoryIds: [],
  institutionalSubcategoryIds: [],
  specialCategoryIds: [],
  scopeIds: [],
  governmentSphereIds: [],
  countries: [],
  states: [],
  positions: [],
  eventIds: [],
  eventStatuses: ["present"],
  classifications: [],
  involvementTypes: [],
  relationshipLevels: [],
  accountManagers: [],
  origins: [],
  seniorities: [],
  relationshipTypes: [],
  communicationStatuses: ["active"],
  tags: [],
  cities: [],
  onlyWithEmail: true,
}

export type MailingList = {
  id: string
  title: string
  eventId?: string
  filters: MailingFilters
  contactIds: string[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

type DbRow = Record<string, any>

function normalizeFilters(filters?: Partial<MailingFilters> | null): MailingFilters {
  return {
    ...DEFAULT_MAILING_FILTERS,
    ...(filters || {}),
    segmentTypes: filters?.segmentTypes || [],
    segmentIds: filters?.segmentIds || [],
    subsegmentIds: filters?.subsegmentIds || [],
    organizationIds: filters?.organizationIds || [],
    organizationTypeIds: filters?.organizationTypeIds || [],
    institutionalCategoryIds: filters?.institutionalCategoryIds || [],
    institutionalSubcategoryIds: filters?.institutionalSubcategoryIds || [],
    specialCategoryIds: filters?.specialCategoryIds || [],
    scopeIds: filters?.scopeIds || [],
    governmentSphereIds: filters?.governmentSphereIds || [],
    countries: filters?.countries || [],
    states: filters?.states || [],
    positions: filters?.positions || [],
    eventIds: filters?.eventIds || [],
    eventStatuses: filters?.eventStatuses || ["present"],
    classifications: filters?.classifications || [],
    involvementTypes: filters?.involvementTypes || [],
    relationshipLevels: filters?.relationshipLevels || [],
    accountManagers: filters?.accountManagers || [],
    origins: filters?.origins || [],
    seniorities: filters?.seniorities || [],
    relationshipTypes: filters?.relationshipTypes || [],
    communicationStatuses: filters?.communicationStatuses || ["active"],
    tags: filters?.tags || [],
    cities: filters?.cities || [],
    onlyWithEmail: filters?.onlyWithEmail ?? true,
  }
}

function mapList(row: DbRow, contactIds: string[]): MailingList {
  return {
    id: row.id,
    title: row.title,
    eventId: row.event_id || undefined,
    filters: normalizeFilters(row.filters),
    contactIds,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function loadMailingLists(eventId?: string): Promise<MailingList[]> {
  let query = supabase.from("mailing_lists").select("*").order("updated_at", { ascending: false })
  if (eventId) query = query.eq("event_id", eventId)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = data || []
  if (rows.length === 0) return []

  const ids = rows.map((row) => row.id)
  const { data: links, error: linksError } = await supabase
    .from("mailing_list_contacts")
    .select("mailing_list_id,contact_id")
    .in("mailing_list_id", ids)

  if (linksError) throw new Error(linksError.message)

  const contactsByList = new Map<string, string[]>()
  for (const link of links || []) {
    const current = contactsByList.get(link.mailing_list_id) || []
    current.push(link.contact_id)
    contactsByList.set(link.mailing_list_id, current)
  }

  return rows.map((row) => mapList(row, contactsByList.get(row.id) || []))
}

export async function saveMailingList(input: {
  id?: string
  title: string
  eventId?: string
  filters: MailingFilters
  contactIds: string[]
}): Promise<string> {
  const { data, error } = await supabase.rpc("save_mailing_list", {
    p_list_id: input.id || null,
    p_title: input.title.trim(),
    p_event_id: input.eventId || null,
    p_filters: input.filters,
    p_contact_ids: input.contactIds,
  })

  if (error) throw new Error(error.message)
  if (!data) throw new Error("O servidor não confirmou o salvamento do mailing.")
  return String(data)
}

export async function deleteMailingList(id: string): Promise<void> {
  const { error } = await supabase.from("mailing_lists").delete().eq("id", id)
  if (error) throw new Error(error.message)
}
