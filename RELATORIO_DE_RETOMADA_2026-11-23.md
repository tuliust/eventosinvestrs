# RELATÓRIO DE RETOMADA — EVENTOSINVESTRS

> **MARCO FINAL — 24/11/2026:** a recuperação local está **CONCLUÍDA E DOCUMENTADA**, sem alterações em produção ou banco. Leia primeiro [ENCERRAMENTO_RECUPERACAO_2026-11-24.md](ENCERRAMENTO_RECUPERACAO_2026-11-24.md). A homologação de produção constitui **nova fase**, rastreada em [issue #2](https://github.com/tuliust/eventosinvestrs/issues/2); não interpretá-la como parte não concluída da recuperação. O PR documental permanece rascunho para evitar merge/deploy automático.

> **Encerramento da limpeza Git — 23/11/2026: CONCLUÍDO.** A branch `demo-case` foi removida **do GitHub e dos dois computadores locais/repositórios verificados**. O usuário executou o procedimento seguro e enviou saída com `Deleted branch demo-case`, `git branch -a --list '*demo-case*'` vazio e `## main...origin/main` em ambos os repositórios. A ausência das branches remotas foi confirmada diretamente no GitHub. `main`, documentação, banco Supabase e Vercel foram preservados.

**Data da verificação:** 23/11/2026  
**Status:** **REINTEGRAÇÃO FUNCIONAL LOCAL CONCLUÍDA** com o Supabase original `Mailing`; limpeza local e remota de `demo-case` **CONCLUÍDA**; reconciliação Vercel e fluxos de escrita pendentes.  
**Limite:** login e consultas locais aprovados; nenhum teste de escrita, envio, importação ou check-in foi executado.

## 1. Identidade e fontes de verdade

| Recurso | Identificação |
| --- | --- |
| Projeto | EventosInvestRS / Plataforma de Eventos Invest RS |
| Pasta Windows | `C:\Users\Tulius\Documents\github\eventosinvestrs` |
| GitHub | https://github.com/tuliust/eventosinvestrs |
| Código principal | `main`, SHA `43d6bf39f66d152bf57abbb256565061a4cf56e7` |
| Documentação de auditoria | `STATUS_E_CONTINUIDADE.md`, branch `docs/reintegracao-supabase-2026-11-23` |
| Supabase original | Projeto `Mailing`, ref `kcixoybbxcogpqlgeaoi` — https://supabase.com/dashboard/project/kcixoybbxcogpqlgeaoi |
| URL de API | `https://kcixoybbxcogpqlgeaoi.supabase.co` |
| Organização do projeto na conexão atual | ID `itqbkoctfztjzdcdjhny` |
| Vercel localizado | Projeto `eventos`, ID `prj_JcLGZfKtIdmkXr17Zjql7DocChow` |
| Domínio Vercel verificado | https://bemvindo.eventosinvestrs.com.br |

O nome `Mailing` designa o **Supabase original da aplicação EventosInvestRS**; não confundir a organização histórica `InvestRS` com a nova conta que passou a ter acesso ao projeto. A aplicação principal prevê `eventosinvestrs.com.br`, mas a associação atual desse domínio à Vercel não foi confirmada nesta reconciliação.

## 2. Panorama técnico e recursos

- Aplicação React/TypeScript + Vite, Supabase JS, PostgreSQL, Auth, RLS e Vercel; `pnpm@10.34.3`.
- Funcionalidades: Dashboard, gestão de eventos/inscrições/convites, contatos, organizações, segmentações, mailing, relatórios, comunicação, importações, check-in e configurações.
- Inclui na mesma codebase um **Guia de Boas-vindas** em `src/welcome/`; **não** criar backend separado para ele.
- Supabase original **`ACTIVE_HEALTHY`**, região `sa-east-1`.
- **33 tabelas públicas**, todas com RLS. **41 migrations no GitHub = 41 no Supabase**, versões e nomes correspondentes.
- Dados recuperados na auditoria: **3.107 contatos**, **3.875 organizações**, **2 eventos**, **69 inscrições**, **1.040 convites**, **13 presenças**, **1 lista de mailing com 1.040 vínculos**, **3 perfis**, **2 documentos do Guia de Boas-vindas**.
- **Auth:** 3 usuários. **Storage:** 2 buckets e 1 objeto.
- **Edge Functions:** 7 ativas: `import-organizations-v2`, `admin-users`, `beehiiv-integration`, `import-contacts`, `import-organizations`, `admin-settings`, `admin-maintenance`.
- Supabase Advisors: avisos sobre `SECURITY DEFINER` executável para usuários autenticados e proteção contra senhas vazadas desativada.

## 3. Evidências da reintegração local — CONCLUÍDO

1. `git status --short --branch` retornou `## main...origin/main`; a comparação de commits retornou `0 0`.
2. Ambiente local com Node.js `24.22.1` e pnpm `10.34.3`.
3. `.env.local` foi criado e validado de forma mascarada:
   - `VITE_SUPABASE_URL` = `https://kcixoybbxcogpqlgeaoi.supabase.co`;
   - `VITE_SUPABASE_PUBLISHABLE_KEY` no formato `sb_publishable_...`;
   - nenhuma chave `sb_secret_` na variável verificada.
4. `pnpm run typecheck`, `pnpm run lint` (zero avisos) e `pnpm run build` **aprovados**. Vite `8.0.5`, 151 módulos transformados, build em 686 ms.
5. O usuário confirmou no navegador local **7 de 7 grupos de testes**: login administrativo, Dashboard com dados reais, contatos, organizações, eventos/inscrições, mailing/listas/vínculos, segmentações e relatórios.
6. Nenhuma migração, seed, importação, envio, check-in, modificação do Supabase ou deploy foi executado na reintegração.

**Conclusão do teste:** a aplicação `main` está **funcionando localmente com autenticação e leitura dos dados históricos do Supabase recuperado**. Isso não homologa os fluxos transacionais nem a publicação Vercel.

## 4. Como retomar no Windows

### Preparação e Git

```powershell
cd 'C:\Users\Tulius\Documents\github\eventosinvestrs'
git status --short --branch
git fetch origin
git rev-list --left-right --count main...origin/main
git check-ignore .env.local
Test-Path .env.local
node --version
pnpm --version
```

- Usar a **`main`**, nunca o mock de `demo-case` como fonte de dados reais.
- Se houver trabalho local, preservar antes de `git pull`; se `main` estiver limpa e apenas atrasada, considerar `git pull --ff-only`.
- Em `.env.local`, confirmar a URL `kcixoybbxcogpqlgeaoi` e chave `sb_publishable_` em `VITE_SUPABASE_PUBLISHABLE_KEY`. Nunca expor secrets nem adicionar service-role em variáveis `VITE_`.
- O `pnpm-lock.yaml` já foi utilizado com sucesso. Só reinstalar dependências quando necessário, usando `pnpm install --frozen-lockfile`.

### Validar e abrir

```powershell
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm dev
```

- Acesso local habitual: http://localhost:5173/
- Login: http://localhost:5173/login
- Após autenticar com **usuário existente**, revisar Dashboard, `/contatos`, `/organizacoes`, `/eventos`, `/mailing`, `/segmentacoes` e `/relatorios` **somente por leitura**.
- Não executar importações, alteração de contatos/organizações, envios, convites, check-in, exclusões ou disparos externos nesta verificação.
- Encerrar o Vite com `Ctrl+C`. Se a porta estiver ocupada, usar o endereço efetivamente informado pelo Vite.
- A suíte Playwright existente intercepta o Supabase com **mock sintético** e **não** valida a integração com o banco real.

### Ler a auditoria sem mudar da `main`

```powershell
git fetch origin
git show origin/docs/reintegracao-supabase-2026-11-23:STATUS_E_CONTINUIDADE.md
git show origin/docs/reintegracao-supabase-2026-11-23:RELATORIO_DE_RETOMADA_2026-11-23.md
```

## 5. Pendências e riscos para tratar depois

| Prioridade | Questão | Ação recomendada |
| --- | --- | --- |
| Alta | Publicação Vercel `eventos` | O deployment `READY` mais recente foi associado ao SHA `8613028b8f392ccbb0bccb33d7f61aca7d34b637`, **não localizado** no histórico consultado de `tuliust/eventosinvestrs`. Conferir vínculo Git/projeto/domínio antes de qualquer publicação. A existência do deployment não valida esta `main` |
| Alta | Segurança Supabase | Investigar `SECURITY DEFINER`, permissões administrativas e proteção contra senhas vazadas sem mudanças imediatas em permissões de usuários |
| Média | Variáveis Vercel | `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` existem em Production/Preview, mas seus valores sensíveis **não puderam ser confirmados**. Conferir de forma segura antes de redeploy |
| Média | Operações não homologadas | Planejar testes controlados de Auth, RLS, importações, comunicação, convites, check-in e Edge Functions, considerando dados reais e eventuais efeitos externos |
| Baixa | Bundle JS | Aviso não bloqueante: chunk de ~936 kB; planejar code splitting |
| Administrativa | `demo-case` | **CONCLUÍDO:** branch excluída do remoto e do ambiente local; ausência confirmada |

A antiga `demo-case` continha código de testes/fixtures de demonstração, incluindo `e2e/mockSupabase.ts` e `e2e/visualizar-paginas.spec.ts`, diferentes da `main`. **As referências local e remota foram excluídas e verificadas**. Nenhuma alteração demonstrativa foi mesclada à `main` ou importada no Supabase.

## 6. Limites de preservação

- O histórico de **41 migrations já está alinhado**. Não executar `supabase db push`, `db reset`, `seed.sql` ou reparos de migrations.
- Não mudar dados reais, usuários Auth, Storage, Edge Functions, chaves, domínio, Vercel ou configurações comerciais automaticamente.
- Não executar testes com envio de comunicações ou efeitos externos sem ambiente seguro e aprovação específica.
- Não descartar alterações locais com `git reset --hard` ou `git clean`.
- Esta documentação está em branch separada; `main`, Vercel e banco original permaneceram inalterados.
- Fontes complementares: `README.md`, `RECOVERY.md`, `docs/integrations.md` e `STATUS_E_CONTINUIDADE.md` (cuja seção histórica descreve o antigo período sem acesso ao banco e **não** deve ser usada como estado atual).


## 7. Encerramento da demo-case — CONCLUÍDO EM 23/11/2026

- A exclusão remota da branch `demo-case` foi confirmada diretamente na lista de branches do GitHub.
- O usuário confirmou no PowerShell a exclusão da referência local: `Deleted branch demo-case (was f38d7a2)`.
- O comando `git branch -a --list '*demo-case*'` retornou **sem resultados**, após `git fetch --prune origin`.
- O estado final `git status --short --branch` retornou `## main...origin/main`, sem modificações locais reportadas.
- `main` e `docs/reintegracao-supabase-2026-11-23` permanecem preservadas; nenhum dado real foi alterado nem código de demonstração foi mesclado na aplicação.
- **Status de limpeza: concluído (remoto e local).** Não há ações adicionais de `demo-case` a executar.

**Estado a registrar no Guia de Retomada:** *Aplicação funcional com Supabase original Mailing recuperado; Git, ambiente, TypeScript, lint, build e 7 grupos de testes locais confirmados em 23/11/2026. Pendentes apenas: reconciliação Vercel e homologação de operações de escrita.*

## 8. Auditoria final de integridade e publicação — 23/11/2026

**Auditoria por leitura efetuada após a remoção de `demo-case`:**

- GitHub: `main` permanece em `43d6bf39f66d152bf57abbb256565061a4cf56e7`; a branch documental difere somente por este relatório e `STATUS_E_CONTINUIDADE.md`. Não há branch remota `demo-case`.
- Supabase `kcixoybbxcogpqlgeaoi`: `ACTIVE_HEALTHY`; consulta SQL **somente leitura** retornou `contacts=3107`, `organizations=3875`, `events=2`, `event_registrations=69`, `event_invites=1040`, `event_attendances=13`, `mailing_list_contacts=1040`. Valores compatíveis com o inventário da recuperação; nenhuma alteração de registros foi executada.
- Vercel: projeto `eventos`, deployment de produção `dpl_14jgMHXrVWNXzVhrQKLWBsiTkGKn` com estado `READY`, atribuído a commit `8613028b8f392ccbb0bccb33d7f61aca7d34b637`, **divergente do SHA conhecido de `tuliust/eventosinvestrs/main`**. Os metadados citam repositório `eventos`; é necessário verificar a integração Git antes de qualquer merge ou redeploy.
- A inspeção posterior por APIs de **domínios vinculados** (mais confiável para roteamento do que o campo histórico `alias` do deployment) confirmou que **somente** `bemvindo.eventosinvestrs.com.br` está vinculado e verificado no projeto `eventos`. Os domínios `eventosinvestrs.com.br` e `www.eventosinvestrs.com.br` **não estão associados ao projeto**. O domínio raiz existe, está verificado na equipe `tuliust` e usa nameservers Vercel. O usuário confirmou HTTP 404 na raiz e HTTP 200 no subdomínio `bemvindo`. A associação dos domínios principais é uma etapa separada de publicação, condicionada à revisão do vínculo Git antigo.
- Vercel contém as variáveis sensíveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` para Production/Preview, porém **os valores não foram confirmados**.
- Supabase Security Advisors: 2 avisos `WARN` — função `SECURITY DEFINER` executável por usuários autenticados e proteção contra senhas vazadas desativada. Validar função, autorização efetiva, Auth e integrações externas antes de qualquer ajuste.
- **Decisão de segurança:** nenhum merge na `main`, deploy, alteração em Auth/RLS, secrets, migrations, importações, comunicação ou check-in. Preparar incorporação **documental** por Pull Request, com revisão antes de merge.

**Status final seguro:** aplicação reintegrada e testada localmente; demo removida; dados e infraestrutura preservados; **produção, integração Git/Vercel e fluxos de escrita ainda não homologados**.

## 9. Auditoria das pendências e execução no VS Code — 23/11/2026

### 9.1 Divergência GitHub/Vercel — CAUSA IDENTIFICADA

- **Repositório recuperado e testado localmente:** `tuliust/eventosinvestrs` (`main` em `43d6bf39f66d152bf57abbb256565061a4cf56e7`).
- **Git conectado ao projeto Vercel `eventos` (ID `prj_JcLGZfKtIdmkXr17Zjql7DocChow`):** `investrs2026/eventos`, não `tuliust/eventosinvestrs`. Essa vinculação foi obtida do contexto Git dos projetos Vercel.
- A produção atual `READY` aponta para commit `8613028b8f392ccbb0bccb33d7f61aca7d34b637`, que também é o **identificador do snapshot `eventos-main(2).zip`** citado em `RECOVERY.md`. Assim, a divergência decorre da origem/histórico de recuperação, não de ausência de dados no Supabase.
- **Não mudar automaticamente o Git conectado:** desconectar `investrs2026/eventos` e ligar `tuliust/eventosinvestrs` pode iniciar um novo deploy no projeto que atende `eventosinvestrs.com.br` e `bemvindo.eventosinvestrs.com.br`.
- Etapa controlada futura: verificar Vercel → equipe `tuliust` → projeto `eventos` → Settings → Git; preservar o deployment atual e confirmar environment variables; validar um preview/staging da `main` recuperada; somente depois decidir se substitui o vínculo Git e promove o deployment. Instruções oficiais: https://vercel.com/docs/project-configuration/git-settings.
- Variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` constam em Production/Preview, mas seus valores **não foram confirmados**. Não copiar credenciais para chat nem executar `vercel env pull` nesta auditoria.

### 9.2 Segurança Supabase — diagnóstico por metadados concluído

O Supabase `Mailing` informa `authenticated_security_definer_function_executable` e `auth_leaked_password_protection` como WARN. Consulta **somente leitura** a `pg_proc` mostrou:

- `add_event_confirmation`, `check_in_event`, `check_in_event_idempotent` e `undo_event_checkin`: `SECURITY DEFINER`, executáveis por `authenticated`, não por `anon`; seus corpos contêm referências a `auth.uid()` e `is_active_staff()`.
- `current_user_role` e `is_active_staff`: executáveis por `authenticated`, não por `anon`; exercem funções de autorização. O corpo de `current_user_role` referencia `auth.uid()`; `is_active_staff` referencia `current_user_role`.
- `apply_organization_import_service` e `handle_new_user`: `SECURITY DEFINER`, **sem execução direta concedida a `anon` ou `authenticated`**.
- Todas as funções listadas têm `search_path` configurado explicitamente; isso não equivale a auditoria de segurança de toda a implementação.
- **Não revogar** `EXECUTE` de RPCs de check-in automaticamente: o sistema precisa delas para operar. Auditar os corpos e políticas RLS antes de propor mudanças.
- Verificar no painel Auth a disponibilidade de **leaked password protection**; o Supabase informa disponibilidade no plano **Pro ou superior** (https://supabase.com/docs/guides/auth/password-security). Não foi habilitada nesta rodada.

### 9.3 Integridade e testes sem gravar dados reais

- Histórico de migrations: **41** arquivos canônicos correspondem às **41** entradas do Supabase recuperado; não reaplicar, nem rodar `seed.sql`.
- Registros recontados: **3.107 contatos**, **3.875 organizações**, **2 eventos**, **69 inscrições**, **1.040 convites**, **13 presenças**, **1.040 vínculos de mailing**.
- Os sete grupos de testes funcionais locais foram confirmados pelo usuário. A suíte E2E usa **mock sintético**, que não substitui a validação de RLS/Edge Functions com dados reais.
- Para escrita real (importações, convites, comunicações, check-in e reversão), preparar **staging isolado com dados sintéticos**, contas de teste e saídas externas desativadas, verificar rollback e permissões; depois fazer homologação formal antes de produção.

### 9.4 Comandos seguros para o terminal PowerShell do VS Code

~~~powershell
Set-Location 'C:\Users\Tulius\Documents\github\eventosinvestrs'

if ((git branch --show-current) -ne 'main') {
    throw 'Troque para main somente depois de preservar alteracoes locais.'
}
git status --short --branch
git fetch --prune origin
if ($LASTEXITCODE -ne 0) { throw 'Falha ao consultar GitHub.' }
git rev-list --left-right --count main...origin/main
git branch -a --list '*demo-case*'
git remote get-url origin

if (-not (Test-Path '.env.local')) { throw '.env.local ausente.' }
$EnvVars = @{}
Get-Content '.env.local' | ForEach-Object {
    if ($_ -match '^\s*(VITE_SUPABASE_URL|VITE_SUPABASE_PUBLISHABLE_KEY)\s*=(.*)$') {
        $EnvVars[$matches[1]] = $matches[2].Trim().Trim('"', "'")
    }
}
$Key = $EnvVars['VITE_SUPABASE_PUBLISHABLE_KEY']
Write-Output "URL correta: $($EnvVars['VITE_SUPABASE_URL'] -eq 'https://kcixoybbxcogpqlgeaoi.supabase.co')"
Write-Output "Chave publica: $($Key -like 'sb_publishable_*')"
Write-Output "Secret indevido: $($Key -like 'sb_secret_*')"

pnpm run typecheck
if ($LASTEXITCODE -ne 0) { throw 'TypeScript reprovado.' }
pnpm run lint
if ($LASTEXITCODE -ne 0) { throw 'Lint reprovado.' }
pnpm run build
if ($LASTEXITCODE -ne 0) { throw 'Build reprovado.' }

if (Get-Command vercel -ErrorAction SilentlyContinue) {
    vercel project inspect eventos --scope tuliust
} else {
    Write-Output 'Vercel CLI nao instalado. Use o dashboard.'
}
~~~

O `vercel project inspect` é leitura; não altera o vínculo Git. **Não executar** `vercel git connect`, `vercel git disconnect`, `vercel deploy --prod`, `supabase db push`, importações ou check-ins nesta etapa.

### 9.5 Critérios de encerramento

- **Concluído:** banco recuperado; migrations alinhadas; Git e testes locais; exclusão da demo; identificação exata do Git antigo na Vercel; auditoria preliminar dos privilégios de funções; documentação.
- **Pendente:** validar preview/staging da `main` atual; decidir e executar mudança controlada do vínculo Vercel; conferir os valores das variáveis em ambiente protegido; homologar Auth, RLS, importações, e-mails, convites, check-ins e integrações externas sem dados de produção.
- Pull Request documental: https://github.com/tuliust/eventosinvestrs/pull/1 (**draft**, sem merge). A incorporação à `main` deve aguardar revisão dos gatilhos de deploy.

## 10. Resultado de execução no VS Code e causa do HTTP 404 — 23/11/2026

O usuário executou os comandos de validação em PowerShell no VS Code e enviou a saída integral:

| Verificação | Resultado |
| --- | --- |
| `git status --short --branch` inicial/final | `## main...origin/main` (limpa e sincronizada) |
| `git rev-list --left-right --count main...origin/main` | `0 0` |
| `git branch -a --list '*demo-case*'` | Sem entradas |
| `git remote get-url origin` | `https://github.com/tuliust/eventosinvestrs.git` |
| `pnpm run typecheck` | **APROVADO** |
| `pnpm run lint` | **APROVADO**, zero warnings |
| `pnpm run build` | **APROVADO**, Vite `8.0.5`, 151 módulos, 619 ms |
| Otimização | Aviso **não bloqueante** de JS 936,03 kB (gzip 247,08 kB) |
| `vercel.cmd project inspect eventos --scope tuliust` | Projeto `prj_JcLGZfKtIdmkXr17Zjql7DocChow` encontrado; Vite, Node 24.x |
| HTTP `HEAD https://eventosinvestrs.com.br/` | **HTTP 404** |
| HTTP `HEAD https://bemvindo.eventosinvestrs.com.br/` | **HTTP 200** |

### Diagnóstico de domínio por API autenticada da Vercel

- A zona `eventosinvestrs.com.br` consta no inventário de domínios da equipe `tuliust`, com `verified=true` e nameservers `ns1.vercel-dns.com` / `ns2.vercel-dns.com`.
- No projeto Vercel `eventos` **somente** o domínio `bemvindo.eventosinvestrs.com.br` está associado (`verified=true`).
- A busca específica de `eventosinvestrs.com.br` e `www.eventosinvestrs.com.br` no projeto retorna **`404 Project Domain not found`**. A consulta de todos os domínios da zona na equipe confirma uma única associação: `bemvindo.eventosinvestrs.com.br`.
- **Causa identificada para o 404 da raiz:** não existe associação do domínio principal ao projeto de produção; a verificação DNS da zona não cria automaticamente um domínio de projeto.
- **Segunda divergência independente:** o projeto Vercel `eventos` está ligado a `investrs2026/eventos`, mas a aplicação recuperada/testada é `tuliust/eventosinvestrs`. A associação imediata da raiz serviria o deployment **antigo**, e não necessariamente a versão recuperada/validada localmente.

### Ordem segura para homologar a publicação

1. Conferir no painel da equipe `tuliust` → projeto Vercel `eventos` → Settings → Git qual código/branch está vinculado; preservar o deployment existente até haver preview aprovado da `main` recuperada.
2. Conferir **privadamente** em Settings → Environment Variables os valores públicos de URL/chave Supabase, sem copiar tokens para logs ou chat.
3. Preparar e homologar um **preview/staging controlado**, sem dados reais mutáveis e sem enviar mensagens/check-ins.
4. Após homologação e decisão de publicação, conectar o código correto ao projeto, associar `eventosinvestrs.com.br` e `www.eventosinvestrs.com.br` em Settings → Domains, configurar redirecionamento desejado e validar HTTP 200, login e consultas reais na produção.
5. Rever acesso, Auth e RLS. Testes de escrita devem ser feitos apenas em staging isolado, usando dados sintéticos e sem saídas externas.

**Não foram feitas alterações de domínios, DNS, integração Git, configuração da Vercel, banco, migrations ou código.** O PR #1 segue **draft**, apenas documental; o encerramento da **recuperação local** permanece concluído, enquanto o encerramento da **publicação/homologação de produção** permanece pendente.
