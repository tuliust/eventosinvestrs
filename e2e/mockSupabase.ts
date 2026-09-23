import type { BrowserContext, Route } from "@playwright/test"

const now = "2026-09-01T13:00:00.000Z"

type AppRole = "admin" | "receptionist"
type JsonRow = Record<string, unknown>

function base64url(value: string) {
  return Buffer.from(value).toString("base64url")
}

function tokenFor(id: string, role: AppRole) {
  const header = base64url(JSON.stringify({ alg: "none", typ: "JWT" }))
  const payload = base64url(JSON.stringify({
    sub: id,
    role: "authenticated",
    app_role: role,
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
  }))
  return `${header}.${payload}.signature`
}

function parseToken(requestHeaders: Record<string, string>) {
  const raw = requestHeaders.authorization?.replace(/^Bearer\s+/i, "")
  if (!raw || raw === "e2e-publishable-key") return null
  try {
    const payload = JSON.parse(Buffer.from(raw.split(".")[1] || "", "base64url").toString("utf8")) as { sub?: string; app_role?: AppRole }
    if (!payload.sub || !payload.app_role) return null
    return { id: payload.sub, role: payload.app_role }
  } catch {
    return null
  }
}

function contactRow(input: Partial<JsonRow> & { id: string; first_name: string; last_name: string }): JsonRow {
  return {
    email: null,
    email_secondary: null,
    whatsapp: null,
    phone: null,
    phone_secondary: null,
    organization: null,
    organization_id: null,
    position: null,
    seniority: null,
    linkedin: null,
    city: "Porto Alegre",
    state: "RS",
    country: "Brasil",
    relationship_type: null,
    origin: "manual",
    communication_status: "active",
    incomplete_profile: false,
    tags: [],
    notes: null,
    last_interaction: null,
    created_at: now,
    updated_at: now,
    ...input,
  }
}

export class MockSupabaseBackend {
  contacts: JsonRow[]
  events: JsonRow[]
  registrations: JsonRow[]
  invites: JsonRow[]
  attendances: JsonRow[] = []

  constructor() {
    this.contacts = [
      contactRow({ id: "c-luma", first_name: "Ana", last_name: "Luma", email: "ana.luma@example.com", organization: "Empresa Luma", position: "Diretora" }),
      contactRow({ id: "c-invite", first_name: "Bruno", last_name: "Convite", email: "bruno.convite@example.com", organization: "Empresa Convite", position: "Gerente" }),
      contactRow({ id: "c-mailing", first_name: "Carla", last_name: "Mailing", email: "carla.mailing@example.com", organization: "Empresa Mailing", position: "Analista" }),
      contactRow({ id: "c-hom-a", first_name: "José", last_name: "Silva", email: "jose.a@example.com", organization: "Empresa A", position: "Diretor" }),
      contactRow({ id: "c-hom-b", first_name: "José", last_name: "Silva", email: "jose.b@example.com", organization: "Empresa B", position: "Presidente" }),
    ]
    this.events = [{
      id: "evt-1",
      title: "Evento E2E Invest RS",
      description: "Evento sintético para testes automatizados.",
      status: "live",
      type: "Painel",
      format: "presencial",
      date: "2026-09-01",
      start_time: "13:00",
      end_time: "14:00",
      venue: "Auditório de Teste",
      address: "Rua de Teste, 1",
      city: "Porto Alegre",
      state: "RS",
      capacity: 100,
      organizations: [],
      sectors: [],
      sector_ids: [],
      subsectors: [],
      subsegment_ids: [],
      responsavel: "Equipe Invest RS",
      luma_url: "https://luma.com/teste",
      parent_event: null,
      created_at: now,
      updated_at: now,
    }]
    this.registrations = [{
      id: "reg-luma",
      event_id: "evt-1",
      contact_id: "c-luma",
      luma_guest_id: "guest-valid-qr",
      name: "Ana Luma",
      first_name: "Ana",
      last_name: "Luma",
      email: "ana.luma@example.com",
      phone: "+55 51 99999-0001",
      company: "Empresa Luma",
      position: "Diretora",
      registered_at: now,
      approval_status: "approved",
      source: "luma",
      qr_code_url: "https://luma.com/qr-valid",
      custom_data: { codigo: "guest-valid-qr" },
      raw_import_data: { guest_id: "guest-valid-qr" },
    }]
    this.invites = [{
      id: "invite-bruno",
      event_id: "evt-1",
      contact_id: "c-invite",
      email: "bruno.convite@example.com",
      invited_at: now,
      invited_by: "user-admin",
      status: "sent",
    }]
  }

