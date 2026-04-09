-- =============================================================================
-- Kameleon webshop — migratie 1/3
-- Enums, tabellen, indexes (nog geen RLS)
-- Volgende stap: 20260210120020_kameleon_02_rls_rpc_triggers.sql
-- =============================================================================

CREATE TYPE public.app_role AS ENUM ('owner', 'client_admin');
CREATE TYPE public.product_status AS ENUM ('active', 'draft', 'sold_out', 'archived');
CREATE TYPE public.order_status AS ENUM ('new', 'paid', 'processing', 'shipped', 'delivered', 'cancelled');
CREATE TYPE public.discount_type AS ENUM ('percentage', 'fixed');
CREATE TYPE public.stock_mutation_type AS ENUM ('sale', 'return', 'adjustment', 'restock', 'reservation', 'release');

CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo TEXT,
  domain TEXT,
  webshop_enabled BOOLEAN DEFAULT false,
  simple_mode BOOLEAN DEFAULT true,
  currency TEXT DEFAULT 'EUR',
  currency_symbol TEXT DEFAULT '€',
  tax_rate NUMERIC(5,4) DEFAULT 0.2100,
  free_shipping_threshold NUMERIC(10,2) DEFAULT 50.00,
  shipping_cost NUMERIC(10,2) DEFAULT 4.95,
  shop_name TEXT NOT NULL,
  shop_description TEXT,
  theme_settings JSONB DEFAULT '{}',
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  UNIQUE(user_id, role, client_id)
);

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  image TEXT,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, slug)
);

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  short_description TEXT,
  images TEXT[] DEFAULT '{}',
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  base_price NUMERIC(10,2) NOT NULL,
  compare_at_price NUMERIC(10,2),
  total_stock INTEGER DEFAULT 0,
  status product_status DEFAULT 'draft',
  track_inventory BOOLEAN DEFAULT true,
  allow_backorder BOOLEAN DEFAULT false,
  low_stock_threshold INTEGER DEFAULT 5,
  active BOOLEAN DEFAULT true,
  meta_title TEXT,
  meta_description TEXT,
  og_image TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, slug)
);

CREATE TABLE public.product_variant_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  values TEXT[] NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  options JSONB NOT NULL DEFAULT '{}',
  price NUMERIC(10,2) NOT NULL,
  compare_at_price NUMERIC(10,2),
  stock INTEGER DEFAULT 0,
  reserved_stock INTEGER DEFAULT 0,
  sku TEXT,
  image TEXT,
  track_inventory BOOLEAN DEFAULT true,
  allow_backorder BOOLEAN DEFAULT false
);

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  order_number TEXT NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  tax NUMERIC(10,2) NOT NULL,
  discount NUMERIC(10,2) DEFAULT 0,
  discount_code TEXT,
  total NUMERIC(10,2) NOT NULL,
  status order_status DEFAULT 'new',
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT DEFAULT 'NL',
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, order_number)
);

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  variant_label TEXT NOT NULL,
  sku TEXT,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL
);

CREATE TABLE public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL,
  type discount_type NOT NULL,
  value NUMERIC(10,2) NOT NULL,
  min_order_amount NUMERIC(10,2),
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, code)
);

CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  author TEXT NOT NULL,
  email TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,
  approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.stock_mutations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE NOT NULL,
  product_name TEXT NOT NULL,
  variant_label TEXT NOT NULL,
  type stock_mutation_type NOT NULL,
  quantity INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT DEFAULT 'system'
);

CREATE TABLE public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  added_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX wishlist_items_user_product_unique
  ON public.wishlist_items (user_id, product_id, client_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX wishlist_items_session_product_unique
  ON public.wishlist_items (session_id, product_id, client_id)
  WHERE user_id IS NULL AND session_id IS NOT NULL AND session_id <> '';

CREATE INDEX idx_products_client ON public.products(client_id);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_product_variants_product ON public.product_variants(product_id);
CREATE INDEX idx_orders_client ON public.orders(client_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);
CREATE INDEX idx_reviews_product ON public.reviews(product_id);
CREATE INDEX idx_reviews_client ON public.reviews(client_id);
CREATE INDEX idx_stock_mutations_client ON public.stock_mutations(client_id);
CREATE INDEX idx_analytics_client ON public.analytics_events(client_id);
CREATE INDEX idx_analytics_type ON public.analytics_events(type);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_categories_client ON public.categories(client_id);
