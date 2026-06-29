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
  // false until the subdomain lookup has DEFINITIVELY completed. App.jsx must only
  // render "Portal not found" once this is true and no business was found — never
  // while the lookup is still in flight (which caused a black flash).
  const [subdomainResolved, setSubdomainResolved] = useState(false)
  const [enrollments, setEnrollments]     = useState([])
  const [loading, setLoading]             = useState(true)

  // ── Step 1: detect subdomain and load business on mount ───────────────
  useEffect(() => {
    loadSubdomainBusiness()
  }, [])

  async function loadSubdomainBusiness() {
    const slug = detectSubdomainSlug()
    if (!slug) { setSubdomainResolved(true); return } // localhost or www — nothing to resolve

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
    } finally {
      setSubdomainResolved(true)
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

  // ── Cross-institution isolation ───────────────────────────────────────
  // If we're on an institution subdomain and the loaded customer belongs to a
  // DIFFERENT business, sign them out. This runs only once BOTH the customer and
  // the subdomain business are resolved, so it can't be skipped by the earlier
  // stale-closure race (where subdomainBusiness was still null during fetchCustomer).
  useEffect(() => {
    if (customer && subdomainBusiness && customer.business_id !== subdomainBusiness.id) {
      console.warn('Customer business mismatch — signing out')
      supabase.auth.signOut()
    }
  }, [customer, subdomainBusiness])

  async function fetchCustomer(userId, { silent = false } = {}) {
    // Mark loading while the customer row is fetched. Without this, right after
    // signInWithPassword the app has a session but customer === null and
    // loading === false, so the route guards would treat the user as logged out
    // and bounce them back to /portal/login (login appeared to need two tries).
    //
    // A "silent" refresh (refetch from a money flow) must NOT flip loading: the
    // route guards (HomeGuard) render a spinner while loading is true, which
    // UNMOUNTS the current screen (e.g. Pay) and remounts it fresh — resetting it
    // to step 1 and discarding the success step. So silent refetches refresh data
    // in place without ever touching loading.
    if (!silent) setLoading(true)
    try {
      const { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('auth_user_id', userId)
        .maybeSingle()

      if (!customerData) {
        if (!silent) setLoading(false)
        return
      }

      // Check account hasn't been deleted
      if (customerData.registration_status === 'deleted') {
        await supabase.auth.signOut()
        if (!silent) setLoading(false)
        return
      }

      // Cross-institution isolation is enforced by a dedicated effect below that
      // waits until BOTH the customer and the subdomain business are loaded — doing
      // it here was unreliable because subdomainBusiness was usually still null in
      // this closure (it loads in a separate async effect), so the check never fired.

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

    if (!silent) setLoading(false)
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
    subdomainResolved,
    enrollments,
    loading,
    signOut,
    refetch: () => customer && fetchCustomer(customer.auth_user_id, { silent: true }),
  }
}