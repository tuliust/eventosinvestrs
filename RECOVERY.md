# Recuperação do projeto Eventos / Bem-vindo

Este repositório foi reconstruído a partir do snapshot `eventos-main(2).zip` fornecido em 23/09/2026. O arquivo ZIP registra o identificador de origem `8613028b8f392ccbb0bccb33d7f61aca7d34b637`.

## Arquitetura recuperada

- `eventosinvestrs.com.br`: aplicação principal de gestão de eventos, mailing, contatos, organizações, inscrições, comunicações e check-in.
- `bemvindo.eventosinvestrs.com.br`: subaplicação do mesmo código-fonte, implementada em `src/welcome/`.
- `/bemvindo` e `/bemvindo/admin`: rotas alternativas da mesma subaplicação.
- Não criar um segundo backend ou um fork independente para `bemvindo`: ele compartilha a mesma aplicação e o mesmo Supabase.

## Supabase original identificado

- Nome do projeto: `Mailing`
- Project ref: `kcixoybbxcogpqlgeaoi`
- Região: `sa-east-1`
- URL: `https://kcixoybbxcogpqlgeaoi.supabase.co`
- Estado observado em 23/09/2026: `INACTIVE`

As migrations canônicas estão em `supabase/migrations/`. A migration `20260910160412_add_welcome_guide_cms.sql` contém a infraestrutura do Guia de Boas-vindas.

## Vercel

O código conserva `vercel.json` com rewrite SPA para `index.html`. Os domínios conhecidos são:

- `eventosinvestrs.com.br`
- `bemvindo.eventosinvestrs.com.br`

A conexão Vercel disponível durante a recuperação não tinha acesso aos projetos/deployments desses domínios, portanto variáveis de ambiente e metadados de projeto não foram copiados.

## Variáveis de ambiente

O repositório mantém apenas valores públicos/placeholder em `.env.example`. Nunca commitar chaves secretas ou service-role. Para executar, configurar localmente:

```env
VITE_SUPABASE_URL=https://kcixoybbxcogpqlgeaoi.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=
```

## Verificação

O snapshot não contém chaves Supabase gravadas no código. A instalação/build não pôde ser executada no ambiente de recuperação porque o acesso ao registry npm estava indisponível; o lockfile original foi preservado para uma instalação reproduzível.
