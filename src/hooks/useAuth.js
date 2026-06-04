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
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        wallets (*),
        cards (*),
        campaigns (*)
      `)
      .eq('auth_user_id', userId)
      .single()

    if (error) {
      console.error('Error fetching customer:', error)
      setLoading(false)
      return
    }

    setCustomer(data)
    setLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setCustomer(null)
  }

  return { customer, loading, signOut, refetch: () => customer && fetchCustomer(customer.auth_user_id) }
}