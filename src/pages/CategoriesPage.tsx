import { useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useCategories } from '../hooks/useCategories'
import type { Category, CategoryInsert } from '../types/database'
import '../styles/SimpleModal.css'

/* ── Modal ─────────────────────────────────────────────── */
interface CategoryModalProps {
  category?: Category | null
  onSave: (payload: CategoryInsert) => Promise<void>
  onClose: () => void
}

function CategoryModal({ category, onSave, onClose }: CategoryModalProps) {
  const [name, setName] = useState(category?.name ?? '')
  const [description, setDescription] = useState(category?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const isEdit = Boolean(category)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave({ name: name.trim(), description: description.trim() || null, is_active: true })
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
            <h2 className="sm-title">{isEdit ? category!.name : 'Kategori Baru'}</h2>
          </div>
          <button type="button" className="sm-close" onClick={onClose}>✕</button>
        </div>

        <form ref={formRef} onSubmit={(e) => void handleSubmit(e)} className="sm-body">
          <div className="sm-field">
            <label className="sm-label" htmlFor="cat-name">
              Nama Kategori <span className="sm-req">*</span>
            </label>
            <input
              id="cat-name"
              className="sm-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Minuman, Makanan Ringan..."
              required
              autoFocus
            />
          </div>

          <div className="sm-field">
            <label className="sm-label" htmlFor="cat-desc">Deskripsi</label>
            <textarea
              id="cat-desc"
              className="sm-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opsional — deskripsi singkat kategori"
              rows={2}
            />
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

/* ── Page ──────────────────────────────────────────────── */
export function CategoriesPage() {
  const { profile } = useAuth()
  const canManage = profile?.role === 'manager' || profile?.role === 'owner'

  const { categories, loading, error, createCategory, updateCategory, deleteCategory } = useCategories()
  const [search, setSearch] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Category | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Category | null>(null)
  const [actionError, setActionError] = useState('')

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  )

  async function handleSave(payload: CategoryInsert) {
    if (editTarget) {
      await updateCategory(editTarget.id, payload)
    } else {
      await createCategory(payload)
    }
  }

  async function handleDelete(cat: Category) {
    setActionError('')
    try {
      await deleteCategory(cat.id)
      setDeleteConfirm(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal menghapus.')
    }
  }

  return (
    <>
      <section className="page-stack">
        <div className="page-header">
          <div>
            <span className="eyebrow">Master Data</span>
            <h1>Kategori</h1>
          </div>
          {canManage && (
            <button id="btn-tambah-kategori" type="button" className="primary-button" onClick={() => { setEditTarget(null); setModalOpen(true) }}>
              + Tambah Kategori
            </button>
          )}
        </div>

        {actionError && <p className="form-error">{actionError}</p>}

        <section className="panel">
          <div className="toolbar">
            <input
              className="search-input"
              placeholder="Cari kategori..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading && (
            <div className="loading-panel" style={{ marginTop: 16 }}>
              <div className="spinner" />
              <span>Memuat kategori...</span>
            </div>
          )}

          {error && !loading && <p className="form-error" style={{ marginTop: 16 }}>{error}</p>}

          {!loading && !error && (
            <div className="table-shell">
              {filtered.length === 0 ? (
                <div className="empty-state compact">
                  <h2>Belum ada kategori</h2>
                  <p>{search ? 'Tidak ada yang sesuai pencarian.' : 'Tambahkan kategori pertama.'}</p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>Deskripsi</th>
                      <th>Status</th>
                      {canManage && <th>Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((cat) => (
                      <tr key={cat.id}>
                        <td><strong className="product-name">{cat.name}</strong></td>
                        <td className="text-muted">{cat.description ?? '—'}</td>
                        <td>
                          <span className={`status-badge ${cat.is_active ? 'active' : 'inactive'}`}>
                            {cat.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        {canManage && (
                          <td>
                            <div className="row-actions">
                              <button type="button" className="ghost-button small" onClick={() => { setEditTarget(cat); setModalOpen(true) }}>Edit</button>
                              <button type="button" className="ghost-button small danger" onClick={() => setDeleteConfirm(cat)}>Nonaktifkan</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <p className="table-count">{filtered.length} kategori</p>
          )}
        </section>
      </section>

      {modalOpen && (
        <CategoryModal
          category={editTarget}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
        />
      )}

      {deleteConfirm && (
        <div className="sm-backdrop" role="dialog" aria-modal="true">
          <div className="sm-sheet">
            <div className="sm-header">
              <div className="sm-header-info">
                <span className="sm-eyebrow">Konfirmasi</span>
                <h2 className="sm-title">Nonaktifkan Kategori?</h2>
              </div>
            </div>
            <p className="sm-confirm-body">
              Kategori <strong>{deleteConfirm.name}</strong> akan dinonaktifkan.
              Produk yang terhubung tidak terhapus.
            </p>
            {actionError && <p className="sm-error" style={{ margin: '0 22px' }}>{actionError}</p>}
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
