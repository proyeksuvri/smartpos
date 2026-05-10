import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

/* ── Types ──────────────────────────────────────────────── */
interface AppSettings {
  store_name: string
  store_address: string
  telegram_chat_id: string
  daily_report_time: string
  dnd_start: string
  dnd_end: string
  notification_preferences: Record<string, boolean>
}

const NOTIF_OPTIONS = [
  { key: 'stock_alert',      icon: '📦', label: 'Alert Stok Kritis',     desc: 'Notifikasi saat stok di bawah minimum.' },
  { key: 'void_alert',       icon: '🚨', label: 'Alert Void Berlebihan', desc: 'Peringatan jika void > 3x/hari.' },
  { key: 'shift_diff_alert', icon: '💰', label: 'Alert Selisih Kas',     desc: 'Notifikasi selisih saat tutup shift.' },
  { key: 'daily_report',     icon: '📊', label: 'Laporan Harian',        desc: 'Ringkasan penjualan setiap malam.' },
  { key: 'weekly_report',    icon: '📅', label: 'Laporan Mingguan',      desc: 'Rekap penjualan setiap Senin pagi.' },
]

/* ── Toggle Switch ──────────────────────────────────────── */
function ToggleSwitch({ checked, onChange, id }: { checked: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <label htmlFor={id} className="toggle-switch" aria-label="toggle">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
    </label>
  )
}

