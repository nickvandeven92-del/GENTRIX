-- =============================================================================
-- WIPE: alle klanten, sites, snapshots, boekingen, facturen gekoppeld aan klanten
-- =============================================================================
-- Handmatig: voer elke statement apart uit in SQL Editor als je geen Node gebruikt.
-- Aanbevolen DB-verbinding: Session pooler poort 5432 of Direct db.*.supabase.co:5432
-- (niet Transaction pooler 6543 — die kan multi-statement / tx weigeren).
-- =============================================================================

DELETE FROM public.sales_tasks
WHERE linked_entity_type IN ('client', 'website');

UPDATE public.clients
SET
  draft_snapshot_id = NULL,
  published_snapshot_id = NULL;

DELETE FROM public.clients;

-- storage.objects: Supabase blokkeert direct DELETE (protect_delete).
-- Gebruik:  npm run db:clear-clients -- --yes  (ruimt bucket op via API)
-- of wis handmatig in Dashboard → Storage → site-assets.
