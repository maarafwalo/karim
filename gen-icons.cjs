/**
 * Pure-Node PNG generator — no dependencies needed
 * Creates minimal valid PNG files for PWA icons
 */
const fs = require('fs')
const zlib = require('zlib')

function createPNG(size, bgColor, letter) {
  // PNG signature
  const sig = Buffer.from([137,80,78,71,13,10,26,10])

  // IHDR chunk: width, height, bit depth=8, color type=2 (RGB)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 2   // color type: RGB
  ihdr[10] = 0  // compression
  ihdr[11] = 0  // filter
  ihdr[12] = 0  // interlace

  // Build raw pixel data
  const [br, bg, bb] = bgColor
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3) // filter byte + RGB pixels
    row[0] = 0 // filter type None
    for (let x = 0; x < size; x++) {
      // Draw rounded rect background
      const margin = size * 0.12
      const inRect = x >= margin && x < size - margin && y >= margin && y < size - margin
      // Simple circle-like rounding at corners
      const cx = Math.min(x - margin, size - margin - x - 1)
      const cy = Math.min(y - margin, size - margin - y - 1)
      const inCorner = cx < size * 0.12 && cy < size * 0.12
      const cornerDist = Math.sqrt((cx - size * 0.12) ** 2 + (cy - size * 0.12) ** 2)
      const inBg = inRect && !(inCorner && cornerDist > size * 0.12)

      // Draw letter "J" in center
      const lx = (x / size - 0.5) * 10  // -5 to 5
      const ly = (y / size - 0.5) * 10  // -5 to 5
      // Simple "J" shape definition
      const isJ = (
        // Top horizontal bar
        (ly >= -4 && ly <= -2.8 && lx >= -2 && lx <= 2) ||
        // Vertical stroke
        (lx >= 0.5 && lx <= 2 && ly >= -4 && ly <= 2) ||
        // Bottom curve left
        (lx >= -2 && lx <= 0.5 && ly >= 1 && ly <= 3 &&
         Math.sqrt((lx + 0.75) ** 2 + (ly - 1) ** 2) >= 0.8 &&
         Math.sqrt((lx + 0.75) ** 2 + (ly - 1) ** 2) <= 2.5)
      )

      const offset = 1 + x * 3
      if (inBg) {
        if (isJ) {
          row[offset] = 255; row[offset+1] = 255; row[offset+2] = 255
        } else {
          row[offset] = br; row[offset+1] = bg; row[offset+2] = bb
        }
      } else {
        row[offset] = 240; row[offset+1] = 242; row[offset+2] = 245
      }
    }
    rows.push(row)
  }
  const rawData = Buffer.concat(rows)
  const compressed = zlib.deflateSync(rawData)

  function chunk(type, data) {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const typeBytes = Buffer.from(type, 'ascii')
    const crcData = Buffer.concat([typeBytes, data])
    const crc = crc32(crcData)
    const crcBuf = Buffer.alloc(4)
    crcBuf.writeUInt32BE(crc >>> 0)
    return Buffer.concat([len, typeBytes, data, crcBuf])
  }

  function crc32(buf) {
    const table = makeCRCTable()
    let crc = 0xFFFFFFFF
    for (const b of buf) crc = (crc >>> 8) ^ table[(crc ^ b) & 0xFF]
    return (crc ^ 0xFFFFFFFF) >>> 0
  }

  let _table = null
  function makeCRCTable() {
    if (_table) return _table
    _table = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
      _table[i] = c
    }
    return _table
  }

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

fs.mkdirSync('public/icons', { recursive: true })
for (const size of [192, 512]) {
  const png = createPNG(size, [26, 86, 219], 'J') // #1a56db
  fs.writeFileSync(`public/icons/icon-${size}.png`, png)
  console.log(`✅ icon-${size}.png (${png.length} bytes)`)
}
console.log('Done!')
