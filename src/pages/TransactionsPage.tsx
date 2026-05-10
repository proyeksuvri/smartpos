import { useState } from 'react'
import { Link } from 'react-router-dom'
import { VoidTransactionModal } from '../components/VoidTransactionModal'
import { useAuth } from '../hooks/useAuth'
import { useTransactions, type Transaction } from '../hooks/useTransactions'
import { supabase } from '../lib/supabase'

/* ── Helpers ────────────────────────────────────────────── */
function formatRp(v: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(v)
}

function formatDt(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

/* ── Transactions Page ──────────────────────────────────── */
export function TransactionsPage() {
  const { user, profile } = useAuth()
  const canVoid = profile?.role === 'manager' || profile?.role === 'owner'

  // Filters
  const [dateFrom, setDateFrom] = useState(todayStr())
  const [dateTo, setDateTo]     = useState(todayStr())
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'voided'>('all')

  const { transactions, loading, error, refetch } = useTransactions({
    dateFrom, dateTo, status: statusFilter, limit: 100,
  })

  // Void modal
  const [voidTarget, setVoidTarget] = useState<Transaction | null>(null)

  // Stats
  const paidTx    = transactions.filter((t) => t.status === 'paid')
  const totalRev  = paidTx.reduce((s, t) => s + Number(t.total), 0)
  const voidedTx  = transactions.filter((t) => t.status === 'voided')

  return (
    <section className="page-stack">
      {/* Header */}
      <div className="page-header">
        <div>
          <span className="eyebrow">Laporan</span>
          <h1>Riwayat Transaksi</h1>
        </div>
      </div>

      {/* Summary cards */}
      <div className="tx-summary-grid">
        <div className="tx-summary-card">
          <span className="tx-sum-label">Total Transaksi</span>
          <strong className="tx-sum-value">{paidTx.length}</strong>
        </div>
        <div className="tx-summary-card">
          <span className="tx-sum-label">Total Omset</span>
          <strong className="tx-sum-value accent">{formatRp(totalRev)}</strong>
        </div>
        <div className="tx-summary-card">
          <span className="tx-sum-label">Divoid</span>
          <strong className="tx-sum-value warn">{voidedTx.length}</strong>
        </div>
      </div>

      {/* Filters */}
      <div className="panel">
        <div className="tx-filters">
          <div className="tx-filter-group">
            <label className="sm-label" htmlFor="tx-date-from">Dari</label>
            <input
              id="tx-date-from"
              type="date"
              className="pm-input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ width: 'auto' }}
            />
          </div>
          <div className="tx-filter-group">
            <label className="sm-label" htmlFor="tx-date-to">Sampai</label>
            <input
              id="tx-date-to"
              type="date"
              className="pm-input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ width: 'auto' }}
            />
          </div>
          <div className="tx-filter-group">
            <label className="sm-label" htmlFor="tx-status">Status</label>
            <select
              id="tx-status"
              className="pm-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              style={{ width: 'auto' }}
            >
              <option value="all">Semua</option>
              <option value="paid">Lunas</option>
              <option value="voided">Divoid</option>
            </select>
          </div>
          <button type="button" className="ghost-button small" onClick={() => void refetch()}>
            ↻ Muat Ulang
          </button>
        </div>
      </div>

      {/* Error */}
      {error && <p className="form-error">{error}</p>}

      {/* Table */}
      <section className="panel">
        {loading ? (
          <div className="loading-panel"><div className="spinner" /></div>
        ) : transactions.length === 0 ? (
          <div className="empty-state compact">
            <h2>Tidak ada transaksi</h2>
            <p>Coba ubah filter tanggal atau status.</p>
          </div>
        ) : (
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Waktu</th>
                  <th>Kasir</th>
                  <th>Metode</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className={tx.status === 'voided' ? 'tx-voided-row' : ''}>
                    <td>
                      <Link
                        to={`/receipt/${tx.invoice_no}`}
                        className="tx-invoice-link"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {tx.invoice_no}
                      </Link>
                    </td>
                    <td className="text-muted" style={{ fontSize: 12 }}>{formatDt(tx.created_at)}</td>
                    <td>{tx.profiles?.name ?? '—'}</td>
                    <td>
                      <span className="tx-method-badge">
                        {tx.payment_method === 'cash' ? '💵 Tunai'
                          : tx.payment_method === 'transfer' ? '🏦 Transfer'
                          : '💳 Mixed'}
                      </span>
                    </td>
                    <td><strong>{formatRp(Number(tx.total))}</strong></td>
                    <td>
                      {tx.status === 'voided' ? (
                        <span className="status-badge inactive" title={tx.void_reason ?? ''}>
                          Void
                        </span>
                      ) : (
                        <span className="status-badge active">Lunas</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {tx.status === 'paid' && canVoid && user && (
                        <button
                          type="button"
                          className="ghost-button small danger"
                          onClick={() => setVoidTarget(tx)}
                          title="Void transaksi ini"
                        >
                          Void
                        </button>
                      )}
                      {tx.status === 'voided' && tx.void_reason && (
                        <span className="tx-void-reason" title={tx.void_reason}>
                          {tx.void_reason.slice(0, 20)}{tx.void_reason.length > 20 ? '…' : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Void Modal */}
      {voidTarget && user && (
        <VoidTransactionModal
          transaction={voidTarget}
          voidedBy={user.id}
          onSuccess={(reason) => {
            setVoidTarget(null)
            void refetch()
            
            // Trigger notifikasi Telegram (Void Alert)
            void supabase.functions.invoke('telegram-bot', {
              body: {
                type: 'void_alert',
                data: {
                  transaction_id: voidTarget.invoice_no,
                  total: voidTarget.total,
                  reason,
                },
              },
            })
          }}
          onClose={() => setVoidTarget(null)}
        />
      )}
    </section>
  )
}
