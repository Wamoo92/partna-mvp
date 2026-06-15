import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

function formatCardNumber(num) {
  if (!num) return '•••• •••• •••• ••••'
  return num.replace(/(\d{4})(?=\d)/g, '$1 ')
}

function formatExpiry(dateStr) {
  if (!dateStr) return 'MM/YY'
  const d = new Date(dateStr)
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`
}

export default function CardDetail({ customer }) {
  const brand    = useBrand()
  const navigate = useNavigate()
  const [card, setCard]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [flipped, setFlipped] = useState(false)

  useEffect(() => { if (customer) loadCard() }, [customer])

  async function loadCard() {
    setLoading(true)
    const { data } = await supabase
      .from('cards').select('*').eq('customer_id', customer.id)
    if (data && data.length > 0) setCard(data[0])
    setLoading(false)
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner spinner-lg spinner-purple" />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', paddingBottom: 80 }}>

      {/* ── Header ── */}
      <header style={{
        background: 'var(--color-black)',
        borderBottom: 'var(--border)',
        padding: 'var(--space-4) var(--space-5)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
      }}>
        <button
          onClick={() => navigate('/portal/home')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36,
            border: '2px solid rgba(255,255,255,0.25)',
            background: 'transparent',
            color: 'var(--color-white)',
            cursor: 'pointer', flexShrink: 0,
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'}
        >
          <span className="icon-outlined icon-sm">arrow_back</span>
        </button>
        <div style={{ color: 'var(--color-white)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
          My Card
        </div>
      </header>

      {/* ── Card display panel ── */}
      <div style={{
        background: 'var(--color-black)',
        borderBottom: '3px solid var(--color-primary)',
        padding: 'var(--space-8) var(--space-5) var(--space-10)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-4)',
      }}>
        {/* Flippable card */}
        <div
          onClick={() => setFlipped(f => !f)}
          style={{
            perspective: '1000px',
            width: '100%',
            maxWidth: 340,
            height: 210,
            cursor: 'pointer',
          }}
        >
          <div style={{
            width: '100%',
            height: 210,
            position: 'relative',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.6s ease',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}>

            {/* ── FRONT ── */}
            <div style={{
              position: 'absolute', inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              background: 'var(--color-white)',
              border: '3px solid var(--color-black)',
              boxShadow: 'var(--shadow-xl)',
              padding: 'var(--space-5)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              overflow: 'hidden',
            }}>
              {/* Top accent strip */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                height: 6,
                background: 'var(--color-primary)',
              }} />

              {/* Top row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <div style={{
                  fontWeight: 'var(--weight-black)',
                  fontSize: 'var(--text-xs)',
                  letterSpacing: 'var(--tracking-wider)',
                  textTransform: 'uppercase',
                  color: 'var(--color-black)',
                }}>
                  {brand.businessName}
                </div>
                {/* Chip */}
                <div style={{
                  width: 38, height: 28,
                  background: 'linear-gradient(135deg, #EDE5A6, #CFA255)',
                  border: '1.5px solid var(--color-black)',
                }} />
              </div>

              {/* Card number */}
              <div style={{
                fontFamily: 'monospace',
                fontSize: 'var(--text-lg)',
                fontWeight: 'var(--weight-bold)',
                letterSpacing: '0.15em',
                color: 'var(--color-black)',
              }}>
                {formatCardNumber(card?.card_number)}
              </div>

              {/* Bottom row */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                  <div style={{
                    fontSize: 9, fontWeight: 'var(--weight-bold)',
                    letterSpacing: 'var(--tracking-widest)',
                    textTransform: 'uppercase',
                    color: 'var(--color-grey)',
                    marginBottom: 3,
                  }}>
                    Cardholder
                  </div>
                  <div style={{
                    fontWeight: 'var(--weight-black)',
                    fontSize: 'var(--text-sm)',
                    textTransform: 'uppercase',
                    letterSpacing: 'var(--tracking-wide)',
                    color: 'var(--color-black)',
                  }}>
                    {customer?.first_name} {customer?.last_name}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: 9, fontWeight: 'var(--weight-bold)',
                    letterSpacing: 'var(--tracking-widest)',
                    textTransform: 'uppercase',
                    color: 'var(--color-grey)',
                    marginBottom: 3,
                  }}>
                    Expires
                  </div>
                  <div style={{
                    fontFamily: 'monospace',
                    fontWeight: 'var(--weight-bold)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-black)',
                  }}>
                    {formatExpiry(card?.expiry_date)}
                  </div>
                </div>
                {/* Mastercard */}
                <div style={{ display: 'flex' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#EB001B', border: '2px solid var(--color-black)' }} />
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#F79E1B', border: '2px solid var(--color-black)', marginLeft: -10 }} />
                </div>
              </div>

              {/* Tap hint */}
              <div style={{
                position: 'absolute', bottom: 5, left: 0, right: 0,
                textAlign: 'center',
                fontSize: 8,
                fontWeight: 'var(--weight-bold)',
                letterSpacing: 'var(--tracking-widest)',
                textTransform: 'uppercase',
                color: 'var(--color-grey-mid)',
              }}>
                tap to flip
              </div>
            </div>

            {/* ── BACK ── */}
            <div style={{
              position: 'absolute', inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: 'var(--color-black)',
              border: '3px solid var(--color-black)',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
            }}>
              {/* Magnetic stripe */}
              <div style={{ position: 'absolute', top: 32, left: 0, right: 0, height: 44, background: '#1a1a1a' }} />

              {/* Signature + CVV */}
              <div style={{ position: 'absolute', top: 92, left: 20, right: 20, display: 'flex', alignItems: 'center' }}>
                <div style={{
                  flex: 1, height: 36,
                  background: 'repeating-linear-gradient(90deg, #e8e8e8 0, #e8e8e8 4px, #ccc 4px, #ccc 8px)',
                }} />
                <div style={{
                  width: 56, height: 36,
                  background: 'var(--color-white)',
                  border: '2px solid var(--color-black)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'monospace',
                  fontWeight: 'var(--weight-black)',
                  fontSize: 'var(--text-lg)',
                  color: 'var(--color-black)',
                }}>
                  {card?.cvv || '•••'}
                </div>
              </div>

              {/* CVV label */}
              <div style={{
                position: 'absolute', top: 134, right: 20,
                fontSize: 9, fontWeight: 'var(--weight-bold)',
                letterSpacing: 'var(--tracking-widest)',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.3)',
              }}>
                CVV
              </div>

              {/* Card number */}
              <div style={{
                position: 'absolute', bottom: 42, left: 20,
                fontFamily: 'monospace',
                fontSize: 'var(--text-sm)',
                color: 'rgba(255,255,255,0.35)',
                letterSpacing: '0.1em',
              }}>
                {formatCardNumber(card?.card_number)}
              </div>

              {/* Valid thru */}
              <div style={{
                position: 'absolute', bottom: 20, left: 20,
                fontSize: 'var(--text-xs)',
                color: 'rgba(255,255,255,0.3)',
                fontWeight: 'var(--weight-bold)',
              }}>
                Valid thru {formatExpiry(card?.expiry_date)}
              </div>

              {/* Mastercard circles */}
              <div style={{ position: 'absolute', bottom: 18, right: 20, display: 'flex' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#EB001B', border: '2px solid rgba(255,255,255,0.1)', opacity: 0.8 }} />
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#F79E1B', border: '2px solid rgba(255,255,255,0.1)', marginLeft: -10, opacity: 0.8 }} />
              </div>
            </div>
          </div>
        </div>

        {/* Hint */}
        <div style={{
          fontSize: 9,
          fontWeight: 'var(--weight-bold)',
          letterSpacing: 'var(--tracking-widest)',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.25)',
        }}>
          Tap card to flip
        </div>

        {/* Card details strip */}
        {card && (
          <div style={{
            width: '100%',
            maxWidth: 340,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--space-2)',
          }}>
            {[
              { label: 'Card number',  value: formatCardNumber(card.card_number), mono: true },
              { label: 'Expiry',       value: formatExpiry(card.expiry_date),     mono: true },
            ].map((item, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1.5px solid rgba(255,255,255,0.1)',
                padding: 'var(--space-3) var(--space-4)',
              }}>
                <div style={{
                  fontSize: 9,
                  fontWeight: 'var(--weight-bold)',
                  letterSpacing: 'var(--tracking-widest)',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.35)',
                  marginBottom: 4,
                }}>
                  {item.label}
                </div>
                <div style={{
                  fontFamily: item.mono ? 'monospace' : 'inherit',
                  fontWeight: 'var(--weight-bold)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-white)',
                  letterSpacing: item.mono ? '0.08em' : 0,
                }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Action buttons ── */}
      <div style={{
        flex: 1,
        padding: 'var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}>
        <div style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-black)',
          letterSpacing: 'var(--tracking-widest)',
          textTransform: 'uppercase',
          color: 'var(--color-grey)',
          paddingLeft: 'var(--space-1)',
        }}>
          Quick actions
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          {[
            { label: 'Add money', icon: 'add_circle',  accent: 'var(--color-green)',  path: '/portal/add-money' },
            { label: 'Withdraw',  icon: 'south',       accent: 'var(--color-yellow)', path: '/portal/withdraw'  },
          ].map(({ label, icon, accent, path }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-5) var(--space-3)',
                background: 'var(--color-white)',
                border: 'var(--border)',
                boxShadow: 'var(--shadow-sm)',
                cursor: 'pointer',
                transition: 'box-shadow var(--transition-base), transform var(--transition-fast)',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translate(-2px,-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translate(0,0)' }}
              onMouseDown={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translate(3px,3px)' }}
              onMouseUp={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translate(-2px,-2px)' }}
            >
              <div style={{
                width: 44, height: 44,
                background: 'var(--color-black)',
                border: 'var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span className="icon-outlined" style={{ fontSize: 22, color: 'var(--color-white)' }}>
                  {icon}
                </span>
              </div>
              <span style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-black)',
                letterSpacing: 'var(--tracking-wide)',
                textTransform: 'uppercase',
                color: 'var(--color-black)',
              }}>
                {label}
              </span>
            </button>
          ))}
        </div>

        {/* No card state */}
        {!card && (
          <div style={{
            background: 'var(--color-white)',
            border: 'var(--border)',
            boxShadow: 'var(--shadow-sm)',
            padding: 'var(--space-6)',
            textAlign: 'center',
          }}>
            <span className="icon-outlined" style={{ fontSize: 40, color: 'var(--color-grey-mid)', display: 'block', marginBottom: 'var(--space-3)' }}>
              credit_card_off
            </span>
            <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>
              No card issued yet
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
              Your savings card will be issued once your account is verified and you make your first deposit.
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom nav ── */}
      <nav style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        background: 'var(--color-white)',
        borderTop: 'var(--border-thick)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: 'var(--space-2) var(--space-4)',
        zIndex: 'var(--z-sticky)',
      }}>
        {[
          { label: 'Home',    icon: 'home',          path: '/portal/home'         },
          { label: 'Rewards', icon: 'card_giftcard', path: '/portal/rewards'      },
          { label: 'History', icon: 'receipt_long',  path: '/portal/transactions' },
          { label: 'Profile', icon: 'person',        path: '/portal/profile'      },
        ].map(({ label, icon, path }) => {
          const active = false
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 'var(--space-1) var(--space-3)',
              }}>
              <span className="icon-outlined" style={{ fontSize: 22, color: 'var(--color-grey)' }}>
                {icon}
              </span>
              <span style={{
                fontWeight: 'var(--weight-medium)',
                letterSpacing: 'var(--tracking-wide)',
                textTransform: 'uppercase',
                fontSize: 9,
                color: 'var(--color-grey)',
              }}>
                {label}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}