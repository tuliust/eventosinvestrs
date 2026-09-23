import coverLogoUrl from "@/imports/Logo_Invest_RS_-_Branco.png"
import { supabase } from "@/lib/supabase"

export type WelcomeMediaOverride = {
  url: string
  alt?: string
}

export type WelcomeGuideContent = {
  version: 3
  text: Record<string, string>
  blocks: Record<string, string>
  hidden: Record<string, boolean>
  media: Record<string, WelcomeMediaOverride>
  pageTitles: Record<string, string>
  pageHidden: Record<string, boolean>
  pageOrder: string[]
  footerText: string
}

export type WelcomeTextField = {
  id: string
  value: string
  sectionIndex: number
  sectionTitle: string
}

export type WelcomeBlockField = {
  id: string
  html: string
  label: string
  sectionIndex: number
  sectionTitle: string
  hideable: boolean
}

export type WelcomeMediaField = {
  id: string
  kind: "image" | "placeholder"
  label: string
  sectionIndex: number
  sectionTitle: string
  currentUrl?: string
  currentAlt?: string
}

export type WelcomePageField = {
  id: string
  originalIndex: number
  publicTitle: string
  defaultInternalTitle: string
  code?: string
  partNumber?: number
  opener: boolean
}

export const DEFAULT_WELCOME_FOOTER = "Invest RS · Guia do novo colaborador"

export const EMPTY_WELCOME_CONTENT: WelcomeGuideContent = {
  version: 3,
  text: {},
  blocks: {},
  hidden: {},
  media: {},
  pageTitles: {},
  pageHidden: {},
  pageOrder: [],
  footerText: DEFAULT_WELCOME_FOOTER,
}

const TEMPLATE_URL = "/welcome-guide-template.html"
const TEXT_SELECTOR_EXCLUSIONS = new Set(["STYLE", "SCRIPT", "NOSCRIPT"])
const SPECIAL_BLOCK_SELECTOR = ".alert,.box,.reserved,.quote"
const RICH_BLOCK_SELECTOR = "h1,h2,h3,h4,p,li,td,th,figcaption"

function normalizeRecord<T>(value: unknown): Record<string, T> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, T> : {}
}

export function normalizeWelcomeContent(value: unknown): WelcomeGuideContent {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<WelcomeGuideContent> & { version?: number }
  return {
    version: 3,
    text: normalizeRecord<string>(raw.text),
    blocks: normalizeRecord<string>(raw.blocks),
    hidden: normalizeRecord<boolean>(raw.hidden),
    media: normalizeRecord<WelcomeMediaOverride>(raw.media),
    pageTitles: normalizeRecord<string>(raw.pageTitles),
    pageHidden: normalizeRecord<boolean>(raw.pageHidden),
    pageOrder: Array.isArray(raw.pageOrder) ? raw.pageOrder.filter((item): item is string => typeof item === "string") : [],
    footerText: typeof raw.footerText === "string" ? raw.footerText : DEFAULT_WELCOME_FOOTER,
  }
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function sectionTitle(section: Element, index: number) {
  const heading = section.querySelector("h1,h2,h3")?.textContent
  return cleanText(heading || "") || `Seção ${index + 1}`
}

function walkTextNodes(root: Node, visitor: (node: Text) => void) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent || TEXT_SELECTOR_EXCLUSIONS.has(parent.tagName)) return NodeFilter.FILTER_REJECT
      return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    },
  })
  let current: Node | null
  while ((current = walker.nextNode())) visitor(current as Text)
}

function parseTemplate(html: string) {
  return new DOMParser().parseFromString(html, "text/html")
}

function applyLegacyText(doc: Document, content: WelcomeGuideContent) {
  let textIndex = 0
  doc.body.querySelectorAll(":scope > section").forEach((section) => {
    walkTextNodes(section, (node) => {
      const id = `text:${textIndex++}`
      if (Object.prototype.hasOwnProperty.call(content.text, id)) node.textContent = content.text[id]
    })
  })
}

type BlockInfo = { id: string; element: HTMLElement; sectionIndex: number; hideable: boolean }

function assignBlockIds(doc: Document): BlockInfo[] {
  const blocks: BlockInfo[] = []
  Array.from(doc.body.querySelectorAll<HTMLElement>(":scope > section")).forEach((section, sectionIndex) => {
    let blockIndex = 0
    const candidates = Array.from(section.querySelectorAll<HTMLElement>(`${SPECIAL_BLOCK_SELECTOR},${RICH_BLOCK_SELECTOR}`))
    candidates.forEach((element) => {
      if (element.closest(".cover .logo") || element.closest(".toc") || element.closest(".foot")) return
      const isSpecial = element.matches(SPECIAL_BLOCK_SELECTOR)
      if (!isSpecial && element.closest(SPECIAL_BLOCK_SELECTOR)) return
      const id = `block:${sectionIndex}:${blockIndex++}`
      element.dataset.welcomeBlockId = id
      blocks.push({ id, element, sectionIndex, hideable: isSpecial })
    })
  })
  return blocks
}

