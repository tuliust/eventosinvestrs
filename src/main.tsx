import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"
import "./mailing-table.css"
import { registerInvestServiceWorker } from "@/lib/pwa"
import WelcomeGuideRoot, { isWelcomeExperience } from "@/welcome/WelcomeGuideRoot"

const welcomeExperience = isWelcomeExperience()

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {welcomeExperience ? <WelcomeGuideRoot /> : <App />}
  </React.StrictMode>,
)

if (!welcomeExperience) {
  if (document.readyState === "complete") {
    void registerInvestServiceWorker()
  } else {
    window.addEventListener("load", () => void registerInvestServiceWorker(), { once: true })
  }
}
