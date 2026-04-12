import { useState } from 'react'
import { useProductsStore } from '../../stores/productsStore.js'
import { useSettingsStore } from '../../stores/settingsStore.js'
import { fmt } from '../../lib/utils.js'
import toast from 'react-hot-toast'

function StockBadge({ stock }) {
  if (stock === null || stock === undefined) return <span className="badge-unlimited">∞ غير محدود</span>
  if (stock <= 0) return <span className="badge-out">❌ نفد</span>
  if (stock <= 5) return <span className="badge-low">⚠️ {stock}</span>
  return <span className="badge-ok">✓ {stock}</span>
}

export default function StockPage() {
  const { products, categories, updateStock, updateProduct } = useProductsStore()
  const { settings } = useSettingsStore()
  const [q, setQ]           = useState('')
  const [catFilter, setCat] = useState('')
  const [saving, setSaving] = useState({})

  const filtered = products.filter(p => {
    if (!p.is_active) return false
    const qm = !q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.barcode||'').includes(q)
    const cm = !catFilter || (p.categories?.name||p.cat) === catFilter
    return qm && cm
  })

  const handleStockChange = async (id, val) => {
    const newStock = val === '' ? null : parseInt(val, 10)
    setSaving(s => ({ ...s, [id]: true }))
    const error = await updateStock(id, newStock)
    setSaving(s => ({ ...s, [id]: false }))
    if (error) toast.error('فشل حفظ المخزون')
    else toast.success('✔ تم تحديث المخزون', { duration: 800 })
  }

  const low   = products.filter(p => p.is_active && p.stock !== null && p.stock <= 5 && p.stock > 0)
  const oos   = products.filter(p => p.is_active && p.stock !== null && p.stock <= 0)
  const total = products.filter(p => p.is_active).length

  return (
    <div className="flex flex-col h-full overflow-hidden font-arabic" dir="rtl">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-2 p-3 bg-white border-b border-gray-100 flex-shrink-0">
        {[
          { label: 'إجمالي', value: total,    color: 'text-primary' },
          { label: 'متبقي',  value: products.filter(p=>p.is_active&&p.stock!==null&&p.stock>5).length, color: 'text-success' },
          { label: 'منخفض', value: low.length, color: 'text-accent' },
          { label: 'نفد',   value: oos.length, color: 'text-danger' },
        ].map(s => (
          <div key={s.label} className="text-center bg-gray-50 rounded-xl p-2">
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Low stock alert */}
      {oos.length > 0 && (
        <div className="bg-danger-light border-r-4 border-danger px-3 py-2 text-xs text-danger font-bold flex-shrink-0">
          ❌ نفد المخزون: {oos.map(p=>p.name).join('، ').slice(0,120)}
          {oos.map(p=>p.name).join('').length > 120 && '...'}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 p-2 bg-white border-b border-gray-100 flex-shrink-0">
        <input value={q} onChange={e => setQ(e.target.value)} className="inp flex-1" placeholder="🔍 بحث..." />
        <select value={catFilter} onChange={e => setCat(e.target.value)}
          className="inp" style={{ width: 140 }}>
          <option value="">— كل الأقسام —</option>
          {categories.filter(c=>c.name!=='الكل').map(c => (
            <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>
          ))}
        </select>
      </div>

      {/* Product stock grid */}
      <div className="flex-1 overflow-y-auto p-3 grid gap-2"
        style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))' }}>
        {filtered.map(p => (
          <div key={p.id} className={`panel flex gap-3 p-3 ${p.stock !== null && p.stock <= 0 ? 'border-danger/30 bg-danger-light/30' : p.stock !== null && p.stock <= 5 ? 'border-accent/30 bg-accent-light/30' : ''}`}>
            {/* Image */}
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
              {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                : <span className="text-xl">{p.emoji||'📦'}</span>}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-800 truncate">{p.name}</p>
              <p className="text-[10px] text-primary font-semibold">{p.categories?.name || p.cat}</p>
              {p.barcode && <p className="text-[10px] text-muted font-mono">{p.barcode}</p>}
              <div className="flex items-center gap-2 mt-1">
                <StockBadge stock={p.stock} />
                <span className="text-xs font-black text-gray-700">{fmt(p.sell_price)} {settings?.currency||'درهم'}</span>
              </div>
            </div>
            {/* Stock input */}
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <input
                type="number" min="0" placeholder="∞"
                defaultValue={p.stock !== null ? p.stock : ''}
                key={`${p.id}-${p.stock}`}
                onBlur={e => handleStockChange(p.id, e.target.value)}
                onKeyDown={e => e.key==='Enter' && handleStockChange(p.id, e.target.value)}
                className="inp text-center font-black" style={{ width: 70 }}
              />
              {saving[p.id] && <span className="text-[10px] text-muted animate-pulse">حفظ...</span>}
              <div className="flex gap-2">
                <button onClick={() => handleStockChange(p.id, 0)}
                  className="text-[10px] text-danger hover:underline">نفد</button>
                <button onClick={async () => {
                  const { error } = await updateProduct(p.id, { is_hidden: !p.is_hidden })
                  if (!error) toast.success(p.is_hidden ? '👁 ظهر' : '🙈 مخفي')
                  else toast.error('فشل')
                }} className="text-[10px] text-muted hover:underline">
                  {p.is_hidden ? 'إظهار' : 'إخفاء'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
