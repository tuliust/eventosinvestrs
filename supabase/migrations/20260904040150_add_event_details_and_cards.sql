create table if not exists public.event_details (
  event_id text primary key references public.events(id) on delete cascade,
  online_url text,
  card_url text,
  card_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_details_online_url_check
    check (online_url is null or online_url ~* '^https?://')
);

alter table public.event_details enable row level security;
revoke all on public.event_details from anon;
grant select, insert, update, delete on public.event_details to authenticated;
grant select, insert, update, delete on public.event_details to service_role;

drop policy if exists event_details_staff_read on public.event_details;
create policy event_details_staff_read
on public.event_details for select to authenticated
using (public.is_active_staff());

drop policy if exists event_details_admin_insert on public.event_details;
create policy event_details_admin_insert
on public.event_details for insert to authenticated
with check (public.current_user_role() = 'admin');

drop policy if exists event_details_admin_update on public.event_details;
create policy event_details_admin_update
on public.event_details for update to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists event_details_admin_delete on public.event_details;
create policy event_details_admin_delete
on public.event_details for delete to authenticated
using (public.current_user_role() = 'admin');

drop trigger if exists event_details_set_updated_at on public.event_details;
create trigger event_details_set_updated_at
before update on public.event_details
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-cards',
  'event-cards',
  true,
  8388608,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists event_cards_admin_insert on storage.objects;
create policy event_cards_admin_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'event-cards'
  and public.current_user_role() = 'admin'
);

drop policy if exists event_cards_admin_update on storage.objects;
create policy event_cards_admin_update
on storage.objects for update to authenticated
using (
  bucket_id = 'event-cards'
  and public.current_user_role() = 'admin'
)
with check (
  bucket_id = 'event-cards'
  and public.current_user_role() = 'admin'
);

drop policy if exists event_cards_admin_delete on storage.objects;
create policy event_cards_admin_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'event-cards'
  and public.current_user_role() = 'admin'
);

create or replace function private.audit_event_details_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    'event.details_updated',
    'event',
    coalesce(new.event_id, old.event_id),
    jsonb_build_object(
      'online_url_changed', coalesce(new.online_url, '') is distinct from coalesce(old.online_url, ''),
      'card_changed', coalesce(new.card_url, '') is distinct from coalesce(old.card_url, '')
    )
  );
  return coalesce(new, old);
end;
$$;

revoke execute on function private.audit_event_details_change() from public, anon, authenticated;

drop trigger if exists audit_event_details_after_change on public.event_details;
create trigger audit_event_details_after_change
after update on public.event_details
for each row execute function private.audit_event_details_change();
