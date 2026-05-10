import type { MouseEvent } from 'react'

interface PinKeypadProps {
  pin: string
  maxLength?: number
  loading?: boolean
  error?: string
  onDigit: (digit: string) => void
  onBackspace: () => void
  onClear: () => void
  onSubmit: () => void
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

export function PinKeypad({
  pin,
  maxLength = 6,
  loading = false,
  error,
  onDigit,
  onBackspace,
  onClear,
  onSubmit,
}: PinKeypadProps) {
  function handleKey(event: MouseEvent<HTMLButtonElement>, key: string) {
    event.preventDefault()
    if (loading) return

    if (key === '⌫') {
      onBackspace()
    } else if (key === '') {
      // Empty cell — no action
    } else {
      onDigit(key)
    }
  }

  const dots = Array.from({ length: maxLength }, (_, i) => i < pin.length)

  return (
    <div className="pin-keypad">
      {/* PIN dot display */}
      <div className="pin-dots" aria-label={`PIN ${pin.length} dari ${maxLength} digit`}>
        {dots.map((filled, i) => (
          <span
            key={i}
            className={`pin-dot${filled ? ' filled' : ''}`}
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Error */}
      {error ? <p className="pin-error">{error}</p> : <p className="pin-error-placeholder" />}

      {/* Digit grid */}
      <div className="pin-grid" role="group" aria-label="Keypad PIN">
        {DIGITS.map((key, idx) => {
          if (key === '') {
            return <span key={idx} aria-hidden="true" />
          }
          return (
            <button
              key={idx}
              type="button"
              id={`pin-key-${key === '⌫' ? 'backspace' : key}`}
              className={`pin-key${key === '⌫' ? ' pin-key-back' : ''}`}
              onClick={(e) => handleKey(e, key)}
              disabled={
                loading ||
                (key !== '⌫' && pin.length >= maxLength)
              }
              aria-label={key === '⌫' ? 'Hapus' : key}
            >
              {key}
            </button>
          )
        })}
      </div>

      {/* Actions row */}
      <div className="pin-actions">
        <button
          type="button"
          id="pin-clear"
          className="pin-clear-btn"
          onClick={onClear}
          disabled={loading || pin.length === 0}
        >
          Hapus Semua
        </button>

        <button
          type="button"
          id="pin-submit"
          className="pin-submit-btn primary-button"
          onClick={onSubmit}
          disabled={loading || pin.length < maxLength}
        >
          {loading ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Memverifikasi…
            </>
          ) : (
            'Masuk'
          )}
        </button>
      </div>
    </div>
  )
}
