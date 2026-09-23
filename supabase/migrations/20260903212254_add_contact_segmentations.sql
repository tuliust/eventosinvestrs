create table public.segments (
  id text primary key default gen_random_uuid()::text,
  name text not null unique,
  description text,
  color text not null default '#009C63'
    check (color ~ '^#[0-9A-Fa-f]{6}$'),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subsegments (
  id text primary key default gen_random_uuid()::text,
  segment_id text not null references public.segments(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (segment_id, name),
  unique (segment_id, id)
);

create table public.contact_segmentations (
  id text primary key default gen_random_uuid()::text,
  contact_id text not null references public.contacts(id) on delete cascade,
  segment_id text not null references public.segments(id) on delete cascade,
  subsegment_id text,
  created_at timestamptz not null default now(),
  constraint contact_segmentations_subsegment_fk
    foreign key (segment_id, subsegment_id)
    references public.subsegments(segment_id, id)
    on delete cascade,
  unique nulls not distinct (contact_id, segment_id, subsegment_id)
);

create index segments_sort_order_idx on public.segments (sort_order, name);
create index subsegments_segment_id_idx on public.subsegments (segment_id, sort_order, name);
create index contact_segmentations_contact_id_idx on public.contact_segmentations (contact_id);
create index contact_segmentations_segment_id_idx on public.contact_segmentations (segment_id);
create index contact_segmentations_subsegment_id_idx on public.contact_segmentations (subsegment_id);

create trigger segments_set_updated_at before update on public.segments
  for each row execute function public.set_updated_at();
create trigger subsegments_set_updated_at before update on public.subsegments
  for each row execute function public.set_updated_at();

alter table public.segments enable row level security;
alter table public.subsegments enable row level security;
alter table public.contact_segmentations enable row level security;

create policy segments_staff_read on public.segments
  for select to authenticated using ((select public.is_active_staff()));
create policy segments_admin_insert on public.segments
  for insert to authenticated with check ((select public.current_user_role()) = 'admin');
create policy segments_admin_update on public.segments
  for update to authenticated using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');
create policy segments_admin_delete on public.segments
  for delete to authenticated using ((select public.current_user_role()) = 'admin');

create policy subsegments_staff_read on public.subsegments
  for select to authenticated using ((select public.is_active_staff()));
create policy subsegments_admin_insert on public.subsegments
  for insert to authenticated with check ((select public.current_user_role()) = 'admin');
create policy subsegments_admin_update on public.subsegments
  for update to authenticated using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');
create policy subsegments_admin_delete on public.subsegments
  for delete to authenticated using ((select public.current_user_role()) = 'admin');

create policy contact_segmentations_staff_read on public.contact_segmentations
  for select to authenticated using ((select public.is_active_staff()));
create policy contact_segmentations_admin_insert on public.contact_segmentations
  for insert to authenticated with check ((select public.current_user_role()) = 'admin');
create policy contact_segmentations_admin_update on public.contact_segmentations
  for update to authenticated using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');
create policy contact_segmentations_admin_delete on public.contact_segmentations
  for delete to authenticated using ((select public.current_user_role()) = 'admin');

revoke all on table public.segments, public.subsegments, public.contact_segmentations from anon;
grant select on table public.segments, public.subsegments, public.contact_segmentations to authenticated;
grant insert, update, delete on table public.segments, public.subsegments, public.contact_segmentations to authenticated;

insert into public.segments (name, description, sort_order)
values
  ('Agronegócio e Bioeconomia', 'Cadeias produtivas agropecuárias e soluções de bioeconomia.', 10),
  ('Energia e Infraestrutura', 'Energia, saneamento e infraestrutura estratégica.', 20),
  ('Tecnologia e Inovação', 'Tecnologia, semicondutores, software e inovação.', 30),
  ('Saúde e Ciências da Vida', 'Saúde, biotecnologia e equipamentos médicos.', 40),
  ('Indústria de Base e Mineração', 'Indústrias de base, transformação e mineração.', 50),
  ('Defesa e Segurança', 'Soluções para defesa, segurança e proteção.', 60),
  ('Serviços Financeiros e Fintechs', 'Serviços financeiros, crédito e fintechs.', 70),
  ('Logística e Mobilidade', 'Logística, transportes e mobilidade.', 80),
  ('Construção Civil e Imobiliário', 'Construção, desenvolvimento urbano e mercado imobiliário.', 90),
  ('Economia Criativa e Turismo', 'Turismo, cultura, audiovisual e economia criativa.', 100),
  ('Educação e Capacitação', 'Educação, formação e desenvolvimento de talentos.', 110),
  ('Comércio Internacional e Exportações', 'Internacionalização, comércio exterior e exportações.', 120)
on conflict (name) do nothing;
