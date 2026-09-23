import { useMemo } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useApp } from "@/contexts/AppContext"
import { formatDateTime, fullName, getInitials } from "@/lib/utils"
import { SOURCE_LABELS } from "@/lib/constants"

type HistoryItem = {
  id: string
  date: string
  title: string
  description: string
  tone: "green" | "yellow" | "carbon"
}

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { state } = useApp()
  const contact = state.contacts.find((item) => item.id === id)

  const registrations = Object.values(state.registrations)
    .flat()
    .filter((item) => item.contactId === id)
  const attendances = Object.values(state.attendances)
    .flat()
    .filter((item) => item.contactId === id)
  const invites = Object.values(state.invites)
    .flat()
    .filter((item) => item.contactId === id)

  const segmentations = state.contactSegmentations.filter(
    (item) => item.contactId === id,
  )
  const organization = state.organizations.find(
    (item) => item.id === contact?.organizationId,
  )

  const history = useMemo<HistoryItem[]>(() => {
    const eventName = (eventId: string) =>
      state.events.find((event) => event.id === eventId)?.title || "Evento"

    return [
      ...invites.map((item) => ({
        id: `invite-${item.id}`,
        date: item.invitedAt,
        title: "Convite enviado",
        description: `${eventName(item.eventId)} · ${item.status}`,
        tone: "yellow" as const,
      })),
      ...registrations.map((item) => ({
        id: `registration-${item.id}`,
        date: item.registeredAt,
        title: "Inscrição registrada",
        description: `${eventName(item.eventId)} · ${SOURCE_LABELS[item.source] || item.source}`,
        tone: "carbon" as const,
      })),
      ...attendances.map((item) => ({
        id: `attendance-${item.id}`,
        date: item.checkedInAt,
        title: item.undoneAt ? "Check-in desfeito" : "Presença confirmada",
        description: eventName(item.eventId),
        tone: item.undoneAt ? "carbon" as const : "green" as const,
      })),
    ].sort((a, b) => b.date.localeCompare(a.date))
  }, [attendances, invites, registrations, state.events])

  if (!contact) {
    return (
      <div className="h-full flex items-center justify-center text-center">
        <div>
          <p className="text-4xl opacity-30 mb-3">◎</p>
          <p className="font-semibold text-carbon">Contato não encontrado</p>
          <button
            onClick={() => navigate("/contatos")}
            className="mt-3 text-sm font-semibold text-green"
          >
            ← Voltar para contatos
          </button>
        </div>
      </div>
    )
  }

  const name = fullName(contact)
  const activeAttendances = attendances.filter((item) => !item.undoneAt)

  return (
    <div className="h-full overflow-y-auto">
      <header className="bg-white border-b border-carbon-20 px-6 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 text-xs text-carbon-60 mb-4">
            <button
              onClick={() => navigate("/contatos")}
              className="hover:text-green"
            >
              Contatos
            </button>
            <span>/</span>
            <span className="text-carbon font-medium">{name}</span>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-green text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
              {getInitials(name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-carbon">{name}</h1>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    contact.communicationStatus === "active"
                      ? "badge-green"
                      : "badge-magenta"
                  }`}
                >
                  {contact.communicationStatus === "active"
                    ? "Ativo"
                    : contact.communicationStatus}
                </span>
                {contact.incompleteProfile && (
                  <span className="badge-yellow text-xs font-semibold px-2.5 py-1 rounded-full">
                    Perfil incompleto
                  </span>
                )}
              </div>
              <p className="text-sm text-carbon-60 mt-1">
                {[contact.position, contact.organization]
                  .filter(Boolean)
                  .join(" · ") || "Sem vínculo profissional informado"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        <section className="grid grid-cols-3 gap-3 mb-6">
          <Stat label="Convites" value={invites.length} />
          <Stat label="Inscrições" value={registrations.length} />
          <Stat label="Presenças" value={activeAttendances.length} highlight />
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
          <div className="xl:col-span-2 space-y-5">
            <Card title="Informações de contato">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <Info
                  label="E-mail"
                  value={contact.email}
                  href={contact.email ? `mailto:${contact.email}` : undefined}
                />
                <Info
                  label="E-mail secundário"
                  value={contact.emailSecondary}
                  href={
                    contact.emailSecondary
                      ? `mailto:${contact.emailSecondary}`
                      : undefined
                  }
                />
                <Info
                  label="WhatsApp"
                  value={contact.whatsapp}
                  href={
                    contact.whatsapp
                      ? `https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`
                      : undefined
                  }
                />
                <Info
                  label="Telefone"
                  value={contact.phone}
                  href={contact.phone ? `tel:${contact.phone}` : undefined}
                />
                <Info
                  label="LinkedIn"
                  value={contact.linkedin}
                  href={contact.linkedin}
                />
                <Info
                  label="Localização"
                  value={[contact.city, contact.state, contact.country]
                    .filter(Boolean)
                    .join(" · ")}
                />
              </div>
            </Card>

            <Card title="Perfil profissional">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <Info label="Cargo" value={contact.position} />
                <Info label="Senioridade" value={contact.seniority} />
                <Info
                  label="Organização"
                  value={organization?.name || contact.organization}
                />
                <Info
                  label="Tipo de relacionamento"
                  value={contact.relationshipType}
                />
                <Info label="Origem do cadastro" value={contact.origin} />
                <Info
                  label="Última interação"
                  value={
                    contact.lastInteraction
                      ? formatDateTime(contact.lastInteraction)
                      : undefined
                  }
                />
              </div>
            </Card>

            <Card title="Segmentações">
              {segmentations.length === 0 ? (
                <EmptyText>Nenhuma segmentação vinculada.</EmptyText>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {segmentations.map((link) => {
                    const segment = state.segments.find(
                      (item) => item.id === link.segmentId,
                    )
                    const subsegment = state.subsegments.find(
                      (item) => item.id === link.subsegmentId,
                    )
                    return (
                      <span
                        key={link.id}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-carbon-20 text-xs font-semibold text-carbon"
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: segment?.color || "#009C63" }}
                        />
                        {segment?.name || "Segmento"}
                        {subsegment ? ` · ${subsegment.name}` : ""}
                      </span>
                    )
                  })}
                </div>
              )}
            </Card>

            <Card title="Observações">
              <p className="text-sm text-carbon-60 leading-relaxed whitespace-pre-wrap">
                {contact.notes || "Nenhuma observação registrada."}
              </p>
              {contact.tags && contact.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {contact.tags.map((tag) => (
                    <span
                      key={tag}
                      className="badge-carbon text-xs font-semibold px-2.5 py-1 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card title="Histórico de relacionamento">
            {history.length === 0 ? (
              <EmptyText>Nenhuma interação registrada.</EmptyText>
            ) : (
              <div className="space-y-4">
                {history.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <span
                      className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        item.tone === "green"
                          ? "bg-green"
                          : item.tone === "yellow"
                            ? "bg-yellow"
                            : "bg-carbon-20"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-carbon">
                        {item.title}
                      </p>
                      <p className="text-xs text-carbon-60 mt-0.5 leading-relaxed">
                        {item.description}
                      </p>
                      <p className="text-[11px] text-carbon-60/70 mt-1">
                        {formatDateTime(item.date)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  )
}

function Card({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-white rounded-2xl border border-carbon-20 p-5">
      <h2 className="text-xs font-bold uppercase tracking-widest text-carbon-60 mb-4">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Info({
  label,
  value,
  href,
}: {
  label: string
  value?: string
  href?: string
}) {
  return (
    <div className="py-3 border-b border-carbon-20/60 min-w-0">
      <p className="text-[11px] uppercase tracking-wide font-semibold text-carbon-60 mb-1">
        {label}
      </p>
      {href && value ? (
        <a
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel="noreferrer"
          className="text-sm font-medium text-green hover:underline break-words"
        >
          {value}
        </a>
      ) : (
        <p className="text-sm font-medium text-carbon break-words">
          {value || "—"}
        </p>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div className="bg-white rounded-xl border border-carbon-20 px-4 py-3">
      <p
        className={`text-2xl font-bold ${
          highlight ? "text-green" : "text-carbon"
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-carbon-60 font-semibold mt-0.5">{label}</p>
    </div>
  )
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-carbon-60">{children}</p>
}
