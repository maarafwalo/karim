import { useState, useEffect, useMemo } from 'react'
import { supabase, supabaseAdmin } from '../../lib/supabase.js'
import { useSettingsStore } from '../../stores/settingsStore.js'
import { useBagStore } from '../../stores/bagStore.js'
import { fmt, fmtDate, buildWhatsApp } from '../../lib/utils.js'
import toast from 'react-hot-toast'

import ProductsTab from './ProductsTab.jsx'
import CartTab     from './CartTab.jsx'
import OrdersTab   from './OrdersTab.jsx'
import { COLORS }  from './_workspaceHelpers.js'

// ── Customer card (one unified entity) ─────────────────────────
function CustomerCard({ c, cur, expanded, onToggle, onChange, onDelete, onUseForOrder }) {
  const [editing, setEditing]   = useState(false)
  const [draft, setDraft]       = useState({ name: c.name, phone: c.phone || '' })
  const [history, setHistory]   = useState({ invoices: [], payments: [], loaded: false })
  const [payAmt, setPayAmt]     = useState('')
  const [working, setWorking]   = useState(false)

  // Single source of truth for fetching the customer's history. Called both
  // from the expand effect AND right after recordPayment (so the new dفعة
  // shows up without needing to collapse + reopen the card).
  const refreshHistory = async (isCancelled = () => false) => {
    const [inv, pay] = await Promise.all([
      supabase.from('pos_invoices').select('order_number, total, payment_method, payment_label, created_at')
        .eq('customer_id', c.id).order('created_at', { ascending: false }).limit(10),
      (supabaseAdmin || supabase).from('debt_payments').select('amount, created_at')
        .eq('customer_id', c.id).order('created_at', { ascending: false }).limit(10),
    ])
    if (isCancelled()) return
    setHistory({ invoices: inv.data || [], payments: pay.data || [], loaded: true })
  }

  useEffect(() => {
    if (!expanded) return
    let cancelled = false
    refreshHistory(() => cancelled)
    return () => { cancelled = true }
  }, [expanded, c.id])

  const initials = (c.name || '?').trim().slice(0, 2)

  const saveEdit = async () => {
    if (!draft.name.trim()) { toast.error('الاسم مطلوب'); return }
    setWorking(true)
    const { data, error } = await (supabaseAdmin || supabase).from('customers').update({
      name: draft.name.trim(),
      phone: draft.phone.trim(),
    }).eq('id', c.id).select().single()
    setWorking(false)
    if (error) { toast.error('خطأ في الحفظ'); return }
    toast.success('تم الحفظ')
    setEditing(false)
    onChange(data)
  }

  const recordPayment = async () => {
    const raw = parseFloat(payAmt)
    if (!raw || raw <= 0) { toast.error('أدخل مبلغاً صحيحاً'); return }
    const balance = Number(c.balance) || 0
    if (balance <= 0) { toast.error('لا يوجد دين على هذا الزبون'); return }
    const amount = Math.min(raw, balance)
    if (raw > balance) {
      if (!window.confirm(`المبلغ أكبر من الدين (${fmt(balance)} ${cur}). نسجل ${fmt(amount)} فقط؟`)) return
    }
    setWorking(true)
    const { error } = await (supabaseAdmin || supabase).from('debt_payments').insert({ customer_id: c.id, amount })
    if (error) { setWorking(false); toast.error('فشل التسجيل'); return }
    const newBal = Math.max(0, (c.balance || 0) - amount)
    const { data: upd } = await (supabaseAdmin || supabase).from('customers').update({ balance: newBal }).eq('id', c.id).select().single()
    setWorking(false)
    setPayAmt('')
    await refreshHistory()
    toast.success(`✔ تم تسجيل ${fmt(amount)} ${cur}`)
    if (upd) onChange(upd)
  }

  return (
    <div className={`bg-white border-2 rounded-2xl shadow-sm overflow-hidden transition ${
      expanded ? 'border-indigo-300' : c.balance > 0 ? 'border-rose-200' : 'border-slate-200'
    }`}>
      <button onClick={onToggle} className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 transition">
        <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${
          c.balance > 0 ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'
        }`}>{initials}</div>
        <div className="flex-1 text-right min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-black text-sm text-slate-900 truncate">{c.name}</p>
            {c.loyalty_pts > 0 && <span className="text-[9px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-bold">⭐ {c.loyalty_pts}</span>}
          </div>
          {c.phone && <p className="text-[11px] text-slate-500 mt-0.5 ltr">{c.phone}</p>}
        </div>
        <div className="text-left flex-shrink-0">
          {c.balance > 0 ? (
            <div className="font-black text-sm text-rose-600">{fmt(c.balance)} <span className="text-[10px] font-normal text-slate-400">{cur}</span></div>
          ) : (
            <div className="text-[10px] text-emerald-600 font-bold">✓ مسدّد</div>
          )}
          <div className="text-[10px] text-slate-400">{expanded ? '▲' : '▼'}</div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 p-3 space-y-3 bg-slate-50/40">
          <button onClick={onUseForOrder}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-2.5 rounded-xl text-sm shadow-sm transition active:scale-95 flex items-center justify-center gap-2">
            🛒 استخدم لهذا الطلب
          </button>

          <div className="grid grid-cols-3 gap-1.5">
            {c.phone && (
              <a href={buildWhatsApp(c.phone, `مرحباً ${c.name}`)} target="_blank" rel="noreferrer"
                className="flex flex-col items-center gap-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-2 rounded-xl transition">
                <span className="text-base leading-none">📱</span>
                <span className="text-[10px] font-bold">واتساب</span>
              </a>
            )}
            {c.phone && (
              <a href={`tel:${c.phone}`}
                className="flex flex-col items-center gap-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-xl transition">
                <span className="text-base leading-none">📞</span>
                <span className="text-[10px] font-bold">اتصال</span>
              </a>
            )}
            <button onClick={() => setEditing(e => !e)}
              className="flex flex-col items-center gap-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 py-2 rounded-xl transition">
              <span className="text-base leading-none">✏</span>
              <span className="text-[10px] font-bold">{editing ? 'إلغاء' : 'تعديل'}</span>
            </button>
          </div>

          {editing && (
            <div className="bg-white p-3 rounded-xl border border-amber-200 space-y-2">
              <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                className="inp text-sm" placeholder="الاسم *" />
              <input value={draft.phone} onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))}
                className="inp text-sm" placeholder="الهاتف" />
              <button onClick={saveEdit} disabled={working}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-xs font-black py-2 rounded-lg">
                {working ? '...' : '✔ حفظ'}
              </button>
            </div>
          )}

          {c.balance > 0 && (
            <div className="bg-white p-3 rounded-xl border border-rose-200">
              <div className="text-xs text-slate-500 mb-1.5">💵 تسجيل دفعة</div>
              <div className="flex gap-2">
                <input type="number" value={payAmt} onChange={e => setPayAmt(e.target.value)}
                  className="inp text-sm flex-1" placeholder={`المبلغ (${cur})`} />
                <button onClick={recordPayment} disabled={working}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-xs font-black px-3 rounded-lg">✔</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="text-[10px] font-black text-slate-500 px-2 py-1 bg-slate-50 border-b border-slate-100">🧾 الفواتير</div>
              <div className="max-h-32 overflow-y-auto">
                {!history.loaded ? (
                  <div className="text-center text-[10px] text-slate-400 py-2">...</div>
                ) : history.invoices.length === 0 ? (
                  <div className="text-center text-[10px] text-slate-400 py-2">لا شيء</div>
                ) : history.invoices.map((inv, i) => (
                  <div key={i} className="px-2 py-1 border-b border-slate-50 last:border-0">
                    <div className="font-bold text-[10px] text-slate-700 truncate">{inv.order_number}</div>
                    <div className="flex justify-between text-[9px]">
                      <span className="text-slate-400">{fmtDate(inv.created_at)}</span>
                      <span className="font-black text-indigo-600">{fmt(inv.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="text-[10px] font-black text-slate-500 px-2 py-1 bg-slate-50 border-b border-slate-100">💵 السداد</div>
              <div className="max-h-32 overflow-y-auto">
                {!history.loaded ? (
                  <div className="text-center text-[10px] text-slate-400 py-2">...</div>
                ) : history.payments.length === 0 ? (
                  <div className="text-center text-[10px] text-slate-400 py-2">لا شيء</div>
                ) : history.payments.map((p, i) => (
                  <div key={i} className="px-2 py-1 border-b border-slate-50 last:border-0 flex justify-between text-[10px]">
                    <span className="text-slate-400">{fmtDate(p.created_at)}</span>
                    <span className="font-black text-emerald-600">{fmt(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button onClick={onDelete}
            className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold py-2 rounded-xl transition">
            🗑 حذف الزبون
          </button>
        </div>
      )}
    </div>
  )
}

// ── Customers tab (CRM-style cards) ────────────────────────────
function CustomersTab({ cur, onUseInCart }) {
  const setBagCustomer = useBagStore(s => s.setCustomer)
  const bagCount       = useBagStore(s => s.items.reduce((a, b) => a + b.qty, 0))

  const [customers, setCustomers] = useState([])
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(false)
  const [showAdd, setShowAdd]     = useState(false)
  const [form, setForm]           = useState({ name: '', phone: '' })
  const [filter, setFilter]       = useState('all')
  const [sort, setSort]           = useState('name')
  const [expandedId, setExpandedId] = useState(null)

  const load = async () => {
    setLoading(true)
    const { data } = await (supabaseAdmin || supabase).from('customers').select('*').order('name')
    setCustomers(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.name.trim()) { toast.error('الاسم مطلوب'); return }
    const { data, error } = await (supabaseAdmin || supabase).from('customers').insert({
      name: form.name.trim(), phone: form.phone.trim(),
    }).select().single()
    if (error) {
      console.error('Customer insert failed:', error)
      toast.error(`فشل: ${error.message || 'خطأ غير معروف'}`, { duration: 6000 })
      return
    }
    toast.success('تم إضافة الزبون')
    setForm({ name: '', phone: '' })
    setShowAdd(false)
    if (data) {
      setCustomers(prev => [data, ...prev])
      if (bagCount > 0) {
        setBagCustomer({
          id:      data.id,
          name:    data.name    || '',
          phone:   data.phone   || '',
          address: data.address || '',
        })
        toast.success(`✓ ${data.name} محدد للطلب`)
        onUseInCart?.()
      } else {
        setExpandedId(data.id)
      }
    }
  }

  const del = async (id) => {
    if (!confirm('حذف هذا الزبون؟')) return
    const { error } = await (supabaseAdmin || supabase).from('customers').delete().eq('id', id)
    if (error) {
      // FK violation when invoices/orders reference this customer — common.
      toast.error('لا يمكن الحذف: ' + (error.message || 'الزبون مرتبط بفواتير'), { duration: 5000 })
      return
    }
    setCustomers(c => c.filter(x => x.id !== id))
    toast.success('تم الحذف')
  }

  const updateOne = (updated) => {
    setCustomers(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
  }

  const filtered = useMemo(() => {
    let list = customers.filter(c =>
      !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
    )
    if (filter === 'debt') list = list.filter(c => (c.balance || 0) > 0)
    if (sort === 'debt')   list = [...list].sort((a, b) => (b.balance || 0) - (a.balance || 0))
    if (sort === 'recent') list = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    if (sort === 'name')   list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    return list
  }, [customers, search, filter, sort])

  const stats = useMemo(() => {
    const totalDebt = customers.reduce((s, c) => s + (c.balance || 0), 0)
    const debtors   = customers.filter(c => (c.balance || 0) > 0).length
    return { totalDebt, debtors, total: customers.length }
  }, [customers])

  return (
    <div className="flex flex-col h-full" style={{ background: COLORS.pageBg }}>
      <div className="bg-white border-b border-slate-100 px-3 pt-3 pb-2 flex-shrink-0">
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div className="bg-indigo-50 rounded-xl px-2 py-1.5 text-center">
            <div className="text-base font-black text-indigo-700 leading-none">{stats.total}</div>
            <div className="text-[9px] text-indigo-600 font-bold mt-0.5">زبون</div>
          </div>
          <div className="bg-rose-50 rounded-xl px-2 py-1.5 text-center">
            <div className="text-base font-black text-rose-700 leading-none">{stats.debtors}</div>
            <div className="text-[9px] text-rose-600 font-bold mt-0.5">مديون</div>
          </div>
          <div className="bg-emerald-50 rounded-xl px-2 py-1.5 text-center">
            <div className="text-base font-black text-emerald-700 leading-none truncate">{fmt(stats.totalDebt)}</div>
            <div className="text-[9px] text-emerald-600 font-bold mt-0.5">إجمالي الديون</div>
          </div>
        </div>

        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="inp text-sm flex-1" placeholder="🔍 الاسم، الهاتف..." />
          <button onClick={() => setShowAdd(s => !s)}
            className="text-white text-xs font-black px-3 py-2 rounded-xl flex-shrink-0"
            style={{ background: COLORS.brand }}>
            {showAdd ? '✕' : '+ جديد'}
          </button>
        </div>

        <div className="flex items-center gap-1.5 mt-2 overflow-x-auto">
          {[
            { key: 'all',  lbl: `الكل (${stats.total})` },
            { key: 'debt', lbl: `مديون (${stats.debtors})` },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition flex-shrink-0 ${
                filter === f.key ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              style={filter === f.key ? { background: COLORS.brand } : undefined}>
              {f.lbl}
            </button>
          ))}
          <span className="text-[10px] text-slate-300 mx-1">·</span>
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="text-[10px] font-bold bg-slate-100 rounded-lg px-2 py-1 border-0 focus:outline-none">
            <option value="name">أبجدي</option>
            <option value="debt">حسب الدين</option>
            <option value="recent">الأحدث</option>
          </select>
        </div>

        {showAdd && (
          <div className="mt-2 p-3 bg-slate-50 rounded-xl space-y-2">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="inp text-sm" placeholder="الاسم *" />
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="inp text-sm" placeholder="الهاتف" type="tel" />
            <button onClick={save} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black py-2 rounded-lg">✔ حفظ</button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {loading ? (
          <div className="text-center text-slate-400 py-6 text-sm">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-sm">
            <span className="text-4xl mb-2">👤</span>
            <span>لا توجد نتائج</span>
          </div>
        ) : (
          filtered.map(c => (
            <CustomerCard
              key={c.id}
              c={c}
              cur={cur}
              expanded={expandedId === c.id}
              onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
              onChange={updateOne}
              onDelete={() => del(c.id)}
              onUseForOrder={() => {
                setBagCustomer({
                  id:      c.id,
                  name:    c.name    || '',
                  phone:   c.phone   || '',
                  address: c.address || '',
                })
                setExpandedId(null)
                toast.success(`✓ ${c.name} محدد للطلب`)
                // Hand off to the cart so the user can finish the order
                onUseInCart?.()
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ── Main page with tabs ────────────────────────────────────────
export default function WorkspacePage() {
  const { settings } = useSettingsStore()
  const cur = settings?.currency_symbol || settings?.currency || 'درهم'
  const bagCount = useBagStore(s => s.items.reduce((acc, b) => acc + b.qty, 0))

  const VALID_TABS = ['browse', 'cart', 'orders', 'customers']
  const [tab, setTab] = useState(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash && VALID_TABS.includes(hash)) return hash
    return bagCount > 0 ? 'cart' : 'browse'
  })

  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace('#', '')
      if (VALID_TABS.includes(h)) setTab(h)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const TABS = [
    { key: 'browse',    label: 'منتجات',  icon: '📦' },
    { key: 'cart',      label: 'السلة',   icon: '🧺',  badge: bagCount || null },
    { key: 'orders',    label: 'طلبات',   icon: '📋' },
    { key: 'customers', label: 'الزبائن', icon: '👤' },
  ]

  // Setting hash twice in a row would skip the second hashchange event, so
  // we also call setTab directly to keep state and URL in sync.
  const goTab = (key) => { window.location.hash = key; setTab(key) }
  const goCart = () => goTab('cart')
  const goBrowse = () => goTab('browse')

  return (
    <div className="flex flex-col h-full overflow-hidden font-arabic" dir="rtl"
      style={{ background: COLORS.pageBg }}>
      {/* Tab bar — colorful pill design, tablet-friendly tap targets */}
      <div className="flex-shrink-0 px-3 pt-3" style={{ background: COLORS.brand }}>
        <div className="flex gap-2 overflow-x-auto pb-3">
          {TABS.map(t => {
            const active = tab === t.key
            return (
              <button key={t.key} onClick={() => goTab(t.key)}
                className="relative flex items-center gap-2 rounded-2xl whitespace-nowrap transition flex-shrink-0 active:scale-95"
                style={{
                  // 48px min-height for thumb-friendly tablet taps
                  minHeight: 48,
                  padding: '10px 18px',
                  fontSize: 15,
                  fontWeight: 600,
                  background: active ? 'white' : 'rgba(255,255,255,0.12)',
                  color: active ? COLORS.brand : 'white',
                  boxShadow: active ? '0 4px 12px rgba(0,0,0,0.18)' : 'none',
                  border: 'none', cursor: 'pointer',
                }}>
                <span style={{ fontSize: 18 }}>{t.icon}</span><span>{t.label}</span>
                {t.badge != null && (
                  <span className="rounded-full font-bold flex items-center justify-center"
                    style={{
                      background: active ? COLORS.brand : COLORS.warn,
                      color: 'white',
                      minWidth: 22, height: 22, fontSize: 12, padding: '0 6px',
                    }}>
                    {t.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {tab === 'browse'    && <ProductsTab onOpenCart={goCart} />}
        {tab === 'cart'      && <CartTab onBrowse={goBrowse} />}
        {tab === 'orders'    && <OrdersTab onSwitchToCart={goCart} />}
        {tab === 'customers' && <CustomersTab cur={cur} onUseInCart={goCart} />}
      </div>
    </div>
  )
}
