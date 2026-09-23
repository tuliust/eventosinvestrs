-- Corrige a manutenção de contatos e adiciona importação opcional de inscritos Luma.

create or replace function public.delete_all_contacts_admin(p_actor_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*)::integer into v_count from public.contacts;

  update public.event_invites
     set contact_id = null,
         updated_at = now()
   where contact_id is not null;

  update public.event_registrations
     set contact_id = null,
         updated_at = now()
   where contact_id is not null;

  update public.event_attendances
     set contact_id = null,
         updated_at = now()
   where contact_id is not null;

  -- A instância usa proteção contra DELETE sem WHERE. Como id é PK NOT NULL,
  -- esta condição continua significando "todos os contatos" de forma explícita.
  delete from public.contacts where id is not null;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    p_actor_id,
    'contacts.deleted_all',
    'contacts',
    'all',
    jsonb_build_object('deleted_count', v_count)
  );

  return v_count;
end;
$$;

revoke all on function public.delete_all_contacts_admin(uuid) from public, anon, authenticated;
grant execute on function public.delete_all_contacts_admin(uuid) to service_role;

create or replace function public.get_pending_luma_contact_import()
returns table (
  event_id text,
  event_title text,
  pending_count bigint,
  latest_registration timestamptz
)
language sql
security invoker
stable
set search_path = public
as $$
  with eligible as (
    select
      r.event_id,
      e.title as event_title,
      r.registered_at,
      nullif(lower(btrim(r.email::text)), '') as email_key,
      nullif(regexp_replace(coalesce(r.phone, ''), '\D', '', 'g'), '') as phone_key,
      r.id
    from public.event_registrations r
    join public.events e on e.id = r.event_id
    where public.current_user_role() = 'admin'
      and r.source = 'luma'
      and r.approval_status = 'approved'
      and r.contact_id is null
      and not exists (
        select 1
        from public.contacts c
        where (
          nullif(btrim(r.email::text), '') is not null
          and (
            lower(btrim(coalesce(c.email::text, ''))) = lower(btrim(r.email::text))
            or lower(btrim(coalesce(c.email_secondary::text, ''))) = lower(btrim(r.email::text))
          )
        )
        or (
          nullif(btrim(r.email::text), '') is null
          and nullif(regexp_replace(coalesce(r.phone, ''), '\D', '', 'g'), '') is not null
          and (
            regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = regexp_replace(coalesce(r.phone, ''), '\D', '', 'g')
            or regexp_replace(coalesce(c.whatsapp, ''), '\D', '', 'g') = regexp_replace(coalesce(r.phone, ''), '\D', '', 'g')
            or regexp_replace(coalesce(c.phone_secondary, ''), '\D', '', 'g') = regexp_replace(coalesce(r.phone, ''), '\D', '', 'g')
          )
        )
      )
  ), deduped as (
    select distinct on (
      event_id,
      coalesce('e:' || email_key, 'p:' || phone_key, 'r:' || id)
    )
      event_id,
      event_title,
      registered_at,
      coalesce('e:' || email_key, 'p:' || phone_key, 'r:' || id) as person_key
    from eligible
    order by event_id, coalesce('e:' || email_key, 'p:' || phone_key, 'r:' || id), registered_at desc
  ), grouped as (
    select
      event_id,
      max(event_title) as event_title,
      count(*)::bigint as pending_count,
      max(registered_at) as latest_registration
    from deduped
    group by event_id
  )
  select g.event_id, g.event_title, g.pending_count, g.latest_registration
  from grouped g
  where g.pending_count > 0
  order by g.latest_registration desc
  limit 1;
$$;

revoke all on function public.get_pending_luma_contact_import() from public, anon;
grant execute on function public.get_pending_luma_contact_import() to authenticated;

create or replace function public.import_luma_contacts_admin(p_event_id text)
returns jsonb
language plpgsql
security invoker
set search_path = public
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
  if public.current_user_role() <> 'admin' then
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

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'contacts.imported_from_luma',
    'event',
    p_event_id,
    jsonb_build_object(
      'event_title', v_event_title,
      'contacts_created', v_created,
      'existing_contacts_linked', v_existing,
      'registrations_linked', v_linked
    )
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

revoke all on function public.import_luma_contacts_admin(text) from public, anon;
grant execute on function public.import_luma_contacts_admin(text) to authenticated;
