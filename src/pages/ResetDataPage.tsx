import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

/* ── Reset target config ────────────────────────────────── */
interface ResetCard {
  target: string
  icon: string
  title: string
  description: string
  affected: string[]
  danger: 'medium' | 'high' | 'critical'
}

const RESET_CARDS: ResetCard[] = [
  {
    target: 'transactions',
    icon: '🧾',
    title: 'Reset Transaksi',
    description: 'Hapus seluruh riwayat transaksi penjualan, item transaksi, pergerakan stok, dan data shift kasir.',
    affected: ['transactions', 'transaction_items', 'stock_movements', 'shifts'],
    danger: 'high',
  },
  {
    target: 'products',
    icon: '📦',
    title: 'Reset Produk & Kategori',
    description: 'Hapus semua produk dan kategori. Otomatis menghapus transaksi terkait terlebih dahulu.',
    affected: ['products', 'categories', 'transaction_items', 'transactions', 'stock_movements'],
    danger: 'high',
  },
  {
    target: 'customers',
    icon: '👥',
    title: 'Reset Data Customer',
    description: 'Hapus semua data pelanggan. Transaksi yang terkait tidak ikut terhapus.',
    affected: ['customers'],
    danger: 'medium',
  },
  {
    target: 'suppliers',
    icon: '🚚',
    title: 'Reset Data Supplier',
    description: 'Hapus semua data supplier beserta relasi produk-supplier.',
    affected: ['suppliers', 'product_suppliers'],
    danger: 'medium',
  },
  {
    target: 'operational_costs',
    icon: '💸',
    title: 'Reset Biaya Operasional',
    description: 'Hapus seluruh catatan biaya operasional.',
    affected: ['operational_costs'],
    danger: 'medium',
  },
  {
    target: 'audit_logs',
    icon: '📋',
    title: 'Reset Log & Notifikasi',
    description: 'Bersihkan audit log dan riwayat notifikasi sistem.',
    affected: ['audit_logs', 'notification_log'],
    danger: 'medium',
  },
  {
    target: 'all',
    icon: '⚠️',
    title: 'Reset Semua Data',
    description: 'Hapus SEMUA data bisnis (transaksi, produk, pelanggan, supplier, log). Profil akun dan pengaturan tidak terpengaruh.',
    affected: ['transactions', 'transaction_items', 'products', 'categories', 'customers', 'suppliers', 'stock_movements', 'shifts', 'operational_costs', 'audit_logs', 'notification_log', 'product_suppliers'],
    danger: 'critical',
  },
]

