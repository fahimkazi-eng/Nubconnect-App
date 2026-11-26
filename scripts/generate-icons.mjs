// ============================================================================
// NUBCONNECT — PWA icon generator (dependency-free).
// Renders the CAMPUS GLASS "N" monogram to PNG at the sizes the manifest and
// Apple devices need. Uses only Node's built-in zlib — no image libraries.
//
//   node scripts/generate-icons.mjs
//
// Writes: public/apple-touch-icon.png (180), public/icon-192.png, public/icon-512.png
// ============================================================================
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public');
mkdirSync(OUT, { recursive: true });

// --- PNG encoding (RGB, no interlace) ---------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(width, height, rgb) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  // compression (0), filter (0), interlace (0) already zero
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0; // filter: none
    rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// --- Brand mark --------------------------------------------------------------
const VIOLET = [0x92, 0x7c, 0xfa]; // Electric Violet
const AQUA = [0x72, 0xdc, 0xcb]; // Aqua
const WHITE = [0xff, 0xff, 0xff];

/** distance from point (x,y) to segment (x1,y1)-(x2,y2) */
function distToSegment(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((x - x1) * dx + (y - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return Math.hypot(x - px, y - py);
}

/**
 * Renders the full-bleed icon: diagonal violet→aqua background with the
 * white N monogram centered in the maskable safe zone.
 */
function render(size) {
  const rgb = Buffer.alloc(size * size * 3);
  // Monogram geometry (fractions of size — matches public/icon.svg).
  const x0 = 0.265, x1 = 0.735, y0 = 0.265, y1 = 0.735, stem = 0.1, half = 0.1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x + 0.5) / size;
      const fy = (y + 0.5) / size;
      let color;
      // Background: diagonal blend violet -> aqua.
      const t = Math.max(0, Math.min(1, (fx + fy) / 2));
      color = [
        Math.round(VIOLET[0] + (AQUA[0] - VIOLET[0]) * t),
        Math.round(VIOLET[1] + (AQUA[1] - VIOLET[1]) * t),
        Math.round(VIOLET[2] + (AQUA[2] - VIOLET[2]) * t),
      ];
      // N monogram.
      const inLeftStem = fx >= x0 - stem / 2 && fx <= x0 + stem / 2 && fy >= y0 && fy <= y1;
      const inRightStem = fx >= x1 - stem / 2 && fx <= x1 + stem / 2 && fy >= y0 && fy <= y1;
      const d = distToSegment(fx, fy, x0, y0, x1, y1);
      const inDiagonal = d <= half && fy >= y0 - half && fy <= y1 + half;
      if (inLeftStem || inRightStem || inDiagonal) color = WHITE;
      const i = (y * size + x) * 3;
      rgb[i] = color[0];
      rgb[i + 1] = color[1];
      rgb[i + 2] = color[2];
    }
  }
  return encodePng(size, size, rgb);
}

const targets = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
];
for (const { file, size } of targets) {
  writeFileSync(join(OUT, file), render(size));
  console.log(`wrote public/${file} (${size}x${size})`);
}
