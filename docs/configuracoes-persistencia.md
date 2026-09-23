# Persistência de configurações

A gravação de `app_settings` é feita pela Edge Function `admin-settings`.
O frontend considera a operação concluída somente após receber a linha atualizada e reler a configuração do Supabase, comparando os valores persistidos com o patch enviado.
