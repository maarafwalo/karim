import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore.js'
import { useSettingsStore } from '../stores/settingsStore.js'
import { useProductsStore } from '../stores/productsStore.js'
import { useCameraStore, getGlobalStream } from '../stores/cameraStore.js'
import { usePermissionsStore } from '../stores/permissionsStore.js'
import { useEffect, useRef, useState } from 'react'
import { ROLE_LABELS } from '../lib/utils.js'

const HIDE_CATALOG = import.meta.env.VITE_HIDE_CATALOG === 'true'

const NAV = [
  { path: '/pos',             label: 'POS',            icon: '🛒', roles: ['admin','cashier','store_manager'] },
  { path: '/customers',       label: 'الزبائن',        icon: '👤', roles: ['admin','cashier','vendor','delivery','store_manager'] },
  ...(!HIDE_CATALOG ? [{ path: '/catalog', label: 'كتالوج', icon: '📋', roles: ['admin','vendor'] }] : []),
  { path: '/expenses',        label: 'مصاريف',         icon: '💸', roles: ['admin','cashier','store_manager'] },
  { path: '/debt',            label: 'الديون',         icon: '⚖️', roles: ['admin','cashier','delivery','store_manager'] },
  { path: '/stock',           label: 'مخزن',           icon: '📦', roles: ['admin','stock_manager','assistant','store_manager'] },
  { path: '/editing',         label: 'منتجات',         icon: '✏️', roles: ['admin','stock_manager'] },
  { path: '/suppliers',       label: 'موردون',         icon: '🚚', roles: ['admin','stock_manager'] },
  { path: '/reports',         label: 'تقارير',         icon: '📊', roles: ['admin','store_manager'] },
  { path: '/store-accounts',   label: 'حسابات الفروع',   icon: '🏦', roles: ['admin'] },
  { path: '/partner-account',  label: 'حساب سعيد',       icon: '🤝', roles: ['admin'] },
  { path: '/partner-orders',   label: 'طلبات الشركاء',   icon: '📋', roles: ['admin','stock_manager'] },
  { path: '/admin',           label: 'إدارة',          icon: '⚙️', roles: ['admin'] },
  { path: '/surveillance',    label: 'مراقبة',         icon: '📹', roles: ['admin'] },
]

// ── Persistent mini camera overlay ────────────────────────────
function MiniCamera({ onClick }) {
  const { active } = useCameraStore()
  const videoRef   = useRef(null)
  const [minimized, setMinimized] = useState(false)

  // Attach stream to video element whenever active changes
  useEffect(() => {
    const vid = videoRef.current
    if (!vid) return
    const stream = getGlobalStream()
    if (active && stream) {
      vid.srcObject = stream
      vid.play().catch(() => {})
    } else {
      vid.srcObject = null
    }
  }, [active])

  if (!active) return null

  return (
    <div
      className="fixed bottom-3 left-3 z-50 rounded-xl overflow-hidden shadow-2xl border-2 border-green-400 cursor-pointer group"
      style={{ width: minimized ? 44 : 160 }}
      title="كاميرا المراقبة — انقر للتكبير"
    >
      {!minimized && (
        <video
          ref={videoRef}
          muted
          playsInline
          className="w-full block"
          style={{ aspectRatio: '16/9', objectFit: 'cover', transform: 'scaleX(-1)' }}
        />
      )}
      {minimized && (
        <div className="bg-gray-900 flex items-center justify-center h-11 w-11">
          <span className="text-green-400 text-lg">📹</span>
        </div>
      )}

      {/* Overlay controls */}
      <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
        <button
          onClick={e => { e.stopPropagation(); onClick() }}
          className="bg-white/90 text-xs font-black px-2 py-1 rounded-lg text-gray-800"
          title="فتح المراقبة"
        >⛶</button>
        <button
          onClick={e => { e.stopPropagation(); setMinimized(m => !m) }}
          className="bg-white/90 text-xs font-black px-2 py-1 rounded-lg text-gray-800"
          title={minimized ? 'تكبير' : 'تصغير'}
        >{minimized ? '▲' : '▼'}</button>
      </div>

      {/* Live dot */}
      {!minimized && (
        <div className="absolute top-1 right-1 flex items-center gap-1 bg-black/50 rounded px-1">
          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
          <span className="text-white text-[9px] font-bold">LIVE</span>
        </div>
      )}
    </div>
  )
}

