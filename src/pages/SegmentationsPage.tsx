import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import { useSearchParams } from "react-router-dom"
import { useApp, useSegmentationActions } from "@/contexts/AppContext"
import Modal from "@/components/ui/Modal"
import {
  MultiSearchableSelect,
  SearchableSelect,
  type SelectOption,
} from "@/components/ui/SearchableSelect"
import { generateId } from "@/lib/utils"
import {
  deleteSegment,
  deleteSubsegment,
  updateSegment,
  updateSubsegment,
} from "@/lib/segmentationApi"
import {
  createInstitutionalCategory,
  createInstitutionalSubcategory,
  deleteInstitutionalCategory,
  deleteInstitutionalSubcategory,
  loadSegmentationsCatalog,
  updateInstitutionalCategory,
  updateInstitutionalSubcategory,
  type InstitutionalCategory,
  type InstitutionalSubcategory,
  type SegmentationsCatalog,
} from "@/lib/segmentationsCatalogApi"
import type { Organization, Segment, SegmentType, Subsegment } from "@/lib/types"

const COLORS = {
  priority: "#009C63",
  secondary: "#F8B51E",
  institutional: "#E60456",
} as const

const GROUP_LABELS = {
  priority: "Prioritário",
  secondary: "Secundário",
  institutional: "Institucional",
} as const

type GroupFilter = "all" | "priority" | "secondary" | "institutional"
type NewKind = SegmentType | "institutional"
type InstitutionalFilter =
  | { kind: "category"; id: string }
  | { kind: "subcategory"; id: string }
  | null

type CardItem =
  | { kind: "economic"; segment: Segment }
  | { kind: "institutional"; category: InstitutionalCategory }

const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl border border-carbon-20 bg-white text-sm text-carbon focus:border-green focus:ring-2 focus:ring-green/20 focus:outline-none transition-fast"

function parseInstitutionalFilter(value: string): InstitutionalFilter {
  if (!value) return null
  const [kind, ...idParts] = value.split(":")
  const id = idParts.join(":")
  if (!id) return null
  if (kind === "category") return { kind: "category", id }
  if (kind === "subcategory") return { kind: "subcategory", id }
  return null
}

function normalize(value?: string) {
  return (value || "").trim().toLocaleLowerCase("pt-BR")
}

