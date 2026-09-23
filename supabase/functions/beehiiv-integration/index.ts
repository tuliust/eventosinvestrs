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

async function beehiiv(path: string, apiKey: string, init?: RequestInit) {
  const response = await fetch(`https://api.beehiiv.com/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `Beehiiv respondeu ${response.status}.`
    throw new Error(message)
  }
  return payload
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return json({ error: "Unauthorized" }, 401)

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const token = authHeader.replace(/^Bearer\s+/i, "")
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return json({ error: "Unauthorized" }, 401)

  const { data: profile } = await admin
    .from("profiles")
    .select("id,role,active")
    .eq("id", userData.user.id)
    .single()

  if (!profile?.active || profile.role !== "admin") {
    return json({ error: "Acesso restrito a administradores." }, 403)
  }

  const apiKey = Deno.env.get("BEEHIIV_API_KEY") || ""
  const publicationId = Deno.env.get("BEEHIIV_PUBLICATION_ID") || ""
  const configured = Boolean(apiKey && publicationId)
  const body = await req.json().catch(() => ({}))
  const action = String(body?.action || "status")

  if (action === "status") {
    if (!configured) return json({ configured: false })
    try {
      const publication = await beehiiv(`/publications/${encodeURIComponent(publicationId)}`, apiKey)
      return json({
        configured: true,
        publication: {
          id: publication?.data?.id,
          name: publication?.data?.name,
          organizationName: publication?.data?.organization_name,
        },
      })
    } catch (error) {
      return json({ configured: true, healthy: false, error: error instanceof Error ? error.message : "Falha ao validar Beehiiv." }, 502)
    }
  }

  if (!configured) return json({ error: "Integração Beehiiv não configurada.", configured: false }, 409)

  if (action === "sync_campaign") {
    const postId = String(body?.postId || "").trim()
    if (!/^post_[0-9a-fA-F-]+$/.test(postId)) return json({ error: "ID de campanha Beehiiv inválido." }, 400)
    try {
      const post = await beehiiv(`/publications/${encodeURIComponent(publicationId)}/posts/${encodeURIComponent(postId)}?expand=stats`, apiKey)
      const data = post?.data || {}
      return json({
        configured: true,
        campaign: {
          id: data.id,
          title: data.title,
          subject: data.subject_line,
          status: data.status,
          webUrl: data.web_url,
          created: data.created,
          publishDate: data.publish_date,
          stats: data.stats || null,
        },
      })
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Não foi possível consultar a campanha Beehiiv." }, 502)
    }
  }

  if (action === "create_campaign") {
    const title = String(body?.title || "").trim()
    const subject = String(body?.subject || "").trim()
    const bodyContent = String(body?.bodyContent || "").trim()
    const sendNow = Boolean(body?.sendNow)
    const emails = Array.isArray(body?.emails)
      ? [...new Set(body.emails.map((value: unknown) => String(value).trim().toLowerCase()).filter(Boolean))]
      : []

    if (!title || !subject || !bodyContent) return json({ error: "Título, assunto e conteúdo são obrigatórios." }, 400)
    if (!emails.length) return json({ error: "Informe pelo menos um destinatário elegível." }, 400)
    if (emails.length > 5000) return json({ error: "Limite operacional de 5.000 e-mails por campanha excedido." }, 400)

    try {
      const segmentName = `Invest RS · ${title.slice(0, 60)} · ${Date.now()}`
      const segment = await beehiiv(`/publications/${encodeURIComponent(publicationId)}/segments`, apiKey, {
        method: "POST",
        body: JSON.stringify({
          name: segmentName,
          input: { type: "emails", emails },
        }),
      })
      const segmentId = segment?.data?.id
      if (!segmentId) throw new Error("Beehiiv não retornou o segmento criado.")

      const post = await beehiiv(`/publications/${encodeURIComponent(publicationId)}/posts`, apiKey, {
        method: "POST",
        body: JSON.stringify({
          title,
          body_content: bodyContent,
          status: sendNow ? "confirmed" : "draft",
          recipients: {
            email: {
              tier_ids: ["free", "premium"],
              include_segment_ids: [segmentId],
            },
          },
          email_settings: {
            email_subject_line: subject,
          },
        }),
      })

      return json({
        configured: true,
        campaign: {
          id: post?.data?.id,
          previewUrl: post?.data?.preview_url,
          status: sendNow ? "confirmed" : "draft",
          segmentId,
          requestedRecipients: emails.length,
          matchedSubscribers: segment?.data?.total_results ?? null,
        },
      }, 201)
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Não foi possível criar a campanha Beehiiv." }, 502)
    }
  }

  return json({ error: "Ação inválida." }, 400)
})
