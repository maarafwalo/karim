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
      heldCarts:      [],        // parked invoices: [{ id, heldAt, items, customer, notes, discountType, discountValue }]

      // ignoreStock: true when adding via barcode scan (item is physically present)
      addItem: (product, { ignoreStock = false } = {}) => {
        let status = 'added'
        set(state => {
          if (state.returnMode) { status = 'returnMode'; return state }
          const price = (state.customer?.price_tier === 'wholesale' && product.wholesale_price > 0)
            ? product.wholesale_price
            : product.sell_price
          const productWithPrice = { ...product, sell_price: price }
          const existing = state.items.find(i => i.id === product.id)
          const maxQty   = ignoreStock ? Infinity : (product.stock ?? Infinity)
          if (existing) {
            if (existing.qty >= maxQty) { status = 'maxStock'; return state }
            status = 'increased'
            return { items: state.items.map(i =>
              i.id === product.id ? { ...i, qty: i.qty + 1 } : i
            )}
          }
          if (!ignoreStock && maxQty <= 0) { status = 'outOfStock'; return state }
          return { items: [...state.items, { ...productWithPrice, qty: 1, isReturn: false }] }
        })
        return status
      },

      // Scale item: always a new line, price = total from barcode, qty = 1
      addScaleItem: (product, totalPrice) => set(state => {
        if (state.returnMode) return state
        const scaleItem = {
          ...product,
          id:         product.id + '_scale_' + Date.now(), // unique per scan
          sell_price: totalPrice,
          qty:        1,
          isReturn:   false,
          _isScale:   true,
        }
        return { items: [...state.items, scaleItem] }
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
      setPrice:      (id, price) => set(state => ({
        items: state.items.map(i => i.id === id ? { ...i, sell_price: price } : i)
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

      holdCart: () => set(state => {
        if (!state.items.length) return state
        const held = {
          id:            Date.now(),
          heldAt:        new Date().toISOString(),
          items:         state.items,
          customer:      state.customer,
          notes:         state.notes,
          discountType:  state.discountType,
          discountValue: state.discountValue,
          paymentMethod: state.paymentMethod,
        }
        return {
          heldCarts:    [...state.heldCarts, held],
          items: [], discountValue: 0, amountPaid: 0,
          notes: '', customer: null, returnMode: false,
          paymentMethod: 'cash', discountType: 'fixed',
        }
      }),

      resumeCart: (id) => set(state => {
        const held = state.heldCarts.find(h => h.id === id)
        if (!held) return state
        // If current cart has items, push it to held before restoring
        const newHeld = state.heldCarts.filter(h => h.id !== id)
        if (state.items.length) {
          newHeld.push({
            id:            Date.now(),
            heldAt:        new Date().toISOString(),
            items:         state.items,
            customer:      state.customer,
            notes:         state.notes,
            discountType:  state.discountType,
            discountValue: state.discountValue,
            paymentMethod: state.paymentMethod,
          })
        }
        return {
          heldCarts:    newHeld,
          items:        held.items,
          customer:     held.customer,
          notes:        held.notes,
          discountType: held.discountType,
          discountValue:held.discountValue,
          paymentMethod:held.paymentMethod,
          amountPaid: 0,
          returnMode: false,
        }
      }),

      deleteHeldCart: (id) => set(state => ({
        heldCarts: state.heldCarts.filter(h => h.id !== id),
      })),

      clear: () => set({
        items: [], discountValue: 0, amountPaid: 0,
        notes: '', customer: null, returnMode: false,
        paymentMethod: 'cash', discountType: 'fixed',
      }),

      // Load a vendor catalog_order into the POS cart for invoicing.
      // items: [{ product_id, product_name, unit_price, quantity, ... }]
      // customer: { id?, name, phone, address }
      // orderRef: optional string (e.g. 'ORD-...') stored in notes
      // liveProducts: optional array from productsStore so we can rehydrate
      //   image_url / barcode / stock / category for cleaner POS rendering and
      //   stock validation. If omitted, items still load (stock unknown).
      loadFromOrder: (items, customer, orderRef, liveProducts) => set(() => {
        const productMap = new Map((liveProducts || []).map(p => [p.id, p]))
        return {
          items: (items || []).map(it => {
            const live = productMap.get(it.product_id)
            return {
              id:         it.product_id,
              name:       it.product_name,
              sell_price: Number(it.unit_price) || 0,
              qty:        Math.max(1, Number(it.quantity) || 1),
              stock:      live?.stock ?? null,
              emoji:      live?.emoji || '📦',
              image_url:  live?.image_url || null,
              barcode:    live?.barcode || null,
              categories: live?.categories || null,
              cat:        live?.cat || null,
              isReturn:   false,
            }
          }),
          customer: customer ? {
            // Preserve the linked customer id when present so debt rolls under
            // the right customer record; falls back to walk-in (id: null).
            id:    customer.id ?? null,
            name:  customer.name || '',
            phone: customer.phone || '',
            address: customer.address || '',
          } : null,
          discountType:  'fixed',
          discountValue: 0,
          amountPaid:    0,
          paymentMethod: 'cash',
          notes:         orderRef ? `من طلب: ${orderRef}` : '',
          returnMode:    false,
        }
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
        const tva          = tvaRate > 0 ? Math.max(afterDisc, 0) * tvaRate / 100 : 0
        const total        = afterDisc + tva   // negative = refund owed to customer
        const isRefund     = total < 0
        const change       = !isRefund && amountPaid > 0 ? amountPaid - total : 0
        return { subtotal, discount, returnTotal, tva, tvaRate, total, isRefund, change, amountPaid }
      },
    }),
    { name: 'joud_cart', partialize: (s) => ({ items: s.items, customer: s.customer, heldCarts: s.heldCarts }) }
  )
)
