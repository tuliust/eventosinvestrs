update public.segments
set icon_path = replace(icon_path, '.png', '.svg')
where segment_type = 'priority'
  and icon_path like '/sector-icons/%.png';
