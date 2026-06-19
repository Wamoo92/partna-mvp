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

// ── Smooth scroll helper ──────────────────────────────────────────────────
function scrollTo(ref) {
  ref?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function Landing() {
  const brand    = useBrand()
  const navigate = useNavigate()

  const [heroImage, setHeroImage]   = useState(null)
  const [menuOpen, setMenuOpen]     = useState(false)
  const [activeStep, setActiveStep] = useState(0)

  // Section refs for anchor scrolling
  const howItWorksRef = useRef(null)
  const benefitsRef   = useRef(null)

  // Primary and secondary colours from brand context
  const primary   = brand.primaryColor   || '#1B4F72'
  const secondary = brand.secondaryColor || '#D4AF37'

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

  // ── How it works steps ───────────────────────────────────────────────
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

  // ── Value propositions ───────────────────────────────────────────────
  const vps = [
    {
      icon: 'savings',
      heading: 'Save smarter',
      body: "Deposit money toward school fees whenever you're ready, at your own pace.",
    },
    {
      icon: 'north',
      heading: 'Pay direct',
      body: 'Use your savings balance to pay fees straight to us with one tap.',
    },
    {
      icon: 'redeem',
      heading: 'Earn rewards on purchases',
      body: 'Earn cashback every time you use your card at our select partner merchants.',
    },
  ]

  // ── Benefits ─────────────────────────────────────────────────────────
  const benefits = [
    {
      heading: 'Track your progress',
      body: 'Stay on top of your savings with a clear progress tracker. See how close you are to your fee target, track every deposit and payment, and unlock cashback tiers as you hit each milestone along the way.',
      link: 'View your progress',
    },
    {
      heading: 'Flexible, partial payments',
      body: 'You do not have to pay all your fees at once. Make deposits and partial payments at any time, at your own pace. Withdraw your balance whenever you need to. Each payment moves you closer to your goal, and using your card at select merchants earns you cashback rewards.',
      link: 'How payments work',
    },
    {
      heading: 'Clear fees, always upfront',
      body: 'Deposits are always free. A small fee applies to payments, always shown before you confirm. You will never be charged anything you did not expect.',
      link: 'More about fees',
    },
  ]

  const year = new Date().getFullYear()

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: "'Inter', system-ui, sans-serif", color: '#111' }}>

      {/* ══════════════════════════════════════════════
          HEADER — desktop nav + mobile menu
      ══════════════════════════════════════════════ */}
      <header style={{
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          padding: '0 24px',
          height: 64,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {brand.logoUrl && (
              <img src={brand.logoUrl} alt={brand.businessName}
                style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
            )}
            {!brand.logoUrl && (
              <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.03em', color: '#111' }}>
                {brand.businessName}
              </span>
            )}
          </div>

          {/* Desktop nav buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} className="desktop-nav">
            <button
              onClick={() => navigate('/portal/login')}
              style={{ padding: '9px 20px', borderRadius: 999, border: '1px solid #d1d5db', background: 'transparent', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: '#111', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              Log In
            </button>
            <button
              onClick={() => navigate('/portal/register')}
              style={{ padding: '9px 20px', borderRadius: 999, border: 'none', background: primary, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'opacity 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Sign Up
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMenuOpen(o => !o)}
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            aria-label="Menu"
          >
            <div style={{ width: 22, height: 2, background: '#111', marginBottom: 5, borderRadius: 2 }} />
            <div style={{ width: 22, height: 2, background: '#111', marginBottom: 5, borderRadius: 2 }} />
            <div style={{ width: 22, height: 2, background: '#111', borderRadius: 2 }} />
          </button>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div style={{ borderTop: '1px solid #e5e7eb', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10, background: '#fff' }}>
            <button onClick={() => { navigate('/portal/login'); setMenuOpen(false) }}
              style={{ padding: '12px 0', border: 'none', background: 'none', fontWeight: 600, fontSize: 15, textAlign: 'left', cursor: 'pointer', color: '#111' }}>
              Log In
            </button>
            <button onClick={() => { navigate('/portal/register'); setMenuOpen(false) }}
              style={{ padding: '13px 20px', borderRadius: 999, border: 'none', background: primary, color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer', textAlign: 'center' }}>
              Sign Up For Free
            </button>
          </div>
        )}
      </header>

      {/* ══════════════════════════════════════════════
          SECTION 1 — HERO
      ══════════════════════════════════════════════ */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>

        {/* Hero image */}
        <div style={{
          width: '100%',
          height: 'clamp(280px, 45vw, 560px)',
          background: heroImage ? `url(${heroImage}) center/cover no-repeat` : `linear-gradient(135deg, ${primary}dd, ${primary}88)`,
          position: 'relative',
        }}>
          {/* Dark overlay for text legibility */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />

          {/* Hero content */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '32px 24px', textAlign: 'center',
          }}>
            <h1 style={{
              color: '#fff',
              fontSize: 'clamp(26px, 5vw, 52px)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              lineHeight: 1.08,
              marginBottom: 24,
              maxWidth: 640,
            }}>
              The easier way to save up<br />and pay school fees.
            </h1>
            <button
              onClick={() => navigate('/portal/register')}
              style={{
                padding: '14px 36px', borderRadius: 999,
                border: 'none', background: primary, color: '#fff',
                fontWeight: 700, fontSize: 16, cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                transition: 'transform 0.15s, opacity 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              Sign Up For Free
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 2 — VALUE PROPOSITIONS
      ══════════════════════════════════════════════ */}
      <section style={{ padding: 'clamp(48px, 8vw, 96px) 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>

          <h2 style={{
            textAlign: 'center',
            fontSize: 'clamp(22px, 3.5vw, 36px)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            marginBottom: 'clamp(32px, 5vw, 64px)',
            color: '#111',
          }}>
            Three ways we make paying school fees work for you.
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 32,
          }}>
            {vps.map(vp => (
              <div key={vp.heading} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16 }}>
                {/* Icon circle */}
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  border: `2px solid ${primary}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${primary}0d`,
                }}>
                  <span className="icon-outlined" style={{ fontSize: 28, color: primary }}>{vp.icon}</span>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: 0, letterSpacing: '-0.01em' }}>{vp.heading}</h3>
                <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, margin: 0, maxWidth: 280 }}>{vp.body}</p>
                <button
                  onClick={() => scrollTo(benefitsRef)}
                  style={{ background: 'none', border: 'none', color: primary, fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0, textDecoration: 'underline', textUnderlineOffset: 3 }}
                >
                  Learn More
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 3 — HOW IT WORKS
      ══════════════════════════════════════════════ */}
      <section ref={howItWorksRef} style={{ padding: 'clamp(48px, 8vw, 96px) 24px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>

          <h2 style={{
            textAlign: 'center',
            fontSize: 'clamp(22px, 3.5vw, 36px)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            marginBottom: 32,
            color: '#111',
          }}>
            Getting started is quick and simple.
          </h2>



          {/* Active step content */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 48, alignItems: 'center',
          }}>
            {/* Step info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {steps.map((s, i) => (
                <div
                  key={i}
                  onClick={() => setActiveStep(i)}
                  style={{
                    display: 'flex', gap: 16, alignItems: 'flex-start',
                    cursor: 'pointer', opacity: activeStep === i ? 1 : 0.4,
                    transition: 'opacity 0.2s',
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: activeStep === i ? primary : '#e5e7eb',
                    color: activeStep === i ? '#fff' : '#6b7280',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 14,
                  }}>
                    {s.num}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111', lineHeight: 1.5 }}>{s.title}</p>
                    {activeStep === i && (
                      <p style={{ margin: '8px 0 0', fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{s.desc}</p>
                    )}
                  </div>
                </div>
              ))}
              <button
                onClick={() => navigate('/portal/register')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '12px 24px', borderRadius: 999,
                  border: 'none', background: primary, color: '#fff',
                  fontWeight: 600, fontSize: 14, cursor: 'pointer',
                  alignSelf: 'flex-start', marginTop: 8,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                Learn More
              </button>
            </div>

            {/* Screenshot placeholder — 390×760 portrait */}
            <div style={{
              display: 'flex', justifyContent: 'center',
            }}>
              <div style={{
                width: 195, height: 380,
                background: `linear-gradient(160deg, ${primary}22, ${primary}08)`,
                border: `1px solid ${primary}33`,
                borderRadius: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 12, color: '#9ca3af',
              }}>
                <span className="icon-outlined" style={{ fontSize: 36 }}>phone_iphone</span>
                <span style={{ fontSize: 12, textAlign: 'center', padding: '0 24px', lineHeight: 1.5 }}>
                  Replace with 390 × 760px screenshot
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 4 — BENEFITS
      ══════════════════════════════════════════════ */}
      <section ref={benefitsRef} style={{ padding: 'clamp(48px, 8vw, 96px) 24px', background: primary }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>

          <h2 style={{
            textAlign: 'center',
            fontSize: 'clamp(22px, 3.5vw, 36px)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: '#fff',
            marginBottom: 'clamp(32px, 5vw, 64px)',
          }}>
            Join families saving smarter across Uganda.
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 32,
          }}>
            {benefits.map(b => (
              <div key={b.heading} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.01em' }}>{b.heading}</h3>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.65, margin: 0 }}>{b.body}</p>
                <button
                  onClick={() => scrollTo(howItWorksRef)}
                  style={{ background: 'none', border: 'none', color: secondary || '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0, textAlign: 'left', textDecoration: 'underline', textUnderlineOffset: 3 }}
                >
                  {b.link}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 5 — SIGN UP CTA
      ══════════════════════════════════════════════ */}
      <section style={{ padding: 'clamp(64px, 10vw, 120px) 24px', background: '#fff', textAlign: 'center' }}>
        <h2 style={{
          fontSize: 'clamp(24px, 4vw, 42px)',
          fontWeight: 700, letterSpacing: '-0.03em',
          color: '#111', marginBottom: 32,
        }}>
          Sign up and get started.
        </h2>
        <button
          onClick={() => navigate('/portal/register')}
          style={{
            padding: '16px 48px', borderRadius: 999,
            border: 'none', background: primary, color: '#fff',
            fontWeight: 700, fontSize: 17, cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            transition: 'transform 0.15s, opacity 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          Get Started
        </button>
      </section>

      {/* ══════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════ */}
      <footer style={{ background: '#f9fafb', borderTop: '1px solid #e5e7eb', padding: '40px 24px 28px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>

          {/* Footer links */}
          <div style={{
            display: 'flex', flexWrap: 'wrap',
            justifyContent: 'space-between', alignItems: 'flex-start',
            gap: 24, marginBottom: 32,
          }}>
            {/* Left links */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px' }}>
              {['Help and Contact', 'Fees', 'Security', 'Privacy', 'Legal'].map(link => (
                <a key={link} href="#" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#111'}
                  onMouseLeave={e => e.currentTarget.style.color = '#6b7280'}
                >
                  {link}
                </a>
              ))}
            </div>
            {/* Right links */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px' }}>
              <a href="https://www.partna.io" target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}
                onMouseEnter={e => e.currentTarget.style.color = '#111'}
                onMouseLeave={e => e.currentTarget.style.color = '#6b7280'}
              >
                About Partna
              </a>
            </div>
          </div>

          {/* Legal text */}
          <p style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.7, marginBottom: 16, maxWidth: 860 }}>
            Partna is a product of Wamoo Innovations - SMC Limited. An application for a Payment Service Provider licence has been submitted to the Bank of Uganda. While this application is being processed, Partna continues to operate in a sandbox environment and to provide savings and fee payment services to users.
          </p>

          {/* Copyright */}
          <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 20 }}>
            © {year} {brand.businessName}.
          </p>

          {/* Powered by Partna */}
          <a
            href="https://www.partna.io"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', opacity: 0.55, transition: 'opacity 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.55'}
          >
            <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Powered by</span>
            <img src="/partna-logo@2x.png" alt="Partna" style={{ height: 18, width: 'auto', objectFit: 'contain' }} />
          </a>
        </div>
      </footer>

      {/* ── Responsive styles ── */}
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