  activeAttendances() {
    return this.attendances.filter((item) => !item.undone_at)
  }

  activeForContact(contactId: string) {
    return this.activeAttendances().filter((item) => item.contact_id === contactId)
  }

  async install(context: BrowserContext) {
    await context.route("**/*", async (route) => this.handle(route))
  }

  private async json(route: Route, data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
    await route.fulfill({
      status,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "authorization, apikey, content-type, prefer, x-client-info",
        "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
        ...extraHeaders,
      },
      body: JSON.stringify(data),
    })
  }

  private async handle(route: Route) {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()

    if (!path.includes("/mock-supabase/")) {
      await route.continue()
      return
    }

    if (method === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "authorization, apikey, content-type, prefer, x-client-info",
          "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
        },
      })
      return
    }

    if (path.endsWith("/auth/v1/token") && method === "POST") {
      const body = request.postDataJSON() as { email?: string }
      const receptionist = body.email === "reception@investrs.org.br"
      const admin = body.email === "admin@investrs.org.br"
      if (!receptionist && !admin) {
        await this.json(route, { message: "Invalid login credentials" }, 400)
        return
      }
      const role: AppRole = receptionist ? "receptionist" : "admin"
      const id = receptionist ? "user-reception" : "user-admin"
      const email = body.email || ""
      const accessToken = tokenFor(id, role)
      await this.json(route, {
        access_token: accessToken,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: `refresh-${id}`,
        user: {
          id,
          aud: "authenticated",
          role: "authenticated",
          email,
          email_confirmed_at: now,
          app_metadata: { provider: "email", providers: ["email"] },
          user_metadata: {},
          identities: [],
          created_at: now,
          updated_at: now,
        },
      })
      return
    }

    if (path.endsWith("/auth/v1/logout")) {
      await this.json(route, {})
      return
    }

    const currentUser = parseToken(request.headers())
    if (!currentUser) {
      await this.json(route, { message: "JWT ausente ou inválido" }, 401)
      return
    }

    if (path.includes("/rest/v1/profiles") && method === "GET") {
      const profile = {
        id: currentUser.id,
        email: currentUser.role === "admin" ? "admin@investrs.org.br" : "reception@investrs.org.br",
        name: currentUser.role === "admin" ? "Admin E2E" : "Recepção E2E",
        role: currentUser.role,
        active: true,
      }
      await this.json(route, profile)
      return
    }

    if ((path.endsWith("/rest/v1/rpc/check_in_event") || path.endsWith("/rest/v1/rpc/check_in_event_idempotent")) && method === "POST") {
      if (!(["admin", "receptionist"] as AppRole[]).includes(currentUser.role)) {
        await this.json(route, { message: "Sem permissão para check-in" }, 403)
        return
      }
      const body = request.postDataJSON() as Record<string, unknown>
      const contactId = body.p_contact_id ? String(body.p_contact_id) : null
      const registrationId = body.p_registration_id ? String(body.p_registration_id) : null
      const idempotencyKey = body.p_idempotency_key ? String(body.p_idempotency_key) : null
      const byKey = idempotencyKey ? this.attendances.find((attendance) => attendance.idempotency_key === idempotencyKey) : undefined
      if (byKey) {
        await this.json(route, byKey)
        return
      }
      const duplicate = this.activeAttendances().find((attendance) =>
        (contactId && attendance.contact_id === contactId) ||
        (registrationId && attendance.registration_id === registrationId),
      )
      if (duplicate) {
        if (path.endsWith("/rest/v1/rpc/check_in_event_idempotent")) {
          await this.json(route, duplicate)
        } else {
          await this.json(route, { message: "Participante já possui check-in ativo neste evento" }, 409)
        }
        return
      }
      const row: JsonRow = {
        id: String(body.p_attendance_id),
        event_id: String(body.p_event_id),
        contact_id: contactId,
        registration_id: registrationId,
        name: String(body.p_name || "Participante"),
        company: body.p_company || null,
        position: body.p_position || null,
        checked_in_at: new Date().toISOString(),
        checked_in_by: currentUser.id,
        source: String(body.p_source || "mailing"),
        idempotency_key: idempotencyKey,
        undone_at: null,
        undone_by: null,
      }
      this.attendances.push(row)
      await this.json(route, row)
      return
    }

    if (path.endsWith("/rest/v1/rpc/undo_event_checkin") && method === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>
      const row = this.attendances.find((item) => item.id === body.p_attendance_id && item.event_id === body.p_event_id)
      if (!row) {
        await this.json(route, { message: "Check-in não encontrado" }, 404)
        return
      }
      row.undone_at = new Date().toISOString()
      row.undone_by = currentUser.id
      await this.json(route, row)
      return
    }

    if (path.includes("/rest/v1/contacts") && method === "POST") {
      const body = request.postDataJSON() as JsonRow
      const row = contactRow({
        id: String(body.id),
        first_name: String(body.first_name || ""),
        last_name: String(body.last_name || ""),
        ...body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      this.contacts.push(row)
      await this.json(route, row, 201)
      return
    }

    if (path.includes("/rest/v1/event_invites") && method === "POST") {
      const body = request.postDataJSON() as JsonRow[] | JsonRow
      const rows = Array.isArray(body) ? body : [body]
      for (const row of rows) {
        const exists = this.invites.some((item) => item.event_id === row.event_id && item.email === row.email)
        if (!exists) this.invites.push(row)
      }
      await this.json(route, rows, 201)
      return
    }

    if (path.includes("/rest/v1/event_registrations") && method === "POST") {
      const body = request.postDataJSON() as JsonRow[] | JsonRow
      const rows = Array.isArray(body) ? body : [body]
      for (const row of rows) {
        const index = this.registrations.findIndex((item) => item.id === row.id)
        if (index >= 0) this.registrations[index] = { ...this.registrations[index], ...row }
        else this.registrations.push(row)
      }
      await this.json(route, rows, 201)
      return
    }

    if (method === "GET" && path.includes("/rest/v1/")) {
      const table = path.split("/rest/v1/")[1]?.split("/")[0]
      const tables: Record<string, JsonRow[]> = {
        contacts: this.contacts,
        organizations: [],
        segments: [],
        subsegments: [],
        contact_segmentations: [],
        events: this.events,
        event_registrations: this.registrations,
        event_attendances: this.attendances,
        event_invites: this.invites,
        mailing_lists: [],
        mailing_list_contacts: [],
      }
      if (table in tables) {
        let rows = tables[table]
        if (table === "contacts") {
          const idFilter = url.searchParams.get("id")
          const emailFilter = url.searchParams.get("email")
          if (idFilter?.startsWith("eq.")) rows = rows.filter((row) => row.id === idFilter.slice(3))
          if (emailFilter?.startsWith("eq.")) rows = rows.filter((row) => String(row.email || "").toLowerCase() === emailFilter.slice(3).toLowerCase())
        }
        await this.json(route, rows, 200, { "content-range": `0-${Math.max(0, rows.length - 1)}/${rows.length}` })
        return
      }
    }

    await this.json(route, { message: `Rota mock não implementada: ${method} ${path}` }, 404)
  }
}

export async function loginAndOpenReception(
  context: BrowserContext,
  backend: MockSupabaseBackend,
  role: AppRole = "admin",
) {
  await backend.install(context)
  const page = await context.newPage()
  await page.goto("/login")
  await page.getByLabel("E-mail").fill(role === "admin" ? "admin@investrs.org.br" : "reception@investrs.org.br")
  await page.getByLabel("Senha").fill("senha-e2e")
  await page.getByRole("button", { name: "Entrar" }).click()
  await page.waitForURL("/")
  await page.goto("/eventos/evt-1")
  await page.getByRole("heading", { name: "Evento E2E Invest RS" }).waitFor()
  await page.getByRole("button", { name: "Iniciar Modo Recepção" }).click()
  await page.getByPlaceholder("Buscar nome, empresa, e-mail ou telefone…").waitFor()
  return page
}
