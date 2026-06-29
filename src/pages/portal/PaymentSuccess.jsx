import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useBrand } from '../../lib/BrandContext'

function formatUGX(n) {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

const C = {
  bg:       '#F6F7EE',
  white:    '#FFFFFF',
  black:    '#111111',
  labelBg:  '#E4E5DD',
  stroke:   '#D7D8CB',
  grayLine: '#D5D9DD',
  secondary:'#959687',
  grayMid:  '#898B90',
  green:    '#59886D',
  bgGreen:  '#E4F8EC',
}

export default function PaymentSuccess() {
  useEffect(() => { document.title = 'Payment Complete - Partna' }, [])

  const brand    = useBrand()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const reference    = params.get('reference')
  const amount       = params.get('amount')
  const enrollmentId = params.get('enrollmentId') || null

  // Validate the amount from the URL — never render "UGX NaN" if it's missing or malformed.
  const amountNum      = Number(amount)
  const hasValidAmount = amount != null && amount.trim() !== '' && !isNaN(amountNum)

  const btnPrimary = {
    width: '100%', padding: '11px 18px',
    fontSize: 14, fontWeight: 600,
    color: C.white, background: C.black,
    border: `1px solid ${C.black}`, borderRadius: 10,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontFamily: 'Inter, system-ui, sans-serif',
  }

  const btnSecondary = {
    width: '100%', padding: '11px 18px',
    fontSize: 14, fontWeight: 600,
    color: C.black, background: C.white,
    border: `1px solid ${C.grayLine}`, borderRadius: 10,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontFamily: 'Inter, system-ui, sans-serif',
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Topbar ── */}
      <header style={{
        background: C.white, borderBottom: `1px solid ${C.stroke}`,
        padding: '14px 20px',
        display: 'flex', alignItems: 'center',
      }}>
        {brand.logoUrl
          ? <img src={brand.logoUrl} alt={brand.businessName} style={{ height: 26, width: 'auto' }} />
          : <span style={{ fontSize: 18, fontWeight: 600, color: C.black, letterSpacing: '-1px' }}>{brand.businessName}</span>
        }
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 20px' }}>
        <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Success card ── */}
          <div style={{
            background: C.white, border: `1px solid ${C.stroke}`,
            borderRadius: 12, padding: '32px 24px',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            textAlign: 'center', gap: 12,
          }}>
            {/* Check circle */}
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              background: C.green,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>

            <h1 style={{ fontSize: 24, fontWeight: 600, color: C.black, letterSpacing: '-1px', margin: 0 }}>
              Payment received
            </h1>
            <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0 }}>
              Your savings balance has been updated.
            </p>

            {/* Reference pill */}
            {reference && (
              <div style={{
                background: C.labelBg, borderRadius: 8,
                padding: '6px 16px',
                fontFamily: 'monospace', fontWeight: 600,
                fontSize: 13, letterSpacing: '0.08em', color: C.black,
              }}>
                {reference}
              </div>
            )}

            {/* Amount — only render when it parses to a valid number */}
            {hasValidAmount ? (
              <div style={{ marginTop: 4 }}>
                <p style={{ fontSize: 11, fontWeight: 500, color: C.secondary, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Amount deposited
                </p>
                <p style={{ fontSize: 32, fontWeight: 600, color: C.green, letterSpacing: '-1px', margin: 0 }}>
                  {formatUGX(amountNum)}
                </p>
              </div>
            ) : (
              <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: '4px 0 0' }}>
                Your deposit was received. Check your transactions for the exact amount.
              </p>
            )}
          </div>

          {/* ── Actions ── */}
          <button
            style={btnPrimary}
            onClick={() => navigate('/portal/home', { state: { enrollmentId } })}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Back to home
          </button>

          <button
            style={btnSecondary}
            onClick={() => navigate('/portal/transactions', { state: { enrollmentId } })}
            onMouseEnter={e => e.currentTarget.style.background = '#ECEDE1'}
            onMouseLeave={e => e.currentTarget.style.background = C.white}
          >
            View transactions
          </button>

        </div>
      </div>

      {/* ── Footer ── */}
      <footer style={{ padding: '16px 20px', borderTop: `1px solid ${C.grayLine}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: C.grayMid }}>Powered by Partna</span>
      </footer>

    </div>
  )
}