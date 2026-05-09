// Products tab — adapted to the real bagStore + productsStore shapes.
import React, { useEffect, useMemo } from 'react'
import { useBagStore } from '../../stores/bagStore.js'
import { useProductsStore } from '../../stores/productsStore.js'
import { COLORS, money, itemSubtotal } from './_workspaceHelpers.js'

export default function ProductsTab({ onOpenCart }) {
  const products    = useProductsStore((s) => s.products)
  const categories  = useProductsStore((s) => s.categories)
  const activeCat   = useProductsStore((s) => s.activeCat)
  const setActiveCat = useProductsStore((s) => s.setActiveCat)
  const searchQ     = useProductsStore((s) => s.searchQ)
  const setSearchQ  = useProductsStore((s) => s.setSearchQ)

  // Memoize the filtered list so 800+ products don't re-filter on every
  // re-render (cart state changes propagate up here too).
  const filtered = useMemo(() => {
    const q = (searchQ || '').toLowerCase().trim()
    return (products || []).filter(p => {
      if (!p.is_active || p.is_hidden || p.store_id) return false
      const catMatch = activeCat === 'الكل' || p.categories?.name === activeCat || p.cat === activeCat
      if (!catMatch) return false
      if (!q) return true
      return p.name?.toLowerCase().includes(q)
        || (p.barcode || '').includes(q)
        || (p.cat || '').includes(q)
        || (p.categories?.name || '').includes(q)
    })
  }, [products, activeCat, searchQ])

  // Clear the global search filter when leaving the workspace so it doesn't
  // leak into the POS or stock pages (productsStore.searchQ is shared).
  useEffect(() => () => { setSearchQ('') }, [setSearchQ])

  const bagItems = useBagStore((s) => s.items)
  const addItem = useBagStore((s) => s.addItem)
  const decItem = useBagStore((s) => s.decItem)

  const bagTotal = bagItems.reduce((sum, it) => sum + itemSubtotal(it), 0)
  const bagCount = bagItems.reduce((s, it) => s + (it.qty || 0), 0)
  const inCartQty = (productId) =>
    bagItems.filter((it) => it.product?.id === productId).reduce((s, it) => s + (it.qty || 0), 0)

  return (
    <div style={{ background: COLORS.pageBg, minHeight: '100%', padding: 16 }}>
      {/* Search row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <button
          onClick={() => setActiveCat('الكل')}
          style={{
            background: COLORS.brand, color: 'white', border: 'none',
            padding: '14px 20px', borderRadius: 12, fontSize: 15, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          }}>
          🗂 الكل
        </button>
        <div style={{ flex: 1, position: 'relative' }}>
          <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>🔍</span>
          <input type="text" value={searchQ || ''} onChange={(e) => setSearchQ(e.target.value)}
            placeholder="ابحث عن منتج..."
            style={{
              width: '100%', padding: '14px 44px 14px 14px',
              border: `2px solid ${COLORS.borderStrong}`, borderRadius: 12,
              fontSize: 15, background: 'white', outline: 'none', boxSizing: 'border-box',
            }} />
        </div>
      </div>

      {/* Category chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}>
        {(categories || []).map((c) => {
          const active = activeCat === c.name
          return (
            <CategoryChip
              key={c.id ?? c.name}
              active={active}
              label={`${c.emoji || '📦'} ${c.name}`}
              onClick={() => setActiveCat(c.name)}
            />
          )
        })}
      </div>

      {/* Products grid — auto-fits 2 cols on phone, 3 on tablet, 4-5 on desktop */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
        gap: 12, paddingBottom: 120,
      }}>
        {filtered.map((p) => {
          const qty = inCartQty(p.id)
          const inCart = qty > 0
          return (
            <ProductCard
              key={p.id} product={p} qty={qty} inCart={inCart}
              onAdd={() => addItem(p)}
              onDec={() => decItem(p.id)}
            />
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{
          background: 'white', borderRadius: 16, padding: 40, textAlign: 'center',
          color: COLORS.muted, border: `1.5px solid ${COLORS.border}`,
        }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#334155' }}>ما لقيناش هاد المنتج</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>جرب كلمة أخرى أو اختر فئة مختلفة</div>
        </div>
      )}

      {/* Sticky cart bar — entire bar is one big tap target */}
      {bagCount > 0 && (
        <button
          onClick={onOpenCart}
          style={{
            position: 'fixed', bottom: 16, left: 16, right: 16,
            background: COLORS.success, borderRadius: 16, padding: '16px 20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            color: 'white', boxShadow: '0 8px 24px rgba(22, 163, 74, 0.35)', zIndex: 30,
            border: 'none', cursor: 'pointer', textAlign: 'inherit',
            // Bigger min-height for tablet thumbs + safe-area padding for iPad PWA
            minHeight: 64,
            paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          }}
          onTouchStart={(e) => { e.currentTarget.style.transform = 'scale(0.98)' }}
          onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              background: 'rgba(255,255,255,0.2)', width: 48, height: 48, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, position: 'relative',
            }}>
              🧺
              <span style={{
                position: 'absolute', top: -6, left: -6, background: COLORS.warn,
                minWidth: 22, height: 22, borderRadius: 999, fontSize: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 6px', fontWeight: 600,
              }}>
                {bagCount}
              </span>
            </div>
            <div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>مجموع السلة</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{money(bagTotal)} درهم</div>
            </div>
          </div>
          <span style={{
            background: 'white', color: COLORS.success,
            padding: '12px 24px', borderRadius: 12, fontSize: 16, fontWeight: 600,
          }}>
            عرض السلة ←
          </span>
        </button>
      )}
    </div>
  )
}

