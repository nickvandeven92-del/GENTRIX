-- Verwijderen van kennisregels: zelfde kring als insert/update (ingelogde Studio-gebruikers).
drop policy if exists "ai_knowledge_delete_super_admin" on public.ai_knowledge;

create policy "ai_knowledge_delete_authenticated"
  on public.ai_knowledge for delete to authenticated
  using (true);
