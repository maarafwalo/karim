import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useSettingsStore } from '../../stores/settingsStore.js'
import { useAuthStore } from '../../stores/authStore.js'
import { fmt, fmtDate } from '../../lib/utils.js'
import toast from 'react-hot-toast'

export default function DebtPage() {
  const { settings } = useSettingsStore()
  const { profile }  = useAuthStore()
  const cur = settings?.currency || 'درهم'

  const [tab, setTab] = useState('customers') // 'customers' | 'suppliers' | 'employees'

  // ── CUSTOMER DEBT ──────────────────────────────────────────
  const [customers, setCustomers]       = useState([])
  const [selCustomer, setSelCustomer]   = useState(null)
  const [custInvoices, setCustInvoices] = useState([])
  const [custPayments, setCustPayments] = useState([])
  const [payAmt, setPayAmt]             = useState('')
  const [payNote, setPayNote]           = useState('')
  const [loadingCust, setLoadingCust]   = useState(false)

  // ── SUPPLIER DEBT ──────────────────────────────────────────
  const [suppliers, setSuppliers]         = useState([])
  const [supplierDebts, setSupplierDebts] = useState([])
  const [selSupplier, setSelSupplier]     = useState(null)
  const [supPayments, setSupPayments]     = useState([])
  const [supPayAmt, setSupPayAmt]         = useState('')
  const [supPayNote, setSupPayNote]       = useState('')
  const [newDebt, setNewDebt]             = useState({ supplier_id:'', amount:'', description:'' })
  const [loadingSup, setLoadingSup]       = useState(false)

  // ── EMPLOYEE DEBT ──────────────────────────────────────────
  const [employees, setEmployees]         = useState([])
  const [employeeDebts, setEmployeeDebts] = useState([])   // ALL debts (any status)
  const [empAllPayments, setEmpAllPayments] = useState([]) // ALL payments across all employees
  const [selEmployee, setSelEmployee]     = useState(null)
  const [empPayments, setEmpPayments]     = useState([])   // payments for selected employee
  const [empPayAmt, setEmpPayAmt]         = useState('')
  const [empPayNote, setEmpPayNote]       = useState('')
  const [newEmpDebt, setNewEmpDebt]       = useState({ employee_id:'', amount:'', type:'salary', description:'' })
  const [newEmployee, setNewEmployee]     = useState({ name:'', role:'', phone:'', monthly_salary:'' })
  const [showAddEmp, setShowAddEmp]       = useState(false)
  const [loadingEmp, setLoadingEmp]       = useState(false)

  // ─────────────────────────────────────────────────────────
  const loadCustomers = async () => {
    setLoadingCust(true)
    const { data } = await supabase.from('customers')
      .select('*').gt('balance', 0).order('balance', { ascending: false })
    setCustomers(data || [])
    setLoadingCust(false)
  }

  const loadSuppliers = async () => {
    setLoadingSup(true)
    const { data: sups }  = await supabase.from('suppliers').select('*').order('name')
    const { data: debts } = await supabase.from('supplier_debts').select('*').eq('status','open').order('created_at', { ascending: false })
    setSuppliers(sups || [])
    setSupplierDebts(debts || [])
    setLoadingSup(false)
  }

  const loadEmployees = async () => {
    setLoadingEmp(true)
    const [{ data: emps }, { data: debts }, { data: pays }] = await Promise.all([
      supabase.from('employees').select('*').order('name'),
      supabase.from('employee_debts').select('*').order('created_at', { ascending: false }),
      supabase.from('employee_debt_payments').select('*').order('created_at', { ascending: false }),
    ])
    setEmployees(emps || [])
    setEmployeeDebts(debts || [])
    setEmpAllPayments(pays || [])
    setLoadingEmp(false)
  }

  // net balance per employee: positive = store owes, negative = employee owes store
  const empNetBalance = (empId) => {
    const owed = employeeDebts.filter(d => d.employee_id === empId).reduce((s,d) => s + (d.amount||0), 0)
    const paid = empAllPayments.filter(p => p.employee_id === empId).reduce((s,p) => s + (p.amount||0), 0)
    return owed - paid
  }

  useEffect(() => { loadCustomers(); loadSuppliers(); loadEmployees() }, [])

  // ── Customer detail ──────────────────────────────────────
  const openCustomer = async (c) => {
    setSelCustomer(c)
    setPayAmt('')
    setPayNote('')
    const [{ data: invs }, { data: pays }] = await Promise.all([
      supabase.from('pos_invoices').select('*')
        .eq('customer_id', c.id)
        .in('payment_method', ['credit','debt'])
        .order('created_at', { ascending: false }),
      supabase.from('debt_payments').select('*')
        .eq('customer_id', c.id)
        .order('created_at', { ascending: false }),
    ])
    setCustInvoices(invs || [])
    setCustPayments(pays || [])
  }

  const recordCustPayment = async () => {
    const amount = parseFloat(payAmt)
    if (!selCustomer || isNaN(amount) || amount <= 0) { toast.error('أدخل المبلغ'); return }
    await supabase.from('debt_payments').insert({
      customer_id: selCustomer.id,
      amount,
      notes: payNote || null,
      cashier_id: profile?.id,
    })
    const newBalance = Math.max(0, (selCustomer.balance || 0) - amount)
    await supabase.from('customers').update({ balance: newBalance }).eq('id', selCustomer.id)
    toast.success(`تم تسجيل دفعة ${fmt(amount)} ${cur}`)
    setPayAmt('')
    setPayNote('')
    const updated = { ...selCustomer, balance: newBalance }
    setSelCustomer(updated)
    setCustomers(cs => cs.map(c => c.id === selCustomer.id ? updated : c).filter(c => c.balance > 0))
    openCustomer(updated)
  }

  // ── Supplier debt ──────────────────────────────────────
  const openSupplier = async (s) => {
    setSelSupplier(s)
    setSupPayAmt('')
    setSupPayNote('')
    const { data } = await supabase.from('supplier_debt_payments').select('*')
      .eq('supplier_id', s.id).order('created_at', { ascending: false })
    setSupPayments(data || [])
  }

  const addSupplierDebt = async () => {
    const amount = parseFloat(newDebt.amount)
    if (!newDebt.supplier_id || isNaN(amount) || amount <= 0) { toast.error('اختر المورد وأدخل المبلغ'); return }
    await supabase.from('supplier_debts').insert({
      supplier_id: newDebt.supplier_id,
      amount,
      description: newDebt.description || null,
      status: 'open',
    })
    toast.success('تم تسجيل الدين')
    setNewDebt({ supplier_id:'', amount:'', description:'' })
    loadSuppliers()
  }

  const recordSupPayment = async () => {
    const amount = parseFloat(supPayAmt)
    if (!selSupplier || isNaN(amount) || amount <= 0) { toast.error('أدخل المبلغ'); return }
    await supabase.from('supplier_debt_payments').insert({
      supplier_id: selSupplier.id,
      amount,
      notes: supPayNote || null,
    })
    const { data: openDebts } = await supabase.from('supplier_debts')
      .select('*').eq('supplier_id', selSupplier.id).eq('status','open').order('created_at')
    let remaining = amount
    for (const debt of (openDebts||[])) {
      if (remaining <= 0) break
      const paid    = Math.min(remaining, debt.amount - (debt.paid||0))
      const newPaid = (debt.paid||0) + paid
      remaining -= paid
      await supabase.from('supplier_debts').update({
        paid: newPaid,
        status: newPaid >= debt.amount ? 'closed' : 'open',
      }).eq('id', debt.id)
    }
    toast.success(`تم تسجيل دفعة ${fmt(amount)} ${cur}`)
    setSupPayAmt('')
    setSupPayNote('')
    loadSuppliers()
    openSupplier(selSupplier)
  }

  // ── Employee debt ──────────────────────────────────────
  const openEmployee = async (e) => {
    setSelEmployee(e)
    setEmpPayAmt('')
    setEmpPayNote('')
    const { data } = await supabase.from('employee_debt_payments').select('*')
      .eq('employee_id', e.id).order('created_at', { ascending: false })
    setEmpPayments(data || [])
  }

  const addEmployee = async () => {
    if (!newEmployee.name.trim()) { toast.error('أدخل اسم الموظف'); return }
    await supabase.from('employees').insert({
      name:           newEmployee.name.trim(),
      role:           newEmployee.role || null,
      phone:          newEmployee.phone || null,
      monthly_salary: parseFloat(newEmployee.monthly_salary) || 0,
    })
    toast.success('تم إضافة الموظف')
    setNewEmployee({ name:'', role:'', phone:'', monthly_salary:'' })
    setShowAddEmp(false)
    loadEmployees()
  }

  const addEmployeeDebt = async () => {
    const amount = parseFloat(newEmpDebt.amount)
    if (!newEmpDebt.employee_id || isNaN(amount) || amount <= 0) { toast.error('اختر الموظف وأدخل المبلغ'); return }
    await supabase.from('employee_debts').insert({
      employee_id: newEmpDebt.employee_id,
      amount,
      type:        newEmpDebt.type,
      description: newEmpDebt.description || null,
      status:      'open',
    })
    toast.success('تم تسجيل المستحق')
    setNewEmpDebt({ employee_id:'', amount:'', type:'salary', description:'' })
    loadEmployees()
  }

  const recordEmpPayment = async () => {
    const amount = parseFloat(empPayAmt)
    if (!selEmployee || isNaN(amount) || amount <= 0) { toast.error('أدخل المبلغ'); return }
    await supabase.from('employee_debt_payments').insert({
      employee_id: selEmployee.id,
      amount,
      notes: empPayNote || null,
    })
    toast.success(`تم تسجيل دفعة ${fmt(amount)} ${cur}`)
    setEmpPayAmt('')
    setEmpPayNote('')
    loadEmployees()
    openEmployee(selEmployee)
  }

  // ── Totals ──────────────────────────────────────────────
  const totalCustDebt = customers.reduce((s,c) => s + (c.balance||0), 0)
  const totalSupDebt  = supplierDebts.reduce((s,d) => s + ((d.amount||0) - (d.paid||0)), 0)
  // For employees: sum of absolute net balances (both what store owes + what employees owe)
  const totalEmpDebt  = employees.reduce((s,e) => s + Math.abs(empNetBalance(e.id)), 0)

  const DEBT_TYPE_LABELS = { salary:'راتب مستحق', bonus:'مكافأة', other:'أخرى' }

  return (
    <div className="flex flex-col h-full font-arabic" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white border-b flex-shrink-0 flex-wrap gap-y-2">
        <h1 className="font-black text-lg">⚖️ الديون</h1>
        <div className="flex gap-1 flex-wrap">
          {[
            { id:'customers', label:'ديون الزبائن',   badge: customers.length,    color:'bg-danger'     },
            { id:'suppliers', label:'ديون الموردين',  badge: supplierDebts.length, color:'bg-orange-500' },
            { id:'employees', label:'مستحقات الموظفين', badge: employeeDebts.length, color:'bg-purple-500' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 ${tab===t.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`}>
              {t.label}
              {t.badge > 0 && <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-black ${tab===t.id ? 'bg-white/30' : `${t.color} text-white`}`}>{t.badge}</span>}
            </button>
          ))}
        </div>
        <div className="mr-auto text-sm font-black">
          {tab==='customers' && <span className="text-danger">إجمالي: {fmt(totalCustDebt)} {cur}</span>}
          {tab==='suppliers' && <span className="text-orange-500">إجمالي: {fmt(totalSupDebt)} {cur}</span>}
          {tab==='employees' && <span className="text-purple-600">إجمالي: {fmt(totalEmpDebt)} {cur}</span>}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── CUSTOMER DEBTS ── */}
        {tab === 'customers' && (
          <>
            <div className="w-full md:w-72 border-l border-gray-100 bg-white flex flex-col flex-shrink-0 overflow-y-auto">
              {loadingCust && <p className="text-center text-muted p-4">جارٍ التحميل...</p>}
              {!loadingCust && customers.length === 0 && (
                <p className="text-center text-muted p-8">لا توجد ديون 🎉</p>
              )}
              {customers.map(c => (
                <div key={c.id} onClick={() => openCustomer(c)}
                  className={`p-3 border-b cursor-pointer hover:bg-gray-50 transition-colors ${selCustomer?.id===c.id ? 'bg-blue-50 border-r-2 border-r-primary' : ''}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm">{c.name}</p>
                    <span className="text-sm font-black text-danger">{fmt(c.balance)} {cur}</span>
                  </div>
                  {c.phone && <p className="text-xs text-muted">{c.phone}</p>}
                </div>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {!selCustomer ? (
                <p className="text-center text-muted mt-20">اختر زبوناً لعرض التفاصيل</p>
              ) : (
                <>
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="font-black text-lg">{selCustomer.name}</h2>
                      <span className="text-2xl font-black text-danger">{fmt(selCustomer.balance)} {cur}</span>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-danger/10 rounded-xl p-3 text-center">
                        <p className="text-lg font-black text-danger">{fmt(custInvoices.reduce((s,i)=>s+(i.total||0),0))}</p>
                        <p className="text-xs text-muted">إجمالي الفواتير الآجلة</p>
                      </div>
                      <div className="flex-1 bg-success/10 rounded-xl p-3 text-center">
                        <p className="text-lg font-black text-success">{fmt(custPayments.reduce((s,p)=>s+(p.amount||0),0))}</p>
                        <p className="text-xs text-muted">إجمالي المدفوع</p>
                      </div>
                    </div>
                    <div className="mt-3 border-t pt-3">
                      <p className="text-xs font-bold text-muted mb-2">تسجيل دفعة</p>
                      <div className="flex gap-2">
                        <input type="number" value={payAmt} onChange={e=>setPayAmt(e.target.value)}
                          className="inp text-sm flex-1" placeholder={`المبلغ ${cur}`} min="0" step="0.01" />
                        <input value={payNote} onChange={e=>setPayNote(e.target.value)}
                          className="inp text-sm flex-1" placeholder="ملاحظة" />
                        <button onClick={recordCustPayment}
                          className="bg-success text-white text-xs font-black px-4 rounded-lg">✔ دفع</button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-3 bg-gray-50 border-b font-black text-sm">🧾 فواتير آجلة ({custInvoices.length})</div>
                    {custInvoices.map(inv => (
                      <div key={inv.id} className="flex items-center justify-between p-3 border-b hover:bg-gray-50 text-sm">
                        <div>
                          <p className="font-bold text-xs">{inv.order_number}</p>
                          <p className="text-xs text-muted">{fmtDate(inv.created_at)}</p>
                          <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-bold">{inv.payment_label||inv.payment_method}</span>
                        </div>
                        <p className="font-black text-danger">{fmt(inv.total)} {cur}</p>
                      </div>
                    ))}
                    {custInvoices.length === 0 && <p className="text-center text-muted p-4 text-sm">لا توجد فواتير</p>}
                  </div>

                  {custPayments.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="p-3 bg-gray-50 border-b font-black text-sm">💵 سجل الدفعات ({custPayments.length})</div>
                      {custPayments.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-3 border-b text-sm">
                          <div>
                            <p className="text-xs text-muted">{fmtDate(p.created_at)}</p>
                            {p.notes && <p className="text-xs text-muted">{p.notes}</p>}
                          </div>
                          <p className="font-black text-success">+ {fmt(p.amount)} {cur}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* ── SUPPLIER DEBTS ── */}
        {tab === 'suppliers' && (
          <>
            <div className="w-full md:w-72 border-l border-gray-100 bg-white flex flex-col flex-shrink-0 overflow-hidden">
              <div className="p-3 border-b bg-gray-50">
                <p className="text-xs font-bold text-muted mb-2">تسجيل دين للمورد</p>
                <select value={newDebt.supplier_id} onChange={e=>setNewDebt(d=>({...d,supplier_id:e.target.value}))}
                  className="inp text-sm mb-1">
                  <option value="">اختر المورد</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <div className="flex gap-1">
                  <input type="number" value={newDebt.amount} onChange={e=>setNewDebt(d=>({...d,amount:e.target.value}))}
                    className="inp text-sm flex-1" placeholder={`المبلغ ${cur}`} min="0" />
                  <button onClick={addSupplierDebt}
                    className="bg-orange-500 text-white text-xs font-black px-3 rounded-lg">+ دين</button>
                </div>
                <input value={newDebt.description} onChange={e=>setNewDebt(d=>({...d,description:e.target.value}))}
                  className="inp text-sm mt-1" placeholder="الوصف (اختياري)" />
              </div>

              <div className="flex-1 overflow-y-auto">
                {loadingSup && <p className="text-center text-muted p-4">جارٍ التحميل...</p>}
                {!loadingSup && supplierDebts.length === 0 && (
                  <p className="text-center text-muted p-8">لا توجد ديون للموردين 🎉</p>
                )}
                {suppliers
                  .map(s => ({
                    ...s,
                    debts: supplierDebts.filter(d => d.supplier_id === s.id),
                    total: supplierDebts.filter(d => d.supplier_id === s.id).reduce((sum,d) => sum + ((d.amount||0)-(d.paid||0)), 0)
                  }))
                  .filter(s => s.total > 0)
                  .sort((a,b) => b.total - a.total)
                  .map(s => (
                    <div key={s.id} onClick={() => openSupplier(s)}
                      className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${selSupplier?.id===s.id ? 'bg-orange-50 border-r-2 border-r-orange-500' : ''}`}>
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-sm">{s.name}</p>
                        <span className="text-sm font-black text-orange-600">{fmt(s.total)} {cur}</span>
                      </div>
                      <p className="text-xs text-muted">{s.debts.length} سجل دين</p>
                    </div>
                  ))
                }
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {!selSupplier ? (
                <p className="text-center text-muted mt-20">اختر مورداً لعرض التفاصيل</p>
              ) : (
                <>
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h2 className="font-black text-lg">{selSupplier.name}</h2>
                        {selSupplier.phone && <p className="text-sm text-muted">{selSupplier.phone}</p>}
                      </div>
                      <div className="text-left">
                        <p className="text-2xl font-black text-orange-600">
                          {fmt(supplierDebts.filter(d=>d.supplier_id===selSupplier.id).reduce((s,d)=>s+((d.amount||0)-(d.paid||0)),0))} {cur}
                        </p>
                        <p className="text-xs text-muted text-left">المتبقي</p>
                      </div>
                    </div>
                    <div className="border-t pt-3">
                      <p className="text-xs font-bold text-muted mb-2">تسجيل دفعة للمورد</p>
                      <div className="flex gap-2">
                        <input type="number" value={supPayAmt} onChange={e=>setSupPayAmt(e.target.value)}
                          className="inp text-sm flex-1" placeholder={`المبلغ ${cur}`} min="0" step="0.01" />
                        <input value={supPayNote} onChange={e=>setSupPayNote(e.target.value)}
                          className="inp text-sm flex-1" placeholder="ملاحظة" />
                        <button onClick={recordSupPayment}
                          className="bg-success text-white text-xs font-black px-4 rounded-lg">✔ دفع</button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-3 bg-gray-50 border-b font-black text-sm">📋 سجلات الديون</div>
                    {supplierDebts.filter(d=>d.supplier_id===selSupplier.id).map(d => (
                      <div key={d.id} className="flex items-center justify-between p-3 border-b hover:bg-gray-50 text-sm">
                        <div>
                          <p className="text-xs text-muted">{fmtDate(d.created_at)}</p>
                          {d.description && <p className="font-bold">{d.description}</p>}
                          <p className="text-xs text-muted">المدفوع: {fmt(d.paid||0)} {cur}</p>
                        </div>
                        <div className="text-left">
                          <p className="font-black text-orange-600">{fmt((d.amount||0)-(d.paid||0))} {cur}</p>
                          <p className="text-xs text-muted">من {fmt(d.amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {supPayments.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="p-3 bg-gray-50 border-b font-black text-sm">💵 سجل الدفعات</div>
                      {supPayments.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-3 border-b text-sm">
                          <div>
                            <p className="text-xs text-muted">{fmtDate(p.created_at)}</p>
                            {p.notes && <p className="text-xs">{p.notes}</p>}
                          </div>
                          <p className="font-black text-success">+ {fmt(p.amount)} {cur}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* ── EMPLOYEE DEBTS ── */}
        {tab === 'employees' && (
          <>
            <div className="w-full md:w-72 border-l border-gray-100 bg-white flex flex-col flex-shrink-0 overflow-hidden">
              {/* Add debt form */}
              <div className="p-3 border-b bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-muted">تسجيل مستحق للموظف</p>
                  <button onClick={() => setShowAddEmp(v => !v)}
                    className="text-xs text-primary font-bold">+ موظف جديد</button>
                </div>

                {showAddEmp && (
                  <div className="mb-2 p-2 bg-white rounded-lg border border-purple-200 space-y-1">
                    <input value={newEmployee.name} onChange={e=>setNewEmployee(d=>({...d,name:e.target.value}))}
                      className="inp text-sm" placeholder="الاسم *" />
                    <input value={newEmployee.role} onChange={e=>setNewEmployee(d=>({...d,role:e.target.value}))}
                      className="inp text-sm" placeholder="المنصب (بائع، أمين صندوق...)" />
                    <input value={newEmployee.phone} onChange={e=>setNewEmployee(d=>({...d,phone:e.target.value}))}
                      className="inp text-sm" placeholder="الهاتف" />
                    <input type="number" value={newEmployee.monthly_salary} onChange={e=>setNewEmployee(d=>({...d,monthly_salary:e.target.value}))}
                      className="inp text-sm" placeholder={`الراتب الشهري ${cur}`} min="0" />
                    <div className="flex gap-1">
                      <button onClick={addEmployee}
                        className="flex-1 bg-purple-600 text-white text-xs font-black py-1.5 rounded-lg">حفظ</button>
                      <button onClick={() => setShowAddEmp(false)}
                        className="flex-1 bg-gray-200 text-gray-700 text-xs font-black py-1.5 rounded-lg">إلغاء</button>
                    </div>
                  </div>
                )}

                <select value={newEmpDebt.employee_id} onChange={e=>setNewEmpDebt(d=>({...d,employee_id:e.target.value}))}
                  className="inp text-sm mb-1">
                  <option value="">اختر الموظف</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <select value={newEmpDebt.type} onChange={e=>setNewEmpDebt(d=>({...d,type:e.target.value}))}
                  className="inp text-sm mb-1">
                  <option value="salary">راتب مستحق</option>
                  <option value="bonus">مكافأة</option>
                  <option value="other">أخرى</option>
                </select>
                <div className="flex gap-1">
                  <input type="number" value={newEmpDebt.amount} onChange={e=>setNewEmpDebt(d=>({...d,amount:e.target.value}))}
                    className="inp text-sm flex-1" placeholder={`المبلغ ${cur}`} min="0" />
                  <button onClick={addEmployeeDebt}
                    className="bg-purple-600 text-white text-xs font-black px-3 rounded-lg">+ مستحق</button>
                </div>
                <input value={newEmpDebt.description} onChange={e=>setNewEmpDebt(d=>({...d,description:e.target.value}))}
                  className="inp text-sm mt-1" placeholder="الوصف (اختياري)" />
              </div>

              {/* Employees list — show all with non-zero net balance */}
              <div className="flex-1 overflow-y-auto">
                {loadingEmp && <p className="text-center text-muted p-4">جارٍ التحميل...</p>}
                {!loadingEmp && employees.length === 0 && (
                  <p className="text-center text-muted p-8">لا يوجد موظفون 🎉</p>
                )}
                {employees
                  .map(e => ({ ...e, net: empNetBalance(e.id) }))
                  .filter(e => Math.abs(e.net) > 0.001)
                  .sort((a,b) => Math.abs(b.net) - Math.abs(a.net))
                  .map(e => {
                    const storeOwes = e.net > 0
                    return (
                      <div key={e.id} onClick={() => openEmployee(e)}
                        className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${selEmployee?.id===e.id ? 'bg-purple-50 border-r-2 border-r-purple-500' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-sm">{e.name}</p>
                            {e.role && <p className="text-xs text-muted">{e.role}</p>}
                          </div>
                          <div className="text-left">
                            <p className={`text-sm font-black ${storeOwes ? 'text-purple-600' : 'text-danger'}`}>
                              {fmt(Math.abs(e.net))} {cur}
                            </p>
                            <p className={`text-[10px] font-bold ${storeOwes ? 'text-purple-400' : 'text-danger'}`}>
                              {storeOwes ? 'المتجر مدين' : 'الموظف مدين'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })
                }
              </div>
            </div>

            {/* Employee detail */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {!selEmployee ? (
                <p className="text-center text-muted mt-20">اختر موظفاً لعرض التفاصيل</p>
              ) : (() => {
                const totalOwed = employeeDebts.filter(d=>d.employee_id===selEmployee.id).reduce((s,d)=>s+(d.amount||0),0)
                const totalPaid = empAllPayments.filter(p=>p.employee_id===selEmployee.id).reduce((s,p)=>s+(p.amount||0),0)
                const net = totalOwed - totalPaid  // positive = store owes, negative = emp owes
                return (
                  <>
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h2 className="font-black text-lg">{selEmployee.name}</h2>
                          {selEmployee.role && <p className="text-sm text-muted">{selEmployee.role}</p>}
                          {selEmployee.phone && <p className="text-sm text-muted">{selEmployee.phone}</p>}
                          {selEmployee.monthly_salary > 0 && (
                            <p className="text-xs text-purple-600 font-bold">الراتب الشهري: {fmt(selEmployee.monthly_salary)} {cur}</p>
                          )}
                        </div>
                        <div className="text-left">
                          <p className={`text-2xl font-black ${net > 0 ? 'text-purple-600' : net < 0 ? 'text-danger' : 'text-success'}`}>
                            {fmt(Math.abs(net))} {cur}
                          </p>
                          <p className="text-xs text-muted">
                            {net > 0 ? '← المتجر مدين للموظف' : net < 0 ? '← الموظف مدين للمتجر' : 'مسوّى ✓'}
                          </p>
                        </div>
                      </div>

                      {/* Summary cards */}
                      <div className="flex gap-2 mb-3">
                        <div className="flex-1 bg-purple-50 rounded-xl p-3 text-center">
                          <p className="text-base font-black text-purple-700">{fmt(totalOwed)}</p>
                          <p className="text-[10px] text-muted">إجمالي المستحقات</p>
                        </div>
                        <div className="flex-1 bg-success/10 rounded-xl p-3 text-center">
                          <p className="text-base font-black text-success">{fmt(totalPaid)}</p>
                          <p className="text-[10px] text-muted">إجمالي المدفوع</p>
                        </div>
                        {net < 0 && (
                          <div className="flex-1 bg-danger/10 rounded-xl p-3 text-center">
                            <p className="text-base font-black text-danger">{fmt(Math.abs(net))}</p>
                            <p className="text-[10px] text-muted">زيادة مأخوذة</p>
                          </div>
                        )}
                      </div>

                      {/* Warning if employee took more */}
                      {net < 0 && (
                        <div className="bg-danger/10 border border-danger/20 rounded-xl p-3 mb-3 text-center">
                          <p className="text-sm font-black text-danger">⚠️ الموظف أخذ {fmt(Math.abs(net))} {cur} زيادة عن مستحقاته</p>
                          <p className="text-xs text-muted">سيتم خصمها من الراتب القادم</p>
                        </div>
                      )}

                      <div className="border-t pt-3">
                        <p className="text-xs font-bold text-muted mb-2">تسجيل دفعة للموظف</p>
                        <div className="flex gap-2">
                          <input type="number" value={empPayAmt} onChange={e=>setEmpPayAmt(e.target.value)}
                            className="inp text-sm flex-1" placeholder={`المبلغ ${cur}`} min="0" step="0.01" />
                          <input value={empPayNote} onChange={e=>setEmpPayNote(e.target.value)}
                            className="inp text-sm flex-1" placeholder="ملاحظة" />
                          <button onClick={recordEmpPayment}
                            className="bg-success text-white text-xs font-black px-4 rounded-lg">✔ دفع</button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="p-3 bg-gray-50 border-b font-black text-sm">📋 سجلات المستحقات</div>
                      {employeeDebts.filter(d=>d.employee_id===selEmployee.id).map(d => (
                        <div key={d.id} className="flex items-center justify-between p-3 border-b hover:bg-gray-50 text-sm">
                          <div>
                            <p className="text-xs text-muted">{fmtDate(d.created_at)}</p>
                            <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold">{DEBT_TYPE_LABELS[d.type]||d.type}</span>
                            {d.description && <p className="font-bold text-xs mt-0.5">{d.description}</p>}
                          </div>
                          <p className="font-black text-purple-600">+ {fmt(d.amount)} {cur}</p>
                        </div>
                      ))}
                      {employeeDebts.filter(d=>d.employee_id===selEmployee.id).length === 0 &&
                        <p className="text-center text-muted p-4 text-sm">لا توجد سجلات</p>}
                    </div>

                    {empPayments.length > 0 && (
                      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-3 bg-gray-50 border-b font-black text-sm">💵 سجل الدفعات</div>
                        {empPayments.map(p => (
                          <div key={p.id} className="flex items-center justify-between p-3 border-b text-sm">
                            <div>
                              <p className="text-xs text-muted">{fmtDate(p.created_at)}</p>
                              {p.notes && <p className="text-xs">{p.notes}</p>}
                            </div>
                            <p className="font-black text-success">- {fmt(p.amount)} {cur}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

