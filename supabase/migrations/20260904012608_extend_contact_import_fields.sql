alter table public.contacts
  add column if not exists phone_secondary text;

alter table public.organizations
  add column if not exists phone text,
  add column if not exists phone_secondary text,
  add column if not exists emails text[] not null default '{}'::text[],
  add column if not exists channel_types text[] not null default '{}'::text[];
