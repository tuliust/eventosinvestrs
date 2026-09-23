import { useEffect, useMemo, useState } from "react"
import { useApp } from "@/contexts/AppContext"
import {
  DEFAULT_MAILING_FILTERS,
  deleteMailingList,
  loadMailingLists,
  saveMailingList,
  type MailingFilters,
  type MailingList,
} from "@/lib/mailingApi"
import { loadMailingOrganizations } from "@/lib/mailingDataApi"
import {
  buildMailingFilterOptions,
  filterMailingContacts,
  type MailingCandidate,
  type MailingOption,
} from "@/lib/mailingFilter"
import {
  loadSegmentationsCatalog,
  type SegmentationsCatalog,
} from "@/lib/segmentationsCatalogApi"

const PAGE_SIZE = 50

const EMPTY_FILTERS = (): MailingFilters => ({
  ...DEFAULT_MAILING_FILTERS,
  segmentTypes: [],
  segmentIds: [],
  subsegmentIds: [],
  organizationIds: [],
  organizationTypeIds: [],
  institutionalCategoryIds: [],
  institutionalSubcategoryIds: [],
  specialCategoryIds: [],
  scopeIds: [],
  governmentSphereIds: [],
  countries: [],
  states: [],
  positions: [],
  eventIds: [],
  eventStatuses: ["present"],
  classifications: [],
  involvementTypes: [],
  relationshipLevels: [],
  accountManagers: [],
  origins: [],
  seniorities: [],
  relationshipTypes: [],
  communicationStatuses: ["active"],
  tags: [],
  cities: [],
  onlyWithEmail: true,
})

