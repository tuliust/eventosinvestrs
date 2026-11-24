# Eventos Invest RS — Estado do projeto e guia de continuidade

> **Encerramento da limpeza Git — 23/11/2026: CONCLUÍDO.** A branch `demo-case` foi removida **do GitHub e dos dois computadores locais/repositórios verificados**. O usuário executou o procedimento seguro e enviou saída com `Deleted branch demo-case`, `git branch -a --list '*demo-case*'` vazio e `## main...origin/main` em ambos os repositórios. A ausência das branches remotas foi confirmada diretamente no GitHub. `main`, documentação, banco Supabase e Vercel foram preservados.

> **Auditoria complementar de segurança e publicação — 23/11/2026:** o relatório consolidado, na seção 9, inclui **comandos PowerShell para VS Code**, revisão preliminar dos privilégios `SECURITY DEFINER` e a **causa exata** da divergência Git/Vercel: projeto Vercel `eventos` conectado a **`investrs2026/eventos`**, enquanto a aplicação recuperada está em **`tuliust/eventosinvestrs`**. O deployment `READY` tem SHA `8613028b8f392ccbb0bccb33d7f61aca7d34b637`, correspondente ao identificador do snapshot `eventos-main(2).zip` registrado em `RECOVERY.md`. **Não mudar o vínculo Git nem publicar sem staging e validação de produção.** PR documental: https://github.com/tuliust/eventosinvestrs/pull/1 (draft, sem merge).

> **Validação de VS Code e diagnóstico de domínio — 23/11/2026:** `main...origin/main` limpa (`0 0`); TypeScript/lint/build aprovados; Vercel CLI identificou `eventos`. No teste de HTTP: **200** para `bemvindo.eventosinvestrs.com.br` e **404** para `eventosinvestrs.com.br`. A API da Vercel confirmou que a raiz e `www` **não estão associados** ao projeto, embora a zona esteja verificada na equipe `tuliust`; apenas o subdomínio `bemvindo` está vinculado. Além disso, o Vercel `eventos` continua ligado ao GitHub `investrs2026/eventos`, não a `tuliust/eventosinvestrs`. **Não conectar a raiz nem mudar Git antes de homologar staging.** Detalhes na seção 10 do relatório.

> **Relatório consolidado para futuras retomadas:** [RELATORIO_DE_RETOMADA_2026-11-23.md](RELATORIO_DE_RETOMADA_2026-11-23.md) — estado atual, evidências, procedimentos e pendências. O relatório é a referência rápida; este documento preserva a trilha histórica da auditoria.

## ATUALIZAÇÃO PRIORITÁRIA — SUPABASE RECUPERADO (23/11/2026)

> **Esta seção substitui o estado de perda de acesso ao banco descrito nas seções históricas abaixo.** O projeto Supabase original foi recuperado na nova conta e está ativo. A demonstração em `demo-case` foi descontinuada, e a branch foi excluída local e remotamente, conforme decisão do usuário. Os dados reais não devem ser substituídos por mocks.
>
> **Escopo atualizado em 23/11/2026:** a auditoria de leitura foi seguida de configuração local, build, login administrativo e sete grupos de testes funcionais com dados reais **confirmados pelo usuário**. Vercel não foi alterada. Operações de escrita e homologação independente de produção permanecem pendentes.

### Identidade atual

