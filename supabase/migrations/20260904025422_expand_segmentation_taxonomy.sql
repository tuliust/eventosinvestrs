-- Expande /segmentacoes sem alterar os IDs dos 12 setores prioritários existentes.

alter table public.segments
  add column if not exists segment_type text not null default 'priority';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'segments_segment_type_check'
      and conrelid = 'public.segments'::regclass
  ) then
    alter table public.segments
      add constraint segments_segment_type_check
      check (segment_type in ('priority', 'secondary'));
  end if;
end $$;

update public.segments
set segment_type = 'priority', color = '#009C63'
where name in (
  'Cadeia agropecuária',
  'Cadeia automotiva',
  'Cadeia petroquímica',
  'Fertilizantes',
  'Máquinas agrícolas',
  'Máquinas, equipamentos e semicondutores',
  'Produtos de transição energética',
  'Produtos e serviços digitais',
  'Produtos regionais',
  'Saúde — equipamentos médicos',
  'Silvicultura, papel e celulose',
  'Turismo'
);

insert into public.segments (id, name, description, color, active, sort_order, segment_type)
values
  ('seg-secondary-food-beverage', 'Alimentos e bebidas', null, '#F8B51E', true, 130, 'secondary'),
  ('seg-secondary-construction-real-estate', 'Construção civil e mercado imobiliário', null, '#F8B51E', true, 140, 'secondary'),
  ('seg-secondary-metalworking', 'Metalmecânico e metalurgia', null, '#F8B51E', true, 150, 'secondary'),
  ('seg-secondary-leather-footwear', 'Couro, calçados e componentes', null, '#F8B51E', true, 160, 'secondary'),
  ('seg-secondary-textile-fashion', 'Têxtil, confecção e moda', null, '#F8B51E', true, 170, 'secondary'),
  ('seg-secondary-wood-furniture', 'Madeira, móveis e design', null, '#F8B51E', true, 180, 'secondary'),
  ('seg-secondary-transport-logistics', 'Transporte, logística e mobilidade', null, '#F8B51E', true, 190, 'secondary'),
  ('seg-secondary-mining', 'Mineração e minerais', null, '#F8B51E', true, 200, 'secondary'),
  ('seg-secondary-environment-sanitation', 'Meio ambiente e saneamento', null, '#F8B51E', true, 210, 'secondary'),
  ('seg-secondary-creative-audiovisual', 'Economia criativa e audiovisual', null, '#F8B51E', true, 220, 'secondary'),
  ('seg-secondary-education-research', 'Educação, ciência e pesquisa', null, '#F8B51E', true, 230, 'secondary'),
  ('seg-secondary-finance-insurance', 'Serviços financeiros e seguros', null, '#F8B51E', true, 240, 'secondary'),
  ('seg-secondary-commerce-retail', 'Comércio e varejo', null, '#F8B51E', true, 250, 'secondary'),
  ('seg-secondary-business-services', 'Serviços empresariais e profissionais', null, '#F8B51E', true, 260, 'secondary'),
  ('seg-secondary-defense-aerospace-naval', 'Defesa, segurança, aeroespacial e naval', null, '#F8B51E', true, 270, 'secondary')
on conflict (name) do update set
  segment_type = excluded.segment_type,
  color = excluded.color,
  active = true,
  sort_order = excluded.sort_order;

