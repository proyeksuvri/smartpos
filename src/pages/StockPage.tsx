import { useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  TYPE_LABEL,
  useStockMovements,
  useStockMutations,
  useStockProducts,
  type MovementType,
  type StockProduct,
} from '../hooks/useStock'
import '../styles/SimpleModal.css'

/* ── helpers ────────────────────────────────────────────── */
function formatDatetime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

type StockStatus = 'ok' | 'low' | 'empty'
function stockStatus(p: StockProduct): StockStatus {
  if (p.stock_qty <= 0) return 'empty'
  if (p.min_stock > 0 && p.stock_qty <= p.min_stock) return 'low'
  return 'ok'
}

const STATUS_LABEL: Record<StockStatus, string> = {
  ok: 'Aman',
  low: 'Kritis',
  empty: 'Habis',
}

/* ── Movement Modal ─────────────────────────────────────── */
type ModalMode = 'in' | 'out' | 'opname'

interface MovementModalProps {
  mode: ModalMode
  products: StockProduct[]
  selectedProduct?: StockProduct | null
  onSave: (productId: string, type: MovementType, qty: number, notes: string) => Promise<void>
  onClose: () => void
}

function MovementModal({ mode, products, selectedProduct, onSave, onClose }: MovementModalProps) {
  const [productId, setProductId] = useState(selectedProduct?.id ?? '')
  const [qty, setQty] = useState(1)
  const [physicalQty, setPhysicalQty] = useState(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  const chosenProduct = products.find((p) => p.id === productId) ?? null

  const MODAL_CONFIG = {
    in:     { title: 'Stok Masuk',  eyebrow: 'Pembelian / Penerimaan', type: 'purchase' as MovementType },
    out:    { title: 'Stok Keluar', eyebrow: 'Rusak / Hilang / Retur',  type: 'adjustment_out' as MovementType },
    opname: { title: 'Stock Opname', eyebrow: 'Penyesuaian Fisik',      type: 'adjustment_in' as MovementType },
  }

  const config = MODAL_CONFIG[mode]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!productId) { setError('Pilih produk terlebih dahulu.'); return }

    let finalType: MovementType = config.type
    let finalQty = qty

    if (mode === 'opname' && chosenProduct) {
      const diff = physicalQty - chosenProduct.stock_qty
      if (diff === 0) { setError('Stok fisik sama dengan stok sistem — tidak ada perubahan.'); return }
      finalType = diff > 0 ? 'adjustment_in' : 'adjustment_out'
      finalQty = Math.abs(diff)
    }

    setSaving(true)
    setError('')
    try {
      await onSave(productId, finalType, finalQty, notes)
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
            <span className="sm-eyebrow">{config.eyebrow}</span>
            <h2 className="sm-title">{config.title}</h2>
          </div>
          <button type="button" className="sm-close" onClick={onClose}>✕</button>
        </div>

        <form ref={formRef} onSubmit={(e) => void handleSubmit(e)} className="sm-body">
          {/* Product selector */}
          <div className="sm-field">
            <label className="sm-label" htmlFor="mv-product">
              Produk <span className="sm-req">*</span>
            </label>
            <select
              id="mv-product"
              className="sm-input"
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value)
                const p = products.find((pr) => pr.id === e.target.value)
                if (p && mode === 'opname') setPhysicalQty(p.stock_qty)
              }}
              required
            >
              <option value="">— Pilih produk —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (stok: {p.stock_qty} {p.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Current stock info */}
          {chosenProduct && (
            <div className="shift-info-card">
              <div className="shift-info-row">
                <span>Stok Sistem</span>
                <strong>{chosenProduct.stock_qty} {chosenProduct.unit}</strong>
              </div>
              {chosenProduct.min_stock > 0 && (
                <div className="shift-info-row">
                  <span>Stok Minimum</span>
                  <strong>{chosenProduct.min_stock} {chosenProduct.unit}</strong>
                </div>
              )}
            </div>
          )}

          {/* Qty fields */}
          {mode === 'opname' ? (
            <div className="sm-field">
              <label className="sm-label" htmlFor="mv-physical">
                Stok Fisik (hasil hitung) <span className="sm-req">*</span>
              </label>
              <input
                id="mv-physical"
                className="sm-input"
                type="number"
                min="0"
                step="any"
                value={physicalQty}
                onChange={(e) => setPhysicalQty(parseFloat(e.target.value) || 0)}
                required
              />
              {chosenProduct && physicalQty !== chosenProduct.stock_qty && (
                <span className={`sm-hint ${physicalQty > chosenProduct.stock_qty ? 'hint-plus' : 'hint-minus'}`}>
                  Selisih: {physicalQty > chosenProduct.stock_qty ? '+' : ''}{physicalQty - chosenProduct.stock_qty} {chosenProduct.unit}
                  {' → '}akan dicatat sebagai {physicalQty > chosenProduct.stock_qty ? 'Penyesuaian +' : 'Penyesuaian −'}
                </span>
              )}
            </div>
          ) : (
            <div className="sm-field">
              <label className="sm-label" htmlFor="mv-qty">
                Jumlah {mode === 'in' ? 'Masuk' : 'Keluar'} <span className="sm-req">*</span>
              </label>
              <input
                id="mv-qty"
                className="sm-input"
                type="number"
                min="0.001"
                step="any"
                value={qty}
                onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
                required
              />
              {chosenProduct && (
                <span className="sm-hint">
                  Stok setelah: {mode === 'in'
                    ? chosenProduct.stock_qty + qty
                    : chosenProduct.stock_qty - qty} {chosenProduct.unit}
                </span>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="sm-field">
            <label className="sm-label" htmlFor="mv-notes">
              Keterangan {mode !== 'in' && <span className="sm-req">*</span>}
            </label>
            <textarea
              id="mv-notes"
              className="sm-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                mode === 'in' ? 'Contoh: Pembelian dari supplier X' :
                mode === 'out' ? 'Contoh: Barang rusak, expired, atau hilang' :
                'Contoh: Hasil stock opname bulanan'
              }
              rows={2}
              required={mode !== 'in'}
            />
          </div>

          {error && <div className="sm-error">{error}</div>}
        </form>

        <div className="sm-footer">
          <button type="button" className="sm-btn-cancel" onClick={onClose}>Batal</button>
          <button type="button" className="sm-btn-save" disabled={saving} onClick={() => formRef.current?.requestSubmit()}>
            {saving ? '⟳ Menyimpan...' : config.title}
          </button>
        </div>
      </div>
    </div>
  )
}

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
  const [filterStatus, setFilterStatus] = useState<'all' | 'low' | 'empty'>('all')
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
                                {STATUS_LABEL[st]}
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
                              {formatDatetime(mv.created_at)}
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
        <MovementModal
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
