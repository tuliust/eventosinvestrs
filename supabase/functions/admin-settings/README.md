# admin-settings

Edge Function autenticada usada pela área `/configuracoes` para persistir configurações globais.

- exige JWT válido;
- valida que o usuário esteja ativo e tenha função `admin`;
- aceita apenas campos conhecidos de `app_settings`;
- executa o update sob o contexto do usuário autenticado para preservar as políticas RLS e a auditoria;
- retorna a linha persistida para confirmação pelo frontend.