export default function SegmentationsPage() {
  const { state, dispatch } = useApp()
  const {
    createSegment,
    createSubsegment,
    error: createError,
    saving: createSaving,
    clearError,
  } = useSegmentationActions()
  const isAdmin = state.user?.role === "admin"
  const [searchParams, setSearchParams] = useSearchParams()

  const [catalog, setCatalog] = useState<SegmentationsCatalog | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [expandedCards, setExpandedCards] = useState<Set<string>>(() => new Set())

  const [newSegmentOpen, setNewSegmentOpen] = useState(false)
  const [newKind, setNewKind] = useState<NewKind | null>(null)
  const [segmentName, setSegmentName] = useState("")
  const [segmentDescription, setSegmentDescription] = useState("")
  const [newInstitutionOrganizationTypeId, setNewInstitutionOrganizationTypeId] = useState("")

  const [editingSegment, setEditingSegment] = useState<Segment | null>(null)
  const [editSegmentName, setEditSegmentName] = useState("")
  const [editSegmentDescription, setEditSegmentDescription] = useState("")
  const [newSubsegmentName, setNewSubsegmentName] = useState("")
  const [editingSubsegmentId, setEditingSubsegmentId] = useState<string | null>(null)
  const [editingSubsegmentName, setEditingSubsegmentName] = useState("")
  const [editorSaving, setEditorSaving] = useState(false)
  const [editorError, setEditorError] = useState("")
  const [editorMessage, setEditorMessage] = useState("")

  const [editingInstitution, setEditingInstitution] = useState<InstitutionalCategory | null>(null)
  const [editInstitutionName, setEditInstitutionName] = useState("")
  const [editInstitutionDescription, setEditInstitutionDescription] = useState("")
  const [editInstitutionOrganizationTypeId, setEditInstitutionOrganizationTypeId] = useState("")
  const [newInstitutionSubcategoryName, setNewInstitutionSubcategoryName] = useState("")
  const [editingInstitutionSubcategoryId, setEditingInstitutionSubcategoryId] = useState<string | null>(null)
  const [editingInstitutionSubcategoryName, setEditingInstitutionSubcategoryName] = useState("")
  const [institutionSaving, setInstitutionSaving] = useState(false)
  const [institutionError, setInstitutionError] = useState("")
  const [institutionMessage, setInstitutionMessage] = useState("")

  const reloadCatalog = useCallback(async () => {
    setCatalogLoading(true)
    setCatalogError("")
    try {
      setCatalog(await loadSegmentationsCatalog())
    } catch (cause) {
      setCatalogError(cause instanceof Error ? cause.message : "Não foi possível carregar as categorias institucionais.")
    } finally {
      setCatalogLoading(false)
    }
  }, [])

  useEffect(() => {
    void reloadCatalog()
  }, [reloadCatalog])

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

  const setSpecialParams = (values: string[]) => {
    updateUrl((params) => {
      params.delete("special")
      values.forEach((value) => params.append("special", value))
    })
  }

  const toggleCardChildren = (key: string) => {
    setExpandedCards((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const group = ((): GroupFilter => {
    const raw = searchParams.get("group")
    return raw === "priority" || raw === "secondary" || raw === "institutional" ? raw : "all"
  })()
  const query = searchParams.get("q") || ""
  const sectorType = searchParams.get("sectorType") || ""
  const sectorId = searchParams.get("sector") || ""
  const subsegmentId = searchParams.get("subsegment") || ""
  const organizationTypeId = searchParams.get("orgType") || ""
  const institutionalValue = searchParams.get("institutional") || ""
  const institutionalFilter = parseInstitutionalFilter(institutionalValue)
  const specialCategoryIds = searchParams.getAll("special")
  const scopeId = searchParams.get("scope") || ""
  const governmentSphereId = searchParams.get("government") || ""
  const countryId = searchParams.get("country") || ""
  const stateId = searchParams.get("state") || ""

  const selectedSegment = state.segments.find((item) => item.id === sectorId)
  const selectedSubsegment = state.subsegments.find((item) => item.id === subsegmentId)

  const priorityCount = state.segments.filter((item) => item.type === "priority").length
  const secondaryCount = state.segments.filter((item) => item.type === "secondary").length
  const institutionalCount = catalog?.institutionalCategories.length || 0
  const totalCards = priorityCount + secondaryCount + institutionalCount

  const segmentOptions = useMemo<SelectOption[]>(() => {
    return [...state.segments]
      .filter((segment) => !sectorType || segment.type === sectorType)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR"))
      .map((segment) => ({ value: segment.id, label: segment.name, group: GROUP_LABELS[segment.type] }))
  }, [sectorType, state.segments])

  const subsegmentOptions = useMemo<SelectOption[]>(() => {
    if (!sectorId) return []
    return state.subsegments
      .filter((item) => item.segmentId === sectorId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR"))
      .map((item) => ({ value: item.id, label: item.name }))
  }, [sectorId, state.subsegments])

  const organizationTypeOptions = useMemo<SelectOption[]>(
    () => (catalog?.organizationTypes || []).filter((item) => item.active).map((item) => ({ value: item.id, label: item.name })),
    [catalog],
  )

  const institutionalOptions = useMemo<SelectOption[]>(() => {
    if (!catalog) return []
    const categories = catalog.institutionalCategories.filter((item) => !organizationTypeId || item.organizationTypeId === organizationTypeId)
    const categoryIds = new Set(categories.map((item) => item.id))
    const options: SelectOption[] = categories.map((item) => ({ value: `category:${item.id}`, label: item.name, group: "Categoria" }))
    for (const item of catalog.institutionalSubcategories) {
      if (!categoryIds.has(item.institutionalCategoryId)) continue
      options.push({ value: `subcategory:${item.id}`, label: item.name, group: "Subcategoria" })
    }
    return options
  }, [catalog, organizationTypeId])

  const specialOptions = useMemo<SelectOption[]>(
    () => (catalog?.specialCategories || []).filter((item) => item.active).map((item) => ({ value: item.id, label: item.name })),
    [catalog],
  )
  const scopeOptions = useMemo<SelectOption[]>(
    () => (catalog?.scopes || []).filter((item) => item.active).map((item) => ({ value: item.id, label: item.name })),
    [catalog],
  )
  const governmentOptions = useMemo<SelectOption[]>(
    () => (catalog?.governmentSpheres || []).filter((item) => item.active).map((item) => ({ value: item.id, label: item.name })),
    [catalog],
  )
  const countryOptions = useMemo<SelectOption[]>(
    () => (catalog?.countries || []).filter((item) => item.active).map((item) => ({ value: item.id, label: item.name })),
    [catalog],
  )
  const stateOptions = useMemo<SelectOption[]>(
    () => (catalog?.states || []).filter((item) => item.active && item.countryId === countryId).map((item) => ({ value: item.id, label: item.name })),
    [catalog, countryId],
  )

  const organizationSpecialMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const link of catalog?.organizationSpecialCategories || []) {
      if (!map.has(link.organizationId)) map.set(link.organizationId, new Set())
      map.get(link.organizationId)!.add(link.specialCategoryId)
    }
    return map
  }, [catalog])

  const categoryById = useMemo(() => new Map((catalog?.institutionalCategories || []).map((item) => [item.id, item])), [catalog])
  const institutionalSubcategoryById = useMemo(() => new Map((catalog?.institutionalSubcategories || []).map((item) => [item.id, item])), [catalog])

  const organizationMatchesFilters = (organization: Organization) => {
    let organizationSegment = organization.primarySegmentId ? state.segments.find((item) => item.id === organization.primarySegmentId) : undefined
    if (!organizationSegment && organization.sector) organizationSegment = state.segments.find((item) => item.name === organization.sector)
    if (sectorType && organizationSegment?.type !== sectorType) return false
    if (sectorId && organization.primarySegmentId !== sectorId && organization.sector !== selectedSegment?.name) return false
    if (subsegmentId && organization.primarySubsegmentId !== subsegmentId && organization.subsector !== selectedSubsegment?.name) return false
    if (organizationTypeId && organization.organizationTypeId !== organizationTypeId) return false
    if (institutionalFilter?.kind === "category" && organization.institutionalCategoryId !== institutionalFilter.id) return false
    if (institutionalFilter?.kind === "subcategory" && organization.institutionalSubcategoryId !== institutionalFilter.id) return false
    if (specialCategoryIds.length > 0) {
      const organizationSpecials = organizationSpecialMap.get(organization.id) || new Set<string>()
      if (!specialCategoryIds.every((id) => organizationSpecials.has(id))) return false
    }
    if (scopeId && organization.scopeId !== scopeId) return false
    if (governmentSphereId && organization.governmentSphereId !== governmentSphereId) return false
    if (countryId) {
      const countryName = catalog?.countries.find((item) => item.id === countryId)?.name
      if (organization.countryId !== countryId && normalize(organization.country) !== normalize(countryName)) return false
    }
    if (stateId) {
      const stateItem = catalog?.states.find((item) => item.id === stateId)
      if (organization.stateId !== stateId && normalize(organization.state) !== normalize(stateItem?.name) && normalize(organization.state) !== normalize(stateItem?.code)) return false
    }
    return true
  }

  const matchingOrganizationIds = useMemo(
    () => new Set(state.organizations.filter(organizationMatchesFilters).map((item) => item.id)),
    [state.organizations, state.segments, selectedSegment?.name, selectedSubsegment?.name, sectorType, sectorId, subsegmentId, organizationTypeId, institutionalValue, specialCategoryIds.join("|"), scopeId, governmentSphereId, countryId, stateId, organizationSpecialMap, catalog],
  )

  const directInstitutionalContacts = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const link of catalog?.contactInstitutionalCategories || []) {
      if (!map.has(link.institutionalCategoryId)) map.set(link.institutionalCategoryId, new Set())
      map.get(link.institutionalCategoryId)!.add(link.contactId)
    }
    return map
  }, [catalog])

  const organizationFilterForEconomicActive = Boolean(organizationTypeId || institutionalValue || specialCategoryIds.length || scopeId || governmentSphereId || countryId || stateId)
  const organizationFilterForInstitutionalActive = Boolean(sectorType || sectorId || subsegmentId || organizationTypeId || specialCategoryIds.length || scopeId || governmentSphereId || countryId || stateId)

  const economicRelatedOrganizations = (segment: Segment) => state.organizations.filter((organization) => organization.primarySegmentId === segment.id || organization.sector === segment.name)
  const institutionalRelatedOrganizations = (category: InstitutionalCategory) => state.organizations.filter((organization) => organization.institutionalCategoryId === category.id)

  const economicStats = (segment: Segment) => {
    const allOrganizations = economicRelatedOrganizations(segment)
    const organizations = organizationFilterForEconomicActive ? allOrganizations.filter((item) => matchingOrganizationIds.has(item.id)) : allOrganizations
    const organizationIds = new Set(organizations.map((item) => item.id))
    const directContacts = new Set(state.contactSegmentations.filter((item) => item.segmentId === segment.id).map((item) => item.contactId))
    const contacts = new Set<string>()
    for (const contact of state.contacts) {
      if (organizationFilterForEconomicActive) {
        if (contact.organizationId && organizationIds.has(contact.organizationId)) contacts.add(contact.id)
      } else if (directContacts.has(contact.id) || (contact.organizationId && organizationIds.has(contact.organizationId))) contacts.add(contact.id)
    }
    return { organizations: organizations.length, contacts: contacts.size }
  }

  const institutionalStats = (category: InstitutionalCategory) => {
    const allOrganizations = institutionalRelatedOrganizations(category)
    const organizations = organizationFilterForInstitutionalActive ? allOrganizations.filter((item) => matchingOrganizationIds.has(item.id)) : allOrganizations
    const organizationIds = new Set(organizations.map((item) => item.id))
    const directContacts = directInstitutionalContacts.get(category.id) || new Set<string>()
    const contacts = new Set<string>()
    for (const contact of state.contacts) {
      if (organizationFilterForInstitutionalActive) {
        if (contact.organizationId && organizationIds.has(contact.organizationId)) contacts.add(contact.id)
      } else if (directContacts.has(contact.id) || (contact.organizationId && organizationIds.has(contact.organizationId))) contacts.add(contact.id)
    }
    return { organizations: organizations.length, contacts: contacts.size }
  }

  const cards = useMemo<CardItem[]>(() => {
    const economic: CardItem[] = [...state.segments]
      .sort((a, b) => a.type !== b.type ? (a.type === "priority" ? -1 : 1) : a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR"))
      .map((segment) => ({ kind: "economic" as const, segment }))
    const institutional: CardItem[] = (catalog?.institutionalCategories || [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR"))
      .map((category) => ({ kind: "institutional" as const, category }))
    return [...economic, ...institutional]
  }, [catalog, state.segments])

  const results = useMemo(() => {
    const normalizedQuery = normalize(query)
    return cards.filter((card) => {
      if (card.kind === "economic") {
        const segment = card.segment
        if (group === "priority" && segment.type !== "priority") return false
        if (group === "secondary" && segment.type !== "secondary") return false
        if (group === "institutional") return false
        if (sectorType && segment.type !== sectorType) return false
        if (sectorId && segment.id !== sectorId) return false
        if (subsegmentId && selectedSubsegment?.segmentId !== segment.id) return false
        const children = state.subsegments.filter((item) => item.segmentId === segment.id)
        if (normalizedQuery && ![segment.name, segment.description, ...children.map((item) => item.name)].filter(Boolean).some((value) => normalize(value).includes(normalizedQuery))) return false
        if (organizationFilterForEconomicActive && !economicRelatedOrganizations(segment).some((organization) => matchingOrganizationIds.has(organization.id))) return false
        return true
      }
      const category = card.category
      if (group === "priority" || group === "secondary") return false
      if ((sectorType || sectorId || subsegmentId) && !institutionalRelatedOrganizations(category).some((organization) => matchingOrganizationIds.has(organization.id))) return false
      if (institutionalFilter?.kind === "category" && institutionalFilter.id !== category.id) return false
      if (institutionalFilter?.kind === "subcategory") {
        const selected = institutionalSubcategoryById.get(institutionalFilter.id)
        if (selected?.institutionalCategoryId !== category.id) return false
      }
      const children = (catalog?.institutionalSubcategories || []).filter((item) => item.institutionalCategoryId === category.id)
      if (normalizedQuery && ![category.name, category.description, ...children.map((item) => item.name)].filter(Boolean).some((value) => normalize(value).includes(normalizedQuery))) return false
      if (organizationFilterForInstitutionalActive && !institutionalRelatedOrganizations(category).some((organization) => matchingOrganizationIds.has(organization.id))) return false
      return true
    })
  }, [cards, group, query, sectorType, sectorId, subsegmentId, organizationTypeId, institutionalValue, specialCategoryIds.join("|"), scopeId, governmentSphereId, countryId, stateId, matchingOrganizationIds, state.subsegments, catalog])

  const filterChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; remove: () => void }> = []
    if (sectorType) chips.push({ id: "sectorType", label: `Tipo: ${sectorType === "priority" ? "Prioritário" : "Secundário"}`, remove: () => updateUrl((params) => { params.delete("sectorType"); params.delete("sector"); params.delete("subsegment") }) })
    if (selectedSegment) chips.push({ id: "sector", label: `Setor: ${selectedSegment.name}`, remove: () => updateUrl((params) => { params.delete("sector"); params.delete("subsegment") }) })
    if (selectedSubsegment) chips.push({ id: "subsegment", label: `Subsetor: ${selectedSubsegment.name}`, remove: () => setParam("subsegment", "") })
    const organizationType = catalog?.organizationTypes.find((item) => item.id === organizationTypeId)
    if (organizationType) chips.push({ id: "orgType", label: `Tipo de organização: ${organizationType.name}`, remove: () => updateUrl((params) => { params.delete("orgType"); params.delete("institutional") }) })
    if (institutionalFilter) {
      const label = institutionalFilter.kind === "category" ? categoryById.get(institutionalFilter.id)?.name : institutionalSubcategoryById.get(institutionalFilter.id)?.name
      if (label) chips.push({ id: "institutional", label: `Categoria: ${label}`, remove: () => setParam("institutional", "") })
    }
    for (const id of specialCategoryIds) {
      const item = catalog?.specialCategories.find((category) => category.id === id)
      if (item) chips.push({ id: `special-${id}`, label: `Especial: ${item.name}`, remove: () => setSpecialParams(specialCategoryIds.filter((value) => value !== id)) })
    }
    const scope = catalog?.scopes.find((item) => item.id === scopeId)
    if (scope) chips.push({ id: "scope", label: `Abrangência: ${scope.name}`, remove: () => setParam("scope", "") })
    const government = catalog?.governmentSpheres.find((item) => item.id === governmentSphereId)
    if (government) chips.push({ id: "government", label: `Esfera: ${government.name}`, remove: () => setParam("government", "") })
    const country = catalog?.countries.find((item) => item.id === countryId)
    if (country) chips.push({ id: "country", label: `País: ${country.name}`, remove: () => updateUrl((params) => { params.delete("country"); params.delete("state") }) })
    const stateOption = catalog?.states.find((item) => item.id === stateId)
    if (stateOption) chips.push({ id: "state", label: `Estado: ${stateOption.name}`, remove: () => setParam("state", "") })
    return chips
  }, [sectorType, selectedSegment, selectedSubsegment, organizationTypeId, institutionalValue, specialCategoryIds.join("|"), scopeId, governmentSphereId, countryId, stateId, catalog])

  const clearFilters = () => updateUrl((params) => {
    const currentGroup = params.get("group")
    for (const key of ["q", "sectorType", "sector", "subsegment", "orgType", "institutional", "special", "scope", "government", "country", "state"]) params.delete(key)
    if (currentGroup) params.set("group", currentGroup)
  })

  const closeNewSegmentModal = () => {
    setNewSegmentOpen(false)
    setNewKind(null)
    setSegmentName("")
    setSegmentDescription("")
    setNewInstitutionOrganizationTypeId("")
    clearError()
  }

  const openSegmentEditor = (segment: Segment, focusNewSubsegment = false) => {
    if (!isAdmin) return
    clearError()
    setEditorError("")
    setEditorMessage("")
    setEditingSubsegmentId(null)
    setEditingSubsegmentName("")
    setNewSubsegmentName("")
    setEditingSegment(segment)
    setEditSegmentName(segment.name)
    setEditSegmentDescription(segment.description || "")
    if (focusNewSubsegment) window.setTimeout(() => document.getElementById("new-subsegment-name")?.focus(), 100)
  }

  const closeSegmentEditor = () => {
    if (editorSaving) return
    setEditingSegment(null)
    setEditorError("")
    setEditorMessage("")
    setEditingSubsegmentId(null)
    setEditingSubsegmentName("")
    setNewSubsegmentName("")
    clearError()
  }

  const openInstitutionEditor = (category: InstitutionalCategory, focusNewSubcategory = false) => {
    if (!isAdmin) return
    setEditingInstitution(category)
    setEditInstitutionName(category.name)
    setEditInstitutionDescription(category.description || "")
    setEditInstitutionOrganizationTypeId(category.organizationTypeId || "")
    setNewInstitutionSubcategoryName("")
    setEditingInstitutionSubcategoryId(null)
    setEditingInstitutionSubcategoryName("")
    setInstitutionError("")
    setInstitutionMessage("")
    if (focusNewSubcategory) window.setTimeout(() => document.getElementById("new-institution-subcategory")?.focus(), 100)
  }

  const closeInstitutionEditor = () => {
    if (institutionSaving) return
    setEditingInstitution(null)
    setInstitutionError("")
    setInstitutionMessage("")
  }

  const submitNewSegmentation = async (event: FormEvent) => {
    event.preventDefault()
    if (!newKind || !segmentName.trim()) return
    if (newKind === "institutional") {
      setInstitutionSaving(true)
      setInstitutionError("")
      try {
        const persisted = await createInstitutionalCategory({ id: generateId(), name: segmentName, description: segmentDescription || undefined, organizationTypeId: newInstitutionOrganizationTypeId || undefined, sortOrder: ((catalog?.institutionalCategories.length || 0) + 1) * 10 })
        setCatalog((current) => current ? { ...current, institutionalCategories: [...current.institutionalCategories, persisted] } : current)
        closeNewSegmentModal()
        openInstitutionEditor(persisted, true)
      } catch (cause) {
        setInstitutionError(cause instanceof Error ? cause.message : "Não foi possível criar a categoria institucional.")
      } finally {
        setInstitutionSaving(false)
      }
      return
    }
    const sameType = state.segments.filter((item) => item.type === newKind)
    const nextSort = Math.max(0, ...sameType.map((item) => item.sortOrder)) + 10
    const now = new Date().toISOString()
    const segment: Segment = { id: generateId(), name: segmentName.trim(), description: segmentDescription.trim() || undefined, type: newKind, color: COLORS[newKind], active: true, sortOrder: nextSort, createdAt: now, updatedAt: now }
    const persisted = await createSegment(segment)
    if (persisted) {
      closeNewSegmentModal()
      openSegmentEditor(persisted, true)
    }
  }

  const submitSegmentChanges = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingSegment || !editSegmentName.trim()) return
    setEditorSaving(true)
    setEditorError("")
    setEditorMessage("")
    clearError()
    try {
      const previousName = editingSegment.name
      const persisted = await updateSegment(editingSegment, { name: editSegmentName, description: editSegmentDescription || undefined, color: COLORS[editingSegment.type] })
      dispatch({ type: "SET_SEGMENTS", payload: state.segments.map((item) => item.id === persisted.id ? persisted : item) })
      if (previousName !== persisted.name) {
        dispatch({ type: "SET_ORGANIZATIONS", payload: state.organizations.map((organization) => organization.sector === previousName ? { ...organization, sector: persisted.name } : organization) })
        dispatch({ type: "SET_EVENTS", payload: state.events.map((eventItem) => ({ ...eventItem, sectors: eventItem.sectors?.map((sector) => sector === previousName ? persisted.name : sector) })) })
      }
      setEditingSegment(persisted)
      setEditSegmentName(persisted.name)
      setEditSegmentDescription(persisted.description || "")
      setEditorMessage("Setor atualizado.")
    } catch (cause) {
      setEditorError(cause instanceof Error ? cause.message : "Não foi possível atualizar o setor.")
    } finally {
      setEditorSaving(false)
    }
  }

  const submitNewSubsegment = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingSegment || !newSubsegmentName.trim()) return
    setEditorError("")
    setEditorMessage("")
    clearError()
    const siblingCount = state.subsegments.filter((item) => item.segmentId === editingSegment.id).length
    const now = new Date().toISOString()
    const subsegment: Subsegment = { id: generateId(), segmentId: editingSegment.id, name: newSubsegmentName.trim(), active: true, sortOrder: (siblingCount + 1) * 10, createdAt: now, updatedAt: now }
    const persisted = await createSubsegment(subsegment)
    if (persisted) {
      setNewSubsegmentName("")
      setEditorMessage("Subsetor adicionado.")
    }
  }

  const saveSubsegmentName = async (subsegment: Subsegment) => {
    if (!editingSegment || !editingSubsegmentName.trim()) return
    setEditorSaving(true)
    setEditorError("")
    setEditorMessage("")
    try {
      const previousName = subsegment.name
      const persisted = await updateSubsegment(subsegment.id, editingSubsegmentName)
      dispatch({ type: "SET_SUBSEGMENTS", payload: state.subsegments.map((item) => item.id === persisted.id ? persisted : item) })
      if (previousName !== persisted.name) dispatch({ type: "SET_ORGANIZATIONS", payload: state.organizations.map((organization) => organization.sector === editingSegment.name && organization.subsector === previousName ? { ...organization, subsector: persisted.name } : organization) })
      setEditingSubsegmentId(null)
      setEditingSubsegmentName("")
      setEditorMessage("Subsetor atualizado.")
    } catch (cause) {
      setEditorError(cause instanceof Error ? cause.message : "Não foi possível atualizar o subsetor.")
    } finally {
      setEditorSaving(false)
    }
  }

  const removeSubsegment = async (subsegment: Subsegment) => {
    if (!editingSegment) return
    const links = state.contactSegmentations.filter((item) => item.subsegmentId === subsegment.id).length
    if (links > 0) {
      setEditorError(`Este subsetor possui ${links} contato(s) associado(s). Reassocie os contatos antes de removê-lo.`)
      return
    }
    if (!window.confirm(`Remover o subsetor “${subsegment.name}”?`)) return
    setEditorSaving(true)
    setEditorError("")
    setEditorMessage("")
    try {
      await deleteSubsegment(subsegment.id)
      dispatch({ type: "SET_SUBSEGMENTS", payload: state.subsegments.filter((item) => item.id !== subsegment.id) })
      dispatch({ type: "SET_ORGANIZATIONS", payload: state.organizations.map((organization) => organization.sector === editingSegment.name && organization.subsector === subsegment.name ? { ...organization, subsector: undefined, primarySubsegmentId: undefined } : organization) })
      setEditorMessage("Subsetor removido.")
    } catch (cause) {
      setEditorError(cause instanceof Error ? cause.message : "Não foi possível remover o subsetor.")
    } finally {
      setEditorSaving(false)
    }
  }

  const removeCurrentSegment = async () => {
    if (!editingSegment) return
    const links = state.contactSegmentations.filter((item) => item.segmentId === editingSegment.id).length
    if (links > 0) {
      setEditorError(`Este setor possui ${links} contato(s) associado(s). Reassocie os contatos antes de removê-lo.`)
      return
    }
    const childCount = state.subsegments.filter((item) => item.segmentId === editingSegment.id).length
    if (!window.confirm(childCount ? `Remover o setor “${editingSegment.name}” e seus ${childCount} subsetores?` : `Remover o setor “${editingSegment.name}”?`)) return
    setEditorSaving(true)
    setEditorError("")
    try {
      const removedName = editingSegment.name
      const removedId = editingSegment.id
      await deleteSegment(removedId)
      dispatch({ type: "SET_SEGMENTS", payload: state.segments.filter((item) => item.id !== removedId) })
      dispatch({ type: "SET_SUBSEGMENTS", payload: state.subsegments.filter((item) => item.segmentId !== removedId) })
      dispatch({ type: "SET_ORGANIZATIONS", payload: state.organizations.map((organization) => organization.sector === removedName || organization.primarySegmentId === removedId ? { ...organization, sector: undefined, subsector: undefined, primarySegmentId: undefined, primarySubsegmentId: undefined } : organization) })
      dispatch({ type: "SET_EVENTS", payload: state.events.map((eventItem) => ({ ...eventItem, sectors: eventItem.sectors?.filter((sector) => sector !== removedName) })) })
      setEditingSegment(null)
    } catch (cause) {
      setEditorError(cause instanceof Error ? cause.message : "Não foi possível remover o setor.")
    } finally {
      setEditorSaving(false)
    }
  }

  const submitInstitutionChanges = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingInstitution || !editInstitutionName.trim() || !catalog) return
    setInstitutionSaving(true)
    setInstitutionError("")
    setInstitutionMessage("")
    try {
      const persisted = await updateInstitutionalCategory(editingInstitution.id, { name: editInstitutionName, description: editInstitutionDescription || undefined, organizationTypeId: editInstitutionOrganizationTypeId || undefined })
      setCatalog({ ...catalog, institutionalCategories: catalog.institutionalCategories.map((item) => item.id === persisted.id ? persisted : item) })
      setEditingInstitution(persisted)
      setInstitutionMessage("Categoria institucional atualizada.")
    } catch (cause) {
      setInstitutionError(cause instanceof Error ? cause.message : "Não foi possível atualizar a categoria.")
    } finally {
      setInstitutionSaving(false)
    }
  }

  const submitInstitutionSubcategory = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingInstitution || !newInstitutionSubcategoryName.trim() || !catalog) return
    setInstitutionSaving(true)
    setInstitutionError("")
    try {
      const siblings = catalog.institutionalSubcategories.filter((item) => item.institutionalCategoryId === editingInstitution.id)
      const persisted = await createInstitutionalSubcategory({ id: generateId(), institutionalCategoryId: editingInstitution.id, name: newInstitutionSubcategoryName, sortOrder: (siblings.length + 1) * 10 })
      setCatalog({ ...catalog, institutionalSubcategories: [...catalog.institutionalSubcategories, persisted] })
      setNewInstitutionSubcategoryName("")
      setInstitutionMessage("Subcategoria adicionada.")
    } catch (cause) {
      setInstitutionError(cause instanceof Error ? cause.message : "Não foi possível adicionar a subcategoria.")
    } finally {
      setInstitutionSaving(false)
    }
  }

  const saveInstitutionSubcategoryName = async (subcategory: InstitutionalSubcategory) => {
    if (!editingInstitutionSubcategoryName.trim() || !catalog) return
    setInstitutionSaving(true)
    setInstitutionError("")
    try {
      const persisted = await updateInstitutionalSubcategory(subcategory.id, editingInstitutionSubcategoryName)
      setCatalog({ ...catalog, institutionalSubcategories: catalog.institutionalSubcategories.map((item) => item.id === persisted.id ? persisted : item) })
      setEditingInstitutionSubcategoryId(null)
      setEditingInstitutionSubcategoryName("")
      setInstitutionMessage("Subcategoria atualizada.")
    } catch (cause) {
      setInstitutionError(cause instanceof Error ? cause.message : "Não foi possível atualizar a subcategoria.")
    } finally {
      setInstitutionSaving(false)
    }
  }

  const removeInstitutionSubcategory = async (subcategory: InstitutionalSubcategory) => {
    if (!catalog) return
    const organizationLinks = state.organizations.filter((item) => item.institutionalSubcategoryId === subcategory.id).length
    const contactLinks = (catalog.contactInstitutionalCategories || []).filter((item) => item.institutionalSubcategoryId === subcategory.id).length
    if (organizationLinks + contactLinks > 0) {
      setInstitutionError("Esta subcategoria possui organizações ou contatos associados. Reassocie-os antes de remover.")
      return
    }
    if (!window.confirm(`Remover a subcategoria “${subcategory.name}”?`)) return
    setInstitutionSaving(true)
    try {
      await deleteInstitutionalSubcategory(subcategory.id)
      setCatalog({ ...catalog, institutionalSubcategories: catalog.institutionalSubcategories.filter((item) => item.id !== subcategory.id) })
      setInstitutionMessage("Subcategoria removida.")
    } catch (cause) {
      setInstitutionError(cause instanceof Error ? cause.message : "Não foi possível remover a subcategoria.")
    } finally {
      setInstitutionSaving(false)
    }
  }

  const removeCurrentInstitution = async () => {
    if (!editingInstitution || !catalog) return
    const stats = institutionalStats(editingInstitution)
    if (stats.organizations + stats.contacts > 0) {
      setInstitutionError("Esta categoria possui organizações ou contatos associados. Reassocie-os antes de remover.")
      return
    }
    const childCount = catalog.institutionalSubcategories.filter((item) => item.institutionalCategoryId === editingInstitution.id).length
    if (!window.confirm(childCount ? `Remover “${editingInstitution.name}” e suas ${childCount} subcategorias?` : `Remover “${editingInstitution.name}”?`)) return
    setInstitutionSaving(true)
    try {
      await deleteInstitutionalCategory(editingInstitution.id)
      setCatalog({ ...catalog, institutionalCategories: catalog.institutionalCategories.filter((item) => item.id !== editingInstitution.id), institutionalSubcategories: catalog.institutionalSubcategories.filter((item) => item.institutionalCategoryId !== editingInstitution.id) })
      setEditingInstitution(null)
    } catch (cause) {
      setInstitutionError(cause instanceof Error ? cause.message : "Não foi possível remover a categoria.")
    } finally {
      setInstitutionSaving(false)
    }
  }

  const editorChildren = editingSegment ? [...state.subsegments].filter((item) => item.segmentId === editingSegment.id).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR")) : []
  const institutionEditorChildren = editingInstitution ? [...(catalog?.institutionalSubcategories || [])].filter((item) => item.institutionalCategoryId === editingInstitution.id).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR")) : []

  const groupTabs: Array<{ id: GroupFilter; label: string; count: number }> = [
    { id: "all", label: "Todos", count: totalCards },
    { id: "priority", label: "Setores prioritários", count: priorityCount },
    { id: "secondary", label: "Setores secundários", count: secondaryCount },
    { id: "institutional", label: "Categorias institucionais", count: institutionalCount },
  ]

  const renderChildChips = (
    cardKey: string,
    children: Array<{ id: string; name: string }>,
    onSelect: (id: string) => void,
    itemLabel: string,
  ) => {
    if (children.length === 0) return <p className="text-xs text-carbon-60 py-1">Nenhum {itemLabel} cadastrado.</p>
    const expanded = expandedCards.has(cardKey)
    const buttons = children.map((item) => (
      <button
        key={item.id}
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onSelect(item.id)
        }}
        className="px-2.5 py-1.5 rounded-lg bg-white/80 border border-carbon-20/50 text-xs font-medium text-carbon hover:ring-1 hover:ring-carbon-20 whitespace-nowrap flex-shrink-0"
        title={`Filtrar por este ${itemLabel}`}
      >
        {item.name}
      </button>
    ))
    return (
      <div className="flex items-start gap-2 min-w-0">
        {expanded ? (
          <div className="flex flex-wrap gap-2 flex-1 min-w-0">{buttons}</div>
        ) : (
          <div className="flex flex-nowrap gap-2 flex-1 min-w-0 overflow-hidden">{buttons}</div>
        )}
        {children.length > 1 && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              toggleCardChildren(cardKey)
            }}
            className="w-8 h-8 rounded-lg border border-carbon-20 bg-white text-carbon font-bold flex-shrink-0 hover:bg-carbon-20 transition-fast"
            aria-expanded={expanded}
            aria-label={expanded ? `Recolher ${itemLabel}s` : `Exibir todos os ${itemLabel}s`}
          >
            {expanded ? "−" : "+"}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="flex-shrink-0 px-4 sm:px-6 py-5 bg-white border-b border-carbon-20 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-carbon">Segmentações</h1>
          <p className="text-xs text-carbon-60 mt-0.5">{state.segments.length} setores econômicos, {state.subsegments.length} subsetores e {institutionalCount} categorias institucionais</p>
        </div>
        {isAdmin && <button onClick={() => setNewSegmentOpen(true)} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-green hover:opacity-90 active:scale-95 transition-fast whitespace-nowrap">+ Nova segmentação</button>}
      </header>

      <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-carbon-20 bg-white/60 space-y-4">
        <div className="flex gap-2 items-center">
          <input type="search" value={query} onChange={(event) => setParam("q", event.target.value)} placeholder="Buscar setor, subsetor, categoria ou subcategoria…" aria-label="Buscar segmentações" className="flex-1 min-w-0 max-w-2xl px-4 py-2.5 rounded-xl border border-carbon-20 bg-white text-sm text-carbon focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20 transition-fast" />
          <button type="button" onClick={() => setFiltersOpen((current) => !current)} aria-expanded={filtersOpen} className="px-3.5 py-2.5 rounded-xl border border-carbon-20 bg-white text-xs font-bold text-carbon hover:bg-neutral">Filtros{filterChips.length ? ` (${filterChips.length})` : ""}</button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Grupos de segmentação">
          {groupTabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={group === tab.id} onClick={() => setParam("group", tab.id === "all" ? "" : tab.id)} className={`flex-shrink-0 rounded-xl border px-3.5 py-2 text-xs font-bold transition-fast ${group === tab.id ? "border-carbon bg-carbon text-white" : "border-carbon-20 bg-white text-carbon hover:bg-neutral"}`}>{tab.label} <span className="ml-1 opacity-70">{tab.count}</span></button>)}
        </div>

        <section aria-label="Filtros de segmentação" className={`${filtersOpen ? "block" : "hidden"} rounded-2xl border border-carbon-20 bg-white p-4`}>
          <div className="flex items-center justify-between gap-3 mb-3"><div><h2 className="text-sm font-bold text-carbon">Filtros</h2><p className="text-[11px] text-carbon-60 mt-0.5">Os filtros são salvos na URL e podem ser compartilhados.</p></div>{filterChips.length > 0 && <button type="button" onClick={clearFilters} className="text-xs font-bold text-magenta hover:underline">Limpar filtros</button>}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            <SearchableSelect id="filter-sector-type" label="Tipo de setor" value={sectorType} options={[{ value: "priority", label: "Prioritário" }, { value: "secondary", label: "Secundário" }]} onChange={(value) => updateUrl((params) => { if (value) params.set("sectorType", value); else params.delete("sectorType"); const selected = state.segments.find((item) => item.id === params.get("sector")); if (selected && value && selected.type !== value) { params.delete("sector"); params.delete("subsegment") } })} />
            <SearchableSelect id="filter-sector" label="Setor econômico" value={sectorId} options={segmentOptions} onChange={(value) => updateUrl((params) => { if (value) params.set("sector", value); else params.delete("sector"); params.delete("subsegment") })} />
            <SearchableSelect id="filter-subsector" label="Subsetor" value={subsegmentId} options={subsegmentOptions} disabled={!sectorId} placeholder={sectorId ? "Selecionar" : "Selecione um setor"} onChange={(value) => setParam("subsegment", value)} />
            <SearchableSelect id="filter-org-type" label="Tipo de organização" value={organizationTypeId} options={organizationTypeOptions} onChange={(value) => updateUrl((params) => { if (value) params.set("orgType", value); else params.delete("orgType"); params.delete("institutional") })} />
            <SearchableSelect id="filter-institutional" label="Categoria institucional" value={institutionalValue} options={institutionalOptions} onChange={(value) => setParam("institutional", value)} />
            <MultiSearchableSelect id="filter-special" label="Categorias especiais" values={specialCategoryIds} options={specialOptions} onChange={setSpecialParams} />
            <SearchableSelect id="filter-scope" label="Abrangência" value={scopeId} options={scopeOptions} onChange={(value) => setParam("scope", value)} />
            <SearchableSelect id="filter-government" label="Esfera governamental" value={governmentSphereId} options={governmentOptions} onChange={(value) => setParam("government", value)} />
            <SearchableSelect id="filter-country" label="País" value={countryId} options={countryOptions} onChange={(value) => updateUrl((params) => { if (value) params.set("country", value); else params.delete("country"); params.delete("state") })} />
            <SearchableSelect id="filter-state" label="Estado" value={stateId} options={stateOptions} disabled={!countryId} placeholder={countryId ? "Selecionar" : "Selecione um país"} onChange={(value) => setParam("state", value)} />
          </div>
        </section>

        {filterChips.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Filtros ativos">{filterChips.map((chip) => <button key={chip.id} type="button" onClick={chip.remove} className="inline-flex items-center gap-1.5 rounded-full bg-neutral px-3 py-1.5 text-[11px] font-semibold text-carbon hover:bg-carbon-20" aria-label={`Remover filtro ${chip.label}`}>{chip.label} <span aria-hidden>×</span></button>)}</div>}
        <div className="text-[11px] font-semibold text-carbon-60">{results.length} resultado{results.length === 1 ? "" : "s"}</div>
      </div>

      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
        {catalogLoading ? (
          <div className="max-w-6xl mx-auto rounded-2xl border border-carbon-20 bg-white p-8 text-center text-sm text-carbon-60">Carregando segmentações…</div>
        ) : catalogError ? (
          <div className="max-w-6xl mx-auto rounded-2xl border border-magenta/20 bg-light-magenta p-6"><p className="text-sm font-bold text-magenta">Não foi possível carregar o catálogo institucional.</p><p className="text-xs text-carbon-60 mt-1">{catalogError}</p><button type="button" onClick={() => void reloadCatalog()} className="mt-3 text-xs font-bold text-magenta underline">Tentar novamente</button></div>
        ) : results.length === 0 ? (
          <div className="max-w-6xl mx-auto rounded-2xl border border-carbon-20 bg-white p-10 text-center"><div className="text-2xl mb-2">⌕</div><h2 className="text-sm font-bold text-carbon">Nenhum resultado encontrado</h2><p className="text-xs text-carbon-60 mt-1">Ajuste a pesquisa ou remova alguns filtros.</p>{filterChips.length > 0 && <button type="button" onClick={clearFilters} className="mt-4 text-xs font-bold text-green underline">Limpar filtros</button>}</div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-6xl mx-auto">
            {results.map((card) => {
              if (card.kind === "economic") {
                const segment = card.segment
                const cardKey = `segment-${segment.id}`
                const children = state.subsegments.filter((item) => item.segmentId === segment.id).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR"))
                const stats = economicStats(segment)
                const color = COLORS[segment.type]
                return (
                  <article key={cardKey} className={`bg-white rounded-2xl border border-carbon-20 overflow-hidden transition-fast hover:bg-neutral/70 ${isAdmin ? "cursor-pointer hover:shadow-md" : ""}`} onClick={() => openSegmentEditor(segment)} onKeyDown={(event) => { if (isAdmin && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); openSegmentEditor(segment) } }} role={isAdmin ? "button" : undefined} tabIndex={isAdmin ? 0 : undefined} aria-label={isAdmin ? `Editar setor ${segment.name}` : undefined}>
                    <div className="h-1" style={{ backgroundColor: color }} />
                    <div className="p-5">
                      <div className="flex items-start gap-3"><span className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0" style={{ backgroundColor: color }}>⊕</span><div className="flex-1 min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-carbon">{segment.name}</h2><span className="px-2 py-1 rounded-full text-[10px] font-bold" style={{ color, backgroundColor: `${color}15` }}>{GROUP_LABELS[segment.type]}</span></div>{segment.description && <p className="text-xs text-carbon-60 mt-1 leading-relaxed">{segment.description}</p>}</div></div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-carbon-60 mt-4 pt-4 border-t border-carbon-20/60"><span><strong className="text-carbon">{children.length}</strong> subsetores</span><span><strong className="text-carbon">{stats.organizations}</strong> organizações</span><span><strong className="text-carbon">{stats.contacts}</strong> contatos</span></div>
                      <div className="mt-3"><p className="text-[11px] font-bold uppercase tracking-widest text-carbon-60 mb-2">Subsetores</p>{renderChildChips(cardKey, children, (id) => updateUrl((params) => { params.set("sectorType", segment.type); params.set("sector", segment.id); params.set("subsegment", id) }), "subsetor")}</div>
                    </div>
                  </article>
                )
              }

              const category = card.category
              const cardKey = `institution-${category.id}`
              const children = (catalog?.institutionalSubcategories || []).filter((item) => item.institutionalCategoryId === category.id).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR"))
              const stats = institutionalStats(category)
              const color = COLORS.institutional
              return (
                <article key={cardKey} className={`bg-white rounded-2xl border border-carbon-20 overflow-hidden transition-fast hover:bg-neutral/70 ${isAdmin ? "cursor-pointer hover:shadow-md" : ""}`} onClick={() => openInstitutionEditor(category)} onKeyDown={(event) => { if (isAdmin && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); openInstitutionEditor(category) } }} role={isAdmin ? "button" : undefined} tabIndex={isAdmin ? 0 : undefined} aria-label={isAdmin ? `Editar categoria institucional ${category.name}` : undefined}>
                  <div className="h-1" style={{ backgroundColor: color }} />
                  <div className="p-5">
                    <div className="flex items-start gap-3"><span className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0" style={{ backgroundColor: color }}>⊕</span><div className="flex-1 min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-carbon">{category.name}</h2><span className="px-2 py-1 rounded-full text-[10px] font-bold" style={{ color, backgroundColor: `${color}15` }}>Institucional</span></div>{category.description && <p className="text-xs text-carbon-60 mt-1 leading-relaxed">{category.description}</p>}</div></div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-carbon-60 mt-4 pt-4 border-t border-carbon-20/60"><span><strong className="text-carbon">{children.length}</strong> subcategorias</span><span><strong className="text-carbon">{stats.organizations}</strong> organizações</span><span><strong className="text-carbon">{stats.contacts}</strong> contatos</span></div>
                    <div className="mt-3"><p className="text-[11px] font-bold uppercase tracking-widest text-carbon-60 mb-2">Subcategorias</p>{renderChildChips(cardKey, children, (id) => setParam("institutional", `subcategory:${id}`), "subcategoria")}</div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>

      <Modal open={newSegmentOpen} onClose={closeNewSegmentModal} title="Nova segmentação" maxWidth="lg" footer={newKind ? <><button onClick={closeNewSegmentModal} className="px-4 py-2 rounded-xl border border-carbon-20 text-sm font-bold">Cancelar</button><button form="new-segmentation-form" disabled={createSaving || institutionSaving || !segmentName.trim()} className="px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-50" style={{ backgroundColor: COLORS[newKind] }}>{createSaving || institutionSaving ? "Salvando…" : "Salvar"}</button></> : <button onClick={closeNewSegmentModal} className="px-4 py-2 rounded-xl border border-carbon-20 text-sm font-bold">Fechar</button>}>
        {!newKind ? (
          <div className="grid gap-3">{([ ["priority", "Novo setor prioritário", "Setor econômico estratégico da Invest RS."], ["secondary", "Novo setor secundário", "Setor econômico complementar."], ["institutional", "Nova categoria institucional", "Classificação institucional ou público especial."] ] as const).map(([kind, title, description]) => <button key={kind} type="button" onClick={() => setNewKind(kind)} className="flex items-center gap-3 rounded-2xl border border-carbon-20 p-4 text-left hover:shadow-sm"><span className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-bold" style={{ backgroundColor: COLORS[kind] }}>+</span><span><strong className="block text-sm text-carbon">{title}</strong><span className="block text-xs text-carbon-60 mt-0.5">{description}</span></span></button>)}</div>
        ) : (
          <form id="new-segmentation-form" onSubmit={submitNewSegmentation} className="space-y-4">
            {(createError || institutionError) && <p className="px-3 py-2 rounded-lg bg-light-magenta text-magenta text-xs font-medium">{createError || institutionError}</p>}
            <div className="flex items-center gap-2"><span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ color: COLORS[newKind], backgroundColor: `${COLORS[newKind]}15` }}>{GROUP_LABELS[newKind]}</span><button type="button" onClick={() => setNewKind(null)} className="text-xs font-semibold text-carbon-60 underline">Trocar tipo</button></div>
            <Field label={newKind === "institutional" ? "Nome da categoria" : "Nome do setor"}><input autoFocus className={inputClass} value={segmentName} onChange={(event) => setSegmentName(event.target.value)} /></Field>
            <Field label="Descrição opcional"><textarea className={`${inputClass} min-h-24 resize-y`} value={segmentDescription} onChange={(event) => setSegmentDescription(event.target.value)} /></Field>
            {newKind === "institutional" && <SearchableSelect id="new-institution-org-type" label="Tipo de organização relacionado" value={newInstitutionOrganizationTypeId} options={organizationTypeOptions} onChange={setNewInstitutionOrganizationTypeId} placeholder="Opcional" />}
          </form>
        )}
      </Modal>

      <Modal open={Boolean(editingSegment)} onClose={closeSegmentEditor} title={editingSegment ? `Editar · ${editingSegment.name}` : "Editar setor"} maxWidth="xl" footer={editingSegment ? <><button type="button" onClick={() => void removeCurrentSegment()} disabled={editorSaving} className="mr-auto px-4 py-2 rounded-xl text-sm font-bold text-magenta hover:bg-light-magenta disabled:opacity-50">Excluir setor</button><button type="button" onClick={closeSegmentEditor} disabled={editorSaving} className="px-4 py-2 rounded-xl border border-carbon-20 text-sm font-bold disabled:opacity-50">Fechar</button><button form="edit-segment-form" disabled={editorSaving || !editSegmentName.trim()} className="px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-50" style={{ backgroundColor: editingSegment ? COLORS[editingSegment.type] : COLORS.priority }}>{editorSaving ? "Salvando…" : "Salvar setor"}</button></> : null}>
        {editingSegment && (
          <div className="space-y-6">
            {(editorError || createError) && <p className="px-3 py-2 rounded-lg bg-light-magenta text-magenta text-xs font-medium">{editorError || createError}</p>}
            {editorMessage && <p className="px-3 py-2 rounded-lg bg-light-green text-green text-xs font-semibold">{editorMessage}</p>}
            <form id="edit-segment-form" onSubmit={submitSegmentChanges} className="space-y-4"><div className="flex items-center gap-2"><span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ color: COLORS[editingSegment.type], backgroundColor: `${COLORS[editingSegment.type]}15` }}>{GROUP_LABELS[editingSegment.type]}</span><span className="text-[11px] text-carbon-60">A cor é definida pelo grupo.</span></div><Field label="Nome do setor"><input className={inputClass} value={editSegmentName} onChange={(event) => setEditSegmentName(event.target.value)} /></Field><Field label="Descrição"><textarea className={`${inputClass} min-h-20 resize-y`} value={editSegmentDescription} onChange={(event) => setEditSegmentDescription(event.target.value)} /></Field></form>
            <section className="pt-5 border-t border-carbon-20">
              <div className="mb-3"><h3 className="text-sm font-bold text-carbon">Subsetores</h3><p className="text-xs text-carbon-60 mt-0.5">{editorChildren.length} nomes cadastrados</p></div>
              <form onSubmit={submitNewSubsegment} className="flex gap-2 mb-4"><input id="new-subsegment-name" className={inputClass} value={newSubsegmentName} onChange={(event) => setNewSubsegmentName(event.target.value)} placeholder="Adicionar novo subsetor" /><button type="submit" disabled={createSaving || !newSubsegmentName.trim()} className="flex-shrink-0 px-4 py-2 rounded-xl text-white text-xs font-bold disabled:opacity-50" style={{ backgroundColor: COLORS[editingSegment.type] }}>{createSaving ? "Adicionando…" : "+ Adicionar"}</button></form>
              <div className="space-y-2">{editorChildren.map((subsegment, index) => <div key={subsegment.id} className="flex items-center gap-2 rounded-xl border border-carbon-20 px-3 py-2.5"><span className="w-6 flex-shrink-0 text-[11px] font-bold text-carbon-40 text-right">{index + 1}.</span>{editingSubsegmentId === subsegment.id ? <><input autoFocus className={`${inputClass} py-2`} value={editingSubsegmentName} onChange={(event) => setEditingSubsegmentName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void saveSubsegmentName(subsegment) } if (event.key === "Escape") { setEditingSubsegmentId(null); setEditingSubsegmentName("") } }} /><button type="button" onClick={() => void saveSubsegmentName(subsegment)} disabled={editorSaving || !editingSubsegmentName.trim()} className="px-3 py-2 rounded-lg text-white text-xs font-bold disabled:opacity-50" style={{ backgroundColor: COLORS[editingSegment.type] }}>Salvar</button><button type="button" onClick={() => { setEditingSubsegmentId(null); setEditingSubsegmentName("") }} className="px-2 py-2 text-xs font-semibold text-carbon-60">Cancelar</button></> : <><span className="flex-1 min-w-0 text-sm font-medium text-carbon">{subsegment.name}</span><button type="button" onClick={() => { setEditingSubsegmentId(subsegment.id); setEditingSubsegmentName(subsegment.name) }} disabled={editorSaving} className="px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-neutral" style={{ color: COLORS[editingSegment.type] }}>Editar</button><button type="button" onClick={() => void removeSubsegment(subsegment)} disabled={editorSaving} className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-magenta hover:bg-light-magenta">Remover</button></>}</div>)}</div>
            </section>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(editingInstitution)} onClose={closeInstitutionEditor} title={editingInstitution ? `Editar · ${editingInstitution.name}` : "Editar categoria institucional"} maxWidth="xl" footer={editingInstitution ? <><button type="button" onClick={() => void removeCurrentInstitution()} disabled={institutionSaving} className="mr-auto px-4 py-2 rounded-xl text-sm font-bold text-magenta hover:bg-light-magenta disabled:opacity-50">Excluir categoria</button><button type="button" onClick={closeInstitutionEditor} disabled={institutionSaving} className="px-4 py-2 rounded-xl border border-carbon-20 text-sm font-bold disabled:opacity-50">Fechar</button><button form="edit-institution-form" disabled={institutionSaving || !editInstitutionName.trim()} className="px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-50" style={{ backgroundColor: COLORS.institutional }}>{institutionSaving ? "Salvando…" : "Salvar categoria"}</button></> : null}>
        {editingInstitution && (
          <div className="space-y-6">
            {institutionError && <p className="px-3 py-2 rounded-lg bg-light-magenta text-magenta text-xs font-medium">{institutionError}</p>}
            {institutionMessage && <p className="px-3 py-2 rounded-lg bg-light-green text-green text-xs font-semibold">{institutionMessage}</p>}
            <form id="edit-institution-form" onSubmit={submitInstitutionChanges} className="space-y-4"><span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold" style={{ color: COLORS.institutional, backgroundColor: `${COLORS.institutional}15` }}>Institucional</span><Field label="Nome da categoria"><input className={inputClass} value={editInstitutionName} onChange={(event) => setEditInstitutionName(event.target.value)} /></Field><Field label="Descrição"><textarea className={`${inputClass} min-h-20 resize-y`} value={editInstitutionDescription} onChange={(event) => setEditInstitutionDescription(event.target.value)} /></Field><SearchableSelect id="edit-institution-org-type" label="Tipo de organização relacionado" value={editInstitutionOrganizationTypeId} options={organizationTypeOptions} onChange={setEditInstitutionOrganizationTypeId} placeholder="Opcional" /></form>
            <section className="pt-5 border-t border-carbon-20">
              <div className="mb-3"><h3 className="text-sm font-bold text-carbon">Subcategorias institucionais</h3><p className="text-xs text-carbon-60 mt-0.5">{institutionEditorChildren.length} nomes cadastrados</p></div>
              <form onSubmit={submitInstitutionSubcategory} className="flex gap-2 mb-4"><input id="new-institution-subcategory" className={inputClass} value={newInstitutionSubcategoryName} onChange={(event) => setNewInstitutionSubcategoryName(event.target.value)} placeholder="Adicionar nova subcategoria" /><button type="submit" disabled={institutionSaving || !newInstitutionSubcategoryName.trim()} className="flex-shrink-0 px-4 py-2 rounded-xl text-white text-xs font-bold disabled:opacity-50" style={{ backgroundColor: COLORS.institutional }}>{institutionSaving ? "Adicionando…" : "+ Adicionar"}</button></form>
              <div className="space-y-2">{institutionEditorChildren.map((subcategory, index) => <div key={subcategory.id} className="flex items-center gap-2 rounded-xl border border-carbon-20 px-3 py-2.5"><span className="w-6 flex-shrink-0 text-[11px] font-bold text-carbon-40 text-right">{index + 1}.</span>{editingInstitutionSubcategoryId === subcategory.id ? <><input autoFocus className={`${inputClass} py-2`} value={editingInstitutionSubcategoryName} onChange={(event) => setEditingInstitutionSubcategoryName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void saveInstitutionSubcategoryName(subcategory) } if (event.key === "Escape") { setEditingInstitutionSubcategoryId(null); setEditingInstitutionSubcategoryName("") } }} /><button type="button" onClick={() => void saveInstitutionSubcategoryName(subcategory)} disabled={institutionSaving || !editingInstitutionSubcategoryName.trim()} className="px-3 py-2 rounded-lg text-white text-xs font-bold disabled:opacity-50" style={{ backgroundColor: COLORS.institutional }}>Salvar</button><button type="button" onClick={() => { setEditingInstitutionSubcategoryId(null); setEditingInstitutionSubcategoryName("") }} className="px-2 py-2 text-xs font-semibold text-carbon-60">Cancelar</button></> : <><span className="flex-1 min-w-0 text-sm font-medium text-carbon">{subcategory.name}</span><button type="button" onClick={() => { setEditingInstitutionSubcategoryId(subcategory.id); setEditingInstitutionSubcategoryName(subcategory.name) }} disabled={institutionSaving} className="px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-light-magenta" style={{ color: COLORS.institutional }}>Editar</button><button type="button" onClick={() => void removeInstitutionSubcategory(subcategory)} disabled={institutionSaving} className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-magenta hover:bg-light-magenta">Remover</button></>}</div>)}</div>
            </section>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-xs font-semibold text-carbon-60 mb-1.5">{label}</span>{children}</label>
}