function applyBlockOverrides(blocks: BlockInfo[], content: WelcomeGuideContent) {
  blocks.forEach(({ id, element, hideable }) => {
    if (Object.prototype.hasOwnProperty.call(content.blocks, id)) {
      element.innerHTML = sanitizeWelcomeRichHtml(content.blocks[id])
    }
    if (hideable && content.hidden[id]) element.style.display = "none"
  })
}

function injectCoverLogo(doc: Document) {
  const logo = doc.querySelector<HTMLElement>(".cover .logo")
  if (!logo) return
  logo.innerHTML = ""
  const image = doc.createElement("img")
  image.setAttribute("src", coverLogoUrl)
  image.setAttribute("alt", "Invest RS")
  logo.appendChild(image)
}

function applyMedia(doc: Document, content: WelcomeGuideContent) {
  let imageIndex = 0
  let placeholderIndex = 0
  doc.body.querySelectorAll(":scope > section").forEach((section) => {
    section.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
      if (img.closest(".cover .logo")) return
      const id = `image:${imageIndex++}`
      const override = content.media[id]
      if (!override?.url) return
      img.setAttribute("src", override.url)
      if (override.alt) img.setAttribute("alt", override.alt)
    })
    section.querySelectorAll<HTMLElement>(".photo").forEach((slot) => {
      const id = `photo:${placeholderIndex++}`
      const override = content.media[id]
      if (!override?.url) return
      slot.innerHTML = ""
      slot.style.padding = "0"
      slot.style.border = "0"
      slot.style.background = "transparent"
      const img = doc.createElement("img")
      img.setAttribute("src", override.url)
      img.setAttribute("alt", override.alt || "")
      img.style.display = "block"
      img.style.width = "100%"
      img.style.height = "auto"
      slot.appendChild(img)
    })
  })
}

function buildPageFields(doc: Document): WelcomePageField[] {
  const sections = Array.from(doc.body.querySelectorAll<HTMLElement>(":scope > section"))
  let activePart: number | undefined

  return sections.map((section, originalIndex) => {
    const publicTitle = sectionTitle(section, originalIndex)
    const opener = section.classList.contains("opener")
    const openerNumber = opener ? Number.parseInt(cleanText(section.querySelector(".num")?.textContent || ""), 10) : Number.NaN
    if (opener && Number.isFinite(openerNumber)) activePart = openerNumber

    const eyebrow = cleanText(section.querySelector(".eyebrow")?.textContent || "")
    const code = eyebrow.match(/\b([123]\.\d{1,2})\b/)?.[1]
    const partNumber = opener ? (Number.isFinite(openerNumber) ? openerNumber : activePart) : (code ? activePart : undefined)

    let defaultInternalTitle: string
    if (originalIndex === 0) defaultInternalTitle = "Capa"
    else if (originalIndex === 1) defaultInternalTitle = "Boas-vindas"
    else if (originalIndex === 2) defaultInternalTitle = "Como usar este guia"
    else if (opener && partNumber) defaultInternalTitle = `Parte ${partNumber} - ${publicTitle}`
    else if (code && partNumber) defaultInternalTitle = `Parte ${partNumber} - ${publicTitle}`
    else if (originalIndex === sections.length - 1) defaultInternalTitle = `Encerramento - ${publicTitle}`
    else defaultInternalTitle = publicTitle

    return {
      id: `page:${originalIndex}`,
      originalIndex,
      publicTitle,
      defaultInternalTitle,
      code,
      partNumber,
      opener,
    }
  })
}

export function orderWelcomePages(pages: WelcomePageField[], requestedOrder: string[]) {
  const byId = new Map(pages.map((page) => [page.id, page]))
  const seen = new Set<string>()
  const ordered: WelcomePageField[] = []

  requestedOrder.forEach((id) => {
    const page = byId.get(id)
    if (!page || seen.has(id)) return
    seen.add(id)
    ordered.push(page)
  })

  pages.forEach((page) => {
    if (seen.has(page.id)) return
    seen.add(page.id)
    ordered.push(page)
  })

  return ordered
}

function pageDomId(page: WelcomePageField) {
  return `welcome-section-${page.originalIndex}`
}

