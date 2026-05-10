import { useEffect, useState } from 'react'
import { downloadCsv, downloadExcel, fmtDatetime, fmtRp } from '../lib/exportCsv'
import { useSoldProductsReport, useStockReport, useShiftReport } from '../hooks/useReports'
import { useTransactions } from '../hooks/useTransactions'
import { useFinancialReport } from '../hooks/useFinancialReport'

/* ── Helpers ────────────────────────────────────────────── */
function todayStr()      { return new Date().toISOString().split('T')[0] }
function monthStartStr() {
  const d = new Date(); d.setDate(1)
  return d.toISOString().split('T')[0]
}

type TabKey = 'transactions' | 'products' | 'stock' | 'shifts' | 'finance'

/* ── Reports Page ───────────────────────────────────────── */
export function ReportsPage() {
  const [tab, setTab]         = useState<TabKey>('transactions')
  const [dateFrom, setDateFrom] = useState(monthStartStr())
  const [dateTo, setDateTo]   = useState(todayStr())

  /* -- Financial tab -- */
  const finHook = useFinancialReport()

  /* -- Transactions tab -- */
  const txHook = useTransactions({ dateFrom, dateTo, status: 'all', limit: 1000 })

  /* -- Products sold tab -- */
  const prodHook = useSoldProductsReport()

  /* -- Stock tab -- */
  const stockHook = useStockReport()

  /* -- Shifts tab -- */
  const shiftHook = useShiftReport()

  /* Fetch data on tab change */
  useEffect(() => {
    if (tab === 'transactions') void txHook.refetch()
    if (tab === 'products')     void prodHook.fetch(dateFrom, dateTo)
    if (tab === 'stock')        void stockHook.fetch()
    if (tab === 'shifts')       void shiftHook.fetch(dateFrom, dateTo)
    if (tab === 'finance')      void finHook.fetch(dateFrom, dateTo)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, dateFrom, dateTo])

  /* ── Export handlers ── */
  function exportTransactionsCsv() {
    const headers = ['Invoice', 'Tanggal', 'Kasir', 'Metode', 'Subtotal', 'Diskon', 'Total', 'Bayar', 'Kembalian', 'Status']
    const rows = txHook.transactions.map((t) => [
      t.invoice_no,
      fmtDatetime(t.created_at),
      t.profiles?.name ?? '—',
      t.payment_method,
      fmtRp(t.subtotal),
      fmtRp(t.discount),
      fmtRp(t.total),
      t.cash_paid !== null ? fmtRp(t.cash_paid) : '—',
      t.change    !== null ? fmtRp(t.change)    : '—',
      t.status,
    ])
    downloadCsv(`transaksi_${dateFrom}_sd_${dateTo}`, headers, rows)
  }

  function exportProductsCsv() {
    const headers = ['Produk', 'Kategori', 'Satuan', 'Qty Terjual', 'Jumlah Transaksi', 'Total Omset (Rp)']
    const rows = prodHook.data.map((p) => [
      p.product_name, p.category_name ?? '—', p.unit,
      p.total_qty, p.total_transactions, fmtRp(p.total_subtotal),
    ])
    downloadCsv(`produk_terjual_${dateFrom}_sd_${dateTo}`, headers, rows)
  }

  function exportStockCsv() {
    const headers = ['Nama Produk', 'SKU', 'Kategori', 'Satuan', 'Stok', 'Min Stok', 'HPP (Rp)', 'Harga Ecer (Rp)', 'Nilai Stok (Rp)', 'Status']
    const rows = stockHook.data.map((p) => [
      p.name, p.sku ?? '—', p.category_name ?? '—', p.unit,
      p.stock_qty, p.min_stock, fmtRp(p.cost_price), fmtRp(p.price_retail), fmtRp(p.stock_value), p.status,
    ])
    downloadCsv(`stok_produk_${todayStr()}`, headers, rows)
  }

  function exportShiftsCsv() {
    const headers = ['Kasir', 'Buka Shift', 'Tutup Shift', 'Status', 'Modal Awal', 'Kas Fisik', 'Expected Kas', 'Selisih', 'Jml Transaksi', 'Total Omset (Rp)']
    const rows = shiftHook.data.map((s) => [
      s.cashier_name,
      fmtDatetime(s.opened_at),
      s.closed_at ? fmtDatetime(s.closed_at) : '—',
      s.status,
      fmtRp(s.opening_cash),
      s.closing_cash  !== null ? fmtRp(s.closing_cash)  : '—',
      s.expected_cash !== null ? fmtRp(s.expected_cash) : '—',
      s.difference    !== null ? fmtRp(s.difference)    : '—',
      s.total_transactions,
      fmtRp(s.total_revenue),
    ])
    downloadCsv(`laporan_shift_${dateFrom}_sd_${dateTo}`, headers, rows)
  }

  function exportFinanceHeaders() {
    return ['Produk', 'Kategori', 'Satuan', 'Qty Terjual', 'Omset (Rp)', 'HPP (Rp)', 'Laba Kotor (Rp)', 'Margin Kotor (%)']
  }
  function exportFinanceRows() {
    return (finHook.summary?.productBreakdown ?? []).map((p) => [
      p.product_name,
      p.category_name ?? '—',
      p.unit,
      p.qty_sold,
      p.revenue,
      p.cogs,
      p.gross_profit,
      p.gross_margin.toFixed(2),
    ])
  }

  const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: 'transactions', label: 'Transaksi',      icon: '🧾' },
    { key: 'products',     label: 'Produk Terjual', icon: '📦' },
    { key: 'stock',        label: 'Stok Produk',    icon: '📊' },
    { key: 'shifts',       label: 'Shift Kasir',    icon: '🔐' },
    { key: 'finance',      label: 'Keuangan',       icon: '💰' },
  ]

  const hasDateFilter = tab !== 'stock'
  const isLoading =
    (tab === 'transactions' && txHook.loading) ||
    (tab === 'products'     && prodHook.loading) ||
    (tab === 'stock'        && stockHook.loading) ||
    (tab === 'shifts'       && shiftHook.loading) ||
    (tab === 'finance'      && finHook.loading)
  const currentError =
    (tab === 'transactions' && txHook.error) ||
    (tab === 'products'     && prodHook.error) ||
    (tab === 'stock'        && stockHook.error) ||
    (tab === 'shifts'       && shiftHook.error) ||
    (tab === 'finance'      && finHook.error)

  function handleExport() {
    if (tab === 'transactions') exportTransactionsCsv()
    if (tab === 'products')     exportProductsCsv()
    if (tab === 'stock')        exportStockCsv()
    if (tab === 'shifts')       exportShiftsCsv()
  }

  const totalCount =
    tab === 'transactions' ? txHook.transactions.length :
    tab === 'products'     ? prodHook.data.length :
    tab === 'stock'        ? stockHook.data.length :
    tab === 'finance'      ? (finHook.summary?.productBreakdown.length ?? 0) :
    shiftHook.data.length

  return (
    <section className="page-stack">
      {/* Header */}
      <div className="page-header">
        <div>
          <span className="eyebrow">Laporan</span>
          <h1>Export & Laporan</h1>
        </div>
        {tab === 'finance' ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="ghost-button"
              onClick={() => downloadExcel(`keuangan_${dateFrom}_sd_${dateTo}`, exportFinanceHeaders(), exportFinanceRows(), 'Lap. Keuangan')}
              disabled={isLoading || totalCount === 0}>
              ⬇ Excel
            </button>
            <button type="button" className="primary-button"
              onClick={() => downloadCsv(`keuangan_${dateFrom}_sd_${dateTo}`, exportFinanceHeaders(), exportFinanceRows())}
              disabled={isLoading || totalCount === 0}>
              ⬇ CSV ({totalCount} produk)
            </button>
          </div>
        ) : (
          <button type="button" className="primary-button"
            onClick={handleExport} disabled={isLoading || totalCount === 0}>
            ⬇ Export CSV ({totalCount} baris)
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="report-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`report-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Date filter (hide for stock tab) */}
      {hasDateFilter && (
        <div className="panel">
          <div className="tx-filters">
            <div className="tx-filter-group">
              <label className="sm-label" htmlFor="rpt-from">Dari Tanggal</label>
              <input id="rpt-from" type="date" className="pm-input" value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)} style={{ width: 'auto' }} />
            </div>
            <div className="tx-filter-group">
              <label className="sm-label" htmlFor="rpt-to">Sampai Tanggal</label>
              <input id="rpt-to" type="date" className="pm-input" value={dateTo}
                onChange={(e) => setDateTo(e.target.value)} style={{ width: 'auto' }} />
            </div>
            <button type="button" className="ghost-button small" onClick={() => {
              if (tab === 'transactions') void txHook.refetch()
              if (tab === 'products')     void prodHook.fetch(dateFrom, dateTo)
              if (tab === 'shifts')       void shiftHook.fetch(dateFrom, dateTo)
            }}>↻ Terapkan</button>
          </div>
        </div>
      )}

      {/* Error */}
      {currentError && <p className="form-error">{currentError}</p>}

      {/* Table content */}
      <section className="panel print-panel">
        {isLoading ? (
          <div className="loading-panel"><div className="spinner" /></div>
        ) : (
          <>
            {/* ── TRANSACTIONS ── */}
            {tab === 'transactions' && (
              txHook.transactions.length === 0
                ? <div className="empty-state compact"><h2>Belum ada transaksi</h2></div>
                : (
                  <>
                    <div className="report-summary-bar">
                      <span>{txHook.transactions.filter(t=>t.status==='paid').length} lunas</span>
                      <span>{txHook.transactions.filter(t=>t.status==='voided').length} void</span>
                      <strong>
                        Total: Rp {txHook.transactions.filter(t=>t.status==='paid')
                          .reduce((s,t)=>s+Number(t.total),0).toLocaleString('id-ID')}
                      </strong>
                    </div>
                    <div className="table-shell">
                      <table>
                        <thead>
                          <tr><th>Invoice</th><th>Tanggal</th><th>Kasir</th><th>Metode</th><th style={{textAlign:'right'}}>Subtotal</th><th style={{textAlign:'right'}}>Diskon</th><th style={{textAlign:'right'}}>Total</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                          {txHook.transactions.map((t) => (
                            <tr key={t.id} className={t.status==='voided'?'tx-voided-row':''}>
                              <td style={{fontWeight:650}}>{t.invoice_no}</td>
                              <td style={{fontSize:12,color:'var(--text-muted)'}}>{fmtDatetime(t.created_at)}</td>
                              <td>{t.profiles?.name??'—'}</td>
                              <td>{t.payment_method}</td>
                              <td style={{textAlign:'right'}}>Rp {fmtRp(t.subtotal)}</td>
                              <td style={{textAlign:'right'}}>{Number(t.discount)>0?`Rp ${fmtRp(t.discount)}`:'—'}</td>
                              <td style={{textAlign:'right',fontWeight:700}}>Rp {fmtRp(t.total)}</td>
                              <td><span className={`status-badge ${t.status==='paid'?'active':'inactive'}`}>{t.status==='paid'?'Lunas':'Void'}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )
            )}

            {/* ── PRODUCTS SOLD ── */}
            {tab === 'products' && (
              prodHook.data.length === 0
                ? <div className="empty-state compact"><h2>Belum ada penjualan</h2></div>
                : (
                  <>
                    <div className="report-summary-bar">
                      <span>{prodHook.data.length} produk terjual</span>
                      <strong>Total Omset: Rp {prodHook.data.reduce((s,p)=>s+p.total_subtotal,0).toLocaleString('id-ID')}</strong>
                    </div>
                    <div className="table-shell">
                      <table>
                        <thead>
                          <tr><th>Produk</th><th>Kategori</th><th>Satuan</th><th style={{textAlign:'right'}}>Qty Terjual</th><th style={{textAlign:'right'}}>Jml Transaksi</th><th style={{textAlign:'right'}}>Total Omset</th></tr>
                        </thead>
                        <tbody>
                          {prodHook.data.map((p,i) => (
                            <tr key={p.product_id}>
                              <td><span className="rpt-rank">#{i+1}</span> {p.product_name}</td>
                              <td style={{color:'var(--text-muted)',fontSize:12}}>{p.category_name??'—'}</td>
                              <td>{p.unit}</td>
                              <td style={{textAlign:'right',fontWeight:650}}>{p.total_qty.toLocaleString('id-ID')}</td>
                              <td style={{textAlign:'right',color:'var(--text-muted)'}}>{p.total_transactions}</td>
                              <td style={{textAlign:'right',fontWeight:700}}>Rp {fmtRp(p.total_subtotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )
            )}

            {/* ── STOCK ── */}
            {tab === 'stock' && (
              stockHook.data.length === 0
                ? <div className="empty-state compact"><h2>Belum ada produk aktif</h2></div>
                : (
                  <>
                    <div className="report-summary-bar">
                      <span>{stockHook.data.length} produk</span>
                      <span className="text-warn">{stockHook.data.filter(p=>p.status==='kritis').length} kritis</span>
                      <span className="text-danger">{stockHook.data.filter(p=>p.status==='habis').length} habis</span>
                      <strong>Total Nilai Stok: Rp {stockHook.data.reduce((s,p)=>s+p.stock_value,0).toLocaleString('id-ID')}</strong>
                    </div>
                    <div className="table-shell">
                      <table>
                        <thead>
                          <tr><th>Produk</th><th>SKU</th><th>Kategori</th><th>Satuan</th><th style={{textAlign:'right'}}>Stok</th><th style={{textAlign:'right'}}>Min</th><th style={{textAlign:'right'}}>HPP</th><th style={{textAlign:'right'}}>Nilai Stok</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                          {stockHook.data.map((p) => (
                            <tr key={p.id}>
                              <td style={{fontWeight:650}}>{p.name}</td>
                              <td style={{fontSize:12,color:'var(--text-muted)'}}>{p.sku??'—'}</td>
                              <td style={{fontSize:12,color:'var(--text-muted)'}}>{p.category_name??'—'}</td>
                              <td>{p.unit}</td>
                              <td style={{textAlign:'right',fontWeight:700}}>{p.stock_qty}</td>
                              <td style={{textAlign:'right',color:'var(--text-muted)'}}>{p.min_stock}</td>
                              <td style={{textAlign:'right'}}>Rp {fmtRp(p.cost_price)}</td>
                              <td style={{textAlign:'right',fontWeight:700}}>Rp {fmtRp(p.stock_value)}</td>
                              <td>
                                <span className={`status-badge ${p.status==='aman'?'active':p.status==='kritis'?'warning':'inactive'}`}>
                                  {p.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )
            )}

            {/* ── SHIFTS ── */}
            {tab === 'shifts' && (
              shiftHook.data.length === 0
                ? <div className="empty-state compact"><h2>Belum ada shift</h2></div>
                : (
                  <>
                    <div className="report-summary-bar">
                      <span>{shiftHook.data.length} shift</span>
                      <strong>Total Omset: Rp {shiftHook.data.reduce((s,sh)=>s+sh.total_revenue,0).toLocaleString('id-ID')}</strong>
                    </div>
                    <div className="table-shell">
                      <table>
                        <thead>
                          <tr><th>Kasir</th><th>Buka</th><th>Tutup</th><th style={{textAlign:'right'}}>Modal Awal</th><th style={{textAlign:'right'}}>Selisih Kas</th><th style={{textAlign:'right'}}>Transaksi</th><th style={{textAlign:'right'}}>Total Omset</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                          {shiftHook.data.map((s) => (
                            <tr key={s.id}>
                              <td style={{fontWeight:650}}>{s.cashier_name}</td>
                              <td style={{fontSize:12}}>{fmtDatetime(s.opened_at)}</td>
                              <td style={{fontSize:12,color:'var(--text-muted)'}}>{s.closed_at?fmtDatetime(s.closed_at):'—'}</td>
                              <td style={{textAlign:'right'}}>Rp {fmtRp(s.opening_cash)}</td>
                              <td style={{textAlign:'right',color:s.difference&&s.difference<0?'#e11d48':'var(--text-strong)',fontWeight:s.difference&&s.difference!==0?700:400}}>
                                {s.difference!==null?`Rp ${fmtRp(s.difference)}`:'—'}
                              </td>
                              <td style={{textAlign:'right'}}>{s.total_transactions}</td>
                              <td style={{textAlign:'right',fontWeight:700}}>Rp {fmtRp(s.total_revenue)}</td>
                              <td><span className={`status-badge ${s.status==='open'?'active':'inactive'}`}>{s.status==='open'?'Buka':'Tutup'}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )
            )}
            {/* ── FINANCE ── */}
            {tab === 'finance' && (
              finHook.summary === null
                ? <div className="empty-state compact"><h2>Pilih periode dan tekan Terapkan</h2></div>
                : (() => {
                    const s = finHook.summary
                    const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`
                    const pct = (n: number) => `${n.toFixed(1)}%`
                    const colorGreen = { color: '#16a34a', fontWeight: 700 } as const
                    const colorRed   = { color: '#e11d48', fontWeight: 700 } as const
                    return (
                      <>
                        {/* KPI Baris 1 — Pendapatan & HPP */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 10 }}>
                          {[
                            { label: 'Omset Bersih', value: fmt(s.revenue), sub: `Sebelum diskon: ${fmt(s.revenueGross)}`, style: {} },
                            { label: 'HPP Total', value: fmt(s.cogs), sub: 'Harga Pokok Penjualan', style: colorRed },
                            { label: 'Laba Kotor', value: fmt(s.grossProfit), sub: pct(s.grossMargin) + ' margin', style: s.grossProfit >= 0 ? colorGreen : colorRed },
                            { label: 'Margin Kotor', value: pct(s.grossMargin), sub: `${s.totalTransactions} transaksi`, style: s.grossMargin >= 20 ? colorGreen : { color: '#d97706', fontWeight: 700 } },
                          ].map((kpi) => (
                            <div key={kpi.label} className="panel" style={{ textAlign: 'center', padding: '14px 12px' }}>
                              <p className="sm-label" style={{ marginBottom: 4 }}>{kpi.label}</p>
                              <p style={{ fontSize: 18, ...kpi.style }}>{kpi.value}</p>
                              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{kpi.sub}</p>
                            </div>
                          ))}
                        </div>
                        {/* KPI Baris 2 — Laba Bersih & Void */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
                          {[
                            { label: 'Total Diskon', value: fmt(s.totalDiscount), sub: pct(s.discountImpact) + ' dari omset kotor', style: { color: '#d97706', fontWeight: 700 } },
                            { label: 'Biaya Operasional', value: fmt(s.operationalCosts), sub: 'Dari modul Biaya Operasional', style: colorRed },
                            { label: 'Laba Bersih', value: fmt(s.netProfit), sub: pct(s.netMargin) + ' margin bersih', style: s.netProfit >= 0 ? colorGreen : colorRed },
                            { label: 'Nilai Void', value: fmt(s.voidedValue), sub: `${s.voidedCount} transaksi dibatalkan`, style: s.voidedCount > 0 ? { color: '#e11d48', fontWeight: 700 } : {} },
                          ].map((kpi) => (
                            <div key={kpi.label} className="panel" style={{ textAlign: 'center', padding: '14px 12px' }}>
                              <p className="sm-label" style={{ marginBottom: 4 }}>{kpi.label}</p>
                              <p style={{ fontSize: 18, ...kpi.style }}>{kpi.value}</p>
                              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{kpi.sub}</p>
                            </div>
                          ))}
                        </div>
                        {/* Tabel rincian per produk */}
                        {s.productBreakdown.length === 0
                          ? <div className="empty-state compact"><h2>Tidak ada data penjualan</h2></div>
                          : (
                            <div className="table-shell">
                              <table>
                                <thead>
                                  <tr>
                                    <th>#</th><th>Produk</th><th>Kategori</th><th style={{textAlign:'right'}}>Qty</th>
                                    <th style={{textAlign:'right'}}>Omset</th><th style={{textAlign:'right'}}>HPP</th>
                                    <th style={{textAlign:'right'}}>Laba Kotor</th><th style={{textAlign:'right'}}>Margin</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {s.productBreakdown.map((p, i) => (
                                    <tr key={p.product_id}>
                                      <td style={{color:'var(--text-muted)',fontSize:12}}>#{i+1}</td>
                                      <td style={{fontWeight:650}}>{p.product_name}</td>
                                      <td style={{fontSize:12,color:'var(--text-muted)'}}>{p.category_name ?? '—'}</td>
                                      <td style={{textAlign:'right'}}>{p.qty_sold.toLocaleString('id-ID')} {p.unit}</td>
                                      <td style={{textAlign:'right'}}>Rp {fmtRp(p.revenue)}</td>
                                      <td style={{textAlign:'right',color:'#e11d48'}}>Rp {fmtRp(p.cogs)}</td>
                                      <td style={{textAlign:'right',fontWeight:700,...(p.gross_profit>=0?{color:'#16a34a'}:{color:'#e11d48'})}}>
                                        Rp {fmtRp(p.gross_profit)}
                                      </td>
                                      <td style={{textAlign:'right',fontWeight:650,...(p.gross_margin>=20?{color:'#16a34a'}:p.gross_margin>=10?{color:'#d97706'}:{color:'#e11d48'})}}>
                                        {p.gross_margin.toFixed(1)}%
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr>
                                    <td colSpan={4} style={{fontWeight:700,paddingTop:10}}>TOTAL</td>
                                    <td style={{textAlign:'right',fontWeight:700}}>Rp {fmtRp(s.revenue)}</td>
                                    <td style={{textAlign:'right',fontWeight:700,color:'#e11d48'}}>Rp {fmtRp(s.cogs)}</td>
                                    <td style={{textAlign:'right',fontWeight:700,color:'#16a34a'}}>Rp {fmtRp(s.grossProfit)}</td>
                                    <td style={{textAlign:'right',fontWeight:700}}>{s.grossMargin.toFixed(1)}%</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )
                        }
                      </>
                    )
                  })()
            )}
          </>
        )}
      </section>
    </section>
  )
}
