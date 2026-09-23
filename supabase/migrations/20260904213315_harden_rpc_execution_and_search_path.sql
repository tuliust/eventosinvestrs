-- Reduz a superfície executável dos RPCs e elimina resolução de objetos por search_path mutável.

alter default privileges for role postgres in schema public
  revoke execute on functions from public;

revoke execute on function public.record_event_communication(
  text,text,text,text,text,timestamptz,text,text,text,text,boolean,jsonb,jsonb
) from public, anon;

grant execute on function public.record_event_communication(
  text,text,text,text,text,timestamptz,text,text,text,text,boolean,jsonb,jsonb
) to authenticated;

revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.is_active_staff() from public, anon;
revoke execute on function public.add_event_confirmation(text,text,text,text,text,text,text) from public, anon;
revoke execute on function public.check_in_event(uuid,text,text,text,text,text,text,text) from public, anon;
revoke execute on function public.check_in_event_idempotent(uuid,text,text,text,text,text,text,text,text,boolean) from public, anon;
revoke execute on function public.undo_event_checkin(text,uuid) from public, anon;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_active_staff() to authenticated;
grant execute on function public.add_event_confirmation(text,text,text,text,text,text,text) to authenticated;
grant execute on function public.check_in_event(uuid,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.check_in_event_idempotent(uuid,text,text,text,text,text,text,text,text,boolean) to authenticated;
grant execute on function public.undo_event_checkin(text,uuid) to authenticated;

alter function public.current_user_role() set search_path to '';
alter function public.is_active_staff() set search_path to '';
alter function public.add_event_confirmation(text,text,text,text,text,text,text) set search_path to '';
alter function public.check_in_event(uuid,text,text,text,text,text,text,text) set search_path to '';
alter function public.check_in_event_idempotent(uuid,text,text,text,text,text,text,text,text,boolean) set search_path to '';
alter function public.undo_event_checkin(text,uuid) set search_path to '';
