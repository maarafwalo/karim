import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, supabaseAdmin } from '../../lib/supabase.js'
import { useAuthStore } from '../../stores/authStore.js'
import { useSettingsStore } from '../../stores/settingsStore.js'
import { useBagStore } from '../../stores/bagStore.js'
import { fmt, fmtDate, buildWhatsApp } from '../../lib/utils.js'
import toast from 'react-hot-toast'

const STATUS_LABEL = {
  new:       { txt: 'جديد',    cls: 'bg-blue-100 text-blue-700' },
  approved:  { txt: 'مقبول',   cls: 'bg-emerald-100 text-emerald-700' },
  rejected:  { txt: 'مرفوض',   cls: 'bg-rose-100 text-rose-700' },
  delivered: { txt: 'مسلَّم',  cls: 'bg-slate-100 text-slate-700' },
  cancelled: { txt: 'ملغى',    cls: 'bg-slate-100 text-slate-500' },
}

// ── Tab 1: السلة (live bag from store) ─────────────────────────
function CartTab({ cur }) {
  const navigate = useNavigate()
  const items        = useBagStore(s => s.items)
  const editingOrder = useBagStore(s => s.editingOrder)
  const decItem      = useBagStore(s => s.decItem)
  const removeItem   = useBagStore(s => s.removeItem)
  const setNegPrice  = useBagStore(s => s.setNegPrice)
  const addItem      = useBagStore(s => s.addItem)

  const priceOf = (b) => (typeof b.negotiatedPrice === 'number' ? b.negotiatedPrice : b.product.sell_price)
  const total   = items.reduce((s, b) => s + priceOf(b) * b.qty, 0)
  const count   = items.reduce((s, b) => s + b.qty, 0)

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="text-6xl mb-3">🛍</div>
        <p className="text-slate-600 font-bold mb-4">سلتك فارغة</p>
        <button onClick={() => navigate('/catalog')}
          className="bg-primary hover:bg-primary-dark text-white font-black px-6 py-3 rounded-2xl shadow-lg transition active:scale-95">
          📋 تصفح الكتالوج
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {editingOrder && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-amber-800 text-xs font-bold">
          ✏️ تعديل الطلب #{editingOrder.order_number}
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
        <div className="flex-1">
          <div className="text-xs text-slate-500">{count} منتج</div>
          <div className="text-xl font-black text-slate-900">{fmt(total)} <span className="text-xs font-normal text-slate-400">{cur}</span></div>
        </div>
        <button onClick={() => navigate('/catalog?checkout=1')}
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-black px-5 py-3 rounded-2xl shadow-lg transition active:scale-95">
          {editingOrder ? '✔ حفظ التعديلات' : '📋 إكمال الطلب'}
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

// ── Tab 3: الزبائن ─────────────────────────────────────────────
function CustomersTab({ cur }) {
  const [customers, setCustomers] = useState([])
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(false)
  const [showAdd, setShowAdd]     = useState(false)
  const [form, setForm]           = useState({ name:'', phone:'', price_tier:'retail' })

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('customers').select('*').order('name')
    setCustomers(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.name.trim()) { toast.error('يرجى إدخال الاسم'); return }
    const { error } = await supabase.from('customers').insert({
      name: form.name.trim(), phone: form.phone.trim(), price_tier: form.price_tier,
    })
    if (error) { toast.error('خطأ في الحفظ'); return }
    toast.success('تم إضافة الزبون')
    setForm({ name:'', phone:'', price_tier:'retail' })
    setShowAdd(false)
    load()
  }

  const del = async (id) => {
    if (!confirm('حذف هذا الزبون؟')) return
    await supabase.from('customers').delete().eq('id', id)
    setCustomers(c => c.filter(x => x.id !== id))
  }

  const filtered = customers.filter(c =>
    !search || c.name?.includes(search) || c.phone?.includes(search))

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-slate-100 px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="inp text-sm flex-1" placeholder="🔍 بحث بالاسم أو الهاتف..." />
          <button onClick={() => setShowAdd(s => !s)}
            className="bg-primary text-white text-xs font-black px-3 py-2 rounded-lg flex-shrink-0">
            {showAdd ? '✕' : '+ جديد'}
          </button>
        </div>
        {showAdd && (
          <div className="space-y-2 p-3 bg-slate-50 rounded-xl">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="inp text-sm" placeholder="الاسم *" />
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="inp text-sm" placeholder="الهاتف" />
            <select value={form.price_tier} onChange={e => setForm(f => ({ ...f, price_tier: e.target.value }))}
              className="inp text-sm">
              <option value="retail">سعر التجزئة</option>
              <option value="wholesale">سعر الجملة</option>
            </select>
            <button onClick={save} className="w-full bg-primary text-white text-xs font-black py-2 rounded-lg">حفظ</button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {loading ? (
          <div className="text-center text-slate-400 py-6 text-sm">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-slate-400 py-6 text-sm">لا توجد نتائج</div>
        ) : (
          filtered.map(c => (
            <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 shadow-sm">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-900 truncate">{c.name}</p>
                {c.phone && (
                  <a href={buildWhatsApp(c.phone, `مرحباً ${c.name}`)} target="_blank" rel="noreferrer"
                    className="text-[11px] text-emerald-600 font-bold">📱 {c.phone}</a>
                )}
                <div className="flex gap-1 mt-1 flex-wrap">
                  {c.balance > 0 && <span className="text-[10px] bg-rose-500 text-white px-1.5 py-0.5 rounded-full font-bold">دين: {fmt(c.balance)}</span>}
                  {c.loyalty_pts > 0 && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-bold">⭐ {c.loyalty_pts}</span>}
                  {c.price_tier === 'wholesale' && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">جملة</span>}
                </div>
              </div>
              <button onClick={() => del(c.id)} className="text-rose-400 hover:text-rose-600 text-sm">✕</button>
            </div>
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

  const [tab, setTab] = useState('cart')
  // If user lands here with empty cart, default to orders for a more useful first view
  useEffect(() => {
    if (bagCount === 0) setTab('orders')
  }, []) // eslint-disable-line

  const TABS = [
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
        {tab === 'cart'      && <CartTab cur={cur} />}
        {tab === 'orders'    && <OrdersTab cur={cur} profile={profile} />}
        {tab === 'customers' && <CustomersTab cur={cur} />}
        {tab === 'debts'     && <DebtsTab cur={cur} />}
      </div>
    </div>
  )
}
