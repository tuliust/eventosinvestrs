import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2.112.4"
import * as XLSX from "npm:xlsx@0.18.5"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const MAX = 20 * 1024 * 1024
const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim()
const key = (value: unknown) => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } })

const companySuffixes = new Set(["sa", "s", "a", "ltda", "eireli", "me", "epp", "inc", "llc", "corp", "corporation", "limited"])
const matchKey = (value: unknown) => key(value).split(" ").filter((token) => token && !companySuffixes.has(token)).join(" ")

function diceScore(a: string, b: string) {
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const counts = new Map<string, number>()
  for (let index = 0; index < a.length - 1; index += 1) {
    const pair = a.slice(index, index + 2)
    counts.set(pair, (counts.get(pair) || 0) + 1)
  }
  let overlap = 0
  for (let index = 0; index < b.length - 1; index += 1) {
    const pair = b.slice(index, index + 2)
    const count = counts.get(pair) || 0
    if (count > 0) {
      overlap += 1
      counts.set(pair, count - 1)
    }
  }
  return (2 * overlap) / ((a.length - 1) + (b.length - 1))
}

type MatchEntry = {
  id: string
  name: string
  exact: string
  comparable: string
  compact: string
}

type MatchIndex = {
  exact: Map<string, MatchEntry[]>
  byInitial: Map<string, MatchEntry[]>
}

function buildMatchIndex(organizations: any[]): MatchIndex {
  const exact = new Map<string, MatchEntry[]>()
  const byInitial = new Map<string, MatchEntry[]>()

  for (const organization of organizations) {
    const entry: MatchEntry = {
      id: organization.id,
      name: organization.name,
      exact: key(organization.name),
      comparable: matchKey(organization.name),
      compact: matchKey(organization.name).replace(/\s+/g, ""),
    }
    if (!exact.has(entry.exact)) exact.set(entry.exact, [])
    exact.get(entry.exact)!.push(entry)
    const initial = entry.compact.slice(0, 1)
    if (initial) {
      if (!byInitial.has(initial)) byInitial.set(initial, [])
      byInitial.get(initial)!.push(entry)
    }
  }

  return { exact, byInitial }
}

function scoreComparable(input: string, candidate: MatchEntry) {
  const comparable = matchKey(input)
  const compact = comparable.replace(/\s+/g, "")
  if (!comparable || !candidate.comparable) return 0
  if (comparable === candidate.comparable) return 0.98
  const shorter = comparable.length <= candidate.comparable.length ? comparable : candidate.comparable
  const longer = comparable.length > candidate.comparable.length ? comparable : candidate.comparable
  let score = diceScore(comparable, candidate.comparable)
  if (shorter.length >= 6 && longer.includes(shorter) && shorter.length / longer.length >= 0.65) score = Math.max(score, 0.88)
  if (compact && candidate.compact && compact === candidate.compact) score = Math.max(score, 0.98)
  return score
}

function findMatches(name: string, index: MatchIndex) {
  const exactKey = key(name)
  const exactMatches = index.exact.get(exactKey) || []
  if (exactMatches.length > 0) {
    return exactMatches.slice(0, 3).map((entry) => ({ id: entry.id, name: entry.name, score: 1, reason: "Mesmo nome" as const }))
  }

  const compact = matchKey(name).replace(/\s+/g, "")
  if (!compact) return []
  const candidates = index.byInitial.get(compact.slice(0, 1)) || []
  return candidates
    .filter((candidate) => {
      const shortest = Math.min(compact.length, candidate.compact.length)
      const longest = Math.max(compact.length, candidate.compact.length)
      return longest === 0 || shortest / longest >= 0.5
    })
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      score: Math.round(scoreComparable(name, candidate) * 100) / 100,
      reason: "Nome semelhante" as const,
    }))
    .filter((candidate) => candidate.score >= 0.82)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, 3)
}

