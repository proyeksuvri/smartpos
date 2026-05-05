import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Product, ProductInsert, ProductUpdate } from '../types/database'

interface UseProductsOptions {
  search?: string
  categoryId?: string
  showInactive?: boolean
}

export function useProducts(options: UseProductsOptions = {}) {
  const { search = '', categoryId = '', showInactive = false } = options

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError(null)

    let query = supabase
      .from('products')
      .select('*, categories(id, name)')
      .order('name')

    if (!showInactive) {
      query = query.eq('is_active', true)
    }

    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }

    if (search.trim()) {
      query = query.ilike('name', `%${search.trim()}%`)
    }

    const { data, error: err } = await query

    if (err) {
      setError(err.message)
    } else {
      setProducts((data ?? []) as Product[])
    }

    setLoading(false)
  }, [search, categoryId, showInactive])

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchProducts()
    }, search ? 300 : 0)

    return () => clearTimeout(timer)
  }, [fetchProducts, search])

  const createProduct = useCallback(async (payload: ProductInsert) => {
    const { data, error: err } = await supabase
      .from('products')
      .insert(payload)
      .select('*, categories(id, name)')
      .single()

    if (err) throw new Error(err.message)

    setProducts((prev) => [...prev, data as Product].sort((a, b) => a.name.localeCompare(b.name)))
    return data as Product
  }, [])

  const updateProduct = useCallback(async (id: string, payload: ProductUpdate) => {
    const { data, error: err } = await supabase
      .from('products')
      .update(payload)
      .eq('id', id)
      .select('*, categories(id, name)')
      .single()

    if (err) throw new Error(err.message)

    setProducts((prev) =>
      prev
        .map((p) => (p.id === id ? (data as Product) : p))
        .sort((a, b) => a.name.localeCompare(b.name)),
    )
    return data as Product
  }, [])

  const deleteProduct = useCallback(async (id: string) => {
    const { error: err } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id)

    if (err) throw new Error(err.message)

    setProducts((prev) => prev.filter((p) => p.id !== id))
  }, [])

  return {
    products,
    loading,
    error,
    refetch: fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
  }
}
