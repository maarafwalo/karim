import { useState } from 'react'
import { useProductsStore } from '../../stores/productsStore.js'
import { useAuthStore } from '../../stores/authStore.js'
import { useSettingsStore } from '../../stores/settingsStore.js'
import { supabase } from '../../lib/supabase.js'
import { fmt, generateOrderNumber, buildWhatsApp, STORE_PHONE } from '../../lib/utils.js'
import toast from 'react-hot-toast'

// ── Product Card ──────────────────────────────────────────────
function ProductCard({ p, inBag, cur, onAdd, onInc, onDec }) {
  const [imgError, setImgError] = useState(false)
  return (
    <div className={`bg-white rounded-2xl overflow-hidden flex flex-col transition-all hover:shadow-lg border-2 ${inBag ? 'border-primary shadow-md' : 'border-gray-100 shadow-sm'}`}>
      {/* Image area */}
      <div className="relative bg-gray-50 flex items-center justify-center flex-shrink-0" style={{ height: 140 }}>
        {p.image_url && !imgError
          ? <img src={p.image_url} alt={p.name} className="w-full h-full object-contain p-2" loading="lazy" onError={() => setImgError(true)} />
          : <span className="text-5xl">{p.emoji || '📦'}</span>
        }
        {inBag && (
          <span className="absolute top-2 left-2 bg-primary text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow-md">
            {inBag.qty}
          </span>
        )}
      </div>

      {/* Info area */}
      <div className="flex flex-col flex-1 p-2 gap-1">
        <p className="text-xs font-bold text-gray-800 leading-snug flex-1"
          style={{ display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', minHeight:'2.5rem' }}>
          {p.name}
        </p>
        {p.size && <p className="text-[10px] text-slate-400">{p.size}</p>}
        <div className="flex items-center justify-between gap-1 mt-auto pt-1 border-t border-gray-100">
          <span className="text-sm font-black text-red-600">{fmt(p.sell_price)} <span className="text-[10px] text-slate-400 font-normal">{cur}</span></span>
          {inBag ? (
            <div className="flex items-center gap-0.5">
              <button onClick={onDec} className="w-6 h-6 bg-gray-100 rounded-md text-base font-black hover:bg-gray-200 flex items-center justify-center leading-none">−</button>
              <span className="text-sm font-black text-primary w-5 text-center">{inBag.qty}</span>
              <button onClick={onInc} className="w-6 h-6 bg-primary text-white rounded-md text-base font-black flex items-center justify-center leading-none">+</button>
            </div>
          ) : (
            <button onClick={onAdd} className="bg-green-500 hover:bg-green-600 text-white rounded-lg px-2 py-1 text-[11px] font-bold transition-colors">
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

  const cur      = settings?.currency || 'درهم'
  const products = filteredProducts()

  const addToBag = (product) => {
    setBag(prev => {
      const ex = prev.find(b => b.product.id === product.id)
      if (ex) return prev.map(b => b.product.id === product.id ? { ...b, qty: b.qty+1 } : b)
      return [...prev, { product, qty: 1 }]
    })
    toast.success(`${product.name} ✔`, { duration: 600, style: { fontSize: '0.8rem' } })
  }

  const removeFromBag = (id) => setBag(prev => prev.filter(b => b.product.id !== id))

  const bagTotal = bag.reduce((s, b) => s + b.product.sell_price * b.qty, 0)
  const bagCount = bag.reduce((s, b) => s + b.qty, 0)

  const sendOrder = async () => {
    if (!customer.name || !customer.phone) { toast.error('أدخل الاسم والهاتف'); return }
    setSending(true)
    const orderNum = generateOrderNumber('ORD')

    try {
      const { data: order } = await supabase.from('catalog_orders').insert({
        order_number:      orderNum,
        vendor_id:         profile?.id || null,
        customer_name:     customer.name,
        customer_phone:    customer.phone,
        customer_address:  customer.address,
        subtotal:          bagTotal,
        total:             bagTotal,
        status:            'new',
        wa_sent:           true,
      }).select().single()

      if (order) {
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
      }
    } catch (e) { /* offline mode */ }

    const lines = bag.map(b =>
      `• ${b.product.name}${b.product.size ? ` (${b.product.size})` : ''} × ${b.qty} = ${fmt(b.product.sell_price * b.qty)} ${cur}`
    ).join('\n')

    const msg = `🛒 طلب جديد — ${orderNum}\n\n` +
      `👤 ${customer.name}\n📞 ${customer.phone}\n` +
      (customer.address ? `📍 ${customer.address}\n` : '') +
      `\n${lines}\n\n💰 الإجمالي: ${fmt(bagTotal)} ${cur}`

    window.open(buildWhatsApp(settings?.phone || STORE_PHONE, msg), '_blank')

    setSending(false)
    setShowOrder(false)
    setBag([])
    setCustomer({ name:'', phone:'', address:'' })
    toast.success('✔ تم إرسال الطلب')
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
      <div className="flex-1 overflow-y-auto p-3">
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
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
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
          className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-primary text-white font-black px-6 py-3 rounded-2xl shadow-xl flex items-center gap-2 z-30">
          🛍️ {bagCount} منتج — {fmt(bagTotal)} {cur}
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
              {bag.map(b => (
                <div key={b.product.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-2">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {b.product.image_url ? <img src={b.product.image_url} alt="" className="w-full h-full object-contain" /> : <span className="text-xl">{b.product.emoji}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{b.product.name}</p>
                    <p className="text-xs text-slate-400">{fmt(b.product.sell_price)} × {b.qty} = <span className="text-red-600 font-bold">{fmt(b.product.sell_price*b.qty)} {cur}</span></p>
                  </div>
                  <button onClick={() => removeFromBag(b.product.id)} className="text-red-400 text-sm hover:opacity-70">✕</button>
                </div>
              ))}
            </div>
            <div className="p-4 border-t bg-gray-50">
              <div className="flex justify-between font-black text-lg mb-3">
                <span>الإجمالي</span><span className="text-primary">{fmt(bagTotal)} {cur}</span>
              </div>
              <button onClick={() => { setShowBag(false); setShowOrder(true) }}
                className="w-full bg-green-500 text-white font-black py-3 rounded-xl text-base hover:bg-green-600 transition-colors">
                📱 إرسال الطلب عبر واتساب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order / customer info modal */}
      {showOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 animate-slide-up">
            <h2 className="font-black text-lg mb-4">👤 معلومات الزبون</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-bold block mb-1">الاسم *</label>
                <input value={customer.name} onChange={e=>setCustomer(c=>({...c,name:e.target.value}))} className="inp" placeholder="محمد أحمد" />
              </div>
              <div>
                <label className="text-sm font-bold block mb-1">الهاتف *</label>
                <input value={customer.phone} onChange={e=>setCustomer(c=>({...c,phone:e.target.value}))} className="inp" placeholder="0600000000" />
              </div>
              <div>
                <label className="text-sm font-bold block mb-1">العنوان</label>
                <input value={customer.address} onChange={e=>setCustomer(c=>({...c,address:e.target.value}))} className="inp" placeholder="الحي، المدينة" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowOrder(false)} className="flex-1 bg-gray-100 text-gray-700 font-bold py-2.5 rounded-xl">إلغاء</button>
              <button onClick={sendOrder} disabled={sending}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white font-black py-2.5 rounded-xl transition-colors disabled:opacity-60">
                {sending ? '...' : '📱 إرسال'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
