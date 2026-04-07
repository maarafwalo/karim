import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore.js'
import { ROLE_HOME } from '../lib/utils.js'

export default function UnauthorizedPage() {
  const { profile, signOut } = useAuthStore()
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 font-arabic" dir="rtl">
      <div className="text-center p-8">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-2xl font-black text-gray-800 mb-2">غير مصرح لك</h1>
        <p className="text-muted mb-6">ليس لديك صلاحية للوصول إلى هذه الصفحة</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate(ROLE_HOME[profile?.role] || '/')}
            className="bg-primary text-white px-6 py-2 rounded-xl font-bold">
            الصفحة الرئيسية
          </button>
          <button onClick={signOut} className="bg-gray-200 px-6 py-2 rounded-xl font-bold text-gray-700">
            خروج
          </button>
        </div>
      </div>
    </div>
  )
}
