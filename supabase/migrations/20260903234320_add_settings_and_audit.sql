create table public.app_settings (
  id text primary key default 'global' check (id = 'global'),
  platform_name text not null default 'Eventos Invest RS',
  organization_name text not null default 'Invest RS',
  default_state text not null default 'RS',
  default_country text not null default 'Brasil',
  timezone text not null default 'America/Sao_Paulo',
  logo_url text,
  default_event_owner text,
  frequent_organizations text[] not null default '{}',
  default_event_type text not null default 'painel',
  default_event_format text not null default 'presencial'
    check (default_event_format in ('presencial', 'online', 'hibrido')),
  default_capacity integer not null default 90 check (default_capacity >= 0),
  allow_walk_ins boolean not null default true,
  quick_registration_required_fields text[] not null default array['name']::text[],
  prevent_duplicate_checkin boolean not null default true,
  allow_undo_checkin boolean not null default true,
  reception_autofocus boolean not null default true,
  checkin_feedback text not null default 'visual'
    check (checkin_feedback in ('visual', 'sound', 'both', 'none')),
  realtime_refresh_seconds integer not null default 5
    check (realtime_refresh_seconds between 1 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id)
values ('global')
on conflict (id) do nothing;

create table public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.import_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source text not null default 'luma' check (source in ('luma', 'generic')),
  mapping jsonb not null default '{}'::jsonb,
  match_by text[] not null default array['email', 'phone', 'name']::text[]
    check (cardinality(match_by) > 0),
  unnamed_strategy text not null default 'keep_email'
    check (unnamed_strategy in ('keep_email', 'placeholder', 'reject')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index import_templates_name_unique
  on public.import_templates (lower(name));

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_id_idx on public.audit_logs (actor_id);
create index audit_logs_action_idx on public.audit_logs (action);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

create trigger import_templates_set_updated_at
  before update on public.import_templates
  for each row execute function public.set_updated_at();

alter table public.app_settings enable row level security;
alter table public.user_preferences enable row level security;
alter table public.import_templates enable row level security;
alter table public.audit_logs enable row level security;

create policy app_settings_staff_read on public.app_settings
  for select to authenticated
  using (public.is_active_staff());

create policy app_settings_admin_update on public.app_settings
  for update to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

create policy user_preferences_own_read on public.user_preferences
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy user_preferences_own_insert on public.user_preferences
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy user_preferences_own_update on public.user_preferences
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy user_preferences_own_delete on public.user_preferences
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy import_templates_admin_read on public.import_templates
  for select to authenticated
  using (public.current_user_role() = 'admin');

create policy import_templates_admin_insert on public.import_templates
  for insert to authenticated
  with check (
    public.current_user_role() = 'admin'
    and created_by = (select auth.uid())
  );

create policy import_templates_admin_update on public.import_templates
  for update to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

create policy import_templates_admin_delete on public.import_templates
  for delete to authenticated
  using (public.current_user_role() = 'admin');

create policy audit_logs_admin_read on public.audit_logs
  for select to authenticated
  using (public.current_user_role() = 'admin');

revoke all on public.app_settings from anon;
revoke all on public.user_preferences from anon;
revoke all on public.import_templates from anon;
revoke all on public.audit_logs from anon;

grant select, update on public.app_settings to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, insert, update, delete on public.import_templates to authenticated;
grant select on public.audit_logs to authenticated;

grant select, insert, update, delete on public.app_settings to service_role;
grant select, insert, update, delete on public.user_preferences to service_role;
grant select, insert, update, delete on public.import_templates to service_role;
grant select, insert, update, delete on public.audit_logs to service_role;

drop policy if exists profiles_admin_update on public.profiles;
revoke insert, update, delete, truncate on public.profiles from authenticated;
revoke all on public.profiles from anon;
grant select on public.profiles to authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.audit_settings_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    (select auth.uid()),
    'settings.updated',
    'app_settings',
    new.id,
    jsonb_build_object(
      'platform_name', new.platform_name,
      'organization_name', new.organization_name,
      'timezone', new.timezone
    )
  );
  return new;
end;
$$;

create or replace function private.audit_event_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'event.created';
  elsif old.status is distinct from new.status and new.status = 'cancelled' then
    v_action := 'event.cancelled';
  else
    v_action := 'event.updated';
  end if;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    (select auth.uid()),
    v_action,
    'event',
    new.id,
    jsonb_build_object(
      'title', new.title,
      'status', new.status,
      'date', new.date
    )
  );
  return new;
end;
$$;

create or replace function private.audit_checkin_undo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.undone_at is null and new.undone_at is not null then
    insert into public.audit_logs (
      actor_id, action, entity_type, entity_id, metadata
    ) values (
      coalesce(new.undone_by, (select auth.uid())),
      'checkin.undone',
      'event_attendance',
      new.id::text,
      jsonb_build_object(
        'event_id', new.event_id,
        'name', new.name,
        'checked_in_at', new.checked_in_at,
        'undone_at', new.undone_at
      )
    );
  end if;
  return new;
end;
$$;

create or replace function private.audit_import_template_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_id text;
  v_name text;
begin
  if tg_op = 'INSERT' then
    v_action := 'import_template.created';
    v_id := new.id::text;
    v_name := new.name;
  elsif tg_op = 'UPDATE' then
    v_action := 'import_template.updated';
    v_id := new.id::text;
    v_name := new.name;
  else
    v_action := 'import_template.deleted';
    v_id := old.id::text;
    v_name := old.name;
  end if;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    (select auth.uid()),
    v_action,
    'import_template',
    v_id,
    jsonb_build_object('name', v_name)
  );

  return coalesce(new, old);
end;
$$;

revoke execute on function private.audit_settings_change() from public, anon, authenticated;
revoke execute on function private.audit_event_change() from public, anon, authenticated;
revoke execute on function private.audit_checkin_undo() from public, anon, authenticated;
revoke execute on function private.audit_import_template_change() from public, anon, authenticated;

create trigger audit_app_settings_after_update
  after update on public.app_settings
  for each row execute function private.audit_settings_change();

create trigger audit_events_after_change
  after insert or update on public.events
  for each row execute function private.audit_event_change();

create trigger audit_event_attendances_after_update
  after update on public.event_attendances
  for each row execute function private.audit_checkin_undo();

create trigger audit_import_templates_after_change
  after insert or update or delete on public.import_templates
  for each row execute function private.audit_import_template_change();
