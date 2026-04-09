-- Publieke renderer: anonieme reads alleen voor actieve sites (RLS).

create policy "clients_select_anon_active"
  on public.clients
  for select
  to anon
  using (status = 'active');
