import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PaymentModal } from '../components/PaymentModal'
import { CloseShiftModal, OpenShiftModal } from '../components/ShiftModals'
import { useAuth } from '../hooks/useAuth'
import { useCart } from '../hooks/useCart'
import { useCategories } from '../hooks/useCategories'
import { useProducts } from '../hooks/useProducts'
import { useShift } from '../hooks/useShift'
import { supabase } from '../lib/supabase'
import type { Product } from '../types/database'

/* ── Helpers ────────────────────────────────────────────── */
function formatRp(v: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(v)
}

function generateInvoiceNo() {
  const d = new Date()
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `TRX-${date}-${String(Math.floor(Math.random() * 9000) + 1000)}`
}

/* ── Cart Item Row ──────────────────────────────────────── */
interface CartItemRowProps {
  item: ReturnType<typeof useCart>['items'][number]
  onQty: (id: string, qty: number) => void
  onRemove: (id: string) => void
}

function CartItemRow({ item, onQty, onRemove }: CartItemRowProps) {
  const lowStock = item.product.stock_qty > 0 && item.qty >= item.product.stock_qty

  return (
    <div className="pos-cart-item">
      {/* Thumbnail */}
      <div className="pos-cart-thumb">
        {item.product.image_url ? (
          <img
            src={item.product.image_url}
            alt={item.product.name}
            className="pos-cart-thumb-img"
            loading="lazy"
          />
        ) : (
          <span className="pos-cart-thumb-placeholder">🛍️</span>
        )}
      </div>

      {/* Info */}
      <div className="pos-cart-item-body">
        {/* Top row: name + badge + remove */}
        <div className="pos-cart-item-top">
          <div className="pos-cart-item-name-wrap">
            <span className="pos-cart-item-name">{item.product.name}</span>
            {item.isWholesale && <span className="badge-grosir">Grosir</span>}
          </div>
          <button
            type="button"
            className="pos-cart-remove"
            onClick={() => onRemove(item.product.id)}
            title="Hapus item"
          >
            ✕
          </button>
        </div>

        {/* Bottom row: harga + qty + subtotal */}
        <div className="pos-cart-item-bottom">
          <span className="pos-cart-item-price">{formatRp(item.unitPrice)}</span>
          <div className="pos-cart-item-controls">
            <button
              type="button"
              className="qty-btn"
              onClick={() => onQty(item.product.id, item.qty - 1)}
            >−</button>
            <input
              className="qty-input"
              type="number"
              min="1"
              max={item.product.stock_qty}
              value={item.qty}
              onChange={(e) => onQty(item.product.id, parseInt(e.target.value) || 1)}
            />
            <button
              type="button"
              className={`qty-btn ${lowStock ? 'qty-max' : ''}`}
              onClick={() => onQty(item.product.id, item.qty + 1)}
              disabled={lowStock}
            >+</button>
          </div>
          <span className="pos-cart-item-subtotal">{formatRp(item.subtotal)}</span>
        </div>
      </div>
    </div>
  )
}

/* ── POS Page ───────────────────────────────────────────── */
export function PosPage() {
  const { user } = useAuth()
  const { activeShift, loading: shiftLoading, openShift, closeShift } = useShift()
  const { categories } = useCategories()

  const [search, setSearch] = useState('')
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)

  // Fetch all products once, filter client-side for snappy category switching
  const { products, loading: productsLoading } = useProducts({ search, showInactive: false })

  const displayedProducts = useMemo(() => {
    if (!activeCategoryId) return products
    return products.filter((p) => p.category_id === activeCategoryId)
  }, [products, activeCategoryId])

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

  const hasShift = Boolean(activeShift)

  async function handlePayment(method: 'cash' | 'transfer' | 'mixed', cashPaid: number) {
    if (!activeShift || !user) throw new Error('Shift tidak aktif.')
    if (items.length === 0) throw new Error('Keranjang kosong.')

    setTxError('')
    const invoiceNo = generateInvoiceNo()

    const { error } = await supabase.rpc('create_paid_transaction', {
      p_client_transaction_id: crypto.randomUUID(),
      p_idempotency_key: crypto.randomUUID(),
      p_invoice_no: invoiceNo,
      p_customer_id: null,
      p_type: 'retail' as const,
      p_payment_method: method,
      p_subtotal: subtotal,
      p_discount: txDiscount,
      p_total: total,
      p_cash_paid: method === 'cash' || method === 'mixed' ? cashPaid : null,
      p_change: method === 'cash' ? Math.max(0, cashPaid - total) : null,
      p_shift_id: activeShift.id,
      p_items: items.map((i) => ({
        product_id: i.product.id,
        qty: i.qty,
        unit_price: i.unitPrice,
        master_price: i.product.price_retail,
        discount: i.discount,
        subtotal: i.subtotal,
      })),
    })

    if (error) throw new Error(error.message)
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
              <h1 className="pos-title">POS</h1>
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
                  const inCart = items.find((i) => i.product.id === product.id)
                  const noStock = product.stock_qty <= 0
                  const lowStock = !noStock && product.min_stock > 0 && product.stock_qty <= product.min_stock

                  return (
                    <button
                      key={product.id}
                      type="button"
                      className={`pos-product-card ${inCart ? 'in-cart' : ''} ${noStock ? 'no-stock' : ''}`}
                      onClick={() => { if (!noStock && hasShift) addItem(product) }}
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
                      {inCart && <span className="pos-product-qty-badge">{inCart.qty}</span>}
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
                  key={item.product.id}
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
