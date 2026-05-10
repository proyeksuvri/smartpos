/**
 * db.ts — SmartPOS IndexedDB schema via Dexie.js
 *
 * Tabel:
 *  - products_cache     : cache produk aktif untuk POS offline
 *  - pending_transactions: transaksi offline menunggu sync
 *  - sync_meta          : metadata sinkronisasi terakhir
 */
import Dexie, { type Table } from 'dexie'

/* ── Types ──────────────────────────────────────────────── */
export interface CachedProduct {
  id:                string
  name:              string
  sku:               string | null
  barcode:           string | null
  category_id:       string | null
  category_name:     string | null
  price_retail:      number
  price_wholesale:   number
  wholesale_min_qty: number
  cost_price:        number
  stock_qty:         number
  min_stock:         number
  unit:              string
  image_url:         string | null
  is_active:         boolean
  updated_at:        string
}

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed'

export interface PendingTransaction {
  /** Local UUID — primary key di IndexedDB */
  localId:                  string
  client_transaction_id:    string
  idempotency_key:          string
  invoice_no:               string
  /** Full RPC payload — disimpan agar bisa di-retry */
  payload: {
    p_client_transaction_id: string
    p_idempotency_key:        string
    p_invoice_no:             string
    p_customer_id:            string | null
    p_type:                   'retail' | 'wholesale'
    p_payment_method:         'cash' | 'transfer' | 'mixed'
    p_subtotal:               number
    p_discount:               number
    p_total:                  number
    p_cash_paid:              number | null
    p_change:                 number | null
    p_shift_id:               string
    p_items: {
      product_id:            string
      qty:                   number
      unit_price:            number
      master_price:          number
      discount:              number
      subtotal:              number
    }[]
  }
  sync_status:  SyncStatus
  retry_count:  number
  last_error:   string | null
  created_at:   string
  synced_at:    string | null
}

export interface SyncMeta {
  key:                     string   // 'main' — single row
  last_products_sync_at:   string | null
  schema_version:          number
}

/* ── Database ───────────────────────────────────────────── */
class SmartPOSDatabase extends Dexie {
  products_cache!:      Table<CachedProduct,      string>
  pending_transactions!: Table<PendingTransaction, string>
  sync_meta!:           Table<SyncMeta,            string>

  constructor() {
    super('smartpos_db')

    this.version(1).stores({
      products_cache:       'id, name, sku, barcode, category_id, is_active, updated_at',
      pending_transactions: 'localId, idempotency_key, sync_status, created_at',
      sync_meta:            'key',
    })
  }
}

export const db = new SmartPOSDatabase()

/* ── Helpers ────────────────────────────────────────────── */

/** Ambil metadata sinkronisasi, buat jika belum ada */
export async function getSyncMeta(): Promise<SyncMeta> {
  const meta = await db.sync_meta.get('main')
  if (meta) return meta
  const newMeta: SyncMeta = { key: 'main', last_products_sync_at: null, schema_version: 1 }
  await db.sync_meta.put(newMeta)
  return newMeta
}

/** Update waktu sync produk terakhir */
export async function markProductsSynced() {
  await db.sync_meta.put({
    key: 'main',
    last_products_sync_at: new Date().toISOString(),
    schema_version: 1,
  })
}

/** Hitung cache produk sudah terlalu lama (> 24 jam) */
export async function isCacheStale(maxAgeHours = 24): Promise<boolean> {
  const meta = await getSyncMeta()
  if (!meta.last_products_sync_at) return true
  const diffMs = Date.now() - new Date(meta.last_products_sync_at).getTime()
  return diffMs > maxAgeHours * 60 * 60 * 1000
}
