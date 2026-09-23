import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2.112.4"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const allowedKeys = new Set([
  "platform_name",
  "organization_name",
  "default_state",
  "default_country",
  "timezone",
  "logo_url",
  "default_event_owner",
  "frequent_organizations",
  "default_event_type",
  "default_event_format",
  "default_capacity",
  "allow_walk_ins",
  "quick_registration_required_fields",
  "prevent_duplicate_checkin",
  "allow_undo_checkin",
  "reception_autofocus",
  "checkin_feedback",
  "realtime_refresh_seconds",
])

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return json({ error: "Unauthorized" }, 401)

  const url = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || ""

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const token = authHeader.replace(/^Bearer\s+/i, "")
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return json({ error: "Unauthorized" }, 401)

  const callerId = userData.user.id
  const { data: callerProfile, error: profileError } = await admin
    .from("profiles")
    .select("id,role,active")
    .eq("id", callerId)
    .single()

  if (profileError || !callerProfile?.active)
    return json({ error: "Usuário inativo." }, 403)
  if (callerProfile.role !== "admin")
    return json({ error: "Acesso restrito a administradores." }, 403)

  const body = await req.json().catch(() => ({}))
  if (body?.action !== "save") return json({ error: "Ação inválida." }, 400)

  const rawPatch = body?.patch
  if (!rawPatch || typeof rawPatch !== "object" || Array.isArray(rawPatch))
    return json({ error: "Configurações inválidas." }, 400)

  const patch: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(rawPatch)) {
    if (allowedKeys.has(key)) patch[key] = value
  }

  if (Object.keys(patch).length === 0)
    return json({ error: "Nenhuma configuração válida para salvar." }, 400)

  const userClient = createClient(url, anonKey || serviceKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await userClient
    .from("app_settings")
    .update(patch)
    .eq("id", "global")
    .select("*")
    .single()

  if (error) return json({ error: error.message }, 400)
  if (!data) return json({ error: "A configuração não foi persistida." }, 500)

  return json({ success: true, settings: data })
})
