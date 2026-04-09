import { useEffect, useRef, useCallback, useState } from 'react'
import { useCameraStore, getGlobalStream } from '../../stores/cameraStore.js'
import toast from 'react-hot-toast'

// ── Audio level meter ─────────────────────────────────────────
function AudioMeter({ stream }) {
  const canvasRef   = useRef(null)
  const animRef     = useRef(null)
  const analyserRef = useRef(null)

  useEffect(() => {
    if (!stream) return
    const audioTracks = stream.getAudioTracks()
    if (!audioTracks.length) return

    const ctx      = new (window.AudioContext || window.webkitAudioContext)()
    const source   = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 64
    source.connect(analyser)
    analyserRef.current = analyser
    const data = new Uint8Array(analyser.frequencyBinCount)

    const draw = () => {
      animRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(data)
      const canvas = canvasRef.current
      if (!canvas) return
      const c = canvas.getContext('2d')
      c.clearRect(0, 0, canvas.width, canvas.height)
      const barW = canvas.width / data.length
      data.forEach((v, i) => {
        const h = (v / 255) * canvas.height
        const r = Math.min(255, v * 2)
        const g = Math.max(0, 255 - v * 2)
        c.fillStyle = `rgb(${r},${g},50)`
        c.fillRect(i * barW, canvas.height - h, barW - 1, h)
      })
    }
    draw()

    return () => {
      cancelAnimationFrame(animRef.current)
      ctx.close()
    }
  }, [stream])

  return (
    <canvas ref={canvasRef} width={200} height={32}
      className="rounded-lg bg-gray-800 w-full h-8" />
  )
}

// ── Recording timer ───────────────────────────────────────────
function RecTimer({ recording }) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    if (!recording) { setSecs(0); return }
    const id = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [recording])
  if (!recording) return null
  const m = String(Math.floor(secs / 60)).padStart(2, '0')
  const s = String(secs % 60).padStart(2, '0')
  return (
    <span className="flex items-center gap-1.5 text-red-400 font-mono text-sm font-bold">
      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
      {m}:{s}
    </span>
  )
}

// ── Media card (snapshot or clip) ─────────────────────────────
function SnapCard({ snap, onDelete }) {
  return (
    <div className="relative group rounded-xl overflow-hidden border border-gray-700 bg-gray-800 flex-shrink-0">
      <img src={snap.url} alt="" className="w-full object-cover" style={{ aspectRatio:'16/9' }} />
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] px-2 py-1 flex justify-between">
        <span>{snap.time}</span>
        <button onClick={() => onDelete(snap.id)} className="text-red-400 hover:text-red-300">🗑️</button>
      </div>
      <a href={snap.url} download={`snap-${snap.id}.jpg`}
        className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
        💾
      </a>
    </div>
  )
}

