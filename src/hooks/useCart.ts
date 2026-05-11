import { useCallback, useState } from 'react'
import type { Product } from '../types/database'

export interface CartItem {
  product: Product
  qty: number
  unitPrice: number
  discount: number
  subtotal: number
  isWholesale: boolean
}

function calcItem(product: Product, qty: number, discount: number): CartItem {
  const isWholesale = product.price_wholesale > 0 && product.wholesale_min_qty > 0 && qty >= product.wholesale_min_qty
  const unitPrice = isWholesale ? product.price_wholesale : product.price_retail
  const subtotal = Math.max(0, unitPrice * qty - discount)
  return { product, qty, unitPrice, discount, subtotal, isWholesale }
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([])
  const [txDiscount, setTxDiscount] = useState(0)

  const addItem = useCallback((product: Product, qty = 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id)
      if (idx >= 0) {
        const updated = [...prev]
        const existing = updated[idx]
        const newQty = existing.qty + qty
        updated[idx] = calcItem(product, newQty, existing.discount)
        return updated
      }
      return [...prev, calcItem(product, qty, 0)]
    })
  }, [])

  const setQty = useCallback((productId: string, qty: number) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((i) => i.product.id !== productId))
      return
    }
    setItems((prev) =>
      prev.map((i) => (i.product.id === productId ? calcItem(i.product, qty, i.discount) : i)),
    )
  }, [])

  const setItemDiscount = useCallback((productId: string, discount: number) => {
    setItems((prev) =>
      prev.map((i) => (i.product.id === productId ? calcItem(i.product, i.qty, discount) : i)),
    )
  }, [])

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId))
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    setTxDiscount(0)
  }, [])

  const subtotal = items.reduce((acc, i) => acc + i.subtotal, 0)
  const total = Math.max(0, subtotal - txDiscount)
  const itemCount = items.reduce((acc, i) => acc + i.qty, 0)

  return {
    items,
    txDiscount,
    setTxDiscount,
    subtotal,
    total,
    itemCount,
    addItem,
    setQty,
    setItemDiscount,
    removeItem,
    clearCart,
  }
}
