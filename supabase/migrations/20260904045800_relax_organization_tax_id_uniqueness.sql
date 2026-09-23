drop index if exists public.organizations_tax_id_unique_idx;

create index if not exists organizations_tax_id_idx
  on public.organizations (lower(regexp_replace(tax_id, '[^a-zA-Z0-9]', '', 'g')))
  where nullif(btrim(tax_id), '') is not null;
