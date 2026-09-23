import { FormEvent, useEffect, useMemo, useState } from "react"
import { NavLink, useNavigate, useParams } from "react-router-dom"
import Modal from "@/components/ui/Modal"
import EventDeletionManager from "@/components/settings/EventDeletionManager"
import { useApp } from "@/contexts/AppContext"
import { loadAppData } from "@/lib/api"
import {
  AppSettings,
  AuditLog,
  AdminUser,
  ImportTemplate,
  deleteAllContacts,
  deleteImportTemplate,
  inviteAdminUser,
  loadAdminUsers,
  loadAuditLogs,
  loadImportTemplates,
  loadSettings,
  loadUserPreferences,
  saveImportTemplate,
  saveSettings,
  saveUserPreferences,
  sendUserRecovery,
  updateAdminUserAccess,
  updateOwnPassword,
  updateOwnProfile,
} from "@/lib/settingsApi"

const SECTIONS = [
  { id: "perfil", label: "Minha conta", description: "Perfil, senha e sessão", admin: false },
  { id: "usuarios", label: "Usuários e acessos", description: "Contas, funções e status", admin: true },
  { id: "geral", label: "Preferências gerais", description: "Organização e padrões", admin: true },
  { id: "eventos", label: "Eventos e check-in", description: "Regras operacionais", admin: true },
  { id: "importacoes", label: "Importações", description: "Modelos e correspondências", admin: true },
  { id: "integracoes", label: "Integrações", description: "Estado das conexões", admin: true },
  { id: "auditoria", label: "Segurança e auditoria", description: "Histórico e manutenção", admin: true },
] as const

const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl border border-carbon-20 bg-white text-sm text-carbon focus:border-green focus:ring-2 focus:ring-green/20 focus:outline-none transition-fast"

