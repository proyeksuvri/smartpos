import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

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
      { to: '/transactions', label: '🧾 Transaksi' },
      { to: '/reports',      label: '📋 Export CSV' },
    ],
  },
  {
    label: 'Sistem',
    items: [
      { to: '/settings', label: '⚙️ Settings' },
    ],
  },
]

export function AppLayout() {
  const { profile, signOut } = useAuth()

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

        <nav className="sidebar-nav" aria-label="Navigasi utama">
          {NAV_GROUPS.map((group) => (
            <div key={group.label ?? 'main'} className="nav-group">
              {group.label && (
                <span className="nav-group-label">{group.label}</span>
              )}
              {group.items.map((item) => (
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
