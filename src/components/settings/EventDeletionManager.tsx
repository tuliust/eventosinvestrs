import { useMemo, useState } from "react"
import Modal from "@/components/ui/Modal"
import { useApp } from "@/contexts/AppContext"
import { loadAppData } from "@/lib/api"
import { EVENT_STATUS_LABELS } from "@/lib/constants"
import { supabase } from "@/lib/supabase"
import { formatDate } from "@/lib/utils"

const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl border border-carbon-20 bg-white text-sm text-carbon focus:border-green focus:ring-2 focus:ring-green/20 focus:outline-none transition-fast"

export default function EventDeletionManager() {
  const { state, dispatch } = useApp()
  const [selectedId, setSelectedId] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const events = useMemo(
    () => [...state.events].sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date)
      if (dateCompare !== 0) return dateCompare
      return b.startTime.localeCompare(a.startTime)
    }),
    [state.events],
  )

  const selectedEvent = state.events.find((event) => event.id === selectedId)
  const registrationCount = selectedEvent ? (state.registrations[selectedEvent.id] || []).length : 0
  const inviteCount = selectedEvent ? (state.invites[selectedEvent.id] || []).length : 0
  const attendanceCount = selectedEvent
    ? (state.attendances[selectedEvent.id] || []).filter((attendance) => !attendance.undoneAt).length
    : 0
  const childEventCount = selectedEvent
    ? state.events.filter((event) => event.parentEvent === selectedEvent.id).length
    : 0

  const openConfirmation = () => {
    if (!selectedEvent) return
    setMessage("")
    setError("")
    setConfirmation("")
    setConfirmOpen(true)
  }

  const deleteEvent = async () => {
    if (!selectedEvent || confirmation !== "EXCLUIR") return

    setDeleting(true)
    setMessage("")
    setError("")

    try {
      const { data, error: deleteError } = await supabase
        .from("events")
        .delete()
        .eq("id", selectedEvent.id)
        .select("id")
        .maybeSingle()

      if (deleteError) throw new Error(deleteError.message)
      if (!data) throw new Error("O evento não foi encontrado ou não pôde ser excluído.")

      const appData = await loadAppData()
      dispatch({ type: "HYDRATE_DATA", payload: appData })

      setConfirmOpen(false)
      setConfirmation("")
      setSelectedId("")
      setMessage(`Evento “${selectedEvent.title}” excluído definitivamente.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível excluir o evento.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <section className="bg-white rounded-2xl border border-carbon-20 p-5 mb-4">
        <div className="mb-4">
          <h3 className="font-bold text-carbon">Excluir evento</h3>
          <p className="text-xs text-carbon-60 mt-1 leading-relaxed">
            Exclusão administrativa e definitiva de um evento. Contatos e organizações não são removidos.
          </p>
        </div>

        {message && <div className="rounded-xl px-3.5 py-2.5 text-xs font-semibold mb-4 bg-green/10 text-green">{message}</div>}
        {error && <div className="rounded-xl px-3.5 py-2.5 text-xs font-semibold mb-4 bg-light-magenta text-magenta">{error}</div>}

        {events.length === 0 ? (
          <p className="text-sm text-carbon-60">Não há eventos cadastrados.</p>
        ) : (
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-bold text-carbon block mb-1.5">Evento</span>
              <select className={inputClass} value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setMessage(""); setError("") }}>
                <option value="">Selecione um evento</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {formatDate(event.date)} · {event.title}
                  </option>
                ))}
              </select>
            </label>

            {selectedEvent && (
              <div className="rounded-xl border border-carbon-20 bg-neutral/35 p-4">
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-neutral text-carbon-60">
                        {EVENT_STATUS_LABELS[selectedEvent.status]}
                      </span>
                      <span className="text-xs text-carbon-60">
                        {formatDate(selectedEvent.date)} · {selectedEvent.startTime}–{selectedEvent.endTime}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-carbon break-words">{selectedEvent.title}</p>
                    <p className="text-xs text-carbon-60 mt-2">
                      {registrationCount} inscrição(ões) · {inviteCount} convite(s) · {attendanceCount} presença(s)
                      {childEventCount > 0 ? ` · ${childEventCount} evento(s) vinculado(s)` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openConfirmation}
                    className="px-4 py-2.5 rounded-xl border border-magenta text-magenta text-sm font-bold hover:bg-light-magenta/40 transition-fast"
                  >
                    Excluir evento
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <Modal
        open={confirmOpen}
        onClose={() => !deleting && setConfirmOpen(false)}
        title="Excluir evento"
        maxWidth="lg"
        footer={(
          <>
            <button disabled={deleting} onClick={() => setConfirmOpen(false)} className="px-4 py-2 rounded-xl border border-carbon-20 text-sm font-bold disabled:opacity-50">
              Cancelar
            </button>
            <button disabled={confirmation !== "EXCLUIR" || deleting} onClick={() => void deleteEvent()} className="px-4 py-2 rounded-xl bg-magenta text-white text-sm font-bold disabled:opacity-40">
              {deleting ? "Excluindo…" : "Excluir definitivamente"}
            </button>
          </>
        )}
      >
        {selectedEvent && (
          <div className="space-y-4">
            <div className="rounded-xl bg-light-magenta px-4 py-3 text-sm text-magenta font-semibold leading-relaxed">
              Esta ação é irreversível. O evento “{selectedEvent.title}” e seus registros de inscrições, convites e check-ins serão excluídos. Contatos e organizações permanecerão na base.
              {childEventCount > 0 ? ` ${childEventCount} evento(s) vinculado(s) deixarão de ter este evento como evento principal.` : ""}
            </div>
            <label className="block">
              <span className="text-xs font-bold text-carbon block mb-1.5">Digite EXCLUIR para confirmar</span>
              <input autoFocus className={inputClass} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="EXCLUIR" autoComplete="off" />
            </label>
          </div>
        )}
      </Modal>
    </>
  )
}
