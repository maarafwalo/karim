import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useCartStore = create(
  persist(
    (set, get) => ({
      items:          [],
      discountType:   'fixed',   // 'fixed' | 'pct'
      discountValue:  0,
      amountPaid:     0,
      paymentMethod:  'cash',    // cash | card | credit | check | debt
      notes:          '',
      customer:       null,      // { id, name, phone, address }
      returnMode:     false,

      addItem: (product) => set(state => {
        if (state.returnMode) return state  // block add during return mode
        const existing = state.items.find(i => i.id === product.id)
        const maxQty   = product.stock ?? Infinity
        if (existing) {
          if (existing.qty >= maxQty) return state
          return { items: state.items.map(i =>
            i.id === product.id ? { ...i, qty: i.qty + 1 } : i
          )}
        }
        if (maxQty <= 0) return state
        return { items: [...state.items, { ...product, qty: 1, isReturn: false }] }
      }),

      removeOne: (id) => set(state => ({
        items: state.items
          .map(i => i.id === id ? { ...i, qty: i.qty - 1 } : i)
          .filter(i => i.qty > 0)
      })),

      deleteItem:    (id)  => set(state => ({ items: state.items.filter(i => i.id !== id) })),
      setQty:        (id, qty) => set(state => ({
        items: qty <= 0
          ? state.items.filter(i => i.id !== id)
          : state.items.map(i => i.id === id ? { ...i, qty } : i)
      })),
      setDiscount:   (type, val)    => set({ discountType: type, discountValue: val }),
      setAmountPaid: (v)            => set({ amountPaid: v }),
      setPayMethod:  (m)            => set({ paymentMethod: m }),
      setNotes:      (n)            => set({ notes: n }),
      setCustomer:   (c)            => set({ customer: c }),
      setReturnMode: (v)            => set({ returnMode: v }),

      returnItem: (product) => set(state => {
        const existing = state.items.find(i => i.id === product.id && i.isReturn)
        if (existing) {
          return { items: state.items.map(i =>
            (i.id === product.id && i.isReturn) ? { ...i, qty: i.qty + 1 } : i
          )}
        }
        return { items: [...state.items, { ...product, qty: 1, isReturn: true }] }
      }),

      clear: () => set({
        items: [], discountValue: 0, amountPaid: 0,
        notes: '', customer: null, returnMode: false,
        paymentMethod: 'cash', discountType: 'fixed',
      }),

      getTotals: (tvaRate = 0) => {
        const { items, discountType, discountValue, amountPaid } = get()
        const regularItems = items.filter(i => !i.isReturn)
        const returnItems  = items.filter(i => i.isReturn)
        const subtotal     = regularItems.reduce((s, i) => s + i.sell_price * i.qty, 0)
        const returnTotal  = returnItems.reduce((s, i)  => s + i.sell_price * i.qty, 0)
        let   discount     = discountType === 'pct'
                              ? subtotal * discountValue / 100
                              : discountValue
        discount           = Math.min(Math.max(discount, 0), subtotal)
        const afterDisc    = subtotal - discount - returnTotal
        const tva          = tvaRate > 0 ? afterDisc * tvaRate / 100 : 0
        const total        = Math.max(afterDisc + tva, 0)
        const change       = amountPaid > 0 ? amountPaid - total : 0
        return { subtotal, discount, returnTotal, tva, tvaRate, total, change, amountPaid }
      },
    }),
    { name: 'joud_cart', partialize: (s) => ({ items: s.items, customer: s.customer }) }
  )
)
