import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'

/* ── Types ──────────────────────────────────────────────── */
export type CostCategory =
  | 'gaji' | 'sewa' | 'listrik' | 'air' | 'internet'
  | 'transportasi' | 'bahan_baku_non_produk' | 'perlengkapan'
  | 'pemasaran' | 'lainnya'

export type CostPeriod = 'harian' | 'mingguan' | 'bulanan' | 'tahunan' | 'sekali'

export const COST_CATEGORY_LABELS: Record<CostCategory, string> = {
  gaji:                  'Gaji & Upah',
  sewa:                  'Sewa Tempat',
  listrik:               'Listrik',
  air:                   'Air',
  internet:              'Internet & Telekomunikasi',
  transportasi:          'Transportasi',
  bahan_baku_non_produk: 'Bahan Baku Non-Produk',
  perlengkapan:          'Perlengkapan',
  pemasaran:             'Pemasaran & Promosi',
  lainnya:               'Lainnya',
}

export const COST_PERIOD_LABELS: Record<CostPeriod, string> = {
  harian:   'Harian',
  mingguan: 'Mingguan',
  bulanan:  'Bulanan',
  tahunan:  'Tahunan',
  sekali:   'Sekali Bayar',
}

export interface OperationalCost {
  id:           string
  name:         string
  category:     CostCategory
  amount:       number
  period:       CostPeriod
  cost_date:    string
  description:  string | null
  is_recurring: boolean
  created_by:   string | null
  created_at:   string
  updated_at:   string
}

export interface OperationalCostInput {
  name:         string
  category:     CostCategory
  amount:       number
  period:       CostPeriod
  cost_date:    string
  description?: string
  is_recurring: boolean
}

/* ── Hook ───────────────────────────────────────────────── */
export function useOperationalCosts() {
  const [data, setData]       = useState<OperationalCost[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  /* -- Fetch -- */
  const fetch = useCallback(async (dateFrom?: string, dateTo?: string) => {
    setLoading(true); setError(null)
    try {
      let query = supabase
        .from('operational_costs')
        .select('*')
        .order('cost_date', { ascending: false })

      if (dateFrom) query = query.gte('cost_date', dateFrom)
      if (dateTo)   query = query.lte('cost_date', dateTo)

      const { data: rows, error: err } = await query
      if (err) throw err
      setData((rows ?? []) as OperationalCost[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat biaya operasional.')
    } finally { setLoading(false) }
  }, [])

  /* -- Create -- */
  const create = useCallback(async (input: OperationalCostInput): Promise<boolean> => {
    setLoading(true); setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error: err } = await supabase
        .from('operational_costs')
        .insert({ ...input, created_by: user?.id })
      if (err) throw err
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan biaya.')
      return false
    } finally { setLoading(false) }
  }, [])

  /* -- Update -- */
  const update = useCallback(async (id: string, input: Partial<OperationalCostInput>): Promise<boolean> => {
    setLoading(true); setError(null)
    try {
      const { error: err } = await supabase
        .from('operational_costs')
        .update(input)
        .eq('id', id)
      if (err) throw err
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengubah biaya.')
      return false
    } finally { setLoading(false) }
  }, [])

  /* -- Delete -- */
  const remove = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true); setError(null)
    try {
      const { error: err } = await supabase
        .from('operational_costs')
        .delete()
        .eq('id', id)
      if (err) throw err
      setData((prev) => prev.filter((c) => c.id !== id))
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus biaya.')
      return false
    } finally { setLoading(false) }
  }, [])

  return { data, loading, error, fetch, create, update, remove }
}
