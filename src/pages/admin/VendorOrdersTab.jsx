import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, supabaseAdmin } from '../../lib/supabase.js'
import { useCartStore } from '../../stores/cartStore.js'
import { fmt, fmtDate } from '../../lib/utils.js'
import toast from 'react-hot-toast'

const STATUS_LABEL = {
  new:       { txt: 'جديد',   cls: 'bg-blue-100 text-blue-700' },
  approved:  { txt: 'مقبول',  cls: 'bg-emerald-100 text-emerald-700' },
  rejected:  { txt: 'مرفوض', cls: 'bg-rose-100 text-rose-700' },
  delivered: { txt: 'مسلَّم', cls: 'bg-slate-100 text-slate-700' },
  cancelled: { txt: 'ملغى',   cls: 'bg-slate-100 text-slate-500' },
  invoiced:  { txt: 'فوترت',  cls: 'bg-violet-100 text-violet-700' },
}

export default function VendorOrdersTab() {
  const navigate = useNavigate()
  const loadFromOrder = useCartStore(s => s.loadFromOrder)

  const [orders, setOrders]       = useState([])
  const [vendors, setVendors]     = useState({})  // id -> full_name
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('open') // open | all | invoiced
  const [search, setSearch]       = useState('')
  const [expanded, setExpanded]   = useState(null) // order id
  const [items, setItems]         = useState({})   // orderId -> items[]
  const [busyId, setBusyId]       = useState(null)

  const [loadError, setLoadError] = useState(null)

  const load = async () => {
    setLoading(true)
    setLoadError(null)
    const db = supabaseAdmin || supabase
    const withTimeout = (p, ms = 8000) => Promise.race([
      p,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
    ])
    try {
      const { data: ords, error } = await withTimeout(
        db.from('catalog_orders')
          .select('*')
          .eq('is_partner_request', false)
          .order('created_at', { ascending: false })
          .limit(200)
      )
      if (error) throw error
      setOrders(ords || [])

      // Best-effort vendor name lookup — only fetch IDs we actually need.
      const vendorIds = [...new Set((ords || []).map(o => o.vendor_id).filter(Boolean))]
      if (vendorIds.length) {
        const { data: profs } = await db
          .from('profiles')
          .select('id, full_name')
          .in('id', vendorIds)
        const map = {}
        ;(profs || []).forEach(p => { map[p.id] = p.full_name || '—' })
        setVendors(map)
      }
    } catch (e) {
      console.error('VendorOrdersTab load failed:', e)
      setLoadError(
        e.message === 'timeout'
          ? 'انتهت المهلة — قد تحتاج صلاحية إدارية على catalog_orders'
          : (e.message || 'فشل التحميل')
      )
      setOrders([])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const expandOne = async (id) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!items[id]) {
      const db = supabaseAdmin || supabase
      const { data } = await db.from('catalog_order_items').select('*').eq('order_id', id)
      setItems(prev => ({ ...prev, [id]: data || [] }))
    }
  }

  const sendToPos = async (order) => {
    // Warn if the cashier already has an unfinished sale in the POS cart.
    // Without this we silently wipe their work.
    const { useCartStore } = await import('../../stores/cartStore.js')
    const existing = useCartStore.getState().items
    if (existing.length > 0) {
      const ok = window.confirm(
        `الـ POS فيه ${existing.length} منتج. تحب نحتفظ بيهم في الانتظار ونحمل هاد الطلب؟`
      )
      if (!ok) return
      // Park the existing cart so it can be resumed later from POS.
      useCartStore.getState().holdCart?.()
    }

    setBusyId(order.id)
    const db = supabaseAdmin || supabase
    let orderItems = items[order.id]
    if (!orderItems) {
      const { data } = await db.from('catalog_order_items').select('*').eq('order_id', order.id)
      orderItems = data || []
    }
    if (!orderItems.length) {
      setBusyId(null)
      toast.error('الطلب فارغ')
      return
    }
    // Bring product metadata along so the POS cart shows images / categories /
    // valid stock caps instead of bare 'name + price'.
    const { useProductsStore } = await import('../../stores/productsStore.js')
    const liveProducts = useProductsStore.getState().products
    loadFromOrder(orderItems, {
      // Pass through the customer_id if the saved order has one — otherwise POS
      // creates an unlinked walk-in invoice and the debt rolls under a phantom row.
      id:      order.customer_id || null,
      name:    order.customer_name,
      phone:   order.customer_phone,
      address: order.customer_address,
    }, order.order_number, liveProducts)
    // NOTE: status only flips after the POS sale actually completes — we don't
    // mark 'invoiced' here. If the cashier abandons the POS session this order
    // stays open and the admin can retry.
    setBusyId(null)
    toast.success(`📋 تم تحميل ${orderItems.length} صنف في POS`)
    navigate('/pos')
  }

  const deleteOrder = async (order) => {
    if (!confirm(`حذف الطلب #${order.order_number}؟`)) return
    setBusyId(order.id)
    const db = supabaseAdmin || supabase
    await db.from('catalog_order_items').delete().eq('order_id', order.id)
    const { error } = await db.from('catalog_orders').delete().eq('id', order.id)
    setBusyId(null)
    if (error) { toast.error('فشل الحذف: ' + error.message); return }
    toast.success('تم الحذف')
    setOrders(prev => prev.filter(o => o.id !== order.id))
  }

  const filtered = useMemo(() => {
    let list = orders
    if (filter === 'open')     list = list.filter(o => o.status !== 'invoiced' && o.status !== 'cancelled' && o.status !== 'delivered')
    if (filter === 'invoiced') list = list.filter(o => o.status === 'invoiced')
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(o =>
        (o.customer_name  || '').toLowerCase().includes(q) ||
        (o.customer_phone || '').includes(search) ||
        (o.order_number   || '').toLowerCase().includes(q) ||
        (vendors[o.vendor_id] || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [orders, filter, search, vendors])

  const stats = useMemo(() => {
    const open = orders.filter(o => o.status !== 'invoiced' && o.status !== 'cancelled' && o.status !== 'delivered').length
    const total = orders.reduce((s, o) => s + (o.total || 0), 0)
    return { open, total, count: orders.length }
  }, [orders])

  return (
    <div className="flex flex-col h-full font-arabic" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-black text-base text-slate-900">📋 طلبات الباعة</h2>
          <span className="text-xs text-slate-500">
            <span className="font-black text-amber-600">{stats.open}</span> مفتوح ·
            <span className="font-black text-slate-700 mx-1">{stats.count}</span> إجمالي ·
            <span className="font-black text-emerald-600">{fmt(stats.total)} د</span>
          </span>
        </div>

        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="inp text-sm flex-1" placeholder="🔍 ابحث بالاسم، الهاتف، الرقم، البائع..." />
          <button onClick={load}
            className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-xs font-bold px-3 py-2 rounded-xl">
            ↻
          </button>
        </div>

        <div className="flex gap-1.5">
          {[
            { key: 'open',     lbl: 'مفتوح' },
            { key: 'invoiced', lbl: 'فوترت' },
            { key: 'all',      lbl: 'الكل' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                filter === f.key ? 'bg-primary text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {f.lbl}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="text-center text-slate-400 py-8 text-sm">جاري التحميل...</div>
        ) : loadError ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
            ⚠️ {loadError}
            <div className="text-xs text-amber-700 mt-2">
              تأكد أن <code className="bg-amber-100 px-1 rounded">VITE_SUPABASE_SERVICE_KEY</code> مضبوط في الإنتاج،
              أو شغّل <code className="bg-amber-100 px-1 rounded">sql/admin_orders_rls.sql</code> لإضافة سياسة قراءة للإداري.
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-slate-400 py-10 text-sm">لا توجد طلبات</div>
        ) : (
          filtered.map(o => {
            const st = STATUS_LABEL[o.status] || { txt: o.status, cls: 'bg-slate-100 text-slate-600' }
            const isOpen = expanded === o.id
            const orderItems = items[o.id]
            const isInvoiced = o.status === 'invoiced'
            return (
              <div key={o.id} className={`border-2 rounded-2xl bg-white shadow-sm overflow-hidden transition ${
                isInvoiced ? 'border-violet-200' : 'border-slate-200'
              }`}>
                <div className="flex items-stretch gap-1.5 p-2">
                  <button onClick={() => expandOne(o.id)}
                    className="flex-1 flex items-start justify-between gap-2 text-right min-w-0 px-1 hover:bg-slate-50 rounded-lg transition">
                    <div className="flex-1 text-right min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-slate-900 truncate">{o.customer_name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.txt}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        #{o.order_number} · 👤 {vendors[o.vendor_id] || '—'} · {fmtDate(o.created_at)}
                      </div>
                      {o.customer_phone && <div className="text-[11px] text-slate-500 ltr">📞 {o.customer_phone}</div>}
                    </div>
                    <div className="text-left flex-shrink-0">
                      <div className="font-black text-sm text-slate-900">{fmt(o.total)}</div>
                      <div className="text-[10px] text-slate-400">{isOpen ? '▲' : '▼'}</div>
                    </div>
                  </button>

                  {/* Inline actions */}
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={() => sendToPos(o)} disabled={busyId === o.id}
                      title="إرسال للـ POS"
                      className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 active:scale-90 text-white w-9 h-9 rounded-lg text-base font-black flex items-center justify-center transition shadow-sm">
                      🛒
                    </button>
                    <button onClick={() => deleteOrder(o)} disabled={busyId === o.id}
                      title="حذف"
                      className="bg-rose-100 hover:bg-rose-200 active:scale-90 text-rose-700 w-9 h-9 rounded-lg text-base font-black flex items-center justify-center transition shadow-sm">
                      🗑
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100 p-3 bg-slate-50/40">
                    {!orderItems ? (
                      <div className="text-xs text-slate-400 py-2 text-center">جاري التحميل...</div>
                    ) : orderItems.length === 0 ? (
                      <div className="text-xs text-slate-400 py-2 text-center">لا توجد أصناف</div>
                    ) : (
                      <div className="space-y-1">
                        {orderItems.map((it, i) => (
                          <div key={it.id || i} className="flex items-center justify-between text-xs bg-white rounded-lg px-2 py-1.5 border border-slate-100">
                            <span className="font-bold text-slate-700 truncate flex-1">{it.product_name}</span>
                            <span className="text-slate-500 mx-2">× {it.quantity}</span>
                            {it.negotiated && it.original_price != null && (
                              <span className="text-[9px] line-through text-slate-400 ml-1">{fmt(it.original_price)}</span>
                            )}
                            <span className={`font-bold ${it.negotiated ? 'text-amber-700' : 'text-slate-800'}`}>
                              {fmt(it.total)} د
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {o.customer_address && (
                      <div className="text-[11px] text-slate-500 mt-2">📍 {o.customer_address}</div>
                    )}
                    <button onClick={() => sendToPos(o)} disabled={busyId === o.id}
                      className="w-full mt-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-black py-2.5 rounded-xl text-sm transition active:scale-95 flex items-center justify-center gap-2">
                      🛒 إرسال للـ POS وإنشاء فاتورة
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
