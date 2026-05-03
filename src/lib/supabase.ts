import { createClient } from '@supabase/supabase-js'

// Mengambil konfigurasi URL dan Key dari file .env.local
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Pengaman: Memastikan environment variables sudah diisi
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check .env.local file.')
}

// Membuat dan mengekspor instance client Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,        // Simpan session login kasir di localStorage browser
    autoRefreshToken: true,      // Otomatis perbarui token JWT jika hampir kedaluwarsa
    detectSessionInUrl: true,    // Menangani redirect dari OAuth (jika ada)
  },
  realtime: {
    params: {
      eventsPerSecond: 10,       // Membatasi event realtime maksimal 10 per detik untuk menghemat resource (Free Tier)
    },
  },
})

// Mengekspor tipe bawaan Supabase agar mudah digunakan di komponen lain
export type { User, Session } from '@supabase/supabase-js'