import { supabase } from './supabase'

export async function testSupabaseConnection() {
  const { data, error } = await supabase
    .from('_test_connection')
    .select('*')
    .limit(1)
  
  // Jika errornya adalah karena tabel tidak ditemukan, itu berarti koneksi BERHASIL.
  // Supabase versi baru sering menggunakan error code 'PGRST116' atau pesan spesifik.
  if (error && (error.code === '42P01' || error.message.includes('Could not find the table'))) {
    console.log('✅ Supabase connected! Database bisa dihubungi (Tabel belum ada).')
    return true
  }
  
  // Jika error karena hal lain (misal salah password/kunci)
  if (error) {
    console.error('❌ Connection failed:', error.message)
    return false
  }
  
  console.log('✅ Supabase connected!')
  return true
}