with seed(segment_name, subsegment_name, sort_order) as (
  values
    ('Alimentos e bebidas', 'Alimentos processados', 10),
    ('Alimentos e bebidas', 'Bebidas não alcoólicas', 20),
    ('Alimentos e bebidas', 'Cervejas e bebidas alcoólicas', 30),
    ('Alimentos e bebidas', 'Panificação e confeitaria', 40),
    ('Alimentos e bebidas', 'Refrigeração e conservação de alimentos', 50),
    ('Construção civil e mercado imobiliário', 'Construção residencial', 10),
    ('Construção civil e mercado imobiliário', 'Construção comercial e industrial', 20),
    ('Construção civil e mercado imobiliário', 'Incorporação imobiliária', 30),
    ('Construção civil e mercado imobiliário', 'Materiais de construção', 40),
    ('Construção civil e mercado imobiliário', 'Engenharia, arquitetura e projetos', 50),
    ('Metalmecânico e metalurgia', 'Fundição', 10),
    ('Metalmecânico e metalurgia', 'Siderurgia', 20),
    ('Metalmecânico e metalurgia', 'Usinagem e ferramentaria', 30),
    ('Metalmecânico e metalurgia', 'Estruturas metálicas', 40),
    ('Metalmecânico e metalurgia', 'Componentes e produtos de metal', 50),
    ('Couro, calçados e componentes', 'Curtumes e processamento de couro', 10),
    ('Couro, calçados e componentes', 'Calçados', 20),
    ('Couro, calçados e componentes', 'Bolsas e artefatos de couro', 30),
    ('Couro, calçados e componentes', 'Componentes para calçados', 40),
    ('Couro, calçados e componentes', 'Máquinas e tecnologia calçadista', 50),
    ('Têxtil, confecção e moda', 'Fiação e tecelagem', 10),
    ('Têxtil, confecção e moda', 'Confecção e vestuário', 20),
    ('Têxtil, confecção e moda', 'Malharia', 30),
    ('Têxtil, confecção e moda', 'Têxteis técnicos', 40),
    ('Têxtil, confecção e moda', 'Moda e acessórios', 50),
    ('Madeira, móveis e design', 'Móveis residenciais', 10),
    ('Madeira, móveis e design', 'Móveis corporativos', 20),
    ('Madeira, móveis e design', 'Móveis planejados', 30),
    ('Madeira, móveis e design', 'Componentes e acessórios', 40),
    ('Madeira, móveis e design', 'Design e decoração', 50),
    ('Transporte, logística e mobilidade', 'Transporte rodoviário', 10),
    ('Transporte, logística e mobilidade', 'Transporte ferroviário', 20),
    ('Transporte, logística e mobilidade', 'Transporte aéreo', 30),
    ('Transporte, logística e mobilidade', 'Transporte aquaviário e portos', 40),
    ('Transporte, logística e mobilidade', 'Operadores logísticos e armazenagem', 50),
    ('Mineração e minerais', 'Extração mineral', 10),
    ('Mineração e minerais', 'Rochas ornamentais', 20),
    ('Mineração e minerais', 'Areia, argila e agregados', 30),
    ('Mineração e minerais', 'Cerâmica e minerais não metálicos', 40),
    ('Mineração e minerais', 'Serviços e tecnologia para mineração', 50),
    ('Meio ambiente e saneamento', 'Abastecimento de água', 10),
    ('Meio ambiente e saneamento', 'Esgotamento sanitário', 20),
    ('Meio ambiente e saneamento', 'Gestão de resíduos', 30),
    ('Meio ambiente e saneamento', 'Recuperação ambiental', 40),
    ('Meio ambiente e saneamento', 'Consultoria e tecnologia ambiental', 50),
    ('Economia criativa e audiovisual', 'Cinema e produção audiovisual', 10),
    ('Economia criativa e audiovisual', 'Publicidade e comunicação', 20),
    ('Economia criativa e audiovisual', 'Design e arquitetura criativa', 30),
    ('Economia criativa e audiovisual', 'Música e produção cultural', 40),
    ('Economia criativa e audiovisual', 'Editoras e produção de conteúdo', 50),
    ('Educação, ciência e pesquisa', 'Educação básica', 10),
    ('Educação, ciência e pesquisa', 'Ensino superior', 20),
    ('Educação, ciência e pesquisa', 'Educação profissional e técnica', 30),
    ('Educação, ciência e pesquisa', 'Pesquisa e desenvolvimento', 40),
    ('Educação, ciência e pesquisa', 'Capacitação e educação corporativa', 50),
    ('Serviços financeiros e seguros', 'Bancos e cooperativas de crédito', 10),
    ('Serviços financeiros e seguros', 'Seguradoras', 20),
    ('Serviços financeiros e seguros', 'Meios de pagamento', 30),
    ('Serviços financeiros e seguros', 'Crédito e financiamento', 40),
    ('Serviços financeiros e seguros', 'Investimentos e gestão de recursos', 50),
    ('Comércio e varejo', 'Comércio atacadista', 10),
    ('Comércio e varejo', 'Varejo alimentar', 20),
    ('Comércio e varejo', 'Varejo de bens de consumo', 30),
    ('Comércio e varejo', 'Shopping centers e centros comerciais', 40),
    ('Comércio e varejo', 'Distribuição e representação comercial', 50),
    ('Serviços empresariais e profissionais', 'Consultoria empresarial', 10),
    ('Serviços empresariais e profissionais', 'Serviços jurídicos', 20),
    ('Serviços empresariais e profissionais', 'Contabilidade e auditoria', 30),
    ('Serviços empresariais e profissionais', 'Recursos humanos e recrutamento', 40),
    ('Serviços empresariais e profissionais', 'Terceirização e serviços administrativos', 50),
    ('Defesa, segurança, aeroespacial e naval', 'Indústria de defesa', 10),
    ('Defesa, segurança, aeroespacial e naval', 'Segurança eletrônica', 20),
    ('Defesa, segurança, aeroespacial e naval', 'Tecnologia aeroespacial', 30),
    ('Defesa, segurança, aeroespacial e naval', 'Indústria naval', 40),
    ('Defesa, segurança, aeroespacial e naval', 'Drones e sistemas não tripulados', 50)
)
insert into public.subsegments (id, segment_id, name, active, sort_order)
select
  'sub-secondary-' || md5(s.id || ':' || seed.subsegment_name),
  s.id,
  seed.subsegment_name,
  true,
  seed.sort_order
