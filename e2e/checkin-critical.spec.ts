import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test"
import { loginAndOpenReception, MockSupabaseBackend } from "./mockSupabase"

async function open(browser: Browser, role: "admin" | "receptionist" = "admin") {
  const backend = new MockSupabaseBackend()
  const context = await browser.newContext()
  const page = await loginAndOpenReception(context, backend, role)
  return { backend, context, page }
}

async function search(page: Page, value: string) {
  const input = page.getByPlaceholder("Buscar nome, empresa, e-mail ou telefone…")
  await input.fill(value)
  return input
}

async function registerBySearch(page: Page, query: string, buttonName: "Check-in" | "Registrar presença") {
  await search(page, query)
  await page.getByRole("button", { name: buttonName, exact: true }).first().click()
}

async function installQrScanner(context: BrowserContext, rawValue: string) {
  await context.addInitScript((raw) => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          // A câmera real sempre resolve de forma assíncrona. Este pequeno atraso
          // permite que o React monte o <video> antes da resolução da permissão.
          await new Promise((resolve) => setTimeout(resolve, 20))
          return { getTracks: () => [{ stop: () => {} }] }
        },
      },
    })
    Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
      configurable: true,
      writable: true,
      value: null,
    })
    Object.defineProperty(HTMLMediaElement.prototype, "readyState", {
      configurable: true,
      get: () => 4,
    })
    HTMLMediaElement.prototype.play = async () => {}
    ;(window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class {
      async detect() {
        return [{ rawValue: raw }]
      }
    }
  }, rawValue)
}

