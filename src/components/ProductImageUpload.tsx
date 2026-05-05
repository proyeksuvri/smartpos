import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import './ProductImageUpload.css'

/* ── Constants ──────────────────────────────────────────── */
const BUCKET = 'product-images'
const MAX_SIZE_BYTES = 2 * 1024 * 1024   // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/* ── Helpers ────────────────────────────────────────────── */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function ext(file: File) {
  return file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
}

/* ── Component ──────────────────────────────────────────── */
interface ProductImageUploadProps {
  /** Current image URL (from DB) */
  currentUrl: string | null
  /** Product ID — used as folder prefix. Can be 'new' for new products */
  productId?: string
  /** Called when upload completes with the new public URL */
  onChange: (url: string | null) => void
}

export function ProductImageUpload({ currentUrl, productId, onChange }: ProductImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentUrl)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError(null)

    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Format tidak didukung. Gunakan JPEG, PNG, WebP, atau GIF.')
      return
    }

    // Validate size
    if (file.size > MAX_SIZE_BYTES) {
      setError(`Ukuran file melebihi 2 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).`)
      return
    }

    // Show local preview immediately
    const dataUrl = await fileToDataUrl(file)
    setPreview(dataUrl)

    // Upload to Supabase Storage
    setUploading(true)
    setProgress(10)

    try {
      const folder = productId ?? 'new'
      const filename = `${folder}/${crypto.randomUUID()}.${ext(file)}`

      setProgress(30)

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(filename, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        })

      if (uploadErr) throw new Error(uploadErr.message)

      setProgress(80)

      // Get public URL
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename)
      const publicUrl = data.publicUrl

      setProgress(100)
      onChange(publicUrl)

      // Reset progress after short delay
      setTimeout(() => setProgress(0), 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload gagal.')
      setPreview(currentUrl)   // Revert preview
    } finally {
      setUploading(false)
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  function handleRemove() {
    setPreview(null)
    setError(null)
    onChange(null)
  }

  return (
    <div className="piu-root">
      {/* Drop Zone */}
      <div
        className={`piu-zone ${dragging ? 'dragging' : ''} ${preview ? 'has-image' : ''}`}
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        aria-label="Upload foto produk"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
      >
        {preview ? (
          <img
            src={preview}
            alt="Preview foto produk"
            className="piu-preview"
          />
        ) : (
          <div className="piu-placeholder">
            <span className="piu-icon">📷</span>
            <span className="piu-hint-main">
              {dragging ? 'Lepaskan untuk upload' : 'Klik atau tarik foto ke sini'}
            </span>
            <span className="piu-hint-sub">JPEG · PNG · WebP · GIF · Maks 2 MB</span>
          </div>
        )}

        {/* Uploading overlay */}
        {uploading && (
          <div className="piu-uploading">
            <div className="piu-spinner" />
            <span>Mengupload... {progress}%</span>
            <div className="piu-progress-bar">
              <div className="piu-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {preview && !uploading && (
        <div className="piu-actions">
          <button
            type="button"
            className="piu-btn change"
            onClick={() => inputRef.current?.click()}
          >
            🔄 Ganti Foto
          </button>
          <button
            type="button"
            className="piu-btn remove"
            onClick={handleRemove}
          >
            🗑️ Hapus
          </button>
        </div>
      )}

      {/* Error */}
      {error && <p className="piu-error">{error}</p>}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        className="piu-input-hidden"
        onChange={handleInputChange}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  )
}