export default function SettingsPage() {
  const { section = "perfil" } = useParams()
  const { state } = useApp()
  const isAdmin = state.user?.role === "admin"
  const allowed = SECTIONS.filter((item) => !item.admin || isAdmin)
  const selected = allowed.some((item) => item.id === section) ? section : "perfil"

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="flex-shrink-0 px-6 py-5 bg-white border-b border-carbon-20">
        <h1 className="text-lg font-bold text-carbon">Configurações</h1>
        <p className="text-xs text-carbon-60 mt-0.5">Conta, acessos, padrões operacionais e segurança da plataforma</p>
      </header>
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <aside className="lg:w-72 lg:min-w-72 bg-white border-b lg:border-b-0 lg:border-r border-carbon-20">
          <nav className="flex lg:flex-col gap-2 p-3 overflow-x-auto lg:overflow-y-auto">
            {allowed.map((item) => (
              <NavLink key={item.id} to={`/configuracoes/${item.id}`} className={({ isActive }) => `min-w-max lg:min-w-0 rounded-xl px-3.5 py-3 border transition-fast ${isActive ? "border-green bg-green/5 text-green" : "border-transparent text-carbon hover:bg-neutral"}`}>
                <div className="text-sm font-bold">{item.label}</div>
                <div className="hidden lg:block text-xs text-carbon-60 mt-0.5">{item.description}</div>
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="flex-1 min-w-0 overflow-y-auto px-4 md:px-6 py-5">
          <div className="max-w-5xl mx-auto">
            {selected === "perfil" && <ProfileSection />}
            {selected === "usuarios" && isAdmin && <UsersSection />}
            {selected === "geral" && isAdmin && <GeneralSection />}
            {selected === "eventos" && isAdmin && <EventsSection />}
            {selected === "importacoes" && isAdmin && <ImportsSection />}
            {selected === "integracoes" && isAdmin && <IntegrationsSection />}
            {selected === "auditoria" && isAdmin && <AuditSection />}
          </div>
        </main>
      </div>
    </div>
  )
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return <div className="mb-5"><h2 className="text-xl font-bold text-carbon">{title}</h2><p className="text-sm text-carbon-60 mt-1">{description}</p></div>
}

function Card({ title, children, action }: { title?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="bg-white rounded-2xl border border-carbon-20 p-5 mb-4">{(title || action) && <div className="flex items-center justify-between gap-4 mb-4">{title && <h3 className="font-bold text-carbon">{title}</h3>}{action}</div>}{children}</section>
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="block"><span className="text-xs font-bold text-carbon block mb-1.5">{label}</span>{children}{hint && <span className="text-[11px] text-carbon-60 block mt-1">{hint}</span>}</label>
}

function Message({ text, error = false }: { text: string; error?: boolean }) {
  return <div className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold mb-4 ${error ? "bg-light-magenta text-magenta" : "bg-green/10 text-green"}`}>{text}</div>
}

function ProfileSection() {
  const { state, logout } = useApp()
  const navigate = useNavigate()
  const user = state.user!
  const [name, setName] = useState(user.name)
  const [password, setPassword] = useState("")
  const [preferences, setPreferences] = useState<Record<string, unknown>>({})
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => { void loadUserPreferences(user.id).then(setPreferences).catch(() => {}) }, [user.id])

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage(""); setError("")
    try { await updateOwnProfile(name); setMessage("Nome atualizado.") }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar.") }
    finally { setSaving(false) }
  }

  const savePassword = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage(""); setError("")
    try { if (password.length < 8) throw new Error("A senha deve ter pelo menos 8 caracteres."); await updateOwnPassword(password); setPassword(""); setMessage("Senha atualizada.") }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível alterar a senha.") }
    finally { setSaving(false) }
  }

  const togglePreference = async (key: string, value: boolean) => {
    const next = { ...preferences, [key]: value }; setPreferences(next)
    try { await saveUserPreferences(user.id, next) } catch { setPreferences(preferences) }
  }

  return <>
    <SectionHeader title="Minha conta" description="Dados do usuário autenticado e preferências individuais." />
    {message && <Message text={message} />}{error && <Message text={error} error />}
    <Card title="Perfil">
      <form onSubmit={saveProfile} className="grid md:grid-cols-2 gap-4">
        <Field label="Nome"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="E-mail utilizado no login"><input className={`${inputClass} bg-neutral`} value={user.email} disabled /></Field>
        <Field label="Função atual" hint="A própria função não pode ser alterada por este usuário."><input className={`${inputClass} bg-neutral`} value={user.role === "admin" ? "Administrador" : "Recepcionista"} disabled /></Field>
        <div className="md:flex md:items-end"><button disabled={saving || !name.trim()} className="px-4 py-2.5 rounded-xl bg-green text-white text-sm font-bold disabled:opacity-50">Salvar perfil</button></div>
      </form>
    </Card>
    <Card title="Segurança">
      <form onSubmit={savePassword} className="max-w-xl flex gap-3">
        <input type="password" className={inputClass} placeholder="Nova senha" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button disabled={saving || !password} className="min-w-max px-4 py-2.5 rounded-xl border border-green text-green text-sm font-bold disabled:opacity-50">Alterar senha</button>
      </form>
    </Card>
    <Card title="Preferências individuais">
      <div className="space-y-3">
        <ToggleRow label="Confirmações visuais reforçadas" description="Mantém feedback visual destacado nas ações da interface." checked={Boolean(preferences.strong_feedback)} onChange={(value) => void togglePreference("strong_feedback", value)} />
        <ToggleRow label="Interface compacta" description="Reserva uma preferência individual para densidade de informação." checked={Boolean(preferences.compact_ui)} onChange={(value) => void togglePreference("compact_ui", value)} />
      </div>
    </Card>
    <Card title="Sessão">
      <button onClick={async () => { await logout(); navigate("/login") }} className="px-4 py-2.5 rounded-xl border border-magenta text-magenta text-sm font-bold">Encerrar sessão</button>
      <p className="text-xs text-carbon-60 mt-3">O gerenciamento de outras sessões fica reservado para uma etapa futura.</p>
    </Card>
  </>
}

function UsersSection() {
  const { state } = useApp()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"admin" | "receptionist">("receptionist")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const refresh = async () => { setLoading(true); try { setUsers(await loadAdminUsers()); setError("") } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao carregar usuários.") } finally { setLoading(false) } }
  useEffect(() => { void refresh() }, [])
  const invite = async (event: FormEvent) => { event.preventDefault(); try { await inviteAdminUser({ name, email, role, redirectTo: `${window.location.origin}/login` }); setModal(false); setName(""); setEmail(""); setRole("receptionist"); setMessage("Convite enviado."); await refresh() } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao convidar.") } }
  const change = async (user: AdminUser, patch: Partial<Pick<AdminUser, "role" | "active">>) => { setError(""); try { await updateAdminUserAccess({ userId: user.id, role: patch.role || user.role, active: patch.active ?? user.active }); setMessage("Acesso atualizado."); await refresh() } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao atualizar acesso.") } }

  return <>
    <SectionHeader title="Usuários e acessos" description="Administração de contas sem expor chaves privilegiadas no navegador." />
    {message && <Message text={message} />}{error && <Message text={error} error />}
    <Card action={<button onClick={() => setModal(true)} className="px-4 py-2.5 rounded-xl bg-green text-white text-sm font-bold">+ Novo usuário</button>}>
      {loading ? <p className="text-sm text-carbon-60">Carregando usuários…</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-carbon-60 border-b border-carbon-20"><th className="py-3 pr-3">Usuário</th><th className="py-3 pr-3">Função</th><th className="py-3 pr-3">Status</th><th className="py-3 pr-3">Último acesso</th><th className="py-3 text-right">Ações</th></tr></thead><tbody>{users.map((user) => { const isSelf = user.id === state.user?.id; return <tr key={user.id} className="border-b border-carbon-20/60"><td className="py-3 pr-3"><div className="font-bold text-carbon">{user.name}</div><div className="text-xs text-carbon-60">{user.email}</div></td><td className="py-3 pr-3"><select className={`${inputClass} min-w-40`} value={user.role} disabled={isSelf} onChange={(e) => void change(user, { role: e.target.value as "admin" | "receptionist" })}><option value="admin">Administrador</option><option value="receptionist">Recepcionista</option></select></td><td className="py-3 pr-3"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${user.active ? "bg-green/10 text-green" : "bg-neutral text-carbon-60"}`}>{user.active ? "Ativo" : "Inativo"}</span></td><td className="py-3 pr-3 text-xs text-carbon-60">{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("pt-BR") : "Sem acesso registrado"}</td><td className="py-3"><div className="flex justify-end gap-2"><button onClick={() => void sendUserRecovery(user.email, `${window.location.origin}/login`).then(() => setMessage("E-mail de recuperação enviado.")).catch((cause) => setError(cause instanceof Error ? cause.message : "Falha ao enviar recuperação."))} className="px-3 py-2 rounded-lg border border-carbon-20 text-xs font-bold">Recuperação</button>{!isSelf && <button onClick={() => void change(user, { active: !user.active })} className={`px-3 py-2 rounded-lg text-xs font-bold ${user.active ? "border border-magenta text-magenta" : "bg-green text-white"}`}>{user.active ? "Desativar" : "Ativar"}</button>}</div></td></tr> })}</tbody></table></div>}
    </Card>
    <Modal open={modal} onClose={() => setModal(false)} title="Convidar novo usuário" footer={<><button onClick={() => setModal(false)} className="px-4 py-2 rounded-xl border border-carbon-20 text-sm font-bold">Cancelar</button><button form="invite-user-form" className="px-4 py-2 rounded-xl bg-green text-white text-sm font-bold">Enviar convite</button></>}>
      <form id="invite-user-form" onSubmit={invite} className="space-y-4"><Field label="Nome"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required /></Field><Field label="E-mail"><input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required /></Field><Field label="Função"><select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as typeof role)}><option value="receptionist">Recepcionista</option><option value="admin">Administrador</option></select></Field></form>
    </Modal>
  </>
}

