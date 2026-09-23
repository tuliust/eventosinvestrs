import { useEffect, useRef, useState } from "react"
import {
  activateWaitingServiceWorker,
  isCriticalReceptionActive,
  subscribeCriticalReception,
  subscribePwaUpdate,
} from "@/lib/pwa"

export default function PwaUpdateBanner() {
  const [available, setAvailable] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [critical, setCritical] = useState(isCriticalReceptionActive())
  const [message, setMessage] = useState("")
  const deferredReloadRef = useRef(false)

  useEffect(() => {
    const unsubUpdate = subscribePwaUpdate(() => {
      setAvailable(true)
      setDismissed(false)
      setMessage("")
    })
    const unsubCritical = subscribeCriticalReception((active) => {
      setCritical(active)
      if (!active && deferredReloadRef.current) {
        deferredReloadRef.current = false
        window.location.reload()
      }
    })
    return () => {
      unsubUpdate()
      unsubCritical()
    }
  }, [])

  useEffect(() => {
    if (!available) return
    const onControllerChange = () => {
      if (isCriticalReceptionActive()) {
        deferredReloadRef.current = true
        setMessage("A nova versão já foi ativada, mas a recarga ficará adiada até o Modo Recepção ser fechado.")
        return
      }
      window.location.reload()
    }
    navigator.serviceWorker?.addEventListener("controllerchange", onControllerChange)
    return () => navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange)
  }, [available])

  if (!available || dismissed) return null

  const updateNow = () => {
    if (critical) {
      setMessage("A atualização foi adiada porque o Modo Recepção está aberto. Feche-o quando for seguro atualizar.")
      return
    }
    setMessage("Atualizando a plataforma…")
    if (!activateWaitingServiceWorker()) {
      setMessage("A nova versão ainda não está pronta. Tente novamente em alguns segundos.")
    }
  }

  return (
    <div className="fixed left-1/2 bottom-4 z-[120] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-carbon-20 bg-white p-4 shadow-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-carbon">Uma nova versão da plataforma está disponível.</p>
          <p className="text-xs text-carbon-60 mt-1">
            {critical ? "O Modo Recepção está ativo; a página não será recarregada enquanto a operação estiver em andamento." : "Atualize quando for conveniente para carregar a versão mais recente."}
          </p>
          {message && <p className="text-xs font-semibold text-magenta mt-2">{message}</p>}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button type="button" onClick={() => setDismissed(true)} className="px-4 py-2 rounded-xl border border-carbon-20 text-xs font-bold text-carbon">Depois</button>
          <button type="button" onClick={updateNow} className="px-4 py-2 rounded-xl bg-green text-white text-xs font-bold">Atualizar agora</button>
        </div>
      </div>
    </div>
  )
}
