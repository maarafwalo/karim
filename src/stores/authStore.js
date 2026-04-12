import { create } from 'zustand'
import { supabase } from '../lib/supabase.js'

export const useAuthStore = create((set, get) => ({
  user:    null,
  profile: null,
  loading: true,

  init: async () => {
    // Restore session from localStorage first — works across refreshes
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) await get()._fetchProfile(session.user)
    set({ loading: false })

    // Then listen for future auth changes (login / logout / token refresh)
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await get()._fetchProfile(session.user)
      } else if (event === 'SIGNED_OUT') {
        set({ user: null, profile: null })
      }
    })
  },

  _fetchProfile: async (user) => {
    const { data: profile } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    // Always prefer user_metadata.role — it holds the true role set at account
    // creation and isn't limited by the DB enum (which may be missing new values).
    const metaRole = user.user_metadata?.role
    const metaName = user.user_metadata?.full_name
    const effective = profile
      ? { ...profile, ...(metaRole && { role: metaRole }), ...(metaName && { full_name: metaName }) }
      : (metaRole ? { id: user.id, full_name: metaName || '', role: metaRole } : null)
    set({ user, profile: effective })
  },

  signIn: async (email, password) => {
    // Clear in-memory session + localStorage before signing in.
    // signOut({ scope:'local' }) clears the SDK's internal state (no HTTP call),
    // which releases any Web Lock held by a stale token refresh and lets
    // signInWithPassword acquire the lock immediately.
    try { await supabase.auth.signOut({ scope: 'local' }) } catch {}
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null })
  },

  // Admin: create a new user with a role
  createUser: async ({ email, password, full_name, role, phone }) => {
    // Uses Supabase Admin API via edge function or service key
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: { email, password, full_name, role, phone }
    })
    return { data, error }
  },
}))
