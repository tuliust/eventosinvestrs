import { FormEvent, useEffect, useMemo, useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { useApp, useContactActions } from "@/contexts/AppContext"
import { clearDraft, loadDraft, saveDraft } from "@/lib/draftStorage"
import { generateId, isValidEmail, normalizeEmail } from "@/lib/utils"
import type { CommunicationStatus, Contact } from "@/lib/types"

type SegmentationDraft = { segmentId: string; subsegmentId?: string }

const DEFAULT_CONTACT_VALUES = {
  firstName: "",
  lastName: "",
  email: "",
  emailSecondary: "",
  whatsapp: "",
  phone: "",
  organizationId: "",
  position: "",
  seniority: "",
  linkedin: "",
  city: "",
  state: "RS",
  country: "Brasil",
  relationshipType: "",
  origin: "manual",
  communicationStatus: "active" as CommunicationStatus,
  tags: "",
  notes: "",
}

type ContactDraft = {
  values: typeof DEFAULT_CONTACT_VALUES
  segmentId: string
  subsegmentId: string
  segmentations: SegmentationDraft[]
}

const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl border border-carbon-20 bg-white text-sm text-carbon placeholder:text-carbon-60/60 focus:border-green focus:ring-2 focus:ring-green/20 focus:outline-none transition-fast"

export default function NewContactPage() {
  const navigate = useNavigate()
  const { state } = useApp()
  const { createContact, error, saving } = useContactActions()
  const draftKey = `invest-rs:draft:new-contact:${state.user?.id || "anonymous"}`
  const [initialDraft] = useState(() => loadDraft<ContactDraft>(draftKey))
  const [formError, setFormError] = useState<string | null>(null)
  const [segmentId, setSegmentId] = useState(initialDraft?.segmentId || "")
  const [subsegmentId, setSubsegmentId] = useState(initialDraft?.subsegmentId || "")
  const [segmentations, setSegmentations] = useState<SegmentationDraft[]>(initialDraft?.segmentations || [])
  const [values, setValues] = useState({
    ...DEFAULT_CONTACT_VALUES,
    ...(initialDraft?.values || {}),
  })

  useEffect(() => {
    saveDraft<ContactDraft>(draftKey, {
      values,
      segmentId,
      subsegmentId,
      segmentations,
    })
  }, [draftKey, values, segmentId, subsegmentId, segmentations])

  const availableSubsegments = useMemo(
    () =>
      state.subsegments.filter(
        (item) => item.segmentId === segmentId && item.active,
      ),
    [segmentId, state.subsegments],
  )

  if (state.user?.role !== "admin") return <Navigate to="/contatos" replace />

  const update = (field: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
  }

  const addSegmentation = () => {
    if (!segmentId) return
    const duplicate = segmentations.some(
      (item) =>
        item.segmentId === segmentId &&
        (item.subsegmentId || "") === subsegmentId,
    )
    if (!duplicate) {
      setSegmentations((current) => [
        ...current,
        { segmentId, subsegmentId: subsegmentId || undefined },
      ])
    }
    setSegmentId("")
    setSubsegmentId("")
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)

    if (!values.firstName.trim() || !values.lastName.trim()) {
      setFormError("Informe o nome e o sobrenome.")
      return
    }
    if (
      !values.email.trim() &&
      !values.whatsapp.trim() &&
      !values.phone.trim()
    ) {
      setFormError("Informe pelo menos um e-mail, WhatsApp ou telefone.")
      return
    }
    if (values.email && !isValidEmail(values.email)) {
      setFormError("Informe um e-mail válido.")
      return
    }
    if (values.emailSecondary && !isValidEmail(values.emailSecondary)) {
      setFormError("Informe um e-mail secundário válido.")
      return
    }
    if (
      values.email &&
      state.contacts.some(
        (item) =>
          item.email &&
          normalizeEmail(item.email) === normalizeEmail(values.email),
      )
    ) {
      setFormError("Já existe um contato com este e-mail.")
      return
    }

    const selectedOrganization = state.organizations.find(
      (item) => item.id === values.organizationId,
    )
    const now = new Date().toISOString()
    const contact: Contact = {
      id: generateId(),
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: values.email.trim() || undefined,
      emailSecondary: values.emailSecondary.trim() || undefined,
      whatsapp: values.whatsapp.trim() || undefined,
      phone: values.phone.trim() || undefined,
      organizationId: selectedOrganization?.id,
      organization: selectedOrganization?.name,
      position: values.position.trim() || undefined,
      seniority: values.seniority || undefined,
      linkedin: values.linkedin.trim() || undefined,
      city: values.city.trim() || undefined,
      state: values.state.trim() || undefined,
      country: values.country.trim() || undefined,
      relationshipType: values.relationshipType || undefined,
      origin: values.origin,
      communicationStatus: values.communicationStatus,
      tags: values.tags
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      notes: values.notes.trim() || undefined,
      incompleteProfile: false,
      createdAt: now,
      updatedAt: now,
    }

    const persisted = await createContact(contact, segmentations)
    if (persisted) {
      clearDraft(draftKey)
      navigate(`/contatos/${persisted.id}`)
    }
  }

  const cancel = () => {
    clearDraft(draftKey)
    navigate("/contatos")
  }

  return (
    <div className="h-full overflow-y-auto">
      <header className="bg-white border-b border-carbon-20 px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 text-xs text-carbon-60 mb-2">
            <button
              onClick={() => navigate("/contatos")}
              className="hover:text-green"
            >
              Contatos
            </button>
            <span>/</span>
            <span className="text-carbon font-medium">Novo contato</span>
          </div>
          <h1 className="text-2xl font-bold text-carbon">
            Cadastrar novo contato
          </h1>
          <p className="text-sm text-carbon-60 mt-1">
            Inclua os dados profissionais e de relacionamento disponíveis.
          </p>
          <p className="text-xs text-green font-semibold mt-2">Rascunho salvo automaticamente neste navegador.</p>
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="max-w-5xl mx-auto px-6 py-6 space-y-5"
      >
        {(formError || error) && (
          <div
            className="px-4 py-3 rounded-xl bg-light-magenta text-magenta text-sm font-medium"
            role="alert"
          >
            {formError || error}
          </div>
        )}

        <Section title="Identificação">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nome" required>
              <input
                className={inputClass}
                value={values.firstName}
                onChange={(e) => update("firstName", e.target.value)}
              />
            </Field>
            <Field label="Sobrenome" required>
              <input
                className={inputClass}
                value={values.lastName}
                onChange={(e) => update("lastName", e.target.value)}
              />
            </Field>
            <Field label="E-mail">
              <input
                type="email"
                className={inputClass}
                value={values.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </Field>
            <Field label="E-mail secundário">
              <input
                type="email"
                className={inputClass}
                value={values.emailSecondary}
                onChange={(e) => update("emailSecondary", e.target.value)}
              />
            </Field>
            <Field label="WhatsApp">
              <input
                className={inputClass}
                value={values.whatsapp}
                onChange={(e) => update("whatsapp", e.target.value)}
                placeholder="(51) 99999-9999"
              />
            </Field>
            <Field label="Telefone">
              <input
                className={inputClass}
                value={values.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
            </Field>
          </div>
        </Section>

        <Section title="Informações profissionais">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Organização">
              <select
                className={inputClass}
                value={values.organizationId}
                onChange={(e) => update("organizationId", e.target.value)}
              >
                <option value="">Sem organização vinculada</option>
                {state.organizations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cargo">
              <input
                className={inputClass}
                value={values.position}
                onChange={(e) => update("position", e.target.value)}
              />
            </Field>
            <Field label="Senioridade">
              <select
                className={inputClass}
                value={values.seniority}
                onChange={(e) => update("seniority", e.target.value)}
              >
                <option value="">Não informada</option>
                <option>Direção</option>
                <option>Gerência</option>
                <option>Coordenação</option>
                <option>Especialista</option>
                <option>Analista</option>
                <option>Assistência</option>
                <option>Outro</option>
              </select>
            </Field>
            <Field label="LinkedIn">
              <input
                type="url"
                className={inputClass}
                value={values.linkedin}
                onChange={(e) => update("linkedin", e.target.value)}
                placeholder="https://linkedin.com/in/..."
              />
            </Field>
          </div>
        </Section>

        <Section title="Localização e relacionamento">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Cidade">
              <input
                className={inputClass}
                value={values.city}
                onChange={(e) => update("city", e.target.value)}
              />
            </Field>
            <Field label="Estado">
              <input
                className={inputClass}
                value={values.state}
                onChange={(e) => update("state", e.target.value)}
              />
            </Field>
            <Field label="País">
              <input
                className={inputClass}
                value={values.country}
                onChange={(e) => update("country", e.target.value)}
              />
            </Field>
            <Field label="Tipo de relacionamento">
              <select
                className={inputClass}
                value={values.relationshipType}
                onChange={(e) => update("relationshipType", e.target.value)}
              >
                <option value="">Não informado</option>
                <option>Prospect</option>
                <option>Parceiro</option>
                <option>Investidor</option>
                <option>Fornecedor</option>
                <option>Imprensa</option>
                <option>Institucional</option>
                <option>Outro</option>
              </select>
            </Field>
            <Field label="Origem">
              <select
                className={inputClass}
                value={values.origin}
                onChange={(e) => update("origin", e.target.value)}
              >
                <option value="manual">Cadastro manual</option>
                <option value="luma">Luma</option>
                <option value="mailing">Mailing</option>
                <option value="bitrix">Bitrix</option>
                <option value="cartao_visita">Cartão de visita</option>
                <option value="outro">Outro</option>
              </select>
            </Field>
            <Field label="Status de comunicação">
              <select
                className={inputClass}
                value={values.communicationStatus}
                onChange={(e) =>
                  update(
                    "communicationStatus",
                    e.target.value as CommunicationStatus,
                  )
                }
              >
                <option value="active">Ativo</option>
                <option value="unsubscribed">Descadastrado</option>
                <option value="bounced">E-mail devolvido</option>
                <option value="invalid">Inválido</option>
              </select>
            </Field>
          </div>
        </Section>

        <Section title="Segmentações">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <Field label="Setor">
              <select
                className={inputClass}
                value={segmentId}
                onChange={(e) => {
                  setSegmentId(e.target.value)
                  setSubsegmentId("")
                }}
              >
                <option value="">Selecione um setor</option>
                {state.segments
                  .filter((item) => item.active)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Subsetor">
              <select
                className={inputClass}
                value={subsegmentId}
                onChange={(e) => setSubsegmentId(e.target.value)}
                disabled={!segmentId}
              >
                <option value="">Sem subsetor</option>
                {availableSubsegments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <button
              type="button"
              onClick={addSegmentation}
              disabled={!segmentId}
              className="px-4 py-2.5 rounded-xl border border-green text-green text-sm font-bold disabled:opacity-40"
            >
              Adicionar
            </button>
          </div>
          {segmentations.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {segmentations.map((item, index) => {
                const segment = state.segments.find(
                  (segment) => segment.id === item.segmentId,
                )
                const subsegment = state.subsegments.find(
                  (subsegment) => subsegment.id === item.subsegmentId,
                )
                return (
                  <button
                    key={`${item.segmentId}-${item.subsegmentId || index}`}
                    type="button"
                    onClick={() =>
                      setSegmentations((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    className="px-3 py-1.5 rounded-full badge-green text-xs font-semibold"
                    title="Remover"
                  >
                    {segment?.name}
                    {subsegment ? ` · ${subsegment.name}` : ""} ×
                  </button>
                )
              })}
            </div>
          )}
        </Section>

        <Section title="Notas e marcadores">
          <div className="space-y-4">
            <Field label="Tags" hint="Separe por vírgulas">
              <input
                className={inputClass}
                value={values.tags}
                onChange={(e) => update("tags", e.target.value)}
                placeholder="Ex.: investidor, agro, relacionamento prioritário"
              />
            </Field>
            <Field label="Observações">
              <textarea
                className={`${inputClass} min-h-28 resize-y`}
                value={values.notes}
                onChange={(e) => update("notes", e.target.value)}
              />
            </Field>
          </div>
        </Section>

        <div className="flex justify-end gap-3 pb-8">
          <button
            type="button"
            onClick={cancel}
            className="px-5 py-2.5 rounded-xl border border-carbon-20 bg-white text-sm font-bold text-carbon"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-green text-white text-sm font-bold disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Salvar contato"}
          </button>
        </div>
      </form>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-white rounded-2xl border border-carbon-20 p-5">
      <h2 className="text-sm font-bold text-carbon mb-4">{title}</h2>
      {children}
    </section>
  )
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-carbon-60 mb-1.5">
        {label}
        {required && <span className="text-magenta"> *</span>}
        {hint && <span className="font-normal ml-1">({hint})</span>}
      </span>
      {children}
    </label>
  )
}
