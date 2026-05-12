import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  STOCK_STATUS_LABEL,
  TYPE_LABEL,
  stockStatus,
  useStockMovements,
  useStockMutations,
  useStockProducts,
  type StockProduct,
  type StockStatus,
  type MovementType,
} from '../hooks/useStock'
import { formatDate } from '../lib/formatters'
import { StockMovementModal, type ModalMode } from '../components/StockMovementModal'
import '../styles/SimpleModal.css'

// formatDatetime → diganti formatDate dari lib/formatters.ts
// stockStatus, StockStatus, STATUS_LABEL → dipindah ke hooks/useStock.ts
// MovementModal → dipindah ke components/StockMovementModal.tsx
// ModalMode → di-re-export dari StockMovementModal.tsx

/* ── Stock Page ─────────────────────────────────────────── */
type ActiveTab = 'list' | 'history'

export function StockPage() {
  const { profile } = useAuth()
  const canManage = profile?.role === 'manager' || profile?.role === 'owner'

  const { products, loading: productsLoading, error: productsError, refetch: refetchProducts } = useStockProducts()
  const { movements, loading: movLoading, error: movError, refetch: refetchMovements } = useStockMovements()
  const { addMovement } = useStockMutations()

  const [tab, setTab] = useState<ActiveTab>('list')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | StockStatus>('all')
  const [modalMode, setModalMode] = useState<ModalMode | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<StockProduct | null>(null)
  const [actionError, setActionError] = useState('')

  const filtered = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku ?? '').toLowerCase().includes(search.toLowerCase())
    const st = stockStatus(p)
    const matchFilter = filterStatus === 'all' || filterStatus === st
    return matchSearch && matchFilter
  })

  const criticalCount = products.filter((p) => stockStatus(p) !== 'ok').length

  async function handleSave(productId: string, type: MovementType, qty: number, notes: string) {
    setActionError('')
    await addMovement({ product_id: productId, type, qty, notes })
    await refetchProducts()
    await refetchMovements()
  }

  function openModal(mode: ModalMode, product?: StockProduct) {
    setSelectedProduct(product ?? null)
    setModalMode(mode)
  }

  return (
    <>
      <section className="page-stack">
        <div className="page-header">
          <div>
            <span className="eyebrow">Inventori</span>
            <h1>Stok</h1>
          </div>
          {canManage && (
            <div className="header-actions">
              {criticalCount > 0 && (
                <span className="badge badge-warning">{criticalCount} perlu perhatian</span>
              )}
              <button type="button" className="ghost-button" onClick={() => openModal('opname')}>
                📋 Stock Opname
              </button>
              <button type="button" className="ghost-button" onClick={() => openModal('out')}>
                📤 Stok Keluar
              </button>
              <button type="button" className="primary-button" onClick={() => openModal('in')}>
                📥 Stok Masuk
              </button>
            </div>
          )}
        </div>

        {actionError && <p className="form-error">{actionError}</p>}

        {/* Tabs */}
        <div className="stock-tabs">
          <button
            type="button"
            className={`stock-tab ${tab === 'list' ? 'active' : ''}`}
            onClick={() => setTab('list')}
          >
            📦 Daftar Stok
          </button>
          <button
            type="button"
            className={`stock-tab ${tab === 'history' ? 'active' : ''}`}
            onClick={() => setTab('history')}
          >
            📜 Riwayat Pergerakan
          </button>
        </div>

        {/* ── Tab: Daftar Stok ───────────────────────── */}
        {tab === 'list' && (
          <section className="panel">
            <div className="toolbar">
              <input
                className="search-input"
                placeholder="Cari produk atau SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                aria-label="Filter status stok"
              >
                <option value="all">Semua status</option>
                <option value="low">⚠️ Kritis</option>
                <option value="empty">🔴 Habis</option>
              </select>
            </div>

            {productsLoading && (
              <div className="loading-panel" style={{ marginTop: 16 }}>
                <div className="spinner" /><span>Memuat stok...</span>
              </div>
            )}
            {productsError && !productsLoading && (
              <p className="form-error" style={{ marginTop: 16 }}>{productsError}</p>
            )}

            {!productsLoading && !productsError && (
              <div className="table-shell">
                {filtered.length === 0 ? (
                  <div className="empty-state compact">
                    <h2>Tidak ada produk</h2>
                    <p>{search || filterStatus !== 'all' ? 'Ubah filter pencarian.' : 'Tambahkan produk di halaman Produk.'}</p>
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Produk</th>
                        <th>Kategori</th>
                        <th>Stok</th>
                        <th>Min. Stok</th>
                        <th>Status</th>
                        {canManage && <th>Aksi</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p) => {
                        const st = stockStatus(p)
                        return (
                          <tr key={p.id}>
                            <td>
                              <strong className="product-name">{p.name}</strong>
                              {p.sku && <small className="product-meta">SKU: {p.sku}</small>}
                            </td>
                            <td className="text-muted">{p.category_name ?? '—'}</td>
                            <td>
                              <span className={st === 'ok' ? '' : st === 'low' ? 'stock-low' : 'stock-empty'}>
                                {p.stock_qty} {p.unit}
                              </span>
                            </td>
                            <td className="text-muted">
                              {p.min_stock > 0 ? `${p.min_stock} ${p.unit}` : '—'}
                            </td>
                            <td>
                              <span className={`status-badge ${st === 'ok' ? 'active' : st === 'low' ? 'warning' : 'inactive'}`}>
                                {STOCK_STATUS_LABEL[st]}
                              </span>
                            </td>
                            {canManage && (
                              <td>
                                <div className="row-actions">
                                  <button type="button" className="ghost-button small" onClick={() => openModal('in', p)}>
                                    📥 Masuk
                                  </button>
                                  <button type="button" className="ghost-button small" onClick={() => openModal('out', p)}>
                                    📤 Keluar
                                  </button>
                                  <button type="button" className="ghost-button small" onClick={() => openModal('opname', p)}>
                                    📋 Opname
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
            {!productsLoading && filtered.length > 0 && (
              <p className="table-count">{filtered.length} produk</p>
            )}
          </section>
        )}

        {/* ── Tab: Riwayat ──────────────────────────── */}
        {tab === 'history' && (
          <section className="panel">
            {movLoading && (
              <div className="loading-panel"><div className="spinner" /><span>Memuat riwayat...</span></div>
            )}
            {movError && !movLoading && (
              <p className="form-error">{movError}</p>
            )}
            {!movLoading && !movError && (
              <div className="table-shell">
                {movements.length === 0 ? (
                  <div className="empty-state compact">
                    <h2>Belum ada pergerakan stok</h2>
                    <p>Pergerakan stok akan tercatat di sini setelah transaksi atau penyesuaian.</p>
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Waktu</th>
                        <th>Produk</th>
                        <th>Jenis</th>
                        <th>Qty</th>
                        <th>Keterangan</th>
                        <th>Oleh</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((mv) => {
                        const isIn = ['purchase', 'return', 'adjustment_in', 'void'].includes(mv.type)
                        return (
                          <tr key={mv.id}>
                            <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>
                              {formatDate(mv.created_at)}
                            </td>
                            <td><strong className="product-name">{mv.product_name}</strong></td>
                            <td>
                              <span className={`status-badge ${isIn ? 'active' : 'inactive'}`}>
                                {TYPE_LABEL[mv.type]}
                              </span>
                            </td>
                            <td>
                              <span className={isIn ? 'mv-in' : 'mv-out'}>
                                {isIn ? '+' : '−'}{mv.qty}
                              </span>
                            </td>
                            <td className="text-muted">{mv.notes ?? '—'}</td>
                            <td className="text-muted">{mv.created_by_name ?? '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
            {!movLoading && movements.length > 0 && (
              <p className="table-count">{movements.length} entri (200 terbaru)</p>
            )}
          </section>
        )}
      </section>

      {/* Movement Modal */}
      {modalMode && (
        <StockMovementModal
          mode={modalMode}
          products={products}
          selectedProduct={selectedProduct}
          onSave={handleSave}
          onClose={() => { setModalMode(null); setSelectedProduct(null) }}
        />
      )}
    </>
  )
}
