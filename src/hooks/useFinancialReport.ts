import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'

/* ── Types ──────────────────────────────────────────────── */
export interface ProductProfitRow {
  product_id:    string
  product_name:  string
  category_name: string | null
  unit:          string
  qty_sold:      number
  revenue:       number   // total harga jual (subtotal item)
  cogs:          number   // qty × cost_price saat terjual
  gross_profit:  number   // revenue − cogs
  gross_margin:  number   // % (gross_profit / revenue * 100)
}

export interface FinancialSummary {
  /* Pendapatan */
  revenueGross:       number   // subtotal sebelum diskon
  totalDiscount:      number   // total semua diskon
  revenue:            number   // omset bersih (setelah diskon)
  /* Biaya Pokok */
  cogs:               number   // HPP Total
  /* Laba Kotor */
  grossProfit:        number
  grossMargin:        number   // %
  /* Diskon */
  discountImpact:     number   // % diskon terhadap revenueGross
  /* Biaya Operasional */
  operationalCosts:   number   // dari tabel operational_costs
  /* Laba Bersih */
  netProfit:          number   // grossProfit − operationalCosts
  netMargin:          number   // %
  /* Void */
  voidedValue:        number   // total nilai void
  voidedCount:        number
  /* Statistik */
  totalTransactions:  number
  avgProfitPerTrx:    number
  /* Breakdown per produk */
  productBreakdown:   ProductProfitRow[]
}

/* ── Hook ───────────────────────────────────────────────── */
export function useFinancialReport() {
  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const fetch = useCallback(async (dateFrom: string, dateTo: string) => {
    setLoading(true); setError(null)
    try {
      /* ── 1. Ambil transaction_items yang terkait transaksi paid ── */
      const { data: items, error: iErr } = await supabase
        .from('transaction_items')
        .select(`
          qty, subtotal,
          products ( id, name, unit, cost_price, categories ( name ) ),
          transactions!transaction_id ( status, subtotal, discount, total, created_at )
        `)
        .gte('transactions.created_at', `${dateFrom}T00:00:00`)
        .lte('transactions.created_at', `${dateTo}T23:59:59`)
        .limit(10000)

      if (iErr) throw iErr

      /* ── 2. Ambil transaksi void untuk hitung nilai void ── */
      const { data: voidedTx, error: vErr } = await supabase
        .from('transactions')
        .select('id, total')
        .eq('status', 'voided')
        .gte('created_at', `${dateFrom}T00:00:00`)
        .lte('created_at', `${dateTo}T23:59:59`)

      if (vErr) throw vErr

      /* ── 3. Ambil biaya operasional periode yang sama ── */
      const { data: opCosts, error: oErr } = await supabase
        .from('operational_costs')
        .select('amount')
        .gte('cost_date', dateFrom)
        .lte('cost_date', dateTo)

      if (oErr) throw oErr

      /* ── 4. Kalkulasi ── */
      type RawItem = {
        qty:      number
        subtotal: number
        products: {
          id: string; name: string; unit: string; cost_price: number
          categories: { name: string } | null
        } | null
        transactions: {
          status: string; subtotal: number; discount: number; total: number; created_at: string
        } | null
      }

      // Filter hanya item dari transaksi paid (JOIN lewat supabase bisa return null utk filtered rows)
      const paidItems = ((items ?? []) as unknown as RawItem[])
        .filter((r) => r.transactions?.status === 'paid')

      // Set untuk hitung unique transaksi
      const paidTxSet = new Set<string>()

      // Aggregate per transaksi (satu transaksi bisa banyak item)
      let revenueGross   = 0
      let totalDiscount  = 0
      let revenue        = 0
      let cogs           = 0

      // Kumpulkan data per produk
      const productMap = new Map<string, ProductProfitRow>()

      // Kita butuh aggregate subtotal & discount dari transaksi unik
      // Gunakan pendekatan: kumpulkan data dari items, lalu aggregate
      const txDataMap = new Map<string, { subtotal: number; discount: number; total: number }>()

      for (const r of paidItems) {
        if (!r.transactions || !r.products) continue

        // Track transaksi unik
        // Tidak ada tx id di sini, gunakan kombinasi nilai (sudah pasti paid)
        // Cara terbaik: aggregate dari field transaksi langsung per produk
        const txKey = `${r.transactions.subtotal}-${r.transactions.discount}-${r.transactions.total}-${r.transactions.created_at}`
        if (!txDataMap.has(txKey)) {
          txDataMap.set(txKey, {
            subtotal: Number(r.transactions.subtotal),
            discount: Number(r.transactions.discount),
            total:    Number(r.transactions.total),
          })
          paidTxSet.add(txKey)
        }

        const qty      = Number(r.qty)
        const itemSub  = Number(r.subtotal)
        const itemCogs = qty * Number(r.products.cost_price)

        cogs += itemCogs

        // Aggregate per produk
        const existing = productMap.get(r.products.id)
        if (existing) {
          existing.qty_sold     += qty
          existing.revenue      += itemSub
          existing.cogs         += itemCogs
          existing.gross_profit  = existing.revenue - existing.cogs
          existing.gross_margin  = existing.revenue > 0
            ? (existing.gross_profit / existing.revenue) * 100 : 0
        } else {
          productMap.set(r.products.id, {
            product_id:    r.products.id,
            product_name:  r.products.name,
            category_name: r.products.categories?.name ?? null,
            unit:          r.products.unit,
            qty_sold:      qty,
            revenue:       itemSub,
            cogs:          itemCogs,
            gross_profit:  itemSub - itemCogs,
            gross_margin:  itemSub > 0 ? ((itemSub - itemCogs) / itemSub) * 100 : 0,
          })
        }
      }

      // Hitung revenueGross, discount, revenue dari transaksi unik
      for (const tx of txDataMap.values()) {
        revenueGross  += tx.subtotal
        totalDiscount += tx.discount
        revenue       += tx.total
      }

      // Laba kotor
      const grossProfit = revenue - cogs
      const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0

      // Dampak diskon
      const discountImpact = revenueGross > 0 ? (totalDiscount / revenueGross) * 100 : 0

      // Biaya operasional
      const operationalCosts = (opCosts ?? []).reduce((s, c) => s + Number(c.amount), 0)

      // Laba bersih
      const netProfit = grossProfit - operationalCosts
      const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0

      // Void
      const voidedValue = (voidedTx ?? []).reduce((s, t) => s + Number(t.total), 0)
      const voidedCount = (voidedTx ?? []).length

      // Statistik
      const totalTransactions = paidTxSet.size
      const avgProfitPerTrx   = totalTransactions > 0 ? grossProfit / totalTransactions : 0

      // Sort produk: margin tertinggi
      const productBreakdown = Array.from(productMap.values())
        .sort((a, b) => b.gross_profit - a.gross_profit)

      setSummary({
        revenueGross,
        totalDiscount,
        revenue,
        cogs,
        grossProfit,
        grossMargin,
        discountImpact,
        operationalCosts,
        netProfit,
        netMargin,
        voidedValue,
        voidedCount,
        totalTransactions,
        avgProfitPerTrx,
        productBreakdown,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat laporan keuangan.')
    } finally { setLoading(false) }
  }, [])

  return { summary, loading, error, fetch }
}
