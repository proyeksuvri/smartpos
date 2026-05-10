import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { to: '/dashboard', label: '📊 Dashboard' },
      { to: '/pos', label: '🛒 POS Kasir' },
    ],
  },
  {
    label: 'Master Data',
    items: [
      { to: '/products', label: '📦 Produk' },
      { to: '/stock', label: '📊 Stok' },
      { to: '/categories', label: '🏷️ Kategori' },
      { to: '/customers', label: '👥 Customer' },
      { to: '/suppliers', label: '🚚 Supplier' },
    ],
  },
  {
    label: 'Laporan',
    items: [
      { to: '/transactions',      label: '🧾 Transaksi' },
      { to: '/shifts',            label: '🕐 Shift Kasir' },
      { to: '/reports',           label: '📋 Export Laporan' },
      { to: '/operational-costs', label: '💸 Biaya Operasional' },
      { to: '/sync-queue',        label: '📡 Sync Queue' },
    ],
  },
  {
    label: 'Sistem',
    items: [
      { to: '/employees', label: '👤 Pegawai' },
      { to: '/reset-data', label: '🗑️ Reset Data' },
      { to: '/settings',  label: '⚙️ Settings' },
    ],
  },
]

// Items only visible to owner/manager
const OWNER_ONLY_ITEMS = ['/employees', '/reset-data']

export function AppLayout() {
  const { profile, signOut } = useAuth()
  const isOnline    = useOnlineStatus()
  const { pendingCount, failedCount } = useOfflineSync()
  const isOwnerOrManager = profile?.role === 'owner' || profile?.role === 'manager'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-mark">SP</span>
          <div>
            <strong>SmartPOS</strong>
            <small>Core MVP</small>
          </div>
        </div>

        {/* Online/Offline status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 8,
          background: isOnline ? '#f0fdf4' : '#fff7ed',
          border: `1px solid ${isOnline ? '#bbf7d0' : '#fed7aa'}`,
          fontSize: 12, fontWeight: 700,
          color: isOnline ? '#15803d' : '#c2410c',
        }}>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: isOnline ? '#16a34a' : '#ea580c',
          }} />
          {isOnline ? 'Online' : 'Offline'}
          {(pendingCount > 0 || failedCount > 0) && (
            <span style={{
              marginLeft: 4, background: failedCount > 0 ? '#e11d48' : '#d97706',
              color: '#fff', borderRadius: '999px', fontSize: 11,
              padding: '1px 6px', fontWeight: 800,
            }}>
              {failedCount > 0 ? `${failedCount} gagal` : `${pendingCount} pending`}
            </span>
          )}
        </div>

        <nav className="sidebar-nav" aria-label="Navigasi utama">
          {NAV_GROUPS.map((group) => (
            <div key={group.label ?? 'main'} className="nav-group">
              {group.label && (
                <span className="nav-group-label">{group.label}</span>
              )}
              {group.items
                .filter((item) => !OWNER_ONLY_ITEMS.includes(item.to) || isOwnerOrManager)
                .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Role</span>
            <strong>{profile?.role ?? '-'}</strong>
          </div>
          <div className="user-actions">
            <span>{profile?.name ?? 'User'}</span>
            <button type="button" className="ghost-button" onClick={() => void signOut()}>
              Keluar
            </button>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
