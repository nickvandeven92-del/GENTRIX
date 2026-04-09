-- =============================================================================
-- Kameleon webshop — migratie 2/3
-- RLS policies, helperfuncties, triggers, submit_guest_order RPC
-- Vereist: migratie 01 is succesvol gedraaid
-- Volgende stap: 20260210120030_kameleon_03_client_admin.sql
-- =============================================================================

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variant_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_mutations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.has_client_access(_user_id UUID, _client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = 'owner' OR (role = 'client_admin' AND client_id = _client_id))
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_client_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT client_id FROM public.user_roles
  WHERE user_id = _user_id AND role = 'client_admin'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.client_webshop_live(_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = _client_id AND c.webshop_enabled = true
  )
$$;

CREATE POLICY "Public can view active clients" ON public.clients
  FOR SELECT USING (webshop_enabled = true);
CREATE POLICY "Owner full access clients" ON public.clients
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Client admin can view own client" ON public.clients
  FOR SELECT TO authenticated USING (public.has_client_access(auth.uid(), id));

CREATE POLICY "Owner manages roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Users see own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Public view active categories live shop" ON public.categories
  FOR SELECT USING (
    active = true AND public.client_webshop_live(client_id)
  );
CREATE POLICY "Admin manage categories" ON public.categories
  FOR ALL TO authenticated USING (public.has_client_access(auth.uid(), client_id));

CREATE POLICY "Public view active products live shop" ON public.products
  FOR SELECT USING (
    active = true AND status = 'active' AND public.client_webshop_live(client_id)
  );
CREATE POLICY "Admin manage products" ON public.products
  FOR ALL TO authenticated USING (public.has_client_access(auth.uid(), client_id));

CREATE POLICY "Public view variant options live shop" ON public.product_variant_options
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.active AND p.status = 'active'
        AND public.client_webshop_live(p.client_id)
    )
  );
CREATE POLICY "Admin manage variant options" ON public.product_variant_options
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND public.has_client_access(auth.uid(), p.client_id)
    )
  );

CREATE POLICY "Public view variants live shop" ON public.product_variants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.active AND p.status = 'active'
        AND public.client_webshop_live(p.client_id)
    )
  );
CREATE POLICY "Admin manage variants" ON public.product_variants
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND public.has_client_access(auth.uid(), p.client_id)
    )
  );

CREATE POLICY "Admin view orders" ON public.orders
  FOR SELECT TO authenticated USING (public.has_client_access(auth.uid(), client_id));
CREATE POLICY "Admin update orders" ON public.orders
  FOR UPDATE TO authenticated USING (public.has_client_access(auth.uid(), client_id));

CREATE POLICY "Admin view order items" ON public.order_items
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND public.has_client_access(auth.uid(), o.client_id)
    )
  );

CREATE POLICY "Public validate discount codes" ON public.discount_codes
  FOR SELECT USING (active = true AND public.client_webshop_live(client_id));
CREATE POLICY "Admin manage discounts" ON public.discount_codes
  FOR ALL TO authenticated USING (public.has_client_access(auth.uid(), client_id));

CREATE POLICY "Public view approved reviews" ON public.reviews
  FOR SELECT USING (approved = true AND public.client_webshop_live(client_id));
CREATE POLICY "Guest insert reviews" ON public.reviews
  FOR INSERT WITH CHECK (
    client_id = (SELECT p.client_id FROM public.products p WHERE p.id = product_id)
    AND public.client_webshop_live(client_id)
  );
CREATE POLICY "Admin manage reviews" ON public.reviews
  FOR ALL TO authenticated USING (public.has_client_access(auth.uid(), client_id));

CREATE POLICY "Admin view mutations" ON public.stock_mutations
  FOR SELECT TO authenticated USING (public.has_client_access(auth.uid(), client_id));
CREATE POLICY "Admin insert mutations" ON public.stock_mutations
  FOR INSERT TO authenticated WITH CHECK (public.has_client_access(auth.uid(), client_id));

