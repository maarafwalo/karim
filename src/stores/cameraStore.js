import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Module-level — not serializable, kept outside Zustand
let _stream    = null
let _recorder  = null
let _chunks    = []

export function getGlobalStream() { return _stream }
export function getRecorder()     { return _recorder }

export const useCameraStore = create(
  persist(
    (set, get) => ({
      active:      false,
      recording:   false,
      autoStart:   true,
      autoSnap:    false,
      autoSnapMin: 10,
      snapshots:   [],   // { id, url, time }
      clips:       [],   // { id, url, time, duration, size }

      startCamera: async () => {
        if (_stream) { set({ active: true }); return { error: null } }
        try {
          _stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: true,   // 🎤 microphone included
          })
          _stream.getVideoTracks()[0].onended = () => {
            _stream = null
            set({ active: false, recording: false })
          }
          set({ active: true })
          return { error: null }
        } catch (err) {
          // Fallback: try video-only if mic denied
          if (err.name === 'NotAllowedError' || err.name === 'NotFoundError') {
            try {
              _stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false,
              })
              _stream.getVideoTracks()[0].onended = () => {
                _stream = null
                set({ active: false, recording: false })
              }
              set({ active: true })
              return { error: null, audioUnavailable: true }
            } catch (e2) {
              _stream = null
              set({ active: false })
              return { error: e2 }
            }
          }
          _stream = null
          set({ active: false })
          return { error: err }
        }
      },

      stopCamera: () => {
        if (_recorder && _recorder.state !== 'inactive') _recorder.stop()
        _stream?.getTracks().forEach(t => t.stop())
        _stream = null
        _recorder = null
        _chunks = []
        set({ active: false, recording: false })
      },

      startRecording: () => {
        if (!_stream || get().recording) return
        _chunks = []
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
          ? 'video/webm;codecs=vp9,opus'
          : MediaRecorder.isTypeSupported('video/webm')
            ? 'video/webm'
            : 'video/mp4'

        _recorder = new MediaRecorder(_stream, { mimeType })
        _recorder.ondataavailable = e => { if (e.data.size > 0) _chunks.push(e.data) }
        _recorder.onstop = () => {
          const blob = new Blob(_chunks, { type: mimeType })
          const url  = URL.createObjectURL(blob)
          const time = new Date().toLocaleString('ar-MA')
          const size = (blob.size / 1024 / 1024).toFixed(1) + ' MB'
          set(s => ({
            recording: false,
            clips: [{ id: Date.now(), url, time, size, mimeType }, ...s.clips.slice(0, 19)],
          }))
          _chunks = []
        }
        _recorder.start(1000)
        set({ recording: true })
      },

      stopRecording: () => {
        if (_recorder && _recorder.state === 'recording') {
          _recorder.stop()
        }
      },

      addSnapshot: (dataUrl) => {
        const time = new Date().toLocaleString('ar-MA')
        set(s => ({ snapshots: [{ id: Date.now(), url: dataUrl, time }, ...s.snapshots.slice(0, 99)] }))
      },

      deleteSnapshot: (id) => set(s => ({ snapshots: s.snapshots.filter(x => x.id !== id) })),
      deleteClip:     (id) => set(s => ({ clips:     s.clips.filter(x => x.id !== id) })),
      clearSnapshots: ()   => set({ snapshots: [] }),
      clearClips:     ()   => set({ clips: [] }),
    }),
    {
      name: 'joud_camera',
      partialize: s => ({
        autoStart:   s.autoStart,
        autoSnap:    s.autoSnap,
        autoSnapMin: s.autoSnapMin,
        snapshots:   s.snapshots,
        // clips have blob URLs — don't persist (lost on page reload anyway)
      }),
    }
  )
)
