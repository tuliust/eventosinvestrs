# Integrações

## Beehiiv

A integração com Beehiiv é opcional. A Plataforma continua permitindo registro manual de comunicações quando a integração não está configurada.

### Arquitetura

`Frontend → Supabase Edge Function beehiiv-integration → Beehiiv API v2`

Nenhuma credencial Beehiiv é exposta ao navegador.

### Secrets no Supabase

Configure na área de Edge Functions / Secrets:

- `BEEHIIV_API_KEY`
- `BEEHIIV_PUBLICATION_ID`

A Edge Function também utiliza os secrets internos do Supabase (`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`) para validar o usuário e confirmar que ele possui perfil `admin` ativo.

### Funcionalidades

- verificar se a integração está configurada;
- consultar uma campanha existente pelo `post_id`;
- criar um segmento manual Beehiiv a partir dos e-mails elegíveis;
- criar um post/campanha direcionado ao segmento;
- criar como rascunho ou confirmar o envio imediatamente;
- registrar `external_campaign_id`, status e metadados na comunicação do evento.

### Regras de segurança e operação

- somente administradores autenticados podem chamar a integração;
- e-mails impedidos na Plataforma não são enviados para a criação do segmento;
- a Plataforma não reativa automaticamente assinantes descadastrados no Beehiiv;
- o endpoint de segmento do Beehiiv ignora e-mails que ainda não sejam assinantes; a Plataforma registra a quantidade solicitada e, quando retornada, a quantidade reconhecida pelo Beehiiv;
- se o plano Beehiiv não oferecer o Send API/Create Post, a API externa retornará erro e nenhuma comunicação será registrada como enviada;
- o envio imediato exige confirmação explícita na interface.
