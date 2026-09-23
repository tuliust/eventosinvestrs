import { supabase } from "./supabase"
import type {
  Contact,
  Event,
  EventAttendance,
  EventInvite,
  EventRegistration,
  Organization,
  Segment,
  Subsegment,
  ContactSegmentation,
  User,
} from "./types"

type DatabaseRow = Record<string, any>

function assertNoError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export function mapContact(row: DatabaseRow): Contact {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email || undefined,
    emailSecondary: row.email_secondary || undefined,
    whatsapp: row.whatsapp || undefined,
    phone: row.phone || undefined,
    phoneSecondary: row.phone_secondary || undefined,
    organization: row.organization || undefined,
    organizationId: row.organization_id || undefined,
    position: row.position || undefined,
    seniority: row.seniority || undefined,
    linkedin: row.linkedin || undefined,
    city: row.city || undefined,
    state: row.state || undefined,
    country: row.country || undefined,
    relationshipType: row.relationship_type || undefined,
    origin: row.origin || undefined,
    communicationStatus: row.communication_status,
    incompleteProfile: row.incomplete_profile,
    tags: row.tags || [],
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastInteraction: row.last_interaction || undefined,
  }
}

export function mapOrganization(row: DatabaseRow): Organization {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    sector: row.sector || undefined,
    subsector: row.subsector || undefined,
    primarySegmentId: row.primary_segment_id || undefined,
    primarySubsegmentId: row.primary_subsegment_id || undefined,
    organizationTypeId: row.organization_type_id || undefined,
    institutionalCategoryId: row.institutional_category_id || undefined,
    institutionalSubcategoryId: row.institutional_subcategory_id || undefined,
    scopeId: row.scope_id || undefined,
    governmentSphereId: row.government_sphere_id || undefined,
    countryId: row.country_id || undefined,
    stateId: row.state_id || undefined,
    phone: row.phone || undefined,
    phoneSecondary: row.phone_secondary || undefined,
    emails: row.emails || [],
    channelTypes: row.channel_types || [],
    site: row.site || undefined,
    city: row.city || undefined,
    state: row.state || undefined,
    country: row.country || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapSegment(row: DatabaseRow): Segment {
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    type: row.segment_type === "secondary" ? "secondary" : "priority",
    color: row.color,
    active: row.active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapSubsegment(row: DatabaseRow): Subsegment {
  return {
    id: row.id,
    segmentId: row.segment_id,
    name: row.name,
    active: row.active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapContactSegmentation(row: DatabaseRow): ContactSegmentation {
  return {
    id: row.id,
    contactId: row.contact_id,
    segmentId: row.segment_id,
    subsegmentId: row.subsegment_id || undefined,
    createdAt: row.created_at,
  }
}

export function mapEvent(row: DatabaseRow): Event {
  return {
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    status: row.status,
    type: row.type,
    format: row.format,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    venue: row.venue || undefined,
    address: row.address || undefined,
    city: row.city || undefined,
    state: row.state || undefined,
    capacity: row.capacity,
    organizations: row.organizations || [],
    sectors: row.sectors || [],
    sectorIds: row.sector_ids || [],
    subsectors: row.subsectors || [],
    subsegmentIds: row.subsegment_ids || [],
    responsavel: row.responsavel || undefined,
    lumaUrl: row.luma_url || undefined,
    parentEvent: row.parent_event || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapRegistration(row: DatabaseRow): EventRegistration {
  return {
    id: row.id,
    eventId: row.event_id,
    contactId: row.contact_id || undefined,
    lumaGuestId: row.luma_guest_id || undefined,
    name: row.name,
    firstName: row.first_name || undefined,
    lastName: row.last_name || undefined,
    email: row.email || undefined,
    phone: row.phone || undefined,
    company: row.company || undefined,
    position: row.position || undefined,
    registeredAt: row.registered_at,
    approvalStatus: row.approval_status,
    source: row.source,
    qrCodeUrl: row.qr_code_url || undefined,
    customData: row.custom_data || {},
    rawImportData: row.raw_import_data || {},
  }
}

export function mapAttendance(row: DatabaseRow): EventAttendance {
  return {
    id: row.id,
    eventId: row.event_id,
    contactId: row.contact_id || undefined,
    registrationId: row.registration_id || undefined,
    name: row.name,
    company: row.company || undefined,
    position: row.position || undefined,
    checkedInAt: row.checked_in_at,
    checkedInBy: row.checked_in_by,
    source: row.source,
    undoneAt: row.undone_at || undefined,
    undoneBy: row.undone_by || undefined,
  }
}

function mapInvite(row: DatabaseRow): EventInvite {
  return {
    id: row.id,
    eventId: row.event_id,
    contactId: row.contact_id || undefined,
    email: row.email,
    invitedAt: row.invited_at,
    invitedBy: row.invited_by,
    status: row.status,
  }
}

export async function loadProfile(
  userId: string,
  fallbackEmail = "",
): Promise<User> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,name,role,active")
    .eq("id", userId)
    .single()

  assertNoError(error)
  if (!data) throw new Error("Perfil de acesso não encontrado")
  if (!data.active) throw new Error("Usuário inativo")

  return {
    id: data.id,
    email: data.email || fallbackEmail,
    name: data.name,
    role: data.role,
  }
}

export async function loadAppData(): Promise<{
  contacts: Contact[]
  organizations: Organization[]
  segments: Segment[]
  subsegments: Subsegment[]
  contactSegmentations: ContactSegmentation[]
  events: Event[]
  registrations: Record<string, EventRegistration[]>
  attendances: Record<string, EventAttendance[]>
  invites: Record<string, EventInvite[]>
}> {
  const [
    contactsResult,
    organizationsResult,
    segmentsResult,
    subsegmentsResult,
    contactSegmentationsResult,
    eventsResult,
    registrationsResult,
    attendancesResult,
    invitesResult,
  ] = await Promise.all([
    supabase.from("contacts").select("*").order("first_name"),
    supabase.from("organizations").select("*").order("name"),
    supabase.from("segments").select("*").order("sort_order").order("name"),
    supabase.from("subsegments").select("*").order("sort_order").order("name"),
    supabase.from("contact_segmentations").select("*").order("created_at"),
    supabase.from("events").select("*").order("date", { ascending: false }),
    supabase.from("event_registrations").select("*").order("registered_at", { ascending: false }),
    supabase.from("event_attendances").select("*").order("checked_in_at", { ascending: false }),
    supabase.from("event_invites").select("*").order("invited_at", { ascending: false }),
  ])

  for (const result of [
    contactsResult,
    organizationsResult,
    segmentsResult,
    subsegmentsResult,
    contactSegmentationsResult,
    eventsResult,
    registrationsResult,
    attendancesResult,
    invitesResult,
  ]) {
    assertNoError(result.error)
  }

  const registrations: Record<string, EventRegistration[]> = {}
  for (const row of registrationsResult.data || []) {
    const item = mapRegistration(row)
    registrations[item.eventId] = [...(registrations[item.eventId] || []), item]
  }

  const attendances: Record<string, EventAttendance[]> = {}
  for (const row of attendancesResult.data || []) {
    const item = mapAttendance(row)
    attendances[item.eventId] = [...(attendances[item.eventId] || []), item]
  }

  const invites: Record<string, EventInvite[]> = {}
  for (const row of invitesResult.data || []) {
    const item = mapInvite(row)
    invites[item.eventId] = [...(invites[item.eventId] || []), item]
  }

  return {
    contacts: (contactsResult.data || []).map(mapContact),
    organizations: (organizationsResult.data || []).map(mapOrganization),
    segments: (segmentsResult.data || []).map(mapSegment),
    subsegments: (subsegmentsResult.data || []).map(mapSubsegment),
    contactSegmentations: (contactSegmentationsResult.data || []).map(mapContactSegmentation),
    events: (eventsResult.data || []).map(mapEvent),
    registrations,
    attendances,
    invites,
  }
}

export async function saveAttendance(
  attendance: EventAttendance,
): Promise<EventAttendance> {
  const { data, error } = await supabase.rpc("check_in_event", {
    p_attendance_id: attendance.id,
    p_event_id: attendance.eventId,
    p_contact_id: attendance.contactId || null,
    p_registration_id: attendance.registrationId || null,
    p_name: attendance.name,
    p_company: attendance.company || null,
    p_position: attendance.position || null,
    p_source: attendance.source,
  })

  assertNoError(error)
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error("O check-in não foi gravado")
  return mapAttendance(row)
}

export async function undoAttendanceRemote(
  eventId: string,
  attendanceId: string,
): Promise<EventAttendance> {
  const { data, error } = await supabase.rpc("undo_event_checkin", {
    p_event_id: eventId,
    p_attendance_id: attendanceId,
  })

  assertNoError(error)
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error("O check-in não foi encontrado")
  return mapAttendance(row)
}

export async function saveContact(
  contact: Contact,
  createdBy: string,
): Promise<Contact> {
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      id: contact.id,
      first_name: contact.firstName,
      last_name: contact.lastName,
      email: contact.email || null,
      email_secondary: contact.emailSecondary || null,
      whatsapp: contact.whatsapp || null,
      phone: contact.phone || null,
      phone_secondary: contact.phoneSecondary || null,
      organization: contact.organization || null,
      organization_id: contact.organizationId || null,
      position: contact.position || null,
      seniority: contact.seniority || null,
      linkedin: contact.linkedin || null,
      city: contact.city || null,
      state: contact.state || null,
      country: contact.country || null,
      relationship_type: contact.relationshipType || null,
      communication_status: contact.communicationStatus,
      origin: contact.origin || "manual",
      incomplete_profile: contact.incompleteProfile || false,
      tags: contact.tags || [],
      notes: contact.notes || null,
      created_by: createdBy,
    })
    .select("*")
    .single()

  assertNoError(error)
  return mapContact(data)
}

export async function saveOrganization(
  organization: Organization,
): Promise<Organization> {
  const { data, error } = await supabase
    .from("organizations")
    .insert({
      id: organization.id,
      name: organization.name,
      type: organization.type,
      sector: organization.sector || null,
      subsector: organization.subsector || null,
      primary_segment_id: organization.primarySegmentId || null,
      primary_subsegment_id: organization.primarySubsegmentId || null,
      organization_type_id: organization.organizationTypeId || null,
      institutional_category_id: organization.institutionalCategoryId || null,
      institutional_subcategory_id: organization.institutionalSubcategoryId || null,
      scope_id: organization.scopeId || null,
      government_sphere_id: organization.governmentSphereId || null,
      country_id: organization.countryId || null,
      state_id: organization.stateId || null,
      site: organization.site || null,
      city: organization.city || null,
      state: organization.state || null,
      country: organization.country || null,
    })
    .select("*")
    .single()

  assertNoError(error)
  return mapOrganization(data)
}

export async function saveEvent(
  event: Event,
  createdBy: string,
): Promise<Event> {
  const { data, error } = await supabase
    .from("events")
    .insert({
      id: event.id,
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
      created_by: createdBy,
    })
    .select("*")
    .single()

  assertNoError(error)
  return mapEvent(data)
}

export async function saveSegment(segment: Segment): Promise<Segment> {
  const { data, error } = await supabase
    .from("segments")
    .insert({
      id: segment.id,
      name: segment.name,
      description: segment.description || null,
      segment_type: segment.type,
      color: segment.color,
      active: segment.active,
      sort_order: segment.sortOrder,
    })
    .select("*")
    .single()

  assertNoError(error)
  return mapSegment(data)
}

export async function saveSubsegment(
  subsegment: Subsegment,
): Promise<Subsegment> {
  const { data, error } = await supabase
    .from("subsegments")
    .insert({
      id: subsegment.id,
      segment_id: subsegment.segmentId,
      name: subsegment.name,
      active: subsegment.active,
      sort_order: subsegment.sortOrder,
    })
    .select("*")
    .single()

  assertNoError(error)
  return mapSubsegment(data)
}

export async function saveContactSegmentations(
  contactId: string,
  segmentations: Array<{ segmentId: string; subsegmentId?: string }>,
): Promise<ContactSegmentation[]> {
  if (segmentations.length === 0) return []

  const { data, error } = await supabase
    .from("contact_segmentations")
    .insert(
      segmentations.map((item) => ({
        contact_id: contactId,
        segment_id: item.segmentId,
        subsegment_id: item.subsegmentId || null,
      })),
    )
    .select("*")

  assertNoError(error)
  return (data || []).map(mapContactSegmentation)
}

export async function saveRegistrations(
  registrations: EventRegistration[],
): Promise<void> {
  if (registrations.length === 0) return

  const { error } = await supabase.from("event_registrations").upsert(
    registrations.map((registration) => ({
      id: registration.id,
      event_id: registration.eventId,
      contact_id: registration.contactId || null,
      luma_guest_id: registration.lumaGuestId || null,
      name: registration.name,
      first_name: registration.firstName || null,
      last_name: registration.lastName || null,
      email: registration.email || null,
      phone: registration.phone || null,
      company: registration.company || null,
      position: registration.position || null,
      registered_at: registration.registeredAt,
      approval_status: registration.approvalStatus,
      source: registration.source,
      qr_code_url: registration.qrCodeUrl || null,
      custom_data: registration.customData || {},
      raw_import_data: registration.rawImportData || {},
    })),
    { onConflict: "id" },
  )

  assertNoError(error)
}

export async function saveInvites(
  _eventId: string,
  invites: EventInvite[],
): Promise<void> {
  if (invites.length === 0) return
  const { error } = await supabase.from("event_invites").upsert(
    invites.map((invite) => ({
      id: invite.id,
      event_id: invite.eventId,
      contact_id: invite.contactId || null,
      email: invite.email,
      invited_at: invite.invitedAt,
      invited_by: invite.invitedBy,
      status: invite.status,
    })),
    { onConflict: "event_id,email" },
  )
  assertNoError(error)
}
