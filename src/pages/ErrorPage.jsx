// Top-level fallback rendered when any route throws or any data loader fails.
// Without this, a single crash blanks the whole app with the React-Router
// default white screen.
import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom'

export default function ErrorPage() {
  const error = useRouteError()
  const navigate = useNavigate()
  const message = isRouteErrorResponse(error)
    ? `${error.status} — ${error.statusText || ''}`
    : error?.message || 'حدث خطأ غير متوقع'

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center font-arabic"
      style={{ background: '#fff7ed', padding: 16 }}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full text-center"
        style={{ border: '1.5px solid #f1f5f9', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
        <div className="text-5xl mb-3">⚠️</div>
        <div className="font-black text-lg text-slate-900 mb-2">واجهنا مشكلة</div>
        <div className="text-sm text-slate-600 break-words mb-4">{message}</div>
        <details className="text-[11px] text-left text-slate-400 mb-4 ltr">
          <summary className="cursor-pointer">تفاصيل تقنية</summary>
          <pre className="whitespace-pre-wrap mt-2 text-[10px]">
            {error?.stack || JSON.stringify(error, null, 2)}
          </pre>
        </details>
        <div className="flex gap-2 justify-center">
          <button onClick={() => location.reload()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-sm">
            إعادة تحميل
          </button>
          <button onClick={() => navigate('/')}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm">
            العودة للرئيسية
          </button>
        </div>
      </div>
    </div>
  )
}