function rebuildToc(doc: Document, orderedPages: WelcomePageField[], content: WelcomeGuideContent) {
  const toc = doc.querySelector<HTMLUListElement>(".toc")
  if (!toc) return
  toc.innerHTML = ""

  orderedPages.forEach((page) => {
    if (content.pageHidden[page.id]) return
    if (!page.opener && !page.code) return

    const item = doc.createElement("li")
    const link = doc.createElement("a")
    link.href = `#${pageDomId(page)}`

    if (page.opener) {
      item.className = `part${page.partNumber === 2 ? " m" : page.partNumber === 3 ? " a" : ""}`
      link.textContent = `Parte ${page.partNumber || ""} · ${page.publicTitle}`.replace(/Parte  · /, "")
    } else {
      const number = doc.createElement("span")
      number.className = "n"
      number.textContent = page.code || ""
      link.appendChild(number)
      link.appendChild(doc.createTextNode(page.publicTitle))
    }

    item.appendChild(link)
    toc.appendChild(item)
  })
}

function applyPageStructure(doc: Document, content: WelcomeGuideContent, previewPageId?: string) {
  const pages = buildPageFields(doc)
  const orderedPages = orderWelcomePages(pages, content.pageOrder)
  const byId = new Map(pages.map((page) => [page.id, page]))
  const sections = Array.from(doc.body.querySelectorAll<HTMLElement>(":scope > section"))

  sections.forEach((section, originalIndex) => {
    const page = byId.get(`page:${originalIndex}`)
    if (!page) return
    section.id = pageDomId(page)
    section.dataset.welcomePageId = page.id
    section.style.scrollMarginTop = "12px"
  })

  rebuildToc(doc, orderedPages, content)

  const visiblePages = orderedPages.filter((page) => !content.pageHidden[page.id])
  const visiblePosition = new Map(visiblePages.map((page, index) => [page.id, index + 1]))
  const footerText = content.footerText.trim() || DEFAULT_WELCOME_FOOTER

  sections.forEach((section) => section.remove())
  orderedPages.forEach((page) => {
    const hidden = Boolean(content.pageHidden[page.id])
    if (hidden && previewPageId !== page.id) return
    const section = sections[page.originalIndex]
    if (!section) return

    const footer = section.querySelector<HTMLElement>(".foot")
    if (footer) {
      const spans = footer.querySelectorAll("span")
      if (spans[0]) spans[0].textContent = footerText
      if (spans[1]) {
        const number = visiblePosition.get(page.id)
        spans[1].textContent = number ? String(number).padStart(2, "0") : "—"
      }
    }

    if (hidden && previewPageId === page.id) section.dataset.welcomePreviewHidden = "true"
    doc.body.appendChild(section)
  })
}

function addNavigationStyle(doc: Document) {
  const style = doc.createElement("style")
  style.textContent = `
    html{scroll-behavior:smooth}
    .cover .logo{display:block;font-size:0;line-height:0}
    .cover .logo img{display:block;width:260px;max-width:72vw;height:auto}
    .toc li>a{display:flex;align-items:baseline;gap:14px;width:100%;color:inherit;text-decoration:none}
    .toc li>a:hover{color:var(--verde)}
    .toc li.part>a{color:inherit}
    section[data-welcome-preview-hidden="true"]{outline:3px dashed rgba(230,4,86,.45);outline-offset:-3px}
    @media(max-width:760px){.cover .logo img{width:220px;max-width:76vw}}
  `
  doc.head.appendChild(style)
}

export function sanitizeWelcomeRichHtml(html: string) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html")
  const allowed = new Set(["STRONG", "B", "EM", "I", "U", "BR", "P", "H1", "H2", "H3", "H4", "UL", "OL", "LI", "A", "DIV", "SPAN"])
  const safeClasses = new Set(["attr", "flag", "todo", "tag"])

  Array.from(doc.body.querySelectorAll<HTMLElement>("*")).reverse().forEach((element) => {
    if (!allowed.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes))
      return
    }
    const href = element.tagName === "A" ? element.getAttribute("href") || "" : ""
    const classes = Array.from(element.classList).filter((name) => safeClasses.has(name))
    Array.from(element.attributes).forEach((attribute) => element.removeAttribute(attribute.name))
    if (classes.length) element.className = classes.join(" ")
    if (element.tagName === "A" && /^(https?:|mailto:|#)/i.test(href)) {
      element.setAttribute("href", href)
      if (/^https?:/i.test(href)) {
        element.setAttribute("target", "_blank")
        element.setAttribute("rel", "noopener noreferrer")
      }
    }
  })
  return doc.body.innerHTML
}

export async function loadWelcomeTemplate() {
  const response = await fetch(TEMPLATE_URL, { cache: "no-store" })
  if (!response.ok) throw new Error("Não foi possível carregar o guia-base.")
  return response.text()
}

