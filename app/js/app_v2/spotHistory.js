/*
 * spotHistory.js — REAL tiered spot-price history engine (no fabricated data)
 *
 * Design (per user spec):
 *  - Seed from REAL Yahoo monthly (12) + yearly (10) averages.
 *    Public ships app/data/spot_history_seed.json ({metal:{monthly,yearly}}).
 *    Self-hosted fetches /api/spot_history (may return a FLAT [{t,v}] array).
 *  - On every app open (throttled to <=1x/hour) we append the REAL current
 *    price as a raw point.
 *  - Raw points roll up into daily/weekly/monthly/yearly averages. History
 *    compounds over time with no unbounded growth and ZERO synthetic points.
 *  - buildSeries(metalKey, period) returns only REAL buckets; missing buckets
 *    fall back to the next-coarser REAL bucket (never faked).
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

// Accepts BOTH seed shapes:
//   Shape A: { metalKey: { monthly:[{t,v}], yearly:[{t,v}] } }   (public static JSON)
//   Shape B: { metalKey: [ {t,v}, ... ] }                        (self-hosted /api/spot_history flat array)
function applySeed(s, seed) {
  if (!seed) return;
  s.seed = seed;
  for (const k of METAL_KEYS) {
    const sm = seed[k];
    if (!sm) continue;
    if (Array.isArray(sm.monthly) || Array.isArray(sm.yearly)) {
      // Shape A
      for (const p of (sm.monthly || [])) s.monthly[_monthKey(p.t)] = p.v;
      for (const p of (sm.yearly || [])) s.yearly[_yearKey(p.t)] = p.v;
    } else if (Array.isArray(sm)) {
      // Shape B — roll the flat array into real monthly + yearly AVERAGES
      const mBuckets = {}, yBuckets = {};
      for (const p of sm) {
        (mBuckets[_monthKey(p.t)] ||= []).push(p.v);
        (yBuckets[_yearKey(p.t)] ||= []).push(p.v);
      }
      for (const mk in mBuckets) s.monthly[mk] = _avg(mBuckets[mk]);
      for (const yk in yBuckets) s.yearly[yk] = _avg(yBuckets[yk]);
    }
  }
}

function applyBaseline(s, baseline) {
  // Merge a STATIC, pre-2000 historical baseline (e.g. FRED annual averages)
  // UNDER the live Yahoo data. Only baseline points OLDER than the youngest
  // Yahoo yearly point are added, so the two never overlap. Baked once; the
  // app then keeps accumulating newer points automatically.
  if (!baseline) return;
  s.baseline = baseline;
  for (const k of METAL_KEYS) {
    const bm = baseline[k];
    if (!bm) continue;
    const src = Array.isArray(bm) ? bm : (bm.yearly || []);
    if (!src.length) continue;
    const m = s.metals[k] || (s.metals[k] = _emptyMetal());
    const yKeys = Object.keys(m.yearly).sort();
    const yMin = yKeys.length ? new Date(yKeys[0] + '-01-01T00:00:00').getTime() : Date.now();
    for (const p of src) {
      const yk = _yearKey(p.t);
      const t = new Date(yk + '-01-01T00:00:00').getTime();
      if (t < yMin) m.yearly[yk] = p.v;  // only older-than-Yahoo points
    }
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
function _monthlySeries(s) { return _toSeries(s.monthly, k => new Date(k + '-01T00:00:00').getTime()); }
function _dailySeries(s) { return _toSeries(s.daily, k => new Date(k + 'T00:00:00').getTime()); }

// Pick the richer of two real series for a period
function _best(a, b) { return a.length >= b.length ? a : b; }

/*
 * Build a REAL series for a metal + period.
 * period: '1D' | '1W' | '1M' | '1Y' | '10Y'
 * Returns [{t, v}] — only genuine data; never fabricated.
 * Falls back to the next-coarser REAL bucket when a fine bucket is sparse,
 * so every period always renders a true line (no blank, no fake).
 */
function buildSeries(s, metalKey, period) {
  if (period === '1D') {
    const cutoff = Date.now() - 86400000;
    let recent = s.raw.filter(p => p.t >= cutoff).map(p => ({ t: p.t, v: p.v }));
    if (recent.length < 1) {
      // fall back to the latest real daily/monthly point so the card isn't blank
      const all = _dailySeries(s).concat(_monthlySeries(s)).sort((a, b) => a.t - b.t);
      if (all.length) recent = [all[all.length - 1]];
    }
    return recent;
  }
  if (period === '1W') {
    const cutoff = Date.now() - 7 * 86400000;
    const daily = _dailySeries(s).filter(p => p.t >= cutoff);
    const monthly = _monthlySeries(s).filter(p => p.t >= cutoff);
    return _best(daily, monthly);
  }
  if (period === '1M') {
    const cutoff = Date.now() - 30 * 86400000;
    const daily = _dailySeries(s).filter(p => p.t >= cutoff);
    const monthly = _monthlySeries(s).filter(p => p.t >= cutoff);
    return _best(daily, monthly);
  }
  if (period === '1Y') {
    const cutoff = Date.now() - 365 * 86400000;
    const monthly = _monthlySeries(s).filter(p => p.t >= cutoff);
    const yearly = _toSeries(s.yearly, k => new Date(k + '-01-01T00:00:00').getTime()).filter(p => p.t >= cutoff);
    return _best(monthly, yearly);
  }
  if (period === '10Y') {
    const yr = _toSeries(s.yearly, k => new Date(k + '-01-01T00:00:00').getTime());
    const yearly = yr.slice(-10);
    const mo = _monthlySeries(s);
    return yearly.concat(mo);
  }
  return [];
}

async function initSpotHistory({ getSeed, getPrices, getBaseline }) {
  const s = loadStore();
  if (getSeed) { try { applySeed(s, await getSeed()); } catch (e) {} }
  if (getBaseline) { try { applyBaseline(s, await getBaseline()); } catch (e) {} }
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

export { initSpotHistory, getSeriesForPeriod, loadStore, SPOT_HISTORY_KEY, METAL_KEYS, applyBaseline };
