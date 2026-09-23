revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

create index if not exists contacts_created_by_idx
  on public.contacts (created_by);
create index if not exists contacts_organization_id_idx
  on public.contacts (organization_id);

create index if not exists event_attendances_checked_in_by_idx
  on public.event_attendances (checked_in_by);
create index if not exists event_attendances_contact_id_idx
  on public.event_attendances (contact_id);
create index if not exists event_attendances_registration_id_idx
  on public.event_attendances (registration_id);
create index if not exists event_attendances_undone_by_idx
  on public.event_attendances (undone_by);

create index if not exists event_invites_contact_id_idx
  on public.event_invites (contact_id);
create index if not exists event_invites_invited_by_idx
  on public.event_invites (invited_by);

create index if not exists event_registrations_contact_id_idx
  on public.event_registrations (contact_id);

create index if not exists events_created_by_idx
  on public.events (created_by);
create index if not exists events_parent_event_idx
  on public.events (parent_event);
