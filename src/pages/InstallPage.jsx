/**
 * InstallPage — صفحة تثبيت التطبيق
 * تُعرض للمستخدم عند أول دخول أو عند الضغط على زر التثبيت
 */
import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore.js'
import { ROLE_LABELS } from '../lib/utils.js'

const APP_URL = 'https://karime.vercel.app'

// بطاقة الموظف مع بيانات الدخول
const ACCOUNTS = [
  { name:'أنت (المدير)',   email:'digitalmarouane@gmail.com', role:'admin',           pass:'Admin123456',  icon:'👑' },
  { name:'أخوك',           email:'akh@joud.app',              role:'admin',           pass:'Joud@1234',    icon:'👑' },
  { name:'عمران',          email:'imran@joud.app',            role:'stock_manager',   pass:'Joud@1234',    icon:'📦' },
  { name:'إبراهيم',       email:'ibrahim@joud.app',          role:'assistant',       pass:'Joud@1234',    icon:'👷' },
  { name:'عبد القادر',    email:'abdelkader@joud.app',       role:'assistant',       pass:'Joud@1234',    icon:'👷' },
  { name:'البائع',         email:'vendeur@joud.app',          role:'vendor',          pass:'Joud@1234',    icon:'📋' },
  { name:'أسامة',          email:'ossama@joud.app',           role:'delivery',        pass:'Joud@1234',    icon:'🚚' },
  { name:'سعيد',           email:'said@joud.app',             role:'trusted_partner', pass:'Joud@1234',    icon:'🤝' },
  { name:'ميلود',          email:'miloud@joud.app',           role:'store_manager',   pass:'Joud@1234',    icon:'🏪' },
  { name:'رضوان',          email:'ridwan@joud.app',           role:'store_manager',   pass:'Joud@1234',    icon:'🏪' },
  { name:'كاشير 1',       email:'cashier1@joud.app',         role:'cashier',         pass:'Joud@1234',    icon:'🛒' },
  { name:'كاشير 2',       email:'cashier2@joud.app',         role:'cashier',         pass:'Joud@1234',    icon:'🛒' },
  { name:'مساعد 1',       email:'assistant1@joud.app',       role:'assistant',       pass:'Joud@1234',    icon:'👷' },
  { name:'مساعد 2',       email:'assistant2@joud.app',       role:'assistant',       pass:'Joud@1234',    icon:'👷' },
]

const ROLE_COLORS = {
  admin:           'bg-purple-100 text-purple-700 border-purple-200',
  cashier:         'bg-blue-100 text-blue-700 border-blue-200',
  stock_manager:   'bg-orange-100 text-orange-700 border-orange-200',
  vendor:          'bg-green-100 text-green-700 border-green-200',
  store_manager:   'bg-teal-100 text-teal-700 border-teal-200',
  delivery:        'bg-cyan-100 text-cyan-700 border-cyan-200',
  assistant:       'bg-gray-100 text-gray-700 border-gray-200',
  trusted_partner: 'bg-amber-100 text-amber-700 border-amber-200',
}

