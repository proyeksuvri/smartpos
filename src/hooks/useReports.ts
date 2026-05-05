import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'

/* ── Types ─────────────────────────────────────────────── */
export interface SoldProductRow {
  product_id: string
  product_name: string
  category_name: string | null
  unit: string
  total_qty: number
  total_subtotal: number
  total_transactions: number
}

export interface StockReportRow {
  id: string
  name: string
  sku: string | null
  category_name: string | null
  unit: string
  stock_qty: number
  min_stock: number
  cost_price: number
  price_retail: number
  stock_value: number   // stock_qty * cost_price
  status: 'aman' | 'kritis' | 'habis'
}

export interface ShiftReportRow {
  id: string
  cashier_name: string
  opened_at: string
  closed_at: string | null
  status: 'open' | 'closed'
  opening_cash: number
  closing_cash: number | null
  expected_cash: number | null
  difference: number | null
  total_transactions: number
  total_revenue: number
}

/* ── Hook: Produk Terjual ───────────────────────────────── */
export function useSoldProductsReport() {
  const [data, setData] = useState<SoldProductRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async (dateFrom: string, dateTo: string) => {
    setLoading(true); setError(null)
    try {
      const { data: rows, error: err } = await supabase
        .from('transaction_items')
        .select(`
          product_id, qty, subtotal,
          products ( name, unit, categories ( name ) ),
          transactions!transaction_id ( status, created_at )
        `)
        .eq('transactions.status', 'paid')
        .gte('transactions.created_at', `${dateFrom}T00:00:00`)
        .lte('transactions.created_at', `${dateTo}T23:59:59`)
        .limit(5000)

      if (err) throw err

      type RawRow = {
        product_id: string
        qty: number
        subtotal: number
        products: { name: string; unit: string; categories: { name: string } | null } | null
        transactions: { status: string; created_at: string } | null
      }

      const map = new Map<string, SoldProductRow>()
      for (const r of (rows ?? []) as unknown as RawRow[]) {
        if (r.transactions?.status !== 'paid') continue
        const existing = map.get(r.product_id)
        if (existing) {
          existing.total_qty += Number(r.qty)
          existing.total_subtotal += Number(r.subtotal)
          existing.total_transactions += 1
        } else {
          map.set(r.product_id, {
            product_id: r.product_id,
            product_name: r.products?.name ?? '—',
            category_name: r.products?.categories?.name ?? null,
            unit: r.products?.unit ?? '—',
            total_qty: Number(r.qty),
            total_subtotal: Number(r.subtotal),
            total_transactions: 1,
          })
        }
      }
      const result = Array.from(map.values())
        .sort((a, b) => b.total_subtotal - a.total_subtotal)
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat laporan produk.')
    } finally { setLoading(false) }
  }, [])

  return { data, loading, error, fetch }
}

/* ── Hook: Stok Saat Ini ────────────────────────────────── */
export function useStockReport() {
  const [data, setData] = useState<StockReportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data: rows, error: err } = await supabase
        .from('products')
        .select('id, name, sku, unit, stock_qty, min_stock, cost_price, price_retail, is_active, categories ( name )')
        .eq('is_active', true)
        .order('name')

      if (err) throw err

      type RawProd = {
        id: string; name: string; sku: string | null; unit: string
        stock_qty: number; min_stock: number; cost_price: number; price_retail: number
        categories: { name: string } | null
      }

      const result: StockReportRow[] = (rows as unknown as RawProd[]).map((p) => {
        const qty = Number(p.stock_qty)
        const min = Number(p.min_stock)
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          category_name: p.categories?.name ?? null,
          unit: p.unit,
          stock_qty: qty,
          min_stock: min,
          cost_price: Number(p.cost_price),
          price_retail: Number(p.price_retail),
          stock_value: qty * Number(p.cost_price),
          status: qty <= 0 ? 'habis' : (min > 0 && qty <= min ? 'kritis' : 'aman'),
        }
      })
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat stok.')
    } finally { setLoading(false) }
  }, [])

  return { data, loading, error, fetch }
}

/* ── Hook: Shift Report ─────────────────────────────────── */
export function useShiftReport() {
  const [data, setData] = useState<ShiftReportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async (dateFrom: string, dateTo: string) => {
    setLoading(true); setError(null)
    try {
      const { data: shifts, error: sErr } = await supabase
        .from('shifts')
        .select(`
          id, status, opening_cash, closing_cash, expected_cash, difference,
          opened_at, closed_at,
          profiles!cashier_id ( name )
        `)
        .gte('opened_at', `${dateFrom}T00:00:00`)
        .lte('opened_at', `${dateTo}T23:59:59`)
        .order('opened_at', { ascending: false })

      if (sErr) throw sErr

      // Hitung total transaksi & omset per shift
      const shiftIds = (shifts ?? []).map((s: {id: string}) => s.id)
      let txMap: Map<string, { count: number; revenue: number }> = new Map()

      if (shiftIds.length > 0) {
        const { data: txRows } = await supabase
          .from('transactions')
          .select('shift_id, total, status')
          .in('shift_id', shiftIds)
          .eq('status', 'paid')

        for (const tx of txRows ?? []) {
          const entry = txMap.get(tx.shift_id) ?? { count: 0, revenue: 0 }
          entry.count += 1
          entry.revenue += Number(tx.total)
          txMap.set(tx.shift_id, entry)
        }
      }

      type RawShift = {
        id: string; status: string; opening_cash: number
        closing_cash: number | null; expected_cash: number | null
        difference: number | null; opened_at: string; closed_at: string | null
        profiles: { name: string } | null
      }

      const result: ShiftReportRow[] = (shifts as unknown as RawShift[]).map((s) => {
        const txData = txMap.get(s.id) ?? { count: 0, revenue: 0 }
        return {
          id: s.id,
          cashier_name: s.profiles?.name ?? '—',
          opened_at: s.opened_at,
          closed_at: s.closed_at,
          status: s.status as 'open' | 'closed',
          opening_cash: Number(s.opening_cash),
          closing_cash: s.closing_cash !== null ? Number(s.closing_cash) : null,
          expected_cash: s.expected_cash !== null ? Number(s.expected_cash) : null,
          difference: s.difference !== null ? Number(s.difference) : null,
          total_transactions: txData.count,
          total_revenue: txData.revenue,
        }
      })
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat laporan shift.')
    } finally { setLoading(false) }
  }, [])

  return { data, loading, error, fetch }
}
