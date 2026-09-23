CRIE UMA APLICAÇÃO WEB FUNCIONAL PARA A INVEST RS

TIPO DE PRODUTO
Aplicação web interna responsiva, tablet-first, com comportamento de app e preparada para PWA.

NÃO crie um site institucional, landing page ou apenas um protótipo visual.

A aplicação deve ter:
- navegação funcional;
- formulários;
- busca;
- filtros;
- estados;
- regras de negócio;
- persistência de dados;
- conexão com Supabase;
- importação de CSV/XLSX;
- check-in de eventos.

Leia todos os arquivos anexados antes de começar. Use os anexos como referência real de identidade visual, mailing, evento e estrutura de dados.

==================================================
1. OBJETIVO DO PRODUTO
==================================================

Estamos criando uma plataforma interna da Invest RS para gestão de:

Contatos
Organizações
Mailing
Segmentações
Eventos
Convidados
Inscrições
Check-in
Histórico de relacionamento
Relatórios
Inteligência de relacionamento

O produto completo será um CRM institucional orientado a relacionamento e eventos.

Fluxo conceitual:

CONTATO
→ ORGANIZAÇÃO
→ SEGMENTAÇÃO
→ EVENTO
→ CONVITE
→ INSCRIÇÃO
→ PRESENÇA
→ HISTÓRICO

Porém, neste primeiro release, PRIORIZE o módulo de EVENTOS e CHECK-IN.

Não deixe funcionalidades futuras atrasarem o MVP.

==================================================
2. EVENTO INICIAL
==================================================

Criar como primeiro evento:

Título:
Oportunidades RS e Acordo Mercosul–UE

Data:
01/09/2026

Horário:
13h30 às 14h

Tipo:
Painel

Formato:
Presencial

Evento:
Expointer 2026

Local:
Arena do Governo do Rio Grande do Sul
Pavilhão Internacional
Parque Assis Brasil
Esteio/RS

Organização:
Invest RS
AHK-RS
CCIRS

Luma:
https://luma.com/po542ot8

Capacidade inicial:
70 pessoas

A capacidade deve ser EDITÁVEL pelo administrador e nunca hardcoded.

Utilize o card do evento e os materiais anexados como referência para descrição, participantes e identidade específica do evento.

==================================================
3. IDENTIDADE VISUAL
==================================================

Use o Guia Visual da Invest RS anexado como referência principal.

NÃO transforme slides em páginas web.

Traduza a linguagem da marca para um DESIGN SYSTEM DIGITAL.

Cores principais:

Carvão #3C3C3B
Verde #009C63
Magenta #E60456
Amarelo #F8B51E
Branco #FFFFFF

Tons claros:

#E8F4EF
#FCE7EF
#FFF4D6
#F4F4F1

Semântica:

Verde = sucesso, presença, concluído
Magenta = erro, crítico, bloqueio
Amarelo = atenção, aguardando, processamento
Carvão = estrutura e texto principal

Nunca comunicar status apenas por cor.

Usar cor + texto + badge ou ícone.

A interface deve ser:
institucional,
contemporânea,
limpa,
editorial,
profissional,
simples,
rápida.

Evitar aparência de:
SaaS genérico,
dashboard financeiro,
PowerPoint,
interface excessivamente colorida.

Use Gotham na interface se disponível.

Sixsound apenas em títulos institucionais ou destaques.

Se as fontes não estiverem disponíveis, usar Montserrat como fallback.

==================================================
4. RESPONSIVIDADE
==================================================

A aplicação deve funcionar em:

tablet landscape,
tablet portrait,
desktop,
notebook,
smartphone.

O principal dispositivo do primeiro evento será:

Xiaomi Redmi Pad SE
11 polegadas
1920 × 1200 pixels físicos
proporção 16:10
Android 15
HyperOS

IMPORTANTE:

Não criar layout fixo em 1920 × 1200.

A resolução física não corresponde necessariamente à viewport CSS do navegador.

Criar layout fluido utilizando:
CSS Grid,
Flexbox,
minmax(),
clamp(),
breakpoints responsivos.

Priorizar TABLET LANDSCAPE.

Touch targets:
mínimo recomendado de 48 × 48 CSS px.

Não depender de hover.

==================================================
5. NAVEGAÇÃO
==================================================

Criar arquitetura para:

Dashboard
Contatos
Organizações
Segmentações
Eventos
Relatórios
Configurações

IMPLEMENTAR COMPLETAMENTE AGORA:

Eventos
Página do evento
Convidados
Importação Luma
Check-in
Participantes
Cadastro rápido
Base de contatos necessária para essas operações

