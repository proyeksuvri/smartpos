import { useCallback, useState } from 'react'
import type { Product } from '../types/database'
import type { CachedProductUnit } from '../lib/db'

/* ─── Types ─────────────────────────────────────────────────────────────────── */

export interface CartItem {
  product:     Product
  /**
   * null  = unit dasar (pcs, kg, dll.)
   * object = unit partai yang dipilih (pak, karton, dll.)
   */
  unit:        CachedProductUnit | null
  qty:         number        // qty dalam unit yang dipilih (mis. 2 pak)
  qtyInBase:   number        // qty dalam unit dasar untuk stok & checkout (mis. 20 pcs)
  unitPrice:   number        // harga per unit yang dipilih
  unitLabel:   string        // label unit yang tampil ('pcs', 'pak', dll.)
  discount:    number
  subtotal:    number
  /**
   * true HANYA jika:
   *  - unit dasar (bukan partai)
   *  - price_wholesale > 0 && wholesale_min_qty > 0
   *  - qty >= wholesale_min_qty
   */
  isWholesale: boolean
}

/* ─── Core calculation ──────────────────────────────────────────────────────── */

function calcItem(
  product: Product,
  qty: number,
  discount: number,
  unit: CachedProductUnit | null = null,
): CartItem {
  const isBulk = unit !== null

  // Qty dikonversi ke unit dasar
  const qtyInBase = isBulk
    ? Math.round(qty * (unit.conversion_factor ?? 1) * 1000) / 1000
    : qty

  // Grosir HANYA untuk mode satuan (unit dasar)
  const isWholesale = !isBulk
    && product.price_wholesale > 0
    && product.wholesale_min_qty > 0
    && qty >= product.wholesale_min_qty

  // Harga per unit
  const unitPrice = isBulk
    ? (unit.price ?? 0)
    : isWholesale
      ? product.price_wholesale
      : product.price_retail

  const unitLabel = isBulk ? unit.unit_name : product.unit
  const subtotal  = Math.max(0, unitPrice * qty - discount)

  return { product, unit, qty, qtyInBase, unitPrice, unitLabel, discount, subtotal, isWholesale }
}

/* ─── Hook ──────────────────────────────────────────────────────────────────── */

export function useCart() {
  const [items, setItems]           = useState<CartItem[]>([])
  const [txDiscount, setTxDiscount] = useState(0)

  /**
   * Tambah produk ke keranjang.
   * Produk + unit berbeda = baris terpisah (mis. "Mie Instan [pcs]" ≠ "Mie Instan [pak]")
   */
  const addItem = useCallback((
    product: Product,
    qty = 1,
    unit: CachedProductUnit | null = null,
  ) => {
    setItems((prev) => {
      const unitId = unit?.id ?? null
      const idx    = prev.findIndex(
        (i) => i.product.id === product.id && (i.unit?.id ?? null) === unitId
      )
      if (idx >= 0) {
        const updated = [...prev]
        const existing = updated[idx]
        updated[idx] = calcItem(product, existing.qty + qty, existing.discount, unit)
        return updated
      }
      return [...prev, calcItem(product, qty, 0, unit)]
    })
  }, [])

  /**
   * Set qty untuk kombinasi product+unit tertentu.
   * qty <= 0 → hapus baris.
   */
  const setQty = useCallback((
    productId: string,
    unitId: string | null,
    qty: number,
  ) => {
    if (qty <= 0) {
      setItems((prev) =>
        prev.filter((i) => !(i.product.id === productId && (i.unit?.id ?? null) === unitId))
      )
      return
    }
    setItems((prev) =>
      prev.map((i) =>
        i.product.id === productId && (i.unit?.id ?? null) === unitId
          ? calcItem(i.product, qty, i.discount, i.unit)
          : i
      )
    )
  }, [])

  /** Update diskon per item */
  const setItemDiscount = useCallback((
    productId: string,
    unitId: string | null,
    discount: number,
  ) => {
    setItems((prev) =>
      prev.map((i) =>
        i.product.id === productId && (i.unit?.id ?? null) === unitId
          ? calcItem(i.product, i.qty, discount, i.unit)
          : i
      )
    )
  }, [])

  /** Hapus satu baris dari keranjang */
  const removeItem = useCallback((productId: string, unitId: string | null = null) => {
    setItems((prev) =>
      prev.filter((i) => !(i.product.id === productId && (i.unit?.id ?? null) === unitId))
    )
  }, [])

  /** Kosongkan seluruh keranjang */
  const clearCart = useCallback(() => {
    setItems([])
    setTxDiscount(0)
  }, [])

  const subtotal  = items.reduce((acc, i) => acc + i.subtotal, 0)
  const total     = Math.max(0, subtotal - txDiscount)
  const itemCount = items.reduce((acc, i) => acc + i.qty, 0)

  return {
    items,
    txDiscount, setTxDiscount,
    subtotal, total, itemCount,
    addItem, setQty, setItemDiscount,
    removeItem, clearCart,
  }
}
