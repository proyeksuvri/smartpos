-- ============================================================
-- Void Transaction RPC
-- Memvalidasi, membatalkan transaksi, mengembalikan stok,
-- dan mencatat di audit_logs.
-- ============================================================

CREATE OR REPLACE FUNCTION void_transaction(
  p_transaction_id  uuid,
  p_reason          text,
  p_voided_by       uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tx          RECORD;
  v_item        RECORD;
  v_role        text;
BEGIN
  -- 1. Pastikan pemanggil adalah manager / owner
  SELECT role INTO v_role
  FROM profiles
  WHERE id = p_voided_by AND is_active = true;

  IF v_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profil tidak ditemukan.');
  END IF;

  IF v_role NOT IN ('manager', 'owner') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hanya manager atau owner yang bisa void transaksi.');
  END IF;

  -- 2. Validasi alasan
  IF trim(p_reason) = '' OR p_reason IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Alasan void wajib diisi.');
  END IF;

  -- 3. Ambil data transaksi
  SELECT * INTO v_tx
  FROM transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaksi tidak ditemukan.');
  END IF;

  IF v_tx.status <> 'paid' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Transaksi tidak bisa di-void (status: %s).', v_tx.status)
    );
  END IF;

  -- 4. Update status transaksi menjadi voided
  UPDATE transactions SET
    status     = 'voided',
    voided_at  = now(),
    voided_by  = p_voided_by,
    void_reason = trim(p_reason),
    updated_at = now()
  WHERE id = p_transaction_id;

  -- 5. Kembalikan stok untuk setiap item via stock_movements
  FOR v_item IN
    SELECT product_id, qty
    FROM transaction_items
    WHERE transaction_id = p_transaction_id
  LOOP
    INSERT INTO stock_movements (
      product_id, type, qty,
      reference_type, reference_id,
      notes, created_by
    ) VALUES (
      v_item.product_id,
      'void',
      v_item.qty,          -- qty positif = stok kembali masuk
      'transaction',
      p_transaction_id,
      format('Void transaksi %s: %s', v_tx.invoice_no, trim(p_reason)),
      p_voided_by
    );
  END LOOP;

  -- 6. Catat di audit_logs
  INSERT INTO audit_logs (
    actor_id, action, entity_type, entity_id,
    before_data, after_data
  ) VALUES (
    p_voided_by,
    'void_transaction',
    'transactions',
    p_transaction_id,
    jsonb_build_object('status', 'paid'),
    jsonb_build_object('status', 'voided', 'void_reason', trim(p_reason), 'voided_at', now())
  );

  RETURN jsonb_build_object(
    'success',     true,
    'invoice_no',  v_tx.invoice_no,
    'total',       v_tx.total
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant eksekusi hanya ke user terotentikasi
GRANT EXECUTE ON FUNCTION void_transaction(uuid, text, uuid) TO authenticated;
