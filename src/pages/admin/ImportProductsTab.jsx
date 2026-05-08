import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import { supabase, supabaseAdmin } from '../../lib/supabase.js'
import { fmt } from '../../lib/utils.js'
import toast from 'react-hot-toast'

// joud-lite (source) Supabase — read-only with the public anon key.
// Using the URL + anon key directly is safe; RLS prevents writes.
const LITE_URL = 'https://suemrjvzhfbxdpsccgoi.supabase.co'
const LITE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1ZW1yanZ6aGZieGRwc2NjZ29pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTk4NTEsImV4cCI6MjA5MjA5NTg1MX0.XEQrprgwsvesg3B9s_j3VYCXFR83pj27qiXlzMOwUAs'

const liteClient = createClient(LITE_URL, LITE_ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export default function ImportProductsTab() {
  const [liteProducts, setLiteProducts] = useState([])
  const [liteCats, setLiteCats]         = useState([])
  const [appCats, setAppCats]           = useState([])
  const [existingBarcodes, setExistingBarcodes] = useState(new Set())
  const [existingNames, setExistingNames]       = useState(new Set())
  const [loading, setLoading]   = useState(false)
  const [search, setSearch]     = useState('')
  const [hideExisting, setHideExisting] = useState(true)
  const [picked, setPicked]     = useState(new Set())  // ids selected for import
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [activeCatId, setActiveCatId]     = useState(null) // null = all categories

  const load = async () => {
    setLoading(true)
    try {
      const [{ data: liteProds }, { data: liteCs }, { data: appProds }, { data: appCs }] = await Promise.all([
        liteClient.from('products').select('id,name,size,sell_price,cost_price,barcode,emoji,image_url,is_active,is_hidden,category_id,categories(name)').order('name'),
        liteClient.from('categories').select('id,name').order('name'),
        (supabaseAdmin || supabase).from('products').select('barcode,name'),
        (supabaseAdmin || supabase).from('categories').select('id,name'),
      ])
      setLiteProducts(liteProds || [])
      setLiteCats(liteCs || [])
      setAppCats(appCs || [])
      const barcodes = new Set((appProds || []).map(p => (p.barcode || '').trim()).filter(Boolean))
      const names    = new Set((appProds || []).map(p => (p.name    || '').trim().toLowerCase()))
      setExistingBarcodes(barcodes)
      setExistingNames(names)
    } catch (e) {
      toast.error('فشل التحميل: ' + e.message)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Lookup helpers
  const isExisting = (p) =>
    (p.barcode && existingBarcodes.has(p.barcode.trim())) ||
    existingNames.has((p.name || '').trim().toLowerCase())

  const filtered = useMemo(() => {
    let list = liteProducts
    if (activeCatId !== null) list = list.filter(p => p.category_id === activeCatId)
    if (hideExisting) list = list.filter(p => !isExisting(p))
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.barcode || '').includes(search) ||
        (p.categories?.name || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [liteProducts, search, hideExisting, activeCatId, existingBarcodes, existingNames])

  // Count fresh (not-already-imported) products per category
  const catCounts = useMemo(() => {
    const m = new Map()
    for (const p of liteProducts) {
      if (hideExisting && isExisting(p)) continue
      m.set(p.category_id, (m.get(p.category_id) || 0) + 1)
    }
    return m
  }, [liteProducts, hideExisting, existingBarcodes, existingNames])

  const toggle = (id) => {
    setPicked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const togglePage = () => {
    const allSelected = filtered.every(p => picked.has(p.id))
    setPicked(prev => {
      const next = new Set(prev)
      if (allSelected) {
        filtered.forEach(p => next.delete(p.id))
      } else {
        filtered.forEach(p => next.add(p.id))
      }
      return next
    })
  }

  const clearPicks = () => setPicked(new Set())

  const runImport = async () => {
    if (picked.size === 0) { toast.error('لم تختر أي منتج'); return }
    if (!supabaseAdmin) {
      toast.error('مفتاح الخدمة غير متوفر — لا يمكن الاستيراد')
      return
    }
    if (!confirm(`استيراد ${picked.size} منتج؟`)) return

    setImporting(true)
    setImportedCount(0)

    // Build a category-name → app-category-id map
    const appCatByName = new Map(appCats.map(c => [c.name.trim().toLowerCase(), c.id]))

    // Find selected products
    const toImport = liteProducts.filter(p => picked.has(p.id))

    // Re-check existing right before insert (in case admin loaded stale data)
    const stillNew = toImport.filter(p => !isExisting(p))
    const skipped = toImport.length - stillNew.length

    // Map joud-lite products → joud-app insert payloads
    const payloads = stillNew.map(p => {
      const catName = p.categories?.name?.trim().toLowerCase()
      const category_id = catName ? (appCatByName.get(catName) || null) : null
      return {
        name:       p.name,
        size:       p.size,
        sell_price: p.sell_price,
        cost_price: p.cost_price,
        barcode:    p.barcode,
        emoji:      p.emoji,
        image_url:  p.image_url,
        is_active:  p.is_active ?? true,
        is_hidden:  p.is_hidden ?? false,
        category_id,
      }
    })

    // Insert in chunks of 100
    let inserted = 0
    let failed = 0
    for (let i = 0; i < payloads.length; i += 100) {
      const chunk = payloads.slice(i, i + 100)
      const { error } = await supabaseAdmin.from('products').insert(chunk)
      if (error) {
        console.error('Chunk insert failed:', error)
        failed += chunk.length
      } else {
        inserted += chunk.length
      }
      setImportedCount(inserted)
    }

    setImporting(false)
    if (failed) {
      toast.error(`تم استيراد ${inserted} ❌ فشل ${failed}`)
    } else {
      toast.success(`✔ تم استيراد ${inserted} منتج`)
    }
    if (skipped) {
      toast(`تخطّينا ${skipped} منتج موجود مسبقاً`, { duration: 5000 })
    }
    setPicked(new Set())
    // Refresh existing list so the imported items disappear (if hideExisting)
    load()
  }

  const allFilteredPicked = filtered.length > 0 && filtered.every(p => picked.has(p.id))

  return (
    <div className="flex flex-col h-full font-arabic" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-black text-base text-slate-900">📦 استيراد منتجات من joud-lite</h2>
          <span className="text-xs text-slate-500">
            <span className="font-black text-indigo-600">{liteProducts.length}</span> منتج في المصدر ·
            <span className="font-black text-emerald-600 mx-1">{filtered.length}</span> معروض ·
            <span className="font-black text-rose-600">{picked.size}</span> محدد
          </span>
        </div>

        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="inp text-sm flex-1" placeholder="🔍 ابحث بالاسم، الباركود، القسم..." />
          <button onClick={() => setHideExisting(h => !h)}
            className={`text-xs font-black px-3 py-2 rounded-xl whitespace-nowrap transition flex-shrink-0 ${
              hideExisting ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>
            {hideExisting ? '✓ إخفاء الموجود' : 'عرض الكل'}
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button onClick={togglePage}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg">
            {allFilteredPicked ? '☐ إلغاء الكل' : '☑ تحديد الكل'}
          </button>
          {picked.size > 0 && (
            <button onClick={clearPicks}
              className="bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold px-3 py-1.5 rounded-lg">
              مسح الاختيار
            </button>
          )}
          <button onClick={load}
            className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-lg">
            ↻ تحديث
          </button>
        </div>

        {/* Category filter chips */}
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1">
          <button onClick={() => setActiveCatId(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap flex-shrink-0 transition ${
              activeCatId === null ? 'bg-primary text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>
            كل الأقسام
          </button>
          {liteCats.map(c => {
            const n = catCounts.get(c.id) || 0
            if (n === 0) return null
            const active = activeCatId === c.id
            return (
              <button key={c.id} onClick={() => setActiveCatId(c.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap flex-shrink-0 transition ${
                  active ? 'bg-primary text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>
                {c.name} <span className={`text-[10px] ${active ? 'text-white/80' : 'text-slate-400'}`}>({n})</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {loading ? (
          <div className="text-center text-slate-400 py-6 text-sm">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-slate-400 py-10 text-sm">
            {hideExisting ? 'كل المنتجات موجودة — اعرض الكل لاستيراد المكررات' : 'لا توجد نتائج'}
          </div>
        ) : (
          filtered.slice(0, 500).map(p => {
            const exists = isExisting(p)
            const sel = picked.has(p.id)
            return (
              <button key={p.id} onClick={() => toggle(p.id)} disabled={exists}
                className={`w-full flex items-center gap-3 p-2 rounded-xl border transition text-right ${
                  exists ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed' :
                  sel ? 'bg-emerald-50 border-emerald-300 shadow-sm' :
                  'bg-white border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/30'
                }`}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition ${
                  sel ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white'
                }`}>
                  {sel && <span className="text-xs leading-none">✔</span>}
                </div>
                <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {p.image_url
                    ? <img src={p.image_url} alt="" className="w-full h-full object-contain p-0.5" loading="lazy" />
                    : <span className="text-xl">{p.emoji || '📦'}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-slate-900 truncate">{p.name}</div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                    {p.size && <span>{p.size}</span>}
                    {p.categories?.name && <span className="bg-indigo-100 text-indigo-700 px-1.5 rounded">{p.categories.name}</span>}
                    {p.barcode && <span className="text-slate-400 ltr">{p.barcode}</span>}
                  </div>
                </div>
                <div className="text-left flex-shrink-0">
                  <div className="font-black text-sm text-rose-600">{fmt(p.sell_price || 0)}</div>
                  {exists && <div className="text-[9px] text-slate-400 font-bold">موجود</div>}
                </div>
              </button>
            )
          })
        )}
        {filtered.length > 500 && (
          <div className="text-center text-xs text-slate-400 py-2">
            عرض أول 500 — استخدم البحث لتضييق النتائج (إجمالي {filtered.length})
          </div>
        )}
      </div>

      {/* Action bar */}
      {picked.size > 0 && (
        <div className="bg-white border-t border-slate-200 px-4 py-3 flex-shrink-0 flex items-center gap-3">
          <div className="flex-1">
            <div className="text-xs text-slate-500">جاهز للاستيراد</div>
            <div className="text-lg font-black text-slate-900">{picked.size} منتج</div>
          </div>
          {importing ? (
            <div className="text-sm font-bold text-emerald-600">
              جاري الاستيراد... {importedCount}/{picked.size}
            </div>
          ) : (
            <button onClick={runImport} disabled={!supabaseAdmin}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white font-black px-5 py-3 rounded-2xl shadow-lg transition active:scale-95">
              ✔ استيراد المحدد
            </button>
          )}
        </div>
      )}

      {!supabaseAdmin && (
        <div className="bg-amber-50 border-t border-amber-200 px-4 py-2 text-amber-800 text-xs text-center flex-shrink-0">
          ⚠ مفتاح الخدمة غير متوفر في هذه البيئة — الاستيراد يعمل فقط على nou7.shop
        </div>
      )}
    </div>
  )
}