/* ── Field ──────────────────────────────────────────────── */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="sf-field">
      <div className="sf-label-row">
        <span className="sf-label">{label}</span>
        {hint && <span className="sf-hint">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

/* ── Section ────────────────────────────────────────────── */
function Section({ icon, title, children, fullWidth }: {
  icon: string; title: string; children: React.ReactNode; fullWidth?: boolean
}) {
  return (
    <div className={`s-section${fullWidth ? ' s-section--full' : ''}`}>
      <div className="s-section-header">
        <span className="s-section-icon">{icon}</span>
        <h2 className="s-section-title">{title}</h2>
      </div>
      <div className="s-section-body">{children}</div>
    </div>
  )
}

/* ── Main Page ──────────────────────────────────────────── */
export function SettingsPage() {
  const { user, profile } = useAuth()
  const isOwner = profile?.role === 'owner'

  /* store */
  const [store, setStore] = useState<AppSettings>({
    store_name: '', store_address: '', telegram_chat_id: '',
    daily_report_time: '', dnd_start: '', dnd_end: '',
    notification_preferences: {},
  })
  const [loadingStore, setLoadingStore] = useState(true)
  const [savingStore,  setSavingStore]  = useState(false)
  const [testingTelegram, setTestingTelegram] = useState(false)

  /* account */
  const [displayName,  setDisplayName]  = useState('')
  const [savingName,   setSavingName]   = useState(false)
  const [newPw,        setNewPw]        = useState('')
  const [newPwConfirm, setNewPwConfirm] = useState('')
  const [savingPw,     setSavingPw]     = useState(false)

  /* toast */
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  /* load */
  const loadStore = useCallback(async () => {
    setLoadingStore(true)
    const { data } = await supabase.from('app_settings').select('*').eq('id', true).maybeSingle()
    if (data) {
      setStore({
        store_name:               data.store_name ?? '',
        store_address:            data.store_address ?? '',
        telegram_chat_id:         data.telegram_chat_id ?? '',
        daily_report_time:        data.daily_report_time ?? '',
        dnd_start:                data.dnd_start ?? '',
        dnd_end:                  data.dnd_end ?? '',
        notification_preferences: (data.notification_preferences as Record<string, boolean>) ?? {},
      })
    }
    setLoadingStore(false)
  }, [])

  useEffect(() => { void loadStore() }, [loadStore])
  useEffect(() => { setDisplayName(profile?.name ?? '') }, [profile?.name])

  /* save store */
  async function handleSaveStore(e: React.FormEvent) {
    e.preventDefault()
    setSavingStore(true)
    const { error } = await supabase.from('app_settings').update({
      store_name:               store.store_name.trim(),
      store_address:            store.store_address.trim() || null,
      telegram_chat_id:         store.telegram_chat_id.trim() || null,
      daily_report_time:        store.daily_report_time || null,
      dnd_start:                store.dnd_start || null,
      dnd_end:                  store.dnd_end || null,
      notification_preferences: store.notification_preferences,
    }).eq('id', true)
    setSavingStore(false)
    error ? showToast(error.message, false) : showToast('Pengaturan toko disimpan.')
  }

  /* test telegram bot */
  async function handleTestTelegram() {
    if (!store.telegram_chat_id) {
      showToast('Masukkan Telegram Chat ID terlebih dahulu.', false)
      return
    }
    setTestingTelegram(true)
    const { error } = await supabase.functions.invoke('telegram-bot', {
      body: { type: 'test' },
    })
    setTestingTelegram(false)
    error ? showToast('Gagal mengirim pesan ke Telegram: ' + error.message, false) : showToast('Pesan percobaan berhasil dikirim ke Telegram!')
  }

  /* save name */
  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    if (!displayName.trim() || !user) return
    setSavingName(true)
    const { error } = await supabase.from('profiles').update({ name: displayName.trim() }).eq('id', user.id)
    setSavingName(false)
    error ? showToast(error.message, false) : showToast('Nama berhasil diperbarui.')
  }

  /* change pw */
  async function handleChangePw(e: React.FormEvent) {
    e.preventDefault()
    if (newPw !== newPwConfirm) { showToast('Konfirmasi password tidak cocok.', false); return }
    if (newPw.length < 8) { showToast('Password minimal 8 karakter.', false); return }
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setSavingPw(false)
    if (error) { showToast(error.message, false); return }
    showToast('Password berhasil diubah.')
    setNewPw(''); setNewPwConfirm('')
  }

  function s(key: keyof AppSettings) {
    return (val: string) => setStore((p) => ({ ...p, [key]: val }))
  }

  /* ── Render ─────────────────────────────────────── */
  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Pengaturan</h1>
          <p className="page-subtitle">Kelola profil toko, akun, dan preferensi notifikasi.</p>
        </div>
      </div>

      <div className="s-grid">

        {/* ═══════════════════════ PROFIL TOKO ═══════════════════ */}
        {isOwner && (
          <Section icon="🏪" title="Profil Toko">
            {loadingStore ? (
              <div className="loading-panel"><span className="spinner" /><span>Memuat…</span></div>
            ) : (
              <form onSubmit={handleSaveStore} className="s-form">
                <Field label="Nama Toko">
                  <input
                    id="store-name" type="text" value={store.store_name} required
                    onChange={(e) => s('store_name')(e.target.value)}
                    placeholder="Contoh: Toko Berkah Jaya"
                  />
                </Field>

                <Field label="Alamat Toko">
                  <textarea
                    id="store-address" rows={2} value={store.store_address}
                    onChange={(e) => s('store_address')(e.target.value)}
                    placeholder="Jl. Contoh No. 1, Kota"
                  />
                </Field>

                <Field label="Telegram Chat ID" hint="Untuk notifikasi otomatis">
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      id="telegram-chat-id" type="text" value={store.telegram_chat_id}
                      onChange={(e) => s('telegram_chat_id')(e.target.value)}
                      placeholder="-100xxxxxxxxxx"
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={handleTestTelegram}
                      disabled={testingTelegram || !store.telegram_chat_id}
                      style={{ flexShrink: 0 }}
                    >
                      {testingTelegram ? '...' : '✈️ Test Bot'}
                    </button>
                  </div>
                </Field>

                <div className="s-row-2">
                  <Field label="Jam Laporan Harian">
                    <input
                      id="daily-report-time" type="time" value={store.daily_report_time}
                      onChange={(e) => s('daily_report_time')(e.target.value)}
                    />
                  </Field>
                  <Field label="Jam DND">
                    <div className="s-time-range">
                      <input type="time" value={store.dnd_start} onChange={(e) => s('dnd_start')(e.target.value)} />
                      <span>–</span>
                      <input type="time" value={store.dnd_end} onChange={(e) => s('dnd_end')(e.target.value)} />
                    </div>
                  </Field>
                </div>

                {/* Notification Preferences */}
                <div className="sf-field">
                  <div className="sf-label-row">
                    <span className="sf-label">Notifikasi Telegram</span>
                  </div>
                  <div className="s-notif-list">
                    {NOTIF_OPTIONS.map(({ key, icon, label, desc }) => (
                      <div key={key} className="s-notif-row">
                        <span className="s-notif-icon">{icon}</span>
                        <div className="s-notif-text">
                          <span className="s-notif-label">{label}</span>
                          <span className="s-notif-desc">{desc}</span>
                        </div>
                        <ToggleSwitch
                          id={`notif-${key}`}
                          checked={store.notification_preferences[key] ?? false}
                          onChange={(v) => setStore((p) => ({
                            ...p,
                            notification_preferences: { ...p.notification_preferences, [key]: v },
                          }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="s-form-footer">
                  <button id="save-store-btn" type="submit" className="primary-button" disabled={savingStore}>
                    {savingStore ? 'Menyimpan…' : '💾 Simpan Pengaturan Toko'}
                  </button>
                </div>
              </form>
            )}
          </Section>
        )}

        {/* ═══════════════════════ PROFIL AKUN ═══════════════════ */}
        <Section icon="👤" title="Profil Akun">
          <form onSubmit={handleSaveName} className="s-form">
            <Field label="Nama Tampilan">
              <input
                id="display-name" type="text" value={displayName} required
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nama kamu"
              />
            </Field>
            <Field label="Email">
              <input type="email" value={user?.email ?? ''} readOnly className="s-readonly" />
            </Field>
            <div className="s-info-row">
              <span className="s-info-label">Role</span>
              <span className={`status-badge s-role-badge s-role--${profile?.role}`}>
                {profile?.role}
              </span>
            </div>
            <div className="s-form-footer">
              <button id="save-name-btn" type="submit" className="primary-button" disabled={savingName}>
                {savingName ? 'Menyimpan…' : 'Simpan Nama'}
              </button>
            </div>
          </form>
        </Section>

        {/* ═══════════════════════ KEAMANAN ═══════════════════════ */}
        <Section icon="🔒" title="Keamanan">
          <form onSubmit={handleChangePw} className="s-form">
            <p className="s-desc">Ganti password akun Anda. Gunakan minimal 8 karakter kombinasi huruf dan angka.</p>
            <Field label="Password Baru">
              <input
                id="new-password" type="password" value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Minimal 8 karakter"
                autoComplete="new-password"
              />
            </Field>
            <Field label="Konfirmasi Password Baru">
              <input
                id="new-password-confirm" type="password" value={newPwConfirm}
                onChange={(e) => setNewPwConfirm(e.target.value)}
                placeholder="Ulangi password baru"
                autoComplete="new-password"
              />
            </Field>
            {/* Password strength indicator */}
            {newPw.length > 0 && (
              <div className="s-pw-strength">
                <div className="s-pw-bar">
                  <div
                    className="s-pw-fill"
                    style={{
                      width: `${Math.min(100, newPw.length * 8)}%`,
                      background: newPw.length < 8 ? '#ef4444' : newPw.length < 12 ? '#f59e0b' : '#22c55e',
                    }}
                  />
                </div>
                <span style={{ color: newPw.length < 8 ? '#ef4444' : newPw.length < 12 ? '#f59e0b' : '#22c55e', fontSize: 12 }}>
                  {newPw.length < 8 ? 'Terlalu pendek' : newPw.length < 12 ? 'Cukup' : 'Kuat'}
                </span>
              </div>
            )}
            <div className="s-form-footer">
              <button
                id="change-pw-btn" type="submit" className="primary-button"
                disabled={savingPw || !newPw || !newPwConfirm}
              >
                {savingPw ? 'Menyimpan…' : '🔑 Ubah Password'}
              </button>
            </div>
          </form>
        </Section>

        {/* ═══════════════════════ TENTANG ════════════════════════ */}
        <Section icon="ℹ️" title="Tentang Aplikasi">
          <div className="s-about">
            <div className="s-about-logo">⚡</div>
            <div className="s-about-body">
              <div className="s-about-name">SmartPOS</div>
              <div className="s-about-version">Versi 1.0.0 — Build 2026</div>
              <p className="s-about-desc">
                Sistem kasir modern berbasis web dengan dukungan offline-first,
                manajemen stok, shift kasir, dan laporan bisnis.
              </p>
              <div className="s-about-tags">
                <span className="s-tag">React + Vite</span>
                <span className="s-tag">Supabase</span>
                <span className="s-tag">PWA</span>
                <span className="s-tag">TypeScript</span>
              </div>
            </div>
          </div>
        </Section>

      </div>

      {/* Toast */}
      {toast && (
        <div className={`s-toast ${toast.ok ? 's-toast--ok' : 's-toast--err'}`}>
          {toast.ok ? '✅' : '❌'} {toast.msg}
        </div>
      )}
    </div>
  )
}
