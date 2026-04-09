-- Koppel optioneel een Supabase Auth-user aan een klant voor /home en /dashboard → /portal/[slug].

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS portal_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS clients_portal_user_id_active_idx
  ON public.clients (portal_user_id)
  WHERE portal_user_id IS NOT NULL AND status = 'active';

COMMENT ON COLUMN public.clients.portal_user_id IS
  'Als gezet: deze ingelogde gebruiker ziet dit dossier in portaal-home redirect (één klant → direct /portal/slug).';
