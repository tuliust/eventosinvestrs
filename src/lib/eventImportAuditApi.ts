import { supabase } from "@/lib/supabase"

export interface EventImportRunInput {
  eventId: string
  source?: "luma" | "generic"
  fileName: string
  columns: string[]
  mapping: Array<{ source: string; target: string; isCustom: boolean }>
  total: number
  safe: number
  possible: number
  newCount: number
  ignored: number
  errors: number
  imported: number
  createdBy: string
}

export async function recordEventImportRun(input: EventImportRunInput): Promise<void> {
  const { error } = await supabase.from("event_import_runs").insert({
    event_id: input.eventId,
    source: input.source || "luma",
    file_name: input.fileName,
    columns: input.columns,
    mapping: input.mapping,
    total_count: input.total,
    safe_count: input.safe,
    possible_count: input.possible,
    new_count: input.newCount,
    ignored_count: input.ignored,
    error_count: input.errors,
    imported_count: input.imported,
    created_by: input.createdBy,
  })

  if (error) throw new Error(error.message)
}