- Repositório: `tuliust/eventosinvestrs`, branch `main`, commit `43d6bf39f66d152bf57abbb256565061a4cf56e7`.
- Pasta informada: `C:\Users\Tulius\Documents\github\eventosinvestrs`.
- Supabase original: `Mailing`, projeto ref `kcixoybbxcogpqlgeaoi`; `https://kcixoybbxcogpqlgeaoi.supabase.co`, **ACTIVE_HEALTHY**, `sa-east-1`.
- Organização atual: `Mailing`, ID `itqbkoctfztjzdcdjhny`, acessível via conexão Supabase da nova conta. Não associar automaticamente a referências da antiga organização InvestRS.
- `README.md`, `.env.example` e `src/lib/supabase.ts` já usam a URL/ref original; as variáveis do frontend são `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (com fallback para `VITE_SUPABASE_ANON_KEY`).
- A aplicação usa **pnpm 10.34.3**, conforme `package.json`. Não trocar por npm sem analisar o lockfile.

### Diagnóstico do Windows — 23/11/2026

O usuário executou verificações locais em `C:\Users\Tulius\Documents\github\eventosinvestrs`:

- `git status --short --branch`: `## main...origin/main`, sem arquivos locais alterados ou não rastreados visíveis.
- `git rev-list --left-right --count main...origin/main`: `0 0`. Git local alinhado ao remoto.
- Node.js `v24.22.1`; pnpm `10.34.3` (versão informada no `package.json`).
- `Test-Path .env.local`: **ausente**. Ainda não há configuração local verificada para conectar o navegador ao Supabase real.
- `.gitignore` da `main` exclui `.env*` com exceção de `.env.example`; a chave pública/ambiente deve permanecer exclusivamente em `.env.local`.
- A `.env.example` já contém a URL original e o nome `VITE_SUPABASE_PUBLISHABLE_KEY`; copiar para `.env.local` e substituir o valor de exemplo pela chave pública `sb_publishable_` do projeto `kcixoybbxcogpqlgeaoi`. Não inserir uma chave secret/service-role nas variáveis `VITE_`, e não imprimir ou compartilhar credenciais.
- **Próxima evidência (atualização):** URL e chave publicável já confirmadas, `pnpm run typecheck`, `pnpm run lint` e `pnpm run build` aprovados. Falta teste local de login e leitura. Nenhum fluxo de escrita ou deploy autorizado.
- Exclusão **remota e local de `demo-case` concluída** e verificada no GitHub e no PowerShell; a tentativa anterior via PowerShell havia falhado por autenticação.

### Configuração local do Supabase confirmada — 23/11/2026

O usuário criou `.env.local` a partir da referência local e executou verificações mascaradas em PowerShell:

- `VITE_SUPABASE_URL` corresponde exatamente a `https://kcixoybbxcogpqlgeaoi.supabase.co`: **True**.
- `VITE_SUPABASE_PUBLISHABLE_KEY` com prefixo `sb_publishable_`: **True**. O valor não foi compartilhado.
- Prefixo `sb_secret_` nessa variável pública: **False**.
- `git status --short --branch`: `## main...origin/main` — sem alterações locais apresentadas.
- Aplicação na branch `main` (não demo); o mock Playwright não é utilizado para a integração real.
- **Conclusão parcial (atualização):** variáveis corretas e build aprovado; autenticação e consultas reais ainda não foram testadas no navegador.
- **Próxima verificação:** `pnpm build` e `pnpm dev` com pnpm 10.34.3; verificar navegação, login administrativo existente, contatos, organizações, eventos e mailing somente por leitura.
- Não executar migrations, seeds, importações, envio de e-mails, convites, check-in ou operações de escrita. Não mudar Vercel.

### Build e verificações locais aprovados — 23/11/2026

O usuário executou, na `main` sincronizada e com `.env.local` apontando para o Supabase original:

