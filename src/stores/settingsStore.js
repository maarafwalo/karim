import { create } from 'zustand'
import { supabase } from '../lib/supabase.js'

const DEFAULTS = {
  store_name:   'joud',
  phone:        '212761568529',
  currency:     'درهم',
  tva_rate:     0,
  cashier_name: '',
  logo_url:     '',
}

export const useSettingsStore = create((set, get) => ({
  settings: DEFAULTS,
  loading:  false,

  load: async () => {
    set({ loading: true })
    const { data } = await supabase.from('store_settings').select('*').eq('id', 1).single()
    set({ settings: data || DEFAULTS, loading: false })
  },

  save: async (updates) => {
    const { error } = await supabase
      .from('store_settings')
      .upsert({ id: 1, ...get().settings, ...updates, updated_at: new Date().toISOString() })
    if (!error) set(state => ({ settings: { ...state.settings, ...updates } }))
    return error
  },

  get tva() { return get().settings.tva_rate || 0 },
  get currency() { return get().settings.currency || 'درهم' },
  get storeName() { return get().settings.store_name || 'joud' },
}))
