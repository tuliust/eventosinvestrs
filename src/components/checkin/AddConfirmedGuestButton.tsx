import { useMemo, useState } from "react"
import { useApp } from "@/contexts/AppContext"
import { loadAppData } from "@/lib/api"
import { supabase } from "@/lib/supabase"
import {
  fullName,
  isValidEmail,
  normalizeName,
} from "@/lib/utils"
import Modal from "@/components/ui/Modal"
import type { Contact, Event } from "@/lib/types"

interface Props {
  event: Event
}

interface ConfirmationResult {
  contact_id: string
  registration_id: string
  created_contact: boolean
  already_confirmed: boolean
}

export default function AddConfirmedGuestButton({ event }: Props) {
  const { state, dispatch } = useApp()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedContactId, setSelectedContactId] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [company, setCompany] = useState("")
  const [position, setPosition] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const matches = useMemo(() => {
    const query = normalizeName(search)
    if (!query) return []

    const rank = (contact: Contact) => {
      const normalized = normalizeName(fullName(contact))
      if (normalized.startsWith(query)) return 0
      if (normalized.split(/\s+/).some((part) => part.startsWith(query))) return 1
      return 2
    }

    return state.contacts
      .filter((contact) => normalizeName(fullName(contact)).includes(query))
      .sort((a, b) => {
        const rankDiff = rank(a) - rank(b)
        if (rankDiff !== 0) return rankDiff
        return fullName(a).localeCompare(fullName(b), "pt-BR")
      })
      .slice(0, 12)
  }, [search, state.contacts])

  const resetForm = () => {
    setSearch("")
    setSelectedContactId("")
    setName("")
    setEmail("")
    setPhone("")
    setCompany("")
    setPosition("")
    setError("")
  }

  const closeModal = () => {
    if (saving) return
    setOpen(false)
    resetForm()
  }

  const selectContact = (contact: Contact) => {
    setSelectedContactId(contact.id)
    setName(fullName(contact))
    setEmail(contact.email || "")
    setPhone(contact.whatsapp || contact.phone || "")
    setCompany(contact.organization || "")
    setPosition(contact.position || "")
    setSearch("")
    setError("")
  }

  const clearSelection = () => {
    setSelectedContactId("")
    setName("")
    setEmail("")
    setPhone("")
    setCompany("")
    setPosition("")
  }

  const handleSave = async () => {
    if (!selectedContactId && !name.trim()) {
      setError("Informe o nome do participante ou selecione um contato existente.")
      return
    }
    if (email.trim() && !isValidEmail(email)) {
      setError("Informe um e-mail válido ou deixe o campo em branco.")
      return
    }

    setSaving(true)
    setError("")
    try {
      const { data, error: rpcError } = await supabase.rpc("add_event_confirmation", {
        p_event_id: event.id,
        p_contact_id: selectedContactId || null,
        p_name: name.trim() || null,
        p_email: email.trim() || null,
        p_phone: phone.trim() || null,
        p_company: company.trim() || null,
        p_position: position.trim() || null,
      })

      if (rpcError) throw new Error(rpcError.message)

      const result = data as ConfirmationResult | null
      const refreshed = await loadAppData()
      dispatch({ type: "HYDRATE_DATA", payload: refreshed })

      const displayName = name.trim() || "Participante"
      if (result?.already_confirmed) {
        setSuccess(`${displayName} já estava confirmado neste evento.`)
      } else if (result?.created_contact) {
        setSuccess(`${displayName} foi confirmado e adicionado à base de contatos.`)
      } else {
        setSuccess(`${displayName} foi adicionado aos confirmados do evento.`)
      }

      setOpen(false)
      resetForm()
      window.setTimeout(() => setSuccess(""), 3500)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível registrar a confirmação.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-fast hover:opacity-90 active:scale-95 whitespace-nowrap"
        style={{ background: "#009C63" }}
      >
        + Adicionar confirmado
      </button>

      <Modal
        open={open}
        onClose={closeModal}
        title="Adicionar participante"
        maxWidth="2xl"
        footer={
          <>
            <button
              type="button"
              onClick={closeModal}
              disabled={saving}
              className="px-5 py-2.5 text-sm font-bold text-carbon-60 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || (!selectedContactId && !name.trim())}
              className="px-6 py-2.5 text-sm font-bold text-white rounded-lg disabled:opacity-50 transition-fast"
              style={{ background: "#009C63" }}
            >
              {saving ? "Salvando…" : "Adicionar aos confirmados"}
            </button>
          </>
        }
      >
        <div className="space-y-6 py-1">
          <div>
            <p className="text-base text-carbon font-semibold">Primeiro, verifique se a pessoa já está na base.</p>
            <p className="text-sm text-carbon-60 mt-1.5">Se não estiver, preencha os dados abaixo. O contato será criado automaticamente ao confirmar.</p>
          </div>

          {!selectedContactId ? (
            <div className="relative">
              <label className="block text-xs font-semibold text-carbon-60 uppercase tracking-wide mb-2">Buscar contato existente</label>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Digite o nome da pessoa…"
                className="w-full px-5 py-4 rounded-xl border border-carbon-20 text-base text-carbon focus:outline-none focus:border-green"
                autoFocus
              />
              {search.trim() && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-xl border border-carbon-20 bg-white shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                  {matches.length > 0 ? (
                    matches.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => selectContact(contact)}
                        className="w-full text-left px-5 py-3.5 border-b border-carbon-20/60 last:border-b-0 hover:bg-neutral transition-fast"
                      >
                        <span className="block text-sm font-bold text-carbon">{fullName(contact)}</span>
                        <span className="block text-xs text-carbon-60 mt-0.5">
                          {[contact.position, contact.organization, contact.email].filter(Boolean).join(" · ") || "Contato sem dados complementares"}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-5 py-4 text-sm text-carbon-60">
                      Nenhum nome encontrado para “{search.trim()}”.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-green/30 bg-light-green px-5 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-green">Contato encontrado na base</p>
                <p className="text-base font-bold text-carbon mt-1 truncate">{name}</p>
                <p className="text-sm text-carbon-60 mt-1 truncate">{[position, company, email].filter(Boolean).join(" · ")}</p>
              </div>
              <button type="button" onClick={clearSelection} className="text-xs font-bold text-green hover:underline flex-shrink-0">Trocar</button>
            </div>
          )}

          <div className="border-t border-carbon-20 pt-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-5">
              <Field label="Nome *" span>
                <input
                  value={name}
                  onChange={(event) => { setName(event.target.value); if (selectedContactId) setSelectedContactId("") }}
                  placeholder="Nome completo"
                  className="w-full px-5 py-3.5 rounded-xl border border-carbon-20 text-sm text-carbon focus:outline-none focus:border-green"
                />
              </Field>
              <Field label="E-mail">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => { setEmail(event.target.value); if (selectedContactId) setSelectedContactId("") }}
                  placeholder="email@exemplo.com"
                  className="w-full px-5 py-3.5 rounded-xl border border-carbon-20 text-sm text-carbon focus:outline-none focus:border-green"
                />
              </Field>
              <Field label="WhatsApp / telefone">
                <input
                  value={phone}
                  onChange={(event) => { setPhone(event.target.value); if (selectedContactId) setSelectedContactId("") }}
                  placeholder="(51) 99999-9999"
                  className="w-full px-5 py-3.5 rounded-xl border border-carbon-20 text-sm text-carbon focus:outline-none focus:border-green"
                />
              </Field>
              <Field label="Organização">
                <input
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  placeholder="Nome da organização"
                  className="w-full px-5 py-3.5 rounded-xl border border-carbon-20 text-sm text-carbon focus:outline-none focus:border-green"
                />
              </Field>
              <Field label="Cargo">
                <input
                  value={position}
                  onChange={(event) => setPosition(event.target.value)}
                  placeholder="Cargo ou função"
                  className="w-full px-5 py-3.5 rounded-xl border border-carbon-20 text-sm text-carbon focus:outline-none focus:border-green"
                />
              </Field>
            </div>
          </div>

          {error && (
            <p className="rounded-xl bg-light-magenta px-4 py-3 text-xs font-semibold text-magenta" role="alert">{error}</p>
          )}
        </div>
      </Modal>

      {success && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl text-sm font-bold z-50 shadow-lg"
          style={{ background: "#009C63", color: "#FFFFFF" }}
          role="status"
        >
          ✓ {success}
        </div>
      )}
    </>
  )
}

function Field({ label, span = false, children }: { label: string; span?: boolean; children: React.ReactNode }) {
  return (
    <div className={span ? "sm:col-span-2" : ""}>
      <label className="block text-xs font-semibold text-carbon-60 uppercase tracking-wide mb-2">{label}</label>
      {children}
    </div>
  )
}
