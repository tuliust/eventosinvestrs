import { supabase } from "./supabase"
import type { Organization } from "./types"

export async function loadOrganizationDetail(id: string): Promise<Organization | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  return {
    id: data.id,
    name: data.name,
    type: data.type,
    sector: data.sector || undefined,
    subsector: data.subsector || undefined,
    primarySegmentId: data.primary_segment_id || undefined,
    primarySubsegmentId: data.primary_subsegment_id || undefined,
    organizationTypeId: data.organization_type_id || undefined,
    institutionalCategoryId: data.institutional_category_id || undefined,
    institutionalSubcategoryId: data.institutional_subcategory_id || undefined,
    scopeId: data.scope_id || undefined,
    governmentSphereId: data.government_sphere_id || undefined,
    countryId: data.country_id || undefined,
    stateId: data.state_id || undefined,
    phone: data.phone || undefined,
    phoneSecondary: data.phone_secondary || undefined,
    emails: data.emails || [],
    channelTypes: data.channel_types || [],
    site: data.site || undefined,
    city: data.city || undefined,
    state: data.state || undefined,
    country: data.country || undefined,
    taxId: data.tax_id || undefined,
    classificationType: data.classification_type || undefined,
    involvementType: data.involvement_type || undefined,
    relationshipLevel: data.relationship_level ?? undefined,
    accountManager: data.account_manager || undefined,
    address: data.address || undefined,
    description: data.description || undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}
