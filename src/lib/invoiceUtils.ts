/**
 * invoiceUtils.ts
 * Business rules seputar pembuatan nomor invoice dan identifiers transaksi.
 * Dipisah dari UI agar mudah ditest dan diubah format-nya tanpa menyentuh komponen.
 */

/**
 * Generate nomor invoice unik dengan format: TRX-YYYYMMDD-XXXX
 * Format ini adalah business rule — tidak boleh ada di UI layer.
 * @example generateInvoiceNo() → "TRX-20260511-4829"
 */
export function generateInvoiceNo(): string {
  const d = new Date()
  const year  = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day   = String(d.getDate()).padStart(2, '0')
  const rand  = String(Math.floor(Math.random() * 9000) + 1000)
  return `TRX-${year}${month}${day}-${rand}`
}

/**
 * Generate UUID untuk client transaction ID (idempotency).
 * Wrapper agar tidak ada dependency langsung ke crypto.randomUUID() di UI layer.
 */
export function generateClientTxId(): string {
  return crypto.randomUUID()
}

/**
 * Generate idempotency key untuk mencegah double-submit ke server.
 */
export function generateIdempotencyKey(): string {
  return crypto.randomUUID()
}
