/**
 * PartnerAccountPage — للمدير (أنت وأخوك)
 * متابعة حساب سعيد وكل الشركاء الموثوقين:
 * - البضاعة التي أخذها (من partner_orders الجديد + catalog_orders القديم)
 * - الأموال التي دفعها
 * - الرصيد المتبقي عليه
 * - تأكيد الطلبات غير المؤكدة
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuthStore } from '../../stores/authStore.js'
import { fmt, fmtDate } from '../../lib/utils.js'
import toast from 'react-hot-toast'

// ── Record payment modal ───────────────────────────────────────
function PaymentModal({ partner, onClose, onSave }) {
  const { profile } = useAuthStore()
  const [form, setForm] = useState({
    amount: '',
    notes:  '',
    date:   new Date().toISOString().split('T')[0],
  })
  const [saving, setSaving] = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    const amt = parseFloat(form.amount)
    if (!amt || amt <= 0) { toast.error('أدخل مبلغاً صحيحاً'); return }
    setSaving(true)
    const { error } = await supabase.from('partner_payments').insert({
      partner_id:       partner.id,
      partner_name:     partner.full_name,
      amount:           amt,
      notes:            form.notes || null,
      recorded_by:      profile?.id,
      recorded_by_name: profile?.full_name || 'مدير',
      date:             form.date,
    })
    setSaving(false)
    if (error) { toast.error('فشل الحفظ: ' + error.message); return }
    toast.success('✅ تم تسجيل الدفعة')
    onSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="bg-green-50 border-b border-green-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💰</span>
            <div>
              <p className="font-black text-gray-900">تسجيل دفعة</p>
              <p className="text-xs text-gray-600">🤝 {partner.full_name}</p>
            </div>
          </div>
        </div>
        <form onSubmit={handle} className="p-5 space-y-4">
          <div>
            <label className="label">المبلغ المدفوع (درهم)</label>
            <input
              type="number" min="0.01" step="0.01"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="inp text-xl font-black"
              placeholder="0.00"
              required autoFocus
            />
          </div>
          <div>
            <label className="label">التاريخ</label>
            <input
              type="date" value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="inp"
            />
          </div>
          <div>
            <label className="label">ملاحظات</label>
            <input
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="inp"
              placeholder="مثال: دفعة أسبوع الأول..."
            />
          </div>
          <p className="text-xs text-gray-400">سيُسجَّل باسم: {profile?.full_name || 'مدير'}</p>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white font-black py-3 rounded-xl transition-colors">
              {saving ? '⏳...' : '💾 حفظ الدفعة'}
            </button>
            <button type="button" onClick={onClose}
              className="bg-gray-200 px-5 py-3 rounded-xl font-bold text-gray-700 hover:bg-gray-300">
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Partner detail view ────────────────────────────────────────
function PartnerDetail({ partner, onBack }) {
  const { profile }      = useAuthStore()
  const [orders, setOrders]     = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showPayModal, setShowPayModal] = useState(false)
  const [tab, setTab]           = useState('all')
  const [verifying, setVerifying] = useState(null) // order id being verified

  const load = useCallback(async () => {
    setLoading(true)
    const [newOrdRes, oldOrdRes, payRes] = await Promise.all([
      // New partner_orders
      supabase
        .from('partner_orders')
        .select('*, partner_order_items(*)')
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false }),
      // Legacy catalog_orders
      supabase
        .from('catalog_orders')
        .select('*, catalog_order_items(*)')
        .eq('vendor_id', partner.id)
        .eq('is_partner_request', true)
        .eq('stock_approved', true)
        .order('created_at', { ascending: false }),
      // Payments
      supabase
        .from('partner_payments')
        .select('*')
        .eq('partner_id', partner.id)
        .order('date', { ascending: false }),
    ])
    setOrders([
      ...(newOrdRes.data || []).map(o => ({ ...o, _source: 'new' })),
      ...(oldOrdRes.data || []).map(o => ({
        id:           o.id,
        created_at:   o.created_at,
        order_number: o.order_number,
        total_amount: o.total,
        is_verified:  true, // old orders are considered verified
        partner_order_items: (o.catalog_order_items || []).map(i => ({
          product_name:       i.product_name,
          quantity:           i.quantity,
          custom_unit_price:  i.unit_price || 0,
          total:              i.total,
        })),
        _source: 'legacy',
      })),
    ])
    setPayments(payRes.data || [])
    setLoading(false)
  }, [partner.id])

  useEffect(() => { load() }, [load])

  const handleVerify = async (orderId) => {
    setVerifying(orderId)
    const { error } = await supabase.rpc('verify_partner_order', {
      p_order_id: orderId,
      p_admin_id: profile?.id,
    })
    setVerifying(null)
    if (error) { toast.error('فشل التأكيد: ' + error.message); return }
    toast.success('✅ تم تأكيد الطلب')
    load()
  }

  // Balance — all orders count (stock already left)
  const totalGoods   = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0)
  const totalPaid    = payments.reduce((s, p) => s + Number(p.amount || 0), 0)
  const balance      = totalGoods - totalPaid
  const unverified   = orders.filter(o => !o.is_verified)

  // Combined timeline
  const timeline = [
    ...orders.map(o => ({
      id:         o.id,
      type:       'order',
      date:       o.created_at,
      amount:     Number(o.total_amount || 0),
      label:      `📦 أخذ بضاعة — ${o.order_number}`,
      items:      o.partner_order_items || [],
      verified:   o.is_verified,
      source:     o._source,
      orderId:    o.id,
    })),
    ...payments.map(p => ({
      id:       p.id,
      type:     'payment',
      date:     p.date || p.created_at,
      amount:   Number(p.amount || 0),
      label:    `💰 دفع — ${p.recorded_by_name || 'مدير'}`,
      notes:    p.notes,
      verified: true,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date))

  const filtered = tab === 'all'    ? timeline
    : tab === 'orders'   ? timeline.filter(t => t.type === 'order')
    : timeline.filter(t => t.type === 'payment')

  return (
    <div className="flex flex-col h-full overflow-hidden font-arabic bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b shadow-sm flex-shrink-0">
        <button onClick={onBack} className="text-primary font-bold text-sm hover:text-primary-dark">→ رجوع</button>
        <div className="w-px h-5 bg-gray-200" />
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center font-black text-amber-700 flex-shrink-0">
          {partner.full_name?.charAt(0) || '؟'}
        </div>
        <div className="flex-1">
          <p className="font-black text-gray-900">{partner.full_name}</p>
          <p className="text-xs text-gray-500">🤝 شريك موثوق</p>
        </div>
        <button
          onClick={() => setShowPayModal(true)}
          className="bg-green-500 hover:bg-green-600 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
        >
          💰 تسجيل دفعة
        </button>
      </div>

      {/* Balance summary */}
      <div className="grid grid-cols-3 gap-3 p-4 flex-shrink-0">
        <div className="bg-red-50 rounded-2xl p-3 text-center border border-red-100">
          <p className="text-xs text-gray-500 mb-1">📦 بضاعة أخذها</p>
          <p className="font-black text-red-700 text-xl">{fmt(totalGoods)}</p>
          <p className="text-xs text-gray-500">درهم</p>
        </div>
        <div className="bg-green-50 rounded-2xl p-3 text-center border border-green-100">
          <p className="text-xs text-gray-500 mb-1">💰 مجموع ما دفع</p>
          <p className="font-black text-green-700 text-xl">{fmt(totalPaid)}</p>
          <p className="text-xs text-gray-500">درهم</p>
        </div>
        <div className={`rounded-2xl p-3 text-center border ${
          balance > 0 ? 'bg-orange-50 border-orange-200'
          : balance < 0 ? 'bg-emerald-50 border-emerald-200'
          : 'bg-gray-100 border-gray-200'
        }`}>
          <p className="text-xs text-gray-500 mb-1">⚖️ المتبقي</p>
          <p className={`font-black text-xl ${balance > 0 ? 'text-orange-700' : balance < 0 ? 'text-emerald-700' : 'text-gray-500'}`}>
            {fmt(Math.abs(balance))}
          </p>
          <p className={`text-xs font-bold ${balance > 0 ? 'text-orange-600' : balance < 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
            {balance > 0 ? 'عليه' : balance < 0 ? 'له' : 'مسوّى'}
          </p>
        </div>
      </div>

      {/* Unverified orders alert */}
      {unverified.length > 0 && (
        <div className="mx-4 mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 flex-shrink-0">
          <span className="text-amber-500 animate-pulse">⚠️</span>
          <p className="text-xs text-amber-700 font-bold">
            {unverified.length} طلب بانتظار التأكيد — اضغط "تأكيد" على كل طلب بعد مراجعته
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 px-4 pb-3 flex-shrink-0">
        {[
          { k: 'all',      l: 'الكل',       count: timeline.length },
          { k: 'orders',   l: '📦 البضاعة', count: orders.length },
          { k: 'payments', l: '💰 الدفعات', count: payments.length },
        ].map(({ k, l, count }) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              tab === k ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}>
            {l}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tab === k ? 'bg-white/30' : 'bg-gray-100'}`}>{count}</span>
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {loading && (
          <div className="text-center py-12 text-gray-400">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm">جارٍ التحميل...</p>
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
            className={`bg-white rounded-2xl border p-4 ${
              entry.type === 'order'
                ? entry.verified ? 'border-red-100' : 'border-amber-300 bg-amber-50/50'
                : 'border-green-100'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                entry.type === 'order' ? 'bg-red-50' : 'bg-green-50'
              }`}>
                {entry.type === 'order' ? '📦' : '💰'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-gray-900 text-sm">{entry.label}</p>
                  {entry.type === 'order' && !entry.verified && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 font-black px-2 py-0.5 rounded-full animate-pulse">
                      ⏳ بانتظار التأكيد
                    </span>
                  )}
                  {entry.type === 'order' && entry.verified && (
                    <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">
                      ✅ مؤكد
                    </span>
                  )}
                </div>
                {entry.notes && <p className="text-xs text-gray-500">{entry.notes}</p>}
                {entry.type === 'order' && entry.items?.length > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {entry.items.slice(0, 2).map(it => it.product_name).join(' · ')}
                    {entry.items.length > 2 && ` + ${entry.items.length - 2} أخرى`}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">{fmtDate(entry.date)}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <p className={`font-black text-base ${entry.type === 'order' ? 'text-red-600' : 'text-green-600'}`}>
                  {entry.type === 'order' ? '+' : '−'}{fmt(entry.amount)}
                  <span className="text-xs font-normal text-gray-400 mr-0.5">د</span>
                </p>
                {entry.type === 'order' && !entry.verified && (
                  <button
                    onClick={() => handleVerify(entry.orderId)}
                    disabled={verifying === entry.orderId}
                    className="bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white text-[10px] font-black px-3 py-1 rounded-lg transition-colors"
                  >
                    {verifying === entry.orderId ? '⏳' : '✅ تأكيد'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showPayModal && (
        <PaymentModal
          partner={partner}
          onClose={() => setShowPayModal(false)}
          onSave={load}
        />
      )}
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────
export default function PartnerAccountPage() {
  const [partners, setPartners]   = useState([])
  const [selected, setSelected]   = useState(null)
  const [loading, setLoading]     = useState(true)
  const [summaries, setSummaries] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    const { data: users } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'trusted_partner')
      .order('full_name')

    if (!users?.length) { setPartners([]); setLoading(false); return }
    setPartners(users)

    const ids = users.map(u => u.id)

    const [newOrdRes, oldOrdRes, payRes] = await Promise.all([
      supabase.from('partner_orders').select('partner_id, total_amount, is_verified').in('partner_id', ids),
      supabase.from('catalog_orders').select('vendor_id, total, stock_approved').eq('is_partner_request', true).in('vendor_id', ids),
      supabase.from('partner_payments').select('partner_id, amount').in('partner_id', ids),
    ])

    const sums = {}
    users.forEach(u => {
      const newOrders = (newOrdRes.data || []).filter(o => o.partner_id === u.id)
      const oldOrders = (oldOrdRes.data || []).filter(o => o.vendor_id === u.id && o.stock_approved)
      const goods = [
        ...newOrders.map(o => Number(o.total_amount || 0)),
        ...oldOrders.map(o => Number(o.total || 0)),
      ].reduce((s, v) => s + v, 0)
      const paid    = (payRes.data || []).filter(p => p.partner_id === u.id).reduce((s, p) => s + Number(p.amount || 0), 0)
      const pending = newOrders.filter(o => !o.is_verified).length
      sums[u.id] = { goods, paid, balance: goods - paid, pending }
    })
    setSummaries(sums)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (selected) {
    return <PartnerDetail partner={selected} onBack={() => { setSelected(null); load() }} />
  }

  const grandGoods   = Object.values(summaries).reduce((s, v) => s + v.goods, 0)
  const grandPaid    = Object.values(summaries).reduce((s, v) => s + v.paid, 0)
  const grandBalance = grandGoods - grandPaid
  const grandPending = Object.values(summaries).reduce((s, v) => s + v.pending, 0)

  return (
    <div className="flex flex-col h-full overflow-hidden font-arabic bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b shadow-sm flex-shrink-0">
        <span className="text-xl">🤝</span>
        <h1 className="font-black text-lg flex-1">حساب الشركاء الموثوقين</h1>
        {grandPending > 0 && (
          <span className="text-xs bg-amber-100 text-amber-700 font-black px-3 py-1 rounded-full animate-pulse">
            ⚠️ {grandPending} بانتظار التأكيد
          </span>
        )}
      </div>

      {/* Grand totals */}
      {!loading && partners.length > 0 && (
        <div className="grid grid-cols-3 gap-3 p-4 flex-shrink-0">
          <div className="bg-red-50 rounded-2xl p-3 text-center border border-red-100">
            <p className="text-xs text-gray-500 mb-1">📦 إجمالي خرج</p>
            <p className="font-black text-red-700 text-xl">{fmt(grandGoods)}</p>
          </div>
          <div className="bg-green-50 rounded-2xl p-3 text-center border border-green-100">
            <p className="text-xs text-gray-500 mb-1">💰 إجمالي دفع</p>
            <p className="font-black text-green-700 text-xl">{fmt(grandPaid)}</p>
          </div>
          <div className={`rounded-2xl p-3 text-center border ${grandBalance > 0 ? 'bg-orange-50 border-orange-200' : 'bg-emerald-50 border-emerald-200'}`}>
            <p className="text-xs text-gray-500 mb-1">⚖️ المجموع عليهم</p>
            <p className={`font-black text-xl ${grandBalance > 0 ? 'text-orange-700' : 'text-emerald-700'}`}>
              {fmt(Math.abs(grandBalance))}
            </p>
          </div>
        </div>
      )}

      {/* Partners list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {loading && (
          <div className="text-center py-16 text-gray-400">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p>جارٍ التحميل...</p>
          </div>
        )}

        {!loading && partners.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-5xl mb-3">🤝</p>
            <p className="font-bold text-gray-600">لا يوجد شركاء موثوقون بعد</p>
            <p className="text-sm mt-1">أضف مستخدماً بدور <strong>شريك موثوق</strong> من صفحة الإدارة</p>
          </div>
        )}

        {!loading && partners.map(partner => {
          const s = summaries[partner.id] || { goods: 0, paid: 0, balance: 0, pending: 0 }
          return (
            <div
              key={partner.id}
              className="bg-white rounded-2xl border-2 border-gray-100 hover:border-primary/30 hover:shadow-lg transition-all cursor-pointer p-4 group"
              onClick={() => setSelected(partner)}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center font-black text-amber-700 text-xl flex-shrink-0">
                  {partner.full_name?.charAt(0) || '؟'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-black text-gray-900">{partner.full_name}</p>
                    {s.pending > 0 && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 font-black px-2 py-0.5 rounded-full animate-pulse">
                        ⚠️ {s.pending} بانتظار التأكيد
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{partner.phone || partner.email || '—'}</p>
                </div>
                <div className="text-left flex-shrink-0">
                  <p className={`font-black text-lg ${s.balance > 0 ? 'text-orange-700' : s.balance < 0 ? 'text-emerald-700' : 'text-gray-500'}`}>
                    {fmt(Math.abs(s.balance))} <span className="text-xs font-normal text-gray-400">د</span>
                  </p>
                  <p className={`text-xs ${s.balance > 0 ? 'text-orange-500' : s.balance < 0 ? 'text-emerald-500' : 'text-gray-400'}`}>
                    {s.balance > 0 ? 'عليه' : s.balance < 0 ? 'له' : 'مسوّى'}
                  </p>
                </div>
                <span className="text-gray-300 group-hover:text-primary transition-colors text-lg mr-1">←</span>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-center">
                <div className="bg-red-50 rounded-xl p-2">
                  <p className="font-black text-red-700">{fmt(s.goods)}</p>
                  <p className="text-gray-500">📦 بضاعة أخذ</p>
                </div>
                <div className="bg-green-50 rounded-xl p-2">
                  <p className="font-black text-green-700">{fmt(s.paid)}</p>
                  <p className="text-gray-500">💰 دفع</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
