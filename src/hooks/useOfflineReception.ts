import { useCallback, useEffect, useMemo, useState } from "react"
import { useApp } from "@/contexts/AppContext"
import { generateId } from "@/lib/utils"
import { undoAttendanceRemote } from "@/lib/api"
import {
  resolveWalkinContact,
  saveAttendanceIdempotent,
  type CheckinPersistenceResult,
} from "@/lib/offlineCheckinApi"
import {
  isLikelyNetworkError,
  listOfflineOperations,
  putOfflineOperation,
  removeOfflineOperation,
  subscribeOfflineQueue,
  type OfflineCheckinOperation,
} from "@/lib/offlineStore"
import type { Contact, EventAttendance, RegistrationSource } from "@/lib/types"

type CheckinParams = {
  name: string
  company?: string
  position?: string
  contactId?: string
  registrationId?: string
  source: RegistrationSource
  checkedInBy: string
}

function pendingResult(attendance: EventAttendance, idempotencyKey: string): CheckinPersistenceResult {
  return { ...attendance, syncState: "pending", idempotencyKey }
}

export function useOfflineReception(eventId: string) {
  const { state, dispatch } = useApp()
  const [operations, setOperations] = useState<OfflineCheckinOperation[]>([])
  const [error, setError] = useState<string | null>(null)

  const refreshQueue = useCallback(async () => {
    try {
      setOperations(await listOfflineOperations(eventId, state.user?.id))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível ler as pendências locais.")
    }
  }, [eventId, state.user?.id])

  useEffect(() => {
    void refreshQueue()
    return subscribeOfflineQueue(() => void refreshQueue())
  }, [refreshQueue])

  const pendingOperations = useMemo(
    () => operations.filter((operation) => operation.status !== "syncing"),
    [operations],
  )

  const getPendingOperation = useCallback((registrationId?: string, contactId?: string) => {
    return operations.find((operation) => {
      const attendance = operation.attendance
      if (registrationId && attendance.registrationId === registrationId) return true
      if (contactId && attendance.contactId === contactId) return true
      return false
    })
  }, [operations])

  const getAttendance = useCallback((registrationId?: string, contactId?: string) => {
    return (state.attendances[eventId] || []).find((attendance) => {
      if (attendance.undoneAt) return false
      if (registrationId && attendance.registrationId === registrationId) return true
      if (contactId && attendance.contactId === contactId) return true
      return false
    })
  }, [eventId, state.attendances])

  const isCheckedIn = useCallback((registrationId?: string, contactId?: string) => {
    return Boolean(getAttendance(registrationId, contactId) || getPendingOperation(registrationId, contactId))
  }, [getAttendance, getPendingOperation])

  const enqueue = useCallback(async (
    attendance: EventAttendance,
    kind: OfflineCheckinOperation["kind"],
    idempotencyKey: string,
    walkinContact?: Contact,
  ) => {
    const userId = state.user?.id
    if (!userId) throw new Error("Sessão do usuário não está disponível para registrar a pendência offline.")
    const now = new Date().toISOString()
    const operation: OfflineCheckinOperation = {
      idempotencyKey,
      userId,
      eventId,
      kind,
      status: "pending",
      attendance,
      walkinContact,
      createdAt: now,
      updatedAt: now,
      attempts: 0,
    }
    await putOfflineOperation(operation)
    return pendingResult(attendance, idempotencyKey)
  }, [eventId, state.user?.id])

  const checkin = useCallback(async (params: CheckinParams): Promise<CheckinPersistenceResult | null> => {
    setError(null)

    const existingPending = getPendingOperation(params.registrationId, params.contactId)
    if (existingPending) return pendingResult(existingPending.attendance, existingPending.idempotencyKey)

    const attendance: EventAttendance = {
      id: generateId(),
      eventId,
      name: params.name,
      company: params.company,
      position: params.position,
      contactId: params.contactId,
      registrationId: params.registrationId,
      source: params.source,
      checkedInAt: new Date().toISOString(),
      checkedInBy: params.checkedInBy,
    }
    const idempotencyKey = generateId()

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      try {
        return await enqueue(attendance, "checkin", idempotencyKey)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Não foi possível salvar a pendência localmente.")
        return null
      }
    }

    try {
      const persisted = await saveAttendanceIdempotent(attendance, idempotencyKey, false)
      dispatch({ type: "UPDATE_ATTENDANCE", payload: persisted })
      return { ...persisted, syncState: "synced", idempotencyKey }
    } catch (cause) {
      if (isLikelyNetworkError(cause)) {
        try {
          return await enqueue(attendance, "checkin", idempotencyKey)
        } catch (queueError) {
          setError(queueError instanceof Error ? queueError.message : "A conexão caiu e a operação não pôde ser armazenada localmente.")
          return null
        }
      }
      setError(cause instanceof Error ? `Não foi possível concluir o check-in: ${cause.message}` : "Não foi possível concluir o check-in.")
      return null
    }
  }, [dispatch, enqueue, eventId, getPendingOperation])

  const checkinWalkin = useCallback(async (
    contact: Contact,
    checkedInBy: string,
  ): Promise<CheckinPersistenceResult | null> => {
    setError(null)
    const attendance: EventAttendance = {
      id: generateId(),
      eventId,
      name: `${contact.firstName} ${contact.lastName}`.trim(),
      company: contact.organization,
      position: contact.position,
      contactId: contact.id,
      source: "walk_in",
      checkedInAt: new Date().toISOString(),
      checkedInBy,
    }
    const idempotencyKey = generateId()

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      try {
        return await enqueue(attendance, "walkin_checkin", idempotencyKey, contact)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Não foi possível armazenar o walk-in offline.")
        return null
      }
    }

    try {
      const persistedContact = await resolveWalkinContact(contact, checkedInBy)
      const persistedAttendance = await saveAttendanceIdempotent(
        { ...attendance, contactId: persistedContact.id },
        idempotencyKey,
        false,
      )
      if (!state.contacts.some((item) => item.id === persistedContact.id)) {
        dispatch({ type: "ADD_CONTACT", payload: persistedContact })
      } else {
        dispatch({ type: "UPDATE_CONTACT", payload: persistedContact })
      }
      dispatch({ type: "UPDATE_ATTENDANCE", payload: persistedAttendance })
      return { ...persistedAttendance, syncState: "synced", idempotencyKey }
    } catch (cause) {
      if (isLikelyNetworkError(cause)) {
        try {
          return await enqueue(attendance, "walkin_checkin", idempotencyKey, contact)
        } catch (queueError) {
          setError(queueError instanceof Error ? queueError.message : "A conexão caiu e o walk-in não pôde ser armazenado localmente.")
          return null
        }
      }
      setError(cause instanceof Error ? `Não foi possível cadastrar o walk-in: ${cause.message}` : "Não foi possível cadastrar o walk-in.")
      return null
    }
  }, [dispatch, enqueue, eventId, state.contacts])

  const undoCheckin = useCallback(async (attendanceId: string): Promise<boolean> => {
    setError(null)
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("Desfazer um check-in já persistido exige conexão com o servidor. A operação foi bloqueada para preservar consistência.")
      return false
    }
    try {
      const persisted = await undoAttendanceRemote(eventId, attendanceId)
      dispatch({ type: "UPDATE_ATTENDANCE", payload: persisted })
      return true
    } catch (cause) {
      setError(cause instanceof Error ? `Não foi possível desfazer o check-in: ${cause.message}` : "Não foi possível desfazer o check-in.")
      return false
    }
  }, [dispatch, eventId])

  const cancelPending = useCallback(async (idempotencyKey: string) => {
    try {
      await removeOfflineOperation(idempotencyKey)
      setError(null)
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível cancelar a pendência local.")
      return false
    }
  }, [])

  return {
    checkin,
    checkinWalkin,
    undoCheckin,
    isCheckedIn,
    getAttendance,
    getPendingOperation,
    cancelPending,
    pendingCount: operations.length,
    failedCount: operations.filter((operation) => operation.status === "failed").length,
    syncing: operations.some((operation) => operation.status === "syncing"),
    operations: pendingOperations,
    error,
    clearError: () => setError(null),
  }
}
