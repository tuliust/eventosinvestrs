import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useApp } from "@/contexts/AppContext"
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect"
import ListPagination from "@/components/ui/ListPagination"
import { ORG_TYPE_LABELS } from "@/lib/constants"
import type { Organization, OrgType } from "@/lib/types"

const PAGE_SIZE = 100
const normalize = (value?: string) => (value || "").trim().toLocaleLowerCase("pt-BR")
const organizationLocation = (organization: Organization) => [organization.city, organization.state, organization.country].filter(Boolean).join(" · ")

type OrganizationCategory = "all" | OrgType

export default function OrganizationsPage() {
  const { state } = useApp()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [newOrganizationMenuOpen, setNewOrganizationMenuOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [page, setPage] = useState(1)

  const query = searchParams.get("q") || searchParams.get("buscar") || ""
  const rawCategory = searchParams.get("category") || "all"
  const category: OrganizationCategory = rawCategory === "all" || rawCategory in ORG_TYPE_LABELS ? rawCategory as OrganizationCategory : "all"
  const rawOrganizationType = searchParams.get("organizationType") || ""
  const organizationType: OrgType | "" = rawOrganizationType in ORG_TYPE_LABELS ? rawOrganizationType as OrgType : ""
  const classification = searchParams.get("classification") || ""
  const sectorId = searchParams.get("sector") || ""
  const subsegmentId = searchParams.get("subsegment") || ""
  const relationshipLevel = searchParams.get("relationshipLevel") || ""
  const locationFilter = searchParams.get("location") || ""

  const updateUrl = (mutate: (params: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams)
    next.delete("buscar")
    mutate(next)
    setSearchParams(next, { replace: true })
  }

  const setParam = (key: string, value: string) => updateUrl((params) => {
    if (value) params.set(key, value)
    else params.delete(key)
  })

  const selectedSegment = state.segments.find((item) => item.id === sectorId)
  const selectedSubsegment = state.subsegments.find((item) => item.id === subsegmentId)

  const segmentsById = useMemo(
    () => new Map(state.segments.map((item) => [item.id, item])),
    [state.segments],
  )
  const segmentsByName = useMemo(
    () => new Map(state.segments.map((item) => [normalize(item.name), item])),
    [state.segments],
  )
  const organizationsByName = useMemo(
    () => new Map(state.organizations.map((item) => [normalize(item.name), item])),
    [state.organizations],
  )

  const classificationFor = (organization: Organization) => {
    if (organization.classificationType) return organization.classificationType
    const segment = organization.primarySegmentId
      ? segmentsById.get(organization.primarySegmentId)
      : segmentsByName.get(normalize(organization.sector))
    if (!segment) return ""
    return segment.type === "priority" ? "Prioritário" : "Secundário"
  }

  const contactCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const contact of state.contacts) {
      if (contact.organizationId) {
        map.set(contact.organizationId, (map.get(contact.organizationId) || 0) + 1)
        continue
      }
      const organizationName = normalize(contact.organization)
      if (!organizationName) continue
      const organization = organizationsByName.get(organizationName)
      if (organization) map.set(organization.id, (map.get(organization.id) || 0) + 1)
    }
    return map
  }, [state.contacts, organizationsByName])

  const categoryTabs = useMemo(() => {
    const counts = new Map<OrgType, number>()
    for (const organization of state.organizations) counts.set(organization.type, (counts.get(organization.type) || 0) + 1)
    const typed = (Object.entries(ORG_TYPE_LABELS) as Array<[OrgType, string]>)
      .map(([id, label]) => ({ id, label, count: counts.get(id) || 0 }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"))

    const visible = typed.slice(0, 5)
    if (category !== "all" && !visible.some((item) => item.id === category)) {
      const selected = typed.find((item) => item.id === category)
      if (selected) visible.splice(Math.max(visible.length - 1, 0), 1, selected)
    }

    return [{ id: "all" as OrganizationCategory, label: "Todos", count: state.organizations.length }, ...visible]
  }, [state.organizations, category])

  const organizationTypeOptions = useMemo<SelectOption[]>(
    () => (Object.entries(ORG_TYPE_LABELS) as Array<[OrgType, string]>)
      .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
      .map(([value, label]) => ({ value, label })),
    [],
  )

  const classificationOptions: SelectOption[] = [
    { value: "Prioritário", label: "Prioritário" },
    { value: "Secundário", label: "Secundário" },
  ]

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

  const relationshipLevelOptions = useMemo<SelectOption[]>(() => {
    const values = [...new Set(state.organizations.map((item) => item.relationshipLevel).filter((value): value is number => typeof value === "number"))]
    return values.sort((a, b) => a - b).map((value) => ({ value: String(value), label: `Nível ${value}` }))
  }, [state.organizations])

  const locationOptions = useMemo<SelectOption[]>(() => {
    const values = [...new Set(state.organizations.map(organizationLocation).filter(Boolean))]
    return values.sort((a, b) => a.localeCompare(b, "pt-BR")).map((value) => ({ value, label: value }))
  }, [state.organizations])

  const results = useMemo(() => {
    const normalizedQuery = normalize(query)
    return state.organizations.filter((item) => {
      if (category !== "all" && item.type !== category) return false
      if (organizationType && item.type !== organizationType) return false
      if (normalizedQuery && ![item.name, ORG_TYPE_LABELS[item.type], item.sector, item.subsector, item.city, item.state, item.country, item.site].filter(Boolean).some((value) => normalize(value).includes(normalizedQuery))) return false
      if (classification && normalize(classificationFor(item)) !== normalize(classification)) return false
      if (sectorId && item.primarySegmentId !== sectorId && normalize(item.sector) !== normalize(selectedSegment?.name)) return false
      if (subsegmentId && item.primarySubsegmentId !== subsegmentId && normalize(item.subsector) !== normalize(selectedSubsegment?.name)) return false
      if (relationshipLevel && String(item.relationshipLevel ?? "") !== relationshipLevel) return false
      if (locationFilter && normalize(organizationLocation(item)) !== normalize(locationFilter)) return false
      return true
    })
  }, [state.organizations, category, organizationType, query, classification, sectorId, subsegmentId, relationshipLevel, locationFilter, selectedSegment?.name, selectedSubsegment?.name, segmentsById, segmentsByName])

  useEffect(() => {
    setPage(1)
  }, [query, category, organizationType, classification, sectorId, subsegmentId, relationshipLevel, locationFilter])

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visibleResults = useMemo(
    () => results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [results, currentPage],
  )

  const filterChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; remove: () => void }> = []
    if (organizationType) chips.push({ id: "organizationType", label: `Tipo: ${ORG_TYPE_LABELS[organizationType]}`, remove: () => setParam("organizationType", "") })
    if (classification) chips.push({ id: "classification", label: `Classificação: ${classification}`, remove: () => setParam("classification", "") })
    if (selectedSegment) chips.push({ id: "sector", label: `Setor: ${selectedSegment.name}`, remove: () => updateUrl((params) => { params.delete("sector"); params.delete("subsegment") }) })
    if (selectedSubsegment) chips.push({ id: "subsegment", label: `Subsetor: ${selectedSubsegment.name}`, remove: () => setParam("subsegment", "") })
    if (relationshipLevel) chips.push({ id: "relationshipLevel", label: `Nível de relacionamento: ${relationshipLevel}`, remove: () => setParam("relationshipLevel", "") })
    if (locationFilter) chips.push({ id: "location", label: `Localização: ${locationFilter}`, remove: () => setParam("location", "") })
    return chips
  }, [organizationType, classification, selectedSegment, selectedSubsegment, relationshipLevel, locationFilter, searchParams])

  const clearFilters = () => updateUrl((params) => {
    for (const key of ["organizationType", "classification", "sector", "subsegment", "relationshipLevel", "location", "state", "country", "contacts"]) params.delete(key)
  })

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="flex-shrink-0 px-6 py-5 bg-white border-b border-carbon-20 flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-lg font-bold text-carbon">Organizações</h1>
          <p className="text-xs text-carbon-60 mt-0.5">{state.organizations.length.toLocaleString("pt-BR")} organizações na base</p>
        </div>
        {state.user?.role === "admin" && (
          <div className="relative">
            <button type="button" aria-expanded={newOrganizationMenuOpen} aria-haspopup="menu" onClick={() => setNewOrganizationMenuOpen((open) => !open)} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-green hover:opacity-90 active:scale-95 transition-fast">+ Nova organização</button>
            {newOrganizationMenuOpen && (
              <div role="menu" className="absolute right-0 top-full mt-2 z-30 w-72 bg-white rounded-2xl border border-carbon-20 shadow-lg p-2">
                <button type="button" role="menuitem" onClick={() => navigate("/organizacoes/nova")} className="w-full text-left px-3.5 py-3 rounded-xl hover:bg-neutral transition-fast"><span className="block text-sm font-bold text-carbon">Organização única</span><span className="block text-xs text-carbon-60 mt-0.5">Cadastrar uma organização manualmente</span></button>
                <button type="button" role="menuitem" onClick={() => navigate("/organizacoes/importar")} className="w-full text-left px-3.5 py-3 rounded-xl hover:bg-neutral transition-fast"><span className="block text-sm font-bold text-carbon">Importar organizações</span><span className="block text-xs text-carbon-60 mt-0.5">Enviar uma planilha Excel com várias organizações</span></button>
              </div>
            )}
          </div>
        )}
      </header>

      <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-carbon-20 bg-white/60 space-y-4">
        <div className="flex gap-2 items-center">
          <input type="search" value={query} onChange={(event) => setParam("q", event.target.value)} placeholder="Buscar por nome, tipo, setor ou cidade…" aria-label="Buscar organizações" className="flex-1 min-w-0 max-w-2xl px-4 py-2.5 rounded-xl border border-carbon-20 bg-white text-sm text-carbon focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20 transition-fast" />
          <button type="button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} className="px-3.5 py-2.5 rounded-xl border border-carbon-20 bg-white text-xs font-bold text-carbon hover:bg-neutral">Filtros{filterChips.length ? ` (${filterChips.length})` : ""}</button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2" role="tablist" aria-label="Categorias de organizações">
          {categoryTabs.map((tab) => (
            <button key={tab.id} type="button" role="tab" aria-selected={category === tab.id} onClick={() => setParam("category", tab.id === "all" ? "" : tab.id)} className={`min-w-0 rounded-xl border px-3 py-2 text-xs font-bold leading-4 whitespace-normal break-words transition-fast ${category === tab.id ? "border-carbon bg-carbon text-white" : "border-carbon-20 bg-white text-carbon hover:bg-neutral"}`}>{tab.label} <span className="ml-1 opacity-70">{tab.count.toLocaleString("pt-BR")}</span></button>
          ))}
        </div>

        <section aria-label="Filtros de organizações" className={`${filtersOpen ? "block" : "hidden"} rounded-2xl border border-carbon-20 bg-white p-4`}>
          <div className="flex items-center justify-between gap-3 mb-3"><div><h2 className="text-sm font-bold text-carbon">Filtros</h2><p className="text-[11px] text-carbon-60 mt-0.5">Combine os campos para refinar a lista de organizações.</p></div>{filterChips.length > 0 && <button type="button" onClick={clearFilters} className="text-xs font-bold text-magenta hover:underline">Limpar filtros</button>}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            <SearchableSelect id="organizations-filter-type" label="Tipo de organização" value={organizationType} options={organizationTypeOptions} onChange={(value) => setParam("organizationType", value)} />
            <SearchableSelect id="organizations-filter-classification" label="Classificação" value={classification} options={classificationOptions} onChange={(value) => setParam("classification", value)} />
            <SearchableSelect id="organizations-filter-sector" label="Setor econômico" value={sectorId} options={segmentOptions} onChange={(value) => updateUrl((params) => { if (value) params.set("sector", value); else params.delete("sector"); params.delete("subsegment") })} />
            <SearchableSelect id="organizations-filter-subsegment" label="Subsetor" value={subsegmentId} options={subsegmentOptions} disabled={!sectorId} placeholder={sectorId ? "Selecionar" : "Selecione um setor"} onChange={(value) => setParam("subsegment", value)} />
            <SearchableSelect id="organizations-filter-relationship-level" label="Nível de Relacionamento" value={relationshipLevel} options={relationshipLevelOptions} onChange={(value) => setParam("relationshipLevel", value)} />
            <SearchableSelect id="organizations-filter-location" label="Localização" value={locationFilter} options={locationOptions} onChange={(value) => setParam("location", value)} />
          </div>
        </section>

        {filterChips.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Filtros ativos">{filterChips.map((chip) => <button key={chip.id} type="button" onClick={chip.remove} className="inline-flex items-center gap-1.5 rounded-full bg-neutral px-3 py-1.5 text-[11px] font-semibold text-carbon hover:bg-carbon-20" aria-label={`Remover filtro ${chip.label}`}>{chip.label} <span aria-hidden>×</span></button>)}</div>}
        <div className="text-[11px] font-semibold text-carbon-60">{results.length.toLocaleString("pt-BR")} resultado{results.length === 1 ? "" : "s"}</div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center"><p className="text-4xl mb-3 opacity-30">⬡</p><p className="text-carbon-60 font-medium">Nenhuma organização encontrada</p><p className="text-sm text-carbon-60 opacity-70 mt-1">Ajuste a pesquisa, categoria ou filtros.</p></div>
        ) : (
          <>
            <table className="w-full min-w-[900px] table-fixed text-sm">
              <colgroup><col style={{ width: "24%" }} /><col style={{ width: "18%" }} /><col style={{ width: "24%" }} /><col style={{ width: "24%" }} /><col style={{ width: "10%" }} /></colgroup>
              <thead><tr className="text-left border-b border-carbon-20"><Header>Organização</Header><Header>Tipo</Header><Header>Setor / subsetor</Header><Header>Localização</Header><Header>Contatos</Header></tr></thead>
              <tbody className="divide-y divide-carbon-20/50">
                {visibleResults.map((item) => {
                  const contactCount = contactCounts.get(item.id) || 0
                  return (
                    <tr key={item.id} role="button" tabIndex={0} aria-label={`Abrir organização ${item.name}`} onClick={() => navigate(`/organizacoes/${item.id}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); navigate(`/organizacoes/${item.id}`) } }} className="hover:bg-white/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green/30 transition-fast cursor-pointer">
                      <td className="py-3 pr-4 align-top"><div className="flex items-start gap-3 min-w-0"><span className="w-9 h-9 rounded-xl bg-light-green text-green flex items-center justify-center font-bold flex-shrink-0">⬡</span><span className="min-w-0 font-semibold text-carbon leading-5 whitespace-normal break-words" title={item.name}>{item.name}</span></div></td>
                      <td className="py-3 pr-4 align-top text-carbon-60 whitespace-normal break-words leading-5">{ORG_TYPE_LABELS[item.type]}</td>
                      <td className="py-3 pr-4 align-top"><p className="text-carbon whitespace-normal break-words leading-5">{item.sector || "—"}</p>{item.subsector && <p className="text-xs text-carbon-60 mt-0.5 whitespace-normal break-words leading-4">{item.subsector}</p>}</td>
                      <td className="py-3 pr-4 align-top text-carbon-60 whitespace-normal break-words leading-5">{organizationLocation(item) || "—"}</td>
                      <td className="py-3 align-top"><span className="badge-carbon text-xs font-semibold px-2.5 py-1 rounded-full">{contactCount.toLocaleString("pt-BR")}</span></td>
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
  )
}

function Header({ children }: { children: React.ReactNode }) {
  return <th className="pb-2 pr-4 align-bottom font-semibold text-xs text-carbon-60 uppercase tracking-wide whitespace-normal break-words leading-4">{children}</th>
}
