create or replace function public.add_event_confirmation(
  p_event_id text,
  p_contact_id text default null,
  p_name text default null,
  p_email text default null,
  p_phone text default null,
  p_company text default null,
  p_position text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_contact public.contacts%rowtype;
  v_registration public.event_registrations%rowtype;
  v_contact_id text := nullif(trim(p_contact_id), '');
  v_name text := nullif(trim(p_name), '');
  v_email extensions.citext := nullif(trim(p_email), '')::extensions.citext;
  v_phone text := nullif(trim(p_phone), '');
  v_company text := nullif(trim(p_company), '');
  v_position text := nullif(trim(p_position), '');
  v_phone_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_created_contact boolean := false;
  v_already_confirmed boolean := false;
  v_first_name text;
  v_last_name text;
begin
  if not public.is_active_staff() then
    raise exception 'Usuário sem permissão para registrar confirmações' using errcode = '42501';
  end if;

  if not exists (select 1 from public.events where id = p_event_id) then
    raise exception 'Evento não encontrado' using errcode = 'P0002';
  end if;

  if v_contact_id is not null then
    select * into v_contact
    from public.contacts
    where id = v_contact_id;

    if not found then
      raise exception 'Contato não encontrado' using errcode = 'P0002';
    end if;
  elsif v_email is not null then
    select * into v_contact
    from public.contacts
    where email = v_email or email_secondary = v_email
    order by updated_at desc
    limit 1;

    if found then
      v_contact_id := v_contact.id;
    end if;
  end if;

  if v_contact_id is null and length(v_phone_digits) >= 6 then
    select * into v_contact
    from public.contacts
    where regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g') = v_phone_digits
       or regexp_replace(coalesce(phone, ''), '\D', '', 'g') = v_phone_digits
       or regexp_replace(coalesce(phone_secondary, ''), '\D', '', 'g') = v_phone_digits
    order by updated_at desc
    limit 1;

    if found then
      v_contact_id := v_contact.id;
    end if;
  end if;

  if v_contact_id is null then
    if v_name is null then
      raise exception 'Nome é obrigatório para cadastrar um novo contato' using errcode = '22023';
    end if;

    v_first_name := split_part(v_name, ' ', 1);
    v_last_name := case
      when strpos(v_name, ' ') > 0 then substr(v_name, strpos(v_name, ' ') + 1)
      else ''
    end;

    begin
      insert into public.contacts (
        id,
        first_name,
        last_name,
        email,
        whatsapp,
        organization,
        position,
        communication_status,
        origin,
        incomplete_profile,
        created_by
      ) values (
        gen_random_uuid()::text,
        v_first_name,
        v_last_name,
        v_email,
        v_phone,
        v_company,
        v_position,
        'active',
        'reception_confirmation',
        v_email is null and v_phone is null,
        (select auth.uid())
      )
      returning * into v_contact;
      v_created_contact := true;
    exception when unique_violation then
      if v_email is null then
        raise;
      end if;

      select * into v_contact
      from public.contacts
      where email = v_email or email_secondary = v_email
      order by updated_at desc
      limit 1;

      if not found then
        raise;
      end if;
    end;

    v_contact_id := v_contact.id;
  end if;

  v_name := coalesce(v_name, nullif(trim(concat_ws(' ', v_contact.first_name, v_contact.last_name)), ''));
  v_email := coalesce(v_email, v_contact.email, v_contact.email_secondary);
  v_phone := coalesce(v_phone, v_contact.whatsapp, v_contact.phone, v_contact.phone_secondary);
  v_company := coalesce(v_company, v_contact.organization);
  v_position := coalesce(v_position, v_contact.position);

  select * into v_registration
  from public.event_registrations
  where event_id = p_event_id
    and (
      contact_id = v_contact_id
      or (v_email is not null and email = v_email)
    )
  order by (approval_status = 'approved') desc, registered_at desc
  limit 1;

  if found then
    v_already_confirmed := v_registration.approval_status = 'approved';

    update public.event_registrations
    set
      contact_id = coalesce(contact_id, v_contact_id),
      name = coalesce(nullif(name, ''), v_name),
      email = coalesce(email, v_email),
      phone = coalesce(phone, v_phone),
      company = coalesce(company, v_company),
      position = coalesce(position, v_position),
      approval_status = 'approved'
    where id = v_registration.id
    returning * into v_registration;
  else
    insert into public.event_registrations (
      id,
      event_id,
      contact_id,
      name,
      first_name,
      last_name,
      email,
      phone,
      company,
      position,
      registered_at,
      approval_status,
      source,
      custom_data
    ) values (
      gen_random_uuid()::text,
      p_event_id,
      v_contact_id,
      v_name,
      v_contact.first_name,
      v_contact.last_name,
      v_email,
      v_phone,
      v_company,
      v_position,
      now(),
      'approved',
      'invited',
      jsonb_build_object('confirmation_source', 'reception_manual')
    )
    returning * into v_registration;
  end if;

  return jsonb_build_object(
    'contact_id', v_contact_id,
    'registration_id', v_registration.id,
    'created_contact', v_created_contact,
    'already_confirmed', v_already_confirmed
  );
end;
$$;

revoke all on function public.add_event_confirmation(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.add_event_confirmation(text, text, text, text, text, text, text) to authenticated;
