import { useState, useEffect } from 'react'
import { useSettingsStore } from '../../stores/settingsStore.js'
import { useProductsStore } from '../../stores/productsStore.js'
import { useStoreContext } from '../../stores/storeContext.js'
import { usePermissionsStore, PAGES } from '../../stores/permissionsStore.js'
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
    try {
      const { data, error } = await supabase.auth.signUp({
        email:    form.email,
        password: form.password,
        options:  { data: { full_name: form.full_name, role: form.role } },
      })

      if (error) throw error

      // user: null + no error = email already registered (Supabase hides this for security)
      if (!data?.user?.id) {
        toast.error('هذا البريد الإلكتروني مستخدم بالفعل')
        setLoad(false)
        return
      }

      const userId = data.user.id

      // Save profile
      await supabase.from('profiles').upsert({
        id:        userId,
        full_name: form.full_name,
        role:      form.role,
        phone:     form.phone || null,
        email:     form.email,
      }, { onConflict: 'id' })

      // Check if email confirmation is needed
      const needsConfirm = !data.session
      if (needsConfirm) {
        toast.success('✔ تم إنشاء الحساب — يحتاج تأكيد البريد', { duration: 6000 })
        toast('💡 لتجاوز التأكيد: Supabase → Auth → Settings → عطّل Email Confirmations', { duration: 8000, icon: '⚙️' })
      } else {
        toast.success('✔ تم إنشاء المستخدم')
      }

      setForm({ email:'', password:'', full_name:'', role:'vendor', phone:'' })
      setShow(false)
      loadUsers()
    } catch (err) {
      toast.error(err.message || 'فشل إنشاء المستخدم')
    }
    setLoad(false)
  }

  const ROLE_COLORS = {
    admin:         'bg-purple-100 text-purple-700',
    cashier:       'bg-blue-100 text-blue-700',
    stock_manager: 'bg-orange-100 text-orange-700',
    vendor:        'bg-green-100 text-green-700',
    store_manager:   'bg-teal-100 text-teal-700',
    delivery:        'bg-cyan-100 text-cyan-700',
    assistant:       'bg-gray-100 text-gray-600',
    trusted_partner: 'bg-amber-100 text-amber-700',
  }

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
                <option value="stock_manager">📦 مسؤول مخزن</option>
                <option value="store_manager">🏪 مسؤول فرع</option>
                <option value="delivery">🚚 موصل</option>
                <option value="assistant">👷 مساعد</option>
                <option value="trusted_partner">🤝 شريك موثوق</option>
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

// ── Stores Tab ───────────────────────────────────────────────
const STORE_COLORS = ['#1a56db','#16a34a','#dc2626','#d97706','#7c3aed','#0891b2','#db2777','#65a30d']
const STORE_ICONS  = ['🏬','🏪','🛒','🛍️','🍎','🧴','🥩','🥐','🧀','🍫','🧹','💊']

