// Time-of-day for the garden scene. Clary has no account and never asks for
// location, so "what time is it where you are" can only come from a
// timezone the user picks themselves in Settings (defaulting to whatever
// the device itself reports) - not from GPS or IP-based guessing, and not
// real sunrise/sunset astronomy, which would need a precise location. These
// are five fixed clock bands instead: a reasonable approximation, not an
// almanac.

// The local {hour, minute} in an IANA timezone, for a given moment. Falls
// back to the device's own local time if the timezone string is invalid.
export function localTime(date, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, hour: 'numeric', minute: 'numeric', hour12: false,
    }).formatToParts(date);
    const get = (type) => Number(parts.find((p) => p.type === type)?.value);
    return { hour: get('hour') % 24, minute: get('minute') };
  } catch {
    return { hour: date.getHours(), minute: date.getMinutes() };
  }
}

// Ordered by minutes-since-midnight each band ends at.
const BANDS = [
  [5 * 60, 'night'],
  [6.5 * 60, 'sunrise'],
  [18 * 60, 'day'],
  [19.5 * 60, 'sunset'],
  [22 * 60, 'twilight'],
  [24 * 60, 'night'],
];

export function dayPhase(date, timeZone) {
  const { hour, minute } = localTime(date, timeZone);
  const mins = hour * 60 + minute;
  for (const [until, phase] of BANDS) if (mins < until) return phase;
  return 'night';
}

// Best-effort default: the device's own timezone, used until the user picks
// one explicitly in Settings.
export const deviceTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
};

// All IANA timezone names the browser knows, for a Settings picker. Falls
// back to just the device's own zone where the (newer) API isn't available.
export function timezoneOptions() {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [deviceTimezone()];
  }
}
