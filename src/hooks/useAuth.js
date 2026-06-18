import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

// ── Subdomain detection ────────────────────────────────────────────────────
// Returns the slug from the subdomain e.g. 'stcatherines' from
// 'stcatherines.partna.io'. Returns null on localhost, 127.0.0.1,
// www.partna.io, or any hostname with no meaningful subdomain.
function detectSubdomainSlug() {
  const hostname = window.location.hostname

  // Local development — no subdomain logic
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === 'www.partna.io' ||
    hostname === 'partna.io'
  ) return null

  // Extract subdomain from *.partna.io
  const parts = hostname.split('.')
  if (parts.length >= 3 && parts.slice(-2).join('.') === 'partna.io') {
    const slug = parts[0]
    // Ignore www just in case
    if (slug && slug !== 'www') return slug
  }

  return null
}

export function useAuth() {
  const [customer, setCustomer]           = useState(null)
  const [business, setBusiness]           = useState(null)
  const [subdomainBusiness, setSubdomainBusiness] = useState(null)
  const [enrollments, setEnrollments]     = useState([])
  const [loading, setLoading]             = useState(true)

  // ── Step 1: detect subdomain and load business on mount ───────────────
  useEffect(() => {
    loadSubdomainBusiness()
  }, [])

  async function loadSubdomainBusiness() {
    const slug = detectSubdomainSlug()
    if (!slug) return // localhost or www — skip

    try {
      const { data } = await supabase
        .from('businesses')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'active')
        .maybeSingle()

      if (data) setSubdomainBusiness(data)
      // If no business found for slug, subdomainBusiness stays null
      // App.jsx will handle showing a "not found" state
    } catch (e) {
      console.error('Subdomain business lookup error:', e)
    }
  }

  // ── Step 2: auth state — runs after subdomain is known ────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchCustomer(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          fetchCustomer(session.user.id)
        } else {
          setCustomer(null)
          setBusiness(null)
          setEnrollments([])
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function fetchCustomer(userId) {
    try {
      const { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('auth_user_id', userId)
        .maybeSingle()

      if (!customerData) {
        setLoading(false)
        return
      }

      // Check account hasn't been deleted
      if (customerData.registration_status === 'deleted') {
        await supabase.auth.signOut()
        setLoading(false)
        return
      }

      // ── Security check: if a subdomain business is loaded, the customer
      // must belong to that business. If not, sign them out immediately.
      // This prevents a customer from one institution logging into another's portal.
      const slug = detectSubdomainSlug()
      if (slug && subdomainBusiness && customerData.business_id !== subdomainBusiness.id) {
        console.warn('Customer business mismatch — signing out')
        await supabase.auth.signOut()
        setLoading(false)
        return
      }

      setCustomer(customerData)

      // Fetch business branding —
      // On a subdomain: subdomainBusiness is already loaded, use it directly.
      // On localhost/www: fetch from customer's business_id as before.
      if (subdomainBusiness) {
        setBusiness(subdomainBusiness)
      } else if (customerData.business_id) {
        const { data: businessData } = await supabase
          .from('businesses')
          .select('*')
          .eq('id', customerData.business_id)
          .maybeSingle()
        if (businessData) setBusiness(businessData)
      }

      // Fetch all active campaign enrollments
      const { data: enrollmentData } = await supabase
        .from('customer_campaigns')
        .select('*, campaigns(*), wallets(*)')
        .eq('customer_id', customerData.id)
        .eq('status', 'active')
        .order('enrolled_at', { ascending: true })

      setEnrollments(enrollmentData || [])

    } catch (e) {
      console.error('fetchCustomer error:', e)
    }

    setLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setCustomer(null)
    setBusiness(null)
    setEnrollments([])
  }

  return {
    customer,
    // On a subdomain: subdomainBusiness takes priority so branding is always
    // correct even before the customer logs in (Landing, Register, Login pages).
    // On localhost/www: falls back to the customer's business as before.
    business: subdomainBusiness || business,
    subdomainBusiness,
    enrollments,
    loading,
    signOut,
    refetch: () => customer && fetchCustomer(customer.auth_user_id),
  }
}