function useSettingsForm() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)
  useEffect(() => { void loadSettings().then(setSettings).catch((cause) => setError(cause instanceof Error ? cause.message : "Falha ao carregar configurações.")) }, [])
  const persist = async (patch: Partial<AppSettings>) => { if (!settings) return; setSaving(true); setError(""); setMessage(""); try { const updated = await saveSettings(patch); setSettings(updated); setMessage("Configurações salvas.") } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao salvar configurações.") } finally { setSaving(false) } }
  return { settings, setSettings, error, message, saving, persist }
}

function GeneralSection() {
  const { settings, setSettings, error, message, saving, persist } = useSettingsForm(); const { state } = useApp(); if (!settings) return <Loading error={error} />
  return <><SectionHeader title="Preferências gerais" description="Identidade da plataforma e valores padrão da organização." />{message && <Message text={message} />}{error && <Message text={error} error />}<Card><div className="grid md:grid-cols-2 gap-4"><Field label="Nome da plataforma"><input className={inputClass} value={settings.platform_name} onChange={(e) => setSettings({ ...settings, platform_name: e.target.value })} /></Field><Field label="Organização"><input className={inputClass} value={settings.organization_name} onChange={(e) => setSettings({ ...settings, organization_name: e.target.value })} /></Field><Field label="Estado padrão"><input className={inputClass} value={settings.default_state} onChange={(e) => setSettings({ ...settings, default_state: e.target.value })} /></Field><Field label="País padrão"><input className={inputClass} value={settings.default_country} onChange={(e) => setSettings({ ...settings, default_country: e.target.value })} /></Field><Field label="Fuso horário"><input className={inputClass} value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} /></Field><Field label="Responsável padrão pelos eventos"><input className={inputClass} list="event-owners" value={settings.default_event_owner || ""} onChange={(e) => setSettings({ ...settings, default_event_owner: e.target.value || null })} /><datalist id="event-owners">{[...new Set(state.events.map((event) => event.responsavel).filter(Boolean))].map((name) => <option key={name} value={name} />)}</datalist></Field><Field label="URL da marca / logo" hint="Nenhum arquivo secreto é armazenado nesta configuração."><input className={inputClass} placeholder="https://..." value={settings.logo_url || ""} onChange={(e) => setSettings({ ...settings, logo_url: e.target.value || null })} /></Field></div><div className="mt-5"><button disabled={saving} onClick={() => void persist({ platform_name: settings.platform_name, organization_name: settings.organization_name, default_state: settings.default_state, default_country: settings.default_country, timezone: settings.timezone, default_event_owner: settings.default_event_owner, logo_url: settings.logo_url })} className="px-4 py-2.5 rounded-xl bg-green text-white text-sm font-bold disabled:opacity-50">Salvar preferências</button></div></Card><Card title="Segmentos e subsetores"><p className="text-sm text-carbon-60">A administração permanece centralizada em <strong>/segmentacoes</strong>, evitando duplicidade de regras.</p></Card></>
}

