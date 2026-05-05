import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/* ── Types ─────────────────────────────────────────────── */
export interface DashboardMetrics {
  todayRevenue: number
  todayTxCount: number
  yesterdayRevenue: number
  yesterdayTxCount: number
  activeShifts: number
  criticalStockCount: number
  outOfStockCount: number
}

export interface ChartPoint {
  date: string       // 'DD/MM'
  fullDate: string   // 'YYYY-MM-DD'
  revenue: number
  txCount: number
}

export interface TopProduct {
  product_id: string
  product_name: string
  total_qty: number
  total_revenue: number
}

export interface DashboardData {
  metrics: DashboardMetrics
  chart: ChartPoint[]
  topProducts: TopProduct[]
  criticalProducts: { id: string; name: string; stock_qty: number; min_stock: number; unit: string }[]
}

/* ── Helper ─────────────────────────────────────────────── */
function localDateStr(daysAgo = 0): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}

function fmt(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

/* ── Hook ──────────────────────────────────────────────── */
export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const today = localDateStr(0)
      const yesterday = localDateStr(1)
      const sevenDaysAgo = localDateStr(6)

      // Run all queries in parallel for speed
      const [
        todayTxResult,
        yesterdayTxResult,
        activeShiftsResult,
        allProdsResult,
        chartTxResult,
        topItemsResult,
      ] = await Promise.all([
        // Today transactions
        supabase
          .from('transactions')
          .select('total')
          .eq('status', 'paid')
          .gte('created_at', `${today}T00:00:00`)
          .lt('created_at', `${today}T23:59:59`),

        // Yesterday transactions
        supabase
          .from('transactions')
          .select('total')
          .eq('status', 'paid')
          .gte('created_at', `${yesterday}T00:00:00`)
          .lt('created_at', `${yesterday}T23:59:59`),

        // Active shifts count
        supabase
          .from('shifts')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'open'),

        // All active product stocks
        supabase
          .from('products')
          .select('id, name, stock_qty, min_stock, unit')
          .eq('is_active', true)
          .order('stock_qty', { ascending: true })
          .limit(100),

        // Chart: last 7 days transactions
        supabase
          .from('transactions')
          .select('created_at, total')
          .eq('status', 'paid')
          .gte('created_at', `${sevenDaysAgo}T00:00:00`)
          .order('created_at', { ascending: true }),

        // Top products items
        supabase
          .from('transaction_items')
          .select(`
            product_id, qty, subtotal,
            products!product_id ( name ),
            transactions!transaction_id ( status, created_at )
          `)
          .gte('transactions.created_at', `${sevenDaysAgo}T00:00:00`)
          .eq('transactions.status', 'paid')
          .limit(1000),
      ])

      const todayTx       = todayTxResult.data ?? []
      const yesterdayTx   = yesterdayTxResult.data ?? []
      const activeShifts  = activeShiftsResult.count ?? 0
      const allProds      = (allProdsResult.data ?? []) as { id: string; name: string; stock_qty: number; min_stock: number; unit: string }[]
      const chartTx       = chartTxResult.data ?? []
      const topItems      = topItemsResult.data ?? []

      // Derived metrics
      const todayRevenue    = todayTx.reduce((s, t) => s + Number(t.total), 0)
      const todayTxCount    = todayTx.length
      const yesterdayRevenue = yesterdayTx.reduce((s, t) => s + Number(t.total), 0)
      const yesterdayTxCount = yesterdayTx.length
      const critical   = allProds.filter((p) => p.stock_qty > 0 && p.min_stock > 0 && p.stock_qty <= p.min_stock)
      const outOfStock = allProds.filter((p) => p.stock_qty <= 0)

      // Group chart data by date
      const dateMap = new Map<string, { revenue: number; txCount: number }>()
      for (let i = 6; i >= 0; i--) dateMap.set(localDateStr(i), { revenue: 0, txCount: 0 })
      ;(chartTx as { created_at: string; total: number }[]).forEach((tx) => {
        const d = tx.created_at.split('T')[0]
        const entry = dateMap.get(d)
        if (entry) { entry.revenue += Number(tx.total); entry.txCount += 1 }
      })
      const chart: ChartPoint[] = Array.from(dateMap.entries()).map(([date, v]) => ({
        date: fmt(date), fullDate: date, revenue: v.revenue, txCount: v.txCount,
      }))

      type TopRow = {
        product_id: string
        qty: number
        subtotal: number
        products: { name: string } | null
        transactions: { status: string; created_at: string } | null
      }

      const productMap = new Map<string, { name: string; qty: number; revenue: number }>()
      ;((topItems ?? []) as unknown as TopRow[])
        .filter((item) => item.transactions?.status === 'paid')
        .forEach((item) => {
          const existing = productMap.get(item.product_id) ?? { name: item.products?.name ?? '—', qty: 0, revenue: 0 }
          existing.qty += Number(item.qty)
          existing.revenue += Number(item.subtotal)
          productMap.set(item.product_id, existing)
        })

      const topProducts: TopProduct[] = Array.from(productMap.entries())
        .map(([product_id, v]) => ({ product_id, product_name: v.name, total_qty: v.qty, total_revenue: v.revenue }))
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, 5)

      setData({
        metrics: { todayRevenue, todayTxCount, yesterdayRevenue, yesterdayTxCount, activeShifts, criticalStockCount: critical.length, outOfStockCount: outOfStock.length },
        chart,
        topProducts,
        criticalProducts: [...critical, ...outOfStock].slice(0, 8),
      })

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat dashboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchDashboard()
    // Auto-refresh setiap 2 menit
    const interval = setInterval(() => void fetchDashboard(), 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchDashboard])

  return { data, loading, error, refetch: fetchDashboard }
}
