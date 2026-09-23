import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from "react"
import type { Session } from "@supabase/supabase-js"
import type {
  AppAction,
  AppState,
  Contact,
  ContactSegmentation,
  EventAttendance,
  EventInvite,
  Organization,
  Segment,
  Subsegment,
} from "@/lib/types"
import { generateId } from "@/lib/utils"
import {
  loadAppData,
  loadProfile,
  mapAttendance,
  saveAttendance,
  saveContact,
  saveContactSegmentations,
  saveInvites,
  saveOrganization,
  saveSegment,
  saveSubsegment,
  undoAttendanceRemote,
} from "@/lib/api"
import {
  getSupabaseConfigurationError,
  isSupabaseConfigured,
  supabase,
} from "@/lib/supabase"
import {
  clearOfflineBootstrap,
  isLikelyNetworkError,
  loadOfflineBootstrap,
} from "@/lib/offlineStore"

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_USER":
      return { ...state, user: action.payload }
    case "SET_AUTH_LOADING":
      return { ...state, isAuthLoading: action.payload }
    case "HYDRATE_DATA":
      return { ...state, ...action.payload }
    case "SET_CONTACTS":
      return { ...state, contacts: action.payload }
    case "ADD_CONTACT":
      return { ...state, contacts: [action.payload, ...state.contacts] }
    case "REMOVE_CONTACT":
      return {
        ...state,
        contacts: state.contacts.filter(
          (contact) => contact.id !== action.payload,
        ),
      }
    case "UPDATE_CONTACT":
      return {
        ...state,
        contacts: state.contacts.map((contact) =>
          contact.id === action.payload.id ? action.payload : contact,
        ),
      }
    case "SET_ORGANIZATIONS":
      return { ...state, organizations: action.payload }
    case "ADD_ORGANIZATION":
      return {
        ...state,
        organizations: [action.payload, ...state.organizations],
      }
    case "SET_SEGMENTS":
      return { ...state, segments: action.payload }
    case "ADD_SEGMENT":
      return { ...state, segments: [...state.segments, action.payload] }
    case "SET_SUBSEGMENTS":
      return { ...state, subsegments: action.payload }
    case "ADD_SUBSEGMENT":
      return { ...state, subsegments: [...state.subsegments, action.payload] }
    case "SET_CONTACT_SEGMENTATIONS":
      return { ...state, contactSegmentations: action.payload }
    case "ADD_CONTACT_SEGMENTATIONS":
      return {
        ...state,
        contactSegmentations: [
          ...state.contactSegmentations,
          ...action.payload,
        ],
      }
    case "SET_EVENTS":
      return { ...state, events: action.payload }
    case "ADD_EVENT":
      return { ...state, events: [action.payload, ...state.events] }
    case "UPDATE_EVENT":
      return {
        ...state,
        events: state.events.map((event) =>
          event.id === action.payload.id ? action.payload : event,
        ),
      }
    case "SET_REGISTRATIONS":
      return {
        ...state,
        registrations: {
          ...state.registrations,
          [action.payload.eventId]: action.payload.registrations,
        },
      }
    case "ADD_REGISTRATION": {
      const existing = state.registrations[action.payload.eventId] || []
      return {
        ...state,
        registrations: {
          ...state.registrations,
          [action.payload.eventId]: [action.payload, ...existing],
        },
      }
    }
    case "SET_ATTENDANCES":
      return {
        ...state,
        attendances: {
          ...state.attendances,
          [action.payload.eventId]: action.payload.attendances,
        },
      }
    case "ADD_ATTENDANCE": {
      const existing = state.attendances[action.payload.eventId] || []
      const isDuplicate = existing.some(
        (attendance) =>
          !attendance.undoneAt &&
          (attendance.id === action.payload.id ||
            (action.payload.registrationId &&
              attendance.registrationId === action.payload.registrationId) ||
            (action.payload.contactId &&
              attendance.contactId === action.payload.contactId)),
      )
      if (isDuplicate) return state
      return {
        ...state,
        attendances: {
          ...state.attendances,
          [action.payload.eventId]: [action.payload, ...existing],
        },
      }
    }
    case "UPDATE_ATTENDANCE": {
      const existing = state.attendances[action.payload.eventId] || []
      const found = existing.some(
        (attendance) => attendance.id === action.payload.id,
      )
      return {
        ...state,
        attendances: {
          ...state.attendances,
          [action.payload.eventId]: found
            ? existing.map((attendance) =>
                attendance.id === action.payload.id
                  ? action.payload
                  : attendance,
              )
            : [action.payload, ...existing],
        },
      }
    }
    case "REMOVE_ATTENDANCE": {
      const existing = state.attendances[action.payload.eventId] || []
      return {
        ...state,
        attendances: {
          ...state.attendances,
          [action.payload.eventId]: existing.filter(
            (attendance) => attendance.id !== action.payload.attendanceId,
          ),
        },
      }
    }
    case "UNDO_ATTENDANCE": {
      const { attendanceId, eventId, undoneBy, undoneAt } = action.payload
      const existing = state.attendances[eventId] || []
      return {
        ...state,
        attendances: {
          ...state.attendances,
          [eventId]: existing.map((attendance) =>
            attendance.id === attendanceId
              ? { ...attendance, undoneAt, undoneBy }
              : attendance,
          ),
        },
      }
    }
    case "SET_INVITES":
      return {
        ...state,
        invites: {
          ...state.invites,
          [action.payload.eventId]: action.payload.invites,
        },
      }
    case "ADD_INVITES": {
      const existing = state.invites[action.payload.eventId] || []
      return {
        ...state,
        invites: {
          ...state.invites,
          [action.payload.eventId]: [...existing, ...action.payload.invites],
        },
      }
    }
    default:
      return state
  }
}

