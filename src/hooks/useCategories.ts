import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Category, CategoryInsert, CategoryUpdate } from '../types/database'

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCategories = useCallback(async (includeInactive = false) => {
    setLoading(true)
    setError(null)

    let query = supabase
      .from('categories')
      .select('id, name, description, is_active, created_at, updated_at')
      .order('name')

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data, error: err } = await query

    if (err) {
      setError(err.message)
    } else {
      setCategories((data ?? []) as Category[])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchCategories()
  }, [fetchCategories])

  const createCategory = useCallback(async (payload: CategoryInsert) => {
    const { data, error: err } = await supabase
      .from('categories')
      .insert(payload)
      .select()
      .single()

    if (err) throw new Error(err.message)

    const created = data as Category
    setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
    return created
  }, [])

  const updateCategory = useCallback(async (id: string, payload: CategoryUpdate) => {
    const { data, error: err } = await supabase
      .from('categories')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (err) throw new Error(err.message)

    const updated = data as Category
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? updated : c)).sort((a, b) => a.name.localeCompare(b.name)),
    )
    return updated
  }, [])

  const deleteCategory = useCallback(async (id: string) => {
    const { error: err } = await supabase
      .from('categories')
      .update({ is_active: false })
      .eq('id', id)

    if (err) throw new Error(err.message)

    setCategories((prev) => prev.filter((c) => c.id !== id))
  }, [])

  return {
    categories,
    loading,
    error,
    refetch: fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  }
}
