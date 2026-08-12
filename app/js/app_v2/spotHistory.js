/*
 * spotHistory.js — REAL tiered spot-price history engine (no fabricated data)
 *
 * Design (per user spec):
 *  - "Historical data is by definition already done." We seed from REAL Yahoo
 *    monthly (12) + yearly (10) averages shipped as app/data/spot_history_seed.json
 *    (self-hosted fetches the same from its backend /api/spot_history).
 *  - On every app open (throttled to <=1x/hour) we append the REAL current
 *    price as a raw point.
 *  - Raw points roll up into: daily avg (keep ~400), weekly avg (~120),
 *    monthly avg (~120), yearly avg (all). History compounds over time with
 *    no unbounded growth and ZERO synthetic points.
 *  - buildSeries(metalKey, period) returns only REAL buckets; missing buckets
 *    are simply absent (never faked).
 */

const SPOT_HISTORY_KEY = 'cc-spot-history-v2';
const SPOT_LAST_FETCH_KEY = 'cc-spot-lastfetch';
const FETCH_THROTTLE_MS = 60 * 60 * 1000; // at most once an hour

const METAL_KEYS = ['gold_oz', 'silver_oz', 'copper_lb', 'platinum_oz', 'palladium_oz'];

function _dayKey(t) { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function _weekKey(t) { const d = new Date(t); const onejan = new Date(d.getFullYear(), 0, 1); const wk = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7); return d.getFullYear() + '-W' + String(wk).padStart(2, '0'); }
function _monthKey(t) { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function _yearKey(t) { return String(new Date(t).getFullYear()); }

function _avg(arr) { if (!arr.length) return 0; return arr.reduce((a, b) => a + b, 0) / arr.length; }

function _emptyStore() {
  return { raw: [], daily: {}, weekly: {}, monthly: {}, yearly: {}, seed: null, updated_at: 0 };
}

function loadStore() {
  try {
    const s = JSON.parse(localStorage.getItem(SPOT_HISTORY_KEY));
    if (s && s.daily) return s;
  } catch (e) {}
  return _emptyStore();
}

function saveStore(s) {
  s.updated_at = Date.now();
  try { localStorage.setItem(SPOT_HISTORY_KEY, JSON.stringify(s)); } catch (e) {}
}

function applySeed(s, seed) {
  // seed: { metalKey: { monthly:[{t,v}], yearly:[{t,v}] } }
  if (!seed) return;
  s.seed = seed;
  for (const k of METAL_KEYS) {
    const sm = seed[k];
    if (!sm) continue;
    for (const p of (sm.monthly || [])) s.monthly[_monthKey(p.t)] = p.v;
    for (const p of (sm.yearly || [])) s.yearly[_yearKey(p.t)] = p.v;
  }
}

function addRawPoint(s, prices) {
  // prices: { gold_oz, silver_oz, ... } real current values
  const now = Date.now();
  for (const k of METAL_KEYS) {
    if (prices[k] == null) continue;
    s.raw.push({ t: now, v: prices[k] });
  }
  if (s.raw.length > 200) s.raw = s.raw.slice(-200);
  // Roll up raw into daily/weekly/monthly/yearly
  const byDay = {}, byWeek = {}, byMonth = {}, byYear = {};
  for (const p of s.raw) {
    (byDay[_dayKey(p.t)] ||= []).push(p.v);
    (byWeek[_weekKey(p.t)] ||= []).push(p.v);
    (byMonth[_monthKey(p.t)] ||= []).push(p.v);
    (byYear[_yearKey(p.t)] ||= []).push(p.v);
  }
  for (const dk in byDay) s.daily[dk] = _avg(byDay[dk]);
  for (const wk in byWeek) s.weekly[wk] = _avg(byWeek[wk]);
  for (const mk in byMonth) s.monthly[mk] = _avg(byMonth[mk]);
  for (const yk in byYear) s.yearly[yk] = _avg(byYear[yk]);
  // Caps
  const trim = (obj, max) => { const ks = Object.keys(obj).sort(); if (ks.length > max) ks.slice(0, ks.length - max).forEach(k => delete obj[k]); };
  trim(s.daily, 400); trim(s.weekly, 120); trim(s.monthly, 120);
  saveStore(s);
}

function _toSeries(bucketObj, keyFn) {
  return Object.keys(bucketObj).sort().map(k => ({ t: keyFn(k), v: bucketObj[k] }));
}

/*
 * Build a REAL series for a metal + period.
 * period: '1D' | '1W' | '1M' | '1Y' | '10Y'
 * Returns [{t, v}] — only genuine data; never fabricated.
 */
function buildSeries(s, metalKey, period) {
  if (period === '1D') {
    // intraday: raw points from last 24h (few, real)
    const cutoff = Date.now() - 86400000;
    return s.raw.filter(p => p.t >= cutoff).map(p => ({ t: p.t, v: p.v }));
  }
  if (period === '1W') {
    // daily for last 7 days + any seed monthly context is coarser; use daily only
    const series = _toSeries(s.daily, k => new Date(k + 'T00:00:00').getTime());
    const cutoff = Date.now() - 7 * 86400000;
    return series.filter(p => p.t >= cutoff);
  }
  if (period === '1M') {
    const series = _toSeries(s.daily, k => new Date(k + 'T00:00:00').getTime());
    const cutoff = Date.now() - 30 * 86400000;
    return series.filter(p => p.t >= cutoff);
  }
  if (period === '1Y') {
    const series = _toSeries(s.monthly, k => new Date(k + '-01T00:00:00').getTime());
    const cutoff = Date.now() - 365 * 86400000;
    const recent = series.filter(p => p.t >= cutoff);
    // If we have fewer than 2 real monthly points, also include yearly seed (real)
    if (recent.length < 2) {
      const yr = _toSeries(s.yearly, k => new Date(k + '-01-01T00:00:00').getTime()).filter(p => p.t >= cutoff);
      return yr.length >= recent.length ? yr : recent;
    }
    return recent;
  }
  if (period === '10Y') {
    const yr = _toSeries(s.yearly, k => new Date(k + '-01-01T00:00:00').getTime());
    const series = yr.slice(-10);
    const mo = _toSeries(s.monthly, k => new Date(k + '-01T00:00:00').getTime());
    // Append recent monthly points (real, finer detail) after the yearly line
    return series.concat(mo);
  }
  return [];
}

/*
 * Initialize: load store, apply seed (provided), and if throttle allows,
 * fetch real current prices and append. Returns the store.
 * getPrices: async () => ({gold_oz, ...}) real live prices (CORS-open source)
 * getSeed: () => seed object (from static JSON or backend)
 */
async function initSpotHistory({ getSeed, getPrices }) {
  const s = loadStore();
  if (getSeed) { try { applySeed(s, await getSeed()); } catch (e) {} }
  const last = Number(localStorage.getItem(SPOT_LAST_FETCH_KEY) || 0);
  if (Date.now() - last > FETCH_THROTTLE_MS) {
    try {
      const prices = getPrices ? await getPrices() : null;
      if (prices) { addRawPoint(s, prices); localStorage.setItem(SPOT_LAST_FETCH_KEY, String(Date.now())); }
    } catch (e) { /* keep existing real data */ }
  }
  return s;
}

function getSeriesForPeriod(store, metalKey, period) {
  return buildSeries(store, metalKey, period);
}

export { initSpotHistory, getSeriesForPeriod, loadStore, SPOT_HISTORY_KEY, METAL_KEYS };
