import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Category, Product, ProductInsert } from '../types/database'
import { ProductImageUpload } from './ProductImageUpload'
import '../styles/ProductModal.css'

interface ProductModalProps {
  product?: Product | null
  categories: Category[]
  onSave: (payload: ProductInsert) => Promise<void>
  onClose: () => void
}

const UNITS = ['pcs', 'kg', 'g', 'liter', 'ml', 'dus', 'pack', 'lusin', 'meter', 'lembar']

const emptyForm = (): ProductInsert => ({
  name: '',
  sku: null,
  barcode: null,
  category_id: null,
  price_retail: 0,
  price_wholesale: 0,
  wholesale_min_qty: 1,
  cost_price: 0,
  stock_qty: 0,
  min_stock: 0,
  unit: 'pcs',
  image_url: null,
  is_active: true,
})

export function ProductModal({ product, categories, onSave, onClose }: ProductModalProps) {
  const [form, setForm] = useState<ProductInsert>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  const isEdit = Boolean(product)

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        category_id: product.category_id,
        price_retail: product.price_retail,
        price_wholesale: product.price_wholesale,
        wholesale_min_qty: product.wholesale_min_qty,
        cost_price: product.cost_price,
        stock_qty: product.stock_qty,
        min_stock: product.min_stock,
        unit: product.unit,
        image_url: product.image_url,
        is_active: product.is_active,
      })
    } else {
      setForm(emptyForm())
    }
  }, [product])

  function set<K extends keyof ProductInsert>(key: K, value: ProductInsert[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan produk.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="pm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pm-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="pm-sheet">

        {/* Header */}
        <div className="pm-header">
          <div className="pm-header-info">
            <span className="pm-eyebrow">{isEdit ? 'Edit' : 'Tambah'}</span>
            <h2 id="pm-title" className="pm-title">
              {isEdit ? product!.name : 'Produk Baru'}
            </h2>
          </div>
          <button
            type="button"
            className="pm-close"
            onClick={onClose}
            aria-label="Tutup modal"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form ref={formRef} onSubmit={(e) => void handleSubmit(e)} className="pm-body">

          {/* SECTION: Foto Produk */}
          <div className="pm-section">
            <p className="pm-section-label">Foto Produk</p>
            <ProductImageUpload
              currentUrl={form.image_url ?? null}
              productId={product?.id}
              onChange={(url) => set('image_url', url)}
            />
          </div>

          {/* SECTION: Informasi Dasar */}
          <div className="pm-section">
            <p className="pm-section-label">Informasi Dasar</p>

            <div className="pm-field">
              <label className="pm-label" htmlFor="pm-name">
                Nama Produk <span className="pm-req">*</span>
              </label>
              <input
                id="pm-name"
                className="pm-input"
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Contoh: Indomie Goreng"
                required
              />
            </div>

            <div className="pm-row-2">
              <div className="pm-field">
                <label className="pm-label" htmlFor="pm-sku">SKU</label>
                <input
                  id="pm-sku"
                  className="pm-input"
                  type="text"
                  value={form.sku ?? ''}
                  onChange={(e) => set('sku', e.target.value || null)}
                  placeholder="Opsional"
                />
              </div>
              <div className="pm-field">
                <label className="pm-label" htmlFor="pm-barcode">Barcode</label>
                <input
                  id="pm-barcode"
                  className="pm-input"
                  type="text"
                  value={form.barcode ?? ''}
                  onChange={(e) => set('barcode', e.target.value || null)}
                  placeholder="Opsional"
                />
              </div>
            </div>

            <div className="pm-row-2">
              <div className="pm-field">
                <label className="pm-label" htmlFor="pm-category">Kategori</label>
                <select
                  id="pm-category"
                  className="pm-input"
                  value={form.category_id ?? ''}
                  onChange={(e) => set('category_id', e.target.value || null)}
                >
                  <option value="">Tanpa kategori</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="pm-field">
                <label className="pm-label" htmlFor="pm-unit">Satuan</label>
                <select
                  id="pm-unit"
                  className="pm-input"
                  value={form.unit}
                  onChange={(e) => set('unit', e.target.value)}
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SECTION: Harga */}
          <div className="pm-section">
            <p className="pm-section-label">Harga</p>

            <div className="pm-row-3">
              <div className="pm-field">
                <label className="pm-label" htmlFor="pm-cost">Harga Modal</label>
                <div className="pm-input-prefix">
                  <span className="pm-prefix">Rp</span>
                  <input
                    id="pm-cost"
                    className="pm-input has-prefix"
                    type="number"
                    min="0"
                    step="any"
                    value={form.cost_price}
                    onChange={(e) => set('cost_price', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="pm-field">
                <label className="pm-label" htmlFor="pm-retail">
                  Harga Ecer <span className="pm-req">*</span>
                </label>
                <div className="pm-input-prefix">
                  <span className="pm-prefix">Rp</span>
                  <input
                    id="pm-retail"
                    className="pm-input has-prefix"
                    type="number"
                    min="0"
                    step="any"
                    value={form.price_retail}
                    onChange={(e) => set('price_retail', parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
              </div>
              <div className="pm-field">
                <label className="pm-label" htmlFor="pm-wholesale">Harga Grosir</label>
                <div className="pm-input-prefix">
                  <span className="pm-prefix">Rp</span>
                  <input
                    id="pm-wholesale"
                    className="pm-input has-prefix"
                    type="number"
                    min="0"
                    step="any"
                    value={form.price_wholesale}
                    onChange={(e) => set('price_wholesale', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>

            <div className="pm-field pm-field-inline">
              <label className="pm-label" htmlFor="pm-min-qty">Min. Qty Grosir</label>
              <input
                id="pm-min-qty"
                className="pm-input pm-input-narrow"
                type="number"
                min="1"
                step="any"
                value={form.wholesale_min_qty}
                onChange={(e) => set('wholesale_min_qty', parseFloat(e.target.value) || 1)}
              />
            </div>
          </div>

          {/* SECTION: Stok */}
          <div className="pm-section">
            <p className="pm-section-label">Stok</p>

            <div className="pm-row-2">
              <div className="pm-field">
                <label className="pm-label" htmlFor="pm-stock">Stok Awal</label>
                <input
                  id="pm-stock"
                  className={`pm-input ${isEdit ? 'pm-input-disabled' : ''}`}
                  type="number"
                  min="0"
                  step="any"
                  value={form.stock_qty}
                  onChange={(e) => set('stock_qty', parseFloat(e.target.value) || 0)}
                  disabled={isEdit}
                  title={isEdit ? 'Stok dikelola via mutasi stok' : undefined}
                />
                {isEdit && (
                  <span className="pm-hint">Ubah stok via halaman Mutasi Stok</span>
                )}
              </div>
              <div className="pm-field">
                <label className="pm-label" htmlFor="pm-min-stock">Stok Minimum</label>
                <input
                  id="pm-min-stock"
                  className="pm-input"
                  type="number"
                  min="0"
                  step="any"
                  value={form.min_stock}
                  onChange={(e) => set('min_stock', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="pm-error">{error}</div>
          )}
        </form>

        {/* Footer */}
        <div className="pm-footer">
          <button type="button" className="pm-btn-cancel" onClick={onClose}>
            Batal
          </button>
          <button
            type="button"
            className="pm-btn-save"
            disabled={saving}
            onClick={() => formRef.current?.requestSubmit()}
          >
            {saving
              ? '⟳ Menyimpan...'
              : isEdit
                ? 'Simpan Perubahan'
                : '+ Tambah Produk'}
          </button>
        </div>
      </div>
    </div>
  )
}
