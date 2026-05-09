// src/pages/catalog/_workspaceHelpers.js
// Shared helpers for the redesigned workspace screens.

export const COLORS = {
  brand: '#4f46e5',
  success: '#16a34a',
  warn: '#f59e0b',
  danger: '#b91c1c',
  pageBg: '#fff7ed',
  cardBg: '#ffffff',
  border: '#f1f5f9',
  borderStrong: '#e2e8f0',
  muted: '#64748b',
}

const AVATAR_COLORS = [
  { bg: '#f59e0b', fg: '#ffffff' },
  { bg: '#3b82f6', fg: '#ffffff' },
  { bg: '#ec4899', fg: '#ffffff' },
  { bg: '#16a34a', fg: '#ffffff' },
  { bg: '#8b5cf6', fg: '#ffffff' },
]

export function avatarColor(seed) {
  if (!seed) return AVATAR_COLORS[0]
  const str = String(seed)
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function initials(name = '') {
  const trimmed = String(name).trim()
  if (!trimmed) return '؟'
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2)
  return (parts[0][0] || '') + (parts[1][0] || '')
}

export function timeAgoArabic(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffMin < 1) return 'الآن'
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`
  if (diffHr < 24) return `منذ ${diffHr} ساعة`
  if (diffDay === 1) return 'الأمس'
  if (diffDay < 7) return `منذ ${diffDay} أيام`

  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.toLocaleDateString('ar-MA')} ${hh}:${mm}`
}

export function money(n) {
  const num = Number(n)
  if (!Number.isFinite(num)) return '0.00'
  return num.toFixed(2)
}

export function statusBadge(status) {
  switch (status) {
    case 'new':       return { label: '🆕 جديد',   bg: '#dbeafe', fg: '#1e40af' }
    case 'approved':  return { label: '✓ مقبول',   bg: '#dcfce7', fg: '#166534' }
    case 'delivered': return { label: '🚚 مسلَّم',  bg: '#fef3c7', fg: '#92400e' }
    case 'rejected':  return { label: '✕ مرفوض',  bg: '#fee2e2', fg: '#991b1b' }
    case 'cancelled': return { label: '⊘ ملغى',   bg: '#f1f5f9', fg: '#475569' }
    case 'invoiced':  return { label: '💵 مفوتر',  bg: '#ede9fe', fg: '#5b21b6' }
    default:          return { label: status,      bg: '#f1f5f9', fg: '#475569' }
  }
}

// bagStore item helpers: items are { product, qty, negotiatedPrice, originalPrice?, partial? }
export const itemPrice = (it) =>
  typeof it?.negotiatedPrice === 'number' ? it.negotiatedPrice : (it?.product?.sell_price ?? 0)
export const itemOriginalPrice = (it) =>
  typeof it?.originalPrice === 'number' ? it.originalPrice : (it?.product?.sell_price ?? 0)
// Rounded to 2 decimals so the displayed line total matches what gets saved
// to catalog_order_items.total. Without rounding, summing 33.333 three times
// shows 99.99 in UI but stores 99.999 → 100.00 in DB (off-by-cent).
export const itemSubtotal = (it) =>
  Math.round(itemPrice(it) * (it?.qty ?? 0) * 100) / 100
