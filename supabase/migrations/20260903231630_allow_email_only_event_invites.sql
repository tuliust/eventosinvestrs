alter table public.event_invites
  add column email extensions.citext;

update public.event_invites as invite
set email = contact.email
from public.contacts as contact
where contact.id = invite.contact_id
  and invite.email is null;

alter table public.event_invites
  alter column contact_id drop not null;

alter table public.event_invites
  add constraint event_invites_contact_or_email_check
  check (contact_id is not null or email is not null);

alter table public.event_invites
  add constraint event_invites_event_email_key unique (event_id, email);

create index event_invites_email_idx
  on public.event_invites (email)
  where email is not null;
