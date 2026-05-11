/**
 * formatters.ts
 * Shared utility functions untuk formatting tampilan.
 * Sentralisasi di sini agar tidak duplikat di setiap komponen/page.
 */

/**
 * Format angka ke format mata uang Rupiah.
 * @example formatRp(150000) → "Rp 150.000"
 */
export function formatRp(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value)
}

/**
 * Format string ISO date ke format tanggal lokal Indonesia.
 * @example formatDate("2026-05-11T10:00:00Z") → "11/05/26, 17.00"
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format angka ke string dengan separator ribuan Indonesia.
 * @example formatNumber(1500) → "1.500"
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value)
}
