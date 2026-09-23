import { FormEvent, useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { useApp, useOrganizationActions } from "@/contexts/AppContext"
import { ORG_TYPE_LABELS } from "@/lib/constants"
import { supabase } from "@/lib/supabase"
import { generateId, isValidEmail } from "@/lib/utils"
import type { Organization, OrgType } from "@/lib/types"

const inputClass = "w-full px-3.5 py-2.5 rounded-xl border border-carbon-20 bg-white text-sm text-carbon focus:border-green focus:ring-2 focus:ring-green/20 focus:outline-none transition-fast"

export default function NewOrganizationPage() {
  const { state } = useApp()
  const navigate = useNavigate()
  const { createOrganization, error, saving } = useOrganizationActions()
  const [formError, setFormError] = useState<string | null>(null)
  const [values, setValues] = useState({
    name: "", type: "empresa_privada" as OrgType, sector: "", subsector: "", site: "", city: "", state: "RS", country: "Brasil",
    taxId: "", classificationType: "", involvementType: "", relationshipLevel: "", accountManager: "", address: "", phone: "", institutionalEmail: "", description: "",
  })

  if (state.user?.role !== "admin") return <Navigate to="/organizacoes" replace />

  const update = (field: keyof typeof values, value: string) => setValues((current) => ({ ...current, [field]: value }))
  const subsegments = state.subsegments.filter((item) => item.segmentId === values.sector && item.active)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    if (!values.name.trim()) return setFormError("Informe o nome da organização.")
    if (values.institutionalEmail.trim() && !isValidEmail(values.institutionalEmail.trim())) return setFormError("Informe um e-mail institucional válido.")
    if (state.organizations.some((item) => item.name.toLocaleLowerCase("pt-BR") === values.name.trim().toLocaleLowerCase("pt-BR"))) return setFormError("Já existe uma organização com este nome.")

    const segment = state.segments.find((item) => item.id === values.sector)
    const subsegment = state.subsegments.find((item) => item.id === values.subsector)
    const now = new Date().toISOString()
    const organization: Organization = {
      id: generateId(), name: values.name.trim(), type: values.type,
      sector: segment?.name, subsector: subsegment?.name,
      primarySegmentId: segment?.id, primarySubsegmentId: subsegment?.id,
      site: values.site.trim() || undefined, city: values.city.trim() || undefined,
      state: values.state.trim() || undefined, country: values.country.trim() || undefined,
      phone: values.phone.trim() || undefined,
      emails: values.institutionalEmail.trim() ? [values.institutionalEmail.trim()] : [],
      taxId: values.taxId.trim() || undefined,
      classificationType: values.classificationType || (segment ? (segment.type === "priority" ? "Prioritário" : "Secundário") : undefined),
      involvementType: values.involvementType.trim() || undefined,
      relationshipLevel: values.relationshipLevel !== "" ? Number(values.relationshipLevel) : undefined,
      accountManager: values.accountManager.trim() || undefined,
      address: values.address.trim() || undefined,
      description: values.description.trim() || undefined,
      createdAt: now, updatedAt: now,
    }

    const persisted = await createOrganization(organization)
    if (!persisted) return

    const { error: detailError } = await supabase.from("organizations").update({
      phone: organization.phone || null,
      emails: organization.emails || [],
      tax_id: organization.taxId || null,
      classification_type: organization.classificationType || null,
      involvement_type: organization.involvementType || null,
      relationship_level: organization.relationshipLevel ?? null,
      account_manager: organization.accountManager || null,
      address: organization.address || null,
      description: organization.description || null,
    }).eq("id", persisted.id)

    if (detailError) {
      setFormError(`A organização foi criada, mas os campos secundários não foram salvos: ${detailError.message}`)
      return
    }
    navigate("/organizacoes")
  }

  return (
    <div className="h-full overflow-y-auto">
      <header className="bg-white border-b border-carbon-20 px-6 py-5">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 text-xs text-carbon-60 mb-2"><button onClick={() => navigate("/organizacoes")} className="hover:text-green">Organizações</button><span>/</span><span className="text-carbon font-medium">Nova organização</span></div>
          <h1 className="text-2xl font-bold text-carbon">Cadastrar organização</h1>
          <p className="text-sm text-carbon-60 mt-1">Registre empresas, entidades, órgãos públicos e parceiros.</p>
        </div>
      </header>
      <form onSubmit={submit} className="max-w-4xl mx-auto px-6 py-6 space-y-5">
        {(formError || error) && <div className="px-4 py-3 rounded-xl bg-light-magenta text-magenta text-sm font-medium">{formError || error}</div>}

        <section className="bg-white rounded-2xl border border-carbon-20 p-5">
          <div className="mb-4"><h2 className="text-sm font-bold text-carbon">Dados principais</h2><p className="text-xs text-carbon-60 mt-1">Nome, classificação econômica e localização da organização.</p></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nome" required><input className={inputClass} value={values.name} onChange={(e) => update("name", e.target.value)} /></Field>
            <Field label="Tipo"><select className={inputClass} value={values.type} onChange={(e) => update("type", e.target.value)}>{Object.entries(ORG_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="Setor"><select className={inputClass} value={values.sector} onChange={(e) => { const id=e.target.value; update("sector", id); update("subsector", ""); const selected=state.segments.find((item)=>item.id===id); update("classificationType", selected ? (selected.type === "priority" ? "Prioritário" : "Secundário") : "") }}><option value="">Não informado</option>{state.segments.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
            <Field label="Subsetor"><select className={inputClass} value={values.subsector} onChange={(e) => update("subsector", e.target.value)} disabled={!values.sector}><option value="">Não informado</option>{subsegments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
            <Field label="Site"><input type="url" className={inputClass} value={values.site} onChange={(e) => update("site", e.target.value)} placeholder="https://" /></Field>
            <Field label="Cidade"><input className={inputClass} value={values.city} onChange={(e) => update("city", e.target.value)} /></Field>
            <Field label="Estado"><input className={inputClass} value={values.state} onChange={(e) => update("state", e.target.value)} /></Field>
            <Field label="País"><input className={inputClass} value={values.country} onChange={(e) => update("country", e.target.value)} /></Field>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-carbon-20 p-5">
          <div className="mb-4"><h2 className="text-sm font-bold text-carbon">Campos secundários</h2><p className="text-xs text-carbon-60 mt-1">Opcionais — correspondem aos campos complementares do modelo de planilha de organizações.</p></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="CNPJ/EIN"><input className={inputClass} value={values.taxId} onChange={(e) => update("taxId", e.target.value)} /></Field>
            <Field label="Tipo de classificação"><select className={inputClass} value={values.classificationType} onChange={(e) => update("classificationType", e.target.value)}><option value="">Não informado</option><option>Prioritário</option><option>Secundário</option></select></Field>
            <Field label="Tipo de envolvimento com a Invest RS"><input className={inputClass} value={values.involvementType} onChange={(e) => update("involvementType", e.target.value)} placeholder="Ex.: Investidor, parceiro, fornecedor" /></Field>
            <Field label="Nível de relacionamento"><input type="number" min="0" step="1" className={inputClass} value={values.relationshipLevel} onChange={(e) => update("relationshipLevel", e.target.value)} /></Field>
            <Field label="Analista responsável"><input className={inputClass} value={values.accountManager} onChange={(e) => update("accountManager", e.target.value)} /></Field>
            <Field label="Telefone"><input className={inputClass} value={values.phone} onChange={(e) => update("phone", e.target.value)} /></Field>
            <Field label="E-mail institucional"><input type="email" className={inputClass} value={values.institutionalEmail} onChange={(e) => update("institutionalEmail", e.target.value)} /></Field>
            <div className="md:col-span-2"><Field label="Endereço"><input className={inputClass} value={values.address} onChange={(e) => update("address", e.target.value)} /></Field></div>
            <div className="md:col-span-2"><Field label="Descrição resumida"><textarea rows={4} className={`${inputClass} resize-y`} value={values.description} onChange={(e) => update("description", e.target.value)} /></Field></div>
          </div>
        </section>

        <div className="flex justify-end gap-3 pb-8">
          <button type="button" onClick={() => navigate("/organizacoes")} className="px-5 py-2.5 rounded-xl border border-carbon-20 bg-white text-sm font-bold text-carbon">Cancelar</button>
          <button disabled={saving} className="px-5 py-2.5 rounded-xl bg-green text-white text-sm font-bold disabled:opacity-50">{saving ? "Salvando…" : "Salvar organização"}</button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block"><span className="block text-xs font-semibold text-carbon-60 mb-1.5">{label}{required && <span className="text-magenta"> *</span>}</span>{children}</label>
}
