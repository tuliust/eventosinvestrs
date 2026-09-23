import { useApp, useEventAttendances } from "@/contexts/AppContext"
import { formatTime, getInitials } from "@/lib/utils"
import { SOURCE_LABELS } from "@/lib/constants"
import type { Event } from "@/lib/types"

interface Props { event: Event }

export default function ParticipantsTab({ event }: Props) {
  const attendances = useEventAttendances(event.id)
  const { state } = useApp()

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-carbon-20 bg-white/60">
        <div>
          <h3 className="font-bold text-carbon text-sm">Participantes presentes</h3>
          <p className="text-xs text-carbon-60 mt-0.5">{attendances.length} pessoa{attendances.length !== 1 ? "s" : ""} registrada{attendances.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {attendances.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-3xl mb-3 opacity-30">✓</p>
            <p className="text-carbon-60 font-medium text-sm">Nenhum check-in ainda</p>
            <p className="text-xs text-carbon-60 opacity-70 mt-1">Os participantes aparecerão aqui conforme o check-in for feito</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...attendances].sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt)).map((att, i) => (
              <div key={att.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-carbon-20">
                <span className="text-xs text-carbon-60 w-6 text-right flex-shrink-0">{i + 1}</span>
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: "#009C63" }}
                >
                  {getInitials(att.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-carbon text-sm truncate">{att.name}</p>
                  <p className="text-xs text-carbon-60 truncate">
                    {att.position}{att.position && att.company ? " · " : ""}{att.company}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold text-green">{formatTime(att.checkedInAt)}</p>
                  <p className="text-xs text-carbon-60">{SOURCE_LABELS[att.source] || att.source}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
