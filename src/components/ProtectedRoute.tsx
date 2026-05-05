import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { loading, session, profile } = useAuth()
  const location = useLocation()

  // Masih loading initial session — tampilkan spinner
  // Jangan redirect dulu karena session mungkin sudah ada di storage
  if (loading) {
    return (
      <main className="screen-center">
        <div className="loading-panel">
          <span className="spinner" aria-hidden="true" />
          <p>Memuat sesi...</p>
        </div>
      </main>
    )
  }

  // Loading selesai, tidak ada session → redirect ke login
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Session ada, tapi profile masih loading (misal setelah TOKEN_REFRESHED)
  // Tampilkan spinner ringan daripada flash ke "profil belum siap"
  if (!profile) {
    return (
      <main className="screen-center">
        <div className="loading-panel">
          <span className="spinner" aria-hidden="true" />
          <p>Memuat profil...</p>
        </div>
      </main>
    )
  }

  if (!profile.is_active) {
    return (
      <main className="screen-center">
        <div className="empty-state">
          <h1>Akun nonaktif</h1>
          <p>Hubungi owner untuk mengaktifkan akun ini.</p>
        </div>
      </main>
    )
  }

  return children
}
