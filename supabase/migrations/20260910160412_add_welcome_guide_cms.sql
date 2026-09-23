create table public.welcome_guide_documents (
  key text primary key,
  content jsonb not null default '{"version":1,"text":{},"media":{}}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint welcome_guide_documents_key_check check (key in ('draft', 'published'))
);

alter table public.welcome_guide_documents enable row level security;

grant select on table public.welcome_guide_documents to anon, authenticated;
grant update on table public.welcome_guide_documents to authenticated;

create policy welcome_guide_public_read on public.welcome_guide_documents for select to anon using (key = 'published');
create policy welcome_guide_authenticated_read_published on public.welcome_guide_documents for select to authenticated using (key = 'published');
create policy welcome_guide_admin_read_all on public.welcome_guide_documents for select to authenticated using ((select public.current_user_role()) = 'admin');
create policy welcome_guide_admin_update on public.welcome_guide_documents for update to authenticated using ((select public.current_user_role()) = 'admin') with check ((select public.current_user_role()) = 'admin');

insert into public.welcome_guide_documents (key, content)
values ('draft', '{"version":1,"text":{},"media":{}}'::jsonb), ('published', '{"version":1,"text":{},"media":{}}'::jsonb);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('welcome-guide-media','welcome-guide-media',true,10485760,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy welcome_guide_media_admin_select on storage.objects for select to authenticated using (bucket_id='welcome-guide-media' and (select public.current_user_role())='admin');
create policy welcome_guide_media_admin_insert on storage.objects for insert to authenticated with check (bucket_id='welcome-guide-media' and (select public.current_user_role())='admin');
create policy welcome_guide_media_admin_update on storage.objects for update to authenticated using (bucket_id='welcome-guide-media' and (select public.current_user_role())='admin') with check (bucket_id='welcome-guide-media' and (select public.current_user_role())='admin');
create policy welcome_guide_media_admin_delete on storage.objects for delete to authenticated using (bucket_id='welcome-guide-media' and (select public.current_user_role())='admin');
