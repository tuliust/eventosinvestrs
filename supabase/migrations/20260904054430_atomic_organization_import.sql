create or replace function public.apply_organization_import_service(
  p_rows jsonb,
  p_actor_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count integer := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;

  insert into public.organizations (
    id, name, type, sector, subsector, site, city, state, country,
    phone, phone_secondary, emails, channel_types,
    primary_segment_id, primary_subsegment_id, organization_type_id,
    institutional_category_id, institutional_subcategory_id,
    scope_id, government_sphere_id, country_id, state_id,
    tax_id, classification_type, involvement_type, relationship_level,
    account_manager, address, description
  )
  select
    r.id, r.name, r.type, r.sector, r.subsector, r.site, r.city, r.state, r.country,
    r.phone, r.phone_secondary, coalesce(r.emails, '{}'::text[]), coalesce(r.channel_types, '{}'::text[]),
    r.primary_segment_id, r.primary_subsegment_id, r.organization_type_id,
    r.institutional_category_id, r.institutional_subcategory_id,
    r.scope_id, r.government_sphere_id, r.country_id, r.state_id,
    r.tax_id, r.classification_type, r.involvement_type, r.relationship_level,
    r.account_manager, r.address, r.description
  from jsonb_to_recordset(p_rows) as r(
    id text, name text, type text, sector text, subsector text, site text, city text, state text, country text,
    phone text, phone_secondary text, emails text[], channel_types text[],
    primary_segment_id text, primary_subsegment_id text, organization_type_id text,
    institutional_category_id text, institutional_subcategory_id text,
    scope_id text, government_sphere_id text, country_id text, state_id text,
    tax_id text, classification_type text, involvement_type text, relationship_level integer,
    account_manager text, address text, description text
  )
  where nullif(btrim(r.id), '') is not null
    and nullif(btrim(r.name), '') is not null
  on conflict (id) do update set
    name = excluded.name,
    type = excluded.type,
    sector = excluded.sector,
    subsector = excluded.subsector,
    site = excluded.site,
    city = excluded.city,
    state = excluded.state,
    country = excluded.country,
    phone = excluded.phone,
    phone_secondary = excluded.phone_secondary,
    emails = excluded.emails,
    channel_types = excluded.channel_types,
    primary_segment_id = excluded.primary_segment_id,
    primary_subsegment_id = excluded.primary_subsegment_id,
    organization_type_id = excluded.organization_type_id,
    institutional_category_id = excluded.institutional_category_id,
    institutional_subcategory_id = excluded.institutional_subcategory_id,
    scope_id = excluded.scope_id,
    government_sphere_id = excluded.government_sphere_id,
    country_id = excluded.country_id,
    state_id = excluded.state_id,
    tax_id = excluded.tax_id,
    classification_type = excluded.classification_type,
    involvement_type = excluded.involvement_type,
    relationship_level = excluded.relationship_level,
    account_manager = excluded.account_manager,
    address = excluded.address,
    description = excluded.description,
    updated_at = now();

  get diagnostics v_count = row_count;

  insert into public.audit_logs (actor_id, action, entity_type, metadata)
  values (
    p_actor_id,
    'organizations.imported',
    'organization_import',
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('persisted_rows', v_count)
  );

  return v_count;
end;
$$;

revoke all on function public.apply_organization_import_service(jsonb, uuid, jsonb) from public;
revoke all on function public.apply_organization_import_service(jsonb, uuid, jsonb) from anon;
revoke all on function public.apply_organization_import_service(jsonb, uuid, jsonb) from authenticated;
grant execute on function public.apply_organization_import_service(jsonb, uuid, jsonb) to service_role;
