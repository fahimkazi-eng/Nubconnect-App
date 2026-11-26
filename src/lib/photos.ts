// ============================================================================
// NUBCONNECT — Photo library for demonstration content.
//
// Strategy (per product policy §16):
//  • Two real photographs ship from this project's own bundled assets
//    (/public/demo/campus-1.jpg, /public/demo/campus-2.jpg).
//  • Everything else is ORIGINAL generated SVG scene art — layered,
//    illustrative scenes (not flat rectangles), deterministic per seed,
//    different art per content type (campus, portrait, room, product, cover).
//  • All demo imagery is labelled DEMO in the UI and recorded in
//    public/demo/ATTRIBUTION.md. Real rooms/products/students are never
//    fabricated with stock photography.
// ============================================================================
import { hashSeed } from './format';

/* --- palette pools per content type (CAMPUS ORBIT accents) ---------------- */
const CAMPUS_SKIES = ['#A7C4E8', '#B8D5EA', '#9FC3E4', '#C3D9EC', '#8FB6DE'];
const CAMPUS_WALLS = ['#E8E0D0', '#DDD5C5', '#E2DACA', '#D8D0BE'];
const ACCENTS = ['#927CFA', '#72DCCB', '#FF735D', '#C9F36B', '#F1D36B'];
const ROOM_WALLS = ['#EDE7DC', '#E3DCCF', '#F0EAE0', '#E8E1D3'];
const ROOM_FLOORS = ['#C9A97C', '#B99B6F', '#D2B58A', '#C5A277'];
const PRODUCT_BGS = ['#F0EBE0', '#EAE4D8', '#F4EFE6', '#E6E0D2'];
const SKINS = ['#E7B98E', '#C68B59', '#8D5A3A', '#F0C8A0', '#A96F44'];
const HAIRS = ['#231A15', '#3A2A1D', '#111', '#4B3826', '#2C1F14'];

