create schema if not exists internal;
revoke all on schema internal from public;
grant usage on schema internal to authenticated;

create or replace function internal.audit_luma_contact_import(
  p_event_id text,
  p_event_title text,
  p_created integer,
  p_existing integer,
  p_linked integer
)
returns void
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  if not public.is_active_staff() or public.current_user_role() <> 'admin' then
    raise exception 'Somente administradores podem registrar esta auditoria.' using errcode = '42501';
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'contacts.imported_from_luma',
    'event',
    p_event_id,
    jsonb_build_object(
      'event_title', p_event_title,
      'contacts_created', p_created,
      'existing_contacts_linked', p_existing,
      'registrations_linked', p_linked
    )
  );
end;
$$;

revoke all on function internal.audit_luma_contact_import(text,text,integer,integer,integer) from public;
grant execute on function internal.audit_luma_contact_import(text,text,integer,integer,integer) to authenticated;

create or replace function public.import_luma_contacts_admin(p_event_id text)
returns jsonb
language plpgsql
security invoker
set search_path = 'public', 'pg_temp'
as $$
declare
  v_event_title text;
  v_registration public.event_registrations%rowtype;
  v_contact_id text;
  v_organization_id text;
  v_first_name text;
  v_last_name text;
  v_normalized_phone text;
  v_created integer := 0;
  v_linked integer := 0;
  v_existing integer := 0;
begin
  if not public.is_active_staff() or public.current_user_role() <> 'admin' then
    raise exception 'Somente administradores podem importar contatos do Luma.' using errcode = '42501';
  end if;

  select title into v_event_title
    from public.events
   where id = p_event_id;

  if not found then
    raise exception 'Evento não encontrado.' using errcode = 'P0002';
  end if;

  for v_registration in
    select r.*
      from public.event_registrations r
     where r.event_id = p_event_id
       and r.source = 'luma'
       and r.approval_status = 'approved'
     order by r.registered_at, r.id
  loop
    if v_registration.contact_id is not null then
      continue;
    end if;

    v_contact_id := null;
    v_organization_id := null;
    v_normalized_phone := nullif(regexp_replace(coalesce(v_registration.phone, ''), '\D', '', 'g'), '');

    if nullif(btrim(v_registration.email::text), '') is not null then
      select c.id into v_contact_id
        from public.contacts c
       where lower(btrim(coalesce(c.email::text, ''))) = lower(btrim(v_registration.email::text))
          or lower(btrim(coalesce(c.email_secondary::text, ''))) = lower(btrim(v_registration.email::text))
       order by c.created_at
       limit 1;
    end if;

    if v_contact_id is null and v_normalized_phone is not null then
      select c.id into v_contact_id
        from public.contacts c
       where regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = v_normalized_phone
          or regexp_replace(coalesce(c.whatsapp, ''), '\D', '', 'g') = v_normalized_phone
          or regexp_replace(coalesce(c.phone_secondary, ''), '\D', '', 'g') = v_normalized_phone
       order by c.created_at
       limit 1;
    end if;

    if v_contact_id is null then
      if nullif(btrim(coalesce(v_registration.company, '')), '') is not null then
        select o.id into v_organization_id
          from public.organizations o
         where lower(btrim(o.name)) = lower(btrim(v_registration.company))
         order by o.created_at
         limit 1;
      end if;

      v_first_name := nullif(btrim(coalesce(v_registration.first_name, '')), '');
      v_last_name := nullif(btrim(coalesce(v_registration.last_name, '')), '');

      if v_first_name is null then
        v_first_name := split_part(btrim(coalesce(v_registration.name, '')), ' ', 1);
      end if;
      if nullif(v_first_name, '') is null then
        v_first_name := 'Contato';
      end if;

      if v_last_name is null then
        v_last_name := nullif(btrim(regexp_replace(btrim(coalesce(v_registration.name, '')), '^\S+\s*', '')), '');
      end if;

      insert into public.contacts (
        id,
        first_name,
        last_name,
        email,
        phone,
        organization,
        organization_id,
        position,
        origin,
        communication_status,
        incomplete_profile,
        tags,
        notes,
        created_by
      ) values (
        gen_random_uuid()::text,
        v_first_name,
        coalesce(v_last_name, ''),
        nullif(btrim(v_registration.email::text), ''),
        nullif(btrim(coalesce(v_registration.phone, '')), ''),
        nullif(btrim(coalesce(v_registration.company, '')), ''),
        v_organization_id,
        nullif(btrim(coalesce(v_registration.position, '')), ''),
        'luma',
        'active',
        false,
        array['Luma']::text[],
        'Importado do Luma · ' || v_event_title,
        auth.uid()
      )
      returning id into v_contact_id;

      v_created := v_created + 1;
    else
      v_existing := v_existing + 1;
    end if;

    update public.event_registrations
       set contact_id = v_contact_id,
           updated_at = now()
     where id = v_registration.id;

    v_linked := v_linked + 1;
  end loop;

  perform internal.audit_luma_contact_import(
    p_event_id,
    v_event_title,
    v_created,
    v_existing,
    v_linked
  );

  return jsonb_build_object(
    'success', true,
    'event_id', p_event_id,
    'event_title', v_event_title,
    'created', v_created,
    'existing', v_existing,
    'linked', v_linked
  );
end;
$$;

revoke all on function public.import_luma_contacts_admin(text) from public;
revoke all on function public.import_luma_contacts_admin(text) from anon;
grant execute on function public.import_luma_contacts_admin(text) to authenticated;
