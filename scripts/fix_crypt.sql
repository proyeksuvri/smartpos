-- Enable pgcrypto di schema extensions (standard Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Fix fungsi verify_cashier_pin agar pakai extensions.crypt bukan crypt biasa
CREATE OR REPLACE FUNCTION public.verify_cashier_pin(p_cashier_id uuid, p_pin text) 
RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO public, extensions
AS $func$
DECLARE 
  v_pin_hash text; 
BEGIN 
  SELECT pin_hash INTO v_pin_hash 
  FROM public.profiles 
  WHERE id = p_cashier_id 
    AND role = 'cashier' 
    AND is_active = true; 
    
  IF v_pin_hash IS NULL THEN 
    RETURN false; 
  END IF; 
  
  RETURN extensions.crypt(p_pin, v_pin_hash) = v_pin_hash; 
END; 
$func$;

-- Reset PIN kasir utama menggunakan extensions.crypt (bukan crypt biasa)
UPDATE public.profiles 
SET pin_hash = extensions.crypt('123456', extensions.gen_salt('bf'))
WHERE id = '2aea6ef1-04be-4b28-8b2f-8d9c32f4e2ef';

-- Verifikasi hasilnya
SELECT id, name, role, is_active, (pin_hash IS NOT NULL) as has_pin FROM public.profiles 
WHERE id = '2aea6ef1-04be-4b28-8b2f-8d9c32f4e2ef';
