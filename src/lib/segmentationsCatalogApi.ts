import { supabase } from "@/lib/supabase"

export interface CatalogItem {
  id: string
  name: string
  active: boolean
  sortOrder: number
}

export interface OrganizationType extends CatalogItem {}
export interface SpecialCategory extends CatalogItem {}
export interface ScopeOption extends CatalogItem {}
export interface GovernmentSphere extends CatalogItem {}

export interface CountryOption extends CatalogItem {
  iso2?: string
}

export interface StateOption extends CatalogItem {
  countryId: string
  code: string
}

export interface InstitutionalCategory extends CatalogItem {
  description?: string
  organizationTypeId?: string
  color: string
  createdAt: string
  updatedAt: string
}

export interface InstitutionalSubcategory extends CatalogItem {
  institutionalCategoryId: string
  createdAt: string
  updatedAt: string
}

export interface OrganizationSpecialCategoryLink {
  organizationId: string
  specialCategoryId: string
}

export interface ContactInstitutionalCategoryLink {
  contactId: string
  institutionalCategoryId: string
  institutionalSubcategoryId?: string
}

export interface ContactSpecialCategoryLink {
  contactId: string
  specialCategoryId: string
}

export interface SegmentationsCatalog {
  institutionalCategories: InstitutionalCategory[]
  institutionalSubcategories: InstitutionalSubcategory[]
  organizationTypes: OrganizationType[]
  specialCategories: SpecialCategory[]
  scopes: ScopeOption[]
  governmentSpheres: GovernmentSphere[]
  countries: CountryOption[]
  states: StateOption[]
  organizationSpecialCategories: OrganizationSpecialCategoryLink[]
  contactInstitutionalCategories: ContactInstitutionalCategoryLink[]
  contactSpecialCategories: ContactSpecialCategoryLink[]
}

type DbRow = Record<string, any>

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

function mapBasic(row: DbRow): CatalogItem {
  return {
    id: row.id,
    name: row.name,
    active: row.active,
    sortOrder: row.sort_order,
  }
}

