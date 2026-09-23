import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useApp } from "@/contexts/AppContext"
import logoWhite from "@/imports/Logo_Invest_RS_-_Branco.png"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const { login, state, authError } = useApp()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    const ok = await login(email, password)
    if (ok) {
      navigate("/")
    } else {
      setError("Não foi possível entrar. Confira o e-mail e a senha.")
    }
  }

  return (
    <div className="min-h-full flex">
      <div
        className="hidden md:flex flex-col justify-between p-10 w-[420px] flex-shrink-0"
        style={{ background: "#3C3C3B" }}
      >
        <img src={logoWhite} alt="Invest RS" className="h-9 w-auto object-contain" />
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: "#F8B51E" }}>
            Expointer 2026
          </p>
          <h1 className="text-white text-3xl font-bold leading-tight mb-3">
            Gestão de<br />Eventos e Check-in
          </h1>
          <p className="text-white/50 text-sm leading-relaxed">
            Plataforma interna da Invest RS para gestão de relacionamento, mailing e operação de eventos.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-white/30 text-xs">Oportunidades RS e Acordo Mercosul–UE</p>
          <p className="text-white/20 text-xs">01/09/2026 · 13h30 · Arena do Governo RS</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6" style={{ background: "#F4F4F1" }}>
        <div className="w-full max-w-sm">
          <div className="md:hidden flex justify-center mb-8 p-5 rounded-2xl" style={{ background: "#3C3C3B" }}>
            <img src={logoWhite} alt="Invest RS" className="h-8 w-auto object-contain" />
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-sm border border-carbon-20">
            <h2 className="text-carbon font-bold text-xl mb-1">Entrar</h2>
            <p className="text-carbon-60 text-sm mb-6">Acesso à plataforma interna</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-xs font-semibold text-carbon mb-1.5 uppercase tracking-wide">
                  E-mail
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-carbon-20 text-carbon text-sm focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20 transition-fast"
                  style={{ background: "#FAFAFA" }}
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-semibold text-carbon mb-1.5 uppercase tracking-wide">
                  Senha
                </label>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-carbon-20 text-carbon text-sm focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20 transition-fast"
                  style={{ background: "#FAFAFA" }}
                />
              </div>

              {(authError || error) && (
                <p className="text-xs text-magenta font-medium px-1">{authError || error}</p>
              )}

              <button
                type="submit"
                disabled={state.isAuthLoading}
                className="w-full py-3 rounded-xl text-white font-bold text-sm transition-fast disabled:opacity-60"
                style={{ background: "#009C63" }}
              >
                {state.isAuthLoading ? "Entrando…" : "Entrar"}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-carbon-20">
              <p className="text-xs text-carbon-60/70 text-center leading-relaxed">
                Acesso restrito a usuários autorizados pela Invest RS.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
