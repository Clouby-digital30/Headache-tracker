// CSV export, JSON backup and file download helpers.

export function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function cell(v) {
  let s = Array.isArray(v) ? v.join('; ') : String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // stop spreadsheets treating notes as formulas
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** labelOf(id) turns stored ids into readable names. */
export function toCsv(entries, labelOf) {
  const head = ['date', 'headache', 'intensity', 'type', 'onset', 'duration', 'locations', 'symptoms', 'impact',
    'medication', 'relief', 'period', 'stress', 'sleep_quality', 'sleep_hours', 'mood', 'triggers',
    'menopause_symptoms', 'hrt_taken', 'notes'];
  const rows = Object.keys(entries).sort().map((d) => {
    const e = entries[d];
    const h = e.headache || {};
    const names = (list) => (list || []).map(labelOf);
    return [
      d, h.had ? 'yes' : 'no', h.had ? h.intensity : '', h.had ? labelOf(h.type) : '', h.had ? labelOf(h.onset) : '', h.had ? labelOf(h.duration) : '',
      h.had ? names(h.locations) : '', h.had ? names(h.symptoms) : '', h.had ? labelOf(h.impact) : '',
      h.had ? (h.meds || []) : '', h.had ? labelOf(h.relief) : '',
      e.period || 'none', e.stress || '', e.sleep || '', e.sleepHours || '', e.mood || '',
      names(e.triggers), names(e.meno), e.hrt ? 'yes' : 'no', e.notes || '',
    ].map(cell).join(',');
  });
  return [head.join(','), ...rows].join('\n');
}