- `pnpm run typecheck` (`tsc --noEmit`): **aprovado**, sem erros.
- `pnpm run lint` (`eslint src tests e2e --max-warnings=0`): **aprovado**, sem erros ou warnings.
- `pnpm run build`: **aprovado**, Vite `v8.0.5`, **151 módulos transformados**, compilado em **686 ms**.
- Artefatos: HTML `1,56 kB`, CSS `68,12 kB` (gzip `12,47 kB`), JS `936,03 kB` (gzip `247,08 kB`).
- Aviso **não bloqueante**: chunk JS maior que 500 kB; otimização futura por code splitting, sem alterar o comportamento agora.
- `git status --short --branch` após o build: `## main...origin/main`, sem alterações locais.
- **Não executado nesta rodada:** `pnpm test` (vitest), testes E2E (backend mockado), migrations, seeds, alterações de Auth/Storage/Edge Functions, importações ou deploy.
- **Próximo teste:** `pnpm dev`; autenticar com usuário administrativo existente e confirmar visualmente a navegação/consultas reais em `/` (Dashboard), `/eventos`, `/mailing`, `/contatos`, `/organizacoes`, `/segmentacoes` e `/relatorios`. O login é em `/login`. Somente leitura, sem criar/importar/editar/excluir registros, fazer check-in ou enviar mensagens.
- A compilação não comprova por si só que as rotas, autenticação e consultas reais funcionem, tampouco homologa a produção Vercel.

### Testes funcionais com banco real — CONFIRMADOS em 23/11/2026

Após aprovação de TypeScript, lint e build na `main`, o usuário confirmou sete verificações no navegador local, com `.env.local` apontando para o Supabase original `Mailing`:

| Verificação | Resultado |
| --- | --- |
| Login administrativo com usuário existente | CONFIRMADO |
| Dashboard com informações reais | CONFIRMADO |
| `/contatos` — registros históricos | CONFIRMADO |
| `/organizacoes` — registros históricos | CONFIRMADO |
| `/eventos` — eventos e inscrições | CONFIRMADO |
| `/mailing` — listas e vínculos | CONFIRMADO |
| Segmentações e relatórios | CONFIRMADO |

**Conclusão:** reintegração funcional local de navegação, autenticação e **leitura** ao banco recuperado concluída, com evidência de confirmação pelo usuário. O banco já continha 3.107 contatos, 3.875 organizações, 2 eventos, 69 inscrições, 1.040 convites e demais registros; não houve nova importação nem aplicação de migrations.

**Limites ainda pendentes:** não foram executados testes de gravação, contatos, imports, check-in, convites, comunicações, administração de usuários, Edge Functions, permissões multiusuário nem autenticação/consulta independente no deployment Vercel. A publicação atual do projeto Vercel `eventos` ainda exige reconciliação com o histórico da `main` consultada; não publicar automaticamente.

**Limpeza da demo — CONCLUÍDA:** a branch `demo-case` foi excluída do GitHub e confirmada no remoto. O usuário depois removeu a referência **local** (saída `Deleted branch demo-case`), executou `git branch -a --list '*demo-case*'` sem resultados e confirmou a `main` limpa/sincronizada. Dados e produção foram preservados.

### Inventário recuperado — leitura

- **33 tabelas `public`**, todas com RLS habilitado.
- **41 migrations no GitHub = 41 migrations no histórico remoto**, versões e nomes integralmente alinhados.
- Auth: **3 usuários**; Storage: **2 buckets e 1 objeto**.
- Edge Functions: **7 ativas** — `import-organizations-v2`, `admin-users`, `beehiiv-integration`, `import-contacts`, `import-organizations`, `admin-settings`, `admin-maintenance`.
- Contagens: **3 perfis**, **3.875 organizações**, **3.107 contatos**, **2 eventos**, **69 inscrições**, **1.040 convites**, **13 presenças**, **1.040 vínculos com mailing**, **1 lista**, **1 configuração**, **2 documentos do Guia de Boas-vindas**.
- Supabase Advisors: WARN para `authenticated_security_definer_function_executable` e `auth_leaked_password_protection`. Nenhuma política foi alterada.
- Não houve recuperação por seeds nesta rodada; os registros históricos já estavam disponíveis no Supabase reativado.

### Branch de demonstração — descontinuação

