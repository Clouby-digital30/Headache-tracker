// Checks a Lemon Squeezy license key straight from the browser - no backend
// needed. Lemon Squeezy's license endpoints are public and meant for this.
//
// Setup (see README "Selling Clary"): create the product, enable License
// Keys on it, then fill in BUY_URL below with the real checkout link.
//
// NOTE: Lemon Squeezy is shutting down (processing stops 2027-03-31). When
// migrating to its replacement, update BUY_URL *and* PACK_BUY_URL below, and
// swap LS_API for the new provider's equivalent license-key endpoints - both
// the main license and the pack license use the same `post()` helper.
const LS_API = 'https://api.lemonsqueezy.com/v1/licenses';
export const BUY_URL = 'https://REPLACE-ME.lemonsqueezy.com/buy/REPLACE-WITH-VARIANT-ID';
export const PACK_BUY_URL = 'https://REPLACE-ME.lemonsqueezy.com/buy/REPLACE-WITH-PACK-VARIANT-ID';

// Free check-ins before a license is required. Matches the point at which
// pattern recognition itself switches on, so the trial ends right after the
// app has shown what it can do.
export const TRIAL_LIMIT = 14;

export const trialUsed = (state) => Object.keys(state.entries).length;
export const isLicensed = (state) => !!(state.license && state.license.valid);
export const trialExhausted = (state) => !isLicensed(state) && trialUsed(state) >= TRIAL_LIMIT;

async function post(path, body) {
  const res = await fetch(`${LS_API}/${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: new URLSearchParams(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

// Activates a key for this device and stores the result on state.license.
// Returns { ok: true } or { ok: false, error }.
export async function applyLicenseKey(state, rawKey) {
  const key = rawKey.trim();
  if (!key) return { ok: false, error: 'empty' };
  try {
    const { ok, data } = await post('activate', { license_key: key, instance_name: 'Clary web app' });
    if (!ok || !data.activated) {
      state.license = { key, instanceId: null, valid: false };
      return { ok: false, error: data.error || null };
    }
    state.license = { key, instanceId: data.instance?.id || null, valid: true };
    return { ok: true };
  } catch {
    return { ok: false, error: null, network: true };
  }
}

// Re-confirms a stored license without using up another activation. Fails
// open on a network error, so a paying user offline isn't locked out.
export async function revalidate(state) {
  const lic = state.license;
  if (!lic || !lic.key || !lic.instanceId || lic.grandfathered) return;
  try {
    const { ok, data } = await post('validate', { license_key: lic.key, instance_id: lic.instanceId });
    state.license.valid = !!(ok && data.valid);
  } catch {
    // offline or the API is down: keep the last known status
  }
}

// Frees up this device's activation slot (e.g. before switching phones).
export async function releaseDevice(state) {
  const lic = state.license;
  if (!lic || !lic.key || !lic.instanceId) return { ok: true };
  try {
    await post('deactivate', { license_key: lic.key, instance_id: lic.instanceId });
  } catch {
    // best effort: clear locally regardless, the key still works elsewhere
  }
  state.license = { key: null, instanceId: null, valid: false };
  return { ok: true };
}

// --- Optional paid add-on packs (e.g. "Garden & self-care"), each its own
// product/license key, independent of the main trial/unlock above. ---------

export const isPackUnlocked = (state, packId) => !!(state.packs && state.packs[packId] && state.packs[packId].valid);

export async function applyPackKey(state, packId, rawKey) {
  const key = rawKey.trim();
  if (!key) return { ok: false, error: 'empty' };
  state.packs = state.packs || {};
  try {
    const { ok, data } = await post('activate', { license_key: key, instance_name: 'Clary web app' });
    if (!ok || !data.activated) {
      state.packs[packId] = { key, instanceId: null, valid: false };
      return { ok: false, error: data.error || null };
    }
    state.packs[packId] = { key, instanceId: data.instance?.id || null, valid: true };
    return { ok: true };
  } catch {
    return { ok: false, error: null, network: true };
  }
}

export async function revalidatePack(state, packId) {
  const lic = state.packs && state.packs[packId];
  if (!lic || !lic.key || !lic.instanceId) return;
  try {
    const { ok, data } = await post('validate', { license_key: lic.key, instance_id: lic.instanceId });
    lic.valid = !!(ok && data.valid);
  } catch {
    // offline or the API is down: keep the last known status
  }
}

export async function releasePack(state, packId) {
  const lic = state.packs && state.packs[packId];
  if (!lic || !lic.key || !lic.instanceId) return { ok: true };
  try {
    await post('deactivate', { license_key: lic.key, instance_id: lic.instanceId });
  } catch {
    // best effort: clear locally regardless, the key still works elsewhere
  }
  state.packs[packId] = { key: null, instanceId: null, valid: false };
  return { ok: true };
}
