import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export function useAuth() {
  const [customer, setCustomer] = useState(null)
  const [business, setBusiness] = useState(null)
  const [campaign, setCampaign] = useState(null)
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
          setCampaign(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function fetchCustomer(userId) {
    const { data: customerData } = await supabase
      .from('customers')
      .select('*')
      .eq('auth_user_id', userId)

    if (!customerData || customerData.length === 0) {
      setLoading(false)
      return
    }

    const c = customerData[0]
    setCustomer(c)

    // Fetch business branding
    if (c.business_id) {
      const { data: businessData } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', c.business_id)

      if (businessData && businessData.length > 0) {
        setBusiness(businessData[0])
      }
    }

    // Fetch customer's selected campaign (needed for HomeGuard deletion check)
    if (c.campaign_id) {
      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', c.campaign_id)
        .maybeSingle()

      setCampaign(campaignData || null)
    } else {
      setCampaign(null)
    }

    setLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setCustomer(null)
    setBusiness(null)
    setCampaign(null)
  }

  return {
    customer,
    business,
    campaign,
    loading,
    signOut,
    refetch: () => customer && fetchCustomer(customer.auth_user_id)
  }
}