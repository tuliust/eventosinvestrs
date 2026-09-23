alter table public.events
  add column if not exists sector_ids text[] not null default '{}'::text[],
  add column if not exists subsectors text[] not null default '{}'::text[],
  add column if not exists subsegment_ids text[] not null default '{}'::text[];

update public.events e
   set sector_ids = coalesce((
     select array_agg(s.id order by s.sort_order, s.name)
       from public.segments s
      where s.name = any(coalesce(e.sectors, '{}'::text[]))
   ), '{}'::text[])
 where cardinality(coalesce(e.sectors, '{}'::text[])) > 0
   and cardinality(coalesce(e.sector_ids, '{}'::text[])) = 0;

create index if not exists events_sector_ids_gin_idx
  on public.events using gin (sector_ids);

create index if not exists events_subsegment_ids_gin_idx
  on public.events using gin (subsegment_ids);

create or replace function public.update_segment_admin(
  p_segment_id text,
  p_name text,
  p_description text default null::text,
  p_color text default '#009C63'::text
)
returns public.segments
language plpgsql
set search_path to 'public'
as $function$
declare
  v_result public.segments;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Somente administradores podem editar setores.' using errcode = '42501';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception 'O nome do setor é obrigatório.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.segments where id = p_segment_id) then
    raise exception 'Setor não encontrado.' using errcode = 'P0002';
  end if;

  update public.segments
     set name = btrim(p_name),
         description = nullif(btrim(coalesce(p_description, '')), ''),
         color = p_color
   where id = p_segment_id
   returning * into v_result;

  update public.organizations
     set sector = v_result.name
   where primary_segment_id = p_segment_id;

  update public.events e
     set sectors = coalesce((
       select array_agg(s.name order by s.sort_order, s.name)
         from public.segments s
        where s.id = any(coalesce(e.sector_ids, '{}'::text[]))
     ), '{}'::text[])
   where p_segment_id = any(coalesce(e.sector_ids, '{}'::text[]));

  return v_result;
end;
$function$;

create or replace function public.update_subsegment_admin(
  p_subsegment_id text,
  p_name text
)
returns public.subsegments
language plpgsql
set search_path to 'public'
as $function$
declare
  v_old_name text;
  v_segment_id text;
  v_segment_name text;
  v_result public.subsegments;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Somente administradores podem editar subsetores.' using errcode = '42501';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception 'O nome do subsetor é obrigatório.' using errcode = '22023';
  end if;

  select ss.name, ss.segment_id, s.name
    into v_old_name, v_segment_id, v_segment_name
    from public.subsegments ss
    join public.segments s on s.id = ss.segment_id
   where ss.id = p_subsegment_id;

  if not found then
    raise exception 'Subsetor não encontrado.' using errcode = 'P0002';
  end if;

  update public.subsegments
     set name = btrim(p_name)
   where id = p_subsegment_id
   returning * into v_result;

  update public.organizations
     set subsector = v_result.name
   where primary_subsegment_id = p_subsegment_id
      or (primary_segment_id = v_segment_id and sector = v_segment_name and subsector = v_old_name);

  update public.events e
     set subsectors = coalesce((
       select array_agg(ss.name order by ss.sort_order, ss.name)
         from public.subsegments ss
        where ss.id = any(coalesce(e.subsegment_ids, '{}'::text[]))
     ), '{}'::text[])
   where p_subsegment_id = any(coalesce(e.subsegment_ids, '{}'::text[]));

  return v_result;
end;
$function$;

create or replace function public.delete_subsegment_admin(p_subsegment_id text)
returns text
language plpgsql
set search_path to 'public'
as $function$
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

  update public.events
     set subsegment_ids = array_remove(coalesce(subsegment_ids, '{}'::text[]), p_subsegment_id)
   where p_subsegment_id = any(coalesce(subsegment_ids, '{}'::text[]));

  delete from public.subsegments where id = p_subsegment_id;

  update public.events e
     set subsectors = coalesce((
       select array_agg(ss.name order by ss.sort_order, ss.name)
         from public.subsegments ss
        where ss.id = any(coalesce(e.subsegment_ids, '{}'::text[]))
     ), '{}'::text[])
   where v_name = any(coalesce(e.subsectors, '{}'::text[]));

  return v_name;
end;
$function$;

create or replace function public.delete_segment_admin(p_segment_id text)
returns text
language plpgsql
set search_path to 'public'
as $function$
declare
  v_name text;
  v_contact_links integer;
  v_org_links integer;
  v_child_ids text[];
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

  select coalesce(array_agg(id), '{}'::text[])
    into v_child_ids
    from public.subsegments
   where segment_id = p_segment_id;

  update public.events
     set sector_ids = array_remove(coalesce(sector_ids, '{}'::text[]), p_segment_id),
         subsegment_ids = array(
           select value
             from unnest(coalesce(subsegment_ids, '{}'::text[])) as value
            where not (value = any(v_child_ids))
         )
   where p_segment_id = any(coalesce(sector_ids, '{}'::text[]))
      or coalesce(subsegment_ids, '{}'::text[]) && v_child_ids;

  delete from public.segments where id = p_segment_id;

  update public.events e
     set sectors = coalesce((
       select array_agg(s.name order by s.sort_order, s.name)
         from public.segments s
        where s.id = any(coalesce(e.sector_ids, '{}'::text[]))
     ), '{}'::text[]),
         subsectors = coalesce((
       select array_agg(ss.name order by ss.sort_order, ss.name)
         from public.subsegments ss
        where ss.id = any(coalesce(e.subsegment_ids, '{}'::text[]))
     ), '{}'::text[])
   where v_name = any(coalesce(e.sectors, '{}'::text[]))
      or cardinality(v_child_ids) > 0;

  return v_name;
end;
$function$;
