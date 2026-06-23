import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useBrand } from '../../lib/BrandContext'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

async function sendSMS(customerId, phone, event, vars = {}) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ event, phone, customerId, vars }),
    })
  } catch (e) { console.error('SMS send error (non-critical):', e) }
}

function generateDrawCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'SC-'
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function formatUGX(n) {
  return 'UGX ' + Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' })
}

const FEE_TYPE_LABELS = {
  tuition:       'Tuition fees',
  functional:    'Functional fees',
  building_fund: 'Building fund',
  exam:          'Exam fees',
  pta:           'PTA contribution',
  other:         'Other fees',
}

// ── Sellin tokens ──────────────────────────────────────────────────────────
const C = {
  bg:        '#F6F7EE',
  white:     '#FFFFFF',
  black:     '#111111',
  accent:    '#ECEDE1',
  labelBg:   '#E4E5DD',
  stroke:    '#D7D8CB',
  grayLine:  '#D5D9DD',
  secondary: '#959687',
  grayMid:   '#898B90',
  grayLight: '#ECECEC',
  green:     '#59886D',
  bgGreen:   '#E4F8EC',
  red:       '#CC3939',
  bgRed:     '#F8E4E4',
  orange:    '#EF8354',
  bgOrange:  '#F8F0E4',
  blue:      '#85A0C5',
}

