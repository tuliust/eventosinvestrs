import { useEffect, useMemo, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import RichTextEditor from "./RichTextEditor"
import WelcomeGuideFrame from "./WelcomeGuideFrame"
import {
  EMPTY_WELCOME_CONTENT,
  inspectWelcomeTemplate,
  loadWelcomeContent,
  loadWelcomeTemplate,
  orderWelcomePages,
  publishWelcomeGuide,
  saveWelcomeDraft,
  uploadWelcomeImage,
  type WelcomeGuideContent,
  type WelcomeMediaField,
} from "./welcomeGuide"

type WelcomeFields = ReturnType<typeof inspectWelcomeTemplate>
const EMPTY_FIELDS: WelcomeFields = { pages: [], texts: [], blocks: [], media: [] }

function cloneContent(content: WelcomeGuideContent): WelcomeGuideContent {
  return {
    version: 3,
    text: { ...content.text },
    blocks: { ...content.blocks },
    hidden: { ...content.hidden },
    media: { ...content.media },
    pageTitles: { ...content.pageTitles },
    pageHidden: { ...content.pageHidden },
    pageOrder: [...content.pageOrder],
    footerText: content.footerText,
  }
}

export default function WelcomeGuideAdmin() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [authError, setAuthError] = useState("")
  const [template, setTemplate] = useState("")
  const [fields, setFields] = useState<WelcomeFields>(EMPTY_FIELDS)
  const [content, setContent] = useState<WelcomeGuideContent>(EMPTY_WELCOME_CONTENT)
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)
  const [selectedPageId, setSelectedPageId] = useState("page:0")
  const [showPreview, setShowPreview] = useState(true)
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState("")

  useEffect(() => {
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setAuthReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession)
        setAuthReady(true)
      }
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session) {
      setIsAdmin(false)
      return
    }
    let active = true
    void supabase
      .from("profiles")
      .select("role, active")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        if (!active) return
        const allowed = !error && data?.active === true && data?.role === "admin"
        setIsAdmin(allowed)
        if (!allowed) setAuthError("Seu usuário não possui permissão de administrador.")
      })
    return () => {
      active = false
    }
  }, [session])

  useEffect(() => {
    if (!isAdmin) return
    let active = true
    Promise.all([loadWelcomeTemplate(), loadWelcomeContent("draft")])
      .then(([html, draft]) => {
        if (!active) return
        const nextContent = cloneContent(draft.content)
        const nextFields = inspectWelcomeTemplate(html, nextContent)
        setTemplate(html)
        setContent(nextContent)
        setFields(nextFields)
        setSelectedPageId((current) => {
          if (!nextFields.pages.length) return current
          return nextFields.pages.some((page) => page.id === current) ? current : nextFields.pages[0].id
        })
      })
      .catch((cause) => active && setStatus(cause instanceof Error ? cause.message : "Falha ao carregar o editor."))
    return () => {
      active = false
    }
  }, [isAdmin])

  const pages = useMemo(() => orderWelcomePages(fields.pages, content.pageOrder), [fields.pages, content.pageOrder])
  const selectedPage = pages.find((page) => page.id === selectedPageId) || pages[0]
  const selectedSection = selectedPage?.originalIndex ?? 0
  const selectedInternalTitle = selectedPage
    ? content.pageTitles[selectedPage.id] || selectedPage.defaultInternalTitle
    : "Conteúdo"

  const sectionTexts = fields.texts.filter((field) => field.sectionIndex === selectedSection)
  const sectionBlocks = fields.blocks.filter((field) => field.sectionIndex === selectedSection)
  const sectionMedia = fields.media.filter((field) => field.sectionIndex === selectedSection)

  useEffect(() => {
    setEditingTitle(false)
    setTitleDraft(selectedInternalTitle)
  }, [selectedPageId, selectedInternalTitle])

  async function login(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setAuthError("")
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setAuthError(error.message)
    setBusy(false)
  }

  async function save() {
    if (!session) return
    setBusy(true)
    setStatus("")
    try {
      await saveWelcomeDraft(content, session.user.id)
      setStatus("Rascunho salvo.")
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Não foi possível salvar.")
    } finally {
      setBusy(false)
    }
  }

  async function publish() {
    if (!session) return
    setBusy(true)
    setStatus("")
    try {
      await saveWelcomeDraft(content, session.user.id)
      await publishWelcomeGuide(content, session.user.id)
      setStatus("Guia publicado com sucesso.")
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Não foi possível publicar.")
    } finally {
      setBusy(false)
    }
  }

  async function replaceImage(field: WelcomeMediaField, file?: File) {
    if (!file || !session) return
    setBusy(true)
    setStatus("")
    try {
      const url = await uploadWelcomeImage(file, session.user.id)
      setContent((current) => ({
        ...current,
        media: {
          ...current.media,
          [field.id]: { url, alt: field.currentAlt || field.label },
        },
      }))
      setStatus("Imagem carregada. Salve ou publique para aplicar a alteração.")
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Falha no upload da imagem.")
    } finally {
      setBusy(false)
    }
  }

  function commitPageTitle() {
    if (!selectedPage) return
    const nextTitle = titleDraft.trim() || selectedPage.defaultInternalTitle
    setContent((current) => ({
      ...current,
      pageTitles: { ...current.pageTitles, [selectedPage.id]: nextTitle },
    }))
    setTitleDraft(nextTitle)
    setEditingTitle(false)
  }

  function movePage(draggedId: string, targetId: string) {
    if (draggedId === targetId) return
    const ids = pages.map((page) => page.id)
    const withoutDragged = ids.filter((id) => id !== draggedId)
    const targetIndex = withoutDragged.indexOf(targetId)
    if (targetIndex < 0) return
    withoutDragged.splice(targetIndex, 0, draggedId)
    setContent((current) => ({ ...current, pageOrder: withoutDragged }))
  }

  if (!authReady) return <div className="welcome-admin-center">Validando sessão…</div>

  if (!session || !isAdmin) {
    return (
      <main className="welcome-admin-login">
        <form className="welcome-login-card" onSubmit={login}>
          <div className="welcome-mark">›››</div>
          <p className="welcome-kicker">Invest RS</p>
          <h1>Administração do guia</h1>
          <p>Entre com o mesmo usuário administrador da Plataforma de Eventos.</p>
          <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" /></label>
          <label>Senha<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label>
          {authError && <div className="welcome-admin-alert">{authError}</div>}
          <button type="submit" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
        </form>
      </main>
    )
  }

  return (
    <main className="welcome-admin-shell">
      <header className="welcome-admin-header">
        <div><span className="welcome-mark">›››</span><strong>Guia do novo colaborador</strong><small>Editor de conteúdo</small></div>
        <div className="welcome-admin-actions">
          <button className="secondary" onClick={() => setShowPreview((value) => !value)}>{showPreview ? "Ocultar preview" : "Mostrar preview"}</button>
          <button className="secondary" onClick={() => void save()} disabled={busy}>Salvar rascunho</button>
          <button onClick={() => void publish()} disabled={busy}>Publicar</button>
          <button className="ghost" onClick={() => void supabase.auth.signOut()}>Sair</button>
        </div>
      </header>

      {status && <div className="welcome-admin-status">{status}</div>}

      <div className={showPreview ? "welcome-admin-layout" : "welcome-admin-layout no-preview"}>
        <aside className="welcome-admin-nav">
          <p>PÁGINAS</p>
          <div className="welcome-page-list-help">Arraste para reordenar</div>
          {pages.map((page, position) => {
            const hidden = Boolean(content.pageHidden[page.id])
            const title = content.pageTitles[page.id] || page.defaultInternalTitle
            return (
              <div
                key={page.id}
                className={`welcome-page-nav-item${selectedPageId === page.id ? " active" : ""}${hidden ? " is-hidden" : ""}${draggedPageId === page.id ? " is-dragging" : ""}`}
                draggable
                onDragStart={() => setDraggedPageId(page.id)}
                onDragEnd={() => setDraggedPageId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  if (draggedPageId) movePage(draggedPageId, page.id)
                  setDraggedPageId(null)
                }}
              >
                <span className="welcome-page-drag" aria-hidden="true">⋮⋮</span>
                <button type="button" onClick={() => setSelectedPageId(page.id)}>
                  <span className="welcome-page-position">{String(position + 1).padStart(2, "0")}</span>
                  <span className="welcome-page-nav-title">{title}</span>
                  {hidden && <span className="welcome-page-hidden-badge">Oculta</span>}
                </button>
              </div>
            )
          })}
        </aside>

        <section className="welcome-editor-panel">
          <div className="welcome-editor-heading">
            <p>Página {pages.findIndex((page) => page.id === selectedPageId) + 1}</p>
            {editingTitle ? (
              <input
                className="welcome-page-title-input"
                autoFocus
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={commitPageTitle}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitPageTitle()
                  if (event.key === "Escape") {
                    setTitleDraft(selectedInternalTitle)
                    setEditingTitle(false)
                  }
                }}
              />
            ) : (
              <h2 className="welcome-page-title-editable" onClick={() => setEditingTitle(true)} title="Clique para editar o título interno">
                {selectedInternalTitle}<span aria-hidden="true">✎</span>
              </h2>
            )}
            <small className="welcome-page-title-note">Título interno. Não aparece para o leitor.</small>
          </div>

          {selectedPage && (
            <div className="welcome-editor-group welcome-page-settings">
              <h3>Configurações</h3>
              <label className="welcome-page-visibility">
                <input
                  type="checkbox"
                  checked={!content.pageHidden[selectedPage.id]}
                  onChange={(event) => setContent((current) => ({
                    ...current,
                    pageHidden: { ...current.pageHidden, [selectedPage.id]: !event.target.checked },
                  }))}
                />
                <span><strong>Exibir página no guia</strong><small>Ao ocultar, ela sai do guia e do sumário. A numeração é recalculada automaticamente.</small></span>
              </label>
              <label className="welcome-global-footer-field">
                <span>Rodapé global</span>
                <input
                  value={content.footerText}
                  onChange={(event) => setContent((current) => ({ ...current, footerText: event.target.value }))}
                  placeholder="Invest RS · Guia do novo colaborador"
                />
                <small>Este texto é aplicado a todas as páginas. O número da página é automático e não é editável.</small>
              </label>
            </div>
          )}

          {sectionMedia.length > 0 && <div className="welcome-editor-group"><h3>Imagens</h3>{sectionMedia.map((field) => {
            const override = content.media[field.id]
            return <div className="welcome-image-field" key={field.id}>
              <div>{override?.url && <img src={override.url} alt="" />}<div><strong>{field.label}</strong><small>{field.kind === "placeholder" ? "Espaço de foto previsto no guia" : "Imagem atual do guia"}</small></div></div>
              <label className="welcome-upload">Trocar imagem<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => void replaceImage(field, event.target.files?.[0])} /></label>
            </div>
          })}</div>}

          {sectionBlocks.length > 0 && <div className="welcome-editor-group"><h3>Blocos de conteúdo</h3>{sectionBlocks.map((field) => {
            const value = Object.prototype.hasOwnProperty.call(content.blocks, field.id) ? content.blocks[field.id] : field.html
            const hidden = Boolean(content.hidden[field.id])
            return <div className={`welcome-block-field${hidden ? " is-hidden" : ""}`} key={field.id}>
              <div className="welcome-block-field-head">
                <div><strong>{field.label}</strong><small>{field.hideable ? "Caixa de destaque" : "Texto formatável"}</small></div>
                {field.hideable && <label className="welcome-visibility-toggle"><input type="checkbox" checked={!hidden} onChange={(event) => setContent((current) => ({ ...current, hidden: { ...current.hidden, [field.id]: !event.target.checked } }))} /><span>Exibir no guia</span></label>}
              </div>
              <RichTextEditor
                label={field.label}
                value={value}
                onChange={(nextValue) => setContent((current) => ({ ...current, blocks: { ...current.blocks, [field.id]: nextValue } }))}
              />
            </div>
          })}</div>}

          {sectionTexts.length > 0 && <div className="welcome-editor-group"><h3>Textos simples</h3>{sectionTexts.map((field) => {
            const value = Object.prototype.hasOwnProperty.call(content.text, field.id) ? content.text[field.id] : field.value
            const multiline = value.length > 100
            return <label className="welcome-text-field" key={field.id}><span>{field.id}</span>{multiline ? <textarea rows={Math.min(8, Math.max(3, Math.ceil(value.length / 90)))} value={value} onChange={(event) => setContent((current) => ({ ...current, text: { ...current.text, [field.id]: event.target.value } }))} /> : <input value={value} onChange={(event) => setContent((current) => ({ ...current, text: { ...current.text, [field.id]: event.target.value } }))} />}</label>
          })}</div>}
        </section>

        {showPreview && <section className="welcome-preview-panel"><div className="welcome-preview-label">PREVIEW</div><WelcomeGuideFrame content={content} preview pageId={selectedPageId} /></section>}
      </div>
    </main>
  )
}
