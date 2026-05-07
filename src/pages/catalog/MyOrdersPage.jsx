import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, supabaseAdmin } from '../../lib/supabase.js'
import { useAuthStore } from '../../stores/authStore.js'
import { useSettingsStore } from '../../stores/settingsStore.js'
import { fmt } from '../../lib/utils.js'
import toast from 'react-hot-toast'

const STATUS_LABEL = {
  new:       { txt: 'جديد',    cls: 'bg-blue-100 text-blue-700' },
  approved:  { txt: 'مقبول',   cls: 'bg-emerald-100 text-emerald-700' },
  rejected:  { txt: 'مرفوض',   cls: 'bg-rose-100 text-rose-700' },
  delivered: { txt: 'مسلَّم',  cls: 'bg-slate-100 text-slate-700' },
  cancelled: { txt: 'ملغى',    cls: 'bg-slate-100 text-slate-500' },
}

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
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded-lg text-xs transition active:scale-95">
            ✏️ تعديل
          </button>
          <button onClick={onDelete}
            className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 rounded-lg text-xs transition active:scale-95">
            🗑 حذف
          </button>
        </div>
      ) : (
        <div className="text-[10px] text-slate-400 text-center pt-1">⚠ تم بدء معالجة الطلب — لا يمكن التعديل</div>
      )}
    </div>
  )
}

export default function MyOrdersPage() {
  const { profile } = useAuthStore()
  const { settings } = useSettingsStore()
  const navigate = useNavigate()
  const cur = settings?.currency_symbol || 'درهم'

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
    // Hand off to CatalogPage via sessionStorage
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
    <div className="flex flex-col h-full overflow-hidden font-arabic bg-slate-50" dir="rtl">
      {/* Top bar: title + summary */}
      <div className="bg-white border-b border-slate-100 flex-shrink-0 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-black text-slate-900">📋 طلباتي</h1>
          <div className="text-xs text-slate-500">
            <span className="font-bold text-slate-800">{filtered.length}</span> طلب
            <span className="mx-1">·</span>
            <span className="font-black text-emerald-600">{fmt(totalAll)} {cur}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            className="inp flex-1 text-sm"
            placeholder="🔍 ابحث بالاسم، الهاتف، الرقم..."
          />
        </div>
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

      {/* List */}
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
