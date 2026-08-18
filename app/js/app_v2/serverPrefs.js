// serverPrefs.js — Cross-device preference sync (Option A)
//
// Problem: preferences were stored only in per-device localStorage, so a theme /
// layout change on one device never appeared on another.
//
// Solution: transparently mirror a whitelist of localStorage keys to the
// self-hosted backend (/api/settings/<key>). On boot we pull the server's
// values down and seed localStorage, then re-apply the theme. Every subsequent
// localStorage write for a synced key is pushed to the server (debounced).
//
// Fail-soft: on the public (GitHub Pages) build there is no /api backend, so
// every fetch/put is wrapped in try/catch and silently no-ops. No exceptions
// bubble up to the caller and boot is never blocked.

const SETTINGS_BASE = '/api/settings';

// Keys we mirror to the server. Broad prefix match keeps future keys covered.
const SYNC_PREFIXES = ['cc-', 'catalogViewMode'];
// Per-coin flip state etc. is view-state, not a preference — never sync it.
const SYNC_EXCLUDE_PREFIXES = ['cc-flipped-'];

function isSyncedKey(key) {
  if (typeof key !== 'string') return false;
  if (SYNC_EXCLUDE_PREFIXES.some(p => key.startsWith(p))) return false;
  return SYNC_PREFIXES.some(p => key.startsWith(p));
}

// ---- raw localStorage write (bypasses the interceptor so we don't loop) ----
const _origSetItem = window.localStorage.setItem.bind(window.localStorage);
function rawSet(key, value) {
  _origSetItem(key, value);
}

// ---- debounced push to server ----------------------------------------------
const _timers = new Map();
function schedulePush(key, value) {
  if (_timers.has(key)) clearTimeout(_timers.get(key));
  _timers.set(key, setTimeout(() => {
    _timers.delete(key);
    pushToServer(key, value);
  }, 400));
}

function getNativeFetch() {
  return window.__nativeFetch || window.fetch;
}

async function pushToServer(key, value) {
  try {
    const res = await getNativeFetch()(`${SETTINGS_BASE}/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: value })
    });
    if (!res.ok) {
      console.warn(`[serverPrefs] push "${key}" failed: HTTP ${res.status}`);
    }
  } catch (e) {
    // Offline / no backend (e.g. public build) — non-fatal.
    console.debug(`[serverPrefs] push "${key}" skipped:`, e.message);
  }
}

// ---- intercept localStorage.setItem ----------------------------------------
let _installed = false;
export function installLocalStorageInterceptor() {
  if (_installed) return;
  _installed = true;
  window.localStorage.setItem = function (key, value) {
    _origSetItem(key, value);
    if (isSyncedKey(key)) schedulePush(key, value);
  };
}

// ---- boot-time pull from server --------------------------------------------
async function fetchAllSettings() {
  const res = await getNativeFetch()(SETTINGS_BASE, { method: 'GET', cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json(); // { key: value, ... }
}

// Seed localStorage from the server. Returns the fetched map (may be {}).
export async function syncPrefsFromServer() {
  const map = await fetchAllSettings();
  for (const [key, serverVal] of Object.entries(map || {})) {
    if (!isSyncedKey(key)) continue;
    const localVal = window.localStorage.getItem(key);
    if (localVal !== serverVal) {
      // Use rawSet so we don't immediately re-push the same value back.
      rawSet(key, serverVal);
    }
  }
  return map || {};
}

// Re-apply theme-related prefs after seeding. Imported lazily-safe from themes.
import { setTheme, loadCustomThemes } from './themes.js';
function applyThemePrefs() {
  try { loadCustomThemes(); } catch (e) { console.warn('[serverPrefs] loadCustomThemes failed', e); }
  const t = window.localStorage.getItem('cc-theme') || 'dark';
  try { setTheme(t); } catch (e) { console.warn('[serverPrefs] setTheme failed', e); }
}

// Full boot step: pull from server, seed localStorage, re-apply theme.
// Never throws — callers can await it directly.
export async function syncAndApplyPrefs(timeoutMs = 5000) {
  const withTimeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), timeoutMs));
  try {
    await Promise.race([syncPrefsFromServer(), withTimeout]);
    applyThemePrefs();
  } catch (e) {
    console.debug('[serverPrefs] sync skipped:', e.message);
  }
  // Install the write-interceptor regardless, so future writes sync if a
  // backend later becomes reachable.
  installLocalStorageInterceptor();
}
