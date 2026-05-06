/**
 * useScale — Web Serial API hook for Rongta RLS1100C (and compatible scales)
 *
 * Scale sends weight data over RS-232/USB-Serial.
 * Common Rongta format:  "ST,GS,+000123g\r\n"  (Stable, Gross, weight in grams)
 *                     or "US,GS,+000123g\r\n"  (Unstable)
 *                     or just "+0.123\r\n" in kg mode
 *
 * Baud: 9600, 8N1
 */

import { useState, useRef, useCallback } from 'react'

// Parse raw bytes from scale into a weight value in kg
function parseWeight(line) {
  const s = line.trim()
  if (!s) return null

  // Format 1: "ST,GS, +000234g" or "US,GS, +000234g"
  const m1 = s.match(/[SU][ST],GS,\s*[+-]?(\d+(?:\.\d+)?)\s*([gk])/i)
  if (m1) {
    const val = parseFloat(m1[1])
    return m1[2].toLowerCase() === 'g' ? val / 1000 : val
  }

  // Format 2: "  +0.234 kg" or "  +234 g"
  const m2 = s.match(/[+-]?(\d+(?:\.\d+)?)\s*(kg|g)\b/i)
  if (m2) {
    const val = parseFloat(m2[1])
    return m2[2].toLowerCase() === 'g' ? val / 1000 : val
  }

  // Format 3: plain number (kg assumed)
  const m3 = s.match(/^[+-]?(\d+\.\d+)$/)
  if (m3) return parseFloat(m3[1])

  return null
}

export function useScale() {
  const [connected, setConnected]   = useState(false)
  const [weight, setWeight]         = useState(null)   // kg, null = no reading
  const [stable, setStable]         = useState(false)
  const [error, setError]           = useState(null)

  const portRef   = useRef(null)
  const readerRef = useRef(null)
  const activeRef = useRef(false)

  // ── Connect ───────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (!('serial' in navigator)) {
      setError('المتصفح لا يدعم Web Serial — استخدم Chrome أو Edge')
      return
    }
    try {
      setError(null)
      const port = await navigator.serial.requestPort()
      await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' })
      portRef.current = port
      activeRef.current = true
      setConnected(true)

      // Read loop
      const decoder  = new TextDecoderStream()
      const lineReader = decoder.readable
        .pipeThrough(new TransformStream(new LineBreakTransformer()))
        .getReader()
      port.readable.pipeTo(decoder.writable)
      readerRef.current = lineReader

      ;(async () => {
        try {
          while (activeRef.current) {
            const { value, done } = await lineReader.read()
            if (done) break
            const kg = parseWeight(value)
            if (kg !== null) {
              setWeight(Math.round(kg * 1000) / 1000) // round to 3 decimals
              setStable(value.trim().startsWith('ST'))
            }
          }
        } catch (e) {
          if (activeRef.current) setError('انقطع الاتصال بالميزان')
        } finally {
          setConnected(false)
          setWeight(null)
        }
      })()
    } catch (e) {
      if (e.name !== 'NotFoundError') setError('فشل الاتصال: ' + e.message)
    }
  }, [])

  // ── Disconnect ────────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    activeRef.current = false
    try { readerRef.current?.cancel() } catch (_) {}
    try { await portRef.current?.close() } catch (_) {}
    portRef.current  = null
    readerRef.current = null
    setConnected(false)
    setWeight(null)
    setStable(false)
  }, [])

  return { connected, weight, stable, error, connect, disconnect }
}

// ── Transformer: split stream into lines ─────────────────────────────────────
class LineBreakTransformer {
  constructor() { this.buf = '' }
  transform(chunk, ctrl) {
    this.buf += chunk
    const parts = this.buf.split(/\r?\n/)
    this.buf = parts.pop()
    parts.forEach(p => ctrl.enqueue(p))
  }
  flush(ctrl) { if (this.buf) ctrl.enqueue(this.buf) }
}
