-- Helper RPC: set (or reset) the PIN hash for a cashier
-- Called by manage-cashier Edge Function with service role
CREATE OR REPLACE FUNCTION public.set_cashier_pin(p_cashier_id uuid, p_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
BEGIN
  UPDATE public.profiles
  SET pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf'))
  WHERE id = p_cashier_id
    AND role = 'cashier';
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_cashier_pin(uuid, text) TO service_role;
