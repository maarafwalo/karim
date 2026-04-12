import { useState, useRef, useEffect } from 'react'
import { useProductsStore } from '../../stores/productsStore.js'
import { useCartStore } from '../../stores/cartStore.js'
import { useSettingsStore } from '../../stores/settingsStore.js'
import { useAuthStore } from '../../stores/authStore.js'
import { useShiftStore } from '../../stores/shiftStore.js'
import { useStoreContext } from '../../stores/storeContext.js'
import { supabase } from '../../lib/supabase.js'
import { fmt, fmtDate, generateOrderNumber, buildWhatsApp, STORE_PHONE } from '../../lib/utils.js'
import toast from 'react-hot-toast'

// ── Category Tabs ────────────────────────────────────────────
function CategoryTabs({ active, setActive, categories }) {
  const ref = useRef(null)
  const drag = useRef({ down: false, startX: 0, scrollLeft: 0, moved: false })

  const onDown = (e) => {
    const x = e.touches ? e.touches[0].pageX : e.pageX
    drag.current = { down: true, startX: x - ref.current.offsetLeft, scrollLeft: ref.current.scrollLeft, moved: false }
  }
  const onMove = (e) => {
    if (!drag.current.down) return
    const x = e.touches ? e.touches[0].pageX : e.pageX
    const dist = x - ref.current.offsetLeft - drag.current.startX
    if (Math.abs(dist) > 4) drag.current.moved = true
    ref.current.scrollLeft = drag.current.scrollLeft - dist
  }
  const onUp = () => { drag.current.down = false }

  return (
    <div ref={ref}
      className="flex gap-1 overflow-x-auto px-2 py-1.5 bg-white border-b border-gray-100 flex-shrink-0 cursor-grab active:cursor-grabbing select-none"
      style={{ scrollbarWidth: 'none' }}
      onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
      onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}>
      {categories.map(c => (
        <button key={c.name}
          onClick={() => { if (!drag.current.moved) setActive(c.name) }}
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
function ProductGrid({ products, onAdd, returnMode }) {
  const items = useCartStore(s => s.items)
  const cartIds = new Set(items.filter(i => !i.isReturn).map(i => i.id))
  const visible = returnMode ? products : products.filter(p => !cartIds.has(p.id))
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-2 overflow-y-auto h-full content-start">
      {visible.map(p => {
        const isOOS = !returnMode && p.stock !== null && p.stock <= 0
        return (
          <div key={p.id} className={`pos-prod-btn relative ${isOOS ? 'opacity-40' : ''}`}>
            <div onClick={() => !isOOS && onAdd(p)} className={`flex flex-col items-center w-full ${isOOS ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
              {p.image_url
                ? <img src={p.image_url} alt="" className="w-full h-20 object-contain rounded-md mb-1.5" loading="lazy" />
                : <span className="text-4xl mb-1.5">{p.emoji || '📦'}</span>
              }
              <span className="text-xs font-bold text-gray-800 leading-tight line-clamp-2 text-center">{p.name}</span>
              <span className="text-sm font-black text-primary mt-1">{fmt(p.sell_price)}</span>
            </div>
            {isOOS && <span className="absolute inset-0 bg-white/60 rounded-lg flex items-center justify-center text-[10px] text-danger font-bold">نفد</span>}
          </div>
        )
      })}
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
function CartRow({ item, currency, selected, editing, onSelect, onEdit }) {
  const { deleteItem, setQty, setPrice } = useCartStore()
  const [editQty, setEditQty]     = useState(String(item.qty))
  const [editPrice, setEditPrice] = useState(String(item.sell_price))
  const [activeField, setActiveField] = useState(null)

  const applyEdit = () => {
    const q = parseFloat(editQty)
    const p = parseFloat(editPrice)
    if (!isNaN(q) && q > 0) setQty(item.id, q)
    if (!isNaN(p) && p > 0) setPrice(item.id, p)
    onEdit(null)
  }

  if (editing) {
    const setter = activeField === 'qty' ? setEditQty : setEditPrice
    return (
      <div className="p-2 border-b border-primary/30 bg-blue-50 rounded-lg mb-0.5">
        <p className="text-xs font-bold text-gray-800 truncate mb-2">
          {item.isReturn && <span className="text-orange-500">↩ </span>}{item.name}
        </p>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] text-muted block mb-0.5">الكمية</label>
            <input readOnly type="text" value={editQty} onFocus={() => setActiveField('qty')} onBlur={() => setActiveField(null)}
              className={`inp text-sm font-black py-1 cursor-pointer ${activeField==='qty' ? 'ring-2 ring-primary' : ''}`} />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-muted block mb-0.5">السعر</label>
            <input readOnly type="text" value={editPrice} onFocus={() => setActiveField('price')} onBlur={() => setActiveField(null)}
              className={`inp text-sm font-black py-1 cursor-pointer ${activeField==='price' ? 'ring-2 ring-primary' : ''}`} />
          </div>
        </div>
        {activeField && <Numpad value={activeField === 'qty' ? editQty : editPrice} onChange={setter} onConfirm={applyEdit} />}
        <div className="flex gap-1 mt-2">
          <button onClick={applyEdit} className="flex-1 bg-primary text-white text-xs font-black py-1.5 rounded-lg">✔ تأكيد</button>
          <button onClick={() => { deleteItem(item.id); onEdit(null); onSelect(null) }}
            className="bg-danger text-white text-xs font-black px-3 py-1.5 rounded-lg">حذف</button>
          <button onClick={() => onEdit(null)}
            className="bg-gray-200 text-gray-700 text-xs font-black px-3 py-1.5 rounded-lg">✕</button>
        </div>
      </div>
    )
  }

  return (
    <div onClick={() => onSelect(selected ? null : item.id)}
      className={`flex items-center gap-2 py-1.5 border-b cursor-pointer transition-colors ${
        selected ? 'bg-primary/10 border-primary/30' : 'border-gray-50 hover:bg-gray-50'
      } ${item.isReturn ? 'bg-orange-50' : ''}`}>
      {item.image_url
        ? <img src={item.image_url} alt="" className="w-10 h-10 object-contain rounded flex-shrink-0" />
        : <span className="text-xl flex-shrink-0">{item.emoji || '📦'}</span>
      }
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-gray-800 leading-tight">
          {item.isReturn && <span className="text-orange-500">↩ </span>}{item.name}
        </p>
        <p className="text-[10px] text-muted">{fmt(item.sell_price)} × {item.qty}</p>
      </div>
      <div className="flex flex-col items-end flex-shrink-0">
        <span className="text-xs font-black text-primary">{fmt(item.sell_price * item.qty)}</span>
        <div className="flex gap-1 mt-0.5">
          {selected && (
            <button onClick={e => { e.stopPropagation(); onEdit(item.id) }}
              className="text-primary text-xs hover:opacity-70">✏️</button>
          )}
          <button onClick={e => { e.stopPropagation(); deleteItem(item.id); onSelect(null) }}
            className="text-danger text-xs hover:opacity-70">✕</button>
        </div>
      </div>
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
  const { profile, signOut } = useAuthStore()

  const [showPayment, setShowPayment]   = useState(false)
  const [showNotes, setShowNotes]       = useState(false)
  const [lastInvoice, setLastInvoice]   = useState(null)
  const [showInvoiceList, setShowInvoiceList] = useState(false)
  const [cartOpen, setCartOpen] = useState(true)
  const [invoices, setInvoices]         = useState([])
  const [showCustomer, setShowCustomer] = useState(false)
  const [customers, setCustomers]       = useState([])
  const [custSearch, setCustSearch]     = useState('')
  const [newCust, setNewCust]           = useState({ name:'', phone:'' })
  const [discount, setDiscount]         = useState({ type: 'fixed', val: 0 })
  const [selectedItem, setSelectedItem]   = useState(null)
  const [editingItem, setEditingItem]     = useState(null)
  const [showHeldCarts, setShowHeldCarts] = useState(false)

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
        notes: inv.notes, shift_id: currentShift?.id || null,
        store_id: activeStore?.id || null,
      }).select().single()

      if (!error && saved) {
        await supabase.from('pos_invoice_items').insert(
          inv.items.map(item => ({ invoice_id: saved.id, ...item }))
        )
        inv.id = saved.id

        // Debt tracking — update customer balance if credit/debt payment
        if (cart.customer?.id && ['credit','debt'].includes(cart.paymentMethod)) {
          const { data: cust } = await supabase.from('customers').select('balance').eq('id', cart.customer.id).single()
          await supabase.from('customers').update({ balance: (cust?.balance||0) + totals.total }).eq('id', cart.customer.id)
        }

        // Loyalty points — 1 point per dirham spent
        if (cart.customer?.id && totals.total > 0) {
          const pts = Math.floor(totals.total)
          const { data: cust } = await supabase.from('customers').select('loyalty_pts').eq('id', cart.customer.id).single()
          await supabase.from('customers').update({ loyalty_pts: (cust?.loyalty_pts||0) + pts }).eq('id', cart.customer.id)
          await supabase.from('loyalty_transactions').insert({ customer_id: cart.customer.id, invoice_id: saved.id, type:'earn', points: pts })
        }
      }
    } catch(e) { /* offline - still works */ }

    setLastInvoice(inv)
    toast.success('✔ تم حفظ الفاتورة')

    // WhatsApp receipt if customer has phone
    const phone = cart.customer?.phone || ''
    if (phone) {
      const msg = `🧾 فاتورة #${inv.order_number}\n${inv.items.map(i=>`• ${i.product_name} ×${i.quantity||i.qty} = ${fmt(i.total)} ${cur}`).join('\n')}\n━━━━━━━━━\nالمجموع: ${fmt(inv.total)} ${cur}\nشكراً لتسوقكم معنا 🙏`
      const waUrl = buildWhatsApp(phone, msg)
      toast((t) => (
        <span>
          <a href={waUrl} target="_blank" rel="noreferrer" className="underline font-bold text-green-600">📱 إرسال الفاتورة واتساب</a>
          <button onClick={() => toast.dismiss(t.id)} className="mr-2 text-xs opacity-50">✕</button>
        </span>
      ), { duration: 8000 })
    }

    cart.clear()
    setTimeout(() => window.print(), 300)
  }

  const [invoiceFilter, setInvoiceFilter] = useState({ from: new Date().toISOString().slice(0,10), to: new Date().toISOString().slice(0,10), customer: '' })
  const [expandedInv, setExpandedInv]     = useState(null)

  const loadInvoices = async (filter) => {
    const f = filter || invoiceFilter
    setShowInvoiceList(true)
    try {
      const from = f.from + 'T00:00:00'
      const to   = f.to   + 'T23:59:59'
      let q = supabase.from('pos_invoices')
        .select('*, pos_invoice_items(*)')
        .gte('created_at', from).lte('created_at', to)
        .order('created_at', { ascending: false })
      if (f.customer) q = q.ilike('customer_name', `%${f.customer}%`)
      const { data } = await q
      setInvoices(data || [])
    } catch(e) {
      setInvoices([])
    }
  }

  const openCustomer = async () => {
    setShowCustomer(true)
    const { data } = await supabase.from('customers').select('*').order('name')
    setCustomers(data || [])
  }

  const saveNewCustomer = async () => {
    if (!newCust.name.trim()) return
    const { data } = await supabase.from('customers').insert({ name: newCust.name.trim(), phone: newCust.phone.trim() }).select().single()
    if (data) {
      setCustomers(c => [data, ...c])
      cart.setCustomer(data)
      setNewCust({ name:'', phone:'' })
      setShowCustomer(false)
    }
  }

  const reprintInvoice = (inv) => {
    setLastInvoice({ ...inv, items: inv.pos_invoice_items || [] })
    setTimeout(() => window.print(), 300)
  }

  const { currentShift, openShift, closeShift } = useShiftStore()
  const { stores, activeStore, loadStores, setActiveStore } = useStoreContext()
  const [showStorePicker, setShowStorePicker] = useState(false)
  useEffect(() => { loadStores() }, [])
  const [openingCash, setOpeningCash]   = useState('')
  const [closingCash, setClosingCash]   = useState('')
  const [showCloseShift, setShowCloseShift] = useState(false)
  const searchRef = useRef(null)

  // Barcode: auto-add when exact barcode match
  const products = filteredProducts(activeStore?.id || null)
  useEffect(() => {
    if (!searchQ.trim()) return
    const exact = products.find(p => p.barcode && p.barcode === searchQ.trim())
    if (exact) {
      addItem(exact)
      setSearchQ('')
    }
  }, [searchQ])

  // Auto-focus search (barcode scanner support)
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key.length === 1) searchRef.current?.focus()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Shift gate
  if (!currentShift) return (
    <div className="flex items-center justify-center h-full bg-gray-50 font-arabic" dir="rtl">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-80 text-center">
        <div className="text-5xl mb-4">🏪</div>
        <h2 className="font-black text-xl mb-2">فتح الوردية</h2>
        <p className="text-muted text-sm mb-4">أدخل رصيد الصندوق الافتتاحي</p>
        <input type="number" value={openingCash} onChange={e=>setOpeningCash(e.target.value)}
          className="inp text-lg font-black text-center mb-4" placeholder="0.00" min="0" step="0.01" />
        <button onClick={() => openShift(parseFloat(openingCash)||0, profile?.id)}
          className="w-full bg-primary text-white font-black py-3 rounded-xl text-lg">
          ✔ فتح الوردية
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-full overflow-hidden font-arabic" dir="rtl">

      {/* ── LEFT — Action Panel ── */}
      <div className="w-24 bg-[#1e293b] flex flex-col flex-shrink-0 overflow-hidden">
        {/* Scrollable top section */}
        <div className="flex flex-col gap-1 p-1.5 flex-1 overflow-y-auto">
        {[
          { icon:'👤', label:'الزبون',   color:'bg-blue-500',  action: openCustomer },
          { icon:'🗑️', label:'حذف فاتورة', color:'bg-red-600', action: () => { if(confirm('حذف الفاتورة؟')) cart.clear() } },
          { icon:'❌', label:'حذف سلعة', color:'bg-red-500',   action: () => cart.items.length && cart.deleteItem(cart.items[cart.items.length-1].id) },
          { icon:'↩',  label:'إرجاع',    color:'bg-orange-500', action: () => cart.setReturnMode(!cart.returnMode) },
          { icon:'💬', label:'ملاحظات',  color:'bg-slate-600',  action: () => setShowNotes(true) },
          { icon:'📋', label:'الفواتير', color:'bg-purple-600', action: loadInvoices },
          { icon:'🔒', label:'إغلاق',   color:'bg-gray-700',   action: () => setShowCloseShift(true) },
        ].map(btn => (
          <button key={btn.label} onClick={btn.action}
            className={`${btn.color} text-white rounded-lg p-2 text-center text-[10px] font-bold flex flex-col items-center gap-0.5 transition-all active:scale-95 ${btn.label==='إرجاع' && cart.returnMode ? 'ring-2 ring-white' : ''}`}>
            <span className="text-base">{btn.icon}</span>
            <span>{btn.label}</span>
          </button>
        ))}

        {/* Store switcher */}
        <button onClick={() => setShowStorePicker(true)}
          className="text-white rounded-lg p-2 text-center text-[10px] font-bold flex flex-col items-center gap-0.5 transition-all active:scale-95 border-2 border-white/30"
          style={{ backgroundColor: activeStore?.color || '#475569' }}>
          <span className="text-base">{activeStore?.icon || '🏪'}</span>
          <span className="leading-tight text-center">{activeStore?.name || 'رئيسي'}</span>
        </button>

        {/* Hold button — always visible, badge shows count */}
        <button onClick={() => {
            if (cart.items.length) { cart.holdCart(); toast.success('تم تعليق الفاتورة') }
            else setShowHeldCarts(true)
          }}
          className="bg-yellow-500 text-white rounded-lg p-2 text-center text-[10px] font-bold flex flex-col items-center gap-0.5 transition-all active:scale-95 relative">
          <span className="text-base">⏸️</span>
          <span>تعليق</span>
          {cart.heldCarts.length > 0 && (
            <span className="absolute -top-1 -left-1 bg-danger text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">{cart.heldCarts.length}</span>
          )}
        </button>

        {/* Held carts button — only when held carts exist */}
        {cart.heldCarts.length > 0 && (
          <button onClick={() => setShowHeldCarts(true)}
            className="bg-amber-600 text-white rounded-lg p-2 text-center text-[10px] font-bold flex flex-col items-center gap-0.5 transition-all active:scale-95 relative">
            <span className="text-base">📂</span>
            <span>معلقة ({cart.heldCarts.length})</span>
          </button>
        )}

        </div>

        {/* Logout — always pinned to bottom */}
        <button onClick={signOut}
          className="bg-red-700 hover:bg-red-600 text-white p-2 text-center text-[10px] font-bold flex flex-col items-center gap-0.5 transition-all active:scale-95 flex-shrink-0 border-t border-white/10">
          <span className="text-base">🚪</span>
          <span>خروج</span>
        </button>
      </div>

      {/* ── CENTER — Search + Categories + Grid ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
        {/* Search bar */}
        <div className="flex gap-2 p-2 bg-white border-b border-gray-100">
          <input
            ref={searchRef}
            value={searchQ} onChange={e => setSearchQ(e.target.value)}
            className="inp flex-1" placeholder="🔍 بحث بالاسم أو الباركود..."
            autoFocus
          />
          <div className="flex gap-2 text-xs text-muted items-center">
            <span>المجموع: <b className="text-primary">{fmt(totals.total)} {cur}</b></span>
            {totals.change > 0 && <span>الباقي: <b className="text-success">{fmt(totals.change)}</b></span>}
          </div>
        </div>

        {/* Category tabs */}
        <CategoryTabs active={activeCat} setActive={setActiveCat} categories={categories} />

        {/* Products */}
        <div className="flex-1 overflow-hidden min-h-0">
          <ProductGrid products={products} onAdd={cart.returnMode ? cart.returnItem : addItem} returnMode={cart.returnMode} />
        </div>
      </div>

      {/* ── RIGHT — Cart + Payment Buttons ── */}
      <div className={`${cartOpen ? 'w-64' : 'w-10'} bg-white border-r border-gray-100 flex flex-col flex-shrink-0 shadow-lg transition-all duration-200`}>
        {/* Cart header */}
        <div className="flex items-center gap-1 px-2 py-2 border-b border-gray-100 bg-gray-50">
          {cartOpen && <h2 className="font-black text-sm text-gray-800 flex-1">🧾 الفاتورة</h2>}
          <button onClick={() => setCartOpen(o => !o)}
            className="text-gray-500 hover:text-primary text-base font-black leading-none ml-auto">
            {cartOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Cart customer */}
        {cartOpen && cart.customer && (
          <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-100 text-xs font-bold text-blue-700 flex items-center justify-between">
            <span>👤 {cart.customer.name}</span>
            <button onClick={() => cart.setCustomer(null)} className="text-blue-400 hover:text-danger text-xs">✕</button>
          </div>
        )}

        {/* Items */}
        {cartOpen && <>
        <div className="flex-1 overflow-y-auto px-3 py-1">
          {cart.items.length === 0
            ? <p className="text-center text-muted text-sm mt-6">السلة فارغة</p>
            : cart.items.map(item => <CartRow key={`${item.id}-${item.isReturn}`} item={item} currency={cur} selected={selectedItem === item.id} editing={editingItem === item.id} onSelect={setSelectedItem} onEdit={setEditingItem} />)
          }
        </div>

        {/* Totals */}
        <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
          <div className="space-y-0.5 text-xs">

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
          </div>
        </div>

        {/* Payment button */}
        <div className="p-2 border-t border-gray-100 bg-gray-50">
          <button onClick={() => cart.items.length && setShowPayment(true)}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-black py-3 rounded-xl text-sm transition-colors active:scale-95 shadow-sm">
            ✔ تأكيد الدفع — {fmt(totals.total)} {cur}
          </button>
        </div>
        </>}
      </div>

      {/* ── PAYMENT MODAL ── */}
      <PaymentModal open={showPayment} onClose={() => setShowPayment(false)}
        totals={totals} currency={cur} onConfirm={handleConfirm} />

      {/* ── CUSTOMER MODAL ── */}
      {showCustomer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center animate-fade-in" onClick={() => setShowCustomer(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-md max-h-[85vh] flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="font-black">👤 الزبون</h2>
              <button onClick={() => setShowCustomer(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            {/* Add new */}
            <div className="p-3 border-b bg-gray-50">
              <p className="text-xs font-bold text-muted mb-2">زبون جديد</p>
              <div className="flex gap-2 mb-2">
                <input value={newCust.name} onChange={e => setNewCust(c => ({...c, name: e.target.value}))}
                  className="inp text-sm flex-1" placeholder="الاسم *" />
                <input value={newCust.phone} onChange={e => setNewCust(c => ({...c, phone: e.target.value}))}
                  className="inp text-sm w-32" placeholder="الهاتف" />
              </div>
              <button onClick={saveNewCustomer} className="w-full bg-primary text-white text-xs font-black py-1.5 rounded-lg">+ إضافة وتحديد</button>
            </div>
            {/* Search */}
            <div className="px-3 pt-2">
              <input value={custSearch} onChange={e => setCustSearch(e.target.value)}
                className="inp text-sm" placeholder="🔍 بحث بالاسم أو الهاتف..." />
            </div>
            {/* List */}
            <div className="overflow-y-auto flex-1 px-3 pb-3">
              {cart.customer && (
                <div className="flex items-center justify-between py-2 border-b border-primary/20 text-primary text-xs font-bold">
                  <span>✔ {cart.customer.name}</span>
                  <button onClick={() => { cart.setCustomer(null); setShowCustomer(false) }} className="text-danger">إزالة</button>
                </div>
              )}
              {customers
                .filter(c => !custSearch || c.name?.includes(custSearch) || c.phone?.includes(custSearch))
                .map(c => (
                  <div key={c.id} onClick={() => { cart.setCustomer(c); setShowCustomer(false) }}
                    className={`flex items-center justify-between py-2 border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${cart.customer?.id === c.id ? 'text-primary font-black' : ''}`}>
                    <div>
                      <p className="text-sm font-bold">{c.name}</p>
                      {c.phone && <p className="text-xs text-muted">{c.phone}</p>}
                    </div>
                    {cart.customer?.id === c.id && <span className="text-primary">✔</span>}
                  </div>
                ))
              }
            </div>
          </div>
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

      {/* ── INVOICE LIST MODAL ── */}
      {showInvoiceList && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col font-arabic" dir="rtl">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-primary text-white flex-shrink-0">
            <h2 className="font-black text-base flex-1">📋 الفواتير</h2>
            <button onClick={() => setShowInvoiceList(false)} className="text-white/80 hover:text-white text-xl">✕</button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b flex-shrink-0 flex-wrap">
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
            <div className="text-xs text-muted whitespace-nowrap">
              {invoices.length} فاتورة — <b className="text-primary">{fmt(invoices.reduce((s,i) => s + (i.total||0), 0))} {cur}</b>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {invoices.length === 0
              ? <p className="text-center text-muted text-sm mt-10">لا توجد فواتير في هذه الفترة</p>
              : invoices.map(inv => (
                <div key={inv.id} className="border-b">
                  {/* Row */}
                  <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedInv(expandedInv === inv.id ? null : inv.id)}>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm text-gray-800">{inv.order_number}</p>
                      <p className="text-xs text-muted">{fmtDate(inv.created_at)} — {inv.payment_label || inv.payment_method}</p>
                      {inv.customer_name && <p className="text-xs text-blue-600">👤 {inv.customer_name}</p>}
                    </div>
                    <div className="text-left flex-shrink-0">
                      <p className="font-black text-primary">{fmt(inv.total)} {cur}</p>
                      <p className="text-[10px] text-muted">{(inv.pos_invoice_items||[]).length} صنف</p>
                    </div>
                    <span className="text-gray-400 text-xs">{expandedInv === inv.id ? '▲' : '▼'}</span>
                  </div>

                  {/* Expanded details */}
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
                            <tr key={i} className="border-b border-gray-100">
                              <td className="py-0.5">{it.isReturn && '↩ '}{it.product_name}</td>
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
                        <div className="flex justify-between font-black"><span>الإجمالي</span><span className="text-primary">{fmt(inv.total)} {cur}</span></div>
                        {inv.amount_paid > 0 && <div className="flex justify-between text-muted"><span>المدفوع</span><span>{fmt(inv.amount_paid)}</span></div>}
                        {inv.change_given > 0 && <div className="flex justify-between text-success"><span>الباقي</span><span>{fmt(inv.change_given)}</span></div>}
                        {inv.notes && <div className="text-muted mt-1">ملاحظات: {inv.notes}</div>}
                      </div>
                      <button onClick={() => reprintInvoice(inv)}
                        className="mt-2 w-full bg-primary text-white text-xs font-black py-1.5 rounded-lg">🖨️ طباعة</button>
                    </div>
                  )}
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* ── CLOSE SHIFT MODAL ── */}
      {showCloseShift && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-fade-in" onClick={() => setShowCloseShift(false)}>
          <div className="bg-white rounded-2xl p-6 w-80 animate-slide-up" onClick={e=>e.stopPropagation()}>
            <h2 className="font-black text-lg mb-4">🔒 إغلاق الوردية</h2>
            <p className="text-xs text-muted mb-1">رصيد الافتتاح: <b>{fmt(currentShift?.opening_cash||0)} {cur}</b></p>
            <p className="text-xs text-muted mb-3">فُتحت: {currentShift ? new Date(currentShift.opened_at).toLocaleTimeString('ar') : ''}</p>
            <label className="text-sm font-bold block mb-1">النقود الفعلية في الصندوق</label>
            <input type="number" value={closingCash} onChange={e=>setClosingCash(e.target.value)}
              className="inp text-lg font-black mb-4" placeholder="0.00" />
            <button onClick={async () => {
              await closeShift(parseFloat(closingCash)||0, '')
              setShowCloseShift(false)
              setClosingCash('')
              toast.success('تم إغلاق الوردية')
            }} className="w-full bg-danger text-white font-black py-3 rounded-xl">
              ✔ إغلاق الوردية
            </button>
            <button onClick={() => setShowCloseShift(false)}
              className="w-full bg-gray-100 text-gray-700 font-bold py-2 rounded-xl mt-2">إلغاء</button>
          </div>
        </div>
      )}

      {/* ── PRINT AREA (hidden, shown on print) ── */}
      <PrintView invoice={lastInvoice} settings={settings} />
    </div>
  )
}