/* ── Component ──────────────────────────────────────────── */
export function ResetDataPage() {
  const { session } = useAuth()
  const token = session?.access_token ?? ''

  const [selected, setSelected]   = useState<ResetCard | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult]        = useState<{ success: boolean; message: string } | null>(null)

  function openModal(card: ResetCard) {
    setSelected(card)
    setConfirmText('')
    setResult(null)
  }

  function closeModal() {
    if (submitting) return
    setSelected(null)
    setConfirmText('')
    setResult(null)
  }

  async function handleReset() {
    if (!selected || confirmText !== 'HAPUS' || submitting) return

    setSubmitting(true)
    setResult(null)

    try {
      const { data, error } = await supabase.functions.invoke('reset-data', {
        body: { target: selected.target, confirm: 'HAPUS' },
        headers: { Authorization: `Bearer ${token}` },
      })

      if (error) {
        let msg = 'Gagal mereset data.'
        try {
          const errBody = await (error as any).context?.json?.()
          if (errBody?.error) msg = errBody.error
        } catch { msg = error.message }
        setResult({ success: false, message: msg })
        return
      }

      setResult({
        success: true,
        message: `Data "${selected.title}" berhasil direset.`,
      })
      setConfirmText('')
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Terjadi kesalahan.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const dangerColor = {
    medium:   { bg: '#fffbeb', border: '#fcd34d', badge: '#d97706', badgeBg: '#fef3c7' },
    high:     { bg: '#fff7ed', border: '#fdba74', badge: '#ea580c', badgeBg: '#ffedd5' },
    critical: { bg: '#fff1f2', border: '#fca5a5', badge: '#dc2626', badgeBg: '#fee2e2' },
  }

  const dangerLabel = {
    medium: 'Sedang',
    high: 'Tinggi',
    critical: '⚠️ Kritis',
  }

  return (
    <div className="page-content">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Reset Data</h1>
          <p className="page-subtitle">
            Hapus data bisnis secara selektif. Tindakan ini <strong>tidak dapat dibatalkan</strong>.
            Hanya owner yang bisa mengakses halaman ini.
          </p>
        </div>
      </div>

      {/* ── Warning banner ── */}
      <div className="reset-global-warning">
        🔒 Semua operasi reset memerlukan konfirmasi dengan mengetik <code>HAPUS</code>.
        Profil akun pengguna dan pengaturan aplikasi tidak akan terpengaruh.
      </div>

      {/* ── Cards grid ── */}
      <div className="reset-cards-grid">
        {RESET_CARDS.map((card) => {
          const c = dangerColor[card.danger]
          return (
            <div
              key={card.target}
              className="reset-card"
              style={{ borderColor: c.border, background: card.danger === 'critical' ? c.bg : undefined }}
            >
              <div className="reset-card-top">
                <span className="reset-card-icon">{card.icon}</span>
                <span
                  className="reset-danger-badge"
                  style={{ color: c.badge, background: c.badgeBg }}
                >
                  {dangerLabel[card.danger]}
                </span>
              </div>

              <h3 className="reset-card-title">{card.title}</h3>
              <p className="reset-card-desc">{card.description}</p>

              <div className="reset-affected">
                {card.affected.map((t) => (
                  <span key={t} className="reset-table-tag">{t}</span>
                ))}
              </div>

              <button
                id={`reset-btn-${card.target}`}
                className="reset-trigger-btn"
                style={{ borderColor: c.badge, color: c.badge }}
                onClick={() => openModal(card)}
              >
                Reset {card.title.replace('Reset ', '')}
              </button>
            </div>
          )
        })}
      </div>

      {/* ══════════════════════════════════════════════════ */}
      {/* ── Confirmation Modal ── */}
      {selected && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="modal-box reset-modal">
            <div className="modal-header">
              <h2 className="modal-title modal-title--danger">
                {selected.icon} Konfirmasi Reset
              </h2>
              <button className="modal-close-btn" onClick={closeModal} aria-label="Tutup">×</button>
            </div>

            {/* Result message */}
            {result && (
              <div className={result.success ? 'reset-result-success' : 'modal-deps-error'}>
                <p>{result.message}</p>
                {result.success && (
                  <button className="ghost-button" style={{ marginTop: 12 }} onClick={closeModal}>
                    Tutup
                  </button>
                )}
              </div>
            )}

            {!result && (
              <>
                <div className="modal-delete-warning">
                  <p>Anda akan melakukan: <strong>{selected.title}</strong></p>
                  <p>Tabel yang akan dihapus:</p>
                  <div className="reset-affected" style={{ marginTop: 8 }}>
                    {selected.affected.map((t) => (
                      <span key={t} className="reset-table-tag">{t}</span>
                    ))}
                  </div>
                  <p style={{ marginTop: 10 }}>
                    <strong>Tindakan ini tidak dapat dibatalkan.</strong> Pastikan sudah backup data sebelum melanjutkan.
                  </p>
                </div>

                <label htmlFor="reset-confirm-input" className="reset-confirm-label">
                  Ketik <code>HAPUS</code> untuk mengonfirmasi:
                  <input
                    id="reset-confirm-input"
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Ketik HAPUS"
                    autoFocus
                    autoComplete="off"
                    className={`reset-confirm-input ${confirmText === 'HAPUS' ? 'reset-confirm-input--valid' : ''}`}
                  />
                </label>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={closeModal}
                    disabled={submitting}
                  >
                    Batal
                  </button>
                  <button
                    id="execute-reset-btn"
                    type="button"
                    className="primary-button"
                    style={{
                      background: confirmText === 'HAPUS' ? '#dc2626' : undefined,
                      opacity: confirmText !== 'HAPUS' ? 0.4 : 1,
                      cursor: confirmText !== 'HAPUS' ? 'not-allowed' : 'pointer',
                    }}
                    onClick={handleReset}
                    disabled={confirmText !== 'HAPUS' || submitting}
                  >
                    {submitting ? (
                      <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Mereset…</>
                    ) : '🗑️ Eksekusi Reset'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
