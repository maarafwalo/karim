import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore.js'
import { ROLE_HOME } from '../lib/utils.js'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const { signIn, profile }     = useAuthStore()
  const navigate                = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    const error = await signIn(email.trim(), password)
    setLoading(false)
    if (error) { toast.error('بيانات خاطئة — تحقق من الإيميل وكلمة السر'); return }
    // profile is set by auth listener; navigate to role home
    const { profile } = useAuthStore.getState()
    navigate(ROLE_HOME[profile?.role] || '/catalog', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a56db] to-[#1645b7] flex items-center justify-center p-4 font-arabic" dir="rtl">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="bg-[#1a56db] p-6 text-center text-white">
          <div className="text-5xl mb-2">🏪</div>
          <h1 className="text-2xl font-black">joud</h1>
          <p className="text-sm opacity-80 mt-1">نظام نقطة البيع والكتالوج</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">البريد الإلكتروني</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="inp" placeholder="admin@joud.ma"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">كلمة السر</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="inp" placeholder="••••••••"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full bg-[#1a56db] hover:bg-[#1645b7] text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-60"
          >
            {loading ? '...' : 'دخول 🔐'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 pb-4">
          joud POS v2.0 — Powered by Supabase
        </p>
      </div>
    </div>
  )
}