export function inspectWelcomeTemplate(html: string, rawContent: WelcomeGuideContent = EMPTY_WELCOME_CONTENT) {
  const content = normalizeWelcomeContent(rawContent)
  const doc = parseTemplate(html)
  applyLegacyText(doc, content)
  const blocks = assignBlockIds(doc)

  const pendingTexts: Array<Omit<WelcomeTextField, "sectionTitle">> = []
  let textIndex = 0
  doc.body.querySelectorAll(":scope > section").forEach((section, sectionIndex) => {
    walkTextNodes(section, (node) => {
      const id = `text:${textIndex++}`
      const parent = node.parentElement
      if (!parent || parent.closest("[data-welcome-block-id],.toc,.cover .logo,.foot")) return
      pendingTexts.push({ id, value: node.textContent || "", sectionIndex })
    })
  })

  applyBlockOverrides(blocks, content)
  const sections = Array.from(doc.body.querySelectorAll<HTMLElement>(":scope > section"))
  const titles = sections.map(sectionTitle)
  const pages = buildPageFields(doc)

  const texts: WelcomeTextField[] = pendingTexts.map((field) => ({ ...field, sectionTitle: titles[field.sectionIndex] }))
  const richBlocks: WelcomeBlockField[] = blocks.map(({ id, element, sectionIndex, hideable }) => {
    const heading = element.matches(SPECIAL_BLOCK_SELECTOR) ? element.querySelector("h1,h2,h3,h4")?.textContent?.trim() : ""
    return {
      id,
      html: element.innerHTML,
      label: heading ? `Caixa · ${heading}` : element.textContent?.trim().slice(0, 70) || "Bloco de texto",
      sectionIndex,
      sectionTitle: titles[sectionIndex],
      hideable,
    }
  })

  const media: WelcomeMediaField[] = []
  let imageIndex = 0
  let placeholderIndex = 0
  sections.forEach((section, sectionIndex) => {
    section.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
      if (img.closest(".cover .logo")) return
      media.push({
        id: `image:${imageIndex++}`,
        kind: "image",
        label: img.alt || `Imagem ${imageIndex}`,
        sectionIndex,
        sectionTitle: titles[sectionIndex],
        currentUrl: img.getAttribute("src") || undefined,
        currentAlt: img.alt || undefined,
      })
    })
    section.querySelectorAll<HTMLElement>(".photo").forEach((slot) => {
      media.push({
        id: `photo:${placeholderIndex++}`,
        kind: "placeholder",
        label: slot.querySelector(".t")?.textContent?.trim() || `Foto ${placeholderIndex}`,
        sectionIndex,
        sectionTitle: titles[sectionIndex],
      })
    })
  })

  return { pages, texts, blocks: richBlocks, media }
}

export function applyWelcomeOverrides(
  html: string,
  rawContent: WelcomeGuideContent,
  options: { previewPageId?: string } = {},
) {
  const content = normalizeWelcomeContent(rawContent)
  const doc = parseTemplate(html)
  applyLegacyText(doc, content)
  const blocks = assignBlockIds(doc)
  applyBlockOverrides(blocks, content)
  applyMedia(doc, content)
  injectCoverLogo(doc)
  applyPageStructure(doc, content, options.previewPageId)
  addNavigationStyle(doc)
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`
}

export async function loadWelcomeContent(key: "draft" | "published") {
  const { data, error } = await supabase
    .from("welcome_guide_documents")
    .select("content, updated_at, published_at")
    .eq("key", key)
    .single()
  if (error) throw error
  return {
    content: normalizeWelcomeContent(data.content),
    updatedAt: data.updated_at as string,
    publishedAt: data.published_at as string | null,
  }
}

export async function saveWelcomeDraft(content: WelcomeGuideContent, userId: string) {
  const { error } = await supabase
    .from("welcome_guide_documents")
    .update({ content: normalizeWelcomeContent(content), updated_by: userId, updated_at: new Date().toISOString() })
    .eq("key", "draft")
  if (error) throw error
}

export async function publishWelcomeGuide(content: WelcomeGuideContent, userId: string) {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from("welcome_guide_documents")
    .update({ content: normalizeWelcomeContent(content), updated_by: userId, updated_at: now, published_at: now })
    .eq("key", "published")
  if (error) throw error
}

export async function uploadWelcomeImage(file: File, userId: string) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
  const safeBase = file.name
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "imagem"
  const path = `${userId}/${Date.now()}-${safeBase}.${ext}`
  const { error } = await supabase.storage
    .from("welcome-guide-media")
    .upload(path, file, { cacheControl: "3600", upsert: false })
  if (error) throw error
  return supabase.storage.from("welcome-guide-media").getPublicUrl(path).data.publicUrl
}
