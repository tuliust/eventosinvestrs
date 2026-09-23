create table if not exists public.event_communications (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events(id) on delete cascade,
  title text not null,
  subject text,
  channel text not null check (channel in ('email','beehiiv','luma','whatsapp','individual','other')),
  origin text not null default 'manual',
  sent_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  content_summary text,
  external_campaign_id text,
  external_status text,
  notes text,
  is_invitation boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_communication_recipients (
  id uuid primary key default gen_random_uuid(),
  communication_id uuid not null references public.event_communications(id) on delete cascade,
  contact_id text references public.contacts(id) on delete set null,
  email extensions.citext not null,
  match_status text not null default 'found' check (match_status in ('found','unmatched','blocked')),
  delivery_status text not null default 'registered',
  created_at timestamptz not null default now(),
  unique (communication_id, email)
);

create index if not exists event_communications_event_sent_idx on public.event_communications (event_id, sent_at desc);
create index if not exists event_communications_created_by_idx on public.event_communications (created_by);
create index if not exists event_communication_recipients_contact_idx on public.event_communication_recipients (contact_id) where contact_id is not null;
create index if not exists event_communication_recipients_email_idx on public.event_communication_recipients (email);

alter table public.event_communications enable row level security;
alter table public.event_communication_recipients enable row level security;

drop policy if exists event_communications_staff_read on public.event_communications;
create policy event_communications_staff_read on public.event_communications for select to authenticated using (public.is_active_staff());
drop policy if exists event_communications_admin_insert on public.event_communications;
create policy event_communications_admin_insert on public.event_communications for insert to authenticated with check (public.current_user_role() = 'admin' and created_by = auth.uid());
drop policy if exists event_communications_admin_update on public.event_communications;
create policy event_communications_admin_update on public.event_communications for update to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
drop policy if exists event_communications_admin_delete on public.event_communications;
create policy event_communications_admin_delete on public.event_communications for delete to authenticated using (public.current_user_role() = 'admin');

drop policy if exists event_communication_recipients_staff_read on public.event_communication_recipients;
create policy event_communication_recipients_staff_read on public.event_communication_recipients for select to authenticated using (public.is_active_staff());
drop policy if exists event_communication_recipients_admin_insert on public.event_communication_recipients;
create policy event_communication_recipients_admin_insert on public.event_communication_recipients for insert to authenticated with check (public.current_user_role() = 'admin');
drop policy if exists event_communication_recipients_admin_update on public.event_communication_recipients;
create policy event_communication_recipients_admin_update on public.event_communication_recipients for update to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
drop policy if exists event_communication_recipients_admin_delete on public.event_communication_recipients;
create policy event_communication_recipients_admin_delete on public.event_communication_recipients for delete to authenticated using (public.current_user_role() = 'admin');

drop trigger if exists set_event_communications_updated_at on public.event_communications;
create trigger set_event_communications_updated_at before update on public.event_communications for each row execute function public.set_updated_at();

create or replace function public.record_event_communication(
  p_event_id text, p_title text, p_subject text, p_channel text, p_origin text,
  p_sent_at timestamptz, p_content_summary text, p_external_campaign_id text,
  p_external_status text, p_notes text, p_is_invitation boolean, p_metadata jsonb,
  p_recipients jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_communication_id uuid := gen_random_uuid();
  v_recipient jsonb;
  v_email extensions.citext;
  v_contact_id text;
  v_match_status text;
  v_count integer := 0;
begin
  if public.current_user_role() <> 'admin' then raise exception 'Acesso restrito a administradores.'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Informe o título da comunicação.'; end if;
  if p_channel not in ('email','beehiiv','luma','whatsapp','individual','other') then raise exception 'Canal de comunicação inválido.'; end if;

  insert into public.event_communications (
    id, event_id, title, subject, channel, origin, sent_at, created_by,
    content_summary, external_campaign_id, external_status, notes, is_invitation, metadata, recipient_count
  ) values (
    v_communication_id, p_event_id, trim(p_title), nullif(trim(p_subject), ''), p_channel,
    coalesce(nullif(trim(p_origin), ''), 'manual'), coalesce(p_sent_at, now()), auth.uid(),
    nullif(trim(p_content_summary), ''), nullif(trim(p_external_campaign_id), ''),
    nullif(trim(p_external_status), ''), nullif(trim(p_notes), ''), coalesce(p_is_invitation, false),
    coalesce(p_metadata, '{}'::jsonb), 0
  );

  if jsonb_typeof(coalesce(p_recipients, '[]'::jsonb)) <> 'array' then raise exception 'Lista de destinatários inválida.'; end if;

  for v_recipient in select value from jsonb_array_elements(coalesce(p_recipients, '[]'::jsonb)) loop
    v_email := nullif(lower(trim(v_recipient->>'email')), '')::extensions.citext;
    if v_email is null then continue; end if;
    v_contact_id := nullif(v_recipient->>'contact_id', '');
    v_match_status := coalesce(nullif(v_recipient->>'match_status', ''), 'unmatched');
    if v_match_status not in ('found','unmatched','blocked') then v_match_status := 'unmatched'; end if;

    insert into public.event_communication_recipients (communication_id, contact_id, email, match_status, delivery_status)
    values (v_communication_id, v_contact_id, v_email, v_match_status, coalesce(nullif(v_recipient->>'delivery_status', ''), 'registered'))
    on conflict (communication_id, email) do nothing;
    if found then v_count := v_count + 1; end if;

    if coalesce(p_is_invitation, false) and v_match_status <> 'blocked' then
      insert into public.event_invites (id, event_id, contact_id, email, invited_at, invited_by, status)
      values (gen_random_uuid()::text, p_event_id, v_contact_id, v_email, coalesce(p_sent_at, now()), auth.uid(), 'sent')
      on conflict do nothing;
    end if;
  end loop;

  update public.event_communications set recipient_count = v_count where id = v_communication_id;
  return v_communication_id;
end;
$$;

grant execute on function public.record_event_communication(text,text,text,text,text,timestamptz,text,text,text,text,boolean,jsonb,jsonb) to authenticated;
revoke execute on function public.record_event_communication(text,text,text,text,text,timestamptz,text,text,text,text,boolean,jsonb,jsonb) from anon;

create or replace function private.audit_event_communication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (new.created_by, 'event_communication.created', 'event_communication', new.id::text,
    jsonb_build_object('event_id', new.event_id, 'channel', new.channel, 'origin', new.origin,
      'sent_at', new.sent_at, 'recipient_count', new.recipient_count,
      'external_campaign_id', new.external_campaign_id, 'is_invitation', new.is_invitation));
  return new;
end;
$$;

drop trigger if exists audit_event_communication_after_insert on public.event_communications;
drop trigger if exists audit_event_communication_after_update on public.event_communications;
create trigger audit_event_communication_after_update after update of recipient_count on public.event_communications for each row execute function private.audit_event_communication();