const btnPrimary = { padding: '10px 18px', fontSize: 14, fontWeight: 600, color: C.white, background: C.black, border: `1px solid ${C.black}`, borderRadius: 10, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Inter, system-ui, sans-serif' }
const btnSecondary = { padding: '10px 18px', fontSize: 14, fontWeight: 600, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 10, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Inter, system-ui, sans-serif' }
const inputStyle = { display: 'block', width: '100%', padding: '10px 14px', fontSize: 14, fontWeight: 500, color: C.black, background: C.white, border: `1px solid ${C.grayLine}`, borderRadius: 10, outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', transition: 'border-color 0.15s' }
const labelStyle = { display: 'block', fontSize: 14, fontWeight: 600, color: C.black, letterSpacing: '-0.4px', marginBottom: 6 }

// ── Card preview ───────────────────────────────────────────────────────────
function PreviewCard({ customer, brand, flipped, onFlip }) {
  return (
    <div onClick={onFlip} style={{ perspective: '800px', width: 280, height: 174, cursor: 'pointer', margin: '0 auto' }}>
      <div style={{ width: 280, height: 174, position: 'relative', transformStyle: 'preserve-3d', transition: 'transform 0.55s ease', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
        {/* Front */}
        <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 8px 24px rgba(0,0,0,0.28)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.black, letterSpacing: '-0.4px' }}>{brand.businessName}</span>
            <div style={{ width: 28, height: 20, borderRadius: 4, background: 'linear-gradient(135deg, #EDE5A6, #CFA255)' }} />
          </div>
          <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: C.black, letterSpacing: '0.14em' }}>•••• •••• •••• ••••</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <p style={{ fontSize: 8, fontWeight: 500, color: C.secondary, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cardholder</p>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.black, margin: 0 }}>{customer?.first_name} {customer?.last_name}</p>
            </div>
            <div style={{ display: 'flex' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#EB001B', opacity: 0.9 }} />
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#F79E1B', opacity: 0.9, marginLeft: -8 }} />
            </div>
          </div>
          <p style={{ position: 'absolute', bottom: 5, left: 0, right: 0, textAlign: 'center', fontSize: 8, fontWeight: 500, color: C.grayMid, margin: 0 }}>tap to flip</p>
        </div>
        {/* Back */}
        <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', background: '#1a1a1a', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.28)' }}>
          <div style={{ position: 'absolute', top: 26, left: 0, right: 0, height: 32, background: '#2a2a2a' }} />
          <div style={{ position: 'absolute', top: 70, left: 14, right: 14, display: 'flex', alignItems: 'center' }}>
            <div style={{ flex: 1, height: 26, background: 'repeating-linear-gradient(90deg,#e8e8e8 0,#e8e8e8 4px,#ccc 4px,#ccc 8px)' }} />
            <div style={{ width: 40, height: 26, background: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontWeight: 600, fontSize: 12, color: C.black, borderRadius: 3 }}>•••</div>
          </div>
          <p style={{ position: 'absolute', bottom: 14, left: 0, right: 0, textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.3)', margin: 0 }}>{brand.businessName} Savings Program</p>
        </div>
      </div>
    </div>
  )
}

// ── Student ID lookup ──────────────────────────────────────────────────────
function StudentIdLookup({ businessId, enrolledStudentIds, onStudentConfirmed, confirmedStudent, onClear }) {
  const [studentIdInput, setStudentIdInput] = useState('')
  const [lookingUp, setLookingUp]           = useState(false)
  const [lookupError, setLookupError]       = useState('')
  const [showNameSearch, setShowNameSearch] = useState(false)
  const [nameFirst, setNameFirst]           = useState('')
  const [nameLast, setNameLast]             = useState('')
  const [nameYear, setNameYear]             = useState('')
  const [nameSearching, setNameSearching]   = useState(false)
  const [nameSearchError, setNameSearchError] = useState('')

  // ── Business logic — unchanged ──────────────────────────────────────
  function checkAndConfirm(data) {
    if (enrolledStudentIds.includes(data.id)) {
      return 'This student is already enrolled in an active campaign. Each child can only have one active campaign at a time.'
    }
    onStudentConfirmed(data)
    return null
  }

  async function handleIdLookup() {
    const val = studentIdInput.trim()
    if (!val) { setLookupError('Please enter a student ID.'); return }
    setLookingUp(true); setLookupError('')
    try {
      const { data, error } = await supabase.from('students').select('id, first_name, last_name, partna_student_id, school_student_id, year_group').eq('business_id', businessId).eq('is_active', true).or(`partna_student_id.eq.${val.toUpperCase()},school_student_id.eq.${val}`).maybeSingle()
      if (error || !data) { setLookupError("No student found with that ID. Please check the ID and try again, or use \"I don't know the Student ID number\" below."); setLookingUp(false); return }
      const err = checkAndConfirm(data)
      if (err) setLookupError(err)
    } catch (e) { console.error('Student ID lookup error:', e); setLookupError('Something went wrong. Please try again.') }
    setLookingUp(false)
  }

  async function handleNameLookup() {
    const first = nameFirst.trim(); const last = nameLast.trim(); const year = nameYear.trim()
    if (!first) { setNameSearchError('Please enter the first name.'); return }
    if (!last)  { setNameSearchError('Please enter the last name.'); return }
    if (!year)  { setNameSearchError('Please enter the year group or class.'); return }
    setNameSearching(true); setNameSearchError('')
    try {
      const { data, error } = await supabase.from('students').select('id, first_name, last_name, partna_student_id, school_student_id, year_group').eq('business_id', businessId).eq('is_active', true).ilike('first_name', first).ilike('last_name', last).ilike('year_group', year).maybeSingle()
      if (error || !data) { setNameSearchError('No student found with those details. Please check the spelling and year group, and try again. If the problem continues, contact your school office.'); setNameSearching(false); return }
      const err = checkAndConfirm(data)
      if (err) setNameSearchError(err)
    } catch (e) { console.error('Student name lookup error:', e); setNameSearchError('Something went wrong. Please try again.') }
    setNameSearching(false)
  }

  // ── Confirmed state ─────────────────────────────────────────────────
  if (confirmedStudent) {
    return (
      <div style={{ background: C.bgGreen, border: `1px solid ${C.green}`, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{confirmedStudent.first_name} {confirmedStudent.last_name}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: C.green }}>{confirmedStudent.partna_student_id}</span>
              {confirmedStudent.year_group && <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>· {confirmedStudent.year_group}</span>}
            </div>
          </div>
        </div>
        <button
          onClick={() => { onClear(); setStudentIdInput(''); setLookupError(''); setShowNameSearch(false); setNameFirst(''); setNameLast(''); setNameYear(''); setNameSearchError('') }}
          style={{ ...btnSecondary, padding: '6px 12px', fontSize: 12 }}
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!showNameSearch && (
        <>
          <div style={{ background: C.bg, border: `1px solid ${C.grayLine}`, borderRadius: 8, padding: '12px 14px', fontSize: 13, fontWeight: 500, color: C.secondary, lineHeight: '140%' }}>
            Enter your child's <strong style={{ color: C.black }}>Student ID number</strong> (e.g. ADM-001, STU-001). You can find this on any fee statement, admission letter, or registration document.
          </div>
          <div>
            <label style={labelStyle}>Student ID number</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={{ ...inputStyle, flex: 1, textTransform: 'uppercase', borderColor: lookupError ? C.red : C.grayLine }}
                type="text" placeholder="e.g. ADM-001, STU-001"
                value={studentIdInput}
                onChange={e => { setStudentIdInput(e.target.value); setLookupError('') }}
                onKeyDown={e => e.key === 'Enter' && handleIdLookup()}
                onFocus={e => e.target.style.borderColor = C.black}
                onBlur={e => e.target.style.borderColor = lookupError ? C.red : C.grayLine}
              />
              <button
                onClick={handleIdLookup} disabled={lookingUp || !studentIdInput.trim()}
                style={{ ...btnPrimary, flexShrink: 0, opacity: lookingUp || !studentIdInput.trim() ? 0.45 : 1 }}
              >
                {lookingUp ? <div className="spinner spinner-sm spinner-light" /> : 'Find'}
              </button>
            </div>
            {lookupError && <p style={{ fontSize: 12, fontWeight: 500, color: C.red, margin: '4px 0 0' }}>{lookupError}</p>}
          </div>
          <button onClick={() => { setShowNameSearch(true); setLookupError('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.black, textDecoration: 'underline', textUnderlineOffset: 3, textAlign: 'left', padding: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>
            I don't know the Student ID number
          </button>
        </>
      )}

      {showNameSearch && (
        <>
          <div style={{ background: C.bgOrange, border: `1px solid ${C.orange}`, borderRadius: 8, padding: '12px 14px', fontSize: 13, fontWeight: 500, color: C.orange, lineHeight: '140%' }}>
            Enter your child's <strong>exact</strong> first name, last name, and year group or class as registered at school. All three must match exactly.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>First name</label>
              <input style={inputStyle} type="text" placeholder="e.g. Sarah" value={nameFirst} onChange={e => { setNameFirst(e.target.value); setNameSearchError('') }} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
            </div>
            <div>
              <label style={labelStyle}>Last name</label>
              <input style={inputStyle} type="text" placeholder="e.g. Nakato" value={nameLast} onChange={e => { setNameLast(e.target.value); setNameSearchError('') }} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Year group / Class</label>
            <input style={inputStyle} type="text" placeholder="e.g. S3, P6, Form 4, Year 2" value={nameYear} onChange={e => { setNameYear(e.target.value); setNameSearchError('') }} onFocus={e => e.target.style.borderColor = C.black} onBlur={e => e.target.style.borderColor = C.grayLine} />
            <p style={{ fontSize: 12, fontWeight: 500, color: C.grayMid, margin: '4px 0 0' }}>Enter exactly as it appears on your institution's correspondence.</p>
          </div>
          {nameSearchError && <div style={{ background: C.bgRed, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.red }}>{nameSearchError}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setShowNameSearch(false); setNameSearchError(''); setNameFirst(''); setNameLast(''); setNameYear('') }} style={{ ...btnSecondary, flex: 1 }}>Back</button>
            <button onClick={handleNameLookup} disabled={nameSearching || !nameFirst.trim() || !nameLast.trim() || !nameYear.trim()} style={{ ...btnPrimary, flex: 2, opacity: nameSearching || !nameFirst.trim() || !nameLast.trim() || !nameYear.trim() ? 0.45 : 1 }}>
              {nameSearching ? <><div className="spinner spinner-sm spinner-light" /> Searching…</> : 'Find my child'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Campaign detail + enroll card ──────────────────────────────────────────
function CampaignDetailCard({ campaign, customer, brand, cardFlipped, setCardFlipped, agreed, setAgreed, saving, onConfirm, alreadyEnrolled, isEducation, businessId, enrolledStudentIds, confirmedStudent, onStudentConfirmed, onStudentClear }) {
  const isEduCampaign = campaign.campaign_type === 'education_fees'
  const canEnroll     = !isEduCampaign || (isEduCampaign && !!confirmedStudent)

  const detailRows = isEduCampaign ? [
    { label: 'Fee type',           value: FEE_TYPE_LABELS[campaign.fee_type] || campaign.fee_type || '—' },
    ...(campaign.academic_year    ? [{ label: 'Academic year',           value: campaign.academic_year }]    : []),
    ...(campaign.term_or_semester ? [{ label: 'Term',                   value: campaign.term_or_semester }] : []),
    { label: 'Total fees',                                                value: formatUGX(campaign.target_amount) },
    { label: 'Payment deadline',                                          value: formatDate(campaign.target_date) },
    ...(campaign.minimum_payment > 0                    ? [{ label: 'Minimum per payment',            value: formatUGX(campaign.minimum_payment) }]              : []),
    ...(campaign.minimum_registration_amount > 0         ? [{ label: 'Registration threshold (info)', value: formatUGX(campaign.minimum_registration_amount) }]  : []),
  ] : [
    { label: 'Target amount',      value: formatUGX(campaign.target_amount) },
    { label: 'Deadline',           value: formatDate(campaign.target_date)  },
    { label: 'Minimum deposit',    value: campaign.minimum_deposit > 0 ? formatUGX(campaign.minimum_deposit) : 'None' },
    { label: 'Payment installments', value: campaign.allow_partial_payments ? 'Yes' : 'No' },
  ]

  return (
    <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, overflow: 'hidden' }}>

      {/* Card preview */}
      <div style={{ background: C.black, padding: '24px 20px 20px', borderBottom: `1px solid ${C.grayLine}` }}>
        <PreviewCard customer={customer} brand={brand} flipped={cardFlipped} onFlip={() => setCardFlipped(f => !f)} />
        <p style={{ textAlign: 'center', marginTop: 8, fontSize: 9, fontWeight: 500, color: 'rgba(255,255,255,0.3)', margin: '8px 0 0' }}>
          Your savings card preview · Tap to flip
        </p>
      </div>

      {/* Campaign info */}
      <div style={{ padding: '20px 20px 0' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.secondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {isEduCampaign ? 'Education fees' : 'Campaign'}
        </span>
        <h3 style={{ fontSize: 20, fontWeight: 600, color: C.black, letterSpacing: '-0.5px', margin: '6px 0 8px' }}>{campaign.name}</h3>
        {campaign.description && (
          <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, lineHeight: '140%', margin: '0 0 16px' }}>{campaign.description}</p>
        )}

        {alreadyEnrolled && (
          <div style={{ background: C.bgGreen, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.green, marginBottom: 16 }}>
            You are already enrolled in this campaign.
          </div>
        )}

        {/* Detail rows */}
        <div style={{ border: `1px solid ${C.stroke}`, borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
          {detailRows.map((row, i, arr) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${C.grayLine}` : 'none', background: i % 2 === 0 ? C.white : C.bg }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.secondary }}>{row.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.black }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Student ID lookup — education only */}
      {isEduCampaign && !alreadyEnrolled && (
        <div style={{ padding: '0 20px 20px' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: C.secondary, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Which child is this for?</p>
          <StudentIdLookup businessId={businessId} enrolledStudentIds={enrolledStudentIds} confirmedStudent={confirmedStudent} onStudentConfirmed={onStudentConfirmed} onClear={onStudentClear} />
        </div>
      )}

      {/* Enroll CTA */}
      {!alreadyEnrolled && (
        <div style={{ padding: '16px 20px 20px', borderTop: `1px solid ${C.grayLine}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isEduCampaign && !confirmedStudent && (
            <div style={{ background: C.bgOrange, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.orange }}>
              Please find and confirm your child's student ID above before enrolling.
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: canEnroll ? 'pointer' : 'not-allowed', opacity: canEnroll ? 1 : 0.5 }}>
            <input
              type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} disabled={!canEnroll}
              style={{ marginTop: 2, flexShrink: 0, width: 16, height: 16, accentColor: C.black }}
            />
            <span style={{ fontSize: 13, fontWeight: 500, color: C.secondary, lineHeight: '140%' }}>
              I agree to the savings campaign terms and conditions. I understand the target amount, deadline, and payment requirements for this campaign.
            </span>
          </label>

          <button
            onClick={onConfirm} disabled={!agreed || saving || !canEnroll}
            style={{ ...btnPrimary, width: '100%', padding: '11px 18px', opacity: !agreed || saving || !canEnroll ? 0.45 : 1, cursor: !agreed || saving || !canEnroll ? 'not-allowed' : 'pointer' }}
          >
            {saving ? <><div className="spinner spinner-sm spinner-light" /> Enrolling…</> : 'Join this campaign'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function SelectCampaign({
 customer, business }) {
  useEffect(() => { document.title = 'Select Campaign - Partna' }, [])

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
  const [enrolledStudentIds, setEnrolledStudentIds]   = useState([])
  const [confirmedStudent, setConfirmedStudent]   = useState(null)

  useEffect(() => { if (business?.id && customer?.id) loadData() }, [business, customer])
  useEffect(() => { setConfirmedStudent(null); setAgreed(false) }, [selectedCampaign?.id])

  // ── All business logic — unchanged ────────────────────────────────────

  async function loadData() {
    setLoading(true)
    const { data: existingEnrollments } = await supabase.from('customer_campaigns').select('campaign_id, student_id').eq('customer_id', customer.id).eq('status', 'active')
    setEnrolledCampaignIds((existingEnrollments || []).map(e => e.campaign_id))
    setEnrolledStudentIds((existingEnrollments || []).map(e => e.student_id).filter(Boolean))
    if (!isRetail) {
      const { data } = await supabase.from('campaigns').select('*').eq('business_id', business.id).eq('status', 'active').order('created_at', { ascending: false })
      const found = data || []
      setCampaigns(found)
      if (found.length === 1) setSelectedCampaign(found[0])
    }
    setLoading(false)
  }

  async function handleProductSearch(val) {
    setProductQuery(val); setRetailCampaign(null); setProductError(''); setAgreed(false)
    if (val.length < 1) { setProductResults([]); setShowDropdown(false); return }
    const { data: products } = await supabase.from('products').select('*').eq('business_id', business.id).eq('is_active', true).or(`name.ilike.%${val}%,product_code.ilike.%${val}%`).limit(10)
    if (!products || products.length === 0) { setProductResults([]); setShowDropdown(true); return }
    const { data: camps } = await supabase.from('campaigns').select('product_code').eq('business_id', business.id).eq('status', 'active')
    const validCodes = new Set((camps || []).map(c => c.product_code).filter(Boolean))
    setProductResults(products.filter(p => validCodes.has(p.product_code)))
    setShowDropdown(true)
  }

  async function handleSelectProduct(product) {
    setProductQuery(product.name + '  ·  ' + product.product_code); setShowDropdown(false); setProductError(''); setAgreed(false); setRetailCampaign(null)
    const { data: camps } = await supabase.from('campaigns').select('*').eq('business_id', business.id).eq('status', 'active').eq('product_code', product.product_code).limit(1)
    if (camps && camps.length > 0) { setRetailCampaign(camps[0]) } else { setProductError('No active campaign found for this product.') }
  }

  async function handleConfirm() {
    const campaign = isRetail ? retailCampaign : selectedCampaign
    if (!campaign || !agreed) return
    if (enrolledCampaignIds.includes(campaign.id)) { navigate('/portal/home', { replace: true }); return }
    const isEduCampaign = campaign.campaign_type === 'education_fees'
    if (isEduCampaign && !confirmedStudent) return
    setSaving(true)
    try {
      const drawCode = generateDrawCode()
      const enrollPayload = { customer_id: customer.id, campaign_id: campaign.id, business_id: business.id, draw_code: drawCode, status: 'active', ...(isEduCampaign && confirmedStudent ? { student_id: confirmedStudent.id } : {}) }
      const { data: enrollment, error: enrollError } = await supabase.from('customer_campaigns').insert(enrollPayload).select().single()
      if (enrollError) { console.error('Enrollment error:', enrollError); setSaving(false); return }
      const { data: wallet, error: walletError } = await supabase.from('wallets').insert({ customer_id: customer.id, customer_campaign_id: enrollment.id, balance: 0 }).select().single()
      if (walletError) { console.error('Wallet creation error:', walletError); setSaving(false); return }
      await supabase.from('customer_campaigns').update({ wallet_id: wallet.id }).eq('id', enrollment.id)
      if (customer?.phone) sendSMS(customer.id, customer.phone, 'campaign_enrolled', { campaign: campaign.name, draw_code: drawCode })
      if (enrolledCampaignIds.length === 0) { navigate('/portal/kyc', { replace: true }) } else { navigate('/portal/home', { replace: true }) }
    } catch (e) { console.error('Campaign selection error:', e) }
    setSaving(false)
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner spinner-lg" />
    </div>
  )

  const availableCampaigns = campaigns.filter(c => !enrolledCampaignIds.includes(c.id))
  const hasEnrollments     = enrolledCampaignIds.length > 0

  const detailProps = {
    customer, brand, cardFlipped, setCardFlipped, agreed, setAgreed, saving, onConfirm: handleConfirm,
    isEducation: business?.sector === 'Education',
    businessId: business?.id,
    enrolledStudentIds, confirmedStudent,
    onStudentConfirmed: setConfirmedStudent,
    onStudentClear: () => { setConfirmedStudent(null); setAgreed(false) },
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Topbar ── */}
      <header style={{ background: C.white, borderBottom: `1px solid ${C.stroke}`, padding: '14px 20px', position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {brand.logoUrl
            ? <img src={brand.logoUrl} alt={brand.businessName} style={{ height: 26, width: 'auto' }} />
            : <span style={{ fontSize: 18, fontWeight: 600, color: C.black, letterSpacing: '-1px' }}>{brand.businessName}</span>
          }
        </div>
        {hasEnrollments && (
          <button onClick={() => navigate('/portal/home')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: C.secondary, padding: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>
            ← Back
          </button>
        )}
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 20px 48px' }}>
        <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Heading ── */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: '0 0 8px' }}>
              {hasEnrollments ? 'Add campaign' : 'Get started'}
            </p>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: C.black, letterSpacing: '-1px', lineHeight: '130%', margin: '0 0 6px' }}>
              {hasEnrollments ? 'Add another campaign' : 'Choose your campaign'}
            </h1>
            <p style={{ fontSize: 14, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '140%' }}>
              {isRetail
                ? 'Enter a product code or name to find your savings campaign.'
                : availableCampaigns.length === 1
                ? 'Review the campaign details and agree to the terms to continue.'
                : 'Select the campaign you want to save toward.'}
            </p>
            {!hasEnrollments && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, padding: '6px 12px', background: C.labelBg, borderRadius: 999 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span style={{ fontSize: 12, fontWeight: 500, color: C.secondary }}>You must select at least one campaign to continue</span>
              </div>
            )}
          </div>

          {/* ── RETAIL FLOW ── */}
          {isRetail && (
            <>
              <div style={{ position: 'relative' }}>
                <label style={labelStyle}>Product code or name</label>
                <input
                  style={inputStyle} type="text" placeholder="Enter product code or name…"
                  value={productQuery}
                  onChange={e => handleProductSearch(e.target.value)}
                  onFocus={() => productResults.length > 0 && setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  onFocusCapture={e => e.target.style.borderColor = C.black}
                  onBlurCapture={e => e.target.style.borderColor = C.grayLine}
                />
                {showDropdown && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 10, boxShadow: '0 4px 16px rgba(17,17,17,0.10)', zIndex: 100, marginTop: 4, overflow: 'hidden' }}>
                    {productResults.length === 0 ? (
                      <div style={{ padding: '14px 16px', fontSize: 13, fontWeight: 500, color: C.secondary }}>No products with active campaigns found.</div>
                    ) : productResults.map((p, i) => (
                      <button
                        key={p.id} onMouseDown={() => handleSelectProduct(p)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'none', border: 'none', borderBottom: i < productResults.length - 1 ? `1px solid ${C.grayLine}` : 'none', cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => e.currentTarget.style.background = C.bg}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 600, color: C.black, margin: '0 0 2px' }}>{p.name}</p>
                          {p.description && <p style={{ fontSize: 12, fontWeight: 500, color: C.secondary, margin: 0 }}>{p.description}</p>}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                          <p style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 12, color: C.green, margin: '0 0 2px' }}>{p.product_code}</p>
                          <p style={{ fontSize: 12, fontWeight: 600, color: C.black, margin: 0 }}>{formatUGX(p.price)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {productError && <div style={{ background: C.bgRed, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: C.red }}>{productError}</div>}
              {retailCampaign && <CampaignDetailCard campaign={retailCampaign} alreadyEnrolled={enrolledCampaignIds.includes(retailCampaign.id)} {...detailProps} />}
            </>
          )}

          {/* ── NON-RETAIL FLOW ── */}
          {!isRetail && (
            <>
              {availableCampaigns.length === 0 && !hasEnrollments && (
                <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '40px 20px', textAlign: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: C.labelBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.grayMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: '0 0 6px' }}>No campaigns available yet</p>
                  <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0, lineHeight: '140%' }}>Your institution hasn't launched any active campaigns yet. Please check back later or contact your institution.</p>
                </div>
              )}

              {availableCampaigns.length === 0 && hasEnrollments && (
                <div style={{ background: C.white, border: `1px solid ${C.stroke}`, borderRadius: 12, padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: C.black, margin: 0 }}>You're enrolled in all available campaigns</p>
                  <p style={{ fontSize: 13, fontWeight: 500, color: C.secondary, margin: 0 }}>There are no additional campaigns to join right now.</p>
                  <button onClick={() => navigate('/portal/home')} style={{ ...btnPrimary, marginTop: 4 }}>Back to home</button>
                </div>
              )}

              {availableCampaigns.length === 1 && (
                <CampaignDetailCard campaign={availableCampaigns[0]} alreadyEnrolled={enrolledCampaignIds.includes(availableCampaigns[0].id)} {...detailProps} />
              )}

              {availableCampaigns.length > 1 && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {availableCampaigns.map(c => {
                      const isSelected = selectedCampaign?.id === c.id
                      const isEduC     = c.campaign_type === 'education_fees'
                      return (
                        <button
                          key={c.id}
                          onClick={() => { setSelectedCampaign(c); setAgreed(false); setCardFlipped(false) }}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: isSelected ? C.black : C.white, border: `1px solid ${isSelected ? C.black : C.stroke}`, borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                        >
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 600, color: isSelected ? C.white : C.black, margin: '0 0 3px' }}>{c.name}</p>
                            <p style={{ fontSize: 12, fontWeight: 500, color: isSelected ? 'rgba(255,255,255,0.6)' : C.secondary, margin: 0 }}>
                              {isEduC ? `${FEE_TYPE_LABELS[c.fee_type] || c.fee_type || 'Fees'} · ${formatUGX(c.target_amount)} · Due ${formatDate(c.target_date)}` : `${formatUGX(c.target_amount)} · Due ${formatDate(c.target_date)}`}
                            </p>
                          </div>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${isSelected ? C.white : C.grayLine}`, background: isSelected ? C.white : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 12, transition: 'all 0.15s' }}>
                            {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.black} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  {selectedCampaign && <CampaignDetailCard campaign={selectedCampaign} alreadyEnrolled={enrolledCampaignIds.includes(selectedCampaign.id)} {...detailProps} />}
                </>
              )}
            </>
          )}

        </div>
      </div>

      {/* ── Footer ── */}
      <footer style={{ padding: '16px 20px', borderTop: `1px solid ${C.grayLine}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: C.grayMid }}>Powered by Partna</span>
      </footer>

    </div>
  )
}