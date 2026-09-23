create index if not exists institutional_categories_organization_type_idx
  on public.institutional_categories(organization_type_id);

create index if not exists organizations_primary_segment_subsegment_idx
  on public.organizations(primary_segment_id, primary_subsegment_id);

create index if not exists organizations_institutional_category_subcategory_idx
  on public.organizations(institutional_category_id, institutional_subcategory_id);

-- Evita duas políticas permissivas de SELECT para authenticated.
-- Leitura continua liberada para staff ativo; escrita continua exclusiva de admin.
do $$
declare
  t text;
begin
  foreach t in array array[
    'organization_types','institutional_categories','institutional_subcategories',
    'special_categories','scopes','government_spheres','countries','states',
    'organization_special_categories','contact_institutional_categories','contact_special_categories'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_manage', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_delete', t);

    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.current_user_role() = ''admin'')',
      t || '_admin_insert', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.current_user_role() = ''admin'') with check (public.current_user_role() = ''admin'')',
      t || '_admin_update', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.current_user_role() = ''admin'')',
      t || '_admin_delete', t
    );
  end loop;
end $$;
