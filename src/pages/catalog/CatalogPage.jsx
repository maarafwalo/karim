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
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 z-[60] p-2 border-t-2 border-gray-700 shadow-2xl font-arabic" onMouseDown={e => e.preventDefault()}>
      <div className="flex justify-between items-center mb-2">
        <button onMouseDown={e => { e.preventDefault(); onBackspace() }} className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-lg text-sm">⌫ مسح</button>
        <span className="text-white text-xs font-bold">{mode === 'num' ? 'أرقام' : 'عربي'}</span>
        <button onMouseDown={e => { e.preventDefault(); onClose() }} className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-4 py-2 rounded-lg text-sm">✕ إغلاق</button>
      </div>
      <div className="space-y-1" dir={mode === 'num' ? 'ltr' : 'rtl'}>
        {layout.map((row, ri) => {
          // First row in AR mode is digits — keep LTR, otherwise RTL so first letter shows on right
          const rowDir = (mode === 'ar' && ri === 0) ? 'ltr' : (mode === 'num' ? 'ltr' : 'rtl')
          return (
            <div key={ri} dir={rowDir} className={`flex gap-1 justify-center ${mode === 'num' ? 'max-w-xs mx-auto' : ''}`}>
              {row.map((k, ki) => (
                <button key={ki} onMouseDown={e => { e.preventDefault(); onKey(k) }}
                  className="bg-white hover:bg-gray-200 active:bg-blue-200 text-gray-900 font-black rounded-md flex-1 py-3 min-w-[28px] text-xl shadow font-arabic">
                  {k}
                </button>
              ))}
            </div>
          )
        })}
        <div className="flex gap-1 justify-center">
          <button onMouseDown={e => { e.preventDefault(); onKey(' ') }}
            className="bg-white hover:bg-gray-200 active:bg-blue-200 text-gray-900 font-bold rounded-md py-3 px-12 text-base shadow font-arabic">
            مسافة
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Product Card ──────────────────────────────────────────────
function ProductCard({ p, inBag, cur, onAdd, onInc, onDec }) {
  const [imgError, setImgError] = useState(false)
  return (
    <div className={`bg-white rounded-2xl overflow-hidden flex flex-col transition-all hover:shadow-lg border-2 ${inBag ? 'border-primary shadow-md' : 'border-gray-100 shadow-sm'}`}>
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
        <div className="flex items-center justify-between gap-1 mt-auto pt-1 border-t border-gray-100">
          <span className="text-sm font-black text-red-600 leading-none">{fmt(p.sell_price)} <span className="text-[9px] text-slate-400 font-normal">{cur}</span></span>
          {inBag ? (
            <div className="flex items-center gap-0.5">
              <button onClick={onDec} className="w-6 h-6 bg-gray-100 rounded-md text-base font-black hover:bg-gray-200 flex items-center justify-center leading-none">−</button>
              <span className="text-xs font-black text-primary w-5 text-center">{inBag.qty}</span>
              <button onClick={onInc} className="w-6 h-6 bg-primary text-white rounded-md text-base font-black flex items-center justify-center leading-none">+</button>
            </div>
          ) : (
            <button onClick={onAdd} className="bg-green-500 hover:bg-green-600 text-white rounded-lg px-2 py-1 text-[10px] font-bold transition-colors leading-none">
              + إضافة
            </button>
          )}
        </div>
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
  const [activeField, setActiveField] = useState(null)  // 'name'|'phone'|'address'|null

  const kbInsert = (ch) => {
    if (!activeField) return
    setCustomer(c => ({ ...c, [activeField]: (c[activeField] || '') + ch }))
  }
  const kbBackspace = () => {
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

      {/* Bag modal */}
      {showBag && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center animate-fade-in" onClick={() => setShowBag(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-slide-up" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="font-black text-lg">🛍️ سلة الطلب</h2>
              <button onClick={() => setShowBag(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {bag.map(b => {
                const negPrice = priceOf(b)
                const isNeg = negPrice !== b.product.sell_price
                return (
                <div key={b.product.id} className="bg-gray-50 rounded-xl p-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {b.product.image_url ? <img src={b.product.image_url} alt="" className="w-full h-full object-contain" /> : <span className="text-xl">{b.product.emoji}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{b.product.name}</p>
                      <p className="text-xs text-slate-400">
                        {isNeg && <span className="line-through ml-1">{fmt(b.product.sell_price)}</span>}
                        <span className={isNeg ? 'text-amber-600 font-bold' : ''}>{fmt(negPrice)}</span> × {b.qty}
                        {' = '}
                        <span className="text-red-600 font-bold">{fmt(negPrice * b.qty)} {cur}</span>
                      </p>
                    </div>
                    <button onClick={() => removeFromBag(b.product.id)} className="text-red-400 text-sm hover:opacity-70">✕</button>
                  </div>
                  {/* Price negotiation row (vendor only) */}
                  <div className="flex items-center gap-2 mt-2 pr-12">
                    <label className="text-[10px] text-slate-500 font-bold whitespace-nowrap">سعر التفاوض:</label>
                    <input type="number" step="0.01" min="0"
                      value={negPrice}
                      onChange={e => setNegotiatedPrice(b.product.id, e.target.value)}
                      className={`flex-1 text-xs px-2 py-1 rounded-md border bg-white ${isNeg ? 'border-amber-400 ring-1 ring-amber-300' : 'border-gray-200'}`}
                    />
                    {isNeg && (
                      <button onClick={() => setNegotiatedPrice(b.product.id, b.product.sell_price)}
                        className="text-[10px] text-amber-600 hover:underline whitespace-nowrap">↺ افتراضي</button>
                    )}
                  </div>
                </div>
              )})}
            </div>
            <div className="p-4 border-t bg-gray-50">
              {hasNegotiated && (
                <div className="bg-amber-50 border border-amber-300 text-amber-800 text-xs font-bold rounded-lg p-2 mb-2 text-center">
                  ⚠ هذا الطلب فيه أسعار متفاوضة — ستظهر للإدارة
                </div>
              )}
              <div className="flex justify-between font-black text-lg mb-3">
                <span>الإجمالي</span>
                <span className={isPartner ? 'text-amber-600' : 'text-primary'}>{fmt(bagTotal)} {cur}</span>
              </div>
              {isPartner ? (
                <button
                  onClick={submitPartnerRequest}
                  disabled={sending}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-black py-3 rounded-xl text-base transition-colors"
                >
                  {sending ? '⏳ جارٍ الإرسال...' : '🤝 تقديم طلب أخذ بضاعة'}
                </button>
              ) : (
                <button onClick={() => { setShowBag(false); setShowOrder(true) }}
                  className="w-full bg-green-500 text-white font-black py-3 rounded-xl text-base hover:bg-green-600 transition-colors">
                  📋 حفظ الفاتورة وإرسالها للإدارة
                </button>
              )}
              {isPartner && (
                <p className="text-xs text-amber-600 text-center mt-2 font-bold">
                  سيُرسَل الطلب لعمران للتأكيد قبل إخراج البضاعة
                </p>
              )}
            </div>
          </div>
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
