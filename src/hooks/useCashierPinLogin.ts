import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface CashierProfile {
  id: string
  name: string
  role: 'cashier'
}

const CASHIER_SESSION_KEY = 'smartpos_cashier_session'

interface CashierSession {
  cashier_id: string
  cashier_name: string
  logged_in_at: string
}

export function useCashierPinLogin() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'select' | 'pin'>('select')
  const [cashiers, setCashiers] = useState<CashierProfile[]>([])
  const [selectedCashier, setSelectedCashier] = useState<CashierProfile | null>(null)
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loadingCashiers, setLoadingCashiers] = useState(false)

  const MAX_PIN_LENGTH = 6

  const fetchCashiers = useCallback(async () => {
    setLoadingCashiers(true)
    setError('')
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, role')
        .eq('role', 'cashier')
        .eq('is_active', true)
        .not('pin_hash', 'is', null)
        .order('name')

      if (error) throw error
      setCashiers((data ?? []) as CashierProfile[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengambil daftar kasir.')
      setCashiers([])
    } finally {
      setLoadingCashiers(false)
    }
  }, [])

  const selectCashier = useCallback((cashier: CashierProfile) => {
    setSelectedCashier(cashier)
    setPin('')
    setError('')
    setStep('pin')
  }, [])

  const handlePinDigit = useCallback((digit: string) => {
    setError('')
    setPin((prev) => {
      if (prev.length < MAX_PIN_LENGTH) {
        return prev + digit
      }
      return prev
    })
  }, [])

  const handlePinBackspace = useCallback(() => {
    setError('')
    setPin((prev) => prev.slice(0, -1))
  }, [])

  const handlePinClear = useCallback(() => {
    setError('')
    setPin('')
  }, [])

  const submitPin = useCallback(async (): Promise<boolean> => {
    if (!selectedCashier) return false
    if (pin.length < MAX_PIN_LENGTH) {
      setError(`PIN harus ${MAX_PIN_LENGTH} digit.`)
      return false
    }

    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase.rpc('verify_cashier_pin', {
        p_cashier_id: selectedCashier.id,
        p_pin: pin,
      })

      if (error) {
        throw error
      }

      if (data !== true) {
        setError('PIN yang dimasukkan salah.')
        setPin('')
        return false
      }

      // PIN verified! Save session to localStorage
      const session: CashierSession = {
        cashier_id: selectedCashier.id,
        cashier_name: selectedCashier.name,
        logged_in_at: new Date().toISOString(),
      }
      localStorage.setItem(CASHIER_SESSION_KEY, JSON.stringify(session))

      // Store cashier context in Supabase auth metadata for API calls
      void supabase.auth.updateUser({
        data: {
          cashier_id: selectedCashier.id,
          cashier_name: selectedCashier.name,
          login_type: 'pin',
        },
      })

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verifikasi PIN gagal.')
      return false
    } finally {
      setLoading(false)
    }
  }, [selectedCashier, pin])

  const goBack = useCallback(() => {
    setSelectedCashier(null)
    setPin('')
    setError('')
    setStep('select')
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(CASHIER_SESSION_KEY)
    setSelectedCashier(null)
    setPin('')
    setError('')
    setStep('select')
    navigate('/login')
  }, [navigate])

  return {
    step,
    cashiers,
    selectedCashier,
    pin,
    loading,
    error,
    loadingCashiers,
    maxPinLength: MAX_PIN_LENGTH,
    fetchCashiers,
    selectCashier,
    handlePinDigit,
    handlePinBackspace,
    handlePinClear,
    submitPin,
    goBack,
    logout,
  }
}

export function getCashierSession(): CashierSession | null {
  try {
    const stored = localStorage.getItem(CASHIER_SESSION_KEY)
    if (!stored) return null
    return JSON.parse(stored) as CashierSession
  } catch {
    return null
  }
}

export function clearCashierSession(): void {
  localStorage.removeItem(CASHIER_SESSION_KEY)
}
