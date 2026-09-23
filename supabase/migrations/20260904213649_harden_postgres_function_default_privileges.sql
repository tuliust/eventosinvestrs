-- Exige grants explícitos para novas funções criadas pelas migrations da aplicação (owner postgres).
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
