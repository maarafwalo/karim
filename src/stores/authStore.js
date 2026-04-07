import { create } from 'zustand'
import { supabase } from '../lib/supabase.js'

export const useAuthStore = create((set, get) => ({
  user:    null,
  profile: null,
  loading: true,

  init: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) await get()._fetchProfile(session.user)
    set({ loading: false })

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) await get()._fetchProfile(session.user)
      else set({ user: null, profile: null })
    })
  },

  _fetchProfile: async (user) => {
    const { data: profile } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    set({ user, profile })
  },

  signIn: async (email, password) => {
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
