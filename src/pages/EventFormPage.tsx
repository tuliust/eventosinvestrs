import { FormEvent, useEffect, useMemo, useState } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import { useApp } from "@/contexts/AppContext"
import EventAudienceFields from "@/components/events/EventAudienceFields"
import EventCardField, { validateEventCard } from "@/components/events/EventCardField"
import {
  CANONICAL_FIELD_LABELS,
  EVENT_FORMAT_LABELS,
  EVENT_STATUS_LABELS,
} from "@/lib/constants"
import { saveEvent, saveInvites, saveRegistrations } from "@/lib/api"
import {
  isValidOnlineUrl,
  loadEventDetails,
  removeEventCard,
  saveEventDetails,
  updateEventCore,
  uploadEventCard,
  type EventDetails,
} from "@/lib/eventDetailsApi"
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
  organizations: [] as string[],
  sectorIds: [] as string[],
  subsegmentIds: [] as string[],
  responsavel: "",
  lumaUrl: "",
  parentEvent: "",
  onlineUrl: "",
}

type EventFormValues = typeof DEFAULT_EVENT_VALUES

type EventDraft = {
  values: EventFormValues
  rawEmails: string
}

type LegacyEventDraftValues = Partial<EventFormValues> & {
  organizationIds?: string[]
}

const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl border border-carbon-20 bg-white text-sm text-carbon placeholder:text-carbon-60/60 focus:border-green focus:ring-2 focus:ring-green/20 focus:outline-none transition-fast"

function eventToValues(event: Event, state: ReturnType<typeof useApp>["state"]): EventFormValues {
  const sectorIds = event.sectorIds?.length
    ? event.sectorIds
    : state.segments
        .filter((item) => (event.sectors || []).includes(item.name))
        .map((item) => item.id)

  const subsegmentIds = event.subsegmentIds?.length
    ? event.subsegmentIds
    : state.subsegments
        .filter((item) => (event.subsectors || []).includes(item.name))
        .map((item) => item.id)

  return {
    title: event.title,
    description: event.description || "",
    status: event.status,
    type: event.type,
    format: event.format,
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    venue: event.venue || "",
    address: event.address || "",
    city: event.city || "",
    state: event.state || "",
    capacity: String(event.capacity),
    organizations: [...event.organizations],
    sectorIds,
    subsegmentIds,
    responsavel: event.responsavel || "",
    lumaUrl: event.lumaUrl || "",
    parentEvent: event.parentEvent || "",
    onlineUrl: "",
  }
}

