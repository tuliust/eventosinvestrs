import { FormEvent, useEffect, useMemo, useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { useApp } from "@/contexts/AppContext"
import {
  CANONICAL_FIELD_LABELS,
  EVENT_FORMAT_LABELS,
  EVENT_STATUS_LABELS,
} from "@/lib/constants"
import { saveEvent, saveInvites, saveRegistrations } from "@/lib/api"
import { clearDraft, loadDraft, saveDraft } from "@/lib/draftStorage"
import {
  buildLumaRegistrations,
  createLumaMappings,
  matchLumaRows,
  parseCsv,
} from "@/lib/lumaImport"
import {
  generateId,
  isValidEmail,
  matchContactByEmail,
  parseEmailList,
} from "@/lib/utils"
import type {
  CsvColumnMapping,
  Event,
  EventFormat,
  EventInvite,
  EventStatus,
} from "@/lib/types"

const DEFAULT_EVENT_VALUES = {
  title: "",
  description: "",
  status: "draft" as EventStatus,
  type: "Painel",
  format: "presencial" as EventFormat,
  date: "",
  startTime: "",
  endTime: "",
  venue: "",
  address: "",
  city: "",
  state: "RS",
  capacity: "90",
  organizationIds: [] as string[],
  sectorIds: [] as string[],
  responsavel: "",
  lumaUrl: "",
  parentEvent: "",
}

type EventDraft = {
  values: typeof DEFAULT_EVENT_VALUES
  rawEmails: string
}

const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl border border-carbon-20 bg-white text-sm text-carbon placeholder:text-carbon-60/60 focus:border-green focus:ring-2 focus:ring-green/20 focus:outline-none transition-fast"

export default function NewEventPage() {
  const { state, dispatch } = useApp()
  const user = state.user
  const navigate = useNavigate()
  const draftKey = `invest-rs:draft:new-event:${user?.id || "anonymous"}`
  const [initialDraft] = useState(() => loadDraft<EventDraft>(draftKey))
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [createdEvent, setCreatedEvent] = useState<Event | null>(null)
  const [csvFileName, setCsvFileName] = useState("")
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [mappings, setMappings] = useState<CsvColumnMapping[]>([])
  const [rawEmails, setRawEmails] = useState(initialDraft?.rawEmails || "")
  const [values, setValues] = useState({
    ...DEFAULT_EVENT_VALUES,
    ...(initialDraft?.values || {}),
  })

  useEffect(() => {
    saveDraft<EventDraft>(draftKey, { values, rawEmails })
  }, [draftKey, values, rawEmails])

  const parsedEmails = useMemo(() => parseEmailList(rawEmails), [rawEmails])
  const validEmails = useMemo(
    () => parsedEmails.filter(isValidEmail),
    [parsedEmails],
  )
  const invalidEmails = useMemo(
    () => parsedEmails.filter((email) => !isValidEmail(email)),
    [parsedEmails],
  )

  if (user?.role !== "admin") return <Navigate to="/eventos" replace />

  const update = <Key extends keyof typeof values,>(
    field: Key,
    value: typeof values[Key],
  ) => setValues((current) => ({ ...current, [field]: value }))

  const handleCsv = async (file?: File) => {
    setFormError(null)
    if (!file) return
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setFormError("Selecione um arquivo CSV exportado pelo Luma.")
      return
    }

    const parsed = parseCsv(await file.text())
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      setFormError("O CSV selecionado não possui registros para importar.")
      return
    }

    setCsvFileName(file.name)
    setCsvRows(parsed.rows)
    setMappings(createLumaMappings(parsed.headers))
  }

  const updateMapping = (index: number, value: string) => {
    setMappings((current) =>
      current.map((mapping, mappingIndex) =>
        mappingIndex === index
          ? {
              ...mapping,
              mappedTo: value as CsvColumnMapping["mappedTo"],
              isCustom: value === "custom",
            }
          : mapping,
      ),
    )
  }

  const submit = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault()
    setFormError(null)

    if (!values.title.trim()) return setFormError("Informe o título do evento.")
    if (!values.date) return setFormError("Informe a data do evento.")
    if (!values.startTime || !values.endTime)
      return setFormError("Informe os horários de início e término.")
    if (values.endTime <= values.startTime)
      return setFormError("O horário de término deve ser posterior ao início.")
    if (
      Number(values.capacity) < 0 ||
      !Number.isFinite(Number(values.capacity))
    )
      return setFormError("Informe uma capacidade válida.")
    if (invalidEmails.length > 0)
      return setFormError(
        `Corrija os e-mails inválidos antes de salvar: ${invalidEmails.join(", ")}`,
      )

    const now = new Date().toISOString()
    const draft: Event = {
      id: generateId(),
      title: values.title.trim(),
      description: values.description.trim() || undefined,
      status: values.status,
      type: values.type,
      format: values.format,
      date: values.date,
      startTime: values.startTime,
      endTime: values.endTime,
      venue: values.venue.trim() || undefined,
      address: values.address.trim() || undefined,
      city: values.city.trim() || undefined,
      state: values.state.trim() || undefined,
      capacity: Number(values.capacity),
      organizations: values.organizationIds
        .map((id) => state.organizations.find((item) => item.id === id)?.name)
        .filter((name): name is string => Boolean(name)),
      sectors: values.sectorIds
        .map((id) => state.segments.find((item) => item.id === id)?.name)
        .filter((name): name is string => Boolean(name)),
      responsavel: values.responsavel.trim() || undefined,
      lumaUrl: values.lumaUrl.trim() || undefined,
      parentEvent: values.parentEvent || undefined,
      createdAt: now,
      updatedAt: now,
    }

    setSaving(true)
    try {
      const persisted = await saveEvent(draft, user.id)
      dispatch({ type: "ADD_EVENT", payload: persisted })
      setCreatedEvent(persisted)
      clearDraft(draftKey)

      const importErrors: string[] = []

      if (csvRows.length > 0) {
        try {
          const matchedRows = matchLumaRows(csvRows, mappings, state.contacts)
          const registrations = buildLumaRegistrations(
            persisted.id,
            matchedRows,
          )
          await saveRegistrations(registrations)
          dispatch({
            type: "SET_REGISTRATIONS",
            payload: { eventId: persisted.id, registrations },
          })
        } catch (cause) {
          importErrors.push(
            cause instanceof Error
              ? `CSV do Luma: ${cause.message}`
              : "CSV do Luma não importado",
          )
        }
      }

      if (validEmails.length > 0) {
        try {
          const invites: EventInvite[] = validEmails.map((email) => ({
            id: generateId(),
            eventId: persisted.id,
            contactId: matchContactByEmail(state.contacts, email)?.id,
            email,
            invitedAt: now,
            invitedBy: user.id,
            status: "sent",
          }))
          await saveInvites(persisted.id, invites)
          dispatch({
            type: "SET_INVITES",
            payload: { eventId: persisted.id, invites },
          })
        } catch (cause) {
          importErrors.push(
            cause instanceof Error
              ? `E-mails convidados: ${cause.message}`
              : "E-mails convidados não registrados",
          )
        }
      }

      if (importErrors.length > 0) {
        setFormError(
          `O evento foi criado, mas houve falha na importação. ${importErrors.join(" · ")}`,
        )
        return
      }

      navigate(`/eventos/${persisted.id}`)
    } catch (cause) {
      setFormError(
        cause instanceof Error
          ? `Não foi possível criar o evento: ${cause.message}`
          : "Não foi possível criar o evento.",
      )
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => {
    clearDraft(draftKey)
    navigate("/eventos")
  }

  return (
    <div className="h-full overflow-y-auto">
      <header className="bg-white border-b border-carbon-20 px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 text-xs text-carbon-60 mb-2">
            <button
              onClick={() => navigate("/eventos")}
              className="hover:text-green"
            >
              Eventos
            </button>
            <span>/</span>
            <span className="text-carbon font-medium">Novo evento</span>
          </div>
          <h1 className="text-2xl font-bold text-carbon">Criar novo evento</h1>
          <p className="text-sm text-carbon-60 mt-1">
            Cadastre o evento e, se desejar, importe os inscritos do Luma e os
            e-mails convidados.
          </p>
          <p className="text-xs text-green font-semibold mt-2">Rascunho salvo automaticamente neste navegador.</p>
        </div>
      </header>

      <form onSubmit={submit} className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {formError && (
          <div
            className="px-4 py-3 rounded-xl bg-light-magenta text-magenta text-sm font-medium"
            role="alert"
          >
            {formError}
            {createdEvent && (
              <button
                type="button"
                onClick={() => navigate(`/eventos/${createdEvent.id}`)}
                className="ml-2 underline font-bold"
              >
                Abrir evento criado
              </button>
            )}
          </div>
        )}

        <Section title="Informações gerais">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Field label="Título" required>
                <input
                  className={inputClass}
                  value={values.title}
                  onChange={(event) => update("title", event.target.value)}
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Descrição">
                <textarea
                  className={`${inputClass} resize-y`}
                  rows={4}
                  value={values.description}
                  onChange={(event) =>
                    update("description", event.target.value)
                  }
                />
              </Field>
            </div>
            <Field label="Tipo">
              <select
                className={inputClass}
                value={values.type}
                onChange={(event) => update("type", event.target.value)}
              >
                {[
                  "Painel",
                  "Webinar",
                  "Encontro",
                  "Feira",
                  "Missão",
                  "Reunião",
                  "Outro",
                ].map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </Field>
            <Field label="Formato">
              <select
                className={inputClass}
                value={values.format}
                onChange={(event) =>
                  update("format", event.target.value as EventFormat)
                }
              >
                {Object.entries(EVENT_FORMAT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                className={inputClass}
                value={values.status}
                onChange={(event) =>
                  update("status", event.target.value as EventStatus)
                }
              >
                {Object.entries(EVENT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Responsável">
              <input
                className={inputClass}
                value={values.responsavel}
                onChange={(event) => update("responsavel", event.target.value)}
              />
            </Field>
            <Field label="Evento relacionado">
              <select
                className={inputClass}
                value={values.parentEvent}
                onChange={(event) => update("parentEvent", event.target.value)}
              >
                <option value="">Nenhum</option>
                {state.events.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="URL do Luma">
              <input
                type="url"
                className={inputClass}
                placeholder="https://lu.ma/..."
                value={values.lumaUrl}
                onChange={(event) => update("lumaUrl", event.target.value)}
              />
            </Field>
          </div>
        </Section>

        <Section title="Data e local">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Data" required>
              <input
                type="date"
                className={inputClass}
                value={values.date}
                onChange={(event) => update("date", event.target.value)}
              />
            </Field>
            <Field label="Início" required>
              <input
                type="time"
                className={inputClass}
                value={values.startTime}
                onChange={(event) => update("startTime", event.target.value)}
              />
            </Field>
            <Field label="Término" required>
              <input
                type="time"
                className={inputClass}
                value={values.endTime}
                onChange={(event) => update("endTime", event.target.value)}
              />
            </Field>
            <Field label="Local">
              <input
                className={inputClass}
                value={values.venue}
                onChange={(event) => update("venue", event.target.value)}
              />
            </Field>
            <Field label="Cidade">
              <input
                className={inputClass}
                value={values.city}
                onChange={(event) => update("city", event.target.value)}
              />
            </Field>
            <Field label="Estado">
              <input
                className={inputClass}
                value={values.state}
                onChange={(event) => update("state", event.target.value)}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Endereço">
                <input
                  className={inputClass}
                  value={values.address}
                  onChange={(event) => update("address", event.target.value)}
                />
              </Field>
            </div>
            <Field label="Capacidade">
              <input
                type="number"
                min="0"
                className={inputClass}
                value={values.capacity}
                onChange={(event) => update("capacity", event.target.value)}
              />
            </Field>
          </div>
        </Section>

        <Section title="Organizações e setores">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Organizações participantes">
              <select
                multiple
                className={`${inputClass} min-h-36`}
                value={values.organizationIds}
                onChange={(event) =>
                  update(
                    "organizationIds",
                    Array.from(
                      event.target.selectedOptions,
                      (option) => option.value,
                    ),
                  )
                }
              >
                {state.organizations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Setores prioritários">
              <select
                multiple
                className={`${inputClass} min-h-36`}
                value={values.sectorIds}
                onChange={(event) =>
                  update(
                    "sectorIds",
                    Array.from(
                      event.target.selectedOptions,
                      (option) => option.value,
                    ),
                  )
                }
              >
                {state.segments
                  .filter((item) => item.active)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <p className="text-xs text-carbon-60 mt-2">
            Use Ctrl (Windows) ou Command (Mac) para selecionar mais de uma
            opção.
          </p>
        </Section>

        <Section
          title="Inscritos do Luma"
          subtitle="Opcional — importe o CSV já durante a criação do evento."
        >
          <label className="flex items-center justify-between gap-4 rounded-xl border-2 border-dashed border-carbon-20 bg-neutral/50 px-5 py-5 cursor-pointer hover:border-green/50 transition-fast">
            <div>
              <p className="text-sm font-bold text-carbon">
                {csvFileName || "Selecionar CSV do Luma"}
              </p>
              <p className="text-xs text-carbon-60 mt-1">
                {csvRows.length > 0
                  ? `${csvRows.length} registro(s) detectado(s)`
                  : "Arquivo .csv exportado pelo Luma"}
              </p>
            </div>
            <span className="px-4 py-2 rounded-lg bg-white border border-carbon-20 text-sm font-bold text-green">
              Escolher arquivo
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => void handleCsv(event.target.files?.[0])}
            />
          </label>

          {mappings.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-carbon-60">
                Confira o mapeamento das colunas:
              </p>
              {mappings.map((mapping, index) => (
                <div
                  key={mapping.originalName}
                  className="grid grid-cols-[minmax(0,1fr)_auto_minmax(180px,1fr)] items-center gap-3 rounded-xl border border-carbon-20 px-4 py-3"
                >
                  <span className="text-sm font-semibold text-carbon truncate">
                    {mapping.originalName}
                  </span>
                  <span className="text-carbon-60">→</span>
                  <select
                    className={inputClass}
                    value={mapping.mappedTo || "skip"}
                    onChange={(event) =>
                      updateMapping(index, event.target.value)
                    }
                  >
                    {Object.entries(CANONICAL_FIELD_LABELS).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-carbon-60 mt-3">Se o navegador recarregar completamente a página, selecione o CSV novamente. Os demais campos do rascunho são restaurados automaticamente.</p>
        </Section>

        <Section
          title="E-mails convidados"
          subtitle="Opcional — cole um endereço por linha. Também aceita vírgula ou ponto e vírgula."
        >
          <textarea
            className={`${inputClass} font-mono resize-y`}
            rows={8}
            value={rawEmails}
            onChange={(event) => setRawEmails(event.target.value)}
            placeholder={"contato1@empresa.com.br\ncontato2@entidade.org.br"}
          />
          {parsedEmails.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 text-xs font-semibold">
              <span className="px-2.5 py-1 rounded-full badge-green">
                {validEmails.length} válido(s)
              </span>
              {invalidEmails.length > 0 && (
                <span className="px-2.5 py-1 rounded-full badge-magenta">
                  {invalidEmails.length} inválido(s)
                </span>
              )}
              <span className="px-2.5 py-1 rounded-full badge-carbon">
                {
                  validEmails.filter((email) =>
                    matchContactByEmail(state.contacts, email),
                  ).length
                }{" "}
                já cadastrado(s)
              </span>
            </div>
          )}
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
            disabled={saving || Boolean(createdEvent)}
            className="px-5 py-2.5 rounded-xl bg-green text-white text-sm font-bold disabled:opacity-50"
          >
            {saving ? "Criando evento…" : "Criar evento"}
          </button>
        </div>
      </form>
    </div>
  )
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-white rounded-2xl border border-carbon-20 p-5">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-carbon">{title}</h2>
        {subtitle && <p className="text-xs text-carbon-60 mt-1">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-carbon-60 mb-1.5">
        {label}
        {required && <span className="text-magenta"> *</span>}
      </span>
      {children}
    </label>
  )
}
