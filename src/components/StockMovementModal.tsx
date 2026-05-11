/**
 * StockMovementModal.tsx
 * Modal untuk input pergerakan stok: masuk, keluar, dan stock opname.
 * Dipindahkan dari StockPage.tsx agar setiap file memiliki satu tanggung jawab.
 */

import { useRef, useState } from 'react'
import {
  type MovementType,
  type StockProduct,
} from '../hooks/useStock'
import '../styles/SimpleModal.css'

/* ── Types ──────────────────────────────────────────────── */
export type ModalMode = 'in' | 'out' | 'opname'

interface MovementModalProps {
  mode: ModalMode
  products: StockProduct[]
  selectedProduct?: StockProduct | null
  onSave: (productId: string, type: MovementType, qty: number, notes: string) => Promise<void>
  onClose: () => void
}

/* ── Konfigurasi per mode ───────────────────────────────── */
const MODAL_CONFIG = {
  in: {
    title:   'Stok Masuk',
    eyebrow: 'Pembelian / Penerimaan',
    type:    'purchase' as MovementType,
  },
  out: {
    title:   'Stok Keluar',
    eyebrow: 'Rusak / Hilang / Retur',
    type:    'adjustment_out' as MovementType,
  },
  opname: {
    title:   'Stock Opname',
    eyebrow: 'Penyesuaian Fisik',
    type:    'adjustment_in' as MovementType,
  },
} as const

/* ── Komponen ───────────────────────────────────────────── */
export function StockMovementModal({
  mode,
  products,
  selectedProduct,
  onSave,
  onClose,
}: MovementModalProps) {
  const [productId,   setProductId]   = useState(selectedProduct?.id ?? '')
  const [qty,         setQty]         = useState(1)
  const [physicalQty, setPhysicalQty] = useState(selectedProduct?.stock_qty ?? 0)
  const [notes,       setNotes]       = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  const config        = MODAL_CONFIG[mode]
  const chosenProduct = products.find((p) => p.id === productId) ?? null

  /**
   * Logika kalkulasi opname: business rule untuk menentukan jenis adjustment
   * (in / out) dan jumlahnya berdasarkan selisih fisik vs sistem.
   */
  function calcOpname(physQty: number, currentQty: number): { type: MovementType; qty: number } | null {
    const diff = physQty - currentQty
    if (diff === 0) return null
    return {
      type: diff > 0 ? 'adjustment_in' : 'adjustment_out',
      qty:  Math.abs(diff),
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!productId) { setError('Pilih produk terlebih dahulu.'); return }

    let finalType: MovementType = config.type
    let finalQty                = qty

    if (mode === 'opname' && chosenProduct) {
      const result = calcOpname(physicalQty, chosenProduct.stock_qty)
      if (!result) {
        setError('Stok fisik sama dengan stok sistem — tidak ada perubahan.')
        return
      }
      finalType = result.type
      finalQty  = result.qty
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
    <div
      className="sm-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="sm-sheet">
        <div className="sm-header">
          <div className="sm-header-info">
            <span className="sm-eyebrow">{config.eyebrow}</span>
            <h2 className="sm-title">{config.title}</h2>
          </div>
          <button type="button" className="sm-close" onClick={onClose}>✕</button>
        </div>

        <form ref={formRef} onSubmit={(e) => void handleSubmit(e)} className="sm-body">
          {/* Pemilih Produk */}
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

          {/* Info stok saat ini */}
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

          {/* Input jumlah */}
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
                  Selisih: {physicalQty > chosenProduct.stock_qty ? '+' : ''}
                  {physicalQty - chosenProduct.stock_qty} {chosenProduct.unit}
                  {' → '}akan dicatat sebagai{' '}
                  {physicalQty > chosenProduct.stock_qty ? 'Penyesuaian +' : 'Penyesuaian −'}
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
                  Stok setelah:{' '}
                  {mode === 'in'
                    ? chosenProduct.stock_qty + qty
                    : chosenProduct.stock_qty - qty}{' '}
                  {chosenProduct.unit}
                </span>
              )}
            </div>
          )}

          {/* Keterangan */}
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
                mode === 'in'     ? 'Contoh: Pembelian dari supplier X' :
                mode === 'out'    ? 'Contoh: Barang rusak, expired, atau hilang' :
                                    'Contoh: Hasil stock opname bulanan'
              }
              rows={2}
              required={mode !== 'in'}
            />
          </div>

          {error && <div className="sm-error">{error}</div>}
        </form>

        <div className="sm-footer">
          <button type="button" className="sm-btn-cancel" onClick={onClose}>
            Batal
          </button>
          <button
            type="button"
            className="sm-btn-save"
            disabled={saving}
            onClick={() => formRef.current?.requestSubmit()}
          >
            {saving ? '⟳ Menyimpan...' : config.title}
          </button>
        </div>
      </div>
    </div>
  )
}
