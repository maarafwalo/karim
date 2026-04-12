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

  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts]   = useState([])
  const [loading, setLoading]     = useState(false)

  // Supplier modals
  const [showSuppliersList, setShowSuppliersList] = useState(false)
  const [showAddSupplier, setShowAddSupplier]     = useState(false)
  const [form, setForm]   = useState({ name:'', phone:'', address:'', notes:'' })
  const [editing, setEditing] = useState(null)

  // Receive stock
  const [recvSupplier, setRecvSupplier] = useState('')
  const [recvRows, setRecvRows]         = useState([{ product_id:'', product_name:'', qty:1, unit_cost:0 }])
  const [prodSearch, setProdSearch]     = useState('')
  const [catFilter, setCatFilter]       = useState('')
  const [quickAdd, setQuickAdd]         = useState(false)
  const [qaForm, setQaForm]             = useState({ name:'', sell_price:'', cost_price:'', stock:'' })
  const [recvNotes, setRecvNotes]       = useState('')

  const loadSuppliers = async () => {
    setLoading(true)
    const { data } = await supabase.from('suppliers').select('*').order('name')
    setSuppliers(data || [])
    setLoading(false)
  }

  const loadProducts = async () => {
    const { data } = await supabase.from('products').select('id, name, stock, cost_price, sell_price, supplier_id, category_id, categories(name)').order('name')
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

  const allCats = [...new Set(products.map(p => p.categories?.name).filter(Boolean))].sort()

  const filteredProds = products.filter(p => {
    const qm = !prodSearch || p.name?.toLowerCase().includes(prodSearch.toLowerCase())
    const cm = !catFilter || p.categories?.name === catFilter
    return qm && cm
  })

  const submitQuickAdd = async () => {
    if (!qaForm.name.trim() || !qaForm.sell_price) { toast.error('الاسم والسعر مطلوبان'); return }
    const { data, error } = await supabase.from('products').insert({
      name: qaForm.name.trim(),
      sell_price: parseFloat(qaForm.sell_price),
      cost_price: parseFloat(qaForm.cost_price) || 0,
      stock: qaForm.stock !== '' ? parseInt(qaForm.stock) : null,
      is_active: true,
    }).select().single()
    if (error) { toast.error('فشل إضافة المنتج'); return }
    toast.success('✔ تمت إضافة المنتج')
    setProducts(prev => [...prev, data])
    // Auto-add to receive rows
    setRecvRows(r => {
      const emptyIdx = r.findIndex(x => !x.product_id)
      const newRow = { product_id: data.id, product_name: data.name, qty: 1, unit_cost: data.cost_price || 0 }
      return emptyIdx >= 0 ? r.map((row,i) => i===emptyIdx ? newRow : row) : [...r, newRow]
    })
    setQaForm({ name:'', sell_price:'', cost_price:'', stock:'' })
    setQuickAdd(false)
  }

  return (
    <div className="flex flex-col h-full font-arabic" dir="rtl">
      {/* ── HEADER ── */}
      <div className="bg-[#1a56db] text-white px-4 pt-4 pb-5 flex-shrink-0">
        <h1 className="font-black text-xl mb-3">🚚 الموردون</h1>
        <div className="flex gap-3">
          <button onClick={() => setShowSuppliersList(true)}
            className="flex-1 flex items-center gap-3 bg-white/15 hover:bg-white/25 rounded-xl px-4 py-3 transition-colors">
            <span className="text-2xl">🚚</span>
            <div className="text-right">
              <p className="font-black text-sm">الموردون</p>
              <p className="text-xs text-white/70">{suppliers.length} مورد</p>
            </div>
          </button>
          <button onClick={() => { setEditing(null); setForm({ name:'', phone:'', address:'', notes:'' }); setShowAddSupplier(true) }}
            className="flex-1 flex items-center gap-3 bg-white/15 hover:bg-white/25 rounded-xl px-4 py-3 transition-colors">
            <span className="text-2xl">➕</span>
            <div className="text-right">
              <p className="font-black text-sm">إضافة مورد</p>
              <p className="text-xs text-white/70">مورد جديد</p>
            </div>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ── RECEIVE SECTION ── */}
        <div className="space-y-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h3 className="font-black mb-3 text-base">📥 استلام بضاعة</h3>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <select value={recvSupplier} onChange={e=>setRecvSupplier(e.target.value)} className="inp text-sm">
                  <option value="">اختر المورد</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <input value={recvNotes} onChange={e=>setRecvNotes(e.target.value)}
                  className="inp text-sm" placeholder="ملاحظات" />
              </div>

              {/* Product search + picker */}
              <div className="mb-3">
                <div className="flex gap-2 mb-2">
                  <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} className="inp text-sm">
                    <option value="">— كل الأقسام —</option>
                    {allCats.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <input value={prodSearch} onChange={e=>setProdSearch(e.target.value)}
                    className="inp text-sm flex-1" placeholder="🔍 بحث عن منتج للإضافة..." />
                  <button onClick={() => setQuickAdd(true)}
                    className="bg-primary text-white px-3 rounded-xl text-lg font-black hover:bg-primary-dark transition-colors flex-shrink-0"
                    title="إضافة منتج جديد">➕</button>
                </div>
                {prodSearch && (
                  <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto shadow-sm">
                    {filteredProds.slice(0,30).map(p => (
                      <button key={p.id} type="button"
                        onClick={() => {
                          const exists = recvRows.findIndex(r => r.product_id === p.id)
                          if (exists >= 0) {
                            updateRow(exists, 'qty', recvRows[exists].qty + 1)
                          } else {
                            const emptyIdx = recvRows.findIndex(r => !r.product_id)
                            if (emptyIdx >= 0) {
                              updateRow(emptyIdx, 'product_id', p.id)
                              updateRow(emptyIdx, 'product_name', p.name)
                              updateRow(emptyIdx, 'unit_cost', p.cost_price || 0)
                            } else {
                              setRecvRows(r => [...r, { product_id: p.id, product_name: p.name, qty: 1, unit_cost: p.cost_price || 0 }])
                            }
                          }
                          setProdSearch('')
                        }}
                        className="w-full text-right px-3 py-2 text-sm hover:bg-primary hover:text-white transition-colors flex justify-between items-center border-b border-gray-50 last:border-0">
                        <span className="font-bold">{p.name}</span>
                        <span className="text-xs text-muted">{p.stock ?? '∞'}</span>
                      </button>
                    ))}
                    {filteredProds.length === 0 && <p className="p-3 text-sm text-muted text-center">لا توجد نتائج</p>}
                  </div>
                )}
              </div>

              {/* Selected rows */}
              <div className="space-y-2">
                {recvRows.map((row, i) => (
                  <div key={i} className={`rounded-xl p-3 ${row.product_id ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <p className={`font-black text-sm leading-snug ${row.product_id ? 'text-gray-800' : 'text-muted'}`}>
                        {row.product_id ? row.product_name : 'ابحث عن منتج واختره من فوق'}
                      </p>
                      <button onClick={()=>removeRow(i)} className="text-danger text-base leading-none mr-2 flex-shrink-0">✕</button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="flex flex-col items-center gap-0.5 flex-1">
                        <span className="text-[10px] text-muted">الكمية</span>
                        <input type="number" value={row.qty} min="1"
                          onChange={e=>updateRow(i,'qty',parseInt(e.target.value)||1)}
                          className="inp text-sm text-center w-full" />
                      </div>
                      <div className="flex flex-col items-center gap-0.5 flex-1">
                        <span className="text-[10px] text-muted">سعر الوحدة</span>
                        <input type="number" value={row.unit_cost} min="0" step="0.01"
                          onChange={e=>updateRow(i,'unit_cost',parseFloat(e.target.value)||0)}
                          className="inp text-sm w-full" />
                      </div>
                      <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                        <span className="text-[10px] text-muted">الإجمالي</span>
                        <span className="text-sm font-black text-primary whitespace-nowrap">{fmt(row.qty * row.unit_cost)} {cur}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
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
      </div>

      {/* Suppliers list modal */}
      {showSuppliersList && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowSuppliersList(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-black text-base">🚚 الموردون</h3>
              <button onClick={() => setShowSuppliersList(false)} className="text-gray-400 text-xl hover:text-gray-700">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? <p className="text-center p-6 text-muted">جارٍ التحميل...</p> : (
                <table className="w-full text-sm" dir="rtl">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-right p-3 font-bold">الاسم</th>
                      <th className="text-right p-3 font-bold">الهاتف</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map(s => (
                      <tr key={s.id} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="p-3 font-bold">{s.name}</td>
                        <td className="p-3 text-muted">{s.phone||'—'}</td>
                        <td className="p-3 flex gap-2">
                          <button onClick={() => { editSupplier(s); setShowSuppliersList(false); setShowAddSupplier(true) }}
                            className="text-primary text-xs font-bold hover:opacity-70">تعديل</button>
                          <button onClick={()=>delSupplier(s.id)} className="text-danger text-xs hover:opacity-70">حذف</button>
                        </td>
                      </tr>
                    ))}
                    {suppliers.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted">لا يوجد موردون</td></tr>}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/edit supplier modal */}
      {showAddSupplier && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddSupplier(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-base">{editing ? '✏️ تعديل المورد' : '➕ مورد جديد'}</h3>
              <button onClick={() => setShowAddSupplier(false)} className="text-gray-400 text-xl hover:text-gray-700">✕</button>
            </div>
            <div className="space-y-2">
              <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                className="inp text-sm" placeholder="الاسم *" autoFocus />
              <input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}
                className="inp text-sm" placeholder="الهاتف" />
              <input value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))}
                className="inp text-sm" placeholder="العنوان" />
              <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
                className="inp text-sm" placeholder="ملاحظات" />
              <div className="flex gap-2 pt-1">
                <button onClick={async () => { await saveSupplier(); setShowAddSupplier(false) }}
                  className="flex-1 bg-primary text-white text-sm font-black py-2.5 rounded-xl">
                  {editing ? '✔ حفظ التعديل' : '✔ إضافة'}
                </button>
                {editing && <button onClick={() => { setEditing(null); setForm({ name:'', phone:'', address:'', notes:'' }) }}
                  className="bg-gray-200 text-gray-700 text-sm font-bold px-4 py-2.5 rounded-xl">إلغاء</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick-add product modal */}
      {quickAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setQuickAdd(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-base">➕ منتج جديد</h3>
              <button onClick={() => setQuickAdd(false)} className="text-gray-400 text-xl hover:text-gray-700">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">اسم المنتج *</label>
                <input value={qaForm.name} onChange={e=>setQaForm(f=>({...f,name:e.target.value}))}
                  className="inp" placeholder="مثال: نيسكافي 200غ" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">سعر البيع *</label>
                  <input type="number" value={qaForm.sell_price} onChange={e=>setQaForm(f=>({...f,sell_price:e.target.value}))}
                    className="inp" step="0.01" min="0" />
                </div>
                <div>
                  <label className="label">سعر التكلفة</label>
                  <input type="number" value={qaForm.cost_price} onChange={e=>setQaForm(f=>({...f,cost_price:e.target.value}))}
                    className="inp" step="0.01" min="0" />
                </div>
              </div>
              <div>
                <label className="label">المخزون الأولي (اتركه فارغاً لـ ∞)</label>
                <input type="number" value={qaForm.stock} onChange={e=>setQaForm(f=>({...f,stock:e.target.value}))}
                  className="inp" min="0" placeholder="∞" />
              </div>
              <button onClick={submitQuickAdd}
                className="w-full bg-primary text-white font-black py-3 rounded-xl hover:bg-primary-dark transition-colors">
                ✔ إضافة المنتج
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
