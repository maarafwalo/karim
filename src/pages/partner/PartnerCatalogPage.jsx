/**
 * PartnerCatalogPage — لسعيد (trusted_partner)
 * كتالوج مخصص: المنتجات مع خانة "السعر المتفق عليه"
 * أسعار البيع العادية مخفية تماماً
 */
import { useState, useMemo } from 'react'
import { useProductsStore }    from '../../stores/productsStore.js'
import { usePartnerOrderStore } from '../../stores/partnerOrderStore.js'
import { useAuthStore }         from '../../stores/authStore.js'
import { fmt }                  from '../../lib/utils.js'
import toast                    from 'react-hot-toast'

// ── Product Card ──────────────────────────────────────────────
function ProductCard({ product }) {
  const [agreedPrice, setAgreedPrice] = useState('')
  const [qty, setQty]                 = useState(1)
  const { addItem, items }            = usePartnerOrderStore()
  const inCart = items.some(i => i.product.id === product.id)
  const isOOS  = product.stock !== null && product.stock <= 0

  const handleAdd = () => {
    const price = parseFloat(agreedPrice)
    if (!price || price <= 0) { toast.error('أدخل السعر المتفق عليه'); return }
    addItem(product, price, qty)
    setAgreedPrice('')
    setQty(1)
    toast.success(`${product.name} ✔`, { duration: 700, style: { fontSize: '0.8rem' } })
  }

  return (
    <div className={`bg-white rounded-xl border-2 p-2.5 flex flex-col gap-1.5 transition-all ${
      inCart   ? 'border-amber-400 shadow-md'
      : isOOS  ? 'border-gray-100 opacity-55'
      : 'border-gray-100 hover:border-amber-300'
    }`}>
      {/* Image */}
      <div className="relative">
        {product.image_url
          ? <img src={product.image_url} alt="" className="w-full h-20 object-contain rounded-lg bg-gray-50" loading="lazy" />
          : <div className="w-full h-20 bg-gray-50 rounded-lg flex items-center justify-center text-3xl">
              {product.emoji || '📦'}
            </div>
        }
        {isOOS && (
          <span className="absolute inset-0 bg-white/75 rounded-lg flex items-center justify-center text-xs text-red-600 font-black">
            نفد
          </span>
        )}
        {inCart && (
          <span className="absolute top-1 left-1 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
            ✔ في السلة
          </span>
        )}
      </div>

      {/* Name */}
      <p className="text-xs font-bold text-gray-800 leading-tight line-clamp-2 text-center">
        {product.name}
      </p>

      {/* Category */}
      {product.categories?.name && (
        <p className="text-[10px] text-gray-400 text-center">
          {product.categories.emoji} {product.categories.name}
        </p>
      )}

      {/* Stock */}
      {product.stock !== null && (
        <div className={`text-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
          isOOS             ? 'bg-red-100 text-red-600'
          : product.stock <= 5 ? 'bg-orange-100 text-orange-600'
          : 'bg-green-100 text-green-600'
        }`}>
          {isOOS ? 'نفد' : `${product.stock} متبقي`}
        </div>
      )}

      {/* Agreed price input */}
      <input
        type="number"
        min="0"
        step="0.01"
        value={agreedPrice}
        onChange={e => setAgreedPrice(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
        placeholder="السعر المتفق عليه"
        disabled={isOOS}
        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center font-black focus:outline-none focus:border-amber-400 placeholder:font-normal placeholder:text-[10px] disabled:opacity-40"
      />

      {/* Qty + Add */}
      <div className="flex gap-1">
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => setQty(q => Math.max(1, q - 1))}
            className="w-6 h-6 bg-gray-100 rounded-lg text-sm font-black hover:bg-gray-200 flex items-center justify-center"
          >−</button>
          <span className="w-5 text-center text-xs font-black">{qty}</span>
          <button
            onClick={() => setQty(q => q + 1)}
            className="w-6 h-6 bg-gray-100 rounded-lg text-sm font-black hover:bg-gray-200 flex items-center justify-center"
          >+</button>
        </div>
        <button
          onClick={handleAdd}
          disabled={isOOS || !agreedPrice}
          className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-black rounded-lg py-1.5 transition-colors"
        >
          +
        </button>
      </div>
    </div>
  )
}

// ── Basket Panel ──────────────────────────────────────────────
function BasketPanel({ onClose, onSubmit }) {
  const { items, removeItem, setPrice, setQty, getTotal, clear, submitting } =
    usePartnerOrderStore()
  const cur = 'ريال مغربي'
  const total = getTotal()

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6 gap-3">
        <span className="text-5xl">🛒</span>
        <p className="font-bold text-sm">السلة فارغة</p>
        <p className="text-xs text-center">اختر منتجاً وأدخل السعر المتفق عليه ثم اضغط +</p>
        {onClose && (
          <button onClick={onClose} className="mt-2 text-xs text-primary font-bold">
            ← رجوع
          </button>
        )}
      </div>
    )
  }

  const allPriced = items.every(i => Number(i.agreedPrice) > 0)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 flex-shrink-0">
        <span className="font-black text-sm flex-1">🛒 السلة ({items.length})</span>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-base">✕</button>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.map(({ product, agreedPrice, qty }) => (
          <div key={product.id} className="bg-gray-50 rounded-xl border border-amber-100 p-2.5">
            <div className="flex items-start gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-xs text-gray-800 leading-tight line-clamp-2">
                  {product.name}
                </p>
              </div>
              <button
                onClick={() => removeItem(product.id)}
                className="text-red-400 hover:text-red-600 text-sm flex-shrink-0 leading-none"
              >✕</button>
            </div>
            <div className="flex gap-1.5 items-center">
              {/* Qty */}
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setQty(product.id, qty - 1)}
                  className="w-5 h-5 bg-white border border-gray-200 rounded text-xs font-black hover:bg-gray-100"
                >−</button>
                <span className="w-6 text-center text-xs font-black">{qty}</span>
                <button
                  onClick={() => setQty(product.id, qty + 1)}
                  className="w-5 h-5 bg-white border border-gray-200 rounded text-xs font-black hover:bg-gray-100"
                >+</button>
              </div>
              {/* Price input */}
              <input
                type="number"
                min="0"
                step="0.01"
                value={agreedPrice || ''}
                onChange={e => setPrice(product.id, parseFloat(e.target.value) || 0)}
                className="flex-1 text-center text-xs font-black border border-gray-200 rounded-lg py-1 px-1.5 focus:outline-none focus:border-amber-400 bg-white"
                placeholder="السعر"
              />
              <span className="text-xs font-black text-amber-600 flex-shrink-0 w-20 text-left">
                {fmt(Number(agreedPrice) * qty)} {cur}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100 space-y-2 flex-shrink-0 bg-white">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500 font-bold">{items.length} صنف</span>
          <span className="font-black text-lg text-amber-600">{fmt(total)} <span className="text-xs font-normal text-gray-400">{cur}</span></span>
        </div>

        {!allPriced && (
          <p className="text-[10px] text-red-500 text-center font-bold">
            ⚠️ أدخل السعر لجميع المنتجات
          </p>
        )}

        <button
          onClick={onSubmit}
          disabled={submitting || !allPriced}
          className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
        >
          {submitting
            ? <><span className="animate-spin inline-block">⏳</span> جارٍ الإرسال...</>
            : <>📤 إرسال الطلب</>
          }
        </button>

        <button
          onClick={clear}
          className="w-full text-xs text-gray-400 hover:text-red-500 transition-colors py-1"
        >
          🗑️ مسح السلة
        </button>

        <p className="text-[10px] text-gray-400 text-center leading-relaxed">
          سيتم تسجيل الطلب وإشعار المدير للتأكيد
        </p>
      </div>
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────
export default function PartnerCatalogPage() {
  const { profile }                         = useAuthStore()
  const { products, categories, loading }   = useProductsStore()
  const { submit, items }                   = usePartnerOrderStore()
  const [searchQ, setSearchQ]               = useState('')
  const [activeCat, setActiveCat]           = useState('الكل')
  const [showBasket, setShowBasket]         = useState(false)

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (!p.is_active) return false
      if (p.is_hidden)  return false
      const catMatch = activeCat === 'الكل' || p.categories?.name === activeCat || p.cat === activeCat
      const q        = searchQ.toLowerCase().trim()
      const qMatch   = !q || p.name.toLowerCase().includes(q) || (p.barcode || '').includes(q)
      return catMatch && qMatch
    })
  }, [products, activeCat, searchQ])

  const handleSubmit = async () => {
    const { data, error } = await submit(profile)
    if (error) {
      toast.error(typeof error === 'string' ? error : 'فشل الإرسال: ' + (error.message || ''))
    } else {
      toast.success('✅ تم إرسال الطلب! سيتواصل معك المدير للتأكيد', { duration: 4000 })
      setShowBasket(false)
    }
  }

  return (
    <div className="flex h-full overflow-hidden font-arabic bg-gray-50" dir="rtl">

      {/* ── BASKET PANEL (right side in RTL, fixed width) ── */}
      <div className={`
        ${showBasket ? 'flex' : 'hidden'} md:flex
        w-full md:w-72 bg-white border-l border-gray-100 flex-col flex-shrink-0 shadow-lg
        absolute md:relative inset-0 z-20 md:z-auto
      `}>
        <BasketPanel
          onClose={() => setShowBasket(false)}
          onSubmit={handleSubmit}
        />
      </div>

      {/* ── CATALOG PANEL (left side in RTL) ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-100 flex-shrink-0">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="بحث عن منتج..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 pr-8 text-sm focus:outline-none focus:border-amber-400"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          </div>

          {/* Basket toggle for mobile */}
          <button
            onClick={() => setShowBasket(s => !s)}
            className="relative md:hidden bg-amber-500 text-white rounded-xl w-10 h-10 flex items-center justify-center flex-shrink-0"
          >
            🛒
            {items.length > 0 && (
              <span className="absolute -top-1 -left-1 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {items.length}
              </span>
            )}
          </button>
        </div>

        {/* Category tabs */}
        <div
          className="flex gap-1 px-2 py-1.5 overflow-x-auto bg-white border-b border-gray-100 flex-shrink-0"
          style={{ scrollbarWidth: 'none' }}
        >
          {categories.map(cat => (
            <button
              key={cat.id ?? cat.name}
              onClick={() => setActiveCat(cat.name)}
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                activeCat === cat.name
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-amber-100'
              }`}
            >
              {cat.emoji && <span>{cat.emoji}</span>}
              <span>{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading && (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-2">📦</p>
              <p className="font-bold">لا توجد منتجات</p>
            </div>
          )}
          {!loading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {filtered.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
