import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// "Customer mode" — when the vendor hands the tablet to a customer to browse.
// Hides the back-office header (nav + logout) and locks the workspace to
// منتجات / السلة only. Persisted to localStorage so it survives refresh
// (otherwise a customer could just refresh to escape it).
export const useKioskStore = create(
  persist(
    (set) => ({
      isKiosk: false,
      enable:  () => set({ isKiosk: true }),
      disable: () => set({ isKiosk: false }),
    }),
    { name: 'joud_kiosk' }
  )
)
