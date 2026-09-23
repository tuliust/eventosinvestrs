import { useState } from "react"
import { useApp, useEventInvites, useAddInvites } from "@/contexts/AppContext"
import {
  parseEmailList,
  isValidEmail,
  fullName,
  normalizeEmail,
} from "@/lib/utils"
import Modal from "@/components/ui/Modal"
import type { Event, EventInvite } from "@/lib/types"
import { generateId } from "@/lib/utils"
import { formatDateTime } from "@/lib/utils"

interface Props {
  event: Event
}

export default function GuestsTab({ event }: Props) {
  const { state } = useApp()
  const invites = useEventInvites(event.id)
  const addInvites = useAddInvites(event.id)
  const [showModal, setShowModal] = useState(false)
  const [rawEmails, setRawEmails] = useState("")
  const [preview, setPreview] =
    useState<ReturnType<typeof analyzeEmails> | null>(null)
  const user = state.user
  const canManageInvites = user?.role === "admin"

  function analyzeEmails(raw: string) {
    const parsed = parseEmailList(raw)
    const result = {
      valid: [] as { email: string; contact?: (typeof state.contacts)[0] }[],
      invalid: [] as string[],
      duplicate: [] as string[],
      alreadyInvited: [] as string[],
    }

    const invited = new Set(invites.map((i) => normalizeEmail(i.email)))

    for (const email of parsed) {
      if (!isValidEmail(email)) {
        result.invalid.push(email)
        continue
      }
      if (invited.has(email)) {
        result.alreadyInvited.push(email)
        continue
      }
      if (result.valid.some((v) => v.email === email)) {
        result.duplicate.push(email)
        continue
      }
      const contact = state.contacts.find(
        (c) => normalizeEmail(c.email || "") === email,
      )
      result.valid.push({ email, contact })
    }

    return result
  }

  const handlePreview = () => {
    setPreview(analyzeEmails(rawEmails))
  }

  const handleConfirmInvites = () => {
    if (!preview || !user) return
    const newInvites: EventInvite[] = preview.valid.map((v) => ({
      id: generateId(),
      eventId: event.id,
      contactId: v.contact?.id,
      email: v.email,
      invitedAt: new Date().toISOString(),
      invitedBy: user.id,
      status: "sent",
    }))
    addInvites(newInvites)
    setShowModal(false)
    setRawEmails("")
    setPreview(null)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-carbon-20 bg-white/60">
        <div>
          <h3 className="font-bold text-carbon text-sm">Convidados</h3>
          <p className="text-xs text-carbon-60 mt-0.5">
            {invites.length} convite{invites.length !== 1 ? "s" : ""} registrado
            {invites.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canManageInvites && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-green hover:opacity-90 transition-fast"
          >
            + Registrar convites
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {invites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-3xl mb-3 opacity-30">✉</p>
            <p className="text-carbon-60 font-medium text-sm">
              Nenhum convite registrado
            </p>
            <p className="text-xs text-carbon-60 opacity-70 mt-1">
              Use o botão acima para registrar envio de convites
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-carbon-20 text-left">
                <th className="pb-2 text-xs font-semibold text-carbon-60 uppercase tracking-wide pr-4">
                  Contato
                </th>
                <th className="pb-2 text-xs font-semibold text-carbon-60 uppercase tracking-wide pr-4">
                  Organização
                </th>
                <th className="pb-2 text-xs font-semibold text-carbon-60 uppercase tracking-wide pr-4">
                  Enviado em
                </th>
                <th className="pb-2 text-xs font-semibold text-carbon-60 uppercase tracking-wide">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-carbon-20/50">
              {invites.map((invite) => {
                const contact = state.contacts.find(
                  (c) => c.id === invite.contactId,
                )
                return (
                  <tr
                    key={invite.id}
                    className="hover:bg-white/60 transition-fast"
                  >
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-carbon">
                        {contact ? fullName(contact) : "Contato não cadastrado"}
                      </p>
                      <p className="text-xs text-carbon-60">{invite.email}</p>
                    </td>
                    <td className="py-3 pr-4 text-carbon-60">
                      {contact?.organization || "—"}
                    </td>
                    <td className="py-3 pr-4 text-carbon-60 text-xs">
                      {formatDateTime(invite.invitedAt)}
                    </td>
                    <td className="py-3">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full badge-carbon">
                        Enviado
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Register invites modal */}
      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false)
          setPreview(null)
          setRawEmails("")
        }}
        title="Registrar envio de convites"
        maxWidth="lg"
        footer={
          preview ? (
            <>
              <button
                onClick={() => setPreview(null)}
                className="px-4 py-2 text-sm font-bold text-carbon-60 hover:text-carbon transition-fast"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmInvites}
                disabled={preview.valid.length === 0}
                className="px-4 py-2 text-sm font-bold text-white rounded-lg bg-green disabled:opacity-50 transition-fast"
              >
                Confirmar {preview.valid.length} convite(s)
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-bold text-carbon-60"
              >
                Cancelar
              </button>
              <button
                onClick={handlePreview}
                disabled={!rawEmails.trim()}
                className="px-4 py-2 text-sm font-bold text-white rounded-lg bg-green disabled:opacity-50"
              >
                Analisar lista
              </button>
            </>
          )
        }
      >
        {!preview ? (
          <div>
            <p className="text-sm text-carbon-60 mb-3">
              Cole a lista de e-mails abaixo. Aceita: quebra de linha, vírgula,
              ponto e vírgula ou tab.
            </p>
            <textarea
              value={rawEmails}
              onChange={(e) => setRawEmails(e.target.value)}
              rows={8}
              placeholder={
                "email1@exemplo.com\nemail2@exemplo.com\nemail3@exemplo.com"
              }
              className="w-full px-4 py-3 rounded-xl border border-carbon-20 text-sm font-mono text-carbon focus:outline-none focus:border-green resize-none"
            />
          </div>
        ) : (
          <div className="space-y-4">
            <ResultGroup
              title="Encontrados na base"
              items={preview.valid.filter((v) => v.contact)}
              color="green"
              render={(v) => (
                <div>
                  <p className="font-semibold text-carbon text-sm">
                    {fullName(v.contact!)}
                  </p>
                  <p className="text-xs text-carbon-60">
                    {v.email} · {v.contact!.organization}
                  </p>
                </div>
              )}
            />
            <ResultGroup
              title="Não encontrados na base"
              items={preview.valid.filter((v) => !v.contact)}
              color="yellow"
              render={(v) => (
                <p className="text-sm text-carbon-60">
                  {v.email} — contato não cadastrado
                </p>
              )}
            />
            <ResultGroup
              title="Já convidados"
              items={preview.alreadyInvited}
              color="neutral"
              render={(e) => <p className="text-sm text-carbon-60">{e}</p>}
            />
            <ResultGroup
              title="E-mails inválidos"
              items={preview.invalid}
              color="magenta"
              render={(e) => <p className="text-sm">{e}</p>}
            />
            <ResultGroup
              title="Duplicados (ignorados)"
              items={preview.duplicate}
              color="neutral"
              render={(e) => <p className="text-sm text-carbon-60">{e}</p>}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}

function ResultGroup<T>({
  title,
  items,
  color,
  render,
}: {
  title: string
  items: T[]
  color: string
  render: (item: T) => React.ReactNode
}) {
  if (items.length === 0) return null
  const bgColors: Record<string, string> = {
    green: "#E8F4EF",
    yellow: "#FFF4D6",
    magenta: "#FCE7EF",
    neutral: "#F4F4F1",
  }
  const textColors: Record<string, string> = {
    green: "#009C63",
    yellow: "#9B6E00",
    magenta: "#E60456",
    neutral: "#7A7A78",
  }
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h4
          className="text-xs font-bold uppercase tracking-wide"
          style={{ color: textColors[color] }}
        >
          {title}
        </h4>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: bgColors[color], color: textColors[color] }}
        >
          {items.length}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="px-3 py-2 rounded-lg"
            style={{ background: bgColors[color] + "60" }}
          >
            {render(item)}
          </div>
        ))}
      </div>
    </div>
  )
}
