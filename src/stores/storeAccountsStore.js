import { create } from 'zustand'
import { supabase } from '../lib/supabase.js'

export const useStoreAccountsStore = create((set, get) => ({
  transactions: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('branch_transactions')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    if (!error && data) set({ transactions: data })
    set({ loading: false })
  },

  addTransaction: async (payload) => {
    // Optimistic local insert
    const local = { id: 'local-' + Date.now(), ...payload, created_at: new Date().toISOString() }
    set(s => ({ transactions: [local, ...s.transactions] }))

    const { data, error } = await supabase
      .from('branch_transactions')
      .insert({
        store_id: payload.store_id,
        type:     payload.type,
        amount:   payload.amount,
        notes:    payload.notes || null,
        date:     payload.date,
      })
      .select()
      .single()

    if (error) {
      // Rollback
      set(s => ({ transactions: s.transactions.filter(t => t.id !== local.id) }))
      return { error }
    }
    // Replace local with real DB row
    set(s => ({ transactions: s.transactions.map(t => t.id === local.id ? data : t) }))
    return { error: null }
  },

  deleteTransaction: async (id) => {
    set(s => ({ transactions: s.transactions.filter(t => t.id !== id) }))
    const { error } = await supabase.from('branch_transactions').delete().eq('id', id)
    if (error) {
      get().load() // Reload to restore
      return { error }
    }
    return { error: null }
  },
}))
