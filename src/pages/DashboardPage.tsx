import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Link } from 'react-router-dom'
import { useDashboard } from '../hooks/useDashboard'

/* ── Helpers ────────────────────────────────────────────── */
function formatRp(v: number, compact = false): string {
  if (compact) {
    if (v >= 1_000_000) return `Rp ${(v / 1_000_000).toFixed(1)}jt`
    if (v >= 1_000) return `Rp ${(v / 1_000).toFixed(0)}rb`
    return `Rp ${v}`
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(v)
}

function delta(today: number, yesterday: number): { sign: string; pct: number; dir: 'up' | 'down' | 'flat' } {
  if (yesterday === 0) return { sign: '', pct: 0, dir: 'flat' }
  const pct = ((today - yesterday) / yesterday) * 100
  return {
    sign: pct >= 0 ? '▲' : '▼',
    pct: Math.abs(pct),
    dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat',
  }
}

/* ── Metric Card ────────────────────────────────────────── */
interface MetricCardProps {
  label: string
  value: string
  icon: string
  sub?: string
  dir?: 'up' | 'down' | 'flat'
  subColor?: 'green' | 'red' | 'muted' | 'warn'
  loading?: boolean
}

function MetricCard({ label, value, icon, sub, dir, subColor = 'muted', loading }: MetricCardProps) {
  return (
    <article className="dash-metric-card">
      <div className="dash-metric-icon">{icon}</div>
      <div className="dash-metric-body">
        <span className="dash-metric-label">{label}</span>
        {loading ? (
          <div className="dash-metric-skeleton" />
        ) : (
          <strong className="dash-metric-value">{value}</strong>
        )}
        {sub && !loading && (
          <span className={`dash-metric-sub ${dir ?? ''} ${subColor}`}>{sub}</span>
        )}
      </div>
    </article>
  )
}

/* ── Revenue Chart ──────────────────────────────────────── */
interface RevenueChartProps {
  data: { date: string; revenue: number; txCount: number }[]
}

function RevenueChart({ data }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="grad-revenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => formatRp(v, true)}
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        <Tooltip
          formatter={(val) => [formatRp(Number(val ?? 0)), 'Omset']}
          labelFormatter={(label) => `Tanggal: ${label as string}`}
          contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #e2e8f0' }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#2563eb"
          strokeWidth={2}
          fill="url(#grad-revenue)"
          dot={false}
          activeDot={{ r: 5, strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ── Top Products Bar ───────────────────────────────────── */
interface TopProductsProps {
  data: { product_name: string; total_revenue: number; total_qty: number }[]
  maxRevenue: number
}

function TopProducts({ data, maxRevenue }: TopProductsProps) {
  return (
    <div className="dash-top-products">
      {data.map((p, i) => (
        <div key={p.product_name} className="dash-top-item">
          <span className="dash-top-rank">#{i + 1}</span>
          <div className="dash-top-info">
            <span className="dash-top-name">{p.product_name}</span>
            <div className="dash-top-bar-wrap">
              <div
                className="dash-top-bar"
                style={{ width: `${maxRevenue > 0 ? (p.total_revenue / maxRevenue) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div className="dash-top-stats">
            <span className="dash-top-rev">{formatRp(p.total_revenue, true)}</span>
            <span className="dash-top-qty">{p.total_qty} terjual</span>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Auto-refresh countdown ─────────────────────────────── */
function useCountdown(seconds: number, onTick: () => void) {
  const [remaining, setRemaining] = useState(seconds)
  const cbRef = useRef(onTick)
  cbRef.current = onTick

  useEffect(() => {
    setRemaining(seconds)
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          cbRef.current()
          return seconds
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [seconds])

  return remaining
}

/* ── Dashboard Page ─────────────────────────────────────── */
export function DashboardPage() {
  const { data, loading, error, refetch } = useDashboard()
  const remaining = useCountdown(120, useCallback(() => void refetch(), [refetch]))

  const m = data?.metrics
  const revDelta = m ? delta(m.todayRevenue, m.yesterdayRevenue) : null
  const txDelta  = m ? delta(m.todayTxCount, m.yesterdayTxCount)  : null
  const maxRevenue = data?.topProducts?.[0]?.total_revenue ?? 0

  return (
    <section className="page-stack">
      {/* Header */}
      <div className="page-header">
        <div>
          <span className="eyebrow">Overview</span>
          <h1>Dashboard</h1>
        </div>
        <div className="dash-header-right">
          <span className="dash-refresh-hint">Refresh dalam {remaining}d</span>
          <button type="button" className="ghost-button small" onClick={() => void refetch()}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {/* ── Metric Cards ─────────────────────────────── */}
      <div className="dash-metric-grid">
        <MetricCard
          label="Omset Hari Ini"
          value={formatRp(m?.todayRevenue ?? 0)}
          icon="💰"
          sub={revDelta && m?.yesterdayRevenue
            ? `${revDelta.sign} ${revDelta.pct.toFixed(0)}% vs kemarin`
            : 'Belum ada data kemarin'}
          dir={revDelta?.dir}
          subColor={revDelta?.dir === 'up' ? 'green' : revDelta?.dir === 'down' ? 'red' : 'muted'}
          loading={loading}
        />
        <MetricCard
          label="Transaksi Hari Ini"
          value={String(m?.todayTxCount ?? 0)}
          icon="🧾"
          sub={txDelta && m?.yesterdayTxCount
            ? `${txDelta.sign} ${txDelta.pct.toFixed(0)}% vs kemarin (${m?.yesterdayTxCount} kemarin)`
            : `${m?.yesterdayTxCount ?? 0} transaksi kemarin`}
          dir={txDelta?.dir}
          subColor={txDelta?.dir === 'up' ? 'green' : txDelta?.dir === 'down' ? 'red' : 'muted'}
          loading={loading}
        />
        <MetricCard
          label="Shift Aktif"
          value={String(m?.activeShifts ?? 0)}
          icon="🟢"
          sub={m?.activeShifts ? 'Kasir sedang bertugas' : 'Tidak ada shift terbuka'}
          subColor={m?.activeShifts ? 'green' : 'muted'}
          loading={loading}
        />
        <MetricCard
          label="Stok Bermasalah"
          value={String((m?.criticalStockCount ?? 0) + (m?.outOfStockCount ?? 0))}
          icon="⚠️"
          sub={m ? `${m.criticalStockCount} kritis · ${m.outOfStockCount} habis` : ''}
          subColor={(m?.criticalStockCount ?? 0) + (m?.outOfStockCount ?? 0) > 0 ? 'warn' : 'green'}
          loading={loading}
        />
      </div>

      {/* ── Charts Row ───────────────────────────────── */}
      <div className="dash-charts-row">
        {/* Revenue chart */}
        <section className="panel dash-chart-panel">
          <div className="dash-panel-header">
            <h2>Omset 7 Hari Terakhir</h2>
          </div>
          {loading ? (
            <div className="dash-chart-skeleton" />
          ) : (
            <RevenueChart data={data?.chart ?? []} />
          )}
        </section>

        {/* Top products */}
        <section className="panel dash-top-panel">
          <div className="dash-panel-header">
            <h2>Top 5 Produk (7 Hari)</h2>
          </div>
          {loading ? (
            <div className="loading-panel"><div className="spinner" /></div>
          ) : data?.topProducts && data.topProducts.length > 0 ? (
            <TopProducts data={data.topProducts} maxRevenue={maxRevenue} />
          ) : (
            <p className="text-muted" style={{ fontSize: 13 }}>Belum ada data penjualan.</p>
          )}
        </section>
      </div>

      {/* ── Critical Stock Alert ─────────────────────── */}
      {!loading && data?.criticalProducts && data.criticalProducts.length > 0 && (
        <section className="panel">
          <div className="dash-panel-header">
            <h2>⚠️ Peringatan Stok</h2>
            <Link to="/stock" className="dash-see-all">Kelola Stok →</Link>
          </div>
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Stok Saat Ini</th>
                  <th>Stok Minimum</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.criticalProducts.map((p) => (
                  <tr key={p.id}>
                    <td><strong className="product-name">{p.name}</strong></td>
                    <td>
                      <span className={p.stock_qty <= 0 ? 'stock-empty' : 'stock-low'}>
                        {p.stock_qty} {p.unit}
                      </span>
                    </td>
                    <td className="text-muted">
                      {p.min_stock > 0 ? `${p.min_stock} ${p.unit}` : '—'}
                    </td>
                    <td>
                      <span className={`status-badge ${p.stock_qty <= 0 ? 'inactive' : 'warning'}`}>
                        {p.stock_qty <= 0 ? 'Habis' : 'Kritis'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  )
}
