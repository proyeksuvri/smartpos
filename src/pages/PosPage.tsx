import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PaymentModal } from '../components/PaymentModal'
import { CloseShiftModal, OpenShiftModal } from '../components/ShiftModals'
import { useAuth } from '../hooks/useAuth'
import { useCart } from '../hooks/useCart'
import { useCheckout } from '../hooks/useCheckout'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useProductCache } from '../lib/productCache'
import { useShift } from '../hooks/useShift'
import { formatRp } from '../lib/formatters'
import { db, type CachedProductUnit } from '../lib/db'
import type { Product } from '../types/database'

/* ── Helpers ────────────────────────────────────────────── */
// formatRp dan generateInvoiceNo telah dipindah ke src/lib/formatters.ts dan src/lib/invoiceUtils.ts

/* ── Cart Item Row ──────────────────────────────────────── */
interface CartItemRowProps {
  item: ReturnType<typeof useCart>['items'][number]
  onQty: (productId: string, unitId: string | null, qty: number) => void
  onRemove: (productId: string, unitId: string | null) => void
}

function CartItemRow({ item, onQty, onRemove }: CartItemRowProps) {
  const p      = item.product
  const unitId = item.unit?.id ?? null
  const isBulk = item.unit !== null

  // Stok dihitung dari unit dasar
  const overStock = p.stock_qty > 0 && item.qtyInBase > p.stock_qty

  // Hint grosir hanya untuk mode satuan dasar
  const hasWholesale     = !isBulk && p.price_wholesale > 0 && p.wholesale_min_qty > 0
  const qtyUntilWholesale = hasWholesale && !item.isWholesale
    ? p.wholesale_min_qty - item.qty
    : 0

  return (
    <div className="pos-cart-item">
      {/* Thumbnail */}
      <div className="pos-cart-thumb">
        {p.image_url ? (
          <img src={p.image_url} alt={p.name} className="pos-cart-thumb-img" loading="lazy" />
        ) : (
          <span className="pos-cart-thumb-placeholder">🛍️</span>
        )}
      </div>

      {/* Info */}
      <div className="pos-cart-item-body">
        {/* Top row: name + badges + remove */}
        <div className="pos-cart-item-top">
          <div className="pos-cart-item-name-wrap">
            <span className="pos-cart-item-name">{p.name}</span>
            {isBulk && (
              <span className="badge-unit">{item.unitLabel}</span>
            )}
            {item.isWholesale && <span className="badge-grosir">Grosir</span>}
          </div>
          <button
            type="button"
            className="pos-cart-remove"
            onClick={() => onRemove(p.id, unitId)}
            title="Hapus item"
          >✕</button>
        </div>

        {/* Konversi unit partai → unit dasar */}
        {isBulk && (
          <div className="pos-cart-unit-conv">
            {item.qty} {item.unitLabel} = <strong>{item.qtyInBase} {p.unit}</strong>
          </div>
        )}

        {/* Bottom row: harga + qty + subtotal */}
        <div className="pos-cart-item-bottom">
          <span className="pos-cart-item-price">
            {formatRp(item.unitPrice)}<span className="pos-unit-label">/{item.unitLabel}</span>
          </span>
          <div className="pos-cart-item-controls">
            <button type="button" className="qty-btn"
              onClick={() => onQty(p.id, unitId, item.qty - 1)}>−</button>
            <input
              className="qty-input"
              type="number"
              min="1"
              value={item.qty}
              onChange={(e) => onQty(p.id, unitId, parseInt(e.target.value) || 1)}
            />
            <button type="button" className="qty-btn"
              onClick={() => onQty(p.id, unitId, item.qty + 1)}>+</button>
          </div>
          <span className="pos-cart-item-subtotal">{formatRp(item.subtotal)}</span>
        </div>

        {/* Wholesale hint (hanya mode satuan) */}
        {qtyUntilWholesale > 0 && (
          <div className="pos-cart-wholesale-hint">
            Tambah <strong>{qtyUntilWholesale}</strong> lagi → grosir {formatRp(p.price_wholesale)}/{p.unit}
          </div>
        )}

        {/* Over-stock warning */}
        {overStock && (
          <div className="pos-cart-stock-warn">
            ⚠️ Qty melebihi stok ({p.stock_qty} {p.unit})
          </div>
        )}
      </div>
    </div>
  )
}

