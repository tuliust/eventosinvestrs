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

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return json({ error: "Não autorizado." }, 401)

    const url = Deno.env.get("SUPABASE_URL")!
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const token = authHeader.replace(/^Bearer\s+/i, "")
    const { data: userData, error: userError } = await admin.auth.getUser(token)
    if (userError || !userData.user) return json({ error: "Sessão inválida." }, 401)

    const userId = userData.user.id
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role,active")
      .eq("id", userId)
      .single()

    if (profileError || !profile?.active) return json({ error: "Usuário inativo." }, 403)
    if (profile.role !== "admin") return json({ error: "Acesso restrito a administradores." }, 403)

    const body = await req.json().catch(() => ({}))
    if (body?.action !== "delete_all_contacts") return json({ error: "Ação inválida." }, 400)
    if (body?.confirmation !== "DELETAR") {
      return json({ error: "Digite DELETAR para confirmar a exclusão." }, 400)
    }

    const { data, error } = await admin.rpc("delete_all_contacts_admin", {
      p_actor_id: userId,
    })
    if (error) return json({ error: error.message }, 400)

    return json({ success: true, deleted: Number(data || 0) })
  } catch (error) {
    console.error(error)
    return json({ error: error instanceof Error ? error.message : "Falha inesperada." }, 500)
  }
})
