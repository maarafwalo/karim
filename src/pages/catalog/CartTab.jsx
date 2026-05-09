// Cart tab — adapted to bagStore's { product, qty, negotiatedPrice, partial } shape.
// Self-contained: handles save to catalog_orders + catalog_order_items.
import React, { useState } from 'react'
import { useBagStore } from '../../stores/bagStore.js'
import { useAuthStore } from '../../stores/authStore.js'
import { supabase, supabaseAdmin } from '../../lib/supabase.js'
import { generateOrderNumber } from '../../lib/utils.js'
import toast from 'react-hot-toast'
import { COLORS, money, avatarColor, initials, itemPrice, itemOriginalPrice, itemSubtotal } from './_workspaceHelpers.js'
import CustomerPickerModal from './CustomerPickerModal.jsx'

export default function CartTab({ onBrowse }) {
  const { profile } = useAuthStore()

  const items         = useBagStore(s => s.items)
  const customer      = useBagStore(s => s.customer)
  const editingOrder  = useBagStore(s => s.editingOrder)
  const setCustomer   = useBagStore(s => s.setCustomer)
  const addItem       = useBagStore(s => s.addItem)
  const decItem       = useBagStore(s => s.decItem)
  const removeItem    = useBagStore(s => s.removeItem)
  const setNegPrice   = useBagStore(s => s.setNegPrice)
  const setPartial    = useBagStore(s => s.setPartial)
  const clearBag      = useBagStore(s => s.clear)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [sending, setSending]       = useState(false)

  const total = items.reduce((s, it) => s + itemSubtotal(it), 0)
  const count = items.reduce((s, it) => s + (it.qty || 0), 0)
  const hasCustomer = !!(customer?.name)

  const sendOrder = async ({ skipCustomer = false } = {}) => {
    // Guard against double-click race
    if (sending) return

    // Read freshest state from the store, NOT the closure (#26 — picker
    // setCustomer + tap save can race on slow devices).
    const live = useBagStore.getState()
    const liveItems    = live.items
    const liveCustomer = live.customer
    const liveEditing  = live.editingOrder
    if (liveItems.length === 0) { toast.error('السلة فارغة'); return }

    const liveHasCustomer = !!(liveCustomer?.name?.trim())
    if (!skipCustomer && !liveHasCustomer) { toast.error('اختر زبون أولاً'); return }
    setSending(true)

    // Strip any leftover -tmp-… suffix from a previously failed save
    const cleanOrderNum = (liveEditing?.order_number || '').replace(/-tmp-\d+$/, '')
    const orderNum = cleanOrderNum || generateOrderNumber('ORD')
    const db = supabaseAdmin || supabase
    const cName  = liveCustomer?.name?.trim()  || 'زبون عابر'
    const cPhone = liveCustomer?.phone?.trim() || ''
    const cAddr  = liveCustomer?.address?.trim() || ''
    const liveTotal = liveItems.reduce((s, b) => s + itemPrice(b) * (b.qty || 0), 0)
    const withTimeout = (p, ms = 8000) => Promise.race([
      p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
    ])

    const EPS = 0.005

    try {
      const tmpSuffix = liveEditing?.id ? `-tmp-${Date.now()}` : ''
      const { data: order, error: ordErr } = await withTimeout(
        db.from('catalog_orders').insert({
          order_number:       orderNum + tmpSuffix,
          vendor_id:          profile?.id || null,
          customer_name:      cName,
          customer_phone:     cPhone,
          customer_address:   cAddr,
          subtotal:           +liveTotal.toFixed(2),
          total:              +liveTotal.toFixed(2),
          status:             'new',
          wa_sent:            false,
          is_partner_request: false,
        }).select().single()
      )
      if (ordErr) throw ordErr

      const { error: itemsErr } = await withTimeout(
        db.from('catalog_order_items').insert(
          liveItems.map(b => {
            const np = itemPrice(b)
            const orig = itemOriginalPrice(b) // snapshotted at add-time, not live
            const isNeg = Math.abs(np - orig) > EPS
            const nameWithPartial = b.partial
              ? `${b.product.name} (${b.partial.units}/${b.partial.packSize})`
              : b.product.name
            return {
              order_id:       order.id,
              product_id:     b.product.id,
              product_name:   nameWithPartial,
              unit_price:     np,
              original_price: orig,
              negotiated:     isNeg || !!b.partial,
              price_diff:     +(np - orig).toFixed(2),
              quantity:       b.qty,
              total:          +(np * b.qty).toFixed(2),
            }
          })
        )
      )
      if (itemsErr) throw itemsErr

      // Replace old order if editing — items + parent. Both wrapped in withTimeout.
      if (liveEditing?.id) {
        await withTimeout(db.from('catalog_order_items').delete().eq('order_id', liveEditing.id))
        await withTimeout(db.from('catalog_orders').delete().eq('id', liveEditing.id))
        // Restore the real order_number. If this rename fails the new order is
        // still valid, just stuck with the -tmp suffix; surface a warning
        // toast so the admin can fix manually.
        const { error: renameErr } = await withTimeout(
          db.from('catalog_orders').update({ order_number: orderNum }).eq('id', order.id)
        )
        if (renameErr) {
          console.warn('Order saved but rename failed:', renameErr)
          toast(`⚠️ الطلب محفوظ لكن ببداية -tmp — نراجعه`, { duration: 5000 })
        }
      }

      toast.success(liveEditing ? `✔ تم تحديث #${orderNum}` : `✔ تم حفظ #${orderNum}`)
      clearBag()
      // Tell OrdersTab a save just happened so it refetches on its next mount
      // even if it was already mounted (rare race but possible).
      sessionStorage.setItem('joud_orders_dirty', String(Date.now()))
      window.location.hash = 'orders'
    } catch (e) {
      console.error('sendOrder failed:', e)
      toast.error('فشل الحفظ: ' + (e.message || 'خطأ'))
    } finally {
      setSending(false)
    }
  }

  if (items.length === 0) {
    return (
      <div style={{ background: COLORS.pageBg, minHeight: '100%', padding: 16 }}>
        {editingOrder && (
          <div style={{
            background: '#fef3c7', border: '2px solid #fcd34d', borderRadius: 14,
            padding: '12px 14px', marginBottom: 12,
            color: '#92400e', fontSize: 14, fontWeight: 500,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 18 }}>✏️</span>
              <span style={{ flex: 1 }}>وضع تعديل #{editingOrder.order_number} — أضف منتجات لإكمال التعديل</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {onBrowse && (
                <button onClick={onBrowse} style={{
                  background: 'white', color: '#92400e',
                  border: '1px solid #fcd34d', borderRadius: 10,
                  padding: '10px 12px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}>
                  ← تصفح المنتجات
                </button>
              )}
              <button
                onClick={() => { if (window.confirm('إلغاء التعديل؟')) clearBag() }}
                style={{
                  background: '#fef2f2', color: COLORS.danger,
                  border: '1px solid #fecaca', borderRadius: 10,
                  padding: '10px 12px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}>
                إلغاء التعديل
              </button>
            </div>
          </div>
        )}
        <div style={{
          background: 'white', borderRadius: 16, padding: 40, textAlign: 'center',
          color: COLORS.muted, border: `1.5px solid ${COLORS.border}`,
        }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🧺</div>
          <div style={{ fontSize: 17, fontWeight: 500, color: '#334155' }}>السلة فارغة</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>رجع لشاشة المنتجات وزِيد منتجات للسلة</div>
          {onBrowse && (
            <button onClick={onBrowse} style={{
              marginTop: 18, background: COLORS.brand, color: 'white', border: 'none',
              padding: '12px 22px', borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: 'pointer',
            }}>← تصفح المنتجات</button>
          )}
        </div>
      </div>
    )
  }

  const avColor = customer?.name ? avatarColor(customer.id || customer.name) : null

  return (
    <div style={{ background: COLORS.pageBg, minHeight: '100%', padding: 16 }}>
      {/* Editing-mode banner — visible reminder so vendor doesn't accidentally create a new order */}
      {editingOrder && (
        <div style={{
          background: '#fef3c7', border: '2px solid #fcd34d', borderRadius: 14,
          padding: '10px 14px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 10,
          color: '#92400e', fontSize: 14, fontWeight: 500,
        }}>
          <span style={{ fontSize: 18 }}>✏️</span>
          <span style={{ flex: 1 }}>تعديل الطلب <b>#{editingOrder.order_number}</b></span>
          <button
            onClick={() => { if (window.confirm('إلغاء التعديل وإفراغ السلة؟')) clearBag() }}
            style={{
              background: 'white', color: '#92400e',
              border: '1px solid #fcd34d', borderRadius: 10,
              padding: '6px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}>
            إلغاء التعديل
          </button>
        </div>
      )}

      <div style={{
        background: 'white', borderRadius: 16, overflow: 'hidden',
        border: `1.5px solid ${COLORS.border}`,
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 18px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', borderBottom: `1.5px solid ${COLORS.border}`,
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 500 }}>
              {count} {count === 1 ? 'منتج' : 'منتجات'} في السلة
            </div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
              يمكنك تعديل الكمية والسعر
            </div>
          </div>
          <button
            onClick={() => { if (window.confirm('هل تريد إفراغ السلة؟')) clearBag() }}
            style={{
              background: '#fef2f2', color: COLORS.danger,
              border: '1.5px solid #fecaca', borderRadius: 12,
              padding: '10px 16px', fontSize: 14, fontWeight: 500, cursor: 'pointer',
            }}>
            🗑 إفراغ
          </button>
        </div>

        {/* Items */}
        {items.map((item, idx) => (
          <CartRow
            key={`${item.product.id}-${idx}`}
            item={item}
            onInc={() => addItem(item.product)}
            onDec={() => decItem(item.product.id)}
            onRemove={() => removeItem(item.product.id)}
            onPriceUp={() => setNegPrice(item.product.id, +(itemPrice(item) + 0.10).toFixed(2))}
            onPriceDown={() => setNegPrice(item.product.id, Math.max(0, +(itemPrice(item) - 0.10).toFixed(2)))}
            onSplit={() => {
              const units = window.prompt('كم وحدة تريد بيعها؟ (اكتب 0 لإلغاء التقسيم)', String(item.partial?.units || item.qty))
              if (units === null) return // canceled
              const u = Number(units)
              if (!Number.isFinite(u) || u < 0) { toast.error('عدد غير صالح'); return }
              if (u === 0) { setPartial(item.product.id, null); toast.success('تم إلغاء التقسيم'); return }
              const packSize = window.prompt('عدد الوحدات في الباكية؟', String(item.partial?.packSize || 12))
              if (packSize === null) return
              const p = Number(packSize)
              if (!Number.isFinite(p) || p < 1) { toast.error('عدد الوحدات غير صالح'); return }
              if (u > p) { toast.error('لا يمكن أن تكون الوحدات أكثر من الباكية'); return }
              setPartial(item.product.id, { units: u, packSize: p })
            }}
          />
        ))}

        {/* Tip */}
        <div style={{
          padding: '10px 18px', background: '#fef9c3',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, color: '#713f12',
        }}>
          💡 <span>تحب تبيع جزء فقط من الباكية؟ اضغط <b>✂ تقسيم</b> فوق المنتج.</span>
        </div>

        {/* Summary */}
        <div style={{ padding: '16px 18px', background: '#f8fafc' }}>
          <Row label="عدد المنتجات" value={count} />
          <Row label="الخصم" value={`− ${money(0)}`} valueColor={COLORS.success} />
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            padding: '12px 0 4px', borderTop: '1.5px dashed #cbd5e1', marginTop: 6,
          }}>
            <span style={{ fontSize: 16, fontWeight: 500 }}>المجموع الكلي</span>
            <div>
              <span style={{ fontSize: 28, fontWeight: 500, color: COLORS.success }}>{money(total)}</span>
              <span style={{ fontSize: 14, color: COLORS.muted, marginRight: 4 }}>درهم</span>
            </div>
          </div>
        </div>

        {/* Customer slot */}
        <div style={{
          padding: '14px 18px', background: 'white',
          borderTop: `1.5px solid ${COLORS.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {hasCustomer ? (
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: avColor.bg, color: avColor.fg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 500, fontSize: 16,
              }}>{initials(customer.name)}</div>
            ) : (
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: '#e0e7ff', color: '#3730a3',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
              }}>👤</div>
            )}
            <div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>الزبون</div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>
                {hasCustomer ? customer.name : 'لم يتم اختياره'}
              </div>
            </div>
          </div>
          <button onClick={() => setPickerOpen(true)} style={{
            background: COLORS.brand, color: 'white', border: 'none',
            padding: '12px 18px', borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: 'pointer',
          }}>
            {hasCustomer ? 'تغيير' : '+ اختر زبون'}
          </button>
        </div>

        {/* Final actions */}
        <div style={{
          padding: '14px 18px', background: 'white',
          borderTop: `1.5px solid ${COLORS.border}`,
          display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10,
        }}>
          <button onClick={() => sendOrder({ skipCustomer: true })} disabled={sending} style={{
            background: 'white', color: '#475569', border: '1.5px solid #cbd5e1',
            padding: 16, borderRadius: 14, fontSize: 14, fontWeight: 500,
            cursor: sending ? 'wait' : 'pointer', opacity: sending ? 0.6 : 1,
          }}>
            حفظ بدون زبون
          </button>
          <button onClick={() => sendOrder({ skipCustomer: false })}
            disabled={sending || !hasCustomer}
            style={{
              background: hasCustomer ? COLORS.success : '#94a3b8',
              color: 'white', border: 'none', padding: 16, borderRadius: 14,
              fontSize: 16, fontWeight: 500,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              cursor: hasCustomer && !sending ? 'pointer' : 'not-allowed',
              opacity: sending ? 0.6 : 1,
            }}>
            {sending ? '...' : '✓ أتمّ الطلب'}
          </button>
        </div>
      </div>

      {pickerOpen && (
        <CustomerPickerModal
          orderTotal={total}
          onClose={() => setPickerOpen(false)}
          onPick={(c) => {
            if (c === null) {
              setCustomer({ name: 'زبون عابر', phone: '', address: '' })
            } else {
              setCustomer({ id: c.id, name: c.name || '', phone: c.phone || '', address: c.address || '' })
            }
            setPickerOpen(false)
          }}
        />
      )}
    </div>
  )
}

function CartRow({ item, onInc, onDec, onRemove, onPriceUp, onPriceDown, onSplit }) {
  const product = item.product
  const lineTotal = itemSubtotal(item)
  const [imgFailed, setImgFailed] = React.useState(false)
  const showImage = product.image_url && !imgFailed
  return (
    <div style={{
      padding: '14px 18px', borderBottom: `1.5px solid ${COLORS.border}`,
      display: 'flex', gap: 14, alignItems: 'center',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 12, background: '#ecfdf5',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32, flexShrink: 0, overflow: 'hidden',
      }}>
        {showImage ? (
          <img src={product.image_url} alt={product.name}
            onError={() => setImgFailed(true)}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (product.emoji || '📦')}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 500 }}>
          {product.name}
          {item.partial && (
            <span style={{
              marginInlineStart: 6, background: '#ede9fe', color: '#5b21b6',
              fontSize: 11, padding: '2px 6px', borderRadius: 6, fontWeight: 500,
            }}>
              {item.partial.units}/{item.partial.packSize}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
          الأصلي {money(itemOriginalPrice(item))} درهم
        </div>

        <div style={{
          display: 'flex', gap: 10, marginTop: 10,
          alignItems: 'center', flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, color: COLORS.muted }}>الكمية</span>
            <div style={{
              display: 'flex', alignItems: 'center',
              border: `1.5px solid ${COLORS.borderStrong}`, borderRadius: 10, overflow: 'hidden',
            }}>
              <button onClick={onDec} style={{
                background: '#fee2e2', color: COLORS.danger, border: 'none',
                width: 44, height: 44, fontSize: 22, fontWeight: 600, cursor: 'pointer',
              }} className="active:scale-90 transition">−</button>
              <div style={{ width: 44, textAlign: 'center', fontWeight: 600, fontSize: 17 }}>{item.qty}</div>
              <button onClick={onInc} style={{
                background: '#dcfce7', color: '#166534', border: 'none',
                width: 44, height: 44, fontSize: 22, fontWeight: 600, cursor: 'pointer',
              }} className="active:scale-90 transition">+</button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, color: COLORS.muted }}>السعر</span>
            <div style={{
              display: 'flex', alignItems: 'center',
              border: '1.5px solid #fde68a', background: '#fffbeb',
              borderRadius: 10, overflow: 'hidden',
            }}>
              <button onClick={onPriceDown} style={{
                background: 'transparent', color: '#92400e', border: 'none',
                width: 40, height: 44, fontSize: 20, fontWeight: 600, cursor: 'pointer',
              }} className="active:scale-90 transition">−</button>
              <div style={{
                minWidth: 64, textAlign: 'center', fontWeight: 600, color: '#92400e', fontSize: 15,
              }}>{money(itemPrice(item))}</div>
              <button onClick={onPriceUp} style={{
                background: 'transparent', color: '#92400e', border: 'none',
                width: 40, height: 44, fontSize: 20, fontWeight: 600, cursor: 'pointer',
              }} className="active:scale-90 transition">+</button>
            </div>
          </div>

          <button onClick={onSplit} style={{
            background: '#ede9fe', color: '#5b21b6', border: '1.5px solid #ddd6fe',
            padding: '8px 14px', borderRadius: 10, fontSize: 12,
            fontWeight: 500, cursor: 'pointer',
          }}>✂ تقسيم</button>
        </div>
      </div>

      <div style={{ textAlign: 'end', flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: COLORS.muted }}>المجموع</div>
        <div style={{ fontSize: 20, fontWeight: 500, color: COLORS.success }}>{money(lineTotal)}</div>
        <button onClick={onRemove} style={{
          background: 'transparent', border: 'none',
          color: COLORS.danger, fontSize: 22, marginTop: 4, cursor: 'pointer',
        }}>🗑</button>
      </div>
    </div>
  )
}

function Row({ label, value, valueColor }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '6px 0', fontSize: 14,
    }}>
      <span style={{ color: COLORS.muted }}>{label}</span>
      <span style={{ fontWeight: 500, color: valueColor || 'inherit' }}>{value}</span>
    </div>
  )
}
