/**
 * Generates PWA icon PNGs using pure Node.js (no external deps)
 * Creates a simple colored square with "J" letter
 */
import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync } from 'fs'

// Try canvas, fallback to raw PNG bytes
let useCanvas = false
try {
  const { createCanvas: cc } = await import('canvas')
  useCanvas = true
} catch {}

if (useCanvas) {
  const { createCanvas } = await import('canvas')
  for (const size of [192, 512]) {
    const canvas = createCanvas(size, size)
    const ctx = canvas.getContext('2d')
    const r = size * 0.12
    ctx.beginPath()
    ctx.moveTo(r, 0); ctx.lineTo(size - r, 0)
    ctx.quadraticCurveTo(size, 0, size, r)
    ctx.lineTo(size, size - r)
    ctx.quadraticCurveTo(size, size, size - r, size)
    ctx.lineTo(r, size)
    ctx.quadraticCurveTo(0, size, 0, size - r)
    ctx.lineTo(0, r)
    ctx.quadraticCurveTo(0, 0, r, 0)
    ctx.fillStyle = '#1a56db'
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${size * 0.55}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('J', size / 2, size / 2 + size * 0.03)
    writeFileSync(`public/icons/icon-${size}.png`, canvas.toBuffer('image/png'))
    console.log(`✅ Created icon-${size}.png`)
  }
} else {
  console.log('canvas not available — creating minimal PNG')
}
