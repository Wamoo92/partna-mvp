import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export function useBusinessAuth() {
  const [admin, setAdmin]                   = useState(null)
  const [business, setBusiness]             = useState(null)
  const [loading, setLoading]               = useState(true)
  const [mustChangePassword, setMustChangePassword] = useState(false)

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
          setMustChangePassword(false)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function fetchAdmin(userId) {
    try {
      const { data: adminData } = await supabase
        .from('business_admins')
        .select('*')
        .eq('auth_user_id', userId)
        .maybeSingle()

      if (!adminData) {
        setLoading(false)
        return
      }

      setAdmin(adminData)
      setMustChangePassword(adminData.first_login === true)

      if (adminData.business_id) {
        const { data: businessData } = await supabase
          .from('businesses')
          .select('*')
          .eq('id', adminData.business_id)
          .maybeSingle()

        if (businessData) setBusiness(businessData)
      }
    } catch (e) {
      console.error('fetchAdmin error:', e)
    }

    setLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setAdmin(null)
    setBusiness(null)
    setMustChangePassword(false)
  }

  // Called by FirstLogin.jsx after password change succeeds
  function clearFirstLogin() {
    setMustChangePassword(false)
    setAdmin(prev => prev ? { ...prev, first_login: false } : prev)
  }

  return {
    admin,
    business,
    loading,
    mustChangePassword,
    signOut,
    clearFirstLogin,
    refetch: () => admin && fetchAdmin(admin.auth_user_id),
  }
}