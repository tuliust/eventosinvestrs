import { useEffect, useRef, useState } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import { useApp, useCurrentUser, useSyncStatus } from "@/contexts/AppContext"
import Logo from "@/components/ui/Logo"
import OnlineStatus from "@/components/ui/OnlineStatus"
import { getInitials } from "@/lib/utils"

const NAV = [
  { path: "/", label: "Dashboard", icon: "⊞", exact: true },
  { path: "/eventos", label: "Eventos", icon: "◈" },
  { path: "/mailing", label: "Mailing", icon: "✉" },
  { path: "/contatos", label: "Contatos", icon: "◎" },
  { path: "/organizacoes", label: "Organizações", icon: "⬡" },
  { path: "/segmentacoes", label: "Segmentações", icon: "⊕" },
]

const NAV_BOTTOM = [
  { path: "/relatorios", label: "Relatórios", icon: "↗" },
  { path: "/configuracoes", label: "Configurações", icon: "⚙" },
]

interface SidebarProps {
  mobile?: boolean
  onNavigate?: () => void
}

export default function Sidebar({ mobile = false, onNavigate }: SidebarProps) {
  const user = useCurrentUser()
  const { logout } = useApp()
  const syncStatus = useSyncStatus()
  const navigate = useNavigate()
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!accountMenuOpen) return

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setAccountMenuOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountMenuOpen(false)
    }

    document.addEventListener("mousedown", closeOnOutsideClick)
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [accountMenuOpen])

  const openProfileSection = (
    title: "Perfil" | "Segurança" | "Preferências individuais",
    hash: string,
  ) => {
    setAccountMenuOpen(false)
    navigate(`/configuracoes/perfil#${hash}`)
    onNavigate?.()

    window.setTimeout(() => {
      const heading = Array.from(document.querySelectorAll("h3")).find(
        (element) => element.textContent?.trim() === title,
      )
      heading?.closest("section")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }, 100)
  }

  const handleLogout = async () => {
    setAccountMenuOpen(false)
    await logout()
    navigate("/login", { replace: true })
    onNavigate?.()
  }

  return (
    <aside
      className={`${mobile ? "flex" : "hidden lg:flex"} flex-col h-full`}
      style={{
        background: "#3C3C3B",
        color: "#FFFFFF",
        width: mobile ? "min(86vw, 320px)" : "220px",
        minWidth: mobile ? "min(86vw, 320px)" : "220px",
        flexShrink: 0,
        paddingTop: mobile ? "env(safe-area-inset-top)" : undefined,
        paddingBottom: mobile ? "env(safe-area-inset-bottom)" : undefined,
      }}
      aria-label="Navegação principal"
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b flex items-center gap-3" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
        <div className="flex-1 min-w-0">
          <Logo size="sm" />
        </div>
        {mobile && (
          <button
            type="button"
            onClick={onNavigate}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-fast"
            aria-label="Fechar menu principal"
          >
            ✕
          </button>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.exact}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-fast ${
                isActive
                  ? "bg-green text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`
            }
          >
            <span className="text-base leading-none opacity-80">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom nav */}
      <div className="px-3 pb-3 space-y-0.5 border-t" style={{ borderColor: "rgba(255,255,255,0.1)", paddingTop: "12px" }}>
        {NAV_BOTTOM.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-fast ${
                isActive
                  ? "bg-green text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`
            }
          >
            <span className="text-base leading-none opacity-80">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        {/* Online status + sync */}
        <div className="px-3 py-2 flex items-center gap-3">
          <OnlineStatus className="text-white/60" />
          {syncStatus === "syncing" && (
            <span className="text-white/40 text-xs animate-pulse">sincronizando…</span>
          )}
          {syncStatus === "synced" && (
            <span className="text-white/40 text-xs">✓ sincronizado</span>
          )}
          {syncStatus === "error" && (
            <span className="text-xs" style={{ color: "#E60456" }}>⚠ sem sync</span>
          )}
        </div>

        {/* User */}
        <div ref={accountMenuRef} className="relative mt-1">
          {accountMenuOpen && (
            <div
              className="absolute left-0 right-0 bottom-[calc(100%+8px)] z-50 rounded-xl border bg-white p-1.5 shadow-xl"
              style={{ borderColor: "rgba(60,60,59,0.15)" }}
              role="menu"
              aria-label="Opções da conta"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => openProfileSection("Perfil", "perfil")}
                className="w-full rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-carbon hover:bg-neutral transition-fast"
              >
                Perfil
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => openProfileSection("Segurança", "seguranca")}
                className="w-full rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-carbon hover:bg-neutral transition-fast"
              >
                Segurança
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => openProfileSection("Preferências individuais", "preferencias")}
                className="w-full rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-carbon hover:bg-neutral transition-fast"
              >
                Preferências
              </button>
              <div className="my-1 border-t border-carbon-20" />
              <button
                type="button"
                role="menuitem"
                onClick={() => void handleLogout()}
                className="w-full rounded-lg px-3 py-2.5 text-left text-xs font-bold text-magenta hover:bg-light-magenta transition-fast"
              >
                Sair
              </button>
            </div>
          )}

          <button
            type="button"
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border cursor-pointer hover:bg-white/5 transition-fast text-left"
            style={{ borderColor: "rgba(255,255,255,0.12)" }}
            onClick={() => setAccountMenuOpen((open) => !open)}
            title="Abrir opções da conta"
            aria-haspopup="menu"
            aria-expanded={accountMenuOpen}
          >
            <div className="w-8 h-8 rounded-full bg-green flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user ? getInitials(user.name) : "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user?.name}</p>
              <p className="text-white/50 text-xs truncate capitalize">{user?.role === "admin" ? "Administrador" : "Recepcionista"}</p>
            </div>
            <span className={`text-white/40 text-xs transition-transform ${accountMenuOpen ? "rotate-180" : ""}`}>⌃</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
