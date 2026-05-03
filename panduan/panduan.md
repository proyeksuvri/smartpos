# 📅 TIMELINE PENGEMBANGAN SMARTPOS
## Schedule Lengkap — Dari Nol Hingga Production

> **Mulai:** Mei 2026 | **Target Production:** Agustus 2026  
> **Total Durasi:** ~15 Minggu (4 Fase)  
> **Stack:** Vite + React (PWA) | Supabase Free Tier | Telegram Bot

---

## 🏗️ FASE 0: FOUNDATION (Minggu 1–2)

### Minggu 1 — Setup & Arsitektur

#### Hari 1: Inisialisasi Project
- [ ] Buat repository GitHub
- [ ] Init project Vite + React + TypeScript
- [ ] Konfigurasi PWA (vite-plugin-pwa, manifest.json, service worker)
- [ ] Setup ESLint, Prettier
- [ ] Buat struktur folder: `/src/pages`, `/src/components`, `/src/hooks`, `/src/lib`, `/src/styles`

#### Hari 2: Setup Supabase
- [ ] Buat project di Supabase Dashboard
- [ ] Install `@supabase/supabase-js`
- [ ] Buat file `supabase.ts` (client config)
- [ ] Aktifkan extensions: `pg_cron`, `pg_net`, `pgcrypto`, `uuid-ossp`
- [ ] Setup environment variables (`.env.local`)

---

### 📖 PANDUAN DETAIL: Buat Project di Supabase Dashboard

#### Langkah 1 — Registrasi Akun Supabase

