import { create } from 'zustand'
import { supabase } from '../lib/supabase.js'
import { generateOrderNumber } from '../lib/utils.js'

export const usePartnerOrderStore = create((set, get) => ({
  items:      [], // [{ product, agreedPrice, qty }]
  submitting: false,

  addItem: (product, agreedPrice = 0, qty = 1) => {
    set(s => {
      const existing = s.items.find(i => i.product.id === product.id)
      if (existing) {
        return {
          items: s.items.map(i =>
            i.product.id === product.id
              ? { ...i, qty: i.qty + qty, agreedPrice: agreedPrice || i.agreedPrice }
              : i
          ),
        }
      }
      return { items: [...s.items, { product, agreedPrice, qty }] }
    })
  },

  removeItem: (productId) =>
    set(s => ({ items: s.items.filter(i => i.product.id !== productId) })),

  setPrice: (productId, price) =>
    set(s => ({
      items: s.items.map(i =>
        i.product.id === productId ? { ...i, agreedPrice: price } : i
      ),
    })),

  setQty: (productId, qty) =>
    set(s => ({
      items: s.items.map(i =>
        i.product.id === productId ? { ...i, qty: Math.max(1, qty) } : i
      ),
    })),

  getTotal: () =>
    get().items.reduce((s, i) => s + (Number(i.agreedPrice) || 0) * i.qty, 0),

  submit: async (profile) => {
    const { items } = get()
    if (!items.length) return { error: 'السلة فارغة' }

    const allPriced = items.every(i => Number(i.agreedPrice) > 0)
    if (!allPriced) return { error: 'أدخل السعر المتفق عليه لجميع المنتجات' }

    set({ submitting: true })

    const orderNumber = generateOrderNumber('PRT')
    const payload = items.map(i => ({
      product_id:         i.product.id,
      product_name:       i.product.name,
      quantity:           i.qty,
      custom_unit_price:  Number(i.agreedPrice),
    }))

    const { data, error } = await supabase.rpc('submit_partner_order', {
      p_partner_id:    profile.id,
      p_partner_name:  profile.full_name || profile.email,
      p_order_number:  orderNumber,
      p_items:         payload,
    })

    set({ submitting: false })
    if (!error) set({ items: [] })
    return { data, error }
  },

  clear: () => set({ items: [] }),
}))
