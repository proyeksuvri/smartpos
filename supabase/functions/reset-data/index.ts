import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * Reset targets and their safe deletion order (FK-aware).
 *
 * 'transactions'      → transaction_items, stock_movements (sale/void type), transactions, shifts
 * 'products'          → product_suppliers, stock_movements, transaction_items, transactions, products, categories
 * 'customers'         → (nullify customer_id on transactions), customers
 * 'suppliers'         → product_suppliers, suppliers
 * 'operational_costs' → operational_costs
 * 'audit_logs'        → audit_logs, notification_log
 * 'all'               → everything above in correct order (never touches profiles/app_settings)
 */
type ResetTarget =
  | 'transactions'
  | 'products'
  | 'customers'
  | 'suppliers'
  | 'operational_costs'
  | 'audit_logs'
  | 'all'

interface Payload {
  target: ResetTarget
  confirm: string   // Must equal "HAPUS"
}

// Tables that use a composite PK or non-'id' primary key
// Map: table_name → column to use for "delete all" filter
const TABLE_PK: Record<string, string> = {
  product_suppliers: 'product_id',
  notification_log:  'id',  // assume standard id; adjust if needed
}

function getPkCol(table: string): string {
  return TABLE_PK[table] ?? 'id'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // ── Auth: only owner can reset data ──────────────────────
  const authHeader  = req.headers.get('Authorization') ?? ''
  const callerToken = authHeader.replace('Bearer ', '').trim()
  if (!callerToken) {
    return new Response(JSON.stringify({ error: 'Tidak terautentikasi.' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(callerToken)
  if (callerErr || !caller) {
    return new Response(JSON.stringify({ error: 'Token tidak valid.' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: callerProfile } = await admin
    .from('profiles').select('role').eq('id', caller.id).maybeSingle()

  if (!callerProfile || callerProfile.role !== 'owner') {
    return new Response(JSON.stringify({ error: 'Akses ditolak. Hanya owner yang bisa mereset data.' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── Validate payload ──────────────────────────────────────
  const body = await req.json() as Payload
  const { target, confirm } = body

  if (confirm !== 'HAPUS') {
    return new Response(JSON.stringify({ error: 'Konfirmasi tidak valid. Ketik HAPUS untuk melanjutkan.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const validTargets: ResetTarget[] = ['transactions', 'products', 'customers', 'suppliers', 'operational_costs', 'audit_logs', 'all']
  if (!validTargets.includes(target)) {
    return new Response(JSON.stringify({ error: `Target tidak dikenal: ${target}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const deleted: Record<string, number> = {}

    // ── Helper to safely delete all rows from a table ────
    const del = async (table: string) => {
      const pkCol = getPkCol(table)
      // Use neq on the PK column — no real row will have the nil UUID
      const { error } = await admin
        .from(table)
        .delete()
        .neq(pkCol, '00000000-0000-0000-0000-000000000000')
      if (error) {
        console.error(`Delete ${table} error:`, error)
        throw new Error(`Gagal menghapus ${table}: ${error.message}`)
      }
      deleted[table] = 1
    }

    // ── Nullify helper (for soft FK clears) ───────────────
    const nullify = async (table: string, col: string) => {
      const { error } = await admin.from(table).update({ [col]: null } as any)
        .neq('id', '00000000-0000-0000-0000-000000000000')
      if (error) console.warn(`Nullify ${table}.${col}:`, error.message)
    }

    // ══════════════════════════════════════════════════════
    // RESET TRANSAKSI
    // ══════════════════════════════════════════════════════
    if (target === 'transactions' || target === 'all') {
      await del('transaction_items')
      await del('stock_movements')
      await del('transactions')
      await del('shifts')
    }

    // ══════════════════════════════════════════════════════
    // RESET PRODUK (requires transactions cleared first)
    // ══════════════════════════════════════════════════════
    if (target === 'products' || target === 'all') {
      // On isolated 'products' reset: clear product-related joins first
      if (target === 'products') {
        await del('transaction_items')
        await del('stock_movements')
        await del('transactions')
        await del('shifts')
      }
      await del('product_suppliers')
      await del('products')
      await del('categories')
    }

    // ══════════════════════════════════════════════════════
    // RESET CUSTOMERS
    // ══════════════════════════════════════════════════════
    if (target === 'customers' || target === 'all') {
      // Nullify customer_id on transactions to avoid FK block
      await nullify('transactions', 'customer_id')
      await del('customers')
    }

    // ══════════════════════════════════════════════════════
    // RESET SUPPLIERS
    // ══════════════════════════════════════════════════════
    if (target === 'suppliers' || target === 'all') {
      await del('product_suppliers')
      await del('suppliers')
    }

    // ══════════════════════════════════════════════════════
    // RESET BIAYA OPERASIONAL
    // ══════════════════════════════════════════════════════
    if (target === 'operational_costs' || target === 'all') {
      await del('operational_costs')
    }

    // ══════════════════════════════════════════════════════
    // RESET AUDIT / LOG
    // ══════════════════════════════════════════════════════
    if (target === 'audit_logs' || target === 'all') {
      await del('audit_logs')
      await del('notification_log')
    }

    return new Response(
      JSON.stringify({ success: true, target, deleted }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

  } catch (err) {
    const e = err as Error
    console.error('Reset error:', e)
    return new Response(
      JSON.stringify({ error: e.message || 'Terjadi kesalahan saat mereset data.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