const legacyType = (value: string) => {
  const normalized = key(value)
  if (normalized.includes("empresa privada")) return "empresa_privada"
  if (normalized.includes("veiculo de comunicacao") || normalized.includes("imprensa")) return "imprensa"
  if (normalized.includes("associ")) return "associacao"
  if (normalized.includes("orgao publico") || normalized.includes("govern")) return "orgao_governamental"
  if (normalized.includes("embaix") || normalized.includes("consulado")) return "embaixada_consulado"
  if (normalized.includes("financeira") || normalized.includes("investidor")) return "instituicao_financeira"
  if (normalized.includes("univers") || normalized.includes("ensino") || normalized.includes("pesquisa")) return "universidade_academia"
  if (normalized.includes("entidade") || normalized.includes("cooperativa") || normalized.includes("sociedade civil") || normalized.includes("inovacao") || normalized.includes("organismo internacional")) return "entidade"
  return "outro"
}

const organizationTypeAliasId = (value: string) => {
  const aliases: Record<string, string> = {
    "empresa privada": "orgtype-private-company",
    "orgao publico": "orgtype-government",
    "instituicao financeira ou investidor": "orgtype-investor-financier",
    "entidade representativa": "orgtype-business-entity",
    "veiculo de comunicacao": "orgtype-media",
    "embaixada ou consulado": "orgtype-embassy-consulate",
    "organizacao da sociedade civil": "orgtype-third-sector",
    "cooperativa": "orgtype-cooperative",
    "ambiente de inovacao": "orgtype-innovation",
    "instituicao de ensino ou pesquisa": "orgtype-education-research",
    "organismo internacional": "orgtype-multilateral",
    "entidade profissional": "orgtype-professional-worker",
    "entidade de representacao internacional": "orgtype-international-representation",
  }
  return aliases[key(value)]
}

function parse(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: "array", raw: false })
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: null, raw: false })
  let headerIndex = -1
  let header = new Map<string, number>()

  for (let index = 0; index < Math.min(rows.length, 15); index += 1) {
    const candidate = new Map<string, number>()
    ;(rows[index] || []).forEach((value, column) => {
      const normalized = key(value)
      if (normalized) candidate.set(normalized, column)
    })
    if (candidate.has("organizacao")) {
      headerIndex = index
      header = candidate
      break
    }
  }

  if (headerIndex < 0) throw new Error("Não foi encontrada a coluna Organização.")

  const get = (row: unknown[], ...names: string[]) => {
    for (const name of names) {
      const column = header.get(key(name))
      if (column !== undefined) return clean(row[column])
    }
    return ""
  }

  return rows.slice(headerIndex + 1).map((row, offset) => ({
    rowKey: `row-${headerIndex + 2 + offset}`,
    name: get(row, "Organização"),
    taxId: get(row, "CNPJ/EIN"),
    classificationType: get(row, "Tipo de classificação"),
    sector: get(row, "Setor econômico"),
    subsector: get(row, "Subsetor"),
    organizationType: get(row, "Tipo de organização"),
    involvementType: get(row, "Tipo de envolvimento com a Invest RS"),
    relationshipLevel: get(row, "Nível de relacionamento"),
    accountManager: get(row, "Analista responsável"),
    state: get(row, "Estado"),
    city: get(row, "Cidade"),
    site: get(row, "Site corporativo"),
    address: get(row, "Endereço"),
    phone: get(row, "Telefone"),
    email: get(row, "E-mail institucional"),
    description: get(row, "Descrição resumida"),
  })).filter((item) => item.name)
}

