import { useEffect, useMemo, useState } from "react"
import { useApp, useEventInvites } from "@/contexts/AppContext"
import { loadMailingLists, type MailingList } from "@/lib/mailingApi"
import { saveInvites } from "@/lib/api"
import { generateId, normalizeEmail } from "@/lib/utils"
import type { Event, EventInvite } from "@/lib/types"

export default function MailingInviteActions({
  event,
  refreshKey = 0,
}: {
  event: Event
  refreshKey?: number
}) {
  const { state, dispatch } = useApp()
  const invites = useEventInvites(event.id)
  const [lists, setLists] = useState<MailingList[]>([])
  const [selectedListId, setSelectedListId] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const isAdmin = state.user?.role === "admin"

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError("")

    void loadMailingLists(event.id)
      .then((next) => {
        if (cancelled) return
        setLists(next)
        setSelectedListId((current) =>
          current && next.some((list) => list.id === current)
            ? current
            : next[0]?.id || "",
        )
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Não foi possível carregar os mailings deste evento.",
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [event.id, refreshKey])

  const selectedList = useMemo(
    () => lists.find((list) => list.id === selectedListId),
    [lists, selectedListId],
  )

  const contactById = useMemo(
    () => new Map(state.contacts.map((contact) => [contact.id, contact])),
    [state.contacts],
  )

  const preview = useMemo(() => {
    const existingEmails = new Set(invites.map((invite) => normalizeEmail(invite.email)))
    const existingContactIds = new Set(
      invites.map((invite) => invite.contactId).filter(Boolean) as string[],
    )

    const ready: Array<{ contactId: string; email: string }> = []
    let alreadyInvited = 0
    let withoutEmail = 0
    let blocked = 0
    let missingContact = 0

    for (const contactId of selectedList?.contactIds || []) {
      const contact = contactById.get(contactId)
      if (!contact) {
        missingContact += 1
        continue
      }

      const email = contact.email || contact.emailSecondary || ""
      if (!email) {
        withoutEmail += 1
        continue
      }

      if (contact.communicationStatus !== "active") {
        blocked += 1
        continue
      }

      const normalized = normalizeEmail(email)
      if (existingContactIds.has(contact.id) || existingEmails.has(normalized)) {
        alreadyInvited += 1
        continue
      }

      ready.push({ contactId: contact.id, email: normalized })
    }

    return {
      total: selectedList?.contactIds.length || 0,
      ready,
      alreadyInvited,
      withoutEmail,
      blocked,
      missingContact,
    }
  }, [contactById, invites, selectedList])

  const addAsInvites = async () => {
    if (!isAdmin || !state.user || !selectedList || saving) return
    setError("")
    setMessage("")

    if (preview.ready.length === 0) {
      setError("Este mailing não possui novos contatos elegíveis para adicionar como convidados.")
      return
    }

    const now = new Date().toISOString()
    const newInvites: EventInvite[] = preview.ready.map(({ contactId, email }) => ({
      id: generateId(),
      eventId: event.id,
      contactId,
      email,
      invitedAt: now,
      invitedBy: state.user!.id,
      status: "sent",
    }))

    setSaving(true)
    try {
      await saveInvites(event.id, newInvites)
      dispatch({
        type: "ADD_INVITES",
        payload: { eventId: event.id, invites: newInvites },
      })

      const notes = [
        `${newInvites.length} contato(s) adicionado(s) como convidados`,
      ]
      if (preview.alreadyInvited) notes.push(`${preview.alreadyInvited} já convidado(s)`)
      if (preview.withoutEmail) notes.push(`${preview.withoutEmail} sem e-mail`)
      if (preview.blocked) notes.push(`${preview.blocked} impedido(s) de comunicação`)
      if (preview.missingContact) notes.push(`${preview.missingContact} cadastro(s) não localizado(s)`)
      setMessage(`${notes.join(" · ")}.`)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `Não foi possível adicionar os convidados: ${cause.message}`
          : "Não foi possível adicionar os convidados.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-carbon-20 p-5">
      <div className="flex flex-col xl:flex-row xl:items-end gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-wide font-bold text-carbon-60">
            Convidados do evento
          </p>
          <h2 className="text-base font-bold text-carbon mt-1">
            Adicionar mailing como convidados
          </h2>
          <p className="text-xs text-carbon-60 mt-1 max-w-3xl">
            Escolha uma seleção salva. Os contatos cadastrados serão relacionados ao convite pelo contact_id e passarão a aparecer na aba Convidados e no Modo Recepção como convidados.
          </p>
        </div>

        <div className="w-full xl:w-[420px]">
          <label className="block">
            <span className="block text-xs font-bold text-carbon mb-1.5">Mailing</span>
            <select
              value={selectedListId}
              onChange={(event) => {
                setSelectedListId(event.target.value)
                setError("")
                setMessage("")
              }}
              disabled={loading || lists.length === 0}
              className="w-full px-3.5 py-2.5 rounded-xl border border-carbon-20 bg-white text-sm text-carbon focus:outline-none focus:border-green disabled:bg-neutral"
            >
              {lists.length === 0 && <option value="">Nenhum mailing salvo</option>}
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.title} · {list.contactIds.length} contato(s)
                </option>
              ))}
            </select>
          </label>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => void addAsInvites()}
            disabled={loading || saving || !selectedList || preview.ready.length === 0}
            className="px-5 py-2.5 rounded-xl bg-green text-white text-sm font-bold disabled:opacity-40 whitespace-nowrap"
          >
            {saving ? "Adicionando…" : `Adicionar ${preview.ready.length} como convidados`}
          </button>
        )}
      </div>

      {selectedList && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2">
          <MiniStat label="No mailing" value={preview.total} />
          <MiniStat label="Novos convidados" value={preview.ready.length} tone="green" />
          <MiniStat label="Já convidados" value={preview.alreadyInvited} />
          <MiniStat label="Sem e-mail" value={preview.withoutEmail} tone="yellow" />
          <MiniStat label="Impedidos" value={preview.blocked} tone="magenta" />
        </div>
      )}

      <p className="mt-3 text-[11px] text-carbon-60">
        Contatos já convidados não são duplicados. Contatos sem e-mail ou com status de comunicação diferente de ativo não são registrados automaticamente como convite enviado.
      </p>

      {error && (
        <div className="mt-3 rounded-xl bg-light-magenta px-3 py-2 text-xs text-magenta font-semibold">
          {error}
        </div>
      )}
      {message && (
        <div className="mt-3 rounded-xl bg-light-green px-3 py-2 text-xs text-green font-semibold">
          {message}
        </div>
      )}
    </section>
  )
}

function MiniStat({
  label,
  value,
  tone = "carbon",
}: {
  label: string
  value: number
  tone?: "carbon" | "green" | "yellow" | "magenta"
}) {
  const toneClass =
    tone === "green"
      ? "text-green"
      : tone === "yellow"
        ? "text-[#9B6E00]"
        : tone === "magenta"
          ? "text-magenta"
          : "text-carbon"

  return (
    <div className="rounded-xl border border-carbon-20 bg-neutral/30 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-carbon-60">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${toneClass}`}>{value}</p>
    </div>
  )
}
