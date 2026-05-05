import { useState } from 'react'
import { ProductModal } from '../components/ProductModal'
import { useAuth } from '../hooks/useAuth'
import { useCategories } from '../hooks/useCategories'
import { useProducts } from '../hooks/useProducts'
import type { Product, ProductInsert } from '../types/database'

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value)
}

export function ProductsPage() {
  const { profile } = useAuth()
  const canManage = profile?.role === 'manager' || profile?.role === 'owner'

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const { products, loading, error, createProduct, updateProduct, deleteProduct } = useProducts({
    search,
    categoryId: categoryFilter,
    showInactive,
  })

  const { categories } = useCategories()

  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Product | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null)
  const [actionError, setActionError] = useState('')

  function openCreate() {
    setEditTarget(null)
    setModalOpen(true)
  }

  function openEdit(product: Product) {
    setEditTarget(product)
    setModalOpen(true)
  }

  async function handleSave(payload: ProductInsert) {
    setActionError('')
    if (editTarget) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { stock_qty: _sq, ...updatePayload } = payload
      await updateProduct(editTarget.id, updatePayload)
    } else {
      await createProduct(payload)
    }
  }

  async function handleDelete(product: Product) {
    setActionError('')
    try {
      await deleteProduct(product.id)
      setDeleteConfirm(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal menghapus produk.')
    }
  }

  const lowStock = products.filter(
    (p) => p.min_stock > 0 && p.stock_qty <= p.min_stock,
  ).length

  return (
    <>
      <section className="page-stack">
        <div className="page-header">
          <div>
            <span className="eyebrow">Master Data</span>
            <h1>Produk</h1>
          </div>
          <div className="header-actions">
            {lowStock > 0 && (
              <span className="badge badge-warning">{lowStock} stok kritis</span>
            )}
            {canManage && (
              <button id="btn-tambah-produk" type="button" className="primary-button" onClick={openCreate}>
                + Tambah Produk
              </button>
            )}
          </div>
        </div>

        {actionError && <p className="form-error">{actionError}</p>}

        <section className="panel">
          <div className="toolbar">
            <input
              id="search-produk"
              className="search-input"
              placeholder="Cari nama produk..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              id="filter-kategori"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter kategori"
            >
              <option value="">Semua kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {canManage && (
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                <span>Tampilkan nonaktif</span>
              </label>
            )}
          </div>

          {loading && (
            <div className="loading-panel" style={{ marginTop: '16px' }}>
              <div className="spinner" />
              <span>Memuat produk...</span>
            </div>
          )}

          {error && !loading && (
            <p className="form-error" style={{ marginTop: '16px' }}>
              {error}
            </p>
          )}

          {!loading && !error && (
            <div className="table-shell">
              {products.length === 0 ? (
                <div className="empty-state compact">
                  <h2>Belum ada produk</h2>
                  <p>
                    {search || categoryFilter
                      ? 'Tidak ada produk yang sesuai dengan filter.'
                      : 'Tambahkan produk pertama Anda untuk memulai.'}
                  </p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Produk</th>
                      <th>SKU</th>
                      <th>Kategori</th>
                      <th>Harga Ecer</th>
                      <th>Stok</th>
                      <th>Status</th>
                      {canManage && <th>Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => {
                      const isLow =
                        product.min_stock > 0 && product.stock_qty <= product.min_stock
                      return (
                        <tr key={product.id} className={!product.is_active ? 'row-inactive' : ''}>
                          <td>
                            <strong className="product-name">{product.name}</strong>
                            {product.barcode && (
                              <small className="product-meta">{product.barcode}</small>
                            )}
                          </td>
                          <td className="text-muted">{product.sku ?? '—'}</td>
                          <td className="text-muted">{product.categories?.name ?? '—'}</td>
                          <td>{formatRupiah(product.price_retail)}</td>
                          <td>
                            <span className={isLow ? 'stock-low' : ''}>
                              {product.stock_qty} {product.unit}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge ${product.is_active ? 'active' : 'inactive'}`}>
                              {product.is_active ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                          {canManage && (
                            <td>
                              <div className="row-actions">
                                <button
                                  type="button"
                                  className="ghost-button small"
                                  onClick={() => openEdit(product)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="ghost-button small danger"
                                  onClick={() => setDeleteConfirm(product)}
                                >
                                  Nonaktifkan
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {!loading && products.length > 0 && (
            <p className="table-count">
              Menampilkan {products.length} produk
            </p>
          )}
        </section>
      </section>

      {/* Modal Tambah/Edit */}
      {modalOpen && (
        <ProductModal
          product={editTarget}
          categories={categories}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
        />
      )}

      {/* Dialog Konfirmasi Nonaktifkan */}
      {deleteConfirm && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal modal-sm">
            <div className="modal-header">
              <h2>Nonaktifkan Produk?</h2>
            </div>
            <p>
              Produk <strong>{deleteConfirm.name}</strong> akan dinonaktifkan dan tidak muncul di
              daftar maupun POS.
            </p>
            {actionError && <p className="form-error">{actionError}</p>}
            <div className="modal-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setDeleteConfirm(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="primary-button danger"
                onClick={() => void handleDelete(deleteConfirm)}
              >
                Nonaktifkan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
