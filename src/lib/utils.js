export const STORE_PHONE = '212761568529'

export function fmt(num, decimals = 2) {
  return Number(num || 0).toFixed(decimals)
}

export function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ar-MA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function generateOrderNumber(prefix = 'INV') {
  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  // Add ms + 3-digit random to avoid collisions when two saves land in the
  // same second on the same device (or two devices firing simultaneously).
  const ms   = String(now.getMilliseconds()).padStart(3, '0')
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
  return `${prefix}-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${ms}${rand}`
}

export function calcMargin(sell, cost) {
  if (!sell || !cost || sell <= 0) return null
  return ((sell - cost) / sell * 100).toFixed(1)
}

// Normalize a Moroccan phone for the WhatsApp deep link.
// Stored numbers may be '0612345678' (local), '+212612345678' (intl),
// '212612345678' (no plus), or have spaces/dashes. WhatsApp expects bare
// E.164-style digits with country code, no leading 0.
export function normalizePhoneForWA(phone) {
  let d = String(phone || '').replace(/\D/g, '')
  if (!d) return ''
  // Local number — replace leading 0 with Morocco country code.
  if (d.startsWith('0')) d = '212' + d.slice(1)
  // Already-international without +: keep as-is.
  return d
}

export function buildWhatsApp(phone, message) {
  return `https://wa.me/${normalizePhoneForWA(phone)}?text=${encodeURIComponent(message || '')}`
}

export const ROLE_LABELS = {
  admin:            '👑 مدير',
  cashier:          '🛒 كاشير',
  stock_manager:    '📦 مخزن',
  vendor:           '📋 مندوب',
  store_manager:    '🏪 مسؤول فرع',
  delivery:         '🚚 موصل',
  assistant:        '👷 مساعد',
  trusted_partner:  '🤝 شريك موثوق',
}

export const getFirstName = (fullName) => fullName?.split(' ')[0] || '—'

export const ROLE_HOME = {
  admin:            '/pos',
  cashier:          '/pos',
  stock_manager:    '/stock',
  store_manager:    '/pos',
  assistant:        '/stock',
  vendor:           '/workspace',
  delivery:         '/customers',
  trusted_partner:  '/partner-catalog',
}
