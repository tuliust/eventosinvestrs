import { useEffect, useMemo, useRef, useState } from "react"
import Modal from "@/components/ui/Modal"
import { useApp, useEventRegistrations } from "@/contexts/AppContext"
import { useOfflineReception } from "@/hooks/useOfflineReception"
import { fullName } from "@/lib/utils"
import type { Contact, Event, EventRegistration } from "@/lib/types"

interface Props {
  event: Event
}

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>
}

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike

type ScannerState = "idle" | "starting" | "scanning" | "found" | "error" | "success" | "pending"

function normalizeToken(value?: string) {
  return (value || "").trim()
}

function qrTokens(raw: string) {
  const values = new Set<string>()
  const trimmed = normalizeToken(raw)
  if (!trimmed) return values
  values.add(trimmed)
  try { values.add(decodeURIComponent(trimmed)) } catch { /* valor já decodificado */ }
  try {
    const url = new URL(trimmed, window.location.origin)
    values.add(url.href)
    values.add(url.pathname)
    const last = url.pathname.split("/").filter(Boolean).pop()
    if (last) values.add(last)
    url.searchParams.forEach((value) => { if (value) values.add(value) })
    if (url.hash) values.add(url.hash.replace(/^#/, ""))
  } catch {
    // QR pode conter apenas um identificador simples.
  }
  return values
}

function registrationMatches(registration: EventRegistration, raw: string) {
  const tokens = qrTokens(raw)
  const direct = [registration.id, registration.lumaGuestId, registration.qrCodeUrl]
    .map(normalizeToken)
    .filter(Boolean)
  if (direct.some((value) => tokens.has(value))) return true

  const additional = [
    ...Object.values(registration.customData || {}),
    ...Object.values(registration.rawImportData || {}),
  ].map((value) => normalizeToken(String(value || ""))).filter(Boolean)

  return additional.some((value) => tokens.has(value))
}

function cameraErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : ""
  if (name === "NotAllowedError" || name === "SecurityError") return "Permissão para usar a câmera foi negada. Autorize a câmera no navegador ou continue usando a busca textual."
  if (name === "NotFoundError" || name === "OverconstrainedError") return "Nenhuma câmera compatível foi encontrada neste dispositivo. A busca textual continua disponível."
  if (name === "NotReadableError" || name === "AbortError") return "A câmera está indisponível ou sendo usada por outro aplicativo. Feche-o e tente novamente."
  return error instanceof Error ? error.message : "Não foi possível iniciar a câmera."
}

export default function QrCheckinButton({ event }: Props) {
  const { state } = useApp()
  const registrations = useEventRegistrations(event.id)
  const { checkin, getAttendance, getPendingOperation } = useOfflineReception(event.id)
  const user = state.user
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)
  const detectorRef = useRef<BarcodeDetectorLike | null>(null)
  const processingRef = useRef(false)

  const [open, setOpen] = useState(false)
  const [scannerState, setScannerState] = useState<ScannerState>("idle")
  const [message, setMessage] = useState("")
  const [registration, setRegistration] = useState<EventRegistration | null>(null)
  const [saving, setSaving] = useState(false)

  const contact = useMemo<Contact | undefined>(() => {
    if (!registration?.contactId) return undefined
    return state.contacts.find((item) => item.id === registration.contactId)
  }, [registration, state.contacts])

  const alreadyPresent = registration ? Boolean(getAttendance(registration.id, registration.contactId)) : false
  const pendingOperation = registration ? getPendingOperation(registration.id, registration.contactId) : undefined
  const alreadyPending = Boolean(pendingOperation)

  const stopCamera = () => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
    animationRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    detectorRef.current = null
    processingRef.current = false
  }

  const close = () => {
    if (saving) return
    stopCamera()
    setOpen(false)
    setScannerState("idle")
    setMessage("")
    setRegistration(null)
  }

  const findRegistration = (raw: string) => {
    const current = registrations.find((item) => registrationMatches(item, raw))
    if (current) return { registration: current, currentEvent: true }

    for (const [eventId, items] of Object.entries(state.registrations)) {
      if (eventId === event.id) continue
      const other = items.find((item) => registrationMatches(item, raw))
      if (other) return { registration: other, currentEvent: false }
    }
    return null
  }

  const handleDecoded = (raw: string) => {
    if (processingRef.current) return
    processingRef.current = true
    const match = findRegistration(raw)
    stopCamera()

    if (!match) {
      setRegistration(null)
      setScannerState("error")
      setMessage("QR Code inválido ou sem inscrição correspondente. Confira o código ou use a busca textual.")
      return
    }

    if (!match.currentEvent) {
      const otherEvent = state.events.find((item) => item.id === match.registration.eventId)
      setRegistration(null)
      setScannerState("error")
      setMessage(`Este QR Code pertence a outro evento${otherEvent ? `: ${otherEvent.title}` : ""}.`)
      return
    }

    setRegistration(match.registration)
    setMessage("")
    setScannerState("found")
  }

  const scanFrame = async () => {
    const video = videoRef.current
    const detector = detectorRef.current
    if (!video || !detector || scannerState === "found" || scannerState === "success" || scannerState === "pending") return
    try {
      if (video.readyState >= 2 && !processingRef.current) {
        const results = await detector.detect(video)
        const raw = results.find((item) => item.rawValue)?.rawValue
        if (raw) {
          handleDecoded(raw)
          return
        }
      }
    } catch {
      // Erros transitórios de leitura não interrompem a recepção.
    }
    animationRef.current = requestAnimationFrame(() => void scanFrame())
  }

  const startCamera = async () => {
    stopCamera()
    setRegistration(null)
    setMessage("")
    setScannerState("starting")

    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector
    if (!Detector) {
      setScannerState("error")
      setMessage("A leitura nativa de QR Code não é suportada neste navegador. Use Chrome atualizado no Android ou continue com a busca textual.")
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerState("error")
      setMessage("A câmera não está disponível neste navegador. A busca textual continua funcionando normalmente.")
      return
    }

    try {
      detectorRef.current = new Detector({ formats: ["qr_code"] })
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (!videoRef.current) throw new Error("Visualizador da câmera não disponível.")
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setScannerState("scanning")
      processingRef.current = false
      animationRef.current = requestAnimationFrame(() => void scanFrame())
    } catch (error) {
      stopCamera()
      setScannerState("error")
      setMessage(cameraErrorMessage(error))
    }
  }

  useEffect(() => {
    if (open) void startCamera()
    return () => stopCamera()
  }, [open])

  const registerCheckin = async () => {
    if (!registration || !user || alreadyPresent || alreadyPending || saving) return
    setSaving(true)
    setMessage("")
    try {
      const attendance = await checkin({
        name: contact ? fullName(contact) : registration.name,
        company: contact?.organization || registration.company,
        position: contact?.position || registration.position,
        contactId: contact?.id || registration.contactId,
        registrationId: registration.id,
        source: registration.source,
        checkedInBy: user.id,
      })
      if (!attendance) throw new Error("O check-in não foi confirmado nem armazenado localmente.")
      const name = contact ? fullName(contact) : registration.name
      if (attendance.syncState === "pending") {
        setScannerState("pending")
        setMessage(`${name} — check-in pendente de sincronização. Nenhuma confirmação do servidor foi simulada.`)
      } else {
        setScannerState("success")
        setMessage(`${name} — presença registrada no servidor.`)
      }
    } catch (error) {
      setScannerState("error")
      setMessage(error instanceof Error ? error.message : "Não foi possível registrar o check-in.")
    } finally {
      setSaving(false)
    }
  }

  const completed = alreadyPresent || scannerState === "success"
  const pending = alreadyPending || scannerState === "pending"

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-xl text-sm font-bold text-white border border-white/20 bg-white/10 hover:bg-white/15 transition-fast whitespace-nowrap"
      >
        ▣ Escanear QR Code
      </button>

      <Modal
        open={open}
        onClose={close}
        title="Escanear QR Code"
        maxWidth="lg"
        footer={
          <>
            <button type="button" disabled={saving} onClick={close} className="px-4 py-2.5 rounded-xl border border-carbon-20 text-sm font-bold text-carbon disabled:opacity-50">Fechar</button>
            {(scannerState === "error" || scannerState === "found" || scannerState === "success" || scannerState === "pending") && (
              <button type="button" disabled={saving} onClick={() => void startCamera()} className="px-4 py-2.5 rounded-xl border border-green text-green text-sm font-bold disabled:opacity-50">Escanear outro</button>
            )}
            {registration && scannerState === "found" && !completed && !pending && (
              <button type="button" disabled={saving} onClick={() => void registerCheckin()} className="px-5 py-2.5 rounded-xl bg-green text-white text-sm font-bold disabled:opacity-50">{saving ? "Registrando…" : navigator.onLine ? "Registrar check-in" : "Salvar pendência offline"}</button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          {(scannerState === "starting" || scannerState === "scanning") && (
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-2xl bg-carbon aspect-[4/3] sm:aspect-video">
                <video ref={videoRef} muted playsInline autoPlay className="w-full h-full object-cover" />
                <div className="pointer-events-none absolute inset-[16%] border-2 border-white/80 rounded-2xl shadow-[0_0_0_999px_rgba(0,0,0,0.28)]" />
              </div>
              <p className="text-xs text-carbon-60 text-center">Aponte a câmera para o QR Code da inscrição. A leitura é automática.</p>
              {scannerState === "starting" && <p className="text-xs font-semibold text-green text-center">Solicitando acesso à câmera…</p>}
            </div>
          )}

          {message && (
            <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${scannerState === "success" ? "bg-light-green text-green" : scannerState === "pending" ? "bg-light-yellow text-[#9B6E00]" : scannerState === "error" ? "bg-light-magenta text-magenta" : "bg-neutral text-carbon"}`}>{message}</div>
          )}

          {registration && (
            <div className="rounded-2xl border border-carbon-20 p-4">
              <div className="flex items-start gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold ${completed ? "bg-light-green text-green" : pending ? "bg-light-yellow text-[#9B6E00]" : "bg-neutral text-carbon"}`}>{completed ? "✓" : pending ? "…" : "QR"}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-carbon">{contact ? fullName(contact) : registration.name}</p>
                  <p className="text-xs text-carbon-60 mt-1">{[contact?.position || registration.position, contact?.organization || registration.company].filter(Boolean).join(" · ") || "Sem cargo ou organização informados"}</p>
                  {registration.email && <p className="text-xs text-carbon-60 mt-0.5">{registration.email}</p>}
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${completed ? "bg-light-green text-green" : pending ? "bg-light-yellow text-[#9B6E00]" : "bg-neutral text-carbon-60"}`}>{completed ? "Já presente" : pending ? "Pendente" : "Inscrição localizada"}</span>
              </div>
              {alreadyPresent && <p className="mt-3 text-xs text-green font-semibold">Este participante já possui presença ativa neste evento. Nenhum novo check-in foi criado.</p>}
              {pending && !alreadyPresent && <p className="mt-3 text-xs text-[#9B6E00] font-semibold">A operação está armazenada no dispositivo e será sincronizada automaticamente quando houver conexão.</p>}
            </div>
          )}

          <p className="text-[11px] text-carbon-60 leading-5">O scanner é opcional. Fechar esta janela devolve imediatamente o foco ao Modo Recepção; a busca por nome, empresa, e-mail ou telefone continua sendo o fluxo principal.</p>
        </div>
      </Modal>
    </>
  )
}
