create or replace function private.audit_event_import_run()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    new.created_by,
    'event_import.completed',
    'event_import_run',
    new.id::text,
    jsonb_build_object(
      'event_id', new.event_id,
      'source', new.source,
      'file_name', new.file_name,
      'columns', new.columns,
      'mapping', new.mapping,
      'total', new.total_count,
      'safe', new.safe_count,
      'possible', new.possible_count,
      'new', new.new_count,
      'ignored', new.ignored_count,
      'errors', new.error_count,
      'imported', new.imported_count
    )
  );
  return new;
end;
$$;

drop trigger if exists audit_event_import_runs_after_insert on public.event_import_runs;
create trigger audit_event_import_runs_after_insert
after insert on public.event_import_runs
for each row execute function private.audit_event_import_run();
