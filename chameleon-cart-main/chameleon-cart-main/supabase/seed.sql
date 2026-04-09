-- Demo tenant + categorieën + producten (koppel aan je owner-account via SQL hieronder)
-- Vervang YOUR_USER_UUID door auth.users.id na registratie.

BEGIN;

INSERT INTO public.clients (
  id, name, slug, webshop_enabled, simple_mode,
  currency, currency_symbol, tax_rate, free_shipping_threshold, shipping_cost,
  shop_name, shop_description
) VALUES (
  '11111111-1111-4111-8111-111111111111',
  'Demo Kapperszaak',
  'demo-kapper',
  true,
  false,
  'EUR', '€', 0.21, 50.00, 4.95,
  'Demo Kapperszaak',
  'Voorbeeldwebshop voor Kameleon SaaS.'
);

INSERT INTO public.categories (id, client_id, slug, name, description, active, sort_order) VALUES
  ('21111111-1111-4111-8111-111111111101', '11111111-1111-4111-8111-111111111111', 'clothing', 'Kleding', 'Shirts, broeken en meer', true, 1),
  ('21111111-1111-4111-8111-111111111102', '11111111-1111-4111-8111-111111111111', 'accessories', 'Accessoires', 'Tassen, riemen en meer', true, 2),
  ('21111111-1111-4111-8111-111111111103', '11111111-1111-4111-8111-111111111111', 'shoes', 'Schoenen', 'Sneakers, boots en meer', true, 3);

INSERT INTO public.products (
  id, client_id, slug, name, description, short_description, images, category_id, tags,
  base_price, compare_at_price, status, track_inventory, allow_backorder, low_stock_threshold, active
) VALUES
(
  '31111111-1111-4111-8111-111111111101',
  '11111111-1111-4111-8111-111111111111',
  'basic-tshirt',
  'Basic T-Shirt',
  'Een veelzijdig basis T-shirt van hoogwaardig biologisch katoen. Perfect voor elke gelegenheid.',
  'Biologisch katoenen T-shirt',
  ARRAY['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=600&fit=crop']::text[],
  '21111111-1111-4111-8111-111111111101',
  ARRAY[]::text[],
  29.95, NULL, 'active', true, false, 5, true
),
(
  '31111111-1111-4111-8111-111111111102',
  '11111111-1111-4111-8111-111111111111',
  'canvas-sneakers',
  'Canvas Sneakers',
  'Lichtgewicht canvas sneakers met een klassiek ontwerp. Comfortabel voor dagelijks gebruik.',
  'Klassieke canvas sneakers',
  ARRAY['https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=600&h=600&fit=crop']::text[],
  '21111111-1111-4111-8111-111111111103',
  ARRAY[]::text[],
  59.95, NULL, 'active', true, false, 5, true
),
(
  '31111111-1111-4111-8111-111111111103',
  '11111111-1111-4111-8111-111111111111',
  'leather-belt',
  'Leren Riem',
  'Handgemaakte leren riem van premium Italiaans leer. Tijdloos design.',
  'Premium Italiaanse leren riem',
  ARRAY['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=600&fit=crop']::text[],
  '21111111-1111-4111-8111-111111111102',
  ARRAY[]::text[],
  44.95, NULL, 'active', true, false, 3, true
),
(
  '31111111-1111-4111-8111-111111111104',
  '11111111-1111-4111-8111-111111111111',
  'denim-jacket',
  'Denim Jacket',
  'Klassiek denim jasje met een moderne pasvorm. Ideaal voor de tussenseizoenen.',
  'Klassiek denim jasje',
  ARRAY['https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=600&h=600&fit=crop']::text[],
  '21111111-1111-4111-8111-111111111101',
  ARRAY[]::text[],
  89.95, 119.95, 'active', true, false, 5, true
),
(
  '31111111-1111-4111-8111-111111111105',
  '11111111-1111-4111-8111-111111111111',
  'canvas-backpack',
  'Canvas Rugzak',
  'Duurzame canvas rugzak met leren details. Ruim genoeg voor een laptop van 15 inch.',
  'Duurzame canvas rugzak',
  ARRAY['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=600&fit=crop']::text[],
  '21111111-1111-4111-8111-111111111102',
  ARRAY[]::text[],
  74.95, NULL, 'active', true, false, 3, true
),
(
  '31111111-1111-4111-8111-111111111106',
  '11111111-1111-4111-8111-111111111111',
  'wool-beanie',
  'Wollen Muts',
  'Zachte wollen muts, perfect voor koude dagen. Unisex model.',
  'Zachte wollen unisex muts',
  ARRAY['https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=600&h=600&fit=crop']::text[],
  '21111111-1111-4111-8111-111111111102',
  ARRAY[]::text[],
  19.95, NULL, 'active', true, false, 5, true
);