from seed
join public.segments s on s.name = seed.segment_name
on conflict (segment_id, name) do update set
  active = true,
  sort_order = excluded.sort_order;

create table if not exists public.organization_types (
  id text primary key,
  name text not null unique,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.institutional_categories (
  id text primary key,
  name text not null unique,
  description text,
  organization_type_id text references public.organization_types(id) on delete set null,
  color text not null default '#E60456' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.institutional_subcategories (
  id text primary key,
  institutional_category_id text not null references public.institutional_categories(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institutional_category_id, name),
  unique (institutional_category_id, id)
);

create table if not exists public.special_categories (
  id text primary key,
  name text not null unique,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scopes (
  id text primary key,
  name text not null unique,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.government_spheres (
  id text primary key,
  name text not null unique,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.countries (
  id text primary key,
  name text not null unique,
  iso2 text unique,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.states (
  id text primary key,
  country_id text not null references public.countries(id) on delete cascade,
  code text not null,
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_id, code),
  unique (country_id, id)
);

create unique index if not exists organization_types_name_ci_unique on public.organization_types(lower(name));
create unique index if not exists institutional_categories_name_ci_unique on public.institutional_categories(lower(name));
create unique index if not exists institutional_subcategories_name_ci_unique on public.institutional_subcategories(institutional_category_id, lower(name));
create unique index if not exists special_categories_name_ci_unique on public.special_categories(lower(name));
create unique index if not exists scopes_name_ci_unique on public.scopes(lower(name));
create unique index if not exists government_spheres_name_ci_unique on public.government_spheres(lower(name));
create unique index if not exists countries_name_ci_unique on public.countries(lower(name));
create unique index if not exists states_name_ci_unique on public.states(country_id, lower(name));

insert into public.organization_types (id, name, sort_order) values
  ('orgtype-embassy-consulate', 'Embaixada ou consulado', 10),
  ('orgtype-government', 'Órgão governamental', 20),
  ('orgtype-public-agency', 'Secretaria ou agência pública', 30),
  ('orgtype-legislative', 'Poder Legislativo', 40),
  ('orgtype-judiciary-control', 'Poder Judiciário ou órgão de controle', 50),
  ('orgtype-business-entity', 'Entidade empresarial', 60),
  ('orgtype-professional-worker', 'Entidade profissional ou de trabalhadores', 70),
  ('orgtype-international-representation', 'Representação internacional', 80),
  ('orgtype-multilateral', 'Organismo multilateral', 90),
  ('orgtype-media', 'Imprensa ou mídia', 100),
  ('orgtype-communications-professional', 'Profissional de comunicação', 110),
  ('orgtype-event-producer', 'Produtora ou organizadora de eventos', 120),
  ('orgtype-education-research', 'Instituição de ensino ou pesquisa', 130),
  ('orgtype-innovation', 'Ecossistema de inovação', 140),
  ('orgtype-investor-financier', 'Investidor ou financiador', 150),
  ('orgtype-third-sector', 'Terceiro setor ou sociedade civil', 160),
  ('orgtype-cooperative', 'Cooperativa', 170),
  ('orgtype-event-supplier', 'Fornecedor ou prestador de eventos', 180),
  ('orgtype-leadership', 'Liderança ou personalidade', 190),
  ('orgtype-internal-partner', 'Público interno ou parceiro institucional', 200)
on conflict (id) do update set name = excluded.name, active = true, sort_order = excluded.sort_order;

insert into public.institutional_categories (id, name, organization_type_id, color, sort_order) values
  ('inst-embassies-consulates', 'Embaixadas e consulados', 'orgtype-embassy-consulate', '#E60456', 10),
  ('inst-government-bodies', 'Órgãos governamentais', 'orgtype-government', '#E60456', 20),
  ('inst-public-secretariats-agencies', 'Secretarias e agências públicas', 'orgtype-public-agency', '#E60456', 30),
  ('inst-legislative', 'Poder Legislativo', 'orgtype-legislative', '#E60456', 40),
  ('inst-judiciary-control', 'Poder Judiciário e órgãos de controle', 'orgtype-judiciary-control', '#E60456', 50),
  ('inst-business-entities', 'Entidades empresariais', 'orgtype-business-entity', '#E60456', 60),
  ('inst-professional-workers', 'Entidades profissionais e de trabalhadores', 'orgtype-professional-worker', '#E60456', 70),
  ('inst-international-representations', 'Representações internacionais', 'orgtype-international-representation', '#E60456', 80),
  ('inst-multilateral', 'Organismos multilaterais', 'orgtype-multilateral', '#E60456', 90),
  ('inst-media', 'Imprensa e mídia', 'orgtype-media', '#E60456', 100),
  ('inst-communications-professionals', 'Profissionais de comunicação', 'orgtype-communications-professional', '#E60456', 110),
  ('inst-event-producers', 'Produtoras e organizadoras de eventos', 'orgtype-event-producer', '#E60456', 120),
  ('inst-education-research', 'Instituições de ensino e pesquisa', 'orgtype-education-research', '#E60456', 130),
  ('inst-innovation', 'Ecossistema de inovação', 'orgtype-innovation', '#E60456', 140),
  ('inst-investors-financiers', 'Investidores e financiadores', 'orgtype-investor-financier', '#E60456', 150),
  ('inst-third-sector', 'Terceiro setor e sociedade civil', 'orgtype-third-sector', '#E60456', 160),
  ('inst-cooperatives', 'Cooperativas', 'orgtype-cooperative', '#E60456', 170),
  ('inst-event-suppliers', 'Fornecedores e prestadores de eventos', 'orgtype-event-supplier', '#E60456', 180),
  ('inst-leaderships', 'Lideranças e personalidades', 'orgtype-leadership', '#E60456', 190),
  ('inst-internal-partners', 'Público interno e parceiros institucionais', 'orgtype-internal-partner', '#E60456', 200)
on conflict (id) do update set
  name = excluded.name,
  organization_type_id = excluded.organization_type_id,
  color = '#E60456',
  active = true,
  sort_order = excluded.sort_order;

-- Subcategoria explicitamente usada no exemplo funcional do filtro.
insert into public.institutional_subcategories (id, institutional_category_id, name, sort_order)
values ('inst-sub-business-federation', 'inst-business-entities', 'Federação empresarial', 10)
on conflict (institutional_category_id, name) do update set active = true, sort_order = excluded.sort_order;

insert into public.special_categories (id, name, sort_order) values
  ('special-institutional-partner', 'Parceiro institucional', 10),
  ('special-organizer', 'Organizador', 20)
on conflict (id) do update set name = excluded.name, active = true, sort_order = excluded.sort_order;

insert into public.scopes (id, name, sort_order) values
  ('scope-municipal', 'Municipal', 10),
  ('scope-regional', 'Regional', 20),
  ('scope-state', 'Estadual', 30),
  ('scope-national', 'Nacional', 40),
  ('scope-international', 'Internacional', 50)
on conflict (id) do update set name = excluded.name, active = true, sort_order = excluded.sort_order;

insert into public.government_spheres (id, name, sort_order) values
  ('gov-municipal', 'Governo municipal', 10),
  ('gov-state', 'Governo estadual', 20),
  ('gov-federal', 'Governo federal', 30),
  ('gov-foreign', 'Governo estrangeiro', 40),
  ('gov-supranational', 'Organismo supranacional', 50),
  ('gov-na', 'Não se aplica', 60)
on conflict (id) do update set name = excluded.name, active = true, sort_order = excluded.sort_order;

insert into public.countries (id, name, iso2, sort_order)
values ('BR', 'Brasil', 'BR', 10)
on conflict (id) do update set name = excluded.name, iso2 = excluded.iso2, active = true;

insert into public.states (id, country_id, code, name, sort_order) values
  ('BR-AC', 'BR', 'AC', 'Acre', 10),
  ('BR-AL', 'BR', 'AL', 'Alagoas', 20),
  ('BR-AP', 'BR', 'AP', 'Amapá', 30),
  ('BR-AM', 'BR', 'AM', 'Amazonas', 40),
  ('BR-BA', 'BR', 'BA', 'Bahia', 50),
  ('BR-CE', 'BR', 'CE', 'Ceará', 60),
  ('BR-DF', 'BR', 'DF', 'Distrito Federal', 70),
  ('BR-ES', 'BR', 'ES', 'Espírito Santo', 80),
  ('BR-GO', 'BR', 'GO', 'Goiás', 90),
  ('BR-MA', 'BR', 'MA', 'Maranhão', 100),
  ('BR-MT', 'BR', 'MT', 'Mato Grosso', 110),
  ('BR-MS', 'BR', 'MS', 'Mato Grosso do Sul', 120),
  ('BR-MG', 'BR', 'MG', 'Minas Gerais', 130),
  ('BR-PA', 'BR', 'PA', 'Pará', 140),
  ('BR-PB', 'BR', 'PB', 'Paraíba', 150),
  ('BR-PR', 'BR', 'PR', 'Paraná', 160),
  ('BR-PE', 'BR', 'PE', 'Pernambuco', 170),
  ('BR-PI', 'BR', 'PI', 'Piauí', 180),
  ('BR-RJ', 'BR', 'RJ', 'Rio de Janeiro', 190),
  ('BR-RN', 'BR', 'RN', 'Rio Grande do Norte', 200),
  ('BR-RS', 'BR', 'RS', 'Rio Grande do Sul', 210),
  ('BR-RO', 'BR', 'RO', 'Rondônia', 220),
  ('BR-RR', 'BR', 'RR', 'Roraima', 230),
  ('BR-SC', 'BR', 'SC', 'Santa Catarina', 240),
  ('BR-SP', 'BR', 'SP', 'São Paulo', 250),
  ('BR-SE', 'BR', 'SE', 'Sergipe', 260),
  ('BR-TO', 'BR', 'TO', 'Tocantins', 270)
on conflict (id) do update set name = excluded.name, code = excluded.code, active = true, sort_order = excluded.sort_order;

alter table public.organizations
  add column if not exists primary_segment_id text,
  add column if not exists primary_subsegment_id text,
  add column if not exists organization_type_id text,
  add column if not exists institutional_category_id text,
  add column if not exists institutional_subcategory_id text,
  add column if not exists scope_id text,
  add column if not exists government_sphere_id text,
  add column if not exists country_id text,
  add column if not exists state_id text;

update public.organizations o
set primary_segment_id = s.id
from public.segments s
where o.primary_segment_id is null and o.sector = s.name;

update public.organizations o
set primary_subsegment_id = ss.id
from public.subsegments ss
where o.primary_segment_id = ss.segment_id
  and o.primary_subsegment_id is null
  and o.subsector = ss.name;

update public.organizations set country_id = 'BR'
where country_id is null and lower(coalesce(country, '')) in ('brasil', 'brazil');

update public.organizations set state_id = 'BR-RS'
where state_id is null and country_id = 'BR' and lower(coalesce(state, '')) in ('rs', 'rio grande do sul');

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'organizations_primary_segment_fk') then
    alter table public.organizations add constraint organizations_primary_segment_fk
      foreign key (primary_segment_id) references public.segments(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'organizations_primary_subsegment_fk') then
    alter table public.organizations add constraint organizations_primary_subsegment_fk
      foreign key (primary_segment_id, primary_subsegment_id)
      references public.subsegments(segment_id, id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'organizations_organization_type_fk') then
    alter table public.organizations add constraint organizations_organization_type_fk
      foreign key (organization_type_id) references public.organization_types(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'organizations_institutional_category_fk') then
    alter table public.organizations add constraint organizations_institutional_category_fk
      foreign key (institutional_category_id) references public.institutional_categories(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'organizations_institutional_subcategory_fk') then
    alter table public.organizations add constraint organizations_institutional_subcategory_fk
      foreign key (institutional_category_id, institutional_subcategory_id)
      references public.institutional_subcategories(institutional_category_id, id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'organizations_scope_fk') then
    alter table public.organizations add constraint organizations_scope_fk
      foreign key (scope_id) references public.scopes(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'organizations_government_sphere_fk') then
    alter table public.organizations add constraint organizations_government_sphere_fk
      foreign key (government_sphere_id) references public.government_spheres(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'organizations_country_fk') then
    alter table public.organizations add constraint organizations_country_fk
      foreign key (country_id) references public.countries(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'organizations_state_fk') then
    alter table public.organizations add constraint organizations_state_fk
      foreign key (country_id, state_id) references public.states(country_id, id) on delete set null;
  end if;
end $$;

create table if not exists public.organization_special_categories (
  organization_id text not null references public.organizations(id) on delete cascade,
  special_category_id text not null references public.special_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (organization_id, special_category_id)
);

create table if not exists public.contact_institutional_categories (
  id text primary key default gen_random_uuid()::text,
  contact_id text not null references public.contacts(id) on delete cascade,
  institutional_category_id text not null references public.institutional_categories(id) on delete restrict,
  institutional_subcategory_id text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contact_institutional_subcategory_fk') then
    alter table public.contact_institutional_categories add constraint contact_institutional_subcategory_fk
      foreign key (institutional_category_id, institutional_subcategory_id)
      references public.institutional_subcategories(institutional_category_id, id) on delete restrict;
  end if;
end $$;

create unique index if not exists contact_institutional_categories_unique
  on public.contact_institutional_categories(contact_id, institutional_category_id, institutional_subcategory_id) nulls not distinct;

create table if not exists public.contact_special_categories (
  contact_id text not null references public.contacts(id) on delete cascade,
  special_category_id text not null references public.special_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contact_id, special_category_id)
);

create index if not exists organizations_primary_segment_idx on public.organizations(primary_segment_id);
create index if not exists organizations_primary_subsegment_idx on public.organizations(primary_subsegment_id);
create index if not exists organizations_organization_type_idx on public.organizations(organization_type_id);
create index if not exists organizations_institutional_category_idx on public.organizations(institutional_category_id);
create index if not exists organizations_scope_idx on public.organizations(scope_id);
create index if not exists organizations_government_sphere_idx on public.organizations(government_sphere_id);
create index if not exists organizations_country_state_idx on public.organizations(country_id, state_id);
create index if not exists organization_special_categories_special_idx on public.organization_special_categories(special_category_id);
create index if not exists contact_institutional_categories_category_idx on public.contact_institutional_categories(institutional_category_id, institutional_subcategory_id);
create index if not exists contact_special_categories_special_idx on public.contact_special_categories(special_category_id);

-- Triggers de updated_at.
drop trigger if exists organization_types_set_updated_at on public.organization_types;
create trigger organization_types_set_updated_at before update on public.organization_types
for each row execute function public.set_updated_at();
drop trigger if exists institutional_categories_set_updated_at on public.institutional_categories;
create trigger institutional_categories_set_updated_at before update on public.institutional_categories
for each row execute function public.set_updated_at();
drop trigger if exists institutional_subcategories_set_updated_at on public.institutional_subcategories;
create trigger institutional_subcategories_set_updated_at before update on public.institutional_subcategories
for each row execute function public.set_updated_at();

-- Data API: grants explícitos para novas tabelas, conforme o comportamento atual do Supabase.
do $$
declare
  t text;
begin
  foreach t in array array[
    'organization_types','institutional_categories','institutional_subcategories',
    'special_categories','scopes','government_spheres','countries','states',
    'organization_special_categories','contact_institutional_categories','contact_special_categories'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff_read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_active_staff())',
      t || '_staff_read', t
    );
    execute format('drop policy if exists %I on public.%I', t || '_admin_manage', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.current_user_role() = ''admin'') with check (public.current_user_role() = ''admin'')',
      t || '_admin_manage', t
    );
  end loop;
end $$;

create or replace function private.audit_institutional_segmentation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity_type text;
  v_action text;
  v_id text;
  v_name text;
begin
  v_entity_type := case
    when tg_table_name = 'institutional_categories' then 'institutional_category'
    else 'institutional_subcategory'
  end;
  v_action := v_entity_type || case
    when tg_op = 'INSERT' then '.created'
    when tg_op = 'UPDATE' then '.updated'
    else '.deleted'
  end;
  v_id := coalesce(new.id, old.id)::text;
  v_name := coalesce(new.name, old.name);
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), v_action, v_entity_type, v_id, jsonb_build_object('name', v_name));
  return coalesce(new, old);
end;
$$;

revoke execute on function private.audit_institutional_segmentation_change() from public, anon, authenticated;

drop trigger if exists audit_institutional_categories_after_change on public.institutional_categories;
create trigger audit_institutional_categories_after_change
after insert or update or delete on public.institutional_categories
for each row execute function private.audit_institutional_segmentation_change();

drop trigger if exists audit_institutional_subcategories_after_change on public.institutional_subcategories;
create trigger audit_institutional_subcategories_after_change
after insert or update or delete on public.institutional_subcategories
for each row execute function private.audit_institutional_segmentation_change();
