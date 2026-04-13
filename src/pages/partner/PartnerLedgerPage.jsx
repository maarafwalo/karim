/**
 * PartnerLedgerPage — لسعيد (trusted_partner)
 * سجل حسابه الشخصي: ما أخذه من بضاعة + ما دفعه + الرصيد المتبقي
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase }       from '../../lib/supabase.js'
import { useAuthStore }   from '../../stores/authStore.js'
import { fmt, fmtDate }   from '../../lib/utils.js'

export default function PartnerLedgerPage() {
  const { profile }            = useAuthStore()
  const [orders, setOrders]    = useState([])
  const [payments, setPayments]= useState([])
  const [loading, setLoading]  = useState(true)
  const [tab, setTab]          = useState('all')

  const load = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    const [ordRes, payRes] = await Promise.all([
      supabase
        .from('partner_orders')
        .select('*, partner_order_items(*)')
        .eq('partner_id', profile.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('partner_payments')
        .select('*')
        .eq('partner_id', profile.id)
        .order('date', { ascending: false }),
    ])
    setOrders(ordRes.data || [])
    setPayments(payRes.data || [])
    setLoading(false)
  }, [profile?.id])

  useEffect(() => { load() }, [load])

  const totalGoods = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0)
  const totalPaid  = payments.reduce((s, p) => s + Number(p.amount || 0), 0)
  const balance    = totalGoods - totalPaid

  // Combined timeline sorted by date
  const timeline = [
    ...orders.map(o => ({
      id:       o.id,
      type:     'order',
      date:     o.created_at,
      amount:   Number(o.total_amount || 0),
      label:    `📦 أخذت بضاعة — ${o.order_number}`,
      items:    o.partner_order_items || [],
      verified: o.is_verified,
    })),
    ...payments.map(p => ({
      id:     p.id,
      type:   'payment',
      date:   p.date || p.created_at,
      amount: Number(p.amount || 0),
      label:  `💰 دفعت — ${fmtDate(p.date || p.created_at)}`,
      notes:  p.notes,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date))

  // Running balance (oldest → newest, then reverse for display)
  let running = 0
  const withBalance = [...timeline].reverse().map(entry => {
    running += entry.type === 'order' ? entry.amount : -entry.amount
    return { ...entry, runningBalance: running }
  }).reverse()

  const filtered = tab === 'all'     ? withBalance
    : tab === 'orders'   ? withBalance.filter(t => t.type === 'order')
    : withBalance.filter(t => t.type === 'payment')

  return (
    <div className="flex flex-col h-full overflow-hidden font-arabic bg-gray-50" dir="rtl">

      {/* Header */}
      <div className="px-4 py-3 bg-white border-b shadow-sm flex-shrink-0">
        <h1 className="font-black text-lg">⚖️ حسابي</h1>
        <p className="text-xs text-gray-500">سجل ما أخذته من بضاعة وما دفعته</p>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-3 gap-3 p-4 flex-shrink-0">
        <div className="bg-red-50 rounded-2xl p-3 text-center border border-red-100">
          <p className="text-[10px] text-gray-500 mb-1">📦 بضاعة أخذتها</p>
          <p className="font-black text-red-700 text-lg">{fmt(totalGoods)}</p>
          <p className="text-[10px] text-gray-400">ريال مغربي</p>
        </div>
        <div className="bg-green-50 rounded-2xl p-3 text-center border border-green-100">
          <p className="text-[10px] text-gray-500 mb-1">💰 مجموع ما دفعت</p>
          <p className="font-black text-green-700 text-lg">{fmt(totalPaid)}</p>
          <p className="text-[10px] text-gray-400">ريال مغربي</p>
        </div>
        <div className={`rounded-2xl p-3 text-center border ${
          balance > 0 ? 'bg-orange-50 border-orange-200'
          : balance < 0 ? 'bg-emerald-50 border-emerald-200'
          : 'bg-gray-100 border-gray-200'
        }`}>
          <p className="text-[10px] text-gray-500 mb-1">⚖️ المتبقي عليّ</p>
          <p className={`font-black text-lg ${
            balance > 0 ? 'text-orange-700' : balance < 0 ? 'text-emerald-700' : 'text-gray-500'
          }`}>
            {fmt(Math.abs(balance))}
          </p>
          <p className={`text-[10px] font-bold ${
            balance > 0 ? 'text-orange-600' : balance < 0 ? 'text-emerald-600' : 'text-gray-400'
          }`}>
            {balance > 0 ? 'عليّ' : balance < 0 ? 'لي' : 'مسوّى ✅'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 pb-3 flex-shrink-0">
        {[
          { k: 'all',      l: 'الكل',         count: timeline.length },
          { k: 'orders',   l: '📦 بضاعة أخذت', count: orders.length },
          { k: 'payments', l: '💰 دفعات',      count: payments.length },
        ].map(({ k, l, count }) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              tab === k ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}>
            {l}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tab === k ? 'bg-white/30' : 'bg-gray-100'}`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {loading && (
          <div className="flex items-center justify-center h-40 text-gray-400">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-bold">لا توجد معاملات بعد</p>
          </div>
        )}

        {!loading && filtered.map(entry => (
          <div key={entry.id + entry.type}
            className={`bg-white rounded-2xl border p-4 flex items-start gap-3 ${
              entry.type === 'order'
                ? entry.verified ? 'border-red-100' : 'border-amber-200 bg-amber-50/30'
                : 'border-green-100'
            }`}
          >
            {/* Icon */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
              entry.type === 'order' ? 'bg-red-50' : 'bg-green-50'
            }`}>
              {entry.type === 'order' ? '📦' : '💰'}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-gray-900 text-sm">{entry.label}</p>
                {entry.type === 'order' && !entry.verified && (
                  <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">
                    ⏳ بانتظار تأكيد المدير
                  </span>
                )}
              </div>
              {entry.notes && <p className="text-xs text-gray-500 mt-0.5">{entry.notes}</p>}
              {entry.type === 'order' && entry.items?.length > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {entry.items.slice(0, 3).map(it => it.product_name).join(' · ')}
                  {entry.items.length > 3 && ` + ${entry.items.length - 3} أخرى`}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-0.5">{fmtDate(entry.date)}</p>
            </div>

            {/* Amount + running balance */}
            <div className="text-left flex-shrink-0">
              <p className={`font-black text-base ${
                entry.type === 'order' ? 'text-red-600' : 'text-green-600'
              }`}>
                {entry.type === 'order' ? '+' : '−'}{fmt(entry.amount)}
                <span className="text-[10px] font-normal text-gray-400 mr-0.5">ر</span>
              </p>
              <p className={`text-[10px] font-bold mt-0.5 ${
                entry.runningBalance > 0 ? 'text-orange-500' : 'text-emerald-500'
              }`}>
                رصيد: {fmt(Math.abs(entry.runningBalance))}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
