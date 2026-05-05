import { useRef, useState } from 'react'
import type { CartItem } from '../hooks/useCart'
import '../styles/SimpleModal.css'
import './PaymentModal.css'

interface PaymentModalProps {
  items: CartItem[]
  subtotal: number
  txDiscount: number
  total: number
  onConfirm: (method: 'cash' | 'transfer' | 'mixed', cashPaid: number) => Promise<void>
  onClose: () => void
}

function formatRp(v: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v)
}

const QUICK_CASH = [10000, 20000, 50000, 100000, 50000, 200000]

export function PaymentModal({ subtotal, txDiscount, total, onConfirm, onClose }: PaymentModalProps) {
  const [method, setMethod] = useState<'cash' | 'transfer' | 'mixed'>('cash')
  const [cashPaid, setCashPaid] = useState(total)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  const change = Math.max(0, cashPaid - total)
  const cashOnly = method === 'cash'

  function roundUp(v: number, to: number) {
    return Math.ceil(v / to) * to
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (cashOnly && cashPaid < total) {
      setError('Uang yang dibayarkan kurang dari total.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onConfirm(method, cashOnly ? cashPaid : total)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memproses pembayaran.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sm-backdrop pay-backdrop" role="dialog" aria-modal="true">
      <div className="sm-sheet pay-sheet">
        <div className="sm-header">
          <div className="sm-header-info">
            <span className="sm-eyebrow">Pembayaran</span>
            <h2 className="sm-title">Total: {formatRp(total)}</h2>
          </div>
          <button type="button" className="sm-close" onClick={onClose}>✕</button>
        </div>

        <form ref={formRef} onSubmit={(e) => void handleSubmit(e)} className="sm-body">
          {/* Summary */}
          <div className="pay-summary">
            <div className="pay-row"><span>Subtotal</span><span>{formatRp(subtotal)}</span></div>
            {txDiscount > 0 && (
              <div className="pay-row discount"><span>Diskon Transaksi</span><span>-{formatRp(txDiscount)}</span></div>
            )}
            <div className="pay-row total"><span>Total</span><strong>{formatRp(total)}</strong></div>
          </div>

          {/* Method */}
          <div className="sm-field">
            <label className="sm-label">Metode Pembayaran</label>
            <div className="pay-methods">
              {(['cash', 'transfer', 'mixed'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`pay-method-btn ${method === m ? 'active' : ''}`}
                  onClick={() => setMethod(m)}
                >
                  {m === 'cash' ? '💵 Tunai' : m === 'transfer' ? '💳 Transfer' : '🔀 Campuran'}
                </button>
              ))}
            </div>
          </div>

          {/* Cash input */}
          {cashOnly && (
            <>
              <div className="sm-field">
                <label className="sm-label" htmlFor="cash-paid">Uang Dibayar</label>
                <div className="sm-input-prefix">
                  <span className="sm-prefix">Rp</span>
                  <input
                    id="cash-paid"
                    className="sm-input has-prefix"
                    type="number"
                    min={total}
                    step="any"
                    value={cashPaid}
                    onChange={(e) => setCashPaid(parseFloat(e.target.value) || 0)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Quick cash buttons */}
              <div className="pay-quick">
                <button type="button" className="pay-quick-btn" onClick={() => setCashPaid(total)}>
                  Uang Pas
                </button>
                {QUICK_CASH.filter((v) => v >= total || v === roundUp(total, v)).slice(0, 4).map((v) => {
                  const rounded = roundUp(total, v)
                  return (
                    <button key={v} type="button" className="pay-quick-btn" onClick={() => setCashPaid(rounded)}>
                      {formatRp(rounded)}
                    </button>
                  )
                })}
              </div>

              {/* Change */}
              <div className={`pay-change ${change > 0 ? 'has-change' : ''}`}>
                <span>Kembalian</span>
                <strong>{formatRp(change)}</strong>
              </div>
            </>
          )}

          {method === 'transfer' && (
            <div className="pay-info">💳 Konfirmasi transfer sebelum menekan Proses Bayar.</div>
          )}

          {error && <div className="sm-error">{error}</div>}
        </form>

        <div className="sm-footer">
          <button type="button" className="sm-btn-cancel" onClick={onClose}>Batal</button>
          <button type="button" className="sm-btn-save pay-confirm-btn" disabled={saving} onClick={() => formRef.current?.requestSubmit()}>
            {saving ? '⟳ Memproses...' : '✅ Proses Bayar'}
          </button>
        </div>
      </div>
    </div>
  )
}
