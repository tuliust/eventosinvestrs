-- Temporariamente, todo usuário autorizado da plataforma opera como administrador.
-- O papel receptionist permanece aceito pelo schema para reintrodução futura,
-- mas deixa de ser o padrão e todos os perfis existentes são normalizados para admin.

update public.profiles
set role = 'admin',
    updated_at = now()
where role is distinct from 'admin';

alter table public.profiles
  alter column role set default 'admin';