As demais áreas podem ficar estruturadas para expansão futura.

==================================================
6. CONTATOS E ORGANIZAÇÕES
==================================================

Contato e organização são entidades diferentes.

CONTACT deve contemplar:

Nome
Cargo
Senioridade
E-mail
E-mail secundário
WhatsApp
Telefone
Organização
LinkedIn
Cidade
Estado
País
Tipo de relacionamento
Origem
Última atualização
Última interação
Status de comunicação
Cadastro incompleto

Use UUID como ID.

Nunca use e-mail como primary key.

ORGANIZATION deve contemplar:

Nome
Tipo de organização
Setor prioritário
Subsetor
Site
Cidade
Estado
País

Tipos de organização:

Empresa privada
Imprensa
Associação
Entidade
Órgão governamental
Embaixada / Consulado
Instituição financeira
Universidade / Academia
Outro

IMPORTANTE:

Tipo de organização NÃO é setor econômico.

Uma associação pode, por exemplo, estar relacionada à Cadeia agropecuária.

==================================================
7. SETORES PRIORITÁRIOS
==================================================

A plataforma deve utilizar os 12 setores prioritários oficiais da Invest RS.

Use a base anexada para identificar a nomenclatura correta.

Criar também:

Subsetores.

Para empresa privada, permitir:

Pertence a setor prioritário?

Sim
Não
Não classificado

Quando Sim:
exigir setor.

==================================================
8. IMPORTAÇÃO DO MAILING
==================================================

Utilize o arquivo de mailing anexado como base real.

Criar importador de:

XLSX
CSV

Fluxo:

Arquivo
→ Preview
→ Mapeamento de colunas
→ Validação
→ Identificação de duplicidades
→ Importação

Não assumir que todos os arquivos terão exatamente as mesmas colunas.

Matching de contatos:

1. e-mail normalizado;
2. telefone normalizado;
3. nome + organização;
4. nome semelhante apenas como sugestão.

Nunca fazer merge automático apenas por nome.

==================================================
9. PÁGINA DO EVENTO
==================================================

A página de cada evento deve funcionar como um WORKSPACE.

Cabeçalho:

Título
Descrição
Status
Tipo
Formato
Data
Horário
Local
Capacidade
Organização
Setores
Subsetores
Responsável
Link Luma
Imagem/card

Criar abas:

Visão geral
Público
Convidados
Luma
Check-in
Participantes
Comunicações
Relatório

==================================================
10. VISÃO GERAL DO EVENTO
==================================================

Mostrar indicadores calculados automaticamente:

Público selecionado
Convites enviados
Confirmados no Luma
Presentes
Participantes espontâneos
Novos contatos
Capacidade
Ocupação
No-show

Criar funil:

Público
→ Convidados
→ Confirmados
→ Presentes

Walk-ins devem aparecer separadamente.

==================================================
11. CONVIDADOS / BEEHIIV
==================================================

Neste MVP, não integrar automaticamente ao Beehiiv.

Criar função:

REGISTRAR ENVIO DE CONVITE

Permitir colar lista de e-mails.

Aceitar:

quebra de linha
vírgula
ponto e vírgula
tab

Normalizar:
lowercase
trim
remover duplicidades

A aplicação deve comparar os e-mails com a base e mostrar:

Encontrados
Não encontrados
Duplicados
Já associados
E-mail inválido
Descadastrados

Só depois da confirmação registrar como:

CONVITE ENVIADO.

Estar no público do evento não significa automaticamente ter recebido convite.

==================================================
12. IMPORTAÇÃO DO LUMA
==================================================

O CSV exportado pelo Luma MUDA conforme o evento.

NUNCA hardcode o schema do arquivo anexado.

O CSV anexado deve ser tratado como um CASO DE TESTE REAL.

Criar um IMPORTADOR GENÉRICO.

Fluxo:

Upload
→ detectar CSV
→ detectar cabeçalho
→ Preview
→ sugerir mapeamento
→ permitir corrigir mapeamento
→ identificar campos personalizados
→ validar
→ fazer matching
→ revisar conflitos
→ importar

Campos canônicos que o sistema deve tentar reconhecer:

Nome
Primeiro nome
Sobrenome
E-mail
Telefone
Empresa
Cargo
ID externo
Data da inscrição
Status
QR Code
Check-in externo

Exemplos de equivalência:

email / e-mail / guest_email
→ E-mail

phone / phone_number / telefone / celular
→ Telefone

company / empresa / organization
→ Organização

