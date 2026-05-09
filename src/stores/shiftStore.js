import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase.js'

export const useShiftStore = create(
  persist(
    (set, get) => ({
      currentShift: null, // { id, opened_at, opening_cash, cashier_id }
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),

      openShift: async (openingCash, cashierId) => {
        // Try to persist to Supabase; fall back to a local shift if the table doesn't exist yet
        const localShift = {
          id:           crypto.randomUUID(),
          cashier_id:   cashierId,
          opening_cash: openingCash,
          opened_at:    new Date().toISOString(),
          status:       'open',
          _local:       true, // marker so reconcile() knows this needs upgrading
        }
        try {
          const { data, error } = await supabase.from('cash_shifts').insert({
            cashier_id:   cashierId,
            opening_cash: openingCash,
            status:       'open',
          }).select().single()
          if (!error && data) {
            set({ currentShift: data })
            return { data, error: null }
          }
        } catch (_) {}
        // Fallback: local-only shift (works offline / before migration)
        set({ currentShift: localShift })
        return { data: localShift, error: null }
      },

      // If the current shift is a local-only fallback (DB write failed when
      // it was opened), try once more to upgrade it to a real cash_shifts
      // row. Call from POSPage on reconnect / on next render with internet.
      reconcileLocalShift: async () => {
        const cur = get().currentShift
        if (!cur?._local) return
        try {
          const { data, error } = await supabase.from('cash_shifts').insert({
            cashier_id:   cur.cashier_id,
            opening_cash: cur.opening_cash,
            opened_at:    cur.opened_at,
            status:       'open',
          }).select().single()
          if (!error && data) set({ currentShift: data })
        } catch (_) { /* still offline, leave it */ }
      },

      closeShift: async (closingCash, notes) => {
        const shift = get().currentShift
        if (!shift) return
        const from = shift.opened_at
        const to   = new Date().toISOString()
        // Sum cash invoices in this shift
        const { data: invData } = await supabase.from('pos_invoices')
          .select('total, payment_method')
          .eq('shift_id', shift.id)
        const cashTotal = (invData || []).filter(i => i.payment_method === 'cash').reduce((s,i) => s + (i.total||0), 0)
        const expected  = (shift.opening_cash || 0) + cashTotal
        const diff      = closingCash - expected

        await supabase.from('cash_shifts').update({
          closed_at:       to,
          closing_cash:    closingCash,
          expected_cash:   expected,
          cash_difference: diff,
          notes,
          status: 'closed',
        }).eq('id', shift.id)

        set({ currentShift: null })
      },
    }),
    {
      name: 'joud_shift',
      partialize: s => ({ currentShift: s.currentShift }),
      onRehydrateStorage: () => (state) => {
        // Called after hydration finishes (with the rehydrated state). Flip
        // _hasHydrated so consumers like POSPage stop showing the loader.
        state?.setHasHydrated?.(true)
      },
    }
  )
)
