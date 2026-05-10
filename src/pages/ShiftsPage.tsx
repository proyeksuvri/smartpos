import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Shift } from '../hooks/useShift'

/* ── Types ──────────────────────────────────────────────── */
interface ShiftWithCashier extends Shift {
  cashier_name: string
  tx_count: number
  tx_total: number
  tx_cash: number
  tx_transfer: number
}

/* ── Helpers ────────────────────────────────────────────── */
function formatRp(v: number | null | undefined) {
  if (v === null || v === undefined) return '—'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(v)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function duration(opened: string, closed: string | null) {
  const start = new Date(opened).getTime()
  const end   = closed ? new Date(closed).getTime() : Date.now()
  const mins  = Math.floor((end - start) / 60000)
  const h     = Math.floor(mins / 60)
  const m     = mins % 60
  return h > 0 ? `${h}j ${m}m` : `${m} menit`
}

/* ── Page ───────────────────────────────────────────────── */
export function ShiftsPage() {
  const { profile }           = useAuth()
  const isOwnerOrManager      = profile?.role === 'owner' || profile?.role === 'manager'

  const [shifts, setShifts]   = useState<ShiftWithCashier[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail]   = useState<ShiftWithCashier | null>(null)

  // Filter state
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'closed'>('all')
  const [filterDate,   setFilterDate]   = useState('')  // YYYY-MM-DD

  /* ── Load shifts ──────────────────────────────────────── */
  const loadShifts = useCallback(async () => {
    setLoading(true)

    let q = supabase
      .from('shifts')
      .select(`
        *,
        profiles:cashier_id ( name )
      `)
      .order('opened_at', { ascending: false })
      .limit(200)

    if (filterStatus !== 'all') q = q.eq('status', filterStatus)
    if (filterDate) {
      const start = `${filterDate}T00:00:00`
      const end   = `${filterDate}T23:59:59`
      q = q.gte('opened_at', start).lte('opened_at', end)
    }

    const { data: shiftData, error } = await q

    if (error || !shiftData) { setLoading(false); return }

    // For each shift, count transactions
    const enriched: ShiftWithCashier[] = await Promise.all(
      shiftData.map(async (s: any) => {
        const { data: txs } = await supabase
          .from('transactions')
          .select('total, payment_method')
          .eq('shift_id', s.id)
          .eq('status', 'paid')

        const txList = txs ?? []
        const tx_total    = txList.reduce((a, t) => a + Number(t.total), 0)
        const tx_cash     = txList.filter((t) => t.payment_method === 'cash' || t.payment_method === 'mixed')
                                  .reduce((a, t) => a + Number(t.total), 0)
        const tx_transfer = txList.filter((t) => t.payment_method === 'transfer')
                                  .reduce((a, t) => a + Number(t.total), 0)

        return {
          ...s,
          cashier_name: s.profiles?.name ?? '—',
          tx_count:    txList.length,
          tx_total,
          tx_cash,
          tx_transfer,
        } as ShiftWithCashier
      })
    )

    setShifts(enriched)
    setLoading(false)
  }, [filterStatus, filterDate])

  useEffect(() => { void loadShifts() }, [loadShifts])

  /* ── Render ─────────────────────────────────────────── */
  return (
    <div className="page-content">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Riwayat Shift</h1>
          <p className="page-subtitle">Pantau semua sesi kasir — buka shift, tutup shift, dan rekap transaksi per shift.</p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="shift-filters">
        <div className="filter-group">
          <label htmlFor="shift-status-filter">Status</label>
          <select
            id="shift-status-filter"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          >
            <option value="all">Semua</option>
            <option value="open">Sedang Berjalan</option>
            <option value="closed">Sudah Ditutup</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="shift-date-filter">Tanggal</label>
          <input
            id="shift-date-filter"
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
        </div>

        {filterDate && (
          <button
            type="button"
            className="ghost-button"
            style={{ alignSelf: 'flex-end' }}
            onClick={() => setFilterDate('')}
          >
            Hapus Filter
          </button>
        )}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="loading-panel">
          <span className="spinner" aria-hidden="true" />
          <span>Memuat data shift…</span>
        </div>
      ) : shifts.length === 0 ? (
        <div className="empty-state">
          <p>Tidak ada data shift{filterStatus !== 'all' ? ` dengan status "${filterStatus}"` : ''}.</p>
        </div>
      ) : (
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                {isOwnerOrManager && <th>Kasir</th>}
                <th>Buka Shift</th>
                <th>Tutup Shift</th>
                <th>Durasi</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Transaksi</th>
                <th style={{ textAlign: 'right' }}>Total Omset</th>
                <th style={{ textAlign: 'right' }}>Selisih Kas</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => {
                const diffColor =
                  s.difference === null ? 'var(--text-muted)' :
                  s.difference === 0    ? '#15803d' :
                  s.difference > 0      ? '#2563eb' : '#dc2626'

                return (
                  <tr key={s.id}>
                    {isOwnerOrManager && (
                      <td>
                        <div className="emp-name-cell">
                          <span
                            className="cashier-avatar"
                            style={{ width: 28, height: 28, fontSize: 12, flexShrink: 0 }}
                          >
                            {s.cashier_name.charAt(0).toUpperCase()}
                          </span>
                          <span style={{ fontSize: 13 }}>{s.cashier_name}</span>
                        </div>
                      </td>
                    )}
                    <td style={{ fontSize: 13 }}>{formatDate(s.opened_at)}</td>
                    <td style={{ fontSize: 13, color: s.closed_at ? 'var(--text)' : 'var(--text-muted)' }}>
                      {s.closed_at ? formatDate(s.closed_at) : '—'}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {duration(s.opened_at, s.closed_at)}
                    </td>
                    <td>
                      <span className={`status-badge ${s.status === 'open' ? 'shift-badge-open' : 'shift-badge-closed'}`}>
                        {s.status === 'open' ? '🟢 Aktif' : '⚫ Selesai'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 13 }}>
                      {s.tx_count} transaksi
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 650 }}>
                      {formatRp(s.tx_total)}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 650, color: diffColor }}>
                      {s.difference === null ? '—' :
                       s.difference > 0 ? `+${formatRp(s.difference)}` :
                       s.difference < 0 ? formatRp(s.difference) : 'Cocok ✓'}
                    </td>
                    <td>
                      <button
                        id={`shift-detail-${s.id}`}
                        className="ghost-button"
                        style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() => setDetail(s)}
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {detail && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setDetail(null)}
        >
          <div className="modal-box shift-detail-modal">
            <div className="modal-header">
              <h2 className="modal-title">📋 Detail Shift</h2>
              <button className="modal-close-btn" onClick={() => setDetail(null)} aria-label="Tutup">×</button>
            </div>

            {/* Kasir info */}
            <div className="shift-detail-header">
              <span className="cashier-avatar" style={{ width: 44, height: 44, fontSize: 18 }}>
                {detail.cashier_name.charAt(0).toUpperCase()}
              </span>
              <div>
                <div style={{ fontWeight: 750, fontSize: 16 }}>{detail.cashier_name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {formatDate(detail.opened_at)} → {detail.closed_at ? formatDate(detail.closed_at) : 'Masih berjalan'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Durasi: {duration(detail.opened_at, detail.closed_at)}
                </div>
              </div>
              <span className={`status-badge ${detail.status === 'open' ? 'shift-badge-open' : 'shift-badge-closed'}`}
                style={{ marginLeft: 'auto' }}>
                {detail.status === 'open' ? '🟢 Aktif' : '⚫ Selesai'}
              </span>
            </div>

            {/* Summary grid */}
            <div className="shift-summary-grid">
              <div className="shift-summary-card">
                <span className="shift-summary-label">Modal Awal</span>
                <span className="shift-summary-value">{formatRp(detail.opening_cash)}</span>
              </div>
              <div className="shift-summary-card">
                <span className="shift-summary-label">Total Transaksi</span>
                <span className="shift-summary-value" style={{ color: '#2563eb' }}>{detail.tx_count}</span>
              </div>
              <div className="shift-summary-card">
                <span className="shift-summary-label">Omset Tunai</span>
                <span className="shift-summary-value">{formatRp(detail.tx_cash)}</span>
              </div>
              <div className="shift-summary-card">
                <span className="shift-summary-label">Omset Transfer</span>
                <span className="shift-summary-value">{formatRp(detail.tx_transfer)}</span>
              </div>
              <div className="shift-summary-card">
                <span className="shift-summary-label">Total Omset</span>
                <span className="shift-summary-value" style={{ color: '#15803d', fontWeight: 800 }}>
                  {formatRp(detail.tx_total)}
                </span>
              </div>

              {detail.status === 'closed' && (
                <>
                  <div className="shift-summary-card">
                    <span className="shift-summary-label">Kas Ekspektasi</span>
                    <span className="shift-summary-value">{formatRp(detail.expected_cash)}</span>
                  </div>
                  <div className="shift-summary-card">
                    <span className="shift-summary-label">Kas Fisik</span>
                    <span className="shift-summary-value">{formatRp(detail.closing_cash)}</span>
                  </div>
                  <div className="shift-summary-card" style={{
                    background: detail.difference === 0 ? '#f0fdf4' :
                                (detail.difference ?? 0) > 0 ? '#eff6ff' : '#fff1f2',
                    borderColor: detail.difference === 0 ? '#86efac' :
                                 (detail.difference ?? 0) > 0 ? '#bfdbfe' : '#fca5a5',
                  }}>
                    <span className="shift-summary-label">Selisih Kas</span>
                    <span className="shift-summary-value" style={{
                      color: detail.difference === 0 ? '#15803d' :
                             (detail.difference ?? 0) > 0 ? '#1d4ed8' : '#dc2626',
                      fontWeight: 800,
                    }}>
                      {detail.difference === 0 ? '✓ Cocok' :
                       (detail.difference ?? 0) > 0 ? `+${formatRp(detail.difference)}` :
                       formatRp(detail.difference)}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Notes */}
            {detail.notes && (
              <div className="shift-notes">
                <span style={{ fontWeight: 650, fontSize: 13 }}>📝 Catatan:</span>
                <p>{detail.notes}</p>
              </div>
            )}

            <div className="modal-footer">
              <button type="button" className="primary-button" onClick={() => setDetail(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
