// The reward garden: one flower per check-in, drawn as SVG.
import { SPECIES, BUTTERFLY_MILESTONES, TREE_MILESTONE } from './data.js';

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
  protea: ['#C4577A', '#D97091', '#B5436A'],
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
  } else if (kind === 'protea') {
    for (let i = 0; i < 10; i++) head += `<path d="M0 -34 L2.3 -47 L0 -60 L-2.3 -47 Z" fill="${c}" transform="rotate(${i * 36} 0 -34)"/>`;
    head += '<ellipse cx="0" cy="-37" rx="5" ry="7" fill="#F4E7D6"/>';
  } else {
    for (let i = 0; i < 6; i++) head += `<circle cx="0" cy="-39" r="5" fill="${c}" transform="rotate(${i * 60} 0 -35)"/>`;
    head += '<circle cx="0" cy="-35" r="4.6" fill="#F6DAD3"/><circle cx="0" cy="-35" r="2" fill="#E0A93F"/>';
  }
  return stem + head;
}

// --- decorative extras (season, moon, tree, butterflies) -------------------

const SEASON_PALETTE = {
  spring: { sky: '#F6EFE2', hill1: '#CBDBC0', hill2: '#AFCBA8', hill3: '#96BA91' },
  summer: { sky: '#F7EBDD', hill1: '#C9D3BC', hill2: '#B4C2A4', hill3: '#A3B492' },
  autumn: { sky: '#F3E0C9', hill1: '#D9C295', hill2: '#C2A670', hill3: '#A98C55' },
  winter: { sky: '#EDEEF2', hill1: '#CBD1C8', hill2: '#B6BEB8', hill3: '#9FA89F' },
};

// Meteorological seasons, Northern-hemisphere (matches the rest of the app's
// seasonal references, e.g. the self-care cards).
export function seasonFor(date = new Date()) {
  const m = date.getMonth(); // 0-11
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
}

const SYNODIC_MONTH = 29.530588853; // days
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14); // a reference new moon