1. Buka browser, pergi ke **[https://supabase.com](https://supabase.com)**
2. Klik tombol **"Start your project"** atau **"Sign Up"**
3. Pilih metode registrasi:
   - ✅ **Direkomendasikan:** Login dengan **GitHub** (lebih cepat, tidak perlu verifikasi email)
   - Atau daftar dengan email & password → cek inbox untuk verifikasi
4. Selesaikan proses autentikasi → kamu akan masuk ke **Supabase Dashboard**

> **Catatan Free Tier:** Supabase Free Tier memberikan:
> - 2 project aktif
> - 500 MB database storage
> - 1 GB file storage
> - 50.000 monthly active users (Auth)
> - 500.000 Edge Function invocations/bulan
> - Project akan di-**pause otomatis setelah 7 hari tidak aktif** (bisa di-resume manual)

---

#### Langkah 2 — Buat Organisasi (Jika Pertama Kali)

Jika ini pertama kali, Supabase akan meminta membuat **Organization**:

1. Klik **"New organization"**
2. Isi:
   - **Name:** `SmartPOS` (atau nama bisnismu)
   - **Type:** `Personal` (untuk free tier)
3. Klik **"Create organization"**

---

#### Langkah 3 — Buat Project Baru

1. Di dashboard, klik tombol **"New project"**
2. Pilih organisasi yang baru dibuat
3. Isi form pembuatan project:

   | Field | Nilai | Keterangan |
   |-------|-------|------------|
   | **Name** | `smartpos` | Nama project (lowercase, no spasi) |
   | **Database Password** | `[buat password kuat]` | Simpan di password manager! Tidak bisa diubah mudah |
   | **Region** | `Southeast Asia (Singapore)` | Pilih `ap-southeast-1` — server paling dekat Indonesia |
   | **Pricing Plan** | `Free` | Pastikan pilih Free tier |

   > ⚠️ **PENTING — Database Password:**
   > - Gunakan password yang kuat (min. 16 karakter, kombinasi huruf besar/kecil, angka, simbol)
   > - Contoh: `SmartPOS@2026#Secure!`
   > - **Simpan sekarang** — kamu butuh ini untuk koneksi langsung ke PostgreSQL
   > - Jika lupa, pergi ke: `Settings → Database → Reset database password`

4. Klik **"Create new project"**
5. Tunggu **1–3 menit** — Supabase sedang menyiapkan:
   - PostgreSQL database
   - PostgREST API server
   - Auth server (GoTrue)
   - Realtime server
   - Storage server

   Kamu akan melihat progress spinner. Jangan tutup tab-nya.

---

#### Langkah 4 — Verifikasi Project Berhasil Dibuat

Setelah selesai, kamu akan masuk ke halaman project. Pastikan semua indikator hijau:

```
✅ Database        — Connected
✅ Auth            — Running  
✅ Storage         — Running
✅ Edge Functions  — Running
```

Cek navigasi sidebar kiri:
- **Table Editor** — untuk melihat & edit tabel
- **SQL Editor** — untuk menjalankan query SQL
- **Authentication** — manajemen user
- **Storage** — file storage
- **Edge Functions** — serverless functions
- **Settings** — konfigurasi project

---

#### Langkah 5 — Ambil API Keys & URL Project

Ini adalah informasi paling penting yang akan dipakai di aplikasi:

1. Pergi ke **Settings** (ikon ⚙️ di sidebar kiri bawah)
2. Klik **"API"** di sub-menu Settings
3. Kamu akan melihat:

   ```
   Project URL
   https://[project-ref].supabase.co
   
   Project API Keys
   ├── anon (public)   : eyJhbGci...  ← Gunakan ini di frontend
   └── service_role    : eyJhbGci...  ← RAHASIA! Hanya di server/edge functions
   ```

4. Salin dan simpan keduanya:

   | Key | Digunakan di | Level Keamanan |
   |-----|-------------|----------------|
   | `VITE_SUPABASE_URL` | Frontend (`.env.local`) | Public ✅ |
   | `VITE_SUPABASE_ANON_KEY` | Frontend (`.env.local`) | Public ✅ (dilindungi RLS) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions saja | 🔴 RAHASIA — jangan expose ke frontend |

---

#### Langkah 6 — Buat File `.env.local` di Project Vite

Di root folder project SmartPOS (`c:\00_DATA\App\03. AppTokoKasir\smartpos\`), buat file `.env.local`:

```env
# Supabase Config
VITE_SUPABASE_URL=https://[project-ref].supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...

# Telegram (diisi nanti di Fase 2)
# VITE_TELEGRAM_BOT_TOKEN=

# App Config
VITE_APP_NAME=SmartPOS
VITE_APP_VERSION=1.0.0
```

> ⚠️ **Pastikan `.env.local` ada di `.gitignore`** — jangan pernah commit file ini ke GitHub!

Cek `.gitignore` di root project dan pastikan ada baris:
```
.env.local
.env*.local
```

---

#### Langkah 7 — Install Supabase Client & Buat `supabase.ts`

```bash
# Di terminal, dari root folder project
npm install @supabase/supabase-js
```

Buat file `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check .env.local file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,        // Simpan session di localStorage
    autoRefreshToken: true,      // Auto-refresh JWT token
    detectSessionInUrl: true,    // Handle OAuth redirects
  },
  realtime: {
    params: {
      eventsPerSecond: 10,       // Batasi realtime events (hemat resource)
    },
  },
})

export type { User, Session } from '@supabase/supabase-js'
```

---

#### Langkah 8 — Aktifkan Database Extensions

Di Supabase Dashboard:

1. Pergi ke **Database** → **Extensions** (di sidebar kiri)
2. Cari dan aktifkan extension berikut satu per satu:

   | Extension | Fungsi | Cara Aktifkan |
   |-----------|--------|---------------|
   | `uuid-ossp` | Generate UUID untuk primary key | Toggle ON |
   | `pgcrypto` | Enkripsi data sensitif (PIN, token) | Toggle ON |
   | `pg_net` | HTTP requests dari dalam database (untuk Telegram) | Toggle ON |
   | `pg_cron` | Scheduled jobs di database (laporan terjadwal) | Toggle ON |

   > **Catatan `pg_cron`:** Kadang tidak tersedia di Free Tier. Jika tidak muncul, gunakan Supabase Edge Functions dengan schedule sebagai alternatif.

3. Alternatif via **SQL Editor** — jalankan query ini:

   ```sql
   -- Aktifkan semua extensions yang dibutuhkan
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "pgcrypto";
   CREATE EXTENSION IF NOT EXISTS "pg_net";
   CREATE EXTENSION IF NOT EXISTS "pg_cron";
   
   -- Verifikasi extensions aktif
   SELECT name, default_version, installed_version
   FROM pg_available_extensions
   WHERE name IN ('uuid-ossp', 'pgcrypto', 'pg_net', 'pg_cron')
   ORDER BY name;
   ```

---

#### Langkah 9 — Test Koneksi

Tambahkan sementara di `main.tsx` atau buat file test `src/lib/testConnection.ts`:

```typescript
import { supabase } from './supabase'

