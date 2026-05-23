import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) loadProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) loadProfile(session.user.id)
      else {
        setProfile(null)
        setRoles([])
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(authUserId) {
    try {
      // Load profile
      const { data: prof } = await supabase
        .from('profiles')
        .select('*, departments(name)')
        .eq('auth_user_id', authUserId)
        .single()

      // Load roles
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('*, roles(role_name)')
        .eq('user_id', prof?.id)

      setProfile(prof)
      setRoles(userRoles?.map(ur => ur.roles.role_name) || [])
    } catch (err) {
      console.error('Profile load error:', err)
    } finally {
      setLoading(false)
    }
  }

  function hasRole(role) {
    return roles.includes(role)
  }

  function hasAnyRole(roleList) {
    return roleList.some(r => roles.includes(r))
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signUp(email, password, name) {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name } }
    })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
    setRoles([])
  }

  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{
      session, profile, roles, loading,
      hasRole, hasAnyRole,
      signIn, signUp, signOut, resetPassword,
      refreshProfile: () => session?.user && loadProfile(session.user.id)
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
