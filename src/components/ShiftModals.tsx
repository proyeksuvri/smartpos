import { useRef, useState } from 'react'
import type { Shift } from '../hooks/useShift'
import '../styles/SimpleModal.css'

/* ─── Open Shift Modal ─────────────────────────────────── */
interface OpenShiftModalProps {
  onOpen: (cash: number) => Promise<void>
  onClose: () => void
}

export function OpenShiftModal({ onOpen, onClose }: OpenShiftModalProps) {
  const [cash, setCash] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onOpen(cash)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuka shift.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sm-backdrop" role="dialog" aria-modal="true">
      <div className="sm-sheet">
        <div className="sm-header">
          <div className="sm-header-info">
            <span className="sm-eyebrow">Kasir</span>
            <h2 className="sm-title">Buka Shift</h2>
          </div>
        </div>
        <form ref={formRef} onSubmit={(e) => void handleSubmit(e)} className="sm-body">
          <div className="sm-field">
            <label className="sm-label" htmlFor="opening-cash">Modal Awal Kas</label>
            <div className="sm-input-prefix">
              <span className="sm-prefix">Rp</span>
              <input
                id="opening-cash"
                className="sm-input has-prefix"
                type="number"
                min="0"
                step="any"
                value={cash}
                onChange={(e) => setCash(parseFloat(e.target.value) || 0)}
                autoFocus
              />
            </div>
            <span className="sm-hint">Jumlah uang tunai di laci kasir saat shift dimulai</span>
          </div>
          {error && <div className="sm-error">{error}</div>}
        </form>
        <div className="sm-footer">
          <button type="button" className="sm-btn-cancel" onClick={onClose}>Batal</button>
          <button type="button" className="sm-btn-save" disabled={saving} onClick={() => formRef.current?.requestSubmit()}>
            {saving ? '⟳ Membuka...' : '🟢 Buka Shift'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Close Shift Modal ────────────────────────────────── */
interface CloseShiftModalProps {
  shift: Shift
  onClose_: (cash: number, notes: string) => Promise<void>
  onCancel: () => void
}

function formatRp(v: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v)
}

export function CloseShiftModal({ shift, onClose_, onCancel }: CloseShiftModalProps) {
  const [cash, setCash] = useState(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  const duration = (() => {
    const ms = Date.now() - new Date(shift.opened_at).getTime()
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    return `${h}j ${m}m`
  })()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onClose_(cash, notes)
      onCancel()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menutup shift.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sm-backdrop" role="dialog" aria-modal="true">
      <div className="sm-sheet">
        <div className="sm-header">
          <div className="sm-header-info">
            <span className="sm-eyebrow">Kasir</span>
            <h2 className="sm-title">Tutup Shift</h2>
          </div>
        </div>
        <form ref={formRef} onSubmit={(e) => void handleSubmit(e)} className="sm-body">
          <div className="shift-info-card">
            <div className="shift-info-row">
              <span>Modal Awal</span>
              <strong>{formatRp(shift.opening_cash)}</strong>
            </div>
            <div className="shift-info-row">
              <span>Durasi Shift</span>
              <strong>{duration}</strong>
            </div>
          </div>

          <div className="sm-field">
            <label className="sm-label" htmlFor="closing-cash">Kas Fisik Akhir <span className="sm-req">*</span></label>
            <div className="sm-input-prefix">
              <span className="sm-prefix">Rp</span>
              <input
                id="closing-cash"
                className="sm-input has-prefix"
                type="number"
                min="0"
                step="any"
                value={cash}
                onChange={(e) => setCash(parseFloat(e.target.value) || 0)}
                required
                autoFocus
              />
            </div>
            <span className="sm-hint">Hitung uang fisik di laci kasir sekarang</span>
          </div>

          <div className="sm-field">
            <label className="sm-label" htmlFor="shift-notes">Catatan</label>
            <textarea
              id="shift-notes"
              className="sm-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opsional — catatan untuk shift ini"
              rows={2}
            />
          </div>
          {error && <div className="sm-error">{error}</div>}
        </form>
        <div className="sm-footer">
          <button type="button" className="sm-btn-cancel" onClick={onCancel}>Batal</button>
          <button type="button" className="sm-btn-danger" disabled={saving} onClick={() => formRef.current?.requestSubmit()}>
            {saving ? '⟳ Menutup...' : '🔴 Tutup Shift'}
          </button>
        </div>
      </div>
    </div>
  )
}
