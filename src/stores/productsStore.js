import { create } from 'zustand'
import { supabase } from '../lib/supabase.js'
import seedData from '../data/products_seed.json'

export const useProductsStore = create((set, get) => ({
  products:   [],
  categories: [],
  loading:    true,
  error:      null,
  activeCat:  'الكل',
  searchQ:    '',

  // Load from Supabase; fall back to seed data if not yet seeded
  load: async () => {
    set({ loading: true, error: null })
    const { data: cats, error: catErr } = await supabase
      .from('categories').select('*').order('sort_order')
    const { data: prods, error: prodErr } = await supabase
      .from('products').select('*, categories(name,emoji)').order('name')

    if (catErr || prodErr || !prods?.length) {
      // Fallback: use local seed data (before Supabase is seeded)
      set({
        categories: [{ id: 0, name: 'الكل', emoji: '🛍️' }, ...seedData.categories.map((c,i) => ({ id: i+1, ...c }))],
        products:   seedData.products.map(p => ({ ...p, id: p.legacy_id, sell_price: p.sell_price, categories: { name: p.cat, emoji: '📦' } })),
        loading: false,
      })
      return
    }

    set({
      categories: [{ id: 0, name: 'الكل', emoji: '🛍️' }, ...cats],
      products: prods,
      loading: false,
    })
  },

  // Realtime subscription: update stock + product changes live on any terminal.
  // Also listens for categories so newly added category names appear in
  // filters without a manual reload.
  subscribeRealtime: () => {
    const channel = supabase.channel('catalog_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async payload => {
        const { products } = get()
        if (payload.eventType === 'UPDATE') {
          // Preserve the joined categories(name,emoji) shape that's not in payload.new
          set({ products: products.map(p => p.id === payload.new.id ? { ...p, ...payload.new, categories: p.categories } : p) })
        } else if (payload.eventType === 'INSERT') {
          // Refetch the full row WITH the joined category — payload.new doesn't include the join
          const { data } = await supabase.from('products').select('*, categories(name,emoji)').eq('id', payload.new.id).single()
          if (data) set({ products: [...products, data] })
        } else if (payload.eventType === 'DELETE') {
          set({ products: products.filter(p => p.id !== payload.old.id) })
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, payload => {
        const { categories } = get()
        if (payload.eventType === 'UPDATE') {
          set({ categories: categories.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c) })
        } else if (payload.eventType === 'INSERT') {
          // Insert in sort_order if available, else push
          set({ categories: [...categories, payload.new].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) })
        } else if (payload.eventType === 'DELETE') {
          set({ categories: categories.filter(c => c.id !== payload.old.id) })
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  },

  setActiveCat: (cat) => set({ activeCat: cat }),
  setSearchQ:   (q)   => set({ searchQ: q }),

  // storeId: null = main store (store_id IS NULL), uuid = sub-store
  filteredProducts: (storeId = null) => {
    const { products, activeCat, searchQ } = get()
    return products.filter(p => {
      if (!p.is_active) return false
      if (p.is_hidden) return false
      // Store filter
      const storeMatch = storeId
        ? p.store_id === storeId
        : !p.store_id
      if (!storeMatch) return false
      const catMatch = activeCat === 'الكل' || p.categories?.name === activeCat || p.cat === activeCat
      const q = searchQ.toLowerCase().trim()
      const qMatch = !q || p.name.toLowerCase().includes(q) || (p.barcode || '').includes(q) || (p.cat || '').includes(q) || (p.categories?.name || '').includes(q)
      return catMatch && qMatch
    })
  },

  // Update stock in Supabase
  updateStock: async (id, newStock) => {
    const { data, error } = await supabase
      .from('products').update({ stock: newStock, updated_at: new Date().toISOString() }).eq('id', id).select().single()
    if (!error && data) {
      set(state => ({ products: state.products.map(p => p.id === id ? { ...p, stock: newStock } : p) }))
    }
    return error
  },

  // Full product CRUD
  createProduct: async (product) => {
    const { data, error } = await supabase.from('products').insert(product).select().single()
    if (!error) set(state => ({ products: [...state.products, data] }))
    return { data, error }
  },

  updateProduct: async (id, changes) => {
    const { data, error } = await supabase
      .from('products').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', id).select().single()
    if (!error) set(state => ({ products: state.products.map(p => p.id === id ? { ...p, ...data } : p) }))
    return { data, error }
  },

  deleteProduct: async (id) => {
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id)
    if (!error) set(state => ({ products: state.products.filter(p => p.id !== id) }))
    return error
  },
}))
