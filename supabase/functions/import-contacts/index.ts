import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2.112.4"
import * as XLSX from "npm:xlsx@0.18.5"
const corsHeaders = {
"Access-Control-Allow-Origin": "*",
"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
"Access-Control-Allow-Methods": "POST, OPTIONS",
}
const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_ROWS = 20000
const BATCH_SIZE = 250
const portugueseConnectors = new Set(["da", "de", "do", "das", "dos", "e"])
const jobConnectors = new Set(["da", "de", "do", "das", "dos", "e", "em", "para", "por", "com"])
const jobAcronyms = new Set([
"CEO", "CFO", "COO", "CTO", "CIO", "CMO", "CDO", "CRO", "CHRO",
"VP", "EVP", "SVP", "RH", "TI", "IA", "ESG", "PMO", "P&D", "FP&A",
"RI", "PGE", "MP", "B2B", "B2C", "LATAM", "RS", "BR", "EUA",
])
const compoundJobTitles = new Map<string, string>([
["vice-presidente", "Vice-presidente"],
["vice-prefeito", "Vice-prefeito"],
["socio-diretor", "Sócio-diretor"],
["socio-fundador", "Sócio-fundador"],
["editor-chefe", "Editor-chefe"],
["editor-assistente", "Editor-assistente"],
["gerente-geral", "Gerente-geral"],
["procurador-geral", "Procurador-geral"],
["subprocurador-geral", "Subprocurador-geral"],
["consul-geral", "Cônsul-geral"],
])
type ParsedContact = {
rowKey: string
name: string
company?: string
position?: string
email?: string
emailSecondary?: string
phone?: string
phoneSecondary?: string
sector?: string
subsector?: string
}
type ParsedOrganization = {
name: string
sector?: string
subsector?: string
phone?: string
phoneSecondary?: string
emails: string[]
channelTypes: string[]
}
type OrganizationResolution =
| { action: "merge"; organizationId: string }
| { action: "create" }
type ContactResolution =
| { action: "merge"; contactId: string }
| { action: "create" }
type OrganizationMatchOption = {
id: string
name: string
score: number
reason: "Mesmo nome" | "Nome semelhante"
}
type ContactMatchOption = {
id: string
name: string
organization: string
email: string
phone: string
score: number
reason: "Mesmo nome" | "Nome semelhante"
}
type DbRow = Record<string, any>
function json(body: unknown, status = 200) {
return new Response(JSON.stringify(body), {
status,
headers: { ...corsHeaders, "Content-Type": "application/json" },
})
}
function clean(value: unknown): string {
if (value === null || value === undefined) return ""
return String(value).replace(/\s+/g, " ").trim()
}
function normKey(value: unknown): string {
return clean(value)
.normalize("NFD")
.replace(/[\u0300-\u036f]/g, "")
.toLowerCase()
.replace(/[^a-z0-9]+/g, " ")
.trim()
}
function capitalizeSegment(value: string) {
if (!value) return value
const lower = value.toLocaleLowerCase("pt-BR")
return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1)
}
function normalizePersonName(value: unknown) {
const raw = clean(value)
if (!raw) return ""
return raw
.toLocaleLowerCase("pt-BR")
.split(" ")
.filter(Boolean)
.map((word, index) => {
if (index > 0 && portugueseConnectors.has(word)) return word
if (/^[a-zà-ÿ]\.$/i.test(word)) return word.toLocaleUpperCase("pt-BR")
return word
.split(/([-'])/)
.map((part) => (part === "-" || part === "'" ? part : capitalizeSegment(part)))
.join("")
})
.join(" ")
}
function normalizeJobTitle(value: unknown) {
const raw = clean(value)
if (!raw) return ""
return raw
.replace(/\s*\/\s*/g, " / ")
.replace(/\s*&\s*/g, " & ")
.split(" ")
.filter(Boolean)
.map((word, index) => {
if (word === "/" || word === "&") return word
const acronymCandidate = word.toLocaleUpperCase("pt-BR")
if (jobAcronyms.has(acronymCandidate)) return acronymCandidate
const normalizedWord = normKey(word).replace(/\s+/g, "-")
const canonicalCompound = compoundJobTitles.get(normalizedWord)
if (canonicalCompound) return canonicalCompound
const lower = word.toLocaleLowerCase("pt-BR")
if (index > 0 && jobConnectors.has(lower)) return lower
if (word.includes("-")) {
const pieces = lower.split("-")
return [capitalizeSegment(pieces[0]), ...pieces.slice(1)].join("-")
}
return capitalizeSegment(lower)
})
.join(" ")
.replace(/\s+([/&])\s+/g, " $1 ")
}
const companySuffixes = new Set([
"sa", "s", "a", "ltda", "eireli", "me", "epp", "inc", "llc", "corp",
"corporation", "limited",
])
function organizationMatchKey(value: unknown) {
return normKey(value)
.split(" ")
.filter((token) => token && !companySuffixes.has(token))
.join(" ")
}
function organizationResolutionKey(value: unknown) {
return `org:${normKey(value)}`
}
function personComparable(value: unknown) {
return normKey(value)
.split(" ")
.filter((token) => token && !portugueseConnectors.has(token) && token.length > 1)
.join(" ")
}
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
type OrganizationMatchEntry = {
id: string
name: string
exact: string
comparable: string
compact: string
}
type OrganizationMatchIndex = {
exact: Map<string, OrganizationMatchEntry[]>
byInitial: Map<string, OrganizationMatchEntry[]>
}
function buildOrganizationMatchIndex(organizations: DbRow[]): OrganizationMatchIndex {
const exact = new Map<string, OrganizationMatchEntry[]>()
const byInitial = new Map<string, OrganizationMatchEntry[]>()
for (const organization of organizations) {
const comparable = organizationMatchKey(organization.name)
const entry: OrganizationMatchEntry = {
id: organization.id,
name: organization.name,
exact: normKey(organization.name),
comparable,
compact: comparable.replace(/\s+/g, ""),
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
function scoreOrganization(input: string, candidate: OrganizationMatchEntry) {
const comparable = organizationMatchKey(input)
const compact = comparable.replace(/\s+/g, "")
if (!comparable || !candidate.comparable) return 0
if (comparable === candidate.comparable) return 0.98
const shorter = comparable.length <= candidate.comparable.length ? comparable : candidate.comparable
const longer = comparable.length > candidate.comparable.length ? comparable : candidate.comparable
let score = diceScore(comparable, candidate.comparable)
if (shorter.length >= 6 && longer.includes(shorter) && shorter.length / longer.length >= 0.65) {
score = Math.max(score, 0.88)
}
if (compact && candidate.compact && compact === candidate.compact) {
score = Math.max(score, 0.98)
}
return score
}
function findOrganizationMatches(name: string, index: OrganizationMatchIndex): OrganizationMatchOption[] {
const exactMatches = index.exact.get(normKey(name)) || []
if (exactMatches.length > 0) {
return exactMatches.slice(0, 3).map((entry) => ({
id: entry.id,
name: entry.name,
score: 1,
reason: "Mesmo nome" as const,
}))
}
const compact = organizationMatchKey(name).replace(/\s+/g, "")
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
score: Math.round(scoreOrganization(name, candidate) * 100) / 100,
reason: "Nome semelhante" as const,
}))
.filter((candidate) => candidate.score >= 0.82)
.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "pt-BR"))
.slice(0, 3)
}
type ContactMatchEntry = {
id: string
name: string
organization: string
email: string
phone: string
exact: string
comparable: string
compact: string
tokens: string[]
}
type ContactMatchIndex = {
exact: Map<string, ContactMatchEntry[]>
byInitial: Map<string, ContactMatchEntry[]>
}
function buildContactNameMatchIndex(contacts: DbRow[]): ContactMatchIndex {
const exact = new Map<string, ContactMatchEntry[]>()
const byInitial = new Map<string, ContactMatchEntry[]>()
for (const contact of contacts) {
const name = normalizePersonName(`${contact.first_name || ""} ${contact.last_name || ""}`)
if (!name) continue
const comparable = personComparable(name)
const entry: ContactMatchEntry = {
id: contact.id,
name,
organization: clean(contact.organization),
email: clean(contact.email || contact.email_secondary),
phone: clean(contact.phone || contact.phone_secondary || contact.whatsapp),
exact: normKey(name),
comparable,
compact: comparable.replace(/\s+/g, ""),
tokens: comparable.split(" ").filter(Boolean),
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
function scorePersonName(input: string, candidate: ContactMatchEntry) {
const comparable = personComparable(input)
if (!comparable || !candidate.comparable) return 0
if (normKey(input) === candidate.exact) return 1
if (comparable === candidate.comparable) return 0.99
const compact = comparable.replace(/\s+/g, "")
let score = diceScore(comparable, candidate.comparable)
const inputTokens = comparable.split(" ").filter(Boolean)
const candidateTokens = candidate.tokens
const sameFirst = inputTokens[0] && inputTokens[0] === candidateTokens[0]
const sameLast = inputTokens.at(-1) && inputTokens.at(-1) === candidateTokens.at(-1)
const intersection = inputTokens.filter((token) => candidateTokens.includes(token)).length
const overlapRatio = intersection / Math.max(inputTokens.length, candidateTokens.length, 1)
if (sameFirst && sameLast && overlapRatio >= 0.5) score = Math.max(score, 0.93)
if (
compact &&
candidate.compact &&
(compact.includes(candidate.compact) || candidate.compact.includes(compact)) &&
Math.min(compact.length, candidate.compact.length) / Math.max(compact.length, candidate.compact.length) >= 0.72
) {
score = Math.max(score, 0.9)
}
return score
}
function findContactNameMatches(name: string, index: ContactMatchIndex): ContactMatchOption[] {
const exactMatches = index.exact.get(normKey(name)) || []
if (exactMatches.length > 0) {
return exactMatches
.slice(0, 5)
.map((entry) => ({
id: entry.id,
name: entry.name,
organization: entry.organization,
email: entry.email,
phone: entry.phone,
score: 1,
reason: "Mesmo nome" as const,
}))
}
const compact = personComparable(name).replace(/\s+/g, "")
if (!compact) return []
const candidates = index.byInitial.get(compact.slice(0, 1)) || []
return candidates
.filter((candidate) => {
const shortest = Math.min(compact.length, candidate.compact.length)
const longest = Math.max(compact.length, candidate.compact.length)
return longest === 0 || shortest / longest >= 0.58
})
.map((candidate) => ({
id: candidate.id,
name: candidate.name,
organization: candidate.organization,
email: candidate.email,
phone: candidate.phone,
score: Math.round(scorePersonName(name, candidate) * 100) / 100,
reason: "Nome semelhante" as const,
}))
.filter((candidate) => candidate.score >= 0.88)
.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "pt-BR"))
.slice(0, 5)
}
function normEmail(value: unknown): string {
return clean(value).toLowerCase()
}
function normPhone(value: unknown): string {
return clean(value).replace(/\D/g, "")
}
function splitList(value: unknown): string[] {
return clean(value)
.split(/[;,\n]+/)
.map((item) => item.trim())
.filter(Boolean)
}
function splitName(value: string): { firstName: string; lastName: string } {
const parts = normalizePersonName(value).split(" ").filter(Boolean)
return {
firstName: parts.shift() || "",
lastName: parts.join(" "),
}
}
function normalizeHeader(value: unknown): string {
return normKey(value)
}
function buildHeaderMap(row: unknown[]): Map<string, number> {
const map = new Map<string, number>()
row.forEach((value, index) => {
const key = normalizeHeader(value)
if (key) map.set(key, index)
})
return map
}
function findHeader(rows: unknown[][], kind: "contacts" | "organizations") {
for (let index = 0; index < Math.min(rows.length, 15); index += 1) {
const map = buildHeaderMap(rows[index] || [])
if (kind === "contacts" && map.has("nome") && (map.has("e mail") || map.has("empresa"))) {
return { index, map }
}
if (kind === "organizations" && map.has("empresa")) return { index, map }
}
return null
}
function getByAliases(row: unknown[], map: Map<string, number>, aliases: string[]): string {
for (const alias of aliases) {
const index = map.get(normKey(alias))
if (index !== undefined) return clean(row[index])
}
return ""
}
function sheetRows(
workbook: XLSX.WorkBook,
preferredName: string,
kind: "contacts" | "organizations",
allowFallback = true,
) {
const preferred = workbook.SheetNames.find((name) => normKey(name) === normKey(preferredName))
const sheetName = preferred || (allowFallback
? workbook.SheetNames.find((name) => {
const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
header: 1,
defval: null,
raw: false,
})
return Boolean(findHeader(rows, kind))
})
: undefined)
if (!sheetName) {
return { rows: [] as unknown[][], header: null as ReturnType<typeof findHeader> }
}
const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
header: 1,
defval: null,
raw: false,
})
return { rows, header: findHeader(rows, kind) }
}
function parseWorkbook(buffer: ArrayBuffer) {
const workbook = XLSX.read(buffer, { type: "array", cellDates: false })
const contactSheet = sheetRows(workbook, "01 - Contatos", "contacts")
if (!contactSheet.header) {
throw new Error("Não foi encontrada uma aba de contatos com as colunas esperadas.")
}
const contacts: ParsedContact[] = []
const dataRows = contactSheet.rows.slice(contactSheet.header.index + 1)
for (let offset = 0; offset < dataRows.length; offset += 1) {
if (contacts.length >= MAX_ROWS) {
throw new Error(`O arquivo excede o limite de ${MAX_ROWS} contatos.`)
}
const row = dataRows[offset]
const name = normalizePersonName(getByAliases(row, contactSheet.header.map, ["Nome"]))
const email = getByAliases(row, contactSheet.header.map, ["E-mail", "Email"])
const emailSecondary = getByAliases(row, contactSheet.header.map, ["E-mail secundário", "Email secundário"])
const phone = getByAliases(row, contactSheet.header.map, ["Telefone"])
const phoneSecondary = getByAliases(row, contactSheet.header.map, ["Telefone secundário"])
const company = getByAliases(row, contactSheet.header.map, ["Empresa", "Organização", "Company"])
const position = normalizeJobTitle(getByAliases(row, contactSheet.header.map, ["Cargo atual", "Cargo", "Position"]))
const sector = getByAliases(row, contactSheet.header.map, ["Setor"])
const subsector = getByAliases(row, contactSheet.header.map, ["Subsetor / área de atuação", "Subsetor", "Área de atuação"])
if (![name, email, emailSecondary, phone, phoneSecondary, company].some(Boolean)) continue
contacts.push({
rowKey: `row-${contactSheet.header.index + 2 + offset}`,
name,
company: company || undefined,
position: position || undefined,
email: email || undefined,
emailSecondary: emailSecondary || undefined,
phone: phone || undefined,
phoneSecondary: phoneSecondary || undefined,
sector: sector || undefined,
subsector: subsector || undefined,
})
}
const organizationSheet = sheetRows(workbook, "02 - Organizações", "organizations", false)
const organizations: ParsedOrganization[] = []
if (organizationSheet.header) {
for (const row of organizationSheet.rows.slice(organizationSheet.header.index + 1)) {
if (organizations.length >= MAX_ROWS) break
const name = getByAliases(row, organizationSheet.header.map, ["Empresa"])
if (!name) continue
organizations.push({
name,
sector: getByAliases(row, organizationSheet.header.map, ["Setor"]) || undefined,
subsector: getByAliases(row, organizationSheet.header.map, ["Subsetor / área de atuação", "Subsetor", "Área de atuação"]) || undefined,
phone: getByAliases(row, organizationSheet.header.map, ["Telefone"]) || undefined,
phoneSecondary: getByAliases(row, organizationSheet.header.map, ["Telefone secundário"]) || undefined,
emails: splitList(getByAliases(row, organizationSheet.header.map, ["E-mails funcionais", "Emails funcionais"])),
channelTypes: splitList(getByAliases(row, organizationSheet.header.map, ["Tipos de canal", "Tipo de canal"])),
})
}
}
return { contacts, organizations }
}
function buildContactIndexes(rows: DbRow[]) {
const email = new Map<string, string>()
const phone = new Map<string, string>()
const nameOrg = new Map<string, string>()
const nameOrgId = new Map<string, string>()
for (const row of rows) {
for (const value of [row.email, row.email_secondary]) {
const key = normEmail(value)
if (key) email.set(key, row.id)
}
for (const value of [row.phone, row.phone_secondary, row.whatsapp]) {
const key = normPhone(value)
if (key.length >= 8) phone.set(key, row.id)
}
const person = normKey(`${row.first_name || ""} ${row.last_name || ""}`)
const org = normKey(row.organization)
if (person) {
nameOrg.set(`${person}|${org}`, row.id)
if (row.organization_id) nameOrgId.set(`${person}|${row.organization_id}`, row.id)
}
}
return { email, phone, nameOrg, nameOrgId }
}
function buildAmbiguousPhones(contacts: ParsedContact[]) {
const counts = new Map<string, number>()
for (const contact of contacts) {
const values = new Set(
[contact.phone, contact.phoneSecondary]
.map(normPhone)
.filter((value) => value.length >= 8),
)
for (const value of values) counts.set(value, (counts.get(value) || 0) + 1)
}
return new Set(
[...counts.entries()]
.filter(([, count]) => count > 1)
.map(([phone]) => phone),
)
}
function channelCandidateIds(
contact: ParsedContact,
indexes: ReturnType<typeof buildContactIndexes>,
ambiguousPhones: Set<string>,
) {
const ids = new Set<string>()
const emails = [contact.email, contact.emailSecondary].map(normEmail).filter(Boolean)
if (emails.length > 0) {
for (const key of emails) {
const id = indexes.email.get(key)
if (id) ids.add(id)
}
return ids
}
for (const value of [contact.phone, contact.phoneSecondary]) {
const key = normPhone(value)
if (key.length < 8 || ambiguousPhones.has(key)) continue
const id = indexes.phone.get(key)
if (id) ids.add(id)
}
return ids
}
function candidateIds(
contact: ParsedContact,
indexes: ReturnType<typeof buildContactIndexes>,
ambiguousPhones: Set<string>,
organizationId?: string,
) {
const ids = channelCandidateIds(contact, indexes, ambiguousPhones)
if (ids.size > 0) return ids
const person = normKey(contact.name)
if (organizationId) {
const id = indexes.nameOrgId.get(`${person}|${organizationId}`)
if (id) ids.add(id)
}
if (ids.size === 0) {
const id = indexes.nameOrg.get(`${person}|${normKey(contact.company)}`)
if (id) ids.add(id)
}
return ids
}
function writableContact(row: DbRow): DbRow {
return {
id: row.id,
first_name: row.first_name || "",
last_name: row.last_name || "",
email: row.email || null,
email_secondary: row.email_secondary || null,
whatsapp: row.whatsapp || null,
phone: row.phone || null,
phone_secondary: row.phone_secondary || null,
organization: row.organization || null,
organization_id: row.organization_id || null,
position: row.position || null,
seniority: row.seniority || null,
linkedin: row.linkedin || null,
city: row.city || null,
state: row.state || null,
country: row.country || null,
relationship_type: row.relationship_type || null,
origin: row.origin || null,
communication_status: row.communication_status || "active",
incomplete_profile: Boolean(row.incomplete_profile),
tags: row.tags || [],
notes: row.notes || null,
last_interaction: row.last_interaction || null,
created_by: row.created_by || null,
}
}
function incomingContact(
contact: ParsedContact,
organizationId: string | undefined,
organizationName: string | undefined,
userId: string,
): DbRow {
const { firstName, lastName } = splitName(contact.name)
const primaryEmail = contact.email || contact.emailSecondary || ""
const secondaryEmail = contact.email ? contact.emailSecondary || "" : ""
const primaryPhone = contact.phone || contact.phoneSecondary || ""
const secondaryPhone = contact.phone ? contact.phoneSecondary || "" : ""
return {
first_name: firstName,
last_name: lastName,
email: primaryEmail ? normEmail(primaryEmail) : null,
email_secondary: secondaryEmail ? normEmail(secondaryEmail) : null,
phone: primaryPhone || null,
phone_secondary: secondaryPhone || null,
organization: organizationName || contact.company || null,
organization_id: organizationId || null,
position: contact.position || null,
origin: "mailing",
communication_status: "active",
incomplete_profile: !primaryEmail && !primaryPhone,
created_by: userId,
}
}
function mergeContact(current: DbRow, incoming: DbRow, mode: "fill_missing" | "overwrite") {
const result = { ...current }
if (incoming.organization_id && !result.organization_id) {
result.organization_id = incoming.organization_id
if (incoming.organization) result.organization = incoming.organization
}
for (const [key, value] of Object.entries(incoming)) {
if (key === "created_by") {
if (!result.created_by && value) result.created_by = value
continue
}
const incomingPresent = value !== null && value !== undefined && value !== ""
if (!incomingPresent) continue
if (mode === "overwrite") result[key] = value
else if (result[key] === null || result[key] === undefined || result[key] === "") {
result[key] = value
}
}
result.incomplete_profile = !(
result.email || result.email_secondary || result.phone || result.phone_secondary || result.whatsapp
)
return result
}
function indexContact(row: DbRow, indexes: ReturnType<typeof buildContactIndexes>) {
for (const value of [row.email, row.email_secondary]) {
const key = normEmail(value)
if (key) indexes.email.set(key, row.id)
}
for (const value of [row.phone, row.phone_secondary, row.whatsapp]) {
const key = normPhone(value)
if (key.length >= 8) indexes.phone.set(key, row.id)
}
const person = normKey(`${row.first_name || ""} ${row.last_name || ""}`)
if (person) {
indexes.nameOrg.set(`${person}|${normKey(row.organization)}`, row.id)
if (row.organization_id) indexes.nameOrgId.set(`${person}|${row.organization_id}`, row.id)
}
}
async function inBatches<T>(items: T[], callback: (batch: T[]) => Promise<void>) {
for (let index = 0; index < items.length; index += BATCH_SIZE) {
await callback(items.slice(index, index + BATCH_SIZE))
}
}
Deno.serve(async (req: Request) => {
if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)
try {
const authHeader = req.headers.get("Authorization")
if (!authHeader) return json({ error: "Não autorizado." }, 401)
const url = Deno.env.get("SUPABASE_URL")!
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const admin = createClient(url, serviceKey, {
auth: { persistSession: false, autoRefreshToken: false },
})
const token = authHeader.replace(/^Bearer\s+/i, "")
const { data: userData, error: userError } = await admin.auth.getUser(token)
if (userError || !userData.user) return json({ error: "Sessão inválida." }, 401)
const userId = userData.user.id
const { data: profile, error: profileError } = await admin
.from("profiles")
.select("role,active")
.eq("id", userId)
.single()
if (profileError || !profile?.active) return json({ error: "Usuário inativo." }, 403)
if (profile.role !== "admin") {
return json({ error: "Apenas administradores podem importar contatos." }, 403)
}
const form = await req.formData()
const action = clean(form.get("action")) || "preview"
const mergeMode = clean(form.get("mergeMode")) === "overwrite" ? "overwrite" : "fill_missing"
const file = form.get("file")
let organizationResolutions: Record<string, OrganizationResolution> = {}
const organizationResolutionsRaw = form.get("organizationResolutions")
if (typeof organizationResolutionsRaw === "string" && organizationResolutionsRaw) {
try {
organizationResolutions = JSON.parse(organizationResolutionsRaw)
} catch {
return json({ error: "As decisões sobre organizações são inválidas." }, 400)
}
}
let contactResolutions: Record<string, ContactResolution> = {}
const contactResolutionsRaw = form.get("contactResolutions")
if (typeof contactResolutionsRaw === "string" && contactResolutionsRaw) {
try {
contactResolutions = JSON.parse(contactResolutionsRaw)
} catch {
return json({ error: "As decisões sobre contatos são inválidas." }, 400)
}
}
if (!(file instanceof File)) return json({ error: "Selecione um arquivo XLSX." }, 400)
if (file.size <= 0) return json({ error: "O arquivo está vazio." }, 400)
if (file.size > MAX_FILE_BYTES) return json({ error: "O arquivo excede o limite de 20 MB." }, 400)
if (!/\.(xlsx|xls)$/i.test(file.name)) return json({ error: "Formato inválido. Use XLSX ou XLS." }, 400)
const parsed = parseWorkbook(await file.arrayBuffer())
if (parsed.contacts.length === 0) {
return json({ error: "Nenhum contato foi encontrado no arquivo." }, 400)
}
const ambiguousPhones = buildAmbiguousPhones(parsed.contacts)
const [contactsResult, organizationsResult, segmentsResult, subsegmentsResult] = await Promise.all([
admin.from("contacts").select("*"),
admin.from("organizations").select("*"),
admin.from("segments").select("id,name,active"),
admin.from("subsegments").select("id,segment_id,name,active"),
])
for (const result of [contactsResult, organizationsResult, segmentsResult, subsegmentsResult]) {
if (result.error) throw new Error(result.error.message)
}
const existingContacts = contactsResult.data || []
const existingOrganizations = organizationsResult.data || []
const segments = segmentsResult.data || []
const subsegments = subsegmentsResult.data || []
const organizationsById = new Map(existingOrganizations.map((organization) => [organization.id, organization]))
const organizationMatchIndex = buildOrganizationMatchIndex(existingOrganizations)
const contactNameMatchIndex = buildContactNameMatchIndex(existingContacts)
const contactIndexes = buildContactIndexes(existingContacts)
const desiredOrganizations = new Map<string, ParsedOrganization>()
for (const organization of parsed.organizations) {
const key = normKey(organization.name)
if (key && !desiredOrganizations.has(key)) desiredOrganizations.set(key, organization)
}
for (const contact of parsed.contacts) {
if (!contact.company) continue
const key = normKey(contact.company)
if (key && !desiredOrganizations.has(key)) {
desiredOrganizations.set(key, {
name: contact.company,
sector: contact.sector,
subsector: contact.subsector,
emails: [],
channelTypes: [],
})
}
}
const organizationContactCounts = new Map<string, number>()
for (const contact of parsed.contacts) {
if (!contact.company) continue
const key = normKey(contact.company)
organizationContactCounts.set(key, (organizationContactCounts.get(key) || 0) + 1)
}
const organizationMatches = new Map<string, OrganizationMatchOption[]>()
let exactOrganizationMatches = 0
let similarOrganizationMatches = 0
for (const [incomingKey, organization] of desiredOrganizations) {
const options = findOrganizationMatches(organization.name, organizationMatchIndex)
if (options.length === 0) continue
organizationMatches.set(incomingKey, options)
if (options[0].reason === "Mesmo nome") exactOrganizationMatches += 1
else similarOrganizationMatches += 1
}
const contactMatches = new Map<string, ContactMatchOption[]>()
let exactNameMatches = 0
let similarNameMatches = 0
let deterministicMatches = 0
let conflicts = 0
for (const contact of parsed.contacts) {
const channelIds = channelCandidateIds(contact, contactIndexes, ambiguousPhones)
if (channelIds.size === 1) {
deterministicMatches += 1
continue
}
if (channelIds.size > 1) {
conflicts += 1
continue
}
const options = findContactNameMatches(contact.name, contactNameMatchIndex)
if (options.length === 0) continue
contactMatches.set(contact.rowKey, options)
if (options[0].reason === "Mesmo nome") exactNameMatches += 1
else similarNameMatches += 1
}
const segmentMap = new Map<string, DbRow>()
for (const segment of segments) {
if (segment.active) segmentMap.set(normKey(segment.name), segment)
}
const existingSubsegmentMap = new Map<string, DbRow>()
for (const subsegment of subsegments) {
existingSubsegmentMap.set(`${subsegment.segment_id}|${normKey(subsegment.name)}`, subsegment)
}
const unknownSectors = new Set<string>()
const desiredSubsegments = new Map<string, { segmentId: string; name: string }>()
for (const row of [...parsed.contacts, ...parsed.organizations]) {
if (!row.sector) continue
const segment = segmentMap.get(normKey(row.sector))
if (!segment) {
unknownSectors.add(row.sector)
continue
}
if (row.subsector) {
const key = `${segment.id}|${normKey(row.subsector)}`
if (!existingSubsegmentMap.has(key) && !desiredSubsegments.has(key)) {
desiredSubsegments.set(key, { segmentId: segment.id, name: row.subsector })
}
}
}
const previewRows = parsed.contacts.slice(0, 12).map((contact) => {
const channelIds = channelCandidateIds(contact, contactIndexes, ambiguousPhones)
const needsReview = contactMatches.has(contact.rowKey)
return {
rowKey: contact.rowKey,
name: contact.name || "Sem nome",
organization: contact.company || "",
position: contact.position || "",
email: contact.email || contact.emailSecondary || "",
phone: contact.phone || contact.phoneSecondary || "",
sector: contact.sector || "",
subsector: contact.subsector || "",
status: channelIds.size > 1
? "Conflito"
: channelIds.size === 1
? "Existente"
: needsReview
? "Revisar"
: "Novo",
}
})
if (action === "preview") {
const organizationMatchesForReview = [...organizationMatches.entries()].map(([incomingKey, options]) => {
const organization = desiredOrganizations.get(incomingKey)!
return {
organizationKey: organizationResolutionKey(organization.name),
name: organization.name,
contactsCount: organizationContactCounts.get(incomingKey) || 0,
options,
}
})
const contactMatchesForReview = parsed.contacts
.filter((contact) => contactMatches.has(contact.rowKey))
.map((contact) => ({
rowKey: contact.rowKey,
name: contact.name,
organization: contact.company || "",
email: contact.email || contact.emailSecondary || "",
phone: contact.phone || contact.phoneSecondary || "",
options: contactMatches.get(contact.rowKey) || [],
}))
return json({
fileName: file.name,
fileSize: file.size,
contacts: parsed.contacts.length,
organizations: desiredOrganizations.size,
contactsWithEmail: parsed.contacts.filter((item) => item.email || item.emailSecondary).length,
contactsWithoutEmail: parsed.contacts.filter((item) => !item.email && !item.emailSecondary).length,
existingMatches: deterministicMatches,
conflicts,
estimatedNewContacts: Math.max(
0,
parsed.contacts.length - deterministicMatches - conflicts - contactMatches.size,
),
newOrganizations: desiredOrganizations.size - organizationMatches.size,
organizationsWithoutMatches: desiredOrganizations.size - organizationMatches.size,
exactOrganizationMatches,
similarOrganizationMatches,
exactNameMatches,
similarNameMatches,
newSubsegments: desiredSubsegments.size,
ambiguousPhones: ambiguousPhones.size,
unknownSectors: [...unknownSectors].sort(),
organizationMatches: organizationMatchesForReview,
contactMatches: contactMatchesForReview,
preview: previewRows,
expectedContactColumns: [
"Nome",
"Empresa",
"Cargo atual",
"E-mail",
"E-mail secundário",
"Telefone",
"Telefone secundário",
],
})
}
if (action !== "import") return json({ error: "Ação inválida." }, 400)
const resolvedOrganizations = new Map<string, DbRow>()
const organizationsToCreate = new Set<string>()
let organizationsMerged = 0
for (const [incomingKey, organization] of desiredOrganizations) {
const options = organizationMatches.get(incomingKey) || []
if (options.length === 0) {
organizationsToCreate.add(incomingKey)
continue
}
const resolution = organizationResolutions[organizationResolutionKey(organization.name)]
if (!resolution) {
return json({ error: `Revise a organização “${organization.name}” antes de importar.` }, 400)
}
if (resolution.action === "create") {
organizationsToCreate.add(incomingKey)
continue
}
const allowed = options.some((option) => option.id === resolution.organizationId)
const selected = organizationsById.get(resolution.organizationId)
if (!allowed || !selected) {
return json({ error: `A organização selecionada para “${organization.name}” não é uma correspondência válida.` }, 400)
}
resolvedOrganizations.set(incomingKey, selected)
organizationsMerged += 1
}
for (const contact of parsed.contacts) {
const options = contactMatches.get(contact.rowKey) || []
if (options.length === 0) continue
const resolution = contactResolutions[contact.rowKey]
if (!resolution) {
return json({ error: `Revise o contato “${contact.name}” antes de importar.` }, 400)
}
if (resolution.action === "merge" && !options.some((option) => option.id === resolution.contactId)) {
return json({ error: `O contato selecionado para “${contact.name}” não é uma correspondência válida.` }, 400)
}
}
const missingOrganizations = [...organizationsToCreate].map((incomingKey) => {
const organization = desiredOrganizations.get(incomingKey)!
return {
name: organization.name,
type: "outro",
sector: organization.sector || null,
subsector: organization.subsector || null,
phone: organization.phone || null,
phone_secondary: organization.phoneSecondary || null,
emails: organization.emails,
channel_types: organization.channelTypes,
}
})
const createdOrganizations: DbRow[] = []
await inBatches(missingOrganizations, async (batch) => {
const { data, error } = await admin.from("organizations").insert(batch).select("*")
if (error) throw new Error(`Falha ao criar organizações: ${error.message}`)
createdOrganizations.push(...(data || []))
})
for (const organization of createdOrganizations) {
resolvedOrganizations.set(normKey(organization.name), organization)
}
const missingSubsegments = [...desiredSubsegments.values()].map((item) => ({
segment_id: item.segmentId,
name: item.name,
active: true,
sort_order: 0,
}))
const createdSubsegments: DbRow[] = []
await inBatches(missingSubsegments, async (batch) => {
const { data, error } = await admin.from("subsegments").insert(batch).select("*")
if (error) throw new Error(`Falha ao criar subsetores: ${error.message}`)
createdSubsegments.push(...(data || []))
})
for (const subsegment of createdSubsegments) {
existingSubsegmentMap.set(`${subsegment.segment_id}|${normKey(subsegment.name)}`, subsegment)
}
const byId = new Map(existingContacts.map((row) => [row.id, row]))
const existingIds = new Set(existingContacts.map((row) => row.id))
const planningIndexes = buildContactIndexes(existingContacts)
const planned = new Map<string, DbRow>()
const createdIds = new Set<string>()
const updatedIds = new Set<string>()
const desiredLinks = new Map<string, { contact_id: string; segment_id: string; subsegment_id: string | null }>()
let skipped = 0
let importConflicts = 0
let contactsMergedByReview = 0
for (const contact of parsed.contacts) {
if (!contact.name) {
skipped += 1
continue
}
const organization = contact.company ? resolvedOrganizations.get(normKey(contact.company)) : undefined
const effectiveContact = organization ? { ...contact, company: organization.name } : contact
const channelIds = channelCandidateIds(effectiveContact, planningIndexes, ambiguousPhones)
if (channelIds.size > 1) {
importConflicts += 1
continue
}
let id = [...channelIds][0]
const reviewOptions = contactMatches.get(contact.rowKey) || []
const reviewResolution = reviewOptions.length > 0 ? contactResolutions[contact.rowKey] : undefined
if (!id && reviewResolution?.action === "merge") {
id = reviewResolution.contactId
contactsMergedByReview += 1
}
let base: DbRow
let isNew = false
if (!id) {
id = crypto.randomUUID()
isNew = true
base = writableContact({
id,
communication_status: "active",
tags: [],
created_by: userId,
})
} else {
base = planned.get(id) || writableContact(byId.get(id) || { id })
}
const incoming = incomingContact(effectiveContact, organization?.id, organization?.name, userId)
const before = JSON.stringify(base)
const merged = mergeContact(base, incoming, mergeMode)
merged.id = id
planned.set(id, merged)
indexContact(merged, planningIndexes)
if (isNew && !existingIds.has(id)) createdIds.add(id)
else if (before !== JSON.stringify(merged)) updatedIds.add(id)
if (contact.sector) {
const segment = segmentMap.get(normKey(contact.sector))
if (segment) {
const subsegment = contact.subsector
? existingSubsegmentMap.get(`${segment.id}|${normKey(contact.subsector)}`)
: undefined
const link = {
contact_id: id,
segment_id: segment.id,
subsegment_id: subsegment?.id || null,
}
desiredLinks.set(`${id}|${segment.id}|${subsegment?.id || ""}`, link)
}
}
}
const upserts = [...planned.values()].filter(
(row) => createdIds.has(row.id) || updatedIds.has(row.id),
)
await inBatches(upserts, async (batch) => {
const { error } = await admin.from("contacts").upsert(batch, { onConflict: "id" })
if (error) throw new Error(`Falha ao salvar contatos: ${error.message}`)
})
const links = [...desiredLinks.values()]
await inBatches(links, async (batch) => {
const { error } = await admin.from("contact_segmentations").upsert(batch, {
onConflict: "contact_id,segment_id,subsegment_id",
ignoreDuplicates: true,
})
if (error) throw new Error(`Falha ao vincular segmentações: ${error.message}`)
})
const summary = {
contactsInFile: parsed.contacts.length,
organizationsInFile: desiredOrganizations.size,
contactsCreated: createdIds.size,
contactsUpdated: updatedIds.size,
organizationsCreated: createdOrganizations.length,
organizationsMerged,
contactsMergedByReview,
subsegmentsCreated: createdSubsegments.length,
skipped,
conflicts: importConflicts,
segmentationLinks: links.length,
ambiguousPhones: ambiguousPhones.size,
unknownSectors: [...unknownSectors].sort(),
mergeMode,
}
const { data: run, error: runError } = await admin
.from("contact_import_runs")
.insert({
file_name: file.name,
contacts_created: createdIds.size,
contacts_updated: updatedIds.size,
organizations_created: createdOrganizations.length,
subsegments_created: createdSubsegments.length,
skipped,
conflicts: importConflicts,
merge_mode: mergeMode,
summary,
created_by: userId,
})
.select("id,created_at")
.single()
if (runError) {
throw new Error(`Importação concluída, mas o histórico não foi salvo: ${runError.message}`)
}
return json({
success: true,
runId: run.id,
createdAt: run.created_at,
...summary,
})
} catch (error) {
console.error(error)
return json({
error: error instanceof Error ? error.message : "Falha inesperada na importação.",
}, 400)
}
})
