import { useAuth } from '../hooks/useAuth'

export function SettingsPage() {
  const { profile, user } = useAuth()

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <span className="eyebrow">Konfigurasi</span>
          <h1>Settings</h1>
        </div>
      </div>

      <section className="panel details-list">
        <h2>Sesi Aktif</h2>
        <dl>
          <div>
            <dt>Nama</dt>
            <dd>{profile?.name ?? '-'}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{profile?.role ?? '-'}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user?.email ?? '-'}</dd>
          </div>
        </dl>
      </section>
    </section>
  )
}