const initialState: AppState = {
  user: null,
  isAuthLoading: true,
  contacts: [],
  organizations: [],
  segments: [],
  subsegments: [],
  contactSegmentations: [],
  events: [],
  registrations: {},
  attendances: {},
  invites: {},
}

interface AppContextValue {
  state: AppState
  dispatch: React.Dispatch<AppAction>
  login: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  authError: string | null
  syncStatus: "idle" | "syncing" | "synced" | "error"
}

export const AppContext = createContext<AppContextValue | null>(null)

const CONTEXT_FALLBACK: AppContextValue = {
  state: { ...initialState, isAuthLoading: false },
  dispatch: () => {},
  login: async () => false,
  logout: async () => {},
  authError: null,
  syncStatus: "idle",
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [authError, setAuthError] = React.useState<string | null>(
    getSupabaseConfigurationError(),
  )
  const [syncStatus, setSyncStatus] =
    React.useState<"idle" | "syncing" | "synced" | "error">("idle")
  const hydrationRef = useRef<{
    userId: string
    promise: Promise<boolean>
  } | null>(null)

  const hydrateSession = React.useCallback(
    (session: Session): Promise<boolean> => {
      if (hydrationRef.current?.userId === session.user.id) {
        return hydrationRef.current.promise
      }

      const promise = (async () => {
        dispatch({ type: "SET_AUTH_LOADING", payload: true })
        setAuthError(null)

        try {
          const profile = await loadProfile(
            session.user.id,
            session.user.email || "",
          )
          dispatch({ type: "SET_USER", payload: profile })
        } catch (error) {
          if (isLikelyNetworkError(error)) {
            const cached = await loadOfflineBootstrap(session.user.id)
            if (cached) {
              dispatch({ type: "SET_USER", payload: cached.profile })
              dispatch({ type: "HYDRATE_DATA", payload: cached.data })
              setSyncStatus("error")
              setAuthError("Sem conexão. A plataforma está usando os dados armazenados neste dispositivo; novas presenças ficarão pendentes até a sincronização.")
              dispatch({ type: "SET_AUTH_LOADING", payload: false })
              return true
            }
          }
          dispatch({ type: "SET_USER", payload: null })
          setAuthError(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar o perfil.",
          )
          await supabase.auth.signOut()
          dispatch({ type: "SET_AUTH_LOADING", payload: false })
          return false
        }

        setSyncStatus("syncing")
        try {
          const data = await loadAppData()
          dispatch({ type: "HYDRATE_DATA", payload: data })
          setSyncStatus("synced")
        } catch (error) {
          if (isLikelyNetworkError(error)) {
            const cached = await loadOfflineBootstrap(session.user.id)
            if (cached) {
              dispatch({ type: "HYDRATE_DATA", payload: cached.data })
              setSyncStatus("error")
              setAuthError("Sem conexão. Exibindo a última cópia operacional armazenada neste dispositivo.")
            } else {
              setSyncStatus("error")
              setAuthError("Sem conexão e sem cópia offline disponível neste dispositivo.")
            }
          } else {
            setSyncStatus("error")
            setAuthError(
              error instanceof Error
                ? `Falha ao carregar os dados: ${error.message}`
                : "Falha ao carregar os dados.",
            )
          }
        } finally {
          dispatch({ type: "SET_AUTH_LOADING", payload: false })
        }

        return true
      })().finally(() => {
        if (hydrationRef.current?.userId === session.user.id) {
          hydrationRef.current = null
        }
      })

      hydrationRef.current = { userId: session.user.id, promise }
      return promise
    },
    [],
  )

  useEffect(() => {
    if (!isSupabaseConfigured) {
      dispatch({ type: "SET_AUTH_LOADING", payload: false })
      return
    }

    let active = true

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) {
        setAuthError(error.message)
        dispatch({ type: "SET_AUTH_LOADING", payload: false })
        return
      }
      if (data.session) {
        void hydrateSession(data.session)
      } else {
        dispatch({ type: "SET_AUTH_LOADING", payload: false })
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === "SIGNED_OUT" || !session) {
        dispatch({ type: "SET_USER", payload: null })
        dispatch({ type: "SET_AUTH_LOADING", payload: false })
        setSyncStatus("idle")
        return
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        // Supabase emits SIGNED_IN before signInWithPassword finishes returning.
        // Defer DB queries so the client has time to persist and propagate the JWT.
        setTimeout(() => {
          if (active) void hydrateSession(session)
        }, 0)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [hydrateSession])

  useEffect(() => {
    if (!state.user || !isSupabaseConfigured) return

    const channel = supabase
      .channel("event-attendances")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_attendances" },
        (payload) => {
          if (!payload.new || Object.keys(payload.new).length === 0) return
          const attendance = mapAttendance(payload.new)
          dispatch({
            type:
              payload.eventType === "INSERT"
                ? "ADD_ATTENDANCE"
                : "UPDATE_ATTENDANCE",
            payload: attendance,
          })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [state.user?.id])

  const login = async (email: string, password: string): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      setAuthError(getSupabaseConfigurationError())
      return false
    }

    dispatch({ type: "SET_AUTH_LOADING", payload: true })
    setAuthError(null)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error || !data.session) {
      setAuthError(error?.message || "E-mail ou senha inválidos.")
      dispatch({ type: "SET_AUTH_LOADING", payload: false })
      return false
    }

    return hydrateSession(data.session)
  }

  const logout = async () => {
    if (state.user) await clearOfflineBootstrap(state.user.id)
    await supabase.auth.signOut()
    dispatch({ type: "SET_USER", payload: null })
    setSyncStatus("idle")
  }

  return (
    <AppContext.Provider
      value={{ state, dispatch, login, logout, authError, syncStatus }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext) ?? CONTEXT_FALLBACK
}

export function useCurrentUser() {
  return useApp().state.user
}

export function useEvent(eventId: string) {
  return useApp().state.events.find((event) => event.id === eventId)
}

export function useEventRegistrations(eventId: string) {
  return useApp().state.registrations[eventId] || []
}

export function useEventAttendances(eventId: string) {
  return (useApp().state.attendances[eventId] || []).filter(
    (attendance) => !attendance.undoneAt,
  )
}

export function useEventInvites(eventId: string) {
  return useApp().state.invites[eventId] || []
}

export function useCheckinActions(eventId: string) {
  const { dispatch, state } = useApp()
  const [error, setError] = React.useState<string | null>(null)

  const checkin = async (params: {
    name: string
    company?: string
    position?: string
    contactId?: string
    registrationId?: string
    source: "luma" | "invited" | "mailing" | "walk_in" | "qr"
    checkedInBy: string
  }): Promise<EventAttendance | null> => {
    setError(null)
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

    dispatch({ type: "ADD_ATTENDANCE", payload: attendance })

    try {
      const persisted = await saveAttendance(attendance)
      dispatch({ type: "UPDATE_ATTENDANCE", payload: persisted })
      return persisted
    } catch (cause) {
      dispatch({
        type: "REMOVE_ATTENDANCE",
        payload: { attendanceId: attendance.id, eventId },
      })
      setError(
        cause instanceof Error
          ? `Não foi possível concluir o check-in: ${cause.message}`
          : "Não foi possível concluir o check-in.",
      )
      return null
    }
  }

  const undoCheckin = async (
    attendanceId: string,
    _undoneBy: string,
  ): Promise<boolean> => {
    setError(null)
    try {
      const persisted = await undoAttendanceRemote(eventId, attendanceId)
      dispatch({ type: "UPDATE_ATTENDANCE", payload: persisted })
      return true
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `Não foi possível desfazer o check-in: ${cause.message}`
          : "Não foi possível desfazer o check-in.",
      )
      return false
    }
  }

  const addWalkinContact = async (
    contact: Contact,
  ): Promise<Contact | null> => {
    if (!state.user) return null
    setError(null)
    dispatch({ type: "ADD_CONTACT", payload: contact })

    try {
      const persisted = await saveContact(contact, state.user.id)
      dispatch({ type: "UPDATE_CONTACT", payload: persisted })
      return persisted
    } catch (cause) {
      dispatch({ type: "REMOVE_CONTACT", payload: contact.id })
      setError(
        cause instanceof Error
          ? `Não foi possível cadastrar o participante: ${cause.message}`
          : "Não foi possível cadastrar o participante.",
      )
      return null
    }
  }

  const isCheckedIn = (
    registrationId?: string,
    contactId?: string,
  ): boolean => {
    const attendances = state.attendances[eventId] || []
    return attendances.some((attendance) => {
      if (attendance.undoneAt) return false
      if (registrationId && attendance.registrationId === registrationId)
        return true
      if (contactId && attendance.contactId === contactId) return true
      return false
    })
  }

  const getAttendance = (registrationId?: string, contactId?: string) => {
    const attendances = state.attendances[eventId] || []
    return attendances.find((attendance) => {
      if (attendance.undoneAt) return false
      if (registrationId && attendance.registrationId === registrationId)
        return true
      if (contactId && attendance.contactId === contactId) return true
      return false
    })
  }

  return {
    checkin,
    undoCheckin,
    isCheckedIn,
    getAttendance,
    addWalkinContact,
    error,
    clearError: () => setError(null),
  }
}

