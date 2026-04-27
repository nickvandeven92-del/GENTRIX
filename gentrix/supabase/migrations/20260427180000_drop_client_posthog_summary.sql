-- Verwijder ongebruikte samenvattingstabel (vroeger externe product-analytics); app schrijft hier niet meer naartoe.
drop table if exists public.client_posthog_summary cascade;
