-- Mantém compatibilidade entre os campos legados de organizações e os novos relacionamentos normalizados.

insert into public.organization_types (id, name, sort_order) values
  ('orgtype-private-company', 'Empresa privada', 5),
  ('orgtype-association', 'Associação', 65),
  ('orgtype-entity', 'Entidade', 66),
  ('orgtype-financial-institution', 'Instituição financeira', 145),
  ('orgtype-other', 'Outro', 999)
on conflict (id) do update set name = excluded.name, active = true, sort_order = excluded.sort_order;

create or replace function private.sync_organization_classifications()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_name text;
  v_segment_id text;
  v_country_name text;
  v_state_name text;
begin
  -- Setor econômico: IDs normalizados prevalecem; campos textuais continuam sincronizados.
  if new.primary_segment_id is not null then
    select s.name into v_name from public.segments s where s.id = new.primary_segment_id;
    if v_name is not null then new.sector := v_name; end if;
  elsif nullif(btrim(coalesce(new.sector, '')), '') is not null then
    select s.id into new.primary_segment_id
      from public.segments s
     where lower(s.name) = lower(btrim(new.sector))
     limit 1;
  end if;

  if new.primary_subsegment_id is not null then
    select ss.name, ss.segment_id into v_name, v_segment_id
      from public.subsegments ss
     where ss.id = new.primary_subsegment_id
     limit 1;
    if v_name is not null then
      new.primary_segment_id := v_segment_id;
      new.subsector := v_name;
      select s.name into new.sector from public.segments s where s.id = v_segment_id;
    end if;
  elsif new.primary_segment_id is not null
    and nullif(btrim(coalesce(new.subsector, '')), '') is not null then
    select ss.id into new.primary_subsegment_id
      from public.subsegments ss
     where ss.segment_id = new.primary_segment_id
       and lower(ss.name) = lower(btrim(new.subsector))
     limit 1;
  end if;

  -- Tipo de organização: converte os valores legados já usados pela aplicação.
  if new.organization_type_id is null then
    new.organization_type_id := case new.type
      when 'empresa_privada' then 'orgtype-private-company'
      when 'imprensa' then 'orgtype-media'
      when 'associacao' then 'orgtype-association'
      when 'entidade' then 'orgtype-entity'
      when 'orgao_governamental' then 'orgtype-government'
      when 'embaixada_consulado' then 'orgtype-embassy-consulate'
      when 'instituicao_financeira' then 'orgtype-financial-institution'
      when 'universidade_academia' then 'orgtype-education-research'
      when 'outro' then 'orgtype-other'
      else new.organization_type_id
    end;
  end if;

  -- País e estado: mantém o cadastro atual por texto compatível com os novos FKs.
  if new.country_id is not null then
    select c.name into v_country_name from public.countries c where c.id = new.country_id;
    if v_country_name is not null then new.country := v_country_name; end if;
  elsif nullif(btrim(coalesce(new.country, '')), '') is not null then
    select c.id into new.country_id
      from public.countries c
     where lower(c.name) = lower(btrim(new.country))
        or lower(coalesce(c.iso2, '')) = lower(btrim(new.country))
     limit 1;
  end if;

  if new.state_id is not null then
    select st.name, st.country_id into v_state_name, new.country_id
      from public.states st
     where st.id = new.state_id
     limit 1;
    if v_state_name is not null then
      new.state := v_state_name;
      select c.name into new.country from public.countries c where c.id = new.country_id;
    end if;
  elsif new.country_id is not null
    and nullif(btrim(coalesce(new.state, '')), '') is not null then
    select st.id into new.state_id
      from public.states st
     where st.country_id = new.country_id
       and (lower(st.name) = lower(btrim(new.state)) or lower(st.code) = lower(btrim(new.state)))
     limit 1;
  end if;

  return new;
end;
$$;

revoke execute on function private.sync_organization_classifications() from public, anon;
grant execute on function private.sync_organization_classifications() to authenticated, service_role;

