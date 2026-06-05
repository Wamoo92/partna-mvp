import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { brand } from '../../lib/brandConfig'

export default function CardDetail({ customer }) {
  const navigate = useNavigate()
  const [card, setCard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    if (customer) loadCard()
  }, [customer])

  async function loadCard() {
    setLoading(true)
    const { data } = await supabase
      .from('cards').select('*')
      .eq('customer_id', customer.id)
    if (data && data.length > 0) setCard(data[0])
    setLoading(false)
  }

  function formatCardNumber(num) {
    if (!num) return '•••• •••• •••• ••••'
    return num.replace(/(\d{4})(?=\d)/g, '$1 ')
  }

  function formatExpiry(dateStr) {
    if (!dateStr) return 'MM/YY'
    const d = new Date(dateStr)
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f0f2f5' }}>
      <div className="w-8 h-8 border-4 rounded-full animate-spin"
        style={{ borderColor: brand.primaryColor, borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f0f2f5' }}>

      {/* Header */}
      <header className="flex items-center px-4 py-3 gap-3" style={{ background: brand.primaryColor }}>
        <button onClick={() => navigate('/portal/home')} className="text-white text-xl">&#8592;</button>
        <div className="flex items-center gap-2">
          <img src={brand.logoUrl} alt="" className="w-8 h-8 object-contain" style={{ mixBlendMode: 'screen' }} />
          <div className="text-white text-xs font-semibold">My Card</div>
        </div>
      </header>

      {/* Card section */}
      <div className="flex flex-col items-center px-5 pt-8 pb-10" style={{ background: brand.primaryColor }}>

        {/* Flippable card */}
        <div
          className="cursor-pointer w-full max-w-sm"
          style={{ perspective: '1000px', height: '200px' }}
          onClick={() => setFlipped(!flipped)}
        >
          <div style={{
            width: '100%', height: '200px',
            position: 'relative',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.6s ease',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}>

            {/* Front */}
            <div className="rounded-2xl absolute inset-0 overflow-hidden"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                background: brand.primaryColor,
                border: `2px solid ${brand.secondaryColor}`,
              }}>
              <div className="absolute inset-0"
                style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.2) 0%, transparent 60%)' }} />

              {/* Logo top-left */}
              <div className="absolute top-4 left-4">
                <img src={brand.logoUrl} alt="" className="object-contain"
                  style={{ width: '40px', height: '40px', mixBlendMode: 'screen' }} />
              </div>

              {/* Mastercard top-right */}
              <div className="absolute top-4 right-4 flex">
                <div className="w-8 h-8 rounded-full opacity-90" style={{ background: '#EB001B' }} />
                <div className="w-8 h-8 rounded-full opacity-90 -ml-3" style={{ background: '#F79E1B' }} />
              </div>

              {/* Chip */}
              <div className="absolute rounded"
                style={{
                  width: '44px', height: '32px',
                  top: '72px', left: '20px',
                  background: 'linear-gradient(135deg,#EDE5A6,#CFA255)',
                }} />

              {/* Card number */}
              <div className="absolute font-mono font-semibold"
                style={{
                  bottom: '52px', left: '20px', right: '20px',
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: '16px',
                  letterSpacing: '2px',
                }}>
                {formatCardNumber(card?.card_number)}
              </div>

              {/* Name + expiry */}
              <div className="absolute flex justify-between items-end"
                style={{ bottom: '20px', left: '20px', right: '20px' }}>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '9px', marginBottom: '2px' }}>CARD HOLDER</div>
                  <div className="font-semibold uppercase tracking-wide"
                    style={{ color: 'rgba(255,255,255,0.9)', fontSize: '12px' }}>
                    {customer?.first_name} {customer?.last_name}
                  </div>
                </div>
                <div className="text-right">
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '9px', marginBottom: '2px' }}>EXPIRES</div>
                  <div className="font-mono font-semibold"
                    style={{ color: 'rgba(255,255,255,0.9)', fontSize: '12px' }}>
                    {formatExpiry(card?.expiry_date)}
                  </div>
                </div>
              </div>

              {/* Tap hint */}
              <div className="absolute bottom-1 left-0 right-0 text-center"
                style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px' }}>
                tap to flip
              </div>
            </div>

            {/* Back */}
            <div className="rounded-2xl absolute inset-0 overflow-hidden"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                background: '#0f2d40',
                border: `2px solid ${brand.secondaryColor}`,
              }}>

              {/* Magnetic stripe */}
              <div className="absolute w-full" style={{ height: '44px', top: '30px', background: '#111' }} />

              {/* Signature strip + CVV */}
              <div className="absolute flex items-center"
                style={{ top: '92px', left: '20px', right: '20px' }}>
                <div className="flex-1 rounded-l"
                  style={{
                    height: '36px',
                    background: 'repeating-linear-gradient(90deg, #e8e8e8 0px, #e8e8e8 4px, #ccc 4px, #ccc 8px)'
                  }} />
                <div className="rounded-r flex items-center justify-center font-mono font-bold"
                  style={{ width: '56px', height: '36px', background: '#fff', color: '#333', fontSize: '16px' }}>
                  {card?.cvv || '•••'}
                </div>
              </div>
              <div className="absolute text-right"
                style={{ top: '132px', right: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>
                CVV
              </div>

              {/* Card number on back */}
              <div className="absolute font-mono"
                style={{
                  bottom: '36px', left: '20px',
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: '12px', letterSpacing: '1px',
                }}>
                {formatCardNumber(card?.card_number)}
              </div>

              {/* Expiry on back */}
              <div className="absolute"
                style={{ bottom: '18px', left: '20px', color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>
                Valid thru {formatExpiry(card?.expiry_date)}
              </div>

              {/* Mastercard bottom-right */}
              <div className="absolute bottom-5 right-4 flex">
                <div className="w-7 h-7 rounded-full opacity-70" style={{ background: '#EB001B' }} />
                <div className="w-7 h-7 rounded-full opacity-70 -ml-2" style={{ background: '#F79E1B' }} />
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs mt-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Tap card to flip
        </p>
      </div>

      {/* Buttons */}
      <div
        className="rounded-t-3xl flex-1 flex flex-col justify-start px-5 py-6 gap-3"
        style={{ background: '#f0f2f5', marginTop: '-16px' }}
      >
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/portal/add-money')}
            className="flex flex-col items-center gap-2 py-5 rounded-2xl"
            style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.1)' }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-light"
              style={{ background: 'rgba(27,79,114,0.1)', color: brand.primaryColor }}
            >
              +
            </div>
            <span className="text-xs font-semibold" style={{ color: brand.primaryColor }}>Add Money</span>
          </button>

          <button
            onClick={() => navigate('/portal/withdraw')}
            className="flex flex-col items-center gap-2 py-5 rounded-2xl"
            style={{ background: '#fff', border: '1.5px solid rgba(27,79,114,0.1)' }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
              style={{ background: 'rgba(27,79,114,0.1)', color: brand.primaryColor }}
            >
              ↓
            </div>
            <span className="text-xs font-semibold" style={{ color: brand.primaryColor }}>Withdraw</span>
          </button>
        </div>
      </div>

      {/* Bottom nav */}
      <nav className="flex items-center justify-around px-4 py-3 border-t"
        style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.08)' }}>
        {[
          { label: 'Home', icon: '⌂', path: '/portal/home' },
          { label: 'Rewards', icon: '★', path: '/portal/rewards' },
          { label: 'History', icon: '↕', path: '/portal/transactions' },
          { label: 'Profile', icon: '◎', path: '/portal/profile' },
        ].map(item => (
          <button key={item.path} onClick={() => navigate(item.path)} className="flex flex-col items-center gap-1">
            <span className="text-lg leading-none" style={{ color: 'rgba(0,0,0,0.3)' }}>
              {item.icon}
            </span>
            <span className="text-xs" style={{ color: 'rgba(0,0,0,0.3)' }}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>

    </div>
  )
}