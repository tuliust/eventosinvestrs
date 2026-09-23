import { useState } from "react"
import { useApp, useEventRegistrations, useEventAttendances, useCheckinActions } from "@/contexts/AppContext"
import { searchContacts, fullName, getInitials, formatTime } from "@/lib/utils"
import Modal from "@/components/ui/Modal"
import type { Event } from "@/lib/types"

interface Props { event: Event }

type Filter = "all" | "confirmed" | "present" | "noshow"

export default function CheckinTab({ event }: Props) {
  const { state } = useApp()
  const registrations = useEventRegistrations(event.id)
  const attendances = useEventAttendances(event.id)
  const { checkin, undoCheckin, isCheckedIn, getAttendance, error: mutationError } = useCheckinActions(event.id)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [undoTarget, setUndoTarget] = useState<typeof attendances[0] | null>(null)
  const user = state.user

  // Build combined list of all confirmed registrations
  let items = registrations.filter(r => r.approvalStatus === "approved")

  if (filter === "present") items = items.filter(r => isCheckedIn(r.id, r.contactId))
  else if (filter === "noshow") items = items.filter(r => !isCheckedIn(r.id, r.contactId))

  if (query.trim()) {
    const q = query.toLowerCase()
    items = items.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.company || "").toLowerCase().includes(q) ||
      (r.email || "").toLowerCase().includes(q)
    )
  }

  const handleCheckin = async (reg: typeof registrations[0]) => {
    if (!user) return
    await checkin({
      name: reg.name,
      company: reg.company,
      position: reg.position,
      contactId: reg.contactId,
      registrationId: reg.id,
      source: reg.source,
      checkedInBy: user.id,
    })
  }

  const handleUndo = async () => {
    if (!undoTarget || !user) return
    if (await undoCheckin(undoTarget.id, user.id)) setUndoTarget(null)
  }

  const present = attendances.length
  const confirmed = registrations.filter(r => r.approvalStatus === "approved").length

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Stats */}
      <div className="flex-shrink-0 flex gap-px bg-carbon-20/40 border-b border-carbon-20">
        {[
          { label: "Confirmados", value: confirmed, color: "#3C3C3B" },
          { label: "Presentes", value: present, color: "#009C63" },
          { label: "No-show", value: Math.max(0, confirmed - present), color: "#E60456" },
        ].map(s => (
          <div key={s.label} className="flex-1 px-4 py-3 bg-white text-center">
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-carbon-60">{s.label}</p>
          </div>
        ))}
      </div>

      {mutationError && (
        <div className="flex-shrink-0 px-6 py-2.5 text-xs font-semibold text-white bg-magenta">
          {mutationError}
        </div>
      )}

      {/* Search + filters */}
      <div className="flex-shrink-0 flex items-center gap-3 px-6 py-3 border-b border-carbon-20 bg-white/60">
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por nome, empresa ou e-mail…"
          className="flex-1 px-4 py-2 rounded-xl border border-carbon-20 text-sm text-carbon focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20 transition-fast"
          style={{ background: "#FFFFFF" }}
        />
        <div className="flex gap-1">
          {([
            { id: "all", label: "Todos" },
            { id: "present", label: "Presentes" },
            { id: "noshow", label: "No-show" },
          ] as const).map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-fast ${
                filter === f.id ? "bg-carbon text-white" : "text-carbon-60 hover:bg-neutral"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-2">
          {items.map(reg => {
            const checked = isCheckedIn(reg.id, reg.contactId)
            const att = getAttendance(reg.id, reg.contactId)

            return (
              <div
                key={reg.id}
                className="flex items-center gap-4 bg-white rounded-xl px-4 py-3 border transition-fast"
                style={{ borderColor: checked ? "#009C63" : "#E2E2DF" }}
              >
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: checked ? "#009C63" : "#7A7A78" }}
                >
                  {checked ? "✓" : getInitials(reg.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-carbon text-sm truncate">{reg.name}</p>
                  <p className="text-xs text-carbon-60 truncate">
                    {reg.position}{reg.position && reg.company ? " · " : ""}{reg.company}
                  </p>
                  {checked && att && (
                    <p className="text-xs font-semibold" style={{ color: "#009C63" }}>
                      Presente · {formatTime(att.checkedInAt)}
                    </p>
                  )}
                </div>

                {/* Action */}
                {checked ? (
                  <button
                    onClick={() => {
                      const a = getAttendance(reg.id, reg.contactId)
                      if (a) setUndoTarget(a)
                    }}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border transition-fast hover:bg-magenta/10"
                    style={{ borderColor: "#E2E2DF", color: "#7A7A78" }}
                  >
                    Desfazer
                  </button>
                ) : (
                  <button
                    onClick={() => handleCheckin(reg)}
                    className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-bold text-white transition-fast hover:opacity-90 active:scale-95"
                    style={{ background: "#009C63" }}
                  >
                    Check-in
                  </button>
                )}
              </div>
            )
          })}

          {items.length === 0 && (
            <div className="text-center py-12 text-carbon-60">
              <p className="text-3xl mb-2 opacity-30">✓</p>
              <p className="font-medium text-sm">Nenhum resultado</p>
            </div>
          )}
        </div>
      </div>

      {/* Undo confirmation modal */}
      <Modal
        open={!!undoTarget}
        onClose={() => setUndoTarget(null)}
        title="Desfazer check-in"
        maxWidth="sm"
        footer={
          <>
            <button onClick={() => setUndoTarget(null)} className="px-4 py-2 text-sm font-bold text-carbon-60">
              Cancelar
            </button>
            <button
              onClick={handleUndo}
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
          O registro original será preservado com a anotação de reversão.
        </p>
      </Modal>
    </div>
  )
}
