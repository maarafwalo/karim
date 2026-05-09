import { useState, useRef, useEffect, useMemo } from 'react'
import { useProductsStore } from '../../stores/productsStore.js'
import { useCartStore } from '../../stores/cartStore.js'
import { useSettingsStore } from '../../stores/settingsStore.js'
import { useAuthStore } from '../../stores/authStore.js'
import { useShiftStore } from '../../stores/shiftStore.js'
import { useStoreContext } from '../../stores/storeContext.js'
import { supabase, supabaseAdmin } from '../../lib/supabase.js'
import { fmt, fmtDate, generateOrderNumber, buildWhatsApp, STORE_PHONE, getFirstName } from '../../lib/utils.js'
import toast from 'react-hot-toast'

// ── Category Tabs ────────────────────────────────────────────
function CategorySidebar({ active, setActive, categories }) {
  return (
    <div className="flex flex-col overflow-y-auto flex-shrink-0 py-1"
      style={{ width: 72, background: '#1e293b', scrollbarWidth: 'none' }}>
      {categories.map(c => {
        const isActive = active === c.name
        return (
          <button key={c.name} onClick={() => setActive(c.name)}
            className="flex flex-col items-center gap-0.5 px-1 py-2.5 transition-all active:scale-95 select-none flex-shrink-0 relative"
            style={{
              background: isActive ? 'rgba(255,255,255,.12)' : 'transparent',
              borderRight: isActive ? '3px solid #60a5fa' : '3px solid transparent',
            }}>
            <span className="text-xl leading-none">{c.emoji}</span>
            <span className="text-[9px] font-bold text-center leading-tight"
              style={{ color: isActive ? '#93c5fd' : 'rgba(255,255,255,.6)', wordBreak: 'break-word', maxWidth: 60 }}>
              {c.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}

const MAX_GRID = 120 // max products rendered at once to keep DOM fast

// ── Product Grid ─────────────────────────────────────────────
function ProductGrid({ products, onAdd, returnMode }) {
  const items   = useCartStore(s => s.items)
  const cartIds = useMemo(() => new Set(items.filter(i => !i.isReturn).map(i => i.id)), [items])
  const pool    = returnMode ? products : products.filter(p => !cartIds.has(p.id))
  const visible = pool.slice(0, MAX_GRID)
  const hidden  = pool.length - visible.length

  return (
    <div className="overflow-y-auto h-full">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 p-2.5 content-start">
        {visible.map(p => {
          const isOOS = !returnMode && p.stock !== null && p.stock <= 0
          return (
            <div key={p.id}
              onClick={() => !isOOS && onAdd(p)}
              className={`pos-prod-btn relative ${isOOS ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${cartIds.has(p.id) ? 'in-cart' : ''}`}>
              <div className="flex-1 flex items-center justify-center w-full mb-1">
                {p.image_url
                  ? <img src={p.image_url} alt="" className="w-full h-20 object-contain rounded-xl" loading="lazy" />
                  : <span className="text-4xl">{p.emoji || '📦'}</span>
                }
              </div>
              <span className="text-xs font-bold text-gray-700 leading-tight line-clamp-2 text-center w-full">{p.name}</span>
              <span className="mt-1.5 px-3 py-0.5 rounded-full text-xs font-black text-white"
                style={{ background: 'linear-gradient(135deg,#1a56db,#2563eb)' }}>
                {fmt(p.sell_price)}
              </span>
              {isOOS && (
                <span className="absolute inset-0 bg-white/70 rounded-2xl flex items-center justify-center">
                  <span className="bg-red-100 text-red-600 text-[10px] font-black px-2 py-1 rounded-full">نفد المخزون</span>
                </span>
              )}
            </div>
          )
        })}
      </div>
      {hidden > 0 && (
        <p className="text-center text-xs text-gray-400 py-3">
          + {hidden} منتج — ابحث بالاسم أو الباركود لتضييق النتائج
        </p>
      )}
    </div>
  )
}

// ── Numpad ────────────────────────────────────────────────────
function Numpad({ value, onChange, onConfirm }) {
  const press = (key) => {
    if (key === '⌫') { onChange(v => v.length > 1 ? v.slice(0, -1) : '0'); return }
    if (key === 'C')  { onChange('0'); return }
    if (key === '✔')  { onConfirm(); return }
    onChange(v => {
      if (key === '.' && v.includes('.')) return v
      const next = v === '0' && key !== '.' ? key : v + key
      return next
    })
  }
  const keys = ['7','8','9','4','5','6','1','2','3','C','0','.','⌫','✔']
  return (
    <div className="grid grid-cols-4 gap-1 mt-2">
      {keys.map(k => (
        <button key={k} onMouseDown={e => { e.preventDefault(); press(k) }}
          className={`py-2 rounded-lg text-sm font-black transition-all active:scale-95 ${
            k === '✔' ? 'bg-primary text-white col-span-1' :
            k === '⌫' ? 'bg-orange-100 text-orange-600' :
            k === 'C'  ? 'bg-red-100 text-danger' :
            'bg-gray-100 text-gray-800 hover:bg-gray-200'
          }`}>{k}</button>
      ))}
    </div>
  )
}

// ── Cart Item Row ─────────────────────────────────────────────
const ROW_COLORS = [
  { bg: '#eff6ff', border: '#93c5fd', name: '#1d4ed8', accent: '#3b82f6' }, // blue
  { bg: '#f0fdf4', border: '#86efac', name: '#15803d', accent: '#22c55e' }, // green
  { bg: '#fdf4ff', border: '#d8b4fe', name: '#7e22ce', accent: '#a855f7' }, // purple
  { bg: '#fff7ed', border: '#fdba74', name: '#c2410c', accent: '#f97316' }, // orange
  { bg: '#fdf2f8', border: '#f9a8d4', name: '#be185d', accent: '#ec4899' }, // pink
  { bg: '#f0fdfa', border: '#5eead4', name: '#0f766e', accent: '#14b8a6' }, // teal
  { bg: '#fffbeb', border: '#fcd34d', name: '#b45309', accent: '#f59e0b' }, // amber
  { bg: '#f0f9ff', border: '#7dd3fc', name: '#0369a1', accent: '#0ea5e9' }, // sky
]

function CartRow({ item, idx, currency, selected, onSelect }) {
  const { deleteItem, setQty } = useCartStore()
  const inc = (e) => { e.stopPropagation(); setQty(item.id, item.qty + 1) }
  const dec = (e) => { e.stopPropagation(); setQty(item.id, item.qty - 1) }
  const color = item.isReturn ? { bg:'#fff7ed', border:'#fed7aa', name:'#c2410c', accent:'#f97316' }
                              : ROW_COLORS[idx % ROW_COLORS.length]

  return (
    <div onClick={() => onSelect(item.id)}
      className="flex items-center gap-2 px-2 py-2 border-b cursor-pointer select-none transition-all"
      style={{
        background: selected ? color.bg : '#fff',
        borderBottomColor: '#f1f5f9',
        borderRight: `4px solid ${selected ? color.accent : color.border}`,
      }}>

      {/* Thumbnail */}
      <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center"
        style={{ background: color.bg, border: `1.5px solid ${color.border}` }}>
        {item.image_url
          ? <img src={item.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
          : <span className="text-xl leading-none">{item.emoji || '📦'}</span>}
      </div>

      {/* Name + price */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black leading-snug" style={{ color: color.name }}>
          {item.isReturn && <span className="text-orange-500">↩ </span>}
          {item._isScale && <span className="text-teal-600">⚖️ </span>}
          {item.name}
        </p>
        <p className="text-[11px] font-bold mt-0.5" style={{ color: color.accent }}>{fmt(item.sell_price)} {currency}</p>
      </div>

      {/* − N + */}
      <div className="flex items-center flex-shrink-0 rounded-lg overflow-hidden"
        style={{ border: `1.5px solid ${color.border}` }}>
        <button onClick={dec} className="w-7 h-8 flex items-center justify-center text-lg font-black transition-colors active:opacity-60"
          style={{ background: color.bg, color: color.name }}>−</button>
        <span className="w-8 h-8 flex items-center justify-center text-sm font-black bg-white"
          style={{ borderLeft: `1px solid ${color.border}`, borderRight: `1px solid ${color.border}` }}>{item.qty}</span>
        <button onClick={inc} className="w-7 h-8 flex items-center justify-center text-lg font-black transition-colors active:opacity-60"
          style={{ background: color.bg, color: color.name }}>+</button>
      </div>

      {/* Total */}
      <span className="w-14 text-right text-sm font-black flex-shrink-0" style={{ color: color.name }}>
        {fmt(item.sell_price * item.qty)}
      </span>

      {/* Delete */}
      <button onClick={e => { e.stopPropagation(); deleteItem(item.id) }}
        className="w-7 h-7 flex items-center justify-center flex-shrink-0 rounded-lg font-black text-base transition-all active:scale-90"
        style={{ background: '#fee2e2', color: '#ef4444' }}>×</button>
    </div>
  )
}


// ── Payment Modal ──────────────────────────────────────────────
// Real Moroccan Dirham banknote photos (Wikimedia Commons)
const MAD_BANKNOTES = [
  { v: 20,  img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Front_20_Dirham.jpg/240px-Front_20_Dirham.jpg' },
  { v: 50,  img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Front_50_Dirham.jpg/240px-Front_50_Dirham.jpg' },
  { v: 100, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Front_100_Dirham.jpg/240px-Front_100_Dirham.jpg' },
  { v: 200, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Front_200_Dirham.jpg/240px-Front_200_Dirham.jpg' },
]
// Real Moroccan Dirham coin photos (Wikimedia Commons)
const MAD_COINS = [
  { v: 0.5, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/MAD_0.5_dirham.jpg/120px-MAD_0.5_dirham.jpg',  label: '½' },
  { v: 1,   img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/1_MAD_Coin_%28obverse%29.jpg/120px-1_MAD_Coin_%28obverse%29.jpg', label: '1' },
  { v: 2,   img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/2_MAD_Coin_%28obverse%29.jpg/120px-2_MAD_Coin_%28obverse%29.jpg', label: '2' },
  { v: 5,   img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/5_MAD_Coin_%28obverse%29.jpg/120px-5_MAD_Coin_%28obverse%29.jpg', label: '5' },
  { v: 10,  img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/10_MAD_Coin_%28obverse%29.jpg/120px-10_MAD_Coin_%28obverse%29.jpg', label: '10' },
]

function PaymentModal({ open, onClose, totals, currency, onConfirm, onPrint }) {
  const { paymentMethod, setPayMethod, amountPaid, setAmountPaid } = useCartStore()
  if (!open) return null

  const isRefund = totals.isRefund
  const refundAmt = Math.abs(totals.total)

  const PAY_METHODS = [
    { id:'cash',   label:'نقود',        icon:'💵', color:'bg-green-500' },
    { id:'card',   label:'بطاقة بنكية', icon:'💳', color:'bg-blue-500' },
    { id:'credit', label:'كريدي',       icon:'📒', color:'bg-orange-500' },
    { id:'check',  label:'شيك',         icon:'📝', color:'bg-purple-500' },
    { id:'debt',   label:'الدين',       icon:'⏳', color:'bg-yellow-500' },
  ]

  const BILLS  = [
    { v: 10,  img: '/money/10dh.jpg'  },
    { v: 20,  img: '/money/20dh.webp' },
    { v: 50,  img: '/money/50dh.png'  },
    { v: 100, img: '/money/100dh.jpg' },
    { v: 200, img: '/money/200dh.jpg' },
  ]
  const COINS  = [
    { v: 0.5, img: '/money/0.5dh.jpg' },
    { v: 1,   img: '/money/1dh.jpg'   },
    { v: 2,   img: '/money/2dh.jpg'   },
    { v: 5,   img: '/money/5dh.jpg'   },
  ]
  const addDenom = (v) => {
    setPayMethod('cash')
    setAmountPaid(Math.round((amountPaid + v) * 100) / 100)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm animate-slide-up overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="flex justify-between items-center px-5 pt-5 pb-3">
          <h2 className="text-lg font-black">{isRefund ? '↩ تأكيد الإرجاع' : '💳 طريقة الدفع'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold transition-colors">✕</button>
        </div>

        {/* ── Total banner ── */}
        {isRefund ? (
          <div className="mx-5 mb-4 bg-orange-50 border border-orange-200 rounded-2xl p-4 text-center">
            <p className="text-xs text-orange-500 font-bold mb-0.5">مبلغ الاسترداد للزبون</p>
            <p className="text-4xl font-black text-orange-600">{fmt(refundAmt)} <span className="text-xl">{currency}</span></p>
            <p className="text-xs text-orange-400 mt-1">أعطِ هذا المبلغ للزبون</p>
          </div>
        ) : (
          <div className="mx-5 mb-3 rounded-2xl p-3 text-center" style={{ background: 'linear-gradient(135deg,#eef2ff,#dbeafe)' }}>
            <p className="text-xs text-blue-500 font-bold mb-0.5">المبلغ المستحق</p>
            <p className="text-4xl font-black text-blue-800">{fmt(totals.total)} <span className="text-xl font-bold">{currency}</span></p>
          </div>
        )}

        {/* ── Moroccan money picker ── */}
        {!isRefund && (
          <div style={{ background: '#0f172a' }} className="mx-0 px-4 py-3 mb-0">
            {/* Bills */}
            <p className="text-[10px] text-slate-400 font-bold mb-1.5 text-right tracking-wider">أوراق نقدية</p>
            <div className="grid grid-cols-5 gap-2 mb-2">
              {BILLS.map(({ v, img }) => (
                <button key={v} onClick={() => addDenom(v)}
                  className="group flex flex-col rounded-xl overflow-hidden active:scale-90 transition-all duration-150"
                  style={{ boxShadow: '0 4px 12px rgba(0,0,0,.5)' }}>
                  <img src={img} alt={`${v}dh`} draggable={false}
                    className="w-full object-cover group-active:brightness-75 transition-all"
                    style={{ height: 52 }} />
                  <div className="text-center font-black py-1 text-white"
                    style={{ background: 'linear-gradient(135deg,#b45309,#d97706)', fontSize: 13 }}>
                    {v} د
                  </div>
                </button>
              ))}
            </div>

            {/* Coins + exact */}
            <p className="text-[10px] text-slate-400 font-bold mb-1.5 text-right tracking-wider">قطع نقدية</p>
            <div className="grid grid-cols-5 gap-2">
              {COINS.map(({ v, img }) => (
                <button key={v} onClick={() => addDenom(v)}
                  className="group flex flex-col rounded-xl overflow-hidden active:scale-90 transition-all duration-150"
                  style={{ boxShadow: '0 4px 12px rgba(0,0,0,.5)' }}>
                  <img src={img} alt={`${v}dh`} draggable={false}
                    className="w-full object-cover group-active:brightness-75 transition-all"
                    style={{ height: 52 }} />
                  <div className="text-center font-black py-1 text-white"
                    style={{ background: 'linear-gradient(135deg,#1e3a8a,#2563eb)', fontSize: 13 }}>
                    {v} د
                  </div>
                </button>
              ))}
              {/* Exact button */}
              <button onClick={() => { setPayMethod('cash'); setAmountPaid(totals.total) }}
                className="flex flex-col items-center justify-center rounded-xl active:scale-90 transition-all duration-150"
                style={{ minHeight: 72, background: 'linear-gradient(135deg,#064e3b,#059669)', boxShadow: '0 4px 12px rgba(5,150,105,.4)' }}>
                <span className="text-2xl">✔</span>
                <span className="text-[10px] font-black text-green-100 mt-0.5">بالضبط</span>
              </button>
            </div>

            {/* ── Payment methods (inside dark panel) ── */}
            <div className="mt-3 grid grid-cols-6 gap-1.5">
              {PAY_METHODS.map(m => (
                <button key={m.id} onClick={() => setPayMethod(m.id)}
                  className={`${m.color} ${paymentMethod===m.id ? 'ring-2 ring-offset-1 ring-white scale-95' : 'opacity-60'} text-white rounded-lg py-1 px-0.5 text-center transition-all flex flex-col items-center`}>
                  <div className="text-sm leading-none">{m.icon}</div>
                  <div className="text-[8px] font-bold mt-0.5 leading-tight">{m.label}</div>
                </button>
              ))}
              <button onClick={onClose} className="bg-danger opacity-70 text-white rounded-lg py-1 px-0.5 text-center transition-all flex flex-col items-center hover:opacity-100">
                <div className="text-sm leading-none">❌</div>
                <div className="text-[8px] font-bold mt-0.5 leading-tight">إلغاء</div>
              </button>
            </div>
          </div>
        )}

        {/* ── Tracker + confirm (white section) ── */}
        <div className="px-5 pt-4 pb-2">
          {/* Live amount display */}
          {!isRefund && paymentMethod === 'cash' && (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 rounded-xl px-3 py-2 flex items-center justify-between bg-gray-100">
                <span className="text-gray-500 text-xs font-bold">مدفوع</span>
                <span className="text-gray-900 font-black text-base">{fmt(amountPaid || 0)} د</span>
              </div>
              <div className={`flex-1 rounded-xl px-3 py-2 flex items-center justify-between transition-colors ${amountPaid > 0 ? (totals.change >= 0 ? 'bg-green-100' : 'bg-red-100') : 'bg-gray-100'}`}>
                <span className="text-gray-500 text-xs font-bold">{totals.change >= 0 ? 'الباقي' : 'ناقص'}</span>
                <span className={`font-black text-base ${amountPaid > 0 ? (totals.change >= 0 ? 'text-green-700' : 'text-red-600') : 'text-gray-400'}`}>
                  {amountPaid > 0 ? `${fmt(Math.abs(totals.change))} د` : '—'}
                </span>
              </div>
              {amountPaid > 0 && (
                <button onClick={() => setAmountPaid(0)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 transition-colors flex-shrink-0">⌫</button>
              )}
            </div>
          )}

          {/* manual input */}
          {!isRefund && paymentMethod === 'cash' && (
            <div className="mb-3">
              <input type="number" value={amountPaid || ''} onChange={e => setAmountPaid(parseFloat(e.target.value)||0)}
                className="inp text-lg font-black text-center" placeholder="أدخل المبلغ يدوياً..." />
            </div>
          )}

          {/* ── Confirm ── */}
          {(() => {
            const canConfirm = isRefund || paymentMethod !== 'cash' || amountPaid >= totals.total
            const baseLabel  = isRefund ? `↩ استرداد ${fmt(refundAmt)} ${currency}` : `✔ تأكيد الدفع`
            const blockedLabel = `⛔ أدخل ${fmt(totals.total)} ${currency} على الأقل`
            const confirmBg  = isRefund ? 'linear-gradient(135deg,#c2410c,#f97316)' : 'linear-gradient(135deg,#047857,#059669)'
            const printBg    = isRefund ? 'linear-gradient(135deg,#9a3412,#c2410c)'  : 'linear-gradient(135deg,#1e40af,#1a56db)'
            return (
              <div className="flex gap-2 mb-3">
                <button onClick={canConfirm ? onConfirm : undefined} disabled={!canConfirm}
                  className="flex-1 text-white font-black py-3.5 rounded-2xl text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[.98]"
                  style={{ background: canConfirm ? confirmBg : '#9ca3af', boxShadow: canConfirm ? '0 4px 14px rgba(5,150,105,.35)' : 'none' }}>
                  {canConfirm ? baseLabel : blockedLabel}
                </button>
                <button onClick={canConfirm ? onPrint : undefined} disabled={!canConfirm}
                  className="flex-1 text-white font-black py-3.5 rounded-2xl text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[.98] flex items-center justify-center gap-1.5"
                  style={{ background: canConfirm ? printBg : '#9ca3af', boxShadow: canConfirm ? '0 4px 14px rgba(26,86,219,.35)' : 'none' }}>
                  🖨️ طباعة
                </button>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

// ── Print Invoice ──────────────────────────────────────────────
function PrintView({ invoice, settings }) {
  if (!invoice) return null
  const cur = settings?.currency || 'درهم'
  return (
    <div id="print-area" className="hidden print:block font-arabic" dir="rtl" style={{ maxWidth: 302, margin: '0 auto' }}>
      <div className="text-center mb-3">
        <p className="font-black text-lg">{settings?.store_name || 'asswa9'}</p>
        <p className="text-xs">{settings?.phone}</p>
        <p className="text-xs">{fmtDate(invoice.created_at)}</p>
        <p className="text-xs font-bold">فاتورة #{invoice.order_number}</p>
        {invoice.customer_name && <p className="text-xs">الزبون: {invoice.customer_name}</p>}
        <p className="text-xs">الكاشير: {settings?.cashier_name || '—'}</p>
      </div>
      <table className="w-full text-xs mb-3">
        <thead><tr className="border-b border-black">
          <th className="text-right py-1">المنتج</th>
          <th className="text-center">ك</th>
          <th className="text-left">الإجمالي</th>
        </tr></thead>
        <tbody>
          {invoice.items?.map((item, i) => (
            <tr key={i} className="border-b border-dashed border-gray-300">
              <td className="py-0.5 text-right">{item.isReturn && '↩ '}{item.product_name}</td>
              <td className="text-center">{item.quantity}</td>
              <td className="text-left">{fmt(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-black pt-2 space-y-0.5 text-xs">
        {invoice.discount_amt > 0 && <div className="flex justify-between"><span>الخصم</span><span>−{fmt(invoice.discount_amt)}</span></div>}
        {invoice.tva_amt > 0 && <div className="flex justify-between"><span>TVA {invoice.tva_rate}%</span><span>{fmt(invoice.tva_amt)}</span></div>}
        <div className="flex justify-between font-black text-base border-t border-black pt-1 mt-1">
          <span>المجموع</span><span>{fmt(invoice.total)} {cur}</span>
        </div>
        <div className="flex justify-between"><span>طريقة الدفع</span><span>{invoice.payment_label}</span></div>
        {invoice.amount_paid > 0 && <div className="flex justify-between"><span>المدفوع</span><span>{fmt(invoice.amount_paid)}</span></div>}
        {invoice.change_given > 0 && <div className="flex justify-between"><span>الباقي</span><span>{fmt(invoice.change_given)}</span></div>}
      </div>
      {invoice.notes && <p className="text-xs mt-2 border-t pt-1">ملاحظات: {invoice.notes}</p>}
      <p className="text-center text-xs mt-3 opacity-60">شكراً لتسوقكم معنا 🙏</p>
    </div>
  )
}

// ── Scale Modal — Auto PLU Sync ────────────────────────────────
const SCALE_URL = 'http://localhost:3333'

function ScaleModal({ open, onClose, products, onImport }) {
  const [scaleOk, setScaleOk]       = useState(null)
  const [syncing, setSyncing]       = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [progress, setProgress]     = useState(0)
  const [msg, setMsg]               = useState(null)
  const [extracted, setExtracted]   = useState(null)  // products from scale

  useEffect(() => {
    if (!open) return
    setScaleOk(null); setMsg(null); setProgress(0); setExtracted(null)
    fetch(`${SCALE_URL}/ping`, { signal: AbortSignal.timeout(4000) })
      .then(r => r.json()).then(d => setScaleOk(d.ok))
      .catch(() => setScaleOk(false))
  }, [open])

  // Extract products stored on scale → import into POS
  const extractFromScale = async () => {
    setExtracting(true); setMsg(null); setExtracted(null)
    try {
      const r = await fetch(`${SCALE_URL}/extract`, { signal: AbortSignal.timeout(60000) })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error)
      setExtracted(d.products)
      setMsg({ ok: true, text: `✅ تم استخراج ${d.count} منتج من الميزان` })
    } catch (e) {
      setMsg({ ok: false, text: `❌ ${e.message}` })
    }
    setExtracting(false)
  }

  // Auto-assign PLU numbers and sync all products to scale
  const syncAll = async () => {
    setSyncing(true); setMsg(null); setProgress(0)
    const list = products
      .filter(p => p.sell_price > 0)
      .slice(0, 999)
      .map((p, i) => ({
        plu:     i + 1,
        name:    p.name.slice(0, 16),
        price:   p.sell_price,
        barcode: p.barcode || String(i + 1).padStart(5, '0'),
        unit:    'kg',
      }))
    try {
      // Send in small batches so progress bar updates
      const BATCH = 10
      let done = 0
      for (let i = 0; i < list.length; i += BATCH) {
        const batch = list.slice(i, i + BATCH)
        const r = await fetch(`${SCALE_URL}/upload`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batch), signal: AbortSignal.timeout(30000),
        })
        const d = await r.json()
        if (!d.ok) throw new Error(d.error || 'فشل الإرسال')
        done += batch.length
        setProgress(Math.round((done / list.length) * 100))
      }
      setMsg({ ok: true, text: `✅ تم إرسال ${list.length} منتج إلى الميزان` })
    } catch (e) {
      setMsg({ ok: false, text: `❌ ${e.message}` })
    }
    setSyncing(false)
  }

  if (!open) return null

  const list = products.filter(p => p.sell_price > 0).slice(0, 999)

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 font-arabic" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 text-white"
          style={{ background: 'linear-gradient(135deg,#0f172a,#0d9488)' }}>
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚖️</span>
            <div>
              <h2 className="font-black text-base">مزامنة الميزان</h2>
              <p className="text-xs opacity-70">Rongta 192.168.1.200</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              scaleOk === null ? 'bg-yellow-400 text-yellow-900' :
              scaleOk ? 'bg-green-400 text-green-900' : 'bg-red-400 text-red-900'
            }`}>
              {scaleOk === null ? '⏳' : scaleOk ? '✅ متصل' : '❌ غير متصل'}
            </span>
            <button onClick={onClose} className="text-white/70 hover:text-white text-xl">✕</button>
          </div>
        </div>

        <div className="p-5">
          {/* Product count */}
          <div className="bg-teal-50 rounded-xl p-4 mb-4 text-center">
            <p className="text-4xl font-black text-teal-600">{list.length}</p>
            <p className="text-sm font-bold text-teal-700">منتج جاهز للإرسال</p>
            <p className="text-xs text-teal-500 mt-1">سيُرقَّم كل منتج تلقائياً: PLU 1، PLU 2، PLU 3...</p>
          </div>

          {/* Progress bar */}
          {syncing && (
            <div className="mb-4">
              <div className="flex justify-between text-xs font-bold text-muted mb-1">
                <span>جارٍ الإرسال...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-teal-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Sync button */}
          <button onClick={syncAll} disabled={syncing || scaleOk === false || list.length === 0}
            className="w-full py-4 rounded-2xl text-white font-black text-base transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
            style={{ background: 'linear-gradient(135deg,#0d9488,#14b8a6)', boxShadow: '0 4px 14px rgba(13,148,136,.4)' }}>
            {syncing
              ? <><span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> جارٍ المزامنة...</>
              : '📤 إرسال كل المنتجات إلى الميزان'}
          </button>

          {msg && (
            <div className={`mt-3 p-3 rounded-xl text-sm font-bold text-center ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {msg.text}
            </div>
          )}

          {scaleOk === false && (
            <div className="mt-3 p-3 bg-orange-50 rounded-xl text-xs text-orange-700 text-center">
              <p className="font-black mb-1">⚠️ شغّل خادم الميزان أولاً:</p>
              <code className="font-mono bg-orange-100 px-2 py-0.5 rounded">node scale-server.cjs</code>
            </div>
          )}

          {/* PLU preview */}
          {list.length > 0 && !syncing && (
            <div className="mt-4">
              <p className="text-xs font-black text-muted mb-2">معاينة أول 5 منتجات:</p>
              <div className="space-y-1">
                {list.slice(0, 5).map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2 text-xs">
                    <span className="w-6 h-6 bg-teal-600 text-white rounded-md flex items-center justify-center font-black text-[10px]">{i+1}</span>
                    <span className="font-bold flex-1 truncate">{p.name}</span>
                    <span className="text-muted">{p.sell_price} /كغ</span>
                  </div>
                ))}
                {list.length > 5 && <p className="text-xs text-muted text-center">... و {list.length - 5} منتج آخر</p>}
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs font-black text-muted mb-3 text-center">— أو —</p>

            {/* Extract button */}
            <button onClick={extractFromScale} disabled={extracting || syncing || scaleOk === false}
              className="w-full py-3 rounded-2xl font-black text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 border-2 border-teal-500 text-teal-700 bg-white hover:bg-teal-50">
              {extracting
                ? <><span className="w-4 h-4 border-2 border-teal-400/40 border-t-teal-500 rounded-full animate-spin" /> جارٍ الاستخراج...</>
                : '📥 استخراج المنتجات من الميزان'}
            </button>

            {/* Extracted products list */}
            {extracted && extracted.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-black text-gray-700 mb-2">منتجات الميزان ({extracted.length}):</p>
                <div className="space-y-1 max-h-40 overflow-y-auto mb-3">
                  {extracted.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 p-1.5 bg-teal-50 rounded-lg text-xs">
                      <span className="w-5 h-5 bg-teal-600 text-white rounded flex items-center justify-center font-black text-[9px] flex-shrink-0">{p.plu}</span>
                      <span className="font-bold flex-1 truncate">{p.name}</span>
                      <span className="text-teal-700 font-bold">{p.price}/كغ</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => { onImport(extracted); onClose() }}
                  className="w-full py-2.5 rounded-xl text-white font-black text-sm"
                  style={{ background: 'linear-gradient(135deg,#059669,#10b981)' }}>
                  ✅ إضافة هذه المنتجات إلى الكاشير
                </button>
              </div>
            )}
            {extracted && extracted.length === 0 && (
              <p className="mt-2 text-xs text-center text-muted">لا توجد منتجات مبرمجة في الميزان</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Weight Modal — Live scale reading ─────────────────────────
function WeightModal({ open, onClose, products, cur, onAdd }) {
  const [weight, setWeight]   = useState(null)   // kg, null = not ready
  const [stable, setStable]   = useState(false)  // hardware stable flag
  const [query, setQuery]     = useState('')      // PLU number or Arabic name
  const [matched, setMatched] = useState(null)   // matched product
  const pollRef               = useRef(null)
  const inputRef              = useRef(null)
  const savingRef             = useRef(false)

  // Poll /weight every 500ms while open
  useEffect(() => {
    if (!open) { setWeight(null); setStable(false); return }
    setQuery('')
    setMatched(null)
    setTimeout(() => inputRef.current?.focus(), 100)

    const poll = () => {
      fetch(`${SCALE_URL}/weight`, { signal: AbortSignal.timeout(900) })
        .then(r => r.json())
        .then(d => {
          if (d.ok && typeof d.weightKg === 'number') {
            setWeight(d.weightKg)
            setStable(!!d.stable)
          } else {
            setWeight(null); setStable(false)
          }
        })
        .catch(() => { setWeight(null); setStable(false) })
    }
    poll()
    pollRef.current = setInterval(poll, 500)
    return () => clearInterval(pollRef.current)
  }, [open])

  // Match product when query changes
  useEffect(() => {
    if (!query.trim()) { setMatched(null); return }
    const q = query.trim()
    // Try PLU first (numeric → match barcode)
    if (/^\d+$/.test(q)) {
      const byPlu = products.find(p => p.barcode && String(p.barcode).replace(/^0+/, '') === q)
      if (byPlu) { setMatched(byPlu); return }
    }
    // Fallback: Arabic name contains
    const byName = products.find(p => p.name.includes(q))
    setMatched(byName || null)
  }, [query, products])

  if (!open) return null

  const kg    = weight ?? 0
  const price = matched?.sell_price ?? 0
  const total = +(kg * price).toFixed(2)
  const ready = matched && kg > 0.010 && stable

  const confirm = () => {
    if (!ready) return
    onAdd(matched, total)
    // Reset for next item
    setQuery('')
    setMatched(null)
    inputRef.current?.focus()
  }

  const weightColor = kg < 0.010 ? '#94a3b8' : stable ? '#10b981' : '#f59e0b'

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 font-arabic" dir="rtl"
      onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between text-white"
          style={{ background: 'linear-gradient(135deg,#0f172a,#0d9488)' }}>
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚖️</span>
            <div>
              <h2 className="font-black text-base">وزن مباشر</h2>
              <p className="text-xs opacity-60">Rongta 192.168.1.200</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl font-black">✕</button>
        </div>

        <div className="p-5 space-y-4">

          {/* Live weight display */}
          <div className="rounded-2xl p-5 text-center" style={{ background: '#f0fdf4', border: `2px solid ${weightColor}40` }}>
            <div className="text-6xl font-black tabular-nums" style={{ color: weightColor, letterSpacing: '-2px' }}>
              {weight === null ? '---' : kg.toFixed(3)}
            </div>
            <div className="text-sm font-bold mt-1" style={{ color: weightColor }}>
              {weight === null ? 'لا يوجد اتصال' : kg < 0.010 ? 'ضع المنتج على الميزان' : stable ? '✅ وزن مستقر' : '⏳ جارٍ الاستقرار...'}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">كيلوغرام</div>
          </div>

          {/* Product search */}
          <div>
            <label className="text-xs font-black text-gray-500 block mb-1.5">🔢 رقم PLU أو اسم المنتج</label>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirm()}
              className="w-full rounded-xl border-2 px-4 py-3 text-base font-bold outline-none transition-all"
              style={{
                borderColor: matched ? '#10b981' : query ? '#f59e0b' : '#e2e8f0',
                background: matched ? '#f0fdf4' : '#f8fafc',
              }}
              placeholder="مثال: 8 أو مقرونية..."
              autoComplete="off"
            />
          </div>

          {/* Matched product card */}
          {matched ? (
            <div className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: 'linear-gradient(135deg,#ecfdf5,#f0fdf4)', border: '1.5px solid #10b98140' }}>
              <span className="text-3xl">{matched.emoji || '📦'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-black text-gray-800 truncate">{matched.name}</p>
                <p className="text-sm text-teal-600 font-bold">{price} {cur}/كغ</p>
              </div>
              {kg > 0.010 && (
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-400">{kg.toFixed(3)} كغ</p>
                  <p className="font-black text-lg text-teal-700">{total} {cur}</p>
                </div>
              )}
            </div>
          ) : query.trim() ? (
            <div className="rounded-xl p-3 text-center text-sm text-orange-600 font-bold bg-orange-50">
              ⚠️ لم يُعثر على منتج — تحقق من رقم PLU أو الاسم
            </div>
          ) : null}

          {/* Confirm button */}
          <button
            onClick={confirm}
            disabled={!ready}
            className="w-full py-4 rounded-2xl text-white font-black text-lg transition-all active:scale-95 disabled:opacity-40"
            style={{ background: ready ? 'linear-gradient(135deg,#059669,#10b981)' : '#94a3b8', boxShadow: ready ? '0 4px 14px rgba(16,185,129,.4)' : 'none' }}>
            {ready ? `✔ إضافة — ${total} ${cur}` : 'أدخل المنتج والوزن'}
          </button>

          <p className="text-center text-xs text-gray-400">اضغط Enter أو زر الإضافة لتسجيل الوزن في السلة</p>
        </div>
      </div>
    </div>
  )
}

// ── Quick Add Product Modal ────────────────────────────────────
const ARABIC_ROWS = [
  ['ض','ص','ث','ق','ف','غ','ع','ه','خ','ح','ج','د'],
  ['ش','س','ي','ب','ل','ا','ت','ن','م','ك','ط'],
  ['ئ','ء','ؤ','ر','لا','ى','ة','و','ز','ظ'],
]
const NUMPAD_KEYS = [['7','8','9'],['4','5','6'],['1','2','3'],['.',  '0','⌫']]

function QuickAddModal({ open, barcode: initBarcode, onClose, onAdded, currency }) {
  const [form, setForm]           = useState({ name: '', barcode: initBarcode || '', sell_price: '', cost_price: '', stock: '' })
  const [saving, setSaving]       = useState(false)
  const [activeField, setActive]  = useState(null) // 'name' | 'sell_price' | 'cost_price' | 'barcode' | 'stock'
  const kbOuterRef                = useRef(null)
  const kbInnerRef                = useRef(null)

  useEffect(() => {
    if (open) {
      setForm(f => ({ ...f, barcode: initBarcode || '', name: '', sell_price: '', cost_price: '', stock: '' }))
      setActive('name')
    }
  }, [open, initBarcode])


  if (!open) return null

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async (addToCart) => {
    if (!form.name.trim() || !form.sell_price) { toast.error('الاسم والسعر مطلوبان'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        barcode: form.barcode.trim() || null,
        sell_price: parseFloat(form.sell_price) || 0,
        cost_price: parseFloat(form.cost_price) || 0,
        stock: form.stock !== '' ? parseFloat(form.stock) : null,
        is_active: true,
      }
      const { data, error } = await (supabaseAdmin || supabase).from('products').insert(payload).select().single()
      if (error) throw error
      toast.success(`✅ تمت إضافة ${data.name}`)
      onAdded(data, addToCart)
      onClose()
    } catch (e) {
      toast.error('خطأ: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // keyboard handlers — onMouseDown so focus stays on the logical "field"
  const pressArabic = (ch) => {
    if (!activeField) return
    const cur = String(form[activeField] || '')
    if (ch === '⌫') { set(activeField, cur.slice(0, -1)); return }
    if (ch === '␣') { set(activeField, cur + ' '); return }
    set(activeField, cur + ch)
  }
  const pressNum = (ch) => {
    if (!activeField) return
    const cur = String(form[activeField] || '')
    if (ch === '⌫') { set(activeField, cur.slice(0, -1)); return }
    if (ch === '.' && cur.includes('.')) return
    set(activeField, cur + ch)
  }

  const isNumField = activeField && activeField !== 'name'
  const fieldLabel = { name: 'اسم المنتج', sell_price: 'سعر البيع', cost_price: 'سعر التكلفة', barcode: 'الباركود', stock: 'المخزون' }

  const fieldStyle = (f) => ({
    background: activeField === f ? '#eef2ff' : '#f8fafc',
    border: `2px solid ${activeField === f ? '#6366f1' : '#e2e8f0'}`,
    borderRadius: 10,
    padding: '8px 10px',
    fontSize: 14,
    fontWeight: 700,
    width: '100%',
    outline: 'none',
    cursor: 'pointer',
    color: '#1e293b',
    boxSizing: 'border-box',
  })

  const FIELDS = [
    { k: 'name',       label: 'الاسم',     icon: '✏️' },
    { k: 'sell_price', label: 'سعر البيع',  icon: '💰' },
    { k: 'cost_price', label: 'التكلفة',    icon: '🏷️' },
    { k: 'barcode',    label: 'الباركود',   icon: '📷' },
    { k: 'stock',      label: 'المخزون',    icon: '📦' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="bg-white w-full h-full shadow-2xl flex flex-col overflow-hidden"
        style={{ borderRadius: 20, maxWidth: 900, maxHeight: '96vh' }}
        onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="px-6 py-3 flex items-center justify-between flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
          <h2 className="text-white font-black text-lg">➕ إضافة منتج جديد</h2>
          {form.barcode && <span className="text-indigo-200 text-sm">باركود: {form.barcode}</span>}
          <button onClick={onClose} className="text-white/70 hover:text-white font-black text-2xl leading-none">✕</button>
        </div>

        {/* ── Active field display ── */}
        <div className="px-4 pt-3 pb-2 flex-shrink-0">
          <div className="text-xs font-bold text-indigo-500 mb-1">{activeField ? fieldLabel[activeField] : ''}</div>
          <div className="rounded-xl px-4 py-3 text-2xl font-black text-slate-800 flex items-center min-h-[3rem]"
            style={{ background: '#eef2ff', border: '2px solid #6366f1' }}>
            <span className="flex-1 truncate">{activeField ? (form[activeField] || '') : ''}</span>
            <span className="animate-pulse text-indigo-400">|</span>
          </div>
        </div>

        {/* ── Field tabs ── */}
        <div className="px-4 pb-2 flex gap-2 flex-wrap flex-shrink-0">
          {FIELDS.map(({ k, label, icon }) => (
            <button key={k} onMouseDown={e => { e.preventDefault(); setActive(k) }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all"
              style={{ background: activeField === k ? '#4f46e5' : '#f1f5f9', color: activeField === k ? '#fff' : '#475569' }}>
              <span>{icon}</span><span>{label}</span>
              {form[k] ? <span className="opacity-60 max-w-[70px] truncate ml-1">{form[k]}</span> : null}
            </button>
          ))}
        </div>

        {/* ── Keyboards side by side ── */}
        <div className="flex flex-1 gap-3 px-4 pb-3 overflow-hidden min-h-0">

          {/* Arabic keyboard — left, fills available space */}
          <div className="flex-1 flex flex-col justify-between" ref={kbOuterRef}>
            <div ref={kbInnerRef} className="flex flex-col gap-2">
              {ARABIC_ROWS.map((row, ri) => (
                <div key={ri} className="flex gap-1.5">
                  {row.map(ch => (
                    <button key={ch} onMouseDown={e => { e.preventDefault(); pressArabic(ch) }}
                      className="flex-1 rounded-xl text-white font-bold text-lg transition-all active:scale-90"
                      style={{ background: '#334155', minHeight: 52 }}>
                      {ch}
                    </button>
                  ))}
                </div>
              ))}
              {/* Bottom row: space, backspace, clear */}
              <div className="flex gap-1.5">
                <button onMouseDown={e => { e.preventDefault(); pressArabic('␣') }}
                  className="flex-1 rounded-xl text-white font-bold text-sm transition-all active:scale-95"
                  style={{ background: '#475569', minHeight: 52 }}>مسافة</button>
                <button onMouseDown={e => { e.preventDefault(); pressArabic('⌫') }}
                  className="flex-1 rounded-xl text-white font-bold text-xl transition-all active:scale-95"
                  style={{ background: '#dc2626', minHeight: 52 }}>⌫</button>
                <button onMouseDown={e => { e.preventDefault(); set(activeField, '') }}
                  className="flex-1 rounded-xl text-white font-bold text-sm transition-all active:scale-95"
                  style={{ background: '#64748b', minHeight: 52 }}>مسح</button>
              </div>
            </div>
          </div>

          {/* Numpad — right, fixed width */}
          <div className="flex flex-col gap-2" style={{ width: 200 }}>
            {NUMPAD_KEYS.map((row, ri) => (
              <div key={ri} className="flex gap-1.5">
                {row.map(ch => (
                  <button key={ch} onMouseDown={e => { e.preventDefault(); pressNum(ch) }}
                    className="flex-1 rounded-xl font-black text-xl transition-all active:scale-90"
                    style={{ background: ch === '⌫' ? '#dc2626' : '#1e293b', color: '#fff', minHeight: 58 }}>
                    {ch}
                  </button>
                ))}
              </div>
            ))}

            {/* Save buttons below numpad */}
            <button onClick={() => handleSave(true)} disabled={saving}
              className="w-full rounded-xl text-white font-black text-sm transition-all active:scale-95 disabled:opacity-60 mt-1"
              style={{ background: 'linear-gradient(135deg,#059669,#10b981)', minHeight: 52, boxShadow: '0 4px 12px rgba(5,150,105,.4)' }}>
              {saving ? '...' : '✔ حفظ وإضافة للسلة'}
            </button>
            <button onClick={() => handleSave(false)} disabled={saving}
              className="w-full rounded-xl font-black text-sm bg-gray-100 text-gray-600 transition-all active:scale-95 disabled:opacity-60"
              style={{ minHeight: 48 }}>
              حفظ فقط
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── MAIN POS PAGE ─────────────────────────────────────────────
export default function POSPage() {
  // Fine-grained selectors — each re-renders only when its own slice changes
  const categories      = useProductsStore(s => s.categories)
  const activeCat       = useProductsStore(s => s.activeCat)
  const searchQ         = useProductsStore(s => s.searchQ)
  const allProducts     = useProductsStore(s => s.products)
  const setActiveCat    = useProductsStore(s => s.setActiveCat)
  const setSearchQ      = useProductsStore(s => s.setSearchQ)
  const filteredProducts = useProductsStore(s => s.filteredProducts)
  const cart = useCartStore()
  const { settings } = useSettingsStore()
  const { profile, signOut } = useAuthStore()

  const [showPayment, setShowPayment]   = useState(false)
  const [showNotes, setShowNotes]       = useState(false)
  const [lastInvoice, setLastInvoice]   = useState(null)
  const [showPostPay, setShowPostPay]   = useState(false)
  const [pendingPrint, setPendingPrint] = useState(false)
  const [showLookup, setShowLookup]     = useState(false)
  const [lookupTab, setLookupTab]       = useState('today') // 'today' | 'invoices' | 'customer'
  const [cartOpen, setCartOpen]           = useState(true)
  const [confirmClear, setConfirmClear]   = useState(false)
  const [invoices, setInvoices]         = useState([])
  const [customers, setCustomers]       = useState([])
  const [todayStats, setTodayStats]     = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [recentInvs, setRecentInvs]     = useState([])
  const isManager = profile?.role === 'admin' || profile?.role === 'manager'
  const [custSearch, setCustSearch]     = useState('')
  const [newCust, setNewCust]           = useState({ name:'', phone:'' })
  const [discount, setDiscount]         = useState({ type: 'fixed', val: 0 })
  const [selectedItem, setSelectedItem]   = useState(null)
  const [showHeldCarts, setShowHeldCarts] = useState(false)
  const [showScale, setShowScale]         = useState(false)
  const [showWeight, setShowWeight]       = useState(false)
  const [quickAdd, setQuickAdd]           = useState({ open: false, barcode: '' })
  const [showCatSidebar, setShowCatSidebar] = useState(false)
  const [showArabicKbd, setShowArabicKbd]   = useState(false)
  const [localInput, setLocalInput]         = useState('')  // what the search box shows (not drives filter)
  const kbdRef = useRef(null)

  const db      = supabaseAdmin || supabase   // always use admin for writes
  const cur     = settings?.currency || 'درهم'
  const tvaRate = settings?.tva_rate || 0
  const totals  = cart.getTotals(tvaRate)

  const addItem = (product, { ignoreStock = false } = {}) => {
    const status = cart.addItem(product, { ignoreStock })
    setShowArabicKbd(false)
    if (status === 'outOfStock') toast.error(`نفذ المخزون — ${product.name}`, { duration: 1500 })
    else if (status === 'maxStock') toast.error(`وصلت الحد الأقصى — ${product.name}`, { duration: 1500 })
    else if (status === 'returnMode') toast.error('وضع الإرجاع مفعّل، أوقفه أولاً', { duration: 1500 })
    else toast.success(`${product.name} ✔`, { duration: 800, style: { fontSize: '0.8rem' } })
  }

  const applyDiscount = () => {
    cart.setDiscount(discount.type, discount.val)
  }


  // Trigger print after React renders the PrintView
  useEffect(() => {
    if (pendingPrint && lastInvoice) {
      const t = setTimeout(() => { window.print(); setPendingPrint(false) }, 120)
      return () => clearTimeout(t)
    }
  }, [pendingPrint, lastInvoice])

  const refreshLiveExpected = async (shiftId, openingCash) => {
    if (!shiftId) return
    const { data } = await db.from('pos_invoices')
      .select('total,payment_method').eq('shift_id', shiftId).eq('payment_method', 'cash')
      .neq('status', 'cancelled')
    const cashSales = (data||[]).reduce((s,i) => s + (i.total||0), 0)
    const { data: exps } = await db.from('expenses').select('amount').eq('shift_id', shiftId)
    const expTotal = (exps||[]).reduce((s,e) => s + (e.amount||0), 0)
    setLiveExpected((openingCash||0) + cashSales - expTotal)
  }

  const handleConfirm = async (shouldPrint = false) => {
    if (!cart.items.length) { toast.error('السلة فارغة!'); return }
    // Bullet-proof double-tap guard. setShowPayment(false) doesn't take effect
    // synchronously — a fast second tap can fire two pos_invoices inserts.
    if (savingRef.current) return
    savingRef.current = true
    setShowPayment(false)

    const PAY_LABELS = { cash:'نقود', card:'بطاقة', credit:'كريدي', check:'شيك', debt:'دين' }
    const orderNum = generateOrderNumber('INV')
    const inv = {
      order_number:    orderNum,
      cashier_id:      profile?.id,
      customer_id:     cart.customer?.id || null,
      customer_name:   cart.customer?.name || null,
      status:          totals.isRefund ? 'returned' : 'confirmed',
      payment_method:  cart.paymentMethod,
      payment_label:   PAY_LABELS[cart.paymentMethod],
      subtotal:        totals.subtotal,
      discount_type:   cart.discountType,
      discount_value:  cart.discountValue,
      discount_amt:    totals.discount,
      tva_rate:        tvaRate,
      tva_amt:         totals.tva,
      total:           totals.total,  // negative for pure refunds
      amount_paid:     totals.isRefund ? 0 : (cart.amountPaid || totals.total),
      change_given:    totals.isRefund ? Math.abs(totals.total) : Math.max(totals.change, 0),
      notes:           cart.notes,
      created_at:      new Date().toISOString(),
      items: cart.items.map(i => ({
        product_id:   i.id,
        product_name: i.name,
        unit_price:   i.sell_price,
        cost_price:   i.cost_price || 0,
        quantity:     i.qty,
        total:        i.sell_price * i.qty,
        is_return:    i.isReturn || false,
      })),
    }

    // ── Save invoice to Supabase ──────────────────────────────────
    let savedId = null
    try {
      const { data: saved, error } = await db.from('pos_invoices').insert({
        order_number:   inv.order_number,
        cashier_id:     null,
        customer_id:    inv.customer_id,
        status:         inv.status,
        payment_method: inv.payment_method,
        subtotal:       inv.subtotal,
        discount_type:  inv.discount_type,
        discount_value: inv.discount_value,
        discount_amt:   inv.discount_amt,
        tva_rate:       inv.tva_rate,
        tva_amt:        inv.tva_amt,
        total:          inv.total,
        amount_paid:    inv.amount_paid,
        change_given:   inv.change_given,
        notes:          inv.notes,
        shift_id:       currentShift?.id || null,
        store_id:       activeStore?.id || null,
      }).select('id').single()

      if (error) {
        console.error('[POS] invoice insert failed:', error)
        toast.error(`خطأ في حفظ الفاتورة: ${error.message} (${error.code || error.details || ''})`, { duration: 8000 })
        savingRef.current = false  // Allow retry
        return  // Keep cart intact so cashier can retry
      }

      savedId = saved.id
      inv.id  = savedId

      // Insert line items (non-fatal — log error but continue)
      const { error: itemsErr } = await db.from('pos_invoice_items').insert(
        inv.items.map(item => ({ invoice_id: savedId, ...item }))
      )
      if (itemsErr) {
        console.error('[POS] items insert failed:', itemsErr)
        toast.error('تحذير: تفاصيل الفاتورة لم تُحفظ — ' + itemsErr.message, { duration: 4000 })
      }
    } catch (e) {
      // Network error during invoice insert — nothing was saved
      console.error('[POS] invoice save error:', e)
      toast.error('لا يوجد اتصال — الفاتورة لم تُحفظ. حاول مجدداً.')
      savingRef.current = false  // Allow retry
      return  // Keep cart intact so cashier can retry
    }

    // ── Post-save operations (non-fatal) ─────────────────────────
    // Deduct stock
    await Promise.all(cart.items.map(async i => {
      if (i.isReturn || i._isScale || i.stock == null) return
      try {
        const { data: prod } = await db.from('products').select('stock').eq('id', i.id).single()
        if (prod) await db.from('products').update({ stock: Math.max(0, (prod.stock || 0) - i.qty) }).eq('id', i.id)
      } catch (_) { /* offline — stock will be corrected on next sync */ }
    }))

    // Debt tracking. Clamp at 0 so a refund on credit/debt against a
    // zero-balance customer doesn't push them negative.
    if (cart.customer?.id && ['credit','debt'].includes(cart.paymentMethod)) {
      try {
        const { data: cust } = await db.from('customers').select('balance').eq('id', cart.customer.id).single()
        const newBal = Math.max(0, (cust?.balance || 0) + totals.total)
        await db.from('customers').update({ balance: newBal }).eq('id', cart.customer.id)
      } catch (_) {}
    }

    // Loyalty points
    if (cart.customer?.id && totals.total > 0) {
      try {
        const pts = Math.floor(totals.total)
        const { data: cust } = await db.from('customers').select('loyalty_pts').eq('id', cart.customer.id).single()
        await db.from('customers').update({ loyalty_pts: (cust?.loyalty_pts||0) + pts }).eq('id', cart.customer.id)
        await db.from('loyalty_transactions').insert({ customer_id: cart.customer.id, invoice_id: savedId, type:'earn', points: pts })
      } catch (_) {}
    }

    // If this invoice originated from a vendor catalog_order (we stamp the
    // order_number into cart.notes as 'من طلب: ORD-…'), flip the source order
    // to 'invoiced' now — only after the POS save succeeded.
    const linkedOrderMatch = (cart.notes || '').match(/من طلب:\s*(ORD-\S+)/)
    if (linkedOrderMatch) {
      try {
        await db.from('catalog_orders')
          .update({ status: 'invoiced' })
          .eq('order_number', linkedOrderMatch[1])
      } catch (_) { /* admin can flip manually if this fails */ }
    }

    // WhatsApp receipt
    const phone = cart.customer?.phone || ''
    if (phone) {
      try {
        const msg = `🧾 فاتورة #${inv.order_number}\n${inv.items.map(i=>`• ${i.product_name} ×${i.quantity||i.qty} = ${fmt(i.total)} ${cur}`).join('\n')}\n━━━━━━━━━\nالمجموع: ${fmt(inv.total)} ${cur}\nشكراً لتسوقكم معنا 🙏`
        const waUrl = buildWhatsApp(phone, msg)
        toast((t) => (
          <span>
            <a href={waUrl} target="_blank" rel="noreferrer" className="underline font-bold text-green-600">📱 إرسال الفاتورة واتساب</a>
            <button onClick={() => toast.dismiss(t.id)} className="mr-2 text-xs opacity-50">✕</button>
          </span>
        ), { duration: 8000 })
      } catch (_) {}
    }

    // ── Finalize ─────────────────────────────────────────────────
    toast.success(totals.isRefund ? '↩ تم تسجيل الإرجاع — ' + inv.order_number : '✔ تم حفظ الفاتورة — ' + inv.order_number)
    const printData = { ...inv, items: inv.items.map(i => ({ ...i, isReturn: i.is_return })) }
    setLastInvoice(printData)
    cart.clear()
    refreshLiveExpected(currentShift?.id, currentShift?.opening_cash)
    if (shouldPrint) { setPendingPrint(true); setShowPostPay(false) }
    else setShowPostPay(true)
    setShowPayment(false)
    savingRef.current = false
  }

  const [invoiceFilter, setInvoiceFilter] = useState({ from: new Date().toISOString().slice(0,10), to: new Date().toISOString().slice(0,10), customer: '' })
  const [expandedInv, setExpandedInv]     = useState(null)

  const loadInvoices = async (filter) => {
    const f = filter || invoiceFilter
    setShowLookup(true)
    setLookupTab('invoices')
    const from = f.from + 'T00:00:00'
    const to   = f.to   + 'T23:59:59'
    let q = db.from('pos_invoices')
      .select('*')
      .gte('created_at', from).lte('created_at', to)
      .order('created_at', { ascending: false })
    if (f.customer) q = q.ilike('customer_name', `%${f.customer}%`)
    const { data, error } = await q
    if (error) console.error('[invoices]', error)
    // For each invoice, load its items separately
    const invs = data || []
    if (invs.length) {
      const ids = invs.map(i => i.id)
      const { data: items } = await db.from('pos_invoice_items').select('*').in('invoice_id', ids)
      const byInv = {}
      ;(items||[]).forEach(it => { if (!byInv[it.invoice_id]) byInv[it.invoice_id] = []; byInv[it.invoice_id].push(it) })
      invs.forEach(inv => { inv.pos_invoice_items = byInv[inv.id] || [] })
    }
    setInvoices(invs)
  }

  const openCustomer = async () => {
    setShowLookup(true)
    setLookupTab('customer')
    const { data } = await db.from('customers').select('*').order('name')
    setCustomers(data || [])
  }

  const loadTodayStats = async () => {
    setStatsLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const from  = today + 'T00:00:00'
    const to    = today + 'T23:59:59'

    // Last 5 invoices with items (all roles see this)
    const { data: last5 } = await db.from('pos_invoices')
      .select('id,order_number,total,payment_method,payment_label,status,created_at,customer_name,amount_paid,change_given,discount_amt,notes')
      .gte('created_at', from).lte('created_at', to)
      .order('created_at', { ascending: false }).limit(5)
    if (last5?.length) {
      const ids = last5.map(i => i.id)
      const { data: items } = await db.from('pos_invoice_items').select('*').in('invoice_id', ids)
      const byInv = {}
      ;(items||[]).forEach(it => { if (!byInv[it.invoice_id]) byInv[it.invoice_id] = []; byInv[it.invoice_id].push(it) })
      last5.forEach(inv => { inv.pos_invoice_items = byInv[inv.id] || [] })
    }
    setRecentInvs(last5 || [])

    // Manager-only stats
    if (isManager) {
      const { data: invs } = await db.from('pos_invoices')
        .select('total,payment_method,status').gte('created_at', from).lte('created_at', to)
      const { data: items2 } = await db.from('pos_invoice_items')
        .select('product_name,quantity,is_return').gte('created_at', from).lte('created_at', to)
      const active = (invs||[]).filter(i => i.status !== 'cancelled')
      const sales  = active.filter(i => i.total >= 0)
      const returns= active.filter(i => i.total < 0)
      const byMethod = {}
      sales.forEach(i => { byMethod[i.payment_method] = (byMethod[i.payment_method]||0) + i.total })
      const prodMap = {}
      ;(items2||[]).filter(i => !i.is_return).forEach(i => { prodMap[i.product_name] = (prodMap[i.product_name]||0) + (i.quantity||1) })
      const topProds = Object.entries(prodMap).sort((a,b)=>b[1]-a[1]).slice(0,6)
      setTodayStats({
        totalRev: sales.reduce((s,i)=>s+(i.total||0),0),
        totalReturn: returns.reduce((s,i)=>s+Math.abs(i.total||0),0),
        count: sales.length, byMethod, topProds,
      })
    }
    setStatsLoading(false)
  }

  const openDashboard = () => {
    setShowLookup(true)
    setLookupTab('today')
    loadTodayStats()
  }

  const saveNewCustomer = async () => {
    if (!newCust.name.trim()) return
    const { data } = await db.from('customers').insert({ name: newCust.name.trim(), phone: newCust.phone.trim() }).select().single()
    if (data) {
      setCustomers(c => [data, ...c])
      cart.setCustomer(data)
      setNewCust({ name:'', phone:'' })
      setShowLookup(false)
    }
  }

  const reprintInvoice = (inv) => {
    setLastInvoice({ ...inv, items: inv.pos_invoice_items || [] })
    setTimeout(() => window.print(), 300)
  }

  const { currentShift, openShift, closeShift, reconcileLocalShift, _hasHydrated } = useShiftStore()

  // If the active shift was opened in fallback mode (DB write failed), try
  // once more to upgrade it to a real cash_shifts row when POS mounts and
  // whenever the shift id changes. Keeps invoice.shift_id pointing at a real
  // row instead of the local UUID.
  useEffect(() => {
    if (currentShift?._local) reconcileLocalShift?.()
  }, [currentShift?.id])
  const { stores, activeStore, loadStores, setActiveStore } = useStoreContext()
  const [showStorePicker, setShowStorePicker] = useState(false)
  const [showSwitchUser, setShowSwitchUser] = useState(false)
  const [switchCreds, setSwitchCreds] = useState({ email: '', password: '' })
  const [switchLoading, setSwitchLoading] = useState(false)
  useEffect(() => { loadStores() }, [])

  // Admins/managers subscribe to short-cash alerts from any cashier
  useEffect(() => {
    if (!isManager) return
    const ch = supabase.channel('pos-shift-alerts')
      .on('broadcast', { event: 'short_cash' }, ({ payload }) => {
        toast.error(
          `🚨 تنبيه — ${payload.cashier}\nنقص ${fmt(payload.short)} ${cur} في الصندوق\nالمتوقع: ${fmt(payload.expected)} — الفعلي: ${fmt(payload.actual)}`,
          { duration: 15000, style: { whiteSpace: 'pre-line', fontWeight: 'bold' } }
        )
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [isManager])
  const [openingCash, setOpeningCash]       = useState('')
  const [openingNote, setOpeningNote]       = useState('')
  const [lastShiftClose, setLastShiftClose] = useState(null) // { closing_cash, closed_at }

  // Fetch last closed shift when shift gate appears; load live cash when shift is open
  useEffect(() => {
    if (!currentShift) {
      supabase.from('cash_shifts').select('closing_cash,closed_at,cash_difference')
        .eq('status','closed').order('closed_at',{ascending:false}).limit(1).single()
        .then(({ data }) => setLastShiftClose(data || null))
    } else {
      refreshLiveExpected(currentShift.id, currentShift.opening_cash)
    }
  }, [currentShift?.id])
  const [closingCash, setClosingCash]       = useState('')
  const [closingNote, setClosingNote]       = useState('')
  const [expectedCash, setExpectedCash]     = useState(null)
  const [liveExpected, setLiveExpected]     = useState(null)
  const [showCloseShift, setShowCloseShift] = useState(false)
  const searchRef    = useRef(null)
  const scanBuf      = useRef('')       // accumulates scanner chars
  const scanLastTime = useRef(0)        // timestamp of last scanner keystroke

  // Physical-key → QWERTY character map (layout-independent barcode reading)
  // Includes both top-row digits AND numpad (scanners vary)
  const SCAN_CODE_MAP = {
    Digit0:'0',Digit1:'1',Digit2:'2',Digit3:'3',Digit4:'4',
    Digit5:'5',Digit6:'6',Digit7:'7',Digit8:'8',Digit9:'9',
    Numpad0:'0',Numpad1:'1',Numpad2:'2',Numpad3:'3',Numpad4:'4',
    Numpad5:'5',Numpad6:'6',Numpad7:'7',Numpad8:'8',Numpad9:'9',
    KeyA:'A',KeyB:'B',KeyC:'C',KeyD:'D',KeyE:'E',KeyF:'F',KeyG:'G',
    KeyH:'H',KeyI:'I',KeyJ:'J',KeyK:'K',KeyL:'L',KeyM:'M',KeyN:'N',
    KeyO:'O',KeyP:'P',KeyQ:'Q',KeyR:'R',KeyS:'S',KeyT:'T',KeyU:'U',
    KeyV:'V',KeyW:'W',KeyX:'X',KeyY:'Y',KeyZ:'Z',
    Minus:'-', NumpadSubtract:'-',
  }

  // ── Scale barcode parser (Rongta RLS1100C — EAN-13 price-embedded) ─────────
  // Format: 2 PPPPP TTTTT C
  //   [0]   = '2'  → variable-weight/price item
  //   [1-5] = PLU code (5 digits) → matches product.barcode stored as "00001"
  //   [6-10]= total price × 100   → e.g. "01250" = 12.50 MAD
  //   [11]  = filler / check digit
  //   [12]  = EAN check digit
  // Also supports weight-embedded: same structure but [6-10] = weight in grams
  const parseScaleBarcode = (code) => {
    const c = code.replace(/\D/g, '')
    if (c.length !== 13 || c[0] !== '2') return null
    const plu      = c.slice(1, 6)          // '00001'
    const priceRaw = parseInt(c.slice(6, 11), 10)  // e.g. 1250 → 12.50
    const price    = priceRaw / 100
    return { plu, price }
  }

  const storeId  = activeStore?.id || null
  const products = filteredProducts(storeId)   // fresh every render — needed for cart/image reactivity
  const scanPool = useMemo(                    // memoized — only for barcode lookup, not shown in grid
    () => allProducts.filter(p => p.is_active && !p.is_hidden && (storeId ? p.store_id === storeId : !p.store_id)),
    [allProducts, storeId]
  )

  useEffect(() => {
    if (!searchQ.trim()) return
    const q = searchQ.trim()

    // 1. Try scale EAN-13 barcode first
    const scaleParsed = parseScaleBarcode(q)
    if (scaleParsed) {
      // Match product by PLU code (stored in barcode field as e.g. "00001")
      const prod = scanPool.find(p => p.barcode && p.barcode.replace(/^0+/, '') === scaleParsed.plu.replace(/^0+/, ''))
      if (prod && scaleParsed.price > 0) {
        cart.addScaleItem(prod, scaleParsed.price)
        toast.success(`⚖️ ${prod.name} — ${fmt(scaleParsed.price)} ${cur}`, { duration: 1500 })
        setSearchQ('')
        return
      }
    }

    // 2. Flexible barcode match — searches ALL store products (ignores active category)
    const normalizeBarcode = (b) => String(b || '').trim().replace(/^0+/, '') || '0'
    const qNorm = normalizeBarcode(q)
    const exact = scanPool.find(p => {
      if (!p.barcode) return false
      const bc = String(p.barcode).trim()
      return bc === q                          // exact string match
          || bc === String(Number(q))          // numeric equivalence (strips leading zeros)
          || normalizeBarcode(bc) === qNorm    // strip leading zeros from both sides
    })
    if (exact) {
      addItem(exact, { ignoreStock: true })
      setSearchQ('')
      return
    }

    // 3. Barcode scanned but not found — open quick-add if looks like a barcode (digits only, 4+)
    if (/^\d{4,}$/.test(q)) {
      setSearchQ('')
      setQuickAdd({ open: true, barcode: q })
    }
  }, [searchQ])

  // Barcode scanner — intercepts ALL physical key events globally.
  // No per-char re-renders: buffer lives in a ref, UI updates only on Enter.
  // inputMode="none" on the search input prevents OS virtual keyboard from popping up.
  useEffect(() => {
    const handler = (e) => {
      // Let other inputs (modals, etc.) handle their own keys
      if (
        (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') &&
        e.target !== searchRef.current
      ) return

      const ch = SCAN_CODE_MAP[e.code]

      // Commit on Enter — one render, one product lookup
      if (e.key === 'Enter') {
        const buf = scanBuf.current.trim()
        scanBuf.current = ''
        scanLastTime.current = 0
        if (buf.length >= 3) {
          e.preventDefault()
          setSearchQ(buf)
          setLocalInput(buf)
        }
        return
      }

      if (!ch) return // ignore Shift, Alt, Ctrl, F-keys, etc.

      const now = Date.now()
      const diff = now - scanLastTime.current
      scanLastTime.current = now

      e.preventDefault() // never let physical keys reach the input / onChange

      // Reset buffer after a 500 ms idle gap (new scan session)
      if (diff > 500) scanBuf.current = ch
      else            scanBuf.current += ch
      // No setLocalInput here — avoids a re-render per character
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setSearchQ])

  // Reset clear confirmation if cart empties or user does something else
  useEffect(() => { setConfirmClear(false) }, [cart.items.length])

  // Close Arabic keyboard when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (kbdRef.current && !kbdRef.current.contains(e.target)) {
        setShowArabicKbd(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close keyboard when search is cleared
  useEffect(() => {
    if (!searchQ) { setShowArabicKbd(false); setLocalInput('') }
  }, [searchQ])

  // Wait for Zustand to rehydrate from localStorage before deciding
  if (!_hasHydrated) return (
    <div className="flex items-center justify-center h-full bg-gray-50 font-arabic" dir="rtl">
      <p className="text-muted text-lg animate-pulse">جارٍ التحميل...</p>
    </div>
  )

  // Shift gate
  if (!currentShift) {
    const openAmt = parseFloat(openingCash) || 0
    const prevClose = lastShiftClose?.closing_cash ?? null
    const openDiff = prevClose !== null ? openAmt - prevClose : null
    const openHasGap = openDiff !== null && openingCash !== '' && Math.abs(openDiff) > 0.01
    const openCanStart = !openHasGap || openingNote.trim().length >= 5
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 font-arabic" dir="rtl">
        <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm mx-4">
          <div className="text-center mb-4">
            <div className="text-5xl mb-2">🏪</div>
            <h2 className="font-black text-xl">فتح الوردية</h2>
            <p className="text-muted text-sm">{profile?.full_name}</p>
          </div>

          {/* Last shift info */}
          {lastShiftClose && (
            <div className="bg-blue-50 rounded-xl p-3 mb-4 text-sm">
              <p className="font-black text-blue-800 mb-1">📋 إغلاق الوردية السابقة</p>
              <div className="flex justify-between text-blue-700">
                <span>رصيد الإغلاق</span>
                <span className="font-black">{fmt(lastShiftClose.closing_cash)} {cur}</span>
              </div>
              <div className="flex justify-between text-blue-700">
                <span>وقت الإغلاق</span>
                <span className="font-bold text-xs">{new Date(lastShiftClose.closed_at).toLocaleString('ar')}</span>
              </div>
              {lastShiftClose.cash_difference !== 0 && lastShiftClose.cash_difference !== null && (
                <p className="text-xs text-orange-600 font-bold mt-1">
                  ⚠️ كان فيها فارق: {fmt(lastShiftClose.cash_difference)} {cur}
                </p>
              )}
            </div>
          )}

          <label className="text-sm font-bold block mb-1">النقود في الصندوق الآن</label>
          <input type="number" value={openingCash} onChange={e=>setOpeningCash(e.target.value)}
            className="inp text-xl font-black text-center mb-2" placeholder="0.00" min="0" step="0.01" autoFocus />

          {/* Gap indicator */}
          {openingCash !== '' && prevClose !== null && (
            <div className={`rounded-xl p-2 mb-3 text-center text-sm font-black ${
              !openHasGap ? 'bg-green-50 text-green-700' :
              openDiff < 0 ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'
            }`}>
              {!openHasGap ? '✅ مطابق للإغلاق السابق' :
               openDiff < 0 ? `⚠️ نقص ${fmt(Math.abs(openDiff))} ${cur} عن الإغلاق السابق` :
                              `⚠️ زيادة ${fmt(openDiff)} ${cur} عن الإغلاق السابق`}
            </div>
          )}

          {/* Reason required if gap */}
          {openHasGap && (
            <div className="mb-3">
              <label className="text-sm font-bold block mb-1 text-red-600">سبب الفارق (مطلوب)</label>
              <textarea value={openingNote} onChange={e=>setOpeningNote(e.target.value)}
                className="inp w-full text-sm resize-none" rows={2}
                placeholder="اشرح سبب الفارق..." />
            </div>
          )}

          <button onClick={async () => {
            if (!openCanStart) { toast.error('يجب كتابة سبب الفارق أولاً'); return }
            await openShift(openAmt, profile?.id)
            setOpeningCash('')
            setOpeningNote('')
          }} disabled={!openCanStart}
            className="w-full bg-primary text-white font-black py-3 rounded-xl text-lg disabled:opacity-40">
            ✔ فتح الوردية
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden font-arabic" dir="rtl">

      {/* ── LEFT — Action Panel ── */}
      <div className="w-[88px] flex flex-col flex-shrink-0 overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)' }}>
        {/* Scrollable top section */}
        <div className="flex flex-col gap-1.5 p-2 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {[
          { id:'weight',   icon:'🏋️', label:'وزن مباشر',   bg:'#0f766e', action: () => setShowWeight(true) },
          { id:'scale',    icon:'⚖️', label:'الميزان',     bg:'#0d9488', action: () => setShowScale(true) },
          { id:'hold',     icon:'⏸', label:'تعليق',       bg:'#d97706', action: () => { if (cart.items.length) { cart.holdCart(); toast.success('تم تعليق الفاتورة') } } },
          { id:'return',   icon:'↩', label:'إرجاع',       bg: cart.returnMode ? '#ea580c' : '#9a3412', action: () => cart.setReturnMode(!cart.returnMode) },
          { id:'lookup',   icon:'📊', label:'لوحة/فواتير', bg:'#4f46e5', action: openDashboard },
          { id:'notes',    icon:'💬', label:'ملاحظات',     bg:'#475569', action: () => setShowNotes(true) },
          { id:'close',    icon:'🔒', label:'إغلاق',      bg:'#374151', action: async () => {
            setExpectedCash(null)
            setClosingCash('')
            setClosingNote('')
            setShowCloseShift(true)
            if (currentShift?.id) {
              const { data } = await db.from('pos_invoices').select('total,payment_method').eq('shift_id', currentShift.id)
              const cashSales = (data||[]).filter(i=>i.payment_method==='cash').reduce((s,i)=>s+(i.total||0),0)
              const { data: exps } = await db.from('expenses').select('amount').eq('shift_id', currentShift.id)
              const expTotal = (exps||[]).reduce((s,e)=>s+(e.amount||0),0)
              setExpectedCash((currentShift.opening_cash||0) + cashSales - expTotal)
            }
          }},
        ].map(btn => (
          <button key={btn.label} onClick={btn.action}
            style={{ background: btn.bg }}
            className={`text-white rounded-xl p-2 text-center text-[10px] font-bold flex flex-col items-center gap-0.5 transition-all active:scale-90 hover:brightness-110 ${btn.id==='return' && cart.returnMode ? 'ring-2 ring-orange-300' : ''}`}>
            <span className="text-lg leading-none">{btn.icon}</span>
            <span className="leading-tight">{btn.label}</span>
          </button>
        ))}

        {/* Switch User */}
        <button onClick={() => setShowSwitchUser(true)}
          className="text-white rounded-xl p-2 text-center text-[10px] font-bold flex flex-col items-center gap-0.5 transition-all active:scale-90 hover:brightness-110"
          style={{ background: '#4f46e5', border: '1.5px solid rgba(255,255,255,.2)' }}>
          <span className="text-lg leading-none">🔄</span>
          <span className="leading-tight truncate w-full text-center">{getFirstName(profile?.full_name)}</span>
        </button>


        {/* Held carts button — only when held carts exist */}
        {cart.heldCarts.length > 0 && (
          <button onClick={() => setShowHeldCarts(true)}
            className="text-white rounded-xl p-2 text-center text-[10px] font-bold flex flex-col items-center gap-0.5 transition-all active:scale-90 relative"
            style={{ background: '#b45309' }}>
            <span className="text-lg leading-none">📂</span>
            <span>معلقة ({cart.heldCarts.length})</span>
          </button>
        )}

        </div>{/* end scrollable */}

      </div>

      {/* ── CENTER — Search + Categories + Grid ── */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: '#f0f4ff' }}>
        {/* Search bar + Arabic keyboard wrapper */}
        <div ref={kbdRef}>
        <div className="flex gap-2 p-2.5 bg-white border-b border-blue-50"
          style={{ boxShadow: '0 2px 8px rgba(26,86,219,.06)' }}>
          <div className="flex-1 min-w-0 flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-2 overflow-hidden">
            <span className="text-gray-400 flex-shrink-0">🔍</span>
            <input
              ref={searchRef}
              value={localInput}
              onChange={e => { setLocalInput(e.target.value); setSearchQ(e.target.value) }}
              inputMode="none"
              className="flex-1 min-w-0 py-2 text-sm outline-none bg-transparent" placeholder="بحث بالاسم أو الباركود..."
            />
            {localInput && (
              <button onMouseDown={e => { e.preventDefault(); setSearchQ(''); setLocalInput('') }} className="text-gray-400 hover:text-red-500 font-black px-1">✕</button>
            )}
            <button onMouseDown={e => { e.preventDefault(); setShowArabicKbd(s => !s) }}
              className="flex-shrink-0 px-2 py-1 rounded-lg text-xs font-bold transition-all"
              style={{ background: showArabicKbd ? '#1e3a8a' : '#e0e7ff', color: showArabicKbd ? '#fff' : '#3730a3' }}>
              ع
            </button>
          </div>
          <button onClick={() => setQuickAdd({ open: true, barcode: '' })}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-black text-white transition-all active:scale-95 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', boxShadow: '0 2px 8px rgba(99,102,241,.35)' }}>
            <span className="text-base leading-none">+</span>
            <span>منتج</span>
          </button>
        </div>

        {/* Arabic virtual keyboard */}
        {showArabicKbd && (
          <div className="bg-slate-800 px-2 py-2 flex-shrink-0 border-b border-slate-700">
            {[
              ['ض','ص','ث','ق','ف','غ','ع','ه','خ','ح','ج','د','ذ'],
              ['ش','س','ي','ب','ل','ا','ت','ن','م','ك','ط'],
              ['ئ','ء','ؤ','ر','لا','ى','ة','و','ز','ظ'],
            ].map((row, ri) => (
              <div key={ri} className="flex gap-0.5 mb-1">
                {row.map(ch => (
                  <button key={ch}
                    onMouseDown={e => { e.preventDefault(); const v = localInput + ch; setLocalInput(v); setSearchQ(v) }}
                    className="flex-1 h-9 rounded-lg bg-slate-600 hover:bg-slate-500 active:bg-indigo-600 text-white font-bold text-sm transition-all active:scale-95">
                    {ch}
                  </button>
                ))}
              </div>
            ))}
            <div className="flex justify-center gap-1">
              <button onMouseDown={e => { e.preventDefault(); const v = localInput + ' '; setLocalInput(v); setSearchQ(v) }}
                className="flex-1 max-w-[180px] h-9 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-bold text-sm transition-all active:scale-95">
                مسافة
              </button>
              <button onMouseDown={e => { e.preventDefault(); const v = localInput.slice(0,-1); setLocalInput(v); setSearchQ(v) }}
                className="w-14 h-9 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm transition-all active:scale-95">
                ⌫
              </button>
              <button onMouseDown={e => { e.preventDefault(); setLocalInput(''); setSearchQ('') }}
                className="w-14 h-9 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all active:scale-95">
                مسح
              </button>
              <button onMouseDown={e => { e.preventDefault(); setShowArabicKbd(false) }}
                className="w-14 h-9 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold text-xs transition-all active:scale-95">
                ✔ تم
              </button>
            </div>
          </div>
        )}
        </div>{/* end kbdRef wrapper */}

        {/* Category sidebar + Products */}
        <div className="flex flex-1 overflow-hidden min-h-0 relative">
          {showCatSidebar && (
            <>
              {/* Backdrop */}
              <div className="absolute inset-0 z-10" onClick={() => setShowCatSidebar(false)} />
              {/* Sidebar */}
              <div className="absolute right-0 top-0 bottom-0 z-20 shadow-2xl">
                <CategorySidebar active={activeCat} setActive={(cat) => { setActiveCat(cat); setShowCatSidebar(false) }} categories={categories} />
              </div>
            </>
          )}
          <div className="flex-1 overflow-hidden">
            <ProductGrid products={products} onAdd={cart.returnMode ? cart.returnItem : addItem} returnMode={cart.returnMode} />
          </div>
        </div>
      </div>

      {/* ── RIGHT — Cart ── */}
      <div className={`${cartOpen ? 'w-80' : 'w-10'} bg-white border-r border-gray-200 flex flex-col flex-shrink-0 shadow-md transition-all duration-200`}>

        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-800 flex-shrink-0">
          {cartOpen && <>
            <h2 className="font-black text-sm text-white flex-1">🧾 الفاتورة</h2>
            {cart.items.length > 0 && (
              <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{cart.items.length}</span>
            )}
            {cart.items.length > 0 && (
              confirmClear
                ? <button onMouseDown={() => { cart.clear(); setConfirmClear(false) }}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg font-black text-sm text-white animate-pulse"
                    style={{ background: '#dc2626' }}>
                    🗑️ تأكيد
                  </button>
                : <button onClick={() => setConfirmClear(true)}
                    className="text-red-400 hover:text-red-300 font-black text-base leading-none transition-colors">
                    🗑️
                  </button>
            )}
            {cart.returnMode && (
              <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">↩ إرجاع</span>
            )}
          </>}
          <button onClick={() => setCartOpen(o => !o)}
            className="text-white/60 hover:text-white font-black text-sm transition-colors ml-auto">
            {cartOpen ? '◀' : '▶'}
          </button>
        </div>

        {cartOpen && <>
          {/* Customer banner */}
          {cart.customer && (
            <div className="px-3 py-2 bg-blue-50 border-b border-blue-100 text-xs font-bold text-blue-700 flex items-center justify-between flex-shrink-0">
              <span>👤 {cart.customer.name}</span>
              <button onClick={() => cart.setCustomer(null)} className="text-blue-400 hover:text-red-500 font-black transition-colors">✕</button>
            </div>
          )}

          {/* Items list */}
          <div className="flex-1 overflow-y-auto bg-white">
            {cart.items.length === 0
              ? <p className="text-center text-gray-400 text-sm mt-10">السلة فارغة</p>
              : cart.items.map((item, idx) => (
                  <CartRow key={`${item.id}-${item.isReturn}`} item={item} idx={idx} currency={cur}
                    selected={selectedItem === item.id}
                    onSelect={setSelectedItem}
                  />
                ))
            }
          </div>

          {/* Totals */}
          {(totals.discount > 0 || totals.returnTotal > 0 || tvaRate > 0) && (
            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex-shrink-0 space-y-1 text-xs">
              {totals.discount > 0 && (
                <div className="flex justify-between font-bold text-red-500">
                  <span>الخصم</span><span>−{fmt(totals.discount)} {cur}</span>
                </div>
              )}
              {totals.returnTotal > 0 && (
                <div className="flex justify-between font-bold text-orange-500">
                  <span>المرتجعات</span><span>−{fmt(totals.returnTotal)} {cur}</span>
                </div>
              )}
              {tvaRate > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>TVA {tvaRate}%</span><span>{fmt(totals.tva)} {cur}</span>
                </div>
              )}
            </div>
          )}


          {/* Confirm */}
          <div className="px-3 py-3 bg-white border-t border-gray-100 flex-shrink-0">
            <button onClick={() => cart.items.length && setShowPayment(true)}
              className="w-full text-white font-black py-3.5 rounded-xl text-sm transition-all active:scale-[.98] disabled:opacity-50"
              style={{
                background: !cart.items.length ? '#9ca3af'
                  : totals.isRefund ? 'linear-gradient(135deg,#f97316,#ea580c)'
                  : 'linear-gradient(135deg,#16a34a,#22c55e)',
                boxShadow: !cart.items.length ? 'none'
                  : totals.isRefund ? '0 4px 12px rgba(249,115,22,.4)'
                  : '0 4px 12px rgba(22,163,74,.4)',
              }}>
              {totals.isRefund
                ? `↩ استرداد — ${fmt(Math.abs(totals.total))} ${cur}`
                : `✔ تأكيد الدفع — ${fmt(totals.total)} ${cur}`}
            </button>
          </div>
        </>}
      </div>

      {/* ── PAYMENT MODAL ── */}
      <PaymentModal open={showPayment} onClose={() => setShowPayment(false)}
        totals={totals} currency={cur}
        onConfirm={() => handleConfirm(false)}
        onPrint={() => handleConfirm(true)} />

      {/* ── POST-PAYMENT ── */}
      {showPostPay && lastInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl p-6 flex flex-col items-center gap-4 w-72">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
              style={{ background: lastInvoice.total < 0 ? '#fff7ed' : '#f0fdf4' }}>
              {lastInvoice.total < 0 ? '↩' : '✅'}
            </div>
            <div className="text-center">
              <p className="font-black text-lg text-slate-800">
                {lastInvoice.total < 0 ? 'تم الإرجاع' : 'تم الدفع'}
              </p>
              <p className="text-sm text-slate-500 mt-0.5">فاتورة #{lastInvoice.order_number}</p>
              <p className="text-2xl font-black mt-2"
                style={{ color: lastInvoice.total < 0 ? '#f97316' : '#16a34a' }}>
                {fmt(Math.abs(lastInvoice.total))} {cur}
              </p>
            </div>
            <button
              onClick={() => { window.print() }}
              className="w-full py-3 rounded-xl text-white font-black text-base flex items-center justify-center gap-2 transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg,#1e40af,#1a56db)', boxShadow: '0 4px 14px rgba(26,86,219,.4)' }}>
              🖨️ طباعة الفاتورة
            </button>
            <button
              onClick={() => setShowPostPay(false)}
              className="w-full py-2.5 rounded-xl font-black text-sm bg-gray-100 text-gray-600 transition-all active:scale-95">
              ✕ إغلاق
            </button>
          </div>
        </div>
      )}

      {/* ── QUICK ADD MODAL ── */}
      <QuickAddModal
        open={quickAdd.open}
        barcode={quickAdd.barcode}
        currency={cur}
        onClose={() => setQuickAdd({ open: false, barcode: '' })}
        onAdded={(product, addToCart) => {
          useProductsStore.getState().load()   // refresh product list
          if (addToCart) addItem(product)
        }}
      />

      {/* ── WEIGHT MODAL — live scale reading ── */}
      <WeightModal
        open={showWeight}
        onClose={() => setShowWeight(false)}
        products={scanPool}
        cur={cur}
        onAdd={(product, total) => {
          cart.addScaleItem(product, total)
          toast.success(`⚖️ ${product.name} — ${fmt(total)} ${cur}`, { duration: 2000 })
        }}
      />

      {/* ── SCALE MODAL ── */}
      <ScaleModal open={showScale} onClose={() => setShowScale(false)} products={products}
        onImport={async (imported) => {
          const { error } = await (supabaseAdmin || supabase).from('products').insert(
            imported.map(p => ({ name: p.name, sell_price: p.price, cost_price: 0, stock: null, unit: 'kg', barcode: String(p.plu).padStart(5,'0') }))
          )
          if (error) toast.error('خطأ في الاستيراد: ' + error.message)
          else toast.success(`✅ تم استيراد ${imported.length} منتج من الميزان`)
        }}
      />

      {/* ── COMBINED LOOKUP MODAL ── */}
      {showLookup && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col font-arabic" dir="rtl">
          {/* Header / Tabs */}
          <div className="flex items-stretch flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e3a8a 60%,#4f46e5 100%)' }}>
            {[
              { id:'today',    icon:'📊', label:'اليوم' },
              { id:'invoices', icon:'📋', label:'الفواتير' },
              { id:'customer', icon:'👤', label:'الزبائن' },
            ].map(t => (
              <button key={t.id}
                onClick={() => {
                  setLookupTab(t.id)
                  if (t.id === 'invoices') loadInvoices()
                  if (t.id === 'today') loadTodayStats()
                  if (t.id === 'customer') { db.from('customers').select('*').order('name').then(({data}) => setCustomers(data||[])) }
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-black transition-all"
                style={{ color: lookupTab===t.id ? '#1a56db' : 'rgba(255,255,255,.75)', background: lookupTab===t.id ? '#fff' : 'transparent' }}>
                <span>{t.icon}</span><span>{t.label}</span>
              </button>
            ))}
            <button onClick={() => setShowLookup(false)} className="px-4 text-white/70 hover:text-white text-xl font-black">✕</button>
          </div>

          {/* ── TAB: TODAY ── */}
          {lookupTab === 'today' && (
            <div className="flex-1 overflow-y-auto">
              {statsLoading && <p className="text-center text-muted mt-10 text-sm">جاري التحميل...</p>}
              {!statsLoading && <>
                {/* Manager-only stats */}
                {isManager && todayStats && (() => {
                  const PAY_LABEL = { cash:'نقود', card:'بطاقة', credit:'كريدي', check:'شيك', debt:'دين' }
                  const PAY_COLOR = { cash:'#059669', card:'#1a56db', credit:'#7c3aed', check:'#b45309', debt:'#dc2626' }
                  return (
                    <div className="p-4 border-b border-gray-100 space-y-3">
                      <p className="text-[10px] text-muted font-black tracking-widest text-center uppercase">إحصائيات اليوم — مدير فقط 🔒</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label:'المبيعات', value: fmt(todayStats.totalRev)+' '+cur, color:'#059669', icon:'💰' },
                          { label:'الفواتير', value: todayStats.count, color:'#1a56db', icon:'🧾' },
                          { label:'الإرجاع',  value: fmt(todayStats.totalReturn)+' '+cur, color:'#f97316', icon:'↩' },
                        ].map(s => (
                          <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: s.color+'12', border:`1.5px solid ${s.color}25` }}>
                            <div className="font-black text-base" style={{ color: s.color }}>{s.value}</div>
                            <div className="text-[10px] text-muted font-bold">{s.label}</div>
                          </div>
                        ))}
                      </div>
                      {Object.keys(todayStats.byMethod).length > 0 && (
                        <div className="rounded-xl border border-gray-100 overflow-hidden">
                          {Object.entries(todayStats.byMethod).map(([m,v]) => (
                            <div key={m} className="flex justify-between px-3 py-2 border-b border-gray-50 last:border-0">
                              <span className="text-sm font-bold" style={{ color: PAY_COLOR[m]||'#334155' }}>{PAY_LABEL[m]||m}</span>
                              <span className="font-black text-sm">{fmt(v)} {cur}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Last 5 invoices — all roles */}
                <div className="px-3 py-2 flex items-center justify-between">
                  <p className="text-xs font-black text-muted">آخر فواتير اليوم</p>
                  <button onClick={loadTodayStats} className="text-xs font-bold text-primary">🔄 تحديث</button>
                </div>
                {recentInvs.length === 0
                  ? <p className="text-center text-muted text-sm mt-6">لا توجد فواتير اليوم</p>
                  : recentInvs.map(inv => (
                    <div key={inv.id} className="mx-3 mb-3 rounded-2xl border border-gray-100 overflow-hidden">
                      {/* Invoice header */}
                      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50">
                        <div>
                          <p className="font-black text-sm">{inv.order_number}</p>
                          <p className="text-[10px] text-muted">{new Date(inv.created_at).toLocaleTimeString('ar-MA', {hour:'2-digit',minute:'2-digit'})} — {inv.payment_label||inv.payment_method}</p>
                          {inv.customer_name && <p className="text-[10px] text-blue-600">👤 {inv.customer_name}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          {isManager && (
                            <span className={`font-black text-sm ${inv.total < 0 ? 'text-orange-500' : 'text-primary'}`}>
                              {fmt(inv.total)} {cur}
                            </span>
                          )}
                          {inv.status === 'cancelled' && <span className="text-[10px] bg-red-100 text-red-600 font-black px-2 py-0.5 rounded-full">ملغي</span>}
                          {inv.status === 'returned'  && <span className="text-[10px] bg-orange-100 text-orange-600 font-black px-2 py-0.5 rounded-full">مُرجَّع</span>}
                        </div>
                      </div>
                      {/* Items */}
                      <div className="px-4 py-2 space-y-1">
                        {(inv.pos_invoice_items||[]).map((it,i) => (
                          <div key={i} className={`flex justify-between text-sm ${it.is_return ? 'text-orange-500' : 'text-gray-700'}`}>
                            <span className="truncate flex-1">{it.is_return && '↩ '}{it.product_name} ×{it.quantity}</span>
                            {isManager && <span className="font-bold flex-shrink-0 mr-2">{fmt(it.total)}</span>}
                          </div>
                        ))}
                      </div>
                      {/* Reprint */}
                      <div className="px-4 pb-3">
                        <button onClick={() => reprintInvoice(inv)}
                          className="w-full py-2 rounded-xl text-white font-black text-xs transition-all active:scale-95"
                          style={{ background: 'linear-gradient(135deg,#1a56db,#4f46e5)' }}>
                          🖨️ إعادة طباعة
                        </button>
                      </div>
                    </div>
                  ))
                }
              </>}
            </div>
          )}

          {/* ── TAB: CUSTOMER ── */}
          {lookupTab === 'customer' && <>
            <div className="p-3 border-b bg-gray-50 flex-shrink-0">
              <p className="text-xs font-bold text-muted mb-2">➕ زبون جديد</p>
              <div className="flex gap-2 mb-2">
                <input value={newCust.name} onChange={e => setNewCust(c => ({...c, name: e.target.value}))}
                  className="inp text-sm flex-1" placeholder="الاسم *" />
                <input value={newCust.phone} onChange={e => setNewCust(c => ({...c, phone: e.target.value}))}
                  className="inp text-sm w-32" placeholder="الهاتف" />
              </div>
              <button onClick={saveNewCustomer} className="w-full bg-primary text-white text-xs font-black py-1.5 rounded-lg">+ إضافة وتحديد</button>
            </div>
            <div className="px-3 pt-2 pb-1 flex-shrink-0">
              <input value={custSearch} onChange={e => setCustSearch(e.target.value)}
                className="inp text-sm" placeholder="🔍 بحث بالاسم أو الهاتف..." autoFocus />
            </div>
            {cart.customer && (
              <div className="mx-3 mb-1 px-3 py-2 bg-primary/10 rounded-xl flex items-center justify-between flex-shrink-0">
                <span className="text-sm font-black text-primary">✔ {cart.customer.name}</span>
                <button onClick={() => cart.setCustomer(null)} className="text-danger text-xs font-bold">إزالة</button>
              </div>
            )}
            <div className="overflow-y-auto flex-1">
              {customers.filter(c => !custSearch || c.name?.includes(custSearch) || c.phone?.includes(custSearch)).map(c => (
                <div key={c.id} onClick={() => { cart.setCustomer(c); setShowLookup(false) }}
                  className={`flex items-center justify-between px-4 py-2.5 border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${cart.customer?.id === c.id ? 'bg-primary/5' : ''}`}>
                  <div>
                    <p className={`text-sm font-bold ${cart.customer?.id === c.id ? 'text-primary' : 'text-gray-800'}`}>{c.name}</p>
                    {c.phone && <p className="text-xs text-muted">{c.phone}</p>}
                  </div>
                  {cart.customer?.id === c.id && <span className="text-primary font-black text-lg">✔</span>}
                </div>
              ))}
              {customers.length === 0 && <p className="text-center text-muted text-sm mt-10">لا يوجد زبائن — أضف زبوناً جديداً</p>}
            </div>
          </>}

          {/* ── TAB: INVOICES ── */}
          {lookupTab === 'invoices' && <>
            {/* Filters */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b flex-shrink-0 flex-wrap">
              <input type="date" value={invoiceFilter.from}
                onChange={e => setInvoiceFilter(f => ({ ...f, from: e.target.value }))}
                className="inp text-sm py-1 w-36" />
              <span className="text-xs text-muted">→</span>
              <input type="date" value={invoiceFilter.to}
                onChange={e => setInvoiceFilter(f => ({ ...f, to: e.target.value }))}
                className="inp text-sm py-1 w-36" />
              <input value={invoiceFilter.customer}
                onChange={e => setInvoiceFilter(f => ({ ...f, customer: e.target.value }))}
                className="inp text-sm py-1 flex-1 min-w-0" placeholder="🔍 اسم الزبون..." />
              <button onClick={() => loadInvoices(invoiceFilter)}
                className="bg-primary text-white text-xs font-black px-4 py-1.5 rounded-lg">بحث</button>
              <span className="text-xs text-muted whitespace-nowrap">
                {invoices.length} فاتورة — <b className="text-primary">{fmt(invoices.reduce((s,i) => s + (i.total||0), 0))} {cur}</b>
              </span>
            </div>
            {/* Invoice list */}
            <div className="flex-1 overflow-y-auto">
              {invoices.length === 0
                ? <p className="text-center text-muted text-sm mt-10">لا توجد فواتير في هذه الفترة</p>
                : invoices.map(inv => (
                  <div key={inv.id} className="border-b">
                    <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedInv(expandedInv === inv.id ? null : inv.id)}>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm text-gray-800">{inv.order_number}</p>
                        <p className="text-xs text-muted">{fmtDate(inv.created_at)} — {inv.payment_label || inv.payment_method}</p>
                        {inv.customer_name && <p className="text-xs text-blue-600">👤 {inv.customer_name}</p>}
                      </div>
                      <div className="text-left flex-shrink-0">
                        <p className={`font-black ${inv.total < 0 ? 'text-orange-500' : 'text-primary'}`}>{fmt(inv.total)} {cur}</p>
                        <p className="text-[10px] text-muted">{(inv.pos_invoice_items||[]).length} صنف</p>
                      </div>
                      <span className="text-gray-400 text-xs">{expandedInv === inv.id ? '▲' : '▼'}</span>
                    </div>
                    {expandedInv === inv.id && (
                      <div className="bg-gray-50 px-4 pb-3">
                        <table className="w-full text-xs mb-2">
                          <thead><tr className="border-b border-gray-200 text-muted">
                            <th className="text-right py-1">المنتج</th>
                            <th className="text-center w-10">ك</th>
                            <th className="text-center w-16">السعر</th>
                            <th className="text-left w-16">المجموع</th>
                          </tr></thead>
                          <tbody>
                            {(inv.pos_invoice_items||[]).map((it,i) => (
                              <tr key={i} className={`border-b border-gray-100 ${it.is_return ? 'text-orange-500' : ''}`}>
                                <td className="py-0.5">{it.is_return && '↩ '}{it.product_name}</td>
                                <td className="text-center">{it.quantity}</td>
                                <td className="text-center">{fmt(it.unit_price)}</td>
                                <td className="text-left">{fmt(it.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="text-xs space-y-0.5 border-t border-gray-200 pt-1">
                          {inv.discount_amt > 0 && <div className="flex justify-between text-danger"><span>خصم</span><span>−{fmt(inv.discount_amt)}</span></div>}
                          {inv.tva_amt > 0 && <div className="flex justify-between text-muted"><span>TVA</span><span>{fmt(inv.tva_amt)}</span></div>}
                          <div className="flex justify-between font-black"><span>الإجمالي</span>
                            <span className={inv.total < 0 ? 'text-orange-500' : 'text-primary'}>{fmt(inv.total)} {cur}</span>
                          </div>
                          {inv.amount_paid > 0 && <div className="flex justify-between text-muted"><span>المدفوع</span><span>{fmt(inv.amount_paid)}</span></div>}
                          {inv.change_given > 0 && <div className="flex justify-between text-success"><span>الباقي</span><span>{fmt(inv.change_given)}</span></div>}
                          {inv.status === 'returned' && <div className="text-orange-500 font-black text-center mt-1">↩ مُرجَّع</div>}
                          {inv.status === 'cancelled' && <div className="text-danger font-black text-center mt-1">🚫 ملغي</div>}
                          {inv.notes && <div className="text-muted mt-1">ملاحظات: {inv.notes}</div>}
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => reprintInvoice(inv)}
                            className="flex-1 bg-primary text-white text-xs font-black py-1.5 rounded-lg">🖨️ طباعة</button>
                          {isManager && inv.status !== 'cancelled' && inv.status !== 'returned' && (
                            <button onClick={async () => {
                              const reason = window.prompt('سبب إلغاء الفاتورة (مطلوب):')
                              if (!reason || reason.trim().length < 3) { toast.error('يجب كتابة سبب الإلغاء'); return }
                              if (!window.confirm(`تأكيد إلغاء الفاتورة ${inv.order_number}؟`)) return
                              const { error } = await db.from('pos_invoices').update({ status: 'cancelled' }).eq('id', inv.id)
                              if (error) { toast.error('خطأ: ' + error.message); return }
                              await db.from('invoice_audit_log').insert({
                                invoice_id: inv.id, action: 'voided',
                                performed_by: profile?.id,
                                cashier_name: profile?.full_name || profile?.email,
                                invoice_number: inv.order_number, invoice_total: inv.total,
                                reason: reason.trim(), old_data: inv,
                              })
                              toast.success('تم إلغاء الفاتورة')
                              loadInvoices()
                            }}
                            className="flex-1 bg-red-500 text-white text-xs font-black py-1.5 rounded-lg">🚫 إلغاء</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              }
            </div>
          </>}
        </div>
      )}

      {/* ── STORE PICKER MODAL ── */}
      {showStorePicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowStorePicker(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h2 className="font-black text-base mb-3">🏪 اختر نقطة البيع</h2>
            <div className="space-y-2">
              {/* Main store */}
              <button onClick={() => { setActiveStore(null); cart.clear(); setShowStorePicker(false) }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${!activeStore ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}>
                <span className="text-2xl">🏪</span>
                <div className="text-right">
                  <p className="font-black">المحل الرئيسي</p>
                  <p className="text-xs text-muted">المنتجات الأساسية</p>
                </div>
                {!activeStore && <span className="mr-auto text-primary font-black">✔</span>}
              </button>
              {/* Sub stores */}
              {stores.map(s => (
                <button key={s.id} onClick={() => { setActiveStore(s); cart.clear(); setShowStorePicker(false) }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${activeStore?.id === s.id ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}>
                  <span className="text-2xl" style={{ color: s.color }}>{s.icon || '🏬'}</span>
                  <div className="text-right">
                    <p className="font-black">{s.name}</p>
                    {s.address && <p className="text-xs text-muted">{s.address}</p>}
                  </div>
                  {activeStore?.id === s.id && <span className="mr-auto text-primary font-black">✔</span>}
                </button>
              ))}
              {stores.length === 0 && (
                <p className="text-center text-muted text-sm py-4">لا توجد فروع — أضفها من الإدارة</p>
              )}
            </div>
            <button onClick={() => setShowStorePicker(false)} className="w-full mt-3 bg-gray-100 text-gray-700 font-bold py-2 rounded-xl">إغلاق</button>
          </div>
        </div>
      )}

      {/* ── SWITCH USER MODAL ── */}
      {showSwitchUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setShowSwitchUser(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="font-black text-lg mb-1 text-center">🔄 تغيير المستخدم</h2>
            <p className="text-xs text-muted text-center mb-4">سجّل دخول بحساب كاشير أو مدير آخر</p>
            <div className="space-y-3">
              <input
                type="email" placeholder="البريد الإلكتروني" dir="ltr"
                value={switchCreds.email}
                onChange={e => setSwitchCreds(c => ({ ...c, email: e.target.value }))}
                className="inp w-full text-left"
              />
              <input
                type="password" placeholder="كلمة السر" dir="ltr"
                value={switchCreds.password}
                onChange={e => setSwitchCreds(c => ({ ...c, password: e.target.value }))}
                className="inp w-full"
                onKeyDown={async e => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('switchBtn').click() }}}
              />
              <button id="switchBtn"
                disabled={switchLoading || !switchCreds.email || !switchCreds.password}
                onClick={async () => {
                  setSwitchLoading(true)
                  const { error } = await supabase.auth.signInWithPassword({ email: switchCreds.email, password: switchCreds.password })
                  setSwitchLoading(false)
                  if (error) { toast.error('خطأ: ' + (error.message === 'Invalid login credentials' ? 'بيانات خاطئة' : error.message)); return }
                  setSwitchCreds({ email: '', password: '' })
                  setShowSwitchUser(false)
                  toast.success('✔ تم تغيير المستخدم')
                  window.location.reload()
                }}
                className="w-full bg-primary text-white font-black py-2.5 rounded-xl disabled:opacity-50">
                {switchLoading ? '...' : 'دخول'}
              </button>
              <button onClick={() => setShowSwitchUser(false)} className="w-full bg-gray-100 text-gray-600 font-bold py-2 rounded-xl">إلغاء</button>
            </div>
            <p className="text-center text-xs text-muted mt-3">المستخدم الحالي: <span className="font-bold">{profile?.full_name}</span></p>
          </div>
        </div>
      )}

      {/* ── HELD CARTS MODAL ── */}
      {showHeldCarts && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center animate-fade-in" onClick={() => setShowHeldCarts(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-black text-base">⏸️ الفواتير المعلقة ({cart.heldCarts.length})</h2>
              <button onClick={() => setShowHeldCarts(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-3 space-y-2">
              {cart.heldCarts.length === 0 && (
                <p className="text-center text-muted py-8">لا توجد فواتير معلقة</p>
              )}
              {[...cart.heldCarts].reverse().map(h => {
                const hTotal = h.items.reduce((s,i) => s + i.sell_price * i.qty, 0)
                const heldTime = new Date(h.heldAt)
                const timeStr = heldTime.toLocaleTimeString('ar-MA', { hour:'2-digit', minute:'2-digit' })
                return (
                  <div key={h.id} className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        {h.customer && <p className="text-sm font-black text-primary">👤 {h.customer.name}</p>}
                        <p className="text-xs text-muted">⏱ {timeStr} — {h.items.length} منتج</p>
                        <p className="text-xs text-muted truncate max-w-[200px]">
                          {h.items.slice(0,3).map(i => i.name).join('، ')}{h.items.length > 3 ? '...' : ''}
                        </p>
                      </div>
                      <p className="font-black text-primary text-base">{fmt(hTotal)} {cur}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { cart.resumeCart(h.id); setShowHeldCarts(false); toast.success('تم استرجاع الفاتورة') }}
                        className="flex-1 bg-primary text-white text-xs font-black py-2 rounded-lg">▶ استرجاع</button>
                      <button onClick={() => { cart.deleteHeldCart(h.id); if(cart.heldCarts.length === 1) setShowHeldCarts(false) }}
                        className="bg-danger/10 text-danger text-xs font-black px-3 py-2 rounded-lg">🗑 حذف</button>
                    </div>
                  </div>
                )
              })}
            </div>
            {cart.items.length > 0 && (
              <div className="p-3 border-t bg-gray-50">
                <button onClick={() => { cart.holdCart(); setShowHeldCarts(false); toast.success('تم تعليق الفاتورة الحالية') }}
                  className="w-full bg-yellow-500 text-white text-sm font-black py-2.5 rounded-xl">⏸️ تعليق الفاتورة الحالية</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── NOTES MODAL ── */}
      {showNotes && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-fade-in" onClick={() => setShowNotes(false)}>
          <div className="bg-white rounded-2xl p-5 w-80 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="font-black mb-3">💬 ملاحظات</h3>
            <textarea value={cart.notes} onChange={e => cart.setNotes(e.target.value)}
              className="inp resize-none h-28" placeholder="ملاحظات اختيارية..." />
            <button onClick={() => setShowNotes(false)} className="w-full bg-primary text-white font-bold py-2 rounded-xl mt-3">حفظ</button>
          </div>
        </div>
      )}

      {/* ── CLOSE SHIFT MODAL ── */}
      {showCloseShift && (() => {
        const actual    = parseFloat(closingCash) || 0
        const expected  = expectedCash ?? liveExpected
        const diff      = closingCash !== '' && expected !== null ? actual - expected : null
        const isShort   = diff !== null && diff < -0.01   // cash missing → BLOCK
        const isOver    = diff !== null && diff > 0.01    // extra cash → OK but note
        const isExact   = diff !== null && !isShort && !isOver
        const canClose  = closingCash !== '' && !isShort
        return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center animate-fade-in" onClick={() => setShowCloseShift(false)}>
          <div className="bg-white rounded-2xl p-5 w-84 max-w-sm mx-4 animate-slide-up" onClick={e=>e.stopPropagation()}>
            <h2 className="font-black text-lg mb-3 text-center">🔒 إغلاق الوردية</h2>

            {/* Shift info */}
            <div className="bg-gray-50 rounded-xl p-3 mb-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted">فُتحت</span><span className="font-bold">{currentShift ? new Date(currentShift.opened_at).toLocaleTimeString('ar') : ''}</span></div>
              <div className="flex justify-between"><span className="text-muted">رصيد الافتتاح</span><span className="font-bold">{fmt(currentShift?.opening_cash||0)} {cur}</span></div>
            </div>

            {/* Actual cash input — expected hidden from cashier */}
            <label className="text-sm font-bold block mb-1">النقود الفعلية في الصندوق</label>
            <input type="number" value={closingCash} onChange={e=>setClosingCash(e.target.value)}
              className="inp text-xl font-black mb-2 text-center" placeholder="0.00" autoFocus />

            {/* Result indicator */}
            {diff !== null && (
              <div className={`rounded-xl p-3 mb-3 text-center font-black ${
                isExact ? 'bg-green-50 text-green-700 border border-green-200' :
                isOver  ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          'bg-red-50 text-red-700 border-2 border-red-400'
              }`}>
                {isExact && '✅ الصندوق مطابق تماماً'}
                {isOver  && `✅ زيادة ${fmt(diff)} ${cur} — يمكن الإغلاق`}
                {isShort && <>
                  <div className="text-lg mb-1">🚫 لا يمكن الإغلاق</div>
                  <div className="text-sm">نقص {fmt(Math.abs(diff))} {cur} في الصندوق</div>
                  <div className="text-xs mt-1 font-normal opacity-80">يجب تسوية المبلغ الناقص قبل الإغلاق</div>
                </>}
              </div>
            )}

            <button onClick={async () => {
              if (!canClose) {
                toast.error('🚫 لا يمكن الإغلاق — الصندوق ناقص')
                // Broadcast alert to all admin/manager devices
                await supabase.channel('pos-shift-alerts').send({
                  type: 'broadcast', event: 'short_cash',
                  payload: {
                    cashier:  profile?.full_name || profile?.email || 'كاشير',
                    short:    Math.abs(diff),
                    expected: expected,
                    actual:   actual,
                    time:     new Date().toLocaleTimeString('ar'),
                  }
                })
                return
              }
              await closeShift(actual, isOver ? `زيادة ${fmt(diff)} ${cur}` : '')
              setShowCloseShift(false)
              setClosingCash('')
              setClosingNote('')
              toast.success('تم إغلاق الوردية')
            }} disabled={closingCash === '' || !canClose}
              className="w-full bg-danger text-white font-black py-3 rounded-xl disabled:opacity-40">
              ✔ إغلاق الوردية
            </button>
            <button onClick={() => setShowCloseShift(false)}
              className="w-full bg-gray-100 text-gray-700 font-bold py-2 rounded-xl mt-2">إلغاء</button>
          </div>
        </div>
      )})()}

      {/* ── PRINT AREA (hidden, shown on print) ── */}
      <PrintView invoice={lastInvoice} settings={settings} />
    </div>
  )
}
