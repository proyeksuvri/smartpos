import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Action = 'CREATE' | 'RESET_PIN' | 'TOGGLE_STATUS' | 'UPDATE_NAME' | 'DELETE'

interface Payload {
  action: Action
  // CREATE
  name?: string
  pin?: string
  // RESET_PIN | TOGGLE_STATUS | UPDATE_NAME | DELETE
  cashier_id?: string
  new_pin?: string
  new_name?: string
  // TOGGLE_STATUS
  is_active?: boolean
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

  const supabaseUrl     = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // ── Verify caller is owner/manager ───────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  const callerToken = authHeader.replace('Bearer ', '').trim()
  if (!callerToken) {
    return new Response(JSON.stringify({ error: 'Tidak terautentikasi.' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Validate caller token + check role
  const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(callerToken)
  if (callerErr || !caller) {
    return new Response(JSON.stringify({ error: 'Token tidak valid.' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .maybeSingle()

  if (!callerProfile || !['owner', 'manager'].includes(callerProfile.role)) {
    return new Response(JSON.stringify({ error: 'Akses ditolak. Hanya owner/manager.' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── Parse action ──────────────────────────────────────────
  const body = await req.json() as Payload
  const { action } = body

  try {
    // ── CREATE ────────────────────────────────────────────────
    if (action === 'CREATE') {
      const { name, pin } = body
      if (!name?.trim()) {
        return new Response(JSON.stringify({ error: 'Nama kasir wajib diisi.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (!pin || !/^\d{6}$/.test(pin)) {
        return new Response(JSON.stringify({ error: 'PIN harus 6 digit angka.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Generate unique email (never shown to user, just required by Auth)
      const slug = name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      const uid  = crypto.randomUUID().split('-')[0]
      const email = `kasir_${slug}_${uid}@smartpos.app`

      // Create auth user
      const createResp = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
        },
        body: JSON.stringify({
          email,
          email_confirm: true,
          password: crypto.randomUUID() + crypto.randomUUID(), // random, never used
        }),
      })

      if (!createResp.ok) {
        const e = await createResp.json()
        console.error('Create user error:', e)
        return new Response(JSON.stringify({ error: 'Gagal membuat akun kasir.', detail: e }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const newUser = await createResp.json()
      const newId: string = newUser.id

      // Set profile: name, role, pin_hash, is_active
      const { error: profileErr } = await admin
        .from('profiles')
        .update({
          name: name.trim(),
          role: 'cashier',
          is_active: true,
          login_email: email,
        })
        .eq('id', newId)

      if (profileErr) {
        console.error('Profile update error:', profileErr)
        // Rollback — delete the auth user
        await fetch(`${supabaseUrl}/auth/v1/admin/users/${newId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'apikey': serviceRoleKey },
        })
        return new Response(JSON.stringify({ error: 'Gagal menyimpan profil kasir.' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Set PIN hash via SQL (extensions.crypt)
      const { error: pinErr } = await admin.rpc('set_cashier_pin', {
        p_cashier_id: newId,
        p_pin: pin,
      })

      if (pinErr) {
        console.error('Set PIN error:', pinErr)
        return new Response(JSON.stringify({ error: 'Kasir dibuat tapi PIN gagal diset.', detail: pinErr }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true, id: newId, name: name.trim() }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── RESET_PIN ─────────────────────────────────────────────
    if (action === 'RESET_PIN') {
      const { cashier_id, new_pin } = body
      if (!cashier_id) {
        return new Response(JSON.stringify({ error: 'cashier_id wajib diisi.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (!new_pin || !/^\d{6}$/.test(new_pin)) {
        return new Response(JSON.stringify({ error: 'PIN baru harus 6 digit angka.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { error: pinErr } = await admin.rpc('set_cashier_pin', {
        p_cashier_id: cashier_id,
        p_pin: new_pin,
      })

      if (pinErr) {
        return new Response(JSON.stringify({ error: 'Gagal mengubah PIN.', detail: pinErr }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── TOGGLE_STATUS ─────────────────────────────────────────
    if (action === 'TOGGLE_STATUS') {
      const { cashier_id, is_active } = body
      if (!cashier_id || is_active === undefined) {
        return new Response(JSON.stringify({ error: 'cashier_id dan is_active wajib diisi.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { error: toggleErr } = await admin
        .from('profiles')
        .update({ is_active })
        .eq('id', cashier_id)
        .eq('role', 'cashier')

      if (toggleErr) {
        return new Response(JSON.stringify({ error: 'Gagal mengubah status kasir.' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── UPDATE_NAME ───────────────────────────────────────────
    if (action === 'UPDATE_NAME') {
      const { cashier_id, new_name } = body
      if (!cashier_id) {
        return new Response(JSON.stringify({ error: 'cashier_id wajib diisi.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (!new_name?.trim()) {
        return new Response(JSON.stringify({ error: 'Nama baru wajib diisi.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { error: nameErr } = await admin
        .from('profiles')
        .update({ name: new_name.trim() })
        .eq('id', cashier_id)
        .eq('role', 'cashier')

      if (nameErr) {
        return new Response(JSON.stringify({ error: 'Gagal mengubah nama kasir.' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── DELETE ────────────────────────────────────────────────
    if (action === 'DELETE') {
      const { cashier_id } = body
      if (!cashier_id) {
        return new Response(JSON.stringify({ error: 'cashier_id wajib diisi.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Safety: verify this is actually a cashier
      const { data: target } = await admin
        .from('profiles')
        .select('role')
        .eq('id', cashier_id)
        .maybeSingle()

      if (!target || target.role !== 'cashier') {
        return new Response(JSON.stringify({ error: 'Kasir tidak ditemukan atau bukan role kasir.' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Check FK dependencies — block if cashier has related data
      const [txCheck, shiftCheck, stockCheck, costCheck] = await Promise.all([
        admin.from('transactions').select('id', { count: 'exact', head: true })
          .or(`cashier_id.eq.${cashier_id},voided_by.eq.${cashier_id}`),
        admin.from('shifts').select('id', { count: 'exact', head: true })
          .eq('cashier_id', cashier_id),
        admin.from('stock_movements').select('id', { count: 'exact', head: true })
          .eq('created_by', cashier_id),
        admin.from('operational_costs').select('id', { count: 'exact', head: true })
          .eq('created_by', cashier_id),
      ])

      const hasData =
        (txCheck.count ?? 0) > 0 ||
        (shiftCheck.count ?? 0) > 0 ||
        (stockCheck.count ?? 0) > 0 ||
        (costCheck.count ?? 0) > 0

      if (hasData) {
        return new Response(JSON.stringify({
          error: 'Kasir ini masih memiliki riwayat transaksi atau data lain. Hapus permanen tidak diizinkan untuk menjaga integritas data. Nonaktifkan saja jika tidak ingin kasir ini bisa login.',
          code: 'HAS_DEPENDENCIES',
        }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // No dependencies → safe to delete auth user (cascades to profile via FK)
      const deleteResp = await fetch(`${supabaseUrl}/auth/v1/admin/users/${cashier_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
        },
      })

      if (!deleteResp.ok) {
        const e = await deleteResp.text()
        console.error('Delete user error:', e)
        return new Response(JSON.stringify({ error: 'Gagal menghapus akun kasir.', detail: e }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: `Action tidak dikenal: ${action}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    const e = err as Error
    console.error('Unexpected error:', e)
    return new Response(JSON.stringify({ error: 'Terjadi kesalahan server.', detail: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
