import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export function useAuth() {
  const [customer, setCustomer] = useState(null)
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

    setCustomer(customerData[0])
    setLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setCustomer(null)
  }

  return {
    customer,
    loading,
    signOut,
    refetch: () => customer && fetchCustomer(customer.auth_user_id)
  }
}