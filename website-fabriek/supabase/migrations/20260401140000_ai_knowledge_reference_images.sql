-- Optionele referentie-screenshots per kennisregel (multimodaal naar Claude).
alter table public.ai_knowledge
  add column if not exists reference_image_urls text[] not null default '{}';

comment on column public.ai_knowledge.reference_image_urls is
  'Publieke https-URL''s (bijv. Supabase site-assets); max. handvol per regel; worden als vision-input meegegeven.';
