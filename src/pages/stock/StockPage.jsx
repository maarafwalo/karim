import { useState, useRef } from 'react'
import { useProductsStore } from '../../stores/productsStore.js'
import { useSettingsStore } from '../../stores/settingsStore.js'
import { supabase } from '../../lib/supabase.js'
import { fmt, calcMargin } from '../../lib/utils.js'
import toast from 'react-hot-toast'

// ── Product Form Modal ────────────────────────────────────────
function ProductModal({ product, categories, onSave, onClose }) {
  const [form, setForm] = useState(product || {
    name: '', cat: '', sell_price: '', cost_price: '', stock: '',
    barcode: '', size: '', emoji: '📦', image_url: '', is_active: true,
    is_hidden: false, min_stock: '', unit: '', notes: '', discount_price: '',
  })
  const [advanced, setAdvanced] = useState(!!product)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)
  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleImageUpload = async (file) => {
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const fileName = `${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('product-images').upload(fileName, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('product-images').getPublicUrl(fileName)
      set('image_url', data.publicUrl)
      toast.success('✔ تم رفع الصورة')
    } else {
      toast.error('فشل رفع الصورة — جرب رابط URL')
    }
    setUploading(false)
  }

  const margin = form.sell_price && form.cost_price
    ? calcMargin(parseFloat(form.sell_price), parseFloat(form.cost_price))
    : null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.sell_price) { toast.error('الاسم والسعر مطلوبان'); return }
    const cat = categories.find(c => c.name === form.cat)
    await onSave({
      name:        form.name.trim(),
      sell_price:  parseFloat(form.sell_price),
      cost_price:  parseFloat(form.cost_price) || 0,
      stock:       form.stock !== '' && form.stock !== null ? parseInt(form.stock) : null,
      category_id: cat?.id || null,
      is_active:   form.is_active ?? true,
      ...(advanced && {
        barcode:        form.barcode || null,
        size:           form.size || '',
        emoji:          form.emoji || '📦',
        image_url:      form.image_url || null,
        is_hidden:      form.is_hidden || false,
        min_stock:      form.min_stock !== '' ? parseInt(form.min_stock) : null,
        unit:           form.unit || null,
        notes:          form.notes || null,
        discount_price: form.discount_price !== '' ? parseFloat(form.discount_price) : null,
      }),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white flex justify-between items-center p-4 border-b z-10">
          <h2 className="font-black text-lg">{product ? '✏️ تعديل المنتج' : '➕ منتج جديد'}</h2>
          <button onClick={onClose} className="text-gray-400 text-xl hover:text-gray-700">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">

          {/* Basic fields */}
          <div><label className="label">اسم المنتج *</label><input value={form.name} onChange={e => set('name', e.target.value)} className="inp" required autoFocus /></div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">القسم</label>
              <select value={form.cat} onChange={e => set('cat', e.target.value)} className="inp">
                <option value="">— اختر —</option>
                {categories.filter(c => c.name !== 'الكل').map(c => <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>)}
              </select>
            </div>
            <div><label className="label">المخزون</label><input type="number" value={form.stock} onChange={e => set('stock', e.target.value)} className="inp" min="0" placeholder="∞" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">سعر البيع *</label><input type="number" value={form.sell_price} onChange={e => set('sell_price', e.target.value)} className="inp" step="0.01" min="0" required /></div>
            <div><label className="label">سعر التكلفة</label><input type="number" value={form.cost_price} onChange={e => set('cost_price', e.target.value)} className="inp" step="0.01" min="0" /></div>
          </div>

          {margin && (
            <div className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-black ${parseFloat(margin) >= 20 ? 'bg-success-light text-success' : parseFloat(margin) >= 10 ? 'bg-accent-light text-accent' : 'bg-danger-light text-danger'}`}>
              <span>الهامش</span><span>{margin}%</span>
            </div>
          )}

          {/* Advanced toggle */}
          <button type="button" onClick={() => setAdvanced(a => !a)}
            className="w-full flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-xl px-3 py-2 text-sm font-bold text-gray-600 transition-colors">
            <span>⚙️ تعديل متقدم</span>
            <span className="text-xs">{advanced ? '▲ إخفاء' : '▼ إظهار'}</span>
          </button>

          {advanced && (
            <div className="space-y-3 bg-gray-50 rounded-xl p-3">
              {/* Image */}
              <div>
                <label className="label">🖼️ الصورة</label>
                <div className="flex gap-2">
                  <input value={form.image_url || ''} onChange={e => set('image_url', e.target.value)}
                    className="inp flex-1 text-xs" placeholder="https://..." />
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="bg-primary-light text-primary rounded-xl px-3 py-2 text-xs font-bold hover:bg-primary hover:text-white transition-colors disabled:opacity-50 whitespace-nowrap">
                    {uploading ? '⏳' : '📷 رفع'}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={e => handleImageUpload(e.target.files?.[0])} />
                </div>
                {form.image_url && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={form.image_url} alt="" className="w-14 h-14 object-contain rounded-xl border bg-white" />
                    <button type="button" onClick={() => set('image_url', '')} className="text-xs text-red-400 hover:underline">حذف</button>
                  </div>
                )}
              </div>

              {/* Barcode + Size */}
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label">🔢 الباركود</label><input value={form.barcode || ''} onChange={e => set('barcode', e.target.value)} className="inp font-mono text-xs" placeholder="6111234567890" /></div>
                <div><label className="label">📐 الحجم/النوع</label><input value={form.size || ''} onChange={e => set('size', e.target.value)} className="inp" placeholder="200غ" /></div>
              </div>

              {/* Unit + Min stock */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">📦 وحدة القياس</label>
                  <select value={form.unit || ''} onChange={e => set('unit', e.target.value)} className="inp">
                    <option value="">— اختر —</option>
                    {['قطعة','كيلو','لتر','علبة','كرتون','دزينة','متر','كيس'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div><label className="label">⚠️ حد التنبيه</label><input type="number" value={form.min_stock || ''} onChange={e => set('min_stock', e.target.value)} className="inp" min="0" placeholder="مثال: 5" /></div>
              </div>

              {/* Discount */}
              <div>
                <label className="label">🏷️ سعر خاص/تخفيض</label>
                <input type="number" value={form.discount_price || ''} onChange={e => set('discount_price', e.target.value)} className="inp" step="0.01" min="0" placeholder="اتركه فارغاً إن لم يكن هناك تخفيض" />
                {form.discount_price && form.sell_price && parseFloat(form.discount_price) < parseFloat(form.sell_price) && (
                  <p className="text-[11px] text-success font-bold mt-1">
                    تخفيض {Math.round((1 - parseFloat(form.discount_price) / parseFloat(form.sell_price)) * 100)}%
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="label">📝 ملاحظات</label>
                <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} className="inp resize-none" rows={2} placeholder="ملاحظات داخلية..." />
              </div>

              {/* Emoji + toggles */}
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label">الإيموجي</label><input value={form.emoji || '📦'} onChange={e => set('emoji', e.target.value)} className="inp text-center text-2xl" maxLength={4} /></div>
                <div className="space-y-2 pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.is_active ?? true} onChange={e => set('is_active', e.target.checked)} />
                    <span className="text-sm font-bold">نشط</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.is_hidden || false} onChange={e => set('is_hidden', e.target.checked)} />
                    <span className="text-sm font-bold">مخفي من الكتالوج</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          <button type="submit" className="w-full bg-primary hover:bg-primary-dark text-white font-black py-3 rounded-xl transition-colors">
            {product ? '💾 حفظ التعديل' : '➕ إضافة المنتج'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Product Card ──────────────────────────────────────────────
function ProductCard({ p, cur, saving, onStockChange, onEdit, onToggleHide }) {
  const [imgError, setImgError] = useState(false)

  const stockColor =
    p.stock === null || p.stock === undefined ? 'border-gray-100' :
    p.stock <= 0 ? 'border-red-200 bg-red-50/40' :
    p.stock <= 5 ? 'border-amber-200 bg-amber-50/40' : 'border-gray-100'

  return (
    <div className={`bg-white rounded-2xl overflow-hidden flex flex-col border-2 shadow-sm hover:shadow-md transition-all ${stockColor} ${p.is_hidden ? 'opacity-60' : ''}`}>
      <div className="relative bg-gray-50 flex items-center justify-center flex-shrink-0" style={{ height: 100 }}>
        {p.image_url && !imgError
          ? <img src={p.image_url} alt={p.name} className="w-full h-full object-contain p-1" loading="lazy" onError={() => setImgError(true)} />
          : <span className="text-4xl">{p.emoji || '📦'}</span>
        }
        {p.is_hidden && <span className="absolute top-1 right-1 bg-gray-400 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">مخفي</span>}
        {p.stock !== null && p.stock <= 0 && <span className="absolute top-1 left-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">نفد</span>}
      </div>

      <div className="flex flex-col flex-1 p-2 gap-1">
        <p className="text-[11px] font-bold text-gray-800 leading-snug"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: '2.2rem' }}>
          {p.name}
        </p>
        <p className="text-[10px] text-primary font-semibold truncate">{p.categories?.name || p.cat || ''}</p>
        <div className="flex items-center justify-between mt-auto">
          <span className="text-xs font-black text-red-600">{fmt(p.sell_price)}</span>
          <span className="text-[10px] text-muted">{cur}</span>
        </div>

        <input
          type="number" min="0" placeholder="∞"
          defaultValue={p.stock !== null ? p.stock : ''}
          key={`${p.id}-${p.stock}`}
          onBlur={e => onStockChange(p.id, e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onStockChange(p.id, e.target.value)}
          className="inp text-center font-black text-xs py-1 mt-1"
          style={{ height: 28 }}
        />
        {saving && <span className="text-[9px] text-muted text-center animate-pulse">حفظ...</span>}

        <div className="flex gap-1 mt-1">
          <button onClick={onEdit}
            className="flex-1 bg-primary-light text-primary rounded-lg py-1 text-[10px] font-bold hover:bg-primary hover:text-white transition-colors">✏️</button>
          <button onClick={onToggleHide}
            className="flex-1 bg-gray-100 text-gray-500 rounded-lg py-1 text-[10px] font-bold hover:bg-gray-200 transition-colors">
            {p.is_hidden ? '👁' : '🙈'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────
export default function StockPage() {
  const { products, categories, updateStock, updateProduct, createProduct } = useProductsStore()
  const { settings } = useSettingsStore()

  const [q, setQ]                   = useState('')
  const [catFilter, setCat]         = useState('')
  const [showHidden, setShowHidden] = useState(false)
  const [saving, setSaving]         = useState({})
  const [editProd, setEdit]         = useState(null)
  const [showForm, setShow]         = useState(false)

  const cur = settings?.currency || 'درهم'

  const filtered = products.filter(p => {
    if (showHidden ? !p.is_hidden : p.is_hidden) return false
    const qm = !q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.barcode || '').includes(q)
    const cm = !catFilter || (p.categories?.name || p.cat) === catFilter
    return qm && cm
  })

  const handleStockChange = async (id, val) => {
    const newStock = val === '' ? null : parseInt(val, 10)
    setSaving(s => ({ ...s, [id]: true }))
    const error = await updateStock(id, newStock)
    setSaving(s => ({ ...s, [id]: false }))
    if (error) toast.error('فشل حفظ المخزون')
    else toast.success('✔ تم تحديث المخزون', { duration: 600 })
  }

  const handleSave = async (data) => {
    if (editProd && editProd !== 'new') {
      const { error } = await updateProduct(editProd.id, data)
      if (error) toast.error('فشل التعديل'); else toast.success('✔ تم حفظ التعديل')
    } else {
      const { error } = await createProduct(data)
      if (error) toast.error('فشل الإضافة'); else toast.success('✔ تمت الإضافة')
    }
  }

  const hiddenCount = products.filter(p => p.is_hidden).length
  const low   = products.filter(p => p.stock !== null && p.stock <= 5 && p.stock > 0)
  const oos   = products.filter(p => p.stock !== null && p.stock <= 0)

  return (
    <div className="flex flex-col h-full overflow-hidden font-arabic" dir="rtl">
      <div className="bg-white border-b border-gray-100 flex-shrink-0">
        {/* Stats */}
        <div className="grid grid-cols-5 gap-2 px-3 pt-3 pb-2">
          {[
            { label: 'إجمالي', value: products.length, color: 'text-primary' },
            { label: 'متبقي',  value: products.filter(p => p.stock !== null && p.stock > 5).length, color: 'text-success' },
            { label: 'منخفض', value: low.length, color: 'text-accent' },
            { label: 'نفد',   value: oos.length, color: 'text-danger' },
            { label: 'مخفي',  value: hiddenCount, color: 'text-gray-400' },
          ].map(s => (
            <div key={s.label} className="text-center bg-gray-50 rounded-xl py-1.5">
              <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Search + filter + buttons */}
        <div className="flex gap-2 px-3 pb-2">
          <input value={q} onChange={e => setQ(e.target.value)} className="inp flex-1" placeholder="🔍 بحث..." />
          <select value={catFilter} onChange={e => setCat(e.target.value)} className="inp" style={{ width: 130 }}>
            <option value="">— الكل —</option>
            {categories.filter(c => c.name !== 'الكل').map(c => (
              <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>
            ))}
          </select>
          <button onClick={() => setShowHidden(h => !h)}
            className={`relative font-bold px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-colors ${showHidden ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {showHidden ? '👁 ظاهر' : '🙈 مخفي'}
            {!showHidden && hiddenCount > 0 && (
              <span className="absolute -top-1.5 -left-1.5 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {hiddenCount}
              </span>
            )}
          </button>
          <button onClick={() => { setEdit('new'); setShow(true) }}
            className="bg-primary text-white font-bold px-3 py-2 rounded-xl text-sm hover:bg-primary-dark transition-colors">
            ➕
          </button>
        </div>

        {oos.length > 0 && (
          <div className="bg-danger-light border-t border-danger/20 px-3 py-1.5 text-xs text-danger font-bold">
            ❌ نفد: {oos.map(p => p.name).join('، ').slice(0, 100)}{oos.join('').length > 100 ? '...' : ''}
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))' }}>
          {filtered.map(p => (
            <ProductCard
              key={p.id}
              p={p}
              cur={cur}
              saving={saving[p.id]}
              onStockChange={handleStockChange}
              onEdit={() => { setEdit(p); setShow(true) }}
              onToggleHide={async () => {
                const { error } = await updateProduct(p.id, { is_hidden: !p.is_hidden })
                if (!error) toast.success(p.is_hidden ? '👁 ظهر' : '🙈 مخفي', { duration: 600 })
              }}
            />
          ))}
        </div>
      </div>

      {showForm && (
        <ProductModal
          product={editProd === 'new' ? null : editProd}
          categories={categories}
          onSave={handleSave}
          onClose={() => { setShow(false); setEdit(null) }}
        />
      )}
    </div>
  )
}