function StoresTab() {
  const { stores, loadStores, addStore, updateStore, deleteStore } = useStoreContext()
  const [form, setForm] = useState({ name:'', address:'', color:'#1a56db', icon:'🏬' })
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadStores() }, [])

  const save = async () => {
    if (!form.name.trim()) { toast.error('أدخل اسم الفرع'); return }
    setSaving(true)
    const payload = { name: form.name.trim(), address: form.address, color: form.color, icon: form.icon }
    const { error } = editId ? await updateStore(editId, payload) : await addStore(payload)
    setSaving(false)
    if (error) { toast.error('فشل الحفظ: ' + error.message); return }
    toast.success(editId ? 'تم تحديث الفرع' : 'تم إضافة الفرع')
    setForm({ name:'', address:'', color:'#1a56db', icon:'🏬' })
    setShowForm(false); setEditId(null)
  }

  const del = async (id) => {
    if (!confirm('حذف هذا الفرع؟')) return
    const { error } = await deleteStore(id)
    if (error) { toast.error('فشل الحذف: ' + error.message); return }
    toast.success('تم الحذف')
  }

  const startEdit = (s) => {
    setForm({ name: s.name, address: s.address||'', color: s.color||'#1a56db', icon: s.icon||'🏬' })
    setEditId(s.id); setShowForm(true)
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-black text-lg">🏬 الفروع / نقاط البيع</h2>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ name:'', address:'', color:'#1a56db', icon:'🏬' }) }}
          className="bg-primary text-white font-bold px-4 py-2 rounded-xl text-sm">+ فرع جديد</button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-gray-50 rounded-2xl p-4 mb-4 border border-gray-200 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">اسم الفرع *</label>
              <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="inp" placeholder="مثال: فرع الحي الجديد" />
            </div>
            <div className="col-span-2">
              <label className="label">العنوان</label>
              <input value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} className="inp" placeholder="اختياري" />
            </div>
          </div>
          {/* Icon picker */}
          <div>
            <label className="label">الأيقونة</label>
            <div className="flex gap-2 flex-wrap">
              {STORE_ICONS.map(ic => (
                <button key={ic} onClick={() => setForm(f=>({...f,icon:ic}))}
                  className={`text-xl p-1.5 rounded-lg border-2 ${form.icon===ic ? 'border-primary bg-primary/10' : 'border-gray-200'}`}>{ic}</button>
              ))}
            </div>
          </div>
          {/* Color picker */}
          <div>
            <label className="label">اللون</label>
            <div className="flex gap-2">
              {STORE_COLORS.map(c => (
                <button key={c} onClick={() => setForm(f=>({...f,color:c}))}
                  className={`w-8 h-8 rounded-full border-4 ${form.color===c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          {/* Preview */}
          <div className="flex items-center gap-2 p-2 bg-white rounded-xl border">
            <span className="text-2xl" style={{ color: form.color }}>{form.icon}</span>
            <span className="font-black" style={{ color: form.color }}>{form.name || 'معاينة'}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="flex-1 bg-primary text-white font-black py-2 rounded-xl disabled:opacity-60">{saving ? '...' : editId ? 'تحديث' : 'حفظ'}</button>
            <button onClick={() => { setShowForm(false); setEditId(null) }} className="flex-1 bg-gray-200 text-gray-700 font-black py-2 rounded-xl">إلغاء</button>
          </div>
        </div>
      )}

      {/* Main store card */}
      <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/20 mb-2">
        <span className="text-2xl">🏪</span>
        <div>
          <p className="font-black text-primary">المحل الرئيسي</p>
          <p className="text-xs text-muted">المنتجات الافتراضية (بدون فرع)</p>
        </div>
        <span className="mr-auto text-[10px] bg-primary text-white px-2 py-0.5 rounded-full font-bold">رئيسي</span>
      </div>

      {/* Sub stores */}
      {stores.map(s => (
        <div key={s.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 mb-2">
          <span className="text-2xl" style={{ color: s.color }}>{s.icon || '🏬'}</span>
          <div>
            <p className="font-black">{s.name}</p>
            {s.address && <p className="text-xs text-muted">{s.address}</p>}
          </div>
          <div className="mr-auto flex gap-2">
            <button onClick={() => startEdit(s)} className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg font-bold">تعديل</button>
            <button onClick={() => del(s.id)} className="text-xs bg-danger/10 text-danger hover:bg-danger/20 px-3 py-1.5 rounded-lg font-bold">حذف</button>
          </div>
        </div>
      ))}
      {stores.length === 0 && !showForm && (
        <p className="text-center text-muted py-8 text-sm">لا توجد فروع — أضف فرعاً للبدء</p>
      )}

      <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-700">
        <p className="font-bold mb-1">💡 كيف يعمل نظام الفروع:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>كل فرع له منتجاته الخاصة وأسعاره ومخزونه</li>
          <li>لإضافة منتجات لفرع: اذهب إلى صفحة المنتجات واختر الفرع</li>
          <li>في POS اضغط على زر الفرع للتبديل بين المحلات</li>
        </ul>
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

// ── Permissions Tab ───────────────────────────────────────────
const ROLES = [
  { key: 'cashier',       label: 'كاشير',       icon: '🛒', color: 'bg-blue-500' },
  { key: 'stock_manager', label: 'مخزن',        icon: '📦', color: 'bg-orange-500' },
  { key: 'vendor',        label: 'مندوب',       icon: '📋', color: 'bg-green-500' },
  { key: 'store_manager', label: 'مسؤول فرع',   icon: '🏪', color: 'bg-teal-500' },
  { key: 'delivery',      label: 'موصل',        icon: '🚚', color: 'bg-cyan-500' },
  { key: 'assistant',       label: 'مساعد',        icon: '👷', color: 'bg-gray-500' },
  { key: 'trusted_partner', label: 'شريك موثوق',  icon: '🤝', color: 'bg-amber-500' },
]

function PermissionsTab() {
  const { permissions, toggle, resetRole } = usePermissionsStore()
  const [selectedRole, setSelectedRole] = useState('cashier')
  const role = ROLES.find(r => r.key === selectedRole)

  return (
    <div className="p-4 overflow-auto" dir="rtl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-black text-lg">🔐 صلاحيات الوصول</h2>
        <p className="text-xs text-muted">المدير لديه صلاحية كاملة دائماً</p>
      </div>

      {/* Role selector tabs */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {ROLES.map(r => (
          <button
            key={r.key}
            onClick={() => setSelectedRole(r.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedRole === r.key
                ? `${r.color} text-white shadow`
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span>{r.icon}</span><span>{r.label}</span>
          </button>
        ))}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold">
          <span>👑</span><span>مدير — كل الصلاحيات</span>
        </div>
      </div>

      {/* Permissions for selected role */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
        <div className={`px-4 py-3 ${role.color} bg-opacity-10 border-b flex items-center gap-2`}
          style={{ backgroundColor: role.color.replace('bg-','') + '15' }}>
          <span className="text-lg">{role.icon}</span>
          <p className="font-black text-gray-800">{role.label}</p>
          <p className="text-xs text-gray-500 mr-1">— اختر الصفحات المسموح بها</p>
        </div>
        {PAGES.map((page) => {
          const on = permissions[selectedRole]?.[page.key] ?? false
          return (
            <div key={page.key}
              className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
              <span className="text-base">{page.icon}</span>
              <span className="flex-1 text-sm font-bold text-gray-800">{page.label}</span>
              <button
                onClick={() => toggle(selectedRole, page.key)}
                className={`w-11 h-6 rounded-full transition-all relative flex-shrink-0 ${on ? 'bg-primary' : 'bg-gray-200'}`}
                title={on ? 'انقر للإلغاء' : 'انقر للسماح'}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${on ? 'left-5' : 'left-0.5'}`} />
              </button>
              <span className={`text-xs font-bold w-10 text-left ${on ? 'text-primary' : 'text-gray-400'}`}>
                {on ? 'مسموح' : 'مقفل'}
              </span>
            </div>
          )
        })}
      </div>

      {/* Reset button */}
      <button
        onClick={() => { resetRole(selectedRole); toast.success('تم إعادة ضبط ' + role.label) }}
        className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold px-4 py-2 rounded-xl transition-colors"
      >
        🔄 إعادة ضبط {role.icon} {role.label} للإعدادات الافتراضية
      </button>

      <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-700">
        <p className="font-bold mb-1">💡 ملاحظة</p>
        <p>التغييرات تطبق فوراً — الموظف لن يرى الصفحات المقفلة في قائمة التنقل</p>
      </div>
    </div>
  )
}

// ── MAIN ADMIN PAGE ───────────────────────────────────────────
export default function AdminPage() {
  const [tab, setTab] = useState('settings')
  const TABS = [
    { id:'settings',     label:'⚙️ الإعدادات' },
    { id:'users',        label:'👥 المستخدمون' },
    { id:'permissions',  label:'🔐 الصلاحيات' },
    { id:'stores',       label:'🏬 الفروع' },
    { id:'stats',        label:'📊 الإحصائيات' },
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
        {tab === 'settings'    && <SettingsTab />}
        {tab === 'users'       && <UsersTab />}
        {tab === 'permissions' && <PermissionsTab />}
        {tab === 'stores'      && <StoresTab />}
        {tab === 'stats'       && <StatsTab />}
      </div>
    </div>
  )
}
