import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { PinKeypad } from '../components/PinKeypad'
import { supabase } from '../lib/supabase'

/* ── Types ─────────────────────────────────────────── */
interface LocationState {
  from?: { pathname?: string }
}

interface CashierListItem {
  id: string
  name: string
}

type LoginMode = 'staff' | 'cashier'
type CashierStep = 'select' | 'pin'

const MAX_PIN = 6

/* ── Component ──────────────────────────────────────── */
export function LoginPage() {
  const { session, signIn, signInWithPin } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const state = location.state as LocationState | null
  const redirectTo = state?.from?.pathname ?? '/dashboard'

  /* Mode: staff (email+pw) | cashier (PIN) */
  const [mode, setMode] = useState<LoginMode>('cashier')

  /* ── Staff login state ── */
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [staffError, setStaffError] = useState('')
  const [staffSubmitting, setStaffSubmitting] = useState(false)

  /* ── Cashier PIN state ── */
  const [cashierStep, setCashierStep] = useState<CashierStep>('select')
  const [cashiers, setCashiers] = useState<CashierListItem[]>([])
  const [loadingCashiers, setLoadingCashiers] = useState(false)
  const [cashiersError, setCashiersError] = useState('')
  const [selectedCashier, setSelectedCashier] = useState<CashierListItem | null>(null)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinSubmitting, setPinSubmitting] = useState(false)

  /* ── Already logged in → redirect ── */
  if (session) {
    return <Navigate to={redirectTo} replace />
  }

  /* ── Fetch cashiers when switching to cashier mode ── */
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (mode !== 'cashier') return

    let cancelled = false
    setLoadingCashiers(true)
    setCashiersError('')

    async function fetchCashiers() {
      try {
        const { data, error } = await supabase.rpc('get_active_cashiers')
        if (cancelled) return
        if (error) {
          setCashiersError('Gagal memuat daftar kasir.')
        } else {
          setCashiers((data ?? []) as CashierListItem[])
        }
      } catch {
        if (!cancelled) setCashiersError('Gagal memuat daftar kasir.')
      } finally {
        if (!cancelled) setLoadingCashiers(false)
      }
    }

    void fetchCashiers()
    return () => { cancelled = true }
  }, [mode])

  /* ── Staff login handler ── */
  async function handleStaffSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStaffSubmitting(true)
    setStaffError('')
    try {
      await signIn(email.trim(), password)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setStaffError(err instanceof Error ? err.message : 'Login gagal.')
    } finally {
      setStaffSubmitting(false)
    }
  }

  /* ── Cashier: select → pin step ── */
  function handleSelectCashier(c: CashierListItem) {
    setSelectedCashier(c)
    setPin('')
    setPinError('')
    setCashierStep('pin')
  }

  /* ── PIN handlers ── */
  function handlePinDigit(digit: string) {
    setPinError('')
    setPin((prev) => (prev.length < MAX_PIN ? prev + digit : prev))
  }

  function handlePinBackspace() {
    setPinError('')
    setPin((prev) => prev.slice(0, -1))
  }

  function handlePinClear() {
    setPinError('')
    setPin('')
  }

  async function handlePinSubmit() {
    if (!selectedCashier) return
    if (pin.length < MAX_PIN) {
      setPinError(`PIN harus ${MAX_PIN} digit.`)
      return
    }

    setPinSubmitting(true)
    setPinError('')

    try {
      await signInWithPin(selectedCashier.id, pin)
      navigate('/pos', { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'PIN salah atau terjadi kesalahan.'
      setPinError(msg)
      setPin('')
    } finally {
      setPinSubmitting(false)
    }
  }

  /* ── Render ── */
  return (
    <main className="login-screen" id="login-screen">
      <section className="login-panel login-panel--wide" aria-labelledby="login-title">
        {/* Brand header */}
        <div className="login-brand">
          <span className="brand-mark large" aria-hidden="true">SP</span>
          <div>
            <h1 id="login-title" className="login-title">SmartPOS</h1>
            <p className="login-subtitle">Sistem Kasir Cerdas</p>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="login-tabs" role="tablist" aria-label="Metode login">
          <button
            id="tab-cashier"
            role="tab"
            className={`login-tab${mode === 'cashier' ? ' active' : ''}`}
            aria-selected={mode === 'cashier'}
            onClick={() => { setMode('cashier'); setCashierStep('select'); setPin(''); setPinError('') }}
          >
            🏷️ Kasir (PIN)
          </button>
          <button
            id="tab-staff"
            role="tab"
            className={`login-tab${mode === 'staff' ? ' active' : ''}`}
            aria-selected={mode === 'staff'}
            onClick={() => { setMode('staff'); setStaffError('') }}
          >
            👤 Owner / Manager
          </button>
        </div>

        {/* ─── CASHIER PIN FLOW ─── */}
        {mode === 'cashier' && (
          <div
            role="tabpanel"
            aria-labelledby="tab-cashier"
            id="panel-cashier"
            className="login-tab-panel"
          >
            {cashierStep === 'select' ? (
              /* Step 1: pick a cashier */
              <div className="cashier-select">
                <p className="cashier-select-label">Pilih nama kasir Anda:</p>

                {loadingCashiers && (
                  <div className="loading-panel">
                    <span className="spinner" aria-hidden="true" />
                    <span>Memuat daftar kasir…</span>
                  </div>
                )}

                {cashiersError && (
                  <p className="form-error">{cashiersError}</p>
                )}

                {!loadingCashiers && cashiers.length === 0 && !cashiersError && (
                  <div className="empty-state">
                    <p>Belum ada kasir aktif dengan PIN.<br />Hubungi owner untuk menyiapkan akun.</p>
                  </div>
                )}

                {!loadingCashiers && cashiers.length > 0 && (
                  <ul className="cashier-list" role="listbox" aria-label="Daftar kasir">
                    {cashiers.map((c) => (
                      <li key={c.id} role="option" aria-selected={false}>
                        <button
                          id={`cashier-btn-${c.id}`}
                          type="button"
                          className="cashier-list-item"
                          onClick={() => handleSelectCashier(c)}
                        >
                          <span className="cashier-avatar" aria-hidden="true">
                            {c.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="cashier-name">{c.name}</span>
                          <span className="cashier-arrow" aria-hidden="true">›</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              /* Step 2: enter PIN */
              <div className="cashier-pin-step">
                <div className="cashier-pin-header">
                  <button
                    type="button"
                    id="pin-back-btn"
                    className="pin-back-btn"
                    onClick={() => { setCashierStep('select'); setPin(''); setPinError('') }}
                    aria-label="Kembali ke pilih kasir"
                  >
                    ← Ganti kasir
                  </button>
                  <div className="cashier-selected-info">
                    <span className="cashier-avatar cashier-avatar--lg" aria-hidden="true">
                      {selectedCashier!.name.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <strong>{selectedCashier!.name}</strong>
                      <p className="cashier-pin-hint">Masukkan PIN 6 digit</p>
                    </div>
                  </div>
                </div>

                <PinKeypad
                  pin={pin}
                  maxLength={MAX_PIN}
                  loading={pinSubmitting}
                  error={pinError}
                  onDigit={handlePinDigit}
                  onBackspace={handlePinBackspace}
                  onClear={handlePinClear}
                  onSubmit={handlePinSubmit}
                />
              </div>
            )}
          </div>
        )}

        {/* ─── STAFF EMAIL/PASSWORD FLOW ─── */}
        {mode === 'staff' && (
          <div
            role="tabpanel"
            aria-labelledby="tab-staff"
            id="panel-staff"
            className="login-tab-panel"
          >
            <form className="login-form" onSubmit={handleStaffSubmit} noValidate>
              <label htmlFor="login-email">
                Email
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="owner@toko.com"
                  required
                />
              </label>

              <label htmlFor="login-password">
                Password
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                />
              </label>

              {staffError ? <p className="form-error">{staffError}</p> : null}

              <button
                id="staff-login-btn"
                type="submit"
                className="primary-button"
                disabled={staffSubmitting}
              >
                {staffSubmitting ? 'Memproses…' : 'Masuk'}
              </button>
            </form>
          </div>
        )}

        <p className="login-footer">SmartPOS © {new Date().getFullYear()}</p>
      </section>
    </main>
  )
}
