// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
}))

vi.mock("@/contexts/AppContext", () => ({
  useApp: () => ({
    login: mocks.login,
    state: { isAuthLoading: false },
    authError: null,
  }),
}))

import LoginPage from "@/pages/LoginPage"

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>Dashboard de teste</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("LoginPage", () => {
  beforeEach(() => {
    mocks.login.mockReset()
  })

  it("autentica e navega após login válido", async () => {
    mocks.login.mockResolvedValue(true)
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText("E-mail"), "admin@investrs.org.br")
    await user.type(screen.getByLabelText("Senha"), "senha-segura")
    await user.click(screen.getByRole("button", { name: "Entrar" }))

    expect(mocks.login).toHaveBeenCalledWith("admin@investrs.org.br", "senha-segura")
    expect(await screen.findByText("Dashboard de teste")).toBeInTheDocument()
  })

  it("mantém o usuário na tela e mostra erro quando a autenticação falha", async () => {
    mocks.login.mockResolvedValue(false)
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText("E-mail"), "erro@investrs.org.br")
    await user.type(screen.getByLabelText("Senha"), "incorreta")
    await user.click(screen.getByRole("button", { name: "Entrar" }))

    expect(await screen.findByText("Não foi possível entrar. Confira o e-mail e a senha.")).toBeInTheDocument()
  })
})
