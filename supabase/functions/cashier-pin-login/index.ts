import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { cashier_id, pin } = await req.json() as { cashier_id: string; pin: string }

    if (!cashier_id || !pin) {
      return new Response(JSON.stringify({ error: 'cashier_id dan pin wajib diisi.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!/^\d{6}$/.test(pin)) {
      return new Response(JSON.stringify({ error: 'PIN harus 6 digit angka.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Verify PIN via RPC
    const { data: pinOk, error: pinError } = await admin.rpc('verify_cashier_pin', {
      p_cashier_id: cashier_id,
      p_pin: pin,
    })

    if (pinError) {
      console.error('PIN verify RPC error:', JSON.stringify(pinError))
      return new Response(JSON.stringify({ error: 'Gagal memverifikasi PIN.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (pinOk !== true) {
      return new Response(JSON.stringify({ error: 'ID kasir atau PIN salah.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Get cashier email
    const { data: userRecord, error: userError } = await admin.auth.admin.getUserById(cashier_id)

    if (userError || !userRecord?.user?.email) {
      console.error('getUserById error:', userError)
      return new Response(JSON.stringify({ error: 'Akun kasir tidak ditemukan.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const email = userRecord.user.email

    // 3. Set temp password via GoTrue REST API directly
    //    (bypasses supabase-js admin method naming issues)
    const tempPassword = crypto.randomUUID() + crypto.randomUUID()
    const updateResp = await fetch(`${supabaseUrl}/auth/v1/admin/users/${cashier_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
      },
      body: JSON.stringify({ password: tempPassword }),
    })

    if (!updateResp.ok) {
      const updateErr = await updateResp.text()
      console.error('GoTrue update user error:', updateErr)
      return new Response(JSON.stringify({ error: 'Gagal menyiapkan sesi kasir.', detail: updateErr }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Return email + temp password for the frontend to call signInWithPassword
    return new Response(
      JSON.stringify({ email, temp_password: tempPassword }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (err) {
    const e = err as Error
    console.error('Unexpected error:', e)
    return new Response(JSON.stringify({ error: 'Terjadi kesalahan server.', detail: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
