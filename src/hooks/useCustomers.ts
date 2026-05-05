import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Customer, CustomerInsert, CustomerUpdate } from '../types/database'

interface UseCustomersOptions {
  search?: string
  showInactive?: boolean
}

export function useCustomers(options: UseCustomersOptions = {}) {
  const { search = '', showInactive = false } = options

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    setError(null)

    let query = supabase
      .from('customers')
      .select('id, name, phone, type, address, credit_limit, is_active, created_at, updated_at')
      .order('name')

    if (!showInactive) query = query.eq('is_active', true)
    if (search.trim()) query = query.ilike('name', `%${search.trim()}%`)

    const { data, error: err } = await query

    if (err) {
      setError(err.message)
    } else {
      setCustomers((data ?? []) as Customer[])
    }

    setLoading(false)
  }, [search, showInactive])

  useEffect(() => {
    const t = setTimeout(() => void fetchCustomers(), search ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchCustomers, search])

  const createCustomer = useCallback(async (payload: CustomerInsert) => {
    const { data, error: err } = await supabase
      .from('customers')
      .insert(payload)
      .select()
      .single()

    if (err) throw new Error(err.message)
    const created = data as Customer
    setCustomers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
    return created
  }, [])

  const updateCustomer = useCallback(async (id: string, payload: CustomerUpdate) => {
    const { data, error: err } = await supabase
      .from('customers')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (err) throw new Error(err.message)
    const updated = data as Customer
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? updated : c)).sort((a, b) => a.name.localeCompare(b.name)),
    )
    return updated
  }, [])

  const deleteCustomer = useCallback(async (id: string) => {
    const { error: err } = await supabase
      .from('customers')
      .update({ is_active: false })
      .eq('id', id)

    if (err) throw new Error(err.message)
    setCustomers((prev) => prev.filter((c) => c.id !== id))
  }, [])

  return { customers, loading, error, refetch: fetchCustomers, createCustomer, updateCustomer, deleteCustomer }
}
