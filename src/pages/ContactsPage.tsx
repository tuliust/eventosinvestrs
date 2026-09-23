import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useApp } from "@/contexts/AppContext"
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect"
import ListPagination from "@/components/ui/ListPagination"
import { loadAppData } from "@/lib/api"
import { ORG_TYPE_LABELS } from "@/lib/constants"
import {
  importLumaContacts,
  loadPendingLumaContactImport,
  type PendingLumaContactImport,
} from "@/lib/lumaContactImportApi"
import type { Contact, Organization, OrgType } from "@/lib/types"
import { searchContacts, fullName, getInitials } from "@/lib/utils"

const PAGE_SIZE = 100

function dismissalKey(candidate: PendingLumaContactImport) {
  return `invest-rs:luma-contact-toast:${candidate.eventId}:${candidate.latestRegistration}:${candidate.pendingCount}`
}

type ContactCategory = "all" | "active" | "incomplete" | "luma"

const normalize = (value?: string) => (value || "").trim().toLocaleLowerCase("pt-BR")

export default function ContactsPage() {
  const { state, dispatch } = useApp()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [newContactMenuOpen, setNewContactMenuOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [lumaCandidate, setLumaCandidate] = useState<PendingLumaContactImport | null>(null)
  const [lumaBusy, setLumaBusy] = useState(false)
  const [lumaError, setLumaError] = useState("")
  const [lumaSuccess, setLumaSuccess] = useState("")

  const query = searchParams.get("q") || ""
  const rawCategory = searchParams.get("category")
  const category: ContactCategory = rawCategory === "active" || rawCategory === "incomplete" || rawCategory === "luma" ? rawCategory : "all"
  const position = searchParams.get("position") || ""
  const rawOrganizationType = searchParams.get("organizationType") || ""
  const organizationType: OrgType | "" = rawOrganizationType in ORG_TYPE_LABELS ? rawOrganizationType as OrgType : ""
  const sectorId = searchParams.get("sector") || ""
  const subsegmentId = searchParams.get("subsegment") || ""

  const updateUrl = (mutate: (params: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams)
    mutate(next)
    setSearchParams(next, { replace: true })
  }

  const setParam = (key: string, value: string) => {
    updateUrl((params) => {
      if (value) params.set(key, value)
      else params.delete(key)
    })
  }

  const organizationsById = useMemo(
    () => new Map(state.organizations.map((item) => [item.id, item])),
    [state.organizations],
  )
  const organizationsByName = useMemo(
    () => new Map(state.organizations.map((item) => [normalize(item.name), item])),
    [state.organizations],
  )

  const organizationFor = (contact: Contact): Organization | undefined => {
    if (contact.organizationId) return organizationsById.get(contact.organizationId)
    const name = normalize(contact.organization)
    return name ? organizationsByName.get(name) : undefined
  }

  const selectedSegment = state.segments.find((item) => item.id === sectorId)
  const selectedSubsegment = state.subsegments.find((item) => item.id === subsegmentId)

  const positionOptions = useMemo<SelectOption[]>(() => {
    const values = [...new Set(state.contacts.map((item) => item.position?.trim()).filter(Boolean) as string[])]
    return values.sort((a, b) => a.localeCompare(b, "pt-BR")).map((value) => ({ value, label: value }))
  }, [state.contacts])

  const organizationTypeOptions = useMemo<SelectOption[]>(
    () => (Object.entries(ORG_TYPE_LABELS) as Array<[OrgType, string]>)
      .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
      .map(([value, label]) => ({ value, label })),
    [],
  )

  const segmentOptions = useMemo<SelectOption[]>(
    () => [...state.segments]
      .filter((item) => item.active)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR"))
      .map((item) => ({ value: item.id, label: item.name })),
    [state.segments],
  )

  const subsegmentOptions = useMemo<SelectOption[]>(
    () => state.subsegments
      .filter((item) => item.active && item.segmentId === sectorId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR"))
      .map((item) => ({ value: item.id, label: item.name })),
    [sectorId, state.subsegments],
  )

  const categoryCounts = useMemo(() => ({
    all: state.contacts.length,
    active: state.contacts.filter((item) => item.communicationStatus === "active").length,
    incomplete: state.contacts.filter((item) => item.incompleteProfile).length,
    luma: state.contacts.filter((item) => normalize(item.origin) === "luma" || item.tags?.some((tag) => normalize(tag) === "luma")).length,
  }), [state.contacts])

  const results = useMemo(() => {
    const searched = searchContacts(state.contacts, query)
    return searched.filter((contact) => {
      if (category === "active" && contact.communicationStatus !== "active") return false
      if (category === "incomplete" && !contact.incompleteProfile) return false
      if (category === "luma" && normalize(contact.origin) !== "luma" && !contact.tags?.some((tag) => normalize(tag) === "luma")) return false
      if (position && normalize(contact.position) !== normalize(position)) return false

      const organization = contact.organizationId
        ? organizationsById.get(contact.organizationId)
        : organizationsByName.get(normalize(contact.organization))

      if (organizationType && organization?.type !== organizationType) return false
      if (sectorId) {
        const matchesSector = organization?.primarySegmentId === sectorId || normalize(organization?.sector) === normalize(selectedSegment?.name)
        if (!matchesSector) return false
      }
      if (subsegmentId) {
        const matchesSubsegment = organization?.primarySubsegmentId === subsegmentId || normalize(organization?.subsector) === normalize(selectedSubsegment?.name)
        if (!matchesSubsegment) return false
      }
      return true
    })
  }, [state.contacts, query, category, position, organizationType, sectorId, subsegmentId, organizationsById, organizationsByName, selectedSegment?.name, selectedSubsegment?.name])

  useEffect(() => {
    setPage(1)
  }, [query, category, position, organizationType, sectorId, subsegmentId])

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visibleResults = useMemo(
    () => results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [results, currentPage],
  )

  const filterChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; remove: () => void }> = []
    if (position) chips.push({ id: "position", label: `Cargo: ${position}`, remove: () => setParam("position", "") })
    if (organizationType) chips.push({ id: "organizationType", label: `Tipo: ${ORG_TYPE_LABELS[organizationType]}`, remove: () => setParam("organizationType", "") })
    if (selectedSegment) chips.push({ id: "sector", label: `Setor: ${selectedSegment.name}`, remove: () => updateUrl((params) => { params.delete("sector"); params.delete("subsegment") }) })
    if (selectedSubsegment) chips.push({ id: "subsegment", label: `Subsetor: ${selectedSubsegment.name}`, remove: () => setParam("subsegment", "") })
    return chips
  }, [position, organizationType, selectedSegment, selectedSubsegment, searchParams])

  const clearFilters = () => updateUrl((params) => {
    for (const key of ["position", "organizationType", "sector", "subsegment"]) params.delete(key)
  })

  useEffect(() => {
    if (state.user?.role !== "admin") {
      setLumaCandidate(null)
      return
    }
    let active = true
    setLumaError("")
    void loadPendingLumaContactImport()
      .then((candidate) => {
        if (!active || !candidate || candidate.pendingCount <= 0) return
        const dismissed = window.sessionStorage.getItem(dismissalKey(candidate)) === "1"
        if (!dismissed) setLumaCandidate(candidate)
      })
      .catch((cause) => {
        if (!active) return
        setLumaError(cause instanceof Error ? cause.message : "Não foi possível verificar os contatos pendentes do Luma.")
      })
    return () => { active = false }
  }, [state.user?.role])

  const dismissLumaCandidate = () => {
    if (lumaCandidate) window.sessionStorage.setItem(dismissalKey(lumaCandidate), "1")
    setLumaCandidate(null)
    setLumaError("")
  }

  const addLumaContacts = async () => {
    if (!lumaCandidate || lumaBusy) return
    setLumaBusy(true)
    setLumaError("")
    setLumaSuccess("")
    try {
      const imported = await importLumaContacts(lumaCandidate.eventId)
      const data = await loadAppData()
      dispatch({ type: "HYDRATE_DATA", payload: data })
      setLumaCandidate(null)
      const createdLabel = imported.created === 1 ? "contato adicionado" : "contatos adicionados"
      const linkedLabel = imported.linked === 1 ? "inscrição vinculada" : "inscrições vinculadas"
      setLumaSuccess(`${imported.created} ${createdLabel} à base e ${imported.linked} ${linkedLabel} ao evento.`)
    } catch (cause) {
      setLumaError(cause instanceof Error ? cause.message : "Não foi possível adicionar os contatos do Luma.")
    } finally {
      setLumaBusy(false)
    }
  }

  const categoryTabs: Array<{ id: ContactCategory; label: string; count: number }> = [
    { id: "all", label: "Todos", count: categoryCounts.all },
    { id: "active", label: "Ativos", count: categoryCounts.active },
    { id: "incomplete", label: "Incompletos", count: categoryCounts.incomplete },
    { id: "luma", label: "Luma", count: categoryCounts.luma },
  ]

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-6 py-5 bg-white border-b border-carbon-20 flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-lg font-bold text-carbon">Contatos</h1>
          <p className="text-xs text-carbon-60 mt-0.5">{state.contacts.length.toLocaleString("pt-BR")} contatos na base</p>
        </div>
        {state.user?.role === "admin" && (
          <div className="relative">
            <button type="button" aria-expanded={newContactMenuOpen} aria-haspopup="menu" onClick={() => setNewContactMenuOpen((open) => !open)} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-green hover:opacity-90 active:scale-95 transition-fast">+ Novo contato</button>
            {newContactMenuOpen && (
              <div role="menu" className="absolute right-0 top-full mt-2 z-30 w-72 bg-white rounded-2xl border border-carbon-20 shadow-lg p-2">
                <button type="button" role="menuitem" onClick={() => navigate("/contatos/novo")} className="w-full text-left px-3.5 py-3 rounded-xl hover:bg-neutral transition-fast"><span className="block text-sm font-bold text-carbon">Contato único</span><span className="block text-xs text-carbon-60 mt-0.5">Cadastrar uma pessoa manualmente</span></button>
                <button type="button" role="menuitem" onClick={() => navigate("/contatos/importar")} className="w-full text-left px-3.5 py-3 rounded-xl hover:bg-neutral transition-fast"><span className="block text-sm font-bold text-carbon">Importar contatos</span><span className="block text-xs text-carbon-60 mt-0.5">Enviar uma planilha Excel com vários contatos</span></button>
              </div>
            )}
          </div>
        )}
      </div>

      {state.user?.role === "admin" && lumaCandidate && (
        <div className="flex-shrink-0 px-4 sm:px-6 pt-4 bg-white/60">
          <div className="mx-auto rounded-2xl border border-green/25 bg-white shadow-sm overflow-hidden" role="status" aria-live="polite">
            <div className="h-1 bg-green" />
            <div className="px-4 py-3.5 flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-light-green text-green flex items-center justify-center font-bold flex-shrink-0">+</div>
                <div className="min-w-0"><p className="text-sm font-bold text-carbon">{lumaCandidate.pendingCount} novos contatos do Luma disponíveis</p><p className="text-xs text-carbon-60 mt-0.5 leading-relaxed">Os inscritos de “{lumaCandidate.eventTitle}” ainda não estão na base de contatos. Deseja adicioná-los?</p>{lumaError && <p className="text-xs font-semibold text-magenta mt-2" role="alert">{lumaError}</p>}</div>
              </div>
              <div className="flex items-center gap-2 lg:flex-shrink-0"><button type="button" onClick={dismissLumaCandidate} disabled={lumaBusy} className="px-3.5 py-2 rounded-xl text-xs font-bold text-carbon-60 hover:bg-neutral disabled:opacity-50">Agora não</button><button type="button" onClick={() => void addLumaContacts()} disabled={lumaBusy} className="px-4 py-2 rounded-xl bg-green text-white text-xs font-bold hover:opacity-90 disabled:opacity-50">{lumaBusy ? "Adicionando…" : `Adicionar ${lumaCandidate.pendingCount} contatos`}</button></div>
            </div>
          </div>
        </div>
      )}

      {state.user?.role === "admin" && !lumaCandidate && lumaSuccess && (
        <div className="flex-shrink-0 px-4 sm:px-6 pt-4 bg-white/60"><div className="mx-auto rounded-xl border border-green/25 bg-light-green px-4 py-3 flex items-center justify-between gap-3" role="status" aria-live="polite"><p className="text-xs font-semibold text-green">{lumaSuccess}</p><button type="button" onClick={() => setLumaSuccess("")} className="text-xs font-bold text-green px-2 py-1 rounded-lg hover:bg-white/60" aria-label="Fechar confirmação">×</button></div></div>
      )}

      {state.user?.role === "admin" && !lumaCandidate && !lumaSuccess && lumaError && (
        <div className="flex-shrink-0 px-4 sm:px-6 pt-4 bg-white/60"><div className="mx-auto rounded-xl bg-light-magenta px-4 py-3 text-xs font-semibold text-magenta" role="alert">{lumaError}</div></div>
      )}

      <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-carbon-20 bg-white/60 space-y-4">
        <div className="flex gap-2 items-center">
          <input type="search" value={query} onChange={(event) => setParam("q", event.target.value)} placeholder="Buscar por nome, empresa, e-mail ou telefone…" aria-label="Buscar contatos" className="flex-1 min-w-0 max-w-2xl px-4 py-2.5 rounded-xl border border-carbon-20 bg-white text-sm text-carbon focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20 transition-fast" />
          <button type="button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} className="px-3.5 py-2.5 rounded-xl border border-carbon-20 bg-white text-xs font-bold text-carbon hover:bg-neutral">Filtros{filterChips.length ? ` (${filterChips.length})` : ""}</button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Categorias de contatos">
          {categoryTabs.map((tab) => (
            <button key={tab.id} type="button" role="tab" aria-selected={category === tab.id} onClick={() => setParam("category", tab.id === "all" ? "" : tab.id)} className={`flex-shrink-0 rounded-xl border px-3.5 py-2 text-xs font-bold transition-fast ${category === tab.id ? "border-carbon bg-carbon text-white" : "border-carbon-20 bg-white text-carbon hover:bg-neutral"}`}>{tab.label} <span className="ml-1 opacity-70">{tab.count.toLocaleString("pt-BR")}</span></button>
          ))}
        </div>

        <section aria-label="Filtros de contatos" className={`${filtersOpen ? "block" : "hidden"} rounded-2xl border border-carbon-20 bg-white p-4`}>
          <div className="flex items-center justify-between gap-3 mb-3"><div><h2 className="text-sm font-bold text-carbon">Filtros</h2><p className="text-[11px] text-carbon-60 mt-0.5">Filtre as pessoas pelo cargo e pelas características da organização vinculada.</p></div>{filterChips.length > 0 && <button type="button" onClick={clearFilters} className="text-xs font-bold text-magenta hover:underline">Limpar filtros</button>}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <SearchableSelect id="contacts-filter-position" label="Cargo" value={position} options={positionOptions} onChange={(value) => setParam("position", value)} />
            <SearchableSelect id="contacts-filter-organization-type" label="Tipo de organização" value={organizationType} options={organizationTypeOptions} onChange={(value) => setParam("organizationType", value)} />
            <SearchableSelect id="contacts-filter-sector" label="Setor econômico da organização" value={sectorId} options={segmentOptions} onChange={(value) => updateUrl((params) => { if (value) params.set("sector", value); else params.delete("sector"); params.delete("subsegment") })} />
            <SearchableSelect id="contacts-filter-subsegment" label="Subsetor da organização" value={subsegmentId} options={subsegmentOptions} disabled={!sectorId} placeholder={sectorId ? "Selecionar" : "Selecione um setor"} onChange={(value) => setParam("subsegment", value)} />
          </div>
        </section>

        {filterChips.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Filtros ativos">{filterChips.map((chip) => <button key={chip.id} type="button" onClick={chip.remove} className="inline-flex items-center gap-1.5 rounded-full bg-neutral px-3 py-1.5 text-[11px] font-semibold text-carbon hover:bg-carbon-20" aria-label={`Remover filtro ${chip.label}`}>{chip.label} <span aria-hidden>×</span></button>)}</div>}
        <div className="text-[11px] font-semibold text-carbon-60">{results.length.toLocaleString("pt-BR")} resultado{results.length === 1 ? "" : "s"}</div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-4">
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center"><p className="text-4xl mb-3 opacity-30">◎</p><p className="text-carbon-60 font-medium">Nenhum contato encontrado</p><p className="text-sm text-carbon-60 opacity-70 mt-1">Ajuste a pesquisa, categoria ou filtros.</p></div>
          ) : (
            <>
              <table className="w-full min-w-[760px] table-fixed text-sm">
                <colgroup><col className="w-1/4" /><col className="w-1/4" /><col className="w-1/4" /><col className="w-1/4" /></colgroup>
                <thead><tr className="text-left border-b border-carbon-20"><ContactHeader>Nome</ContactHeader><ContactHeader>Cargo</ContactHeader><ContactHeader>Organização</ContactHeader><ContactHeader>E-mail</ContactHeader></tr></thead>
                <tbody className="divide-y divide-carbon-20/50">
                  {visibleResults.map((contact) => {
                    const organization = organizationFor(contact)
                    return (
                      <tr
                        key={contact.id}
                        role="link"
                        tabIndex={0}
                        aria-label={`Abrir contato ${fullName(contact)}`}
                        onClick={() => navigate(`/contatos/${contact.id}`)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            navigate(`/contatos/${contact.id}`)
                          }
                        }}
                        className="cursor-pointer hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green/40 transition-fast"
                      >
                        <td className="py-3 pr-4 align-top"><div className="flex items-start gap-2.5 min-w-0"><div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 bg-green">{getInitials(fullName(contact))}</div><div className="min-w-0 font-semibold text-carbon whitespace-normal break-words leading-5">{fullName(contact)}{contact.incompleteProfile && <span className="ml-1.5 inline-block text-xs font-normal px-1.5 py-0.5 rounded bg-light-yellow text-carbon">incompleto</span>}</div></div></td>
                        <td className="py-3 pr-4 align-top text-carbon-60 whitespace-normal break-words leading-5">{contact.position || "—"}</td>
                        <td className="py-3 pr-4 align-top text-carbon whitespace-normal break-words leading-5">{organization ? <button type="button" onClick={(event) => { event.stopPropagation(); navigate(`/organizacoes/${organization.id}`) }} onKeyDown={(event) => event.stopPropagation()} className="text-left font-medium text-carbon hover:text-green hover:underline transition-fast" aria-label={`Abrir organização ${organization.name}`}>{organization.name}</button> : (contact.organization || "—")}</td>
                        <td className="py-3 align-top text-carbon-60 break-all leading-5">{contact.email || "—"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <ListPagination page={currentPage} pageSize={PAGE_SIZE} total={results.length} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ContactHeader({ children }: { children: React.ReactNode }) {
  return <th className="pb-2 pr-4 align-bottom font-semibold text-xs text-carbon-60 uppercase tracking-wide whitespace-normal break-words leading-4">{children}</th>
}
