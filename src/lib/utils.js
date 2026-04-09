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
  return `${prefix}-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

export function calcMargin(sell, cost) {
  if (!sell || !cost || sell <= 0) return null
  return ((sell - cost) / sell * 100).toFixed(1)
}

export function buildWhatsApp(phone, message) {
  return `https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(message)}`
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

export const ROLE_HOME = {
  admin:            '/pos',
  cashier:          '/pos',
  stock_manager:    '/stock',
  vendor:           '/catalog',
  store_manager:    '/pos',
  delivery:         '/customers',
  assistant:        '/stock',
  trusted_partner:  '/catalog',
}