- `demo-case`: 2 commits exclusivos em relação à `main` e 0 commits faltantes da `main`, alterando `e2e/mockSupabase.ts` e adicionando `e2e/visualizar-paginas.spec.ts`. **Decisão expressa: não manter a branch demo.**
- As referências **remota e local** foram excluídas e verificadas em 23/11/2026. A `main` e os arquivos não rastreados foram preservados.
- Não executar o Playwright com interceptador/mock para validar o backend real e não importar fixtures artificiais.

### Vercel e continuidade

- Vercel acessível: projeto `eventos`, ID `prj_JcLGZfKtIdmkXr17Zjql7DocChow`, domínio `bemvindo.eventosinvestrs.com.br` verificado.
- O deployment `READY` atualmente listado aponta para `8613028b8f392ccbb0bccb33d7f61aca7d34b637`, SHA **não encontrado** no histórico consultado de `tuliust/eventosinvestrs`; logo **não afirmar que essa publicação corresponde à `main` atual**. Investigar vínculo e função do deployment antes de publicar.
- Vercel declara `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` em Preview/Production, porém o conector não conseguiu recuperar os valores (classificados como sensíveis). Não assumir que correspondem às chaves atuais.
- Verificar `git status`, alinhar `main` sem perder mudanças locais, confirmar `.env.local` via teste mascarado, executar `pnpm install --frozen-lockfile`, `pnpm build` e `pnpm dev` apenas quando a sessão estiver compatível e a instalação for necessária.
- Validar login, dados de contatos, organizações, eventos e mailing **por leitura** antes de qualquer importação, envio, edição, check-in ou deploy.
- Nenhuma migration, seed, operação SQL mutável, alteração de Auth, Edge Function, Vercel ou deploy foi feita.

**Status desta rodada:** backend histórico recuperado e inventariado; dados preservados; migrações alinhadas; validação funcional local da `main` ainda pendente.

---


> **Status (23/11/2026): STANDBY — case de portfólio concluído.**
>
> **ALERTA:** os dados exibidos nos prints são **fictícios (mock)**. A prévia funciona por meio de um simulador do Supabase executado no Playwright; **não há conexão ativa e validada com o Supabase original**. Login, indicadores e mensagens de sincronização apresentados nessa prévia não demonstram operação real.
>
> **ATENÇÃO — GITHUB x COMPUTADOR:** em 23/11/2026, o GitHub ainda continha o mock pequeno original em `e2e/mockSupabase.ts` e não continha `e2e/visualizar-paginas.spec.ts`. A versão enriquecida usada nos prints está/estava apenas no computador local. **Este documento NÃO faz upload desses dois arquivos. É necessário versioná-los separadamente**, conforme a seção 6.

## ARQUIVO HISTÓRICO — estado anterior à recuperação

> As seções numeradas abaixo descrevem o período de perda de acesso, o modo de demonstração e pendências antigas. Seu status foi **substituído** pelas verificações de recuperação e testes funcionais registradas no início deste documento. Não seguir procedimentos históricos de reconstrução, seed ou uso de mocks como se fossem instruções atuais.

## 1. Identificação

- **Projeto:** Gestão de Eventos e Check-in — Invest RS.
- **Finalidade original:** plataforma de eventos, relacionamento, mailing, contatos, organizações, convites, inscrições, check-in, relatórios e administração.
- **Finalidade atual:** preservar o projeto e registrar telas para um case de portfólio, sem reativar serviços externos.
- **GitHub principal:** https://github.com/tuliust/eventosinvestrs
- **Branch padrão remota:** `main`.
- **Diretório local Windows:** `C:\Users\Tulius\Documents\github\eventosinvestrs`.
- **Situação:** em pausa voluntária; backend original não foi recuperado nem homologado.
- **Documentação relacionada:** [README.md](README.md) e [RECOVERY.md](RECOVERY.md).

## 2. Arquitetura e módulos