export async function testSupabaseConnection() {
  const { data, error } = await supabase
    .from('_test_connection')
    .select('*')
    .limit(1)
  
  if (error && error.code === '42P01') {
    // Table tidak ada = koneksi berhasil, table belum dibuat
    console.log('✅ Supabase connected! Database ready.')
    return true
  }
  
  if (error) {
    console.error('❌ Connection failed:', error.message)
    return false
  }
  
  console.log('✅ Supabase connected!')
  return true
}
```

---

#### ✅ Checklist Verifikasi Hari 2

Sebelum lanjut ke Hari 3, pastikan semua ini sudah selesai:

- [ ] Akun Supabase berhasil dibuat
- [ ] Project `smartpos` di region Singapore sudah aktif
- [ ] Database password sudah disimpan di password manager
- [ ] `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` sudah disalin
- [ ] File `.env.local` sudah dibuat dengan nilai yang benar
- [ ] `.env.local` ada di `.gitignore`
- [ ] Package `@supabase/supabase-js` berhasil diinstall
- [ ] File `src/lib/supabase.ts` berhasil dibuat
- [ ] Extensions `uuid-ossp`, `pgcrypto`, `pg_net` berhasil diaktifkan
- [ ] Test koneksi berhasil (tidak ada error autentikasi)

---

#### Hari 3–4: Database Schema Core
- [ ] Buat tabel `profiles` (id, role, name, pin, telegram_chat_id)
- [ ] Buat tabel `categories` (id, name, description)
- [ ] Buat tabel `products` (id, name, sku, barcode, category_id, price_retail, price_wholesale, wholesale_min_qty, cost_price, stock_qty, min_stock, unit, image_url)
- [ ] Buat tabel `customers` (id, name, phone, type: ecer/grosir, address)
- [ ] Buat tabel `suppliers` (id, name, phone, address)
- [ ] Buat tabel `transactions` (id, invoice_no, cashier_id, customer_id, type: ecer/grosir, payment_method, subtotal, discount, total, cash_paid, change, shift_id, created_at)
- [ ] Buat tabel `transaction_items` (id, transaction_id, product_id, qty, unit_price, discount, subtotal)
- [ ] Buat tabel `shifts` (id, cashier_id, opened_at, closed_at, opening_cash, closing_cash, expected_cash, difference, status)
- [ ] Buat tabel `stock_movements` (id, product_id, type: in/out/adjustment, qty, reference, notes, created_at)
- [ ] Buat tabel `settings` (id, store_name, store_address, telegram_bot_token, telegram_chat_id, notification_preferences: jsonb)
- [ ] Buat tabel `notification_log` (id, type, message, status, created_at)
- [ ] Setup foreign keys & indexes

#### Hari 5: Auth & RLS (Row Level Security)
- [ ] Konfigurasi Supabase Auth (email/password)
- [ ] Buat RLS policies:
  - Kasir: INSERT transactions, SELECT products/stock
  - Manajer: + SELECT reports, UPDATE stock
  - Owner: full access semua tabel
- [ ] Buat trigger auto-create profile saat user signup
- [ ] Test auth flow: register, login, role check

### Minggu 2 — Design System & Offline Architecture

#### Hari 6–7: Design System UI
- [ ] Pilih & import Google Fonts (Inter/Outfit)
- [ ] Buat CSS variables: warna, spacing, radius, shadows
- [ ] Buat komponen dasar: Button, Input, Card, Modal, Table, Badge, Toast
- [ ] Buat layout: Sidebar, Header, MainContent
- [ ] Responsive breakpoints (mobile-first, tablet, desktop)
- [ ] Dark mode support (CSS variables swap)
- [ ] Animasi & transisi dasar

#### Hari 8–9: Offline-First Architecture
- [ ] Setup IndexedDB via `Dexie.js` atau `idb`
- [ ] Buat local DB schema mirror: products, transactions, transaction_items
- [ ] Buat sync engine:
  - Online → fetch products dari Supabase → simpan ke IndexedDB
  - Offline → simpan transaksi ke IndexedDB
  - Reconnect → batch sync IndexedDB → Supabase
- [ ] Indikator status online/offline di UI
- [ ] Conflict resolution strategy (server wins untuk master data, merge untuk transaksi)

#### Hari 10: Routing & Auth UI
- [ ] Setup React Router: `/login`, `/pos`, `/dashboard`, `/products`, `/settings`
- [ ] Halaman Login (PIN-based untuk kasir, email/password untuk owner)
- [ ] Protected routes berdasarkan role
- [ ] Auto-redirect setelah login sesuai role

---

## 🛒 FASE 1: CORE POS (Minggu 3–6)

### Minggu 3 — Master Data

#### Hari 11–13: Manajemen Produk
- [ ] Halaman daftar produk (search, filter kategori, sort)
- [ ] Form tambah/edit produk (nama, SKU, harga ecer, harga grosir, min qty grosir, HPP, stok, min stok, kategori, satuan)
- [ ] Upload foto produk ke Supabase Storage
- [ ] Barcode scanner via kamera (`html5-qrcode` library)
- [ ] Import produk dari CSV/Excel
- [ ] Batch edit harga (untuk penyesuaian harga massal)

#### Hari 14–15: Manajemen Kategori, Customer, Supplier
- [ ] CRUD kategori produk
- [ ] CRUD customer (nama, telepon, tipe: ecer/grosir, alamat)
- [ ] CRUD supplier (nama, telepon, alamat, produk yang disupply)
- [ ] Assign supplier default ke produk

### Minggu 4 — Transaksi Penjualan (Inti POS)

#### Hari 16–18: Halaman Kasir (POS Screen)
- [ ] Layout POS: grid produk (kiri) + keranjang (kanan)
- [ ] Quick search produk by nama/barcode
- [ ] Scan barcode → auto-add ke keranjang
- [ ] Tampilkan grid produk per kategori (tab/filter)
- [ ] Keranjang: tambah, kurang, hapus item, edit qty
- [ ] Auto-detect harga grosir jika qty ≥ wholesale_min_qty
- [ ] Input diskon per item atau per transaksi
- [ ] Pilih customer (opsional) — auto-set tipe grosir/ecer
- [ ] Kalkulasi real-time: subtotal, diskon, total

#### Hari 19–20: Pembayaran & Penyelesaian Transaksi
- [ ] Modal pembayaran: pilih metode (tunai/transfer)
- [ ] Input nominal bayar, hitung kembalian otomatis
- [ ] Shortcut nominal (Rp50K, Rp100K, uang pas)
- [ ] Simpan transaksi ke Supabase + IndexedDB
- [ ] Auto-kurangi stok produk (trigger DB atau client-side)
- [ ] Generate invoice number otomatis (TRX-YYYYMMDD-NNN)
- [ ] Tampilkan receipt/struk di layar setelah bayar

#### Hari 21: Struk Digital
- [ ] Generate struk sebagai halaman HTML (bukan PDF — hemat storage)
- [ ] URL unik per transaksi: `/receipt/{invoice_no}`
- [ ] QR Code di struk (library `qrcode`)
- [ ] Opsi cetak struk (window.print) untuk printer thermal
- [ ] Data struk dari database, render on-demand (tidak simpan file)

### Minggu 5 — Stok & Shift Kasir

#### Hari 22–23: Manajemen Stok
- [ ] Halaman stok: daftar semua produk + qty + status (aman/hampir habis/habis)
- [ ] Form stok masuk (dari pembelian supplier): pilih produk, qty, harga beli, supplier
- [ ] Form stok keluar (rusak/hilang/retur): pilih produk, qty, alasan
- [ ] Form stock opname: bandingkan stok sistem vs stok fisik, catat selisih
- [ ] Riwayat pergerakan stok per produk (stock_movements)
- [ ] Alert visual untuk produk di bawah minimum stock
- [ ] Database trigger: update `stock_qty` saat `stock_movements` di-insert

#### Hari 24–25: Buka/Tutup Kasir (Shift Management)
- [ ] Halaman buka shift: input modal awal (opening cash)
- [ ] Selama shift: tracking otomatis transaksi tunai/transfer
- [ ] Halaman tutup shift: input kas fisik, sistem hitung expected cash
- [ ] Tampilkan selisih (difference) + status (cocok/selisih)
- [ ] Ringkasan shift: jumlah transaksi, total omset, breakdown tunai/transfer
- [ ] Riwayat shift per kasir
- [ ] Blokir transaksi jika belum buka shift

#### Hari 26: Void/Pembatalan Transaksi
- [ ] Fitur void transaksi (hanya dalam shift aktif)
- [ ] Alasan void wajib diisi
- [ ] Stok otomatis dikembalikan saat void
- [ ] Log void tersimpan (untuk anti-fraud nanti)
- [ ] Batasan: void > Rp tertentu butuh approval owner (opsional)

### Minggu 6 — Dashboard & Laporan

#### Hari 27–29: Dashboard Owner
- [ ] Card ringkasan: omset hari ini, jumlah transaksi, rata-rata per transaksi, pembeli baru
- [ ] Grafik omset 7 hari terakhir (line chart)
- [ ] Grafik omset per jam hari ini (bar chart)
- [ ] Top 5 produk terlaris (hari ini + minggu ini)
- [ ] Daftar produk stok kritis (< min_stock)
- [ ] Perbandingan grosir vs ecer (pie chart)
- [ ] Library chart: `recharts` atau `chart.js`
- [ ] Database views untuk aggregate data (hemat query)

```sql
-- View: ringkasan harian
CREATE VIEW v_daily_summary AS
SELECT
  date_trunc('day', created_at)::date as sale_date,
  count(*) as total_trx,
  sum(total) as revenue,
  avg(total) as avg_trx,
  sum(CASE WHEN type='grosir' THEN total ELSE 0 END) as wholesale_revenue,
  sum(CASE WHEN type='ecer' THEN total ELSE 0 END) as retail_revenue
