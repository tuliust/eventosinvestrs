# Encerramento da recuperação — EventosInvestRS

**Data de encerramento documental:** 24/11/2026 (America/Sao_Paulo).  
**Classificação:** **RECUPERAÇÃO FUNCIONAL LOCAL CONCLUÍDA / PUBLICAÇÃO PRINCIPAL NÃO HOMOLOGADA**.  
**Natureza:** fotografia do estado verificado; não é autorização para mudar domínios, Git/Vercel, Supabase ou executar operações que alterem dados.

## 1. Decisão de encerramento

O Supabase original `Mailing` foi recuperado e a aplicação voltou a **autenticar e consultar dados históricos em ambiente local**. As branches de demonstração foram eliminadas, a `main` está sincronizada e todos os testes locais informados foram aprovados.

O processo de **recuperação funcional local está encerrado**. A publicação do endereço principal e a homologação dos fluxos de escrita são uma fase diferente, rastreada em [issue #2](https://github.com/tuliust/eventosinvestrs/issues/2).

## 2. Estado confirmado

| Recurso | Estado em 24/11/2026 |
| --- | --- |
| Repositório recuperado | [`tuliust/eventosinvestrs`](https://github.com/tuliust/eventosinvestrs), `main` commit `43d6bf39f66d152bf57abbb256565061a4cf56e7` |
| Diretório local utilizado | `C:\Users\Tulius\Documents\github\eventosinvestrs` |
| Git no último teste Windows | `main...origin/main`, `0 0`, sem alterações reportadas |
| Demos | `demo-case` excluída remotamente e localmente; nenhuma referência na listagem final |
| Supabase original | Projeto `Mailing`, ref `kcixoybbxcogpqlgeaoi`, `ACTIVE_HEALTHY` |
| Registros recontados | 3.107 contatos, 3.875 organizações, 2 eventos, 69 inscrições, 1.040 convites, 13 presenças, 1.040 vínculos de mailing |
| Migrations | 41 no GitHub e 41 no histórico do Supabase (alinhadas) |
| Configuração local | `.env.local` com URL original e chave publicável; nenhuma chave secret exposta |
| Build | `pnpm run typecheck`, `pnpm run lint`, `pnpm run build` aprovados; Vite `8.0.5`, 151 módulos, 619 ms |
| Testes locais | 7 grupos confirmados: login, Dashboard, contatos, organizações, eventos/inscrições, mailing, segmentações/relatórios |
| Vercel existente | Projeto `eventos` (`prj_JcLGZfKtIdmkXr17Zjql7DocChow`) conectado ao **repositório antigo `investrs2026/eventos`** |
| Origem da produção Vercel | Deployment `READY` no SHA `8613028b8f392ccbb0bccb33d7f61aca7d34b637`, identificador do snapshot citado em `RECOVERY.md`; **não é SHA da `main` recuperada** |
| Subdomínio de boas-vindas | `bemvindo.eventosinvestrs.com.br` vinculado e verificado no projeto Vercel; `HEAD /` respondeu HTTP 200 |
| Domínio principal | `eventosinvestrs.com.br`: zona verificada na equipe Vercel, mas **sem associação ao projeto `eventos`**; `HEAD /` retornou HTTP 404 |
| Domínio `www` | `www.eventosinvestrs.com.br` também **não associado** ao projeto `eventos` |
| Documentação | Branch `docs/reintegracao-supabase-2026-11-23`; PR [#1](https://github.com/tuliust/eventosinvestrs/pull/1) **draft, sem merge** |

O HTTP 404 é coerente com a falta de associação do domínio raiz ao projeto. O HTTP 200 do subdomínio de boas-vindas apenas demonstra disponibilidade HTTP; não homologa a versão recuperada nem operações administrativas na produção.

## 3. Pendências transferidas para a próxima fase

A **[issue #2 — Git/Vercel, domínio e homologação](https://github.com/tuliust/eventosinvestrs/issues/2)** registra, em ordem segura:

1. Revisar o deployment existente e as variáveis Vercel de forma privada; não exibir chaves nem segredos.
2. Homologar uma versão de teste da `main` recuperada em preview/staging isolado.
3. Somente após validação, decidir a substituição controlada do vínculo Git antigo `investrs2026/eventos` por `tuliust/eventosinvestrs`.
4. Associar `eventosinvestrs.com.br` e `www.eventosinvestrs.com.br` ao projeto **após** aprovar a publicação, preservando `bemvindo`; testar HTTP, Auth e consultas.
5. Revisar os dois avisos WARN do Supabase (funções `SECURITY DEFINER` executáveis por usuários autenticados e proteção contra senhas vazadas desativada), sem revogar RPCs operacionais indiscriminadamente.
6. Homologar importações, confirmações, comunicação/Beehiiv e check-in com dados sintéticos, contas de teste e sem disparos externos.

**Não executar migrations, seeds ou reimportar registros:** o banco real está recuperado.

## 4. Retomada segura

~~~powershell
Set-Location 'C:\Users\Tulius\Documents\github\eventosinvestrs'
git status --short --branch
git fetch --prune origin
git rev-list --left-right --count main...origin/main
git show origin/docs/reintegracao-supabase-2026-11-23:ENCERRAMENTO_RECUPERACAO_2026-11-24.md
pnpm run typecheck
pnpm run lint
pnpm run build
~~~

Consultar [relatório de retomada](RELATORIO_DE_RETOMADA_2026-11-23.md), [trilha de continuidade](STATUS_E_CONTINUIDADE.md), `README.md` e `RECOVERY.md`. Conferir `.env.local` sem revelar credenciais e usar a branch `main` (não uma demo).

## 5. Regras de preservação

- Não executar `supabase db reset`, `db push`, `seed.sql`, importações reais, check-in, disparos de mensagens, `git reset --hard` nem `git clean` apenas para 'finalizar'.
- Não mudar o Git associado à Vercel, nem apontar o domínio raiz ao deployment antigo antes da homologação do código recuperado.
- **Nenhum merge na `main`, deploy, ajuste de domínio ou mutação de banco foi feito para este encerramento.**
- A PR documental **permanece draft**, para evitar merge e eventual publicação não revisados.

**Resultado final:** recuperação concluída e arquivada, dados históricos preservados, publicação principal pendente e rastreada na issue #2.
