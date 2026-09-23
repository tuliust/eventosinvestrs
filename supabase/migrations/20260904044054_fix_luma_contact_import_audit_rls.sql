alter function public.import_luma_contacts_admin(text) security definer;
alter function public.import_luma_contacts_admin(text) set search_path = 'public', 'pg_temp';

revoke all on function public.import_luma_contacts_admin(text) from public;
revoke all on function public.import_luma_contacts_admin(text) from anon;
grant execute on function public.import_luma_contacts_admin(text) to authenticated;
