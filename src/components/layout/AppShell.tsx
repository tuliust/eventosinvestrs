import { useEffect, useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import Sidebar from "./Sidebar"
import Logo from "@/components/ui/Logo"

export default function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileNavOpen) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false)
    }
    const closeOnDesktop = () => {
      if (window.innerWidth >= 1024) setMobileNavOpen(false)
    }

    document.addEventListener("keydown", closeOnEscape)
    window.addEventListener("resize", closeOnDesktop)
    return () => {
      document.removeEventListener("keydown", closeOnEscape)
      window.removeEventListener("resize", closeOnDesktop)
    }
  }, [mobileNavOpen])

  return (
    <div className="app-shell flex h-full overflow-hidden" style={{ background: "#F4F4F1" }}>
      {/* Desktop / tablet landscape navigation */}
      <Sidebar />

      {/* Tablet portrait / smartphone top bar */}
      <header
        className="lg:hidden fixed inset-x-0 top-0 z-40 h-14 flex items-center gap-3 px-3 border-b"
        style={{
          background: "#3C3C3B",
          borderColor: "rgba(255,255,255,0.1)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-white hover:bg-white/10 transition-fast"
          aria-label="Abrir menu principal"
          aria-expanded={mobileNavOpen}
        >
          <span aria-hidden className="text-xl leading-none">☰</span>
        </button>
        <div className="min-w-0 flex-1">
          <Logo size="sm" />
        </div>
      </header>

      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-[90] flex" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Fechar menu principal"
          />
          <div className="relative h-full max-w-[86vw] shadow-2xl">
            <Sidebar mobile onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="app-main flex-1 min-w-0 overflow-hidden pt-14 lg:pt-0">
        <Outlet />
      </main>
    </div>
  )
}
