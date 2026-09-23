import type { SegmentationsCatalog } from "@/lib/segmentationsCatalogApi"
import type {
  AppState,
  Contact,
  Event,
  EventAttendance,
  EventInvite,
  EventRegistration,
  Organization,
} from "@/lib/types"

const now = "2026-09-01T12:00:00.000Z"

export function contact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "contact-1",
    firstName: "Ana",
    lastName: "Silva",
    email: "ana@example.com",
    organization: "Empresa A",
    communicationStatus: "active",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function organization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: "org-1",
    name: "Empresa A",
    type: "empresa_privada",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function event(overrides: Partial<Event> = {}): Event {
  return {
    id: "event-1",
    title: "Evento de Teste",
    status: "live",
    type: "Painel",
    format: "presencial",
    date: "2026-09-01",
    startTime: "13:00",
    endTime: "14:00",
    capacity: 100,
    organizations: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function registration(overrides: Partial<EventRegistration> = {}): EventRegistration {
  return {
    id: "registration-1",
    eventId: "event-1",
    contactId: "contact-1",
    lumaGuestId: "guest-1",
    name: "Ana Silva",
    email: "ana@example.com",
    registeredAt: now,
    approvalStatus: "approved",
    source: "luma",
    customData: {},
    rawImportData: {},
    ...overrides,
  }
}

export function attendance(overrides: Partial<EventAttendance> = {}): EventAttendance {
  return {
    id: "attendance-1",
    eventId: "event-1",
    contactId: "contact-1",
    registrationId: "registration-1",
    name: "Ana Silva",
    checkedInAt: now,
    checkedInBy: "user-1",
    source: "luma",
    ...overrides,
  }
}

export function invite(overrides: Partial<EventInvite> = {}): EventInvite {
  return {
    id: "invite-1",
    eventId: "event-1",
    contactId: "contact-1",
    email: "ana@example.com",
    invitedAt: now,
    invitedBy: "user-1",
    status: "sent",
    ...overrides,
  }
}

export function appState(overrides: Partial<AppState> = {}): AppState {
  return {
    user: { id: "user-1", email: "admin@investrs.org.br", name: "Admin", role: "admin" },
    isAuthLoading: false,
    contacts: [],
    organizations: [],
    segments: [],
    subsegments: [],
    contactSegmentations: [],
    events: [],
    registrations: {},
    attendances: {},
    invites: {},
    ...overrides,
  }
}

export function catalog(overrides: Partial<SegmentationsCatalog> = {}): SegmentationsCatalog {
  return {
    institutionalCategories: [],
    institutionalSubcategories: [],
    organizationTypes: [],
    specialCategories: [],
    scopes: [],
    governmentSpheres: [],
    countries: [],
    states: [],
    organizationSpecialCategories: [],
    contactInstitutionalCategories: [],
    contactSpecialCategories: [],
    ...overrides,
  }
}
