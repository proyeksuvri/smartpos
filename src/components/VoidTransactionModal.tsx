import { useState } from 'react'
import type { Transaction } from '../hooks/useTransactions'
import { useVoidTransaction } from '../hooks/useTransactions'

/* ── Helpers ────────────────────────────────────────────── */
function formatRp(v: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(v)
}

const VOID_REASONS = [
  'Salah input produk',
  'Salah harga',
  'Permintaan pelanggan',
  'Produk tidak tersedia',
  'Pembayaran dibatalkan',
  'Lainnya',
]

/* ── Props ──────────────────────────────────────────────── */
interface VoidTransactionModalProps {
  transaction: Transaction
  voidedBy: string         // user.id dari auth
  onSuccess: () => void    // callback setelah void berhasil
  onClose: () => void
}

/* ── Modal ──────────────────────────────────────────────── */
export function VoidTransactionModal({
  transaction,
  voidedBy,
  onSuccess,
  onClose,
}: VoidTransactionModalProps) {
  const [selectedReason, setSelectedReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const { voidTransaction, loading, error } = useVoidTransaction()

  const finalReason = selectedReason === 'Lainnya' ? customReason.trim() : selectedReason
  const canSubmit = finalReason.length > 0 && confirmed && !loading

  async function handleVoid() {
    if (!canSubmit) return
    const result = await voidTransaction(transaction.id, finalReason, voidedBy)
    if (result.success) onSuccess()
  }

  return (
    <div
      className="pm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="void-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="pm-sheet void-modal-sheet">

        {/* Header */}
        <div className="pm-header">
          <div className="pm-header-info">
            <span className="pm-eyebrow void-eyebrow">⚠️ Pembatalan</span>
            <h2 id="void-title" className="pm-title">Void Transaksi</h2>
          </div>
          <button type="button" className="pm-close" onClick={onClose} aria-label="Tutup">✕</button>
        </div>

        <div className="void-modal-body">
          {/* Transaction Summary */}
          <div className="void-tx-summary">
            <div className="void-tx-row">
              <span>Invoice</span>
              <strong>{transaction.invoice_no}</strong>
            </div>
            <div className="void-tx-row">
              <span>Tanggal</span>
              <span>{new Date(transaction.created_at).toLocaleString('id-ID', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}</span>
            </div>
            <div className="void-tx-row">
              <span>Kasir</span>
              <span>{transaction.profiles?.name ?? '—'}</span>
            </div>
            <div className="void-tx-row void-tx-total">
              <span>Total</span>
              <strong className="void-total-amount">{formatRp(transaction.total)}</strong>
            </div>
          </div>

          {/* Warning */}
          <div className="void-warning">
            <span className="void-warning-icon">🔄</span>
            <div>
              <strong>Stok akan dikembalikan</strong>
              <p>Semua produk dalam transaksi ini akan dikembalikan ke stok secara otomatis.</p>
            </div>
          </div>

          {/* Reason Selection */}
          <div className="void-reason-section">
            <label className="pm-label">Alasan Void <span className="pm-req">*</span></label>
            <div className="void-reason-chips">
              {VOID_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`void-reason-chip ${selectedReason === r ? 'active' : ''}`}
                  onClick={() => { setSelectedReason(r); setCustomReason('') }}
                >
                  {r}
                </button>
              ))}
            </div>

            {selectedReason === 'Lainnya' && (
              <textarea
                className="void-custom-reason"
                placeholder="Tulis alasan void yang lebih spesifik..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                rows={3}
                maxLength={200}
              />
            )}
          </div>

          {/* Confirmation checkbox */}
          <label className="void-confirm-check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>Saya konfirmasi pembatalan transaksi <strong>{transaction.invoice_no}</strong> sebesar <strong>{formatRp(transaction.total)}</strong> tidak dapat dibatalkan.</span>
          </label>

          {/* Error */}
          {error && <p className="form-error">{error}</p>}

          {/* Actions */}
          <div className="void-actions">
            <button type="button" className="ghost-button" onClick={onClose} disabled={loading}>
              Batal
            </button>
            <button
              type="button"
              className="danger-button"
              onClick={() => void handleVoid()}
              disabled={!canSubmit}
            >
              {loading ? '⏳ Memproses...' : '🗑️ Void Transaksi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