function ClipCard({ clip, onDelete }) {
  return (
    <div className="relative group rounded-xl overflow-hidden border border-red-800/50 bg-gray-800 flex-shrink-0">
      <video src={clip.url} controls className="w-full" style={{ aspectRatio:'16/9' }} />
      <div className="bg-gray-900 px-2 py-1 flex items-center justify-between">
        <span className="text-[10px] text-gray-400">{clip.time}</span>
        <span className="text-[10px] text-gray-500">{clip.size}</span>
        <div className="flex gap-1">
          <a href={clip.url} download={`clip-${clip.id}.webm`}
            className="text-blue-400 hover:text-blue-300 text-[10px]">💾</a>
          <button onClick={() => onDelete(clip.id)} className="text-red-400 hover:text-red-300 text-[10px]">🗑️</button>
        </div>
      </div>
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────
export default function SurveillancePage() {
  const {
    active, recording, autoStart, autoSnap, autoSnapMin,
    snapshots, clips,
    startCamera, stopCamera, startRecording, stopRecording,
    addSnapshot, deleteSnapshot, deleteClip, clearSnapshots, clearClips,
  } = useCameraStore()

  const videoRef    = useRef(null)
  const canvasRef   = useRef(null)
  const intervalRef = useRef(null)
  const [tab, setTab]       = useState('snapshots') // 'snapshots' | 'clips'
  const [hasAudio, setHasAudio] = useState(false)
  const [liveStream, setLiveStream] = useState(null)

  // Attach global stream to this video element
  const attachStream = useCallback(() => {
    const stream = getGlobalStream()
    const vid    = videoRef.current
    if (vid && stream && active) {
      vid.srcObject = stream
      vid.play().catch(() => {})
      setLiveStream(stream)
      setHasAudio(stream.getAudioTracks().length > 0)
    }
  }, [active])

  useEffect(() => { attachStream() }, [attachStream])

  const handleStart = async () => {
    const { error, audioUnavailable } = await startCamera()
    if (error) {
      if (error.name === 'NotAllowedError') toast.error('❌ يجب السماح بالكاميرا والميكروفون')
      else if (error.name === 'NotFoundError') toast.error('❌ لا توجد كاميرا')
      else toast.error('خطأ: ' + error.message)
      return
    }
    if (audioUnavailable) toast('⚠️ الكاميرا تعمل بدون صوت', { icon: '🔇' })
    else toast.success('📷🎤 تم تشغيل الكاميرا والميكروفون')
    setTimeout(() => {
      const stream = getGlobalStream()
      const vid    = videoRef.current
      if (vid && stream) { vid.srcObject = stream; vid.play().catch(() => {}) }
      setLiveStream(stream)
      setHasAudio(stream?.getAudioTracks().length > 0)
    }, 150)
  }

  const takeSnapshot = useCallback(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !active) return
    canvas.width  = video.videoWidth  || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)
    addSnapshot(canvas.toDataURL('image/jpeg', 0.85))
    toast.success('📸 تم التقاط صورة')
  }, [active, addSnapshot])

  // Auto-snapshot
  useEffect(() => {
    clearInterval(intervalRef.current)
    if (autoSnap && active) {
      intervalRef.current = setInterval(takeSnapshot, autoSnapMin * 60 * 1000)
    }
    return () => clearInterval(intervalRef.current)
  }, [autoSnap, autoSnapMin, active, takeSnapshot])

  const handleRecord = () => {
    if (recording) {
      stopRecording()
      toast.success('📼 تم حفظ التسجيل')
      setTab('clips')
    } else {
      startRecording()
      toast.success('🔴 بدأ التسجيل بالصوت والصورة')
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden font-arabic bg-gray-950" dir="rtl">
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 border-b border-gray-700 flex-shrink-0">
        <span className="text-xl">📹</span>
        <h1 className="font-black text-white text-base">المراقبة بالكاميرا والصوت</h1>
        <div className="flex items-center gap-3 mr-auto">
          <RecTimer recording={recording} />
          {active && hasAudio && (
            <span className="flex items-center gap-1 text-green-400 text-xs font-bold">
              🎤 <span className="text-[10px]">صوت نشط</span>
            </span>
          )}
          {active && (
            <span className="flex items-center gap-1.5 text-green-400 text-xs font-bold">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              بث مباشر
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── FEED ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Video */}
          <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              muted
              playsInline
              className="max-w-full max-h-full object-contain"
              style={{ transform: 'scaleX(-1)' }}
            />

            {!active && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-6xl mb-4">📹</span>
                <p className="text-lg font-bold text-gray-400 mb-1">الكاميرا متوقفة</p>
                <p className="text-xs text-gray-600 mb-5">سيطلب المتصفح إذن الكاميرا والميكروفون</p>
                <button onClick={handleStart}
                  className="bg-green-500 hover:bg-green-600 text-white font-black px-8 py-3 rounded-xl text-base transition-colors">
                  ▶ تشغيل الكاميرا والميكروفون
                </button>
              </div>
            )}

            {/* Overlays when active */}
            {active && (
              <>
                <div className="absolute top-2 right-2 flex items-center gap-2">
                  {recording && (
                    <span className="bg-red-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />REC
                    </span>
                  )}
                  <span className="bg-black/50 text-white text-[10px] font-mono px-2 py-0.5 rounded">
                    {new Date().toLocaleTimeString('ar-MA')}
                  </span>
                </div>
                {hasAudio && (
                  <div className="absolute bottom-2 left-2 right-2 opacity-60">
                    <AudioMeter stream={liveStream} />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Controls */}
          <div className="bg-gray-900 px-4 py-3 flex items-center gap-2 flex-wrap border-t border-gray-700 flex-shrink-0">
            {/* Start/Stop */}
            {!active ? (
              <button onClick={handleStart}
                className="bg-green-500 hover:bg-green-600 text-white font-black px-4 py-2 rounded-xl text-sm">
                ▶ تشغيل
              </button>
            ) : (
              <button onClick={() => { stopCamera(); toast('⏹ تم إيقاف الكاميرا') }}
                className="bg-gray-600 hover:bg-gray-700 text-white font-black px-4 py-2 rounded-xl text-sm">
                ⏹ إيقاف
              </button>
            )}

            {/* Snapshot */}
            <button onClick={takeSnapshot} disabled={!active}
              className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-40 text-white font-black px-4 py-2 rounded-xl text-sm">
              📸 صورة
            </button>

            {/* Record video+audio */}
            <button onClick={handleRecord} disabled={!active}
              className={`font-black px-4 py-2 rounded-xl text-sm disabled:opacity-40 transition-colors ${
                recording
                  ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                  : 'bg-red-700 hover:bg-red-600 text-white'
              }`}>
              {recording ? '⏹ إيقاف التسجيل' : '🔴 تسجيل فيديو'}
            </button>

            {/* Auto-snapshot */}
            <div className="flex items-center gap-2 mr-auto">
              <label className="flex items-center gap-1.5 text-white text-xs font-bold cursor-pointer">
                <input type="checkbox" checked={autoSnap}
                  onChange={e => useCameraStore.setState({ autoSnap: e.target.checked })}
                  className="w-4 h-4" />
                صورة تلقائية كل
              </label>
              <select value={autoSnapMin}
                onChange={e => useCameraStore.setState({ autoSnapMin: Number(e.target.value) })}
                className="bg-gray-800 text-white text-xs rounded-lg px-2 py-1.5 border border-gray-700">
                <option value={1}>دقيقة</option>
                <option value={5}>5 دقائق</option>
                <option value={10}>10 دقائق</option>
                <option value={30}>30 دقيقة</option>
                <option value={60}>ساعة</option>
              </select>
            </div>

            <label className="flex items-center gap-1.5 text-white text-xs font-bold cursor-pointer">
              <input type="checkbox" checked={autoStart}
                onChange={e => useCameraStore.setState({ autoStart: e.target.checked })}
                className="w-4 h-4" />
              تشغيل تلقائي
            </label>
          </div>
        </div>

        {/* ── MEDIA PANEL ── */}
        <div className="w-56 flex-shrink-0 bg-gray-900 border-r border-gray-700 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-700">
            <button onClick={() => setTab('snapshots')}
              className={`flex-1 py-2 text-xs font-bold transition-colors ${tab==='snapshots' ? 'bg-gray-800 text-yellow-400' : 'text-gray-500 hover:text-gray-300'}`}>
              📸 صور ({snapshots.length})
            </button>
            <button onClick={() => setTab('clips')}
              className={`flex-1 py-2 text-xs font-bold transition-colors ${tab==='clips' ? 'bg-gray-800 text-red-400' : 'text-gray-500 hover:text-gray-300'}`}>
              🎬 تسجيلات ({clips.length})
            </button>
          </div>

          {/* Clear button */}
          <div className="px-3 py-1.5 border-b border-gray-700 flex justify-end">
            {tab === 'snapshots' && snapshots.length > 0 && (
              <button onClick={clearSnapshots} className="text-red-400 text-[10px] hover:text-red-300">مسح الكل</button>
            )}
            {tab === 'clips' && clips.length > 0 && (
              <button onClick={clearClips} className="text-red-400 text-[10px] hover:text-red-300">مسح الكل</button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {tab === 'snapshots' && (
              snapshots.length === 0
                ? <p className="text-gray-600 text-xs text-center mt-8">لا توجد صور</p>
                : snapshots.map(s => <SnapCard key={s.id} snap={s} onDelete={deleteSnapshot} />)
            )}
            {tab === 'clips' && (
              clips.length === 0
                ? <p className="text-gray-600 text-xs text-center mt-8">لا توجد تسجيلات</p>
                : clips.map(c => <ClipCard key={c.id} clip={c} onDelete={deleteClip} />)
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