FROM transactions
WHERE voided = false
GROUP BY sale_date;
```

#### Hari 30–31: Laporan Cetak/Export
- [ ] Laporan penjualan harian (filter tanggal) — tabel + total
- [ ] Laporan penjualan per produk (periode tertentu)
- [ ] Laporan stok saat ini (semua produk + nilai stok)
- [ ] Laporan shift kasir (per kasir, per periode)
- [ ] Export ke CSV/Excel
- [ ] Cetak laporan (print-friendly CSS)

---

## 🤖 FASE 2: TELEGRAM & SMART LAYER (Minggu 7–9)

### Minggu 7 — Setup & Koneksi Telegram

#### Hari 32–33: Setup Telegram Bot
- [ ] Buat bot via @BotFather, simpan token
- [ ] Buat Edge Function: `telegram-webhook`
  - Parsing incoming messages & callback queries
  - Route ke handler berdasarkan command
- [ ] Set webhook URL via Telegram API
- [ ] Simpan bot token di Supabase Vault / settings table (encrypted)

#### Hari 34: Koneksi Toko ↔ Telegram
- [ ] Halaman Settings → Telegram Integration
- [ ] Generate link deep-link unik per toko
- [ ] User klik link → buka Telegram → klik Start
- [ ] Bot kirim chat_id ke Edge Function → simpan di `settings`
- [ ] Konfirmasi: "✅ Toko berhasil terhubung!"
- [ ] Tombol disconnect di Settings

#### Hari 35: Fungsi Pengiriman Pesan
- [ ] Database function `send_telegram_message(chat_id, text, reply_markup)`
  - Menggunakan `pg_net` extension untuk HTTP POST ke Telegram API
- [ ] Helper formatting: Markdown Telegram (bold, mono, emoji)
- [ ] Rate limiting: max 30 pesan/detik (Telegram limit)
- [ ] Log setiap pengiriman ke `notification_log`

### Minggu 8 — Notifikasi Otomatis

#### Hari 36–37: Alert Real-Time (Database Triggers)
- [ ] Trigger `on_stock_update`: jika stock_qty ≤ min_stock → kirim alert stok kritis
- [ ] Trigger `on_shift_close`: jika selisih kas > toleransi → kirim alert
- [ ] Trigger `on_transaction_void`: jika void count hari ini > 3 → kirim alert
- [ ] Semua alert hanya dikirim jika notifikasi ON di settings
- [ ] Deduplikasi: alert yang sama tidak dikirim ulang dalam 1 jam

#### Hari 38–39: Notifikasi Transaksi (Digest Mode)
- [ ] pg_cron job setiap jam: kumpulkan transaksi 1 jam terakhir
- [ ] Format ringkasan: jumlah transaksi, total omset, top produk jam ini
- [ ] Kirim digest ke owner via Telegram
- [ ] Opsi: notif khusus untuk transaksi grosir besar (> threshold)

#### Hari 40: Laporan Harian Terjadwal
- [ ] pg_cron job jam 21:00 (atau jam tutup toko):
  - Omset hari ini vs kemarin (% perubahan)
  - Total transaksi & rata-rata
  - Breakdown grosir vs ecer
  - Top 3 produk terlaris
  - Produk stok kritis
- [ ] pg_cron job Senin 08:00: Laporan mingguan
- [ ] pg_cron job tanggal 1 jam 07:00: Laporan bulanan

### Minggu 9 — Bot Interaktif & Konfigurasi

#### Hari 41–43: Bot Tanya-Jawab (Command Mode)
- [ ] `/omset` — Total omset hari ini real-time
- [ ] `/stok` — Daftar produk stok kritis
- [ ] `/terlaris` — Top 5 produk hari/minggu ini
- [ ] `/kasir [nama]` — Rekap performa kasir
- [ ] `/piutang` — Daftar piutang grosir belum lunas (jika ada)
- [ ] `/help` — Daftar semua perintah

#### Hari 44–45: Panel Konfigurasi Notifikasi
- [ ] Halaman Settings → Notifikasi
- [ ] Toggle ON/OFF per jenis: stok kritis, digest transaksi, laporan harian/mingguan/bulanan
- [ ] Set jam kirim laporan harian
- [ ] Set jam DND (Do Not Disturb)
- [ ] Set threshold transaksi besar
- [ ] Simpan ke `settings.notification_preferences` (JSONB)

---

## 🛡️ FASE 3: ANTI-FRAUD & INTELLIGENCE (Minggu 10–12)

### Minggu 10 — Anti-Fraud Engine

#### Hari 46–47: Deteksi Void Berlebihan
- [ ] Database view: `v_void_summary` — count void per kasir per hari
- [ ] Trigger/cron: jika void > threshold (default 3/hari) → alert ke owner
- [ ] Detail: rincian setiap void (jam, nominal, alasan)
- [ ] Perbandingan vs rata-rata kasir lain

#### Hari 48–49: Deteksi Diskon & Harga Tidak Wajar
- [ ] Trigger `on_transaction_insert`:
  - Cek apakah ada item dengan diskon > batas maksimum kasir
  - Cek apakah ada item dengan harga ≠ harga master
- [ ] Alert ke owner dengan detail selisih
- [ ] Tracking kumulatif per kasir (rata-rata diskon, frekuensi override)

#### Hari 50–51: Selisih Kas Pattern + Laporan Integritas
- [ ] View: `v_cashier_integrity` — histori selisih kas per kasir 30 hari
- [ ] Alert jika pola selisih negatif berulang
- [ ] Laporan Integritas Harian (cron pagi):
  - Tabel per kasir: transaksi, void, avg diskon, selisih kas
  - Status: ✅ bersih / ⚠️ perlu perhatian / 🚨 kritis
  - Ringkasan temuan + rekomendasi tindakan

### Minggu 11 — Smart Intelligence

#### Hari 52–53: Skor Kesehatan Toko
- [ ] Database function `calculate_health_score()`:
  - Penjualan (35%): omset vs target/rata-rata
  - Stok (25%): jumlah produk di bawah minimum
  - Integritas (25%): void, diskon anomali, selisih kas
  - Arus Kas (15%): piutang jatuh tempo
- [ ] Skor 0–100 dengan label: Sangat Baik/Baik/Cukup/Perlu Perhatian/Kritis
- [ ] Breakdown per komponen dengan tren vs kemarin
- [ ] Kirim via Telegram setiap pagi

#### Hari 54–55: Ringkasan Narasi Pagi (Template-Based)
- [ ] Template narasi dengan placeholder data:
  - Sapaan + omset kemarin + perbandingan
  - Highlight 1-2 hal utama (stok kritis, piutang, dll)
  - Status kasir
  - Skor kesehatan
- [ ] Kirim bersamaan dengan health score (1 pesan gabungan)

#### Hari 56: Prediksi Kehabisan Stok
- [ ] Database function: `predict_stockout(product_id)`
  - Hitung rata-rata penjualan 7 hari terakhir
  - `hari_tersisa = stock_qty / avg_daily_sales`
  - Bandingkan dengan lead time supplier
- [ ] View: `v_stock_prediction` — semua produk + estimasi hari habis
- [ ] Alert jika hari_tersisa ≤ lead_time_supplier (harus order hari ini)
- [ ] Tampilkan di dashboard owner

### Minggu 12 — Segmentasi & Data Management

#### Hari 57–58: Segmentasi Customer Sederhana
- [ ] View: `v_customer_segments`:
  - 🟢 Aktif: transaksi dalam 14 hari
  - 🟡 Jarang: transaksi 14–30 hari lalu
  - 🔴 Hilang: > 30 hari tanpa transaksi
- [ ] Tampilkan di dashboard + halaman customer
- [ ] Alert pelanggan grosir yang hilang (> 21 hari) → Telegram

#### Hari 59–60: Data Retention & Backup
- [ ] Edge Function cron bulanan: arsipkan transaksi > 12 bulan
  - Export ke CSV → Supabase Storage
  - Hapus dari tabel utama (pertahankan summary di view)
- [ ] Fitur export manual: owner download semua data (CSV/Excel)
- [ ] Monitor ukuran database: alert jika > 400MB
- [ ] Auto-cleanup notification_log > 90 hari

---

## 🚀 FASE 4: POLISH & PRODUCTION (Minggu 13–15)

### Minggu 13 — Fitur Tambahan

#### Hari 61–62: Tombol Aksi Telegram (Inline Keyboard)
- [ ] Inline buttons di alert stok kritis: [Sudah Ditangani] [Ingatkan Nanti]
- [ ] Inline buttons di alert void: [Lihat Detail] [Abaikan]
- [ ] Callback query handler di Edge Function
- [ ] Update status notifikasi saat tombol diklik

#### Hari 63–64: Notifikasi Kontekstual Kalender
- [ ] Tabel `business_calendar` (event, date_start, date_end, impact_desc)
- [ ] Pre-set events: tanggal muda, akhir bulan, hari raya
- [ ] Cron: cek H-2 sebelum event → kirim peringatan + cek stok produk prioritas
- [ ] Owner bisa tambah event custom di settings

#### Hari 65: Laporan Arus Kas Sederhana
- [ ] View kas masuk (penjualan tunai + transfer + pelunasan piutang)
- [ ] View kas keluar (pembelian stok + biaya operasional)
- [ ] Halaman laporan arus kas di dashboard
- [ ] Termasuk di laporan harian Telegram

### Minggu 14 — Testing & QA

#### Hari 66–67: Unit & Integration Testing
- [ ] Test database functions & triggers
- [ ] Test RLS policies (per role)
- [ ] Test Edge Functions (webhook, cron)
- [ ] Test sync engine (offline → online)
- [ ] Test barcode scanner di berbagai device

#### Hari 68–69: End-to-End Testing
- [ ] Skenario lengkap: login → buka kasir → transaksi → tutup kasir
- [ ] Skenario grosir: customer grosir → harga grosir → notif Telegram
- [ ] Skenario fraud: void berlebihan → alert terkirim ke owner
- [ ] Skenario offline: transaksi offline → reconnect → sync berhasil
- [ ] Skenario stok: stok habis → alert → restock → stok normal

#### Hari 70: Performance & Security Audit
- [ ] Cek query performance (EXPLAIN ANALYZE pada query berat)
- [ ] Optimasi index database
- [ ] Pastikan semua RLS policy ketat (tidak ada data leak)
- [ ] Validasi input di frontend + database (double validation)
- [ ] CSP headers, HTTPS enforcement
- [ ] Cek PWA: lighthouse score > 90

### Minggu 15 — Deployment & Go-Live

#### Hari 71–72: Deployment
- [ ] Build production frontend (`npm run build`)
- [ ] Deploy frontend ke **Cloudflare Pages** atau **Vercel** (gratis)
- [ ] Verifikasi Edge Functions production
- [ ] Setup custom domain (opsional)
- [ ] SSL/HTTPS verifikasi
- [ ] Test production environment end-to-end

#### Hari 73: Data Seeding & Migrasi
- [ ] Input master produk toko (import dari Excel jika ada)
- [ ] Setup kategori produk
- [ ] Input data customer tetap/grosir
- [ ] Input data supplier
- [ ] Set harga ecer & grosir per produk
- [ ] Set min_stock per produk
- [ ] Konfigurasi settings toko (nama, alamat, jam operasional)

#### Hari 74: Setup Telegram Production
- [ ] Koneksikan Telegram bot ke toko
- [ ] Konfigurasi preferensi notifikasi owner
- [ ] Test semua jenis notifikasi di production
- [ ] Set jam DND
- [ ] Verifikasi semua command bot berfungsi

#### Hari 75: Go-Live & Training
- [ ] Training kasir: cara login, buat transaksi, scan barcode, buka/tutup shift
- [ ] Training owner: cara baca dashboard, command Telegram, export data
- [ ] Monitoring hari pertama: pantau error, performa, notifikasi
- [ ] Dokumentasi: panduan pengguna singkat (1 halaman)
- [ ] 🎉 **PRODUCTION LIVE!**

---

## 📊 RINGKASAN TIMELINE

```
Minggu 1–2   ██████████░░░░░░░░░░░░░░░░░░░░  FASE 0: Foundation
Minggu 3–6   ░░░░░░░░░░████████████████░░░░░░  FASE 1: Core POS
Minggu 7–9   ░░░░░░░░░░░░░░░░░░░░░░░░██████░░  FASE 2: Telegram
Minggu 10–12 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░████  FASE 3: Intelligence
Minggu 13–15 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██  FASE 4: Production
```

| Fase | Minggu | Hari Kerja | Milestone |
|------|--------|-----------|-----------|
| **0: Foundation** | 1–2 | 10 hari | Project setup, DB schema, auth, UI system, offline arch |
| **1: Core POS** | 3–6 | 21 hari | Produk, transaksi, stok, shift, dashboard — **APP BISA DIPAKAI** |
| **2: Telegram** | 7–9 | 14 hari | Bot aktif, alert, laporan, command — **NOTIFIKASI AKTIF** |
| **3: Intelligence** | 10–12 | 15 hari | Anti-fraud, health score, prediksi — **SMART LAYER AKTIF** |
| **4: Production** | 13–15 | 15 hari | Polish, testing, deploy, go-live — **🚀 PRODUCTION** |

---

## ⚙️ TOOLS & DEPENDENCIES

| Kategori | Tool | Fungsi |
|----------|------|--------|
| Frontend | Vite + React + TypeScript | Framework UI |
| Styling | Vanilla CSS + CSS Variables | Design system |
| PWA | vite-plugin-pwa | Offline capability |
| Offline DB | Dexie.js | IndexedDB wrapper |
| Backend | Supabase (free tier) | DB, Auth, Storage, Edge Functions |
| Charts | Recharts | Grafik dashboard |
| Barcode | html5-qrcode | Scanner via kamera |
| QR Code | qrcode | Generate QR struk |
| Telegram | pg_net + Telegram Bot API | Notifikasi |
| Deploy | Cloudflare Pages / Vercel | Hosting frontend (gratis) |
| Version Control | Git + GitHub | Source code management |

---

> **Catatan:** Setelah Fase 1 selesai (minggu 6), aplikasi sudah bisa digunakan sebagai POS fungsional. Fase 2–4 bisa dikerjakan sambil toko sudah mulai menggunakan sistem.
