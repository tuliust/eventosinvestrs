import { useState, useRef, useEffect } from "react"
import {
  useApp,
  useEventRegistrations,
  useEventAttendances,
  useEventInvites,
} from "@/contexts/AppContext"
import {
  fullName,
  getInitials,
  normalizeEmail,
  normalizePhone,
  generateId,
  occupancyPercent,
} from "@/lib/utils"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { useOfflineReception } from "@/hooks/useOfflineReception"
import { setCriticalReceptionActive } from "@/lib/pwa"
import AddConfirmedGuestButton from "@/components/checkin/AddConfirmedGuestButton"
import QrCheckinButton from "@/components/checkin/QrCheckinButton"
import Modal from "@/components/ui/Modal"
import type { Event, Contact, EventRegistration, CheckinCase } from "@/lib/types"

interface Props {
  event: Event
  onClose: () => void
}

type QuickFilter = "all" | "confirmed" | "invited" | "present" | "pending"

interface CandidateResult {
  contact?: Contact
  registration?: EventRegistration
  checkInCase: CheckinCase
  isPresent: boolean
  isPending?: boolean
  pendingKey?: string
}

export default function ReceptionMode({ event, onClose }: Props) {
  const { state } = useApp()
  const registrations = useEventRegistrations(event.id)
  const attendances = useEventAttendances(event.id)
  const invites = useEventInvites(event.id)
  const {
    checkin,
    checkinWalkin,
    undoCheckin,
    isCheckedIn,
    getAttendance,
    getPendingOperation,
    cancelPending,
    pendingCount,
    failedCount,
    syncing,
    operations,
    error: mutationError,
  } = useOfflineReception(event.id)
  const isOnline = useOnlineStatus()
  const user = state.user
  const searchRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<QuickFilter>("all")
  const [walkinModal, setWalkinModal] = useState(false)
  const [undoTarget, setUndoTarget] = useState<typeof attendances[0] | null>(null)
  const [successToast, setSuccessToast] = useState("")

  const [wkName, setWkName] = useState("")
  const [wkEmail, setWkEmail] = useState("")
  const [wkWhatsapp, setWkWhatsapp] = useState("")
  const [wkEmpresa, setWkEmpresa] = useState("")
  const [wkCargo, setWkCargo] = useState("")

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    setCriticalReceptionActive(true)
    return () => setCriticalReceptionActive(false)
  }, [])

  const showToast = (msg: string) => {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(""), 3500)
  }

  const pendingFor = (registrationId?: string, contactId?: string) => {
    const operation = getPendingOperation(registrationId, contactId)
    return {
      isPending: Boolean(operation),
      pendingKey: operation?.idempotencyKey,
    }
  }

  function buildCandidates(): CandidateResult[] {
    if (!query.trim()) {
      let results: CandidateResult[] = []

      if (filter === "all" || filter === "confirmed") {
        for (const reg of registrations.filter(r => r.approvalStatus === "approved")) {
          const att = getAttendance(reg.id, reg.contactId)
          const contact = reg.contactId ? state.contacts.find(c => c.id === reg.contactId) : undefined
          results.push({
            contact,
            registration: reg,
            checkInCase: "luma",
            isPresent: Boolean(att),
            ...pendingFor(reg.id, reg.contactId),
          })
        }
      }

      if (filter === "invited") {
        for (const invite of invites) {
          const contact = state.contacts.find(c => c.id === invite.contactId)
          const reg = registrations.find(r => r.contactId === invite.contactId)
          if (!contact || reg) continue
          results.push({
            contact,
            registration: undefined,
            checkInCase: "invited_no_luma",
            isPresent: Boolean(getAttendance(undefined, contact.id)),
            ...pendingFor(undefined, contact.id),
          })
        }
      }

      if (filter === "present") {
        results = attendances.map(att => {
          const contact = att.contactId ? state.contacts.find(c => c.id === att.contactId) : undefined
          const registration = att.registrationId ? registrations.find(r => r.id === att.registrationId) : undefined
          return { contact, registration, checkInCase: att.source === "luma" ? "luma" : "mailing_not_invited", isPresent: true }
        })
      }

      if (filter === "pending") {
        results = operations.map(operation => {
          const att = operation.attendance
          const contact = att.contactId
            ? state.contacts.find(c => c.id === att.contactId) || operation.walkinContact
            : operation.walkinContact
          const registration = att.registrationId ? registrations.find(r => r.id === att.registrationId) : undefined
          return {
            contact,
            registration,
            checkInCase: registration ? "luma" : att.source === "invited" ? "invited_no_luma" : "mailing_not_invited",
            isPresent: false,
            isPending: true,
            pendingKey: operation.idempotencyKey,
          }
        })
      }

      return results
    }

    const q = query.toLowerCase()
    const phoneQuery = normalizePhone(query)
    const hasPhoneQuery = phoneQuery.length >= 3

    const lumaResults: CandidateResult[] = registrations
      .filter(r =>
        r.name.toLowerCase().includes(q) ||
        (r.email || "").toLowerCase().includes(q) ||
        (r.company || "").toLowerCase().includes(q) ||
        (hasPhoneQuery && normalizePhone(r.phone || "").includes(phoneQuery))
      )
      .map(reg => {
        const contact = reg.contactId ? state.contacts.find(c => c.id === reg.contactId) : undefined
        return {
          contact,
          registration: reg,
          checkInCase: "luma" as CheckinCase,
          isPresent: Boolean(getAttendance(reg.id, reg.contactId)),
          ...pendingFor(reg.id, reg.contactId),
        }
      })

    const invitedContactIds = new Set(invites.map(i => i.contactId))
    const lumaContactIds = new Set(registrations.map(r => r.contactId).filter(Boolean))
    const invitedResults: CandidateResult[] = state.contacts
      .filter(c =>
        invitedContactIds.has(c.id) && !lumaContactIds.has(c.id) &&
        (fullName(c).toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q) ||
          (c.organization || "").toLowerCase().includes(q))
      )
      .map(contact => ({
        contact,
        registration: undefined,
        checkInCase: "invited_no_luma" as CheckinCase,
        isPresent: Boolean(getAttendance(undefined, contact.id)),
        ...pendingFor(undefined, contact.id),
      }))

    const mailingResults: CandidateResult[] = state.contacts
      .filter(c =>
        !invitedContactIds.has(c.id) && !lumaContactIds.has(c.id) &&
        (fullName(c).toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q) ||
          (c.organization || "").toLowerCase().includes(q))
      )
      .map(contact => ({
        contact,
        registration: undefined,
        checkInCase: "mailing_not_invited" as CheckinCase,
        isPresent: Boolean(getAttendance(undefined, contact.id)),
        ...pendingFor(undefined, contact.id),
      }))

    return [...lumaResults, ...invitedResults, ...mailingResults]
  }

  const candidates = buildCandidates()
  const notFound = query.trim() && candidates.length === 0
  const present = attendances.length
  const confirmed = registrations.filter(r => r.approvalStatus === "approved").length
  const pct = occupancyPercent(present, event.capacity)

  const doCheckin = async (cand: CandidateResult) => {
    if (!user || cand.isPending) return
    const attendance = await checkin({
      name: cand.contact ? fullName(cand.contact) : (cand.registration?.name || "Participante"),
      company: cand.contact?.organization || cand.registration?.company,
      position: cand.contact?.position || cand.registration?.position,
      contactId: cand.contact?.id,
      registrationId: cand.registration?.id,
      source: cand.checkInCase === "luma" ? "luma"
        : cand.checkInCase === "invited_no_luma" ? "invited"
        : cand.checkInCase === "mailing_not_invited" ? "mailing"
        : "walk_in",
      checkedInBy: user.id,
    })
    if (attendance) {
      const name = cand.contact ? fullName(cand.contact) : cand.registration?.name || "Participante"
      showToast(attendance.syncState === "pending"
        ? `⏳ ${name} — pendente de sincronização`
        : `✓ ${name} — presente`)
      setQuery("")
    }
  }

  const doWalkin = async () => {
    if (!wkName.trim() || !user) return

    const emailMatch = wkEmail ? state.contacts.find(c => normalizeEmail(c.email || "") === normalizeEmail(wkEmail)) : null
    const phoneMatch = wkWhatsapp ? state.contacts.find(c => normalizePhone(c.whatsapp || c.phone || "") === normalizePhone(wkWhatsapp)) : null
    const existing = emailMatch || phoneMatch

    let attendance = null

    if (existing && isCheckedIn(undefined, existing.id)) {
      const pending = getPendingOperation(undefined, existing.id)
      showToast(pending
        ? `⏳ ${fullName(existing)} — check-in já pendente de sincronização`
        : `✓ ${fullName(existing)} — já estava presente`)
      setWalkinModal(false)
      setQuery("")
      return
    }

    if (existing) {
      attendance = await checkin({
        name: fullName(existing),
        company: existing.organization,
        position: existing.position,
        contactId: existing.id,
        source: "walk_in",
        checkedInBy: user.id,
      })
    } else {
      const parts = wkName.trim().split(" ")
      const newContact: Contact = {
        id: generateId(),
        firstName: parts[0],
        lastName: parts.slice(1).join(" ") || "",
        email: wkEmail || undefined,
        whatsapp: wkWhatsapp || undefined,
        organization: wkEmpresa || undefined,
        position: wkCargo || undefined,
        communicationStatus: "active",
        origin: "walk_in",
        incompleteProfile: !wkEmail && !wkWhatsapp,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      attendance = await checkinWalkin(newContact, user.id)
    }

    if (!attendance) return

    showToast(attendance.syncState === "pending"
      ? `⏳ ${wkName.trim()} — pendente de sincronização`
      : `✓ ${wkName.trim()} — presente`)
    setWalkinModal(false)
    setWkName(""); setWkEmail(""); setWkWhatsapp(""); setWkEmpresa(""); setWkCargo("")
    setQuery("")
  }

  const status = syncing
    ? { label: "SINCRONIZANDO", background: "rgba(248,181,30,0.2)", color: "#F8B51E", dot: "bg-yellow" }
    : !isOnline
      ? { label: pendingCount ? `OFFLINE · ${pendingCount} PENDÊNCIA${pendingCount > 1 ? "S" : ""}` : "OFFLINE", background: "rgba(230,4,86,0.2)", color: "#E60456", dot: "bg-magenta" }
      : pendingCount
        ? { label: `PENDÊNCIAS · ${pendingCount}`, background: "rgba(248,181,30,0.2)", color: "#F8B51E", dot: "bg-yellow" }
        : { label: "ONLINE", background: "rgba(0,156,99,0.2)", color: "#009C63", dot: "bg-green" }

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col"
      style={{ background: "#3C3C3B", fontFamily: "'Montserrat', sans-serif" }}
    >
      <div
        className="flex-shrink-0 px-6 py-4 flex items-center justify-between border-b"
        style={{ borderColor: "rgba(255,255,255,0.1)" }}
      >
        <div className="flex items-center gap-4">
          <div>
            <p className="text-white/60 text-xs font-semibold uppercase tracking-widest">Modo Recepção</p>
            <h1 className="text-white font-bold text-base leading-tight truncate max-w-xs md:max-w-md">
              {event.title}
            </h1>
          </div>
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full hidden md:inline"
            style={{ background: "#F8B51E", color: "#3C3C3B" }}
          >
            {event.startTime} – {event.endTime}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{ background: status.background, color: status.color }}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white/70 hover:text-white border transition-fast"
            style={{ borderColor: "rgba(255,255,255,0.2)" }}
          >
            ✕ Fechar
          </button>
        </div>
      </div>

      {mutationError && (
        <div className="flex-shrink-0 px-6 py-2.5 text-xs font-semibold text-white bg-magenta">
          {mutationError}
        </div>
      )}
      {failedCount > 0 && (
        <div className="flex-shrink-0 px-6 py-2.5 text-xs font-semibold text-carbon bg-yellow">
          {failedCount} pendência(s) tiveram falha de sincronização. Os dados continuam armazenados localmente e serão tentados novamente quando houver conexão.
        </div>
      )}

      <div
        className="flex-shrink-0 grid grid-cols-4 gap-px border-b"
        style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)" }}
      >
        {[
          { label: "Confirmados", value: confirmed, color: "rgba(255,255,255,0.7)" },
          { label: "Presentes", value: present, color: "#009C63" },
          { label: "Capacidade", value: event.capacity, color: "rgba(255,255,255,0.7)" },
          { label: pendingCount ? "Pendências" : "Ocupação", value: pendingCount || `${pct}%`, color: pendingCount ? "#F8B51E" : pct >= 90 ? "#E60456" : pct >= 70 ? "#F8B51E" : "#009C63" },
        ].map(s => (
          <div key={s.label} className="py-3 text-center" style={{ background: "rgba(0,0,0,0.15)" }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-white/40 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex-shrink-0 px-6 pt-5 pb-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-xl">⌕</span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar nome, empresa, e-mail ou telefone…"
              className="w-full pl-11 pr-4 py-4 rounded-2xl text-white text-base font-medium focus:outline-none placeholder:text-white/30 transition-fast"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "2px solid",
                borderColor: query ? "#009C63" : "rgba(255,255,255,0.15)",
              }}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 overflow-x-auto">
            <AddConfirmedGuestButton event={event} />
            <QrCheckinButton event={event} />
          </div>
        </div>

        {!query && (
          <div className="flex gap-2 mt-3 overflow-x-auto">
            {([
              { id: "all", label: "Todos" },
              { id: "confirmed", label: "Confirmados" },
              { id: "invited", label: "Convidados" },
              { id: "present", label: "Presentes" },
              { id: "pending", label: `Pendências${pendingCount ? ` (${pendingCount})` : ""}` },
            ] as const).map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className="px-4 py-1.5 rounded-xl text-sm font-semibold transition-fast whitespace-nowrap"
                style={{
                  background: filter === f.id ? (f.id === "pending" ? "#F8B51E" : "#009C63") : "rgba(255,255,255,0.08)",
                  color: filter === f.id ? (f.id === "pending" ? "#3C3C3B" : "#FFFFFF") : "rgba(255,255,255,0.6)",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {notFound ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-white/40 text-4xl mb-4">◎</p>
            <p className="text-white/80 font-semibold text-base mb-1">Nenhum contato encontrado</p>
            <p className="text-white/40 text-sm mb-6">"{query}" não está na base de dados</p>
            <button
              onClick={() => { setWalkinModal(true); setWkName(query) }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-carbon text-sm transition-fast hover:opacity-90 active:scale-95"
              style={{ background: "#F8B51E" }}
            >
              + Participante sem inscrição
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {candidates.map((cand, i) => (
              <CandidateCard
                key={`${cand.registration?.id || cand.contact?.id || cand.pendingKey}-${i}`}
                cand={cand}
                onCheckin={() => void doCheckin(cand)}
                onUndo={() => {
                  const att = getAttendance(cand.registration?.id, cand.contact?.id)
                  if (att) setUndoTarget(att)
                }}
                onCancelPending={() => cand.pendingKey && void cancelPending(cand.pendingKey)}
              />
            ))}

            {query.trim() && candidates.length > 0 && (
              <button
                onClick={() => { setWalkinModal(true); setWkName(query) }}
                className="w-full py-3 mt-2 rounded-xl border text-sm font-semibold transition-fast"
                style={{
                  borderColor: "rgba(255,255,255,0.15)",
                  color: "rgba(255,255,255,0.5)",
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                + Não encontrei meu convidado — cadastrar walk-in
              </button>
            )}

            {!query && candidates.length === 0 && (
              <div className="text-center py-8 text-white/40">
                <p>{filter === "pending" ? "Nenhuma pendência local" : "Nenhum resultado para este filtro"}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        open={walkinModal}
        onClose={() => { setWalkinModal(false); setWkName(""); setWkEmail(""); setWkWhatsapp(""); setWkEmpresa(""); setWkCargo("") }}
        title="Novo participante"
        maxWidth="md"
        footer={
          <>
            <button onClick={() => setWalkinModal(false)} className="px-4 py-2 text-sm font-bold text-carbon-60">
              Cancelar
            </button>
            <button
              onClick={() => void doWalkin()}
              disabled={!wkName.trim()}
              className="px-5 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-50 transition-fast"
              style={{ background: "#009C63" }}
            >
              {isOnline ? "Salvar e registrar presença" : "Salvar como pendência offline"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {!isOnline && (
            <p className="text-xs font-semibold text-[#9B6E00] bg-light-yellow px-3 py-2 rounded-lg">
              Sem conexão. O participante e o check-in serão mantidos no dispositivo como pendência e reconciliados com o servidor ao reconectar.
            </p>
          )}
          <p className="text-xs text-carbon-60 bg-light-yellow px-3 py-2 rounded-lg">
            Somente nome é obrigatório. Outros campos podem ser completados depois.
          </p>
          <Field label="Nome *" required>
            <input value={wkName} onChange={e => setWkName(e.target.value)} placeholder="Nome completo" className="w-full px-4 py-3 rounded-xl border border-carbon-20 text-sm text-carbon focus:outline-none focus:border-green" autoFocus />
          </Field>
          <Field label="E-mail">
            <input type="email" value={wkEmail} onChange={e => setWkEmail(e.target.value)} placeholder="email@exemplo.com" className="w-full px-4 py-3 rounded-xl border border-carbon-20 text-sm text-carbon focus:outline-none focus:border-green" />
          </Field>
          <Field label="WhatsApp">
            <input value={wkWhatsapp} onChange={e => setWkWhatsapp(e.target.value)} placeholder="(51) 99999-9999" className="w-full px-4 py-3 rounded-xl border border-carbon-20 text-sm text-carbon focus:outline-none focus:border-green" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Empresa">
              <input value={wkEmpresa} onChange={e => setWkEmpresa(e.target.value)} placeholder="Nome da empresa" className="w-full px-4 py-3 rounded-xl border border-carbon-20 text-sm text-carbon focus:outline-none focus:border-green" />
            </Field>
            <Field label="Cargo">
              <input value={wkCargo} onChange={e => setWkCargo(e.target.value)} placeholder="Cargo ou função" className="w-full px-4 py-3 rounded-xl border border-carbon-20 text-sm text-carbon focus:outline-none focus:border-green" />
            </Field>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!undoTarget}
        onClose={() => setUndoTarget(null)}
        title="Desfazer check-in"
        maxWidth="sm"
        footer={
          <>
            <button onClick={() => setUndoTarget(null)} className="px-4 py-2 text-sm font-bold text-carbon-60">Cancelar</button>
            <button
              onClick={async () => {
                if (undoTarget && await undoCheckin(undoTarget.id)) setUndoTarget(null)
              }}
              className="px-4 py-2 text-sm font-bold text-white rounded-lg"
              style={{ background: "#E60456" }}
            >
              Desfazer
            </button>
          </>
        }
      >
        <p className="text-sm text-carbon">
          Desfazer o check-in de <strong>{undoTarget?.name}</strong>?
        </p>
        <p className="text-xs text-carbon-60 mt-2">
          {isOnline ? "O registro original será preservado." : "Esta ação exige conexão e será bloqueada enquanto o dispositivo estiver offline."}
        </p>
      </Modal>

      {successToast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl text-sm font-bold z-50 shadow-lg"
          style={{ background: successToast.startsWith("⏳") ? "#F8B51E" : "#009C63", color: successToast.startsWith("⏳") ? "#3C3C3B" : "#FFFFFF" }}
        >
          {successToast}
        </div>
      )}
    </div>
  )
}

function CandidateCard({
  cand,
  onCheckin,
  onUndo,
  onCancelPending,
}: {
  cand: CandidateResult
  onCheckin: () => void
  onUndo: () => void
  onCancelPending: () => void
}) {
  const name = cand.contact ? fullName(cand.contact) : (cand.registration?.name || "Participante")
  const company = cand.contact?.organization || cand.registration?.company
  const position = cand.contact?.position || cand.registration?.position

  const caseConfig: Record<CheckinCase, { badge: string; badgeBg: string; badgeColor: string; btnLabel: string; btnBg: string }> = {
    luma: { badge: "Confirmado no Luma", badgeBg: "#E8F4EF", badgeColor: "#009C63", btnLabel: "Check-in", btnBg: "#009C63" },
    invited_no_luma: { badge: "Convidado · sem inscrição no Luma", badgeBg: "#FFF4D6", badgeColor: "#9B6E00", btnLabel: "Registrar presença", btnBg: "#F8B51E" },
    mailing_not_invited: { badge: "Contato do mailing · não inscrito", badgeBg: "#F4F4F1", badgeColor: "#7A7A78", btnLabel: "Registrar presença", btnBg: "#7A7A78" },
    not_found: { badge: "Não encontrado", badgeBg: "#FCE7EF", badgeColor: "#E60456", btnLabel: "Registrar presença", btnBg: "#E60456" },
  }
  const cfg = caseConfig[cand.checkInCase]
  const pending = Boolean(cand.isPending && !cand.isPresent)

  return (
    <div
      className="flex items-center gap-4 rounded-2xl px-5 py-4 transition-fast"
      style={{
        background: cand.isPresent ? "rgba(0,156,99,0.12)" : pending ? "rgba(248,181,30,0.12)" : "rgba(255,255,255,0.07)",
        border: "1px solid",
        borderColor: cand.isPresent ? "rgba(0,156,99,0.4)" : pending ? "rgba(248,181,30,0.45)" : "rgba(255,255,255,0.1)",
      }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
        style={{ background: cand.isPresent ? "#009C63" : pending ? "#F8B51E" : "rgba(255,255,255,0.15)", color: pending ? "#3C3C3B" : "#FFFFFF" }}
      >
        {cand.isPresent ? "✓" : pending ? "…" : getInitials(name)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <p className="text-white font-bold text-sm">{name}</p>
          {pending ? (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#F8B51E", color: "#3C3C3B" }}>
              PENDENTE DE SINCRONIZAÇÃO
            </span>
          ) : !cand.isPresent ? (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: cfg.badgeBg, color: cfg.badgeColor }}>
              {cfg.badge}
            </span>
          ) : (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#009C63", color: "#FFFFFF" }}>
              ✓ PRESENTE
            </span>
          )}
        </div>
        <p className="text-white/50 text-xs truncate">{position}{position && company ? " · " : ""}{company}</p>
        {cand.registration?.email && <p className="text-white/30 text-xs truncate">{cand.registration.email}</p>}
      </div>

      {pending ? (
        <button onClick={onCancelPending} className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold border transition-fast" style={{ borderColor: "rgba(248,181,30,0.5)", color: "#F8B51E" }}>
          Cancelar pendência
        </button>
      ) : cand.isPresent ? (
        <button onClick={onUndo} className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold border transition-fast" style={{ borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.4)" }}>
          Desfazer
        </button>
      ) : (
        <button onClick={onCheckin} className="flex-shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-fast hover:opacity-90 active:scale-95 min-w-[120px]" style={{ background: cfg.btnBg, color: cfg.badgeColor === "#9B6E00" ? "#3C3C3B" : "#FFFFFF" }}>
          {cfg.btnLabel}
        </button>
      )}
    </div>
  )
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-carbon-60 uppercase tracking-wide mb-1.5">
        {label} {required && <span className="text-magenta">*</span>}
      </span>
      {children}
    </label>
  )
}
