import { useEffect, useMemo, useRef } from "react"
import { useApp } from "@/contexts/AppContext"
import SegmentationsPage from "@/pages/SegmentationsPage"

const PRIORITY_ICON_BY_ID: Record<string, string> = {
  "ccf951d2-0259-409c-b7dd-8e270d8502ef": "/sector-icons/01_cadeia_agropecuaria.svg",
  "659a61e3-9ea5-4910-a6f1-c06871c750b5": "/sector-icons/02_cadeia_automotiva.svg",
  "084f5e26-d55e-4612-b6e4-647e518b2962": "/sector-icons/03_cadeia_petroquimica.svg",
  "0279d565-4aa6-402e-b161-21563c1cab0a": "/sector-icons/04_fertilizantes.svg",
  "7cc40857-74f2-4704-9dd4-bb251223bacc": "/sector-icons/05_maquinas_agricolas.svg",
  "96cfe8ec-ea11-46a3-b4ad-a05fb29ff673": "/sector-icons/06_maquinas_equipamentos_semicondutores.svg",
  "ebd98ab2-6449-49e5-b7ce-4b9a1b7fe81a": "/sector-icons/07_produtos_transicao_energetica.svg",
  "d25c78bf-f64f-43a2-8737-1cbfca338368": "/sector-icons/08_produtos_servicos_digitais.svg",
  "cbc18866-a1e9-401a-aa39-03f4b65f78f1": "/sector-icons/09_produtos_regionais.svg",
  "d365d573-e476-484c-a2c8-6c91f1212ad6": "/sector-icons/10_saude_equipamentos_medicos.svg",
  "55314814-1b16-467f-9a6f-26cc34108325": "/sector-icons/11_silvicultura_papel_celulose.svg",
  "3ecafda5-39e9-413e-8447-df5357660aef": "/sector-icons/12_turismo.svg",
}

export default function SegmentationsPageWithIcons() {
  const { state } = useApp()
  const rootRef = useRef<HTMLDivElement>(null)

  const iconByCurrentName = useMemo(() => {
    const map = new Map<string, string>()
    for (const segment of state.segments) {
      const icon = PRIORITY_ICON_BY_ID[segment.id]
      if (icon) map.set(segment.name, icon)
    }
    return map
  }, [state.segments])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const applyIcons = () => {
      for (const card of root.querySelectorAll<HTMLElement>("article")) {
        const title = card.querySelector("h2")?.textContent?.trim()
        if (!title) continue
        const iconPath = iconByCurrentName.get(title)
        if (!iconPath) continue

        const iconBox = card.querySelector<HTMLElement>(".p-5 > .flex.items-start.gap-3 > span")
        if (!iconBox || iconBox.dataset.prioritySectorIcon === iconPath) continue

        iconBox.dataset.prioritySectorIcon = iconPath
        iconBox.textContent = ""
        const image = document.createElement("img")
        image.src = iconPath
        image.alt = ""
        image.setAttribute("aria-hidden", "true")
        image.className = "w-8 h-8 object-contain"
        iconBox.appendChild(image)
      }
    }

    applyIcons()
    const observer = new MutationObserver(applyIcons)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [iconByCurrentName])

  return (
    <div ref={rootRef} className="h-full">
      <SegmentationsPage />
    </div>
  )
}
