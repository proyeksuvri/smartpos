import { useCallback, useEffect, useState } from 'react'
import { db, markProductsSynced, isCacheStale, type CachedProduct } from '../lib/db'
import { supabase } from './supabase'

/**
 * useProductCache — mengelola cache produk aktif di IndexedDB.
 *
 * - Saat online: fetch dari Supabase, simpan ke IndexedDB, update timestamp sync
 * - Saat offline: baca langsung dari IndexedDB (produk yang sudah di-cache sebelumnya)
 * - Produk dari cache dipakai oleh PosPage saat offline
 */
export function useProductCache() {
  const [products, setProducts] = useState<CachedProduct[]>([])
  const [loading,  setLoading]  = useState(true)
  const [syncing,  setSyncing]  = useState(false)
  const [stale,    setStale]    = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  /** Baca produk dari IndexedDB (selalu, online maupun offline) */
  const loadFromCache = useCallback(async () => {
    try {
      // Kita ambil semua cache karena saat syncFromServer kita hanya menyimpan yang is_active = true
      const cached = await db.products_cache.toArray()
      setProducts(cached)
    } catch (e) {
      console.error('[Cache] Failed to load from IndexedDB:', e)
    }
  }, [])

  /** Sync dari Supabase → IndexedDB */
  const syncFromServer = useCallback(async (): Promise<boolean> => {
    setSyncing(true); setError(null)
    try {
      const { data, error: err } = await supabase
        .from('products')
        .select(`
          id, name, sku, barcode, category_id, price_retail, price_wholesale,
          wholesale_min_qty, cost_price, stock_qty, min_stock, unit,
          image_url, is_active, updated_at,
          categories ( name )
        `)
        .eq('is_active', true)
        .order('name')
        .limit(2000)

      if (err) throw err

      type RawRow = {
        id: string; name: string; sku: string | null; barcode: string | null
        category_id: string | null; price_retail: number; price_wholesale: number
        wholesale_min_qty: number; cost_price: number; stock_qty: number
        min_stock: number; unit: string; image_url: string | null
        is_active: boolean; updated_at: string
        categories: { name: string } | null
      }

      const rows: CachedProduct[] = ((data ?? []) as unknown as RawRow[]).map((r) => ({
        id:                r.id,
        name:              r.name,
        sku:               r.sku,
        barcode:           r.barcode,
        category_id:       r.category_id,
        category_name:     r.categories?.name ?? null,
        price_retail:      Number(r.price_retail),
        price_wholesale:   Number(r.price_wholesale),
        wholesale_min_qty: Number(r.wholesale_min_qty),
        cost_price:        Number(r.cost_price),
        stock_qty:         Number(r.stock_qty),
        min_stock:         Number(r.min_stock),
        unit:              r.unit,
        image_url:         r.image_url,
        is_active:         r.is_active,
        updated_at:        r.updated_at,
      }))

      // Simpan semua ke IndexedDB (bulkPut = upsert)
      await db.products_cache.clear()
      await db.products_cache.bulkPut(rows)
      await markProductsSynced()

      setProducts(rows)
      setStale(false)
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gagal sync produk'
      setError(msg)
      console.error('[Cache] Sync failed:', e)
      return false
    } finally {
      setSyncing(false)
    }
  }, [])

  /** Inisialisasi: load cache dulu, lalu cek apakah perlu sync */
  useEffect(() => {
    async function init() {
      setLoading(true)
      await loadFromCache()

      // Cek apakah cache sudah terlalu lama
      const staleCheck = await isCacheStale(24)
      setStale(staleCheck)

      // Jika online dan cache stale (atau kosong), sync otomatis
      if (navigator.onLine) {
        const cached = await db.products_cache.count()
        if (cached === 0 || staleCheck) {
          await syncFromServer()
        }
      }

      setLoading(false)
    }

    void init()
  }, [loadFromCache, syncFromServer])

  return { products, loading, syncing, stale, error, syncFromServer, loadFromCache }
}
