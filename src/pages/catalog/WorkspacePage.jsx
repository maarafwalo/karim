import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, supabaseAdmin } from '../../lib/supabase.js'
import { useAuthStore } from '../../stores/authStore.js'
import { useSettingsStore } from '../../stores/settingsStore.js'
import { useProductsStore } from '../../stores/productsStore.js'
import { useBagStore } from '../../stores/bagStore.js'
import { fmt, fmtDate, buildWhatsApp, generateOrderNumber } from '../../lib/utils.js'
import { ProductCard, VirtualKeyboard } from './CatalogPage.jsx'
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

// ── Shared order-save hook ─────────────────────────────────────
function useOrderSave({ profile }) {
  const [sending, setSending] = useState(false)
  const items        = useBagStore(s => s.items)
  const customer     = useBagStore(s => s.customer)
  const editingOrder = useBagStore(s => s.editingOrder)
  const clearBag     = useBagStore(s => s.clear)
  const navigate     = useNavigate()

  const priceOf = (b) => (typeof b.negotiatedPrice === 'number' ? b.negotiatedPrice : b.product.sell_price)
  const total   = items.reduce((s, b) => s + priceOf(b) * b.qty, 0)
  const count   = items.reduce((s, b) => s + b.qty, 0)

  const send = async () => {
    if (count === 0) { toast.error('السلة فارغة'); return }
    setSending(true)
    const orderNum = editingOrder?.order_number || generateOrderNumber('ORD')
    const db = supabaseAdmin || supabase
    const cName  = customer?.name?.trim()  || 'زبون عابر'
    const cPhone = customer?.phone?.trim() || ''
    const cAddr  = customer?.address?.trim() || ''
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
          customer_name:      cName,
          customer_phone:     cPhone,
          customer_address:   cAddr,
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
            const np = priceOf(b), orig = b.product.sell_price, isNeg = np !== orig
            const nameWithPartial = b.partial
              ? `${b.product.name} (${b.partial.units}/${b.partial.packSize})`
              : b.product.name
            return {
              order_id:       order.id,
              product_id:     b.product.id,
              product_name:   nameWithPartial,
              unit_price:     np,
              original_price: orig,
              negotiated:     isNeg || !!b.partial,
              price_diff:     +(np - orig).toFixed(2),
              quantity:       b.qty,
              total:          np * b.qty,
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
      navigate('/workspace#orders', { replace: true })
    } catch (e) {
      toast.error('فشل الحفظ: ' + (e.message || 'خطأ'))
    } finally {
      setSending(false)
    }
  }

  return { send, sending, total, count, items, customer, editingOrder }
}

// Detect the pack size from a product name. Handles:
//   "أوني جاڤيل 1ل*18 وحدة"   → 18  (size*count + وحدة)
//   "ألموندرا شوكولاتة 60وحدة" → 60  (count + وحدة)
//   "أولا صلصة الطماطم 30*110غ" → 30  (count*sizeUnit)
//   "أوريو 4*30 وحدة"          → 30  (count + وحدة wins over count*count)
function detectPackSize(product) {
  const name = product?.name || ''
  // 1) Prefer the number that immediately precedes an explicit unit word — most reliable
  const unitMatches = [...name.matchAll(/(\d+)\s*(?:وحدة|قطعة|حبة|عبوة|علبة)/g)]
  if (unitMatches.length) {
    const n = parseInt(unitMatches[unitMatches.length - 1][1], 10)
    if (n > 1) return n
  }
  // 2) "[size]+[unit suffix]*[count]" — e.g., "100مل*24", "1ل*18"
  const sizeStarCount = name.match(/\d+\s*(?:ل|كغ|غ|مل|سم|كلغ|gr|g)\s*[*×]\s*(\d+)/i)
  if (sizeStarCount) {
    const n = parseInt(sizeStarCount[1], 10)
    if (n > 1) return n
  }
  // 3) "[count]*[size]+[unit suffix]" — e.g., "30*110غ", "24*500مل"
  const countStarSize = name.match(/(\d+)\s*[*×]\s*\d+\s*(?:ل|كغ|غ|مل|سم|كلغ|gr|g)/i)
  if (countStarSize) {
    const n = parseInt(countStarSize[1], 10)
    if (n > 1) return n
  }
  // 4) Fall back to last "*N" — but only if N is plausible (≤100) so we don't pick up gram values
  const stars = [...name.matchAll(/[*×]\s*(\d+)/g)]
  if (stars.length) {
    const n = parseInt(stars[stars.length - 1][1], 10)
    if (n > 1 && n <= 100) return n
  }
  return 0
}

