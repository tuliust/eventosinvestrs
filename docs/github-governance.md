# Governança do GitHub

## Fluxo obrigatório

A branch `main` representa o código integrado e não deve receber desenvolvimento direto.

Toda alteração deve seguir este fluxo:

1. atualizar a `main` local;
2. criar uma branch a partir da `main`;
3. implementar e validar a alteração;
4. abrir Pull Request para `main`;
5. aguardar o CI concluir com sucesso;
6. revisar o diff;
7. fazer merge somente após as verificações obrigatórias.

## Convenção de branches

Use somente os prefixos abaixo para novas branches:

- `feature/<descricao>` — novas funcionalidades;
- `fix/<descricao>` — correções;
- `chore/<descricao>` — infraestrutura, dependências, CI, documentação e manutenção.

Exemplos:

- `feature/importacao-luma`;
- `fix/checkin-duplicado`;
- `chore/atualizar-dependencias`.

Branches antigas com o prefixo `feat/` podem permanecer no histórico, mas novas implementações devem usar `feature/`.

## Proteção recomendada para `main`

A integração utilizada pelo ChatGPT não expõe ações administrativas de branch protection/rulesets. Portanto, esta configuração deve ser feita manualmente por um administrador do repositório.

No GitHub, acesse **Settings → Rules → Rulesets → New ruleset → New branch ruleset** e configure:

- **Ruleset name:** `Protect main`;
- **Enforcement status:** `Active`;
- **Target branches:** incluir somente `main`;
- **Restrict deletions:** habilitado;
- **Block force pushes:** habilitado;
- **Require a pull request before merging:** habilitado;
- **Required approvals:** pelo menos 1 quando houver outro revisor disponível; se o projeto estiver temporariamente com um único mantenedor, o requisito de PR pode ser mantido com 0 aprovações até existir segundo revisor;
- **Dismiss stale pull request approvals when new commits are pushed:** recomendado;
- **Require conversation resolution before merging:** recomendado;
- **Require status checks to pass:** habilitado;
- selecionar como checks obrigatórios, depois que o workflow tiver executado ao menos uma vez:
  - `CI / quality`;
  - `CI / e2e`;
- **Require branches to be up to date before merging:** habilitado;
- não criar bypass permanente para desenvolvimento cotidiano; se um bypass administrativo for necessário para incidente operacional, deve ser excepcional e documentado.

## CI obrigatório

O workflow `.github/workflows/ci.yml` executa em `pull_request` e em `push` para `main`:

- instalação das dependências;
- `pnpm typecheck`;
- `pnpm lint`;
- `pnpm test`;
- `pnpm build`;
- suíte E2E Playwright em job separado.

Qualquer etapa com erro encerra o job com falha. O workflow não contém credenciais reais da Invest RS ou do Supabase.

## Segredos e dados

Nunca versionar:

- `.env.local` ou outros arquivos `.env` reais;
- `service_role` do Supabase;
- senhas de banco;
- API keys do Beehiiv ou de qualquer integração;
- arquivos de mailing, CSV Luma ou fixtures contendo dados pessoais reais.

Testes automatizados devem usar somente dados sintéticos.

## Merge

Preferir **Squash and merge** para branches de implementação, mantendo um commit lógico por PR na `main`. O PR deve indicar claramente:

- escopo;
- testes executados;
- alterações de banco, se houver;
- riscos conhecidos ou itens não cobertos.
