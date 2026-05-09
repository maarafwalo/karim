// Customer picker modal — fetches the customers table, supports search,
// shows recent chips, and lets the user create a new one inline.
import React, { useEffect, useState, useMemo } from 'react'
import { supabase, supabaseAdmin } from '../../lib/supabase.js'
import { COLORS, money, avatarColor, initials } from './_workspaceHelpers.js'
import NewCustomerForm from './NewCustomerForm.jsx'

export default function CustomerPickerModal({ onClose, onPick, orderTotal = 0 }) {
  const [customers, setCustomers]     = useState([])
  const [recent, setRecent]           = useState([])
  const [searchQ, setSearchQ]         = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const client = supabaseAdmin || supabase
      const { data } = await client.from('customers').select('*').order('name')
      if (cancelled) return
      setCustomers(data || [])
      const r = [...(data || [])]
        .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
        .slice(0, 4)
      setRecent(r)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    if (!searchQ.trim()) return customers
    const q = searchQ.trim().toLowerCase()
    const qDigits = q.replace(/\D/g, '')
    return customers.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (qDigits && (c.phone || '').replace(/\D/g, '').includes(qDigits))
    )
  }, [customers, searchQ])

  if (showNewForm) {
    return (
      <NewCustomerForm
        onClose={() => setShowNewForm(false)}
        onCreated={(c) => {
          // Push into the local list so it shows up if the picker is reopened
          setCustomers(prev => [c, ...prev])
          setShowNewForm(false)
          onPick(c)
        }}
      />
    )
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', zIndex: 100,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: 16, overflowY: 'auto',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'white', borderRadius: 20, width: '100%', maxWidth: 560,
        overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.18)', marginTop: 40,
      }}>
        <div style={{
          background: COLORS.brand, padding: '16px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ color: 'white', fontWeight: 500, fontSize: 17 }}>👤 اختر الزبون</div>
            {orderTotal > 0 && (
              <div style={{ color: '#c7d2fe', fontSize: 12, marginTop: 2 }}>
                للطلب {money(orderTotal)} درهم
              </div>
            )}
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none',
            width: 36, height: 36, borderRadius: 10, fontSize: 18, cursor: 'pointer',
          }}>✕</button>
        </div>

        <div style={{
          padding: '16px 20px', background: '#f8fafc',
          borderBottom: `1.5px solid ${COLORS.borderStrong}`,
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>🔍</span>
              <input type="text" value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => {
                  // Enter picks the only match — common for "type a phone, hit return".
                  if (e.key === 'Enter' && filtered.length === 1) onPick(filtered[0])
                }}
                placeholder="ابحث بالاسم أو الهاتف..."
                style={{
                  width: '100%', padding: '12px 38px 12px 12px',
                  border: `1.5px solid ${COLORS.borderStrong}`, borderRadius: 12,
                  fontSize: 14, background: 'white', outline: 'none', boxSizing: 'border-box',
                }} />
            </div>
            <button onClick={() => setShowNewForm(true)} style={{
              background: COLORS.success, color: 'white', border: 'none',
              padding: '12px 18px', borderRadius: 12, fontSize: 14,
              fontWeight: 500, whiteSpace: 'nowrap', cursor: 'pointer',
            }}>
              + زبون جديد
            </button>
          </div>
        </div>

        {recent.length > 0 && !searchQ && (
          <div style={{ padding: '14px 20px' }}>
            <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10, fontWeight: 500 }}>⚡ زبائن مؤخراً</div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {recent.map(c => {
                const av = avatarColor(c.id || c.name)
                return (
                  <button key={c.id} onClick={() => onPick(c)} style={{
                    background: 'white', border: `1.5px solid ${COLORS.borderStrong}`,
                    color: '#334155', padding: '10px 16px', borderRadius: 999,
                    fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
                    display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                  }}>
                    <span style={{
                      background: av.bg, color: av.fg, width: 22, height: 22,
                      borderRadius: '50%', display: 'inline-flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: 11,
                    }}>{initials(c.name)}</span>
                    {c.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ padding: '0 20px 20px' }}>
          <div style={{
            fontSize: 12, color: COLORS.muted, marginBottom: 10,
            fontWeight: 500, marginTop: searchQ ? 14 : 0,
          }}>
            📒 {searchQ ? 'النتائج' : 'كل الزبائن'} ({filtered.length})
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 30, color: COLORS.muted }}>جاري التحميل...</div>
          ) : filtered.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: 30, color: COLORS.muted,
              background: '#f8fafc', borderRadius: 12,
            }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>{searchQ ? '🔍' : '👤'}</div>
              {searchQ ? 'ما لقيناش زبون بهاد الاسم' : 'ما كاينش زبائن بعد — زِيد واحد جديد'}
            </div>
          ) : (
            filtered.slice(0, 50).map(c => {
              const av = avatarColor(c.id || c.name)
              const debt = Number(c.balance || 0)
              return (
                <div key={c.id} style={{
                  background: 'white', border: `1.5px solid ${COLORS.borderStrong}`,
                  borderRadius: 12, padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8,
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: av.bg, color: av.fg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 500,
                  }}>{initials(c.name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{c.name}</div>
                    {c.phone && (
                      <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>📞 {c.phone}</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'end' }}>
                    <div style={{ fontSize: 11, color: COLORS.muted }}>الدين</div>
                    <div style={{
                      fontSize: 14, fontWeight: 500,
                      color: debt > 0 ? COLORS.danger : COLORS.success,
                    }}>{money(debt)}</div>
                  </div>
                  <button onClick={() => onPick(c)} style={{
                    background: COLORS.brand, color: 'white', border: 'none',
                    padding: '10px 14px', borderRadius: 10, fontSize: 13,
                    fontWeight: 500, cursor: 'pointer',
                  }}>اختر ✓</button>
                </div>
              )
            })
          )}
        </div>

        <div style={{
          padding: '14px 20px', background: '#f8fafc',
          borderTop: `1.5px solid ${COLORS.borderStrong}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, color: COLORS.muted }}>لا تريد ربط زبون؟</span>
          <button onClick={() => onPick(null)} style={{
            background: 'white', color: '#475569', border: '1.5px solid #cbd5e1',
            padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>
            حفظ كزبون عابر
          </button>
        </div>
      </div>
    </div>
  )
}
