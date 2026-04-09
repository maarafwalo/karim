import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useSettingsStore } from '../../stores/settingsStore.js'
import { fmt, fmtDate, buildWhatsApp } from '../../lib/utils.js'
import toast from 'react-hot-toast'

export default function CustomersPage() {
  const { settings } = useSettingsStore()
  const cur = settings?.currency || 'درهم'

  const [customers, setCustomers] = useState([])
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(false)
  const [selected, setSelected]   = useState(null) // full customer with debt history
  const [form, setForm]           = useState({ name:'', phone:'', price_tier:'retail' })
  const [showAdd, setShowAdd]     = useState(false)
  const [payAmt, setPayAmt]       = useState('')

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
      name: form.name.trim(), phone: form.phone.trim(), price_tier: form.price_tier
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

  const openDetail = async (cust) => {
    setSelected({ ...cust, invoices: [], payments: [] })
    const [{ data: invs }, { data: pays }] = await Promise.all([
      supabase.from('pos_invoices').select('*').eq('customer_id', cust.id).order('created_at', { ascending: false }).limit(30),
      supabase.from('debt_payments').select('*').eq('customer_id', cust.id).order('created_at', { ascending: false }).limit(30),
    ])
    setSelected(s => ({ ...s, invoices: invs||[], payments: pays||[] }))
  }

  const recordPayment = async () => {
    const amount = parseFloat(payAmt)
    if (!selected || isNaN(amount) || amount <= 0) return
    const { error } = await supabase.from('debt_payments').insert({ customer_id: selected.id, amount })
    if (error) { toast.error('خطأ'); return }
    await supabase.from('customers').update({ balance: Math.max(0, (selected.balance||0) - amount) }).eq('id', selected.id)
    toast.success('تم تسجيل الدفعة')
    setPayAmt('')
    load()
    openDetail(selected)
  }

  const filtered = customers.filter(c =>
    !search || c.name?.includes(search) || c.phone?.includes(search)
  )

  const totalDebt = customers.reduce((s,c) => s + (c.balance||0), 0)

  return (
    <div className="flex h-full font-arabic" dir="rtl">
      {/* List */}
      <div className="flex flex-col w-full md:w-80 border-l border-gray-100 bg-white flex-shrink-0">
        <div className="p-3 border-b">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="font-black flex-1">👤 الزبائن</h1>
            <button onClick={() => setShowAdd(s=>!s)}
              className="bg-primary text-white text-xs font-black px-3 py-1.5 rounded-lg">+ جديد</button>
          </div>
          {showAdd && (
            <div className="space-y-2 p-3 bg-gray-50 rounded-xl mb-2">
              <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                className="inp text-sm" placeholder="الاسم *" />
              <input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}
                className="inp text-sm" placeholder="الهاتف" />
              <select value={form.price_tier} onChange={e=>setForm(f=>({...f,price_tier:e.target.value}))}
                className="inp text-sm">
                <option value="retail">سعر التجزئة</option>
                <option value="wholesale">سعر الجملة</option>
              </select>
              <button onClick={save} className="w-full bg-primary text-white text-xs font-black py-1.5 rounded-lg">حفظ</button>
            </div>
          )}
          <input value={search} onChange={e=>setSearch(e.target.value)}
            className="inp text-sm" placeholder="🔍 بحث..." />
          <p className="text-xs text-danger font-bold mt-1">إجمالي الديون: {fmt(totalDebt)} {cur}</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && <p className="text-center text-muted p-4">جارٍ التحميل...</p>}
          {filtered.map(c => (
            <div key={c.id} onClick={() => openDetail(c)}
              className={`flex items-center gap-2 p-3 border-b cursor-pointer hover:bg-gray-50 ${selected?.id===c.id ? 'bg-blue-50' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{c.name}</p>
                {c.phone && <p className="text-xs text-muted">{c.phone}</p>}
                <div className="flex gap-2 mt-0.5">
                  {c.balance > 0 && <span className="text-[10px] bg-danger text-white px-1.5 py-0.5 rounded-full font-bold">دين: {fmt(c.balance)}</span>}
                  {c.loyalty_pts > 0 && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-bold">⭐ {c.loyalty_pts}</span>}
                  {c.price_tier === 'wholesale' && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">جملة</span>}
                </div>
              </div>
              <button onClick={e => { e.stopPropagation(); del(c.id) }} className="text-danger text-xs opacity-40 hover:opacity-100">✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selected ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="font-black text-lg">{selected.name}</h2>
                {selected.phone && (
                  <a href={buildWhatsApp(selected.phone, `مرحباً ${selected.name}`)} target="_blank" rel="noreferrer"
                    className="text-xs text-green-600 font-bold">📱 {selected.phone}</a>
                )}
              </div>
              <div className="text-left">
                {selected.price_tier === 'wholesale' && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold">سعر الجملة</span>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-danger/10 rounded-xl p-3 text-center">
                <p className="text-xl font-black text-danger">{fmt(selected.balance||0)}</p>
                <p className="text-xs text-muted">{cur} مديون</p>
              </div>
              <div className="bg-yellow-50 rounded-xl p-3 text-center">
                <p className="text-xl font-black text-yellow-600">{selected.loyalty_pts||0}</p>
                <p className="text-xs text-muted">نقاط الولاء</p>
              </div>
              <div className="bg-primary/10 rounded-xl p-3 text-center">
                <p className="text-xl font-black text-primary">{selected.invoices?.length||0}</p>
                <p className="text-xs text-muted">فاتورة</p>
              </div>
            </div>

            {/* Debt payment */}
            {(selected.balance||0) > 0 && (
              <div className="mt-3 flex gap-2">
                <input type="number" value={payAmt} onChange={e=>setPayAmt(e.target.value)}
                  className="inp text-sm flex-1" placeholder={`مبلغ السداد (${cur})`} />
                <button onClick={recordPayment}
                  className="bg-success text-white text-xs font-black px-4 py-2 rounded-lg">✔ تسجيل دفعة</button>
              </div>
            )}
          </div>

          {/* Invoices */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-3 border-b bg-gray-50 font-black text-sm">🧾 الفواتير ({selected.invoices?.length||0})</div>
            {(selected.invoices||[]).map(inv => (
              <div key={inv.id} className="flex items-center justify-between p-3 border-b hover:bg-gray-50 text-sm">
                <div>
                  <p className="font-bold text-xs">{inv.order_number}</p>
                  <p className="text-xs text-muted">{fmtDate(inv.created_at)}</p>
                </div>
                <div className="text-left">
                  <p className="font-black text-primary">{fmt(inv.total)} {cur}</p>
                  <p className="text-xs text-muted">{inv.payment_label||inv.payment_method}</p>
                </div>
              </div>
            ))}
            {(selected.invoices||[]).length === 0 && <p className="text-center text-muted p-4 text-sm">لا توجد فواتير</p>}
          </div>

          {/* Payments */}
          {(selected.payments||[]).length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-3 border-b bg-gray-50 font-black text-sm">💵 سجل السداد</div>
              {selected.payments.map(p => (
                <div key={p.id} className="flex justify-between p-3 border-b text-sm">
                  <p className="text-muted text-xs">{fmtDate(p.created_at)}</p>
                  <p className="font-black text-success">{fmt(p.amount)} {cur}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted">
          اختر زبوناً لعرض التفاصيل
        </div>
      )}
    </div>
  )
}
