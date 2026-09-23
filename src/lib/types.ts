export type UserRole = "admin" | "receptionist"

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
}

// ─── Organizations ───────────────────────────────────────────────────────────

export type OrgType = "empresa_privada" | "imprensa" | "associacao" | "entidade" | "orgao_governamental" | "embaixada_consulado" | "instituicao_financeira" | "universidade_academia" | "outro"

export interface Organization {
  id: string
  name: string
  type: OrgType
  sector?: string
  subsector?: string
  primarySegmentId?: string
  primarySubsegmentId?: string
  organizationTypeId?: string
  institutionalCategoryId?: string
  institutionalSubcategoryId?: string
  scopeId?: string
  governmentSphereId?: string
  countryId?: string
  stateId?: string
  phone?: string
  phoneSecondary?: string
  emails?: string[]
  channelTypes?: string[]
  site?: string
  city?: string
  state?: string
  country?: string
  taxId?: string
  classificationType?: string
  involvementType?: string
  relationshipLevel?: number
  accountManager?: string
  address?: string
  description?: string
  createdAt: string
  updatedAt: string
}

// ─── Segmentations ─────────────────────────────────────────────────────────

export type SegmentType = "priority" | "secondary"

export interface Segment {
  id: string
  name: string
  description?: string
  iconPath?: string
  type: SegmentType
  color: string
  active: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface Subsegment {
  id: string
  segmentId: string
  name: string
  active: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface ContactSegmentation {
  id: string
  contactId: string
  segmentId: string
  subsegmentId?: string
  createdAt: string
}

// ─── Contacts ────────────────────────────────────────────────────────────────

export type CommunicationStatus = "active" | "unsubscribed" | "bounced" | "invalid"

export interface Contact {
  id: string
  firstName: string
  lastName: string
  email?: string
  emailSecondary?: string
  whatsapp?: string
  phone?: string
  phoneSecondary?: string
  organization?: string
  organizationId?: string
  position?: string
  seniority?: string
  linkedin?: string
  city?: string
  state?: string
  country?: string
  relationshipType?: string
  origin?: string
  communicationStatus: CommunicationStatus
  incompleteProfile?: boolean
  tags?: string[]
  notes?: string
  createdAt: string
  updatedAt: string
  lastInteraction?: string
}

// ─── Events ──────────────────────────────────────────────────────────────────

export type EventStatus = "draft" | "upcoming" | "live" | "completed" | "cancelled"
export type EventFormat = "presencial" | "online" | "hibrido"

export interface Event {
  id: string
  title: string
  description?: string
  status: EventStatus
  type: string
  format: EventFormat
  date: string
  startTime: string
  endTime: string
  venue?: string
  address?: string
  city?: string
  state?: string
  capacity: number
  organizations: string[]
  sectors?: string[]
  sectorIds?: string[]
  subsectors?: string[]
  subsegmentIds?: string[]
  responsavel?: string
  lumaUrl?: string
  parentEvent?: string
  createdAt: string
  updatedAt: string
}

// ─── Event Registrations (imported from Luma or other sources) ───────────────

export type RegistrationSource = "luma" | "invited" | "mailing" | "walk_in" | "qr"
export type ApprovalStatus = "approved" | "pending" | "rejected"

export interface EventRegistration {
  id: string
  eventId: string
  contactId?: string
  lumaGuestId?: string
  name: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  company?: string
  position?: string
  registeredAt: string
  approvalStatus: ApprovalStatus
  source: RegistrationSource
  qrCodeUrl?: string
  customData?: Record<string, string>
  rawImportData?: Record<string, string>
}

// ─── Event Attendance (check-in records) ─────────────────────────────────────

export interface EventAttendance {
  id: string
  eventId: string
  contactId?: string
  registrationId?: string
  name: string
  company?: string
  position?: string
  checkedInAt: string
  checkedInBy: string
  source: RegistrationSource
  undoneAt?: string
  undoneBy?: string
}

// ─── Event Invites ────────────────────────────────────────────────────────────

export interface EventInvite {
  id: string
  eventId: string
  contactId?: string
  email: string
  invitedAt: string
  invitedBy: string
  status: "sent" | "opened" | "confirmed" | "declined"
}

// ─── App state ────────────────────────────────────────────────────────────────

export interface AppState {
  user: User | null
  isAuthLoading: boolean
  contacts: Contact[]
  organizations: Organization[]
  segments: Segment[]
  subsegments: Subsegment[]
  contactSegmentations: ContactSegmentation[]
  events: Event[]
  registrations: Record<string, EventRegistration[]>
  attendances: Record<string, EventAttendance[]>
  invites: Record<string, EventInvite[]>
}

export type AppAction =
  | { type: "SET_USER"; payload: User | null }
  | { type: "SET_AUTH_LOADING"; payload: boolean }
  | {
      type: "HYDRATE_DATA"
      payload: Omit<AppState, "user" | "isAuthLoading">
    }
  | { type: "SET_CONTACTS"; payload: Contact[] }
  | { type: "ADD_CONTACT"; payload: Contact }
  | { type: "REMOVE_CONTACT"; payload: string }
  | { type: "UPDATE_CONTACT"; payload: Contact }
  | { type: "SET_ORGANIZATIONS"; payload: Organization[] }
  | { type: "ADD_ORGANIZATION"; payload: Organization }
  | { type: "SET_SEGMENTS"; payload: Segment[] }
  | { type: "ADD_SEGMENT"; payload: Segment }
  | { type: "SET_SUBSEGMENTS"; payload: Subsegment[] }
  | { type: "ADD_SUBSEGMENT"; payload: Subsegment }
  | { type: "SET_CONTACT_SEGMENTATIONS"; payload: ContactSegmentation[] }
  | { type: "ADD_CONTACT_SEGMENTATIONS"; payload: ContactSegmentation[] }
  | { type: "SET_EVENTS"; payload: Event[] }
  | { type: "ADD_EVENT"; payload: Event }
  | { type: "UPDATE_EVENT"; payload: Event }
  | {
      type: "SET_REGISTRATIONS"
      payload: { eventId: string; registrations: EventRegistration[] }
    }
  | { type: "ADD_REGISTRATION"; payload: EventRegistration }
  | {
      type: "SET_ATTENDANCES"
      payload: { eventId: string; attendances: EventAttendance[] }
    }
  | { type: "ADD_ATTENDANCE"; payload: EventAttendance }
  | { type: "UPDATE_ATTENDANCE"; payload: EventAttendance }
  | {
      type: "REMOVE_ATTENDANCE"
      payload: { attendanceId: string; eventId: string }
    }
  | {
      type: "UNDO_ATTENDANCE"
      payload: {
        attendanceId: string
        eventId: string
        undoneBy: string
        undoneAt: string
      }
    }
  | {
      type: "SET_INVITES"
      payload: { eventId: string; invites: EventInvite[] }
    }
  | {
      type: "ADD_INVITES"
      payload: { eventId: string; invites: EventInvite[] }
    }
