import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export type MovementType =
  | 'purchase'
  | 'return'
  | 'adjustment_in'
  | 'adjustment_out'
  | 'sale'
  | 'void'

export interface StockMovement {
  id: string
  product_id: string
  product_name: string
  type: MovementType
  qty: number
  notes: string | null
  created_by: string | null
  created_by_name: string | null
  created_at: string
}

export interface StockProduct {
  id: string
  name: string
  sku: string | null
  stock_qty: number
  min_stock: number
  unit: string
  category_name: string | null
}

const TYPE_LABEL: Record<MovementType, string> = {
  purchase: 'Stok Masuk',
  return: 'Retur',
  adjustment_in: 'Penyesuaian +',
  adjustment_out: 'Penyesuaian −',
  sale: 'Penjualan',
  void: 'Void',
}

export { TYPE_LABEL }

/* ── Business Rules: Stock Status ────────────────────────────── */

/** Status ketersediaan stok berdasarkan business rule */
export type StockStatus = 'ok' | 'low' | 'empty'

/**
 * Tentukan status stok sebuah produk.
 * Business rule:
 * - 'empty' → stok ≤ 0
 * - 'low'   → stok > 0 tapi ≤ min_stock
 * - 'ok'    → stok > min_stock (atau min_stock tidak diset)
 */
export function stockStatus(p: Pick<StockProduct, 'stock_qty' | 'min_stock'>): StockStatus {
  if (p.stock_qty <= 0) return 'empty'
  if (p.min_stock > 0 && p.stock_qty <= p.min_stock) return 'low'
  return 'ok'
}

/** Label tampilan untuk setiap status stok */
export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  ok:    'Aman',
  low:   'Kritis',
  empty: 'Habis',
}

export function useStockMovements(productId?: string) {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMovements = useCallback(async () => {
    setLoading(true)
    setError(null)

    let query = supabase
      .from('stock_movements')
      .select(`
        id, product_id, type, qty, notes, created_by, created_at,
        products!product_id ( name ),
        profiles!created_by ( name )
      `)
      .order('created_at', { ascending: false })
      .limit(200)

    if (productId) {
      query = query.eq('product_id', productId)
    }

    const { data, error: err } = await query

    if (err) {
      setError(err.message)
    } else {
      type Row = {
        id: string
        product_id: string
        type: MovementType
        qty: number
        notes: string | null
        created_by: string | null
        created_at: string
        products: { name: string } | null
        profiles: { name: string } | null
      }

      setMovements(
        ((data ?? []) as unknown as Row[]).map((row) => ({
          id: row.id,
          product_id: row.product_id,
          product_name: row.products?.name ?? '—',
          type: row.type,
          qty: Number(row.qty),
          notes: row.notes,
          created_by: row.created_by,
          created_by_name: row.profiles?.name ?? null,
          created_at: row.created_at,
        })),
      )
    }

    setLoading(false)
  }, [productId])

  useEffect(() => {
    void fetchMovements()
  }, [fetchMovements])

  return { movements, loading, error, refetch: fetchMovements }
}

export function useStockProducts() {
  const [products, setProducts] = useState<StockProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('products')
      .select('id, name, sku, stock_qty, min_stock, unit, categories!category_id ( name )')
      .eq('is_active', true)
      .order('name')

    if (err) {
      setError(err.message)
    } else {
      type Row = {
        id: string
        name: string
        sku: string | null
        stock_qty: number
        min_stock: number
        unit: string
        categories: { name: string } | null
      }
      setProducts(
        ((data ?? []) as unknown as Row[]).map((row) => ({
          id: row.id,
          name: row.name,
          sku: row.sku,
          stock_qty: Number(row.stock_qty),
          min_stock: Number(row.min_stock),
          unit: row.unit,
          category_name: row.categories?.name ?? null,
        })),
      )
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchProducts()
  }, [fetchProducts])

  return { products, loading, error, refetch: fetchProducts }
}

export function useStockMutations() {
  const { user } = useAuth()

  const addMovement = useCallback(
    async (payload: {
      product_id: string
      type: MovementType
      qty: number
      notes?: string
    }) => {
      if (!user) throw new Error('User tidak ditemukan')

      const { error } = await supabase.from('stock_movements').insert({
        product_id: payload.product_id,
        type: payload.type,
        qty: payload.qty,
        notes: payload.notes ?? null,
        reference_type: 'manual',
        created_by: user.id,
      })

      if (error) throw new Error(error.message)
    },
    [user],
  )

  return { addMovement }
}
