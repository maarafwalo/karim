// Products tab — adapted to the real bagStore + productsStore shapes.
import React from 'react'
import { useBagStore } from '../../stores/bagStore.js'
import { useProductsStore } from '../../stores/productsStore.js'
import { COLORS, money, itemPrice } from './_workspaceHelpers.js'

export default function ProductsTab({ onOpenCart }) {
  const products = useProductsStore((s) => s.products)
  const categories = useProductsStore((s) => s.categories)
  const activeCat = useProductsStore((s) => s.activeCat)
  const setActiveCat = useProductsStore((s) => s.setActiveCat)
  const searchQ = useProductsStore((s) => s.searchQ)
  const setSearchQ = useProductsStore((s) => s.setSearchQ)
  const filterFn = useProductsStore((s) => s.filteredProducts)
  const filtered = filterFn()

  const bagItems = useBagStore((s) => s.items)
  const addItem = useBagStore((s) => s.addItem)
  const decItem = useBagStore((s) => s.decItem)

  const bagTotal = bagItems.reduce((sum, it) => sum + itemPrice(it) * (it.qty || 0), 0)
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

      {/* Products grid — 3 cols on tablet, 2 on phone */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 12, paddingBottom: 100,
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

      {/* Sticky cart bar */}
      {bagCount > 0 && (
        <div style={{
          position: 'fixed', bottom: 16, left: 16, right: 16,
          background: COLORS.success, borderRadius: 16, padding: '14px 18px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          color: 'white', boxShadow: '0 8px 24px rgba(22, 163, 74, 0.35)', zIndex: 30,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              background: 'rgba(255,255,255,0.2)', width: 44, height: 44, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, position: 'relative',
            }}>
              🧺
              <span style={{
                position: 'absolute', top: -4, left: -4, background: COLORS.warn,
                minWidth: 20, height: 20, borderRadius: 999, fontSize: 11,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 5px', fontWeight: 500,
              }}>
                {bagCount}
              </span>
            </div>
            <div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>مجموع السلة</div>
              <div style={{ fontSize: 18, fontWeight: 500 }}>{money(bagTotal)} درهم</div>
            </div>
          </div>
          <button onClick={onOpenCart} style={{
            background: 'white', color: COLORS.success, border: 'none',
            padding: '12px 22px', borderRadius: 12, fontSize: 15, fontWeight: 500, cursor: 'pointer',
          }}>
            عرض السلة ←
          </button>
        </div>
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
        {product.image_url ? (
          <img src={product.image_url} alt={product.name}
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
              flex: 1, height: 44, fontSize: 22, fontWeight: 500, cursor: 'pointer',
            }}>−</button>
            <div style={{ width: 48, textAlign: 'center', fontWeight: 500, fontSize: 17 }}>{qty}</div>
            <button onClick={onAdd} style={{
              background: '#dcfce7', color: '#166534', border: 'none',
              flex: 1, height: 44, fontSize: 22, fontWeight: 500, cursor: 'pointer',
            }}>+</button>
          </div>
        ) : (
          <button onClick={onAdd} style={{
            background: COLORS.brand, color: 'white', border: 'none',
            width: '100%', height: 44, borderRadius: 12, fontSize: 15, fontWeight: 500, cursor: 'pointer',
          }}>
            ➕ أضف
          </button>
        )}
      </div>
    </div>
  )
}
