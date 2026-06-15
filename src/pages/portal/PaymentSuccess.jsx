import { useNavigate, useSearchParams } from 'react-router-dom'

function formatUGX(n) {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

export default function PaymentSuccess() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const reference    = params.get('reference')
  const amount       = params.get('amount')
  const enrollmentId = params.get('enrollmentId') || null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>

      <header style={{
        background: 'var(--color-black)', borderBottom: 'var(--border)',
        padding: 'var(--space-4) var(--space-5)',
      }}>
        <div style={{ color: 'var(--color-white)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
          Payment confirmed
        </div>
      </header>

      <div style={{
        background: 'var(--color-black)',
        borderBottom: '3px solid var(--color-green)',
        padding: 'var(--space-8) var(--space-5)',
        textAlign: 'center',
      }}>
        <div style={{
          width: 64, height: 64,
          background: 'var(--color-green)',
          border: '3px solid var(--color-white)',
          boxShadow: 'var(--shadow-md)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto var(--space-4)',
        }}>
          <span className="icon-outlined" style={{ fontSize: 32, color: 'var(--color-black)' }}>check</span>
        </div>
        <h1 style={{
          color: 'var(--color-white)', fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--weight-black)', letterSpacing: 'var(--tracking-tight)',
          marginBottom: 'var(--space-2)',
        }}>
          Payment received
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'var(--text-sm)' }}>
          Your savings balance has been updated
        </p>
        {reference && (
          <div style={{
            display: 'inline-block', marginTop: 'var(--space-3)',
            background: 'var(--color-primary)', border: 'var(--border)',
            padding: '4px var(--space-4)',
            fontFamily: 'monospace', fontWeight: 'var(--weight-black)',
            fontSize: 'var(--text-sm)', letterSpacing: '0.1em', color: 'var(--color-black)',
          }}>
            {reference}
          </div>
        )}
      </div>

      <div style={{ flex: 1, padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

        {amount && (
          <div style={{
            background: 'var(--color-white)', border: 'var(--border)',
            padding: 'var(--space-5)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 'var(--space-2)' }}>
              Amount deposited
            </div>
            <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-black)', color: '#2D8B45', letterSpacing: 'var(--tracking-tight)' }}>
              {formatUGX(amount)}
            </div>
          </div>
        )}

        <button
          onClick={() => navigate('/portal/home', { state: { enrollmentId } })}
          className="btn btn-black btn-full btn-lg"
        >
          <span className="icon-outlined icon-sm">home</span>
          Back to home
        </button>

        <button
          onClick={() => navigate('/portal/transactions', { state: { enrollmentId } })}
          className="btn btn-secondary btn-full"
        >
          <span className="icon-outlined icon-sm">receipt_long</span>
          View transactions
        </button>
      </div>
    </div>
  )
}