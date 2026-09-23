create unique index if not exists segments_name_ci_unique
  on public.segments (lower(name));

create unique index if not exists subsegments_segment_name_ci_unique
  on public.subsegments (segment_id, lower(name));

create or replace function public.update_segment_admin(
  p_segment_id uuid,
  p_name text,
  p_description text default null,
  p_color text default '#009C63'
)
returns public.segments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_old_name text;
  v_result public.segments;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Somente administradores podem editar setores.' using errcode = '42501';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception 'O nome do setor é obrigatório.' using errcode = '22023';
  end if;

  select name into v_old_name
    from public.segments
   where id = p_segment_id;

  if not found then
    raise exception 'Setor não encontrado.' using errcode = 'P0002';
  end if;

  update public.segments
     set name = btrim(p_name),
         description = nullif(btrim(coalesce(p_description, '')), ''),
         color = p_color
   where id = p_segment_id
   returning * into v_result;

  if v_old_name is distinct from v_result.name then
    update public.organizations
       set sector = v_result.name
     where sector = v_old_name;

    update public.events
       set sectors = array_replace(sectors, v_old_name, v_result.name)
     where v_old_name = any(sectors);
  end if;

  return v_result;
end;
$$;

create or replace function public.delete_segment_admin(
  p_segment_id uuid
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_name text;
  v_links integer;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Somente administradores podem remover setores.' using errcode = '42501';
  end if;

  select name into v_name
    from public.segments
   where id = p_segment_id;

  if not found then
    raise exception 'Setor não encontrado.' using errcode = 'P0002';
  end if;

  select count(*)::integer into v_links
    from public.contact_segmentations
   where segment_id = p_segment_id;

  if v_links > 0 then
    raise exception 'Este setor possui % contato(s) associado(s). Reassocie os contatos antes de removê-lo.', v_links using errcode = '23503';
  end if;

  update public.organizations
     set sector = null,
         subsector = null
   where sector = v_name;

  update public.events
     set sectors = array_remove(sectors, v_name)
   where v_name = any(sectors);

  delete from public.segments
   where id = p_segment_id;

  return v_name;
end;
$$;

create or replace function public.update_subsegment_admin(
  p_subsegment_id uuid,
  p_name text
)
returns public.subsegments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_old_name text;
  v_segment_name text;
  v_result public.subsegments;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Somente administradores podem editar subsetores.' using errcode = '42501';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception 'O nome do subsetor é obrigatório.' using errcode = '22023';
  end if;

  select ss.name, s.name
    into v_old_name, v_segment_name
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

  if v_old_name is distinct from v_result.name then
    update public.organizations
       set subsector = v_result.name
     where sector = v_segment_name
       and subsector = v_old_name;
  end if;

  return v_result;
end;
$$;

create or replace function public.delete_subsegment_admin(
  p_subsegment_id uuid
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_name text;
  v_segment_name text;
  v_links integer;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Somente administradores podem remover subsetores.' using errcode = '42501';
  end if;

  select ss.name, s.name
    into v_name, v_segment_name
    from public.subsegments ss
    join public.segments s on s.id = ss.segment_id
   where ss.id = p_subsegment_id;

  if not found then
    raise exception 'Subsetor não encontrado.' using errcode = 'P0002';
  end if;

  select count(*)::integer into v_links
    from public.contact_segmentations
   where subsegment_id = p_subsegment_id;

  if v_links > 0 then
    raise exception 'Este subsetor possui % contato(s) associado(s). Reassocie os contatos antes de removê-lo.', v_links using errcode = '23503';
  end if;

  update public.organizations
     set subsector = null
   where sector = v_segment_name
     and subsector = v_name;

  delete from public.subsegments
   where id = p_subsegment_id;

  return v_name;
end;
$$;

revoke all on function public.update_segment_admin(uuid, text, text, text) from public, anon;
revoke all on function public.delete_segment_admin(uuid) from public, anon;
revoke all on function public.update_subsegment_admin(uuid, text) from public, anon;
revoke all on function public.delete_subsegment_admin(uuid) from public, anon;

grant execute on function public.update_segment_admin(uuid, text, text, text) to authenticated;
grant execute on function public.delete_segment_admin(uuid) to authenticated;
grant execute on function public.update_subsegment_admin(uuid, text) to authenticated;
grant execute on function public.delete_subsegment_admin(uuid) to authenticated;

create or replace function private.audit_segmentation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_entity_type text;
  v_entity_id text;
  v_name text;
begin
  v_entity_type := case when tg_table_name = 'segments' then 'segment' else 'subsegment' end;

  if tg_op = 'INSERT' then
    v_action := v_entity_type || '.created';
    v_entity_id := new.id::text;
    v_name := new.name;
  elsif tg_op = 'UPDATE' then
    v_action := v_entity_type || '.updated';
    v_entity_id := new.id::text;
    v_name := new.name;
  else
    v_action := v_entity_type || '.deleted';
    v_entity_id := old.id::text;
    v_name := old.name;
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), v_action, v_entity_type, v_entity_id, jsonb_build_object('name', v_name));

  return coalesce(new, old);
end;
$$;

revoke execute on function private.audit_segmentation_change() from public, anon, authenticated;

drop trigger if exists audit_segments_after_change on public.segments;
create trigger audit_segments_after_change
after insert or update or delete on public.segments
for each row execute function private.audit_segmentation_change();

drop trigger if exists audit_subsegments_after_change on public.subsegments;
create trigger audit_subsegments_after_change
after insert or update or delete on public.subsegments
for each row execute function private.audit_segmentation_change();