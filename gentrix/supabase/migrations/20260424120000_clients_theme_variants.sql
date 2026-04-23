-- Cache voor portal thema-varianten per klant:
-- - `active`: welke preset nu toegepast is op de draft (origineel/donker/warm).
-- - `variants`: opgeslagen tailwind_sections-payload per preset-id.
-- Doel: na een eerste restyle naar Donker/Warm kunnen we zonder Claude-run terug
-- naar Origineel schakelen én Donker/Warm hergebruiken uit cache.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS theme_variants jsonb;

COMMENT ON COLUMN public.clients.theme_variants IS
  'Portaal thema-cache: { active: "original"|"dark"|"warm", variants: { original?: tailwind_sections, dark?: ..., warm?: ... } }. Lazy-gevuld op eerste restyle.';
