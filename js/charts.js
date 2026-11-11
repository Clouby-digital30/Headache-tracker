// Small SVG charts. Text uses ink colours; marks carry the data colour.
const INK_MUTED = '#6B5B52';
const GRID = '#E9DDCF';
const BAR = '#B85A3E';

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** data: [{label, value, tip}] */
export function barChart(data, { ariaLabel = 'Chart' } = {}) {
  const W = 340, H = 170, left = 26, right = 6, top = 10, bottom = 24;
  const max = Math.max(4, ...data.map((d) => d.value));
  const step = Math.ceil(max / 4);
  const top4 = step * 4;
  const plotW = W - left - right, plotH = H - top - bottom;
  const slot = plotW / data.length;
  const barW = Math.min(26, slot - 4);
  const y = (v) => top + plotH - (v / top4) * plotH;

  let grid = '';
  for (let t = 0; t <= top4; t += step * 2) {
    grid += `<line x1="${left}" x2="${W - right}" y1="${y(t)}" y2="${y(t)}" stroke="${GRID}" stroke-width="1"/>
      <text x="${left - 6}" y="${y(t) + 4}" text-anchor="end" font-size="10" fill="${INK_MUTED}">${t}</text>`;
  }
  const bars = data.map((d, i) => {
    const cx = left + slot * i + slot / 2;
    const h = (d.value / top4) * plotH;
    const r = Math.min(4, h);
    const x = cx - barW / 2, by = y(d.value);
    const shape = h > 0
      ? `<path d="M${x} ${top + plotH} V${by + r} Q${x} ${by} ${x + r} ${by} H${x + barW - r} Q${x + barW} ${by} ${x + barW} ${by + r} V${top + plotH} Z" fill="${BAR}"/>`
      : '';
    return `<g class="bar" tabindex="0" data-tip="${escAttr(d.tip)}">
      <rect x="${left + slot * i}" y="${top}" width="${slot}" height="${plotH}" fill="transparent"/>
      ${shape}
      <text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="10" fill="${INK_MUTED}">${escAttr(d.label)}</text>
    </g>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escAttr(ariaLabel)}">${grid}${bars}</svg>`;
}

/** Two labelled horizontal bars: with the factor vs without it. */
export function compareBars(withRate, withoutRate) {
  const row = (cls, label, rate) => `<div class="cmp-row">
      <span class="cmp-label">${label}</span>
      <span class="cmp-track"><span class="cmp-fill ${cls}" style="width:${Math.max(2, Math.round(rate * 100))}%"></span></span>
      <span class="cmp-value">${Math.round(rate * 100)}%</span>
    </div>`;
  return `<div class="cmp">${row('with', 'With', withRate)}${row('without', 'Without', withoutRate)}</div>`;
}
