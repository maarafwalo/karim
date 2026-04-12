import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://tatimyttuxxyeyxztawn.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhdGlteXR0dXh4eWV5eHp0YXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MjQ2MDcsImV4cCI6MjA5MTAwMDYwN30.o04exxcvbb7dnAXQ6XONKIwtft5VnVGAQ5Tx75j3o1g'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: false,
  },
})
