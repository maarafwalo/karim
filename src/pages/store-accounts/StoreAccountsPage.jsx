import { useState, useEffect } from 'react'
import { useStoreAccountsStore } from '../../stores/storeAccountsStore.js'
import { useStoreContext } from '../../stores/storeContext.js'
import { fmt } from '../../lib/utils.js'
import toast from 'react-hot-toast'

// ── Transaction type definitions ──────────────────────────────
const TXN_TYPES = {
  transfer: { label: 'بضاعة خرجت للفرع', icon: '📦', color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-100',    sign: +1 },
  payment:  { label: 'دفعية من الفرع',    icon: '💰', color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-100',  sign: -1 },
  return:   { label: 'إرجاع بضاعة',       icon: '🔄', color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-100',   sign: -1 },
  expense:  { label: 'مصروف على الفرع',   icon: '💸', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100', sign: +1 },
}

// ── Balance helper ─────────────────────────────────────────────
function calcBalance(txns) {
  const out = txns.filter(t => ['transfer','expense'].includes(t.type)).reduce((s,t) => s + Number(t.amount), 0)
  const inp = txns.filter(t => ['payment','return'].includes(t.type)).reduce((s,t) => s + Number(t.amount), 0)
  return { balance: out - inp, totalOut: out, totalIn: inp }
}

// ── Add Transaction Modal ──────────────────────────────────────
function AddTxnModal({ store, onClose, onAdd }) {
  const [form, setForm] = useState({
    type:   'transfer',
    amount: '',
    notes:  '',
    date:   new Date().toISOString().split('T')[0],
  })
  const [saving, setSaving] = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    const amt = parseFloat(form.amount)
    if (!amt || amt <= 0) { toast.error('أدخل مبلغاً صحيحاً'); return }
    setSaving(true)
    const { error } = await onAdd({ ...form, amount: amt, store_id: store.id })
    setSaving(false)
    if (!error) onClose()
  }

  const selected = TXN_TYPES[form.type]

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className={`px-5 py-4 ${selected.bg} border-b ${selected.border}`}>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{selected.icon}</span>
            <div>
              <p className="font-black text-gray-800">إضافة حركة</p>
              <p className="text-xs text-gray-600">{store.icon || '🏪'} {store.name}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handle} className="p-5 space-y-4">
          {/* Type selector */}
          <div>
            <label className="label">نوع الحركة</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(TXN_TYPES).map(([k, v]) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => setForm(f => ({ ...f, type: k }))}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-sm font-bold transition-all ${
                    form.type === k
                      ? `${v.bg} ${v.border.replace('border-','border-')} ${v.color} border-2`
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span>{v.icon}</span>
                  <span className="text-xs leading-tight">{v.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="label">المبلغ (درهم)</label>
            <input
              type="number" min="0.01" step="0.01"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="inp text-lg font-black"
              placeholder="0.00"
              required
              autoFocus
            />
          </div>

          {/* Date */}
          <div>
            <label className="label">التاريخ</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="inp"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="label">ملاحظات (اختياري)</label>
            <input
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="inp"
              placeholder="مثال: بضاعة رمضان، دفعة أولى..."
            />
          </div>

          {/* Preview */}
          <div className={`p-3 rounded-xl ${selected.bg} border ${selected.border} text-sm`}>
            <span className={`font-black ${selected.color}`}>
              {selected.sign > 0 ? '▲ يضاف على الفرع' : '▼ يطرح من رصيد الفرع'}
            </span>
            {form.amount && (
              <span className="mr-2 font-bold text-gray-700">{fmt(form.amount)} درهم</span>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-primary text-white font-black py-2.5 rounded-xl disabled:opacity-60 hover:bg-primary-dark transition-colors"
            >
              {saving ? '⏳ جارٍ الحفظ...' : '✔ حفظ الحركة'}
            </button>
            <button type="button" onClick={onClose} className="bg-gray-200 px-5 py-2.5 rounded-xl font-bold text-gray-700 hover:bg-gray-300">
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Store Summary Card ─────────────────────────────────────────
function StoreCard({ store, transactions, onSelect }) {
  const txns = transactions.filter(t => t.store_id === store.id)
  const { balance, totalOut, totalIn } = calcBalance(txns)
  const isOwed   = balance > 0
  const lastTxn  = txns[0]

  return (
    <div
      className="bg-white rounded-2xl border-2 border-gray-100 hover:border-primary/30 hover:shadow-lg transition-all cursor-pointer p-4 group"
      onClick={() => onSelect(store)}
    >
      {/* Store header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{ backgroundColor: store.color ? store.color + '20' : '#1a56db20' }}
        >
          {store.icon || '🏪'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-gray-900 truncate">{store.name}</p>
          {store.address && <p className="text-xs text-gray-500 truncate">{store.address}</p>}
        </div>
        <span className="text-gray-300 group-hover:text-primary transition-colors text-lg">←</span>
      </div>

      {/* Balance badge */}
      <div className={`rounded-xl p-3 mb-3 text-center ${isOwed ? 'bg-orange-50 border border-orange-100' : balance < 0 ? 'bg-green-50 border border-green-100' : 'bg-gray-50 border border-gray-100'}`}>
        <p className="text-xs text-gray-500 mb-1">{isOwed ? '⚠️ مديون' : balance < 0 ? '✅ دائن' : '✔ تسوية'}</p>
        <p className={`text-2xl font-black ${isOwed ? 'text-orange-700' : balance < 0 ? 'text-green-700' : 'text-gray-500'}`}>
          {fmt(Math.abs(balance))}
        </p>
        <p className="text-xs text-gray-500">درهم</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2 text-center text-xs mb-3">
        <div className="bg-red-50 rounded-xl p-2">
          <p className="font-black text-red-700 text-sm">{fmt(totalOut)}</p>
          <p className="text-gray-500">📦 خرج</p>
        </div>
        <div className="bg-green-50 rounded-xl p-2">
          <p className="font-black text-green-700 text-sm">{fmt(totalIn)}</p>
          <p className="text-gray-500">💰 دخل</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between text-[11px] text-gray-400">
        <span>{txns.length} حركة</span>
        {lastTxn && <span>آخر: {lastTxn.date}</span>}
      </div>
    </div>
  )
}

// ── Store Detail View ──────────────────────────────────────────
function StoreDetail({ store, transactions, onBack, onAdd, onDelete }) {
  const txns = transactions
    .filter(t => t.store_id === store.id)
    .sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date)
      return new Date(b.created_at) - new Date(a.created_at)
    })
  const { balance, totalOut, totalIn } = calcBalance(txns)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter]   = useState('all')

  const filtered = filter === 'all' ? txns : txns.filter(t => t.type === filter)

  // Running balance (oldest → newest reversed)
  let running = 0
  const withRunning = [...txns].reverse().map(t => {
    running += (TXN_TYPES[t.type]?.sign || 1) * Number(t.amount)
    return { ...t, running }
  }).reverse()

  const filteredWithRunning = filter === 'all' ? withRunning : withRunning.filter(t => t.type === filter)

  return (
    <div className="flex flex-col h-full overflow-hidden font-arabic bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b flex-shrink-0 shadow-sm">
        <button onClick={onBack} className="flex items-center gap-1 text-primary font-bold text-sm hover:text-primary-dark">
          → رجوع
        </button>
        <div className="w-px h-5 bg-gray-200" />
        <span className="text-xl">{store.icon || '🏪'}</span>
        <h2 className="font-black text-gray-900 flex-1">{store.name}</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-primary text-white font-bold px-4 py-2 rounded-xl text-sm hover:bg-primary-dark transition-colors"
        >
          ➕ إضافة حركة
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 p-4 flex-shrink-0">
        <div className="bg-red-50 rounded-2xl p-3 text-center border border-red-100">
          <p className="text-xs text-gray-500 mb-1">📦 إجمالي خرج</p>
          <p className="font-black text-red-700 text-xl">{fmt(totalOut)}</p>
          <p className="text-xs text-gray-500">درهم</p>
        </div>
        <div className="bg-green-50 rounded-2xl p-3 text-center border border-green-100">
          <p className="text-xs text-gray-500 mb-1">💰 إجمالي دخل</p>
          <p className="font-black text-green-700 text-xl">{fmt(totalIn)}</p>
          <p className="text-xs text-gray-500">درهم</p>
        </div>
        <div className={`rounded-2xl p-3 text-center border ${balance > 0 ? 'bg-orange-50 border-orange-200' : balance < 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-100 border-gray-200'}`}>
          <p className="text-xs text-gray-500 mb-1">⚖️ الرصيد</p>
          <p className={`font-black text-xl ${balance > 0 ? 'text-orange-700' : balance < 0 ? 'text-emerald-700' : 'text-gray-500'}`}>
            {fmt(Math.abs(balance))}
          </p>
          <p className={`text-xs font-bold ${balance > 0 ? 'text-orange-600' : balance < 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
            {balance > 0 ? 'عليه' : balance < 0 ? 'له' : 'مسوّى'}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 pb-3 flex-shrink-0">
        {[
          { k: 'all',      l: 'الكل' },
          { k: 'transfer', l: '📦 خرج' },
          { k: 'payment',  l: '💰 دفعيات' },
          { k: 'return',   l: '🔄 إرجاع' },
          { k: 'expense',  l: '💸 مصاريف' },
        ].map(({ k, l }) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === k ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-primary/50'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Transactions list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {filteredWithRunning.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-bold">لا توجد حركات</p>
            <p className="text-sm mt-1">اضغط "+ إضافة حركة" للبدء</p>
          </div>
        )}

        {filteredWithRunning.map(t => {
          const td     = TXN_TYPES[t.type] || {}
          const isDebt = ['transfer', 'expense'].includes(t.type)
          return (
            <div key={t.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 hover:border-gray-200 transition-colors group">
              <div className={`w-10 h-10 rounded-xl ${td.bg} flex items-center justify-center text-xl flex-shrink-0`}>
                {td.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm">{td.label}</p>
                {t.notes && <p className="text-xs text-gray-500 truncate">{t.notes}</p>}
                <p className="text-xs text-gray-400">{t.date}</p>
              </div>
              {filter === 'all' && (
                <div className="text-left text-xs text-gray-400 hidden sm:block">
                  <p>رصيد: {fmt(t.running)} د</p>
                </div>
              )}
              <div className="text-left">
                <p className={`font-black text-base ${isDebt ? 'text-red-600' : 'text-green-600'}`}>
                  {isDebt ? '+' : '-'}{fmt(t.amount)}
                </p>
                <p className="text-[10px] text-gray-400 text-left">درهم</p>
              </div>
              <button
                onClick={() => onDelete(t.id)}
                className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 text-sm flex-shrink-0"
                title="حذف"
              >🗑️</button>
            </div>
          )
        })}
      </div>

      {/* Add modal */}
      {showAdd && (
        <AddTxnModal
          store={store}
          onClose={() => setShowAdd(false)}
          onAdd={onAdd}
        />
      )}
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────
export default function StoreAccountsPage() {
  const { stores, loadStores } = useStoreContext()
  const { transactions, loading, load, addTransaction, deleteTransaction } = useStoreAccountsStore()
  const [selected, setSelected] = useState(null)
  const [search, setSearch]     = useState('')

  useEffect(() => {
    loadStores()
    load()
  }, [])

  const handleAdd = async (data) => {
    const { error } = await addTransaction(data)
    if (error) toast.error('فشل الحفظ: ' + (error.message || error.code))
    else toast.success('✔ تم تسجيل الحركة')
    return { error }
  }

  const handleDelete = async (id) => {
    if (!confirm('حذف هذه الحركة؟')) return
    const { error } = await deleteTransaction(id)
    if (error) toast.error('فشل الحذف')
    else toast.success('تم الحذف')
  }

  // ── Summary stats across all stores ──
  const grandBalance = transactions.reduce((s, t) => {
    return s + (TXN_TYPES[t.type]?.sign || 1) * Number(t.amount)
  }, 0)
  const grandOut = transactions.filter(t => ['transfer','expense'].includes(t.type)).reduce((s,t) => s+Number(t.amount), 0)
  const grandIn  = transactions.filter(t => ['payment','return'].includes(t.type)).reduce((s,t) => s+Number(t.amount), 0)

  const filteredStores = stores.filter(s => s.name.includes(search) || (s.address||'').includes(search))

  // Detail view
  if (selected) {
    return (
      <StoreDetail
        store={selected}
        transactions={transactions}
        onBack={() => setSelected(null)}
        onAdd={handleAdd}
        onDelete={handleDelete}
      />
    )
  }

  // Main list view
  return (
    <div className="flex flex-col h-full overflow-hidden font-arabic bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b flex-shrink-0 shadow-sm">
        <span className="text-xl">🏦</span>
        <h1 className="font-black text-lg text-gray-900">حسابات الفروع</h1>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="بحث عن فرع..."
          className="inp mr-auto w-48 text-sm"
        />
      </div>

      {/* Grand totals banner */}
      {transactions.length > 0 && (
        <div className="grid grid-cols-3 gap-3 p-4 bg-white border-b flex-shrink-0">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-0.5">📦 إجمالي خرج</p>
            <p className="font-black text-red-700 text-lg">{fmt(grandOut)}</p>
            <p className="text-xs text-gray-400">درهم</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-0.5">💰 إجمالي دخل</p>
            <p className="font-black text-green-700 text-lg">{fmt(grandIn)}</p>
            <p className="text-xs text-gray-400">درهم</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-0.5">⚖️ مجموع الرصيد</p>
            <p className={`font-black text-lg ${grandBalance > 0 ? 'text-orange-700' : 'text-emerald-700'}`}>
              {fmt(Math.abs(grandBalance))}
            </p>
            <p className="text-xs text-gray-400">{grandBalance >= 0 ? 'مديون' : 'دائن'}</p>
          </div>
        </div>
      )}

      {/* Stores grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="text-center py-16 text-gray-400">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p>جارٍ التحميل...</p>
          </div>
        )}

        {!loading && filteredStores.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-5xl mb-3">🏪</p>
            <p className="font-bold text-gray-600">لا توجد فروع بعد</p>
            <p className="text-sm mt-1">أضف الفروع من صفحة <strong>الإدارة ← الفروع</strong></p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStores.map(store => (
            <StoreCard
              key={store.id}
              store={store}
              transactions={transactions}
              onSelect={setSelected}
            />
          ))}
        </div>

        {/* Info box */}
        {filteredStores.length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 rounded-2xl border border-blue-100 text-sm text-blue-700">
            <p className="font-black mb-2">💡 كيف تستخدم الحسابات:</p>
            <ul className="space-y-1 list-disc list-inside text-xs">
              <li><strong>📦 بضاعة خرجت للفرع</strong> — كل ما تعطيه لميلود أو رضوان يُضاف على رصيدهم</li>
              <li><strong>💰 دفعية من الفرع</strong> — كل ما يدفعه يُطرح من الرصيد</li>
              <li><strong>🔄 إرجاع بضاعة</strong> — بضاعة رجعت دون بيع تُطرح من الرصيد</li>
              <li><strong>💸 مصروف على الفرع</strong> — مصاريف تحملتها أنت عن الفرع تُضاف على رصيده</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
