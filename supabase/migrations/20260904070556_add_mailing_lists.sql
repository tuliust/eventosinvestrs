create table public.mailing_lists (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  event_id text null references public.events(id) on delete cascade,
  filters jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mailing_lists_event_id_idx on public.mailing_lists(event_id);
create index mailing_lists_created_by_idx on public.mailing_lists(created_by);
create index mailing_lists_updated_at_idx on public.mailing_lists(updated_at desc);

create table public.mailing_list_contacts (
  mailing_list_id uuid not null references public.mailing_lists(id) on delete cascade,
  contact_id text not null references public.contacts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (mailing_list_id, contact_id)
);

create index mailing_list_contacts_contact_id_idx on public.mailing_list_contacts(contact_id);

create trigger mailing_lists_set_updated_at
before update on public.mailing_lists
for each row execute function public.set_updated_at();

alter table public.mailing_lists enable row level security;
alter table public.mailing_list_contacts enable row level security;

revoke all on table public.mailing_lists from anon, authenticated;
revoke all on table public.mailing_list_contacts from anon, authenticated;
grant select, insert, update, delete on table public.mailing_lists to authenticated;
grant select, insert, delete on table public.mailing_list_contacts to authenticated;

create policy mailing_lists_staff_read
on public.mailing_lists for select
to authenticated
using (public.is_active_staff());

create policy mailing_lists_admin_insert
on public.mailing_lists for insert
to authenticated
with check (
  public.current_user_role() = 'admin'
  and created_by = (select auth.uid())
);

create policy mailing_lists_admin_update
on public.mailing_lists for update
to authenticated
using (public.current_user_role() = 'admin')
with check (
  public.current_user_role() = 'admin'
  and created_by is not null
);

create policy mailing_lists_admin_delete
on public.mailing_lists for delete
to authenticated
using (public.current_user_role() = 'admin');

create policy mailing_list_contacts_staff_read
on public.mailing_list_contacts for select
to authenticated
using (public.is_active_staff());

create policy mailing_list_contacts_admin_insert
on public.mailing_list_contacts for insert
to authenticated
with check (public.current_user_role() = 'admin');

create policy mailing_list_contacts_admin_delete
on public.mailing_list_contacts for delete
to authenticated
using (public.current_user_role() = 'admin');

create or replace function public.save_mailing_list(
  p_list_id uuid,
  p_title text,
  p_event_id text,
  p_filters jsonb,
  p_contact_ids text[]
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_id uuid := coalesce(p_list_id, gen_random_uuid());
  v_title text := btrim(coalesce(p_title, ''));
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Apenas administradores podem salvar mailings.';
  end if;

  if v_title = '' then
    raise exception 'Informe um título para o mailing.';
  end if;

  if p_event_id is not null and not exists (
    select 1 from public.events e where e.id = p_event_id
  ) then
    raise exception 'Evento não encontrado.';
  end if;

  if p_list_id is null then
    insert into public.mailing_lists (id, title, event_id, filters, created_by)
    values (
      v_id,
      v_title,
      p_event_id,
      coalesce(p_filters, '{}'::jsonb),
      (select auth.uid())
    );
  else
    update public.mailing_lists
    set title = v_title,
        event_id = p_event_id,
        filters = coalesce(p_filters, '{}'::jsonb)
    where id = v_id;

    if not found then
      raise exception 'Mailing não encontrado.';
    end if;
  end if;

  delete from public.mailing_list_contacts
  where mailing_list_id = v_id;

  insert into public.mailing_list_contacts (mailing_list_id, contact_id)
  select v_id, c.id
  from public.contacts c
  join (
    select distinct unnest(coalesce(p_contact_ids, '{}'::text[])) as contact_id
  ) selected on selected.contact_id = c.id;

  return v_id;
end;
$$;

revoke all on function public.save_mailing_list(uuid, text, text, jsonb, text[]) from public, anon;
grant execute on function public.save_mailing_list(uuid, text, text, jsonb, text[]) to authenticated;
