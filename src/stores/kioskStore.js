import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// "Customer mode" — when the vendor hands the tablet to a customer to browse.
// Hides the back-office header (nav + logout) and locks the workspace to
// منتجات / السلة only. Persisted to localStorage so it survives refresh
// (otherwise a customer could just refresh to escape it).
//
// A PIN is required to exit. Vendor sets it when enabling; it's cleared
// when disabling (so each kiosk session uses a fresh PIN). The PIN is not
// hashed — a 4-digit code can't be meaningfully protected client-side, and
// the threat model is "curious customer", not "attacker with localStorage
// access" (who would already have full app access via devtools).
export const useKioskStore = create(
  persist(
    (set, get) => ({
      isKiosk: false,
      pin:     null,
      // Refuse short/empty PINs so a malformed call can't leave the lock
      // in an "any input unlocks" state (defense in depth — the modal also
      // enforces this, but the store is the source of truth).
      enable:  (pin) => {
        const p = String(pin || '').trim()
        if (p.length < 4) return false
        set({ isKiosk: true, pin: p })
        return true
      },
      disable: () => set({ isKiosk: false, pin: null }),
      checkPin: (input) => {
        const saved = get().pin
        // No PIN saved = no valid input. Vendors stuck here use the
        // "نسيت الرمز السري؟" recovery flow (Supabase login password)
        // instead of an implicit any-input bypass.
        if (!saved) return false
        return String(input).trim() === String(saved)
      },
    }),
    {
      name: 'joud_kiosk',
      version: 3,
      // v3: force-unlock everyone exactly once. The vendor reports of being
      // locked out across the PIN-flow churn justify a hard reset — kiosk
      // is a UX feature, not a security boundary, so a one-time wipe is fine.
      // After this lands, the new flow (PIN + "نسيت الرمز السري؟" recovery
      // via login password) is reachable and dependable.
      migrate: () => ({ isKiosk: false, pin: null }),
    }
  )
)