export default function AppLayout() {
  const { profile, signOut }             = useAuthStore()
  const { settings, load: loadSettings } = useSettingsStore()
  const { load: loadProducts, subscribeRealtime } = useProductsStore()
  const { active, autoStart, startCamera } = useCameraStore()
  const { canAccess } = usePermissionsStore()
  const navigate  = useNavigate()
  const location  = useLocation()
  const canvasRef = useRef(null)

  useEffect(() => { loadSettings(); loadProducts() }, [])
  useEffect(() => { const unsub = subscribeRealtime(); return unsub }, [])

  // Auto-start camera when app loads (admin only)
  useEffect(() => {
    if (autoStart && profile?.role === 'admin') {
      startCamera()
    }
  }, [profile?.role])

  // Filter nav: base role check + custom permissions
  const allowedNav = NAV.filter(n => {
    if (!n.roles.includes(profile?.role)) return false
    if (profile?.role === 'admin') return true
    const pageKey = n.path.replace('/', '')
    return canAccess(profile?.role, pageKey)
  })
  const [navOpen, setNavOpen] = useState(true)

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="flex flex-row-reverse h-screen overflow-hidden font-arabic" dir="rtl">
      {/* Hidden canvas for snapshots */}
      <canvas ref={canvasRef} className="hidden" />

      {/* ── VERTICAL SIDEBAR (left side) ── */}
      <aside className={`flex flex-col bg-[#1a56db] text-white z-40 flex-shrink-0 shadow-xl transition-all duration-200 ${navOpen ? 'w-36' : 'w-14'}`}>
        {/* Logo / toggle */}
        <div
          className="flex items-center gap-2 px-3 h-[54px] cursor-pointer select-none flex-shrink-0 border-b border-white/10"
          onClick={() => setNavOpen(o => !o)}
        >
          <span className="text-xl flex-shrink-0">🏪</span>
          {navOpen && <span className="font-black text-base tracking-tight truncate">{settings?.store_name || 'joud'}</span>}
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-1 p-1.5 flex-1 overflow-y-auto overflow-x-hidden">
          {allowedNav.map(n => (
            <button
              key={n.path}
              onClick={() => navigate(n.path)}
              className={`flex items-center gap-2 px-2 py-2 rounded-lg text-sm font-bold transition-all w-full ${
                location.pathname === n.path
                  ? 'bg-white text-[#1a56db] shadow'
                  : 'hover:bg-white/20'
              }`}
              title={n.label}
            >
              <span className="text-base flex-shrink-0">{n.icon}</span>
              {navOpen && <span className="truncate text-right">{n.label}</span>}
            </button>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="flex flex-col gap-1 p-1.5 border-t border-white/10 flex-shrink-0">
          {/* Camera (admin only) */}
          {isAdmin && (
            <button
              onClick={() => navigate('/surveillance')}
              className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-bold transition-colors w-full ${
                active ? 'bg-green-500/20 text-green-300' : 'hover:bg-white/20 text-white/60'
              }`}
              title="المراقبة"
            >
              {active
                ? <><span className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" />{navOpen && <span>مراقبة</span>}</>
                : <><span className="flex-shrink-0">📹</span>{navOpen && <span>متوقف</span>}</>
              }
            </button>
          )}
        </div>
      </aside>

      {/* ── PAGE CONTENT ── */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>

      {/* ── PERSISTENT MINI CAMERA ── */}
      {isAdmin && <MiniCamera onClick={() => navigate('/surveillance')} />}
    </div>
  )
}
