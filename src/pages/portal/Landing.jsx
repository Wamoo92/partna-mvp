import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

// ── Detect current subdomain slug ─────────────────────────────────────────
function getSubdomainSlug() {
  const hostname = window.location.hostname
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === 'www.partna.io' ||
    hostname === 'partna.io'
  ) return null
  if (hostname.endsWith('.partna.io')) return hostname.split('.')[0]
  return null
}

function scrollTo(ref) {
  ref?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function Landing() {
  useEffect(() => { document.title = 'Welcome - Partna' }, [])

  const brand    = useBrand()
  const navigate = useNavigate()

  const [heroImage, setHeroImage]   = useState(null)
  const [menuOpen, setMenuOpen]     = useState(false)
  const [activeStep, setActiveStep] = useState(0)

  const howItWorksRef = useRef(null)
  const benefitsRef   = useRef(null)

  useEffect(() => {
    async function fetchHero() {
      const slug = getSubdomainSlug()
      if (!slug) return
      const { data } = await supabase
        .from('businesses')
        .select('hero_image_url')
        .eq('slug', slug)
        .maybeSingle()
      if (data?.hero_image_url) setHeroImage(data.hero_image_url)
    }
    fetchHero()
  }, [])

  const steps = [
    {
      num: 1,
      title: 'Register with your name, phone number and NIN.',
      desc:  'Create your account in minutes. We verify your identity securely using your National ID.',
    },
    {
      num: 2,
      title: 'Select a term and add a student.',
      desc:  'Choose the fee term you are saving toward and link the student you are paying for.',
    },
    {
      num: 3,
      title: 'Deposit, pay your fees in full or in parts, and earn card cashback rewards.',
      desc:  'Add funds to your wallet, make full or partial payments anytime, and earn cashback when you spend with partner merchants.',
    },
  ]

  const vps = [
    {
      heading: 'Save smarter',
      body: "Deposit money toward school fees whenever you're ready, at your own pace.",
    },
    {
      heading: 'Pay direct',
      body: 'Use your savings balance to pay fees straight to the school with one tap.',
    },
    {
      heading: 'Earn rewards',
      body: 'Earn cashback every time you use your card at our select partner merchants.',
    },
  ]

  const benefits = [
    {
      heading: 'Track your progress',
      body: 'Stay on top of your savings with a clear progress tracker. See how close you are to your fee target, track every deposit and payment, and unlock cashback tiers as you hit each milestone.',
      link: 'View your progress',
    },
    {
      heading: 'Flexible, partial payments',
      body: 'You do not have to pay all your fees at once. Make deposits and partial payments at any time, at your own pace. Withdraw your balance whenever you need to.',
      link: 'How payments work',
    },
    {
      heading: 'Clear fees, always upfront',
      body: 'Deposits are always free. A small fee applies to payments, always shown before you confirm. You will never be charged anything you did not expect.',
      link: 'More about fees',
    },
  ]

  const year = new Date().getFullYear()

  // ── Shared tokens — strict Sellin kit ────────────────────────────────
  const C = {
    bg:        '#F6F7EE',
    white:     '#FFFFFF',
    black:     '#111111',
    secondary: '#959687',
    stroke:    '#D7D8CB',
    grayLine:  '#D5D9DD',
    grayMid:   '#898B90',
    grayLight: '#ECECEC',
    accent:    '#ECEDE1',
    labelBg:   '#E4E5DD',
  }

  const btn = (variant = 'primary') => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: 'Inter, system-ui, sans-serif',
    borderRadius: 10,
    cursor: 'pointer',
    border: variant === 'primary' ? `1px solid ${C.black}` : `1px solid ${C.grayLine}`,
    background: variant === 'primary' ? C.black : C.white,
    color: variant === 'primary' ? C.white : C.black,
    transition: 'opacity 0.15s',
  })

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'Inter, system-ui, sans-serif', color: C.black }}>

      {/* ── Topbar ── */}
      <header style={{
        background: C.white,
        borderBottom: `1px solid ${C.stroke}`,
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          padding: '0 24px', height: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {brand.logoUrl
              ? <img src={brand.logoUrl} alt={brand.businessName} style={{ height: 26, width: 'auto' }} />
              : <span style={{ fontSize: 18, fontWeight: 600, color: C.black, letterSpacing: '-1px' }}>{brand.businessName}</span>
            }
          </div>

          {/* Desktop nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} className="desktop-nav">
            <button
              onClick={() => navigate('/portal/login')}
              style={btn('secondary')}
              onMouseEnter={e => e.currentTarget.style.background = C.accent}
              onMouseLeave={e => e.currentTarget.style.background = C.white}
            >
              Log in
            </button>
            <button
              onClick={() => navigate('/portal/register')}
              style={btn('primary')}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Sign up
            </button>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMenuOpen(o => !o)}
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            aria-label="Menu"
          >
            <div style={{ width: 20, height: 2, background: C.black, marginBottom: 4, borderRadius: 2 }} />
            <div style={{ width: 20, height: 2, background: C.black, marginBottom: 4, borderRadius: 2 }} />
            <div style={{ width: 20, height: 2, background: C.black, borderRadius: 2 }} />
          </button>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div style={{
            borderTop: `1px solid ${C.stroke}`,
            padding: '16px 24px',
            display: 'flex', flexDirection: 'column', gap: 10,
            background: C.white,
          }}>
            <button
              onClick={() => { navigate('/portal/login'); setMenuOpen(false) }}
              style={{ ...btn('secondary'), width: '100%' }}
            >
              Log in
            </button>
            <button
              onClick={() => { navigate('/portal/register'); setMenuOpen(false) }}
              style={{ ...btn('primary'), width: '100%' }}
            >
              Sign up
            </button>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section style={{
        background: heroImage
          ? `url(${heroImage}) center/cover no-repeat`
          : C.accent,
        borderBottom: `1px solid ${C.stroke}`,
        position: 'relative',
      }}>
        {heroImage && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(17,17,17,0.48)' }} />
        )}
        <div style={{
          position: 'relative',
          maxWidth: 1200, margin: '0 auto',
          padding: 'clamp(64px, 10vw, 120px) 24px',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', textAlign: 'center', gap: 24,
        }}>
          <h1 style={{
            fontSize: 'clamp(32px, 5vw, 48px)',
            fontWeight: 600,
            letterSpacing: '-1px',
            lineHeight: '130%',
            color: heroImage ? C.white : C.black,
            maxWidth: 600, margin: 0,
          }}>
            The easier way to save and pay school fees.
          </h1>
          <p style={{
            fontSize: 16,
            fontWeight: 500,
            color: heroImage ? 'rgba(255,255,255,0.80)' : C.secondary,
            lineHeight: '140%',
            maxWidth: 460, margin: 0,
          }}>
            Save toward fees at your own pace, pay direct, and earn cashback rewards on every purchase.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => navigate('/portal/register')}
              style={{
                ...btn('primary'),
                padding: '12px 28px', fontSize: 15,
                background: heroImage ? C.white : C.black,
                color: heroImage ? C.black : C.white,
                border: heroImage ? `1px solid ${C.white}` : `1px solid ${C.black}`,
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Get started
            </button>
            <button
              onClick={() => scrollTo(howItWorksRef)}
              style={{
                ...btn('secondary'),
                padding: '12px 28px', fontSize: 15,
                background: 'transparent',
                color: heroImage ? C.white : C.black,
                border: heroImage ? '1px solid rgba(255,255,255,0.4)' : `1px solid ${C.grayLine}`,
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              How it works
            </button>
          </div>
        </div>
      </section>

      {/* ── VALUE PROPOSITIONS ── */}
      <section style={{ padding: 'clamp(48px, 8vw, 80px) 24px', background: C.white, borderBottom: `1px solid ${C.stroke}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>

          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontSize: 'clamp(20px, 3vw, 32px)', fontWeight: 600, color: C.black, letterSpacing: '-1px', lineHeight: '130%', margin: '0 0 10px' }}>
              Three ways we make paying school fees work for you.
            </h2>
            <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0 }}>
              Simple, transparent, rewarding.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
          }}>
            {vps.map((vp, i) => (
              <div key={i} style={{
                background: C.white,
                border: `1px solid ${C.stroke}`,
                borderRadius: 12,
                padding: '24px 20px',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                {/* Icon */}
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: C.labelBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {i === 0 && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <ellipse cx="12" cy="13" rx="8" ry="6" />
                      <path d="M16 9.5C16 7 14.2 5 12 5s-4 2-4 4.5" />
                      <path d="M20 13h1.5a.5.5 0 0 0 0-1H20" />
                      <path d="M12 5V3" />
                      <path d="M10 19l-1 2m5-2 1 2" />
                      <circle cx="9.5" cy="12" r="1" fill="#111111" stroke="none" />
                    </svg>
                  )}
                  {i === 1 && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 2L11 13" />
                      <path d="M22 2L15 22l-4-9-9-4 20-7z" />
                    </svg>
                  )}
                  {i === 2 && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 12v10H4V12" />
                      <path d="M22 7H2v5h20V7z" />
                      <path d="M12 22V7" />
                      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
                    </svg>
                  )}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: C.black, margin: 0, letterSpacing: '-0.5px' }}>
                  {vp.heading}
                </h3>
                <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, lineHeight: '140%', margin: 0 }}>
                  {vp.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section ref={howItWorksRef} style={{ padding: 'clamp(48px, 8vw, 80px) 24px', background: C.bg, borderBottom: `1px solid ${C.stroke}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>

          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontSize: 'clamp(20px, 3vw, 32px)', fontWeight: 600, color: C.black, letterSpacing: '-1px', lineHeight: '130%', margin: '0 0 10px' }}>
              Getting started is quick and simple.
            </h2>
            <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0 }}>
              Three steps and you're saving.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 40, alignItems: 'start',
          }}>
            {/* Steps list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {steps.map((s, i) => (
                <div
                  key={i}
                  onClick={() => setActiveStep(i)}
                  style={{
                    display: 'flex', gap: 14, alignItems: 'flex-start',
                    padding: '16px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    background: activeStep === i ? C.white : 'transparent',
                    border: activeStep === i ? `1px solid ${C.stroke}` : '1px solid transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: activeStep === i ? C.black : C.labelBg,
                    color: activeStep === i ? C.white : C.grayMid,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 600,
                    transition: 'all 0.2s',
                  }}>
                    {s.num}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{
                      margin: 0, fontSize: 14, fontWeight: 600, color: C.black,
                      lineHeight: '130%',
                      opacity: activeStep === i ? 1 : 0.45,
                    }}>
                      {s.title}
                    </p>
                    {activeStep === i && (
                      <p style={{ margin: '8px 0 0', fontSize: 13, fontWeight: 500, color: C.secondary, lineHeight: '140%' }}>
                        {s.desc}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              <div style={{ padding: '4px 16px 0' }}>
                <button
                  onClick={() => navigate('/portal/register')}
                  style={{ ...btn('primary'), marginTop: 8 }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  Get started
                </button>
              </div>
            </div>

            {/* Phone mockup placeholder */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
              <div style={{
                width: 200, height: 400,
                background: C.accent,
                border: `1px solid ${C.stroke}`,
                borderRadius: 20,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 12,
              }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#898B90" strokeWidth="1.5">
                    <rect x="5" y="2" width="14" height="20" rx="2" />
                    <circle cx="12" cy="18" r="1" fill="#898B90" stroke="none" />
                  </svg>
                </div>
                <p style={{ fontSize: 11, fontWeight: 500, color: C.grayMid, textAlign: 'center', padding: '0 24px', lineHeight: '140%', margin: 0 }}>
                  App screenshot
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BENEFITS ── */}
      <section ref={benefitsRef} style={{ padding: 'clamp(48px, 8vw, 80px) 24px', background: C.white, borderBottom: `1px solid ${C.stroke}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>

          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontSize: 'clamp(20px, 3vw, 32px)', fontWeight: 600, color: C.black, letterSpacing: '-1px', lineHeight: '130%', margin: '0 0 10px' }}>
              Join families saving smarter across Uganda.
            </h2>
            <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0 }}>
              Everything you need to manage school fees in one place.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
          }}>
            {benefits.map((b, i) => (
              <div key={i} style={{
                background: C.bg,
                border: `1px solid ${C.stroke}`,
                borderRadius: 12,
                padding: '24px 20px',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: C.black, margin: 0, letterSpacing: '-0.5px' }}>
                  {b.heading}
                </h3>
                <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, lineHeight: '140%', margin: 0, flex: 1 }}>
                  {b.body}
                </p>
                <button
                  onClick={() => scrollTo(howItWorksRef)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600, color: C.black,
                    padding: 0, textAlign: 'left',
                    textDecoration: 'underline', textUnderlineOffset: 3,
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                >
                  {b.link}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        padding: 'clamp(64px, 10vw, 100px) 24px',
        background: C.bg,
        textAlign: 'center',
        borderBottom: `1px solid ${C.stroke}`,
      }}>
        <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          <h2 style={{
            fontSize: 'clamp(22px, 4vw, 40px)',
            fontWeight: 600, letterSpacing: '-1px', lineHeight: '130%',
            color: C.black, margin: 0,
          }}>
            Sign up and get started today.
          </h2>
          <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '140%' }}>
            Free to sign up. No hidden fees. Cancel anytime.
          </p>
          <button
            onClick={() => navigate('/portal/register')}
            style={{ ...btn('primary'), padding: '13px 32px', fontSize: 15 }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Create your account
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: C.white, borderTop: `1px solid ${C.stroke}`, padding: '36px 24px 28px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>

          <div style={{
            display: 'flex', flexWrap: 'wrap',
            justifyContent: 'space-between', alignItems: 'flex-start',
            gap: 24, marginBottom: 28,
          }}>
            {/* Logo */}
            <div>
              {brand.logoUrl
                ? <img src={brand.logoUrl} alt={brand.businessName} style={{ height: 22, width: 'auto', marginBottom: 12 }} />
                : <span style={{ fontSize: 16, fontWeight: 600, color: C.black, letterSpacing: '-1px', display: 'block', marginBottom: 12 }}>{brand.businessName}</span>
              }
              <p style={{ fontSize: 12, fontWeight: 500, color: C.grayMid, margin: 0 }}>
                The easier way to save and pay school fees.
              </p>
            </div>

            {/* Links */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 24px' }}>
              {['Help and Contact', 'Fees', 'Security', 'Privacy', 'Legal', 'About Partna'].map(link => (
                <a key={link} href="#"
                  style={{ fontSize: 13, fontWeight: 500, color: C.grayMid, textDecoration: 'none' }}
                  onMouseEnter={e => e.currentTarget.style.color = C.black}
                  onMouseLeave={e => e.currentTarget.style.color = C.grayMid}
                >
                  {link}
                </a>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: `1px solid ${C.grayLine}`, marginBottom: 20 }} />

          {/* Legal */}
          <p style={{ fontSize: 12, fontWeight: 500, color: C.grayMid, lineHeight: '170%', marginBottom: 12, maxWidth: 860 }}>
            Partna is a product of Wamoo Innovations - SMC Limited. An application for a Payment Service Provider licence has been submitted to the Bank of Uganda. While this application is being processed, Partna continues to operate in a sandbox environment and to provide savings and fee payment services to users.
          </p>

          <p style={{ fontSize: 12, fontWeight: 500, color: C.grayMid, margin: 0 }}>
            © {year} {brand.businessName}. Powered by Partna.
          </p>

        </div>
      </footer>

      {/* ── Responsive ── */}
      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: block !important; }
        }
        @media (min-width: 769px) {
          .mobile-menu-btn { display: none !important; }
        }
      `}</style>

    </div>
  )
}