-- Variantopties
INSERT INTO public.product_variant_options (product_id, name, values, sort_order) VALUES
  ('31111111-1111-4111-8111-111111111101', 'Maat', ARRAY['S','M','L','XL'], 0),
  ('31111111-1111-4111-8111-111111111101', 'Kleur', ARRAY['Zwart','Wit','Grijs'], 1),
  ('31111111-1111-4111-8111-111111111102', 'Maat', ARRAY['38','40','42','44'], 0),
  ('31111111-1111-4111-8111-111111111103', 'Maat', ARRAY['S','M','L'], 0),
  ('31111111-1111-4111-8111-111111111103', 'Kleur', ARRAY['Bruin','Zwart'], 1),
  ('31111111-1111-4111-8111-111111111104', 'Maat', ARRAY['S','M','L','XL'], 0),
  ('31111111-1111-4111-8111-111111111105', 'Kleur', ARRAY['Groen','Grijs','Navy'], 0),
  ('31111111-1111-4111-8111-111111111106', 'Kleur', ARRAY['Zwart','Grijs','Bordeaux'], 0);

-- Varianten (IDs vast voor testen)
INSERT INTO public.product_variants (id, product_id, options, price, compare_at_price, stock, reserved_stock, sku, track_inventory, allow_backorder) VALUES
  ('41111111-1111-4111-8111-111111111101', '31111111-1111-4111-8111-111111111101', '{"Maat":"S","Kleur":"Zwart"}'::jsonb, 29.95, NULL, 15, 0, 'TS-BLK-S', true, false),
  ('41111111-1111-4111-8111-111111111102', '31111111-1111-4111-8111-111111111101', '{"Maat":"M","Kleur":"Zwart"}'::jsonb, 29.95, NULL, 20, 2, 'TS-BLK-M', true, false),
  ('41111111-1111-4111-8111-111111111103', '31111111-1111-4111-8111-111111111101', '{"Maat":"L","Kleur":"Zwart"}'::jsonb, 29.95, NULL, 10, 0, 'TS-BLK-L', true, false),
  ('41111111-1111-4111-8111-111111111104', '31111111-1111-4111-8111-111111111101', '{"Maat":"M","Kleur":"Wit"}'::jsonb, 29.95, NULL, 18, 1, 'TS-WHT-M', true, false),
  ('41111111-1111-4111-8111-111111111105', '31111111-1111-4111-8111-111111111101', '{"Maat":"L","Kleur":"Grijs"}'::jsonb, 29.95, NULL, 12, 0, 'TS-GRY-L', true, false),
  ('41111111-1111-4111-8111-111111111106', '31111111-1111-4111-8111-111111111102', '{"Maat":"38"}'::jsonb, 59.95, NULL, 8, 0, 'SN-38', true, false),
  ('41111111-1111-4111-8111-111111111107', '31111111-1111-4111-8111-111111111102', '{"Maat":"40"}'::jsonb, 59.95, NULL, 12, 0, 'SN-40', true, false),
  ('41111111-1111-4111-8111-111111111108', '31111111-1111-4111-8111-111111111102', '{"Maat":"42"}'::jsonb, 59.95, NULL, 3, 1, 'SN-42', true, false),
  ('41111111-1111-4111-8111-111111111109', '31111111-1111-4111-8111-111111111102', '{"Maat":"44"}'::jsonb, 59.95, NULL, 6, 0, 'SN-44', true, false),
  ('41111111-1111-4111-8111-111111111110', '31111111-1111-4111-8111-111111111103', '{"Maat":"S","Kleur":"Bruin"}'::jsonb, 44.95, NULL, 10, 0, 'BLT-BRN-S', true, false),
  ('41111111-1111-4111-8111-111111111111', '31111111-1111-4111-8111-111111111103', '{"Maat":"M","Kleur":"Bruin"}'::jsonb, 44.95, NULL, 14, 0, 'BLT-BRN-M', true, false),
  ('41111111-1111-4111-8111-111111111112', '31111111-1111-4111-8111-111111111103', '{"Maat":"L","Kleur":"Zwart"}'::jsonb, 44.95, NULL, 2, 0, 'BLT-BLK-L', true, true),
  ('41111111-1111-4111-8111-111111111113', '31111111-1111-4111-8111-111111111104', '{"Maat":"S"}'::jsonb, 89.95, 119.95, 5, 0, 'DJ-S', true, false),
  ('41111111-1111-4111-8111-111111111114', '31111111-1111-4111-8111-111111111104', '{"Maat":"M"}'::jsonb, 89.95, 119.95, 8, 3, 'DJ-M', true, false),
  ('41111111-1111-4111-8111-111111111115', '31111111-1111-4111-8111-111111111104', '{"Maat":"L"}'::jsonb, 89.95, 119.95, 6, 0, 'DJ-L', true, false),
  ('41111111-1111-4111-8111-111111111116', '31111111-1111-4111-8111-111111111104', '{"Maat":"XL"}'::jsonb, 89.95, 119.95, 1, 0, 'DJ-XL', true, false),
  ('41111111-1111-4111-8111-111111111117', '31111111-1111-4111-8111-111111111105', '{"Kleur":"Groen"}'::jsonb, 74.95, NULL, 11, 0, 'BP-GRN', true, false),
  ('41111111-1111-4111-8111-111111111118', '31111111-1111-4111-8111-111111111105', '{"Kleur":"Grijs"}'::jsonb, 74.95, NULL, 9, 0, 'BP-GRY', true, false),
  ('41111111-1111-4111-8111-111111111119', '31111111-1111-4111-8111-111111111105', '{"Kleur":"Navy"}'::jsonb, 74.95, NULL, 0, 0, 'BP-NVY', true, false),
  ('41111111-1111-4111-8111-111111111120', '31111111-1111-4111-8111-111111111106', '{"Kleur":"Zwart"}'::jsonb, 19.95, NULL, 25, 0, 'BN-BLK', true, false),
  ('41111111-1111-4111-8111-111111111121', '31111111-1111-4111-8111-111111111106', '{"Kleur":"Grijs"}'::jsonb, 19.95, NULL, 20, 0, 'BN-GRY', true, false),
  ('41111111-1111-4111-8111-111111111122', '31111111-1111-4111-8111-111111111106', '{"Kleur":"Bordeaux"}'::jsonb, 19.95, NULL, 0, 0, 'BN-BRD', true, false);

