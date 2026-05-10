import { useEffect, useState } from 'react'
import {
  useOperationalCosts,
  type CostCategory,
  type CostPeriod,
  type OperationalCost,
  type OperationalCostInput,
  COST_CATEGORY_LABELS,
  COST_PERIOD_LABELS,
} from '../hooks/useOperationalCosts'
import { downloadCsv, downloadExcel, fmtDate, fmtRp } from '../lib/exportCsv'

/* ── Helpers ─────────────────────────────────────────────── */
function todayStr() { return new Date().toISOString().split('T')[0] }
function monthStartStr() {
  const d = new Date(); d.setDate(1)
  return d.toISOString().split('T')[0]
}

const CATEGORY_ICONS: Record<CostCategory, string> = {
  gaji: '👥', sewa: '🏠', listrik: '⚡', air: '💧', internet: '📡',
  transportasi: '🚗', bahan_baku_non_produk: '📦', perlengkapan: '🔧',
  pemasaran: '📣', lainnya: '📌',
}

const EMPTY_FORM: OperationalCostInput = {
  name: '', category: 'lainnya', amount: 0,
  period: 'bulanan', cost_date: todayStr(),
  description: '', is_recurring: false,
}

/* ── Modal Form ──────────────────────────────────────────── */
function CostModal({
  initial, onSave, onClose, saving,
}: {
  initial?: OperationalCost
  onSave: (input: OperationalCostInput) => void
  onClose: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<OperationalCostInput>(
    initial
      ? {
          name: initial.name, category: initial.category,
          amount: initial.amount, period: initial.period,
          cost_date: initial.cost_date, description: initial.description ?? '',
          is_recurring: initial.is_recurring,
        }
      : { ...EMPTY_FORM, cost_date: todayStr() }
  )

  function set<K extends keyof OperationalCostInput>(k: K, v: OperationalCostInput[K]) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || form.amount <= 0) return
    onSave(form)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>
              Keuangan
            </p>
            <h2 style={{ margin: 0 }}>{initial ? 'Edit Biaya' : 'Tambah Biaya Operasional'}</h2>
          </div>
          <button
            type="button"
            className="ghost-button icon-button"
            onClick={onClose}
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Nama */}
          <div className="form-field">
            <label htmlFor="cost-name">
              Nama Biaya <span className="required">*</span>
            </label>
            <input
              id="cost-name"
              placeholder="cth: Gaji Kasir Juni, Tagihan Listrik Mei…"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Kategori + Periode */}
          <div className="form-row two-col">
            <div className="form-field">
              <label htmlFor="cost-cat">Kategori <span className="required">*</span></label>
              <select
                id="cost-cat"
                value={form.category}
                onChange={(e) => set('category', e.target.value as CostCategory)}
              >
                {(Object.entries(COST_CATEGORY_LABELS) as [CostCategory, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{CATEGORY_ICONS[k]} {v}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="cost-period">Periode <span className="required">*</span></label>
              <select
                id="cost-period"
                value={form.period}
                onChange={(e) => set('period', e.target.value as CostPeriod)}
              >
                {(Object.entries(COST_PERIOD_LABELS) as [CostPeriod, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Jumlah + Tanggal */}
          <div className="form-row two-col">
            <div className="form-field">
              <label htmlFor="cost-amount">Jumlah (Rp) <span className="required">*</span></label>
              <input
                id="cost-amount"
                type="number"
                min={1}
                placeholder="0"
                value={form.amount || ''}
                onChange={(e) => set('amount', Number(e.target.value))}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="cost-date">Tanggal <span className="required">*</span></label>
              <input
                id="cost-date"
                type="date"
                value={form.cost_date}
                onChange={(e) => set('cost_date', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Keterangan */}
          <div className="form-field">
            <label htmlFor="cost-desc">
              Keterangan
              <span className="field-hint" style={{ marginLeft: 6 }}>(opsional)</span>
            </label>
            <textarea
              id="cost-desc"
              placeholder="Catatan tambahan…"
              rows={2}
              value={form.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              style={{
                resize: 'vertical', fontFamily: 'inherit', fontSize: 14,
                background: 'var(--input-bg)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 12px', color: 'var(--text-strong)',
                minHeight: 64,
              }}
            />
          </div>

          {/* Biaya berulang */}
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={form.is_recurring}
              onChange={(e) => set('is_recurring', e.target.checked)}
            />
            Biaya berulang rutin (contoh: gaji bulanan, sewa tetap)
          </label>

          {/* Actions */}
          <div className="modal-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={onClose}
              disabled={saving}
            >
              Batal
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={saving || !form.name.trim() || form.amount <= 0}
            >
              {saving ? '⏳ Menyimpan…' : (initial ? '✓ Simpan Perubahan' : '+ Tambah Biaya')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Confirm Delete Modal ─────────────────────────────────── */
function ConfirmDeleteModal({
  costName, onConfirm, onClose, loading,
}: {
  costName: string
  onConfirm: () => void
  onClose: () => void
  loading: boolean
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Hapus Biaya?</h2>
          <button type="button" className="ghost-button icon-button" onClick={onClose}>✕</button>
        </div>
        <div>
          <p style={{ margin: '0 0 4px', fontWeight: 650 }}>{costName}</p>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>
            Data ini akan dihapus permanen dan tidak bisa dikembalikan.
          </p>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose} disabled={loading}>
            Batal
          </button>
          <button
            type="button"
            className="primary-button danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? '⏳ Menghapus…' : '🗑 Ya, Hapus'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────── */
export function OperationalCostsPage() {
  const hook = useOperationalCosts()
  const [dateFrom, setDateFrom] = useState(monthStartStr())
  const [dateTo, setDateTo] = useState(todayStr())
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editing, setEditing] = useState<OperationalCost | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<OperationalCost | null>(null)

  useEffect(() => { void hook.fetch(dateFrom, dateTo) }, [])

  function applyFilter() { void hook.fetch(dateFrom, dateTo) }

  function openEdit(c: OperationalCost) { setEditing(c); setModal('edit') }

  async function handleSave(input: OperationalCostInput) {
    const ok = modal === 'edit' && editing
      ? await hook.update(editing.id, input)
      : await hook.create(input)
    if (ok) {
      setModal(null); setEditing(null)
      void hook.fetch(dateFrom, dateTo)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const ok = await hook.remove(deleteTarget.id)
    if (ok) setDeleteTarget(null)
  }

  /* ── Export helpers ── */
  const EXP_HEADERS = ['Tanggal', 'Nama Biaya', 'Kategori', 'Periode', 'Jumlah (Rp)', 'Berulang', 'Keterangan']
  const expRows = () => hook.data.map((c) => [
    fmtDate(c.cost_date), c.name,
    COST_CATEGORY_LABELS[c.category], COST_PERIOD_LABELS[c.period],
    c.amount, c.is_recurring ? 'Ya' : 'Tidak', c.description ?? '',
  ])
  const fname = `biaya_operasional_${dateFrom}_sd_${dateTo}`

  /* ── Derived ── */
  const totalCost = hook.data.reduce((s, c) => s + Number(c.amount), 0)

  const byCategory = hook.data.reduce<Record<string, number>>((acc, c) => {
    acc[c.category] = (acc[c.category] ?? 0) + Number(c.amount)
    return acc
  }, {})

  const topCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)

  return (
    <section className="page-stack">

      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <span className="eyebrow">Keuangan</span>
          <h1>Biaya Operasional</h1>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => downloadExcel(fname, EXP_HEADERS, expRows(), 'Biaya Operasional')}
            disabled={hook.data.length === 0}
            title="Download Excel"
          >
            ⬇ Excel
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => downloadCsv(fname, EXP_HEADERS, expRows())}
            disabled={hook.data.length === 0}
            title="Download CSV"
          >
            ⬇ CSV
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => { setEditing(null); setModal('add') }}
          >
            + Tambah Biaya
          </button>
        </div>
      </div>

      {/* ── Filter Tanggal ── */}
      <div className="panel" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <div className="form-field" style={{ gap: 4 }}>
            <label htmlFor="oc-from" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Dari Tanggal
            </label>
            <input
              id="oc-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ minHeight: 38, fontSize: 14, width: 160 }}
            />
          </div>
          <div className="form-field" style={{ gap: 4 }}>
            <label htmlFor="oc-to" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Sampai Tanggal
            </label>
            <input
              id="oc-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ minHeight: 38, fontSize: 14, width: 160 }}
            />
          </div>
          <button
            type="button"
            className="ghost-button small"
            onClick={applyFilter}
            disabled={hook.loading}
            style={{ marginBottom: 0 }}
          >
            {hook.loading ? '⏳' : '↻'} Terapkan
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {hook.error && <p className="form-error">{hook.error}</p>}

      {/* ── KPI Cards (hanya jika ada data) ── */}
      {hook.data.length > 0 && (
        <div className="metric-grid">
          {/* Total */}
          <div className="metric-card" style={{ gridColumn: topCategories.length > 0 ? '1' : '1 / -1' }}>
            <span>💸 Total Biaya Operasional</span>
            <strong style={{ color: '#e11d48', fontSize: 24 }}>
              Rp {totalCost.toLocaleString('id-ID')}
            </strong>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              {hook.data.length} item · {Object.keys(byCategory).length} kategori
            </p>
          </div>

          {/* Top kategori */}
          {topCategories.map(([cat, amount]) => (
            <div key={cat} className="metric-card">
              <span>
                {CATEGORY_ICONS[cat as CostCategory]}{' '}
                {COST_CATEGORY_LABELS[cat as CostCategory]}
              </span>
              <strong style={{ fontSize: 22, color: 'var(--text-strong)' }}>
                Rp {amount.toLocaleString('id-ID')}
              </strong>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                {((amount / totalCost) * 100).toFixed(1)}% dari total
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabel / Empty State ── */}
      <div className="panel">
        {hook.loading ? (
          <div className="loading-panel">
            <div className="spinner" />
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Memuat data…</span>
          </div>
        ) : hook.data.length === 0 ? (
          <div className="empty-state">
            <p style={{ fontSize: 40, marginBottom: 8 }}>💸</p>
            <h2>Belum ada biaya tercatat</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: 360, margin: '0 auto 16px' }}>
              Catat biaya operasional seperti gaji karyawan, tagihan listrik, biaya sewa,
              internet, dan lainnya untuk mendapatkan laporan laba bersih yang akurat.
            </p>
            <button
              type="button"
              className="primary-button"
              onClick={() => { setEditing(null); setModal('add') }}
            >
              + Tambah Biaya Pertama
            </button>
          </div>
        ) : (
          <>
            {/* Ringkasan kecil di atas tabel */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                {hook.data.length} biaya · periode {fmtDate(dateFrom + 'T00:00:00')} – {fmtDate(dateTo + 'T00:00:00')}
              </p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
                Total: <span style={{ color: '#e11d48' }}>Rp {totalCost.toLocaleString('id-ID')}</span>
              </p>
            </div>

            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Nama Biaya</th>
                    <th>Kategori</th>
                    <th>Periode</th>
                    <th style={{ textAlign: 'right' }}>Jumlah</th>
                    <th style={{ textAlign: 'center' }}>Rutin</th>
                    <th style={{ textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {hook.data.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {fmtDate(c.cost_date)}
                      </td>
                      <td>
                        <span style={{ fontWeight: 650, color: 'var(--text-strong)' }}>{c.name}</span>
                        {c.description && (
                          <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            {c.description}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="status-badge active" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                          {CATEGORY_ICONS[c.category]} {COST_CATEGORY_LABELS[c.category]}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {COST_PERIOD_LABELS[c.period]}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#e11d48', whiteSpace: 'nowrap' }}>
                        Rp {fmtRp(c.amount)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {c.is_recurring
                          ? <span title="Biaya rutin" style={{ color: '#16a34a', fontWeight: 800, fontSize: 15 }}>↻</span>
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>
                        }
                      </td>
                      <td>
                        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="ghost-button small"
                            onClick={() => openEdit(c)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="ghost-button small danger"
                            onClick={() => setDeleteTarget(c)}
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} style={{ fontWeight: 700, borderTop: '2px solid var(--border)', paddingTop: 14 }}>
                      TOTAL
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#e11d48', fontSize: 15, borderTop: '2px solid var(--border)', paddingTop: 14, whiteSpace: 'nowrap' }}>
                      Rp {totalCost.toLocaleString('id-ID')}
                    </td>
                    <td colSpan={2} style={{ borderTop: '2px solid var(--border)' }} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Modals ── */}
      {modal && (
        <CostModal
          initial={editing ?? undefined}
          onSave={handleSave}
          onClose={() => { setModal(null); setEditing(null) }}
          saving={hook.loading}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          costName={deleteTarget.name}
          onConfirm={() => void handleDelete()}
          onClose={() => setDeleteTarget(null)}
          loading={hook.loading}
        />
      )}
    </section>
  )
}
