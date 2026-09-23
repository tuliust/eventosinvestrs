import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2.112.4"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

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

  const body = await req.json().catch(() => ({}))
  const action = body?.action

  if (action === "update_self") {
    const name = String(body.name || "").trim()
    if (!name) return json({ error: "Nome obrigatório." }, 400)
    const { error } = await admin.from("profiles").update({ name }).eq("id", callerId)
    if (error) return json({ error: error.message }, 400)
    await admin.from("audit_logs").insert({
      actor_id: callerId,
      action: "profile.updated",
      entity_type: "profile",
      entity_id: callerId,
      metadata: { name },
    })
    return json({ success: true })
  }

  if (callerProfile.role !== "admin")
    return json({ error: "Acesso restrito a administradores." }, 403)

  if (action === "list") {
    const [
      { data: profiles, error: profilesError },
      { data: authData, error: authError },
    ] = await Promise.all([
      admin
        .from("profiles")
        .select("id,email,name,role,active,created_at,updated_at")
        .order("name"),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ])
    if (profilesError) return json({ error: profilesError.message }, 400)
    if (authError) return json({ error: authError.message }, 400)

    const authMap = new Map((authData.users || []).map((u) => [u.id, u]))
    return json({
      users: (profiles || []).map((profile) => {
        const authUser = authMap.get(profile.id)
        return {
          ...profile,
          role: "admin",
          last_sign_in_at: authUser?.last_sign_in_at || null,
          invited_at: authUser?.invited_at || null,
          email_confirmed_at: authUser?.email_confirmed_at || null,
        }
      }),
    })
  }

  if (action === "invite") {
    const email = String(body.email || "").trim().toLowerCase()
    const name = String(body.name || "").trim()
    const role = "admin"
    if (!email || !name)
      return json({ error: "Nome e e-mail são obrigatórios." }, 400)

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { name },
      redirectTo: body.redirectTo || undefined,
    })
    if (error || !data.user)
      return json({ error: error?.message || "Falha ao convidar usuário." }, 400)

    const { error: updateError } = await admin
      .from("profiles")
      .update({ name, role, active: true })
      .eq("id", data.user.id)
    if (updateError) return json({ error: updateError.message }, 400)

    await admin.from("audit_logs").insert({
      actor_id: callerId,
      action: "user.invited",
      entity_type: "profile",
      entity_id: data.user.id,
      metadata: { email, name, role },
    })
    return json({ success: true, user_id: data.user.id })
  }

  if (action === "update_access") {
    const userId = String(body.userId || "")
    const role = "admin"
    const active = Boolean(body.active)
    if (!userId) return json({ error: "Usuário inválido." }, 400)
    if (userId === callerId && !active)
      return json(
        { error: "Você não pode desativar o próprio acesso." },
        400,
      )

    const { data: target, error: targetError } = await admin
      .from("profiles")
      .select("id,email,name,role,active")
      .eq("id", userId)
      .single()
    if (targetError || !target) return json({ error: "Usuário não encontrado." }, 404)

    const { error } = await admin
      .from("profiles")
      .update({ role, active })
      .eq("id", userId)
    if (error) return json({ error: error.message }, 400)

    await admin.from("audit_logs").insert({
      actor_id: callerId,
      action: active ? "user.access_updated" : "user.deactivated",
      entity_type: "profile",
      entity_id: userId,
      metadata: {
        previous_role: target.role,
        role,
        previous_active: target.active,
        active,
        email: target.email,
      },
    })
    return json({ success: true })
  }

  if (action === "recovery") {
    const email = String(body.email || "").trim().toLowerCase()
    if (!email) return json({ error: "E-mail obrigatório." }, 400)
    const { error } = await admin.auth.resetPasswordForEmail(email, {
      redirectTo: body.redirectTo || undefined,
    })
    if (error) return json({ error: error.message }, 400)

    await admin.from("audit_logs").insert({
      actor_id: callerId,
      action: "user.recovery_sent",
      entity_type: "profile",
      metadata: { email },
    })
    return json({ success: true })
  }

  return json({ error: "Ação inválida." }, 400)
})
