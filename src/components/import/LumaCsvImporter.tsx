import { useCallback, useMemo, useState } from "react"
import { useApp } from "@/contexts/AppContext"
import { CANONICAL_FIELD_LABELS } from "@/lib/constants"
import { saveContact, saveRegistrations } from "@/lib/api"
import { recordEventImportRun } from "@/lib/eventImportAuditApi"
import {
  buildLumaRegistrations,
  createLumaMappings,
  matchLumaRows,
  parseCsv,
} from "@/lib/lumaImport"
import { fullName, generateId, searchContacts } from "@/lib/utils"
import type { Contact, Event } from "@/lib/types"

type CsvColumnMapping = ReturnType<typeof createLumaMappings>[number]
type MatchedImportRow = ReturnType<typeof matchLumaRows>[number]
type ImportStep = "upload" | "mapping" | "review" | "done"
type ResolutionAction = "pending" | "link" | "create" | "unlinked" | "ignore"

type RowResolution = {
  action: ResolutionAction
  contactId?: string
  search?: string
}

interface Props {
  event: Event
  onClose: () => void
}

export default function LumaCsvImporter({ event, onClose }: Props) {
  const { state, dispatch } = useApp()
  const [step, setStep] = useState<ImportStep>("upload")
  const [fileName, setFileName] = useState("")
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [mappings, setMappings] = useState<CsvColumnMapping[]>([])
  const [matchedRows, setMatchedRows] = useState<MatchedImportRow[]>([])
  const [resolutions, setResolutions] = useState<Record<number, RowResolution>>({})
  const [importedCount, setImportedCount] = useState(0)
  const [ignoredCount, setIgnoredCount] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState("")
  const [auditWarning, setAuditWarning] = useState("")

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const { headers, rows } = parseCsv(text)
      setFileName(file.name)
      setCsvHeaders(headers)
      setCsvRows(rows)
      setMappings(createLumaMappings(headers))
      setMatchedRows([])
      setResolutions({})
      setImportError("")
      setAuditWarning("")
      setStep("mapping")
    }
    reader.readAsText(file, "UTF-8")
  }, [])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.toLowerCase().endsWith(".csv")) handleFile(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const updateMapping = (index: number, value: string) => {
    setMappings((prev) =>
      prev.map((mapping, i) =>
        i === index
          ? {
              ...mapping,
              mappedTo: value as CsvColumnMapping["mappedTo"],
              isCustom: value === "custom",
            }
          : mapping,
      ),
    )
  }

  const runMatching = () => {
    const next = matchLumaRows(csvRows, mappings, state.contacts)
    const initialResolutions: Record<number, RowResolution> = {}
    next.forEach((row, index) => {
      if (row.matchResult === "possible") {
        initialResolutions[index] = { action: "pending" }
      }
    })
    setMatchedRows(next)
    setResolutions(initialResolutions)
    setImportError("")
    setStep("review")
  }

  const setResolution = (index: number, resolution: Partial<RowResolution>) => {
    setResolutions((current) => ({
      ...current,
      [index]: { ...(current[index] || { action: "pending" }), ...resolution },
    }))
  }

  const unresolvedPossible = useMemo(
    () => matchedRows.reduce(
      (total, row, index) => total + (row.matchResult === "possible" && (resolutions[index]?.action || "pending") === "pending" ? 1 : 0),
      0,
    ),
    [matchedRows, resolutions],
  )

  const safe = matchedRows.filter((row) => row.matchResult === "safe").length
  const possible = matchedRows.filter((row) => row.matchResult === "possible").length
  const newCount = matchedRows.filter((row) => row.matchResult === "new").length
  const incomplete = matchedRows.filter((row) => row.matchResult === "incomplete").length
  const errors = matchedRows.filter((row) => row.matchResult === "error").length
  const ignored = Object.values(resolutions).filter((resolution) => resolution.action === "ignore").length

  const createContactFromRow = async (row: MatchedImportRow, userId: string): Promise<Contact> => {
    const name = (row.canonicalData.name || "Contato Luma").trim()
    const parts = name.split(/\s+/)
    const now = new Date().toISOString()
    const contact: Contact = {
      id: generateId(),
      firstName: parts[0] || "Contato",
      lastName: parts.slice(1).join(" "),
      email: row.canonicalData.email || undefined,
      phone: row.canonicalData.phone || undefined,
      organization: row.canonicalData.company || undefined,
      position: row.canonicalData.position || undefined,
      communicationStatus: "active",
      origin: "luma",
      incompleteProfile: !row.canonicalData.email && !row.canonicalData.phone,
      createdAt: now,
      updatedAt: now,
    }
    const saved = await saveContact(contact, userId)
    dispatch({ type: "ADD_CONTACT", payload: saved })
    return saved
  }

  const runImport = async () => {
    const user = state.user
    if (!user || isImporting) return
    if (unresolvedPossible > 0) {
      setImportError(`Resolva as ${unresolvedPossible} correspondência(s) possível(is) antes de importar.`)
      return
    }

    setImportError("")
    setAuditWarning("")
    setIsImporting(true)

    try {
      const resolvedRows: MatchedImportRow[] = []

      for (let index = 0; index < matchedRows.length; index += 1) {
        const row = matchedRows[index]
        if (row.matchResult !== "possible") {
          resolvedRows.push(row)
          continue
        }

        const resolution = resolutions[index]
        if (!resolution || resolution.action === "ignore") continue

        if (resolution.action === "unlinked") {
          resolvedRows.push({ ...row, matchResult: "new", contact: undefined, conflicts: [] })
          continue
        }

        if (resolution.action === "create") {
          const contact = await createContactFromRow(row, user.id)
          resolvedRows.push({ ...row, matchResult: "safe", contact, conflicts: [] })
          continue
        }

        if (resolution.action === "link") {
          const contact = state.contacts.find((item) => item.id === resolution.contactId) || row.contact
          if (!contact) throw new Error(`Contato escolhido não foi encontrado para ${row.canonicalData.name || "uma linha"}.`)
          resolvedRows.push({ ...row, matchResult: "safe", contact, conflicts: [] })
        }
      }

      const newRegistrations = buildLumaRegistrations(
        event.id,
        resolvedRows,
        state.registrations[event.id] || [],
      )

      await saveRegistrations(newRegistrations)
      for (const registration of newRegistrations) {
        dispatch({ type: "ADD_REGISTRATION", payload: registration })
      }

      const ignoredRows = matchedRows.length - resolvedRows.length
      setImportedCount(newRegistrations.length)
      setIgnoredCount(ignoredRows)

      try {
        await recordEventImportRun({
          eventId: event.id,
          source: "luma",
          fileName: fileName || "luma.csv",
          columns: csvHeaders,
          mapping: mappings.map((mapping) => ({
            source: mapping.originalName,
            target: String(mapping.mappedTo || "skip"),
            isCustom: Boolean(mapping.isCustom),
          })),
          total: matchedRows.length,
          safe,
          possible,
          newCount,
          ignored: ignoredRows,
          errors,
          imported: newRegistrations.length,
          createdBy: user.id,
        })
      } catch (auditError) {
        setAuditWarning(
          auditError instanceof Error
            ? `Os registros foram importados, mas a auditoria falhou: ${auditError.message}`
            : "Os registros foram importados, mas a auditoria não pôde ser gravada.",
        )
      }

      setStep("done")
    } catch (error) {
      setImportError(
        error instanceof Error
          ? `Não foi possível importar: ${error.message}`
          : "Não foi possível importar os registros.",
      )
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-carbon-20 bg-white">
        <div>
          <h2 className="font-bold text-carbon text-base">Importar CSV Luma</h2>
          <p className="text-xs text-carbon-60 mt-0.5">{event.title}</p>
        </div>
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold border border-carbon-20 text-carbon-60 hover:text-carbon transition-fast">
          ← Voltar
        </button>
      </div>

      <div className="flex-shrink-0 flex gap-0 border-b border-carbon-20 bg-white/60">
        {(["upload", "mapping", "review", "done"] as ImportStep[]).map((currentStep, i) => {
          const labels = ["Upload", "Mapeamento", "Revisão", "Concluído"]
          const done = ["upload", "mapping", "review", "done"].indexOf(step) > i
          const active = step === currentStep
          return (
            <div key={currentStep} className="flex-1 flex items-center gap-2 px-4 py-3 text-xs font-semibold" style={{ color: active || done ? "#009C63" : "#7A7A78" }}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: active ? "#009C63" : done ? "#E8F4EF" : "#F4F4F1", color: active ? "#FFF" : done ? "#009C63" : "#7A7A78" }}>
                {done ? "✓" : i + 1}
              </span>
              {labels[i]}
            </div>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto">
        {step === "upload" && (
          <div className="max-w-lg mx-auto px-6 py-10">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className="border-2 border-dashed rounded-2xl p-10 text-center transition-fast cursor-pointer"
              style={{ borderColor: dragOver ? "#009C63" : "#E2E2DF", background: dragOver ? "#E8F4EF" : "#FAFAFA" }}
            >
              <p className="text-4xl mb-3 opacity-40">⬆</p>
              <p className="font-bold text-carbon mb-1">Arraste o CSV do Luma aqui</p>
              <p className="text-sm text-carbon-60 mb-4">ou selecione o arquivo</p>
              <label className="px-5 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer hover:opacity-90 transition-fast" style={{ background: "#009C63" }}>
                Selecionar arquivo
                <input type="file" accept=".csv" className="hidden" onChange={handleFileInput} />
              </label>
            </div>
            <p className="text-xs text-carbon-60 text-center mt-4">
              O importador é genérico. Colunas desconhecidas são preservadas como campos personalizados e a linha original é mantida para auditoria.
            </p>
          </div>
        )}

        {step === "mapping" && (
          <div className="max-w-3xl mx-auto px-6 py-6">
            <div className="mb-4">
              <h3 className="font-bold text-carbon text-sm mb-1">Mapeamento de colunas</h3>
              <p className="text-xs text-carbon-60">{csvRows.length} linha{csvRows.length !== 1 ? "s" : ""} detectada{csvRows.length !== 1 ? "s" : ""}. Verifique o mapeamento sugerido.</p>
              {fileName && <p className="text-[11px] text-carbon-40 mt-1">Arquivo: {fileName}</p>}
            </div>

            <div className="space-y-2 mb-6">
              {mappings.map((mapping, i) => (
                <div key={mapping.originalName} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-carbon-20">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-carbon truncate">{mapping.originalName}</p>
                    <p className="text-xs text-carbon-60 truncate">ex: "{csvRows[0]?.[mapping.originalName] || "(vazio)"}"</p>
                  </div>
                  <span className="text-carbon-60 opacity-40">→</span>
                  <select value={mapping.mappedTo || "skip"} onChange={(e) => updateMapping(i, e.target.value)} className="flex-shrink-0 px-3 py-2 rounded-lg border border-carbon-20 text-sm text-carbon focus:outline-none focus:border-green bg-white" style={{ minWidth: "180px" }}>
                    {Object.entries(CANONICAL_FIELD_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                  {mapping.isCustom && <span className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#FFF4D6", color: "#9B6E00" }}>Campo personalizado</span>}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-carbon-60">Cancelar</button>
              <button onClick={runMatching} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#009C63" }}>Analisar correspondências →</button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="max-w-5xl mx-auto px-6 py-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              <ReviewStat label="Seguras" value={safe} color="green" />
              <ReviewStat label="Possíveis" value={possible} color="yellow" />
              <ReviewStat label="Novos" value={newCount} color="carbon" />
              <ReviewStat label="Incompletos" value={incomplete} color="magenta" />
              <ReviewStat label="Ignorados" value={ignored} color="carbon" />
            </div>

            {possible > 0 && (
              <div className="mb-4 p-4 rounded-xl" style={{ background: unresolvedPossible ? "#FFF4D6" : "#E8F4EF" }}>
                <p className="text-xs font-bold" style={{ color: unresolvedPossible ? "#9B6E00" : "#009C63" }}>
                  {unresolvedPossible ? `⚠ ${unresolvedPossible} correspondência(s) possível(is) ainda precisam de decisão.` : "✓ Todas as correspondências possíveis foram revisadas."}
                </p>
                <p className="text-xs text-carbon-60 mt-1">Nenhuma correspondência por nome+empresa é vinculada automaticamente. Escolha a ação registro por registro.</p>
              </div>
            )}

            <div className="space-y-3 mb-6">
              {matchedRows.map((row, index) => {
                const name = row.canonicalData.name || "(sem nome)"
                const resolution = resolutions[index]
                const statusColors = {
                  safe: { bg: "#E8F4EF", color: "#009C63", label: "Seguro" },
                  possible: { bg: "#FFF4D6", color: "#9B6E00", label: "Possível" },
                  new: { bg: "#F4F4F1", color: "#7A7A78", label: "Novo" },
                  incomplete: { bg: "#FCE7EF", color: "#E60456", label: "Incompleto" },
                  error: { bg: "#FCE7EF", color: "#E60456", label: "Erro" },
                }
                const style = statusColors[row.matchResult]
                const search = resolution?.search || ""
                const searchResults = row.matchResult === "possible" && search.trim()
                  ? searchContacts(state.contacts, search).slice(0, 6)
                  : []

                return (
                  <div key={index} className="bg-white rounded-xl px-4 py-3 border border-carbon-20">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-carbon">{name}</p>
                        <p className="text-xs text-carbon-60">{row.canonicalData.company || "Sem organização"}{row.canonicalData.email ? ` · ${row.canonicalData.email}` : ""}</p>
                        {row.contact && <p className="text-xs text-green mt-1">Sugestão: {fullName(row.contact)}{row.contact.organization ? ` · ${row.contact.organization}` : ""}</p>}
                        {row.conflicts?.map((conflict, conflictIndex) => <p key={conflictIndex} className="text-xs mt-0.5" style={{ color: "#9B6E00" }}>⚠ {conflict}</p>)}
                      </div>
                      <span className="flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: style.bg, color: style.color }}>{style.label}</span>
                    </div>

                    {row.matchResult === "possible" && (
                      <div className="mt-3 pt-3 border-t border-carbon-20">
                        <div className="flex flex-wrap gap-2">
                          {row.contact && (
                            <button type="button" onClick={() => setResolution(index, { action: "link", contactId: row.contact?.id })} className={`px-3 py-2 rounded-lg text-xs font-bold border ${resolution?.action === "link" && resolution.contactId === row.contact.id ? "border-green bg-light-green text-green" : "border-carbon-20 text-carbon"}`}>
                              Vincular a {fullName(row.contact)}
                            </button>
                          )}
                          <button type="button" onClick={() => setResolution(index, { action: "create", contactId: undefined })} className={`px-3 py-2 rounded-lg text-xs font-bold border ${resolution?.action === "create" ? "border-green bg-light-green text-green" : "border-carbon-20 text-carbon"}`}>Criar novo contato</button>
                          <button type="button" onClick={() => setResolution(index, { action: "unlinked", contactId: undefined })} className={`px-3 py-2 rounded-lg text-xs font-bold border ${resolution?.action === "unlinked" ? "border-green bg-light-green text-green" : "border-carbon-20 text-carbon"}`}>Importar sem vínculo</button>
                          <button type="button" onClick={() => setResolution(index, { action: "ignore", contactId: undefined })} className={`px-3 py-2 rounded-lg text-xs font-bold border ${resolution?.action === "ignore" ? "border-magenta bg-light-magenta text-magenta" : "border-carbon-20 text-carbon"}`}>Ignorar linha</button>
                        </div>

                        <div className="mt-3">
                          <label className="block text-[11px] font-bold text-carbon-60 mb-1">Pesquisar outro contato</label>
                          <input value={search} onChange={(e) => setResolution(index, { search: e.target.value })} placeholder="Nome, organização, e-mail ou telefone" className="w-full px-3 py-2 rounded-lg border border-carbon-20 text-xs focus:outline-none focus:border-green" />
                          {searchResults.length > 0 && (
                            <div className="mt-1 rounded-lg border border-carbon-20 divide-y divide-carbon-20 bg-white overflow-hidden">
                              {searchResults.map((contact) => (
                                <button key={contact.id} type="button" onClick={() => setResolution(index, { action: "link", contactId: contact.id, search: fullName(contact) })} className="w-full text-left px-3 py-2 hover:bg-neutral text-xs">
                                  <span className="font-bold text-carbon">{fullName(contact)}</span>
                                  <span className="text-carbon-60">{contact.position ? ` · ${contact.position}` : ""}{contact.organization ? ` · ${contact.organization}` : ""}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {resolution?.action === "link" && resolution.contactId && (
                            <p className="mt-2 text-xs font-semibold text-green">✓ Será vinculado a {fullName(state.contacts.find((contact) => contact.id === resolution.contactId) || row.contact!)}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-carbon-60">{matchedRows.length} linha(s) analisada(s) · {errors} erro(s)</p>
              <div className="flex gap-3">
                <button onClick={() => setStep("mapping")} className="px-4 py-2 text-sm font-bold text-carbon-60">← Voltar</button>
                <button onClick={runImport} disabled={isImporting || unresolvedPossible > 0} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#009C63" }}>
                  {isImporting ? "Importando…" : unresolvedPossible > 0 ? `Resolver ${unresolvedPossible} pendência(s)` : "Confirmar importação"}
                </button>
              </div>
            </div>
            {importError && <p className="mt-3 text-xs font-semibold text-magenta text-right">{importError}</p>}
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto px-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-5" style={{ background: "#E8F4EF" }}>✓</div>
            <h3 className="text-xl font-bold text-carbon mb-2">Importação concluída</h3>
            <p className="text-sm text-carbon-60 mb-2">{importedCount} registro{importedCount !== 1 ? "s" : ""} importado{importedCount !== 1 ? "s" : ""} com sucesso.</p>
            {ignoredCount > 0 && <p className="text-xs text-carbon-60 mb-2">{ignoredCount} linha(s) ignorada(s).</p>}
            {auditWarning && <p className="text-xs font-semibold text-magenta bg-light-magenta rounded-lg px-3 py-2 mb-4">{auditWarning}</p>}
            <button onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-white text-sm mt-4" style={{ background: "#009C63" }}>Ver inscrições</button>
          </div>
        )}
      </div>
    </div>
  )
}

function ReviewStat({ label, value, color }: { label: string; value: number; color: "green" | "yellow" | "carbon" | "magenta" }) {
  const styles = {
    green: { bg: "#E8F4EF", text: "#009C63" },
    yellow: { bg: "#FFF4D6", text: "#9B6E00" },
    carbon: { bg: "#F4F4F1", text: "#3C3C3B" },
    magenta: { bg: "#FCE7EF", text: "#E60456" },
  }
  const style = styles[color]
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: style.bg }}>
      <p className="text-2xl font-bold" style={{ color: style.text }}>{value}</p>
      <p className="text-xs text-carbon-60 leading-tight mt-0.5">{label}</p>
    </div>
  )
}
