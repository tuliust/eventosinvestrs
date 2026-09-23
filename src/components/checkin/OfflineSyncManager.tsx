import { useEffect, useRef } from "react"
import { useApp } from "@/contexts/AppContext"
import { loadAppData } from "@/lib/api"
import { synchronizeOfflineCheckins } from "@/lib/offlineCheckinApi"
import {
  saveOfflineBootstrap,
  subscribeOfflineQueue,
} from "@/lib/offlineStore"

export default function OfflineSyncManager() {
  const { state, dispatch } = useApp()
  const runningRef = useRef(false)
  const userRef = useRef(state.user)
  userRef.current = state.user

  useEffect(() => {
    if (!state.user || !navigator.onLine) return
    const timeout = window.setTimeout(() => {
      const { user, isAuthLoading, ...data } = state
      if (!isAuthLoading && user) void saveOfflineBootstrap(user, data).catch(() => {})
    }, 800)
    return () => window.clearTimeout(timeout)
  }, [state])

  useEffect(() => {
    if (!state.user) return
    let cancelled = false

    const sync = async () => {
      const user = userRef.current
      if (!user || !navigator.onLine || runningRef.current) return
      runningRef.current = true
      window.dispatchEvent(new CustomEvent("invest-rs-offline-sync-state", { detail: { syncing: true } }))
      try {
        const result = await synchronizeOfflineCheckins(user.id)
        if (cancelled) return

        // Sempre reidrata após recuperar conectividade/rodar sincronização. Assim,
        // mudanças feitas em outros dispositivos enquanto este estava offline não
        // ficam presas no bootstrap local quando não havia operações na fila.
        const data = await loadAppData()
        if (cancelled) return
        dispatch({ type: "HYDRATE_DATA", payload: data })
        await saveOfflineBootstrap(user, data)

        window.dispatchEvent(new CustomEvent("invest-rs-offline-sync-state", {
          detail: {
            syncing: false,
            failed: result.failed,
            error: result.lastError || "",
          },
        }))
      } catch (cause) {
        if (!cancelled) {
          window.dispatchEvent(new CustomEvent("invest-rs-offline-sync-state", {
            detail: {
              syncing: false,
              failed: 1,
              error: cause instanceof Error ? cause.message : "Falha ao sincronizar pendências.",
            },
          }))
        }
      } finally {
        runningRef.current = false
      }
    }

    const onOnline = () => void sync()
    window.addEventListener("online", onOnline)
    const unsubscribe = subscribeOfflineQueue(() => {
      if (navigator.onLine) void sync()
    })
    const interval = window.setInterval(() => void sync(), 30_000)
    void sync()

    return () => {
      cancelled = true
      window.removeEventListener("online", onOnline)
      unsubscribe()
      window.clearInterval(interval)
    }
  }, [dispatch, state.user?.id])

  return null
}