// iOS install steps
function IOSSteps() {
  return (
    <div className="space-y-3">
      {[
        { n:1, icon:'🌐', text:'افتح المتصفح Safari على iPhone أو iPad' },
        { n:2, icon:'📤', text:'اضغط على زر المشاركة (المربع مع السهم للأعلى) في أسفل الشاشة' },
        { n:3, icon:'➕', text:'اختر "Add to Home Screen" أو "إضافة إلى الشاشة الرئيسية"' },
        { n:4, icon:'✅', text:'اضغط "Add" — سيظهر التطبيق على شاشتك الرئيسية' },
      ].map(s => (
        <div key={s.n} className="flex items-start gap-3">
          <span className="w-7 h-7 bg-gray-800 text-white rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">{s.n}</span>
          <div>
            <span className="text-lg ml-1">{s.icon}</span>
            <span className="text-sm text-gray-700">{s.text}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// Android install steps
function AndroidSteps({ onInstall, canInstall }) {
  return (
    <div className="space-y-3">
      {canInstall ? (
        <button
          onClick={onInstall}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-black py-4 rounded-2xl text-lg transition-colors flex items-center justify-center gap-2"
        >
          📲 تثبيت التطبيق الآن
        </button>
      ) : (
        <>
          {[
            { n:1, icon:'🌐', text:'افتح المتصفح Chrome على هاتف Android' },
            { n:2, icon:'⋮',  text:'اضغط على النقاط الثلاث (⋮) في أعلى اليمين' },
            { n:3, icon:'➕', text:'اختر "Add to Home screen" أو "إضافة إلى الشاشة الرئيسية"' },
            { n:4, icon:'✅', text:'اضغط "Add" — سيظهر التطبيق على شاشتك الرئيسية' },
          ].map(s => (
            <div key={s.n} className="flex items-start gap-3">
              <span className="w-7 h-7 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">{s.n}</span>
              <div>
                <span className="text-lg ml-1">{s.icon}</span>
                <span className="text-sm text-gray-700">{s.text}</span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// Desktop install steps
function DesktopSteps({ onInstall, canInstall }) {
  return (
    <div className="space-y-3">
      {canInstall ? (
        <button
          onClick={onInstall}
          className="w-full bg-primary hover:bg-primary-dark text-white font-black py-4 rounded-2xl text-lg transition-colors flex items-center justify-center gap-2"
        >
          💻 تثبيت على الحاسوب
        </button>
      ) : (
        <div className="flex items-start gap-3">
          <span className="w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">1</span>
          <span className="text-sm text-gray-700">ابحث عن أيقونة التثبيت (➕) في شريط العنوان بجانب الرابط</span>
        </div>
      )}
    </div>
  )
}

export default function InstallPage() {
  const { profile, signOut } = useAuthStore()
  const [os, setOs]               = useState('android') // 'ios' | 'android' | 'desktop'
  const [deferredPrompt, setDP]   = useState(null)
  const [installed, setInstalled] = useState(false)
  const [search, setSearch]       = useState('')
  const [copied, setCopied]       = useState(null)

  // Detect OS
  useEffect(() => {
    const ua = navigator.userAgent
    if (/iPad|iPhone|iPod/.test(ua)) setOs('ios')
    else if (/Android/.test(ua)) setOs('android')
    else setOs('desktop')
  }, [])

  // Capture install prompt (Android/Desktop)
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setDP(e) }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setInstalled(true))
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Check if already installed
  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setDP(null)
  }

  const copy = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const filtered = ACCOUNTS.filter(a =>
    a.name.includes(search) || a.email.includes(search) || a.role.includes(search)
  )

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="min-h-screen bg-gray-50 font-arabic" dir="rtl">
      {/* Header */}
      <div className="bg-[#1a56db] text-white px-4 py-5 text-center">
        <div className="text-5xl mb-2">🏪</div>
        <h1 className="font-black text-2xl">نظام جود</h1>
        <p className="text-blue-200 text-sm mt-1">نقطة البيع الذكية</p>
        {installed && (
          <span className="inline-block mt-2 bg-green-400/20 text-green-200 text-xs font-bold px-3 py-1 rounded-full border border-green-400/30">
            ✅ التطبيق مثبت
          </span>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

        {/* ── INSTALL SECTION ── */}
        {!installed && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-black text-lg">📲 تثبيت التطبيق</h2>
              <p className="text-sm text-gray-500 mt-0.5">ثبّت التطبيق للوصول السريع بدون متصفح</p>
            </div>

            {/* OS tabs */}
            <div className="flex border-b border-gray-100">
              {[
                { k:'ios',     l:'🍎 iPhone/iPad' },
                { k:'android', l:'🤖 Android' },
                { k:'desktop', l:'💻 حاسوب' },
              ].map(({ k, l }) => (
                <button key={k} onClick={() => setOs(k)}
                  className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
                    os === k ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  {l}
                </button>
              ))}
            </div>

            <div className="p-4">
              {os === 'ios'     && <IOSSteps />}
              {os === 'android' && <AndroidSteps onInstall={handleInstall} canInstall={!!deferredPrompt} />}
              {os === 'desktop' && <DesktopSteps onInstall={handleInstall} canInstall={!!deferredPrompt} />}

              {/* App URL */}
              <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-2">
                <span className="text-xs text-gray-500 flex-1 font-mono truncate">{APP_URL}</span>
                <button
                  onClick={() => copy(APP_URL, 'url')}
                  className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg font-bold flex-shrink-0"
                >
                  {copied === 'url' ? '✅' : '📋 نسخ'}
                </button>
              </div>
            </div>
          </div>
        )}

        {installed && (
          <div className="bg-green-50 rounded-2xl border border-green-200 p-4 text-center">
            <p className="text-4xl mb-2">✅</p>
            <p className="font-black text-green-800">التطبيق مثبت بنجاح!</p>
            <p className="text-sm text-green-600 mt-1">ابحث عن أيقونة "joud" على شاشتك الرئيسية</p>
          </div>
        )}

        {/* ── MY ACCOUNT ── */}
        {profile && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-black text-base">👤 حسابي</h2>
              <button onClick={signOut} className="text-xs text-red-500 font-bold hover:text-red-700">خروج 🚪</button>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-2xl">
                  {ACCOUNTS.find(a => a.email === profile.email)?.icon || '👤'}
                </div>
                <div>
                  <p className="font-black text-gray-900">{profile.full_name}</p>
                  <p className="text-xs text-gray-500">{profile.email}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border mt-0.5 inline-block ${ROLE_COLORS[profile.role] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                    {ROLE_LABELS[profile.role] || profile.role}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ALL ACCOUNTS (admin only) ── */}
        {isAdmin && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-black text-base">🔑 بيانات دخول الموظفين</h2>
              <p className="text-xs text-gray-500 mt-0.5">شارك كل موظف بيانات دخوله فقط — لا تشارك الكل</p>
            </div>

            <div className="p-3">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="بحث..."
                className="inp text-sm"
              />
            </div>

            <div className="divide-y divide-gray-50 max-h-[60vh] overflow-y-auto">
              {filtered.map((acc, i) => (
                <div key={i} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{acc.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-gray-900">{acc.name}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ROLE_COLORS[acc.role] || ''}`}>
                        {ROLE_LABELS[acc.role] || acc.role}
                      </span>
                    </div>
                    <button
                      onClick={() => copy(`البريد: ${acc.email}\nكلمة السر: ${acc.pass}\nالرابط: ${APP_URL}`, `all-${i}`)}
                      className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-colors flex-shrink-0 ${
                        copied === `all-${i}` ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {copied === `all-${i}` ? '✅ نُسخ' : '📋 نسخ'}
                    </button>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-500">📧 البريد</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-800 truncate max-w-[180px]">{acc.email}</span>
                        <button onClick={() => copy(acc.email, `email-${i}`)}
                          className="text-[10px] text-primary hover:text-primary-dark font-bold">
                          {copied === `email-${i}` ? '✅' : '📋'}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-500">🔒 كلمة السر</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-800">{acc.pass}</span>
                        <button onClick={() => copy(acc.pass, `pass-${i}`)}
                          className="text-[10px] text-primary hover:text-primary-dark font-bold">
                          {copied === `pass-${i}` ? '✅' : '📋'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── QUICK LINKS ── */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-black text-base">🔗 روابط مفيدة</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {[
              { icon:'🌐', label:'فتح التطبيق في المتصفح', href: APP_URL },
              { icon:'📲', label:'إرشادات تثبيت iOS (Apple)', href:'https://support.apple.com/en-us/104996' },
              { icon:'🤖', label:'إرشادات تثبيت Android (Google)', href:'https://support.google.com/chrome/answer/9658361' },
            ].map((l, i) => (
              <a key={i} href={l.href} target="_blank" rel="noreferrer"
                className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
                <span className="text-xl">{l.icon}</span>
                <span className="flex-1 text-sm font-bold text-gray-800">{l.label}</span>
                <span className="text-gray-400">←</span>
              </a>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 pb-4">
          joud POS · {APP_URL}
        </p>
      </div>
    </div>
  )
}
