import { useCallback, useEffect, useMemo, useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { useApp } from "@/contexts/AppContext"
import { loadAppData } from "@/lib/api"
import {
  clearImportFileDraft,
  loadImportFileDraft,
  saveImportFileDraft,
} from "@/lib/importFileDraftStorage"
import {
  importOrganizationsFile,
  previewOrganizationImport,
  type OrganizationImportMatch,
  type OrganizationImportMergeMode,
  type OrganizationImportPreview,
  type OrganizationImportResolution,
  type OrganizationImportResult,
} from "@/lib/organizationImportApi"

const MAX_FILE_SIZE = 20 * 1024 * 1024

export default function ImportOrganizationsPage() {
  const { state, dispatch } = useApp()
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<OrganizationImportPreview | null>(null)
  const [result, setResult] = useState<OrganizationImportResult | null>(null)
  const [mergeMode, setMergeMode] = useState<OrganizationImportMergeMode>("fill_missing")
  const [resolutions, setResolutions] = useState<Record<string, OrganizationImportResolution>>({})
  const [mergeTargets, setMergeTargets] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [busyLabel, setBusyLabel] = useState("")
  const [error, setError] = useState("")
  const [restored, setRestored] = useState(false)

  const draftKey = `organization-import:${state.user?.id || "current"}`

  const unresolvedMatches = useMemo(
    () => preview?.matches.filter((match) => !resolutions[match.rowKey]).length || 0,
    [preview, resolutions],
  )

  const applyPreview = useCallback((next: OrganizationImportPreview) => {
    setPreview(next)
    setResolutions({})
    setMergeTargets(
      Object.fromEntries(
        next.matches
          .filter((match) => match.options[0])
          .map((match) => [match.rowKey, match.options[0].id]),
      ),
    )
  }, [])

  const analyzeFile = useCallback(async (selected: File, fromRestore = false) => {
    setError("")
    setResult(null)
    setBusy(true)
    setBusyLabel(fromRestore ? "Restaurando e analisando a planilha…" : "Analisando a planilha e procurando possíveis duplicidades…")
    setProgress(18)
    try {
      const next = await previewOrganizationImport(selected, "fill_missing")
      setProgress(100)
      applyPreview(next)
      setRestored(fromRestore)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível analisar a planilha.")
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

  if (state.user?.role !== "admin") return <Navigate to="/organizacoes" replace />

  const chooseFile = async (selected?: File) => {
    if (!selected) return
    setError("")
    setResult(null)
    setPreview(null)
    setResolutions({})
    setRestored(false)

    if (!/\.xlsx?$/i.test(selected.name)) {
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

  const selectMergeMode = (mode: OrganizationImportMergeMode) => {
    setMergeMode(mode)
    setResult(null)
    setError("")
  }

  const chooseResolution = (
    match: OrganizationImportMatch,
    action: "merge" | "merge_preserve_name" | "create",
  ) => {
    if (action === "create") {
      setResolutions((current) => ({ ...current, [match.rowKey]: { action: "create" } }))
      return
    }
    const organizationId = mergeTargets[match.rowKey] || match.options[0]?.id
    if (!organizationId) return
    setResolutions((current) => ({
      ...current,
      [match.rowKey]: {
        action: "merge",
        organizationId,
        preserveName: action === "merge_preserve_name",
      },
    }))
  }

  const changeMergeTarget = (match: OrganizationImportMatch, organizationId: string) => {
    setMergeTargets((current) => ({ ...current, [match.rowKey]: organizationId }))
    const resolution = resolutions[match.rowKey]
    if (resolution?.action === "merge") {
      setResolutions((current) => ({
        ...current,
        [match.rowKey]: {
          action: "merge",
          organizationId,
          preserveName: resolution.preserveName,
        },
      }))
    }
  }

  const runImport = async () => {
    if (!file || !preview || busy || unresolvedMatches > 0) return
    setBusy(true)
    setError("")
    setBusyLabel("Importando organizações e aplicando as decisões de mesclagem…")
    setProgress(6)

    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 92) return current
        const step = Math.max(1, Math.ceil((92 - current) * 0.09))
        return Math.min(92, current + step)
      })
    }, 250)

    try {
      const imported = await importOrganizationsFile(file, mergeMode, resolutions)
      setProgress(100)
      setResult(imported)
      await clearImportFileDraft(draftKey).catch(() => undefined)
      const data = await loadAppData()
      dispatch({ type: "HYDRATE_DATA", payload: data })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível importar as organizações.")
    } finally {
      window.clearInterval(timer)
      setBusy(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <header className="bg-white border-b border-carbon-20 px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 text-xs text-carbon-60 mb-2">
            <button onClick={() => navigate("/organizacoes")} className="hover:text-green">Organizações</button>
            <span>/</span>
            <span className="text-carbon font-medium">Importar organizações</span>
          </div>
          <h1 className="text-2xl font-bold text-carbon">Importar organizações</h1>
          <p className="text-sm text-carbon-60 mt-1">Use uma planilha Excel no padrão da base de organizações da Invest RS.</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {error && <div role="alert" className="px-4 py-3 rounded-xl bg-light-magenta text-magenta text-sm font-medium">{error}</div>}
        {result && (
          <div className="px-4 py-3 rounded-xl bg-light-green text-green text-sm font-semibold">
            Importação concluída: {result.created} nova(s) organização(ões) e {result.updated} mesclada(s)/atualizada(s).
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
          <h2 className="text-sm font-bold text-carbon">1. Selecionar planilha</h2>
          <p className="text-xs text-carbon-60 mt-1">Arquivos .xlsx ou .xls, até 20 MB. O arquivo fica salvo neste navegador até a importação ser concluída.</p>
          <label className="mt-4 flex items-center justify-between gap-4 rounded-xl border-2 border-dashed border-carbon-20 bg-neutral/40 px-5 py-6 cursor-pointer hover:border-green/50 transition-fast">
            <div>
              <p className="text-sm font-bold text-carbon">{file?.name || "Selecionar arquivo Excel"}</p>
              <p className="text-xs text-carbon-60 mt-1">
                {restored ? "Planilha restaurada automaticamente. A análise não grava dados." : "A análise não grava nenhum dado."}
              </p>
            </div>
            <span className="px-4 py-2 rounded-lg bg-white border border-carbon-20 text-sm font-bold text-green">Escolher arquivo</span>
            <input type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="hidden" onChange={(event) => void chooseFile(event.target.files?.[0])} />
          </label>
        </section>

        <section className="bg-white rounded-2xl border border-carbon-20 p-5">
          <h2 className="text-sm font-bold text-carbon">2. Como preencher organizações mescladas</h2>
          <p className="text-xs text-carbon-60 mt-1">Esta escolha não refaz a análise da planilha; ela é aplicada somente no momento da importação.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <button type="button" disabled={busy} onClick={() => selectMergeMode("fill_missing")} className={`text-left rounded-xl border p-4 ${mergeMode === "fill_missing" ? "border-green ring-2 ring-green/10" : "border-carbon-20"}`}>
              <span className="block text-sm font-bold text-carbon">Preencher somente campos vazios</span>
              <span className="block text-xs text-carbon-60 mt-1">Mantém dados já consolidados na base.</span>
            </button>
            <button type="button" disabled={busy} onClick={() => selectMergeMode("overwrite")} className={`text-left rounded-xl border p-4 ${mergeMode === "overwrite" ? "border-green ring-2 ring-green/10" : "border-carbon-20"}`}>
              <span className="block text-sm font-bold text-carbon">Atualizar com dados da planilha</span>
              <span className="block text-xs text-carbon-60 mt-1">Sobrescreve campos quando houver valor no arquivo.</span>
            </button>
          </div>
        </section>

        {preview && !busy && (
          <>
            <section className="bg-white rounded-2xl border border-carbon-20 p-5 space-y-5">
              <div>
                <h2 className="text-sm font-bold text-carbon">3. Conferir análise</h2>
                <p className="text-xs text-carbon-60 mt-1">A lista completa não é exibida. Apenas organizações com nomes iguais ou semelhantes aparecem para revisão manual.</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Metric label="No arquivo" value={preview.organizations} />
                <Metric label="Sem correspondência" value={preview.withoutMatches} />
                <Metric label="Mesmo nome" value={preview.exactMatches} />
                <Metric label="Nomes semelhantes" value={preview.similarMatches} />
              </div>

              {preview.unknownSectors.length > 0 && (
                <div className="rounded-xl bg-light-yellow px-4 py-3 text-xs text-carbon">
                  <strong>Setores não reconhecidos:</strong> {preview.unknownSectors.join(" · ")}. Os nomes serão preservados, mas sem vínculo automático com a taxonomia.
                </div>
              )}
            </section>

            {preview.matches.length > 0 && (
              <section className="bg-white rounded-2xl border border-carbon-20 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-carbon">4. Revisar possíveis duplicidades</h2>
                    <p className="text-xs text-carbon-60 mt-1">Decida individualmente como cada possível duplicidade deve ser tratada.</p>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${unresolvedMatches === 0 ? "badge-green" : "bg-light-yellow text-carbon"}`}>
                    {unresolvedMatches === 0 ? "Todas revisadas" : `${unresolvedMatches} pendente(s)`}
                  </span>
                </div>

                <div className="space-y-3">
                  {preview.matches.map((match) => {
                    const resolution = resolutions[match.rowKey]
                    const targetId = mergeTargets[match.rowKey] || match.options[0]?.id || ""
                    const target = match.options.find((option) => option.id === targetId) || match.options[0]
                    return (
                      <div key={match.rowKey} className="rounded-xl border border-carbon-20 p-4">
                        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] uppercase tracking-wide font-semibold text-carbon-60">Na planilha</p>
                            <p className="text-sm font-bold text-carbon mt-1">{match.name}</p>
                            {match.taxId && <p className="text-xs text-carbon-60 mt-0.5">CNPJ/EIN: {match.taxId}</p>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <label className="block text-[11px] uppercase tracking-wide font-semibold text-carbon-60 mb-1">Possível correspondência</label>
                            <select value={targetId} onChange={(event) => changeMergeTarget(match, event.target.value)} className="w-full px-3 py-2 rounded-lg border border-carbon-20 bg-white text-sm text-carbon focus:outline-none focus:border-green">
                              {match.options.map((option) => (
                                <option key={option.id} value={option.id}>{option.name} · {Math.round(option.score * 100)}% · {option.reason}</option>
                              ))}
                            </select>
                            {target && <p className="text-[11px] text-carbon-60 mt-1.5">Nome atual na base: <strong className="text-carbon">{target.name}</strong></p>}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <button type="button" onClick={() => chooseResolution(match, "merge")} className={`px-3.5 py-2 rounded-lg text-xs font-bold border ${resolution?.action === "merge" && !resolution.preserveName ? "bg-green text-white border-green" : "bg-white text-green border-green/40"}`}>
                            Mesclar com a selecionada
                          </button>
                          <button type="button" onClick={() => chooseResolution(match, "merge_preserve_name")} className={`px-3.5 py-2 rounded-lg text-xs font-bold border ${resolution?.action === "merge" && resolution.preserveName ? "bg-green text-white border-green" : "bg-white text-green border-green/40"}`}>
                            Preservar nome atual da organização
                          </button>
                          <button type="button" onClick={() => chooseResolution(match, "create")} className={`px-3.5 py-2 rounded-lg text-xs font-bold border ${resolution?.action === "create" ? "bg-carbon text-white border-carbon" : "bg-white text-carbon border-carbon-20"}`}>
                            Manter como organização separada
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
                <h2 className="text-sm font-bold text-carbon">{preview.matches.length > 0 ? "5" : "4"}. Importar</h2>
                <p className="text-xs text-carbon-60 mt-1">{unresolvedMatches > 0 ? "Resolva todas as possíveis duplicidades para habilitar a importação." : "A planilha está pronta para importação."}</p>
              </div>
              <button type="button" disabled={Boolean(result) || busy || unresolvedMatches > 0} onClick={() => void runImport()} className="px-5 py-2.5 rounded-xl bg-green text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed">
                Importar {preview.organizations} organizações
              </button>
            </section>
          </>
        )}

        <div className="flex justify-end pb-8">
          <button type="button" onClick={() => navigate("/organizacoes")} className="px-5 py-2.5 rounded-xl border border-carbon-20 bg-white text-sm font-bold text-carbon">Voltar para organizações</button>
        </div>
      </main>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-neutral p-4 text-center"><p className="text-xl font-bold text-carbon">{value}</p><p className="text-[11px] text-carbon-60 mt-1">{label}</p></div>
}