CREATE POLICY "Track analytics live shop" ON public.analytics_events
  FOR INSERT WITH CHECK (public.client_webshop_live(client_id));
CREATE POLICY "Admin view analytics" ON public.analytics_events
  FOR SELECT TO authenticated USING (public.has_client_access(auth.uid(), client_id));

CREATE POLICY "Wishlist authenticated full" ON public.wishlist_items
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.client_webshop_live(client_id));

CREATE POLICY "Wishlist anon full" ON public.wishlist_items
  FOR ALL TO anon
  USING (true)
  WITH CHECK (public.client_webshop_live(client_id) AND user_id IS NULL AND session_id IS NOT NULL);

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.recalc_product_total_stock()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.products
  SET total_stock = (
    SELECT COALESCE(SUM(stock), 0) FROM public.product_variants WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
  )
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER variant_stock_change AFTER INSERT OR UPDATE OF stock OR DELETE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.recalc_product_total_stock();

CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1001;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'ORD-' || nextval('public.order_number_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();

CREATE OR REPLACE FUNCTION public.submit_guest_order(
  p_client_id uuid,
  p_email text,
  p_first_name text,
  p_last_name text,
  p_address text,
  p_city text,
  p_postal_code text,
  p_country text,
  p_phone text,
  p_notes text,
  p_items jsonb,
  p_discount_code text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i int;
  v_client record;
  v_tax_rate numeric;
  v_elem jsonb;
  v_variant record;
  v_product record;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_dc_id uuid;
  v_dc record;
  v_lines jsonb := '[]'::jsonb;
  v_label text;
  v_qty int;
  v_line_total numeric;
  v_avail int;
  v_taxable numeric;
  v_tax numeric;
  v_total numeric;
  v_order_id uuid;
  v_order_number text;
  v_row jsonb;
  v_variant_id uuid;
  v_prev_stock int;
  v_new_stock int;
BEGIN
  SELECT * INTO v_client FROM public.clients WHERE id = p_client_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'client_not_found';
  END IF;
  IF NOT v_client.webshop_enabled THEN
    RAISE EXCEPTION 'webshop_disabled';
  END IF;
  v_tax_rate := COALESCE(v_client.tax_rate, 0);

  FOR i IN 0..COALESCE(jsonb_array_length(COALESCE(p_items, '[]'::jsonb)), 0) - 1 LOOP
    v_elem := COALESCE(p_items, '[]'::jsonb) -> i;
    v_variant_id := (v_elem->>'variant_id')::uuid;
    v_qty := (v_elem->>'quantity')::int;
    IF v_variant_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'invalid_line';
    END IF;

    SELECT pv.* INTO v_variant FROM public.product_variants pv
    INNER JOIN public.products p ON p.id = pv.product_id
    WHERE pv.id = v_variant_id AND p.client_id = p_client_id
    FOR UPDATE OF pv;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'variant_not_found';
    END IF;

    SELECT * INTO v_product FROM public.products WHERE id = v_variant.product_id;
    IF NOT v_product.active OR v_product.status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'product_not_available';
    END IF;

    v_avail := v_variant.stock - COALESCE(v_variant.reserved_stock, 0);
    IF v_variant.track_inventory AND NOT v_variant.allow_backorder AND v_avail < v_qty THEN
      RAISE EXCEPTION 'insufficient_stock';
    END IF;

    SELECT COALESCE(string_agg(k || ': ' || v, ' · ' ORDER BY k), '') INTO v_label
    FROM jsonb_each_text(v_variant.options) AS t(k, v);

    v_line_total := v_variant.price * v_qty;
    v_subtotal := v_subtotal + v_line_total;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'variant_id', v_variant.id,
      'product_id', v_product.id,
      'product_name', v_product.name,
      'variant_label', v_label,
      'sku', v_variant.sku,
      'quantity', v_qty,
      'unit_price', v_variant.price,
      'total_price', v_line_total,
      'prev_stock', v_variant.stock
    ));
  END LOOP;

  IF jsonb_array_length(v_lines) = 0 THEN
    RAISE EXCEPTION 'empty_cart';
  END IF;

  IF p_discount_code IS NOT NULL AND btrim(p_discount_code) <> '' THEN
    SELECT * INTO v_dc FROM public.discount_codes
    WHERE client_id = p_client_id AND lower(code) = lower(btrim(p_discount_code)) AND active
    FOR UPDATE;
    IF FOUND THEN
      IF (v_dc.max_uses IS NULL OR v_dc.used_count < v_dc.max_uses)
         AND (v_dc.valid_from IS NULL OR v_dc.valid_from <= now())
         AND (v_dc.valid_until IS NULL OR v_dc.valid_until >= now())
         AND (v_dc.min_order_amount IS NULL OR v_subtotal >= v_dc.min_order_amount)
      THEN
        IF v_dc.type = 'percentage'::public.discount_type THEN
          v_discount := round(v_subtotal * (v_dc.value / 100), 2);
        ELSE
          v_discount := least(v_dc.value, v_subtotal);
        END IF;
        v_dc_id := v_dc.id;
      END IF;
    END IF;
  END IF;

  v_taxable := v_subtotal - v_discount;
  v_tax := round(v_taxable * v_tax_rate, 2);
  v_total := v_taxable + v_tax;

  INSERT INTO public.orders (
    client_id, order_number, subtotal, tax, discount, discount_code, total,
    email, first_name, last_name, address, city, postal_code, country, phone, notes, status
  ) VALUES (
    p_client_id, NULL, v_subtotal, v_tax, v_discount,
    CASE WHEN v_discount > 0 THEN btrim(p_discount_code) ELSE NULL END,
    v_total,
    p_email, p_first_name, p_last_name, p_address, p_city, p_postal_code,
    COALESCE(NULLIF(btrim(p_country), ''), 'NL'),
    NULLIF(btrim(p_phone), ''),
    NULLIF(btrim(p_notes), ''),
    'new'
  )
  RETURNING id, order_number INTO v_order_id, v_order_number;

  FOR i IN 0..jsonb_array_length(v_lines) - 1 LOOP
    v_row := v_lines -> i;
    INSERT INTO public.order_items (
      order_id, product_id, variant_id, product_name, variant_label, sku, quantity, unit_price, total_price
    ) VALUES (
      v_order_id,
      (v_row->>'product_id')::uuid,
      (v_row->>'variant_id')::uuid,
      v_row->>'product_name',
      v_row->>'variant_label',
      NULLIF(v_row->>'sku', ''),
      (v_row->>'quantity')::int,
      (v_row->>'unit_price')::numeric,
      (v_row->>'total_price')::numeric
    );

    v_prev_stock := (v_row->>'prev_stock')::int;
    v_new_stock := v_prev_stock - (v_row->>'quantity')::int;

    UPDATE public.product_variants SET stock = v_new_stock
    WHERE id = (v_row->>'variant_id')::uuid;

    INSERT INTO public.stock_mutations (
      client_id, product_id, variant_id, product_name, variant_label, type, quantity,
      previous_stock, new_stock, reason, reference, created_by
    ) VALUES (
      p_client_id,
      (v_row->>'product_id')::uuid,
      (v_row->>'variant_id')::uuid,
      v_row->>'product_name',
      v_row->>'variant_label',
      'sale'::public.stock_mutation_type,
      -(v_row->>'quantity')::int,
      v_prev_stock,
      v_new_stock,
      'Bestelling geplaatst',
      v_order_number,
      'system'
    );
  END LOOP;

  IF v_dc_id IS NOT NULL AND v_discount > 0 THEN
    UPDATE public.discount_codes SET used_count = used_count + 1 WHERE id = v_dc_id;
  END IF;

  RETURN jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_guest_order(
  uuid, text, text, text, text, text, text, text, text, text, jsonb, text
) TO anon, authenticated;
