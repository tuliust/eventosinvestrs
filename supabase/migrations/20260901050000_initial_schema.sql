create extension if not exists citext with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email extensions.citext not null unique,
  name text not null,
  role text not null default 'receptionist' check (role in ('admin', 'receptionist')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  type text not null default 'outro' check (type in (
    'empresa_privada', 'imprensa', 'associacao', 'entidade',
    'orgao_governamental', 'embaixada_consulado', 'instituicao_financeira',
    'universidade_academia', 'outro'
  )),
  sector text,
  subsector text,
  site text,
  city text,
  state text,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contacts (
  id text primary key default gen_random_uuid()::text,
  first_name text not null,
  last_name text not null default '',
  email extensions.citext,
  email_secondary extensions.citext,
  whatsapp text,
  phone text,
  organization text,
  organization_id text references public.organizations(id) on delete set null,
  position text,
  seniority text,
  linkedin text,
  city text,
  state text,
  country text,
  relationship_type text,
  origin text,
  communication_status text not null default 'active'
    check (communication_status in ('active', 'unsubscribed', 'bounced', 'invalid')),
  incomplete_profile boolean not null default false,
  tags text[] not null default '{}',
  notes text,
  last_interaction timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index contacts_email_unique
  on public.contacts (email)
  where email is not null;

create table public.events (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'upcoming', 'live', 'completed', 'cancelled')),
  type text not null,
  format text not null check (format in ('presencial', 'online', 'hibrido')),
  date date not null,
  start_time text not null,
  end_time text not null,
  venue text,
  address text,
  city text,
  state text,
  capacity integer not null default 0 check (capacity >= 0),
  organizations text[] not null default '{}',
  sectors text[] not null default '{}',
  responsavel text,
  luma_url text,
  parent_event text references public.events(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_registrations (
  id text primary key default gen_random_uuid()::text,
  event_id text not null references public.events(id) on delete cascade,
  contact_id text references public.contacts(id) on delete set null,
  luma_guest_id text,
  name text not null,
  first_name text,
  last_name text,
  email extensions.citext,
  phone text,
  company text,
  position text,
  registered_at timestamptz not null default now(),
  approval_status text not null default 'approved'
    check (approval_status in ('approved', 'pending', 'rejected')),
  source text not null default 'luma'
    check (source in ('luma', 'invited', 'mailing', 'walk_in', 'qr')),
  qr_code_url text,
  custom_data jsonb not null default '{}',
  raw_import_data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, luma_guest_id)
);

create table public.event_invites (
  id text primary key default gen_random_uuid()::text,
  event_id text not null references public.events(id) on delete cascade,
  contact_id text not null references public.contacts(id) on delete cascade,
  invited_at timestamptz not null default now(),
  invited_by uuid not null references public.profiles(id),
  status text not null default 'sent'
    check (status in ('sent', 'opened', 'confirmed', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, contact_id)
);

create table public.event_attendances (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events(id) on delete cascade,
  contact_id text references public.contacts(id) on delete set null,
  registration_id text references public.event_registrations(id) on delete set null,
  name text not null,
  company text,
  position text,
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid not null references public.profiles(id),
  source text not null check (source in ('luma', 'invited', 'mailing', 'walk_in', 'qr')),
  undone_at timestamptz,
  undone_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index event_attendances_active_registration_unique
  on public.event_attendances (event_id, registration_id)
  where registration_id is not null and undone_at is null;

create unique index event_attendances_active_contact_unique
  on public.event_attendances (event_id, contact_id)
  where contact_id is not null and undone_at is null;

create index event_registrations_event_id_idx on public.event_registrations (event_id);
create index event_invites_event_id_idx on public.event_invites (event_id);
create index event_attendances_event_id_idx on public.event_attendances (event_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger organizations_set_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger contacts_set_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();
create trigger events_set_updated_at before update on public.events
  for each row execute function public.set_updated_at();
create trigger event_registrations_set_updated_at before update on public.event_registrations
  for each row execute function public.set_updated_at();
create trigger event_invites_set_updated_at before update on public.event_invites
  for each row execute function public.set_updated_at();
create trigger event_attendances_set_updated_at before update on public.event_attendances
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, email, name)
select
  id,
  email,
  coalesce(raw_user_meta_data ->> 'name', raw_user_meta_data ->> 'full_name', split_part(email, '@', 1))
from auth.users
where email is not null
on conflict (id) do nothing;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role
  from public.profiles
  where id = (select auth.uid()) and active = true
$$;

create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_user_role() in ('admin', 'receptionist'), false)
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.contacts enable row level security;
alter table public.events enable row level security;
alter table public.event_registrations enable row level security;
alter table public.event_invites enable row level security;
alter table public.event_attendances enable row level security;

create policy profiles_read_self_or_admin on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id or public.current_user_role() = 'admin');

create policy profiles_admin_update on public.profiles
  for update to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

create policy organizations_staff_read on public.organizations
  for select to authenticated using (public.is_active_staff());
create policy organizations_admin_insert on public.organizations
  for insert to authenticated with check (public.current_user_role() = 'admin');
create policy organizations_admin_update on public.organizations
  for update to authenticated using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');
create policy organizations_admin_delete on public.organizations
  for delete to authenticated using (public.current_user_role() = 'admin');

create policy contacts_staff_read on public.contacts
  for select to authenticated using (public.is_active_staff());
create policy contacts_admin_or_walkin_insert on public.contacts
  for insert to authenticated
  with check (
    public.current_user_role() = 'admin'
    or (
      public.current_user_role() = 'receptionist'
      and origin = 'walk_in'
      and created_by = (select auth.uid())
    )
  );
create policy contacts_admin_update on public.contacts
  for update to authenticated using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');
create policy contacts_admin_delete on public.contacts
  for delete to authenticated using (public.current_user_role() = 'admin');

create policy events_staff_read on public.events
  for select to authenticated using (public.is_active_staff());
create policy events_admin_insert on public.events
  for insert to authenticated with check (public.current_user_role() = 'admin');
create policy events_admin_update on public.events
  for update to authenticated using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');
create policy events_admin_delete on public.events
  for delete to authenticated using (public.current_user_role() = 'admin');

create policy registrations_staff_read on public.event_registrations
  for select to authenticated using (public.is_active_staff());
create policy registrations_admin_insert on public.event_registrations
  for insert to authenticated with check (public.current_user_role() = 'admin');
create policy registrations_admin_update on public.event_registrations
  for update to authenticated using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');
create policy registrations_admin_delete on public.event_registrations
  for delete to authenticated using (public.current_user_role() = 'admin');

create policy invites_staff_read on public.event_invites
  for select to authenticated using (public.is_active_staff());
create policy invites_admin_insert on public.event_invites
  for insert to authenticated with check (public.current_user_role() = 'admin');
create policy invites_admin_update on public.event_invites
  for update to authenticated using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');
create policy invites_admin_delete on public.event_invites
  for delete to authenticated using (public.current_user_role() = 'admin');

create policy attendances_staff_read on public.event_attendances
  for select to authenticated using (public.is_active_staff());

create or replace function public.check_in_event(
  p_attendance_id uuid,
  p_event_id text,
  p_contact_id text,
  p_registration_id text,
  p_name text,
  p_company text,
  p_position text,
  p_source text
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
    return v_attendance;
  end if;

  begin
    insert into public.event_attendances (
      id, event_id, contact_id, registration_id, name, company, position,
      checked_in_by, source
    ) values (
      p_attendance_id, p_event_id, v_contact_id, p_registration_id,
      trim(p_name), nullif(trim(p_company), ''), nullif(trim(p_position), ''),
      (select auth.uid()), p_source
    )
    returning * into v_attendance;
  exception when unique_violation then
    select * into v_attendance
    from public.event_attendances
    where event_id = p_event_id
      and undone_at is null
      and (
        (p_registration_id is not null and registration_id = p_registration_id)
        or (v_contact_id is not null and contact_id = v_contact_id)
      )
    limit 1;
  end;

  return v_attendance;
end;
$$;

create or replace function public.undo_event_checkin(
  p_event_id text,
  p_attendance_id uuid
)
returns public.event_attendances
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_attendance public.event_attendances;
begin
  if not public.is_active_staff() then
    raise exception 'Usuário sem permissão para desfazer check-in' using errcode = '42501';
  end if;

  update public.event_attendances
  set undone_at = now(), undone_by = (select auth.uid())
  where id = p_attendance_id and event_id = p_event_id and undone_at is null
  returning * into v_attendance;

  if not found then
    raise exception 'Check-in ativo não encontrado' using errcode = 'P0002';
  end if;

  return v_attendance;
end;
$$;

revoke all on table public.profiles from anon;
revoke all on table public.organizations from anon;
revoke all on table public.contacts from anon;
revoke all on table public.events from anon;
revoke all on table public.event_registrations from anon;
revoke all on table public.event_invites from anon;
revoke all on table public.event_attendances from anon;

grant select on public.profiles, public.organizations, public.contacts, public.events,
  public.event_registrations, public.event_invites, public.event_attendances to authenticated;
grant insert, update, delete on public.organizations, public.contacts, public.events,
  public.event_registrations, public.event_invites to authenticated;
grant update on public.profiles to authenticated;

revoke all on function public.check_in_event(uuid, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.undo_event_checkin(text, uuid) from public, anon;
revoke all on function public.current_user_role() from public, anon;
revoke all on function public.is_active_staff() from public, anon;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_active_staff() to authenticated;
grant execute on function public.check_in_event(uuid, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.undo_event_checkin(text, uuid) to authenticated;

alter publication supabase_realtime add table public.event_attendances;
