import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface Shift {
  id: string
  cashier_id: string
  opened_at: string
  closed_at: string | null
  opening_cash: number
  closing_cash: number | null
  expected_cash: number | null
  difference: number | null
  status: 'open' | 'closed'
  notes: string | null
}

export function useShift() {
  const { user } = useAuth()
  const [activeShift, setActiveShift] = useState<Shift | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchActiveShift = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)

    const { data } = await supabase
      .from('shifts')
      .select('*')
      .eq('cashier_id', user.id)
      .eq('status', 'open')
      .maybeSingle()

    setActiveShift(data as Shift | null)
    setLoading(false)
  }, [user])

  useEffect(() => {
    void fetchActiveShift()
  }, [fetchActiveShift])

  const openShift = useCallback(async (openingCash: number) => {
    if (!user) throw new Error('User tidak ditemukan')

    const { data, error } = await supabase
      .from('shifts')
      .insert({ cashier_id: user.id, opening_cash: openingCash, status: 'open' })
      .select()
      .single()

    if (error) throw new Error(error.message)
    setActiveShift(data as Shift)
    return data as Shift
  }, [user])

  const closeShift = useCallback(async (shiftId: string, closingCash: number, notes?: string) => {
    const { data: shift } = await supabase
      .from('shifts')
      .select('opening_cash')
      .eq('id', shiftId)
      .single()

    // Calculate expected cash from transactions
    const { data: txSums } = await supabase
      .from('transactions')
      .select('total, payment_method')
      .eq('shift_id', shiftId)
      .eq('status', 'paid')

    const cashTotal = (txSums ?? []).reduce((acc, tx) => {
      if (tx.payment_method === 'cash' || tx.payment_method === 'mixed') {
        return acc + Number(tx.total)
      }
      return acc
    }, 0)

    const expectedCash = Number((shift as { opening_cash: number } | null)?.opening_cash ?? 0) + cashTotal
    const difference = closingCash - expectedCash

    const { data, error } = await supabase
      .from('shifts')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        closing_cash: closingCash,
        expected_cash: expectedCash,
        difference,
        notes: notes ?? null,
      })
      .eq('id', shiftId)
      .select()
      .single()

    if (error) throw new Error(error.message)
    setActiveShift(null)
    return data as Shift
  }, [])

  return { activeShift, loading, openShift, closeShift, refetch: fetchActiveShift }
}
