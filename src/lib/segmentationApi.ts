import { supabase } from "@/lib/supabase"
import type { Segment, Subsegment } from "@/lib/types"

type DatabaseRow = Record<string, any>

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

function mapSegment(row: DatabaseRow): Segment {
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    type: row.segment_type === "secondary" ? "secondary" : "priority",
    color: row.color,
    active: row.active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapSubsegment(row: DatabaseRow): Subsegment {
  return {
    id: row.id,
    segmentId: row.segment_id,
    name: row.name,
    active: row.active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function updateSegment(
  segment: Segment,
  patch: Pick<Segment, "name" | "description" | "color">,
): Promise<Segment> {
  const { data, error } = await supabase.rpc("update_segment_admin", {
    p_segment_id: segment.id,
    p_name: patch.name.trim(),
    p_description: patch.description?.trim() || null,
    p_color: patch.color,
  })

  throwIfError(error)
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error("O servidor não confirmou a atualização do setor.")
  return mapSegment(row)
}

export async function deleteSegment(segmentId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_segment_admin", {
    p_segment_id: segmentId,
  })
  throwIfError(error)
}

export async function updateSubsegment(
  subsegmentId: string,
  name: string,
): Promise<Subsegment> {
  const { data, error } = await supabase.rpc("update_subsegment_admin", {
    p_subsegment_id: subsegmentId,
    p_name: name.trim(),
  })

  throwIfError(error)
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error("O servidor não confirmou a atualização do subsetor.")
  return mapSubsegment(row)
}

export async function deleteSubsegment(subsegmentId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_subsegment_admin", {
    p_subsegment_id: subsegmentId,
  })
  throwIfError(error)
}
