let criticalReceptionActive = false
let waitingWorker: ServiceWorker | null = null

const UPDATE_EVENT = "invest-rs-pwa-update"
const CRITICAL_EVENT = "invest-rs-critical-reception"

export function setCriticalReceptionActive(active: boolean) {
  criticalReceptionActive = active
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CRITICAL_EVENT, { detail: { active } }))
  }
}

export function isCriticalReceptionActive() {
  return criticalReceptionActive
}

export function getWaitingServiceWorker() {
  return waitingWorker
}

function announceUpdate(worker: ServiceWorker) {
  waitingWorker = worker
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT))
}

function buildRegistrationUrl() {
  const moduleScript = document.querySelector<HTMLScriptElement>('script[type="module"][src]')
  const buildId = moduleScript?.src || document.documentElement.dataset.build || "app"
  return `/sw.js?build=${encodeURIComponent(buildId)}`
}

export async function registerInvestServiceWorker() {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return

  try {
    const registration = await navigator.serviceWorker.register(buildRegistrationUrl(), { scope: "/" })

    if (registration.waiting && navigator.serviceWorker.controller) {
      announceUpdate(registration.waiting)
    }

    registration.addEventListener("updatefound", () => {
      const installing = registration.installing
      if (!installing) return
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          announceUpdate(installing)
        }
      })
    })

    window.setInterval(() => {
      void registration.update().catch(() => {})
    }, 60 * 60 * 1000)
  } catch (error) {
    console.warn("Service worker não pôde ser registrado:", error)
  }
}

export function subscribePwaUpdate(listener: () => void) {
  window.addEventListener(UPDATE_EVENT, listener)
  return () => window.removeEventListener(UPDATE_EVENT, listener)
}

export function subscribeCriticalReception(listener: (active: boolean) => void) {
  const handler = (event: Event) => {
    listener(Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active))
  }
  window.addEventListener(CRITICAL_EVENT, handler)
  return () => window.removeEventListener(CRITICAL_EVENT, handler)
}

export function activateWaitingServiceWorker() {
  if (!waitingWorker) return false
  waitingWorker.postMessage({ type: "SKIP_WAITING" })
  return true
}