drop trigger if exists organizations_sync_classifications on public.organizations;
create trigger organizations_sync_classifications
before insert or update of sector, subsector, primary_segment_id, primary_subsegment_id,
  type, organization_type_id, country, country_id, state, state_id
on public.organizations
for each row execute function private.sync_organization_classifications();

-- Evita perda silenciosa de relacionamentos ao excluir classificações em uso.
alter table public.organizations drop constraint if exists organizations_primary_segment_fk;
alter table public.organizations add constraint organizations_primary_segment_fk
  foreign key (primary_segment_id) references public.segments(id) on delete restrict;

alter table public.organizations drop constraint if exists organizations_primary_subsegment_fk;
alter table public.organizations add constraint organizations_primary_subsegment_fk
  foreign key (primary_segment_id, primary_subsegment_id)
  references public.subsegments(segment_id, id) on delete restrict;

alter table public.organizations drop constraint if exists organizations_institutional_category_fk;
alter table public.organizations add constraint organizations_institutional_category_fk
  foreign key (institutional_category_id) references public.institutional_categories(id) on delete restrict;

alter table public.organizations drop constraint if exists organizations_institutional_subcategory_fk;
alter table public.organizations add constraint organizations_institutional_subcategory_fk
  foreign key (institutional_category_id, institutional_subcategory_id)
  references public.institutional_subcategories(institutional_category_id, id) on delete restrict;

create or replace function public.delete_segment_admin(
  p_segment_id text
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_name text;
  v_contact_links integer;
  v_org_links integer;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Somente administradores podem remover setores.' using errcode = '42501';
  end if;

  select name into v_name from public.segments where id = p_segment_id;
  if not found then
    raise exception 'Setor não encontrado.' using errcode = 'P0002';
  end if;

  select count(*)::integer into v_contact_links
    from public.contact_segmentations
   where segment_id = p_segment_id;

  select count(*)::integer into v_org_links
    from public.organizations
   where primary_segment_id = p_segment_id or sector = v_name;

  if v_contact_links + v_org_links > 0 then
    raise exception 'Este setor possui % contato(s) e % organização(ões) associado(s). Reassocie-os antes de removê-lo.', v_contact_links, v_org_links using errcode = '23503';
  end if;

  update public.events
     set sectors = array_remove(sectors, v_name)
   where v_name = any(sectors);

  delete from public.segments where id = p_segment_id;
  return v_name;
end;
$$;

create or replace function public.delete_subsegment_admin(
  p_subsegment_id text
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_name text;
  v_segment_name text;
  v_contact_links integer;
  v_org_links integer;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Somente administradores podem remover subsetores.' using errcode = '42501';
  end if;

  select ss.name, s.name into v_name, v_segment_name
    from public.subsegments ss
    join public.segments s on s.id = ss.segment_id
   where ss.id = p_subsegment_id;
  if not found then
    raise exception 'Subsetor não encontrado.' using errcode = 'P0002';
  end if;

  select count(*)::integer into v_contact_links
    from public.contact_segmentations
   where subsegment_id = p_subsegment_id;

  select count(*)::integer into v_org_links
    from public.organizations
   where primary_subsegment_id = p_subsegment_id
      or (sector = v_segment_name and subsector = v_name);

  if v_contact_links + v_org_links > 0 then
    raise exception 'Este subsetor possui % contato(s) e % organização(ões) associado(s). Reassocie-os antes de removê-lo.', v_contact_links, v_org_links using errcode = '23503';
  end if;

  delete from public.subsegments where id = p_subsegment_id;
  return v_name;
end;
$$;

revoke all on function public.delete_segment_admin(text) from public, anon;
revoke all on function public.delete_subsegment_admin(text) from public, anon;
grant execute on function public.delete_segment_admin(text) to authenticated;
grant execute on function public.delete_subsegment_admin(text) to authenticated;
