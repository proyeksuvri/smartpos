/**
 * useCheckout.ts
 * Custom hook yang mengabstraksi seluruh business logic pembayaran / checkout.
 *
 * Tanggung jawab hook ini:
 * - Membangun payload transaksi (business rule)
 * - Memutuskan routing: online (supabase RPC) vs offline (IndexedDB queue)
 * - Memicu stock alert Telegram jika stok produk kritis pasca-transaksi
 * - Mengekspos status loading dan error ke UI
 *
 * PosPage cukup memanggil `checkout(method, cashPaid)` dan bereaksi terhadap
 * `invoiceNo` yang dikembalikan — tanpa perlu tahu detail implementasi.
 */

import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import { generateClientTxId, generateIdempotencyKey, generateInvoiceNo } from '../lib/invoiceUtils'
import { useOfflineSync } from './useOfflineSync'
import { useOnlineStatus } from './useOnlineStatus'
import type { CartItem } from './useCart'

interface CheckoutDeps {
  /** Shift ID yang aktif saat ini */
  shiftId: string
  /** User ID kasir yang login */
  userId: string
  /** Daftar item dalam keranjang */
  items: CartItem[]
  /** Subtotal sebelum diskon transaksi */
  subtotal: number
  /** Diskon level transaksi (bukan per item) */
  txDiscount: number
  /** Total yang harus dibayar */
  total: number
}

interface CheckoutResult {
  /** Nomor invoice yang berhasil dibuat */
  invoiceNo: string
}

export function useCheckout() {
  const isOnline = useOnlineStatus()
  const { savePendingTransaction } = useOfflineSync()

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  /**
   * Proses pembayaran. Mengembalikan invoiceNo jika berhasil, atau throw jika gagal.
   */
  const checkout = useCallback(async (
    deps: CheckoutDeps,
    method: 'cash' | 'transfer' | 'mixed',
    cashPaid: number,
  ): Promise<CheckoutResult> => {
    const { shiftId, items, subtotal, txDiscount, total } = deps

    // ── Validasi bisnis (bukan validasi UI) ──────────────────
    if (!shiftId) throw new Error('Shift tidak aktif.')
    if (items.length === 0) throw new Error('Keranjang kosong.')

    setLoading(true)
    setError(null)

    try {
      // ── Buat identifiers ─────────────────────────────────────
      const clientTxId     = generateClientTxId()
      const idempotencyKey = generateIdempotencyKey()
      const invoiceNo      = generateInvoiceNo()

      // ── Bangun payload (data transformation / business rule) ─
      const payload = {
        p_client_transaction_id: clientTxId,
        p_idempotency_key:        idempotencyKey,
        p_invoice_no:             invoiceNo,
        p_customer_id:            null,
        p_type:                   'retail' as const,
        p_payment_method:         method,
        p_subtotal:               subtotal,
        p_discount:               txDiscount,
        p_total:                  total,
        p_cash_paid:              method === 'cash' || method === 'mixed' ? cashPaid : null,
        p_change:                 method === 'cash' ? Math.max(0, cashPaid - total) : null,
        p_shift_id:               shiftId,
        p_items: items.map((i) => ({
          product_id:   i.product.id,
          qty:          i.qty,
          unit_price:   i.unitPrice,
          master_price: i.product.price_retail,
          discount:     i.discount,
          subtotal:     i.subtotal,
        })),
      }

      if (!isOnline) {
        // ── MODE OFFLINE: simpan ke IndexedDB ──────────────────
        await savePendingTransaction({
          localId:               crypto.randomUUID(),
          client_transaction_id: clientTxId,
          idempotency_key:        idempotencyKey,
          invoice_no:             invoiceNo,
          payload,
        })
        return { invoiceNo }
      }

      // ── MODE ONLINE: kirim ke server ───────────────────────
      const { error: rpcError } = await supabase.rpc('create_paid_transaction', payload)
      if (rpcError) throw new Error(rpcError.message)

      // ── Side effect: stock alert Telegram ─────────────────
      // Cek produk yang melewati batas stok minimum setelah transaksi ini
      _triggerStockAlerts(items)

      return { invoiceNo }

    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gagal memproses pembayaran.'
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }, [isOnline, savePendingTransaction])

  return { checkout, loading, error }
}

/* ── Private: Stock Alert Trigger ──────────────────────────── */

/**
 * Kirim notifikasi Telegram jika ada produk yang melewati batas stok minimum
 * pasca transaksi. Dijalankan secara fire-and-forget (tidak block flow utama).
 */
function _triggerStockAlerts(items: CartItem[]): void {
  for (const item of items) {
    const remaining = item.product.stock_qty - item.qty
    const crossedThreshold =
      item.product.min_stock > 0 &&
      remaining <= item.product.min_stock &&
      item.product.stock_qty > item.product.min_stock

    if (crossedThreshold) {
      void supabase.functions.invoke('telegram-bot', {
        body: {
          type: 'stock_alert',
          data: {
            product_name: item.product.name,
            stock_qty:    remaining,
          },
        },
      })
    }
  }
}
