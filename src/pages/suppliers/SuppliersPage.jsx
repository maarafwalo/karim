import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useProductsStore } from '../../stores/productsStore.js'
import { useAuthStore } from '../../stores/authStore.js'
import { useSettingsStore } from '../../stores/settingsStore.js'
import { fmt, fmtDate, generateOrderNumber } from '../../lib/utils.js'
import toast from 'react-hot-toast'

export default function SuppliersPage() {
  const { settings } = useSettingsStore()
  const { profile }  = useAuthStore()
  const cur = settings?.currency || 'درهم'

  const [tab, setTab]             = useState('suppliers')
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts]   = useState([])
  const [loading, setLoading]     = useState(false)

  // Supplier form
  const [form, setForm]   = useState({ name:'', phone:'', address:'', notes:'' })
  const [editing, setEditing] = useState(null)

  // Receive stock
  const [recvSupplier, setRecvSupplier] = useState('')
  const [recvRows, setRecvRows]         = useState([{ product_id:'', product_name:'', qty:1, unit_cost:0 }])
  const [prodSearch, setProdSearch]     = useState('')
  const [recvNotes, setRecvNotes]       = useState('')

  const loadSuppliers = async () => {
    setLoading(true)
    const { data } = await supabase.from('suppliers').select('*').order('name')
    setSuppliers(data || [])
    setLoading(false)
  }

  const loadProducts = async () => {
    const { data } = await supabase.from('products').select('id, name, stock, cost_price, sell_price, supplier_id').order('name')
    setProducts(data || [])
  }

  useEffect(() => { loadSuppliers(); loadProducts() }, [])

  const saveSupplier = async () => {
    if (!form.name.trim()) { toast.error('يرجى إدخال الاسم'); return }
    if (editing) {
      await supabase.from('suppliers').update({ name:form.name, phone:form.phone, address:form.address, notes:form.notes }).eq('id', editing)
      toast.success('تم التعديل')
    } else {
      await supabase.from('suppliers').insert({ name:form.name, phone:form.phone, address:form.address, notes:form.notes })
      toast.success('تم الإضافة')
    }
    setForm({ name:'', phone:'', address:'', notes:'' })
    setEditing(null)
    loadSuppliers()
  }

  const delSupplier = async (id) => {
    if (!confirm('حذف هذا المورد؟')) return
    await supabase.from('suppliers').delete().eq('id', id)
    setSuppliers(s => s.filter(x => x.id !== id))
  }

  const editSupplier = (s) => {
    setEditing(s.id)
    setForm({ name:s.name||'', phone:s.phone||'', address:s.address||'', notes:s.notes||'' })
  }

  // Receive stock
  const addRow = () => setRecvRows(r => [...r, { product_id:'', product_name:'', qty:1, unit_cost:0 }])
  const updateRow = (i, key, val) => setRecvRows(r => r.map((row,idx) => idx===i ? {...row, [key]:val} : row))
  const removeRow = (i) => setRecvRows(r => r.filter((_,idx) => idx!==i))

  const confirmReceive = async () => {
    const validRows = recvRows.filter(r => r.product_id && r.qty > 0)
    if (!validRows.length) { toast.error('أضف منتجاً على الأقل'); return }
    const totalCost = validRows.reduce((s,r) => s + (r.qty * r.unit_cost), 0)

    const { data: recv, error } = await supabase.from('stock_receives').insert({
      supplier_id: recvSupplier || null,
      received_by: profile?.id,
      notes: recvNotes,
      total_cost: totalCost,
    }).select().single()
    if (error) { toast.error('خطأ في الحفظ'); return }

    await supabase.from('stock_receive_items').insert(
      validRows.map(r => ({
        receive_id:   recv.id,
        product_id:   r.product_id,
        product_name: r.product_name,
        qty_received: r.qty,
        unit_cost:    r.unit_cost,
        total_cost:   r.qty * r.unit_cost,
      }))
    )

    // Update stock for each product
    for (const r of validRows) {
      const prod = products.find(p => p.id === r.product_id)
      const newStock = (prod?.stock || 0) + r.qty
      await supabase.from('products').update({ stock: newStock }).eq('id', r.product_id)
    }

    toast.success('تم استلام البضاعة وتحديث المخزون')
    setRecvRows([{ product_id:'', product_name:'', qty:1, unit_cost:0 }])
    setRecvNotes('')
    setRecvSupplier('')
    loadProducts()
  }

  const filteredProds = products.filter(p =>
    !prodSearch || p.name?.toLowerCase().includes(prodSearch.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full font-arabic" dir="rtl">
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b flex-shrink-0">
        <h1 className="font-black text-lg">🚚 الموردون</h1>
        {['suppliers','receive'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold ${tab===t ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`}>
            {t==='suppliers' ? 'الموردون' : 'استلام بضاعة'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* ── SUPPLIERS TAB ── */}
        {tab === 'suppliers' && (
          <div className="space-y-4">
            {/* Form */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <h3 className="font-black mb-3">{editing ? 'تعديل المورد' : 'إضافة مورد جديد'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                  className="inp text-sm" placeholder="الاسم *" />
                <input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}
                  className="inp text-sm" placeholder="الهاتف" />
                <input value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))}
                  className="inp text-sm" placeholder="العنوان" />
                <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
                  className="inp text-sm" placeholder="ملاحظات" />
              </div>
              <div className="flex gap-2">
                <button onClick={saveSupplier} className="bg-primary text-white text-sm font-black px-4 py-1.5 rounded-lg">
                  {editing ? '✔ حفظ التعديل' : '+ إضافة'}
                </button>
                {editing && <button onClick={() => { setEditing(null); setForm({ name:'', phone:'', address:'', notes:'' }) }}
                  className="bg-gray-200 text-gray-700 text-sm font-bold px-4 py-1.5 rounded-lg">إلغاء</button>}
              </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {loading ? <p className="text-center p-6 text-muted">جارٍ التحميل...</p> : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-right p-3 font-bold">الاسم</th>
                      <th className="text-right p-3 font-bold">الهاتف</th>
                      <th className="text-right p-3 font-bold">العنوان</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map(s => (
                      <tr key={s.id} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="p-3 font-bold">{s.name}</td>
                        <td className="p-3 text-muted">{s.phone||'—'}</td>
                        <td className="p-3 text-muted">{s.address||'—'}</td>
                        <td className="p-3 flex gap-2">
                          <button onClick={()=>editSupplier(s)} className="text-primary text-xs font-bold hover:opacity-70">تعديل</button>
                          <button onClick={()=>delSupplier(s.id)} className="text-danger text-xs hover:opacity-70">حذف</button>
                        </td>
                      </tr>
                    ))}
                    {suppliers.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted">لا يوجد موردون</td></tr>}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── RECEIVE TAB ── */}
        {tab === 'receive' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <h3 className="font-black mb-3">استلام بضاعة جديدة</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                <select value={recvSupplier} onChange={e=>setRecvSupplier(e.target.value)} className="inp text-sm">
                  <option value="">اختر المورد (اختياري)</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <input value={recvNotes} onChange={e=>setRecvNotes(e.target.value)}
                  className="inp text-sm" placeholder="ملاحظات" />
              </div>

              <input value={prodSearch} onChange={e=>setProdSearch(e.target.value)}
                className="inp text-sm mb-3" placeholder="🔍 بحث عن منتج..." />

              <div className="space-y-2">
                {recvRows.map((row, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <select value={row.product_id}
                      onChange={e => {
                        const p = products.find(x => x.id === e.target.value)
                        updateRow(i, 'product_id', e.target.value)
                        updateRow(i, 'product_name', p?.name||'')
                        updateRow(i, 'unit_cost', p?.cost_price||0)
                      }}
                      className="inp text-sm flex-1">
                      <option value="">اختر منتج</option>
                      {filteredProds.map(p => <option key={p.id} value={p.id}>{p.name} (مخزون: {p.stock??'∞'})</option>)}
                    </select>
                    <input type="number" value={row.qty} min="1"
                      onChange={e=>updateRow(i,'qty',parseInt(e.target.value)||1)}
                      className="inp text-sm w-20" placeholder="الكمية" />
                    <input type="number" value={row.unit_cost} min="0" step="0.01"
                      onChange={e=>updateRow(i,'unit_cost',parseFloat(e.target.value)||0)}
                      className="inp text-sm w-24" placeholder={`سعر الوحدة`} />
                    <span className="text-xs font-black text-primary w-20 text-left">{fmt(row.qty * row.unit_cost)} {cur}</span>
                    <button onClick={()=>removeRow(i)} className="text-danger text-sm">✕</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={addRow} className="bg-gray-100 text-gray-700 text-sm font-bold px-3 py-1.5 rounded-lg">+ سطر</button>
                <button onClick={confirmReceive}
                  className="bg-success text-white text-sm font-black px-4 py-1.5 rounded-lg">
                  ✔ تأكيد الاستلام
                </button>
                <span className="text-sm font-black text-primary mr-auto">
                  المجموع: {fmt(recvRows.reduce((s,r)=>s+(r.qty*r.unit_cost),0))} {cur}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
