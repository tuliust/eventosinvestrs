import { useEffect, useMemo, useState } from "react"
import { useApp } from "@/contexts/AppContext"
import { createBeehiivCampaign, getBeehiivStatus, syncBeehiivCampaign } from "@/lib/beehiivApi"
import {
  analyzeCommunicationRecipients,
  loadEventCommunications,
  loadEventInvites,
  recordEventCommunication,
  type CommunicationChannel,
  type EventCommunication,
} from "@/lib/eventCommunicationsApi"
import { loadMailingLists, type MailingList } from "@/lib/mailingApi"
import { fullName } from "@/lib/utils"
import type { Event } from "@/lib/types"

const CHANNEL_LABELS: Record<CommunicationChannel, string> = {
  email: "E-mail",
  beehiiv: "Beehiiv",
  luma: "Luma",
  whatsapp: "WhatsApp",
  individual: "Convite individual",
  other: "Outro",
}

function localDateTimeValue() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

export default function CommunicationsTab({ event }: { event: Event }) {
  const { state, dispatch } = useApp()
  const isAdmin = state.user?.role === "admin"
  const [communications, setCommunications] = useState<EventCommunication[]>([])
  const [mailings, setMailings] = useState<MailingList[]>([])
  const [selectedMailingId, setSelectedMailingId] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState("")
  const [subject, setSubject] = useState("")
  const [channel, setChannel] = useState<CommunicationChannel>("email")
  const [origin, setOrigin] = useState("manual")
  const [sentAt, setSentAt] = useState(localDateTimeValue())
  const [summary, setSummary] = useState("")
  const [notes, setNotes] = useState("")
  const [externalCampaignId, setExternalCampaignId] = useState("")
  const [recipientText, setRecipientText] = useState("")
  const [isInvitation, setIsInvitation] = useState(true)
  const [beehiivConfigured, setBeehiivConfigured] = useState(false)
  const [beehiivPublication, setBeehiivPublication] = useState("")
  const [beehiivMode, setBeehiivMode] = useState<"register" | "draft" | "send">("register")
  const [beehiivContent, setBeehiivContent] = useState("")
  const [beehiivSync, setBeehiivSync] = useState<Record<string, unknown> | null>(null)

  const reload = async () => {
    const [nextCommunications, nextMailings] = await Promise.all([
      loadEventCommunications(event.id),
      loadMailingLists(event.id),
    ])
    setCommunications(nextCommunications)
    setMailings(nextMailings)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([loadEventCommunications(event.id), loadMailingLists(event.id), getBeehiivStatus().catch(() => ({ configured: false }))])
      .then(([nextCommunications, nextMailings, beehiiv]) => {
        if (cancelled) return
        setCommunications(nextCommunications)
        setMailings(nextMailings)
        setBeehiivConfigured(Boolean(beehiiv.configured))
        setBeehiivPublication(beehiiv.publication?.name || "")
      })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Não foi possível carregar as comunicações.") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [event.id])

  const priorEmails = useMemo(() => new Set(communications.flatMap((communication) => communication.recipients.map((recipient) => recipient.email))), [communications])
  const analysis = useMemo(() => analyzeCommunicationRecipients(recipientText, state.contacts, priorEmails), [recipientText, state.contacts, priorEmails])
  const uniqueValidRows = analysis.rows.filter((row) => row.valid && !row.duplicate)
  const beehiivEligibleEmails = uniqueValidRows.filter((row) => !row.blocked).map((row) => row.email)

  const useMailing = () => {
    const mailing = mailings.find((item) => item.id === selectedMailingId)
    if (!mailing) return
    const emails = mailing.contactIds.flatMap((id) => {
      const contact = state.contacts.find((item) => item.id === id)
      const email = contact?.email || contact?.emailSecondary
      return email ? [email] : []
    })
    setRecipientText(emails.join("\n"))
    setMessage(`${emails.length} e-mail(s) carregado(s) do mailing “${mailing.title}”.`)
  }

  const resetForm = () => {
    setTitle(""); setSubject(""); setChannel("email"); setOrigin("manual")
    setSentAt(localDateTimeValue()); setSummary(""); setNotes(""); setExternalCampaignId("")
    setRecipientText(""); setIsInvitation(true); setBeehiivMode("register"); setBeehiivContent(""); setBeehiivSync(null)
    setSelectedMailingId(""); setError(""); setMessage("")
  }

  const handleSyncBeehiiv = async () => {
    if (!externalCampaignId.trim()) return
    setSaving(true); setError("")
    try {
      const result = await syncBeehiivCampaign(externalCampaignId.trim())
      setBeehiivSync(result.campaign || null)
      if (result.campaign?.title && !title) setTitle(result.campaign.title)
      if (result.campaign?.subject && !subject) setSubject(result.campaign.subject)
      setMessage("Campanha Beehiiv consultada com sucesso.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível consultar o Beehiiv.")
    } finally { setSaving(false) }
  }

  const handleSave = async () => {
    if (!isAdmin || saving) return
    if (!title.trim()) { setError("Informe o título da comunicação."); return }
    if (!uniqueValidRows.length) { setError("Informe pelo menos um e-mail válido."); return }
    setSaving(true); setError(""); setMessage("")

    try {
      let campaignId = externalCampaignId.trim()
      let externalStatus = beehiivSync?.status ? String(beehiivSync.status) : ""
      let metadata: Record<string, unknown> = {}
      let effectiveInvitation = isInvitation

      if (channel === "beehiiv" && beehiivMode !== "register") {
        if (!beehiivConfigured) throw new Error("Integração Beehiiv não configurada. Use o registro manual ou configure os secrets no Supabase.")
        if (!subject.trim() || !beehiivContent.trim()) throw new Error("Assunto e conteúdo são obrigatórios para criar uma campanha Beehiiv.")
        if (beehiivMode === "send" && !window.confirm(`Enviar agora a campanha Beehiiv para até ${beehiivEligibleEmails.length} destinatário(s) elegível(is)?`)) return
        const result = await createBeehiivCampaign({
          title: title.trim(),
          subject: subject.trim(),
          bodyContent: beehiivContent,
          emails: beehiivEligibleEmails,
          sendNow: beehiivMode === "send",
        })
        campaignId = result.campaign?.id || ""
        externalStatus = result.campaign?.status || (beehiivMode === "send" ? "confirmed" : "draft")
        metadata = {
          beehiiv_segment_id: result.campaign?.segmentId,
          beehiiv_requested_recipients: result.campaign?.requestedRecipients,
          beehiiv_matched_subscribers: result.campaign?.matchedSubscribers,
          beehiiv_preview_url: result.campaign?.previewUrl,
        }
        if (beehiivMode === "draft") effectiveInvitation = false
      }

      await recordEventCommunication({
        eventId: event.id,
        title: title.trim(),
        subject: subject.trim() || undefined,
        channel,
        origin: channel === "beehiiv" ? "beehiiv" : origin,
        sentAt: new Date(sentAt).toISOString(),
        contentSummary: summary || (channel === "beehiiv" ? beehiivContent.slice(0, 500) : undefined),
        externalCampaignId: campaignId || undefined,
        externalStatus: externalStatus || undefined,
        notes: notes || undefined,
        isInvitation: effectiveInvitation,
        metadata,
        recipients: analysis.rows,
      })

      await reload()
      if (effectiveInvitation) {
        const nextInvites = await loadEventInvites(event.id)
        dispatch({ type: "SET_INVITES", payload: { eventId: event.id, invites: nextInvites } })
      }
      resetForm()
      setShowForm(false)
      setMessage(effectiveInvitation ? "Comunicação registrada e convites atualizados." : "Comunicação registrada no histórico do evento.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível registrar a comunicação.")
    } finally { setSaving(false) }
  }

  if (loading) return <div className="h-full flex items-center justify-center text-sm text-carbon-60">Carregando comunicações…</div>

  return (
    <div className="h-full overflow-y-auto bg-neutral/40">
      <div className="max-w-[1400px] mx-auto p-5 space-y-5">
        {error && <div className="rounded-xl bg-light-magenta px-4 py-3 text-sm font-semibold text-magenta">{error}</div>}
        {message && <div className="rounded-xl bg-light-green px-4 py-3 text-sm font-semibold text-green">{message}</div>}

        <section className="bg-white rounded-2xl border border-carbon-20 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide font-bold text-carbon-60">Histórico do evento</p>
            <h2 className="text-lg font-bold text-carbon mt-1">Comunicações</h2>
            <p className="text-xs text-carbon-60 mt-1">Registre o que foi efetivamente enviado. Público selecionado e convite enviado permanecem estados distintos.</p>
          </div>
          {isAdmin && <button onClick={() => { setShowForm((value) => !value); setError("") }} className="px-4 py-2.5 rounded-xl bg-green text-white text-sm font-bold">{showForm ? "Fechar formulário" : "+ Registrar comunicação"}</button>}
        </section>

        {showForm && isAdmin && (
          <section className="bg-white rounded-2xl border border-carbon-20 p-5 space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Field label="Título *"><input value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="Ex.: Convite webinar FINEP" /></Field>
              <Field label="Assunto"><input value={subject} onChange={(e) => setSubject(e.target.value)} className="input" placeholder="Assunto do e-mail ou comunicação" /></Field>
              <Field label="Canal"><select value={channel} onChange={(e) => setChannel(e.target.value as CommunicationChannel)} className="input">{Object.entries(CHANNEL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
              <Field label="Data e hora"><input type="datetime-local" value={sentAt} onChange={(e) => setSentAt(e.target.value)} className="input" /></Field>
            </div>

            {mailings.length > 0 && (
              <div className="rounded-xl bg-neutral/60 border border-carbon-20 p-4">
                <p className="text-xs font-bold text-carbon mb-2">Usar mailing salvo deste evento</p>
                <div className="flex flex-col md:flex-row gap-2">
                  <select value={selectedMailingId} onChange={(e) => setSelectedMailingId(e.target.value)} className="input flex-1">
                    <option value="">Selecione um mailing</option>
                    {mailings.map((mailing) => <option key={mailing.id} value={mailing.id}>{mailing.title} · {mailing.contactIds.length} contato(s)</option>)}
                  </select>
                  <button onClick={useMailing} disabled={!selectedMailingId} className="px-4 py-2.5 rounded-xl border border-green text-green text-sm font-bold disabled:opacity-40">Carregar e-mails</button>
                </div>
              </div>
            )}

            <Field label="Destinatários por e-mail *">
              <textarea value={recipientText} onChange={(e) => setRecipientText(e.target.value)} rows={7} className="input resize-y" placeholder="Um e-mail por linha; também aceita vírgula, ponto e vírgula ou tabulação." />
            </Field>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              <Stat label="Encontrados" value={analysis.found} tone="green" />
              <Stat label="Não encontrados" value={analysis.unmatched} />
              <Stat label="Duplicados" value={analysis.duplicates} tone="yellow" />
              <Stat label="Inválidos" value={analysis.invalid} tone="magenta" />
              <Stat label="Impedidos" value={analysis.blocked} tone="magenta" />
              <Stat label="Já registrados" value={analysis.alreadyRegistered} />
            </div>

            {analysis.rows.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-xl border border-carbon-20 divide-y divide-carbon-20/60">
                {analysis.rows.filter((row) => !row.duplicate).slice(0, 100).map((row) => (
                  <div key={row.email} className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0"><p className="font-semibold text-carbon truncate">{row.email}</p>{row.contact && <p className="text-carbon-60 truncate">{fullName(row.contact)} · {row.contact.organization || "Sem organização"}</p>}</div>
                    <span className={`font-bold ${!row.valid || row.blocked ? "text-magenta" : row.contact ? "text-green" : "text-carbon-60"}`}>{!row.valid ? "Inválido" : row.blocked ? `Impedido: ${row.contact?.communicationStatus}` : row.contact ? "Cadastrado" : "Não cadastrado"}</span>
                  </div>
                ))}
              </div>
            )}

            {channel === "beehiiv" && (
              <div className="rounded-xl border border-carbon-20 p-4 space-y-4">
                <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-carbon">Integração Beehiiv</p><p className="text-xs text-carbon-60">{beehiivConfigured ? `Configurada${beehiivPublication ? ` · ${beehiivPublication}` : ""}` : "Não configurada — o registro manual continua disponível."}</p></div><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${beehiivConfigured ? "badge-green" : "badge-yellow"}`}>{beehiivConfigured ? "Configurada" : "Não configurada"}</span></div>
                <div className="flex flex-wrap gap-2">
                  {[{ id: "register", label: "Registrar campanha existente" }, { id: "draft", label: "Criar rascunho" }, { id: "send", label: "Criar e enviar agora" }].map((option) => <button key={option.id} onClick={() => setBeehiivMode(option.id as typeof beehiivMode)} disabled={option.id !== "register" && !beehiivConfigured} className={`px-3 py-2 rounded-lg text-xs font-bold border ${beehiivMode === option.id ? "border-green text-green bg-light-green" : "border-carbon-20 text-carbon-60"} disabled:opacity-40`}>{option.label}</button>)}
                </div>
                {beehiivMode === "register" ? (
                  <div className="flex flex-col md:flex-row gap-2"><input value={externalCampaignId} onChange={(e) => setExternalCampaignId(e.target.value)} className="input flex-1" placeholder="post_… (opcional)" /><button onClick={() => void handleSyncBeehiiv()} disabled={!beehiivConfigured || !externalCampaignId.trim() || saving} className="px-4 py-2 rounded-xl border border-green text-green text-xs font-bold disabled:opacity-40">Consultar status</button></div>
                ) : (
                  <Field label="Conteúdo HTML da campanha"><textarea value={beehiivContent} onChange={(e) => setBeehiivContent(e.target.value)} rows={6} className="input resize-y" placeholder="Conteúdo do e-mail. O Beehiiv sanitiza o HTML e preserva estilos inline." /></Field>
                )}
                {beehiivSync && <p className="text-xs text-green">Status externo: <strong>{String(beehiivSync.status || "consultado")}</strong></p>}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Field label="Conteúdo / resumo"><textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className="input resize-y" /></Field>
              <Field label="Observações"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="input resize-y" /></Field>
            </div>
            {channel !== "beehiiv" && <Field label="Origem"><input value={origin} onChange={(e) => setOrigin(e.target.value)} className="input" placeholder="manual, assessoria, parceiro…" /></Field>}

            <label className="flex items-start gap-2 text-sm text-carbon cursor-pointer"><input type="checkbox" checked={isInvitation} onChange={(e) => setIsInvitation(e.target.checked)} className="mt-1 accent-green" /><span><strong>Esta comunicação representa convite efetivamente enviado</strong><span className="block text-xs text-carbon-60">Quando marcado, destinatários válidos e não impedidos passam a compor “Convites enviados” do evento.</span></span></label>

            <div className="flex justify-end gap-2"><button onClick={() => { resetForm(); setShowForm(false) }} className="px-4 py-2.5 text-sm font-bold text-carbon-60">Cancelar</button><button onClick={() => void handleSave()} disabled={saving || !title.trim() || !uniqueValidRows.length} className="px-5 py-2.5 rounded-xl bg-green text-white text-sm font-bold disabled:opacity-40">{saving ? "Salvando…" : channel === "beehiiv" && beehiivMode === "send" ? "Enviar e registrar" : "Registrar comunicação"}</button></div>
          </section>
        )}

        <section className="bg-white rounded-2xl border border-carbon-20 overflow-hidden">
          <div className="px-5 py-4 border-b border-carbon-20"><h3 className="font-bold text-carbon">Histórico registrado</h3><p className="text-xs text-carbon-60 mt-1">{communications.length} comunicação(ões)</p></div>
          {communications.length === 0 ? <div className="p-10 text-center text-sm text-carbon-60">Nenhuma comunicação registrada para este evento.</div> : <div className="divide-y divide-carbon-20/70">{communications.map((communication) => <div key={communication.id} className="p-4 flex flex-col lg:flex-row lg:items-start gap-3"><div className="flex-1 min-w-0"><div className="flex items-center gap-2 flex-wrap"><p className="font-bold text-sm text-carbon">{communication.title}</p><span className="badge-carbon px-2 py-0.5 rounded-full text-[11px] font-bold">{CHANNEL_LABELS[communication.channel]}</span>{communication.isInvitation && <span className="badge-green px-2 py-0.5 rounded-full text-[11px] font-bold">Convite enviado</span>}</div>{communication.subject && <p className="text-xs text-carbon-60 mt-1">Assunto: {communication.subject}</p>}<p className="text-xs text-carbon-60 mt-1">{new Date(communication.sentAt).toLocaleString("pt-BR")} · {communication.recipientCount} destinatário(s){communication.externalCampaignId ? ` · ${communication.externalCampaignId}` : ""}</p>{communication.contentSummary && <p className="text-xs text-carbon mt-2 line-clamp-2">{communication.contentSummary}</p>}</div><div className="text-right text-xs text-carbon-60"><p>{communication.recipients.filter((item) => item.matchStatus === "found").length} cadastrados</p><p>{communication.recipients.filter((item) => item.matchStatus === "unmatched").length} não cadastrados</p><p className="text-magenta">{communication.recipients.filter((item) => item.matchStatus === "blocked").length} impedidos</p></div></div>)}</div>}
        </section>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="block text-xs font-bold text-carbon mb-1.5">{label}</span>{children}</label> }
function Stat({ label, value, tone = "carbon" }: { label: string; value: number; tone?: "carbon" | "green" | "yellow" | "magenta" }) { const cls = tone === "green" ? "text-green" : tone === "yellow" ? "text-[#9B6E00]" : tone === "magenta" ? "text-magenta" : "text-carbon"; return <div className="rounded-xl bg-neutral/60 border border-carbon-20 px-3 py-2"><p className="text-[10px] uppercase font-bold text-carbon-60">{label}</p><p className={`text-lg font-bold ${cls}`}>{value}</p></div> }
