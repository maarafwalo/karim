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
  const [navOpen, setNavOpen] = useState(false)

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="flex flex-col h-screen overflow-hidden font-arabic" dir="rtl">
      {/* Hidden canvas for snapshots */}
      <canvas ref={canvasRef} className="hidden" />

      {/* ── HEADER ── */}
      <header className="flex items-center gap-2 px-3 h-[54px] bg-[#1a56db] text-white z-40 flex-shrink-0 shadow-lg">
        {/* Logo — click to toggle nav */}
        <div className="flex items-center gap-1.5 ml-2 cursor-pointer select-none" onClick={() => setNavOpen(o => !o)}>
          <span className="text-xl">🏪</span>
          <span className="font-black text-lg tracking-tight">{settings?.store_name || 'joud'}</span>
        </div>

        {/* Camera status pill in header */}
        {isAdmin && (
          <button
            onClick={() => navigate('/surveillance')}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-colors ${
              active
                ? 'bg-green-500/20 text-green-300 border border-green-400/40'
                : 'bg-white/10 text-white/50 border border-white/10'
            }`}
            title="المراقبة بالكاميرا"
          >
            {active
              ? <><span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />📹</>
              : <>📹 متوقف</>
            }
          </button>
        )}

        {/* Install button */}
        <button
          onClick={() => navigate('/install')}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
          title="تثبيت التطبيق"
        >
          📲
        </button>

        {/* Mode switcher — hidden by default, shown when navOpen */}
        {navOpen && (
          <nav className="flex gap-1 flex-1 overflow-x-auto">
            {allowedNav.map(n => (
              <button
                key={n.path}
                onClick={() => { navigate(n.path); setNavOpen(false) }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                  location.pathname === n.path
                    ? 'bg-white text-primary shadow'
                    : 'bg-white/15 hover:bg-white/25'
                }`}
              >
                <span>{n.icon}</span><span>{n.label}</span>
              </button>
            ))}
            <button
              onClick={signOut}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap bg-red-500/80 hover:bg-red-500 transition-all mr-auto"
            >
              🚪 خروج
            </button>
          </nav>
        )}
      </header>

      {/* ── PAGE CONTENT ── */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>

      {/* ── PERSISTENT MINI CAMERA ── */}
      {isAdmin && <MiniCamera onClick={() => navigate('/surveillance')} />}
    </div>
  )
}
