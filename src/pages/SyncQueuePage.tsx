import { useEffect } from 'react'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { fmtDatetime, fmtRp } from '../lib/exportCsv'

const STATUS_LABELS = {
  pending:  { label: 'Menunggu',   cls: 'warning' },
  syncing:  { label: 'Sinkronisasi…', cls: 'active' },
  synced:   { label: 'Berhasil',   cls: 'active' },
  failed:   { label: 'Gagal',      cls: 'inactive' },
}

export function SyncQueuePage() {
  const isOnline = useOnlineStatus()
  const {
    pending, pendingCount, failedCount,
    syncing, lastSyncError,
    syncAll, retryOne, dismissFailed, refreshPending,
  } = useOfflineSync()

  useEffect(() => { void refreshPending() }, [refreshPending])

  const allSynced = pending.filter((t) => t.sync_status === 'synced')
  const notSynced = pending.filter((t) => t.sync_status !== 'synced')

  return (
    <section className="page-stack">
      {/* Header */}
      <div className="page-header">
        <div>
          <span className="eyebrow">Offline</span>
          <h1>Antrian Sinkronisasi</h1>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => void refreshPending()}
          >
            ↻ Refresh
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => void syncAll()}
            disabled={syncing || !isOnline || pendingCount === 0}
          >
            {syncing ? '⏳ Sinkronisasi…' : `☁ Sync Sekarang (${pendingCount})`}
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="panel" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Online/Offline indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
              background: isOnline ? '#16a34a' : '#e11d48',
              boxShadow: isOnline ? '0 0 0 3px #bbf7d0' : '0 0 0 3px #fecdd3',
            }} />
            <strong style={{ fontSize: 14, color: isOnline ? '#15803d' : '#be123c' }}>
              {isOnline ? 'Online' : 'Offline'}
            </strong>
          </div>

          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            <span style={{ marginRight: 16 }}>
              <strong style={{ color: pendingCount > 0 ? '#d97706' : 'var(--text-strong)' }}>
                {pendingCount}
              </strong> menunggu sync
            </span>
            <span style={{ marginRight: 16 }}>
              <strong style={{ color: failedCount > 0 ? '#e11d48' : 'var(--text-strong)' }}>
                {failedCount}
              </strong> gagal
            </span>
            <span>
              <strong style={{ color: '#16a34a' }}>{allSynced.length}</strong> berhasil
            </span>
          </div>

          {!isOnline && (
            <span style={{
              fontSize: 12, background: '#fef3c7', color: '#92400e',
              border: '1px solid #fde68a', borderRadius: 6, padding: '3px 10px',
            }}>
              ⚠️ Transaksi baru disimpan lokal, akan sync otomatis saat online
            </span>
          )}
        </div>

        {lastSyncError && (
          <p className="form-error" style={{ marginTop: 10 }}>{lastSyncError}</p>
        )}
      </div>

      {/* Belum Sync */}
      {notSynced.length > 0 && (
        <div className="panel">
          <h3 style={{ margin: '0 0 12px', fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
            Menunggu / Gagal ({notSynced.length})
          </h3>
          <div className="table-shell" style={{ marginTop: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Waktu Dibuat</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'center' }}>Retry</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th>Error</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {notSynced.map((tx) => {
                  const s = STATUS_LABELS[tx.sync_status]
                  return (
                    <tr key={tx.localId}>
                      <td style={{ fontWeight: 650 }}>{tx.invoice_no}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {fmtDatetime(tx.created_at)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        Rp {fmtRp(tx.payload.p_total)}
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                        {tx.retry_count}×
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`status-badge ${s.cls}`}>{s.label}</span>
                      </td>
                      <td style={{ fontSize: 12, color: '#be123c', maxWidth: 240 }}>
                        {tx.last_error ?? '—'}
                      </td>
                      <td>
                        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                          {tx.sync_status === 'failed' && (
                            <>
                              <button
                                type="button"
                                className="ghost-button small"
                                onClick={() => void retryOne(tx.localId)}
                                disabled={syncing || !isOnline}
                                title="Coba sync ulang"
                              >
                                ↻ Retry
                              </button>
                              <button
                                type="button"
                                className="ghost-button small danger"
                                onClick={() => void dismissFailed(tx.localId)}
                                title="Hapus dari antrian"
                              >
                                Hapus
                              </button>
                            </>
                          )}
                          {tx.sync_status === 'pending' && (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              Menunggu koneksi…
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sudah Sync */}
      {allSynced.length > 0 && (
        <div className="panel">
          <h3 style={{ margin: '0 0 12px', fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
            Berhasil Disinkronkan ({allSynced.length})
          </h3>
          <div className="table-shell" style={{ marginTop: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Dibuat</th>
                  <th>Disinkronkan</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {allSynced.map((tx) => (
                  <tr key={tx.localId}>
                    <td style={{ fontWeight: 650 }}>{tx.invoice_no}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDatetime(tx.created_at)}</td>
                    <td style={{ fontSize: 12, color: '#15803d' }}>
                      {tx.synced_at ? fmtDatetime(tx.synced_at) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                      Rp {fmtRp(tx.payload.p_total)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="status-badge active">✓ Berhasil</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {pending.length === 0 && (
        <div className="panel">
          <div className="empty-state">
            <p style={{ fontSize: 36, marginBottom: 8 }}>✅</p>
            <h2>Tidak ada transaksi pending</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              Semua transaksi sudah tersinkronisasi ke server.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
