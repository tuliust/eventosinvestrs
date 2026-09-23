import { ClipboardEvent, KeyboardEvent, useEffect, useMemo, useState } from "react"
import type { Segment, Subsegment } from "@/lib/types"

interface Props {
  organizations: string[]
  organizationSuggestions: string[]
  onOrganizationsChange: (organizations: string[]) => void
  sectorIds: string[]
  subsegmentIds: string[]
  segments: Segment[]
  subsegments: Subsegment[]
  onSectorIdsChange: (sectorIds: string[]) => void
  onSubsegmentIdsChange: (subsegmentIds: string[]) => void
}

const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl border border-carbon-20 bg-white text-sm text-carbon placeholder:text-carbon-60/60 focus:border-green focus:ring-2 focus:ring-green/20 focus:outline-none transition-fast"

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

export default function EventAudienceFields({
  organizations,
  organizationSuggestions,
  onOrganizationsChange,
  sectorIds,
  subsegmentIds,
  segments,
  subsegments,
  onSectorIdsChange,
  onSubsegmentIdsChange,
}: Props) {
  const [organizationDraft, setOrganizationDraft] = useState("")
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(() => {
    const selected = new Set(subsegmentIds)
    return new Set(
      subsegments.filter((item) => selected.has(item.id)).map((item) => item.segmentId),
    )
  })

  const activeSegments = useMemo(
    () =>
      [...segments]
        .filter((item) => item.active)
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === "priority" ? -1 : 1
          return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR")
        }),
    [segments],
  )

  const activeSubsegments = useMemo(
    () =>
      [...subsegments]
        .filter((item) => item.active)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR")),
    [subsegments],
  )

  useEffect(() => {
    if (subsegmentIds.length === 0) return
    const selected = new Set(subsegmentIds)
    const parentIds = activeSubsegments
      .filter((item) => selected.has(item.id))
      .map((item) => item.segmentId)
    if (parentIds.length === 0) return
    setExpandedSegments((current) => {
      const next = new Set(current)
      parentIds.forEach((id) => next.add(id))
      return next
    })
  }, [activeSubsegments, subsegmentIds])

  const addOrganizations = (rawValues: string[]) => {
    const existing = new Set(organizations.map((item) => item.toLocaleLowerCase("pt-BR")))
    const next = [...organizations]

    rawValues.forEach((raw) => {
      const value = normalizeName(raw)
      if (!value) return
      const key = value.toLocaleLowerCase("pt-BR")
      if (existing.has(key)) return
      existing.add(key)
      next.push(value)
    })

    if (next.length !== organizations.length) onOrganizationsChange(next)
    setOrganizationDraft("")
  }

  const addOrganizationDraft = () => addOrganizations([organizationDraft])

  const handleOrganizationKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ";") {
      event.preventDefault()
      addOrganizationDraft()
    }
    if (event.key === "Backspace" && !organizationDraft && organizations.length > 0) {
      onOrganizationsChange(organizations.slice(0, -1))
    }
  }

  const handleOrganizationPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text")
    if (!/[;\n\r]/.test(text)) return
    event.preventDefault()
    addOrganizations(text.split(/[;\n\r]+/))
  }

  const toggleSector = (segmentId: string, checked: boolean) => {
    if (checked) {
      if (!sectorIds.includes(segmentId)) onSectorIdsChange([...sectorIds, segmentId])
      return
    }

    onSectorIdsChange(sectorIds.filter((id) => id !== segmentId))
    const childIds = new Set(
      activeSubsegments.filter((item) => item.segmentId === segmentId).map((item) => item.id),
    )
    onSubsegmentIdsChange(subsegmentIds.filter((id) => !childIds.has(id)))
  }

  const toggleSubsegment = (segmentId: string, subsegmentId: string, checked: boolean) => {
    if (checked) {
      if (!sectorIds.includes(segmentId)) onSectorIdsChange([...sectorIds, segmentId])
      if (!subsegmentIds.includes(subsegmentId)) {
        onSubsegmentIdsChange([...subsegmentIds, subsegmentId])
      }
      return
    }
    onSubsegmentIdsChange(subsegmentIds.filter((id) => id !== subsegmentId))
  }

  const toggleExpanded = (segmentId: string) => {
    setExpandedSegments((current) => {
      const next = new Set(current)
      if (next.has(segmentId)) next.delete(segmentId)
      else next.add(segmentId)
      return next
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div>
        <p className="text-xs font-semibold text-carbon-60 mb-1.5">
          Organizações participantes
        </p>
        <div className="rounded-xl border border-carbon-20 bg-white p-3 min-h-44 focus-within:border-green focus-within:ring-2 focus-within:ring-green/20 transition-fast">
          {organizations.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {organizations.map((organization) => (
                <span
                  key={organization}
                  className="inline-flex items-center gap-2 rounded-lg bg-neutral px-2.5 py-1.5 text-xs font-semibold text-carbon"
                >
                  {organization}
                  <button
                    type="button"
                    onClick={() =>
                      onOrganizationsChange(organizations.filter((item) => item !== organization))
                    }
                    className="text-carbon-60 hover:text-magenta"
                    aria-label={`Remover ${organization}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              className={`${inputClass} border-0 px-1 py-2 focus:ring-0`}
              value={organizationDraft}
              list="event-organization-suggestions"
              onChange={(event) => setOrganizationDraft(event.target.value)}
              onKeyDown={handleOrganizationKeyDown}
              onPaste={handleOrganizationPaste}
              onBlur={() => {
                if (organizationDraft.trim()) addOrganizationDraft()
              }}
              placeholder="Digite o nome da empresa ou entidade"
            />
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={addOrganizationDraft}
              disabled={!organizationDraft.trim()}
              className="self-center px-3 py-2 rounded-lg bg-light-green text-green text-xs font-bold disabled:opacity-40"
            >
              Adicionar
            </button>
          </div>

          <datalist id="event-organization-suggestions">
            {organizationSuggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
        <p className="text-[11px] text-carbon-60 mt-2 leading-relaxed">
          Digite livremente os co-organizadores ou organizações participantes. Pressione Enter
          para adicionar; também é possível colar vários nomes separados por linha ou ponto e
          vírgula.
        </p>
      </div>

      <div>
        <div className="flex items-end justify-between gap-3 mb-1.5">
          <p className="text-xs font-semibold text-carbon-60">Setores econômicos</p>
          {(sectorIds.length > 0 || subsegmentIds.length > 0) && (
            <span className="text-[11px] font-semibold text-green">
              {sectorIds.length} setor(es) · {subsegmentIds.length} subsetor(es)
            </span>
          )}
        </div>

        <div className="rounded-xl border border-carbon-20 bg-white max-h-96 overflow-y-auto">
          {activeSegments.map((segment) => {
            const children = activeSubsegments.filter((item) => item.segmentId === segment.id)
            const expanded = expandedSegments.has(segment.id)
            const checked = sectorIds.includes(segment.id)
            const selectedChildren = children.filter((item) => subsegmentIds.includes(item.id)).length

            return (
              <div key={segment.id} className="border-b border-carbon-20/70 last:border-b-0">
                <div className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-neutral/50">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => toggleSector(segment.id, event.target.checked)}
                    className="h-4 w-4 rounded border-carbon-20 accent-green"
                    aria-label={`Selecionar setor ${segment.name}`}
                  />
                  <button
                    type="button"
                    onClick={() => toggleSector(segment.id, !checked)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block text-sm font-semibold text-carbon leading-snug">
                      {segment.name}
                    </span>
                    <span className="block text-[10px] text-carbon-60 mt-0.5">
                      {segment.type === "priority" ? "Prioritário" : "Secundário"}
                      {selectedChildren > 0 ? ` · ${selectedChildren} subsetor(es) selecionado(s)` : ""}
                    </span>
                  </button>
                  {children.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleExpanded(segment.id)}
                      className="w-8 h-8 rounded-lg border border-carbon-20 bg-white text-carbon-60 text-sm font-bold hover:border-green hover:text-green"
                      aria-expanded={expanded}
                      aria-label={`${expanded ? "Recolher" : "Expandir"} subsetores de ${segment.name}`}
                    >
                      {expanded ? "−" : "+"}
                    </button>
                  )}
                </div>

                {expanded && children.length > 0 && (
                  <div className="bg-neutral/35 border-t border-carbon-20/60 px-3 py-2 pl-10 space-y-1">
                    {children.map((subsegment) => (
                      <label
                        key={subsegment.id}
                        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={subsegmentIds.includes(subsegment.id)}
                          onChange={(event) =>
                            toggleSubsegment(segment.id, subsegment.id, event.target.checked)
                          }
                          className="h-3.5 w-3.5 rounded border-carbon-20 accent-green"
                        />
                        <span className="text-xs font-medium text-carbon">{subsegment.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-[11px] text-carbon-60 mt-2 leading-relaxed">
          Marque um ou mais setores. Expanda um setor para refinar o público por subsetores; se
          nenhum subsetor for marcado, o setor inteiro será considerado no mailing.
        </p>
      </div>
    </div>
  )
}
