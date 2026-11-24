# RELATÓRIO DE RETOMADA — EVENTOSINVESTRS

> **Atualização da limpeza Git (verificação posterior em 23/11/2026):** a branch remota `demo-case` foi **excluída e sua ausência confirmada diretamente na lista de branches do GitHub**. O usuário executou `git fetch --prune origin` em ambos os repositórios; `git branch -a --list '*demo-case*'` apresentou apenas `demo-case` **local**. **Pendente: excluir a referência local** com a `main` limpa e sem worktree usando essa branch. `main`, branch documental e dados Supabase foram preservados.

**Data da verificação:** 23/11/2026  
**Status:** **REINTEGRAÇÃO FUNCIONAL LOCAL CONCLUÍDA** com o Supabase original `Mailing`; `demo-case` excluída do GitHub, mas ainda existente localmente; reconciliação Vercel pendente.  
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
| Administrativa | `demo-case` | **Remota excluída e confirmada**; excluir apenas referência **local** após verificações de segurança |

A antiga `demo-case` contém apenas código de testes/fixtures de demonstração: `e2e/mockSupabase.ts` e `e2e/visualizar-paginas.spec.ts` diferentes da `main`. **Não mesclar** essas mudanças na `main`, nem importá-las ao Supabase. **A exclusão remota foi confirmada** posteriormente pelo GitHub; permanece a branch **local**, cujo descarte foi autorizado.

## 6. Limites de preservação

- O histórico de **41 migrations já está alinhado**. Não executar `supabase db push`, `db reset`, `seed.sql` ou reparos de migrations.
- Não mudar dados reais, usuários Auth, Storage, Edge Functions, chaves, domínio, Vercel ou configurações comerciais automaticamente.
- Não executar testes com envio de comunicações ou efeitos externos sem ambiente seguro e aprovação específica.
- Não descartar alterações locais com `git reset --hard` ou `git clean`.
- Esta documentação está em branch separada; `main`, Vercel e banco original permaneceram inalterados.
- Fontes complementares: `README.md`, `RECOVERY.md`, `docs/integrations.md` e `STATUS_E_CONTINUIDADE.md` (cuja seção histórica descreve o antigo período sem acesso ao banco e **não** deve ser usada como estado atual).


## 7. Encerramento da demo-case — REMOTA EXCLUÍDA; LOCAL PENDENTE

- A remoção remota `demo-case` foi confirmada diretamente na listagem de branches do GitHub para `tuliust/eventosinvestrs`; somente `main`, `docs/reintegracao-supabase-2026-11-23` e outras branches não relacionadas persistem conforme o repositório.
- O usuário executou `git fetch --prune origin`. Em seguida, `git branch -a --list '*demo-case*'` exibiu apenas `  demo-case`, indicando que a **referência local** não foi removida.
- O antigo commit exclusivo da demonstração era `f38d7a26b40c6b27010794caa8964c129c5ce46a`. Seu conteúdo demonstrativo não foi mesclado à `main`.
- Para remover a referência local no Windows: confirmar que a branch atual é `main`, `git status --porcelain` está vazio, `git ls-remote --heads origin demo-case` retorna vazio com sucesso e nenhuma worktree utiliza `demo-case`. Então executar `git branch -D demo-case`. O `-D` é intencional porque a demo continha commits exclusivos e o usuário autorizou seu descarte.
- Verificar novamente `git branch -a --list '*demo-case*'`. Após saída vazia, registrar **limpeza concluída**; até lá, o status local é **PENDENTE**.

**Estado a registrar no Guia de Retomada:** *Aplicação funcional com Supabase original Mailing recuperado; Git, ambiente, TypeScript, lint, build e 7 grupos de testes locais confirmados em 23/11/2026. Pendente: exclusão local de `demo-case`, reconciliação Vercel e homologação de operações de escrita.*
