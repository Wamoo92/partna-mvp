import { useNavigate } from 'react-router-dom'
import { useBrand } from '../../lib/BrandContext'

export default function Landing() {
  const brand = useBrand()
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <header style={{
        background: 'var(--color-black)',
        borderBottom: 'var(--border)',
        padding: 'var(--space-4) var(--space-5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {brand.logoUrl && (
            <div style={{
              width: 40,
              height: 40,
              border: '2px solid var(--color-primary)',
              background: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <img
                src={brand.logoUrl}
                alt={brand.businessName}
                style={{ width: 28, height: 28, objectFit: 'contain' }}
              />
            </div>
          )}
          <div>
            <div style={{
              color: 'var(--color-white)',
              fontWeight: 'var(--weight-black)',
              fontSize: 'var(--text-base)',
              letterSpacing: 'var(--tracking-tight)',
              fontVariationSettings: "'wdth' 105, 'opsz' 16",
            }}>
              {brand.businessName}
            </div>
            <div style={{
              color: 'var(--color-primary)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-bold)',
              letterSpacing: 'var(--tracking-widest)',
              textTransform: 'uppercase',
            }}>
              Powered by Partna
            </div>
          </div>
        </div>
      </header>

      {/* ── Hero section ── */}
      <div style={{
        background: 'var(--color-black)',
        padding: 'var(--space-8) var(--space-5) var(--space-10)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-6)',
        borderBottom: '3px solid var(--color-primary)',
      }}>

        {/* Eyebrow */}
        <div style={{
          background: 'var(--color-primary)',
          border: 'var(--border)',
          padding: '4px var(--space-4)',
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-black)',
          letterSpacing: 'var(--tracking-widest)',
          textTransform: 'uppercase',
          color: 'var(--color-black)',
          alignSelf: 'center',
        }}>
          Savings Program
        </div>

        {/* Headline */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            color: 'var(--color-white)',
            fontSize: 'var(--text-3xl)',
            fontWeight: 'var(--weight-black)',
            lineHeight: 'var(--leading-tight)',
            letterSpacing: 'var(--tracking-tight)',
            fontVariationSettings: "'wdth' 110, 'opsz' 36",
            marginBottom: 'var(--space-3)',
          }}>
            Save smarter.<br />Earn rewards.
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.65)',
            fontSize: 'var(--text-sm)',
            lineHeight: 'var(--leading-normal)',
            maxWidth: 280,
            margin: '0 auto',
          }}>
            {brand.tagline || 'Join the savings program and start earning rewards on every purchase.'}
          </p>
        </div>

        {/* Card visual — neobrutalism style */}
        <div style={{
          width: '100%',
          maxWidth: 320,
          background: 'var(--color-primary)',
          border: '3px solid var(--color-white)',
          boxShadow: '8px 8px 0px 0px rgba(255,255,255,0.2)',
          padding: 'var(--space-5)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Card noise texture strip */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: 'var(--color-black)',
          }} />

          {/* Top row — logo + chip */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-6)',
            marginTop: 'var(--space-2)',
          }}>
            <div style={{
              fontWeight: 'var(--weight-black)',
              fontSize: 'var(--text-sm)',
              color: 'var(--color-black)',
              letterSpacing: 'var(--tracking-tight)',
              fontVariationSettings: "'wdth' 105, 'opsz' 14",
            }}>
              {brand.businessName}
            </div>
            {/* Chip */}
            <div style={{
              width: 32,
              height: 24,
              background: 'linear-gradient(135deg, #EDE5A6, #CFA255)',
              border: '1.5px solid rgba(0,0,0,0.3)',
            }} />
          </div>

          {/* Card number */}
          <div style={{
            fontFamily: 'monospace',
            fontSize: 'var(--text-base)',
            fontWeight: 'var(--weight-bold)',
            color: 'var(--color-black)',
            letterSpacing: '0.15em',
            marginBottom: 'var(--space-5)',
          }}>
            •••• •••• •••• ••••
          </div>

          {/* Bottom row */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-bold)',
                letterSpacing: 'var(--tracking-widest)',
                textTransform: 'uppercase',
                color: 'rgba(0,0,0,0.5)',
                marginBottom: 2,
              }}>
                Cardholder
              </div>
              <div style={{
                fontWeight: 'var(--weight-black)',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-black)',
                fontVariationSettings: "'wdth' 100, 'opsz' 14",
              }}>
                YOUR NAME
              </div>
            </div>
            {/* Mastercard circles */}
            <div style={{ display: 'flex' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: '#EB001B', border: '2px solid var(--color-black)',
              }} />
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: '#F79E1B', border: '2px solid var(--color-black)',
                marginLeft: -10,
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Action section ── */}
      <div style={{
        flex: 1,
        padding: 'var(--space-6) var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}>

        {/* Value props */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
        }}>
          {[
            { icon: 'savings',      label: 'Save automatically with every purchase' },
            { icon: 'card_giftcard', label: 'Earn rewards and cashback' },
            { icon: 'security',     label: 'Protected and secure payments' },
          ].map(({ icon, label }) => (
            <div key={icon} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--color-white)',
              border: 'var(--border)',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <span className="icon-outlined" style={{
                fontSize: 20,
                color: 'var(--color-primary)',
                background: 'var(--color-black)',
                padding: 4,
                flexShrink: 0,
              }}>
                {icon}
              </span>
              <span style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--color-black)',
              }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* CTA buttons */}
        <button
          onClick={() => navigate('/portal/register')}
          className="btn btn-primary btn-full btn-lg"
        >
          <span className="icon-outlined icon-sm">person_add</span>
          Create account
        </button>

        <button
          onClick={() => navigate('/portal/login')}
          className="btn btn-secondary btn-full btn-lg"
        >
          <span className="icon-outlined icon-sm">login</span>
          Log in
        </button>
      </div>

      {/* ── Footer ── */}
      <footer style={{
        padding: 'var(--space-4) var(--space-5)',
        borderTop: '1.5px solid var(--color-grey-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-2)',
      }}>
        <img src="/partna-icon.svg" alt="Partna" style={{ width: 18, height: 18, opacity: 0.4 }} />
        <span style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-bold)',
          letterSpacing: 'var(--tracking-wider)',
          textTransform: 'uppercase',
          color: 'var(--color-grey)',
        }}>
          Powered by Partna
        </span>
      </footer>

    </div>
  )
}