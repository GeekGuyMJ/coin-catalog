/*
 * spotHistory.js — REAL tiered spot-price history engine (no fabricated data)
 *
 * Design (per user spec):
 *  - Seed from REAL Yahoo monthly (12) + yearly (10) averages.
 *    Public ships app/data/spot_history_seed.json ({metal:{monthly,yearly}}).
 *    Self-hosted fetches /api/spot_history.
 *  - On every app open (throttled to <=1x/hour) we append the REAL current
 *    price as a raw point.
 *  - Raw points roll up per-metal into daily/weekly/monthly/yearly averages.
 *  - History is stored PER METAL (each metal has its own buckets) so the
 *    trend card shows genuinely different lines for gold vs silver vs copper.
 *  - buildSeries(metalKey, period) returns only REAL buckets; missing buckets
 *    fall back to the next-coarser REAL bucket (never faked).
 */

const SPOT_HISTORY_KEY = 'cc-spot-history-v4';
const SPOT_LAST_FETCH_KEY = 'cc-spot-lastfetch';
const FETCH_THROTTLE_MS = 60 * 60 * 1000; // at most once an hour

const METAL_KEYS = ['gold_oz', 'silver_oz', 'copper_lb', 'platinum_oz', 'palladium_oz'];

function _dayKey(t) { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function _weekKey(t) { const d = new Date(t); const onejan = new Date(d.getFullYear(), 0, 1); const wk = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7); return d.getFullYear() + '-W' + String(wk).padStart(2, '0'); }
function _monthKey(t) { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function _yearKey(t) { return String(new Date(t).getFullYear()); }

function _avg(arr) { if (!arr.length) return 0; return arr.reduce((a, b) => a + b, 0) / arr.length; }

function _emptyMetal() {
  return { raw: [], daily: {}, weekly: {}, monthly: {}, yearly: {} };
}
function _emptyStore() {
  const metals = {};
  for (const k of METAL_KEYS) metals[k] = _emptyMetal();
  return { metals, seed: null, updated_at: 0 };
}

function loadStore() {
  try {
    const s = JSON.parse(localStorage.getItem(SPOT_HISTORY_KEY));
    if (s && s.metals && s.metals.gold_oz) return s;
  } catch (e) {}
  return _emptyStore();
}

function saveStore(s) {
  s.updated_at = Date.now();
  try { localStorage.setItem(SPOT_HISTORY_KEY, JSON.stringify(s)); } catch (e) {}
}

// Accepts BOTH seed shapes, PER METAL:
//   Shape A: { metalKey: { monthly:[{t,v}], yearly:[{t,v}] } }   (public static JSON / backend)
//   Shape B: { metalKey: [ {t,v}, ... ] }                        (flat array fallback)
function applySeed(s, seed) {
  if (!seed) return;
  s.seed = seed;
  for (const k of METAL_KEYS) {
    const sm = seed[k];
    if (!sm) continue;
    const m = s.metals[k] || (s.metals[k] = _emptyMetal());
    if (Array.isArray(sm.monthly) || Array.isArray(sm.yearly)) {
      // Shape A
      for (const p of (sm.monthly || [])) m.monthly[_monthKey(p.t)] = p.v;
      for (const p of (sm.yearly || [])) m.yearly[_yearKey(p.t)] = p.v;
    } else if (Array.isArray(sm)) {
      // Shape B — roll the flat array into per-metal monthly + yearly AVERAGES
      const mBuckets = {}, yBuckets = {};
      for (const p of sm) {
        (mBuckets[_monthKey(p.t)] ||= []).push(p.v);
        (yBuckets[_yearKey(p.t)] ||= []).push(p.v);
      }
      for (const mk in mBuckets) m.monthly[mk] = _avg(mBuckets[mk]);
      for (const yk in yBuckets) m.yearly[yk] = _avg(yBuckets[yk]);
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
  const now = Date.now();
  for (const k of METAL_KEYS) {
    const v = prices[k];
    if (v == null) continue;
    const m = s.metals[k] || (s.metals[k] = _emptyMetal());
    m.raw.push({ t: now, v: v });
    if (m.raw.length > 200) m.raw = m.raw.slice(-200);
    // Roll up raw into daily/weekly/monthly/yearly (per metal)
    const byDay = {}, byWeek = {}, byMonth = {}, byYear = {};
    for (const p of m.raw) {
      (byDay[_dayKey(p.t)] ||= []).push(p.v);
      (byWeek[_weekKey(p.t)] ||= []).push(p.v);
      (byMonth[_monthKey(p.t)] ||= []).push(p.v);
      (byYear[_yearKey(p.t)] ||= []).push(p.v);
    }
    for (const dk in byDay) m.daily[dk] = _avg(byDay[dk]);
    for (const wk in byWeek) m.weekly[wk] = _avg(byWeek[wk]);
    for (const mk in byMonth) m.monthly[mk] = _avg(byMonth[mk]);
    for (const yk in byYear) m.yearly[yk] = _avg(byYear[yk]);
    const trim = (obj, max) => { const ks = Object.keys(obj).sort(); if (ks.length > max) ks.slice(0, ks.length - max).forEach(k => delete obj[k]); };
    trim(m.daily, 400); trim(m.weekly, 120); trim(m.monthly, 120);
  }
  saveStore(s);
}

function _toSeries(bucketObj, keyFn) {
  return Object.keys(bucketObj).sort().map(k => ({ t: keyFn(k), v: bucketObj[k] }));
}
function _monthlySeries(m) { return _toSeries(m.monthly, k => new Date(k + '-01T00:00:00').getTime()); }
function _dailySeries(m) { return _toSeries(m.daily, k => new Date(k + 'T00:00:00').getTime()); }
function _yearlySeries(m) { return _toSeries(m.yearly, k => new Date(k + '-01-01T00:00:00').getTime()); }


function _best(a, b) { return a.length >= b.length ? a : b; }

/*
 * Build a REAL series for a metal + period. PER METAL buckets.
 * period: '1D' | '1W' | '1M' | '1Y' | '10Y'
 * Returns [{t, v}] — only genuine data; never fabricated.
 * Falls back to the next-coarser REAL bucket when a fine bucket is sparse.
 */
function buildSeries(s, metalKey, period) {
  const m = s.metals[metalKey] || _emptyMetal();
  if (period === '1D' || period === '1W' || period === '1M') {
    // Short ranges: the seed only carries monthly+yearly buckets, so show the
    // most recent REAL daily/monthly points. If those are sparse, fall back to
    // the trailing real monthly points (seed has 27+ monthly) so the sparkline
    // always renders a genuine trend (>=2 points, never fabricated).
    const days = period === '1D' ? 1 : period === '1W' ? 7 : 30;
    const fb = period === '1D' ? 7 : period === '1W' ? 10 : 12;
    const cutoff = Date.now() - days * 86400000;
    const daily = _dailySeries(m).filter(p => p.t >= cutoff);
    const monthly = _monthlySeries(m).filter(p => p.t >= cutoff);
    let pts = _best(daily, monthly);
    // Seed only carries monthly+yearly; recent fine buckets are sparse, so if we
    // have fewer than 6 real points fall back to the trailing monthly history
    // (>=6) so each metal's sparkline shows a genuine, distinct trend.
    if (pts.length < 6) {
      const all = _monthlySeries(m).concat(_yearlySeries(m)).sort((a, b) => a.t - b.t);
      pts = all.slice(-fb);
    }
    return pts;
  }
  if (period === '1Y') {
    const cutoff = Date.now() - 365 * 86400000;
    const monthly = _monthlySeries(m).filter(p => p.t >= cutoff);
    const yearly = _toSeries(m.yearly, k => new Date(k + '-01-01T00:00:00').getTime()).filter(p => p.t >= cutoff);
    return _best(monthly, yearly);
  }
  if (period === '10Y') {
    const yearly = _toSeries(m.yearly, k => new Date(k + '-01-01T00:00:00').getTime()).slice(-10);
    const monthly = _monthlySeries(m);
    return yearly.concat(monthly);
  }
  if (period === 'All') {
    // Full real history: every yearly point + every monthly point, oldest -> newest.
    const yearly = _toSeries(m.yearly, k => new Date(k + '-01-01T00:00:00').getTime());
    const monthly = _monthlySeries(m);
    return yearly.concat(monthly);
  }
  return [];
}

async function initSpotHistory({ getSeed, getPrices, getBaseline }) {
  const s = loadStore();
  if (getSeed) { try { applySeed(s, await getSeed()); } catch (e) {} }
  if (getBaseline) { try { applyBaseline(s, await getBaseline()); } catch (e) {} }
  // Self-heal: if seeding left any metal with <6 yearly points (stale/empty
  // store from an old cache), drop the stale metal buckets so a later reseed
  // (or the next load with a fresh store) produces real history.
  let healthy = true;
  for (const k of METAL_KEYS) {
    const m = s.metals && s.metals[k];
    if (!m || Object.keys(m.yearly || {}).length < 6) { healthy = false; break; }
  }
  if (!healthy && getSeed) {
    try {
      const fresh = await getSeed();
      if (fresh) { const clean = _emptyStore(); applySeed(clean, fresh); if (getBaseline) { try { applyBaseline(clean, await getBaseline()); } catch(e){} } s.metals = clean.metals; s.seed = clean.seed; }
    } catch (e) {}
  }
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
