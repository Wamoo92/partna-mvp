import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

async function checkIsAdmin(user) {
  if (!user) return false
  const { data: allAdmins } = await supabase
    .from('admin_users')
    .select('email')
  if (!allAdmins) return false
  return allAdmins.some(a => a.email.toLowerCase().trim() === user.email.toLowerCase().trim())
}

export function useAdminAuth() {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check existing session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const isAdmin = await checkIsAdmin(session.user)
        if (isAdmin) {
          setAdmin(session.user)
        }
      }
      setLoading(false)
    })

    // Listen for sign in events (fires after AdminLogin navigates)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const isAdmin = await checkIsAdmin(session.user)
        if (isAdmin) {
          setAdmin(session.user)
        } else {
          setAdmin(null)
        }
        setLoading(false)
      } else if (event === 'SIGNED_OUT') {
        setAdmin(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    setAdmin(null)
  }

  return { admin, loading, signOut }
}