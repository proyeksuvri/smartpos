import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
    
    if (!BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set in environment variables.')
    }

    const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`

    // Init Supabase client to read settings
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    const payload = await req.json()
    const { type, message, data } = payload

    // Handle webhook from Telegram (if user types /id or /start)
    if (payload.update_id && payload.message) {
      const chatId = payload.message.chat.id
      const text = payload.message.text || ''

      if (text === '/start' || text === '/id') {
        const reply = `Halo dari SmartPOS! 👋\n\nTelegram Chat ID Anda adalah: \`${chatId}\`\n\nSilakan salin ID tersebut dan masukkan ke menu **Pengaturan > Profil Toko** di aplikasi SmartPOS Anda.`
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: reply,
            parse_mode: 'Markdown',
          }),
        })
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Handle internal triggers from SmartPOS (e.g., void, shift, stock)
    // 1. Get settings to know the chat ID & preferences
    const { data: settings } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', true)
      .single()

    if (!settings || !settings.telegram_chat_id) {
      return new Response(JSON.stringify({ error: 'Chat ID not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const chatId = settings.telegram_chat_id
    const prefs = settings.notification_preferences || {}

    let textToSend = message || ''

    // Route logic based on event type
    switch (type) {
      case 'void_alert':
        if (!prefs.void_alert) return new Response(JSON.stringify({ skipped: true }))
        textToSend = `🚨 *ALERT VOID TRANSAKSI*\n\nKasir membatalkan transaksi:\nID: \`${data.transaction_id}\`\nTotal: Rp ${data.total}\nAlasan: ${data.reason}`
        break
      case 'stock_alert':
        if (!prefs.stock_alert) return new Response(JSON.stringify({ skipped: true }))
        textToSend = `📦 *ALERT STOK KRITIS*\n\nProduk berikut berada di bawah batas minimum:\n- *${data.product_name}* (Sisa: ${data.stock_qty})\nSegera lakukan restock!`
        break
      case 'shift_diff_alert':
        if (!prefs.shift_diff_alert) return new Response(JSON.stringify({ skipped: true }))
        textToSend = `💰 *ALERT SELISIH KAS*\n\nShift Ditutup!\nKasir: ${data.cashier_name}\nEkspektasi: Rp ${data.expected}\nFisik: Rp ${data.actual}\nSelisih: *Rp ${data.difference}*`
        break
      case 'test':
        textToSend = `✅ *Notifikasi Tes Berhasil!*\nBot SmartPOS Anda sudah terhubung.`
        break
      case 'daily_report': {
        if (!prefs.daily_report) return new Response(JSON.stringify({ skipped: true }))
        
        // Ambil data hari ini (waktu server Edge)
        const todayStr = new Date().toISOString().split('T')[0]
        const { data: txs } = await supabase
          .from('transactions')
          .select('total, status')
          .gte('created_at', `${todayStr}T00:00:00`)
          .lte('created_at', `${todayStr}T23:59:59`)

        let totalRev = 0
        let countPaid = 0
        let countVoid = 0
        
        if (txs) {
          for (const tx of txs) {
            if (tx.status === 'paid') {
              totalRev += Number(tx.total)
              countPaid++
            } else if (tx.status === 'voided') {
              countVoid++
            }
          }
        }

        const formatRp = (v: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v)
        
        textToSend = `📊 *LAPORAN HARIAN SMARTPOS*\n📅 Tanggal: ${todayStr}\n\n✅ Transaksi Sukses: ${countPaid}\n❌ Transaksi Void: ${countVoid}\n💰 *Total Omset: ${formatRp(totalRev)}*\n\nSelamat beristirahat! 🌙`
        break
      }
      default:
        if (!textToSend) {
          throw new Error('No message provided.')
        }
    }

    // Send the message to the owner's chat ID
    const tgRes = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: textToSend,
        parse_mode: 'Markdown',
      }),
    })

    const tgData = await tgRes.json()

    return new Response(JSON.stringify({ success: true, telegram_response: tgData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
