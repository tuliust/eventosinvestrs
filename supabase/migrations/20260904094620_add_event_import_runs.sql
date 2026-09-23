create table if not exists public.event_import_runs (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events(id) on delete cascade,
  source text not null default 'luma',
  file_name text not null,
  columns jsonb not null default '[]'::jsonb,
  mapping jsonb not null default '[]'::jsonb,
  total_count integer not null default 0,
  safe_count integer not null default 0,
  possible_count integer not null default 0,
  new_count integer not null default 0,
  ignored_count integer not null default 0,
  error_count integer not null default 0,
  imported_count integer not null default 0,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists event_import_runs_event_id_idx on public.event_import_runs(event_id, created_at desc);
create index if not exists event_import_runs_created_by_idx on public.event_import_runs(created_by);

alter table public.event_import_runs enable row level security;

drop policy if exists event_import_runs_staff_read on public.event_import_runs;
create policy event_import_runs_staff_read
on public.event_import_runs for select
to authenticated
using (public.is_active_staff());

drop policy if exists event_import_runs_admin_insert on public.event_import_runs;
create policy event_import_runs_admin_insert
on public.event_import_runs for insert
to authenticated
with check (public.current_user_role() = 'admin' and created_by = auth.uid());
