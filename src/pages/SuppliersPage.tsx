import { useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useSuppliers } from '../hooks/useSuppliers'
import type { Supplier, SupplierInsert } from '../types/database'
import '../styles/SimpleModal.css'

interface SupplierModalProps {
  supplier?: Supplier | null
  onSave: (payload: SupplierInsert) => Promise<void>
  onClose: () => void
}

function SupplierModal({ supplier, onSave, onClose }: SupplierModalProps) {
  const [form, setForm] = useState<SupplierInsert>({
    name: supplier?.name ?? '',
    phone: supplier?.phone ?? null,
    address: supplier?.address ?? null,
    is_active: supplier?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const isEdit = Boolean(supplier)

  function set<K extends keyof SupplierInsert>(key: K, val: SupplierInsert[K]) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave({ ...form, name: form.name.trim(), phone: form.phone?.trim() || null, address: form.address?.trim() || null })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sm-backdrop" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sm-sheet">
        <div className="sm-header">
          <div className="sm-header-info">
            <span className="sm-eyebrow">{isEdit ? 'Edit' : 'Tambah'}</span>
            <h2 className="sm-title">{isEdit ? supplier!.name : 'Supplier Baru'}</h2>
          </div>
          <button type="button" className="sm-close" onClick={onClose}>✕</button>
        </div>
        <form ref={formRef} onSubmit={(e) => void handleSubmit(e)} className="sm-body">
          <div className="sm-field">
            <label className="sm-label" htmlFor="sup-name">Nama Supplier <span className="sm-req">*</span></label>
            <input id="sup-name" className="sm-input" type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Nama pemasok / distributor" required autoFocus />
          </div>
          <div className="sm-field">
            <label className="sm-label" htmlFor="sup-phone">No. Telepon</label>
            <input id="sup-phone" className="sm-input" type="tel" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value || null)} placeholder="08xx..." />
          </div>
          <div className="sm-field">
            <label className="sm-label" htmlFor="sup-address">Alamat</label>
            <textarea id="sup-address" className="sm-input" value={form.address ?? ''} onChange={(e) => set('address', e.target.value || null)} placeholder="Opsional" rows={2} />
          </div>
          {error && <div className="sm-error">{error}</div>}
        </form>
        <div className="sm-footer">
          <button type="button" className="sm-btn-cancel" onClick={onClose}>Batal</button>
          <button type="button" className="sm-btn-save" disabled={saving} onClick={() => formRef.current?.requestSubmit()}>
            {saving ? '⟳ Menyimpan...' : isEdit ? 'Simpan' : '+ Tambah'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function SuppliersPage() {
  const { profile } = useAuth()
  const canManage = profile?.role === 'manager' || profile?.role === 'owner'
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const { suppliers, loading, error, createSupplier, updateSupplier, deleteSupplier } = useSuppliers({ search, showInactive })
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Supplier | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Supplier | null>(null)
  const [actionError, setActionError] = useState('')

  async function handleSave(payload: SupplierInsert) {
    if (editTarget) { await updateSupplier(editTarget.id, payload) }
    else { await createSupplier(payload) }
  }

  async function handleDelete(sup: Supplier) {
    setActionError('')
    try { await deleteSupplier(sup.id); setDeleteConfirm(null) }
    catch (err) { setActionError(err instanceof Error ? err.message : 'Gagal.') }
  }

  return (
    <>
      <section className="page-stack">
        <div className="page-header">
          <div><span className="eyebrow">Master Data</span><h1>Supplier</h1></div>
          {canManage && (
            <button id="btn-tambah-supplier" type="button" className="primary-button" onClick={() => { setEditTarget(null); setModalOpen(true) }}>
              + Tambah Supplier
            </button>
          )}
        </div>
        {actionError && <p className="form-error">{actionError}</p>}
        <section className="panel">
          <div className="toolbar">
            <input className="search-input" placeholder="Cari supplier..." value={search} onChange={(e) => setSearch(e.target.value)} />
            {canManage && (
              <label className="toggle-label">
                <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
                <span>Tampilkan nonaktif</span>
              </label>
            )}
          </div>
          {loading && <div className="loading-panel" style={{ marginTop: 16 }}><div className="spinner" /><span>Memuat...</span></div>}
          {error && !loading && <p className="form-error" style={{ marginTop: 16 }}>{error}</p>}
          {!loading && !error && (
            <div className="table-shell">
              {suppliers.length === 0 ? (
                <div className="empty-state compact"><h2>Belum ada supplier</h2><p>{search ? 'Tidak ada yang sesuai.' : 'Tambahkan supplier pertama.'}</p></div>
              ) : (
                <table>
                  <thead><tr>
                    <th>Nama</th><th>Telepon</th><th>Alamat</th><th>Status</th>
                    {canManage && <th>Aksi</th>}
                  </tr></thead>
                  <tbody>
                    {suppliers.map((sup) => (
                      <tr key={sup.id} className={!sup.is_active ? 'row-inactive' : ''}>
                        <td><strong className="product-name">{sup.name}</strong></td>
                        <td className="text-muted">{sup.phone ?? '—'}</td>
                        <td className="text-muted">{sup.address ?? '—'}</td>
                        <td>
                          <span className={`status-badge ${sup.is_active ? 'active' : 'inactive'}`}>
                            {sup.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        {canManage && (
                          <td><div className="row-actions">
                            <button type="button" className="ghost-button small" onClick={() => { setEditTarget(sup); setModalOpen(true) }}>Edit</button>
                            <button type="button" className="ghost-button small danger" onClick={() => setDeleteConfirm(sup)}>Nonaktifkan</button>
                          </div></td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {!loading && suppliers.length > 0 && <p className="table-count">{suppliers.length} supplier</p>}
        </section>
      </section>

      {modalOpen && <SupplierModal supplier={editTarget} onSave={handleSave} onClose={() => setModalOpen(false)} />}

      {deleteConfirm && (
        <div className="sm-backdrop" role="dialog" aria-modal="true">
          <div className="sm-sheet">
            <div className="sm-header"><div className="sm-header-info"><span className="sm-eyebrow">Konfirmasi</span><h2 className="sm-title">Nonaktifkan Supplier?</h2></div></div>
            <p className="sm-confirm-body">Supplier <strong>{deleteConfirm.name}</strong> akan dinonaktifkan.</p>
            <div className="sm-footer">
              <button type="button" className="sm-btn-cancel" onClick={() => setDeleteConfirm(null)}>Batal</button>
              <button type="button" className="sm-btn-danger" onClick={() => void handleDelete(deleteConfirm)}>Nonaktifkan</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
