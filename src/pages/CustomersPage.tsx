import { useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useCustomers } from '../hooks/useCustomers'
import type { Customer, CustomerInsert } from '../types/database'
import '../styles/SimpleModal.css'

interface CustomerModalProps {
  customer?: Customer | null
  onSave: (payload: CustomerInsert) => Promise<void>
  onClose: () => void
}

function CustomerModal({ customer, onSave, onClose }: CustomerModalProps) {
  const [form, setForm] = useState<CustomerInsert>({
    name: customer?.name ?? '',
    phone: customer?.phone ?? null,
    type: customer?.type ?? 'retail',
    address: customer?.address ?? null,
    credit_limit: customer?.credit_limit ?? 0,
    is_active: customer?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const isEdit = Boolean(customer)

  function set<K extends keyof CustomerInsert>(key: K, val: CustomerInsert[K]) {
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
            <h2 className="sm-title">{isEdit ? customer!.name : 'Customer Baru'}</h2>
          </div>
          <button type="button" className="sm-close" onClick={onClose}>✕</button>
        </div>
        <form ref={formRef} onSubmit={(e) => void handleSubmit(e)} className="sm-body">
          <div className="sm-field">
            <label className="sm-label" htmlFor="cust-name">Nama <span className="sm-req">*</span></label>
            <input id="cust-name" className="sm-input" type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Nama customer" required autoFocus />
          </div>
          <div className="sm-row-2">
            <div className="sm-field">
              <label className="sm-label" htmlFor="cust-phone">No. Telepon</label>
              <input id="cust-phone" className="sm-input" type="tel" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value || null)} placeholder="08xx..." />
            </div>
            <div className="sm-field">
              <label className="sm-label" htmlFor="cust-type">Tipe</label>
              <select id="cust-type" className="sm-input" value={form.type} onChange={(e) => set('type', e.target.value as 'retail' | 'wholesale')}>
                <option value="retail">Ecer (Retail)</option>
                <option value="wholesale">Grosir (Wholesale)</option>
              </select>
            </div>
          </div>
          <div className="sm-field">
            <label className="sm-label" htmlFor="cust-address">Alamat</label>
            <textarea id="cust-address" className="sm-input" value={form.address ?? ''} onChange={(e) => set('address', e.target.value || null)} placeholder="Opsional" rows={2} />
          </div>
          <div className="sm-field">
            <label className="sm-label" htmlFor="cust-credit">Limit Kredit</label>
            <div className="sm-input-prefix">
              <span className="sm-prefix">Rp</span>
              <input id="cust-credit" className="sm-input has-prefix" type="number" min="0" step="any" value={form.credit_limit} onChange={(e) => set('credit_limit', parseFloat(e.target.value) || 0)} />
            </div>
            <span className="sm-hint">Isi 0 jika tidak ada limit kredit</span>
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

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value)
}

export function CustomersPage() {
  const { profile } = useAuth()
  const canManage = profile?.role === 'manager' || profile?.role === 'owner'
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const { customers, loading, error, createCustomer, updateCustomer, deleteCustomer } = useCustomers({ search, showInactive })
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Customer | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Customer | null>(null)
  const [actionError, setActionError] = useState('')

  async function handleSave(payload: CustomerInsert) {
    if (editTarget) { await updateCustomer(editTarget.id, payload) }
    else { await createCustomer(payload) }
  }

  async function handleDelete(cust: Customer) {
    setActionError('')
    try { await deleteCustomer(cust.id); setDeleteConfirm(null) }
    catch (err) { setActionError(err instanceof Error ? err.message : 'Gagal.') }
  }

  return (
    <>
      <section className="page-stack">
        <div className="page-header">
          <div><span className="eyebrow">Master Data</span><h1>Customer</h1></div>
          {canManage && (
            <button id="btn-tambah-customer" type="button" className="primary-button" onClick={() => { setEditTarget(null); setModalOpen(true) }}>
              + Tambah Customer
            </button>
          )}
        </div>
        {actionError && <p className="form-error">{actionError}</p>}
        <section className="panel">
          <div className="toolbar">
            <input className="search-input" placeholder="Cari customer..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
              {customers.length === 0 ? (
                <div className="empty-state compact"><h2>Belum ada customer</h2><p>{search ? 'Tidak ada yang sesuai.' : 'Tambahkan customer pertama.'}</p></div>
              ) : (
                <table>
                  <thead><tr>
                    <th>Nama</th><th>Telepon</th><th>Tipe</th><th>Limit Kredit</th><th>Status</th>
                    {canManage && <th>Aksi</th>}
                  </tr></thead>
                  <tbody>
                    {customers.map((cust) => (
                      <tr key={cust.id} className={!cust.is_active ? 'row-inactive' : ''}>
                        <td>
                          <strong className="product-name">{cust.name}</strong>
                          {cust.address && <small className="product-meta">{cust.address}</small>}
                        </td>
                        <td className="text-muted">{cust.phone ?? '—'}</td>
                        <td>
                          <span className={`status-badge ${cust.type === 'wholesale' ? 'wholesale' : 'retail-badge'}`}>
                            {cust.type === 'wholesale' ? 'Grosir' : 'Ecer'}
                          </span>
                        </td>
                        <td className={cust.credit_limit > 0 ? '' : 'text-muted'}>
                          {cust.credit_limit > 0 ? formatRupiah(cust.credit_limit) : '—'}
                        </td>
                        <td>
                          <span className={`status-badge ${cust.is_active ? 'active' : 'inactive'}`}>
                            {cust.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        {canManage && (
                          <td><div className="row-actions">
                            <button type="button" className="ghost-button small" onClick={() => { setEditTarget(cust); setModalOpen(true) }}>Edit</button>
                            <button type="button" className="ghost-button small danger" onClick={() => setDeleteConfirm(cust)}>Nonaktifkan</button>
                          </div></td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {!loading && customers.length > 0 && <p className="table-count">{customers.length} customer</p>}
        </section>
      </section>

      {modalOpen && <CustomerModal customer={editTarget} onSave={handleSave} onClose={() => setModalOpen(false)} />}

      {deleteConfirm && (
        <div className="sm-backdrop" role="dialog" aria-modal="true">
          <div className="sm-sheet">
            <div className="sm-header"><div className="sm-header-info"><span className="sm-eyebrow">Konfirmasi</span><h2 className="sm-title">Nonaktifkan Customer?</h2></div></div>
            <p className="sm-confirm-body">Customer <strong>{deleteConfirm.name}</strong> akan dinonaktifkan.</p>
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