job_title / cargo / position
→ Cargo

Mas o administrador sempre deve poder alterar o mapping.

==================================================
13. CAMPOS PERSONALIZADOS DO LUMA
==================================================

Colunas desconhecidas NÃO podem ser descartadas.

Elas devem ser preservadas como:

CAMPO PERSONALIZADO DO EVENTO.

Exemplo:

"Qual é sua área de interesse?"
"Como ficou sabendo do evento?"
"Qual município?"
"Tem interesse em exportação?"

Esses campos pertencem à INSCRIÇÃO e não necessariamente ao cadastro permanente do contato.

Armazenar preferencialmente em:

custom_data JSONB

Também preservar:

raw_import_data JSONB

com a linha original.

Isso permite receber novos campos sem migration de banco.

==================================================
14. MATCHING DO LUMA
==================================================

Ordem:

1. e-mail exato normalizado;
2. telefone exato normalizado;
3. nome + organização;
4. nome semelhante.

Resultados:

CORRESPONDÊNCIA SEGURA
POSSÍVEL CORRESPONDÊNCIA
NOVO CONTATO
REGISTRO INCOMPLETO
ERRO

Somente correspondência segura pode ser associada automaticamente.

Nome semelhante sempre exige revisão humana.

==================================================
15. MODO RECEPÇÃO
==================================================

Esta é a funcionalidade MAIS IMPORTANTE.

Criar botão:

INICIAR MODO RECEPÇÃO

Nesse modo, esconder:

Configurações
Relatórios
Importações
Administração
Ações destrutivas

Mostrar:

Nome do evento
Horário
Confirmados
Presentes
Capacidade
Ocupação
Online / Offline

Busca grande e prioritária:

"Buscar nome, empresa, e-mail ou telefone"

Filtros rápidos:

Todos
Confirmados
Convidados
Presentes

==================================================
16. CHECK-IN — CASOS
==================================================

CASO 1

Confirmou no Luma.

Mostrar:

CONFIRMADO NO LUMA

Botão:

CHECK-IN

--------------------------------

CASO 2

Recebeu convite mas não confirmou.

Mostrar:

CONVIDADO
SEM INSCRIÇÃO NO LUMA

Botão:

REGISTRAR PRESENÇA

--------------------------------

CASO 3

Está no mailing mas não foi convidado.

Mostrar:

CONTATO DO MAILING
NÃO INSCRITO

Botão:

REGISTRAR PRESENÇA

--------------------------------

CASO 4

Não está na base.

Mostrar:

Nenhum contato encontrado.

Botão:

+ PARTICIPANTE SEM INSCRIÇÃO

==================================================
17. NOVO PARTICIPANTE
==================================================

Antes de criar novo contato:

buscar novamente na base completa.

Se encontrar contato semelhante:

mostrar possível correspondência.

Permitir:

USAR ESTE CONTATO E REGISTRAR PRESENÇA.

Se realmente for novo:

campos rápidos:

Nome *
E-mail
WhatsApp
Empresa
Cargo

Não exigir outros campos durante a recepção.

Botão:

SALVAR E REGISTRAR PRESENÇA

Criar:
contato
+
presença

na mesma operação.

Se faltar informação:
marcar cadastro como incompleto.

==================================================
18. CHECK-IN
==================================================

Ao registrar presença:

salvar:

event_id
contact_id
checked_in_at
checked_in_by
source

source pode ser:

luma
invited
mailing
walk_in
qr

Não permitir check-in duplicado.

Após ação:

atualizar tela imediatamente.

Mostrar:

PRESENTE ✓

e horário.

Atualizar automaticamente:

Presentes
Ocupação
Lista

Sem reload completo da página.

==================================================
19. DESFAZER CHECK-IN
==================================================

Permitir corrigir erro.

Ação:

Desfazer check-in

Confirmar:

"Desfazer check-in de [Nome]?"

Preservar:

horário original;
quem realizou;
quem desfez;
horário da reversão.

==================================================
20. QR CODE
==================================================

Se o CSV do Luma possuir QR Code:

preservar a informação.

Se possível, implementar:

ESCANEAR QR CODE

usando a câmera do tablet.

Se o browser não permitir ou houver problema de permissão:

não comprometer o sistema.

A busca por nome continua sendo o fluxo principal.

==================================================
21. SUPABASE
==================================================

Projeto:

https://kcixoybbxcogpqlgeaoi.supabase.co

Conectar usando a integração apropriada do Figma Make.

Não colocar:

service_role
secrets
senhas
tokens privados

no frontend.

