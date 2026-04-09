import { useState, useEffect } from 'react'
import { useProductsStore } from '../../stores/productsStore.js'
import { useSettingsStore } from '../../stores/settingsStore.js'
import { useStoreContext } from '../../stores/storeContext.js'
import { fmt, calcMargin } from '../../lib/utils.js'
import toast from 'react-hot-toast'

// ── Product Form Modal ───────────────────────────────────────
function ProductModal({ product, categories, stores, onSave, onClose }) {
  const [form, setForm] = useState(product || {
    name:'', cat:'', size:'', sell_price:'', cost_price:'',
    barcode:'', emoji:'📦', image_url:'', stock:'', is_active: true, is_hidden: false,
    store_id: null,
  })
  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.sell_price) { toast.error('الاسم والسعر مطلوبان'); return }
    const cat = categories.find(c => c.name === form.cat)
    await onSave({
      name:        form.name.trim(),
      size:        form.size || '',
      sell_price:  parseFloat(form.sell_price),
      cost_price:  parseFloat(form.cost_price) || 0,
      barcode:     form.barcode || null,
      emoji:       form.emoji || '📦',
      image_url:   form.image_url || null,
      stock:       form.stock !== '' && form.stock !== null ? parseInt(form.stock) : null,
      category_id: cat?.id || null,
      cat:         form.cat,
      is_active:   form.is_active,
      is_hidden:   form.is_hidden,
      store_id:    form.store_id || null,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-slide-up" onClick={e=>e.stopPropagation()}>
        <div className="sticky top-0 bg-white flex justify-between items-center p-4 border-b z-10">
          <h2 className="font-black text-lg">{product ? '✏️ تعديل المنتج' : '➕ منتج جديد'}</h2>
          <button onClick={onClose} className="text-gray-400 text-xl hover:text-gray-700">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div><label className="label">اسم المنتج *</label><input value={form.name} onChange={e=>set('name',e.target.value)} className="inp" placeholder="مثال: نيسكافي 200غ" required /></div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">القسم</label>
              <select value={form.cat} onChange={e=>set('cat',e.target.value)} className="inp">
                <option value="">— اختر —</option>
                {categories.filter(c=>c.name!=='الكل').map(c=><option key={c.name} value={c.name}>{c.emoji} {c.name}</option>)}
              </select>
            </div>
            <div><label className="label">الحجم/النوع</label><input value={form.size} onChange={e=>set('size',e.target.value)} className="inp" placeholder="200غ" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">سعر البيع *</label><input type="number" value={form.sell_price} onChange={e=>set('sell_price',e.target.value)} className="inp" step="0.01" min="0" required /></div>
            <div><label className="label">سعر التكلفة</label><input type="number" value={form.cost_price} onChange={e=>set('cost_price',e.target.value)} className="inp" step="0.01" min="0" /></div>
          </div>
          {form.sell_price && form.cost_price && (
            <div className="bg-success-light text-success text-xs font-bold rounded-lg px-3 py-1.5">
              الهامش: {calcMargin(parseFloat(form.sell_price), parseFloat(form.cost_price))}%
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">الباركود</label><input value={form.barcode} onChange={e=>set('barcode',e.target.value)} className="inp font-mono" placeholder="6111234567890" /></div>
            <div><label className="label">المخزون (∞=فارغ)</label><input type="number" value={form.stock} onChange={e=>set('stock',e.target.value)} className="inp" min="0" placeholder="∞" /></div>
          </div>
          <div><label className="label">رابط الصورة</label><input value={form.image_url} onChange={e=>set('image_url',e.target.value)} className="inp" placeholder="https://..." /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">الإيموجي</label><input value={form.emoji} onChange={e=>set('emoji',e.target.value)} className="inp text-center text-2xl" maxLength={4} /></div>
            <div className="space-y-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e=>set('is_active',e.target.checked)} />
                <span className="text-sm font-bold">نشط</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_hidden} onChange={e=>set('is_hidden',e.target.checked)} />
                <span className="text-sm font-bold">مخفي</span>
              </label>
            </div>
          </div>
          {/* Store assignment */}
          {stores.length > 0 && (
            <div>
              <label className="label">الفرع</label>
              <select value={form.store_id || ''} onChange={e=>set('store_id', e.target.value || null)} className="inp">
                <option value="">🏠 المتجر الرئيسي</option>
                {stores.map(s=><option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
              </select>
            </div>
          )}
          {form.image_url && <img src={form.image_url} alt="" className="w-20 h-20 object-cover rounded-xl border" />}
          <button type="submit" className="w-full bg-primary hover:bg-primary-dark text-white font-black py-3 rounded-xl transition-colors">
            {product ? '💾 حفظ التعديل' : '➕ إضافة المنتج'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── MAIN EDITING PAGE ─────────────────────────────────────────
export default function EditingPage() {
  const { products, categories, createProduct, updateProduct, deleteProduct } = useProductsStore()
  const { settings } = useSettingsStore()
  const { stores, loadStores } = useStoreContext()

  const [q, setQ]             = useState('')
  const [catFilter, setCat]   = useState('')
  const [storeFilter, setSF]  = useState('main') // 'main' | store.id
  const [editProd, setEdit]   = useState(null)
  const [showForm, setShow]   = useState(false)

  useEffect(() => { loadStores() }, [])

  const cur = settings?.currency || 'درهم'

  const filtered = products.filter(p => {
    const qm = !q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.barcode||'').includes(q) || (p.categories?.name||p.cat||'').includes(q)
    const cm = !catFilter || (p.categories?.name||p.cat) === catFilter
    const sm = storeFilter === 'all'
      ? true
      : storeFilter === 'main'
        ? !p.store_id
        : p.store_id === storeFilter
    return qm && cm && sm
  })

  const handleSave = async (data) => {
    if (editProd && editProd !== 'new') {
      const { error } = await updateProduct(editProd.id, data)
      if (error) toast.error('فشل التعديل'); else toast.success('✔ تم حفظ التعديل')
    } else {
      const { error } = await createProduct(data)
      if (error) toast.error('فشل الإضافة'); else toast.success('✔ تمت الإضافة')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('حذف هذا المنتج نهائياً؟')) return
    const error = await deleteProduct(id)
    if (error) toast.error('فشل الحذف'); else toast.success('✔ تم الحذف')
  }

  // Default store_id for new product modal
  const defaultStoreId = storeFilter === 'main' || storeFilter === 'all' ? null : storeFilter

  return (
    <div className="flex flex-col h-full overflow-hidden font-arabic" dir="rtl">
      {/* Toolbar */}
      <div className="flex gap-2 p-3 bg-white border-b border-gray-100 flex-shrink-0 flex-wrap">
        <input value={q} onChange={e=>setQ(e.target.value)} className="inp flex-1 min-w-32" placeholder="🔍 بحث بالاسم أو الباركود..." />
        <select value={catFilter} onChange={e=>setCat(e.target.value)} className="inp" style={{width:130}}>
          <option value="">— كل الأقسام —</option>
          {categories.filter(c=>c.name!=='الكل').map(c=><option key={c.name} value={c.name}>{c.emoji} {c.name}</option>)}
        </select>
        {stores.length > 0 && (
          <select value={storeFilter} onChange={e=>setSF(e.target.value)} className="inp" style={{width:130}}>
            <option value="all">🏬 كل الفروع</option>
            <option value="main">🏠 الرئيسي</option>
            {stores.map(s=><option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
          </select>
        )}
        <button onClick={() => { setEdit('new'); setShow(true) }}
          className="bg-primary text-white font-bold px-4 py-2 rounded-xl text-sm whitespace-nowrap hover:bg-primary-dark transition-colors">
          ➕ منتج جديد
        </button>
        <span className="text-xs text-muted self-center">{filtered.length} منتج</span>
      </div>

      {/* Products table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs min-w-[600px]">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr className="border-b border-gray-200">
              <th className="text-right p-2 font-bold text-muted">المنتج</th>
              <th className="text-center p-2 font-bold text-muted w-24">القسم</th>
              {stores.length > 0 && <th className="text-center p-2 font-bold text-muted w-20">الفرع</th>}
              <th className="text-center p-2 font-bold text-muted w-20">البيع</th>
              <th className="text-center p-2 font-bold text-muted w-20">التكلفة</th>
              <th className="text-center p-2 font-bold text-muted w-16">الهامش</th>
              <th className="text-center p-2 font-bold text-muted w-16">المخزون</th>
              <th className="text-center p-2 font-bold text-muted w-16">الباركود</th>
              <th className="w-20 p-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const margin = calcMargin(p.sell_price, p.cost_price)
              const storeName = p.store_id ? (stores.find(s=>s.id===p.store_id)?.name || '—') : 'رئيسي'
              const storeIcon = p.store_id ? (stores.find(s=>s.id===p.store_id)?.icon || '') : '🏠'
              return (
                <tr key={p.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${!p.is_active?'opacity-40':''} ${p.is_hidden?'bg-gray-100':''}`}>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center text-base">
                        {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" loading="lazy" /> : p.emoji||'📦'}
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">{p.name}</p>
                        {p.size && <p className="text-[10px] text-muted">{p.size}</p>}
                        {p.is_hidden && <span className="text-[10px] bg-gray-200 px-1 rounded">مخفي</span>}
                      </div>
                    </div>
                  </td>
                  <td className="p-2 text-center text-muted">{p.categories?.name || p.cat}</td>
                  {stores.length > 0 && <td className="p-2 text-center text-muted text-[11px]">{storeIcon} {storeName}</td>}
                  <td className="p-2 text-center font-black text-primary">{fmt(p.sell_price)}</td>
                  <td className="p-2 text-center text-purple-600 font-bold">{p.cost_price ? fmt(p.cost_price) : '—'}</td>
                  <td className="p-2 text-center">
                    {margin ? <span className={`font-bold ${parseFloat(margin) >= 20 ? 'text-success' : parseFloat(margin) >= 10 ? 'text-accent' : 'text-danger'}`}>{margin}%</span> : '—'}
                  </td>
                  <td className="p-2 text-center">
                    {p.stock === null ? <span className="badge-unlimited">∞</span>
                      : p.stock <= 0 ? <span className="badge-out">{p.stock}</span>
                      : p.stock <= 5 ? <span className="badge-low">{p.stock}</span>
                      : <span className="badge-ok">{p.stock}</span>}
                  </td>
                  <td className="p-2 text-center font-mono text-[10px] text-muted">{p.barcode || '—'}</td>
                  <td className="p-2">
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => { setEdit(p); setShow(true) }}
                        className="bg-primary-light text-primary rounded-lg px-2 py-1 font-bold hover:bg-primary hover:text-white transition-colors">✏️</button>
                      <button onClick={() => handleDelete(p.id)}
                        className="bg-danger-light text-danger rounded-lg px-2 py-1 font-bold hover:bg-danger hover:text-white transition-colors">🗑️</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Product modal */}
      {showForm && (
        <ProductModal
          product={editProd === 'new' ? (defaultStoreId ? { store_id: defaultStoreId } : null) : editProd}
          categories={categories}
          stores={stores}
          onSave={handleSave}
          onClose={() => { setShow(false); setEdit(null) }}
        />
      )}
    </div>
  )
}
