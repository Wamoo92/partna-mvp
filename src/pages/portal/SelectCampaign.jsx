import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// ── SMS helper (non-blocking) ──────────────────────────────────────────────
async function sendSMS(customerId, phone, event, vars = {}) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ event, phone, customerId, vars }),
    })
  } catch (e) {
    console.error('SMS send error (non-critical):', e)
  }
}

function generateDrawCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'SC-'
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

function formatUGX(n) {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ── Preview card (neobrutalism) ────────────────────────────────────────────
function PreviewCard({ customer, brand, flipped, onFlip }) {
  return (
    <div
      onClick={onFlip}
      style={{ perspective: '800px', width: 280, height: 174, cursor: 'pointer', margin: '0 auto' }}
    >
      <div style={{
        width: 280, height: 174,
        position: 'relative',
        transformStyle: 'preserve-3d',
        transition: 'transform 0.55s ease',
        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
      }}>
        {/* Front */}
        <div style={{
          position: 'absolute', inset: 0,
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          background: 'var(--color-white)',
          border: '3px solid var(--color-black)',
          boxShadow: '6px 6px 0px 0px var(--color-primary)',
          padding: 'var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: 'var(--color-black)' }} />

          {/* Top row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <div style={{
              fontWeight: 'var(--weight-black)',
              fontSize: 'var(--text-xs)',
              letterSpacing: 'var(--tracking-wider)',
              textTransform: 'uppercase',
            }}>
              {brand.businessName}
            </div>
            <div style={{
              width: 32, height: 22,
              background: 'linear-gradient(135deg, #EDE5A6, #CFA255)',
              border: '1.5px solid var(--color-black)',
            }} />
          </div>

          {/* Card number */}
          <div style={{
            fontFamily: 'monospace',
            fontSize: 'var(--text-base)',
            fontWeight: 'var(--weight-bold)',
            letterSpacing: '0.15em',
            color: 'var(--color-black)',
          }}>
            •••• •••• •••• ••••
          </div>

          {/* Bottom row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 8, fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey)', marginBottom: 2 }}>
                Cardholder
              </div>
              <div style={{ fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)' }}>
                {customer?.first_name} {customer?.last_name}
              </div>
            </div>
            <div style={{ display: 'flex' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#EB001B', border: '2px solid var(--color-black)' }} />
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#F79E1B', border: '2px solid var(--color-black)', marginLeft: -9 }} />
            </div>
          </div>

          <div style={{ position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', fontSize: 8, fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-widest)', textTransform: 'uppercase', color: 'var(--color-grey-mid)' }}>
            tap to flip
          </div>
        </div>

        {/* Back */}
        <div style={{
          position: 'absolute', inset: 0,
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          background: 'var(--color-black)',
          border: '3px solid var(--color-black)',
          boxShadow: '6px 6px 0px 0px var(--color-primary)',
          overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: 26, left: 0, right: 0, height: 36, background: '#1a1a1a' }} />
          <div style={{ position: 'absolute', top: 76, left: 16, right: 16, display: 'flex', alignItems: 'center' }}>
            <div style={{ flex: 1, height: 28, background: 'repeating-linear-gradient(90deg,#e8e8e8 0,#e8e8e8 4px,#ccc 4px,#ccc 8px)' }} />
            <div style={{ width: 44, height: 28, background: 'var(--color-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontWeight: 'var(--weight-black)', fontSize: 'var(--text-sm)', border: '2px solid var(--color-black)' }}>
              •••
            </div>
          </div>
          <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 'var(--weight-bold)', letterSpacing: 'var(--tracking-wide)' }}>
            {brand.businessName} Savings Program
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Campaign detail + enroll card ──────────────────────────────────────────
function CampaignDetailCard({ campaign, customer, brand, cardFlipped, setCardFlipped, agreed, setAgreed, saving, onConfirm, alreadyEnrolled }) {
  return (
    <div style={{
      background: 'var(--color-white)',
      border: 'var(--border-thick)',
      boxShadow: 'var(--shadow-lg)',
      overflow: 'hidden',
    }}>
      {/* Card preview header */}
      <div style={{
        background: 'var(--color-black)',
        borderBottom: 'var(--border)',
        padding: 'var(--space-5) var(--space-5) var(--space-4)',
      }}>
        <PreviewCard customer={customer} brand={brand} flipped={cardFlipped} onFlip={() => setCardFlipped(f => !f)} />
        <p style={{
          textAlign: 'center',
          marginTop: 'var(--space-2)',
          fontSize: 9,
          fontWeight: 'var(--weight-bold)',
          letterSpacing: 'var(--tracking-widest)',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.3)',
        }}>
          Your savings card preview · Tap to flip
        </p>
      </div>

      {/* Campaign info */}
      <div style={{ padding: 'var(--space-5)' }}>
        <div style={{
          display: 'inline-block',
          background: 'var(--color-primary)',
          border: 'var(--border)',
          padding: '3px var(--space-3)',
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-black)',
          letterSpacing: 'var(--tracking-widest)',
          textTransform: 'uppercase',
          marginBottom: 'var(--space-3)',
        }}>
          Campaign
        </div>
        <h3 style={{
          fontSize: 'var(--text-xl)',
          fontWeight: 'var(--weight-black)',
          letterSpacing: 'var(--tracking-tight)',
          fontVariationSettings: "'wdth' 105, 'opsz' 24",
          marginBottom: 'var(--space-2)',
        }}>
          {campaign.name}
        </h3>
        {campaign.description && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', lineHeight: 'var(--leading-normal)', marginBottom: 'var(--space-4)' }}>
            {campaign.description}
          </p>
        )}

        {alreadyEnrolled && (
          <div className="alert alert-success" style={{ marginBottom: 'var(--space-4)' }}>
            <span className="icon-outlined alert-icon">check_circle</span>
            <div className="alert-content">You are already enrolled in this campaign.</div>
          </div>
        )}

        {/* Detail rows */}
        <div style={{ border: 'var(--border)', overflow: 'hidden' }}>
          {[
            { icon: 'savings',       label: 'Target amount',        value: formatUGX(campaign.target_amount) },
            { icon: 'event',         label: 'Deadline',             value: formatDate(campaign.target_date) },
            { icon: 'payments',      label: 'Minimum deposit',      value: campaign.minimum_deposit > 0 ? formatUGX(campaign.minimum_deposit) : 'None' },
            { icon: 'receipt_long',  label: 'Payment installments', value: campaign.allow_partial_payments ? 'Yes' : 'No' },
          ].map((row, i, arr) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--space-3) var(--space-4)',
              borderBottom: i < arr.length - 1 ? 'var(--border)' : 'none',
              background: i % 2 === 0 ? 'var(--color-white)' : 'var(--color-bg)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span className="icon-outlined" style={{ fontSize: 16, color: 'var(--color-grey)' }}>{row.icon}</span>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>{row.label}</span>
              </div>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Enroll CTA */}
      {!alreadyEnrolled && (
        <div style={{
          padding: 'var(--space-4) var(--space-5) var(--space-5)',
          borderTop: 'var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}>
          <label className="checkbox-group">
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
            />
            <span className="checkbox-label" style={{ color: 'var(--color-grey)' }}>
              I agree to the savings campaign terms and conditions. I understand the target amount,
              deadline, and payment requirements for this campaign.
            </span>
          </label>

          <button
            onClick={onConfirm}
            disabled={!agreed || saving}
            className="btn btn-primary btn-full btn-lg"
          >
            {saving
              ? <><div className="spinner spinner-sm" style={{ borderTopColor: 'var(--color-black)' }} /> Enrolling…</>
              : <><span className="icon-outlined icon-sm">how_to_reg</span> Join this campaign</>
            }
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function SelectCampaign({ customer, business }) {
  const brand    = useBrand()
  const navigate = useNavigate()

  const isRetail = business?.sector === 'Retail'

  const [campaigns, setCampaigns]                 = useState([])
  const [selectedCampaign, setSelectedCampaign]   = useState(null)
  const [productQuery, setProductQuery]           = useState('')
  const [productResults, setProductResults]       = useState([])
  const [showDropdown, setShowDropdown]           = useState(false)
  const [retailCampaign, setRetailCampaign]       = useState(null)
  const [productError, setProductError]           = useState('')
  const [agreed, setAgreed]                       = useState(false)
  const [saving, setSaving]                       = useState(false)
  const [loading, setLoading]                     = useState(true)
  const [cardFlipped, setCardFlipped]             = useState(false)
  const [enrolledCampaignIds, setEnrolledCampaignIds] = useState([])

  useEffect(() => {
    if (business?.id && customer?.id) loadData()
  }, [business, customer])

  async function loadData() {
    setLoading(true)
    const { data: existingEnrollments } = await supabase
      .from('customer_campaigns')
      .select('campaign_id')
      .eq('customer_id', customer.id)
      .eq('status', 'active')
    setEnrolledCampaignIds((existingEnrollments || []).map(e => e.campaign_id))

    if (!isRetail) {
      const { data } = await supabase
        .from('campaigns')
        .select('*')
        .eq('business_id', business.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      const found = data || []
      setCampaigns(found)
      if (found.length === 1) setSelectedCampaign(found[0])
    }
    setLoading(false)
  }

  async function handleProductSearch(val) {
    setProductQuery(val)
    setRetailCampaign(null)
    setProductError('')
    setAgreed(false)
    if (val.length < 1) { setProductResults([]); setShowDropdown(false); return }

    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .or(`name.ilike.%${val}%,product_code.ilike.%${val}%`)
      .limit(10)

    if (!products || products.length === 0) {
      setProductResults([]); setShowDropdown(true); return
    }

    const { data: camps } = await supabase
      .from('campaigns')
      .select('product_code')
      .eq('business_id', business.id)
      .eq('status', 'active')

    const validCodes = new Set((camps || []).map(c => c.product_code).filter(Boolean))
    setProductResults(products.filter(p => validCodes.has(p.product_code)))
    setShowDropdown(true)
  }

  async function handleSelectProduct(product) {
    setProductQuery(product.name + '  ·  ' + product.product_code)
    setShowDropdown(false)
    setProductError('')
    setAgreed(false)
    setRetailCampaign(null)

    const { data: camps } = await supabase
      .from('campaigns')
      .select('*')
      .eq('business_id', business.id)
      .eq('status', 'active')
      .eq('product_code', product.product_code)
      .limit(1)

    if (camps && camps.length > 0) {
      setRetailCampaign(camps[0])
    } else {
      setProductError('No active campaign found for this product.')
    }
  }

  async function handleConfirm() {
    const campaign = isRetail ? retailCampaign : selectedCampaign
    if (!campaign || !agreed) return

    if (enrolledCampaignIds.includes(campaign.id)) {
      navigate('/portal/home', { replace: true }); return
    }

    setSaving(true)
    try {
      const drawCode = generateDrawCode()

      const { data: enrollment, error: enrollError } = await supabase
        .from('customer_campaigns')
        .insert({
          customer_id:  customer.id,
          campaign_id:  campaign.id,
          business_id:  business.id,
          draw_code:    drawCode,
          status:       'active',
        })
        .select()
        .single()

      if (enrollError) { console.error('Enrollment error:', enrollError); setSaving(false); return }

      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .insert({ customer_id: customer.id, customer_campaign_id: enrollment.id, balance: 0 })
        .select()
        .single()

      if (walletError) { console.error('Wallet creation error:', walletError); setSaving(false); return }

      await supabase.from('customer_campaigns').update({ wallet_id: wallet.id }).eq('id', enrollment.id)

      // ── Send campaign_enrolled SMS (non-blocking) ──────────────────
      if (customer?.phone) {
        sendSMS(customer.id, customer.phone, 'campaign_enrolled', {
          campaign:  campaign.name,
          draw_code: drawCode,
        })
      }

      if (enrolledCampaignIds.length === 0) {
        navigate('/portal/kyc', { replace: true })
      } else {
        navigate('/portal/home', { replace: true })
      }
    } catch (e) {
      console.error('Campaign selection error:', e)
    }
    setSaving(false)
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner spinner-lg spinner-purple" />
    </div>
  )

  const availableCampaigns = campaigns.filter(c => !enrolledCampaignIds.includes(c.id))
  const hasEnrollments = enrolledCampaignIds.length > 0

  const detailProps = {
    customer, brand, cardFlipped, setCardFlipped,
    agreed, setAgreed, saving, onConfirm: handleConfirm,
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <header style={{
        background: 'var(--color-black)',
        borderBottom: 'var(--border)',
        padding: 'var(--space-4) var(--space-5)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
      }}>
        {hasEnrollments && (
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
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {brand.logoUrl && (
            <div style={{
              width: 32, height: 32,
              background: 'var(--color-primary)',
              border: '2px solid var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <img src={brand.logoUrl} alt={brand.businessName} style={{ width: 22, height: 22, objectFit: 'contain' }} />
            </div>
          )}
          <span style={{ color: 'var(--color-white)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>
            {brand.businessName}
          </span>
        </div>
      </header>

      {/* ── Title bar ── */}
      <div style={{
        background: 'var(--color-black)',
        borderBottom: '3px solid var(--color-primary)',
        padding: 'var(--space-6) var(--space-5) var(--space-8)',
      }}>
        <div style={{
          display: 'inline-block',
          background: 'var(--color-primary)',
          border: 'var(--border)',
          padding: '3px var(--space-3)',
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-black)',
          letterSpacing: 'var(--tracking-widest)',
          textTransform: 'uppercase',
          color: 'var(--color-black)',
          marginBottom: 'var(--space-3)',
        }}>
          {hasEnrollments ? 'Add campaign' : 'Get started'}
        </div>
        <h1 style={{
          color: 'var(--color-white)',
          fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--weight-black)',
          lineHeight: 'var(--leading-tight)',
          letterSpacing: 'var(--tracking-tight)',
          fontVariationSettings: "'wdth' 110, 'opsz' 30",
          marginBottom: 'var(--space-2)',
        }}>
          {hasEnrollments ? 'Add another campaign' : 'Choose your campaign'}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'var(--text-sm)' }}>
          {isRetail
            ? 'Enter a product code or name to find your savings campaign.'
            : availableCampaigns.length === 1
            ? 'Review the campaign details and agree to the terms to continue.'
            : 'Select the campaign you want to save toward.'}
        </p>

        {!hasEnrollments && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginTop: 'var(--space-4)',
            padding: '6px var(--space-4)',
            border: '1.5px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.06)',
          }}>
            <span className="icon-outlined icon-xs" style={{ color: 'var(--color-primary)' }}>lock</span>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'rgba(255,255,255,0.7)', letterSpacing: 'var(--tracking-wide)' }}>
              You must select at least one campaign to continue
            </span>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{
        flex: 1,
        padding: 'var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}>

        {/* ── RETAIL FLOW ── */}
        {isRetail && (
          <>
            <div className="input-group" style={{ position: 'relative' }}>
              <label className="input-label">Product code or name</label>
              <div className="input-wrapper">
                <span className="icon-outlined input-icon-left">search</span>
                <input
                  type="text"
                  className="input"
                  placeholder="Enter product code or name…"
                  value={productQuery}
                  onChange={e => handleProductSearch(e.target.value)}
                  onFocus={() => productResults.length > 0 && setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                />
              </div>

              {showDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0, right: 0,
                  background: 'var(--color-white)',
                  border: 'var(--border)',
                  boxShadow: 'var(--shadow-md)',
                  zIndex: 'var(--z-dropdown)',
                  marginTop: 'var(--space-1)',
                }}>
                  {productResults.length === 0 ? (
                    <div style={{ padding: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                      No products with active campaigns found.
                    </div>
                  ) : (
                    productResults.map((p, i) => (
                      <button
                        key={p.id}
                        onMouseDown={() => handleSelectProduct(p)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 'var(--space-3) var(--space-4)',
                          background: 'none',
                          border: 'none',
                          borderBottom: i < productResults.length - 1 ? '1.5px solid var(--color-grey-light)' : 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background-color var(--transition-fast)',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        <div>
                          <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>{p.name}</div>
                          {p.description && (
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-grey)', marginTop: 2 }}>
                              {p.description}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 'var(--space-4)' }}>
                          <div style={{ fontFamily: 'monospace', fontWeight: 'var(--weight-black)', fontSize: 'var(--text-xs)', color: 'var(--color-primary)' }}>
                            {p.product_code}
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', marginTop: 2 }}>
                            {formatUGX(p.price)}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {productError && (
              <div className="alert alert-danger">
                <span className="icon-outlined alert-icon">error_outline</span>
                <div className="alert-content">{productError}</div>
              </div>
            )}

            {retailCampaign && (
              <CampaignDetailCard
                campaign={retailCampaign}
                alreadyEnrolled={enrolledCampaignIds.includes(retailCampaign.id)}
                {...detailProps}
              />
            )}
          </>
        )}

        {/* ── EDUCATION FLOW ── */}
        {!isRetail && (
          <>
            {/* No campaigns at all */}
            {availableCampaigns.length === 0 && !hasEnrollments && (
              <div className="card" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
                <span className="icon-outlined" style={{ fontSize: 40, color: 'var(--color-grey-mid)', display: 'block', marginBottom: 'var(--space-3)' }}>
                  campaign
                </span>
                <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>
                  No campaigns available yet
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)' }}>
                  Your institution hasn't launched any active campaigns yet. Please check back later or contact your institution.
                </div>
              </div>
            )}

            {/* Already enrolled in all */}
            {availableCampaigns.length === 0 && hasEnrollments && (
              <div className="card" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
                <div style={{
                  width: 56, height: 56,
                  background: 'var(--color-green)',
                  border: 'var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto var(--space-4)',
                }}>
                  <span className="icon-outlined" style={{ fontSize: 28 }}>check</span>
                </div>
                <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>
                  You're enrolled in all available campaigns
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-grey)', marginBottom: 'var(--space-5)' }}>
                  There are no additional campaigns to join right now.
                </div>
                <button onClick={() => navigate('/portal/home')} className="btn btn-black btn-lg">
                  <span className="icon-outlined icon-sm">home</span>
                  Back to home
                </button>
              </div>
            )}

            {/* Single campaign — show detail directly */}
            {availableCampaigns.length === 1 && (
              <CampaignDetailCard
                campaign={availableCampaigns[0]}
                alreadyEnrolled={enrolledCampaignIds.includes(availableCampaigns[0].id)}
                {...detailProps}
              />
            )}

            {/* Multiple campaigns — picker then detail */}
            {availableCampaigns.length > 1 && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {availableCampaigns.map(c => {
                    const isSelected = selectedCampaign?.id === c.id
                    return (
                      <button
                        key={c.id}
                        onClick={() => { setSelectedCampaign(c); setAgreed(false); setCardFlipped(false) }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 'var(--space-4)',
                          background: isSelected ? 'var(--color-primary)' : 'var(--color-white)',
                          border: isSelected ? 'var(--border-thick)' : 'var(--border)',
                          boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all var(--transition-base)',
                        }}
                      >
                        <div>
                          <div style={{
                            fontWeight: 'var(--weight-bold)',
                            fontSize: 'var(--text-base)',
                            color: isSelected ? 'var(--color-black)' : 'var(--color-black)',
                            marginBottom: 'var(--space-1)',
                          }}>
                            {c.name}
                          </div>
                          <div style={{ fontSize: 'var(--text-sm)', color: isSelected ? 'rgba(0,0,0,0.6)' : 'var(--color-grey)' }}>
                            {formatUGX(c.target_amount)} · Due {formatDate(c.target_date)}
                          </div>
                        </div>
                        <div style={{
                          width: 24, height: 24,
                          border: isSelected ? '2px solid var(--color-black)' : '2px solid var(--color-grey-mid)',
                          background: isSelected ? 'var(--color-black)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, marginLeft: 'var(--space-4)',
                          transition: 'all var(--transition-base)',
                        }}>
                          {isSelected && (
                            <span className="icon-outlined" style={{ fontSize: 14, color: 'var(--color-white)' }}>check</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {selectedCampaign && (
                  <CampaignDetailCard
                    campaign={selectedCampaign}
                    alreadyEnrolled={enrolledCampaignIds.includes(selectedCampaign.id)}
                    {...detailProps}
                  />
                )}
              </>
            )}
          </>
        )}
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