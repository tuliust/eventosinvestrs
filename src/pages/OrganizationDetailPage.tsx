import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useApp } from "@/contexts/AppContext"
import { ORG_TYPE_LABELS } from "@/lib/constants"
import { loadOrganizationDetail } from "@/lib/organizationDetailApi"
import { fullName } from "@/lib/utils"
import type { Organization } from "@/lib/types"

const normalize = (value?: string) =>
  (value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR")

export default function OrganizationDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state } = useApp()
  const fallback = state.organizations.find((item) => item.id === id)
  const [organization, setOrganization] = useState<Organization | undefined>(fallback)
  const [loading, setLoading] = useState(Boolean(id))
  const [loadError, setLoadError] = useState("")

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    setLoadError("")
    void loadOrganizationDetail(id)
      .then((item) => {
        if (!active) return
        setOrganization(item || undefined)
      })
      .catch((cause) => {
        if (!active) return
        setLoadError(cause instanceof Error ? cause.message : "Não foi possível carregar a organização.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id])

  const contacts = useMemo(() => {
    if (!organization) return []
    return state.contacts.filter(
      (contact) =>
        contact.organizationId === organization.id ||
        (!contact.organizationId && normalize(contact.organization) === normalize(organization.name)),
    )
  }, [organization, state.contacts])

  const events = useMemo(() => {
    if (!organization) return []
    const target = normalize(organization.name)
    return state.events.filter((event) =>
      event.organizations.some((name) => normalize(name) === target),
    )
  }, [organization, state.events])

  if (loading && !organization) {
    return <div className="h-full flex items-center justify-center text-sm text-carbon-60">Carregando organização…</div>
  }

  if (!organization) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <p className="text-lg font-bold text-carbon">Organização não encontrada</p>
          {loadError && <p className="text-sm text-magenta mt-2">{loadError}</p>}
          <button onClick={() => navigate("/organizacoes")} className="mt-4 px-4 py-2.5 rounded-xl bg-green text-white text-sm font-bold">
            Voltar para organizações
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <header className="bg-white border-b border-carbon-20 px-6 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 text-xs text-carbon-60 mb-3">
            <button onClick={() => navigate("/organizacoes")} className="hover:text-green">Organizações</button>
            <span>/</span>
            <span className="text-carbon font-medium truncate">{organization.name}</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-light-green text-green flex items-center justify-center text-2xl font-bold flex-shrink-0">⬡</div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-carbon break-words">{organization.name}</h1>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="badge-carbon text-xs font-semibold px-2.5 py-1 rounded-full">{ORG_TYPE_LABELS[organization.type]}</span>
                {organization.classificationType && <span className="badge-green text-xs font-semibold px-2.5 py-1 rounded-full">{organization.classificationType}</span>}
                {organization.sector && <span className="px-2.5 py-1 rounded-full bg-neutral text-xs font-semibold text-carbon">{organization.sector}</span>}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-5">
        {loadError && <div className="px-4 py-3 rounded-xl bg-light-magenta text-magenta text-sm">{loadError}</div>}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Metric value={contacts.length} label="Contatos vinculados" />
          <Metric value={events.length} label="Eventos relacionados" />
          <Metric value={organization.relationshipLevel ?? "—"} label="Nível de relacionamento" />
        </section>

        <section className="bg-white rounded-2xl border border-carbon-20 p-5">
          <h2 className="text-sm font-bold text-carbon mb-4">Informações da organização</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-5">
            <Info label="Nome" value={organization.name} />
            <Info label="CNPJ/EIN" value={organization.taxId} />
            <Info label="Tipo" value={ORG_TYPE_LABELS[organization.type]} />
            <Info label="Tipo de classificação" value={organization.classificationType} />
            <Info label="Setor econômico" value={organization.sector} />
            <Info label="Subsetor" value={organization.subsector} />
            <Info label="Tipo de envolvimento com a Invest RS" value={organization.involvementType} />
            <Info label="Analista responsável" value={organization.accountManager} />
            <Info label="Telefone" value={organization.phone} />
            <Info label="Telefone secundário" value={organization.phoneSecondary} />
            <Info label="E-mail institucional" value={organization.emails?.join(" · ")} />
            <Info label="Site corporativo" value={organization.site} link={organization.site} />
            <Info label="Cidade" value={organization.city} />
            <Info label="Estado" value={organization.state} />
            <Info label="País" value={organization.country} />
            <Info label="Endereço" value={organization.address} wide />
          </div>
          <div className="border-t border-carbon-20 mt-5 pt-5">
            <p className="text-xs font-semibold text-carbon-60 uppercase tracking-wide">Descrição resumida</p>
            <p className="text-sm text-carbon mt-2 whitespace-pre-wrap leading-relaxed">{organization.description || "—"}</p>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-carbon-20 overflow-hidden">
          <div className="px-5 py-4 border-b border-carbon-20">
            <h2 className="text-sm font-bold text-carbon">Contatos vinculados</h2>
            <p className="text-xs text-carbon-60 mt-0.5">Pessoas da base associadas a esta organização.</p>
          </div>
          {contacts.length === 0 ? (
            <p className="px-5 py-8 text-sm text-carbon-60 text-center">Nenhum contato vinculado.</p>
          ) : (
            <div className="divide-y divide-carbon-20/50">
              {contacts.map((contact) => (
                <button key={contact.id} type="button" onClick={() => navigate(`/contatos/${contact.id}`)} className="w-full px-5 py-3 flex items-center gap-4 text-left hover:bg-neutral/60 transition-fast">
                  <div className="w-9 h-9 rounded-xl bg-neutral text-carbon flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {(contact.firstName?.[0] || "") + (contact.lastName?.[0] || "")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-carbon truncate">{fullName(contact)}</p>
                    <p className="text-xs text-carbon-60 truncate">{[contact.position, contact.email].filter(Boolean).join(" · ") || "Sem cargo ou e-mail informado"}</p>
                  </div>
                  <span className="text-green text-sm font-bold">Ver →</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {events.length > 0 && (
          <section className="bg-white rounded-2xl border border-carbon-20 overflow-hidden">
            <div className="px-5 py-4 border-b border-carbon-20">
              <h2 className="text-sm font-bold text-carbon">Eventos relacionados</h2>
            </div>
            <div className="divide-y divide-carbon-20/50">
              {events.map((event) => (
                <button key={event.id} type="button" onClick={() => navigate(`/eventos/${event.id}`)} className="w-full px-5 py-3 flex items-center justify-between gap-4 text-left hover:bg-neutral/60 transition-fast">
                  <div>
                    <p className="text-sm font-semibold text-carbon">{event.title}</p>
                    <p className="text-xs text-carbon-60 mt-0.5">{event.date}</p>
                  </div>
                  <span className="text-green text-sm font-bold">Ver →</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

function Metric({ value, label }: { value: string | number; label: string }) {
  return <div className="rounded-2xl border border-carbon-20 bg-white p-4 text-center"><p className="text-2xl font-bold text-carbon">{value}</p><p className="text-xs text-carbon-60 mt-1">{label}</p></div>
}

function Info({ label, value, link, wide }: { label: string; value?: string; link?: string; wide?: boolean }) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <p className="text-xs font-semibold text-carbon-60 uppercase tracking-wide">{label}</p>
      {link && value ? (
        <a href={link} target="_blank" rel="noreferrer" className="text-sm text-green font-semibold mt-1 inline-block break-all hover:underline">{value}</a>
      ) : (
        <p className="text-sm text-carbon mt-1 break-words">{value || "—"}</p>
      )}
    </div>
  )
}