Utilizar Supabase para:

banco
auth
persistência

Separar:

UI
business logic
data access

==================================================
22. TABELAS PRINCIPAIS
==================================================

Criar/preparar:

profiles
contacts
organizations
organization_types
sectors
subsectors
relationships
interactions
events
event_sectors
event_audience
event_invites
event_registrations
event_attendance
event_imports
event_import_field_mappings
audit_log

event_registrations deve suportar:

campos canônicos
+
custom_data JSONB
+
raw_import_data JSONB

==================================================
23. USUÁRIOS
==================================================

Dois perfis:

ADMIN

RECEPTIONIST

ADMIN pode:

gerenciar eventos;
importar;
editar;
resolver conflitos;
fazer check-in;
consultar dados.

RECEPTIONIST pode:

buscar participante;
fazer check-in;
cadastrar walk-in;
usar contato existente;
corrigir check-in autorizado.

Receptionist não pode:

excluir contatos;
editar taxonomias;
alterar configurações críticas;
acessar dados desnecessários.

Preparar Row Level Security.

==================================================
24. ONLINE / OFFLINE
==================================================

Mostrar estado:

ONLINE
OFFLINE
SINCRONIZANDO

Se for possível implementar offline com segurança:

criar fila local de check-ins e sincronização posterior.

Garantir que sincronização não gere presença duplicada.

Se não for possível no primeiro release:

não simular.

Mostrar claramente que conexão é necessária.

==================================================
25. FUTURA EXPANSÃO
==================================================

Preparar arquitetura para, no futuro:

Segmentações dinâmicas
Histórico completo
Timeline
Scoring 0–100
Cinco estrelas
Relationship Score
Organization Score
Event Match
Recomendação de convidados
Integração Beehiiv
Integração automática Luma
Relatórios
Exportações
Descadastros
Bounces
LGPD
Tags
Notas

Não implementar tudo agora.

==================================================
26. GITHUB
==================================================

Repositório:

https://github.com/investrs2026/mailing.git

Preparar o código para continuidade via VS Code + GitHub.

Usar preferencialmente:

React
TypeScript

Organizar código em módulos reutilizáveis.

Nunca commitar:

mailing real;
CSV real do Luma;
dados pessoais;
secrets;
.env;
credenciais.

Criar .gitignore adequado.

==================================================
27. TESTES OBRIGATÓRIOS
==================================================

Antes de considerar o MVP pronto, testar:

Pessoa convidada + Luma + check-in.

Pessoa convidada sem Luma + presença.

Contato do mailing não convidado + presença.

Pessoa completamente nova + cadastro + presença.

Check-in duplicado.

Desfazer check-in.

Dois homônimos.

Nome longo.

Empresa longa.

Sem empresa.

Sem cargo.

CSV Luma com novas colunas.

CSV sem telefone.

CSV sem empresa.

Teclado Android aberto.

Internet lenta.

Busca sem resultado.

==================================================
28. TESTE ESPECÍFICO DO TABLET
==================================================

Testar especialmente para:

Xiaomi Redmi Pad SE
11"
16:10
landscape
Android 15
uso por touch.

A recepcionista precisa conseguir:

localizar;
identificar;
registrar presença;

com pouquíssimos toques.

A tela inicial do Modo Recepção deve mostrar, preferencialmente sem scroll:

evento;
ocupação;
busca;
início da lista.

==================================================
29. CRITÉRIO DE ENTREGA
==================================================

O primeiro release só está pronto quando for possível:

abrir aplicação;
autenticar;
abrir evento;
visualizar informações;
registrar convidados;
importar CSV Luma variável;
mapear campos;
preservar campos extras;
identificar contatos;
abrir Modo Recepção;
buscar participante;
fazer check-in;
registrar convidado sem Luma;
registrar contato existente não convidado;
cadastrar pessoa nova;
impedir duplicidade;
desfazer presença;
visualizar contadores atualizados;
persistir tudo no Supabase.

==================================================
30. REGRA FINAL
==================================================

NÃO pare na criação das telas.

Implemente o máximo possível de:

navegação;
interações;
dados;
regras;
importações;
matching;
persistência;
check-in;
cadastro;
estados;
erros.

Não finja que uma funcionalidade está pronta se estiver mockada.

Se algo não puder ser concluído:

marque claramente como PENDENTE e documente o que falta.

COMECE analisando todos os anexos e depois construa a aplicação.

Prioridade final:

1. confiabilidade;
2. velocidade;
3. clareza;
4. identidade Invest RS;
5. funcionalidades futuras.