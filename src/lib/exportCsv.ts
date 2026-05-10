/**
 * exportCsv — client-side CSV & Excel generator
 * Supports UTF-8 BOM (agar Excel bisa baca karakter Indonesia dengan benar)
 */
import * as XLSX from 'xlsx'

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

/** Download file Excel (.xlsx) ke browser */
export function downloadExcel(
  filename: string,
  headers: string[],
  rows: CsvRow[],
  sheetName = 'Laporan',
): void {
  // Buat worksheet dari array of arrays
  const wsData: (string | number | null)[][] = [
    headers,
    ...rows.map((row) =>
      row.map((v) => (v === undefined ? null : v))
    ),
  ]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Auto-width kolom berdasarkan panjang konten terpanjang
  const colWidths = headers.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map((r) => String(r[i] ?? '').length),
    )
    return { wch: Math.min(maxLen + 4, 50) }
  })
  ws['!cols'] = colWidths

  // Style header (bold) — memerlukan workbook type 'xlsx'
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    if (!ws[addr]) continue
    ws[addr].s = { font: { bold: true }, fill: { fgColor: { rgb: 'E8F4FD' } } }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  const xlsxFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  XLSX.writeFile(wb, xlsxFilename)
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
