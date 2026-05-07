import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Catalog bag (vendor / partner side). Distinct from the POS cartStore.
export const useBagStore = create(
  persist(
    (set, get) => ({
      items:        [],   // [{ product, qty, negotiatedPrice }]
      customer:     { name: '', phone: '', address: '' },
      editingOrder: null, // { id, order_number } when modifying an existing order

      setItems:        (items) => set({ items }),
      setCustomer:     (customer) => set({ customer }),
      setEditingOrder: (editingOrder) => set({ editingOrder }),

      addItem: (product) => set((s) => {
        const ex = s.items.find(b => b.product.id === product.id)
        if (ex) return { items: s.items.map(b => b.product.id === product.id ? { ...b, qty: b.qty + 1 } : b) }
        return { items: [...s.items, { product, qty: 1, negotiatedPrice: product.sell_price }] }
      }),

      removeItem: (id) => set((s) => ({ items: s.items.filter(b => b.product.id !== id) })),

      decItem: (id) => set((s) => ({
        items: s.items
          .map(b => b.product.id === id ? { ...b, qty: b.qty - 1 } : b)
          .filter(b => b.qty > 0),
      })),

      setNegPrice: (id, price) => set((s) => ({
        items: s.items.map(b => b.product.id === id ? { ...b, negotiatedPrice: parseFloat(price) || 0 } : b),
      })),

      clear: () => set({
        items: [],
        customer: { name: '', phone: '', address: '' },
        editingOrder: null,
      }),
    }),
    {
      name: 'joud_bag',
      partialize: (s) => ({ items: s.items, customer: s.customer, editingOrder: s.editingOrder }),
    }
  )
)