export function useContactActions() {
  const { dispatch, state } = useApp()
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const createContact = async (
    contact: Contact,
    segmentations: Array<{ segmentId: string; subsegmentId?: string }> = [],
  ): Promise<Contact | null> => {
    if (!state.user || state.user.role !== "admin") {
      setError("Somente administradores podem cadastrar contatos pela base.")
      return null
    }

    setSaving(true)
    setError(null)
    try {
      const persisted = await saveContact(contact, state.user.id)
      dispatch({ type: "ADD_CONTACT", payload: persisted })

      if (segmentations.length > 0) {
        try {
          const links = await saveContactSegmentations(
            persisted.id,
            segmentations,
          )
          dispatch({ type: "ADD_CONTACT_SEGMENTATIONS", payload: links })
        } catch (cause) {
          setError(
            cause instanceof Error
              ? `Contato salvo, mas não foi possível aplicar as segmentações: ${cause.message}`
              : "Contato salvo, mas não foi possível aplicar as segmentações.",
          )
        }
      }

      return persisted
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `Não foi possível cadastrar o contato: ${cause.message}`
          : "Não foi possível cadastrar o contato.",
      )
      return null
    } finally {
      setSaving(false)
    }
  }

  return { createContact, error, saving, clearError: () => setError(null) }
}

