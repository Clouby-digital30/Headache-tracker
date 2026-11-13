// The reward garden: one flower per check-in, drawn as SVG.
import { SPECIES } from './data.js';

// Small deterministic random generator so the garden looks the same every visit.
function rand(seed) {
  let t = (seed + 1) * 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function speciesFor(index) {
  const unlocked = SPECIES.filter((s) => s.at <= index + 1);
  const newest = unlocked[unlocked.length - 1];
  if (newest.at === index + 1) return newest; // the unlocking flower is always the new kind
  return unlocked[Math.floor(rand(index * 7 + 3)() * unlocked.length)];
}

const PETALS = {
  daisy: ['#FFF9EE', '#FBEFD9', '#FFFFFF'],
  poppy: ['#C4674B', '#D9805F', '#B5533A'],
  lavender: ['#9C8BB8', '#8676A8', '#B0A1C9'],
  tulip: ['#E3A08D', '#D98777', '#EDB9A2'],
  peony: ['#E8B4B0', '#DFA09F', '#F1CCC6'],
};

export function flower(kind, seed = 0) {
  const r = rand(seed);
  const c = PETALS[kind][Math.floor(r() * 3)];
  const lean = (r() - 0.5) * 6;
  const stem = `<path d="M0 0 Q ${lean} -16 0 -32" stroke="#6E8562" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M0 -12 q 7 -5 9 2 q -6 3 -9 -2" fill="#8A9A7B"/>`;
  let head = '';
  if (kind === 'daisy') {
    for (let i = 0; i < 9; i++) head += `<ellipse cx="0" cy="-39" rx="2.4" ry="6" fill="${c}" stroke="#E6D5B8" stroke-width=".4" transform="rotate(${i * 40} 0 -33)"/>`;
    head += '<circle cx="0" cy="-33" r="3.2" fill="#E0A93F"/>';
  } else if (kind === 'poppy') {
    for (let i = 0; i < 4; i++) head += `<circle cx="0" cy="-38" r="5.6" fill="${c}" transform="rotate(${i * 90 + 45} 0 -34)"/>`;
    head += '<circle cx="0" cy="-34" r="2.6" fill="#3B2F2A"/>';
  } else if (kind === 'lavender') {
    for (let i = 0; i < 6; i++) head += `<ellipse cx="${i % 2 ? 2 : -2}" cy="${-30 - i * 3.4}" rx="2.3" ry="2.9" fill="${c}"/>`;
  } else if (kind === 'tulip') {
    head = `<path d="M-6 -42 q 0 12 6 12 q 6 0 6 -12 l -3 4 l -3 -5 l -3 5 z" fill="${c}"/>`;
  } else {
    for (let i = 0; i < 6; i++) head += `<circle cx="0" cy="-39" r="5" fill="${c}" transform="rotate(${i * 60} 0 -35)"/>`;
    head += '<circle cx="0" cy="-35" r="4.6" fill="#F6DAD3"/><circle cx="0" cy="-35" r="2" fill="#E0A93F"/>';
  }
  return stem + head;
}

const MAX_SHOWN = 90;

export function gardenScene(total) {
  const first = Math.max(0, total - MAX_SHOWN);
  const items = [];
  for (let i = first; i < total; i++) {
    const r = rand(i * 13 + 5);
    const y = 128 + r() * 96;
    items.push({ i, x: 14 + r() * 332, y, scale: 0.55 + ((y - 128) / 96) * 0.6 });
  }
  items.sort((a, b) => a.y - b.y);
  const flowers = items.map((f) =>
    `<g transform="translate(${f.x.toFixed(1)} ${f.y.toFixed(1)}) scale(${f.scale.toFixed(2)})"${f.i === total - 1 ? ' class="newest"' : ''}>${flower(speciesFor(f.i).id, f.i)}</g>`).join('');
  const empty = total === 0
    ? '<text x="180" y="175" text-anchor="middle" font-size="13" fill="#6B5B52">Your first flower is waiting for today’s check-in</text>'
    : '';
  return `<svg class="garden" viewBox="0 0 360 240" role="img" aria-label="Your garden with ${total} flowers">
    <rect width="360" height="240" fill="#F7EBDD"/>
    <circle cx="292" cy="52" r="22" fill="#F2CFA4" opacity=".8"/>
    <path d="M0 118 Q 90 78 180 108 T 360 96 V240 H0Z" fill="#C9D3BC"/>
    <path d="M0 140 Q 120 104 220 132 T 360 124 V240 H0Z" fill="#B4C2A4"/>
    <path d="M0 168 Q 140 142 360 160 V240 H0Z" fill="#A3B492"/>
    ${flowers}${empty}
  </svg>`;
}
