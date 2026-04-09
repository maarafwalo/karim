/**
 * PartnerOrdersPage — للمخزن (عمران)
 * يرى هنا طلبات الشركاء الموثوقين ويوافق على خروج البضاعة
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuthStore } from '../../stores/authStore.js'
import { fmt, fmtDate } from '../../lib/utils.js'
import toast from 'react-hot-toast'

const STATUS_MAP = {
  new:              { label: 'جديد',           color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
  partner_request:  { label: 'طلب شريك',       color: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500' },
  pending:          { label: 'قيد المعالجة',   color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  approved:         { label: 'تمت الموافقة',   color: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
  delivered:        { label: 'تم التسليم',     color: 'bg-teal-100 text-teal-700',    dot: 'bg-teal-500' },
}

function OrderCard({ order, items, onApprove, approving }) {
  const [open, setOpen] = useState(false)
  const st = STATUS_MAP[order.status] || STATUS_MAP.new
  const isApproved = order.stock_approved

  return (
    <div className={`bg-white rounded-2xl border-2 transition-all ${isApproved ? 'border-green-200' : 'border-amber-200'}`}>
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isApproved ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-gray-900 text-sm">{order.order_number}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
            {isApproved && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                ✅ وافق عليه عمران
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            🤝 {order.customer_name} · {order.customer_phone}
          </p>
          <p className="text-xs text-gray-400">{fmtDate(order.created_at)}</p>
        </div>
        <div className="text-left flex-shrink-0">
          <p className="font-black text-primary text-base">{fmt(order.total)} <span className="text-xs font-normal text-gray-400">د</span></p>
          <p className="text-xs text-gray-400">{items.length} صنف</p>
        </div>
        <span className="text-gray-300 text-sm">{open ? '▲' : '▼'}</span>
      </div>

      {/* Expanded items */}
      {open && (
        <div className="border-t border-gray-100 px-4 pb-4">
          <div className="space-y-2 mt-3 mb-4">
            {items.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">جارٍ تحميل الأصناف...</p>
            )}
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-gray-400 text-xs w-5 text-center">{i + 1}</span>
                <span className="flex-1 font-bold text-gray-800">{it.product_name}</span>
                <span className="text-gray-500">×{it.quantity}</span>
                <span className="font-black text-gray-700 text-xs">{fmt(it.total)} د</span>
              </div>
            ))}
          </div>

          {/* Approve button (only if not yet approved) */}
          {!isApproved ? (
            <button
              onClick={() => onApprove(order.id)}
              disabled={approving === order.id}
              className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white font-black py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {approving === order.id
                ? <><span className="animate-spin">⏳</span> جارٍ التأكيد...</>
                : <>✅ تأكيد خروج البضاعة</>
              }
            </button>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center text-sm text-green-700 font-bold">
              ✅ تم تأكيد خروج البضاعة
              {order.stock_approved_at && (
                <p className="text-xs text-green-500 font-normal mt-0.5">
                  {fmtDate(order.stock_approved_at)}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PartnerOrdersPage() {
  const { profile } = useAuthStore()
  const [orders, setOrders]     = useState([])
  const [itemsMap, setItemsMap] = useState({})
  const [loading, setLoading]   = useState(true)
  const [approving, setApproving] = useState(null)
  const [filter, setFilter]     = useState('pending') // 'pending' | 'approved' | 'all'

  const load = useCallback(async () => {
    setLoading(true)
    const { data: ords } = await supabase
      .from('catalog_orders')
      .select('*')
      .eq('is_partner_request', true)
      .order('created_at', { ascending: false })

    if (ords && ords.length) {
      setOrders(ords)
      // Load items for all orders
      const ids = ords.map(o => o.id)
      const { data: items } = await supabase
        .from('catalog_order_items')
        .select('*')
        .in('order_id', ids)
      if (items) {
        const map = {}
        items.forEach(it => {
          if (!map[it.order_id]) map[it.order_id] = []
          map[it.order_id].push(it)
        })
        setItemsMap(map)
      }
    } else {
      setOrders([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleApprove = async (orderId) => {
    setApproving(orderId)
    const { error } = await supabase
      .from('catalog_orders')
      .update({
        stock_approved:    true,
        stock_approved_by: profile?.id,
        stock_approved_at: new Date().toISOString(),
        status:            'approved',
      })
      .eq('id', orderId)

    if (error) {
      toast.error('فشل التأكيد: ' + error.message)
    } else {
      toast.success('✅ تم تأكيد خروج البضاعة')
      setOrders(prev => prev.map(o =>
        o.id === orderId
          ? { ...o, stock_approved: true, stock_approved_at: new Date().toISOString(), status: 'approved' }
          : o
      ))
    }
    setApproving(null)
  }

  const filtered = orders.filter(o => {
    if (filter === 'pending')  return !o.stock_approved
    if (filter === 'approved') return  o.stock_approved
    return true
  })

  const pendingCount  = orders.filter(o => !o.stock_approved).length
  const approvedCount = orders.filter(o =>  o.stock_approved).length
  const pendingTotal  = orders.filter(o => !o.stock_approved).reduce((s, o) => s + Number(o.total || 0), 0)

  return (
    <div className="flex flex-col h-full overflow-hidden font-arabic bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b shadow-sm flex-shrink-0">
        <span className="text-xl">📋</span>
        <h1 className="font-black text-lg">طلبات الشركاء</h1>
        {pendingCount > 0 && (
          <span className="bg-amber-500 text-white text-xs font-black px-2 py-0.5 rounded-full animate-pulse">
            {pendingCount} بانتظار
          </span>
        )}
        <button onClick={load} className="mr-auto text-xs text-gray-400 hover:text-primary transition-colors">
          🔄 تحديث
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 p-4 flex-shrink-0">
        <div className="bg-amber-50 rounded-2xl p-3 text-center border border-amber-100">
          <p className="text-xs text-gray-500 mb-1">⏳ بانتظار التأكيد</p>
          <p className="font-black text-amber-700 text-xl">{pendingCount}</p>
          <p className="text-xs text-gray-500">{fmt(pendingTotal)} د</p>
        </div>
        <div className="bg-green-50 rounded-2xl p-3 text-center border border-green-100">
          <p className="text-xs text-gray-500 mb-1">✅ تم تأكيدها</p>
          <p className="font-black text-green-700 text-xl">{approvedCount}</p>
        </div>
        <div className="bg-gray-50 rounded-2xl p-3 text-center border border-gray-200">
          <p className="text-xs text-gray-500 mb-1">📋 المجموع</p>
          <p className="font-black text-gray-700 text-xl">{orders.length}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 px-4 pb-3 flex-shrink-0">
        {[
          { k: 'pending',  l: '⏳ بانتظار التأكيد', count: pendingCount },
          { k: 'approved', l: '✅ تم التأكيد',       count: approvedCount },
          { k: 'all',      l: 'الكل',                count: orders.length },
        ].map(({ k, l, count }) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              filter === k ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-primary/40'
            }`}
          >
            {l}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filter === k ? 'bg-white/30' : 'bg-gray-100'}`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {loading && (
          <div className="text-center py-16 text-gray-400">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p>جارٍ التحميل...</p>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">{filter === 'pending' ? '🎉' : '📋'}</p>
            <p className="font-bold text-gray-600">
              {filter === 'pending' ? 'لا توجد طلبات بانتظار التأكيد' : 'لا توجد طلبات'}
            </p>
          </div>
        )}

        {!loading && filtered.map(order => (
          <OrderCard
            key={order.id}
            order={order}
            items={itemsMap[order.id] || []}
            onApprove={handleApprove}
            approving={approving}
          />
        ))}
      </div>
    </div>
  )
}
