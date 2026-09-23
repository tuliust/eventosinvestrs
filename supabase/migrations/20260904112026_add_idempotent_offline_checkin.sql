alter table public.event_attendances
  add column if not exists idempotency_key text;

create unique index if not exists event_attendances_idempotency_key_unique
  on public.event_attendances (idempotency_key)
  where idempotency_key is not null;

create or replace function public.check_in_event_idempotent(
  p_attendance_id uuid,
  p_event_id text,
  p_contact_id text,
  p_registration_id text,
  p_name text,
  p_company text,
  p_position text,
  p_source text,
  p_idempotency_key text,
  p_offline boolean default false
)
returns public.event_attendances
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_attendance public.event_attendances;
  v_contact_id text := p_contact_id;
  v_registration_contact_id text;
begin
  if not public.is_active_staff() then
    raise exception 'Usuário sem permissão para realizar check-in' using errcode = '42501';
  end if;

  if nullif(trim(p_idempotency_key), '') is null then
    raise exception 'Idempotency key obrigatória' using errcode = '22023';
  end if;

  select * into v_attendance
  from public.event_attendances
  where idempotency_key = p_idempotency_key
  limit 1;

  if found then
    return v_attendance;
  end if;

  if not exists (select 1 from public.events where id = p_event_id) then
    raise exception 'Evento não encontrado' using errcode = 'P0002';
  end if;

  if p_registration_id is not null then
    select contact_id into v_registration_contact_id
    from public.event_registrations
    where id = p_registration_id and event_id = p_event_id;

    if not found then
      raise exception 'Inscrição não pertence ao evento' using errcode = '23503';
    end if;
    v_contact_id := coalesce(v_contact_id, v_registration_contact_id);
  end if;

  if v_contact_id is not null and not exists (
    select 1 from public.contacts where id = v_contact_id
  ) then
    raise exception 'Contato não encontrado' using errcode = '23503';
  end if;

  select * into v_attendance
  from public.event_attendances
  where event_id = p_event_id
    and undone_at is null
    and (
      (p_registration_id is not null and registration_id = p_registration_id)
      or (v_contact_id is not null and contact_id = v_contact_id)
    )
  limit 1;

  if found then
    if p_offline then
      insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
      values (
        (select auth.uid()),
        'checkin.offline_conflict_resolved',
        'event_attendance',
        v_attendance.id::text,
        jsonb_build_object(
          'event_id', p_event_id,
          'idempotency_key', p_idempotency_key,
          'reason', 'already_present'
        )
      );
    end if;
    return v_attendance;
  end if;

  begin
    insert into public.event_attendances (
      id,
      event_id,
      contact_id,
      registration_id,
      name,
      company,
      position,
      checked_in_by,
      source,
      idempotency_key
    ) values (
      p_attendance_id,
      p_event_id,
      v_contact_id,
      p_registration_id,
      trim(p_name),
      nullif(trim(p_company), ''),
      nullif(trim(p_position), ''),
      (select auth.uid()),
      p_source,
      p_idempotency_key
    )
    returning * into v_attendance;
  exception when unique_violation then
    select * into v_attendance
    from public.event_attendances
    where idempotency_key = p_idempotency_key
       or (
         event_id = p_event_id
         and undone_at is null
         and (
           (p_registration_id is not null and registration_id = p_registration_id)
           or (v_contact_id is not null and contact_id = v_contact_id)
         )
       )
    order by checked_in_at desc
    limit 1;

    if not found then
      raise;
    end if;
  end;

  if p_offline then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (
      (select auth.uid()),
      'checkin.offline_synced',
      'event_attendance',
      v_attendance.id::text,
      jsonb_build_object(
        'event_id', p_event_id,
        'idempotency_key', p_idempotency_key,
        'source', p_source,
        'name', p_name
      )
    );
  end if;

  return v_attendance;
end;
$$;

revoke all on function public.check_in_event_idempotent(
  uuid, text, text, text, text, text, text, text, text, boolean
) from public, anon;

grant execute on function public.check_in_event_idempotent(
  uuid, text, text, text, text, text, text, text, text, boolean
) to authenticated;
