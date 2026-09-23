import { supabase } from "@/lib/supabase"
import type { Organization } from "@/lib/types"

type DbRow = Record<string, any>

function mapOrganization(row: DbRow): Organization {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    sector: row.sector || undefined,
    subsector: row.subsector || undefined,
    primarySegmentId: row.primary_segment_id || undefined,
    primarySubsegmentId: row.primary_subsegment_id || undefined,
    organizationTypeId: row.organization_type_id || undefined,
    institutionalCategoryId: row.institutional_category_id || undefined,
    institutionalSubcategoryId: row.institutional_subcategory_id || undefined,
    scopeId: row.scope_id || undefined,
    governmentSphereId: row.government_sphere_id || undefined,
    countryId: row.country_id || undefined,
    stateId: row.state_id || undefined,
    phone: row.phone || undefined,
    phoneSecondary: row.phone_secondary || undefined,
    emails: row.emails || [],
    channelTypes: row.channel_types || [],
    site: row.site || undefined,
    city: row.city || undefined,
    state: row.state || undefined,
    country: row.country || undefined,
    taxId: row.tax_id || undefined,
    classificationType: row.classification_type || undefined,
    involvementType: row.involvement_type || undefined,
    relationshipLevel: row.relationship_level ?? undefined,
    accountManager: row.account_manager || undefined,
    address: row.address || undefined,
    description: row.description || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function loadMailingOrganizations(): Promise<Organization[]> {
  const { data, error } = await supabase.from("organizations").select("*").order("name")
  if (error) throw new Error(error.message)
  return (data || []).map(mapOrganization)
}
