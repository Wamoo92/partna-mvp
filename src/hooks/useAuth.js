import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export function useAuth() {
  const [customer, setCustomer] = useState(null)
  const [business, setBusiness] = useState(null)
  const [enrollments, setEnrollments] = useState([]) // replaces single campaign
  const [loading, setLoading] = useState(true)

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

      setCustomer(customerData)

      // Fetch business branding
      if (customerData.business_id) {
        const { data: businessData } = await supabase
          .from('businesses')
          .select('*')
          .eq('id', customerData.business_id)
          .maybeSingle()
        if (businessData) setBusiness(businessData)
      }

      // Fetch all active campaign enrollments — replaces single campaign_id lookup
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
    business,
    enrollments,
    loading,
    signOut,
    refetch: () => customer && fetchCustomer(customer.auth_user_id),
  }
}