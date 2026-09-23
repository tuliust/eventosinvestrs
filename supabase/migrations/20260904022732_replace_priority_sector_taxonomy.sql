alter table public.segments disable trigger audit_segments_after_change;
alter table public.subsegments disable trigger audit_subsegments_after_change;

do $$
declare
  v_link_count integer;
begin
  select count(*)::integer
    into v_link_count
    from public.contact_segmentations cs
    join public.segments s on s.id = cs.segment_id
   where s.name = any(array[
     'Agronegócio e Bioeconomia','Energia e Infraestrutura','Tecnologia e Inovação','Saúde e Ciências da Vida',
     'Indústria de Base e Mineração','Defesa e Segurança','Serviços Financeiros e Fintechs','Logística e Mobilidade',
     'Construção Civil e Imobiliário','Economia Criativa e Turismo','Educação e Capacitação','Comércio Internacional e Exportações'
   ]::text[]);

  if v_link_count > 0 then
    raise exception 'Não é possível substituir a taxonomia: existem % vínculos de contatos nos setores legados.', v_link_count;
  end if;

  delete from public.segments
   where name = any(array[
     'Agronegócio e Bioeconomia','Energia e Infraestrutura','Tecnologia e Inovação','Saúde e Ciências da Vida',
     'Indústria de Base e Mineração','Defesa e Segurança','Serviços Financeiros e Fintechs','Logística e Mobilidade',
     'Construção Civil e Imobiliário','Economia Criativa e Turismo','Educação e Capacitação','Comércio Internacional e Exportações'
   ]::text[]);
end;
$$;

with desired(name, sort_order) as (
  values
    ('Cadeia agropecuária',10),
    ('Cadeia automotiva',20),
    ('Cadeia petroquímica',30),
    ('Fertilizantes',40),
    ('Máquinas agrícolas',50),
    ('Máquinas, equipamentos e semicondutores',60),
    ('Produtos de transição energética',70),
    ('Produtos e serviços digitais',80),
    ('Produtos regionais',90),
    ('Saúde — equipamentos médicos',100),
    ('Silvicultura, papel e celulose',110),
    ('Turismo',120)
)
insert into public.segments (id, name, description, color, active, sort_order)
select gen_random_uuid(), name, null, '#009C63', true, sort_order
from desired
on conflict (name) do update
set active = true,
    sort_order = excluded.sort_order;

