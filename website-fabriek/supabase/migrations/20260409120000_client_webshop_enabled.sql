-- Publieke webshop-route /winkel/{slug} + placeholder __STUDIO_SHOP_PATH__ op marketingpagina
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS webshop_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clients.webshop_enabled IS
  'Aan: /winkel/slug live, marketinglinks __STUDIO_SHOP_PATH__ → /winkel/slug; uit: shop-sectie en placeholders verborgen op /site.';
