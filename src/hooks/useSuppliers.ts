import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Supplier, SupplierInsert, SupplierUpdate } from '../types/database'

interface UseSuppliersOptions {
  search?: string
  showInactive?: boolean
}

export function useSuppliers(options: UseSuppliersOptions = {}) {
  const { search = '', showInactive = false } = options

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    setError(null)

    let query = supabase
      .from('suppliers')
      .select('id, name, phone, address, is_active, created_at, updated_at')
      .order('name')

    if (!showInactive) query = query.eq('is_active', true)
    if (search.trim()) query = query.ilike('name', `%${search.trim()}%`)

    const { data, error: err } = await query

    if (err) {
      setError(err.message)
    } else {
      setSuppliers((data ?? []) as Supplier[])
    }

    setLoading(false)
  }, [search, showInactive])

  useEffect(() => {
    const t = setTimeout(() => void fetchSuppliers(), search ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchSuppliers, search])

  const createSupplier = useCallback(async (payload: SupplierInsert) => {
    const { data, error: err } = await supabase
      .from('suppliers')
      .insert(payload)
      .select()
      .single()

    if (err) throw new Error(err.message)
    const created = data as Supplier
    setSuppliers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
    return created
  }, [])

  const updateSupplier = useCallback(async (id: string, payload: SupplierUpdate) => {
    const { data, error: err } = await supabase
      .from('suppliers')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (err) throw new Error(err.message)
    const updated = data as Supplier
    setSuppliers((prev) =>
      prev.map((s) => (s.id === id ? updated : s)).sort((a, b) => a.name.localeCompare(b.name)),
    )
    return updated
  }, [])

  const deleteSupplier = useCallback(async (id: string) => {
    const { error: err } = await supabase
      .from('suppliers')
      .update({ is_active: false })
      .eq('id', id)

    if (err) throw new Error(err.message)
    setSuppliers((prev) => prev.filter((s) => s.id !== id))
  }, [])

  return { suppliers, loading, error, refetch: fetchSuppliers, createSupplier, updateSupplier, deleteSupplier }
}
