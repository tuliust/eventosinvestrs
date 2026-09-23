import { FunctionsHttpError } from "@supabase/supabase-js"
import { supabase } from "./supabase"

export type OrganizationImportMergeMode = "fill_missing" | "overwrite"

export type OrganizationImportMatchOption = {
  id: string
  name: string
  score: number
  reason: "Mesmo nome" | "Nome semelhante"
}

export type OrganizationImportMatch = {
  rowKey: string
  name: string
  taxId: string
  options: OrganizationImportMatchOption[]
}

export type OrganizationImportResolution =
  | { action: "merge"; organizationId: string; preserveName?: boolean }
  | { action: "create" }

export type OrganizationImportPreviewRow = {
  rowKey: string
  name: string
  taxId: string
  sector: string
  subsector: string
  type: string
  status: "Nova" | "Revisar"
}

export type OrganizationImportPreview = {
  fileName: string
  fileSize: number
  organizations: number
  withoutMatches: number
  exactMatches: number
  similarMatches: number
  unknownSectors: string[]
  matches: OrganizationImportMatch[]
  preview: OrganizationImportPreviewRow[]
  expectedColumns: string[]
}

export type OrganizationImportResult = {
  success: true
  organizationsInFile: number
  created: number
  updated: number
  unknownSectors: string[]
  mergeMode: OrganizationImportMergeMode
}

async function invoke<T>(
  file: File,
  action: "preview" | "import",
  mergeMode: OrganizationImportMergeMode,
  resolutions?: Record<string, OrganizationImportResolution>,
): Promise<T> {
  const form = new FormData()
  form.append("file", file)
  form.append("action", action)
  form.append("mergeMode", mergeMode)
  if (resolutions) form.append("resolutions", JSON.stringify(resolutions))

  const { data, error } = await supabase.functions.invoke("import-organizations-v2", { body: form })
  if (error) {
    let detail = ""
    let status = 0
    if (error instanceof FunctionsHttpError) {
      status = error.context.status
      try {
        const body = await error.context.json()
        detail = body?.error || ""
      } catch {
        // Respostas do runtime (por exemplo, limite de execução) podem não ser JSON.
      }
    }
    if (!detail && status === 546) {
      detail = "O processamento da planilha foi interrompido pelo servidor. Tente novamente; se persistir, selecione o arquivo novamente."
    }
    throw new Error(detail || error.message)
  }
  if (data?.error) throw new Error(data.error)
  return data as T
}

export function previewOrganizationImport(file: File, mergeMode: OrganizationImportMergeMode) {
  return invoke<OrganizationImportPreview>(file, "preview", mergeMode)
}

export function importOrganizationsFile(
  file: File,
  mergeMode: OrganizationImportMergeMode,
  resolutions: Record<string, OrganizationImportResolution>,
) {
  return invoke<OrganizationImportResult>(file, "import", mergeMode, resolutions)
}
