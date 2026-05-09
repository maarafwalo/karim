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
        // Cap at stock if defined (null = no limit, e.g. weight-priced items)
        const stockLimit = (product.stock != null) ? product.stock : Infinity
        if (ex) {
          if (ex.qty >= stockLimit) return s   // already at stock; no-op
          return { items: s.items.map(b => b.product.id === product.id ? { ...b, qty: b.qty + 1 } : b) }
        }
        if (stockLimit <= 0) return s
        // Snapshot the original price at add-time so realtime price changes
        // don't retroactively change what the vendor saw / signed off on.
        return { items: [...s.items, {
          product,
          qty: 1,
          negotiatedPrice: product.sell_price,
          originalPrice:   product.sell_price,
        }]}
      }),

      removeItem: (id) => set((s) => ({ items: s.items.filter(b => b.product.id !== id) })),

      decItem: (id) => set((s) => ({
        items: s.items
          .map(b => b.product.id === id ? { ...b, qty: b.qty - 1 } : b)
          .filter(b => b.qty > 0),
      })),

      setNegPrice: (id, price) => set((s) => ({
        items: s.items.map(b => b.product.id === id
          ? { ...b, negotiatedPrice: Math.max(0, parseFloat(price) || 0) }
          : b),
      })),

      // Partial pack split: { units, packSize } — null clears it
      setPartial: (id, partial) => set((s) => ({
        items: s.items.map(b => {
          if (b.product.id !== id) return b
          if (!partial) {
            const { partial: _omit, ...rest } = b
            return { ...rest, negotiatedPrice: b.originalPrice ?? b.product.sell_price }
          }
          // Guard against malformed input: divide-by-zero / negative pack size
          if (!partial.packSize || partial.packSize <= 0) return b
          if (partial.units == null || partial.units < 0) return b
          const base  = b.originalPrice ?? b.product.sell_price
          const ratio = partial.units / partial.packSize
          const newPrice = +(base * ratio).toFixed(2)
          return { ...b, partial, negotiatedPrice: newPrice }
        }),
      })),

      // Drop bag items whose product_id no longer matches a live product.
      // Called when productsStore loads / a realtime DELETE fires — keeps the
      // saved order from referencing a deleted product (FK violation).
      reconcile: (liveProducts) => set((s) => {
        if (!liveProducts?.length || !s.items.length) return s
        const liveIds = new Set(liveProducts.map(p => p.id))
        const next = s.items.filter(b => liveIds.has(b.product.id))
        return next.length === s.items.length ? s : { items: next }
      }),

      clear: () => set({
        items: [],
        customer: { name: '', phone: '', address: '' },
        editingOrder: null,
      }),
    }),
    {
      name: 'joud_bag',
      // Bump this when the persisted shape changes incompatibly so old browsers
      // don't blow up after a deploy.
      version: 2,
      partialize: (s) => ({ items: s.items, customer: s.customer, editingOrder: s.editingOrder }),
      migrate: (persisted, fromVersion) => {
        if (!persisted) return persisted
        // v0/v1 → v2: items lacked originalPrice. Backfill from product.sell_price.
        if (fromVersion < 2 && Array.isArray(persisted.items)) {
          persisted.items = persisted.items
            // Drop entries that no longer match the expected nested shape.
            .filter(it => it && it.product && typeof it.product.id !== 'undefined')
            .map(it => ({
              ...it,
              originalPrice: typeof it.originalPrice === 'number'
                ? it.originalPrice
                : (it.product?.sell_price ?? it.negotiatedPrice ?? 0),
            }))
        }
        return persisted
      },
    }
  )
)
