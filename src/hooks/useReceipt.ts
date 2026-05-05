import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface ReceiptItem {
  id: string
  product_id: string
  product_name: string
  unit: string
  qty: number
  unit_price: number
  discount: number
  subtotal: number
}

export interface ReceiptData {
  id: string
  invoice_no: string
  created_at: string
  payment_method: 'cash' | 'transfer' | 'mixed'
  type: 'retail' | 'wholesale'
  subtotal: number
  discount: number
  total: number
  cash_paid: number | null
  change: number | null
  cashier_name: string
  store_name: string
  store_address: string | null
  items: ReceiptItem[]
}

export function useReceipt(invoiceNo: string) {
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReceipt = useCallback(async () => {
    if (!invoiceNo) return
    setLoading(true)
    setError(null)

    try {
      // Fetch transaction + cashier
      const { data: tx, error: txErr } = await supabase
        .from('transactions')
        .select(`
          id, invoice_no, created_at, payment_method, type,
          subtotal, discount, total, cash_paid, change, status,
          profiles!cashier_id ( name )
        `)
        .eq('invoice_no', invoiceNo)
        .single()

      if (txErr) throw new Error(txErr.message)
      if (!tx) throw new Error('Transaksi tidak ditemukan.')
      if ((tx as { status: string }).status === 'voided') throw new Error('Transaksi ini sudah dibatalkan (void).')

      // Fetch items + product name & unit
      const { data: items, error: itemsErr } = await supabase
        .from('transaction_items')
        .select(`
          id, product_id, qty, unit_price, discount, subtotal,
          products!product_id ( name, unit )
        `)
        .eq('transaction_id', tx.id)

      if (itemsErr) throw new Error(itemsErr.message)

      // Fetch store settings
      const { data: settings } = await supabase
        .from('app_settings')
        .select('store_name, store_address')
        .single()

      type TxProfile = { name: string }
      type ItemProduct = { name: string; unit: string }

      const profile = (tx as unknown as { profiles: TxProfile }).profiles

      setReceipt({
        id: tx.id as string,
        invoice_no: tx.invoice_no as string,
        created_at: tx.created_at as string,
        payment_method: tx.payment_method as 'cash' | 'transfer' | 'mixed',
        type: tx.type as 'retail' | 'wholesale',
        subtotal: Number(tx.subtotal),
        discount: Number(tx.discount),
        total: Number(tx.total),
        cash_paid: tx.cash_paid != null ? Number(tx.cash_paid) : null,
        change: tx.change != null ? Number(tx.change) : null,
        cashier_name: profile?.name ?? 'Kasir',
        store_name: settings?.store_name ?? 'SmartPOS',
        store_address: settings?.store_address ?? null,
        items: (items ?? []).map((item) => {
          const prod = (item as unknown as { products: ItemProduct }).products
          return {
            id: item.id as string,
            product_id: item.product_id as string,
            product_name: prod?.name ?? '—',
            unit: prod?.unit ?? 'pcs',
            qty: Number(item.qty),
            unit_price: Number(item.unit_price),
            discount: Number(item.discount),
            subtotal: Number(item.subtotal),
          }
        }),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat struk.')
    } finally {
      setLoading(false)
    }
  }, [invoiceNo])

  useEffect(() => {
    void fetchReceipt()
  }, [fetchReceipt])

  return { receipt, loading, error }
}
