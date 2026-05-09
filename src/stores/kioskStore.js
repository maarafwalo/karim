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
      enable:  (pin) => set({ isKiosk: true, pin: String(pin) }),
      disable: () => set({ isKiosk: false, pin: null }),
      checkPin: (input) => String(input).trim() === String(get().pin),
    }),
    { name: 'joud_kiosk' }
  )
)
