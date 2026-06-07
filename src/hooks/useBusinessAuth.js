import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export function useBusinessAuth() {
  const [admin, setAdmin] = useState(null)
  const [business, setBusiness] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchAdmin(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          fetchAdmin(session.user.id)
        } else {
          setAdmin(null)
          setBusiness(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function fetchAdmin(userId) {
    const { data: adminData } = await supabase
      .from('business_admins')
      .select('*')
      .eq('auth_user_id', userId)

    if (!adminData || adminData.length === 0) {
      setLoading(false)
      return
    }

    const a = adminData[0]
    setAdmin(a)

    if (a.business_id) {
      const { data: businessData } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', a.business_id)

      if (businessData && businessData.length > 0) {
        setBusiness(businessData[0])
      }
    }

    setLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setAdmin(null)
    setBusiness(null)
  }

  return {
    admin,
    business,
    loading,
    signOut,
    refetch: () => admin && fetchAdmin(admin.auth_user_id)
  }
}