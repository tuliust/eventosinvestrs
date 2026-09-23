import { FunctionsHttpError } from "@supabase/supabase-js"
import { supabase } from "./supabase"

export type ContactImportMergeMode = "fill_missing" | "overwrite"

export type ContactImportPreviewRow = {
  rowKey: string
  name: string
  organization: string
  position: string
  email: string
  phone: string
  sector: string
  subsector: string
  status: "Novo" | "Existente" | "Conflito" | "Revisar"
}

export type ContactImportMatchOption = {
  id: string
  name: string
  organization: string
  email: string
  phone: string
  score: number
  reason: "Mesmo nome" | "Nome semelhante"
}

export type ContactImportMatch = {
  rowKey: string
  name: string
  organization: string
  email: string
  phone: string
  options: ContactImportMatchOption[]
}

export type ContactImportResolution =
  | { action: "merge"; contactId: string }
  | { action: "create" }

export type ContactImportOrganizationMatchOption = {
  id: string
  name: string
  score: number
  reason: "Mesmo nome" | "Nome semelhante"
}

export type ContactImportOrganizationMatch = {
  organizationKey: string
  name: string
  contactsCount: number
  options: ContactImportOrganizationMatchOption[]
}

export type ContactImportOrganizationResolution =
  | { action: "merge"; organizationId: string }
  | { action: "create" }

export type ContactImportPreview = {
  fileName: string
  fileSize: number
  contacts: number
  organizations: number
  contactsWithEmail: number
  contactsWithoutEmail: number
  existingMatches: number
  conflicts: number
  estimatedNewContacts: number
  newOrganizations: number
  organizationsWithoutMatches: number
  exactOrganizationMatches: number
  similarOrganizationMatches: number
  exactNameMatches: number
  similarNameMatches: number
  newSubsegments: number
  unknownSectors: string[]
  organizationMatches: ContactImportOrganizationMatch[]
  contactMatches: ContactImportMatch[]
  preview: ContactImportPreviewRow[]
  expectedContactColumns: string[]
}

export type ContactImportResult = {
  success: true
  runId: string
  createdAt: string
  contactsInFile: number
  organizationsInFile: number
  contactsCreated: number
  contactsUpdated: number
  organizationsCreated: number
  organizationsMerged: number
  contactsMergedByReview: number
  subsegmentsCreated: number
  skipped: number
  conflicts: number
  segmentationLinks: number
  unknownSectors: string[]
  mergeMode: ContactImportMergeMode
}

async function invokeImport<T>(
  file: File,
  action: "preview" | "import",
  mergeMode: ContactImportMergeMode,
  organizationResolutions?: Record<string, ContactImportOrganizationResolution>,
  contactResolutions?: Record<string, ContactImportResolution>,
): Promise<T> {
  const form = new FormData()
  form.append("file", file)
  form.append("action", action)
  form.append("mergeMode", mergeMode)
  if (organizationResolutions) {
    form.append("organizationResolutions", JSON.stringify(organizationResolutions))
  }
  if (contactResolutions) {
    form.append("contactResolutions", JSON.stringify(contactResolutions))
  }

  const { data, error } = await supabase.functions.invoke("import-contacts", {
    body: form,
  })

  if (error) {
    let detail = ""
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json()
        detail = body?.error || ""
      } catch {
        // Mantém a mensagem padrão do SDK quando a resposta não é JSON.
      }
    }
    throw new Error(detail || error.message)
  }

  if (data?.error) throw new Error(data.error)
  return data as T
}

export function previewContactImport(
  file: File,
  mergeMode: ContactImportMergeMode,
) {
  return invokeImport<ContactImportPreview>(file, "preview", mergeMode)
}

export function importContactsFile(
  file: File,
  mergeMode: ContactImportMergeMode,
  organizationResolutions: Record<string, ContactImportOrganizationResolution>,
  contactResolutions: Record<string, ContactImportResolution>,
) {
  return invokeImport<ContactImportResult>(
    file,
    "import",
    mergeMode,
    organizationResolutions,
    contactResolutions,
  )
}
