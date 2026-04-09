import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase.js'

// Stores are persisted locally (instant) and synced to Supabase when available.
export const useStoreContext = create(
  persist(
    (set, get) => ({
      stores:      [],
      activeStore: null,

      loadStores: async () => {
        // Try Supabase; if the table isn't ready yet, keep local data
        const { data, error } = await supabase.from('stores').select('*').order('created_at')
        if (!error && data && data.length > 0) set({ stores: data })
      },

      addStore: async (payload) => {
        const localStore = { id: crypto.randomUUID(), ...payload, created_at: new Date().toISOString() }
        // Save locally first (instant)
        set(s => ({ stores: [...s.stores, localStore] }))
        // Try Supabase in background
        const { data, error } = await supabase.from('stores').insert(payload).select().single()
        if (!error && data) {
          // Replace local entry with Supabase entry (gets real UUID)
          set(s => ({ stores: s.stores.map(st => st.id === localStore.id ? data : st) }))
        }
        return { error: null }
      },

      updateStore: async (id, payload) => {
        set(s => ({ stores: s.stores.map(st => st.id === id ? { ...st, ...payload } : st) }))
        await supabase.from('stores').update(payload).eq('id', id)
        return { error: null }
      },

      deleteStore: async (id) => {
        set(s => ({
          stores: s.stores.filter(st => st.id !== id),
          activeStore: s.activeStore?.id === id ? null : s.activeStore,
        }))
        await supabase.from('stores').delete().eq('id', id)
        return { error: null }
      },

      setActiveStore: (store) => set({ activeStore: store }),
    }),
    {
      name: 'joud_store_ctx',
      partialize: s => ({ stores: s.stores, activeStore: s.activeStore }),
    }
  )
)
