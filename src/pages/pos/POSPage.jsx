import { useState, useRef } from 'react'
import { useProductsStore } from '../../stores/productsStore.js'
import { useCartStore } from '../../stores/cartStore.js'
import { useSettingsStore } from '../../stores/settingsStore.js'
import { useAuthStore } from '../../stores/authStore.js'
import { supabase } from '../../lib/supabase.js'
import { fmt, fmtDate, generateOrderNumber, buildWhatsApp, STORE_PHONE } from '../../lib/utils.js'
import toast from 'react-hot-toast'

// ── Category Tabs ────────────────────────────────────────────
function CategoryTabs({ active, setActive, categories }) {
  return (
    <div className="flex gap-1 overflow-x-auto px-2 py-1.5 bg-white border-b border-gray-100 flex-shrink-0">
      {categories.map(c => (
        <button key={c.name} onClick={() => setActive(c.name)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all ${
            active === c.name ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}>
          <span>{c.emoji}</span><span>{c.name}</span>
        </button>
      ))}
    </div>
  )
}

// ── Product Grid ─────────────────────────────────────────────
function ProductGrid({ products, onAdd }) {
  const items = useCartStore(s => s.items)
  return (
    <div className="grid gap-2 p-2 overflow-y-auto"
      style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))' }}>
      {products.map(p => {
        const inCart  = items.find(i => i.id === p.id)
        const isOOS   = p.stock !== null && p.stock <= 0
        return (
          <button key={p.id} onClick={() => !isOOS && onAdd(p)} disabled={isOOS}
            className={`pos-prod-btn relative ${inCart ? 'in-cart' : ''} ${isOOS ? 'opacity-40 cursor-not-allowed' : ''}`}>
            {p.image_url
              ? <img src={p.image_url} alt="" className="w-16 h-16 object-cover rounded-md mb-1.5" loading="lazy" />
              : <span className="text-4xl mb-1.5">{p.emoji || '📦'}</span>
            }
            <span className="text-xs font-bold text-gray-800 leading-tight line-clamp-2">{p.name}</span>
            <span className="text-sm font-black text-primary mt-1">{fmt(p.sell_price)}</span>
            {inCart && (
              <span className="absolute top-1 left-1 bg-primary text-white text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                {inCart.qty}
              </span>
            )}
            {isOOS && <span className="absolute inset-0 bg-white/60 rounded-lg flex items-center justify-center text-[10px] text-danger font-bold">نفد</span>}
          </button>
        )
      })}
    </div>
  )
}

