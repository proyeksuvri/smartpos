import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

/* ── Types ──────────────────────────────────────────────── */
interface Cashier {
  id: string
  name: string
  is_active: boolean
  created_at: string
  login_email: string | null
}

type Modal =
  | { type: 'add' }
  | { type: 'edit'; cashier: Cashier }
  | { type: 'reset_pin'; cashier: Cashier }
  | { type: 'toggle'; cashier: Cashier }
  | { type: 'delete'; cashier: Cashier }
  | null

/* ── Helper: call manage-cashier edge function ──────────── */
async function callManage<T = { success: boolean }>(
  token: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('manage-cashier', {
    body,
    headers: { Authorization: `Bearer ${token}` },
  })
  if (error) {
    let msg = 'Terjadi kesalahan server.'
    try {
      const errBody = await (error as any).context?.json?.()
      if (errBody?.error) msg = errBody.error
      else if (error.message) msg = error.message
    } catch { msg = error.message }
    throw new Error(msg)
  }
  return data as T
}

/* ── Main Component ─────────────────────────────────────── */
export function EmployeesPage() {
  const { session } = useAuth()
  const token = session?.access_token ?? ''

  const [cashiers, setCashiers]       = useState<Cashier[]>([])
  const [loading, setLoading]         = useState(true)
  const [modal, setModal]             = useState<Modal>(null)
  const [submitting, setSubmitting]   = useState(false)
  const [formError, setFormError]     = useState('')
  const [hasDependencies, setHasDependencies] = useState(false)

  // Add form
  const [addName, setAddName]         = useState('')
  const [addPin, setAddPin]           = useState('')
  const [addConfirm, setAddConfirm]   = useState('')

  // Edit name form
  const [editName, setEditName]       = useState('')

  // Reset PIN form
  const [newPin, setNewPin]           = useState('')
  const [newPinConfirm, setNewPinConfirm] = useState('')

  const firstInputRef = useRef<HTMLInputElement>(null)

  /* ── Load cashiers ──────────────────────────────────── */
  const loadCashiers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, is_active, created_at, login_email')
      .eq('role', 'cashier')
      .order('name')
    if (!error) setCashiers((data ?? []) as Cashier[])
    setLoading(false)
  }, [])

  useEffect(() => { void loadCashiers() }, [loadCashiers])

  // Focus first input when modal opens
  useEffect(() => {
    if (modal) setTimeout(() => firstInputRef.current?.focus(), 80)
  }, [modal?.type])

  /* ── Generic error helper ───────────────────────────── */
  async function withSubmit(fn: () => Promise<void>) {
    setSubmitting(true)
    setFormError('')
    try {
      await fn()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal. Coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── ADD Cashier ────────────────────────────────────── */
  function openAdd() {
    setAddName(''); setAddPin(''); setAddConfirm('')
    setFormError('')
    setModal({ type: 'add' })
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!addName.trim()) { setFormError('Nama kasir wajib diisi.'); return }
    if (!/^\d{6}$/.test(addPin)) { setFormError('PIN harus tepat 6 digit angka.'); return }
    if (addPin !== addConfirm) { setFormError('Konfirmasi PIN tidak cocok.'); return }

    await withSubmit(async () => {
      await callManage(token, { action: 'CREATE', name: addName.trim(), pin: addPin })
      setModal(null)
      await loadCashiers()
    })
  }

  /* ── EDIT NAME ──────────────────────────────────────── */
  function openEdit(c: Cashier) {
    setEditName(c.name)
    setFormError('')
    setModal({ type: 'edit', cashier: c })
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editName.trim()) { setFormError('Nama tidak boleh kosong.'); return }

    const cashier = (modal as { type: 'edit'; cashier: Cashier }).cashier
    await withSubmit(async () => {
      await callManage(token, { action: 'UPDATE_NAME', cashier_id: cashier.id, new_name: editName.trim() })
      setModal(null)
      await loadCashiers()
    })
  }

  /* ── RESET PIN ──────────────────────────────────────── */
  function openResetPin(c: Cashier) {
    setNewPin(''); setNewPinConfirm('')
    setFormError('')
    setModal({ type: 'reset_pin', cashier: c })
  }

  async function handleResetPin(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\d{6}$/.test(newPin)) { setFormError('PIN baru harus tepat 6 digit angka.'); return }
    if (newPin !== newPinConfirm) { setFormError('Konfirmasi PIN tidak cocok.'); return }

    const cashier = (modal as { type: 'reset_pin'; cashier: Cashier }).cashier
    await withSubmit(async () => {
      await callManage(token, { action: 'RESET_PIN', cashier_id: cashier.id, new_pin: newPin })
      setModal(null)
    })
  }

  /* ── TOGGLE STATUS ──────────────────────────────────── */
  function openToggle(c: Cashier) {
    setFormError('')
    setModal({ type: 'toggle', cashier: c })
  }

  async function handleToggle() {
    const cashier = (modal as { type: 'toggle'; cashier: Cashier }).cashier
    await withSubmit(async () => {
      await callManage(token, {
        action: 'TOGGLE_STATUS',
        cashier_id: cashier.id,
        is_active: !cashier.is_active,
      })
      setModal(null)
      await loadCashiers()
    })
  }

  /* ── DELETE ─────────────────────────────────────────── */
  function openDelete(c: Cashier) {
    setFormError('')
    setHasDependencies(false)
    setModal({ type: 'delete', cashier: c })
  }

  async function handleDelete() {
    const cashier = (modal as { type: 'delete'; cashier: Cashier }).cashier
    setSubmitting(true)
    setFormError('')
    try {
      await callManage<{ success: boolean; code?: string }>(token, { action: 'DELETE', cashier_id: cashier.id })
      setModal(null)
      await loadCashiers()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal. Coba lagi.'
      // Detect dependency conflict
      if (msg.includes('riwayat transaksi') || msg.includes('HAS_DEPENDENCIES')) {
        setHasDependencies(true)
      }
      setFormError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeactivateInstead() {
    const cashier = (modal as { type: 'delete'; cashier: Cashier }).cashier
    await withSubmit(async () => {
      await callManage(token, { action: 'TOGGLE_STATUS', cashier_id: cashier.id, is_active: false })
      setModal(null)
      await loadCashiers()
    })
  }

  function closeModal() { setModal(null); setFormError('') }

  /* ── Render ─────────────────────────────────────────── */
  return (
    <div className="page-content">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Manajemen Kasir</h1>
          <p className="page-subtitle">Tambah, edit, reset PIN, dan kelola status kasir.</p>
        </div>
        <button id="add-cashier-btn" className="primary-button" onClick={openAdd}>
          + Tambah Kasir
        </button>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="loading-panel">
          <span className="spinner" aria-hidden="true" />
          <span>Memuat data kasir…</span>
        </div>
      ) : cashiers.length === 0 ? (
        <div className="empty-state">
          <p>Belum ada kasir terdaftar.<br />Klik <strong>+ Tambah Kasir</strong> untuk mulai.</p>
        </div>
      ) : (
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Kasir</th>
                <th>Status</th>
                <th>Terdaftar</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {cashiers.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="emp-name-cell">
                      <span
                        className="cashier-avatar"
                        style={{ width: 34, height: 34, fontSize: 14, flexShrink: 0 }}
                        aria-hidden="true"
                      >
                        {c.name.charAt(0).toUpperCase()}
                      </span>
                      <span style={{ fontWeight: 650, color: 'var(--text-strong)' }}>{c.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${c.is_active ? 'status-active' : 'status-inactive'}`}>
                      {c.is_active ? '● Aktif' : '○ Nonaktif'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {new Date(c.created_at).toLocaleDateString('id-ID', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td>
                    <div className="emp-actions">
                      <button
                        id={`edit-btn-${c.id}`}
                        className="emp-icon-btn"
                        title="Edit nama"
                        onClick={() => openEdit(c)}
                      >✏️</button>
                      <button
                        id={`pin-btn-${c.id}`}
                        className="emp-icon-btn"
                        title="Ganti PIN"
                        onClick={() => openResetPin(c)}
                      >🔑</button>
                      <button
                        id={`toggle-btn-${c.id}`}
                        className={`emp-icon-btn ${c.is_active ? '' : 'emp-icon-btn--green'}`}
                        title={c.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        onClick={() => openToggle(c)}
                      >
                        {c.is_active ? '⛔' : '✅'}
                      </button>
                      <button
                        id={`delete-btn-${c.id}`}
                        className="emp-icon-btn emp-icon-btn--danger"
                        title="Hapus kasir"
                        onClick={() => openDelete(c)}
                      >🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* ── Modal: TAMBAH KASIR ── */}
      {modal?.type === 'add' && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal-box">
            <div className="modal-header">
              <h2 className="modal-title">➕ Tambah Kasir Baru</h2>
              <button className="modal-close-btn" onClick={closeModal} aria-label="Tutup">×</button>
            </div>
            <form onSubmit={handleAdd} className="emp-form" noValidate>
              <label htmlFor="add-name">
                Nama Kasir
                <input
                  id="add-name" ref={firstInputRef} type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="Contoh: Budi"
                  required
                />
              </label>
              <label htmlFor="add-pin">
                PIN (6 digit)
                <input
                  id="add-pin" type="password" inputMode="numeric"
                  maxLength={6} value={addPin}
                  onChange={(e) => setAddPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••" required
                />
              </label>
              <label htmlFor="add-pin-confirm">
                Konfirmasi PIN
                <input
                  id="add-pin-confirm" type="password" inputMode="numeric"
                  maxLength={6} value={addConfirm}
                  onChange={(e) => setAddConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••" required
                />
              </label>
              {formError && <p className="form-error">{formError}</p>}
              <div className="modal-footer">
                <button type="button" className="ghost-button" onClick={closeModal} disabled={submitting}>Batal</button>
                <button id="add-save-btn" type="submit" className="primary-button" disabled={submitting}>
                  {submitting ? 'Menyimpan…' : 'Simpan Kasir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: EDIT NAMA ── */}
      {modal?.type === 'edit' && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal-box">
            <div className="modal-header">
              <h2 className="modal-title">✏️ Edit Nama Kasir</h2>
              <button className="modal-close-btn" onClick={closeModal} aria-label="Tutup">×</button>
            </div>
            <form onSubmit={handleEdit} className="emp-form" noValidate>
              <label htmlFor="edit-name">
                Nama Baru
                <input
                  id="edit-name" ref={firstInputRef} type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nama kasir"
                  required
                />
              </label>
              {formError && <p className="form-error">{formError}</p>}
              <div className="modal-footer">
                <button type="button" className="ghost-button" onClick={closeModal} disabled={submitting}>Batal</button>
                <button id="edit-save-btn" type="submit" className="primary-button" disabled={submitting}>
                  {submitting ? 'Menyimpan…' : 'Simpan Nama'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: RESET PIN ── */}
      {modal?.type === 'reset_pin' && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal-box">
            <div className="modal-header">
              <h2 className="modal-title">🔑 Ganti PIN — {modal.cashier.name}</h2>
              <button className="modal-close-btn" onClick={closeModal} aria-label="Tutup">×</button>
            </div>
            <form onSubmit={handleResetPin} className="emp-form" noValidate>
              <label htmlFor="new-pin">
                PIN Baru (6 digit)
                <input
                  id="new-pin" ref={firstInputRef} type="password" inputMode="numeric"
                  maxLength={6} value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••" required
                />
              </label>
              <label htmlFor="new-pin-confirm">
                Konfirmasi PIN Baru
                <input
                  id="new-pin-confirm" type="password" inputMode="numeric"
                  maxLength={6} value={newPinConfirm}
                  onChange={(e) => setNewPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••" required
                />
              </label>
              {formError && <p className="form-error">{formError}</p>}
              <div className="modal-footer">
                <button type="button" className="ghost-button" onClick={closeModal} disabled={submitting}>Batal</button>
                <button id="pin-save-btn" type="submit" className="primary-button" disabled={submitting}>
                  {submitting ? 'Menyimpan…' : 'Simpan PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: TOGGLE STATUS ── */}
      {modal?.type === 'toggle' && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal-box">
            <div className="modal-header">
              <h2 className="modal-title">
                {modal.cashier.is_active ? '⛔ Nonaktifkan Kasir?' : '✅ Aktifkan Kasir?'}
              </h2>
              <button className="modal-close-btn" onClick={closeModal} aria-label="Tutup">×</button>
            </div>
            <p className="modal-desc">
              {modal.cashier.is_active
                ? <><strong>{modal.cashier.name}</strong> tidak akan bisa login sampai diaktifkan kembali.</>
                : <><strong>{modal.cashier.name}</strong> akan bisa login kembali menggunakan PIN.</>
              }
            </p>
            {formError && <p className="form-error">{formError}</p>}
            <div className="modal-footer">
              <button type="button" className="ghost-button" onClick={closeModal} disabled={submitting}>Batal</button>
              <button
                id="toggle-confirm-btn" type="button"
                className="primary-button"
                style={modal.cashier.is_active ? { background: '#dc2626' } : {}}
                onClick={handleToggle}
                disabled={submitting}
              >
                {submitting ? 'Memproses…' : modal.cashier.is_active ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: DELETE ── */}
      {modal?.type === 'delete' && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal-box">
            <div className="modal-header">
              <h2 className="modal-title modal-title--danger">🗑️ Hapus Kasir?</h2>
              <button className="modal-close-btn" onClick={closeModal} aria-label="Tutup">×</button>
            </div>
            <div className="modal-delete-warning">
              <p>
                Anda akan menghapus <strong>{modal.cashier.name}</strong> secara permanen.
              </p>
              <p>Seluruh data akses kasir ini akan hilang dan <strong>tidak dapat dipulihkan</strong>.</p>
            </div>

            {formError && (
              <div className="modal-deps-error">
                <p>{formError}</p>
                {hasDependencies && (
                  <p style={{ marginTop: 10 }}>
                    <strong>Saran:</strong> Nonaktifkan kasir agar tidak bisa login, tanpa menghapus riwayat data.
                  </p>
                )}
              </div>
            )}

            <div className="modal-footer">
              <button type="button" className="ghost-button" onClick={closeModal} disabled={submitting}>Batal</button>
              {hasDependencies ? (
                <button
                  id="deactivate-instead-btn"
                  type="button"
                  className="primary-button"
                  style={{ background: '#d97706' }}
                  onClick={handleDeactivateInstead}
                  disabled={submitting}
                >
                  {submitting ? 'Memproses…' : '⛔ Nonaktifkan Saja'}
                </button>
              ) : (
                <button
                  id="delete-confirm-btn"
                  type="button"
                  className="primary-button"
                  style={{ background: '#dc2626' }}
                  onClick={handleDelete}
                  disabled={submitting}
                >
                  {submitting ? 'Menghapus…' : 'Ya, Hapus Permanen'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
