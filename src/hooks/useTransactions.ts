import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/* ── Types ─────────────────────────────────────────────── */
export interface TransactionItem {
  id: string
  product_id: string
  qty: number
  unit_price: number
  discount: number
  subtotal: number
  products: { name: string; unit: string } | null
}

export interface Transaction {
  id: string
  invoice_no: string
  cashier_id: string
  type: 'retail' | 'wholesale'
  payment_method: 'cash' | 'transfer' | 'mixed'
  subtotal: number
  discount: number
  total: number
  cash_paid: number | null
  change: number | null
  shift_id: string
  status: 'paid' | 'voided' | 'draft' | 'sync_failed'
  voided_at: string | null
  voided_by: string | null
  void_reason: string | null
  created_at: string
  profiles: { name: string } | null
  void_profiles?: { name: string } | null
}

export interface TransactionWithItems extends Transaction {
  transaction_items: TransactionItem[]
}

interface UseTransactionsOptions {
  dateFrom?: string   // YYYY-MM-DD
  dateTo?: string
  status?: 'paid' | 'voided' | 'all'
  limit?: number
}

/* ── Hook: List Transactions ────────────────────────────── */
export function useTransactions(opts: UseTransactionsOptions = {}) {
  const { dateFrom, dateTo, status = 'all', limit = 50 } = opts

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let q = supabase
        .from('transactions')
        .select(`
          id, invoice_no, cashier_id, type, payment_method,
          subtotal, discount, total, cash_paid, change,
          shift_id, status, voided_at, voided_by, void_reason, created_at,
          profiles!cashier_id ( name )
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (status !== 'all') q = q.eq('status', status)
      if (dateFrom) q = q.gte('created_at', `${dateFrom}T00:00:00`)
      if (dateTo)   q = q.lte('created_at', `${dateTo}T23:59:59`)

      const { data, error: err } = await q
      if (err) throw err
      setTransactions((data ?? []) as unknown as Transaction[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat transaksi.')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, status, limit])

  useEffect(() => { void fetch() }, [fetch])

  return { transactions, loading, error, refetch: fetch }
}

/* ── Hook: Single Transaction Detail ───────────────────── */
export function useTransactionDetail(invoiceNo: string | null) {
  const [transaction, setTransaction] = useState<TransactionWithItems | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!invoiceNo) { setTransaction(null); return }

    setLoading(true)
    setError(null)

    supabase
      .from('transactions')
      .select(`
        id, invoice_no, cashier_id, type, payment_method,
        subtotal, discount, total, cash_paid, change,
        shift_id, status, voided_at, voided_by, void_reason, created_at,
        profiles!cashier_id ( name ),
        transaction_items (
          id, product_id, qty, unit_price, discount, subtotal,
          products ( name, unit )
        )
      `)
      .eq('invoice_no', invoiceNo)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setTransaction(data as unknown as TransactionWithItems)
        setLoading(false)
      })
  }, [invoiceNo])

  return { transaction, loading, error }
}

/* ── Hook: Void Transaction ─────────────────────────────── */
export function useVoidTransaction() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const voidTransaction = useCallback(async (
    transactionId: string,
    reason: string,
    voidedBy: string,
  ): Promise<{ success: boolean; invoiceNo?: string; error?: string }> => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: rpcErr } = await supabase.rpc('void_transaction', {
        p_transaction_id: transactionId,
        p_reason: reason,
        p_voided_by: voidedBy,
      })

      if (rpcErr) throw new Error(rpcErr.message)

      const result = data as { success: boolean; invoice_no?: string; error?: string }
      if (!result.success) throw new Error(result.error ?? 'Void gagal.')

      return { success: true, invoiceNo: result.invoice_no }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Void gagal.'
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setLoading(false)
    }
  }, [])

  return { voidTransaction, loading, error }
}
