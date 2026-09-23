alter table public.organizations
  add column if not exists tax_id text,
  add column if not exists classification_type text,
  add column if not exists involvement_type text,
  add column if not exists relationship_level integer,
  add column if not exists account_manager text,
  add column if not exists address text,
  add column if not exists description text;
