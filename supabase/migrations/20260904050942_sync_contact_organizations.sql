create or replace function private.ensure_contact_organization()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_organization_id text;
  v_name text;
begin
  v_name := nullif(btrim(new.organization), '');

  if v_name is null then
    if tg_op = 'UPDATE' and new.organization is distinct from old.organization then
      new.organization_id := null;
    end if;
    return new;
  end if;

  if new.organization_id is not null
     and not (tg_op = 'UPDATE' and new.organization is distinct from old.organization) then
    return new;
  end if;

  select o.id
    into v_organization_id
  from public.organizations o
  where lower(regexp_replace(btrim(o.name), '\s+', ' ', 'g')) =
        lower(regexp_replace(v_name, '\s+', ' ', 'g'))
  order by o.created_at asc, o.id asc
  limit 1;

  if v_organization_id is null then
    v_organization_id := gen_random_uuid()::text;
    insert into public.organizations (id, name, type)
    values (v_organization_id, v_name, 'outro');
  end if;

  new.organization_id := v_organization_id;
  return new;
end;
$$;

revoke all on function private.ensure_contact_organization() from public, anon, authenticated;

drop trigger if exists contacts_ensure_organization on public.contacts;
create trigger contacts_ensure_organization
before insert or update of organization, organization_id on public.contacts
for each row
execute function private.ensure_contact_organization();

with contact_organizations as (
  select
    min(btrim(c.organization)) as name,
    lower(regexp_replace(btrim(c.organization), '\s+', ' ', 'g')) as normalized_name
  from public.contacts c
  where nullif(btrim(c.organization), '') is not null
  group by lower(regexp_replace(btrim(c.organization), '\s+', ' ', 'g'))
), missing as (
  select c.name
  from contact_organizations c
  where not exists (
    select 1
    from public.organizations o
    where lower(regexp_replace(btrim(o.name), '\s+', ' ', 'g')) = c.normalized_name
  )
)
insert into public.organizations (id, name, type)
select gen_random_uuid()::text, name, 'outro'
from missing;

update public.contacts c
set organization_id = (
  select o.id
  from public.organizations o
  where lower(regexp_replace(btrim(o.name), '\s+', ' ', 'g')) =
        lower(regexp_replace(btrim(c.organization), '\s+', ' ', 'g'))
  order by o.created_at asc, o.id asc
  limit 1
)
where nullif(btrim(c.organization), '') is not null
  and c.organization_id is null;