/* ── POS Page ───────────────────────────────────────────── */
export function PosPage() {
  const { user } = useAuth()
  const { activeShift, loading: shiftLoading, openShift, closeShift } = useShift()
  const [search, setSearch] = useState('')
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)

  // Mode Offline: ambil produk dari IndexedDB cache
  const { products: cachedProducts, loading: productsLoading, syncing: productsSyncing, syncFromServer } = useProductCache()

  // Cache unit partai: Map<product_id, CachedProductUnit[]>
  const [allUnits, setAllUnits] = useState<Map<string, CachedProductUnit[]>>(new Map())
  useEffect(() => {
    db.product_units_cache.toArray().then((rows) => {
      const map = new Map<string, CachedProductUnit[]>()
      for (const u of rows) {
        if (!map.has(u.product_id)) map.set(u.product_id, [])
        map.get(u.product_id)!.push(u)
      }
      // Sort per product by sort_order
      for (const units of map.values()) {
        units.sort((a, b) => a.sort_order - b.sort_order)
      }
      setAllUnits(map)
    })
  }, [productsSyncing]) // reload saat sync selesai

  const categories = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of cachedProducts) {
      if (p.category_id && p.category_name) {
        map.set(p.category_id, p.category_name)
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [cachedProducts])

  const displayedProducts = useMemo(() => {
    let filtered = cachedProducts
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
      )
    }
    if (activeCategoryId) {
      filtered = filtered.filter((p) => p.category_id === activeCategoryId)
    }
    return filtered as unknown as Product[] // cast karena perbedaan struktur (misal tanpa created_at)
  }, [cachedProducts, search, activeCategoryId])

  const cart = useCart()
  const {
    items, subtotal, total, txDiscount, itemCount,
    addItem, setQty, removeItem, clearCart, setTxDiscount,
  } = cart

  const [showOpenShift, setShowOpenShift] = useState(false)
  const [showCloseShift, setShowCloseShift] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [lastInvoice, setLastInvoice] = useState<string | null>(null)
  const [txError, setTxError] = useState('')

  const isOnline = useOnlineStatus()
  const { pendingCount, syncing: syncRunning } = useOfflineSync()
  const { checkout } = useCheckout()

  const hasShift = Boolean(activeShift)

  /**
   * Handler pembayaran — hanya mengurus UI state.
   * Semua business logic didelegasikan ke useCheckout hook.
   */
  async function handlePayment(method: 'cash' | 'transfer' | 'mixed', cashPaid: number) {
    if (!activeShift || !user) throw new Error('Shift tidak aktif.')

    setTxError('')
    const { invoiceNo } = await checkout(
      { shiftId: activeShift.id, userId: user.id, items, subtotal, txDiscount, total },
      method,
      cashPaid,
    )
    setLastInvoice(invoiceNo)
    clearCart()
  }

  return (
    <>
      <section className="pos-layout">
        {/* ── LEFT PANEL ──────────────────────────────── */}
        <div className="pos-left">

          {/* Header */}
          <div className="pos-header">
            <div>
              <span className="eyebrow">Kasir</span>
              <h1 className="pos-title">
                POS
                <button 
                  type="button" 
                  className="ghost-button small" 
                  onClick={() => void syncFromServer()}
                  disabled={productsSyncing || !isOnline}
                  style={{ marginLeft: 12, fontSize: 12 }}
                  title="Tarik data produk terbaru"
                >
                  {productsSyncing ? '🔄 Syncing...' : '🔄 Sync'}
                </button>
              </h1>
            </div>
            <div className="pos-header-actions">
              {hasShift ? (
                <button type="button" className="ghost-button shift-badge open" onClick={() => setShowCloseShift(true)}>
                  🟢 Shift Aktif — Tutup
                </button>
              ) : (
                <button type="button" className="primary-button" onClick={() => setShowOpenShift(true)}>
                  🔓 Buka Shift
                </button>
              )}
            </div>
          </div>

          {/* Alerts */}
          {!shiftLoading && !hasShift && (
            <div className="pos-no-shift">
              <p>⚠️ Buka shift terlebih dahulu sebelum memulai transaksi.</p>
            </div>
          )}

          {/* Offline / Pending sync indicator */}
          {!isOnline && (
            <div style={{
              background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8,
              padding: '8px 14px', fontSize: 13, color: '#92400e',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>📡</span>
              <span><strong>Mode Offline</strong> — transaksi disimpan lokal dan akan sync otomatis saat internet pulih.</span>
            </div>
          )}

          {pendingCount > 0 && isOnline && (
            <div style={{
              background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
              padding: '8px 14px', fontSize: 13, color: '#1e40af',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            }}>
              <span>☁ {syncRunning ? 'Menyinkronkan…' : `${pendingCount} transaksi offline menunggu sync`}</span>
              <Link to="/sync-queue" style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none', fontWeight: 700 }}>
                Lihat Antrian →
              </Link>
            </div>
          )}

          {lastInvoice && (
            <div className="pos-success">
              <span>✅ Transaksi berhasil — <strong>{lastInvoice}</strong></span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Link
                  to={`/receipt/${lastInvoice}`}
                  className="receipt-action-btn ghost"
                  style={{ height: 30, fontSize: 12, padding: '0 12px' }}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  🖨️ Lihat Struk
                </Link>
                <button type="button" onClick={() => setLastInvoice(null)}>✕</button>
              </div>
            </div>
          )}

          {txError && <div className="form-error">{txError}</div>}

          {/* Search */}
          <div className="pos-search-wrap">
            <input
              className="pos-search"
              placeholder="🔍 Cari produk, SKU, atau barcode..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setActiveCategoryId(null) }}
              disabled={!hasShift}
            />
          </div>

          {/* Category Filter Chips */}
          {categories.length > 0 && (
            <div className="pos-cat-chips">
              <button
                type="button"
                className={`pos-cat-chip ${activeCategoryId === null ? 'active' : ''}`}
                onClick={() => setActiveCategoryId(null)}
              >
                Semua
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`pos-cat-chip ${activeCategoryId === cat.id ? 'active' : ''}`}
                  onClick={() => { setActiveCategoryId(cat.id); setSearch('') }}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Product Grid */}
          <div className="pos-product-area">
            {productsLoading && (
              <div className="loading-panel"><div className="spinner" /><span>Memuat produk...</span></div>
            )}

            {!productsLoading && displayedProducts.length === 0 && (
              <div className="empty-state compact">
                <h2>{search ? 'Produk tidak ditemukan' : 'Belum ada produk'}</h2>
                <p>
                  {search
                    ? `Tidak ada hasil untuk "${search}"`
                    : activeCategoryId
                      ? 'Tidak ada produk di kategori ini.'
                      : 'Tambahkan produk di halaman Produk.'}
                </p>
              </div>
            )}

            {!productsLoading && displayedProducts.length > 0 && (
              <div className="pos-product-grid">
                {displayedProducts.map((product: Product) => {
                  const productUnits = allUnits.get(product.id) ?? []
                  const inCartQty   = items
                    .filter((i) => i.product.id === product.id)
                    .reduce((s, i) => s + i.qtyInBase, 0)
                  const inCart  = inCartQty > 0
                  const noStock = product.stock_qty <= 0
                  const lowStock = !noStock && product.min_stock > 0 && product.stock_qty <= product.min_stock

                  return (
                    <button
                      key={product.id}
                      type="button"
                      className={`pos-product-card ${inCart ? 'in-cart' : ''} ${noStock ? 'no-stock' : ''}`}
                      onClick={() => { if (!noStock && hasShift) addItem(product, 1, null) }}
                      disabled={noStock || !hasShift}
                      title={noStock ? 'Stok habis' : product.name}
                    >
                      {product.image_url && (
                        <div className="pos-product-img-wrap">
                          <img src={product.image_url} alt={product.name} className="pos-product-img" loading="lazy" />
                        </div>
                      )}
                      <span className="pos-product-name">{product.name}</span>
                      <span className="pos-product-price">{formatRp(product.price_retail)}</span>
                      <span className={`pos-product-stock ${lowStock ? 'stock-warn' : ''} ${noStock ? 'stock-out' : ''}`}>
                        {noStock ? '❌ Habis' : `${product.stock_qty} ${product.unit}`}
                      </span>
                      {inCart && <span className="pos-product-qty-badge">{inCartQty}</span>}

                      {/* Unit partai buttons */}
                      {productUnits.length > 0 && !noStock && hasShift && (
                        <div
                          className="pos-product-units"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {productUnits.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              className="pos-product-unit-btn"
                              onClick={(e) => {
                                e.stopPropagation()
                                addItem(product, 1, u)
                              }}
                              title={`${formatRp(u.price)} / ${u.unit_name} (${u.conversion_factor} ${product.unit})`}
                            >
                              +{u.unit_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: CART ──────────────────────────────── */}
        <aside className="pos-cart">
          <div className="pos-cart-header">
            <h2>Keranjang {itemCount > 0 && <span className="cart-count-badge">{itemCount}</span>}</h2>
            {items.length > 0 && (
              <button type="button" className="ghost-button small danger" onClick={clearCart}>
                Hapus Semua
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="cart-empty">
              <span className="cart-empty-icon">🛒</span>
              <p>Ketuk produk untuk menambah</p>
            </div>
          ) : (
            <div className="pos-cart-items">
              {items.map((item) => (
                <CartItemRow
                  key={`${item.product.id}-${item.unit?.id ?? 'base'}`}
                  item={item}
                  onQty={setQty}
                  onRemove={removeItem}
                />
              ))}
            </div>
          )}

          {/* Discount input */}
          {items.length > 0 && (
            <div className="pos-discount">
              <label className="pos-discount-label" htmlFor="tx-discount">Diskon (Rp)</label>
              <input
                id="tx-discount"
                className="pos-discount-input"
                type="number"
                min="0"
                step="any"
                value={txDiscount}
                onChange={(e) => setTxDiscount(parseFloat(e.target.value) || 0)}
              />
            </div>
          )}

          {/* Footer totals + pay */}
          <div className="pos-cart-footer">
            <div className="pos-total-row">
              <span>Subtotal ({itemCount} item)</span>
              <span>{formatRp(subtotal)}</span>
            </div>
            {txDiscount > 0 && (
              <div className="pos-total-row discount">
                <span>Diskon</span>
                <span>-{formatRp(txDiscount)}</span>
              </div>
            )}
            <div className="pos-total-row grand">
              <strong>Total</strong>
              <strong>{formatRp(total)}</strong>
            </div>
            <button
              type="button"
              className="primary-button pay-btn"
              disabled={items.length === 0 || !hasShift}
              onClick={() => setShowPayment(true)}
            >
              💳 Bayar {items.length > 0 ? formatRp(total) : ''}
            </button>
          </div>
        </aside>
      </section>

      {showOpenShift && (
        <OpenShiftModal
          onOpen={async (cash) => { await openShift(cash) }}
          onClose={() => setShowOpenShift(false)}
        />
      )}

      {showCloseShift && activeShift && (
        <CloseShiftModal
          shift={activeShift}
          onClose_={async (cash, notes) => { await closeShift(activeShift.id, cash, notes) }}
          onCancel={() => setShowCloseShift(false)}
        />
      )}

      {showPayment && (
        <PaymentModal
          items={items}
          subtotal={subtotal}
          txDiscount={txDiscount}
          total={total}
          onConfirm={handlePayment}
          onClose={() => setShowPayment(false)}
        />
      )}
    </>
  )
}
