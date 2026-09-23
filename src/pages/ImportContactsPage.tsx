import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { useApp } from "@/contexts/AppContext"
import { loadAppData } from "@/lib/api"
import {
  clearImportFileDraft,
  loadImportFileDraft,
  saveImportFileDraft,
} from "@/lib/importFileDraftStorage"
import {
  type ContactImportMatch,
  type ContactImportMergeMode,
  type ContactImportOrganizationMatch,
  type ContactImportOrganizationResolution,
  type ContactImportPreview,
  type ContactImportResolution,
  type ContactImportResult,
  importContactsFile,
  previewContactImport,
} from "@/lib/contactImportApi"

const MAX_FILE_SIZE = 20 * 1024 * 1024

const expectedColumns = [
  "Nome",
  "Empresa",
  "Cargo atual",
  "E-mail",
  "E-mail secundário",
  "Telefone",
  "Telefone secundário",
]

export default function ImportContactsPage() {
  const navigate = useNavigate()
  const { state, dispatch } = useApp()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [mergeMode, setMergeMode] = useState<ContactImportMergeMode>("fill_missing")
  const [preview, setPreview] = useState<ContactImportPreview | null>(null)
  const [result, setResult] = useState<ContactImportResult | null>(null)
  const [organizationResolutions, setOrganizationResolutions] = useState<Record<string, ContactImportOrganizationResolution>>({})
  const [organizationTargets, setOrganizationTargets] = useState<Record<string, string>>({})
  const [contactResolutions, setContactResolutions] = useState<Record<string, ContactImportResolution>>({})
  const [contactTargets, setContactTargets] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [busyLabel, setBusyLabel] = useState("")
  const [error, setError] = useState("")
  const [dragging, setDragging] = useState(false)
  const [restored, setRestored] = useState(false)

  const draftKey = `contact-import:${state.user?.id || "current"}`

  const unresolvedOrganizations = useMemo(
    () => preview?.organizationMatches.filter((match) => !organizationResolutions[match.organizationKey]).length || 0,
    [organizationResolutions, preview],
  )

  const unresolvedContacts = useMemo(
    () => preview?.contactMatches.filter((match) => !contactResolutions[match.rowKey]).length || 0,
    [contactResolutions, preview],
  )

  const exactUnambiguousOrganizationMatches = useMemo(
    () => preview?.organizationMatches.filter((match) => {
      const exactOptions = match.options.filter(
        (option) => option.score === 1 && option.reason === "Mesmo nome",
      )
      return exactOptions.length === 1
    }) || [],
    [preview],
  )

  const unresolvedExactOrganizations = useMemo(
    () => exactUnambiguousOrganizationMatches.filter(
      (match) => !organizationResolutions[match.organizationKey],
    ).length,
    [exactUnambiguousOrganizationMatches, organizationResolutions],
  )

  const unresolvedTotal = unresolvedOrganizations + unresolvedContacts

  const orderedOrganizationMatches = useMemo(() => {
    const matches = preview?.organizationMatches || []
    return [...matches].sort((a, b) => {
      const aResolved = Boolean(organizationResolutions[a.organizationKey])
      const bResolved = Boolean(organizationResolutions[b.organizationKey])
      return Number(aResolved) - Number(bResolved)
    })
  }, [organizationResolutions, preview])

  const orderedContactMatches = useMemo(() => {
    const matches = preview?.contactMatches || []
    return [...matches].sort((a, b) => {
      const aResolved = Boolean(contactResolutions[a.rowKey])
      const bResolved = Boolean(contactResolutions[b.rowKey])
      return Number(aResolved) - Number(bResolved)
    })
  }, [contactResolutions, preview])

  const applyPreview = useCallback((next: ContactImportPreview) => {
    setPreview(next)
    setResult(null)
    setOrganizationResolutions({})
    setContactResolutions({})
    setOrganizationTargets(
      Object.fromEntries(
        next.organizationMatches
          .filter((match) => match.options[0])
          .map((match) => [match.organizationKey, match.options[0].id]),
      ),
    )
    setContactTargets(
      Object.fromEntries(
        next.contactMatches
          .filter((match) => match.options[0])
          .map((match) => [match.rowKey, match.options[0].id]),
      ),
    )
  }, [])

  const analyzeFile = useCallback(async (selected: File, fromRestore = false) => {
    setError("")
    setResult(null)
    setBusy(true)
    setBusyLabel(
      fromRestore
        ? "Restaurando e analisando a planilha…"
        : "Analisando contatos, organizações e possíveis duplicidades…",
    )
    setProgress(18)

    try {
      const next = await previewContactImport(selected, "fill_missing")
      setProgress(100)
      applyPreview(next)
      setRestored(fromRestore)
    } catch (cause) {
      setPreview(null)
      setError(cause instanceof Error ? cause.message : "Não foi possível analisar o arquivo.")
    } finally {
      setBusy(false)
    }
  }, [applyPreview])

  useEffect(() => {
    if (state.user?.role !== "admin" || !state.user?.id) return
    let active = true

    void loadImportFileDraft(draftKey)
      .then(async (storedFile) => {
        if (!active || !storedFile) return
        setFile(storedFile)
        await analyzeFile(storedFile, true)
      })
      .catch(() => {
        // O importador continua funcionando mesmo se o navegador bloquear o IndexedDB.
      })

    return () => {
      active = false
    }
  }, [analyzeFile, draftKey, state.user?.id, state.user?.role])

  if (state.user?.role !== "admin") return <Navigate to="/contatos" replace />

  const chooseFile = async (selected?: File | null) => {
    if (!selected) return
    setError("")
    setResult(null)
    setPreview(null)
    setOrganizationResolutions({})
    setContactResolutions({})
    setRestored(false)

    if (!/\.(xlsx|xls)$/i.test(selected.name)) {
      setError("Selecione um arquivo .xlsx ou .xls.")
      return
    }
    if (selected.size > MAX_FILE_SIZE) {
      setError("O arquivo excede 20 MB.")
      return
    }

    setFile(selected)
    try {
      await saveImportFileDraft(draftKey, selected)
    } catch {
      // A análise não deve falhar apenas porque o armazenamento local está indisponível.
    }
    await analyzeFile(selected)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    void chooseFile(event.dataTransfer.files?.[0])
  }

  const selectMergeMode = (mode: ContactImportMergeMode) => {
    setMergeMode(mode)
    setResult(null)
    setError("")
  }

  const chooseOrganizationResolution = (
    match: ContactImportOrganizationMatch,
    action: "merge" | "create",
  ) => {
    if (action === "create") {
      setOrganizationResolutions((current) => ({
        ...current,
        [match.organizationKey]: { action: "create" },
      }))
      return
    }

    const organizationId = organizationTargets[match.organizationKey] || match.options[0]?.id
    if (!organizationId) return
    setOrganizationResolutions((current) => ({
      ...current,
      [match.organizationKey]: { action: "merge", organizationId },
    }))
  }

  const changeOrganizationTarget = (
    match: ContactImportOrganizationMatch,
    organizationId: string,
  ) => {
    setOrganizationTargets((current) => ({
      ...current,
      [match.organizationKey]: organizationId,
    }))
    if (organizationResolutions[match.organizationKey]?.action === "merge") {
      setOrganizationResolutions((current) => ({
        ...current,
        [match.organizationKey]: { action: "merge", organizationId },
      }))
    }
  }

  const acceptAllExactOrganizationMerges = () => {
    if (!preview) return

    const nextTargets: Record<string, string> = {}
    const nextResolutions: Record<string, ContactImportOrganizationResolution> = {}

    for (const match of exactUnambiguousOrganizationMatches) {
      const exactOption = match.options.find(
        (option) => option.score === 1 && option.reason === "Mesmo nome",
      )
      if (!exactOption) continue
      nextTargets[match.organizationKey] = exactOption.id
      nextResolutions[match.organizationKey] = {
        action: "merge",
        organizationId: exactOption.id,
      }
    }

    setOrganizationTargets((current) => ({ ...current, ...nextTargets }))
    setOrganizationResolutions((current) => ({ ...current, ...nextResolutions }))
  }

  const chooseContactResolution = (
    match: ContactImportMatch,
    action: "merge" | "create",
  ) => {
    if (action === "create") {
      setContactResolutions((current) => ({
        ...current,
        [match.rowKey]: { action: "create" },
      }))
      return
    }

    const contactId = contactTargets[match.rowKey] || match.options[0]?.id
    if (!contactId) return
    setContactResolutions((current) => ({
      ...current,
      [match.rowKey]: { action: "merge", contactId },
    }))
  }

  const changeContactTarget = (match: ContactImportMatch, contactId: string) => {
    setContactTargets((current) => ({ ...current, [match.rowKey]: contactId }))
    if (contactResolutions[match.rowKey]?.action === "merge") {
      setContactResolutions((current) => ({
        ...current,
        [match.rowKey]: { action: "merge", contactId },
      }))
    }
  }

  const runImport = async () => {
    if (!file || !preview || busy || unresolvedTotal > 0) return
    setBusy(true)
    setError("")
    setBusyLabel("Importando contatos e aplicando as decisões de mesclagem…")
    setProgress(6)

    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 92) return current
        const step = Math.max(1, Math.ceil((92 - current) * 0.09))
        return Math.min(92, current + step)
      })
    }, 250)

    try {
      const imported = await importContactsFile(
        file,
        mergeMode,
        organizationResolutions,
        contactResolutions,
      )
      setProgress(100)
      setResult(imported)
      await clearImportFileDraft(draftKey).catch(() => undefined)
      const data = await loadAppData()
      dispatch({ type: "HYDRATE_DATA", payload: data })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir a importação.")
    } finally {
      window.clearInterval(timer)
      setBusy(false)
    }
  }

  const hasOrganizationReview = Boolean(preview?.organizationMatches.length)
  const hasContactReview = Boolean(preview?.contactMatches.length)
  const importStep = 4 + Number(hasOrganizationReview) + Number(hasContactReview)

  return (
    <div className="h-full overflow-y-auto">
      <header className="bg-white border-b border-carbon-20 px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 text-xs text-carbon-60 mb-2">
            <button onClick={() => navigate("/contatos")} className="hover:text-green">Contatos</button>
            <span>/</span>
            <span className="text-carbon font-medium">Importar contatos</span>
          </div>
          <h1 className="text-2xl font-bold text-carbon">Importar contatos</h1>
          <p className="text-sm text-carbon-60 mt-1">Use uma planilha Excel no padrão do arquivo Contatos_normalizados.xlsx.</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {error && (
          <div className="px-4 py-3 rounded-xl bg-light-magenta text-magenta text-sm font-medium" role="alert">
            {error}
          </div>
        )}

        {result && (
          <div className="px-4 py-3 rounded-xl bg-light-green text-green text-sm font-semibold">
            Importação concluída: {result.contactsCreated} novo(s) contato(s), {result.contactsUpdated} atualizado(s) e {result.contactsMergedByReview} mesclado(s) após revisão.
          </div>
        )}

        {busy && (
          <section className="rounded-2xl border border-green/25 bg-white p-5" aria-live="polite">
            <div className="flex items-center justify-between gap-4 mb-2">
              <p className="text-sm font-semibold text-carbon">{busyLabel}</p>
              <span className="text-sm font-bold text-green">{progress}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-neutral overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
              <div className="h-full bg-green rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </section>
        )}

        <section className="bg-white rounded-2xl border border-carbon-20 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-carbon">1. Selecionar planilha</h2>
              <p className="text-xs text-carbon-60 mt-1">Arquivos .xlsx ou .xls, até 20 MB. O arquivo fica salvo neste navegador até a importação ser concluída.</p>
            </div>
            {file && (
              <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="text-xs font-bold text-green disabled:opacity-40">
                Trocar arquivo
              </button>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            onChange={(event) => void chooseFile(event.target.files?.[0])}
          />

          <div
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !file && inputRef.current?.click()}
            className={`mt-4 rounded-xl border-2 border-dashed px-5 py-6 transition-fast ${
              dragging
                ? "border-green bg-green/5"
                : file
                  ? "border-green/40 bg-green/5"
                  : "border-carbon-20 bg-neutral/40 hover:border-green/50 cursor-pointer"
            }`}
          >
            {file ? (
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green text-white flex items-center justify-center text-xs font-black">XLSX</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-carbon truncate">{file.name}</p>
                  <p className="text-xs text-carbon-60 mt-1">
                    {restored ? "Planilha restaurada automaticamente e pronta para revisão." : `${formatBytes(file.size)} · análise automática sem gravação de dados.`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-2">
                <p className="text-2xl text-green mb-2">↑</p>
                <p className="text-sm font-bold text-carbon">Arraste a planilha para cá</p>
                <p className="text-xs text-carbon-60 mt-1">ou clique para selecionar o arquivo</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-carbon-20">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-carbon-60 mb-2">Campos do modelo</p>
            <div className="flex flex-wrap gap-2">
              {expectedColumns.map((column) => (
                <span key={column} className="px-2.5 py-1.5 rounded-lg bg-neutral text-xs font-semibold text-carbon-60">{column}</span>
              ))}
            </div>
            <div className="mt-3 rounded-xl bg-neutral/60 px-3.5 py-3 text-xs text-carbon-60 space-y-1">
              <p><strong className="text-carbon">Nomes:</strong> capitalização normalizada automaticamente, preservando conectivos como “de”, “da” e “dos”.</p>
              <p><strong className="text-carbon">Cargos:</strong> formatação padronizada, com siglas preservadas e conectivos em minúsculas.</p>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-carbon-20 p-5">
          <h2 className="text-sm font-bold text-carbon">2. Como preencher contatos já existentes</h2>
          <p className="text-xs text-carbon-60 mt-1">Correspondências inequívocas por e-mail ou telefone são reconhecidas automaticamente. Nomes iguais ou semelhantes sem essa confirmação entram em revisão manual.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <button type="button" disabled={busy} onClick={() => selectMergeMode("fill_missing")} className={`text-left rounded-xl border p-4 ${mergeMode === "fill_missing" ? "border-green ring-2 ring-green/10" : "border-carbon-20"}`}>
              <span className="block text-sm font-bold text-carbon">Preencher somente campos vazios</span>
              <span className="block text-xs text-carbon-60 mt-1">Recomendado. Mantém informações já consolidadas na base.</span>
            </button>
            <button type="button" disabled={busy} onClick={() => selectMergeMode("overwrite")} className={`text-left rounded-xl border p-4 ${mergeMode === "overwrite" ? "border-green ring-2 ring-green/10" : "border-carbon-20"}`}>
              <span className="block text-sm font-bold text-carbon">Atualizar com dados da planilha</span>
              <span className="block text-xs text-carbon-60 mt-1">Sobrescreve campos quando houver valor preenchido no arquivo.</span>
            </button>
          </div>
        </section>

        {preview && !busy && (
          <>
            <section className="bg-white rounded-2xl border border-carbon-20 p-5 space-y-5">
              <div>
                <h2 className="text-sm font-bold text-carbon">3. Conferir análise</h2>
                <p className="text-xs text-carbon-60 mt-1">Nenhum dado é gravado nesta etapa. Os nomes e cargos abaixo já aparecem com a normalização que será persistida.</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Metric label="Contatos no arquivo" value={preview.contacts} />
                <Metric label="Novos estimados" value={preview.estimatedNewContacts} />
                <Metric label="Por e-mail/telefone" value={preview.existingMatches} />
                <Metric label="Nomes para revisar" value={preview.contactMatches.length} attention={preview.contactMatches.length > 0} />
                <Metric label="Organizações novas" value={preview.newOrganizations} />
                <Metric label="Organizações para revisar" value={preview.organizationMatches.length} attention={preview.organizationMatches.length > 0} />
                <Metric label="Subsetores novos" value={preview.newSubsegments} />
                <Metric label="Conflitos" value={preview.conflicts} attention={preview.conflicts > 0} />
              </div>

              {(preview.exactNameMatches > 0 || preview.similarNameMatches > 0) && (
                <p className="text-xs text-carbon-60">
                  Contatos semelhantes: <strong className="text-carbon">{preview.exactNameMatches}</strong> com o mesmo nome e <strong className="text-carbon">{preview.similarNameMatches}</strong> com nome semelhante.
                </p>
              )}

              {preview.unknownSectors.length > 0 && (
                <div className="rounded-xl bg-light-yellow px-4 py-3 text-xs text-carbon">
                  <strong>Setores não reconhecidos:</strong> {preview.unknownSectors.join(" · ")}. Os contatos serão importados, mas essas segmentações não serão vinculadas automaticamente.
                </div>
              )}

              <div className="overflow-x-auto border border-carbon-20 rounded-xl">
                <table className="w-full min-w-[1050px] text-sm">
                  <thead className="bg-neutral/70">
                    <tr className="text-left text-[11px] uppercase tracking-wide text-carbon-60">
                      <th className="px-3 py-2.5">Nome</th>
                      <th className="px-3 py-2.5">Cargo</th>
                      <th className="px-3 py-2.5">Organização</th>
                      <th className="px-3 py-2.5">E-mail / telefone</th>
                      <th className="px-3 py-2.5">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-carbon-20/60">
                    {preview.preview.map((row) => (
                      <tr key={row.rowKey}>
                        <td className="px-3 py-3 font-semibold text-carbon">{row.name}</td>
                        <td className="px-3 py-3 text-carbon-60 max-w-[220px] truncate">{row.position || "—"}</td>
                        <td className="px-3 py-3 text-carbon-60 max-w-[220px] truncate">{row.organization || "—"}</td>
                        <td className="px-3 py-3 text-carbon-60">{row.email || row.phone || "—"}</td>
                        <td className="px-3 py-3">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                            row.status === "Novo"
                              ? "badge-green"
                              : row.status === "Conflito"
                                ? "badge-magenta"
                                : row.status === "Revisar"
                                  ? "bg-light-yellow text-carbon"
                                  : "badge-carbon"
                          }`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-carbon-60">Prévia das primeiras {preview.preview.length} linhas úteis do arquivo.</p>
            </section>

            {hasOrganizationReview && (
              <section className="bg-white rounded-2xl border border-carbon-20 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-carbon">4. Revisar organizações semelhantes</h2>
                    <p className="text-xs text-carbon-60 mt-1">A decisão vale para todos os contatos da planilha vinculados à mesma organização.</p>
                  </div>
                  <ReviewBadge unresolved={unresolvedOrganizations} />
                </div>

                {exactUnambiguousOrganizationMatches.length > 0 && (
                  <div className="rounded-xl border border-green/25 bg-light-green/50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-carbon">
                        {exactUnambiguousOrganizationMatches.length} correspondência(s) com 100% do mesmo nome e um único registro na base.
                      </p>
                      <p className="text-[11px] text-carbon-60 mt-1">
                        A mesclagem mantém o nome atual da organização já cadastrada; apenas os contatos passam a apontar para esse registro.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={unresolvedExactOrganizations === 0}
                      onClick={acceptAllExactOrganizationMerges}
                      className="px-4 py-2 rounded-lg bg-green text-white text-xs font-bold whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {unresolvedExactOrganizations === 0
                        ? "Mesclagens 100% aceitas"
                        : `Aceitar todas as mesclagens 100% (${unresolvedExactOrganizations})`}
                    </button>
                  </div>
                )}

                <div className="space-y-3">
                  {orderedOrganizationMatches.map((match) => {
                    const resolution = organizationResolutions[match.organizationKey]
                    const targetId = organizationTargets[match.organizationKey] || match.options[0]?.id || ""
                    const selectedOption = match.options.find((option) => option.id === targetId) || match.options[0]
                    const isExact = selectedOption?.score === 1 && selectedOption?.reason === "Mesmo nome"
                    return (
                      <div key={match.organizationKey} className="rounded-xl border border-carbon-20 p-4">
                        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] uppercase tracking-wide font-semibold text-carbon-60">Na planilha</p>
                            <p className="text-sm font-bold text-carbon mt-1">{match.name}</p>
                            <p className="text-xs text-carbon-60 mt-0.5">{match.contactsCount} contato(s) vinculado(s)</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <label className="block text-[11px] uppercase tracking-wide font-semibold text-carbon-60 mb-1">Possível correspondência</label>
                            <select value={targetId} onChange={(event) => changeOrganizationTarget(match, event.target.value)} className="w-full px-3 py-2 rounded-lg border border-carbon-20 bg-white text-sm text-carbon focus:outline-none focus:border-green">
                              {match.options.map((option) => (
                                <option key={option.id} value={option.id}>{option.name} · {Math.round(option.score * 100)}% · {option.reason}</option>
                              ))}
                            </select>
                            {isExact && (
                              <p className="text-[11px] text-green font-semibold mt-1.5">Correspondência exata: ao mesclar, o nome atual da organização na base será preservado.</p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <button type="button" onClick={() => chooseOrganizationResolution(match, "merge")} className={`px-3.5 py-2 rounded-lg text-xs font-bold border ${resolution?.action === "merge" ? "bg-green text-white border-green" : "bg-white text-green border-green/40"}`}>
                            Mesclar e manter nome atual da base
                          </button>
                          <button type="button" onClick={() => chooseOrganizationResolution(match, "create")} className={`px-3.5 py-2 rounded-lg text-xs font-bold border ${resolution?.action === "create" ? "bg-carbon text-white border-carbon" : "bg-white text-carbon border-carbon-20"}`}>
                            Manter nome da planilha como organização separada
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {hasContactReview && (
              <section className="bg-white rounded-2xl border border-carbon-20 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-carbon">{hasOrganizationReview ? "5" : "4"}. Revisar nomes semelhantes</h2>
                    <p className="text-xs text-carbon-60 mt-1">Nenhum contato é mesclado apenas por semelhança de nome. Escolha individualmente quando houver dúvida.</p>
                  </div>
                  <ReviewBadge unresolved={unresolvedContacts} />
                </div>

                <div className="space-y-3">
                  {orderedContactMatches.map((match) => {
                    const resolution = contactResolutions[match.rowKey]
                    const targetId = contactTargets[match.rowKey] || match.options[0]?.id || ""
                    const selectedOption = match.options.find((option) => option.id === targetId) || match.options[0]
                    return (
                      <div key={match.rowKey} className="rounded-xl border border-carbon-20 p-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div>
                            <p className="text-[11px] uppercase tracking-wide font-semibold text-carbon-60">Na planilha</p>
                            <p className="text-sm font-bold text-carbon mt-1">{match.name}</p>
                            <p className="text-xs text-carbon-60 mt-0.5">{[match.organization, match.email || match.phone].filter(Boolean).join(" · ") || "Sem organização ou canal"}</p>
                          </div>
                          <div>
                            <label className="block text-[11px] uppercase tracking-wide font-semibold text-carbon-60 mb-1">Possível contato existente</label>
                            <select value={targetId} onChange={(event) => changeContactTarget(match, event.target.value)} className="w-full px-3 py-2 rounded-lg border border-carbon-20 bg-white text-sm text-carbon focus:outline-none focus:border-green">
                              {match.options.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.name} · {Math.round(option.score * 100)}% · {option.organization || option.email || option.phone || option.reason}
                                </option>
                              ))}
                            </select>
                            {selectedOption && (
                              <p className="text-xs text-carbon-60 mt-1.5">
                                {[selectedOption.organization, selectedOption.email, selectedOption.phone].filter(Boolean).join(" · ") || selectedOption.reason}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <button type="button" onClick={() => chooseContactResolution(match, "merge")} className={`px-3.5 py-2 rounded-lg text-xs font-bold border ${resolution?.action === "merge" ? "bg-green text-white border-green" : "bg-white text-green border-green/40"}`}>
                            Mesclar com o contato selecionado
                          </button>
                          <button type="button" onClick={() => chooseContactResolution(match, "create")} className={`px-3.5 py-2 rounded-lg text-xs font-bold border ${resolution?.action === "create" ? "bg-carbon text-white border-carbon" : "bg-white text-carbon border-carbon-20"}`}>
                            Manter como contato separado
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            <section className="bg-white rounded-2xl border border-carbon-20 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-carbon">{importStep}. Importar</h2>
                <p className="text-xs text-carbon-60 mt-1">
                  {unresolvedTotal > 0
                    ? `Resolva ${unresolvedTotal} possível(is) duplicidade(s) para habilitar a importação.`
                    : preview.conflicts > 0
                      ? `${preview.conflicts} conflito(s) de e-mail/telefone serão ignorados para evitar mesclagens incorretas.`
                      : "A planilha está pronta para importação."}
                </p>
              </div>
              <button type="button" disabled={Boolean(result) || busy || unresolvedTotal > 0} onClick={() => void runImport()} className="px-5 py-2.5 rounded-xl bg-green text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed">
                Importar {preview.contacts} contatos
              </button>
            </section>
          </>
        )}

        {result && !busy && (
          <section className="bg-white rounded-2xl border border-carbon-20 p-5">
            <h2 className="text-sm font-bold text-carbon">Resumo da importação</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <Metric label="Contatos criados" value={result.contactsCreated} />
              <Metric label="Contatos atualizados" value={result.contactsUpdated} />
              <Metric label="Mesclados por revisão" value={result.contactsMergedByReview} />
              <Metric label="Organizações criadas" value={result.organizationsCreated} />
              <Metric label="Organizações mescladas" value={result.organizationsMerged} />
              <Metric label="Subsetores criados" value={result.subsegmentsCreated} />
              <Metric label="Linhas ignoradas" value={result.skipped} />
              <Metric label="Conflitos não importados" value={result.conflicts} attention={result.conflicts > 0} />
            </div>
          </section>
        )}

        <div className="flex justify-end pb-8">
          <button type="button" onClick={() => navigate("/contatos")} className="px-5 py-2.5 rounded-xl border border-carbon-20 bg-white text-sm font-bold text-carbon">Voltar para contatos</button>
        </div>
      </main>
    </div>
  )
}

function ReviewBadge({ unresolved }: { unresolved: number }) {
  return (
    <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${unresolved === 0 ? "badge-green" : "bg-light-yellow text-carbon"}`}>
      {unresolved === 0 ? "Todas revisadas" : `${unresolved} pendente(s)`}
    </span>
  )
}

function Metric({ label, value, attention = false }: { label: string; value: number; attention?: boolean }) {
  return (
    <div className="rounded-xl bg-neutral p-4 text-center">
      <p className={`text-xl font-bold ${attention ? "text-magenta" : "text-carbon"}`}>{value}</p>
      <p className="text-[11px] text-carbon-60 mt-1">{label}</p>
    </div>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}