| Componente | Tecnologia / situação |
| --- | --- |
| Aplicação | React 19 + TypeScript + Vite 8 + React Router + Tailwind CSS |
| Pacotes | pnpm (versão declarada: 10.34.3) |
| Autenticação prevista | Supabase Auth |
| Banco previsto | Supabase/PostgreSQL |
| Esquema | migrations em `supabase/migrations/` |
| Dados demonstrativos | respostas sintéticas de `MockSupabaseBackend` |
| Executor do demo | Playwright + Chromium |
| Produção antiga | deployment Vercel legado `eventos`, sem login funcional verificado |

**Rotas principais da aplicação:** Dashboard, Eventos (lista, cadastro, detalhe, recepção/check-in), Mailing, Contatos (lista/cadastro/importação), Organizações, Segmentações, Relatórios e Configurações.

O repositório também contém o **Guia de Boas-vindas**, em `src/welcome/`, com rotas `/bemvindo` e `/bemvindo/admin`. Trata-se da mesma codebase; essa subaplicação não foi validada como parte dos prints da demonstração aqui descrita.

**Arquivos estruturais:**

- `src/App.tsx` — roteamento principal.
- `src/contexts/AppContext.tsx` — usuário autenticado, estados e carregamento de dados.
- `src/lib/supabase.ts` — cliente Supabase e variáveis de ambiente.
- `e2e/mockSupabase.ts` — backend sintético interceptado pelo Playwright.
- `playwright.config.ts` — execução local e URL de mock.
- `e2e/checkin-critical.spec.ts` — testes E2E originais.
- `supabase/seed.sql` — dados sintéticos de desenvolvimento, distintos dos dados reais.

## 3. Supabase antigo: acesso perdido, não recuperado

O histórico em [RECOVERY.md](RECOVERY.md) registra:

- Projeto **Mailing**;
- ref: `kcixoybbxcogpqlgeaoi`;
- URL histórica: `https://kcixoybbxcogpqlgeaoi.supabase.co`;
- região: `sa-east-1`;
- estado em **23/09/2026**: `ACTIVE_HEALTHY`.

O responsável informou que acessava esse Supabase por um **e-mail institucional excluído após deixar a empresa**. Em novembro de 2026 o projeto não apareceu nos projetos acessíveis à conexão pessoal consultada; a tentativa de consultar o ref antigo retornou **sem permissão**.

**Não afirmar que o banco foi excluído definitivamente.** Ele pode permanecer sob outra conta/organização. Seu estado e a titularidade precisam ser verificados legitimamente se o produto voltar a operar.

**O que não foi recuperado:** usuários do Auth, senhas, dados reais, histórico operacional, políticas/configurações de projeto e eventual armazenamento privado. As migrations permitem reconstruir parte da **estrutura** num novo projeto; não restauram, sozinhas, os registros perdidos.

No Vercel havia entradas chamadas `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`, mas a presença das variáveis **não confirma** valores válidos ou backend acessível.

## 4. Como foi feita a demonstração para screenshots

O mock é ativado pelo Playwright, que intercepta requisições de autenticação, tabelas e funções RPC de Supabase. A configuração usa:

- `http://127.0.0.1:4173` — Vite temporário;
- `http://127.0.0.1:4173/mock-supabase` — endpoint falso interceptado;
- `e2e-publishable-key` — chave fictícia apenas para testes.

**Isso não transforma `pnpm dev` ou um deployment Vercel em backend mockado.** Sem o contexto de interceptação do Playwright, o navegador normal continua dependendo da configuração real de Supabase.

A versão enriquecida entregue para a demonstração foi organizada com volumes sintéticos:

| Coleção | Quantidade descrita no cenário |
| --- | ---: |
| Usuário | Tulius (administrador) |
| Contatos | 60 |
| Organizações | 18 |
| Eventos | 6 |
| Listas de mailing | 8 |
| Setores | 12 |
| Subsetores | 32 |
| Convites | 245 |
| Inscrições | 170 |
| Presenças | 85 |

