import type { OrgType } from "./types"

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  empresa_privada: "Empresa privada",
  imprensa: "Imprensa",
  associacao: "Associação",
  entidade: "Entidade",
  orgao_governamental: "Órgão governamental",
  embaixada_consulado: "Embaixada / Consulado",
  instituicao_financeira: "Instituição financeira",
  universidade_academia: "Universidade / Academia",
  outro: "Outro",
}

export const PRIORITY_SECTORS = [
  "Agronegócio e Bioeconomia",
  "Energia e Infraestrutura",
  "Tecnologia e Inovação",
  "Saúde e Ciências da Vida",
  "Indústria de Base e Mineração",
  "Defesa e Segurança",
  "Serviços Financeiros e Fintechs",
  "Logística e Mobilidade",
  "Construção Civil e Imobiliário",
  "Economia Criativa e Turismo",
  "Educação e Capacitação",
  "Comércio Internacional e Exportações",
]

export const CANONICAL_FIELD_LABELS: Record<string, string> = {
  name: "Nome completo",
  firstName: "Primeiro nome",
  lastName: "Sobrenome",
  email: "E-mail",
  phone: "Telefone / WhatsApp",
  company: "Empresa / Organização",
  position: "Cargo",
  externalId: "ID externo",
  registeredAt: "Data da inscrição",
  approvalStatus: "Status de aprovação",
  qrCode: "QR Code",
  checkedInAt: "Check-in externo",
  skip: "Ignorar coluna",
  custom: "Campo personalizado",
}

// Mapping suggestions for Luma CSV headers
export const HEADER_CANONICAL_MAP: Record<string, string> = {
  name: "name",
  nome: "name",
  full_name: "name",
  first_name: "firstName",
  primeiro_nome: "firstName",
  last_name: "lastName",
  sobrenome: "lastName",
  email: "email",
  "e-mail": "email",
  guest_email: "email",
  phone: "phone",
  phone_number: "phone",
  telefone: "phone",
  celular: "phone",
  whatsapp: "phone",
  company: "company",
  empresa: "company",
  organization: "company",
  "para qual empresa você trabalha?": "company",
  "para qual empresa voce trabalha?": "company",
  job_title: "position",
  cargo: "position",
  position: "position",
  role: "position",
  "qual é o seu cargo?": "position",
  "qual e o seu cargo?": "position",
  guest_id: "externalId",
  id: "externalId",
  external_id: "externalId",
  created_at: "registeredAt",
  registered_at: "registeredAt",
  data_inscricao: "registeredAt",
  approval_status: "approvalStatus",
  status: "approvalStatus",
  qr_code_url: "qrCode",
  qr_code: "qrCode",
  qrcode: "qrCode",
  checked_in_at: "checkedInAt",
  check_in_at: "checkedInAt",
  check_in: "checkedInAt",
}

// Columns to auto-skip in Luma CSV (not useful for the app)
export const LUMA_SKIP_COLUMNS = [
  "utm_source", "referrer", "referred_by", "amount", "amount_tax",
  "amount_discount", "currency", "coupon_code", "eth_address",
  "solana_address", "survey_response_rating", "survey_response_feedback",
  "ticket_type_id", "ticket_name",
]

export const EVENT_STATUS_LABELS = {
  draft: "Rascunho",
  upcoming: "Agendado",
  live: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
}

export const EVENT_FORMAT_LABELS = {
  presencial: "Presencial",
  online: "Online",
  hibrido: "Híbrido",
}

export const SOURCE_LABELS: Record<string, string> = {
  luma: "Luma",
  invited: "Convidado",
  mailing: "Mailing",
  walk_in: "Walk-in",
  qr: "QR Code",
}
