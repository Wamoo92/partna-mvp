import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

export default function SelectCampaign({ customer, business }) {
  const brand = useBrand()
  const navigate = useNavigate()

  const isRetail = business?.sector === 'Retail'

  // Education state
  const [campaigns, setCampaigns] = useState([])
  const [selectedCampaign, setSelectedCampaign] = useState(null)

  // Retail state
  const [productQuery, setProductQuery] = useState('')
  const [productResults, setProductResults] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [retailCampaign, setRetailCampaign] = useState(null)
  const [productError, setProductError] = useState('')

  const [agreed, setAgreed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [cardFlipped, setCardFlipped] = useState(false)

  useEffect(() => {
    if (business?.id) loadData()
  }, [business])

  async function loadData() {
    setLoading(true)
    if (!isRetail) {
      // Education: load all active campaigns for this business
      const { data } = await supabase
        .from('campaigns')
        .select('*')
        .eq('business_id', business.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      const found = data || []
      setCampaigns(found)
      // If only one campaign, auto-select it
      if (found.length === 1) setSelectedCampaign(found[0])
    }
    setLoading(false)
  }

  // Retail: search products + verify they have an active campaign
  async function handleProductSearch(val) {
    setProductQuery(val)
    setRetailCampaign(null)
    setProductError('')
    setAgreed(false)

    if (val.length < 1) {
      setProductResults([])
      setShowDropdown(false)
      return
    }

    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .or(`name.ilike.%${val}%,product_code.ilike.%${val}%`)
      .limit(10)

    if (!products || products.length === 0) {
      setProductResults([])
      setShowDropdown(true)
      return
    }

    // Only show products that have an active launched campaign
    const { data: camps } = await supabase
      .from('campaigns')
      .select('product_code')
      .eq('business_id', business.id)
      .eq('status', 'active')

    const validCodes = new Set((camps || []).map(c => c.product_code).filter(Boolean))
    const validProducts = products.filter(p => validCodes.has(p.product_code))
    setProductResults(validProducts)
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
    setSaving(true)
    try {
      await supabase
        .from('customers')
        .update({ campaign_id: campaign.id })
        .eq('id', customer.id)
      navigate('/portal/home', { replace: true })
    } catch (e) {
      console.error('Campaign selection error:', e)
    }
    setSaving(false)
  }

  function formatUGX(n) {
    return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
  }

  function formatDate(d) {
    return new Date(d).toLocaleDateString('en-UG', {
      day: 'numeric', month: 'long', year: 'numeric'
    })
  }

  const CARD_W = 280
  const CARD_H = 175

  function FlippableCard() {
    return (
      <div
        className="cursor-pointer mx-auto"
        style={{ perspective: '800px', width: `${CARD_W}px`, height: `${CARD_H}px` }}
        onClick={() => setCardFlipped(!cardFlipped)}>
        <div style={{
          width: `${CARD_W}px`, height: `${CARD_H}px`,
          position: 'relative', transformStyle: 'preserve-3d',
          transition: 'transform 0.6s ease',
          transform: cardFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}>
          {/* Front */}
          <div className="rounded-2xl absolute inset-0 overflow-hidden" style={{
            backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
            background: brand.primaryColor,
            border: `2px solid ${brand.secondaryColor}`,
          }}>
            <div className="absolute inset-0"
              style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.2) 0%, transparent 60%)' }} />
            <div className="absolute top-3 left-4">
              <img src={brand.logoUrl} alt="" className="object-contain"
                style={{ width: '32px', height: '32px', mixBlendMode: 'screen' }} />
            </div>
            <div className="absolute top-3 right-4 flex">
              <div className="w-6 h-6 rounded-full opacity-90" style={{ background: '#EB001B' }} />
              <div className="w-6 h-6 rounded-full opacity-90 -ml-3" style={{ background: '#F79E1B' }} />
            </div>
            <div className="absolute rounded"
              style={{ width: '36px', height: '24px', top: '60px', left: '16px', background: 'linear-gradient(135deg,#EDE5A6,#CFA255)' }} />
            <div className="absolute font-mono font-semibold tracking-widest"
              style={{ bottom: '40px', left: '16px', right: '16px', color: 'rgba(255,255,255,0.9)', fontSize: '14px', letterSpacing: '2px' }}>
              •••• •••• •••• ••••
            </div>
            <div className="absolute flex justify-between items-end"
              style={{ bottom: '14px', left: '16px', right: '16px' }}>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '8px', marginBottom: '1px' }}>CARD HOLDER</div>
                <div className="font-semibold uppercase tracking-wide"
                  style={{ color: 'rgba(255,255,255,0.9)', fontSize: '10px' }}>
                  {customer?.first_name} {customer?.last_name}
                </div>
              </div>
              <div className="text-right">
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '8px', marginBottom: '1px' }}>PROGRAM</div>
                <div className="font-semibold"
                  style={{ color: 'rgba(255,255,255,0.9)', fontSize: '10px' }}>
                  {brand.businessName?.slice(0, 18)}
                </div>
              </div>
            </div>
            <div className="absolute bottom-1 left-0 right-0 text-center"
              style={{ color: 'rgba(255,255,255,0.25)', fontSize: '7px' }}>tap to flip</div>
          </div>

          {/* Back */}
          <div className="rounded-2xl absolute inset-0 overflow-hidden" style={{
            backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)', background: '#0f2d40',
            border: `2px solid ${brand.secondaryColor}`,
          }}>
            <div className="absolute w-full" style={{ height: '36px', top: '24px', background: '#111' }} />
            <div className="absolute flex items-center"
              style={{ top: '74px', left: '16px', right: '16px' }}>
              <div className="flex-1 rounded-l"
                style={{ height: '28px', background: 'repeating-linear-gradient(90deg,#e8e8e8 0,#e8e8e8 4px,#ccc 4px,#ccc 8px)' }} />
              <div className="rounded-r flex items-center justify-center font-mono font-bold text-xs"
                style={{ width: '44px', height: '28px', background: '#fff', color: '#333' }}>•••</div>
            </div>
            <div className="absolute text-right"
              style={{ top: '106px', right: '16px', color: 'rgba(255,255,255,0.4)', fontSize: '9px' }}>CVV</div>
            <div className="absolute text-center w-full"
              style={{ bottom: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '9px' }}>
              {brand.businessName} Savings Program
            </div>
            <div className="absolute bottom-4 right-4 flex">
              <div className="w-5 h-5 rounded-full opacity-70" style={{ background: '#EB001B' }} />
              <div className="w-5 h-5 rounded-full opacity-70 -ml-2" style={{ background: '#F79E1B' }} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  function CampaignDetailCard({ campaign }) {
    return (
      <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
        {/* Card preview */}
        <div className="pt-5 pb-4 px-4" style={{ background: brand.primaryColor }}>
          <FlippableCard />
          <p className="text-center mt-2 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Your savings card preview · Tap to flip
          </p>
        </div>

        {/* Campaign details */}
        <div className="p-4">
          <div className="text-sm font-bold mb-1" style={{ color: brand.primaryColor }}>
            {campaign.name}
          </div>
          {campaign.description && (
            <div className="text-xs mb-3 leading-relaxed" style={{ color: 'rgba(0,0,0,0.5)' }}>
              {campaign.description}
            </div>
          )}
          {[
            { label: 'Target amount', value: formatUGX(campaign.target_amount) },
            { label: 'Deadline', value: formatDate(campaign.target_date) },
            { label: 'Minimum deposit', value: campaign.minimum_deposit > 0 ? formatUGX(campaign.minimum_deposit) : 'None' },
            { label: 'Payment installments', value: campaign.allow_partial_payments ? 'Yes' : 'No' },
            { label: 'Vouchers', value: 'Yes' },
            { label: 'Prize draw', value: 'Yes' },
          ].map((row, i, arr) => (
            <div key={i} className="flex justify-between items-center py-1.5"
              style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
              <span className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{row.label}</span>
              <span className="text-xs font-semibold" style={{ color: brand.primaryColor }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* T&C + confirm */}
        <div className="px-4 pb-5 flex flex-col gap-3"
          style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <label className="flex items-start gap-3 cursor-pointer pt-3">
            <input type="checkbox" checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 flex-shrink-0 accent-current" />
            <span className="text-xs leading-relaxed" style={{ color: 'rgba(0,0,0,0.6)' }}>
              I agree to the savings campaign terms and conditions. I understand the target amount,
              deadline, and payment requirements for this campaign.
            </span>
          </label>
          <button
            onClick={handleConfirm}
            disabled={!agreed || saving}
            className="w-full py-3 rounded-xl text-sm font-bold"
            style={{
              background: agreed && !saving ? brand.primaryColor : 'rgba(27,79,114,0.25)',
              color: '#fff',
            }}>
            {saving ? 'Enrolling...' : 'Join this campaign →'}
          </button>
        </div>
      </div>
    )
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
      <header className="flex items-center gap-2 px-4 py-3"
        style={{ background: brand.primaryColor }}>
        <img src={brand.logoUrl} alt={brand.businessName}
          className="w-8 h-8 object-contain" style={{ mixBlendMode: 'screen' }} />
        <div>
          <div className="text-white text-xs font-semibold">{brand.businessName}</div>
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Savings Program</div>
        </div>
      </header>

      {/* Hero */}
      <div className="px-5 pt-6 pb-8 text-center" style={{ background: brand.primaryColor }}>
        <div className="text-white text-xl font-bold mb-1">Choose your campaign</div>
        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
          {isRetail
            ? 'Enter a product code or name to find your savings campaign'
            : campaigns.length === 1
              ? 'Review the campaign details and agree to the terms to continue'
              : 'Select the campaign you want to save toward'}
        </div>
        <div className="mt-3 px-4 py-2 rounded-xl inline-flex items-center gap-2 text-xs"
          style={{ background: 'rgba(0,0,0,0.2)', color: 'rgba(255,255,255,0.8)' }}>
          🔒 You must select a campaign before accessing your account
        </div>
      </div>

      <div className="rounded-t-3xl flex-1 px-5 py-5 flex flex-col gap-4"
        style={{ background: '#f0f2f5', marginTop: '-16px' }}>

        {/* ── RETAIL FLOW ── */}
        {isRetail && (
          <>
            <div className="flex flex-col gap-1 relative">
              <label className="text-xs font-semibold" style={{ color: brand.primaryColor }}>
                Product code or name
              </label>
              <input
                type="text"
                placeholder="Enter product code (e.g. PRD-A1B2C3) or product name..."
                value={productQuery}
                onChange={e => handleProductSearch(e.target.value)}
                onFocus={() => productResults.length > 0 && setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{
                  background: '#fff',
                  border: `1.5px solid rgba(27,79,114,0.15)`,
                  color: '#333',
                }}
              />

              {/* Dropdown results */}
              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-20"
                  style={{ background: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.08)' }}>
                  {productResults.length === 0 ? (
                    <div className="px-4 py-3 text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                      No products with active campaigns found
                    </div>
                  ) : (
                    productResults.map(p => (
                      <button
                        key={p.id}
                        onMouseDown={() => handleSelectProduct(p)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left"
                        style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <div>
                          <div className="text-xs font-semibold" style={{ color: brand.primaryColor }}>
                            {p.name}
                          </div>
                          {p.description && (
                            <div className="text-xs truncate max-w-xs mt-0.5"
                              style={{ color: 'rgba(0,0,0,0.4)' }}>
                              {p.description}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <div className="text-xs font-mono font-bold"
                            style={{ color: brand.secondaryColor }}>
                            {p.product_code}
                          </div>
                          <div className="text-xs font-semibold mt-0.5"
                            style={{ color: brand.primaryColor }}>
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
              <div className="text-xs px-4 py-3 rounded-xl"
                style={{ background: '#FEE2E2', color: '#991B1B' }}>
                {productError}
              </div>
            )}

            {retailCampaign && (
              <CampaignDetailCard campaign={retailCampaign} />
            )}
          </>
        )}

        {/* ── EDUCATION FLOW ── */}
        {!isRetail && (
          <>
            {campaigns.length === 0 ? (
              <div className="rounded-2xl p-8 text-center" style={{ background: '#fff' }}>
                <div className="text-3xl mb-3">🎯</div>
                <div className="text-sm font-bold mb-1" style={{ color: brand.primaryColor }}>
                  No campaigns available yet
                </div>
                <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                  Your institution hasn't launched any active campaigns yet.
                  Please check back later or contact your institution.
                </div>
              </div>
            ) : campaigns.length === 1 ? (
              // Single campaign — show directly
              <CampaignDetailCard campaign={campaigns[0]} />
            ) : (
              // Multiple campaigns — show selector then detail
              <>
                <div className="flex flex-col gap-2">
                  {campaigns.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCampaign(c); setAgreed(false); setCardFlipped(false) }}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-left"
                      style={{
                        background: selectedCampaign?.id === c.id
                          ? `rgba(27,79,114,0.06)` : '#fff',
                        border: selectedCampaign?.id === c.id
                          ? `2px solid ${brand.primaryColor}`
                          : '2px solid rgba(0,0,0,0.06)',
                      }}>
                      <div>
                        <div className="text-sm font-bold" style={{ color: brand.primaryColor }}>
                          {c.name}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: 'rgba(0,0,0,0.4)' }}>
                          {formatUGX(c.target_amount)} · Due {formatDate(c.target_date)}
                        </div>
                      </div>
                      <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-4"
                        style={{ borderColor: brand.primaryColor }}>
                        {selectedCampaign?.id === c.id && (
                          <div className="w-2.5 h-2.5 rounded-full"
                            style={{ background: brand.primaryColor }} />
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {selectedCampaign && (
                  <CampaignDetailCard campaign={selectedCampaign} />
                )}
              </>
            )}
          </>
        )}

      </div>
    </div>
  )
}