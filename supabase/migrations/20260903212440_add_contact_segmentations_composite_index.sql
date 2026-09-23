create index if not exists contact_segmentations_segment_subsegment_idx
  on public.contact_segmentations (segment_id, subsegment_id);