Essas quantidades são referentes às **fixtures previstas**, não a dados da Invest RS. O Dashboard calcula seus próprios indicadores com filtros de status, datas, confirmações e unicidade; portanto, valores de cartões **não precisam ser iguais** aos totais das coleções.

Foram preparadas respostas para rotas antes faltantes, incluindo `GET /rest/v1/institutional_categories` e `POST /rest/v1/rpc/get_pending_luma_contact_import`, além de dados auxiliares para Mailing, Segmentações e outras páginas.

**Limites:** o mock não comprova gravação real, autenticação segura, sincronização com servidor, cobertura integral de imports, Edge Functions, armazenamento, relatórios ou políticas RLS. O indicador `Online / sincronizado` no frontend sob teste **é visual, não prova de integração**. Alterações simuladas podem desaparecer após encerrar o teste.

O responsável confirmou que conseguiu visualizar as páginas e concluiu o objetivo de capturar o case em novembro de 2026. Isso **não constitui homologação de produção**.

### Reabrir a demonstração no Windows

~~~powershell
cd C:\Users\Tulius\Documents\github\eventosinvestrs
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm exec playwright test e2e/visualizar-paginas.spec.ts --headed
~~~

**Pré-requisito:** preservar localmente `e2e/visualizar-paginas.spec.ts` e o **mock enriquecido**, pois não estavam no remoto na data deste registro. Usar o Chromium aberto pelo Playwright; manter a pausa/Inspector do roteiro quando aplicável.

Quando o teste é encerrado, o Playwright desliga o Vite temporário; o erro `ERR_CONNECTION_REFUSED` em `127.0.0.1:4173` depois disso é esperado.

## 5. Vercel e GitHub: não presumir publicação automática

Foi identificado um projeto Vercel chamado `eventos`, com um deployment `Ready`, mas o login apresentava `Failed to fetch`.

**Divergência relevante:** o deployment consultado tinha origem em `investrs2026/eventos` (commit histórico `8613028b8f392ccbb0bccb33d7f61aca7d34b637`), não necessariamente no repositório atual `tuliust/eventosinvestrs`.

URLs observadas:

- https://eventos-git-main-tuliust.vercel.app/
- https://eventos-ppqrwgkkn-tuliust.vercel.app/

Domínios históricos documentados: `eventosinvestrs.com.br` e `bemvindo.eventosinvestrs.com.br`.

Antes de publicar algo novo, verificar em Vercel **Settings → Git** o repositório, a equipe, a branch, as variáveis e os domínios. **Não assumir** que o GitHub atual publica nesses endereços.

Se for publicar uma demo navegável no futuro, fazê-la isoladamente da produção, sem dados reais e com aviso visível **DEMONSTRAÇÃO — DADOS FICTÍCIOS**. O mock local de testes não é substituto seguro para um backend público.

## 6. PENDÊNCIA CRÍTICA antes do arquivamento: salvar o cenário no GitHub

**Um clone novo da `main` não reproduzirá automaticamente a demonstração**, porque a versão enriquecida do `mockSupabase.ts` e o teste `visualizar-paginas.spec.ts` podem existir somente no computador.

Para preservar esses dois arquivos, verificar a branch atual:

~~~powershell
cd C:\Users\Tulius\Documents\github\eventosinvestrs
git status
git branch --show-current
~~~

Se a branch atual for `main`, criar uma branch separada de portfólio (uma única vez):

~~~powershell
git switch -c demo-case
~~~

Se `demo-case` já existir, **não repetir o comando de criação**; usar essa branch se for apropriado.

Conferir que os dois arquivos contêm **apenas dados sintéticos** e nenhum segredo ou dado pessoal. Então, na branch de demonstração:

~~~powershell
git add e2e/mockSupabase.ts e2e/visualizar-paginas.spec.ts
git commit -m "demo: preservar cenario ficticio do case"
git push -u origin HEAD
~~~

Verificar no GitHub se a branch publicada contém os dois arquivos. A documentação de continuidade está na `main`; o cenário enriquecido deve permanecer em **branch própria**, salvo decisão posterior consciente de integrá-lo.

