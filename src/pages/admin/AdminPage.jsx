import { useState, useEffect } from 'react'
import { useSettingsStore } from '../../stores/settingsStore.js'
import { useProductsStore } from '../../stores/productsStore.js'
import { supabase } from '../../lib/supabase.js'
import { fmt, fmtDate, ROLE_LABELS } from '../../lib/utils.js'
import toast from 'react-hot-toast'

// ── Settings Tab ─────────────────────────────────────────────
function SettingsTab() {
  const { settings, save } = useSettingsStore()
  const [form, setForm] = useState(settings)
  useEffect(() => setForm(settings), [settings])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async (e) => {
    e.preventDefault()
    const error = await save(form)
    if (error) toast.error('فشل الحفظ'); else toast.success('✔ تم حفظ الإعدادات')
  }

  return (
    <form onSubmit={handleSave} className="max-w-md space-y-4 p-4">
      <h2 className="font-black text-lg">⚙️ إعدادات المتجر</h2>
      {[
        { key:'store_name',   label:'اسم المتجر',           placeholder:'joud',           type:'text' },
        { key:'phone',        label:'رقم الواتساب',         placeholder:'212700000000',   type:'text' },
        { key:'currency',     label:'العملة',               placeholder:'درهم',           type:'text' },
        { key:'cashier_name', label:'اسم الكاشير الافتراضي', placeholder:'محمد',           type:'text' },
        { key:'tva_rate',     label:'نسبة TVA %',           placeholder:'0',              type:'number' },
      ].map(f => (
        <div key={f.key}>
          <label className="block text-sm font-bold text-gray-700 mb-1">{f.label}</label>
          <input type={f.type} value={form[f.key]||''} onChange={e=>set(f.key,f.type==='number'?parseFloat(e.target.value)||0:e.target.value)}
            className="inp" placeholder={f.placeholder} />
        </div>
      ))}
      <button type="submit" className="bg-primary text-white font-black px-6 py-3 rounded-xl hover:bg-primary-dark transition-colors">
        💾 حفظ الإعدادات
      </button>
    </form>
  )
}

