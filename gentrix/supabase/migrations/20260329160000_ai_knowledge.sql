-- Kerninstructies / geleerde lessen voor AI (admin + generate-site).
-- RLS: alleen authenticated; DELETE alleen met JWT user_metadata.role = 'super_admin'
-- Zet super_admin in Supabase → Authentication → Users → [user] → Raw User Meta Data: {"role":"super_admin"}

create table public.ai_knowledge (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  body text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_knowledge_category_check check (
    category in (
      'Design Regels',
      'Copywriting',
      'Security',
      'Klant-specifiek',
      'Overig'
    )
  ),
  constraint ai_knowledge_title_len check (char_length(title) between 1 and 200),
  constraint ai_knowledge_body_len check (char_length(body) between 1 and 32000)
);

create index ai_knowledge_category_sort_idx on public.ai_knowledge (category, sort_order);
create index ai_knowledge_active_idx on public.ai_knowledge (is_active) where is_active = true;

create or replace function public.set_ai_knowledge_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger ai_knowledge_set_updated_at
  before update on public.ai_knowledge
  for each row
  execute function public.set_ai_knowledge_updated_at();

alter table public.ai_knowledge enable row level security;

-- Lezen / schrijven: ingelogde gebruikers (MFA wordt afgedwongen in de Next.js middleware voor /admin).
create policy "ai_knowledge_select_authenticated"
  on public.ai_knowledge for select to authenticated using (true);

create policy "ai_knowledge_insert_authenticated"
  on public.ai_knowledge for insert to authenticated with check (true);

create policy "ai_knowledge_update_authenticated"
  on public.ai_knowledge for update to authenticated using (true) with check (true);

-- Verwijderen: alleen super_admin (JWT user_metadata of app_metadata).
create policy "ai_knowledge_delete_super_admin"
  on public.ai_knowledge for delete to authenticated
  using (
    coalesce((auth.jwt()->'user_metadata'->>'role'), '') = 'super_admin'
    or coalesce((auth.jwt()->'app_metadata'->>'role'), '') = 'super_admin'
  );

comment on table public.ai_knowledge is 'Studio: extra instructies voor Claude; actieve rijen worden in system-prompt gemerged.';