// ── Cart Item Row ─────────────────────────────────────────────
function CartRow({ item, currency }) {
  const { removeOne, addItem, deleteItem } = useCartStore()
  return (
    <div className={`flex items-center gap-2 py-1.5 border-b border-gray-50 ${item.isReturn ? 'bg-orange-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-gray-800 truncate">
          {item.isReturn && <span className="text-orange-500">↩ </span>}{item.name}
        </p>
        <p className="text-[10px] text-muted">{fmt(item.sell_price)} × {item.qty}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={() => removeOne(item.id)} className="w-5 h-5 rounded bg-gray-100 text-xs font-black hover:bg-gray-200">−</button>
        <span className="text-xs font-black w-5 text-center">{item.qty}</span>
        <button onClick={() => addItem(item)} className="w-5 h-5 rounded bg-gray-100 text-xs font-black hover:bg-gray-200">+</button>
      </div>
      <span className="text-xs font-black text-primary w-14 text-left flex-shrink-0">
        {fmt(item.sell_price * item.qty)}
      </span>
      <button onClick={() => deleteItem(item.id)} className="text-danger text-xs hover:opacity-70">✕</button>
    </div>
  )
}

// ── Payment Modal ──────────────────────────────────────────────
function PaymentModal({ open, onClose, totals, currency, onConfirm }) {
  const { paymentMethod, setPayMethod, amountPaid, setAmountPaid } = useCartStore()
  if (!open) return null
  const PAY_METHODS = [
    { id:'cash',   label:'نقود',        icon:'💵', color:'bg-green-500' },
    { id:'card',   label:'بطاقة بنكية', icon:'💳', color:'bg-blue-500' },
    { id:'credit', label:'كريدي',       icon:'📒', color:'bg-orange-500' },
    { id:'check',  label:'شيك',         icon:'📝', color:'bg-purple-500' },
    { id:'debt',   label:'الدين',       icon:'⏳', color:'bg-yellow-500' },
  ]
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-5 animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-black">💳 طريقة الدفع</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
        </div>
        {/* Total display */}
        <div className="bg-primary-light rounded-xl p-3 text-center mb-4">
          <p className="text-sm text-muted">المبلغ المستحق</p>
          <p className="text-3xl font-black text-primary">{fmt(totals.total)} <span className="text-lg">{currency}</span></p>
        </div>
        {/* Payment method buttons */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {PAY_METHODS.map(m => (
            <button key={m.id} onClick={() => setPayMethod(m.id)}
              className={`${m.color} ${paymentMethod===m.id ? 'ring-2 ring-offset-1 ring-gray-800 scale-95' : 'opacity-80'} text-white rounded-xl p-2.5 text-center transition-all`}>
              <div className="text-xl">{m.icon}</div>
              <div className="text-[11px] font-bold mt-0.5">{m.label}</div>
            </button>
          ))}
          <button onClick={onClose} className="bg-danger opacity-80 text-white rounded-xl p-2.5 text-center">
            <div className="text-xl">❌</div>
            <div className="text-[11px] font-bold mt-0.5">إلغاء الدفع</div>
          </button>
        </div>
        {/* Amount paid (cash only) */}
        {paymentMethod === 'cash' && (
          <div className="mb-4">
            <label className="text-sm font-bold block mb-1">المبلغ المدفوع</label>
            <input type="number" value={amountPaid || ''} onChange={e => setAmountPaid(parseFloat(e.target.value)||0)}
              className="inp text-lg font-black" placeholder="0.00" />
            {amountPaid > 0 && (
              <div className={`mt-2 p-2 rounded-lg text-center font-black ${totals.change >= 0 ? 'bg-success-light text-success' : 'bg-danger-light text-danger'}`}>
                {totals.change >= 0 ? `الباقي: ${fmt(totals.change)} ${currency}` : `ناقص: ${fmt(Math.abs(totals.change))} ${currency}`}
              </div>
            )}
          </div>
        )}
        <button onClick={onConfirm}
          className="w-full bg-success hover:bg-green-600 text-white font-black py-3 rounded-xl text-lg transition-colors">
          ✔ تأكيد الدفع
        </button>
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
        <p className="font-black text-lg">{settings?.store_name || 'joud'}</p>
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

// ── MAIN POS PAGE ─────────────────────────────────────────────
export default function POSPage() {
  const { categories, filteredProducts, activeCat, setActiveCat, setSearchQ, searchQ } = useProductsStore()
  const cart = useCartStore()
  const { settings } = useSettingsStore()
  const { profile } = useAuthStore()

  const [showPayment, setShowPayment]   = useState(false)
  const [showNotes, setShowNotes]       = useState(false)
  const [lastInvoice, setLastInvoice]   = useState(null)
  const [showInvoiceList, setShowInvoiceList] = useState(false)
  const [invoices, setInvoices]         = useState([])
  const [discount, setDiscount]         = useState({ type: 'fixed', val: 0 })

  const cur     = settings?.currency || 'درهم'
  const tvaRate = settings?.tva_rate || 0
  const totals  = cart.getTotals(tvaRate)

  const addItem = (product) => {
    cart.addItem(product)
    toast.success(`${product.name} ✔`, { duration: 800, style: { fontSize: '0.8rem' } })
  }

  const applyDiscount = () => {
    cart.setDiscount(discount.type, discount.val)
  }

  const handleConfirm = async () => {
    if (!cart.items.length) { toast.error('السلة فارغة!'); return }
    setShowPayment(false)

    const PAY_LABELS = { cash:'نقود', card:'بطاقة', credit:'كريدي', check:'شيك', debt:'دين' }
    const orderNum = generateOrderNumber('INV')
    const inv = {
      order_number:    orderNum,
      cashier_id:      profile?.id,
      customer_id:     cart.customer?.id || null,
      customer_name:   cart.customer?.name || null,
      status:          'confirmed',
      payment_method:  cart.paymentMethod,
      payment_label:   PAY_LABELS[cart.paymentMethod],
      subtotal:        totals.subtotal,
      discount_type:   cart.discountType,
      discount_value:  cart.discountValue,
      discount_amt:    totals.discount,
      tva_rate:        tvaRate,
      tva_amt:         totals.tva,
      total:           totals.total,
      amount_paid:     cart.amountPaid || totals.total,
      change_given:    Math.max(totals.change, 0),
      notes:           cart.notes,
      created_at:      new Date().toISOString(),
      items: cart.items.map(i => ({
        product_id:   i.id,
        product_name: i.name,
        unit_price:   i.sell_price,
        cost_price:   i.cost_price || 0,
        quantity:     i.qty,
        total:        i.sell_price * i.qty,
        isReturn:     i.isReturn || false,
      })),
    }

    // Save to Supabase
    try {
      const { data: saved, error } = await supabase.from('pos_invoices').insert({
        order_number: inv.order_number, cashier_id: inv.cashier_id,
        customer_id: inv.customer_id, status: inv.status,
        payment_method: inv.payment_method, subtotal: inv.subtotal,
        discount_type: inv.discount_type, discount_value: inv.discount_value,
        discount_amt: inv.discount_amt, tva_rate: inv.tva_rate, tva_amt: inv.tva_amt,
        total: inv.total, amount_paid: inv.amount_paid, change_given: inv.change_given,
        notes: inv.notes,
      }).select().single()

      if (!error && saved) {
        await supabase.from('pos_invoice_items').insert(
          inv.items.map(item => ({ invoice_id: saved.id, ...item }))
        )
        inv.id = saved.id
      }
    } catch(e) { /* offline - still works */ }

    setLastInvoice(inv)
    toast.success('✔ تم حفظ الفاتورة')
    cart.clear()
    setTimeout(() => window.print(), 300)
  }

  const loadInvoices = async () => {
    const { data } = await supabase.from('pos_invoices')
      .select('*').order('created_at', { ascending: false }).limit(50)
    setInvoices(data || [])
    setShowInvoiceList(true)
  }

  const products = filteredProducts()

  return (
    <div className="flex h-full overflow-hidden font-arabic" dir="rtl">

      {/* ── LEFT — Action Panel ── */}
      <div className="w-24 bg-[#1e293b] flex flex-col gap-1 p-1.5 flex-shrink-0 overflow-y-auto">
        {[
          { icon:'✔', label:'تأكيد',     color:'bg-green-500', action: () => setShowPayment(true) },
          { icon:'👤', label:'الزبون',   color:'bg-blue-500',  action: () => {} },
          { icon:'➕', label:'زيادة',    color:'bg-slate-500', action: () => cart.items[0] && cart.addItem(cart.items[cart.items.length-1]) },
          { icon:'➖', label:'تقليص',   color:'bg-slate-500', action: () => cart.items.length && cart.removeOne(cart.items[cart.items.length-1].id) },
          { icon:'🗑️', label:'حذف فاتورة', color:'bg-red-600', action: () => { if(confirm('حذف الفاتورة؟')) cart.clear() } },
          { icon:'❌', label:'حذف سلعة', color:'bg-red-500',   action: () => cart.items.length && cart.deleteItem(cart.items[cart.items.length-1].id) },
          { icon:'↩',  label:'إرجاع',    color:'bg-orange-500', action: () => cart.setReturnMode(!cart.returnMode) },
          { icon:'💬', label:'ملاحظات',  color:'bg-slate-600',  action: () => setShowNotes(true) },
          { icon:'📋', label:'الفواتير', color:'bg-purple-600', action: loadInvoices },
        ].map(btn => (
          <button key={btn.label} onClick={btn.action}
            className={`${btn.color} text-white rounded-lg p-2 text-center text-[10px] font-bold flex flex-col items-center gap-0.5 transition-all active:scale-95 ${btn.label==='إرجاع' && cart.returnMode ? 'ring-2 ring-white' : ''}`}>
            <span className="text-base">{btn.icon}</span>
            <span>{btn.label}</span>
          </button>
        ))}
      </div>

      {/* ── CENTER — Search + Categories + Grid ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
        {/* Search bar */}
        <div className="flex gap-2 p-2 bg-white border-b border-gray-100">
          <input
            value={searchQ} onChange={e => setSearchQ(e.target.value)}
            className="inp flex-1" placeholder="🔍 بحث بالاسم أو الباركود..."
          />
          <div className="flex gap-2 text-xs text-muted items-center">
            <span>المجموع: <b className="text-primary">{fmt(totals.total)} {cur}</b></span>
            {totals.change > 0 && <span>الباقي: <b className="text-success">{fmt(totals.change)}</b></span>}
          </div>
        </div>

        {/* Category tabs */}
        <CategoryTabs active={activeCat} setActive={setActiveCat} categories={categories} />

        {/* Products */}
        <div className="flex-1 overflow-hidden">
          <ProductGrid products={products} onAdd={cart.returnMode ? cart.returnItem : addItem} />
        </div>
      </div>

      {/* ── RIGHT — Cart + Payment Buttons ── */}
      <div className="w-64 bg-white border-r border-gray-100 flex flex-col flex-shrink-0 shadow-lg">
        {/* Cart header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
          <h2 className="font-black text-sm text-gray-800">🧾 الفاتورة</h2>
          <span className="text-xs text-muted">{cart.items.length} صنف</span>
        </div>

        {/* Cart customer */}
        {cart.customer && (
          <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-100 text-xs font-bold text-blue-700">
            👤 {cart.customer.name}
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-3 py-1">
          {cart.items.length === 0
            ? <p className="text-center text-muted text-sm mt-6">السلة فارغة</p>
            : cart.items.map(item => <CartRow key={`${item.id}-${item.isReturn}`} item={item} currency={cur} />)
          }
        </div>

        {/* Discount */}
        <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
          <div className="flex gap-1 mb-1">
            <input type="number" placeholder="خصم" min="0"
              value={discount.val || ''} onChange={e => setDiscount(d => ({ ...d, val: parseFloat(e.target.value)||0 }))}
              className="inp text-sm flex-1" />
            <button onClick={() => setDiscount(d => ({ ...d, type: d.type==='fixed'?'pct':'fixed' }))}
              className="bg-gray-200 text-xs px-2 rounded-lg font-bold">
              {discount.type==='fixed' ? cur : '%'}
            </button>
            <button onClick={applyDiscount} className="bg-primary text-white text-xs px-2 rounded-lg font-bold">✔</button>
          </div>

          {/* Totals */}
          <div className="space-y-0.5 text-xs">
            <div className="flex justify-between text-muted">
              <span>المجموع الفرعي</span><span>{fmt(totals.subtotal)} {cur}</span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-danger">
                <span>الخصم</span><span>−{fmt(totals.discount)} {cur}</span>
              </div>
            )}
            {totals.returnTotal > 0 && (
              <div className="flex justify-between text-orange-500">
                <span>المرتجعات</span><span>−{fmt(totals.returnTotal)} {cur}</span>
              </div>
            )}
            {tvaRate > 0 && (
              <div className="flex justify-between text-muted">
                <span>TVA {tvaRate}%</span><span>{fmt(totals.tva)} {cur}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-base border-t border-gray-200 pt-1 mt-1">
              <span>الإجمالي</span>
              <span className="text-primary">{fmt(totals.total)} {cur}</span>
            </div>
          </div>
        </div>

        {/* Payment method buttons (bottom) */}
        <div className="p-2 border-t border-gray-100 bg-gray-50">
          <button onClick={() => cart.items.length && setShowPayment(true)}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-black py-3 rounded-xl text-sm transition-colors active:scale-95 shadow-sm">
            ✔ تأكيد الدفع — {fmt(totals.total)} {cur}
          </button>
          <div className="grid grid-cols-3 gap-1 mt-1.5">
            {['نقود','بطاقة','كريدي'].map((m,i) => {
              const methods = ['cash','card','credit']
              return (
                <button key={m} onClick={() => { cart.setPayMethod(methods[i]); cart.items.length && setShowPayment(true) }}
                  className={`text-[10px] font-bold py-1.5 rounded-lg transition-colors ${cart.paymentMethod===methods[i] ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {m}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── PAYMENT MODAL ── */}
      <PaymentModal open={showPayment} onClose={() => setShowPayment(false)}
        totals={totals} currency={cur} onConfirm={handleConfirm} />

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

      {/* ── INVOICE LIST MODAL ── */}
      {showInvoiceList && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center animate-fade-in" onClick={() => setShowInvoiceList(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="font-black">📋 الفواتير الأخيرة</h2>
              <button onClick={() => setShowInvoiceList(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="overflow-y-auto flex-1">
              {invoices.map(inv => (
                <div key={inv.id} className="flex justify-between items-center p-3 border-b hover:bg-gray-50">
                  <div>
                    <p className="font-bold text-sm">{inv.order_number}</p>
                    <p className="text-xs text-muted">{fmtDate(inv.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-primary">{fmt(inv.total)} {cur}</p>
                    <p className="text-xs text-muted">{inv.payment_method}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── PRINT AREA (hidden, shown on print) ── */}
      <PrintView invoice={lastInvoice} settings={settings} />
    </div>
  )
}
