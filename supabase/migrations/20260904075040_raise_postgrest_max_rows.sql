-- A base de contatos e organizações ultrapassa o limite padrão de 1.000 linhas
-- por resposta do PostgREST. Este limite é compartilhado pelo frontend e pelas
-- Edge Functions que usam o Data API para consultar a base existente.
--
-- 20.000 mantém uma proteção contra respostas acidentalmente muito grandes,
-- mas permite trabalhar com a base atual e seu crescimento previsto sem
-- truncar contatos, organizações ou referências usadas na deduplicação.
alter role authenticator set pgrst.db_max_rows = '20000';

-- A configuração é reloadable; aplica a alteração sem reiniciar o projeto.
notify pgrst, 'reload config';
