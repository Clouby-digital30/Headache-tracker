// CSV export, JSON backup and file download helpers.
import { t } from './i18n.js';

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

/** labelOf(id) turns stored ids into readable names, in the current language. */
export function toCsv(entries, labelOf, lang = 'en') {
  const head = [
    'csvDate', 'csvHeadache', 'csvIntensity', 'csvType', 'csvOnset', 'csvDuration', 'csvLocations', 'csvSymptoms',
    'csvImpact', 'csvMedication', 'csvRelief', 'csvPeriod', 'csvStress', 'csvSleepQuality', 'csvSleepHours', 'csvMood',
    'csvTriggers', 'csvMenopauseSymptoms', 'csvHrtTaken', 'csvNotes',
  ].map((k) => t(lang, k));
  const yn = (b) => t(lang, b ? 'csvYes' : 'csvNo');
  const rows = Object.keys(entries).sort().map((d) => {
    const e = entries[d];
    const h = e.headache || {};
    const names = (list) => (list || []).map(labelOf);
    return [
      d, yn(h.had), h.had ? h.intensity : '', h.had ? labelOf(h.type) : '', h.had ? labelOf(h.onset) : '', h.had ? labelOf(h.duration) : '',
      h.had ? names(h.locations) : '', h.had ? names(h.symptoms) : '', h.had ? labelOf(h.impact) : '',
      h.had ? (h.meds || []) : '', h.had ? labelOf(h.relief) : '',
      labelOf(e.period || 'none'), e.stress || '', e.sleep || '', e.sleepHours || '', e.mood || '',
      names(e.triggers), names(e.meno), yn(e.hrt), e.notes || '',
    ].map(cell).join(',');
  });
  return [head.join(','), ...rows].join('\n');
}