**Atenção aos testes:** `e2e/checkin-critical.spec.ts` foi escrito para um conjunto pequeno e específico de fixtures. Substituir o mock por um conjunto enriquecido pode afetar IDs e expectativas; não assumir que toda a suíte E2E continue passando sem revisão.

## 7. Sincronizar o arquivo de documentação para o computador

**Na branch `main`**, com as alterações locais conferidas:

~~~powershell
cd C:\Users\Tulius\Documents\github\eventosinvestrs
git status
git branch --show-current
git pull --ff-only origin main
~~~

O novo arquivo `STATUS_E_CONTINUIDADE.md` será baixado do GitHub. O parâmetro `--ff-only` evita merge automático se houver histórico divergente.

**Se estiver em `demo-case` ou outra branch:** primeiro executar `git fetch origin` e avaliar a integração de `origin/main` à branch atual, ou voltar à `main` somente depois de salvar as alterações locais. Se houver erro de merge ou arquivos em risco, interromper e resolver conscientemente. **Não executar `git reset --hard` nem `git clean -fd` para forçar a sincronização.**

`git pull` = GitHub → computador. `git add` + `git commit` + `git push` = computador → GitHub.

## 8. Retomar o projeto no futuro

### Caminho A — somente case visual

1. Recuperar a branch `demo-case` (ou os arquivos locais preservados).
2. Instalar dependências e Playwright.
3. Abrir a prévia mockada, revisar dados e telas.
4. Ajustar datas, rotas e mensagens simuladas, quando necessário.
5. Gerar novos prints, sempre identificando os dados como fictícios.

### Caminho B — voltar a ter um produto funcional

1. Apurar o status e a titularidade do Supabase histórico, por vias autorizadas, e a possibilidade de backup.
2. Se necessário, criar novo projeto Supabase sob conta/organização duradoura.
3. Revisar e aplicar migrations, extensões, funções, storage e policies; usar seed sintético só em desenvolvimento.
4. Criar usuários reais em Supabase Auth e seus perfis em `public.profiles`; revisar roles e RLS.
5. Configurar URL e chave pública/publishable por ambiente. **Nunca** publicar service-role/secret key no código client, no GitHub ou em variáveis `VITE_*`.
6. Validar login, leitura/gravação, contatos, mailing, eventos, inscrições, convites, imports, check-in e relatórios com o backend real e sem interceptação de testes.
7. Validar separadamente o Guia de Boas-vindas.
8. Revisar integração Git/Vercel e domínio antes de novo deploy.
9. Atualizar `README.md`, `RECOVERY.md` e este documento com novo status e evidências.

Comandos básicos de qualidade:

~~~powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
~~~

Build verde e E2E com mock não substituem testes de segurança, banco, permissões e produção.

## 9. Quadro de encerramento em 23/11/2026

| Assunto | Estado |
| --- | --- |
| Screenshots para portfólio | Concluídos, segundo o responsável |
| Execução local da demo | Confirmada |
| Nome demonstrativo | Tulius |
| Dados apresentados | 100% fictícios |
| Supabase original | Sem acesso / não integrado |
| Dados reais anteriores | Não recuperados |
| Login de produção | Não validado |
| Mock enriquecido salvo no GitHub | **Pendente de versionamento/confirmar** |
| Teste de visualização salvo no GitHub | **Pendente de versionamento/confirmar** |
| Suíte E2E após enriquecer mock | Não homologada neste registro |
| Vercel ligado ao repositório atual | Não confirmado |
| Estado geral | STANDBY |

---

**Orientação de retomada:** antes de modificar autenticação, conectar um banco ou publicar, decidir se o objetivo é **demo visual** ou **produto funcional**. Ler também `README.md` e `RECOVERY.md`. Estes caminhos têm dados, permissões e exigências de validação diferentes.
