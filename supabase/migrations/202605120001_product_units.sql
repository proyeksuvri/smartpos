-- =============================================================================
-- Migration: 202605120001_product_units
-- Deskripsi: Tabel unit partai produk (pcs → pak → karton, dll.)
-- =============================================================================

-- ─── Tabel product_units ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_units (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        uuid          NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  unit_name         text          NOT NULL,
  -- Berapa unit dasar per 1 unit ini (mis. 10 pcs per pak, 40 pcs per karton)
  conversion_factor numeric(14,3) NOT NULL CHECK (conversion_factor > 0),
  -- Harga per unit ini = price_wholesale × conversion_factor (otomatis via trigger)
  price             numeric(14,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  sort_order        integer       NOT NULL DEFAULT 0,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (product_id, unit_name)
);

CREATE INDEX IF NOT EXISTS idx_product_units_product_id
  ON public.product_units (product_id);

COMMENT ON TABLE public.product_units IS
  'Unit-unit partai untuk tiap produk (pak, karton, dos, karung, dll.).'
  ' Harga otomatis = products.price_wholesale × conversion_factor.';

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.product_units ENABLE ROW LEVEL SECURITY;

-- Semua user authenticated boleh baca
CREATE POLICY "product_units_select"
  ON public.product_units FOR SELECT
  TO authenticated USING (true);

-- Hanya manager/owner boleh insert
CREATE POLICY "product_units_insert"
  ON public.product_units FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('manager', 'owner') AND is_active = true
    )
  );

-- Hanya manager/owner boleh update
CREATE POLICY "product_units_update"
  ON public.product_units FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('manager', 'owner') AND is_active = true
    )
  );

-- Hanya manager/owner boleh delete
CREATE POLICY "product_units_delete"
  ON public.product_units FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('manager', 'owner') AND is_active = true
    )
  );

-- ─── Trigger: sinkronisasi harga saat price_wholesale produk berubah ─────────
CREATE OR REPLACE FUNCTION public.sync_product_unit_prices()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Hanya jalankan jika price_wholesale berubah dan tidak nol
  IF NEW.price_wholesale IS DISTINCT FROM OLD.price_wholesale THEN
    UPDATE public.product_units
    SET price = ROUND(NEW.price_wholesale * conversion_factor, 2)
    WHERE product_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_unit_prices ON public.products;
CREATE TRIGGER trg_sync_unit_prices
  AFTER UPDATE OF price_wholesale ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_product_unit_prices();

-- ─── Trigger: set harga otomatis saat insert baru ────────────────────────────
CREATE OR REPLACE FUNCTION public.set_product_unit_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wholesale numeric(14,2);
BEGIN
  -- Ambil price_wholesale dari produk induk
  SELECT price_wholesale INTO v_wholesale
  FROM public.products WHERE id = NEW.product_id;

  -- Jika harga belum di-set (= 0), hitung otomatis
  IF NEW.price = 0 OR NEW.price IS NULL THEN
    NEW.price := ROUND(COALESCE(v_wholesale, 0) * NEW.conversion_factor, 2);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_unit_price ON public.product_units;
CREATE TRIGGER trg_set_unit_price
  BEFORE INSERT ON public.product_units
  FOR EACH ROW
  EXECUTE FUNCTION public.set_product_unit_price();