function svg(w: number, h: number, body: string): string {
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`)
  );
}

function band(seed: string, arr: readonly string[]): string {
  return arr[hashSeed(seed) % arr.length]!;
}

/* --- Campus scene: sky, buildings, trees, foreground path --------------- */
export function campusScene(seed: string, w = 1200, h = 800): string {
  const sky = band(seed + 'sky', CAMPUS_SKIES);
  const wall = band(seed + 'wall', CAMPUS_WALLS);
  const accent = band(seed + 'accent', ACCENTS);
  const off = hashSeed(seed) % 60;
  return svg(
    w,
    h,
    `
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${sky}"/><stop offset="1" stop-color="#F3EFE7"/>
    </linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>
    <circle cx="${w * 0.82}" cy="${h * 0.18}" r="${h * 0.1}" fill="#FBE7B4" opacity=".9"/>
    <rect x="${w * 0.04}" y="${h * 0.36 + off}" width="${w * 0.3}" height="${h * 0.5}" rx="8" fill="${wall}"/>
    <rect x="${w * 0.38}" y="${h * 0.28}" width="${w * 0.26}" height="${h * 0.58}" rx="8" fill="${wall}" opacity=".92"/>
    <rect x="${w * 0.68}" y="${h * 0.42 - off}" width="${w * 0.24}" height="${h * 0.44}" rx="8" fill="${wall}"/>
    <rect x="${w * 0.38}" y="${h * 0.28}" width="${w * 0.26}" height="14" fill="${accent}" opacity=".85"/>
    ${windows(w, h, seed)}
    <ellipse cx="${w * 0.14}" cy="${h * 0.86}" rx="${w * 0.08}" ry="${h * 0.05}" fill="#7FA96B"/>
    <ellipse cx="${w * 0.55}" cy="${h * 0.9}" rx="${w * 0.09}" ry="${h * 0.05}" fill="#6E9A5C"/>
    <rect x="0" y="${h * 0.92}" width="${w}" height="${h * 0.08}" fill="#DDD5C2"/>
    <path d="M0 ${h * 0.94} Q ${w / 2} ${h * 0.9} ${w} ${h * 0.95}" stroke="#CFC5AE" stroke-width="6" fill="none"/>
  `,
  );
}

function windows(w: number, h: number, seed: string): string {
  let out = '';
  for (let i = 0; i < 14; i++) {
    const k = hashSeed(seed + 'win' + i) % 100;
    const x = w * 0.06 + (i % 7) * (w * 0.052);
    const y = h * (0.4 + Math.floor(i / 7) * 0.14);
    out += `<rect x="${x}" y="${y}" width="${w * 0.03}" height="${h * 0.08}" rx="3" fill="${k % 3 === 0 ? '#9FB6D4' : '#6B7FA3'}" opacity=".9"/>`;
  }
  return out;
}

/* --- Portrait scene: layered person silhouette (no real student photos) - */
export function portraitScene(seed: string, w = 400, h = 400): string {
  const bg = band(seed + 'pbg', ACCENTS);
  const skin = band(seed + 'skin', SKINS);
  const hair = band(seed + 'hair', HAIRS);
  const female = hashSeed(seed) % 2 === 0;
  return svg(
    w,
    h,
    `
    <rect width="${w}" height="${h}" fill="${bg}" opacity=".18"/>
    <rect width="${w}" height="${h}" fill="${bg}" opacity=".22"/>
    <circle cx="${w / 2}" cy="${h * 0.72}" r="${w * 0.42}" fill="${bg}" opacity=".28"/>
    ${female ? longHair(w, h, hair) : shortHair(w, h, hair)}
    <circle cx="${w / 2}" cy="${h * 0.42}" r="${w * 0.19}" fill="${skin}"/>
    <rect x="${w * 0.28}" y="${h * 0.62}" width="${w * 0.44}" height="${h * 0.38}" rx="${w * 0.16}" fill="${bg}"/>
    <rect x="${w * 0.28}" y="${h * 0.62}" width="${w * 0.44}" height="${h * 0.38}" rx="${w * 0.16}" fill="${skin}" opacity=".25"/>
  `,
  );
}

function shortHair(w: number, h: number, hair: string): string {
  return `<path d="M${w * 0.31} ${h * 0.4} q${w * 0.19} -${h * 0.24} ${w * 0.38} 0 l${w * 0.02} ${h * 0.06} q-${w * 0.21} -${h * 0.09} -${w * 0.42} 0 z" fill="${hair}"/>`;
}

function longHair(w: number, h: number, hair: string): string {
  return `<path d="M${w * 0.3} ${h * 0.42} q${w * 0.2} -${h * 0.26} ${w * 0.4} 0 l${w * 0.05} ${h * 0.34} q-${w * 0.05} ${h * 0.05} -${w * 0.12} ${h * 0.02} l-${w * 0.02} -${h * 0.18} l-${w * 0.03} ${h * 0.18} q-${w * 0.08} ${h * 0.03} -${w * 0.13} -${h * 0.02} z" fill="${hair}"/>`;
}

/* --- Room interior scene: wall, floor, bed/window/door by room type ----- */
export function roomScene(
  seed: string,
  kind: 'Bedroom' | 'Kitchen' | 'Bathroom' | 'Living Area',
  w = 1200,
  h = 800,
): string {
  const wall = band(seed + 'rw', ROOM_WALLS);
  const floor = band(seed + 'rf', ROOM_FLOORS);
  const accent = band(seed + 'ra', ACCENTS);
  const base = `
    <rect width="${w}" height="${h}" fill="${wall}"/>
    <rect y="${h * 0.62}" width="${w}" height="${h * 0.38}" fill="${floor}"/>
    <rect y="${h * 0.62}" width="${w}" height="8" fill="#00000014"/>
  `;
  const extras = (() => {
    switch (kind) {
      case 'Bedroom':
        return `
          <rect x="${w * 0.08}" y="${h * 0.42}" width="${w * 0.42}" height="${h * 0.3}" rx="14" fill="#8A94B8"/>
          <rect x="${w * 0.08}" y="${h * 0.38}" width="${w * 0.42}" height="${h * 0.08}" rx="8" fill="${accent}" opacity=".7"/>
          <rect x="${w * 0.12}" y="${h * 0.36}" width="${w * 0.1}" height="${h * 0.08}" rx="6" fill="#FFFFFF" opacity=".9"/>
          <rect x="${w * 0.62}" y="${h * 0.14}" width="${w * 0.26}" height="${h * 0.3}" rx="10" fill="#AFD0E8"/>
          <rect x="${w * 0.64}" y="${h * 0.16}" width="${w * 0.1}" height="${h * 0.05}" rx="4" fill="#FFFFFF" opacity=".8"/>
          <rect x="${w * 0.64}" y="${h * 0.24}" width="${w * 0.1}" height="${h * 0.05}" rx="4" fill="#FFFFFF" opacity=".8"/>
          <rect x="${w * 0.76}" y="${h * 0.16}" width="${w * 0.1}" height="${h * 0.05}" rx="4" fill="#FFFFFF" opacity=".8"/>`;
      case 'Kitchen':
        return `
          <rect x="${w * 0.06}" y="${h * 0.34}" width="${w * 0.5}" height="${h * 0.3}" rx="8" fill="#D9D2C4"/>
          <rect x="${w * 0.06}" y="${h * 0.34}" width="${w * 0.5}" height="12" rx="6" fill="#4E4637"/>
          <rect x="${w * 0.56}" y="${h * 0.44}" width="${w * 0.14}" height="${h * 0.18}" rx="6" fill="${accent}" opacity=".8"/>
          <circle cx="${w * 0.63}" cy="${h * 0.53}" r="${w * 0.015}" fill="#FFFFFF"/>
          <rect x="${w * 0.74}" y="${h * 0.36}" width="${w * 0.16}" height="${h * 0.26}" rx="6" fill="#BFC8CE"/>`;
      case 'Bathroom':
        return `
          <rect x="${w * 0.08}" y="${h * 0.36}" width="${w * 0.34}" height="${h * 0.26}" rx="10" fill="#FFFFFF"/>
          <rect x="${w * 0.12}" y="${h * 0.4}" width="${w * 0.26}" height="${h * 0.06}" rx="6" fill="#C7D4DB"/>
          <rect x="${w * 0.12}" y="${h * 0.48}" width="${w * 0.26}" height="${h * 0.1}" rx="6" fill="#E8EFF2"/>
          <rect x="${w * 0.5}" y="${h * 0.2}" width="${w * 0.22}" height="${h * 0.42}" rx="40" fill="#DCE8EC"/>
          <rect x="${w * 0.53}" y="${h * 0.24}" width="${w * 0.16}" height="${h * 0.08}" rx="8" fill="#9FC3D4"/>`;
      default:
        return `
          <rect x="${w * 0.05}" y="${h * 0.4}" width="${w * 0.44}" height="${h * 0.22}" rx="16" fill="${accent}" opacity=".65"/>
          <rect x="${w * 0.09}" y="${h * 0.44}" width="${w * 0.36}" height="${h * 0.14}" rx="12" fill="#FFFFFF" opacity=".55"/>
          <rect x="${w * 0.58}" y="${h * 0.12}" width="${w * 0.3}" height="${h * 0.34}" rx="10" fill="#AFD0E8"/>
          <rect x="${w * 0.6}" y="${h * 0.14}" width="${w * 0.12}" height="${h * 0.06}" rx="4" fill="#FFFFFF" opacity=".85"/>
          <rect x="${w * 0.74}" y="${h * 0.14}" width="${w * 0.12}" height="${h * 0.06}" rx="4" fill="#FFFFFF" opacity=".85"/>
          <ellipse cx="${w * 0.85}" cy="${h * 0.78}" rx="${w * 0.06}" ry="${h * 0.05}" fill="#7FA96B"/>`;
    }
  })();
  return svg(w, h, base + extras);
}

/* --- Product scene: shelf bg + product silhouette ----------------------- */
export function productScene(
  seed: string,
  category: string,
  w = 800,
  h = 800,
): string {
  const bg = band(seed + 'pb', PRODUCT_BGS);
  const accent = band(seed + 'pa', ACCENTS);
  const shapes = (() => {
    switch (category) {
      case 'Books & Academic':
        return `<rect x="${w * 0.28}" y="${h * 0.3}" width="${w * 0.12}" height="${h * 0.42}" rx="6" fill="${accent}"/>
                <rect x="${w * 0.44}" y="${h * 0.36}" width="${w * 0.12}" height="${h * 0.36}" rx="6" fill="#72DCCB"/>
                <rect x="${w * 0.6}" y="${h * 0.34}" width="${w * 0.11}" height="${h * 0.38}" rx="6" fill="#4E6B10"/>`;
      case 'Electronics':
      case 'Computers':
        return `<rect x="${w * 0.24}" y="${h * 0.32}" width="${w * 0.52}" height="${h * 0.34}" rx="18" fill="#2E2B45"/>
                <rect x="${w * 0.28}" y="${h * 0.36}" width="${w * 0.44}" height="${h * 0.26}" rx="8" fill="${accent}" opacity=".85"/>
                <rect x="${w * 0.4}" y="${h * 0.66}" width="${w * 0.2}" height="${h * 0.08}" rx="6" fill="#D8D2C2"/>`;
      case 'Furniture':
      case 'Home Items':
        return `<rect x="${w * 0.26}" y="${h * 0.34}" width="${w * 0.48}" height="${h * 0.16}" rx="14" fill="${accent}" opacity=".8"/>
                <rect x="${w * 0.3}" y="${h * 0.5}" width="${w * 0.08}" height="${h * 0.26}" rx="4" fill="#B99B6F"/>
                <rect x="${w * 0.62}" y="${h * 0.5}" width="${w * 0.08}" height="${h * 0.26}" rx="4" fill="#B99B6F"/>`;
      case 'Clothing':
        return `<path d="M${w * 0.38} ${h * 0.3} h${w * 0.24} l${w * 0.08} ${h * 0.08} l-${w * 0.06} ${h * 0.06} v${h * 0.3} h-${w * 0.28} v-${h * 0.3} l-${w * 0.06} -${h * 0.06} z" fill="${accent}" opacity=".85"/>`;
      case 'Sports':
        return `<circle cx="${w / 2}" cy="${h * 0.46}" r="${w * 0.18}" fill="${accent}" opacity=".85"/>
                <path d="M${w * 0.32} ${h * 0.46} h${w * 0.36}" stroke="#fff" stroke-width="8"/>
                <circle cx="${w / 2}" cy="${h * 0.46}" r="${w * 0.05}" fill="#fff"/>`;
      default:
        return `<rect x="${w * 0.3}" y="${h * 0.34}" width="${w * 0.4}" height="${h * 0.32}" rx="20" fill="${accent}" opacity=".8"/>
                <circle cx="${w * 0.5}" cy="${h * 0.5}" r="${w * 0.06}" fill="#fff" opacity=".7"/>`;
    }
  })();
  return svg(w, h, `<rect width="${w}" height="${h}" fill="${bg}"/>${shapes}`);
}

/* --- Community cover: layered abstract scene ---------------------------- */
export function coverScene(seed: string, w = 1200, h = 500): string {
  const a = band(seed + 'c1', ACCENTS);
  const b = band(seed + 'c2', ACCENTS);
  const o = hashSeed(seed) % 40;
  return svg(
    w,
    h,
    `
    <defs><linearGradient id="c" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${a}" stop-opacity=".8"/><stop offset="1" stop-color="${b}" stop-opacity=".55"/>
    </linearGradient></defs>
    <rect width="${w}" height="${h}" fill="#F2EEE6"/>
    <rect width="${w}" height="${h}" fill="url(#c)"/>
    <circle cx="${w * 0.12}" cy="${h * 0.8 + o}" r="${h * 0.5}" fill="#fff" opacity=".14"/>
    <circle cx="${w * 0.7}" cy="${h * 0.2}" r="${h * 0.34}" fill="#fff" opacity=".12"/>
    <circle cx="${w * 0.88}" cy="${h * 0.7}" r="${h * 0.42}" fill="#211B35" opacity=".08"/>
    <path d="M0 ${h * 0.9} L${w * 0.3} ${h * 0.55} L${w * 0.6} ${h * 0.85} L${w} ${h * 0.45} L${w} ${h} L0 ${h} Z" fill="#211B35" opacity=".1"/>
  `,
  );
}

/* --- Hostel dorm scene: bunks, window, study desk ------------------------- */
export function hostelScene(seed: string, w = 1200, h = 800): string {
  const wall = band(seed + 'hw', ROOM_WALLS);
  const floor = band(seed + 'hf', ROOM_FLOORS);
  const accent = band(seed + 'ha', ACCENTS);
  return svg(
    w,
    h,
    `
    <rect width="${w}" height="${h}" fill="${wall}"/>
    <rect y="${h * 0.66}" width="${w}" height="${h * 0.34}" fill="${floor}"/>
    <rect y="${h * 0.66}" width="${w}" height="8" fill="#00000014"/>
    <rect x="${w * 0.05}" y="${h * 0.1}" width="${w * 0.46}" height="${h * 0.52}" rx="10" fill="#8A94B8"/>
    <rect x="${w * 0.05}" y="${h * 0.34}" width="${w * 0.46}" height="${h * 0.05}" fill="#6B7494"/>
    <rect x="${w * 0.09}" y="${h * 0.14}" width="${w * 0.38}" height="${h * 0.11}" rx="8" fill="${accent}" opacity=".6"/>
    <rect x="${w * 0.09}" y="${h * 0.4}" width="${w * 0.38}" height="${h * 0.11}" rx="8" fill="#72DCCB" opacity=".45"/>
    <rect x="${w * 0.49}" y="${h * 0.18}" width="${w * 0.045}" height="${h * 0.42}" rx="4" fill="#6B7494" opacity=".8"/>
    <rect x="${w * 0.6}" y="${h * 0.12}" width="${w * 0.24}" height="${h * 0.3}" rx="10" fill="#AFD0E8"/>
    <rect x="${w * 0.63}" y="${h * 0.15}" width="${w * 0.09}" height="${h * 0.06}" rx="4" fill="#FFFFFF" opacity=".8"/>
    <rect x="${w * 0.75}" y="${h * 0.15}" width="${w * 0.09}" height="${h * 0.06}" rx="4" fill="#FFFFFF" opacity=".8"/>
    <rect x="${w * 0.62}" y="${h * 0.48}" width="${w * 0.26}" height="${h * 0.05}" rx="4" fill="#B99B6F"/>
    <rect x="${w * 0.64}" y="${h * 0.53}" width="${w * 0.05}" height="${h * 0.13}" rx="3" fill="#B99B6F"/>
    <rect x="${w * 0.81}" y="${h * 0.53}" width="${w * 0.05}" height="${h * 0.13}" rx="3" fill="#B99B6F"/>
    <rect x="${w * 0.66}" y="${h * 0.56}" width="${w * 0.16}" height="${h * 0.03}" rx="2" fill="${accent}" opacity=".7"/>
  `,
  );
}

/* --- Mess dining scene: long table, benches, serving counter ------------- */
export function messScene(seed: string, w = 1200, h = 800): string {
  const wall = band(seed + 'mw', ROOM_WALLS);
  const floor = band(seed + 'mf', ROOM_FLOORS);
  const accent = band(seed + 'ma', ACCENTS);
  return svg(
    w,
    h,
    `
    <rect width="${w}" height="${h}" fill="${wall}"/>
    <rect y="${h * 0.6}" width="${w}" height="${h * 0.4}" fill="${floor}"/>
    <rect y="${h * 0.6}" width="${w}" height="8" fill="#00000014"/>
    <rect x="${w * 0.06}" y="${h * 0.06}" width="${w * 0.88}" height="${h * 0.16}" rx="8" fill="#D9D2C4"/>
    <circle cx="${w * 0.16}" cy="${h * 0.14}" r="${w * 0.05}" fill="#FBE7B4" opacity=".9"/>
    <rect x="${w * 0.3}" y="${h * 0.1}" width="${w * 0.3}" height="${h * 0.08}" rx="6" fill="${accent}" opacity=".7"/>
    <rect x="${w * 0.66}" y="${h * 0.1}" width="${w * 0.24}" height="${h * 0.08}" rx="6" fill="#72DCCB" opacity=".55"/>
    <rect x="${w * 0.12}" y="${h * 0.44}" width="${w * 0.76}" height="${h * 0.06}" rx="8" fill="#B99B6F"/>
    <rect x="${w * 0.16}" y="${h * 0.5}" width="${w * 0.05}" height="${h * 0.14}" rx="4" fill="#A8895F"/>
    <rect x="${w * 0.79}" y="${h * 0.5}" width="${w * 0.05}" height="${h * 0.14}" rx="4" fill="#A8895F"/>
    <rect x="${w * 0.08}" y="${h * 0.38}" width="${w * 0.1}" height="${h * 0.06}" rx="4" fill="#B99B6F"/>
    <rect x="${w * 0.82}" y="${h * 0.38}" width="${w * 0.1}" height="${h * 0.06}" rx="4" fill="#B99B6F"/>
    <circle cx="${w * 0.3}" cy="${h * 0.42}" r="${w * 0.02}" fill="#FFFFFF" opacity=".9"/>
    <circle cx="${w * 0.44}" cy="${h * 0.42}" r="${w * 0.02}" fill="#FFFFFF" opacity=".9"/>
    <circle cx="${w * 0.58}" cy="${h * 0.42}" r="${w * 0.02}" fill="#FFFFFF" opacity=".9"/>
    <circle cx="${w * 0.7}" cy="${h * 0.42}" r="${w * 0.02}" fill="#FFFFFF" opacity=".9"/>
  `,
  );
}

/* --- Real photographs bundled with this project ------------------------- */
export const PROJECT_PHOTO_CAMPUS_1 = '/demo/campus-1.jpg';
export const PROJECT_PHOTO_CAMPUS_2 = '/demo/campus-2.jpg';
