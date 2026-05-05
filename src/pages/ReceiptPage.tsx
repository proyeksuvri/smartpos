import { Link, useParams } from 'react-router-dom'
import { useReceipt } from '../hooks/useReceipt'
import '../styles/Receipt.css'

function formatRp(v: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(v)
}

function formatDatetime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'Tunai',
  transfer: 'Transfer',
  mixed: 'Campuran',
}

export function ReceiptPage() {
  const { invoiceNo } = useParams<{ invoiceNo: string }>()
  const { receipt, loading, error } = useReceipt(invoiceNo ?? '')

  if (loading) {
    return (
      <div className="receipt-screen">
        <div className="receipt-state">
          <div className="spinner" />
          <p>Memuat struk...</p>
        </div>
      </div>
    )
  }

  if (error || !receipt) {
    return (
      <div className="receipt-screen">
        <div className="receipt-state">
          <h2>Struk Tidak Ditemukan</h2>
          <p>{error ?? 'Invoice tidak valid.'}</p>
          <Link to="/pos" className="receipt-action-btn ghost">
            ← Kembali ke POS
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="receipt-screen">
      {/* Action Buttons — hidden on print */}
      <div className="receipt-actions">
        <button
          type="button"
          className="receipt-action-btn primary"
          onClick={() => window.print()}
        >
          🖨️ Cetak Struk
        </button>
        <Link to="/pos" className="receipt-action-btn ghost">
          ← Kembali ke POS
        </Link>
      </div>

      {/* Receipt Card */}
      <div className="receipt-card" id="receipt-print-area">

        {/* Store Header */}
        <p className="receipt-store-name">{receipt.store_name}</p>
        {receipt.store_address && (
          <p className="receipt-store-address">{receipt.store_address}</p>
        )}

        <hr className="receipt-divider double" />

        {/* Transaction Meta */}
        <div className="receipt-meta">
          <div className="receipt-meta-row">
            <span className="receipt-meta-label">Invoice</span>
            <span className="receipt-meta-value">{receipt.invoice_no}</span>
          </div>
          <div className="receipt-meta-row">
            <span className="receipt-meta-label">Tanggal</span>
            <span className="receipt-meta-value">{formatDatetime(receipt.created_at)}</span>
          </div>
          <div className="receipt-meta-row">
            <span className="receipt-meta-label">Kasir</span>
            <span className="receipt-meta-value">{receipt.cashier_name}</span>
          </div>
          <div className="receipt-meta-row">
            <span className="receipt-meta-label">Tipe</span>
            <span className="receipt-meta-value">
              {receipt.type === 'wholesale' ? 'Grosir' : 'Ecer'}
            </span>
          </div>
        </div>

        <hr className="receipt-divider" />

        {/* Items */}
        <div className="receipt-items">
          {receipt.items.map((item) => (
            <div key={item.id} className="receipt-item">
              <span className="receipt-item-name">{item.product_name}</span>
              <div className="receipt-item-detail">
                <span className="receipt-item-qty">
                  {item.qty} {item.unit} × {formatRp(item.unit_price)}
                  {item.discount > 0 && ` (disc ${formatRp(item.discount)})`}
                </span>
                <span className="receipt-item-subtotal">{formatRp(item.subtotal)}</span>
              </div>
            </div>
          ))}
        </div>

        <hr className="receipt-divider" />

        {/* Totals */}
        <div className="receipt-totals">
          <div className="receipt-total-row">
            <span>Subtotal ({receipt.items.length} item)</span>
            <span>{formatRp(receipt.subtotal)}</span>
          </div>

          {receipt.discount > 0 && (
            <div className="receipt-total-row discount">
              <span>Diskon</span>
              <span>-{formatRp(receipt.discount)}</span>
            </div>
          )}

          <div className="receipt-total-row grand">
            <span>TOTAL</span>
            <span>{formatRp(receipt.total)}</span>
          </div>

          <div className="receipt-total-row">
            <span>Bayar ({METHOD_LABEL[receipt.payment_method]})</span>
            <span>{formatRp(receipt.cash_paid ?? receipt.total)}</span>
          </div>

          {receipt.change != null && receipt.change > 0 && (
            <div className="receipt-total-row change-row">
              <span>Kembalian</span>
              <span>{formatRp(receipt.change)}</span>
            </div>
          )}
        </div>

        <hr className="receipt-divider" />

        {/* Footer */}
        <p className="receipt-footer">Terima kasih atas kunjungan Anda!</p>
        <p className="receipt-invoice">{receipt.invoice_no}</p>
      </div>
    </div>
  )
}
