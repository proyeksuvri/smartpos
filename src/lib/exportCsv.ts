/**
 * exportCsv — client-side CSV generator
 * Supports UTF-8 BOM (agar Excel bisa baca karakter Indonesia dengan benar)
 */

type CsvRow = (string | number | null | undefined)[]

/** Escape sebuah cell CSV */
function escapeCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return ''
  const str = String(val)
  // Wrap dengan quote jika mengandung koma, newline, atau quote
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/** Konversi array of rows menjadi string CSV */
function buildCsv(headers: string[], rows: CsvRow[]): string {
  const lines: string[] = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ]
  return lines.join('\r\n')
}

/** Download file CSV ke browser */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: CsvRow[],
): void {
  const csv = buildCsv(headers, rows)
  // UTF-8 BOM agar Excel Windows tidak salah encoding
  const bom = '\uFEFF'
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href     = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Helper: format tanggal Indonesia */
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

/** Helper: format datetime Indonesia */
export function fmtDatetime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** Helper: format Rupiah tanpa simbol */
export function fmtRp(v: number | string): string {
  return Number(v).toLocaleString('id-ID')
}