INSERT INTO public.discount_codes (client_id, code, type, value, min_order_amount, used_count, active) VALUES
  ('11111111-1111-4111-8111-111111111111', 'WELKOM10', 'percentage', 10, 25, 3, true),
  ('11111111-1111-4111-8111-111111111111', 'KORTING5', 'fixed', 5, NULL, 0, true);

INSERT INTO public.reviews (id, client_id, product_id, author, email, rating, title, body, verified, approved, created_at) VALUES
  ('51111111-1111-4111-8111-111111111101', '11111111-1111-4111-8111-111111111111', '31111111-1111-4111-8111-111111111101', 'Jan D.', 'jan@test.nl', 5, 'Geweldig T-shirt!', 'Heerlijk zacht materiaal en mooie pasvorm. Zeker een aanrader.', true, true, '2024-03-15T10:00:00Z'),
  ('51111111-1111-4111-8111-111111111102', '11111111-1111-4111-8111-111111111111', '31111111-1111-4111-8111-111111111101', 'Lisa B.', 'lisa@test.nl', 4, 'Mooi shirt', 'Goede kwaliteit, valt iets groter dan verwacht.', true, true, '2024-03-20T14:00:00Z'),
  ('51111111-1111-4111-8111-111111111103', '11111111-1111-4111-8111-111111111111', '31111111-1111-4111-8111-111111111104', 'Mark V.', 'mark@test.nl', 5, 'Top jacket!', 'Prachtig denim jasje, precies zoals op de foto.', false, true, '2024-04-01T09:00:00Z'),
  ('51111111-1111-4111-8111-111111111104', '11111111-1111-4111-8111-111111111111', '31111111-1111-4111-8111-111111111102', 'Emma K.', 'emma@test.nl', 3, 'Okay sneakers', 'Comfortabel maar de zool slijt wat snel.', true, false, '2024-04-05T16:00:00Z');

-- Placeholder-klant (webshop uit — activeer via owner-dashboard)
INSERT INTO public.clients (id, name, slug, webshop_enabled, simple_mode, shop_name, shop_description)
VALUES (
  '12111111-1111-4111-8111-111111111111',
  'Nieuwe klant (placeholder)',
  'placeholder-nieuwe-klant',
  false,
  true,
  'Nieuwe webshop',
  'Wordt gevuld wanneer de webshop wordt geactiveerd.'
);

-- Owner-rol: uncomment en zet je user id
-- INSERT INTO public.user_roles (user_id, role, client_id)
-- VALUES ('YOUR_USER_UUID'::uuid, 'owner', NULL);

COMMIT;