// Fraction of the lunar month elapsed: 0 and 1 are new moon, 0.5 is full.
// A light decorative touch, not meant to be precise to the hour.
export function moonPhase(date = new Date()) {
  const days = (date.getTime() - KNOWN_NEW_MOON) / 86400000;
  const phase = ((days % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
  return phase / SYNODIC_MONTH;
}

// A small moon badge: two arcs forming the lit portion for the current phase.
function moonIcon(phase, r) {
  const theta = phase * 2 * Math.PI;
  const rx = Math.abs(r * Math.cos(theta));
  const outerSweep = theta < Math.PI ? 1 : 0;
  const innerSweep = Math.cos(theta) > 0 ? 1 : 0;
  const lit = `M0 ${-r} A ${r} ${r} 0 0 ${outerSweep} 0 ${r} A ${rx.toFixed(2)} ${r} 0 0 ${innerSweep} 0 ${-r} Z`;
  return `<g aria-hidden="true">
    <circle cx="0" cy="0" r="${r}" fill="#3F3A52"/>
    <path d="${lit}" fill="#F3E9CE"/>
    <circle cx="0" cy="0" r="${r}" fill="none" stroke="#F3E9CE" stroke-width=".6" opacity=".4"/>
  </g>`;
}

function treeSvg() {
  return `<g transform="translate(38 172)" aria-hidden="true">
    <path d="M0 0 L-2.5 -36 L2.5 -36 Z" fill="#6E5A46"/>
    <circle cx="0" cy="-42" r="17" fill="#7C9468"/>
    <circle cx="-11" cy="-33" r="13" fill="#86A072"/>
    <circle cx="11" cy="-31" r="13" fill="#86A072"/>
    <circle cx="0" cy="-54" r="12" fill="#92AC7D"/>
  </g>`;
}

function butterflySvg(seed) {
  const r = rand(seed);
  const hue = r() < 0.5 ? '#D98777' : '#9C8BB8';
  const delay = (r() * 3).toFixed(2);
  return `<g class="butterfly" style="animation-delay:-${delay}s" aria-hidden="true">
    <path d="M0 0 Q -9 -11 -6.5 -2 Q -9 6.5 0 2 Z" fill="${hue}" opacity=".88"/>
    <path d="M0 0 Q 9 -11 6.5 -2 Q 9 6.5 0 2 Z" fill="${hue}" opacity=".88"/>
    <line x1="0" y1="-2.5" x2="0" y2="4" stroke="#3B2F2A" stroke-width="1"/>
  </g>`;
}

const MAX_SHOWN = 90;

/**
 * @param {number} total - how many check-ins (flowers) exist.
 * @param {object} [opts]
 * @param {string[]} [opts.dates] - sorted entry dates, same length as total;
 *   when given, each flower becomes tappable and carries its date.
 * @param {boolean} [opts.interactive] - adds pointer styling and data-date
 *   attributes for tapping (off for the small Today preview).
 * @param {string} [opts.emptyText] - localized message shown with no flowers yet.
 * @param {Date} [opts.now] - overridable for tests; defaults to the real date.
 */
export function gardenScene(total, opts = {}) {
  const { dates, interactive = false, emptyText = '', now = new Date() } = opts;
  const season = seasonFor(now);
  const pal = SEASON_PALETTE[season];
  const first = Math.max(0, total - MAX_SHOWN);
  const items = [];
  for (let i = first; i < total; i++) {
    const r = rand(i * 13 + 5);
    const y = 128 + r() * 96;
    items.push({ i, x: 14 + r() * 332, y, scale: 0.55 + ((y - 128) / 96) * 0.6 });
  }
  items.sort((a, b) => a.y - b.y);
  const flowers = items.map((f) => {
    const date = dates && dates[f.i];
    const tappable = interactive && !!date;
    const classes = ['flower', f.i === total - 1 && 'newest', tappable && 'flower-dot'].filter(Boolean).join(' ');
    const tapAttrs = tappable ? ` tabindex="0" role="button" data-action="show-flower-day" data-flower-date="${date}"` : '';
    // A generous invisible hit circle: the flower's actual petals and stem
    // are thin and sparse, so a real tap (or a bounding-box click in tests)
    // often lands in the gaps between them without one.
    const hit = tappable ? '<circle cx="0" cy="-28" r="24" fill="#000" opacity="0" pointer-events="all"/>' : '';
    return `<g class="${classes}" transform="translate(${f.x.toFixed(1)} ${f.y.toFixed(1)}) scale(${f.scale.toFixed(2)})"${tapAttrs}>${hit}${flower(speciesFor(f.i).id, f.i)}</g>`;
  }).join('');
  const empty = total === 0 && emptyText
    ? `<text x="180" y="175" text-anchor="middle" font-size="13" fill="#6B5B52">${emptyText}</text>` : '';
  const tree = total >= TREE_MILESTONE ? treeSvg() : '';
  const butterflies = BUTTERFLY_MILESTONES
    .map((m, bi) => (total >= m ? `<g transform="translate(${60 + bi * 230} ${70 + bi * 20})">${butterflySvg(m)}</g>` : ''))
    .join('');
  return `<svg class="garden" viewBox="0 0 360 240" role="img" aria-label="Garden with ${total} flowers">
    <rect width="360" height="240" fill="${pal.sky}"/>
    <g transform="translate(300 46)">${moonIcon(moonPhase(now), 16)}</g>
    <path d="M0 118 Q 90 78 180 108 T 360 96 V240 H0Z" fill="${pal.hill1}"/>
    <path d="M0 140 Q 120 104 220 132 T 360 124 V240 H0Z" fill="${pal.hill2}"/>
    ${tree}
    <path d="M0 168 Q 140 142 360 160 V240 H0Z" fill="${pal.hill3}"/>
    ${flowers}${butterflies}${empty}
  </svg>`;
}
