import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'

interface CashierProfile {
  id: string
  name: string
  role: 'cashier'
}

export function usePinLogin() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchActiveCashiers = useCallback(async (): Promise<CashierProfile[]> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, role')
      .eq('role', 'cashier')
      .eq('is_active', true)
      .not('pin_hash', 'is', null)
      .order('name')

    if (error) throw error
    return (data ?? []) as CashierProfile[]
  }, [])

  const verifyPin = useCallback(
    async (cashierId: string, pin: string): Promise<boolean> => {
      setLoading(true)
      setError('')

      try {
        const { data, error } = await supabase.rpc('verify_cashier_pin', {
          p_cashier_id: cashierId,
          p_pin: pin,
        })

        if (error) {
          throw error
        }

        return data === true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Verifikasi PIN gagal.')
        return false
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const loginWithPin = useCallback(
    async (cashierId: string, pin: string): Promise<boolean> => {
      setError('')

      // First verify PIN
      const pinValid = await verifyPin(cashierId, pin)
      if (!pinValid) {
        setError('PIN yang dimasukkan salah.')
        return false
      }

      // PIN is 6-digit placeholder for this demo
      // In production, this would use a special auth flow
      // For now, we use email/password with a shared cashier account
      // or we could use anonymous auth tied to the cashier profile
      setLoading(false)
      return true
    },
    [verifyPin],
  )

  return {
    loading,
    error,
    setError,
    fetchActiveCashiers,
    verifyPin,
    loginWithPin,
  }
}
