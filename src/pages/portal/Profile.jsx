import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { brand } from '../../lib/brandConfig'

const CAMPAIGN_ID = 'b1b2c3d4-0000-0000-0000-000000000001'

export default function Profile({ customer, signOut }) {
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState(null)
  const [wallet, setWallet] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showPinForm, setShowPinForm] = useState(false)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinSuccess, setPinSuccess] = useState(false)
  const [changingPin, setChangingPin] = useState(false)

  useEffect(() => {
    if (customer) loadData()
  }, [customer])

  async function loadData() {
    setLoading(true)
    try {
      const r1 = await supabase.from('campaigns').select('*').eq('id', CAMPAIGN_ID)
      if (r1.data && r1.data.length > 0) setCampaign(r1.data[0])

      const r2 = await supabase.from('wallets').select('*').eq('customer_id', customer.id)
      if (r2.data && r2.data.length > 0) setWallet(r2.data[0])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  async function handleChangePin() {
    setPinError('')
    setPinSuccess(false)

    if (!currentPin || currentPin.length !== 4) {
      setPinError('Enter your current 4-digit PIN.')
      return
    }
    if (!newPin || newPin.length !== 4) {
      setPinError('New PIN must be 4 digits.')
      return
    }
    if (newPin !== confirmPin) {
      setPinError('New PINs do not match.')
      return
    }
    if (newPin === currentPin) {
      setPinError('New PIN must be different from current PIN.')
      return
    }

    setChangingPin(true)
    try {
      const cleanPhone = customer.phone.replace(/\s+/g, '')
      const oldPassword = `pin-${currentPin}-${cleanPhone}`
      const newPassword = `pin-${newPin}-${cleanPhone}`

      // Verify current PIN by signing in with real email
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: customer.email,
        password: oldPassword,
      })

      if (signInError) {
        setPinError('Current PIN is incorrect.')
        setChangingPin(false)
        return
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        setPinError('Could not update PIN. Please try again.')
        setChangingPin(false)
        return
      }

      setPinSuccess(true)
      setCurrentPin('')
      setNewPin('')
      setConfirmPin('')
      setTimeout(() => {
        setShowPinForm(false)
        setPinSuccess(false)
      }, 2000)
    } catch (e) {
      setPinError('Something went wrong. Please try again.')
    }
    setChangingPin(false)
  }

  function maskNin(nin) {
    if (!nin) return 'Not provided'
    const visible = nin.slice(-4)
    const masked = '•'.repeat(Math.max(0, nin.length - 4))
    return masked + visible
  }

  function maskNumber(number) {
    if (!number) return '—'
    const clean = number.replace(/\s+/g, '')
    return clean.slice(0, 4) + ' •••• ' + clean.slice(-3)
  }

  function formatUGX(n) {
    return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
  }

  const balance = wallet ? Number(wallet.balance) : 0
  const target = campaign ? Number(campaign.target_amount) : 1500000
  const pct = Math.min((balance / target) * 100, 100)
  const kycVerified = customer?.kyc_status === 'verified'
  const hasPaymentSource = !!(customer?.payment_network && customer?.payment_number)

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
          <div className="text-white text-xs font-semibold">Profile</div>
        </div>
      </header>

      {/* Avatar section */}
      <div className="flex flex-col items-center pt-6 pb-10 px-5" style={{ background: brand.primaryColor }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mb-3"
          style={{ background: brand.secondaryColor, color: brand.primaryColor }}>
          {customer?.first_name?.[0]}{customer?.last_name?.[0]}
        </div>
        <div className="text-white text-base font-bold">
          {customer?.first_name} {customer?.other_names ? customer.other_names + ' ' : ''}{customer?.last_name}
        </div>
        <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {customer?.phone}
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {customer?.email}
        </div>
      </div>

      {/* Main content */}
      <div className="rounded-t-3xl flex-1 flex flex-col gap-4 px-5 py-5"
        style={{ background: '#f0f2f5', marginTop: '-16px' }}>

        {/* Account details */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'rgba(0,0,0,0.35)' }}>
              Account Details
            </div>
          </div>

          {/* Static rows */}
          {[
            { label: 'First name', value: customer?.first_name },
            { label: 'Last name', value: customer?.last_name },
            customer?.other_names ? { label: 'Other names', value: customer.other_names } : null,
            { label: 'Phone', value: customer?.phone },
            { label: 'Email', value: customer?.email },
            { label: 'National ID (NIN)', value: maskNin(customer?.nin) },
          ].filter(Boolean).map((item, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{item.label}</div>
              <div className="text-xs font-semibold" style={{ color: brand.primaryColor }}>{item.value}</div>
            </div>
          ))}

          {/* KYC status — clickable if not verified */}
          <button
            onClick={() => !kycVerified && navigate('/portal/kyc')}
            className="w-full flex items-center justify-between px-4 py-3"
            style={{ cursor: kycVerified ? 'default' : 'pointer' }}>
            <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>KYC status</div>
            <div className="flex items-center gap-1">
              {kycVerified ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
                  ✓ Verified
                </span>
              ) : (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(217,119,6,0.1)', color: '#D97706' }}>
                  ⚠ Pending — tap to verify
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Payment source */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'rgba(0,0,0,0.35)' }}>
              Payment Source
            </div>
          </div>

          {hasPaymentSource ? (
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <img
                  src={customer.payment_network === 'mtn' ? '/mtn-logo.svg' : '/airtel-logo.svg'}
                  alt={customer.payment_network}
                  className="w-8 h-8 object-contain rounded-lg"
                />
                <div>
                  <div className="text-xs font-semibold" style={{ color: brand.primaryColor }}>
                    {customer.payment_network === 'mtn' ? 'MTN MoMo' : 'Airtel Money'}
                  </div>
                  <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>
                    {maskNumber(customer.payment_number)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => navigate('/portal/payment-source')}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(27,79,114,0.08)', color: brand.primaryColor }}>
                Edit
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/portal/payment-source')}
              className="w-full flex items-center justify-between px-4 py-3">
              <div className="text-xs font-semibold" style={{ color: '#D97706' }}>
                ⚠ No payment source added
              </div>
              <span style={{ color: 'rgba(0,0,0,0.25)' }}>→</span>
            </button>
          )}
        </div>

        {/* Savings summary */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'rgba(0,0,0,0.35)' }}>
              Savings Summary
            </div>
          </div>
          {[
            { label: 'Campaign', value: campaign?.name || 'Term 3 Fees 2026' },
            { label: 'Target amount', value: formatUGX(target) },
            { label: 'Target date', value: campaign?.target_date ? new Date(campaign.target_date).toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
            { label: 'Current balance', value: formatUGX(balance) },
            { label: 'Progress', value: pct.toFixed(1) + '%' },
          ].map((item, i, arr) => (
            <div key={i} className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
              <div className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{item.label}</div>
              <div className="text-xs font-semibold" style={{ color: brand.primaryColor }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff' }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'rgba(0,0,0,0.35)' }}>
              Actions
            </div>
          </div>

          <button onClick={() => navigate('/portal/card')}
            className="w-full flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <div className="text-xs font-semibold" style={{ color: brand.primaryColor }}>View my card</div>
            <span style={{ color: 'rgba(0,0,0,0.25)' }}>→</span>
          </button>

          <button onClick={() => navigate('/portal/rewards')}
            className="w-full flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <div className="text-xs font-semibold" style={{ color: brand.primaryColor }}>View rewards</div>
            <span style={{ color: 'rgba(0,0,0,0.25)' }}>→</span>
          </button>

          <button
            onClick={() => { setShowPinForm(!showPinForm); setPinError(''); setPinSuccess(false) }}
            className="w-full flex items-center justify-between px-4 py-3"
            style={{ borderBottom: showPinForm ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
            <div className="text-xs font-semibold" style={{ color: brand.primaryColor }}>Change PIN</div>
            <span style={{ color: 'rgba(0,0,0,0.25)' }}>{showPinForm ? '↑' : '↓'}</span>
          </button>

          {showPinForm && (
            <div className="px-4 pb-4 flex flex-col gap-3">
              {pinSuccess && (
                <div className="text-xs px-3 py-2 rounded-xl text-center font-semibold"
                  style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A' }}>
                  PIN changed successfully!
                </div>
              )}
              {pinError && (
                <div className="text-xs px-3 py-2 rounded-xl"
                  style={{ background: '#FEE2E2', color: '#991B1B' }}>
                  {pinError}
                </div>
              )}
              {[
                { label: 'Current PIN', value: currentPin, setter: setCurrentPin },
                { label: 'New PIN', value: newPin, setter: setNewPin },
                { label: 'Confirm new PIN', value: confirmPin, setter: setConfirmPin },
              ].map((field, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <label className="text-xs" style={{ color: 'rgba(0,0,0,0.4)' }}>{field.label}</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="••••"
                    value={field.value}
                    onChange={e => field.setter(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none text-center tracking-widest"
                    style={{ background: '#f0f2f5', color: '#333', fontSize: '18px' }}
                  />
                </div>
              ))}
              <button
                onClick={handleChangePin}
                disabled={changingPin}
                className="w-full py-2.5 rounded-xl text-xs font-bold"
                style={{
                  background: changingPin ? 'rgba(27,79,114,0.3)' : brand.primaryColor,
                  color: '#fff'
                }}>
                {changingPin ? 'Updating...' : 'Update PIN'}
              </button>
            </div>
          )}
        </div>

        {/* Log out */}
        <button
          onClick={() => { signOut(); navigate('/portal') }}
          className="w-full py-3 rounded-2xl text-sm font-bold"
          style={{ background: '#FEE2E2', color: '#DC2626' }}>
          Log out
        </button>

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
            <span className="text-lg leading-none"
              style={{ color: item.path === '/portal/profile' ? brand.primaryColor : 'rgba(0,0,0,0.3)' }}>
              {item.icon}
            </span>
            <span className="text-xs"
              style={{
                color: item.path === '/portal/profile' ? brand.primaryColor : 'rgba(0,0,0,0.3)',
                fontWeight: item.path === '/portal/profile' ? 600 : 400
              }}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>

    </div>
  )
}