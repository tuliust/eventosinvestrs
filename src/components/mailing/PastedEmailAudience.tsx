import { useMemo, useState } from "react"
import { useApp } from "@/contexts/AppContext"
import {
  DEFAULT_MAILING_FILTERS,
  loadMailingLists,
  saveMailingList,
  type MailingList,
} from "@/lib/mailingApi"
import {
  fullName,
  isValidEmail,
  normalizeEmail,
  parseEmailList,
} from "@/lib/utils"
import type { Contact, Event } from "@/lib/types"

type EmailMatch = {
  email: string
  contacts: Contact[]
}

export default function PastedEmailAudience({
  event,
  onSaved,
}: {
  event: Event
  onSaved?: () => void
}) {
  const { state } = useApp()
  const [rawEmails, setRawEmails] = useState("")
  const [lists, setLists] = useState<MailingList[]>([])
  const [listsLoaded, setListsLoaded] = useState(false)
  const [destinationId, setDestinationId] = useState("")
  const [newTitle, setNewTitle] = useState(`E-mails colados — ${event.title}`)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const parsed = useMemo(() => parseEmailList(rawEmails), [rawEmails])
  const validEmails = useMemo(() => parsed.filter(isValidEmail), [parsed])
  const invalidEmails = useMemo(() => parsed.filter((email) => !isValidEmail(email)), [parsed])

  const emailIndex = useMemo(() => {
    const index = new Map<string, Contact[]>()
    for (const contact of state.contacts) {
      for (const value of [contact.email, contact.emailSecondary]) {
        if (!value) continue
        const email = normalizeEmail(value)
        const current = index.get(email) || []
        if (!current.some((item) => item.id === contact.id)) current.push(contact)
        index.set(email, current)
      }
    }
    return index
  }, [state.contacts])

  const matches = useMemo<EmailMatch[]>(
    () => validEmails.map((email) => ({ email, contacts: emailIndex.get(normalizeEmail(email)) || [] })),
    [emailIndex, validEmails],
  )

  const recognized = useMemo(
    () => matches.filter((item) => item.contacts.length === 1),
    [matches],
  )
  const ambiguous = useMemo(
    () => matches.filter((item) => item.contacts.length > 1),
    [matches],
  )
  const notFound = useMemo(
    () => matches.filter((item) => item.contacts.length === 0),
    [matches],
  )

  const recognizedContactIds = useMemo(
    () => [...new Set(recognized.map((item) => item.contacts[0].id))],
    [recognized],
  )

  const ensureLists = async () => {
    if (listsLoaded) return
    try {
      const next = await loadMailingLists(event.id)
      setLists(next)
      setListsLoaded(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os mailings deste evento.")
    }
  }

  const saveRecognized = async () => {
    if (state.user?.role !== "admin" || saving) return
    setError("")
    setMessage("")

    if (recognizedContactIds.length === 0) {
      setError("Nenhum e-mail foi reconhecido como contato cadastrado.")
      return
    }

    setSaving(true)
    try {
      const existing = lists.find((list) => list.id === destinationId)
      if (existing) {
        await saveMailingList({
          id: existing.id,
          title: existing.title,
          eventId: event.id,
          filters: existing.filters,
          contactIds: [...new Set([...existing.contactIds, ...recognizedContactIds])],
        })
        setMessage(`${recognizedContactIds.length} contato(s) reconhecido(s) adicionado(s) ao mailing “${existing.title}”.`)
      } else {
        if (!newTitle.trim()) {
          setError("Informe um título para a nova seleção.")
          return
        }
        await saveMailingList({
          title: newTitle.trim(),
          eventId: event.id,
          filters: DEFAULT_MAILING_FILTERS,
          contactIds: recognizedContactIds,
        })
        setMessage(`${recognizedContactIds.length} contato(s) reconhecido(s) salvos em uma nova seleção de público.`)
      }

      const refreshed = await loadMailingLists(event.id)
      setLists(refreshed)
      setListsLoaded(true)
      onSaved?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível adicionar os contatos ao público.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-carbon-20 p-5">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide font-bold text-carbon-60">Adicionar por e-mail</p>
          <h2 className="text-base font-bold text-carbon mt-1">Colar lista de e-mails</h2>
          <p className="text-xs text-carbon-60 mt-1 max-w-3xl">
            Cole e-mails separados por linha, vírgula, ponto e vírgula ou tabulação. Quando houver correspondência única na base, o e-mail será relacionado ao contato cadastrado.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
        <div>
          <textarea
            value={rawEmails}
            onChange={(event) => {
              setRawEmails(event.target.value)
              setError("")
              setMessage("")
            }}
            placeholder={"contato1@empresa.com.br\ncontato2@empresa.com.br"}
            className="w-full min-h-[180px] resize-y rounded-xl border border-carbon-20 bg-white p-3 text-sm leading-6 text-carbon focus:outline-none focus:border-green focus:ring-2 focus:ring-green/10"
          />

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MiniStat label="Válidos" value={validEmails.length} tone="carbon" />
            <MiniStat label="Reconhecidos" value={recognized.length} tone="green" />
            <MiniStat label="Não cadastrados" value={notFound.length} tone="yellow" />
            <MiniStat label="Inválidos" value={invalidEmails.length} tone="magenta" />
          </div>

          {ambiguous.length > 0 && (
            <div className="mt-3 rounded-xl bg-light-yellow px-3 py-2 text-xs text-[#9B6E00] font-semibold">
              {ambiguous.length} e-mail(s) correspondem a mais de um contato e não serão vinculados automaticamente.
            </div>
          )}

          {error && <div className="mt-3 rounded-xl bg-light-magenta px-3 py-2 text-xs text-magenta font-semibold">{error}</div>}
          {message && <div className="mt-3 rounded-xl bg-light-green px-3 py-2 text-xs text-green font-semibold">{message}</div>}
        </div>

        <div className="rounded-xl border border-carbon-20 overflow-hidden">
          <div className="px-4 py-3 border-b border-carbon-20 bg-neutral/40">
            <p className="text-xs font-bold text-carbon">Correspondências</p>
            <p className="text-[11px] text-carbon-60 mt-0.5">Somente correspondências únicas são relacionadas automaticamente.</p>
          </div>
          <div className="max-h-[270px] overflow-y-auto divide-y divide-carbon-20/60">
            {recognized.map(({ email, contacts }) => {
              const contact = contacts[0]
              return (
                <div key={email} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-carbon truncate">{fullName(contact) || "Contato sem nome"}</p>
                      <p className="text-[11px] text-carbon-60 truncate">{contact.position || "Sem cargo"}{contact.organization ? ` · ${contact.organization}` : ""}</p>
                      <p className="text-[11px] text-green truncate mt-0.5">{email}</p>
                    </div>
                    <span className="flex-shrink-0 text-[10px] font-bold rounded-full bg-light-green text-green px-2 py-1">Cadastrado</span>
                  </div>
                </div>
              )
            })}

            {notFound.map(({ email }) => (
              <div key={email} className="px-4 py-3 flex items-center justify-between gap-3">
                <p className="text-xs text-carbon-60 truncate">{email}</p>
                <span className="flex-shrink-0 text-[10px] font-bold rounded-full bg-light-yellow text-[#9B6E00] px-2 py-1">Não cadastrado</span>
              </div>
            ))}

            {ambiguous.map(({ email, contacts }) => (
              <div key={email} className="px-4 py-3">
                <p className="text-xs font-semibold text-carbon">{email}</p>
                <p className="text-[11px] text-[#9B6E00] mt-1">{contacts.length} contatos encontrados — vínculo automático bloqueado.</p>
              </div>
            ))}

            {parsed.length === 0 && (
              <div className="px-4 py-10 text-center text-xs text-carbon-60">Cole uma lista para visualizar as correspondências.</div>
            )}
          </div>
        </div>
      </div>

      {state.user?.role === "admin" && parsed.length > 0 && (
        <div className="mt-4 pt-4 border-t border-carbon-20 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label>
              <span className="block text-xs font-bold text-carbon mb-1.5">Destino</span>
              <select
                value={destinationId}
                onFocus={() => void ensureLists()}
                onChange={(event) => setDestinationId(event.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-carbon-20 bg-white text-sm text-carbon focus:outline-none focus:border-green"
              >
                <option value="">Criar nova seleção de público</option>
                {lists.map((list) => <option key={list.id} value={list.id}>Adicionar em: {list.title}</option>)}
              </select>
            </label>

            {!destinationId && (
              <label>
                <span className="block text-xs font-bold text-carbon mb-1.5">Título da nova seleção</span>
                <input
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-carbon-20 bg-white text-sm text-carbon focus:outline-none focus:border-green"
                />
              </label>
            )}
          </div>

          <button
            type="button"
            onClick={() => void saveRecognized()}
            disabled={saving || recognizedContactIds.length === 0}
            className="px-5 py-2.5 rounded-xl bg-green text-white text-sm font-bold disabled:opacity-40"
          >
            {saving ? "Adicionando…" : `Adicionar ${recognizedContactIds.length} ao público`}
          </button>
        </div>
      )}
    </section>
  )
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "carbon" | "green" | "yellow" | "magenta"
}) {
  const valueClass = tone === "green"
    ? "text-green"
    : tone === "yellow"
      ? "text-[#9B6E00]"
      : tone === "magenta"
        ? "text-magenta"
        : "text-carbon"

  return (
    <div className="rounded-xl bg-neutral/60 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide font-bold text-carbon-60">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${valueClass}`}>{value}</p>
    </div>
  )
}
