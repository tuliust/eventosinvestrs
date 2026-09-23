create or replace function private.audit_contact_import()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    new.created_by,
    'contacts.imported',
    'contact_import',
    new.id::text,
    jsonb_build_object(
      'file_name', new.file_name,
      'contacts_created', new.contacts_created,
      'contacts_updated', new.contacts_updated,
      'organizations_created', new.organizations_created,
      'subsegments_created', new.subsegments_created,
      'skipped', new.skipped
    )
  );
  return new;
end;
$$;

create table if not exists public.contact_import_runs (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  contacts_created integer not null default 0,
  contacts_updated integer not null default 0,
  organizations_created integer not null default 0,
  subsegments_created integer not null default 0,
  skipped integer not null default 0,
  conflicts integer not null default 0,
  merge_mode text not null default 'fill_missing' check (merge_mode in ('fill_missing','overwrite')),
  summary jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.contact_import_runs enable row level security;
revoke all on table public.contact_import_runs from anon;
grant select on table public.contact_import_runs to authenticated;

create policy contact_import_runs_admin_select
on public.contact_import_runs
for select
to authenticated
using (public.current_user_role() = 'admin');

create index if not exists contact_import_runs_created_at_idx
  on public.contact_import_runs(created_at desc);
create index if not exists contact_import_runs_created_by_idx
  on public.contact_import_runs(created_by);

drop trigger if exists contact_import_runs_audit_insert on public.contact_import_runs;
create trigger contact_import_runs_audit_insert
after insert on public.contact_import_runs
for each row execute function private.audit_contact_import();

revoke all on function private.audit_contact_import() from public, anon, authenticated;