export function useOrganizationActions() {
  const { dispatch, state } = useApp()
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const createOrganization = async (
    organization: Organization,
  ): Promise<Organization | null> => {
    if (state.user?.role !== "admin") {
      setError("Somente administradores podem cadastrar organizações.")
      return null
    }

    setSaving(true)
    setError(null)
    try {
      const persisted = await saveOrganization(organization)
      dispatch({ type: "ADD_ORGANIZATION", payload: persisted })
      return persisted
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `Não foi possível cadastrar a organização: ${cause.message}`
          : "Não foi possível cadastrar a organização.",
      )
      return null
    } finally {
      setSaving(false)
    }
  }

  return { createOrganization, error, saving }
}

export function useSegmentationActions() {
  const { dispatch, state } = useApp()
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const createSegment = async (segment: Segment): Promise<Segment | null> => {
    if (state.user?.role !== "admin") {
      setError("Somente administradores podem gerenciar segmentações.")
      return null
    }

    setSaving(true)
    setError(null)
    try {
      const persisted = await saveSegment(segment)
      dispatch({ type: "ADD_SEGMENT", payload: persisted })
      return persisted
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível criar o setor.",
      )
      return null
    } finally {
      setSaving(false)
    }
  }

  const createSubsegment = async (
    subsegment: Subsegment,
  ): Promise<Subsegment | null> => {
    if (state.user?.role !== "admin") {
      setError("Somente administradores podem gerenciar segmentações.")
      return null
    }

    setSaving(true)
    setError(null)
    try {
      const persisted = await saveSubsegment(subsegment)
      dispatch({ type: "ADD_SUBSEGMENT", payload: persisted })
      return persisted
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível criar o subsetor.",
      )
      return null
    } finally {
      setSaving(false)
    }
  }

  return {
    createSegment,
    createSubsegment,
    error,
    saving,
    clearError: () => setError(null),
  }
}

export function useAddInvites(eventId: string) {
  const { dispatch } = useApp()
  return (invites: EventInvite[]) => {
    dispatch({ type: "ADD_INVITES", payload: { eventId, invites } })
    saveInvites(eventId, invites).catch(console.warn)
  }
}

export function useSyncStatus() {
  return useApp().syncStatus
}
