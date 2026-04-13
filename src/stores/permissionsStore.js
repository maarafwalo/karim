import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// All pages in the system
export const PAGES = [
  { key: 'pos',          label: 'POS',       icon: '🛒' },
  { key: 'customers',    label: 'الزبائن',   icon: '👤' },
  { key: 'expenses',     label: 'مصاريف',   icon: '💸' },
  { key: 'debt',         label: 'الديون',   icon: '⚖️' },
  { key: 'catalog',      label: 'كتالوج',   icon: '📋' },
  { key: 'stock',        label: 'مخزن',     icon: '📦' },
  { key: 'editing',      label: 'منتجات',   icon: '✏️' },
  { key: 'suppliers',    label: 'موردون',   icon: '🚚' },
  { key: 'reports',      label: 'تقارير',   icon: '📊' },
  { key: 'surveillance', label: 'مراقبة',   icon: '📹' },
]

// Default permissions per role
const DEFAULT_PERMISSIONS = {
  cashier: {
    pos: true, customers: true, expenses: true, debt: true,
    catalog: false, stock: false, editing: false, suppliers: false, reports: false, surveillance: false,
  },
  stock_manager: {
    pos: false, customers: false, expenses: false, debt: false,
    catalog: false, stock: true, editing: true, suppliers: true, reports: false, surveillance: false,
  },
  vendor: {
    pos: false, customers: true, expenses: false, debt: false,
    catalog: true, stock: false, editing: false, suppliers: false, reports: false, surveillance: false,
  },
  store_manager: {
    pos: true, customers: true, expenses: true, debt: true,
    catalog: false, stock: true, editing: false, suppliers: false, reports: true, surveillance: false,
  },
  delivery: {
    pos: false, customers: true, expenses: false, debt: true,
    catalog: false, stock: false, editing: false, suppliers: false, reports: false, surveillance: false,
  },
  assistant: {
    pos: false, customers: false, expenses: false, debt: false,
    catalog: false, stock: true, editing: false, suppliers: false, reports: false, surveillance: false,
  },
  trusted_partner: {
    pos: false, customers: false, expenses: false, debt: false,
    catalog: true, stock: false, editing: false, suppliers: false, reports: false, surveillance: false,
    'partner-catalog': true, 'my-account': true,
  },
}

export const usePermissionsStore = create(
  persist(
    (set, get) => ({
      permissions: DEFAULT_PERMISSIONS,

      // Check if a role can access a page
      canAccess: (role, pageKey) => {
        if (role === 'admin') return true
        return get().permissions[role]?.[pageKey] ?? false
      },

      // Get all pages a role can access
      allowedPages: (role) => {
        if (role === 'admin') return PAGES.map(p => p.key)
        const perms = get().permissions[role] || {}
        return PAGES.filter(p => perms[p.key]).map(p => p.key)
      },

      // Toggle a single page permission for a role
      toggle: (role, pageKey) => {
        set(s => ({
          permissions: {
            ...s.permissions,
            [role]: { ...s.permissions[role], [pageKey]: !s.permissions[role]?.[pageKey] },
          },
        }))
      },

      // Reset a role to defaults
      resetRole: (role) => {
        set(s => ({
          permissions: { ...s.permissions, [role]: DEFAULT_PERMISSIONS[role] || {} },
        }))
      },
    }),
    { name: 'joud_permissions' }
  )
)
