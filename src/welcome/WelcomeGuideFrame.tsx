import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  applyWelcomeOverrides,
  EMPTY_WELCOME_CONTENT,
  loadWelcomeContent,
  loadWelcomeTemplate,
  type WelcomeGuideContent,
} from "./welcomeGuide"

type Props = {
  content?: WelcomeGuideContent
  preview?: boolean
  pageId?: string
}

function pageIdToDomId(pageId?: string) {
  const index = pageId?.match(/^page:(\d+)$/)?.[1]
  return index === undefined ? undefined : `welcome-section-${index}`
}

export default function WelcomeGuideFrame({ content, preview = false, pageId }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [template, setTemplate] = useState("")
  const [published, setPublished] = useState<WelcomeGuideContent>(EMPTY_WELCOME_CONTENT)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    void loadWelcomeTemplate()
      .then((html) => active && setTemplate(html))
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : "Falha ao carregar o guia."))
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (content) return
    let active = true
    void loadWelcomeContent("published")
      .then((result) => active && setPublished(result.content))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [content])

  const srcDoc = useMemo(() => {
    if (!template) return ""
    return applyWelcomeOverrides(template, content || published, { previewPageId: preview ? pageId : undefined })
  }, [template, content, published, preview, pageId])

  const scrollPreviewToPage = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (!preview || !pageId) return
    const domId = pageIdToDomId(pageId)
    if (!domId) return
    const doc = frameRef.current?.contentDocument
    doc?.getElementById(domId)?.scrollIntoView({ behavior, block: "start" })
  }, [preview, pageId])

  const prepareFrameDocument = useCallback(() => {
    const doc = frameRef.current?.contentDocument
    if (!doc) return

    // O estilo global de links do HTML-base adiciona uma linha verde. No sumário,
    // os links devem manter apenas o divisor cinza do próprio item da lista.
    doc.querySelectorAll<HTMLElement>(".toc li > a").forEach((link) => {
      link.style.borderBottom = "0"
    })

    // O grupo estrutural do organograma possui stroke para desenhar as conexões.
    // Sem esta neutralização, os textos SVG também herdam o stroke e ficam borrados.
    doc.querySelectorAll<SVGTextElement>('svg[aria-label*="Organograma"] text').forEach((text) => {
      text.style.stroke = "none"
      text.style.strokeWidth = "0"
    })

    // Fragmentos dentro de um iframe srcDoc podem resolver contra a URL da página-pai
    // e carregar novamente o admin dentro do preview. Mantemos a navegação no próprio documento.
    doc.querySelectorAll<HTMLAnchorElement>('.toc a[href^="#"]').forEach((anchor) => {
      anchor.onclick = (event) => {
        event.preventDefault()
        const href = anchor.getAttribute("href") || ""
        const targetId = decodeURIComponent(href.slice(1))
        if (!targetId) return
        doc.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    })

    scrollPreviewToPage("auto")
  }, [scrollPreviewToPage])

  useEffect(() => {
    if (!preview || !pageId) return
    requestAnimationFrame(() => scrollPreviewToPage("smooth"))
  }, [preview, pageId, scrollPreviewToPage])

  if (error) return <div className="welcome-error">{error}</div>
  if (!srcDoc) return <div className="welcome-loading">Carregando guia…</div>

  return (
    <iframe
      ref={frameRef}
      className={preview ? "welcome-frame welcome-frame-preview" : "welcome-frame"}
      title={preview ? "Pré-visualização do guia" : "Bem-vindo à Invest RS"}
      srcDoc={srcDoc}
      onLoad={prepareFrameDocument}
    />
  )
}
