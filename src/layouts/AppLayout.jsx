import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore.js'
import { useSettingsStore } from '../stores/settingsStore.js'
import { useProductsStore } from '../stores/productsStore.js'
import { useBagStore } from '../stores/bagStore.js'
import { useCartStore } from '../stores/cartStore.js'
import { useCameraStore, getGlobalStream } from '../stores/cameraStore.js'
import { usePermissionsStore } from '../stores/permissionsStore.js'
import { useEffect, useRef, useState } from 'react'
import { ROLE_LABELS } from '../lib/utils.js'
import { supabase } from '../lib/supabase.js'

const NAV = [
  { path: '/pos',             label: 'POS',            icon: '🛒', roles: ['admin','cashier','store_manager'] },
  { path: '/customers',       label: 'الزبائن',        icon: '👤', roles: ['cashier','delivery','store_manager'] },
  { path: '/workspace',       label: 'ساحة',           icon: '🧰', roles: ['admin'] },
  { path: '/debt',            label: 'محاسبة',         icon: '💼', roles: ['cashier','delivery','store_manager'] },
  { path: '/stock',           label: 'مخزن',           icon: '📦', roles: ['admin','stock_manager','assistant','store_manager'] },
  { path: '/suppliers',       label: 'موردون',         icon: '🚚', roles: ['stock_manager'] },
  { path: '/reports',         label: 'تقارير',         icon: '📊', roles: ['store_manager'] },
  { path: '/partner-catalog',  label: 'طلب بضاعة',       icon: '🛒', roles: ['trusted_partner'] },
  { path: '/my-account',       label: 'حسابي',            icon: '⚖️', roles: ['trusted_partner'] },
  { path: '/admin',           label: 'إدارة',          icon: '⚙️', roles: ['admin'] },
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
  const [unverifiedCount, setUnverifiedCount] = useState(0)

  useEffect(() => { loadSettings(); loadProducts() }, [])
  useEffect(() => { const unsub = subscribeRealtime(); return unsub }, [])

  // Drop bag items that reference products that aren't live anymore (deleted /
  // hidden / from a different store). Runs whenever the products list updates.
  const liveProducts = useProductsStore(s => s.products)
  useEffect(() => {
    if (liveProducts?.length) useBagStore.getState().reconcile(liveProducts)
  }, [liveProducts])

  // Bag + cart survive page reloads via localStorage. If a different user
  // signs in on the same device, the previous user's bag (and editingOrder.id)
  // and the previous cashier's cart + heldCarts leak. Clear both on user
  // change so each session starts clean.
  useEffect(() => {
    if (!profile?.id) return
    const lastUser = sessionStorage.getItem('joud_bag_owner')
    if (lastUser && lastUser !== profile.id) {
      useBagStore.getState().clear()
      useCartStore.getState().clear()
      useCartStore.setState({ heldCarts: [] })
    }
    sessionStorage.setItem('joud_bag_owner', profile.id)
  }, [profile?.id])

  // Poll unverified partner orders count (admin only). Cancel-safe so an
  // in-flight fetch doesn't update state after profile flips role.
  useEffect(() => {
    if (profile?.role !== 'admin') return
    let cancelled = false
    const fetchCount = async () => {
      const { count } = await supabase
        .from('partner_orders')
        .select('id', { count: 'exact', head: true })
        .eq('is_verified', false)
      if (!cancelled) setUnverifiedCount(count || 0)
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [profile?.role])

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
    // trusted_partner always sees their own dedicated pages
    if (profile?.role === 'trusted_partner') return true
    const pageKey = n.path.replace('/', '')
    return canAccess(profile?.role, pageKey)
  })
  const isAdmin = profile?.role === 'admin'

  return (
    <div className="flex flex-col h-screen overflow-hidden font-arabic" dir="rtl">
      <canvas ref={canvasRef} className="hidden" />

      {/* ── HORIZONTAL HEADER ── */}
      <header className="flex items-center gap-2 px-3 h-[54px] bg-[#1a56db] text-white z-40 flex-shrink-0 shadow-lg">
        {/* Logo (click → home) */}
        <button onClick={() => navigate('/')} className="flex items-center gap-1.5 flex-shrink-0 ml-2 hover:opacity-80 transition active:scale-95">
          <span className="text-xl">🏪</span>
          <span className="font-black text-base tracking-tight">{settings?.store_name || 'joud'}</span>
        </button>

        {/* Nav items */}
        <nav className="flex gap-1 flex-1 overflow-x-auto">
          {allowedNav.map(n => (
            <button
              key={n.path}
              onClick={() => navigate(n.path)}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                location.pathname === n.path
                  ? 'bg-white text-[#1a56db] shadow'
                  : 'bg-white/15 hover:bg-white/25'
              }`}
            >
              <span>{n.icon}</span><span>{n.label}</span>
              {n.path === '/admin' && unverifiedCount > 0 && (
                <span className="absolute -top-1 -left-1 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                  {unverifiedCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User + sign out */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs opacity-70 hidden sm:block">{ROLE_LABELS[profile?.role]}</span>
          <button onClick={signOut} className="bg-white/15 hover:bg-white/30 rounded-lg px-2 py-1.5 text-xs font-bold transition-colors">
            خروج
          </button>
        </div>
      </header>

      {/* ── PAGE CONTENT ── */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>

      {isAdmin && <MiniCamera onClick={() => navigate('/surveillance')} />}
    </div>
  )
}
