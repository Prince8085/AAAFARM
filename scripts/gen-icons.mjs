// Generates PWA icons (public/icon-192.png, public/icon-512.png) without any
// dependencies — plain PNG encoding with Node's built-in zlib.
// Run: node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public')

// --- tiny bitmap font: a bold "A" (7 rows x 5 cols) ---
const A = [
  '01110',
  '10001',
  '10001',
  '11111',
  '10001',
  '10001',
  '10001',
]

const GREEN = [31, 109, 76]
const WHITE = [255, 255, 255]

// --- PNG encoder ---
const crcTable = []
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[n] = c >>> 0
}
const crc32 = (buf) => {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function makePng(size) {
  const raw = Buffer.alloc(size * (size * 3 + 1))
  const cell = size / 7 // glyph cell size
  const offset = size * 0.16 // margin so the A isn't edge-to-edge

  let off = 0
  for (let y = 0; y < size; y++) {
    raw[off++] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      // map pixel to glyph cell
      const gx = Math.floor((x - offset) / cell)
      const gy = Math.floor((y - offset) / cell)
      const on = gx >= 0 && gy >= 0 && gx < 5 && gy < 7 && A[gy][gx] === '1'
      const px = on ? WHITE : GREEN
      raw[off++] = px[0]
      raw[off++] = px[1]
      raw[off++] = px[2]
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type RGB
  const idat = deflateSync(raw, { level: 9 })

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(outDir, { recursive: true })
for (const size of [192, 512]) {
  const p = join(outDir, `icon-${size}.png`)
  writeFileSync(p, makePng(size))
  console.log(`wrote ${p}`)
}