function mergeIncoming(found: any, incoming: Record<string, any>, mode: string) {
  const output = { ...found }
  for (const [field, value] of Object.entries(incoming)) {
    const present = value !== null && value !== "" && !(Array.isArray(value) && value.length === 0)
    if (!present) continue
    const empty = output[field] === null || output[field] === undefined || output[field] === "" || (Array.isArray(output[field]) && output[field].length === 0)
    if (mode === "overwrite" || empty) output[field] = value
  }
  return output
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return reply({ error: "Método não permitido." }, 405)

  try {
    const auth = req.headers.get("Authorization")
    if (!auth) return reply({ error: "Não autorizado." }, 401)

    const url = Deno.env.get("SUPABASE_URL")!
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
    const token = auth.replace(/^Bearer\s+/i, "")
    const { data: userData, error: userError } = await admin.auth.getUser(token)
    if (userError || !userData.user) return reply({ error: "Sessão inválida." }, 401)

    const { data: profile } = await admin.from("profiles").select("role,active").eq("id", userData.user.id).single()
    if (!profile?.active || profile.role !== "admin") return reply({ error: "Somente administradores podem importar organizações." }, 403)

    const form = await req.formData()
    const file = form.get("file")
    const action = String(form.get("action") || "preview")
    const mode = String(form.get("mergeMode") || "fill_missing")
    if (!(file instanceof File)) return reply({ error: "Selecione uma planilha Excel." }, 400)
    if (file.size > MAX) return reply({ error: "O arquivo excede 20 MB." }, 400)
    if (mode !== "fill_missing" && mode !== "overwrite") return reply({ error: "Modo de mesclagem inválido." }, 400)

    let resolutions: Record<string, { action: "merge" | "create"; organizationId?: string; preserveName?: boolean }> = {}
    const resolutionsRaw = form.get("resolutions")
    if (typeof resolutionsRaw === "string" && resolutionsRaw) {
      try {
        resolutions = JSON.parse(resolutionsRaw)
      } catch {
        return reply({ error: "As decisões de mesclagem são inválidas." }, 400)
      }
    }

    const items = parse(await file.arrayBuffer())
    const [{ data: existing, error: existingError }, { data: segments }, { data: subsegments }, { data: orgTypes }] = await Promise.all([
      admin.from("organizations").select("*"),
      admin.from("segments").select("id,name,segment_type"),
      admin.from("subsegments").select("id,segment_id,name"),
      admin.from("organization_types").select("id,name"),
    ])
    if (existingError) throw existingError

    const organizations = existing || []
    const organizationsById = new Map(organizations.map((organization) => [organization.id, organization]))
    const matchIndex = buildMatchIndex(organizations)
    const segmentMap = new Map((segments || []).map((item) => [key(item.name), item]))
    const subsegmentMap = new Map((subsegments || []).map((item) => [`${item.segment_id}|${key(item.name)}`, item]))
    const organizationTypeMap = new Map((orgTypes || []).map((item) => [key(item.name), item.id]))

    let exactMatches = 0
    let similarMatches = 0
    const unknownSectors = new Set<string>()

    if (action === "preview") {
      const matches: any[] = []
      const preview: any[] = []

      for (const item of items) {
        const options = findMatches(item.name, matchIndex)
        if (options.length > 0) {
          if (options[0].reason === "Mesmo nome") exactMatches += 1
          else similarMatches += 1
          matches.push({ rowKey: item.rowKey, name: item.name, taxId: item.taxId, options })
        }
        const segment = segmentMap.get(key(item.sector))
        if (item.sector && !segment) unknownSectors.add(item.sector)
        if (preview.length < 5) {
          preview.push({ rowKey: item.rowKey, name: item.name, taxId: item.taxId, sector: item.sector, subsector: item.subsector, type: item.organizationType, status: options.length > 0 ? "Revisar" : "Nova" })
        }
      }

      return reply({
        fileName: file.name,
        fileSize: file.size,
        organizations: items.length,
        withoutMatches: items.length - matches.length,
        exactMatches,
        similarMatches,
        unknownSectors: [...unknownSectors],
        matches,
        preview,
        expectedColumns: ["Organização", "CNPJ/EIN", "Tipo de classificação", "Setor econômico", "Subsetor", "Tipo de organização", "Tipo de envolvimento com a Invest RS", "Nível de relacionamento", "Analista responsável", "Estado", "Cidade", "Site corporativo", "Endereço", "Telefone", "E-mail institucional", "Descrição resumida"],
      })
    }

    if (action !== "import") return reply({ error: "Ação inválida." }, 400)

    let created = 0
    let updated = 0
    let reviewedMatches = 0
    const rowsById = new Map<string, any>()
    const newlyCreatedByName = new Map<string, string>()

    for (const item of items) {
      const resolution = resolutions[item.rowKey]
      let found: any = null

      if (resolution?.action === "merge") {
        if (!resolution.organizationId) return reply({ error: `Selecione a organização de destino para “${item.name}”.` }, 400)
        found = organizationsById.get(resolution.organizationId)
        if (!found || scoreComparable(item.name, {
          id: found.id,
          name: found.name,
          exact: key(found.name),
          comparable: matchKey(found.name),
          compact: matchKey(found.name).replace(/\s+/g, ""),
        }) < 0.82 && key(found.name) !== key(item.name)) {
          return reply({ error: `A organização escolhida para mesclar “${item.name}” não é uma correspondência válida.` }, 400)
        }
        reviewedMatches += 1
      } else if (resolution?.action === "create") {
        reviewedMatches += 1
      } else {
        const options = findMatches(item.name, matchIndex)
        if (options.length > 0) {
          return reply({ error: `A organização “${item.name}” precisa ser revisada novamente antes da importação.` }, 409)
        }
      }

      const segment = segmentMap.get(key(item.sector))
      if (item.sector && !segment) unknownSectors.add(item.sector)
      const subsegment = segment ? subsegmentMap.get(`${segment.id}|${key(item.subsector)}`) : undefined
      const incoming = {
        name: item.name,
        type: legacyType(item.organizationType),
        sector: segment?.name || item.sector || null,
        subsector: subsegment?.name || item.subsector || null,
        primary_segment_id: segment?.id || null,
        primary_subsegment_id: subsegment?.id || null,
        organization_type_id: organizationTypeMap.get(key(item.organizationType)) || organizationTypeAliasId(item.organizationType) || null,
        site: item.site || null,
        city: item.city || null,
        state: item.state || null,
        country: null,
        phone: item.phone || null,
        phone_secondary: null,
        emails: item.email ? [item.email] : [],
        channel_types: [],
        institutional_category_id: null,
        institutional_subcategory_id: null,
        scope_id: null,
        government_sphere_id: null,
        country_id: null,
        state_id: null,
        tax_id: item.taxId || null,
        classification_type: item.classificationType || (segment ? (segment.segment_type === "priority" ? "Prioritário" : "Secundário") : null),
        involvement_type: item.involvementType || null,
        relationship_level: item.relationshipLevel !== "" && Number.isFinite(Number(item.relationshipLevel)) ? Number(item.relationshipLevel) : null,
        account_manager: item.accountManager || null,
        address: item.address || null,
        description: item.description || null,
      }

      if (found) {
        const merged = mergeIncoming(found, incoming, mode)
        if (resolution?.action === "merge" && resolution.preserveName) merged.name = found.name
        rowsById.set(found.id, merged)
        updated += 1
        continue
      }

      const duplicateNewId = newlyCreatedByName.get(key(item.name))
      if (duplicateNewId) {
        rowsById.set(duplicateNewId, mergeIncoming(rowsById.get(duplicateNewId), incoming, mode))
        continue
      }

      const id = crypto.randomUUID()
      newlyCreatedByName.set(key(item.name), id)
      rowsById.set(id, { id, ...incoming })
      created += 1
    }

    const rows = [...rowsById.values()]
    const { error: persistError } = await admin.rpc("apply_organization_import_service", {
      p_rows: rows,
      p_actor_id: userData.user.id,
      p_metadata: {
        file_name: file.name,
        created,
        updated,
        total: items.length,
        reviewed_matches: reviewedMatches,
        unknown_sectors: [...unknownSectors],
        merge_mode: mode,
      },
    })
    if (persistError) throw persistError

    return reply({ success: true, organizationsInFile: items.length, created, updated, unknownSectors: [...unknownSectors], mergeMode: mode })
  } catch (error) {
    console.error(error)
    return reply({ error: error instanceof Error ? error.message : "Falha ao importar organizações." }, 400)
  }
})
