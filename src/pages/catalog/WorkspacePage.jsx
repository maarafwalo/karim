import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, supabaseAdmin } from '../../lib/supabase.js'
import { useAuthStore } from '../../stores/authStore.js'
import { useSettingsStore } from '../../stores/settingsStore.js'
import { useProductsStore } from '../../stores/productsStore.js'
import { useBagStore } from '../../stores/bagStore.js'
import { fmt, fmtDate, buildWhatsApp, generateOrderNumber } from '../../lib/utils.js'
import { ProductCard } from './CatalogPage.jsx'
import toast from 'react-hot-toast'

const STATUS_LABEL = {
  new:       { txt: 'جديد',    cls: 'bg-blue-100 text-blue-700' },
  approved:  { txt: 'مقبول',   cls: 'bg-emerald-100 text-emerald-700' },
  rejected:  { txt: 'مرفوض',   cls: 'bg-rose-100 text-rose-700' },
  delivered: { txt: 'مسلَّم',  cls: 'bg-slate-100 text-slate-700' },
  cancelled: { txt: 'ملغى',    cls: 'bg-slate-100 text-slate-500' },
}

// ── Tab 0: المنتجات (catalog browser) ──────────────────────────
function BrowseTab({ cur }) {
  const { categories, filteredProducts, activeCat, setActiveCat, searchQ, setSearchQ, loading } = useProductsStore()
  const items       = useBagStore(s => s.items)
  const addItem     = useBagStore(s => s.addItem)
  const decItem     = useBagStore(s => s.decItem)
  const setNegPrice = useBagStore(s => s.setNegPrice)
  const [catSheetOpen, setCatSheetOpen] = useState(false)
  const products = filteredProducts()

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-slate-100 flex-shrink-0 p-2 flex gap-2">
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
          className="inp flex-1" placeholder="🔍 ابحث عن منتج..." />
        <button onClick={() => setCatSheetOpen(true)}
          className="bg-primary hover:bg-primary-dark text-white font-bold px-3 rounded-xl text-sm flex items-center gap-1.5 flex-shrink-0 transition active:scale-95">
          {(() => {
            const c = categories.find(c => c.name === activeCat) || categories[0]
            return <><span>{c?.emoji || '📂'}</span><span className="max-w-[80px] truncate">{c?.name || 'الأقسام'}</span><span className="text-[10px]">▾</span></>
          })()}
        </button>
      </div>

      {/* Category sheet */}
      {catSheetOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-3"
          onClick={() => setCatSheetOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-black text-base text-slate-900">📂 اختر القسم</h2>
              <button onClick={() => setCatSheetOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center text-lg leading-none">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <div className="grid grid-cols-3 gap-2">
                {categories.map(c => {
                  const active = activeCat === c.name
                  return (
                    <button key={c.name}
                      onClick={() => { setActiveCat(c.name); setCatSheetOpen(false) }}
                      className={`flex flex-col items-center justify-center gap-1 p-3 rounded-2xl text-xs font-bold transition active:scale-95 ${
                        active
                          ? 'bg-primary text-white shadow-md'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                      <span className="text-2xl leading-none">{c.emoji}</span>
                      <span className="text-[11px] leading-tight text-center">{c.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Products grid */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm gap-2">
            <span className="animate-spin text-xl">⏳</span><span>جاري التحميل...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
            <span className="text-4xl">🔍</span><span className="text-sm">لا توجد منتجات</span>
          </div>
        ) : (
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {products.map(p => {
              const inBag = items.find(b => b.product.id === p.id)
              return (
                <ProductCard
                  key={p.id}
                  p={p}
                  inBag={inBag}
                  cur={cur}
                  onAdd={() => addItem(p)}
                  onInc={() => addItem(p)}
                  onDec={() => decItem(p.id)}
                  onPriceChange={(price) => setNegPrice(p.id, price)}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab 1: السلة (live bag from store + inline checkout) ──────
function CartTab({ cur, profile }) {
  const navigate = useNavigate()
  const items        = useBagStore(s => s.items)
  const customer     = useBagStore(s => s.customer)
  const editingOrder = useBagStore(s => s.editingOrder)
  const decItem      = useBagStore(s => s.decItem)
  const removeItem   = useBagStore(s => s.removeItem)
  const setNegPrice  = useBagStore(s => s.setNegPrice)
  const addItem      = useBagStore(s => s.addItem)
  const clearBag     = useBagStore(s => s.clear)
  const setEditingOrder = useBagStore(s => s.setEditingOrder)

  const setBagCustomer = useBagStore(s => s.setCustomer)

  const [stage, setStage]   = useState('cart')    // 'cart' | 'checkout'
  const [sending, setSending] = useState(false)

  // Inline customer picker state (loaded only when checkout opens)
  const [allCustomers, setAllCustomers] = useState([])
  const [recents, setRecents]           = useState([])  // top 5 most-recent customers from this vendor's orders
  const [pickerQ, setPickerQ]           = useState('')
  const [showNewForm, setShowNewForm]   = useState(false)
  const [newCust, setNewCust]           = useState({ name: '', phone: '' })
  const [newSaving, setNewSaving]       = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(0)

  useEffect(() => {
    if (stage !== 'checkout' || allCustomers.length) return
    supabase.from('customers').select('id,name,phone,address,balance').order('name').then(({ data }) => {
      if (data) setAllCustomers(data)
    })
  }, [stage])

  // Fetch this vendor's most recently-used customers from their catalog_orders
  useEffect(() => {
    if (stage !== 'checkout' || !profile?.id || recents.length) return
    const db = supabaseAdmin || supabase
    db.from('catalog_orders')
      .select('customer_name, customer_phone, customer_address, created_at')
      .eq('vendor_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(40)
      .then(({ data }) => {
        if (!data) return
        // Dedupe by phone (or name if no phone), keep only most recent occurrence
        const seen = new Set()
        const list = []
        for (const o of data) {
          if (!o.customer_name) continue
          const key = (o.customer_phone || o.customer_name).trim()
          if (seen.has(key)) continue
          seen.add(key)
          list.push({
            name:    o.customer_name,
            phone:   o.customer_phone || '',
            address: o.customer_address || '',
          })
          if (list.length >= 5) break
        }
        setRecents(list)
      })
  }, [stage, profile?.id])

  const filteredCust = pickerQ
    ? allCustomers.filter(c =>
        (c.name || '').toLowerCase().includes(pickerQ.toLowerCase()) ||
        (c.phone || '').includes(pickerQ))
    : allCustomers

  // Reset keyboard highlight when query changes
  useEffect(() => { setHighlightIdx(0) }, [pickerQ])

  const pickCustomer = (c) => {
    setBagCustomer({ name: c.name || '', phone: c.phone || '', address: c.address || '' })
    setPickerQ('')
  }

  const clearCustomer = () => setBagCustomer({ name: '', phone: '', address: '' })

  const saveNewCustomer = async () => {
    if (!newCust.name.trim()) { toast.error('الاسم مطلوب'); return }
    setNewSaving(true)
    const { data, error } = await supabase.from('customers').insert({
      name: newCust.name.trim(), phone: newCust.phone.trim(),
    }).select().single()
    setNewSaving(false)
    if (error) { toast.error('فشل الحفظ'); return }
    if (data) {
      setAllCustomers(prev => [data, ...prev])
      pickCustomer(data)
      setShowNewForm(false)
      setNewCust({ name: '', phone: '' })
      toast.success(`✓ ${data.name} محدد للطلب`)
    }
  }

  const priceOf = (b) => (typeof b.negotiatedPrice === 'number' ? b.negotiatedPrice : b.product.sell_price)
  const total   = items.reduce((s, b) => s + priceOf(b) * b.qty, 0)
  const count   = items.reduce((s, b) => s + b.qty, 0)

  const sendOrder = async () => {
    if (!customer.name || !customer.phone) { toast.error('أدخل الاسم والهاتف'); return }
    setSending(true)
    const orderNum = editingOrder?.order_number || generateOrderNumber('ORD')
    const db = supabaseAdmin || supabase
    const withTimeout = (p, ms = 8000) => Promise.race([
      p,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
    ])

    try {
      if (editingOrder?.id) {
        await withTimeout(db.from('catalog_order_items').delete().eq('order_id', editingOrder.id))
        await withTimeout(db.from('catalog_orders').delete().eq('id', editingOrder.id))
      }

      const { data: order, error: ordErr } = await withTimeout(
        db.from('catalog_orders').insert({
          order_number:       orderNum,
          vendor_id:          profile?.id || null,
          customer_name:      customer.name,
          customer_phone:     customer.phone,
          customer_address:   customer.address,
          subtotal:           total,
          total:              total,
          status:             'new',
          wa_sent:            false,
          is_partner_request: false,
        }).select().single()
      )
      if (ordErr) throw ordErr

      const { error: itemsErr } = await withTimeout(
        db.from('catalog_order_items').insert(
          items.map(b => {
            const negPrice = priceOf(b)
            const orig = b.product.sell_price
            const isNeg = negPrice !== orig
            return {
              order_id:       order.id,
              product_id:     b.product.id,
              product_name:   b.product.name,
              unit_price:     negPrice,
              original_price: orig,
              negotiated:     isNeg,
              price_diff:     +(negPrice - orig).toFixed(2),
              quantity:       b.qty,
              total:          negPrice * b.qty,
            }
          })
        )
      )
      if (itemsErr) throw itemsErr

      toast.success(
        editingOrder
          ? `✔ تم تحديث الفاتورة #${orderNum}`
          : `✔ تم حفظ الفاتورة #${orderNum}`,
        { duration: 4000 }
      )
      clearBag()
      setStage('cart')
      // Bounce to orders tab via parent — handled by parent listening to bag state
      navigate('/workspace#orders', { replace: true })
    } catch (e) {
      toast.error('فشل الحفظ: ' + (e.message || 'خطأ'))
    } finally {
      setSending(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="text-6xl mb-3">🛍</div>
        <p className="text-slate-600 font-bold mb-4">سلتك فارغة</p>
        <button onClick={() => { window.location.hash = 'browse' }}
          className="bg-primary hover:bg-primary-dark text-white font-black px-6 py-3 rounded-2xl shadow-lg transition active:scale-95">
          📋 تصفح الكتالوج
        </button>
      </div>
    )
  }

  // ── Checkout stage ──
  if (stage === 'checkout') {
    const hasCustomer = !!(customer?.name && customer?.phone)
    return (
      <div className="flex flex-col h-full">
        {editingOrder && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-amber-800 text-xs font-bold">
            ✏️ تعديل الطلب #{editingOrder.order_number}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <h3 className="font-black text-slate-900 text-sm">👤 الزبون</h3>

          {/* Selected customer summary OR fast picker */}
          {hasCustomer ? (
            <div className="bg-white border-2 border-emerald-300 rounded-2xl p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-700 font-black text-sm flex items-center justify-center flex-shrink-0">
                  {customer.name.trim().slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-slate-900 truncate">{customer.name}</p>
                  {customer.phone && <p className="text-[11px] text-slate-500 ltr">{customer.phone}</p>}
                  {customer.address && <p className="text-[11px] text-slate-500 truncate">📍 {customer.address}</p>}
                </div>
                <button onClick={clearCustomer}
                  className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-xs px-3 py-2 rounded-xl flex-shrink-0">
                  تغيير
                </button>
              </div>
            </div>
          ) : showNewForm ? (
            <div className="bg-white border-2 border-indigo-200 rounded-2xl p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-indigo-700">+ زبون جديد</span>
                <button onClick={() => { setShowNewForm(false); setNewCust({ name: '', phone: '' }) }}
                  className="w-7 h-7 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center text-base leading-none">✕</button>
              </div>
              <input autoFocus value={newCust.name} onChange={e => setNewCust(c => ({ ...c, name: e.target.value }))}
                className="inp" placeholder="الاسم *" />
              <input value={newCust.phone} onChange={e => setNewCust(c => ({ ...c, phone: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') saveNewCustomer() }}
                type="tel" className="inp" placeholder="الهاتف" />
              <button onClick={saveNewCustomer} disabled={newSaving || !newCust.name.trim()}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-black py-3 rounded-xl shadow-sm transition active:scale-95">
                {newSaving ? '...' : '✔ حفظ واختيار'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Recent customers — one-tap access (only when not searching) */}
              {recents.length > 0 && !pickerQ && (
                <div>
                  <div className="text-[10px] font-black text-slate-400 mb-1.5 px-1">⏱ الأخيرون</div>
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {recents.map((r, i) => (
                      <button key={i} onClick={() => pickCustomer(r)}
                        className="flex-shrink-0 flex flex-col items-center gap-1 bg-white hover:bg-indigo-50 active:bg-indigo-100 border-2 border-slate-200 hover:border-indigo-300 rounded-2xl px-3 py-2 transition active:scale-95 min-w-[68px]">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center">
                          {r.name.trim().slice(0, 2)}
                        </div>
                        <div className="text-[10px] font-bold text-slate-700 truncate max-w-[64px]">{r.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Search + add new */}
              <div className="flex items-center gap-2">
                <input autoFocus
                  value={pickerQ}
                  onChange={e => setPickerQ(e.target.value)}
                  onKeyDown={(e) => {
                    const list = filteredCust.slice(0, 50)
                    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx(i => Math.min(i + 1, list.length - 1)) }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx(i => Math.max(i - 1, 0)) }
                    else if (e.key === 'Enter' && list[highlightIdx]) { e.preventDefault(); pickCustomer(list[highlightIdx]) }
                  }}
                  className="inp flex-1" placeholder="🔍 ابحث بالاسم أو الهاتف..." />
                <button onClick={() => setShowNewForm(true)}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white font-black text-sm px-3 py-3 rounded-xl flex-shrink-0 shadow-sm transition active:scale-95">
                  + جديد
                </button>
              </div>

              {/* Results list */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="max-h-72 overflow-y-auto">
                  {allCustomers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                      <span className="text-3xl">👤</span>
                      <span className="text-xs">لا يوجد زبائن — اضغط <span className="font-black text-indigo-600">+ جديد</span></span>
                    </div>
                  ) : filteredCust.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                      <span className="text-3xl">🔍</span>
                      <span className="text-xs">لا توجد نتائج لـ &quot;{pickerQ}&quot;</span>
                      <button onClick={() => { setNewCust({ name: pickerQ, phone: '' }); setShowNewForm(true) }}
                        className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-black text-xs px-3 py-1.5 rounded-lg mt-1">
                        + إضافة &quot;{pickerQ}&quot; كزبون جديد
                      </button>
                    </div>
                  ) : (
                    filteredCust.slice(0, 50).map((c, i) => {
                      const highlighted = i === highlightIdx
                      const q = pickerQ.toLowerCase()
                      // bold the matched substring of the name
                      const renderName = () => {
                        if (!q || !c.name) return c.name || '—'
                        const idx = c.name.toLowerCase().indexOf(q)
                        if (idx === -1) return c.name
                        return <>
                          {c.name.slice(0, idx)}
                          <span className="bg-yellow-200 text-slate-900 font-black">{c.name.slice(idx, idx + q.length)}</span>
                          {c.name.slice(idx + q.length)}
                        </>
                      }
                      return (
                        <button key={c.id} onClick={() => pickCustomer(c)}
                          onMouseEnter={() => setHighlightIdx(i)}
                          className={`w-full px-3 py-3 flex items-center gap-3 border-b border-slate-100 last:border-0 transition text-right ${
                            highlighted ? 'bg-indigo-50' : 'hover:bg-slate-50 active:bg-indigo-100'
                          }`}>
                          <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${
                            c.balance > 0 ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'
                          }`}>
                            {(c.name || '?').trim().slice(0, 2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm text-slate-800 truncate">{renderName()}</div>
                            {c.phone && <div className="text-[11px] text-slate-500 ltr">{c.phone}</div>}
                          </div>
                          {c.balance > 0 && (
                            <span className="text-[10px] bg-rose-500 text-white px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">
                              دين: {fmt(c.balance)}
                            </span>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="bg-slate-100 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-600">الإجمالي</span>
            <span className="text-xl font-black text-slate-900">{fmt(total)} <span className="text-xs font-normal text-slate-400">{cur}</span></span>
          </div>
        </div>

        <div className="bg-white border-t border-slate-200 px-4 py-3 flex gap-2">
          <button onClick={() => setStage('cart')}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-5 py-3 rounded-2xl transition active:scale-95">
            ← عودة
          </button>
          <button onClick={sendOrder} disabled={sending || !hasCustomer}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black py-3 rounded-2xl shadow-lg transition active:scale-95">
            {sending ? '...' : (editingOrder ? '✔ حفظ التعديلات' : '✔ حفظ الطلب')}
          </button>
        </div>
      </div>
    )
  }

  // ── Cart stage ──
  return (
    <div className="flex flex-col h-full">
      {editingOrder && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-amber-800 text-xs font-bold flex items-center justify-between">
          <span>✏️ تعديل الطلب #{editingOrder.order_number}</span>
          <button onClick={() => { setEditingOrder(null); clearBag() }}
            className="text-amber-700 hover:text-amber-900 text-[10px] font-bold underline">إلغاء التعديل</button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.map(b => {
          const negPrice = priceOf(b)
          const isNeg = negPrice !== b.product.sell_price
          return (
            <div key={b.product.id}
              className={`flex items-center gap-3 px-3 py-3 rounded-2xl border bg-white shadow-sm ${
                isNeg ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200'
              }`}>
              <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {b.product.image_url
                  ? <img src={b.product.image_url} alt="" className="w-full h-full object-contain p-0.5" />
                  : <span className="text-2xl">{b.product.emoji || '📦'}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{b.product.name}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  × {b.qty} = <span className="font-bold text-rose-600">{fmt(negPrice * b.qty)} {cur}</span>
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setNegPrice(b.product.id, Math.max(0, +(negPrice - 0.10).toFixed(2)))}
                  className="w-8 h-8 bg-rose-100 hover:bg-rose-200 active:scale-90 text-rose-600 rounded-lg text-lg font-black flex items-center justify-center leading-none transition">−</button>
                <div className={`flex flex-col items-center px-1 min-w-[60px] ${isNeg ? 'text-amber-700' : 'text-slate-800'}`}>
                  <span className={`text-[9px] leading-none ${isNeg ? 'line-through text-slate-400' : 'text-slate-400'}`}>
                    {fmt(b.product.sell_price)}
                  </span>
                  <span className="text-sm font-black leading-tight">{fmt(negPrice)}</span>
                </div>
                <button onClick={() => setNegPrice(b.product.id, +(negPrice + 0.10).toFixed(2))}
                  className="w-8 h-8 bg-emerald-100 hover:bg-emerald-200 active:scale-90 text-emerald-700 rounded-lg text-lg font-black flex items-center justify-center leading-none transition">+</button>
              </div>
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button onClick={() => addItem(b.product)}
                  className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-black leading-none">+</button>
                <button onClick={() => decItem(b.product.id)}
                  className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-black leading-none">−</button>
              </div>
              <button onClick={() => removeItem(b.product.id)}
                className="w-7 h-7 rounded-full text-slate-300 hover:bg-rose-50 hover:text-rose-500 flex items-center justify-center transition flex-shrink-0">🗑</button>
            </div>
          )
        })}
      </div>

      <div className="bg-white border-t border-slate-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => { window.location.hash = 'browse' }}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-3 rounded-2xl transition active:scale-95">
          + إضافة
        </button>
        <div className="flex-1">
          <div className="text-xs text-slate-500">{count} منتج</div>
          <div className="text-xl font-black text-slate-900">{fmt(total)} <span className="text-xs font-normal text-slate-400">{cur}</span></div>
        </div>
        <button onClick={() => setStage('checkout')}
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-black px-5 py-3 rounded-2xl shadow-lg transition active:scale-95">
          {editingOrder ? '✔ متابعة' : '📋 إكمال الطلب'}
        </button>
      </div>
    </div>
  )
}

// ── Order details (lazy-loaded items + actions) ────────────────
function OrderDetails({ orderId, cur, editable, onEdit, onDelete, customerAddress, customerPhone }) {
  const [items, setItems] = useState(null)
  useEffect(() => {
    const db = supabaseAdmin || supabase
    db.from('catalog_order_items').select('*').eq('order_id', orderId).then(({ data }) => setItems(data || []))
  }, [orderId])
  return (
    <div className="px-3 pb-3 pt-1 border-t border-slate-200 bg-white">
      {customerPhone && <div className="text-[11px] text-slate-500 mb-1">📞 {customerPhone}</div>}
      {customerAddress && <div className="text-[11px] text-slate-500 mb-2">📍 {customerAddress}</div>}
      {items === null ? (
        <div className="text-xs text-slate-400 py-2">جاري التحميل...</div>
      ) : items.length === 0 ? (
        <div className="text-xs text-slate-400 py-2">لا توجد أصناف</div>
      ) : (
        <div className="space-y-1 mb-2">
          {items.map(it => {
            const isNeg = it.negotiated
            return (
              <div key={it.id} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-2 py-1.5">
                <span className="font-bold text-slate-700 truncate flex-1">{it.product_name}</span>
                <span className="text-slate-500 mx-2">× {it.quantity}</span>
                <div className="text-left flex-shrink-0">
                  {isNeg && it.original_price != null && (
                    <span className="text-[9px] line-through text-slate-400 ml-1">{fmt(it.original_price)}</span>
                  )}
                  <span className={`font-bold ${isNeg ? 'text-amber-700' : 'text-slate-800'}`}>{fmt(it.total)} {cur}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {editable ? (
        <div className="flex gap-2 pt-1">
          <button onClick={onEdit}
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded-lg text-xs transition active:scale-95">✏️ تعديل</button>
          <button onClick={onDelete}
            className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 rounded-lg text-xs transition active:scale-95">🗑 حذف</button>
        </div>
      ) : (
        <div className="text-[10px] text-slate-400 text-center pt-1">⚠ تم بدء معالجة الطلب — لا يمكن التعديل</div>
      )}
    </div>
  )
}

// ── Tab 2: طلباتي ──────────────────────────────────────────────
function OrdersTab({ cur, profile }) {
  const navigate = useNavigate()
  const [orders, setOrders]               = useState([])
  const [loading, setLoading]             = useState(true)
  const [expandedId, setExpandedId]       = useState(null)
  const [statusFilter, setStatusFilter]   = useState('all')
  const [searchQ, setSearchQ]             = useState('')

  const load = async () => {
    if (!profile?.id) return
    setLoading(true)
    const db = supabaseAdmin || supabase
    const { data } = await db
      .from('catalog_orders')
      .select('id, order_number, customer_name, customer_phone, customer_address, total, status, stock_approved, created_at')
      .eq('vendor_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(200)
    setOrders(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [profile?.id])

  const editOrder = async (order) => {
    const db = supabaseAdmin || supabase
    const { data: items } = await db.from('catalog_order_items').select('*').eq('order_id', order.id)
    sessionStorage.setItem('catalog_edit_handoff', JSON.stringify({
      order_id:     order.id,
      order_number: order.order_number,
      customer: {
        name:    order.customer_name || '',
        phone:   order.customer_phone || '',
        address: order.customer_address || '',
      },
      items: (items || []).map(it => ({
        product_id:     it.product_id,
        product_name:   it.product_name,
        unit_price:     it.unit_price,
        original_price: it.original_price,
        quantity:       it.quantity,
      })),
    }))
    navigate('/catalog')
  }

  const deleteOrder = async (order) => {
    if (!confirm(`حذف الطلب #${order.order_number}؟`)) return
    const db = supabaseAdmin || supabase
    await db.from('catalog_order_items').delete().eq('order_id', order.id)
    const { error } = await db.from('catalog_orders').delete().eq('id', order.id)
    if (error) { toast.error('فشل الحذف: ' + error.message); return }
    toast.success('تم الحذف')
    setOrders(prev => prev.filter(o => o.id !== order.id))
  }

  const filtered = orders.filter(o => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false
    if (searchQ) {
      const q = searchQ.toLowerCase()
      return (o.customer_name || '').toLowerCase().includes(q) ||
             (o.customer_phone || '').includes(searchQ) ||
             (o.order_number || '').toLowerCase().includes(q)
    }
    return true
  })

  const totalAll = filtered.reduce((s, o) => s + (o.total || 0), 0)

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-500">
            <span className="font-bold text-slate-800">{filtered.length}</span> طلب · <span className="font-black text-emerald-600">{fmt(totalAll)} {cur}</span>
          </span>
        </div>
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
          className="inp text-sm" placeholder="🔍 ابحث بالاسم، الهاتف، الرقم..." />
        <div className="flex gap-1 mt-2 overflow-x-auto">
          {[
            { key: 'all',       lbl: 'الكل' },
            { key: 'new',       lbl: 'جديد' },
            { key: 'approved',  lbl: 'مقبول' },
            { key: 'delivered', lbl: 'مسلَّم' },
            { key: 'rejected',  lbl: 'مرفوض' },
            { key: 'cancelled', lbl: 'ملغى' },
          ].map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition flex-shrink-0 ${
                statusFilter === f.key ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {f.lbl}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="text-center text-slate-400 py-8 text-sm">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-slate-400 py-8 text-sm">لا توجد طلبات</div>
        ) : (
          filtered.map(o => {
            const st = STATUS_LABEL[o.status] || { txt: o.status, cls: 'bg-slate-100 text-slate-600' }
            const editable = o.status === 'new' && !o.stock_approved
            const expanded = expandedId === o.id
            return (
              <div key={o.id} className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
                <button onClick={() => setExpandedId(expanded ? null : o.id)}
                  className="w-full px-3 py-2.5 flex items-start justify-between gap-2 hover:bg-slate-50 transition">
                  <div className="flex-1 text-right min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-slate-900 truncate">{o.customer_name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.txt}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      #{o.order_number} · {new Date(o.created_at).toLocaleDateString('fr-FR')} · {new Date(o.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <div className="font-black text-sm text-slate-900">{fmt(o.total)} <span className="text-[10px] font-normal text-slate-400">{cur}</span></div>
                    <div className="text-[10px] text-slate-400">{expanded ? '▲' : '▼'}</div>
                  </div>
                </button>
                {expanded && (
                  <OrderDetails
                    orderId={o.id}
                    cur={cur}
                    editable={editable}
                    onEdit={() => editOrder(o)}
                    onDelete={() => deleteOrder(o)}
                    customerAddress={o.customer_address}
                    customerPhone={o.customer_phone}
                  />
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── Customer card (one unified entity) ─────────────────────────
function CustomerCard({ c, cur, expanded, onToggle, onChange, onDelete, onUseForOrder }) {
  const [editing, setEditing]   = useState(false)
  const [draft, setDraft]       = useState({ name: c.name, phone: c.phone || '' })
  const [history, setHistory]   = useState({ invoices: [], payments: [], loaded: false })
  const [payAmt, setPayAmt]     = useState('')
  const [working, setWorking]   = useState(false)

  // Lazy-load invoices + payments only when expanded
  useEffect(() => {
    if (!expanded || history.loaded) return
    let cancelled = false
    Promise.all([
      supabase.from('pos_invoices').select('order_number, total, payment_method, payment_label, created_at')
        .eq('customer_id', c.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('debt_payments').select('amount, created_at')
        .eq('customer_id', c.id).order('created_at', { ascending: false }).limit(10),
    ]).then(([inv, pay]) => {
      if (cancelled) return
      setHistory({ invoices: inv.data || [], payments: pay.data || [], loaded: true })
    })
    return () => { cancelled = true }
  }, [expanded, c.id])

  const initials = (c.name || '?').trim().slice(0, 2)

  const saveEdit = async () => {
    if (!draft.name.trim()) { toast.error('الاسم مطلوب'); return }
    setWorking(true)
    const { data, error } = await supabase.from('customers').update({
      name: draft.name.trim(),
      phone: draft.phone.trim(),
    }).eq('id', c.id).select().single()
    setWorking(false)
    if (error) { toast.error('خطأ في الحفظ'); return }
    toast.success('تم الحفظ')
    setEditing(false)
    onChange(data)
  }

  const recordPayment = async () => {
    const amount = parseFloat(payAmt)
    if (!amount || amount <= 0) { toast.error('أدخل مبلغاً صحيحاً'); return }
    setWorking(true)
    const { error } = await supabase.from('debt_payments').insert({ customer_id: c.id, amount })
    if (error) { setWorking(false); toast.error('فشل التسجيل'); return }
    const newBal = Math.max(0, (c.balance || 0) - amount)
    const { data: upd } = await supabase.from('customers').update({ balance: newBal }).eq('id', c.id).select().single()
    setWorking(false)
    setPayAmt('')
    setHistory(h => ({ ...h, loaded: false }))
    toast.success(`✔ تم تسجيل ${fmt(amount)} ${cur}`)
    if (upd) onChange(upd)
  }

  return (
    <div className={`bg-white border-2 rounded-2xl shadow-sm overflow-hidden transition ${
      expanded ? 'border-primary' : c.balance > 0 ? 'border-rose-200' : 'border-slate-200'
    }`}>
      {/* Header — always visible */}
      <button onClick={onToggle} className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 transition">
        <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${
          c.balance > 0 ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'
        }`}>
          {initials}
        </div>
        <div className="flex-1 text-right min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-black text-sm text-slate-900 truncate">{c.name}</p>
            {c.loyalty_pts > 0 && <span className="text-[9px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-bold">⭐ {c.loyalty_pts}</span>}
          </div>
          {c.phone && <p className="text-[11px] text-slate-500 mt-0.5 ltr">{c.phone}</p>}
        </div>
        <div className="text-left flex-shrink-0">
          {c.balance > 0 ? (
            <div className="font-black text-sm text-rose-600">{fmt(c.balance)} <span className="text-[10px] font-normal text-slate-400">{cur}</span></div>
          ) : (
            <div className="text-[10px] text-emerald-600 font-bold">✓ مسدّد</div>
          )}
          <div className="text-[10px] text-slate-400">{expanded ? '▲' : '▼'}</div>
        </div>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-slate-100 p-3 space-y-3 bg-slate-50/40">
          {/* Use for current order */}
          <button onClick={onUseForOrder}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-2.5 rounded-xl text-sm shadow-sm transition active:scale-95 flex items-center justify-center gap-2">
            🛒 استخدم لهذا الطلب
          </button>

          {/* Quick actions row */}
          <div className="grid grid-cols-3 gap-1.5">
            {c.phone && (
              <a href={buildWhatsApp(c.phone, `مرحباً ${c.name}`)} target="_blank" rel="noreferrer"
                className="flex flex-col items-center gap-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-2 rounded-xl transition">
                <span className="text-base leading-none">📱</span>
                <span className="text-[10px] font-bold">واتساب</span>
              </a>
            )}
            {c.phone && (
              <a href={`tel:${c.phone}`}
                className="flex flex-col items-center gap-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-xl transition">
                <span className="text-base leading-none">📞</span>
                <span className="text-[10px] font-bold">اتصال</span>
              </a>
            )}
            <button onClick={() => setEditing(e => !e)}
              className="flex flex-col items-center gap-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 py-2 rounded-xl transition">
              <span className="text-base leading-none">✏</span>
              <span className="text-[10px] font-bold">{editing ? 'إلغاء' : 'تعديل'}</span>
            </button>
          </div>

          {/* Inline edit */}
          {editing && (
            <div className="bg-white p-3 rounded-xl border border-amber-200 space-y-2">
              <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                className="inp text-sm" placeholder="الاسم *" />
              <input value={draft.phone} onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))}
                className="inp text-sm" placeholder="الهاتف" />
              <button onClick={saveEdit} disabled={working}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-xs font-black py-2 rounded-lg">
                {working ? '...' : '✔ حفظ'}
              </button>
            </div>
          )}

          {/* Pay debt */}
          {c.balance > 0 && (
            <div className="bg-white p-3 rounded-xl border border-rose-200">
              <div className="text-xs text-slate-500 mb-1.5">💵 تسجيل دفعة</div>
              <div className="flex gap-2">
                <input type="number" value={payAmt} onChange={e => setPayAmt(e.target.value)}
                  className="inp text-sm flex-1" placeholder={`المبلغ (${cur})`} />
                <button onClick={recordPayment} disabled={working}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-xs font-black px-3 rounded-lg">
                  ✔
                </button>
              </div>
            </div>
          )}

          {/* History */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="text-[10px] font-black text-slate-500 px-2 py-1 bg-slate-50 border-b border-slate-100">🧾 الفواتير</div>
              <div className="max-h-32 overflow-y-auto">
                {!history.loaded ? (
                  <div className="text-center text-[10px] text-slate-400 py-2">...</div>
                ) : history.invoices.length === 0 ? (
                  <div className="text-center text-[10px] text-slate-400 py-2">لا شيء</div>
                ) : history.invoices.map((inv, i) => (
                  <div key={i} className="px-2 py-1 border-b border-slate-50 last:border-0">
                    <div className="font-bold text-[10px] text-slate-700 truncate">{inv.order_number}</div>
                    <div className="flex justify-between text-[9px]">
                      <span className="text-slate-400">{fmtDate(inv.created_at)}</span>
                      <span className="font-black text-primary">{fmt(inv.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="text-[10px] font-black text-slate-500 px-2 py-1 bg-slate-50 border-b border-slate-100">💵 السداد</div>
              <div className="max-h-32 overflow-y-auto">
                {!history.loaded ? (
                  <div className="text-center text-[10px] text-slate-400 py-2">...</div>
                ) : history.payments.length === 0 ? (
                  <div className="text-center text-[10px] text-slate-400 py-2">لا شيء</div>
                ) : history.payments.map((p, i) => (
                  <div key={i} className="px-2 py-1 border-b border-slate-50 last:border-0 flex justify-between text-[10px]">
                    <span className="text-slate-400">{fmtDate(p.created_at)}</span>
                    <span className="font-black text-emerald-600">{fmt(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button onClick={onDelete}
            className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold py-2 rounded-xl transition">
            🗑 حذف الزبون
          </button>
        </div>
      )}
    </div>
  )
}

// ── Tab 3: الزبائن (CRM-style unified cards) ──────────────────
function CustomersTab({ cur }) {
  const setBagCustomer = useBagStore(s => s.setCustomer)
  const bagCount       = useBagStore(s => s.items.reduce((a, b) => a + b.qty, 0))
  const [customers, setCustomers] = useState([])
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(false)
  const [showAdd, setShowAdd]     = useState(false)
  const [form, setForm]           = useState({ name: '', phone: '' })
  const [filter, setFilter]       = useState('all')   // all | debt | wholesale | retail
  const [sort, setSort]           = useState('name')  // name | debt | recent
  const [expandedId, setExpandedId] = useState(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('customers').select('*').order('name')
    setCustomers(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.name.trim()) { toast.error('الاسم مطلوب'); return }
    const { data, error } = await supabase.from('customers').insert({
      name: form.name.trim(), phone: form.phone.trim(),
    }).select().single()
    if (error) { toast.error('خطأ في الحفظ'); return }
    toast.success('تم إضافة الزبون')
    setForm({ name: '', phone: '' })
    setShowAdd(false)
    if (data) {
      setCustomers(prev => [data, ...prev])
      // If there's an active bag, auto-select this new customer for the order
      if (bagCount > 0) {
        setBagCustomer({ name: data.name || '', phone: data.phone || '', address: data.address || '' })
        toast.success(`✓ ${data.name} محدد للطلب`)
        window.location.hash = 'cart'
      } else {
        setExpandedId(data.id)
      }
    }
  }

  const del = async (id) => {
    if (!confirm('حذف هذا الزبون؟')) return
    await supabase.from('customers').delete().eq('id', id)
    setCustomers(c => c.filter(x => x.id !== id))
  }

  const updateOne = (updated) => {
    setCustomers(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
  }

  const filtered = useMemo(() => {
    let list = customers.filter(c =>
      !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
    )
    if (filter === 'debt') list = list.filter(c => (c.balance || 0) > 0)

    if (sort === 'debt')   list = [...list].sort((a, b) => (b.balance || 0) - (a.balance || 0))
    if (sort === 'recent') list = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    if (sort === 'name')   list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    return list
  }, [customers, search, filter, sort])

  const stats = useMemo(() => {
    const totalDebt = customers.reduce((s, c) => s + (c.balance || 0), 0)
    const debtors   = customers.filter(c => (c.balance || 0) > 0).length
    return { totalDebt, debtors, total: customers.length }
  }, [customers])

  return (
    <div className="flex flex-col h-full">
      {/* Stats + search */}
      <div className="bg-white border-b border-slate-100 px-3 pt-3 pb-2 flex-shrink-0">
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div className="bg-indigo-50 rounded-xl px-2 py-1.5 text-center">
            <div className="text-base font-black text-indigo-700 leading-none">{stats.total}</div>
            <div className="text-[9px] text-indigo-600 font-bold mt-0.5">زبون</div>
          </div>
          <div className="bg-rose-50 rounded-xl px-2 py-1.5 text-center">
            <div className="text-base font-black text-rose-700 leading-none">{stats.debtors}</div>
            <div className="text-[9px] text-rose-600 font-bold mt-0.5">مديون</div>
          </div>
          <div className="bg-emerald-50 rounded-xl px-2 py-1.5 text-center">
            <div className="text-base font-black text-emerald-700 leading-none truncate">{fmt(stats.totalDebt)}</div>
            <div className="text-[9px] text-emerald-600 font-bold mt-0.5">إجمالي الديون</div>
          </div>
        </div>

        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="inp text-sm flex-1" placeholder="🔍 الاسم، الهاتف..." />
          <button onClick={() => setShowAdd(s => !s)}
            className="bg-primary hover:bg-primary-dark text-white text-xs font-black px-3 py-2 rounded-xl flex-shrink-0">
            {showAdd ? '✕' : '+ جديد'}
          </button>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 mt-2 overflow-x-auto">
          {[
            { key: 'all',  lbl: `الكل (${stats.total})` },
            { key: 'debt', lbl: `مديون (${stats.debtors})` },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition flex-shrink-0 ${
                filter === f.key ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {f.lbl}
            </button>
          ))}
          <span className="text-[10px] text-slate-300 mx-1">·</span>
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="text-[10px] font-bold bg-slate-100 rounded-lg px-2 py-1 border-0 focus:outline-none">
            <option value="name">أبجدي</option>
            <option value="debt">حسب الدين</option>
            <option value="recent">الأحدث</option>
          </select>
        </div>

        {showAdd && (
          <div className="mt-2 p-3 bg-slate-50 rounded-xl space-y-2">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="inp text-sm" placeholder="الاسم *" />
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="inp text-sm" placeholder="الهاتف" type="tel" />
            <button onClick={save} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black py-2 rounded-lg">✔ حفظ</button>
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {loading ? (
          <div className="text-center text-slate-400 py-6 text-sm">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-sm">
            <span className="text-4xl mb-2">👤</span>
            <span>لا توجد نتائج</span>
          </div>
        ) : (
          filtered.map(c => (
            <CustomerCard
              key={c.id}
              c={c}
              cur={cur}
              expanded={expandedId === c.id}
              onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
              onChange={updateOne}
              onDelete={() => del(c.id)}
              onUseForOrder={() => {
                setBagCustomer({
                  name:    c.name || '',
                  phone:   c.phone || '',
                  address: c.address || '',
                })
                toast.success(`✓ ${c.name} محدد للطلب`)
                if (bagCount > 0) {
                  window.location.hash = 'cart'
                }
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ── Tab 4: الديون ──────────────────────────────────────────────
function DebtsTab({ cur }) {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [selected, setSelected]   = useState(null)
  const [payAmt, setPayAmt]       = useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('customers').select('*').gt('balance', 0).order('balance', { ascending: false })
    setCustomers(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const recordPayment = async () => {
    const amount = parseFloat(payAmt)
    if (!selected || isNaN(amount) || amount <= 0) return
    const { error } = await supabase.from('debt_payments').insert({ customer_id: selected.id, amount })
    if (error) { toast.error('خطأ'); return }
    await supabase.from('customers').update({ balance: Math.max(0, (selected.balance || 0) - amount) }).eq('id', selected.id)
    toast.success('تم تسجيل الدفعة')
    setPayAmt('')
    setSelected(null)
    load()
  }

  const filtered = customers.filter(c =>
    !search || c.name?.includes(search) || c.phone?.includes(search))
  const total = filtered.reduce((s, c) => s + (c.balance || 0), 0)

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-slate-100 px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            <span className="font-bold text-slate-800">{filtered.length}</span> مديون
          </span>
          <span className="font-black text-rose-600">{fmt(total)} {cur}</span>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="inp text-sm" placeholder="🔍 بحث..." />
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {loading ? (
          <div className="text-center text-slate-400 py-6 text-sm">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-sm">
            <span className="text-4xl mb-2">✨</span>
            <span>لا توجد ديون</span>
          </div>
        ) : (
          filtered.map(c => (
            <div key={c.id} className="bg-white border border-rose-100 rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-900 truncate">{c.name}</p>
                  {c.phone && <p className="text-[11px] text-slate-500 ltr">{c.phone}</p>}
                </div>
                <div className="text-left flex-shrink-0">
                  <div className="font-black text-rose-600">{fmt(c.balance)} <span className="text-[10px] font-normal text-slate-400">{cur}</span></div>
                  <button onClick={() => setSelected(selected?.id === c.id ? null : c)}
                    className="text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-2 py-1 rounded-md mt-1">
                    💵 سداد
                  </button>
                </div>
              </div>
              {selected?.id === c.id && (
                <div className="flex gap-2 mt-2 pt-2 border-t border-rose-100">
                  <input type="number" value={payAmt} onChange={e => setPayAmt(e.target.value)}
                    className="inp text-sm flex-1" placeholder={`مبلغ السداد (${cur})`} autoFocus />
                  <button onClick={recordPayment}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black px-3 rounded-lg">✔</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Main page with tabs ────────────────────────────────────────
export default function WorkspacePage() {
  const { profile } = useAuthStore()
  const { settings } = useSettingsStore()
  const cur = settings?.currency_symbol || settings?.currency || 'درهم'
  const bagCount = useBagStore(s => s.items.reduce((acc, b) => acc + b.qty, 0))

  const VALID_TABS = ['browse', 'cart', 'orders', 'customers', 'debts']
  const [tab, setTab] = useState(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash && VALID_TABS.includes(hash)) return hash
    return bagCount > 0 ? 'cart' : 'browse'
  })

  // React to hash changes (e.g. after save, we navigate to #orders)
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace('#', '')
      if (VALID_TABS.includes(h)) setTab(h)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const TABS = [
    { key: 'browse',    label: 'منتجات',  icon: '📋' },
    { key: 'cart',      label: 'السلة',   icon: '🛍',  badge: bagCount || null },
    { key: 'orders',    label: 'طلبات',   icon: '🧾' },
    { key: 'customers', label: 'الزبائن', icon: '👤' },
    { key: 'debts',     label: 'الديون',  icon: '⚖️' },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden font-arabic bg-slate-50" dir="rtl">
      {/* Tab bar */}
      <div className="bg-white border-b border-slate-200 flex-shrink-0 px-2 pt-2">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`relative flex items-center gap-1.5 px-4 py-2 rounded-t-xl text-sm font-black whitespace-nowrap transition flex-shrink-0 ${
                tab === t.key
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              <span>{t.icon}</span><span>{t.label}</span>
              {t.badge != null && (
                <span className={`text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center ${
                  tab === t.key ? 'bg-white text-primary' : 'bg-rose-500 text-white'
                }`}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'browse'    && <BrowseTab cur={cur} />}
        {tab === 'cart'      && <CartTab cur={cur} profile={profile} />}
        {tab === 'orders'    && <OrdersTab cur={cur} profile={profile} />}
        {tab === 'customers' && <CustomersTab cur={cur} />}
        {tab === 'debts'     && <DebtsTab cur={cur} />}
      </div>
    </div>
  )
}