function mapInstitutionalCategory(row: DbRow): InstitutionalCategory {
  return {
    ...mapBasic(row),
    description: row.description || undefined,
    organizationTypeId: row.organization_type_id || undefined,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapInstitutionalSubcategory(row: DbRow): InstitutionalSubcategory {
  return {
    ...mapBasic(row),
    institutionalCategoryId: row.institutional_category_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function loadSegmentationsCatalog(): Promise<SegmentationsCatalog> {
  const [
    institutionalCategoriesResult,
    institutionalSubcategoriesResult,
    organizationTypesResult,
    specialCategoriesResult,
    scopesResult,
    governmentSpheresResult,
    countriesResult,
    statesResult,
    organizationSpecialCategoriesResult,
    contactInstitutionalCategoriesResult,
    contactSpecialCategoriesResult,
  ] = await Promise.all([
    supabase.from("institutional_categories").select("*").order("sort_order").order("name"),
    supabase.from("institutional_subcategories").select("*").order("sort_order").order("name"),
    supabase.from("organization_types").select("*").order("sort_order").order("name"),
    supabase.from("special_categories").select("*").order("sort_order").order("name"),
    supabase.from("scopes").select("*").order("sort_order").order("name"),
    supabase.from("government_spheres").select("*").order("sort_order").order("name"),
    supabase.from("countries").select("*").order("sort_order").order("name"),
    supabase.from("states").select("*").order("sort_order").order("name"),
    supabase.from("organization_special_categories").select("organization_id,special_category_id"),
    supabase.from("contact_institutional_categories").select("contact_id,institutional_category_id,institutional_subcategory_id"),
    supabase.from("contact_special_categories").select("contact_id,special_category_id"),
  ])

  for (const result of [
    institutionalCategoriesResult,
    institutionalSubcategoriesResult,
    organizationTypesResult,
    specialCategoriesResult,
    scopesResult,
    governmentSpheresResult,
    countriesResult,
    statesResult,
    organizationSpecialCategoriesResult,
    contactInstitutionalCategoriesResult,
    contactSpecialCategoriesResult,
  ]) {
    throwIfError(result.error)
  }

  return {
    institutionalCategories: (institutionalCategoriesResult.data || []).map(mapInstitutionalCategory),
    institutionalSubcategories: (institutionalSubcategoriesResult.data || []).map(mapInstitutionalSubcategory),
    organizationTypes: (organizationTypesResult.data || []).map((row) => mapBasic(row) as OrganizationType),
    specialCategories: (specialCategoriesResult.data || []).map((row) => mapBasic(row) as SpecialCategory),
    scopes: (scopesResult.data || []).map((row) => mapBasic(row) as ScopeOption),
    governmentSpheres: (governmentSpheresResult.data || []).map((row) => mapBasic(row) as GovernmentSphere),
    countries: (countriesResult.data || []).map((row) => ({
      ...mapBasic(row),
      iso2: row.iso2 || undefined,
    })),
    states: (statesResult.data || []).map((row) => ({
      ...mapBasic(row),
      countryId: row.country_id,
      code: row.code,
    })),
    organizationSpecialCategories: (organizationSpecialCategoriesResult.data || []).map((row) => ({
      organizationId: row.organization_id,
      specialCategoryId: row.special_category_id,
    })),
    contactInstitutionalCategories: (contactInstitutionalCategoriesResult.data || []).map((row) => ({
      contactId: row.contact_id,
      institutionalCategoryId: row.institutional_category_id,
      institutionalSubcategoryId: row.institutional_subcategory_id || undefined,
    })),
    contactSpecialCategories: (contactSpecialCategoriesResult.data || []).map((row) => ({
      contactId: row.contact_id,
      specialCategoryId: row.special_category_id,
    })),
  }
}

export async function createInstitutionalCategory(input: {
  id: string
  name: string
  description?: string
  organizationTypeId?: string
  sortOrder: number
}): Promise<InstitutionalCategory> {
  const { data, error } = await supabase
    .from("institutional_categories")
    .insert({
      id: input.id,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      organization_type_id: input.organizationTypeId || null,
      color: "#E60456",
      active: true,
      sort_order: input.sortOrder,
    })
    .select("*")
    .single()

  throwIfError(error)
  return mapInstitutionalCategory(data)
}

export async function updateInstitutionalCategory(
  id: string,
  patch: { name: string; description?: string; organizationTypeId?: string },
): Promise<InstitutionalCategory> {
  const { data, error } = await supabase
    .from("institutional_categories")
    .update({
      name: patch.name.trim(),
      description: patch.description?.trim() || null,
      organization_type_id: patch.organizationTypeId || null,
      color: "#E60456",
    })
    .eq("id", id)
    .select("*")
    .single()

  throwIfError(error)
  return mapInstitutionalCategory(data)
}

export async function deleteInstitutionalCategory(id: string): Promise<void> {
  const { error } = await supabase.from("institutional_categories").delete().eq("id", id)
  throwIfError(error)
}

export async function createInstitutionalSubcategory(input: {
  id: string
  institutionalCategoryId: string
  name: string
  sortOrder: number
}): Promise<InstitutionalSubcategory> {
  const { data, error } = await supabase
    .from("institutional_subcategories")
    .insert({
      id: input.id,
      institutional_category_id: input.institutionalCategoryId,
      name: input.name.trim(),
      active: true,
      sort_order: input.sortOrder,
    })
    .select("*")
    .single()

  throwIfError(error)
  return mapInstitutionalSubcategory(data)
}

export async function updateInstitutionalSubcategory(
  id: string,
  name: string,
): Promise<InstitutionalSubcategory> {
  const { data, error } = await supabase
    .from("institutional_subcategories")
    .update({ name: name.trim() })
    .eq("id", id)
    .select("*")
    .single()

  throwIfError(error)
  return mapInstitutionalSubcategory(data)
}

export async function deleteInstitutionalSubcategory(id: string): Promise<void> {
  const { error } = await supabase.from("institutional_subcategories").delete().eq("id", id)
  throwIfError(error)
}
