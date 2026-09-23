create or replace function public.delete_all_contacts_admin(p_actor_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*)::integer into v_count from public.contacts;

  update public.event_invites
     set contact_id = null,
         updated_at = now()
   where contact_id is not null;

  update public.event_registrations
     set contact_id = null,
         updated_at = now()
   where contact_id is not null;

  update public.event_attendances
     set contact_id = null,
         updated_at = now()
   where contact_id is not null;

  delete from public.contacts;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    p_actor_id,
    'contacts.deleted_all',
    'contacts',
    'all',
    jsonb_build_object('deleted_count', v_count)
  );

  return v_count;
end;
$$;

revoke all on function public.delete_all_contacts_admin(uuid) from public;
revoke all on function public.delete_all_contacts_admin(uuid) from anon;
revoke all on function public.delete_all_contacts_admin(uuid) from authenticated;
grant execute on function public.delete_all_contacts_admin(uuid) to service_role;
