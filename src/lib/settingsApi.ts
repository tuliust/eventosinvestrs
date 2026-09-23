import { FunctionsHttpError } from "@supabase/supabase-js"
import { supabase } from "./supabase"

export type AppSettings = {
  id: string
  platform_name: string
  organization_name: string
  default_state: string
  default_country: string
  timezone: string
  logo_url: string | null
  default_event_owner: string | null
  frequent_organizations: string[]
  default_event_type: string
  default_event_format: "presencial" | "online" | "hibrido"
  default_capacity: number
  allow_walk_ins: boolean
  quick_registration_required_fields: string[]
  prevent_duplicate_checkin: boolean
  allow_undo_checkin: boolean
  reception_autofocus: boolean
  checkin_feedback: "visual" | "sound" | "both" | "none"
  realtime_refresh_seconds: number
}

export type AdminUser = {
  id: string
  email: string
  name: string
  role: "admin" | "receptionist"
  active: boolean
  created_at: string
  updated_at: string
  last_sign_in_at: string | null
  invited_at: string | null
  email_confirmed_at: string | null
}

export type AuditLog = {
  id: string
  actor_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  profiles?: { name?: string | null; email?: string | null } | null
}

export type ImportTemplate = {
  id: string
  name: string
  source: "luma" | "generic"
  mapping: Record<string, unknown>
  match_by: string[]
  unnamed_strategy: "keep_email" | "placeholder" | "reject"
  created_by: string
  created_at: string
  updated_at: string
}

function throwIf(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function loadSettings(): Promise<AppSettings> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", "global")
    .single()
  throwIf(error)
  return data as AppSettings
}

export async function saveSettings(
  patch: Partial<AppSettings>,
): Promise<AppSettings> {
  const { data, error } = await supabase.functions.invoke("admin-settings", {
    body: { action: "save", patch },
  })

  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  if (!data?.settings) throw new Error("O servidor não confirmou a persistência das configurações.")

  const persisted = await loadSettings()
  for (const [key, value] of Object.entries(patch)) {
    const persistedValue = persisted[key as keyof AppSettings]
    if (JSON.stringify(persistedValue) !== JSON.stringify(value)) {
      throw new Error(`A configuração ${key} não foi persistida corretamente.`)
    }
  }

  return persisted
}

export async function loadUserPreferences(userId: string) {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("preferences")
    .eq("user_id", userId)
    .maybeSingle()
  throwIf(error)
  return (data?.preferences || {}) as Record<string, unknown>
}

export async function saveUserPreferences(
  userId: string,
  preferences: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("user_preferences")
    .upsert({ user_id: userId, preferences }, { onConflict: "user_id" })
  throwIf(error)
}

async function adminUsers(
  action: string,
  payload: Record<string, unknown> = {},
) {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action, ...payload },
  })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data
}

export async function loadAdminUsers(): Promise<AdminUser[]> {
  const data = await adminUsers("list")
  return data.users || []
}

export async function inviteAdminUser(params: {
  name: string
  email: string
  role: "admin" | "receptionist"
  redirectTo?: string
}) {
  return adminUsers("invite", params)
}

export async function updateAdminUserAccess(params: {
  userId: string
  role: "admin" | "receptionist"
  active: boolean
}) {
  return adminUsers("update_access", params)
}

export async function sendUserRecovery(
  email: string,
  redirectTo?: string,
) {
  return adminUsers("recovery", { email, redirectTo })
}

export async function updateOwnProfile(name: string) {
  return adminUsers("update_self", { name })
}

export async function updateOwnPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password })
  throwIf(error)
}

export async function loadImportTemplates(): Promise<ImportTemplate[]> {
  const { data, error } = await supabase
    .from("import_templates")
    .select("*")
    .order("name")
  throwIf(error)
  return (data || []) as ImportTemplate[]
}

export async function saveImportTemplate(input: {
  id?: string
  name: string
  source: "luma" | "generic"
  mapping: Record<string, unknown>
  match_by: string[]
  unnamed_strategy: "keep_email" | "placeholder" | "reject"
  created_by: string
}) {
  const payload = {
    ...(input.id ? { id: input.id } : {}),
    name: input.name,
    source: input.source,
    mapping: input.mapping,
    match_by: input.match_by,
    unnamed_strategy: input.unnamed_strategy,
    created_by: input.created_by,
  }
  const { data, error } = await supabase
    .from("import_templates")
    .upsert(payload)
    .select("*")
    .single()
  throwIf(error)
  return data as ImportTemplate
}

export async function deleteImportTemplate(id: string) {
  const { error } = await supabase
    .from("import_templates")
    .delete()
    .eq("id", id)
  throwIf(error)
}

export async function loadAuditLogs(): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*, profiles(name,email)")
    .order("created_at", { ascending: false })
    .limit(250)
  throwIf(error)
  return (data || []) as AuditLog[]
}

export async function deleteAllContacts(confirmation: string): Promise<number> {
  const { data, error } = await supabase.functions.invoke("admin-maintenance", {
    body: { action: "delete_all_contacts", confirmation },
  })

  if (error) {
    let detail = ""
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json()
        detail = body?.error || ""
      } catch {
        // Mantém a mensagem padrão do SDK quando a resposta não contém JSON.
      }
    }
    throw new Error(detail || error.message)
  }

  if (data?.error) throw new Error(data.error)
  if (!data?.success) throw new Error("O servidor não confirmou a exclusão dos contatos.")
  return Number(data.deleted || 0)
}
