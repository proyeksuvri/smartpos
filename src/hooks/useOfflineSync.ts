import { useCallback, useEffect, useRef, useState } from 'react'
import { db, type PendingTransaction } from '../lib/db'
import { supabase } from '../lib/supabase'
import { useOnlineStatus } from './useOnlineStatus'

const MAX_RETRY = 5

/**
 * useOfflineSync — mengelola antrean transaksi offline dan sinkronisasi ke server.
 *
 * Cara kerja:
 * 1. Saat online pulih, otomatis trigger sync semua transaksi pending
 * 2. Setiap transaksi dikirim satu per satu via RPC create_paid_transaction
 * 3. Server menggunakan idempotency_key untuk mencegah duplikasi
 * 4. Jika sync gagal, status jadi 'failed' dan retry_count bertambah
 * 5. Transaksi yang gagal > MAX_RETRY tidak di-retry otomatis (perlu intervensi manual)
 */
export function useOfflineSync() {
  const isOnline          = useOnlineStatus()
  const [pending,  setPending]  = useState<PendingTransaction[]>([])
  const [syncing,  setSyncing]  = useState(false)
  const [lastSyncError, setLastSyncError] = useState<string | null>(null)
  const syncingRef = useRef(false)  // guard agar tidak double-run

  /** Reload daftar pending dari IndexedDB */
  const refreshPending = useCallback(async () => {
    const rows = await db.pending_transactions
      .where('sync_status').anyOf(['pending', 'failed', 'syncing'])
      .sortBy('created_at')
    setPending(rows)
  }, [])

  /** Simpan transaksi baru ke IndexedDB (dipanggil dari PosPage saat offline) */
  const savePendingTransaction = useCallback(async (
    tx: Omit<PendingTransaction, 'sync_status' | 'retry_count' | 'last_error' | 'created_at' | 'synced_at'>
  ) => {
    const record: PendingTransaction = {
      ...tx,
      sync_status: 'pending',
      retry_count: 0,
      last_error:  null,
      created_at:  new Date().toISOString(),
      synced_at:   null,
    }
    await db.pending_transactions.put(record)
    await refreshPending()
  }, [refreshPending])

  /** Sync satu transaksi ke server */
  async function syncOne(tx: PendingTransaction): Promise<boolean> {
    // Tandai sebagai 'syncing'
    await db.pending_transactions.update(tx.localId, { sync_status: 'syncing' })

    try {
      const { error } = await supabase.rpc('create_paid_transaction', tx.payload)

      if (error) {
        // Jika error "already exists" (idempotency hit) → anggap sukses
        const isDuplicate = error.message?.toLowerCase().includes('duplicate')
          || error.message?.toLowerCase().includes('already exists')
          || error.message?.toLowerCase().includes('idempotency')

        if (isDuplicate) {
          await db.pending_transactions.update(tx.localId, {
            sync_status: 'synced',
            synced_at: new Date().toISOString(),
          })
          return true
        }

        throw new Error(error.message)
      }

      await db.pending_transactions.update(tx.localId, {
        sync_status: 'synced',
        synced_at:   new Date().toISOString(),
        last_error:  null,
      })
      return true

    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Unknown error'
      const newRetry = tx.retry_count + 1
      await db.pending_transactions.update(tx.localId, {
        sync_status: newRetry >= MAX_RETRY ? 'failed' : 'pending',
        retry_count: newRetry,
        last_error:  errMsg,
      })
      console.warn(`[Sync] Failed tx ${tx.invoice_no} (retry ${newRetry}):`, errMsg)
      return false
    }
  }

  /** Sync semua transaksi pending ke server */
  const syncAll = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return
    syncingRef.current = true
    setSyncing(true)
    setLastSyncError(null)

    try {
      // Ambil semua yang belum sync dan belum melebihi batas retry
      const toSync = await db.pending_transactions
        .where('sync_status').anyOf(['pending', 'syncing'])
        .toArray()
        .then((rows) => rows.filter((r) => r.retry_count < MAX_RETRY))
        .then((rows) => rows.sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ))

      let failCount = 0
      for (const tx of toSync) {
        const ok = await syncOne(tx)
        if (!ok) failCount++
      }

      if (failCount > 0) {
        setLastSyncError(`${failCount} transaksi gagal disinkronkan. Cek halaman Sync Queue.`)
      }
    } finally {
      syncingRef.current = false
      setSyncing(false)
      await refreshPending()
    }
  }, [refreshPending])

  /** Retry manual satu transaksi yang gagal */
  const retryOne = useCallback(async (localId: string) => {
    await db.pending_transactions.update(localId, {
      sync_status: 'pending',
      retry_count: 0,
      last_error:  null,
    })
    await refreshPending()
    if (navigator.onLine) await syncAll()
  }, [syncAll, refreshPending])

  /** Hapus transaksi dari antrian (hanya untuk yang sudah synced atau manual dismiss) */
  const dismissFailed = useCallback(async (localId: string) => {
    await db.pending_transactions.delete(localId)
    await refreshPending()
  }, [refreshPending])

  /* Auto-sync saat koneksi pulih */
  useEffect(() => {
    if (isOnline) {
      void refreshPending().then(() => syncAll())
    }
  }, [isOnline, refreshPending, syncAll])

  /* Load pending saat mount */
  useEffect(() => {
    void refreshPending()
  }, [refreshPending])

  const pendingCount = pending.filter((t) => t.sync_status === 'pending').length
  const failedCount  = pending.filter((t) => t.sync_status === 'failed').length

  return {
    pending,
    pendingCount,
    failedCount,
    syncing,
    lastSyncError,
    savePendingTransaction,
    syncAll,
    retryOne,
    dismissFailed,
    refreshPending,
  }
}