function CategoryChip({ active, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: active ? COLORS.brand : 'white',
      color: active ? 'white' : COLORS.muted,
      fontSize: 13, padding: '9px 16px', borderRadius: 999,
      fontWeight: active ? 500 : 400, whiteSpace: 'nowrap',
      border: active ? 'none' : `1.5px solid ${COLORS.borderStrong}`, cursor: 'pointer',
    }}>
      {label}
    </button>
  )
}

function ProductCard({ product, qty, inCart, onAdd, onDec }) {
  const [imgFailed, setImgFailed] = React.useState(false)
  const showImage = product.image_url && !imgFailed
  return (
    <div style={{
      background: 'white',
      border: inCart ? `3px solid ${COLORS.success}` : `1.5px solid ${COLORS.border}`,
      borderRadius: 16, overflow: 'hidden', position: 'relative', transition: 'border-color 0.15s',
    }}>
      {inCart && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          background: COLORS.success, color: 'white', fontSize: 12,
          padding: '4px 10px', borderRadius: 999, fontWeight: 500, zIndex: 2,
        }}>
          في السلة · {qty}
        </div>
      )}

      <div style={{
        background: '#ecfdf5', height: 110,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 52, overflow: 'hidden',
      }}>
        {showImage ? (
          <img src={product.image_url} alt={product.name}
            onError={() => setImgFailed(true)}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          product.emoji || '📦'
        )}
      </div>

      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 500, minHeight: 38, lineHeight: 1.3 }}>
          {product.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, margin: '8px 0' }}>
          <span style={{
            fontSize: 22, fontWeight: 500,
            color: inCart ? COLORS.success : COLORS.warn,
          }}>
            {money(product.sell_price)}
          </span>
          <span style={{ fontSize: 12, color: COLORS.muted }}>درهم</span>
        </div>

        {inCart ? (
          <div style={{
            display: 'flex', alignItems: 'center',
            border: `2px solid ${COLORS.borderStrong}`, borderRadius: 12, overflow: 'hidden',
          }}>
            <button onClick={onDec} style={{
              background: '#fee2e2', color: COLORS.danger, border: 'none',
              flex: 1, height: 48, fontSize: 24, fontWeight: 600, cursor: 'pointer',
            }} className="active:scale-95 transition">−</button>
            <div style={{ width: 56, textAlign: 'center', fontWeight: 600, fontSize: 18 }}>{qty}</div>
            <button onClick={onAdd} style={{
              background: '#dcfce7', color: '#166534', border: 'none',
              flex: 1, height: 48, fontSize: 24, fontWeight: 600, cursor: 'pointer',
            }} className="active:scale-95 transition">+</button>
          </div>
        ) : (
          <button onClick={onAdd} style={{
            background: COLORS.brand, color: 'white', border: 'none',
            width: '100%', height: 48, borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: 'pointer',
          }} className="active:scale-95 transition">
            ➕ أضف
          </button>
        )}
      </div>
    </div>
  )
}
