import type {
  AppState,
  Contact,
  EventAttendance,
  User,
} from "@/lib/types"

const DB_NAME = "invest-rs-events-offline"
const DB_VERSION = 2
const BOOTSTRAP_STORE = "bootstrap"
const OPERATIONS_STORE = "checkin_operations"
const QUEUE_EVENT = "invest-rs-offline-queue-changed"

export type OfflineOperationStatus = "pending" | "syncing" | "failed"

export type OfflineCheckinOperation = {
  idempotencyKey: string
  userId: string
  eventId: string
  kind: "checkin" | "walkin_checkin"
  status: OfflineOperationStatus
  attendance: EventAttendance
  walkinContact?: Contact
  createdAt: string
  updatedAt: string
  attempts: number
  lastError?: string
}

type BootstrapData = Omit<AppState, "user" | "isAuthLoading">

type CachedBootstrap = {
  userId: string
  profile: User
  data: BootstrapData
  cachedAt: string
}

function hasIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window
}

function ensureOperationIndexes(store: IDBObjectStore) {
  if (!store.indexNames.contains("userId")) {
    store.createIndex("userId", "userId", { unique: false })
  }
  if (!store.indexNames.contains("eventId")) {
    store.createIndex("eventId", "eventId", { unique: false })
  }
  if (!store.indexNames.contains("status")) {
    store.createIndex("status", "status", { unique: false })
  }
  if (!store.indexNames.contains("createdAt")) {
    store.createIndex("createdAt", "createdAt", { unique: false })
  }
}

function openDb(): Promise<IDBDatabase> {
  if (!hasIndexedDb()) {
    return Promise.reject(new Error("IndexedDB não está disponível neste navegador."))
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error || new Error("Não foi possível abrir o armazenamento offline."))
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(BOOTSTRAP_STORE)) {
        db.createObjectStore(BOOTSTRAP_STORE, { keyPath: "userId" })
      }

      const operationsStore = db.objectStoreNames.contains(OPERATIONS_STORE)
        ? request.transaction!.objectStore(OPERATIONS_STORE)
        : db.createObjectStore(OPERATIONS_STORE, { keyPath: "idempotencyKey" })
      ensureOperationIndexes(operationsStore)
    }
    request.onsuccess = () => resolve(request.result)
  })
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)
    const request = run(store)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error("Falha no armazenamento offline."))
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => {
      db.close()
      reject(transaction.error || new Error("Falha no armazenamento offline."))
    }
  })
}

function queueChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(QUEUE_EVENT))
}

function sanitizeData(data: BootstrapData): BootstrapData {
  return {
    contacts: data.contacts.map((contact) => ({
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      emailSecondary: contact.emailSecondary,
      whatsapp: contact.whatsapp,
      phone: contact.phone,
      phoneSecondary: contact.phoneSecondary,
      organization: contact.organization,
      organizationId: contact.organizationId,
      position: contact.position,
      seniority: contact.seniority,
      city: contact.city,
      state: contact.state,
      country: contact.country,
      relationshipType: contact.relationshipType,
      origin: contact.origin,
      communicationStatus: contact.communicationStatus,
      incompleteProfile: contact.incompleteProfile,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
      lastInteraction: contact.lastInteraction,
    })),
    organizations: data.organizations.map((organization) => ({
      id: organization.id,
      name: organization.name,
      type: organization.type,
      sector: organization.sector,
      subsector: organization.subsector,
      primarySegmentId: organization.primarySegmentId,
      primarySubsegmentId: organization.primarySubsegmentId,
      organizationTypeId: organization.organizationTypeId,
      city: organization.city,
      state: organization.state,
      country: organization.country,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    })),
    segments: data.segments,
    subsegments: data.subsegments,
    contactSegmentations: data.contactSegmentations,
    events: data.events,
    registrations: Object.fromEntries(
      Object.entries(data.registrations).map(([eventId, registrations]) => [
        eventId,
        registrations.map((registration) => ({
          id: registration.id,
          eventId: registration.eventId,
          contactId: registration.contactId,
          lumaGuestId: registration.lumaGuestId,
          name: registration.name,
          firstName: registration.firstName,
          lastName: registration.lastName,
          email: registration.email,
          phone: registration.phone,
          company: registration.company,
          position: registration.position,
          registeredAt: registration.registeredAt,
          approvalStatus: registration.approvalStatus,
          source: registration.source,
          qrCodeUrl: registration.qrCodeUrl,
          customData: {},
          rawImportData: {},
        })),
      ]),
    ),
    attendances: data.attendances,
    invites: data.invites,
  }
}

export async function saveOfflineBootstrap(profile: User, data: BootstrapData) {
  const record: CachedBootstrap = {
    userId: profile.id,
    profile,
    data: sanitizeData(data),
    cachedAt: new Date().toISOString(),
  }
  await withStore(BOOTSTRAP_STORE, "readwrite", (store) => store.put(record))
}

export async function loadOfflineBootstrap(userId: string): Promise<CachedBootstrap | null> {
  try {
    const result = await withStore<CachedBootstrap | undefined>(
      BOOTSTRAP_STORE,
      "readonly",
      (store) => store.get(userId),
    )
    return result || null
  } catch {
    return null
  }
}

export async function clearOfflineBootstrap(userId: string) {
  try {
    await withStore(BOOTSTRAP_STORE, "readwrite", (store) => store.delete(userId))
  } catch {
    // Limpeza local é best-effort e não deve impedir logout.
  }
}

export async function putOfflineOperation(operation: OfflineCheckinOperation) {
  await withStore(OPERATIONS_STORE, "readwrite", (store) => store.put(operation))
  queueChanged()
}

export async function listOfflineOperations(
  eventId?: string,
  userId?: string,
): Promise<OfflineCheckinOperation[]> {
  const operations = await withStore<OfflineCheckinOperation[]>(
    OPERATIONS_STORE,
    "readonly",
    (store) => store.getAll(),
  )
  return operations
    .filter((operation) => (!eventId || operation.eventId === eventId) && (!userId || operation.userId === userId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function updateOfflineOperation(
  idempotencyKey: string,
  patch: Partial<OfflineCheckinOperation>,
) {
  const current = await withStore<OfflineCheckinOperation | undefined>(
    OPERATIONS_STORE,
    "readonly",
    (store) => store.get(idempotencyKey),
  )
  if (!current) return
  await putOfflineOperation({
    ...current,
    ...patch,
    idempotencyKey: current.idempotencyKey,
    userId: current.userId,
    updatedAt: new Date().toISOString(),
  })
}

export async function removeOfflineOperation(idempotencyKey: string) {
  await withStore(OPERATIONS_STORE, "readwrite", (store) => store.delete(idempotencyKey))
  queueChanged()
}

export function subscribeOfflineQueue(listener: () => void) {
  if (typeof window === "undefined") return () => {}
  window.addEventListener(QUEUE_EVENT, listener)
  return () => window.removeEventListener(QUEUE_EVENT, listener)
}

export function isLikelyNetworkError(error: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || "").toLowerCase()
  return ["failed to fetch", "networkerror", "network error", "load failed", "fetch failed", "connection"].some((token) => message.includes(token))
}