test.describe("check-in crítico", () => {
  test("1. Luma + check-in", async ({ browser }) => {
    const { backend, context, page } = await open(browser)
    await registerBySearch(page, "ana.luma@example.com", "Check-in")
    await expect(page.getByText(/Ana Luma — presente/)).toBeVisible()
    expect(backend.activeForContact("c-luma")).toHaveLength(1)
    expect(backend.activeForContact("c-luma")[0].source).toBe("luma")
    await context.close()
  })

  test("2. convidado sem Luma + presença", async ({ browser }) => {
    const { backend, context, page } = await open(browser)
    await registerBySearch(page, "Bruno Convite", "Registrar presença")
    await expect(page.getByText(/Bruno Convite — presente/)).toBeVisible()
    expect(backend.activeForContact("c-invite")).toHaveLength(1)
    expect(backend.activeForContact("c-invite")[0].source).toBe("invited")
    await context.close()
  })

  test("3. mailing não convidado + presença", async ({ browser }) => {
    const { backend, context, page } = await open(browser)
    await registerBySearch(page, "Carla Mailing", "Registrar presença")
    await expect(page.getByText(/Carla Mailing — presente/)).toBeVisible()
    expect(backend.activeForContact("c-mailing")).toHaveLength(1)
    expect(backend.activeForContact("c-mailing")[0].source).toBe("mailing")
    await context.close()
  })

  test("4. novo walk-in", async ({ browser }) => {
    const { backend, context, page } = await open(browser)
    await search(page, "Walk In Novo")
    await page.getByRole("button", { name: "+ Participante sem inscrição" }).click()
    await page.getByLabel("E-mail").last().fill("walkin@example.com")
    await page.getByLabel("Empresa").fill("Empresa Visitante")
    await page.getByRole("button", { name: "Salvar e registrar presença" }).click()

    await expect(page.getByText(/Walk In Novo — presente/)).toBeVisible()
    const savedContact = backend.contacts.find((item) => item.email === "walkin@example.com")
    expect(savedContact).toBeTruthy()
    expect(backend.activeForContact(String(savedContact?.id))).toHaveLength(1)
    await context.close()
  })

  test("5. participante já presente não gera duplicidade", async ({ browser }) => {
    const { backend, context, page } = await open(browser)
    await registerBySearch(page, "Ana Luma", "Check-in")
    await search(page, "Ana Luma")
    await expect(page.getByText("✓ PRESENTE")).toBeVisible()
    expect(backend.activeForContact("c-luma")).toHaveLength(1)
    await context.close()
  })

  test("6. undo preserva o registro e remove a presença ativa", async ({ browser }) => {
    const { backend, context, page } = await open(browser)
    await registerBySearch(page, "Ana Luma", "Check-in")
    await search(page, "Ana Luma")
    await page.getByRole("button", { name: "Desfazer", exact: true }).first().click()
    await expect(page.getByText("Desfazer o check-in de")).toBeVisible()
    await page.getByRole("button", { name: "Desfazer", exact: true }).last().click()

    await expect.poll(() => backend.activeForContact("c-luma").length).toBe(0)
    expect(backend.attendances).toHaveLength(1)
    expect(backend.attendances[0].undone_at).toBeTruthy()
    await context.close()
  })

  test("7. dois dispositivos simultâneos criam somente uma presença ativa", async ({ browser }) => {
    const backend = new MockSupabaseBackend()
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await loginAndOpenReception(contextA, backend, "admin")
    const pageB = await loginAndOpenReception(contextB, backend, "admin")

    await Promise.all([search(pageA, "Ana Luma"), search(pageB, "Ana Luma")])
    await Promise.allSettled([
      pageA.getByRole("button", { name: "Check-in", exact: true }).click(),
      pageB.getByRole("button", { name: "Check-in", exact: true }).click(),
    ])

    await expect.poll(() => backend.activeForContact("c-luma").length).toBe(1)
    const feedback = /já possui check-in ativo|Ana Luma — presente|✓ PRESENTE/
    const visibleA = await pageA.getByText(feedback).first().isVisible().catch(() => false)
    const visibleB = await pageB.getByText(feedback).first().isVisible().catch(() => false)
    expect(visibleA || visibleB).toBe(true)
    await contextA.close()
    await contextB.close()
  })

  test("8. homônimos podem ser distinguidos pela organização", async ({ browser }) => {
    const { backend, context, page } = await open(browser)
    await search(page, "José Silva")
    await expect(page.getByText(/Diretor · Empresa A/)).toBeVisible()
    await expect(page.getByText(/Presidente · Empresa B/)).toBeVisible()

    const companyB = page.getByText(/Presidente · Empresa B/)
    const card = companyB.locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]")
    await card.getByRole("button", { name: "Registrar presença" }).click()

    await expect.poll(() => backend.activeForContact("c-hom-b").length).toBe(1)
    expect(backend.activeForContact("c-hom-a")).toHaveLength(0)
    await context.close()
  })

  test("9. internet interrompida mantém check-in como pendência local, sem falso sucesso", async ({ browser }) => {
    const { backend, context, page } = await open(browser)

    await context.setOffline(true)
    await expect(page.getByText(/OFFLINE/)).toBeVisible()
    await registerBySearch(page, "Ana Luma", "Check-in")

    await expect(page.getByText(/Ana Luma — pendente de sincronização/)).toBeVisible()
    await expect(page.getByText(/PENDENTE DE SINCRONIZAÇÃO/)).toBeVisible()
    expect(backend.activeForContact("c-luma")).toHaveLength(0)
    await context.close()
  })

  test("10. pendência é sincronizada automaticamente após reconexão", async ({ browser }) => {
    const { backend, context, page } = await open(browser)

    await context.setOffline(true)
    await registerBySearch(page, "Ana Luma", "Check-in")
    await expect(page.getByText(/pendente de sincronização/)).toBeVisible()
    expect(backend.activeForContact("c-luma")).toHaveLength(0)

    await context.setOffline(false)
    await expect.poll(() => backend.activeForContact("c-luma").length, { timeout: 10_000 }).toBe(1)
    await expect(page.getByText(/PENDENTE DE SINCRONIZAÇÃO/)).toHaveCount(0)
    await context.close()
  })

  test("11. QR válido localiza inscrição e registra presença", async ({ browser }) => {
    const backend = new MockSupabaseBackend()
    const context = await browser.newContext()
    await installQrScanner(context, "guest-valid-qr")
    const page = await loginAndOpenReception(context, backend, "admin")

    await page.getByRole("button", { name: /Escanear QR Code/ }).click()
    await expect(page.getByText("Inscrição localizada")).toBeVisible()
    await page.getByRole("button", { name: "Registrar check-in" }).click()
    await expect(page.getByText(/Ana Luma — presença registrada/)).toBeVisible()
    expect(backend.activeForContact("c-luma")).toHaveLength(1)
    await context.close()
  })

  test("12. QR inválido é rejeitado sem criar presença", async ({ browser }) => {
    const backend = new MockSupabaseBackend()
    const context = await browser.newContext()
    await installQrScanner(context, "qr-inexistente")
    const page = await loginAndOpenReception(context, backend, "admin")

    await page.getByRole("button", { name: /Escanear QR Code/ }).click()
    await expect(page.getByText(/QR Code inválido ou sem inscrição correspondente/)).toBeVisible()
    expect(backend.activeAttendances()).toHaveLength(0)
    await context.close()
  })

  test("13. cadastro incompleto é marcado para complementação", async ({ browser }) => {
    const { backend, context, page } = await open(browser)
    await search(page, "Somente Nome")
    await page.getByRole("button", { name: "+ Participante sem inscrição" }).click()
    await page.getByRole("button", { name: "Salvar e registrar presença" }).click()

    await expect.poll(() => backend.contacts.some(
      (item) => item.first_name === "Somente" && item.last_name === "Nome",
    )).toBe(true)
    const saved = backend.contacts.find((item) => item.first_name === "Somente" && item.last_name === "Nome")
    expect(saved?.incomplete_profile).toBe(true)
    await expect.poll(() => backend.activeForContact(String(saved?.id)).length).toBe(1)
    await context.close()
  })

  test("14. tentativa sem permissão é bloqueada", async ({ browser }) => {
    const backend = new MockSupabaseBackend()
    const context = await browser.newContext()
    await backend.install(context)
    const page = await context.newPage()
    await page.goto("/eventos/evt-1")
    await page.waitForURL("**/login")

    const status = await page.evaluate(async () => {
      const response = await fetch("/mock-supabase/rest/v1/rpc/check_in_event", {
        method: "POST",
        headers: { "content-type": "application/json", apikey: "e2e-publishable-key" },
        body: JSON.stringify({ p_event_id: "evt-1", p_attendance_id: "unauthorized" }),
      })
      return response.status
    })
    expect(status).toBe(401)
    expect(backend.activeAttendances()).toHaveLength(0)
    await context.close()
  })

  test("15. usuário autorizado opera como administrador", async ({ browser }) => {
    const { backend, context, page } = await open(browser, "admin")
    await expect(page.getByRole("button", { name: /Admin E2E Administrador/ })).toBeVisible()
    await registerBySearch(page, "Bruno Convite", "Registrar presença")
    await expect.poll(() => backend.activeForContact("c-invite").length).toBe(1)
    expect(backend.activeForContact("c-invite")[0].checked_in_by).toBe("user-admin")
    await context.close()
  })

  test("16. usuário admin pode operar check-in", async ({ browser }) => {
    const { backend, context, page } = await open(browser, "admin")
    await registerBySearch(page, "Carla Mailing", "Registrar presença")
    await expect.poll(() => backend.activeForContact("c-mailing").length).toBe(1)
    expect(backend.activeForContact("c-mailing")[0].checked_in_by).toBe("user-admin")
    await context.close()
  })
})
