import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useSettingsStore } from '../../stores/settingsStore.js'
import { useAuthStore } from '../../stores/authStore.js'
import { useShiftStore } from '../../stores/shiftStore.js'
import { fmt, fmtDate } from '../../lib/utils.js'
import toast from 'react-hot-toast'

const today = new Date().toISOString().slice(0, 10)
const CATEGORIES = ['مصاريف تشغيل','رواتب','إيجار','نقل','كهرباء وماء','صيانة','مشتريات','أخرى']

export default function ExpensesPage() {
  const { settings } = useSettingsStore()
  const { profile }  = useAuthStore()
  const { currentShift } = useShiftStore()
  const cur = settings?.currency || 'درهم'

  const [expenses, setExpenses] = useState([])
  const [from, setFrom] = useState(today)
  const [to,   setTo]   = useState(today)
  const [form, setForm] = useState({ category: CATEGORIES[0], description: '', amount: '' })
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('expenses')
      .select('*')
      .gte('created_at', from + 'T00:00:00')
      .lte('created_at', to   + 'T23:59:59')
      .order('created_at', { ascending: false })
    setExpenses(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    const amount = parseFloat(form.amount)
    if (!form.category || isNaN(amount) || amount <= 0) {
      toast.error('يرجى إدخال الفئة والمبلغ')
      return
    }
    const { error } = await supabase.from('expenses').insert({
      cashier_id:  profile?.id,
      shift_id:    currentShift?.id || null,
      category:    form.category,
      description: form.description,
      amount,
    })
    if (error) { toast.error('خطأ في الحفظ'); return }
    toast.success('تم تسجيل المصروف')
    setForm(f => ({ ...f, description: '', amount: '' }))
    load()
  }

  const del = async (id) => {
    if (!confirm('حذف هذا المصروف؟')) return
    await supabase.from('expenses').delete().eq('id', id)
    setExpenses(e => e.filter(x => x.id !== id))
  }

  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0)

  return (
    <div className="flex flex-col h-full font-arabic" dir="rtl">
      <div className="px-4 py-3 bg-white border-b flex-shrink-0">
        <h1 className="font-black text-lg">💸 المصاريف</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Add form */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h3 className="font-black mb-3">تسجيل مصروف جديد</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <select value={form.category} onChange={e => setForm(f=>({...f, category: e.target.value}))}
              className="inp text-sm">
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <input value={form.description} onChange={e => setForm(f=>({...f, description: e.target.value}))}
              className="inp text-sm" placeholder="الوصف (اختياري)" />
            <input type="number" value={form.amount} onChange={e => setForm(f=>({...f, amount: e.target.value}))}
              className="inp text-sm" placeholder={`المبلغ ${cur}`} min="0" step="0.01" />
            <button onClick={save} className="bg-primary text-white font-black text-sm py-2 rounded-lg">+ إضافة</button>
          </div>
          {currentShift && (
            <p className="text-xs text-muted mt-2">📍 سيتم ربطه بوردية: {new Date(currentShift.opened_at).toLocaleTimeString('ar')}</p>
          )}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="inp text-sm py-1 w-36" />
          <span className="text-muted text-xs">→</span>
          <input type="date" value={to}   onChange={e=>setTo(e.target.value)}   className="inp text-sm py-1 w-36" />
          <button onClick={load} className="bg-gray-200 text-gray-700 text-sm font-bold px-4 py-1.5 rounded-lg">عرض</button>
          <span className="text-sm font-black text-danger mr-auto">إجمالي: {fmt(total)} {cur}</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <p className="text-center text-muted p-6">جارٍ التحميل...</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-right p-3 font-bold">التاريخ</th>
                  <th className="text-right p-3 font-bold">الفئة</th>
                  <th className="text-right p-3 font-bold">الوصف</th>
                  <th className="text-left p-3 font-bold">المبلغ</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="p-3 text-muted text-xs">{fmtDate(e.created_at)}</td>
                    <td className="p-3 font-bold">{e.category}</td>
                    <td className="p-3 text-muted">{e.description || '—'}</td>
                    <td className="p-3 text-left font-black text-danger">{fmt(e.amount)} {cur}</td>
                    <td className="p-3">
                      <button onClick={() => del(e.id)} className="text-danger text-xs hover:opacity-70">✕</button>
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-muted">لا توجد مصاريف في هذه الفترة</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
