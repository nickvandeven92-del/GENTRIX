-- Categorie voor automatische activiteitslogs; wordt nooit in de Claude system-prompt gemerged (zie buildSystemContextFromKnowledge).
-- Optionele metadata voor admin-weergave.

alter table public.ai_knowledge drop constraint if exists ai_knowledge_category_check;

alter table public.ai_knowledge add constraint ai_knowledge_category_check check (
  category in (
    'Design Regels',
    'Copywriting',
    'Security',
    'Klant-specifiek',
    'Overig',
    'Claude activiteit'
  )
);

alter table public.ai_knowledge
  add column if not exists journal_source text,
  add column if not exists auto_generated boolean not null default false;

comment on column public.ai_knowledge.journal_source is 'Bron-actie, bijv. generate_site, edit_site, site_chat';
comment on column public.ai_knowledge.auto_generated is 'True als rij door de app/Claude-journal is aangemaakt';

-- Usage-tabel: extra operatie voor journal-call
alter table public.ai_usage_events drop constraint if exists ai_usage_events_operation_check;

alter table public.ai_usage_events add constraint ai_usage_events_operation_check check (
  operation in ('generate_site', 'edit_site', 'site_chat', 'activity_journal')
);
