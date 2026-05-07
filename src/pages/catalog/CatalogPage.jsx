import { useState } from 'react'
import { useProductsStore } from '../../stores/productsStore.js'
import { useAuthStore } from '../../stores/authStore.js'
import { useSettingsStore } from '../../stores/settingsStore.js'
import { supabase, supabaseAdmin } from '../../lib/supabase.js'
import { fmt, generateOrderNumber } from '../../lib/utils.js'
import toast from 'react-hot-toast'

// ── Virtual Keyboard (Arabic + numbers, for touch devices) ────
// Order matches user request: دجحخهعغفقثصضشسيبلاتنمكطذظزوةىلارؤءئ
const AR_LAYOUT = [
  ['1','2','3','4','5','6','7','8','9','0'],
  ['د','ج','ح','خ','ه','ع','غ','ف','ق','ث','ص','ض'],
  ['ش','س','ي','ب','ل','ا','ت','ن','م','ك','ط'],
  ['ذ','ظ','ز','و','ة','ى','لا','ر','ؤ','ء','ئ'],
]
const NUM_LAYOUT = [
  ['1','2','3'],
  ['4','5','6'],
  ['7','8','9'],
  ['+','0','.'],
]

function VirtualKeyboard({ onKey, onBackspace, onClose, mode = 'ar' }) {
  const layout = mode === 'num' ? NUM_LAYOUT : AR_LAYOUT
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[60] font-arabic backdrop-blur-md"
      style={{
        background: 'linear-gradient(180deg, rgba(248,250,252,.85) 0%, rgba(241,245,249,.95) 100%)',
        boxShadow: '0 -10px 40px rgba(15,23,42,.18)',
        borderTop: '1px solid rgba(148,163,184,.4)',
        paddingBottom: 'env(safe-area-inset-bottom, 8px)',
      }}
      onMouseDown={e => e.preventDefault()}
    >
      <div className="flex justify-between items-center px-3 pt-2 pb-1">
        <button onMouseDown={e => { e.preventDefault(); onBackspace() }}
          className="flex items-center gap-1.5 bg-white text-rose-600 font-bold px-3 py-2 rounded-xl text-sm shadow-sm hover:shadow active:scale-95 transition">
          <span className="text-base">⌫</span> مسح
        </button>
        <span className="text-slate-500 text-xs font-bold tracking-wide">{mode === 'num' ? '0—9' : 'عربي'}</span>
        <button onMouseDown={e => { e.preventDefault(); onClose() }}
          className="flex items-center gap-1.5 bg-white text-slate-700 font-bold px-3 py-2 rounded-xl text-sm shadow-sm hover:shadow active:scale-95 transition">
          إغلاق <span className="text-base">✕</span>
        </button>
      </div>
      <div className="px-2 pb-2 space-y-1.5" dir={mode === 'num' ? 'ltr' : 'rtl'}>
        {layout.map((row, ri) => {
          const rowDir = (mode === 'ar' && ri === 0) ? 'ltr' : (mode === 'num' ? 'ltr' : 'rtl')
          return (
            <div key={ri} dir={rowDir} className={`flex gap-1.5 justify-center ${mode === 'num' ? 'max-w-xs mx-auto' : ''}`}>
              {row.map((k, ki) => (
                <button key={ki} onMouseDown={e => { e.preventDefault(); onKey(k) }}
                  className="bg-white hover:bg-blue-50 active:bg-blue-100 active:scale-95 text-slate-900 font-black rounded-xl flex-1 min-w-[28px] text-xl font-arabic transition"
                  style={{
                    boxShadow: '0 1px 3px rgba(15,23,42,.08), 0 1px 0 rgba(255,255,255,.9) inset',
                    border: '1px solid rgba(226,232,240,.8)',
                    paddingTop: '14px',
                    paddingBottom: '14px',
                  }}>
                  {k}
                </button>
              ))}
            </div>
          )
        })}
        {mode !== 'num' && (
          <div className="flex justify-center pt-1">
            <button onMouseDown={e => { e.preventDefault(); onKey(' ') }}
              className="bg-white hover:bg-blue-50 active:bg-blue-100 active:scale-95 text-slate-700 font-bold rounded-xl py-3 px-16 text-sm shadow-sm transition">
              مسافة
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Product Card ──────────────────────────────────────────────
const PRICE_STEP = 0.50  // dirham step for negotiation

function ProductCard({ p, inBag, cur, onAdd, onInc, onDec, onPriceChange }) {
  const [imgError, setImgError] = useState(false)
  const negPrice    = inBag ? (typeof inBag.negotiatedPrice === 'number' ? inBag.negotiatedPrice : p.sell_price) : p.sell_price
  const isNeg       = inBag && negPrice !== p.sell_price
  const priceUp     = (e) => { e.stopPropagation(); onPriceChange(+(negPrice + PRICE_STEP).toFixed(2)) }
  const priceDown   = (e) => { e.stopPropagation(); onPriceChange(Math.max(0, +(negPrice - PRICE_STEP).toFixed(2))) }
  const priceReset  = (e) => { e.stopPropagation(); onPriceChange(p.sell_price) }

  return (
    <div className={`bg-white rounded-2xl overflow-hidden flex flex-col transition-all hover:shadow-lg border-2 ${inBag ? (isNeg ? 'border-amber-400 shadow-md' : 'border-primary shadow-md') : 'border-gray-100 shadow-sm'}`}>
      {/* Image area */}
      <div className="relative bg-gray-50 flex items-center justify-center flex-shrink-0" style={{ height: 130 }}>
        {p.image_url && !imgError
          ? <img src={p.image_url} alt={p.name} className="w-full h-full object-contain p-1.5" loading="lazy" onError={() => setImgError(true)} />
          : <span className="text-4xl">{p.emoji || '📦'}</span>
        }
        {inBag && (
          <span className="absolute top-1.5 left-1.5 bg-primary text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md">
            {inBag.qty}
          </span>
        )}
      </div>

      {/* Info area */}
      <div className="flex flex-col flex-1 p-2 gap-0.5">
        <p className="text-xs font-bold text-gray-800 leading-tight flex-1"
          style={{ display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', minHeight:'2.2rem' }}>
          {p.name}
        </p>
        {p.size && <p className="text-[10px] text-slate-400 leading-tight">{p.size}</p>}

        {inBag ? (
          <div className="mt-auto pt-1 border-t border-gray-100 space-y-1">
            {/* Price stepper row */}
            <div className="flex items-center justify-between gap-1">
              <button onClick={priceDown}
                className="w-6 h-6 bg-rose-100 hover:bg-rose-200 active:scale-90 text-rose-600 rounded-md text-base font-black flex items-center justify-center leading-none transition">−</button>
              <div className="flex flex-col items-center flex-1 leading-none">
                {isNeg && <span className="text-[8px] line-through text-slate-400">{fmt(p.sell_price)}</span>}
                <span className={`text-sm font-black ${isNeg ? 'text-amber-600' : 'text-red-600'}`}>{fmt(negPrice)}</span>
                <span className="text-[8px] text-slate-400">{cur}</span>
              </div>
              <button onClick={priceUp}
                className="w-6 h-6 bg-emerald-100 hover:bg-emerald-200 active:scale-90 text-emerald-700 rounded-md text-base font-black flex items-center justify-center leading-none transition">+</button>
            </div>
            {/* Reset price + qty stepper row */}
            <div className="flex items-center justify-between gap-1">
              {isNeg ? (
                <button onClick={priceReset}
                  className="text-[9px] text-amber-600 hover:underline font-bold whitespace-nowrap">↺ افتراضي</button>
              ) : <span className="text-[9px] text-slate-300">السعر الأصلي</span>}
              <div className="flex items-center gap-0.5">
                <button onClick={(e)=>{e.stopPropagation();onDec()}} className="w-6 h-6 bg-gray-100 hover:bg-gray-200 active:scale-90 rounded-md text-base font-black flex items-center justify-center leading-none transition">−</button>
                <span className="text-xs font-black text-primary w-5 text-center">{inBag.qty}</span>
                <button onClick={(e)=>{e.stopPropagation();onInc()}} className="w-6 h-6 bg-primary hover:opacity-90 active:scale-90 text-white rounded-md text-base font-black flex items-center justify-center leading-none transition">+</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-1 mt-auto pt-1 border-t border-gray-100">
            <span className="text-sm font-black text-red-600 leading-none">{fmt(p.sell_price)} <span className="text-[9px] text-slate-400 font-normal">{cur}</span></span>
            <button onClick={onAdd} className="bg-green-500 hover:bg-green-600 text-white rounded-lg px-2 py-1 text-[10px] font-bold transition-colors leading-none">
              + إضافة
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CatalogPage() {
  const { categories, filteredProducts, activeCat, setActiveCat, searchQ, setSearchQ, loading } = useProductsStore()
  const { profile } = useAuthStore()
  const { settings } = useSettingsStore()

  const [bag, setBag]           = useState([])
  const [showBag, setShowBag]   = useState(false)
  const [customer, setCustomer] = useState({ name:'', phone:'', address:'' })
  const [showOrder, setShowOrder] = useState(false)
  const [sending, setSending]   = useState(false)
  const [activeField, setActiveField]   = useState(null)  // 'name'|'phone'|'address'|null
  const [activePriceId, setActivePriceId] = useState(null) // bag item id being edited
  const [savedInvoice, setSavedInvoice]   = useState(null) // shown after successful save

  const kbInsert = (ch) => {
    if (activePriceId !== null) {
      // Price field — accept only digits and decimal
      if (!/^[0-9.]$/.test(ch)) return
      setBag(prev => prev.map(b => {
        if (b.product.id !== activePriceId) return b
        const cur = String(b.negotiatedPrice ?? b.product.sell_price ?? '')
        // Don't allow second decimal
        if (ch === '.' && cur.includes('.')) return b
        const nextStr = cur + ch
        const num = parseFloat(nextStr)
        return { ...b, negotiatedPrice: isNaN(num) ? 0 : num, _priceStr: nextStr }
      }))
      return
    }
    if (!activeField) return
    setCustomer(c => ({ ...c, [activeField]: (c[activeField] || '') + ch }))
  }
  const kbBackspace = () => {
    if (activePriceId !== null) {
      setBag(prev => prev.map(b => {
        if (b.product.id !== activePriceId) return b
        const cur = b._priceStr ?? String(b.negotiatedPrice ?? '')
        const nextStr = cur.slice(0, -1)
        const num = parseFloat(nextStr)
        return { ...b, negotiatedPrice: isNaN(num) ? 0 : num, _priceStr: nextStr }
      }))
      return
    }
    if (!activeField) return
    setCustomer(c => ({ ...c, [activeField]: (c[activeField] || '').slice(0, -1) }))
  }

  const cur      = settings?.currency || 'درهم'
  const products = filteredProducts()

  const addToBag = (product) => {
    setBag(prev => {
      const ex = prev.find(b => b.product.id === product.id)
      if (ex) return prev.map(b => b.product.id === product.id ? { ...b, qty: b.qty+1 } : b)
      // negotiatedPrice = current price (may be changed in bag); originalPrice = catalog reference
      return [...prev, { product, qty: 1, negotiatedPrice: product.sell_price }]
    })
    toast.success(`${product.name} ✔`, { duration: 600, style: { fontSize: '0.8rem' } })
  }

  const removeFromBag = (id) => setBag(prev => prev.filter(b => b.product.id !== id))

  const setNegotiatedPrice = (id, newPrice) => {
    const p = parseFloat(newPrice) || 0
    setBag(prev => prev.map(b => b.product.id === id ? { ...b, negotiatedPrice: p } : b))
  }

  const priceOf = (b) => (typeof b.negotiatedPrice === 'number' ? b.negotiatedPrice : b.product.sell_price)
  const bagTotal = bag.reduce((s, b) => s + priceOf(b) * b.qty, 0)
  const bagCount = bag.reduce((s, b) => s + b.qty, 0)
  const hasNegotiated = bag.some(b => priceOf(b) !== b.product.sell_price)

  const isPartner = profile?.role === 'trusted_partner'

  // ── Partner: submit take-request directly (no WhatsApp) ──
  const submitPartnerRequest = async () => {
    setSending(true)
    const orderNum = generateOrderNumber('TKR') // TaKe Request
    try {
      const { data: order, error } = await supabase.from('catalog_orders').insert({
        order_number:        orderNum,
        vendor_id:           profile?.id || null,
        customer_name:       profile?.full_name || 'شريك',
        customer_phone:      profile?.phone || '',
        subtotal:            bagTotal,
        total:               bagTotal,
        status:              'partner_request',
        wa_sent:             false,
        is_partner_request:  true,
        stock_approved:      false,
      }).select().single()

      if (!error && order) {
        await supabase.from('catalog_order_items').insert(
          bag.map(b => ({
            order_id:     order.id,
            product_id:   b.product.id,
            product_name: b.product.name,
            unit_price:   b.product.sell_price,
            quantity:     b.qty,
            total:        b.product.sell_price * b.qty,
          }))
        )
        toast.success('✅ تم تقديم طلبك — بانتظار تأكيد عمران', { duration: 5000 })
      } else {
        toast.error('فشل تقديم الطلب')
      }
    } catch (e) {
      toast.error('خطأ: ' + e.message)
    }
    setSending(false)
    setShowBag(false)
    setBag([])
  }

  // ── Vendor: regular order via WhatsApp ──
  const sendOrder = async () => {
    if (!customer.name || !customer.phone) { toast.error('أدخل الاسم والهاتف'); return }
    setSending(true)
    const orderNum = generateOrderNumber('ORD')

    // Use admin client to bypass RLS if available, otherwise anon (with proper RLS policy)
    const db = supabaseAdmin || supabase

    // Add 8-second timeout so UI never hangs forever
    const withTimeout = (p, ms = 8000) => Promise.race([
      p,
      new Promise((_, rej) => setTimeout(() => rej(new Error('انتهت المهلة (timeout)')), ms))
    ])

    let saved = false
    let saveError = null
    try {
      const { data: order, error: ordErr } = await withTimeout(
        db.from('catalog_orders').insert({
          order_number:      orderNum,
          vendor_id:         profile?.id || null,
          customer_name:     customer.name,
          customer_phone:    customer.phone,
          customer_address:  customer.address,
          subtotal:          bagTotal,
          total:             bagTotal,
          status:            'new',
          wa_sent:           false,
          is_partner_request: false,
        }).select().single()
      )

      if (ordErr) throw ordErr

      if (order) {
        const { error: itemsErr } = await withTimeout(
          db.from('catalog_order_items').insert(
            bag.map(b => {
              const negPrice = priceOf(b)
              const orig = b.product.sell_price
              const isNeg = negPrice !== orig
              return {
                order_id:     order.id,
                product_id:   b.product.id,
                product_name: b.product.name,
                unit_price:   negPrice,                    // actual sell price (may be negotiated)
                original_price: orig,                       // catalog reference price
                negotiated:   isNeg,                        // boolean flag for admin filtering
                price_diff:   +(negPrice - orig).toFixed(2),// + or - vs catalog
                quantity:     b.qty,
                total:        negPrice * b.qty,
              }
            })
          )
        )
        if (itemsErr) throw itemsErr
        saved = true
      }
    } catch (e) {
      saveError = e
      console.error('Order save failed:', e)
    }

    // Always reset sending state (even on error)
    setSending(false)

    if (!saved) {
      // Save locally so order isn't lost even if Supabase failed
      try {
        const pending = JSON.parse(localStorage.getItem('pending_orders') || '[]')
        pending.push({
          order_number: orderNum,
          customer, bag,
          subtotal: bagTotal, total: bagTotal,
          status: 'new',
          created_at: new Date().toISOString(),
          error: saveError?.message || 'unknown',
        })
        localStorage.setItem('pending_orders', JSON.stringify(pending))
      } catch {/* noop */}
      toast.error(`⚠ فشل الحفظ: ${saveError?.message || 'خطأ'} — حُفظ محلياً`, { duration: 6000 })
      return
    }

    toast.success(`✔ تم حفظ الفاتورة #${orderNum} وإرسالها للإدارة`, { duration: 4000 })
    setShowOrder(false)
    setBag([])
    setCustomer({ name:'', phone:'', address:'' })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden font-arabic" dir="rtl">
      {/* Search + Category bar */}
      <div className="bg-white border-b border-gray-100 flex-shrink-0">
        <div className="p-2">
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
            className="inp" placeholder="🔍 ابحث عن منتج..." />
        </div>
        <div className="flex gap-1 overflow-x-auto px-2 pb-2">
          {categories.map(c => (
            <button key={c.name} onClick={() => setActiveCat(c.name)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all ${
                activeCat === c.name ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}>
              <span>{c.emoji}</span><span>{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Products grid */}
      <div className="flex-1 overflow-y-auto p-2 pb-24">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm gap-2">
            <span className="animate-spin text-xl">⏳</span>
            <span>جاري التحميل...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
            <span className="text-4xl">🔍</span>
            <span className="text-sm">لا توجد منتجات</span>
          </div>
        ) : (
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {products.map(p => {
              const inBag = bag.find(b => b.product.id === p.id)
              return (
                <ProductCard
                  key={p.id}
                  p={p}
                  inBag={inBag}
                  cur={cur}
                  onAdd={() => addToBag(p)}
                  onInc={() => addToBag(p)}
                  onDec={() => setBag(prev => prev.map(b => b.product.id===p.id ? {...b,qty:b.qty-1} : b).filter(b=>b.qty>0))}
                  onPriceChange={(newPrice) => setNegotiatedPrice(p.id, newPrice)}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Floating bag button */}
      {bagCount > 0 && (
        <button onClick={() => setShowBag(true)}
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 font-black px-6 py-3 rounded-2xl shadow-xl flex items-center gap-2 z-30 text-white ${
            isPartner ? 'bg-amber-500 hover:bg-amber-600' : 'bg-primary hover:bg-primary-dark'
          }`}>
          {isPartner ? '🤝' : '🛍️'} {bagCount} منتج — {fmt(bagTotal)} {cur}
        </button>
      )}

      {/* Bag modal — clean design */}
      {showBag && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade-in"
          style={{ paddingBottom: activePriceId !== null ? '300px' : '0', transition: 'padding-bottom .2s' }}
          onClick={() => setShowBag(false)}
        >
          <div
            className="w-full max-w-md bg-white flex flex-col animate-slide-up"
            style={{
              maxHeight: activePriceId !== null ? 'calc(100vh - 320px)' : '92vh',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              transition: 'max-height .2s',
            }}
            onClick={e=>e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 pt-4 pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-slate-900">سلة الطلب</h2>
                <button onClick={() => setShowBag(false)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 active:bg-slate-200 text-slate-400 flex items-center justify-center text-lg leading-none transition">
                  ✕
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{bagCount} منتج · انقر السعر للتعديل</p>
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {bag.map(b => {
                const negPrice = priceOf(b)
                const isNeg = negPrice !== b.product.sell_price
                const isActive = activePriceId === b.product.id
                return (
                  <div key={b.product.id}
                    className={`flex items-center gap-3 px-3 py-3 rounded-2xl transition border ${
                      isActive ? 'bg-blue-50 border-blue-300' :
                      isNeg ? 'bg-amber-50/60 border-amber-200' :
                      'bg-slate-50 border-transparent hover:bg-slate-100'
                    }`}
                  >
                    {/* Image */}
                    <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden">
                      {b.product.image_url
                        ? <img src={b.product.image_url} alt="" className="w-full h-full object-contain p-0.5" />
                        : <span className="text-2xl">{b.product.emoji || '📦'}</span>}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate leading-tight">{b.product.name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        × {b.qty} = <span className="font-bold text-rose-600">{fmt(negPrice * b.qty)} {cur}</span>
                      </p>
                    </div>

                    {/* Price (tap to edit) */}
                    <button
                      onClick={() => { setActivePriceId(b.product.id); setActiveField(null) }}
                      className={`flex flex-col items-center px-3 py-2 rounded-xl border-2 min-w-[90px] transition active:scale-95 ${
                        isActive ? 'bg-white border-blue-500 shadow-md' :
                        isNeg ? 'bg-white border-amber-400' :
                        'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {isNeg && !isActive && (
                        <span className="text-[9px] line-through text-slate-400">{fmt(b.product.sell_price)}</span>
                      )}
                      <span className={`text-base font-black leading-none ${
                        isActive ? 'text-blue-700' : isNeg ? 'text-amber-700' : 'text-slate-800'
                      }`}>
                        {b._priceStr ?? fmt(negPrice)}
                      </span>
                      <span className="text-[9px] text-slate-400 mt-0.5">{cur}</span>
                    </button>

                    {/* Remove */}
                    <button onClick={() => removeFromBag(b.product.id)}
                      className="w-8 h-8 rounded-full text-slate-300 hover:bg-rose-50 hover:text-rose-500 active:scale-90 flex items-center justify-center transition flex-shrink-0">
                      🗑
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="px-5 pt-3 pb-5 border-t border-slate-100">
              {hasNegotiated && (
                <div className="flex items-center gap-2 bg-amber-50 text-amber-800 text-xs font-bold rounded-xl px-3 py-2 mb-3">
                  <span>ℹ</span>
                  <span>أسعار التفاوض ستظهر للإدارة</span>
                </div>
              )}
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-sm font-bold text-slate-500">الإجمالي</span>
                <span className={`text-2xl font-black ${isPartner ? 'text-amber-600' : 'text-slate-900'}`}>
                  {fmt(bagTotal)}
                  <span className="text-xs text-slate-400 font-normal mr-1">{cur}</span>
                </span>
              </div>
              {isPartner ? (
                <button onClick={submitPartnerRequest} disabled={sending}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-black py-3.5 rounded-2xl text-base transition active:scale-[.98]">
                  {sending ? '⏳ جارٍ الإرسال...' : '🤝 تقديم طلب أخذ بضاعة'}
                </button>
              ) : (
                <button onClick={() => { setShowBag(false); setShowOrder(true) }}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3.5 rounded-2xl text-base transition active:scale-[.98]">
                  متابعة لإدخال بيانات الزبون ←
                </button>
              )}
            </div>
          </div>

          {/* Virtual numeric keyboard */}
          {activePriceId !== null && (
            <VirtualKeyboard
              mode="num"
              onKey={kbInsert}
              onBackspace={kbBackspace}
              onClose={() => setActivePriceId(null)}
            />
          )}
        </div>
      )}

      {/* Order / customer info modal */}
      {showOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 pt-10 animate-fade-in" style={{ paddingBottom: activeField ? '320px' : '16px' }}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 animate-slide-up">
            <h2 className="font-black text-lg mb-4">👤 معلومات الزبون</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-bold block mb-1">الاسم *</label>
                <input value={customer.name}
                  onFocus={() => setActiveField('name')}
                  onClick={() => setActiveField('name')}
                  onChange={()=>{}}
                  readOnly
                  inputMode="none"
                  className={`inp font-arabic cursor-pointer ${activeField === 'name' ? 'ring-2 ring-primary' : ''}`} placeholder="محمد أحمد" />
              </div>
              <div>
                <label className="text-sm font-bold block mb-1">الهاتف *</label>
                <input value={customer.phone}
                  onFocus={() => setActiveField('phone')}
                  onClick={() => setActiveField('phone')}
                  onChange={()=>{}}
                  readOnly
                  inputMode="none"
                  className={`inp cursor-pointer ${activeField === 'phone' ? 'ring-2 ring-primary' : ''}`} placeholder="0600000000" />
              </div>
              <div>
                <label className="text-sm font-bold block mb-1">العنوان</label>
                <input value={customer.address}
                  onFocus={() => setActiveField('address')}
                  onClick={() => setActiveField('address')}
                  onChange={()=>{}}
                  readOnly
                  inputMode="none"
                  className={`inp font-arabic cursor-pointer ${activeField === 'address' ? 'ring-2 ring-primary' : ''}`} placeholder="الحي، المدينة" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setActiveField(null); setShowOrder(false) }} className="flex-1 bg-gray-100 text-gray-700 font-bold py-2.5 rounded-xl">إلغاء</button>
              <button onClick={sendOrder} disabled={sending}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white font-black py-2.5 rounded-xl transition-colors disabled:opacity-60">
                {sending ? '...' : '📋 حفظ وإرسال'}
              </button>
            </div>
          </div>

          {/* Virtual keyboard appears when an input is focused */}
          {activeField && (
            <VirtualKeyboard
              mode={activeField === 'phone' ? 'num' : 'ar'}
              onKey={kbInsert}
              onBackspace={kbBackspace}
              onClose={() => setActiveField(null)}
            />
          )}
        </div>
      )}
    </div>
  )
}
