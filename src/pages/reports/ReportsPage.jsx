import { useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useSettingsStore } from '../../stores/settingsStore.js'
import { fmt, fmtDate } from '../../lib/utils.js'

const today = new Date().toISOString().slice(0, 10)

export default function ReportsPage() {
  const { settings } = useSettingsStore()
  const cur = settings?.currency || 'درهم'

  const [tab, setTab]       = useState('summary')
  const [from, setFrom]     = useState(today)
  const [to, setTo]         = useState(today)
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const f = from + 'T00:00:00', t = to + 'T23:59:59'

    const [{ data: invs }, { data: items }, { data: exps }] = await Promise.all([
      supabase.from('pos_invoices').select('*').gte('created_at', f).lte('created_at', t),
      supabase.from('pos_invoice_items').select('*, pos_invoices!inner(created_at)')
        .gte('pos_invoices.created_at', f).lte('pos_invoices.created_at', t),
      supabase.from('expenses').select('*').gte('created_at', f).lte('created_at', t),
    ])

    // Summary
    const revenue    = (invs||[]).reduce((s,i) => s + (i.total||0), 0)
    const discount   = (invs||[]).reduce((s,i) => s + (i.discount_amt||0), 0)
    const cashTotal  = (invs||[]).filter(i=>i.payment_method==='cash').reduce((s,i)=>s+(i.total||0),0)
    const cardTotal  = (invs||[]).filter(i=>i.payment_method==='card').reduce((s,i)=>s+(i.total||0),0)
    const creditTotal= (invs||[]).filter(i=>['credit','debt'].includes(i.payment_method)).reduce((s,i)=>s+(i.total||0),0)
    const expTotal   = (exps||[]).reduce((s,e) => s + (e.amount||0), 0)

    // Top products
    const prodMap = {}
    ;(items||[]).forEach(it => {
      const k = it.product_name
      if (!prodMap[k]) prodMap[k] = { name: k, qty: 0, total: 0 }
      prodMap[k].qty   += it.quantity || 0
      prodMap[k].total += it.total    || 0
    })
    const topProducts = Object.values(prodMap).sort((a,b) => b.total - a.total)

    setData({ invs: invs||[], revenue, discount, cashTotal, cardTotal, creditTotal, expTotal, topProducts, exps: exps||[] })
    setLoading(false)
  }

  const TABS = [
    { id:'summary',  label:'ملخص' },
    { id:'products', label:'المنتجات' },
    { id:'expenses', label:'المصاريف' },
    { id:'invoices', label:'الفواتير' },
  ]

  return (
    <div className="flex flex-col h-full font-arabic" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white border-b flex-shrink-0 flex-wrap">
        <h1 className="font-black text-lg">📊 التقارير</h1>
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="inp text-sm py-1 w-36" />
          <span className="text-muted text-xs">→</span>
          <input type="date" value={to}   onChange={e=>setTo(e.target.value)}   className="inp text-sm py-1 w-36" />
          <button onClick={load} disabled={loading}
            className="bg-primary text-white font-black text-sm px-4 py-1.5 rounded-lg disabled:opacity-50">
            {loading ? '...' : 'عرض'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 py-2 bg-gray-50 border-b flex-shrink-0 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap ${tab===t.id ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!data && !loading && (
          <p className="text-center text-muted mt-20">اختر الفترة واضغط "عرض"</p>
        )}
        {loading && <p className="text-center text-muted mt-20">جارٍ التحميل...</p>}

        {data && tab === 'summary' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label:'إجمالي المبيعات', value: fmt(data.revenue), color:'text-primary', icon:'💰' },
                { label:'عدد الفواتير',     value: data.invs.length,  color:'text-gray-800', icon:'🧾' },
                { label:'متوسط الفاتورة',   value: fmt(data.invs.length ? data.revenue/data.invs.length : 0), color:'text-blue-600', icon:'📈' },
                { label:'إجمالي الخصومات', value: fmt(data.discount), color:'text-orange-500', icon:'🏷️' },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <p className="text-2xl mb-1">{c.icon}</p>
                  <p className={`text-xl font-black ${c.color}`}>{c.value} <span className="text-xs text-muted font-normal">{typeof c.value === 'number' ? '' : cur}</span></p>
                  <p className="text-xs text-muted">{c.label}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <h3 className="font-black mb-3">توزيع طرق الدفع</h3>
              <div className="space-y-2">
                {[
                  { label:'نقود',   value: data.cashTotal,   color:'bg-green-500' },
                  { label:'بطاقة',  value: data.cardTotal,   color:'bg-blue-500' },
                  { label:'دين/كريدي', value: data.creditTotal, color:'bg-orange-500' },
                ].map(r => (
                  <div key={r.label} className="flex items-center gap-3">
                    <span className="text-xs text-muted w-20">{r.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div className={`${r.color} h-3 rounded-full`}
                        style={{ width: data.revenue > 0 ? `${(r.value/data.revenue*100).toFixed(0)}%` : '0%' }} />
                    </div>
                    <span className="text-xs font-black w-24 text-left">{fmt(r.value)} {cur}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <h3 className="font-black mb-3">صافي الربح التقديري</h3>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted">إجمالي المبيعات</span><span className="font-bold text-primary">+ {fmt(data.revenue)} {cur}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted">إجمالي المصاريف</span><span className="font-bold text-danger">− {fmt(data.expTotal)} {cur}</span>
              </div>
              <div className="flex justify-between text-base font-black border-t pt-2 mt-2">
                <span>الصافي</span>
                <span className={data.revenue - data.expTotal >= 0 ? 'text-success' : 'text-danger'}>
                  {fmt(data.revenue - data.expTotal)} {cur}
                </span>
              </div>
            </div>
          </div>
        )}

        {data && tab === 'products' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-right p-3 font-bold">#</th>
                  <th className="text-right p-3 font-bold">المنتج</th>
                  <th className="text-center p-3 font-bold">الكمية</th>
                  <th className="text-left p-3 font-bold">المبيعات</th>
                </tr>
              </thead>
              <tbody>
                {data.topProducts.map((p,i) => (
                  <tr key={p.name} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="p-3 text-muted font-black">{i+1}</td>
                    <td className="p-3 font-bold">{p.name}</td>
                    <td className="p-3 text-center">{p.qty}</td>
                    <td className="p-3 text-left font-black text-primary">{fmt(p.total)} {cur}</td>
                  </tr>
                ))}
                {data.topProducts.length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center text-muted">لا توجد بيانات</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {data && tab === 'expenses' && (
          <div className="space-y-3">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex justify-between items-center">
              <span className="font-black">إجمالي المصاريف</span>
              <span className="text-xl font-black text-danger">{fmt(data.expTotal)} {cur}</span>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-right p-3 font-bold">التاريخ</th>
                    <th className="text-right p-3 font-bold">الفئة</th>
                    <th className="text-right p-3 font-bold">الوصف</th>
                    <th className="text-left p-3 font-bold">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.exps.map(e => (
                    <tr key={e.id} className="border-t border-gray-50">
                      <td className="p-3 text-muted text-xs">{fmtDate(e.created_at)}</td>
                      <td className="p-3 font-bold">{e.category}</td>
                      <td className="p-3 text-muted">{e.description}</td>
                      <td className="p-3 text-left font-black text-danger">{fmt(e.amount)} {cur}</td>
                    </tr>
                  ))}
                  {data.exps.length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-center text-muted">لا توجد مصاريف</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data && tab === 'invoices' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-right p-3 font-bold">رقم</th>
                  <th className="text-right p-3 font-bold">التاريخ</th>
                  <th className="text-right p-3 font-bold">الزبون</th>
                  <th className="text-right p-3 font-bold">الدفع</th>
                  <th className="text-left p-3 font-bold">المجموع</th>
                </tr>
              </thead>
              <tbody>
                {data.invs.map(inv => (
                  <tr key={inv.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="p-3 font-black text-xs">{inv.order_number}</td>
                    <td className="p-3 text-muted text-xs">{fmtDate(inv.created_at)}</td>
                    <td className="p-3">{inv.customer_name || '—'}</td>
                    <td className="p-3 text-xs">{inv.payment_label || inv.payment_method}</td>
                    <td className="p-3 text-left font-black text-primary">{fmt(inv.total)} {cur}</td>
                  </tr>
                ))}
                {data.invs.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-muted">لا توجد فواتير</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
