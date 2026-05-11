import { useEffect, useState } from 'react'
import { db, type CachedProductUnit } from '../lib/db'
import { supabase } from '../lib/supabase'

/**
 * useProductUnits — mengambil unit partai produk dari IndexedDB cache.
 *
 * Digunakan di POS page dan ProductModal untuk menampilkan pilihan unit
 * (pcs → pak → karton, dll.).
 *
 * @param productId UUID produk. Jika null/undefined, returns array kosong.
 */
export function useProductUnits(productId: string | null | undefined) {
  const [units, setUnits]   = useState<CachedProductUnit[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!productId) { setUnits([]); return }

    setLoading(true)
    db.product_units_cache
      .where('product_id').equals(productId)
      .sortBy('sort_order')
      .then((rows) => { setUnits(rows); setLoading(false) })
      .catch(() => setLoading(false))
  }, [productId])

  return { units, loading }
}

/* ─── CRUD helpers (untuk ProductModal & ProductPage) ───────────────────────── */

export type UpsertProductUnit = {
  id?: string          // undefined = insert baru
  product_id: string
  unit_name: string
  conversion_factor: number
  sort_order: number
}

/** Simpan (upsert) satu product unit ke Supabase + update cache lokal */
export async function saveProductUnit(payload: UpsertProductUnit): Promise<CachedProductUnit> {
  const { data, error } = await supabase
    .from('product_units')
    .upsert(
      {
        ...(payload.id ? { id: payload.id } : {}),
        product_id:        payload.product_id,
        unit_name:         payload.unit_name,
        conversion_factor: payload.conversion_factor,
        sort_order:        payload.sort_order,
        // price akan di-set otomatis oleh trigger DB
      },
      { onConflict: 'id' }
    )
    .select('id, product_id, unit_name, conversion_factor, price, sort_order')
    .single()

  if (error) throw error

  const saved = data as CachedProductUnit
  // Update cache lokal langsung
  await db.product_units_cache.put(saved)
  return saved
}

/** Hapus satu product unit dari Supabase + cache lokal */
export async function deleteProductUnit(unitId: string): Promise<void> {
  const { error } = await supabase
    .from('product_units')
    .delete()
    .eq('id', unitId)

  if (error) throw error
  await db.product_units_cache.delete(unitId)
}
