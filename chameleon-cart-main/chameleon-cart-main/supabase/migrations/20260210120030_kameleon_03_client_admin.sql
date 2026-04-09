-- =============================================================================
-- Kameleon webshop — migratie 3/3
-- client_admin mag clients bijwerken; webshop_enabled / simple_mode alleen owner
-- Vereist: migraties 01 en 02 succesvol
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_client_admin_shop_flags()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'owner') THEN
    RETURN NEW;
  END IF;
  IF NEW.webshop_enabled IS DISTINCT FROM OLD.webshop_enabled
     OR NEW.simple_mode IS DISTINCT FROM OLD.simple_mode
  THEN
    RAISE EXCEPTION 'Alleen de platformeigenaar kan de webshop-modus of zichtbaarheid wijzigen';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER clients_enforce_shop_flags
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_client_admin_shop_flags();

CREATE POLICY "Client admin update own client row" ON public.clients
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'client_admin' AND ur.client_id = clients.id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'client_admin' AND ur.client_id = clients.id
    )
  );
