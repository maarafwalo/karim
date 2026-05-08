// Orders tab — self-contained: fetches the vendor's catalog_orders and
// supports edit (loads back into bagStore) + delete.
import React, { useEffect, useMemo, useState } from 'react'
import { useBagStore } from '../../stores/bagStore.js'
import { useAuthStore } from '../../stores/authStore.js'
import { useProductsStore } from '../../stores/productsStore.js'
import { supabase, supabaseAdmin } from '../../lib/supabase.js'
import toast from 'react-hot-toast'
import {
  COLORS, money, avatarColor, initials, timeAgoArabic, statusBadge,
} from './_workspaceHelpers.js'

const FILTERS = [
  { id: 'all',       label: 'الكل' },
  { id: 'new',       label: '🆕 جديد' },
  { id: 'approved',  label: '✓ مقبول' },
  { id: 'delivered', label: '🚚 مسلَّم' },
  { id: 'rejected',  label: '✕ مرفوض' },
]

export default function OrdersTab({ onSwitchToCart }) {
  const { profile } = useAuthStore()
  const products    = useProductsStore(s => s.products)
  const setBagItems         = useBagStore(s => s.setItems)
  const setBagCustomer      = useBagStore(s => s.setCustomer)
  const setEditingOrderInBag = useBagStore(s => s.setEditingOrder)
  const currentBagItems     = useBagStore(s => s.items)
  const currentEditingOrder = useBagStore(s => s.editingOrder)

  const [orders, setOrders]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [searchQ, setSearchQ]   = useState('')

  const load = async () => {
    if (!profile?.id) return
    setLoading(true)
    const db = supabaseAdmin || supabase
    const { data } = await db
      .from('catalog_orders')
      .select('*')
      .eq('vendor_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(200)
    setOrders(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [profile?.id])

  const editOrder = async (order) => {
    // Warn if there's an unsaved bag for a different order — user might lose work
    if (currentBagItems.length > 0 && currentEditingOrder?.id !== order.id) {
      const otherLabel = currentEditingOrder
        ? `الطلب #${currentEditingOrder.order_number}`
        : 'سلة جديدة'
      if (!window.confirm(`عندك ${otherLabel} في السلة. هل تريد التخلي عنها وفتح هذا الطلب؟`)) return
    }
    const db = supabaseAdmin || supabase
    const { data: items } = await db.from('catalog_order_items').select('*').eq('order_id', order.id)
    const productMap = new Map((products || []).map(p => [p.id, p]))
    // Match "name (units/packSize)" suffix so we don't double-encode it on save
    const partialRe = /\s*\((\d+)\/(\d+)\)\s*$/
    const newBag = (items || []).map(it => {
      const m = it.product_name?.match(partialRe)
      const cleanName = m ? it.product_name.replace(partialRe, '').trim() : it.product_name
      const partial = m ? { units: Number(m[1]), packSize: Number(m[2]) } : null
      const product = productMap.get(it.product_id) || {
        id: it.product_id,
        name: cleanName,
        sell_price: it.original_price ?? it.unit_price,
        emoji: '📦',
        image_url: null,
      }
      return {
        product,
        qty: it.quantity,
        negotiatedPrice: it.unit_price,
        ...(partial ? { partial } : {}),
      }
    })
    setBagItems(newBag)
    setBagCustomer({
      name: order.customer_name || '',
      phone: order.customer_phone || '',
      address: order.customer_address || '',
    })
    setEditingOrderInBag({ id: order.id, order_number: order.order_number })
    toast(`✏️ تعديل #${order.order_number}`, { duration: 3000 })
    onSwitchToCart?.()
  }

  const deleteOrder = async (order) => {
    const db = supabaseAdmin || supabase
    await db.from('catalog_order_items').delete().eq('order_id', order.id)
    const { error } = await db.from('catalog_orders').delete().eq('id', order.id)
    if (error) { toast.error('فشل الحذف: ' + error.message); return }
    toast.success('تم الحذف')
    setOrders(prev => prev.filter(o => o.id !== order.id))
  }

  const stats = useMemo(() => {
    const today = new Date().toDateString()
    const todays = orders.filter(o => new Date(o.created_at).toDateString() === today)
    const total = todays.reduce((s, o) => s + Number(o.total || 0), 0)
    const pending = orders.filter(o => o.status === 'new').length
    return { count: todays.length, total, pending }
  }, [orders])

  const visible = useMemo(() => {
    let list = orders
    if (filter !== 'all') list = list.filter(o => o.status === filter)
    if (searchQ.trim()) {
      const q = searchQ.trim().toLowerCase()
      // Strip non-digits from both sides so '0612' matches '+212-612-…'.
      const qDigits = q.replace(/\D/g, '')
      list = list.filter(o =>
        (o.order_number   || '').toLowerCase().includes(q) ||
        (o.customer_name  || '').toLowerCase().includes(q) ||
        (qDigits && (o.customer_phone || '').replace(/\D/g, '').includes(qDigits))
      )
    }
    return list
  }, [orders, filter, searchQ])

  return (
    <div style={{ background: COLORS.pageBg, minHeight: '100%', padding: 16 }}>
      {/* Summary cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 10, marginBottom: 14,
      }}>
        <SummaryCard bg="#dbeafe" border="#bfdbfe" fg="#1e40af" fgDark="#1e3a8a"
          label="📦 طلبات اليوم" value={stats.count} />
        <SummaryCard bg="#dcfce7" border="#bbf7d0" fg="#166534" fgDark="#14532d"
          label="💰 المداخيل" value={money(stats.total)} unit="د" />
        <SummaryCard bg="#fef3c7" border="#fde68a" fg="#92400e" fgDark="#78350f"
          label="⏳ في الانتظار" value={stats.pending} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, overflowX: 'auto' }}>
        {FILTERS.map(f => {
          const count = f.id === 'all' ? orders.length : orders.filter(o => o.status === f.id).length
          const active = filter === f.id
          return (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              background: active ? COLORS.brand : 'white',
              color: active ? 'white' : '#475569',
              fontSize: 13, padding: '9px 16px', borderRadius: 999,
              fontWeight: active ? 500 : 400, whiteSpace: 'nowrap',
              border: active ? 'none' : `1.5px solid ${COLORS.borderStrong}`,
              cursor: 'pointer',
            }}>
              {f.label} · {count}
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <span style={{
          position: 'absolute', right: 14, top: '50%',
          transform: 'translateY(-50%)', fontSize: 16,
        }}>🔍</span>
        <input type="text" value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
          placeholder="ابحث برقم الطلب أو اسم الزبون..."
          style={{
            width: '100%', padding: '14px 44px 14px 14px',
            border: `1.5px solid ${COLORS.borderStrong}`, borderRadius: 12,
            fontSize: 14, background: 'white', outline: 'none', boxSizing: 'border-box',
          }} />
      </div>

      {/* Order cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 30, color: COLORS.muted }}>جاري التحميل...</div>
      ) : visible.length === 0 ? (
        <div style={{
          background: 'white', borderRadius: 16, padding: 40, textAlign: 'center',
          color: COLORS.muted, border: `1.5px solid ${COLORS.border}`,
        }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#334155' }}>ما كاينش طلبات</div>
        </div>
      ) : (
        visible.map(order => (
          <OrderCard
            key={order.id}
            order={order}
            onEdit={() => editOrder(order)}
            onDelete={() => {
              const editable = order.status === 'new' && !order.stock_approved
              const msg = editable
                ? `حذف الطلب #${order.order_number}؟`
                : `⚠ هذا الطلب تمت معالجته. هل تريد حذفه نهائياً؟`
              if (window.confirm(msg)) deleteOrder(order)
            }}
          />
        ))
      )}
    </div>
  )
}

function SummaryCard({ bg, border, fg, fgDark, label, value, unit }) {
  return (
    <div style={{
      background: bg, border: `1.5px solid ${border}`,
      borderRadius: 14, padding: 14,
    }}>
      <div style={{ fontSize: 12, color: fg, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 500, marginTop: 6, color: fgDark }}>
        {value}{unit && <span style={{ fontSize: 12, marginRight: 4 }}>{unit}</span>}
      </div>
    </div>
  )
}

function OrderCard({ order, onEdit, onDelete }) {
  const av = avatarColor(order.customer_id || order.customer_name)
  const badge = statusBadge(order.status)
  const editable = order.status === 'new' && !order.stock_approved
  const customerName = order.customer_name || 'زبون عابر'
  const shortNum = (order.order_number || '').split('-').pop() || ''

  return (
    <div style={{
      background: 'white', border: `1.5px solid ${COLORS.border}`,
      borderRadius: 16, padding: 16, marginBottom: 12,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'start', marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: av.bg, color: av.fg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 500, fontSize: 16,
          }}>{initials(customerName)}</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>{customerName}</div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
              ⏰ {timeAgoArabic(order.created_at)}
              {order.customer_phone && ` · 📞 ${order.customer_phone}`}
            </div>
          </div>
        </div>
        <span style={{
          background: badge.bg, color: badge.fg, fontSize: 12,
          padding: '6px 14px', borderRadius: 999, fontWeight: 500,
        }}>
          {badge.label}
        </span>
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 0', borderTop: '1.5px dashed #e2e8f0',
      }}>
        <div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>رقم الطلب</div>
          <div style={{
            fontSize: 12, color: COLORS.muted, marginTop: 2,
            fontFamily: 'monospace',
          }}>#{shortNum}</div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 500, color: COLORS.success }}>
          {money(order.total)} <span style={{ fontSize: 12, color: COLORS.muted }}>د</span>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: editable ? '1fr 1fr' : '1fr',
        gap: 8, marginTop: 8,
      }}>
        {editable && (
          <button onClick={onEdit} style={{
            background: '#fef9c3', border: '1.5px solid #fde047',
            color: '#713f12', padding: 12, borderRadius: 12,
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>✏️ تعديل</button>
        )}
        <button onClick={onDelete} style={{
          background: '#fef2f2', border: '1.5px solid #fecaca',
          color: '#991b1b', padding: 12, borderRadius: 12,
          fontSize: 13, fontWeight: 500, cursor: 'pointer',
        }}>🗑 حذف</button>
      </div>
      {!editable && (
        <div style={{
          marginTop: 8, padding: '8px 12px',
          background: '#f8fafc', color: '#94a3b8',
          borderRadius: 10, fontSize: 11, textAlign: 'center',
        }}>
          ⚠ تم بدء معالجة الطلب — التعديل مغلق، الحذف يحتاج تأكيد إضافي
        </div>
      )}
    </div>
  )
}
