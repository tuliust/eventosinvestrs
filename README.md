# Invest RS — Plataforma de Eventos

Aplicação React/TypeScript para gestão de eventos, contatos, inscrições e check-in da Invest RS.

## Executar o projeto

1. Instale as dependências com o lockfile versionado:

   ```bash
   pnpm install --frozen-lockfile
   ```

2. Copie `.env.example` para `.env.local` e preencha os dados exibidos em **Supabase → Connect → App Frameworks**:

   ```env
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=
   ```

3. Inicie o Vite:

   ```bash
   pnpm dev
   ```

## Qualidade e testes

Antes de abrir ou atualizar um Pull Request, execute:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Para os fluxos críticos de navegador:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

A suíte E2E usa um backend Supabase sintético interceptado pelo Playwright. Nenhuma credencial real ou dado pessoal é necessário para os testes.

O workflow `.github/workflows/ci.yml` executa as mesmas verificações em todo Pull Request e em pushes para `main`. A instalação usa `pnpm install --frozen-lockfile`, e o `pnpm-lock.yaml` deve permanecer sincronizado com o `package.json`. Consulte `docs/github-governance.md` para o fluxo de branches, revisão e proteção recomendada da `main`.

## Preparar o Supabase

As migrations em `supabase/migrations` criam as tabelas, funções atômicas de check-in, índices contra duplicidade e políticas RLS. O arquivo `supabase/seed.sql` usa apenas dados sintéticos para desenvolvimento; contatos e inscrições reais devem ser importados diretamente na aplicação autenticada.

Com o Supabase CLI autenticado:

```bash
supabase link --project-ref SEU_PROJECT_REF
supabase db push --dry-run
supabase db push --include-seed
```

Depois da migration:

1. Crie ou convide os usuários autorizados pela área administrativa da plataforma ou pelo fluxo administrativo do Supabase.
2. No estágio atual do projeto, todos os usuários com acesso devem possuir `role = 'admin'`. O backend administrativo também força novos convites e alterações de acesso para `admin`.
3. Mantenha o cadastro público desativado. A aplicação oferece somente login, sem autoinscrição.

## Permissões

- `admin`: perfil operacional vigente, com leitura e gestão de eventos, contatos, organizações, inscrições, convites, check-in e configurações administrativas.
- `receptionist`: valor reservado no modelo para uma etapa futura; não deve ser atribuído a usuários enquanto esse nível de acesso não for implementado formalmente. Cenários desse papel podem permanecer apenas em fixtures sintéticas para preparar a futura matriz de permissões.
- `anon`: sem acesso às tabelas da aplicação.

O check-in e sua reversão passam pelas funções de banco correspondentes. O usuário é obtido da sessão do Supabase; o cliente não pode escolher quem realizou a operação.

## Domínios e recuperação

- Aplicação principal: `eventosinvestrs.com.br`
- Guia de boas-vindas: `bemvindo.eventosinvestrs.com.br` (mesma codebase, em `src/welcome/`)
- Supabase identificado: projeto `Mailing` (`kcixoybbxcogpqlgeaoi`)

Consulte `RECOVERY.md` para a rastreabilidade da reconstrução.
