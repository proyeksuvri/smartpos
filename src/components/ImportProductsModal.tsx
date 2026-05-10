import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import type { Category } from '../types/database'

interface ImportProductsModalProps {
  categories: Category[]
  onClose: () => void
  onSuccess: () => void
}

const TEMPLATE_HEADERS = [
  'Nama Produk',
  'Kategori (Opsional)',
  'SKU (Opsional)',
  'Barcode (Opsional)',
  'Harga Ecer',
  'Harga Grosir',
  'Min Qty Grosir',
  'Harga Modal',
  'Stok',
  'Stok Min',
  'Satuan',
]

export function ImportProductsModal({ categories, onClose, onSuccess }: ImportProductsModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successCount, setSuccessCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template Produk')
    XLSX.writeFile(wb, 'Template_Import_Produk.xlsx')
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError(null)
    setSuccessCount(0)

    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' })

      if (rows.length === 0) {
        throw new Error('File Excel kosong atau tidak valid.')
      }

      // Maps for quick category lookup (case insensitive)
      const catMap = new Map<string, string>()
      categories.forEach((c) => catMap.set(c.name.toLowerCase().trim(), c.id))

      const productsToInsert: any[] = []
      const stockMovementsToInsert: any[] = []
      
      // Batch ID for tracking bulk operations (could be a random UUID, using simple string for now)
      const batchId = `import-${Date.now()}`

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        
        // Find column names flexibly
        const getCol = (possibleNames: string[]) => {
          const key = Object.keys(row).find(k => possibleNames.some(pn => k.toLowerCase().includes(pn.toLowerCase())))
          return key ? row[key] : ''
        }

        const name = getCol(['Nama Produk', 'Name', 'Nama'])
        if (!name) continue // Skip empty rows

        const catName = getCol(['Kategori'])?.toString().trim()
        let categoryId = null

        if (catName) {
          const searchKey = catName.toLowerCase()
          if (catMap.has(searchKey)) {
            categoryId = catMap.get(searchKey)
          } else {
            // Create new category on the fly
            const { data: newCat, error: catErr } = await supabase
              .from('categories')
              .insert({ name: catName, is_active: true })
              .select('id')
              .single()
            if (!catErr && newCat) {
              categoryId = newCat.id
              catMap.set(searchKey, newCat.id)
            }
          }
        }

        // Generate UUID for product so we can link stock movements
        const productId = crypto.randomUUID()

        const stockQty = parseFloat(getCol(['Stok', 'Stock']) || '0')

        productsToInsert.push({
          id: productId,
          name: name.toString().trim(),
          sku: getCol(['SKU'])?.toString().trim() || null,
          barcode: getCol(['Barcode'])?.toString().trim() || null,
          category_id: categoryId,
          price_retail: parseFloat(getCol(['Harga Ecer', 'Retail']) || '0'),
          price_wholesale: parseFloat(getCol(['Harga Grosir', 'Wholesale']) || '0'),
          wholesale_min_qty: parseFloat(getCol(['Min Qty Grosir', 'Min Grosir']) || '0'),
          cost_price: parseFloat(getCol(['Harga Modal', 'Modal', 'Cost']) || '0'),
          stock_qty: stockQty,
          min_stock: parseFloat(getCol(['Stok Min', 'Min Stok', 'Min']) || '0'),
          unit: getCol(['Satuan', 'Unit'])?.toString().trim() || 'Pcs',
          is_active: true,
        })

        if (stockQty > 0) {
          stockMovementsToInsert.push({
            product_id: productId,
            type: 'in',
            qty: stockQty,
            notes: 'Stok awal (Import Data)',
          })
        }
      }

      if (productsToInsert.length === 0) {
        throw new Error('Tidak ada data produk valid yang ditemukan dalam file.')
      }

      // Insert products in chunks of 100 to avoid request size limits
      const CHUNK_SIZE = 100
      let inserted = 0
      for (let i = 0; i < productsToInsert.length; i += CHUNK_SIZE) {
        const chunk = productsToInsert.slice(i, i + CHUNK_SIZE)
        const { error: insErr } = await supabase.from('products').insert(chunk)
        if (insErr) throw new Error(`Gagal menyimpan produk: ${insErr.message}`)
        inserted += chunk.length
      }

      // Insert stock movements
      for (let i = 0; i < stockMovementsToInsert.length; i += CHUNK_SIZE) {
        const chunk = stockMovementsToInsert.slice(i, i + CHUNK_SIZE)
        const { error: smErr } = await supabase.from('stock_movements').insert(chunk)
        if (smErr) console.warn('Gagal mencatat mutasi stok awal:', smErr.message)
      }

      setSuccessCount(inserted)
      setTimeout(() => {
        onSuccess()
      }, 2000)

    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat memproses file Excel.')
    } finally {
      setLoading(false)
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          <h2>Import Produk via Excel</h2>
          <button type="button" className="close-button" onClick={onClose} disabled={loading}>
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ display: 'grid', gap: '16px' }}>
          {error && <p className="form-error">{error}</p>}
          {successCount > 0 && (
            <div className="status-badge active" style={{ display: 'block', padding: '12px', textAlign: 'center', fontSize: '14px' }}>
              ✅ Berhasil mengimpor {successCount} produk!
            </div>
          )}

          <div style={{ background: 'var(--surface-muted)', padding: '16px', borderRadius: '8px', fontSize: '13px' }}>
            <p style={{ margin: '0 0 10px', fontWeight: 600 }}>Panduan Import:</p>
            <ol style={{ margin: 0, paddingLeft: '20px', display: 'grid', gap: '6px' }}>
              <li>Unduh template Excel yang telah disediakan.</li>
              <li>Isi data produk pada template (kolom Nama Produk wajib diisi).</li>
              <li>Kategori baru akan dibuat otomatis jika belum ada di database.</li>
              <li>Simpan file dan unggah kembali ke sini.</li>
            </ol>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              type="button"
              className="ghost-button"
              onClick={downloadTemplate}
              style={{ flex: 1 }}
              disabled={loading}
            >
              📥 Download Template
            </button>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={(e) => void handleFile(e)}
                style={{
                  position: 'absolute',
                  opacity: 0,
                  width: '100%',
                  height: '100%',
                  cursor: 'pointer'
                }}
                disabled={loading}
              />
              <button
                type="button"
                className="primary-button"
                style={{ width: '100%', pointerEvents: 'none' }}
                disabled={loading}
              >
                {loading ? 'Memproses...' : '📤 Upload File Excel'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