// ── Pack split modal ───────────────────────────────────────────
function PackSplitModal({ bagItem, onConfirm, onClose }) {
  const packSize = bagItem.partial?.packSize || detectPackSize(bagItem.product)
  const initialUnits = bagItem.partial?.units || Math.floor(packSize / 2) || 1
  const [units, setUnits] = useState(initialUnits)
  const unitPrice = bagItem.product.sell_price / packSize
  const partialPrice = +(unitPrice * units).toFixed(2)

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-3"
      onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-black text-base text-slate-900">✂ بيع جزئي</h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center text-lg leading-none">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <div className="text-sm font-bold text-slate-700">{bagItem.product.name}</div>
          <div className="text-[11px] text-slate-500">
            العبوة الكاملة: <span className="font-black text-slate-700">{packSize}</span> وحدة بـ <span className="font-black text-slate-700">{fmt(bagItem.product.sell_price)}</span>
            <br/>سعر الوحدة: <span className="font-black text-emerald-600">{fmt(unitPrice)}</span>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4">
            <div className="text-[11px] text-slate-500 text-center mb-2">عدد الوحدات</div>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setUnits(u => Math.max(1, u - 1))}
                className="w-10 h-10 bg-rose-100 hover:bg-rose-200 active:scale-90 text-rose-600 rounded-xl text-2xl font-black flex items-center justify-center leading-none transition">−</button>
              <div className="text-center">
                <div className="text-3xl font-black text-slate-900 leading-none">{units}<span className="text-base font-bold text-slate-400">/{packSize}</span></div>
                <div className="text-[10px] text-slate-400 mt-1">وحدة</div>
              </div>
              <button onClick={() => setUnits(u => Math.min(packSize, u + 1))}
                className="w-10 h-10 bg-emerald-100 hover:bg-emerald-200 active:scale-90 text-emerald-700 rounded-xl text-2xl font-black flex items-center justify-center leading-none transition">+</button>
            </div>
            <div className="text-center mt-3 pt-3 border-t border-slate-200">
              <div className="text-[10px] text-slate-500">السعر</div>
              <div className="text-2xl font-black text-emerald-600">{fmt(partialPrice)} <span className="text-xs font-normal text-slate-400">درهم</span></div>
            </div>
          </div>
        </div>
        <div className="px-4 pb-4 pt-1 flex gap-2">
          {bagItem.partial && (
            <button onClick={() => { onConfirm(null); onClose() }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-3 rounded-xl text-xs transition">
              ↺ كامل
            </button>
          )}
          <button onClick={() => { onConfirm({ units, packSize }); onClose() }}
            disabled={units < 1 || units > packSize}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-black py-2.5 rounded-xl text-sm shadow-sm transition active:scale-95">
            ✔ تأكيد
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tab 1: السلة (live bag from store) ─────────────────────────
function CartTab({ cur, profile }) {
  const navigate = useNavigate()
  const items        = useBagStore(s => s.items)
  const editingOrder = useBagStore(s => s.editingOrder)
  const decItem      = useBagStore(s => s.decItem)
  const removeItem   = useBagStore(s => s.removeItem)
  const setNegPrice  = useBagStore(s => s.setNegPrice)
  const addItem      = useBagStore(s => s.addItem)
  const setPartial   = useBagStore(s => s.setPartial)
  const clearBag     = useBagStore(s => s.clear)
  const setEditingOrder = useBagStore(s => s.setEditingOrder)

  const [splitTargetId, setSplitTargetId] = useState(null)
  const splitTarget = items.find(b => b.product.id === splitTargetId)

  const priceOf = (b) => (typeof b.negotiatedPrice === 'number' ? b.negotiatedPrice : b.product.sell_price)
  const total   = items.reduce((s, b) => s + priceOf(b) * b.qty, 0)
  const count   = items.reduce((s, b) => s + b.qty, 0)

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

  // ── Cart stage ──
  const emptyCart = () => {
    if (!confirm('إفراغ السلة بالكامل؟')) return
    clearBag()
    toast.success('🗑 تم إفراغ السلة')
  }

  return (
    <div className="flex flex-col h-full">
      {editingOrder && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-amber-800 text-xs font-bold flex items-center justify-between">
          <span>✏️ تعديل الطلب #{editingOrder.order_number}</span>
          <button onClick={() => { setEditingOrder(null); clearBag() }}
            className="text-amber-700 hover:text-amber-900 text-[10px] font-bold underline">إلغاء التعديل</button>
        </div>
      )}
      {/* Cart toolbar */}
      <div className="bg-white border-b border-slate-100 px-3 py-2 flex items-center justify-between flex-shrink-0">
        <div className="text-xs text-slate-500">
          <span className="font-bold text-slate-700">{count}</span> منتج ·
          <span className="font-black text-slate-900 mx-1">{fmt(total)}</span>
          <span className="text-[10px]">{cur}</span>
        </div>
        <button onClick={emptyCart}
          className="bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-600 font-bold text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1">
          🗑 إفراغ
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.map(b => {
          const negPrice = priceOf(b)
          const isNeg = negPrice !== b.product.sell_price
          const detected = detectPackSize(b.product)
          const canSplit = detected > 1 || !!b.partial
          const partial = b.partial
          return (
            <div key={b.product.id}
              className={`flex items-center gap-3 px-3 py-3 rounded-2xl border bg-white shadow-sm ${
                partial ? 'border-blue-200 bg-blue-50/40' :
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
                  {partial ? (
                    <span className="text-blue-700 font-bold">✂ {partial.units}/{partial.packSize} وحدة</span>
                  ) : (
                    <>× {b.qty}</>
                  )}
                  {' = '}
                  <span className="font-bold text-rose-600">{fmt(negPrice * b.qty)} {cur}</span>
                </p>
                {canSplit && (
                  <button onClick={() => setSplitTargetId(b.product.id)}
                    className="mt-1 inline-flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-md transition">
                    ✂ {partial ? 'تعديل' : 'تقسيم'}
                  </button>
                )}
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
        <button onClick={() => { window.location.hash = 'customers' }}
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-black px-5 py-3 rounded-2xl shadow-lg transition active:scale-95">
          {editingOrder ? '✔ متابعة' : '👤 اختر زبون'}
        </button>
      </div>

      {splitTarget && (
        <PackSplitModal
          bagItem={splitTarget}
          onConfirm={(p) => setPartial(splitTargetId, p)}
          onClose={() => setSplitTargetId(null)}
        />
      )}
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
      (supabaseAdmin || supabase).from('debt_payments').select('amount, created_at')
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
    const { data, error } = await (supabaseAdmin || supabase).from('customers').update({
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
    const { error } = await (supabaseAdmin || supabase).from('debt_payments').insert({ customer_id: c.id, amount })
    if (error) { setWorking(false); toast.error('فشل التسجيل'); return }
    const newBal = Math.max(0, (c.balance || 0) - amount)
    const { data: upd } = await (supabaseAdmin || supabase).from('customers').update({ balance: newBal }).eq('id', c.id).select().single()
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
function CustomersTab({ cur, profile }) {
  const setBagCustomer = useBagStore(s => s.setCustomer)
  const bagCount       = useBagStore(s => s.items.reduce((a, b) => a + b.qty, 0))
  const bagCustomer    = useBagStore(s => s.customer)
  const { send: saveOrder, sending: savingOrder, total: bagTotal } = useOrderSave({ profile })
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
    const { data } = await (supabaseAdmin || supabase).from('customers').select('*').order('name')
    setCustomers(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.name.trim()) { toast.error('الاسم مطلوب'); return }
    const { data, error } = await (supabaseAdmin || supabase).from('customers').insert({
      name: form.name.trim(), phone: form.phone.trim(),
    }).select().single()
    if (error) { toast.error('خطأ في الحفظ'); return }
    toast.success('تم إضافة الزبون')
    setForm({ name: '', phone: '' })
    setShowAdd(false)
    if (data) {
      setCustomers(prev => [data, ...prev])
      // Auto-select for the active bag
      if (bagCount > 0) {
        setBagCustomer({ name: data.name || '', phone: data.phone || '', address: data.address || '' })
        toast.success(`✓ ${data.name} محدد للطلب`)
      } else {
        setExpandedId(data.id)
      }
    }
  }

  const del = async (id) => {
    if (!confirm('حذف هذا الزبون؟')) return
    await (supabaseAdmin || supabase).from('customers').delete().eq('id', id)
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

  const hasBagCustomer = !!(bagCustomer?.name)

  return (
    <div className="flex flex-col h-full">
      {/* Sticky checkout banner — only when a bag is active */}
      {bagCount > 0 && (
        <div className="bg-gradient-to-l from-emerald-500 to-emerald-600 text-white px-3 py-2.5 flex items-center gap-2 flex-shrink-0 shadow-sm">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] opacity-80 leading-none">سلة نشطة · {bagCount} منتج</div>
            <div className="font-black text-sm leading-tight mt-0.5">
              {hasBagCustomer ? `لـ ${bagCustomer.name}` : 'بدون زبون'}
              <span className="opacity-60 mx-1">·</span>
              {fmt(bagTotal)} {cur}
            </div>
          </div>
          <button onClick={() => { window.location.hash = 'cart' }}
            className="bg-white/20 hover:bg-white/30 active:scale-95 text-white font-bold text-xs px-2.5 py-2 rounded-lg flex-shrink-0">
            ← السلة
          </button>
          <button onClick={saveOrder} disabled={savingOrder}
            className="bg-white text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 active:scale-95 font-black text-xs px-3 py-2 rounded-lg flex-shrink-0 shadow-sm">
            {savingOrder ? '...' : (hasBagCustomer ? '✔ حفظ الطلب' : '✔ بدون زبون')}
          </button>
        </div>
      )}

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
                setExpandedId(null)
                toast.success(`✓ ${c.name} محدد للطلب`)
              }}
            />
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

  const VALID_TABS = ['browse', 'cart', 'orders', 'customers']
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
        {tab === 'customers' && <CustomersTab cur={cur} profile={profile} />}
      </div>
    </div>
  )
}