export default function MailingBuilder({
  eventId,
  defaultTitle,
  embedded = false,
}: {
  eventId?: string
  defaultTitle?: string
  embedded?: boolean
}) {
  const { state } = useApp()
  const [catalog, setCatalog] = useState<SegmentationsCatalog | null>(null)
  const [completeOrganizations, setCompleteOrganizations] = useState(state.organizations)
  const [lists, setLists] = useState<MailingList[]>([])
  const [activeListId, setActiveListId] = useState<string | undefined>()
  const [title, setTitle] = useState(defaultTitle || "")
  const [filters, setFilters] = useState<MailingFilters>(EMPTY_FILTERS)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [outputMode, setOutputMode] = useState<"contacts" | "emails">("contacts")

  const isAdmin = state.user?.role === "admin"
  const effectiveState = useMemo(
    () => ({ ...state, organizations: completeOrganizations }),
    [completeOrganizations, state],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError("")

    void Promise.all([
      loadSegmentationsCatalog(),
      loadMailingOrganizations(),
      loadMailingLists(eventId),
    ])
      .then(([nextCatalog, organizations, nextLists]) => {
        if (cancelled) return
        setCatalog(nextCatalog)
        setCompleteOrganizations(organizations)
        setLists(nextLists)
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Não foi possível carregar o mailing.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [eventId])

  const options = useMemo(
    () => catalog ? buildMailingFilterOptions(effectiveState, catalog, eventId) : null,
    [catalog, effectiveState, eventId],
  )

  const candidates = useMemo(
    () => catalog ? filterMailingContacts(effectiveState, catalog, filters) : [],
    [catalog, effectiveState, filters],
  )

  const matchingAudience = useMemo(() => {
    if (!catalog) return []
    return filterMailingContacts(effectiveState, catalog, {
      ...filters,
      communicationStatuses: [],
      onlyWithEmail: false,
    })
  }, [catalog, effectiveState, filters])

  const allCandidates = useMemo(() => {
    if (!catalog) return []
    return filterMailingContacts(effectiveState, catalog, {
      ...EMPTY_FILTERS(),
      communicationStatuses: [],
      onlyWithEmail: false,
    })
  }, [catalog, effectiveState])

  const candidateById = useMemo(
    () => new Map(allCandidates.map((candidate) => [candidate.contact.id, candidate])),
    [allCandidates],
  )

  const searchedCandidates = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR")
    if (!query) return candidates
    return candidates.filter((candidate) =>
      [candidate.name, candidate.email, candidate.position, candidate.organizationName, candidate.sector, candidate.subsector]
        .some((value) => value.toLocaleLowerCase("pt-BR").includes(query)),
    )
  }, [candidates, search])

  const totalPages = Math.max(1, Math.ceil(searchedCandidates.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visibleCandidates = useMemo(
    () => searchedCandidates.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, searchedCandidates],
  )

  useEffect(() => {
    setPage(1)
  }, [filters, search])

  const selectedCandidates = useMemo(
    () => [...selectedIds]
      .map((id) => candidateById.get(id))
      .filter(Boolean) as MailingCandidate[],
    [candidateById, selectedIds],
  )

  const exportableSelectedCandidates = useMemo(
    () => selectedCandidates.filter(
      (candidate) => candidate.email && candidate.contact.communicationStatus === "active",
    ),
    [selectedCandidates],
  )

  const emailList = useMemo(() => {
    const emails = new Set<string>()
    for (const candidate of exportableSelectedCandidates) {
      const email = candidate.email.trim().toLocaleLowerCase("pt-BR")
      if (email) emails.add(email)
    }
    return [...emails].join("\n")
  }, [exportableSelectedCandidates])

  const audienceSummary = useMemo(() => {
    const withEmail = matchingAudience.filter((candidate) => Boolean(candidate.email)).length
    const withoutEmail = matchingAudience.length - withEmail
    const blocked = matchingAudience.filter(
      (candidate) => candidate.contact.communicationStatus !== "active",
    ).length
    return {
      found: matchingAudience.length,
      selected: selectedIds.size,
      withEmail,
      withoutEmail,
      blocked,
    }
  }, [matchingAudience, selectedIds.size])

  const activeFilterCount = useMemo(() => {
    const arrayKeys: Array<keyof MailingFilters> = [
      "segmentTypes", "segmentIds", "subsegmentIds", "organizationIds", "organizationTypeIds",
      "institutionalCategoryIds", "institutionalSubcategoryIds", "specialCategoryIds", "scopeIds", "governmentSphereIds",
      "countries", "states", "positions", "eventIds", "classifications", "involvementTypes",
      "relationshipLevels", "accountManagers", "origins", "seniorities", "relationshipTypes",
      "tags", "cities",
    ]
    let count = arrayKeys.filter((key) => Array.isArray(filters[key]) && (filters[key] as string[]).length > 0).length
    if (filters.communicationStatuses.length !== 1 || filters.communicationStatuses[0] !== "active") count += 1
    if (!filters.onlyWithEmail) count += 1
    return count
  }, [filters])

  const subsegmentOptions = useMemo(() => {
    if (!options) return []
    if (filters.segmentIds.length === 0) return options.subsegments
    const allowed = new Set(
      effectiveState.subsegments
        .filter((subsegment) => filters.segmentIds.includes(subsegment.segmentId))
        .map((subsegment) => subsegment.id),
    )
    return options.subsegments.filter((option) => allowed.has(option.value))
  }, [effectiveState.subsegments, filters.segmentIds, options])

  const institutionalSubcategoryOptions = useMemo(() => {
    if (!options || !catalog || filters.institutionalCategoryIds.length === 0) return options?.institutionalSubcategories || []
    const allowed = new Set(
      catalog.institutionalSubcategories
        .filter((item) => filters.institutionalCategoryIds.includes(item.institutionalCategoryId))
        .map((item) => item.id),
    )
    return options.institutionalSubcategories.filter((option) => allowed.has(option.value))
  }, [catalog, filters.institutionalCategoryIds, options])

  const startNew = () => {
    setActiveListId(undefined)
    setTitle(defaultTitle || "")
    setFilters(EMPTY_FILTERS())
    setSelectedIds(new Set())
    setSearch("")
    setPage(1)
    setMessage("")
    setError("")
  }

  const loadList = (list: MailingList) => {
    setActiveListId(list.id)
    setTitle(list.title)
    setFilters({ ...EMPTY_FILTERS(), ...list.filters })
    setSelectedIds(new Set(list.contactIds))
    setSearch("")
    setPage(1)
    setMessage("")
    setError("")
  }

  const refreshLists = async (selectId?: string) => {
    const nextLists = await loadMailingLists(eventId)
    setLists(nextLists)
    if (selectId) {
      const saved = nextLists.find((list) => list.id === selectId)
      if (saved) loadList(saved)
    }
  }

  const handleSave = async () => {
    if (!isAdmin || saving) return
    if (!title.trim()) {
      setError("Informe um título para salvar o mailing.")
      return
    }
    if (selectedIds.size === 0) {
      setError("Selecione pelo menos um contato para salvar o mailing.")
      return
    }

    setSaving(true)
    setError("")
    setMessage("")
    try {
      const id = await saveMailingList({
        id: activeListId,
        title,
        eventId,
        filters,
        contactIds: [...selectedIds],
      })
      await refreshLists(id)
      setMessage("Mailing salvo no Supabase.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o mailing.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (list: MailingList) => {
    if (!isAdmin || !window.confirm(`Excluir o mailing “${list.title}”?`)) return
    setError("")
    try {
      await deleteMailingList(list.id)
      if (activeListId === list.id) startNew()
      await refreshLists()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível excluir o mailing.")
    }
  }

  const selectAllResults = () => {
    setSelectedIds(new Set(candidates.map((candidate) => candidate.contact.id)))
    setMessage(`${candidates.length} contato(s) elegível(is) selecionado(s) a partir dos filtros atuais.`)
  }

  const selectCurrentPage = () => {
    setSelectedIds((current) => {
      const next = new Set(current)
      visibleCandidates.forEach((candidate) => next.add(candidate.contact.id))
      return next
    })
    setMessage(`${visibleCandidates.length} contato(s) desta página adicionado(s) à seleção.`)
  }

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const copyEmails = async () => {
    if (!emailList) return
    try {
      await navigator.clipboard.writeText(emailList)
      setMessage(`${emailList.split("\n").length} e-mail(s) elegível(is) copiado(s).`)
    } catch {
      setError("Não foi possível copiar automaticamente. Selecione o texto da lista de e-mails.")
    }
  }

  const eventName = (id?: string) => effectiveState.events.find((event) => event.id === id)?.title

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-carbon-60 text-sm font-semibold">
        <span className="w-5 h-5 mr-3 rounded-full border-2 border-carbon-20 border-t-green animate-spin" />
        Carregando construtor de mailing…
      </div>
    )
  }

  if (!catalog || !options) {
    return <div className="p-6 text-sm text-magenta">{error || "Não foi possível carregar os filtros."}</div>
  }

  return (
    <div className={`h-full overflow-y-auto ${embedded ? "bg-neutral/40" : "bg-neutral"}`}>
      <div className="max-w-[1500px] mx-auto px-5 py-5 space-y-5">
        {error && <div className="px-4 py-3 rounded-xl bg-light-magenta text-magenta text-sm font-semibold">{error}</div>}
        {message && <div className="px-4 py-3 rounded-xl bg-light-green text-green text-sm font-semibold">{message}</div>}

        <section className="bg-white rounded-2xl border border-carbon-20 p-5">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide font-bold text-carbon-60">Seleções salvas</p>
              <h2 className="text-base font-bold text-carbon mt-1">{eventId ? "Mailings deste evento" : "Mailings personalizados"}</h2>
              <p className="text-xs text-carbon-60 mt-1">Reabra uma seleção para editar filtros, contatos ou gerar novamente a lista de e-mails.</p>
            </div>
            {isAdmin && (
              <button type="button" onClick={startNew} className="px-4 py-2.5 rounded-xl border border-green text-green text-sm font-bold hover:bg-green/5">+ Novo mailing</button>
            )}
          </div>

          {lists.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-carbon-20 p-4 text-sm text-carbon-60">Nenhuma seleção salva ainda.</div>
          ) : (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {lists.map((list) => (
                <div key={list.id} className={`rounded-xl border p-4 ${activeListId === list.id ? "border-green ring-2 ring-green/10" : "border-carbon-20"}`}>
                  <button type="button" onClick={() => loadList(list)} className="w-full text-left">
                    <p className="font-bold text-sm text-carbon truncate">{list.title}</p>
                    <p className="text-xs text-carbon-60 mt-1">{list.contactIds.length} contato(s){list.eventId && eventName(list.eventId) ? ` · ${eventName(list.eventId)}` : ""}</p>
                    <p className="text-[11px] text-carbon-40 mt-1">Atualizado em {new Date(list.updatedAt).toLocaleString("pt-BR")}</p>
                  </button>
                  {isAdmin && <div className="mt-3 pt-3 border-t border-carbon-20 flex justify-end"><button type="button" onClick={() => void handleDelete(list)} className="text-xs font-bold text-magenta hover:underline">Excluir</button></div>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-carbon-20 p-5">
          <div className="flex flex-col xl:flex-row xl:items-end gap-4">
            <label className="flex-1">
              <span className="block text-xs font-bold text-carbon mb-1.5">Título da seleção</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={eventId ? "Ex.: Público prioritário — webinar FINEP" : "Ex.: CEOs da cadeia automotiva"} disabled={!isAdmin} className="w-full px-3.5 py-2.5 rounded-xl border border-carbon-20 text-sm text-carbon focus:outline-none focus:border-green disabled:bg-neutral" />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSelectedIds(new Set())} className="px-4 py-2.5 rounded-xl border border-carbon-20 text-sm font-bold text-carbon">Limpar seleção</button>
              {isAdmin && <button type="button" onClick={() => void handleSave()} disabled={saving} className="px-5 py-2.5 rounded-xl bg-green text-white text-sm font-bold disabled:opacity-40">{saving ? "Salvando…" : activeListId ? "Salvar alterações" : "Salvar mailing"}</button>}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Summary label="Encontrados" value={audienceSummary.found} />
          <Summary label="Selecionados" value={audienceSummary.selected} />
          <Summary label="Com e-mail" value={audienceSummary.withEmail} tone="green" />
          <Summary label="Sem e-mail" value={audienceSummary.withoutEmail} tone="yellow" />
          <Summary label="Impedidos" value={audienceSummary.blocked} tone="magenta" />
        </section>

        <section className="bg-white rounded-2xl border border-carbon-20 p-5">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2"><h2 className="text-base font-bold text-carbon">Filtros do público</h2>{activeFilterCount > 0 && <span className="badge-green text-[11px] font-bold px-2 py-1 rounded-full">{activeFilterCount} ativo(s)</span>}</div>
              <p className="text-xs text-carbon-60 mt-1">Seleção múltipla: valores do mesmo filtro funcionam como OU; filtros diferentes são combinados como E.</p>
            </div>
            <button type="button" onClick={() => setFilters(EMPTY_FILTERS())} className="text-xs font-bold text-green hover:underline">Restaurar filtros</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <MultiSelect label="Tipo de setor" options={options.segmentTypes} selected={filters.segmentTypes} onChange={(value) => setFilters((current) => ({ ...current, segmentTypes: value }))} />
            <MultiSelect label="Setor econômico" options={options.segments} selected={filters.segmentIds} onChange={(value) => setFilters((current) => ({ ...current, segmentIds: value }))} searchable />
            <MultiSelect label="Subsetor" options={subsegmentOptions} selected={filters.subsegmentIds} onChange={(value) => setFilters((current) => ({ ...current, subsegmentIds: value }))} searchable />
            <MultiSelect label="Organização" options={options.organizations} selected={filters.organizationIds} onChange={(value) => setFilters((current) => ({ ...current, organizationIds: value }))} searchable />
            <MultiSelect label="Tipo de organização" options={options.organizationTypes} selected={filters.organizationTypeIds} onChange={(value) => setFilters((current) => ({ ...current, organizationTypeIds: value }))} searchable />
            <MultiSelect label="Categoria institucional" options={options.institutionalCategories} selected={filters.institutionalCategoryIds} onChange={(value) => setFilters((current) => ({ ...current, institutionalCategoryIds: value, institutionalSubcategoryIds: [] }))} searchable />
            <MultiSelect label="Subcategoria institucional" options={institutionalSubcategoryOptions} selected={filters.institutionalSubcategoryIds} onChange={(value) => setFilters((current) => ({ ...current, institutionalSubcategoryIds: value }))} searchable />
            <MultiSelect label="Categorias especiais" options={options.specialCategories} selected={filters.specialCategoryIds} onChange={(value) => setFilters((current) => ({ ...current, specialCategoryIds: value }))} searchable />
            <MultiSelect label="Abrangência" options={options.scopes} selected={filters.scopeIds} onChange={(value) => setFilters((current) => ({ ...current, scopeIds: value }))} />
            <MultiSelect label="Esfera governamental" options={options.governmentSpheres} selected={filters.governmentSphereIds} onChange={(value) => setFilters((current) => ({ ...current, governmentSphereIds: value }))} />
            <MultiSelect label="País" options={options.countries} selected={filters.countries} onChange={(value) => setFilters((current) => ({ ...current, countries: value }))} searchable />
            <MultiSelect label="Estado" options={options.states} selected={filters.states} onChange={(value) => setFilters((current) => ({ ...current, states: value }))} searchable />
            <MultiSelect label="Cargo" options={options.positions} selected={filters.positions} onChange={(value) => setFilters((current) => ({ ...current, positions: value }))} searchable />
            <MultiSelect label="Classificação" options={options.classifications} selected={filters.classifications} onChange={(value) => setFilters((current) => ({ ...current, classifications: value }))} />
            <MultiSelect label="Envolvimento da organização" options={options.involvementTypes} selected={filters.involvementTypes} onChange={(value) => setFilters((current) => ({ ...current, involvementTypes: value }))} />
            <MultiSelect label="Nível de relacionamento" options={options.relationshipLevels} selected={filters.relationshipLevels} onChange={(value) => setFilters((current) => ({ ...current, relationshipLevels: value }))} />
            <MultiSelect label="Responsável da conta" options={options.accountManagers} selected={filters.accountManagers} onChange={(value) => setFilters((current) => ({ ...current, accountManagers: value }))} searchable />
            <MultiSelect label="Origem do contato" options={options.origins} selected={filters.origins} onChange={(value) => setFilters((current) => ({ ...current, origins: value }))} />
            <MultiSelect label="Senioridade" options={options.seniorities} selected={filters.seniorities} onChange={(value) => setFilters((current) => ({ ...current, seniorities: value }))} />
            <MultiSelect label="Tipo de relacionamento" options={options.relationshipTypes} selected={filters.relationshipTypes} onChange={(value) => setFilters((current) => ({ ...current, relationshipTypes: value }))} />
            <MultiSelect label="Status de comunicação" options={options.communicationStatuses} selected={filters.communicationStatuses} onChange={(value) => setFilters((current) => ({ ...current, communicationStatuses: value }))} />
            <MultiSelect label="Tags" options={options.tags} selected={filters.tags} onChange={(value) => setFilters((current) => ({ ...current, tags: value }))} searchable />
            <MultiSelect label="Cidade" options={options.cities} selected={filters.cities} onChange={(value) => setFilters((current) => ({ ...current, cities: value }))} searchable />
          </div>

          <div className="mt-4 pt-4 border-t border-carbon-20 grid grid-cols-1 lg:grid-cols-2 gap-3">
            <MultiSelect label="Histórico em outros eventos" options={options.events} selected={filters.eventIds} onChange={(value) => setFilters((current) => ({ ...current, eventIds: value }))} searchable />
            <MultiSelect label="Situação nos eventos selecionados" options={options.eventStatuses} selected={filters.eventStatuses} onChange={(value) => setFilters((current) => ({ ...current, eventStatuses: value }))} />
          </div>

          <label className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-carbon cursor-pointer">
            <input type="checkbox" checked={filters.onlyWithEmail} onChange={(event) => setFilters((current) => ({ ...current, onlyWithEmail: event.target.checked }))} className="accent-green" />
            Mostrar somente contatos que possuem e-mail
          </label>
          <p className="mt-2 text-[11px] text-carbon-60">Descadastrados, e-mails inválidos e bounces ficam fora da exportação automática. A seleção pode preservá-los para análise, mas somente contatos ativos com e-mail entram na lista copiável.</p>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
          <div className="bg-white rounded-2xl border border-carbon-20 overflow-hidden">
            <div className="p-5 border-b border-carbon-20">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <h2 className="font-bold text-carbon">Resultados</h2>
                  <p className="text-xs text-carbon-60 mt-1">{candidates.length} contato(s) elegível(is) · {selectedIds.size} selecionado(s)</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nos resultados…" className="px-3 py-2 rounded-lg border border-carbon-20 text-xs focus:outline-none focus:border-green" />
                  <button type="button" onClick={selectCurrentPage} disabled={visibleCandidates.length === 0} className="px-3.5 py-2 rounded-lg border border-green text-green text-xs font-bold disabled:opacity-40">Selecionar página</button>
                  <button type="button" onClick={selectAllResults} disabled={candidates.length === 0} className="px-3.5 py-2 rounded-lg bg-green text-white text-xs font-bold disabled:opacity-40">Selecionar todos</button>
                </div>
              </div>
            </div>

            <div className="overflow-auto max-h-[560px]">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="sticky top-0 bg-neutral z-10">
                  <tr className="text-left text-[11px] uppercase tracking-wide text-carbon-60">
                    <th className="px-4 py-3 w-12">Sel.</th><th className="px-3 py-3">Nome</th><th className="px-3 py-3">Cargo</th><th className="px-3 py-3">Organização</th><th className="px-3 py-3">Setor / subsetor</th><th className="px-3 py-3">E-mail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-carbon-20/60">
                  {visibleCandidates.map((candidate) => (
                    <tr key={candidate.contact.id} className={selectedIds.has(candidate.contact.id) ? "bg-green/[0.035]" : ""}>
                      <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.has(candidate.contact.id)} onChange={() => toggleSelected(candidate.contact.id)} className="accent-green" /></td>
                      <td className="px-3 py-3 font-semibold text-carbon">{candidate.name || "Sem nome"}</td>
                      <td className="px-3 py-3 text-carbon-60">{candidate.position}</td>
                      <td className="px-3 py-3 text-carbon-60 max-w-[220px] truncate">{candidate.organizationName}</td>
                      <td className="px-3 py-3 text-carbon-60 max-w-[260px]"><span className="block truncate">{candidate.sector}</span>{candidate.subsector !== "—" && <span className="block truncate text-[11px] text-carbon-40">{candidate.subsector}</span>}</td>
                      <td className="px-3 py-3 text-carbon-60">{candidate.email || "—"}</td>
                    </tr>
                  ))}
                  {visibleCandidates.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-carbon-60">Nenhum contato corresponde aos filtros atuais.</td></tr>}
                </tbody>
              </table>
            </div>

            {searchedCandidates.length > PAGE_SIZE && (
              <div className="px-4 py-3 border-t border-carbon-20 flex items-center justify-between gap-3 text-xs">
                <span className="text-carbon-60">Página {currentPage} de {totalPages} · {searchedCandidates.length} resultado(s)</span>
                <div className="flex gap-2">
                  <button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="px-3 py-1.5 rounded-lg border border-carbon-20 font-bold disabled:opacity-40">Anterior</button>
                  <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="px-3 py-1.5 rounded-lg border border-carbon-20 font-bold disabled:opacity-40">Próxima</button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-carbon-20 overflow-hidden sticky top-4">
            <div className="p-4 border-b border-carbon-20 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-carbon text-sm">Seleção final</h2>
                <p className="text-xs text-carbon-60 mt-0.5">{selectedIds.size} pessoa(s) · {emailList ? emailList.split("\n").length : 0} e-mail(s) exportável(is)</p>
              </div>
              <div className="flex rounded-lg bg-neutral p-1">
                <button type="button" onClick={() => setOutputMode("contacts")} className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold ${outputMode === "contacts" ? "bg-white text-carbon shadow-sm" : "text-carbon-60"}`}>Pessoas</button>
                <button type="button" onClick={() => setOutputMode("emails")} className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold ${outputMode === "emails" ? "bg-white text-carbon shadow-sm" : "text-carbon-60"}`}>E-mails</button>
              </div>
            </div>

            {outputMode === "emails" ? (
              <div className="p-4">
                <textarea readOnly value={emailList} placeholder="Os e-mails elegíveis aparecerão aqui, um por linha." className="w-full h-[360px] resize-none rounded-xl border border-carbon-20 bg-neutral/40 p-3 text-xs leading-6 text-carbon focus:outline-none" />
                <button type="button" disabled={!emailList} onClick={() => void copyEmails()} className="w-full mt-3 px-4 py-2.5 rounded-xl bg-green text-white text-sm font-bold disabled:opacity-40">Copiar e-mails</button>
              </div>
            ) : (
              <div className="max-h-[420px] overflow-y-auto divide-y divide-carbon-20/60">
                {selectedCandidates.map((candidate) => {
                  const blocked = candidate.contact.communicationStatus !== "active"
                  return (
                    <div key={candidate.contact.id} className="px-4 py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-carbon truncate">{candidate.name}</p>
                        <p className="text-[11px] text-carbon-60 truncate">{candidate.position} · {candidate.organizationName}</p>
                        <p className={`text-[11px] truncate mt-0.5 ${blocked || !candidate.email ? "text-magenta" : "text-green"}`}>{!candidate.email ? "Sem e-mail" : blocked ? `Impedido: ${candidate.contact.communicationStatus}` : candidate.email}</p>
                      </div>
                      <button type="button" onClick={() => toggleSelected(candidate.contact.id)} className="text-carbon-40 hover:text-magenta text-xs">×</button>
                    </div>
                  )
                })}
                {selectedCandidates.length === 0 && <div className="p-8 text-center text-xs text-carbon-60">Use os filtros e selecione os contatos que irão compor o mailing.</div>}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function Summary({ label, value, tone = "carbon" }: { label: string; value: number; tone?: "carbon" | "green" | "yellow" | "magenta" }) {
  const toneClass = tone === "green" ? "text-green" : tone === "yellow" ? "text-[#9B6E00]" : tone === "magenta" ? "text-magenta" : "text-carbon"
  return <div className="bg-white rounded-xl border border-carbon-20 px-4 py-3"><p className="text-[11px] font-bold uppercase tracking-wide text-carbon-60">{label}</p><p className={`text-xl font-bold mt-1 ${toneClass}`}>{value}</p></div>
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
  searchable = false,
}: {
  label: string
  options: MailingOption[]
  selected: string[]
  onChange: (value: string[]) => void
  searchable?: boolean
}) {
  const [query, setQuery] = useState("")
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR")
    if (!normalized) return options
    return options.filter((option) => option.label.toLocaleLowerCase("pt-BR").includes(normalized))
  }, [options, query])

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value])
  }

  return (
    <details className="relative group">
      <summary className="list-none cursor-pointer rounded-xl border border-carbon-20 bg-white px-3.5 py-3 flex items-center justify-between gap-3 hover:border-green/50 transition-fast">
        <div className="min-w-0">
          <span className="block text-[11px] font-bold text-carbon-60 truncate">{label}</span>
          <span className={`block text-xs mt-0.5 truncate ${selected.length ? "font-bold text-green" : "text-carbon-40"}`}>{selected.length ? `${selected.length} selecionado(s)` : "Todos"}</span>
        </div>
        <span className="text-carbon-40 group-open:rotate-180 transition-transform">⌄</span>
      </summary>
      <div className="absolute z-40 mt-2 left-0 right-0 min-w-[260px] rounded-xl border border-carbon-20 bg-white shadow-xl p-2">
        {searchable && options.length > 8 && <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar…" className="w-full mb-2 px-3 py-2 rounded-lg border border-carbon-20 text-xs focus:outline-none focus:border-green" />}
        <div className="max-h-60 overflow-y-auto space-y-0.5">
          {visible.map((option) => <label key={option.value} className="flex items-start gap-2 px-2.5 py-2 rounded-lg hover:bg-neutral cursor-pointer text-xs text-carbon"><input type="checkbox" checked={selected.includes(option.value)} onChange={() => toggle(option.value)} className="mt-0.5 accent-green" /><span>{option.label}</span></label>)}
          {visible.length === 0 && <p className="px-2 py-4 text-center text-xs text-carbon-60">Nenhuma opção disponível.</p>}
        </div>
        {selected.length > 0 && <button type="button" onClick={() => onChange([])} className="w-full mt-2 pt-2 border-t border-carbon-20 text-xs font-bold text-green">Limpar filtro</button>}
      </div>
    </details>
  )
}
