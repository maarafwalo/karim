import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://tatimyttuxxyeyxztawn.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhdGlteXR0dXh4eWV5eHp0YXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MjQ2MDcsImV4cCI6MjA5MTAwMDYwN30.o04exxcvbb7dnAXQ6XONKIwtft5VnVGAQ5Tx75j3o1g'

// Only clear sessions that are genuinely corrupted (missing/invalid refresh token).
// Do NOT clear just because the access token is expired — the SDK refreshes it
// automatically using the refresh token, which is valid for weeks.
// The Web Lock issue on login is handled by signOut({ scope:'local' }) in signIn().
;(function clearCorruptedSession() {
  const PREFIX = 'sb-tatimyttuxxyeyxztawn'
  const tokenKey = Object.keys(localStorage).find(k => k.startsWith(PREFIX) && k.endsWith('-auth-token'))
  if (!tokenKey) return
  try {
    const stored = JSON.parse(localStorage.getItem(tokenKey) || '{}')
    const refreshToken = stored?.refresh_token
    // Only clear if the session data is corrupted (no refresh token or clearly wrong format)
    const corrupted = !stored?.user || !refreshToken || refreshToken.length < 20
    if (corrupted) {
      Object.keys(localStorage)
        .filter(k => k.startsWith(PREFIX))
        .forEach(k => localStorage.removeItem(k))
    }
  } catch {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k))
  }
})()

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession:   true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})

// If refresh token is invalid, clear the session cleanly
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    // Remove any stale Supabase keys from localStorage
    Object.keys(localStorage)
      .filter(k => k.startsWith('sb-tatimyttuxxyeyxztawn'))
      .forEach(k => localStorage.removeItem(k))
  }
})
