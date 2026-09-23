import WelcomeGuideAdmin from "./WelcomeGuideAdmin"
import WelcomeGuideFrame from "./WelcomeGuideFrame"
import "./welcome.css"
import "./welcome-pages.css"

export function isWelcomeExperience() {
  if (typeof window === "undefined") return false
  const host = window.location.hostname.toLowerCase()
  return host === "bemvindo.eventosinvestrs.com.br" || window.location.pathname === "/bemvindo" || window.location.pathname.startsWith("/bemvindo/")
}

function isWelcomeAdmin() {
  const host = window.location.hostname.toLowerCase()
  if (host === "bemvindo.eventosinvestrs.com.br") return window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/")
  return window.location.pathname === "/bemvindo/admin" || window.location.pathname.startsWith("/bemvindo/admin/")
}

export default function WelcomeGuideRoot() {
  return isWelcomeAdmin() ? <WelcomeGuideAdmin /> : <WelcomeGuideFrame />
}
