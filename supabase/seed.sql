-- Dados sintéticos para desenvolvimento local. Não inclua dados pessoais reais.

insert into public.events (
  id, title, description, status, type, format, date, start_time, end_time,
  venue, address, city, state, capacity, organizations, sectors,
  responsavel, luma_url
) values (
  'evt-mercosul-ue-2026',
  'Oportunidades RS e Acordo Mercosul–UE',
  'Painel sobre oportunidades comerciais para o Rio Grande do Sul.',
  'upcoming',
  'Painel',
  'presencial',
  '2026-09-01',
  '13:30',
  '14:00',
  'Arena do Governo do Rio Grande do Sul — Pavilhão Internacional',
  'Parque Assis Brasil',
  'Esteio',
  'RS',
  70,
  array['Invest RS', 'AHK-RS', 'CCIRS'],
  array['Comércio Internacional e Exportações', 'Agronegócio e Bioeconomia'],
  'Equipe Invest RS',
  null
)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  status = excluded.status,
  date = excluded.date,
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  venue = excluded.venue,
  capacity = excluded.capacity,
  organizations = excluded.organizations,
  sectors = excluded.sectors,
  responsavel = excluded.responsavel;

insert into public.contacts (
  id, first_name, last_name, email, organization, position,
  communication_status, origin, country
) values
  ('demo-contact-01', 'Ana', 'Silva', 'ana.silva@example.invalid', 'Empresa Gaúcha A', 'Diretora', 'active', 'luma', 'Brasil'),
  ('demo-contact-02', 'Bruno', 'Costa', 'bruno.costa@example.invalid', 'Entidade Setorial B', 'Gerente', 'active', 'luma', 'Brasil'),
  ('demo-contact-03', 'Carla', 'Oliveira', 'carla.oliveira@example.invalid', 'Indústria C', 'Analista', 'active', 'luma', 'Brasil'),
  ('demo-contact-04', 'Daniel', 'Souza', 'daniel.souza@example.invalid', 'Câmara de Comércio D', 'Executivo', 'active', 'luma', 'Brasil'),
  ('demo-contact-05', 'Elisa', 'Ferreira', 'elisa.ferreira@example.invalid', 'Instituição E', 'Coordenadora', 'active', 'luma', 'Brasil')
on conflict (id) do update set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  email = excluded.email,
  organization = excluded.organization,
  position = excluded.position,
  communication_status = excluded.communication_status,
  origin = excluded.origin,
  country = excluded.country;

insert into public.event_registrations (
  id, event_id, contact_id, luma_guest_id, name, email, company, position,
  registered_at, approval_status, source
) values
  ('demo-registration-01', 'evt-mercosul-ue-2026', 'demo-contact-01', 'demo-guest-01', 'Ana Silva', 'ana.silva@example.invalid', 'Empresa Gaúcha A', 'Diretora', '2026-08-27T10:00:00Z', 'approved', 'luma'),
  ('demo-registration-02', 'evt-mercosul-ue-2026', 'demo-contact-02', 'demo-guest-02', 'Bruno Costa', 'bruno.costa@example.invalid', 'Entidade Setorial B', 'Gerente', '2026-08-27T11:00:00Z', 'approved', 'luma'),
  ('demo-registration-03', 'evt-mercosul-ue-2026', 'demo-contact-03', 'demo-guest-03', 'Carla Oliveira', 'carla.oliveira@example.invalid', 'Indústria C', 'Analista', '2026-08-28T09:30:00Z', 'approved', 'luma'),
  ('demo-registration-04', 'evt-mercosul-ue-2026', 'demo-contact-04', 'demo-guest-04', 'Daniel Souza', 'daniel.souza@example.invalid', 'Câmara de Comércio D', 'Executivo', '2026-08-28T14:00:00Z', 'approved', 'luma'),
  ('demo-registration-05', 'evt-mercosul-ue-2026', 'demo-contact-05', 'demo-guest-05', 'Elisa Ferreira', 'elisa.ferreira@example.invalid', 'Instituição E', 'Coordenadora', '2026-08-29T16:15:00Z', 'approved', 'luma')
on conflict (id) do update set
  contact_id = excluded.contact_id,
  luma_guest_id = excluded.luma_guest_id,
  name = excluded.name,
  email = excluded.email,
  company = excluded.company,
  position = excluded.position,
  registered_at = excluded.registered_at,
  approval_status = excluded.approval_status,
  source = excluded.source;