export default function EventFormPage() {
  const { id } = useParams<{ id?: string }>()
  const { state, dispatch } = useApp()
  const user = state.user
  const navigate = useNavigate()
  const editingEvent = id ? state.events.find((item) => item.id === id) : undefined
  const isEditing = Boolean(id)
  const draftKey = `invest-rs:draft:new-event:${user?.id || "anonymous"}`
  const [initialDraft] = useState(() => (!isEditing ? loadDraft<EventDraft>(draftKey) : null))

  const [saving, setSaving] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(isEditing)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [createdEvent, setCreatedEvent] = useState<Event | null>(null)
  const [currentDetails, setCurrentDetails] = useState<EventDetails | null>(null)
  const [cardFile, setCardFile] = useState<File | null>(null)
  const [cardError, setCardError] = useState<string | undefined>()
  const [removeCurrentCard, setRemoveCurrentCard] = useState(false)

  const [csvFileName, setCsvFileName] = useState("")
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [mappings, setMappings] = useState<CsvColumnMapping[]>([])
  const [rawEmails, setRawEmails] = useState(initialDraft?.rawEmails || "")
  const [values, setValues] = useState<EventFormValues>(() => {
    if (editingEvent) return eventToValues(editingEvent, state)

    const draftValues = (initialDraft?.values || {}) as LegacyEventDraftValues
    const legacyOrganizations = (draftValues.organizationIds || [])
      .map((organizationId) => state.organizations.find((item) => item.id === organizationId)?.name)
      .filter((name): name is string => Boolean(name))

    return {
      ...DEFAULT_EVENT_VALUES,
      ...draftValues,
      organizations: draftValues.organizations || legacyOrganizations,
      sectorIds: draftValues.sectorIds || [],
      subsegmentIds: draftValues.subsegmentIds || [],
    }
  })

  useEffect(() => {
    if (!isEditing) saveDraft<EventDraft>(draftKey, { values, rawEmails })
  }, [draftKey, isEditing, values, rawEmails])

  useEffect(() => {
    if (!editingEvent) {
      setDetailsLoading(false)
      return
    }

    let cancelled = false
    setDetailsLoading(true)
    void loadEventDetails(editingEvent.id)
      .then((details) => {
        if (cancelled) return
        setCurrentDetails(details)
        setValues((current) => ({
          ...current,
          onlineUrl: details?.onlineUrl || "",
        }))
      })
      .catch((cause) => {
        if (cancelled) return
        setFormError(
          cause instanceof Error
            ? `Não foi possível carregar os detalhes do evento: ${cause.message}`
            : "Não foi possível carregar os detalhes do evento.",
        )
      })
      .finally(() => {
        if (!cancelled) setDetailsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [editingEvent?.id])

  const parsedEmails = useMemo(() => parseEmailList(rawEmails), [rawEmails])
  const validEmails = useMemo(() => parsedEmails.filter(isValidEmail), [parsedEmails])
  const invalidEmails = useMemo(
    () => parsedEmails.filter((email) => !isValidEmail(email)),
    [parsedEmails],
  )

  if (user?.role !== "admin") return <Navigate to="/eventos" replace />

  if (isEditing && !editingEvent) {
    return (
      <div className="h-full flex items-center justify-center text-carbon-60">
        <div className="text-center">
          <p className="text-sm font-semibold">Evento não encontrado.</p>
          <button
            type="button"
            onClick={() => navigate("/eventos")}
            className="mt-3 text-sm font-bold text-green"
          >
            ← Voltar para eventos
          </button>
        </div>
      </div>
    )
  }

  const update = <Key extends keyof EventFormValues>(
    field: Key,
    value: EventFormValues[Key],
  ) => {
    setValues((current) => ({ ...current, [field]: value }))
    setSuccessMessage(null)
  }

  const handleCardFile = (file: File | null) => {
    setCardError(undefined)
    if (!file) {
      setCardFile(null)
      return
    }
    const validation = validateEventCard(file)
    if (validation) {
      setCardError(validation)
      setCardFile(null)
      return
    }
    setCardFile(file)
    setRemoveCurrentCard(false)
  }

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

  const validate = () => {
    if (!values.title.trim()) return "Informe o título do evento."
    if (!values.date) return "Informe a data do evento."
    if (!values.startTime || !values.endTime)
      return "Informe os horários de início e término."
    if (values.endTime <= values.startTime)
      return "O horário de término deve ser posterior ao início."
    if (Number(values.capacity) < 0 || !Number.isFinite(Number(values.capacity)))
      return "Informe uma capacidade válida."
    if (values.format === "online" && !isValidOnlineUrl(values.onlineUrl))
      return "Informe a URL do Google Meet, Zoom ou outra plataforma online."
    if (
      values.format === "hibrido" &&
      values.onlineUrl.trim() &&
      !isValidOnlineUrl(values.onlineUrl)
    )
      return "Informe uma URL online válida, iniciando por http:// ou https://."
    if (!isEditing && invalidEmails.length > 0)
      return `Corrija os e-mails inválidos antes de salvar: ${invalidEmails.join(", ")}`
    return null
  }

  const buildEvent = (eventId: string, createdAt: string): Event => {
    const isOnlineOnly = values.format === "online"
    const selectedSectorIds = new Set(values.sectorIds)
    const selectedSubsegmentIds = values.subsegmentIds.filter((subsegmentId) => {
      const subsegment = state.subsegments.find((item) => item.id === subsegmentId)
      return Boolean(subsegment && selectedSectorIds.has(subsegment.segmentId))
    })

    return {
      id: eventId,
      title: values.title.trim(),
      description: values.description.trim() || undefined,
      status: values.status,
      type: values.type,
      format: values.format,
      date: values.date,
      startTime: values.startTime,
      endTime: values.endTime,
      venue: isOnlineOnly ? undefined : values.venue.trim() || undefined,
      address: isOnlineOnly ? undefined : values.address.trim() || undefined,
      city: isOnlineOnly ? undefined : values.city.trim() || undefined,
      state: isOnlineOnly ? undefined : values.state.trim() || undefined,
      capacity: Number(values.capacity),
      organizations: values.organizations.map((name) => name.trim()).filter(Boolean),
      sectorIds: values.sectorIds,
      sectors: values.sectorIds
        .map((segmentId) => state.segments.find((item) => item.id === segmentId)?.name)
        .filter((name): name is string => Boolean(name)),
      subsegmentIds: selectedSubsegmentIds,
      subsectors: selectedSubsegmentIds
        .map((subsegmentId) =>
          state.subsegments.find((item) => item.id === subsegmentId)?.name,
        )
        .filter((name): name is string => Boolean(name)),
      responsavel: values.responsavel.trim() || undefined,
      lumaUrl: values.lumaUrl.trim() || undefined,
      parentEvent: values.parentEvent || undefined,
      createdAt,
      updatedAt: new Date().toISOString(),
    }
  }

  const persistDetails = async (
    eventId: string,
    previousDetails: EventDetails | null,
  ): Promise<EventDetails> => {
    let uploaded: { path: string; url: string } | null = null
    try {
      if (cardFile) uploaded = await uploadEventCard(eventId, cardFile)

      const nextCardUrl = uploaded
        ? uploaded.url
        : removeCurrentCard
          ? undefined
          : previousDetails?.cardUrl
      const nextCardPath = uploaded
        ? uploaded.path
        : removeCurrentCard
          ? undefined
          : previousDetails?.cardPath

      const persisted = await saveEventDetails(eventId, {
        onlineUrl:
          values.format === "online" || values.format === "hibrido"
            ? values.onlineUrl.trim() || undefined
            : undefined,
        cardUrl: nextCardUrl,
        cardPath: nextCardPath,
      })

      if (
        previousDetails?.cardPath &&
        previousDetails.cardPath !== persisted.cardPath &&
        (uploaded || removeCurrentCard)
      ) {
        void removeEventCard(previousDetails.cardPath).catch(() => undefined)
      }

      return persisted
    } catch (cause) {
      if (uploaded?.path) void removeEventCard(uploaded.path).catch(() => undefined)
      throw cause
    }
  }

  const submit = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault()
    setFormError(null)
    setSuccessMessage(null)

    const validation = validate()
    if (validation) {
      setFormError(validation)
      return
    }

    setSaving(true)
    try {
      if (editingEvent) {
        const updatedDraft = buildEvent(editingEvent.id, editingEvent.createdAt)
        const persistedEvent = await updateEventCore(updatedDraft)
        dispatch({ type: "UPDATE_EVENT", payload: persistedEvent })

        const persistedDetails = await persistDetails(editingEvent.id, currentDetails)
        setCurrentDetails(persistedDetails)
        setCardFile(null)
        setRemoveCurrentCard(false)
        setSuccessMessage("Informações do evento atualizadas.")
        navigate(`/eventos/${editingEvent.id}`)
        return
      }

      const now = new Date().toISOString()
      const draft = buildEvent(generateId(), now)
      const persisted = await saveEvent(draft, user.id)
      dispatch({ type: "ADD_EVENT", payload: persisted })
      setCreatedEvent(persisted)
      clearDraft(draftKey)

      const postCreateErrors: string[] = []

      try {
        await persistDetails(persisted.id, null)
      } catch (cause) {
        postCreateErrors.push(
          cause instanceof Error
            ? `Card/URL online: ${cause.message}`
            : "Card/URL online não salvos",
        )
      }

      if (csvRows.length > 0) {
        try {
          const matchedRows = matchLumaRows(csvRows, mappings, state.contacts)
          const registrations = buildLumaRegistrations(persisted.id, matchedRows)
          await saveRegistrations(registrations)
          dispatch({
            type: "SET_REGISTRATIONS",
            payload: { eventId: persisted.id, registrations },
          })
        } catch (cause) {
          postCreateErrors.push(
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
          postCreateErrors.push(
            cause instanceof Error
              ? `E-mails convidados: ${cause.message}`
              : "E-mails convidados não registrados",
          )
        }
      }

      if (postCreateErrors.length > 0) {
        setFormError(
          `O evento foi criado, mas houve falha em parte do processamento. ${postCreateErrors.join(" · ")}`,
        )
        return
      }

      navigate(`/eventos/${persisted.id}`)
    } catch (cause) {
      setFormError(
        cause instanceof Error
          ? `Não foi possível ${isEditing ? "atualizar" : "criar"} o evento: ${cause.message}`
          : `Não foi possível ${isEditing ? "atualizar" : "criar"} o evento.`,
      )
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => {
    if (!isEditing) clearDraft(draftKey)
    navigate(isEditing && editingEvent ? `/eventos/${editingEvent.id}` : "/eventos")
  }

  const showPhysicalLocation = values.format !== "online"
  const showOnlineUrl = values.format === "online" || values.format === "hibrido"

  return (
    <div className="h-full overflow-y-auto">
      <header className="bg-white border-b border-carbon-20 px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 text-xs text-carbon-60 mb-2">
            <button onClick={() => navigate("/eventos")} className="hover:text-green">
              Eventos
            </button>
            {editingEvent && (
              <>
                <span>/</span>
                <button
                  onClick={() => navigate(`/eventos/${editingEvent.id}`)}
                  className="hover:text-green truncate max-w-xs"
                >
                  {editingEvent.title}
                </button>
              </>
            )}
            <span>/</span>
            <span className="text-carbon font-medium">
              {isEditing ? "Editar" : "Novo evento"}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-carbon">
            {isEditing ? "Editar informações do evento" : "Criar novo evento"}
          </h1>
          <p className="text-sm text-carbon-60 mt-1">
            {isEditing
              ? "Atualize os dados gerais, acesso online, local e card do evento."
              : "Cadastre o evento e, se desejar, importe os inscritos do Luma e os e-mails convidados."}
          </p>
          {!isEditing && (
            <p className="text-xs text-green font-semibold mt-2">
              Rascunho salvo automaticamente neste navegador.
            </p>
          )}
        </div>
      </header>

      <form onSubmit={submit} className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {detailsLoading && (
          <div className="px-4 py-3 rounded-xl bg-neutral text-carbon-60 text-sm font-medium">
            Carregando detalhes do evento…
          </div>
        )}

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

        {successMessage && (
          <div className="px-4 py-3 rounded-xl bg-light-green text-green text-sm font-semibold">
            {successMessage}
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
                  rows={6}
                  value={values.description}
                  onChange={(event) => update("description", event.target.value)}
                  placeholder="Use uma linha em branco para separar os parágrafos."
                />
              </Field>
            </div>
            <Field label="Tipo">
              <select
                className={inputClass}
                value={values.type}
                onChange={(event) => update("type", event.target.value)}
              >
                {["Painel", "Webinar", "Encontro", "Feira", "Missão", "Reunião", "Outro"].map(
                  (type) => (
                    <option key={type}>{type}</option>
                  ),
                )}
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
                {state.events
                  .filter((item) => item.id !== editingEvent?.id)
                  .map((item) => (
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

        <Section
          title="Card do evento"
          subtitle="Imagem utilizada para identificar visualmente o evento."
        >
          <EventCardField
            file={cardFile}
            currentUrl={currentDetails?.cardUrl}
            removeCurrent={removeCurrentCard}
            onFileChange={handleCardFile}
            onRemoveCurrent={() => setRemoveCurrentCard((current) => !current)}
            error={cardError}
          />
          <p className="text-[11px] text-carbon-60 mt-3">
            O arquivo selecionado é enviado ao Supabase somente quando o evento é salvo.
          </p>
        </Section>

        <Section title={showOnlineUrl && !showPhysicalLocation ? "Data e acesso" : "Data e local"}>
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

            {showOnlineUrl && (
              <div className="md:col-span-2">
                <Field
                  label="URL do Google Meet, Zoom ou plataforma online"
                  required={values.format === "online"}
                >
                  <input
                    type="url"
                    className={inputClass}
                    placeholder="https://meet.google.com/... ou https://zoom.us/..."
                    value={values.onlineUrl}
                    onChange={(event) => update("onlineUrl", event.target.value)}
                  />
                </Field>
              </div>
            )}

            {showPhysicalLocation && (
              <>
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
              </>
            )}

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

        <Section
          title="Organizações e setores"
          subtitle="Defina co-organizadores, participantes e o público econômico-alvo para apoiar a segmentação do mailing."
        >
          <EventAudienceFields
            organizations={values.organizations}
            organizationSuggestions={state.organizations.map((item) => item.name)}
            onOrganizationsChange={(organizations) => update("organizations", organizations)}
            sectorIds={values.sectorIds}
            subsegmentIds={values.subsegmentIds}
            segments={state.segments}
            subsegments={state.subsegments}
            onSectorIdsChange={(sectorIds) => update("sectorIds", sectorIds)}
            onSubsegmentIdsChange={(subsegmentIds) => update("subsegmentIds", subsegmentIds)}
          />
        </Section>

        {!isEditing && (
          <>
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
                        onChange={(event) => updateMapping(index, event.target.value)}
                      >
                        {Object.entries(CANONICAL_FIELD_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-carbon-60 mt-3">
                Se o navegador recarregar completamente a página, selecione o CSV novamente. Os demais campos do rascunho são restaurados automaticamente.
              </p>
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
                      validEmails.filter((email) => matchContactByEmail(state.contacts, email))
                        .length
                    }{" "}
                    já cadastrado(s)
                  </span>
                </div>
              )}
            </Section>
          </>
        )}

        <div className="flex justify-end gap-3 pb-8">
          <button
            type="button"
            onClick={cancel}
            className="px-5 py-2.5 rounded-xl border border-carbon-20 bg-white text-sm font-bold text-carbon"
          >
            Cancelar
          </button>
          <button
            disabled={saving || detailsLoading || Boolean(createdEvent)}
            className="px-5 py-2.5 rounded-xl bg-green text-white text-sm font-bold disabled:opacity-50"
          >
            {saving
              ? isEditing
                ? "Salvando alterações…"
                : "Criando evento…"
              : isEditing
                ? "Salvar alterações"
                : "Criar evento"}
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
