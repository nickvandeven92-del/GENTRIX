-- Chronologische dossier-notities met auteur (snapshot-label bij aanmaak).

create table public.client_dossier_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  body text not null,
  created_by uuid not null,
  created_by_label text not null,
  created_at timestamptz not null default now(),
  constraint client_dossier_notes_body_len check (char_length(body) between 1 and 8000)
);

create index client_dossier_notes_client_created_idx
  on public.client_dossier_notes (client_id, created_at desc);

comment on table public.client_dossier_notes is
  'Notities op klantdossier-overzicht; created_by = auth user id, created_by_label = e-mail (of fallback) bij aanmaak.';

alter table public.client_dossier_notes enable row level security;

create policy "client_dossier_notes_select_authenticated"
  on public.client_dossier_notes
  for select
  to authenticated
  using (true);

create policy "client_dossier_notes_insert_authenticated"
  on public.client_dossier_notes
  for insert
  to authenticated
  with check (true);