with taxonomy as (
  select '{"Cadeia agropecuária":["Agricultura de precisão","Arroz","Avicultura","Bovinocultura de corte","Bovinocultura de leite","Cooperativas agropecuárias","Fruticultura","Horticultura","Insumos agropecuários","Irrigação e gestão hídrica","Milho","Produção de sementes","Proteína animal","Soja","Suinocultura"],"Cadeia automotiva":["Autopeças e componentes","Automação automotiva","Caminhões e veículos pesados","Carrocerias e implementos rodoviários","Concessionárias e distribuição","Eletromobilidade","Fundição e metalurgia automotiva","Máquinas e equipamentos para montadoras","Manutenção e reparação automotiva","Motocicletas e veículos leves","Pneus e componentes de borracha","Sistemas elétricos e eletrônicos","Software e tecnologia automotiva","Veículos especiais","Veículos leves"],"Cadeia petroquímica":["Adesivos e selantes","Bioplásticos","Borrachas e elastômeros","Combustíveis e derivados","Distribuição de produtos químicos","Embalagens plásticas","Gases industriais","Indústria química de base","Lubrificantes","Materiais compostos","Petroquímica de primeira geração","Petroquímica de segunda geração","Plásticos e resinas","Reciclagem química e de plásticos","Tintas, vernizes e revestimentos"],"Fertilizantes":["Adubos especiais","Biofertilizantes","Corretivos de solo","Distribuição de fertilizantes","Fertilizantes fosfatados","Fertilizantes nitrogenados","Fertilizantes organominerais","Fertilizantes potássicos","Fertilizantes solúveis","Formulação e mistura NPK","Inoculantes e bioinsumos","Logística e armazenagem de fertilizantes","Matérias-primas para fertilizantes","Nutrição foliar","Tecnologia e análise de solos"],"Máquinas agrícolas":["Agricultura de precisão embarcada","Arados e grades","Colheitadeiras","Equipamentos de irrigação","Equipamentos para armazenagem de grãos","Equipamentos para pecuária","Implementos agrícolas","Máquinas para agricultura familiar","Máquinas para silvicultura","Plantadeiras e semeadoras","Peças e componentes agrícolas","Pulverizadores","Robótica agrícola","Secadores e beneficiamento de grãos","Tratores"],"Máquinas, equipamentos e semicondutores":["Automação industrial","Componentes eletrônicos","Equipamentos de energia","Equipamentos de movimentação de cargas","Equipamentos elétricos","Ferramentas e equipamentos industriais","Máquinas para alimentos e bebidas","Máquinas para construção civil","Máquinas para madeira e mobiliário","Máquinas para metalurgia","Máquinas para plásticos e borracha","Microeletrônica","Robótica industrial","Semicondutores e circuitos integrados","Sensores e sistemas embarcados"],"Produtos de transição energética":["Armazenamento de energia","Biocombustíveis","Biogás","Biometano","Captura, utilização e armazenamento de carbono","Eficiência energética","Energia eólica","Energia solar","Geração distribuída","Hidrogênio de baixa emissão","Mobilidade elétrica","Redes elétricas inteligentes","Soluções de descarbonização","Tratamento e valorização de resíduos","Transmissão e distribuição de energia"],"Produtos e serviços digitais":["Agritechs","Cibersegurança","Computação em nuvem","Desenvolvimento de software","E-commerce e marketplaces","Edtechs","Fintechs","Games e entretenimento digital","Govtechs","Inteligência artificial e dados","Internet das Coisas","Plataformas SaaS","Serviços de tecnologia da informação","Telecomunicações e conectividade","Transformação digital e automação"],"Produtos regionais":["Alimentos artesanais","Artesanato e economia criativa","Azeites de oliva","Bebidas artesanais","Cachaças e destilados","Carnes e embutidos","Chocolates e doces","Erva-mate","Farinhas, pães e massas","Laticínios e queijos","Produtos coloniais","Produtos com indicação geográfica","Produtos orgânicos","Uvas, vinhos e espumantes","Vestuário, couro e calçados regionais"],"Saúde — equipamentos médicos":["Diagnóstico por imagem","Equipamentos cirúrgicos","Equipamentos de diagnóstico","Equipamentos de fisioterapia","Equipamentos de laboratório","Equipamentos hospitalares","Equipamentos odontológicos","Instrumentos médicos","Materiais e consumíveis hospitalares","Monitoramento de pacientes","Órteses e próteses","Saúde digital e telemedicina","Software para gestão da saúde","Tecnologias assistivas","Tecnologias para esterilização"],"Silvicultura, papel e celulose":["Bioprodutos de base florestal","Celulose","Embalagens de papel e papelão","Energia de biomassa florestal","Equipamentos para silvicultura","Florestas plantadas","Manejo e certificação florestal","Madeira processada","Móveis e componentes","Painéis de madeira","Papel gráfico e para impressão","Papel tissue e produtos sanitários","Produtos químicos para papel e celulose","Reciclagem de papel","Serviços e tecnologia florestal"],"Turismo":["Agências e operadoras de turismo","Ecoturismo","Enoturismo","Gastronomia e turismo gastronômico","Hotelaria e meios de hospedagem","Parques e atrações turísticas","Turismo cultural e histórico","Turismo de aventura","Turismo de eventos e negócios","Turismo de fronteira e compras","Turismo de natureza","Turismo de saúde e bem-estar","Turismo náutico","Turismo religioso","Turismo rural"]}'::jsonb as data
), expanded as (
  select entry.key as segment_name,
         item.value as subsegment_name,
         (item.ordinality * 10)::integer as sort_order
  from taxonomy t
  cross join lateral jsonb_each(t.data) as entry(key, value)
  cross join lateral jsonb_array_elements_text(entry.value) with ordinality as item(value, ordinality)
)
insert into public.subsegments (id, segment_id, name, active, sort_order)
select gen_random_uuid(), s.id, e.subsegment_name, true, e.sort_order
from expanded e
join public.segments s on s.name = e.segment_name
on conflict (segment_id, name) do update
set active = true,
    sort_order = excluded.sort_order;

alter table public.segments enable trigger audit_segments_after_change;
alter table public.subsegments enable trigger audit_subsegments_after_change;