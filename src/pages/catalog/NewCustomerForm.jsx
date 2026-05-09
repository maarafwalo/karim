// New customer inline form, opens from CustomerPickerModal.
import React, { useState } from 'react'
import { supabase, supabaseAdmin } from '../../lib/supabase.js'
import toast from 'react-hot-toast'
import { COLORS } from './_workspaceHelpers.js'

const TIERS = [
  { id: 'retail',    label: 'عادي' },
  { id: 'wholesale', label: 'جملة' },
  { id: 'vip',       label: 'VIP' },
]

export default function NewCustomerForm({ onClose, onCreated }) {
  const [name, setName]       = useState('')
  const [phone, setPhone]     = useState('')
  const [address, setAddress] = useState('')
  const [tier, setTier]       = useState('retail')
  const [saving, setSaving]   = useState(false)

  const canSave = name.trim().length > 0 && !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    const client = supabaseAdmin || supabase
    const { data, error } = await client
      .from('customers')
      .insert({
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        price_tier: tier,
        balance: 0,
      })
      .select()
      .single()

    setSaving(false)
    if (error) {
      toast.error('ما نجحناش نزيدو الزبون: ' + error.message)
      return
    }
    toast.success('زدنا الزبون ' + data.name)
    onCreated(data)
  }

  // Discard-typed-data guard: confirm before closing if any field has content.
  const safeClose = () => {
    if (saving) return
    if (name.trim() || phone.trim() || address.trim()) {
      if (!window.confirm('سيُفقد ما كتبته. هل تريد المتابعة؟')) return
    }
    onClose()
  }

  return (
    <div onClick={safeClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)',
      zIndex: 110, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: 16, overflowY: 'auto',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'white', borderRadius: 20, width: '100%', maxWidth: 520,
        overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.18)', marginTop: 40,
      }}>
        <div style={{
          background: COLORS.success, padding: '16px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ color: 'white', fontWeight: 500, fontSize: 17 }}>➕ زبون جديد</div>
          <button onClick={safeClose} style={{
            background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none',
            width: 36, height: 36, borderRadius: 10, fontSize: 18, cursor: 'pointer',
          }}>✕</button>
        </div>

        <div style={{ padding: 20 }}>
          <Field label="الاسم" required>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً: محمد العلوي" autoFocus style={inputStyle} />
          </Field>

          <Field label="📞 الهاتف">
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="06XX-XXX-XXX"
              style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }}
            />
          </Field>

          <Field label="📍 العنوان" optional>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder="الحي، الشارع..." style={inputStyle} />
          </Field>

          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block', fontSize: 13, fontWeight: 500,
              color: '#334155', marginBottom: 8,
            }}>
              نوع الزبون
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {TIERS.map((t) => {
                const active = tier === t.id
                return (
                  <button key={t.id} onClick={() => setTier(t.id)} style={{
                    background: active ? COLORS.brand : 'white',
                    color: active ? 'white' : COLORS.muted,
                    border: active ? 'none' : `1.5px solid ${COLORS.borderStrong}`,
                    padding: 12, borderRadius: 12, fontSize: 13,
                    fontWeight: active ? 500 : 400, cursor: 'pointer',
                  }}>
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{
            background: '#fef9c3', border: '1.5px solid #fde68a',
            padding: '10px 12px', borderRadius: 10,
            fontSize: 12, color: '#713f12', marginBottom: 16,
          }}>
            💡 الاسم وحده كافي. يمكنك إضافة الباقي لاحقاً.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
            <button onClick={safeClose} style={{
              background: 'white', color: '#475569', border: '1.5px solid #cbd5e1',
              padding: 14, borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: 'pointer',
            }}>إلغاء</button>
            <button onClick={handleSave} disabled={!canSave} style={{
              background: canSave ? COLORS.success : '#94a3b8', color: 'white', border: 'none',
              padding: 14, borderRadius: 12, fontSize: 15, fontWeight: 500,
              cursor: canSave ? 'pointer' : 'not-allowed',
            }}>
              {saving ? 'جاري الحفظ...' : '✓ احفظ واستخدم'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: 14,
  border: `1.5px solid ${COLORS.borderStrong}`, borderRadius: 12,
  fontSize: 15, background: 'white', outline: 'none', boxSizing: 'border-box',
}

function Field({ label, required, optional, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: 'block', fontSize: 13, fontWeight: 500,
        color: '#334155', marginBottom: 6,
      }}>
        {label}
        {required && <span style={{ color: COLORS.danger }}> *</span>}
        {optional && <span style={{ color: '#94a3b8', fontWeight: 400 }}> (اختياري)</span>}
      </label>
      {children}
    </div>
  )
}