function EventsSection() {
  const { settings, setSettings, error, message, saving, persist } = useSettingsForm(); if (!settings) return <Loading error={error} />
  return <><SectionHeader title="Eventos e check-in" description="Padrões usados na criação de eventos e no modo recepção." />{message && <Message text={message} />}{error && <Message text={error} error />}<Card><div className="grid md:grid-cols-2 gap-4 mb-5"><Field label="Tipo padrão"><input className={inputClass} value={settings.default_event_type} onChange={(e) => setSettings({ ...settings, default_event_type: e.target.value })} /></Field><Field label="Formato padrão"><select className={inputClass} value={settings.default_event_format} onChange={(e) => setSettings({ ...settings, default_event_format: e.target.value as AppSettings["default_event_format"] })}><option value="presencial">Presencial</option><option value="online">Online</option><option value="hibrido">Híbrido</option></select></Field><Field label="Capacidade padrão"><input type="number" min={0} className={inputClass} value={settings.default_capacity} onChange={(e) => setSettings({ ...settings, default_capacity: Number(e.target.value) })} /></Field><Field label="Atualização em tempo real (segundos)"><input type="number" min={1} max={300} className={inputClass} value={settings.realtime_refresh_seconds} onChange={(e) => setSettings({ ...settings, realtime_refresh_seconds: Number(e.target.value) })} /></Field><Field label="Feedback de check-in"><select className={inputClass} value={settings.checkin_feedback} onChange={(e) => setSettings({ ...settings, checkin_feedback: e.target.value as AppSettings["checkin_feedback"] })}><option value="visual">Visual</option><option value="sound">Sonoro</option><option value="both">Visual e sonoro</option><option value="none">Sem confirmação adicional</option></select></Field><Field label="Campos obrigatórios no cadastro rápido"><input className={inputClass} value={settings.quick_registration_required_fields.join(", ")} onChange={(e) => setSettings({ ...settings, quick_registration_required_fields: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></Field></div><div className="space-y-3"><ToggleRow label="Permitir participantes avulsos" checked={settings.allow_walk_ins} onChange={(value) => setSettings({ ...settings, allow_walk_ins: value })} /><ToggleRow label="Bloquear check-in duplicado" checked={settings.prevent_duplicate_checkin} onChange={(value) => setSettings({ ...settings, prevent_duplicate_checkin: value })} /><ToggleRow label="Permitir desfazer check-in" checked={settings.allow_undo_checkin} onChange={(value) => setSettings({ ...settings, allow_undo_checkin: value })} /><ToggleRow label="Auto-foco na busca do modo recepção" checked={settings.reception_autofocus} onChange={(value) => setSettings({ ...settings, reception_autofocus: value })} /></div><div className="mt-5"><button disabled={saving} onClick={() => void persist(settings)} className="px-4 py-2.5 rounded-xl bg-green text-white text-sm font-bold disabled:opacity-50">Salvar regras</button></div></Card><EventDeletionManager /></>
}

function ImportsSection() {
  const { state } = useApp(); const [templates, setTemplates] = useState<ImportTemplate[]>([]); const [modal, setModal] = useState(false); const [name, setName] = useState(""); const [matchBy, setMatchBy] = useState<string[]>(["email", "phone", "name"]); const [strategy, setStrategy] = useState<"keep_email" | "placeholder" | "reject">("keep_email"); const [mappingText, setMappingText] = useState('{\n  "email": "email",\n  "name": "name"\n}'); const [error, setError] = useState(""); const [message, setMessage] = useState("")
  const refresh = async () => { try { setTemplates(await loadImportTemplates()) } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao carregar modelos.") } }; useEffect(() => { void refresh() }, [])
  const submit = async (event: FormEvent) => { event.preventDefault(); try { const mapping = JSON.parse(mappingText); await saveImportTemplate({ name, source: "luma", mapping, match_by: matchBy, unnamed_strategy: strategy, created_by: state.user!.id }); setModal(false); setName(""); setMessage("Modelo de importação salvo."); await refresh() } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao salvar modelo.") } }
  return <><SectionHeader title="Importações" description="Modelos de CSV e regras de correspondência para importações manuais." />{message && <Message text={message} />}{error && <Message text={error} error />}<Card title="Modelos de mapeamento" action={<button onClick={() => setModal(true)} className="px-4 py-2 rounded-xl bg-green text-white text-sm font-bold">+ Novo modelo</button>}>{templates.length === 0 ? <p className="text-sm text-carbon-60">Nenhum modelo salvo.</p> : <div className="space-y-2">{templates.map((template) => <div key={template.id} className="flex items-center gap-3 p-3 rounded-xl border border-carbon-20"><div className="flex-1"><div className="font-bold text-sm text-carbon">{template.name}</div><div className="text-xs text-carbon-60 mt-0.5">Luma · correspondência: {template.match_by.join(", ")}</div></div><button onClick={() => void deleteImportTemplate(template.id).then(refresh).catch((cause) => setError(cause instanceof Error ? cause.message : "Falha ao excluir."))} className="text-xs font-bold text-magenta">Excluir</button></div>)}</div>}</Card><Card title="Histórico de importações"><p className="text-sm text-carbon-60">As ações de criação e alteração de modelos já são auditadas. O detalhamento por arquivo, linhas importadas/rejeitadas e relatório de erros será alimentado pelo fluxo de upload do Luma.</p></Card><Modal open={modal} onClose={() => setModal(false)} title="Novo modelo de importação" maxWidth="lg" footer={<><button onClick={() => setModal(false)} className="px-4 py-2 rounded-xl border border-carbon-20 text-sm font-bold">Cancelar</button><button form="template-form" className="px-4 py-2 rounded-xl bg-green text-white text-sm font-bold">Salvar modelo</button></>}><form id="template-form" onSubmit={submit} className="space-y-4"><Field label="Nome do modelo"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required /></Field><Field label="Correspondência"><div className="flex flex-wrap gap-3">{["email", "phone", "name"].map((item) => <label key={item} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={matchBy.includes(item)} onChange={(e) => setMatchBy(e.target.checked ? [...matchBy, item] : matchBy.filter((value) => value !== item))} />{item}</label>)}</div></Field><Field label="Participante sem nome"><select className={inputClass} value={strategy} onChange={(e) => setStrategy(e.target.value as typeof strategy)}><option value="keep_email">Manter usando o e-mail como referência</option><option value="placeholder">Criar nome provisório</option><option value="reject">Rejeitar linha</option></select></Field><Field label="Mapeamento JSON"><textarea className={`${inputClass} min-h-44 font-mono text-xs`} value={mappingText} onChange={(e) => setMappingText(e.target.value)} /></Field></form></Modal></>
}

function IntegrationsSection() {
  const rows = [
    { name: "Supabase", status: "Conectado", detail: "Banco, autenticação e Edge Functions ativos.", ok: true },
    { name: "Vercel", status: window.location.hostname.includes("localhost") ? "Ambiente local" : "Aplicação publicada", detail: "Nenhuma credencial da Vercel é exposta no navegador.", ok: !window.location.hostname.includes("localhost") },
    { name: "Luma", status: "Importação manual", detail: "CSV enviado manualmente por evento.", ok: true },
    { name: "E-mails enviados", status: "Registro manual", detail: "Lista de endereços registrada no módulo de eventos.", ok: true },
    { name: "Luma API", status: "Futura", detail: "Integração automática ainda não configurada.", ok: false },
    { name: "Beehiiv", status: "Futura", detail: "Integração automática ainda não configurada.", ok: false },
  ]
  return <><SectionHeader title="Integrações" description="Estado operacional das conexões sem exposição de chaves ou segredos." /><Card><div className="divide-y divide-carbon-20">{rows.map((row) => <div key={row.name} className="py-4 flex items-center gap-4"><span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${row.ok ? "bg-green" : "bg-carbon-20"}`} /><div className="flex-1"><div className="font-bold text-sm text-carbon">{row.name}</div><div className="text-xs text-carbon-60 mt-0.5">{row.detail}</div></div><span className="text-xs font-bold text-carbon-60">{row.status}</span></div>)}</div></Card><Card title="Segredos"><p className="text-sm text-carbon-60">Chaves privilegiadas permanecem somente no ambiente protegido do Supabase ou da Vercel. Esta interface não permite visualizar nem editar segredos.</p></Card></>
}

function AuditSection() {
  const { state, dispatch } = useApp()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [query, setQuery] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const [deleting, setDeleting] = useState(false)

  const refreshLogs = async () => {
    try { setLogs(await loadAuditLogs()) }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao carregar auditoria.") }
  }

  useEffect(() => { void refreshLogs() }, [])

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return logs
    return logs.filter((log) => [log.action, log.entity_type, log.entity_id, log.profiles?.name, log.profiles?.email, JSON.stringify(log.metadata)].filter(Boolean).some((item) => String(item).toLowerCase().includes(value)))
  }, [logs, query])

  const deleteContacts = async () => {
    if (confirmation !== "DELETAR") return
    setDeleting(true)
    setError("")
    setMessage("")
    try {
      const deleted = await deleteAllContacts(confirmation)
      const data = await loadAppData()
      dispatch({ type: "HYDRATE_DATA", payload: data })
      setConfirmOpen(false)
      setConfirmation("")
      setMessage(`${deleted} contato(s) excluído(s) da base. O histórico dos eventos foi preservado.`)
      await refreshLogs()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível excluir os contatos.")
    } finally {
      setDeleting(false)
    }
  }

  return <>
    <SectionHeader title="Segurança e auditoria" description="Registro das ações críticas e operações administrativas da plataforma." />
    {message && <Message text={message} />}{error && <Message text={error} error />}
    <Card title="Manutenção da base">
      <div className="rounded-xl border border-magenta/30 bg-light-magenta/40 p-4 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1">
          <p className="text-sm font-bold text-carbon">Excluir todos os contatos</p>
          <p className="text-xs text-carbon-60 mt-1 leading-relaxed">Remove os {state.contacts.length} contato(s) atualmente carregados e suas segmentações. Inscrições, presenças, convites e eventos são preservados; apenas o vínculo com o contato é removido.</p>
        </div>
        <button onClick={() => { setConfirmation(""); setConfirmOpen(true) }} className="px-4 py-2.5 rounded-xl border border-magenta text-magenta text-sm font-bold">Excluir todos os contatos</button>
      </div>
    </Card>
    <Card title="Histórico de auditoria"><input type="search" className={`${inputClass} mb-4`} placeholder="Buscar ação, usuário ou entidade…" value={query} onChange={(e) => setQuery(e.target.value)} /><div className="space-y-2">{filtered.map((log) => <div key={log.id} className="rounded-xl border border-carbon-20 p-3"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-carbon">{labelAction(log.action)}</span><span className="text-[11px] text-carbon-60">{new Date(log.created_at).toLocaleString("pt-BR")}</span></div><div className="text-xs text-carbon-60 mt-1">{log.profiles?.name || log.profiles?.email || "Sistema"} · {log.entity_type}{log.entity_id ? ` · ${log.entity_id}` : ""}</div></div>)}{filtered.length === 0 && <p className="text-sm text-carbon-60 py-4">Nenhum registro encontrado.</p>}</div></Card>
    <Modal open={confirmOpen} onClose={() => !deleting && setConfirmOpen(false)} title="Excluir todos os contatos" maxWidth="lg" footer={<><button disabled={deleting} onClick={() => setConfirmOpen(false)} className="px-4 py-2 rounded-xl border border-carbon-20 text-sm font-bold disabled:opacity-50">Cancelar</button><button disabled={confirmation !== "DELETAR" || deleting} onClick={() => void deleteContacts()} className="px-4 py-2 rounded-xl bg-magenta text-white text-sm font-bold disabled:opacity-40">{deleting ? "Excluindo…" : "Excluir definitivamente"}</button></>}>
      <div className="space-y-4">
        <div className="rounded-xl bg-light-magenta px-4 py-3 text-sm text-magenta font-semibold">Esta ação é irreversível para os cadastros de contatos. O histórico dos eventos será mantido.</div>
        <Field label="Digite DELETAR para confirmar"><input autoFocus className={inputClass} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="DELETAR" autoComplete="off" /></Field>
      </div>
    </Modal>
  </>
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center gap-4 py-2 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-green" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span className="flex-1"><span className="text-sm font-semibold text-carbon block">{label}</span>{description && <span className="text-xs text-carbon-60">{description}</span>}</span></label>
}

function Loading({ error }: { error?: string }) { return error ? <Message text={error} error /> : <div className="text-sm text-carbon-60">Carregando configurações…</div> }

function labelAction(action: string) {
  const labels: Record<string, string> = { "settings.updated": "Configurações alteradas", "profile.updated": "Perfil alterado", "user.invited": "Usuário convidado", "user.access_updated": "Acesso de usuário alterado", "user.deactivated": "Usuário desativado", "user.recovery_sent": "Recuperação de senha enviada", "event.created": "Evento criado", "event.updated": "Evento alterado", "event.cancelled": "Evento cancelado", "checkin.undone": "Check-in desfeito", "import_template.created": "Modelo de importação criado", "import_template.updated": "Modelo de importação alterado", "import_template.deleted": "Modelo de importação excluído", "contacts.deleted_all": "Todos os contatos excluídos" }
  return labels[action] || action
}