// ── Users Tab ────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers]   = useState([])
  const [form, setForm]     = useState({ email:'', password:'', full_name:'', role:'vendor', phone:'' })
  const [loading, setLoad]  = useState(false)
  const [showForm, setShow] = useState(false)

  const loadUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setUsers(data || [])
  }
  useEffect(() => { loadUsers() }, [])

  const createUser = async (e) => {
    e.preventDefault()
    setLoad(true)
    // Use Supabase Admin to create user — requires Edge Function or service key setup
    const { error } = await supabase.auth.admin?.createUser?.({
      email: form.email, password: form.password,
      user_metadata: { full_name: form.full_name, role: form.role }
    }) || { error: null }
    if (error) { toast.error('فشل إنشاء المستخدم — تأكد من ضبط service key'); }
    else { toast.success('✔ تم إنشاء المستخدم'); setShow(false); loadUsers() }
    setLoad(false)
  }

  const ROLE_COLORS = { admin:'bg-purple-100 text-purple-700', cashier:'bg-blue-100 text-blue-700', stock_manager:'bg-orange-100 text-orange-700', vendor:'bg-green-100 text-green-700' }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-black text-lg">👥 المستخدمون</h2>
        <button onClick={() => setShow(true)} className="bg-primary text-white font-bold px-4 py-2 rounded-xl text-sm hover:bg-primary-dark">
          ➕ مستخدم جديد
        </button>
      </div>

      {/* New user form */}
      {showForm && (
        <div className="bg-gray-50 rounded-2xl p-4 mb-4 border border-gray-200">
          <form onSubmit={createUser} className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">الاسم الكامل</label><input value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} className="inp" required /></div>
            <div><label className="label">البريد الإلكتروني</label><input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} className="inp" required /></div>
            <div><label className="label">كلمة السر</label><input type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} className="inp" minLength={6} required /></div>
            <div><label className="label">الدور</label>
              <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))} className="inp">
                <option value="cashier">🛒 كاشير</option>
                <option value="vendor">📋 مندوب</option>
                <option value="stock_manager">📦 مخزن</option>
                <option value="admin">👑 مدير</option>
              </select>
            </div>
            <div><label className="label">الهاتف</label><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} className="inp" /></div>
            <div className="col-span-2 flex gap-2">
              <button type="submit" disabled={loading} className="bg-primary text-white font-bold px-5 py-2 rounded-xl disabled:opacity-60">
                {loading ? '...' : 'إضافة'}
              </button>
              <button type="button" onClick={() => setShow(false)} className="bg-gray-200 px-5 py-2 rounded-xl font-bold">إلغاء</button>
            </div>
          </form>
        </div>
      )}

      {/* Users list */}
      <div className="space-y-2">
        {users.map(u => (
          <div key={u.id} className="panel flex items-center gap-3 p-3">
            <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center font-black text-primary text-sm flex-shrink-0">
              {u.full_name?.charAt(0) || '؟'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">{u.full_name}</p>
              <p className="text-xs text-muted">{fmtDate(u.created_at)}</p>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role]||'bg-gray-100'}`}>
              {ROLE_LABELS[u.role] || u.role}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Stats Tab ─────────────────────────────────────────────────
function StatsTab() {
  const { products } = useProductsStore()
  const [invoices, setInvoices]   = useState([])
  const [orders, setOrders]       = useState([])
  const [loading, setLoad]        = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('pos_invoices').select('*').order('created_at',{ascending:false}).limit(10),
      supabase.from('catalog_orders').select('*').order('created_at',{ascending:false}).limit(10),
    ]).then(([inv, ord]) => {
      setInvoices(inv.data || [])
      setOrders(ord.data || [])
      setLoad(false)
    })
  }, [])

  const totalSales     = invoices.reduce((s, i) => s + (i.total||0), 0)
  const totalOrders    = orders.length
  const activeProducts = products.filter(p => p.is_active).length
  const oos            = products.filter(p => p.is_active && p.stock !== null && p.stock <= 0).length

  return (
    <div className="p-4">
      <h2 className="font-black text-lg mb-4">📊 الإحصائيات</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label:'إجمالي المبيعات', value: fmt(totalSales)+' دم', icon:'💰', color:'text-primary' },
          { label:'المنتجات النشطة', value: activeProducts, icon:'📦', color:'text-success' },
          { label:'طلبات الكتالوج', value: totalOrders, icon:'📋', color:'text-accent' },
          { label:'نفد المخزون',    value: oos, icon:'⚠️', color:'text-danger' },
        ].map(s => (
          <div key={s.label} className="panel p-3 text-center">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <h3 className="font-bold mb-2">🧾 آخر فواتير POS</h3>
      <div className="space-y-1 mb-5">
        {invoices.map(inv => (
          <div key={inv.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg text-xs">
            <span className="font-bold">{inv.order_number}</span>
            <span className="text-muted">{fmtDate(inv.created_at)}</span>
            <span className="font-black text-primary">{fmt(inv.total)} دم</span>
          </div>
        ))}
        {!invoices.length && <p className="text-muted text-xs text-center py-4">لا توجد فواتير بعد</p>}
      </div>

      <h3 className="font-bold mb-2">📋 آخر طلبات الكتالوج</h3>
      <div className="space-y-1">
        {orders.map(ord => (
          <div key={ord.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg text-xs">
            <span className="font-bold">{ord.order_number}</span>
            <span className="text-muted">{ord.customer_name || '—'}</span>
            <span className="font-black text-success">{fmt(ord.total)} دم</span>
          </div>
        ))}
        {!orders.length && <p className="text-muted text-xs text-center py-4">لا توجد طلبات بعد</p>}
      </div>
    </div>
  )
}

// ── MAIN ADMIN PAGE ───────────────────────────────────────────
export default function AdminPage() {
  const [tab, setTab] = useState('settings')
  const TABS = [
    { id:'settings', label:'⚙️ الإعدادات' },
    { id:'users',    label:'👥 المستخدمون' },
    { id:'stats',    label:'📊 الإحصائيات' },
  ]
  return (
    <div className="flex flex-col h-full overflow-hidden font-arabic" dir="rtl">
      {/* Tab bar */}
      <div className="flex gap-1 p-2 bg-white border-b border-gray-100 flex-shrink-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 text-sm font-bold py-2 rounded-xl transition-all ${tab===t.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === 'settings' && <SettingsTab />}
        {tab === 'users'    && <UsersTab />}
        {tab === 'stats'    && <StatsTab />}
      </div>
    </div>
  )
}
