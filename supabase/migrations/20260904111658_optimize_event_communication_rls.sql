drop policy if exists event_communications_admin_insert on public.event_communications;
create policy event_communications_admin_insert
on public.event_communications for insert
to authenticated
with check (
  public.current_user_role() = 'admin'
  and created_by = (select auth.uid())
);
