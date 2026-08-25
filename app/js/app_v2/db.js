/**
 * db.js — Coin Catalog v2 — Client-side database using Dexie.js
 * Mirrors the SQLite/PostgreSQL schema and handles offline storage.
 * @module db
 */

import Dexie from './dexie.js';

// DEPLOYMENT-AGNOSTIC HELPER (2026-08-24): returns true when running on the
// server-first self-hosted build. Used to choose the correct data source for
// features that only exist on the backend (spot-price proxy, settings sync).
function getIsSelfHosted() {
    const host = (location.hostname || '');
    return host.includes('opaleye-bluegill') || host.includes('ts.net') || host.startsWith('192.168.');
}

// ============================================================
// Database Initialization
// ============================================================

export const db = new Dexie('CoinCatalogDB');

db.version(1).stores({
    coins_reference: 'id, section, denomination, coin_type, year, mint_mark, metal, is_key_date, is_proof, is_error',
    user_inventory: '++id, coin_ref_id, quantity, grade',
    coin_type_config: 'coin_type',
    bulk_inventory: '++id, label, metal_type',
    raw_bullion: '++id, metal_type, label',
    scrap_metal: '++id, name, metal_type',
    paper_currency: '++id, series_year, serial_number',
    other_collectable: '++id, category_name, name',
    custom_category: 'name',
    wishlist_item: '++id, coin_id, category',
    portfolio_history: '++id, date',
    user_settings: 'key'
});

db.version(2).stores({
    coins_reference: 'id, section, denomination, coin_type, year, mint_mark, metal, is_key_date, is_proof, is_error',
    user_inventory: '++id, coin_ref_id, quantity, grade',
    coin_type_config: 'coin_type',
    bulk_inventory: '++id, label, metal_type',
    raw_bullion: '++id, metal_type, label',
    scrap_metal: '++id, name, metal_type',
    paper_currency: '++id, series_year, serial_number',
    other_collectable: '++id, category_name, name',
    custom_category: 'name',
    wishlist_item: '++id, coin_id, category',
    portfolio_history: '++id, date',
    user_settings: 'key',
    pending_defaults: 'coin_type'
});

// v3: Photos & Documents gallery store (free-form user pictures).
db.version(3).stores({
    coins_reference: 'id, section, denomination, coin_type, year, mint_mark, metal, is_key_date, is_proof, is_error',
    user_inventory: '++id, coin_ref_id, quantity, grade',
    coin_type_config: 'coin_type',
    bulk_inventory: '++id, label, metal_type',
    raw_bullion: '++id, metal_type, label',
    scrap_metal: '++id, name, metal_type',
    paper_currency: '++id, series_year, serial_number',
    other_collectable: '++id, category_name, name',
    custom_category: 'name',
    wishlist_item: '++id, coin_id, category',
    portfolio_history: '++id, date',
    user_settings: 'key',
    pending_defaults: 'coin_type',
    user_photos: '++id, category, title, created_at'
});

// ============================================================
// Constants & Fallbacks
// ============================================================

const FACE_VALUE_MAP = {
    "half cent":    0.005,
    "1 cent":       0.01,
    "2 cents":      0.02,
    "3 cents":      0.03,
    "half dime":    0.05,
    "5 cents":      0.05,
    "10 cents":     0.10,
    "20 cents":     0.20,
    "25 cents":     0.25,
    "50 cents":     0.50,
    "$1":           1.00,
    "trade dollar": 1.00,
    "$2.50":        2.50,
    "$3 gold":      3.00,
    "$5":           5.00,
    "$5 gold":      5.00,
    "$10":         10.00,
    "$10 gold":    10.00,
    "$20":         20.00,
};

const DEFAULT_COIN_PRICES = {
    "Flying Eagle":          [35, 180],
    "Indian Head":           [2.50, 75],
    "Lincoln Wheat":         [0.05, 50],
    "Lincoln Memorial":      [0.01, 5],
    "Lincoln Bicentennial":  [0.01, 2],
    "Lincoln Shield":        [0.01, 1],
    "Small Cent":            [0.05, 10],
    "Buffalo":               [1.25, 120],
    "Jefferson":             [0.05, 10],
    "Jefferson (War Nickel)":[1.80, 20],
    "Liberty Head (V Nickel)":[2, 60],
    "Shield Nickel":         [30, 150],
    "Draped Bust Dime":      [400, 1500],
    "Capped Bust Dime":      [65, 300],
    "Seated Liberty Dime":   [25, 150],
    "Barber Dime":           [5, 45],
    "Mercury":               [3.50, 40],
    "Roosevelt":             [2.50, 15],
    "Roosevelt (Clad)":      [0.10, 2],
    "Washington":            [6.50, 45],
    "Washington (Clad)":     [0.25, 5],
    "50 State Quarters":     [0.25, 4],
    "DC & Territories Quarters": [0.25, 4],
    "America the Beautiful": [0.25, 4],
    "American Women":        [0.25, 3],
    "Standing Liberty":      [15, 80],
    "Barber Quarter":        [10, 70],
    "Seated Liberty Quarter":[35, 200],
    "Kennedy":               [14.50, 50],
    "Kennedy (40% Silver)":  [6, 25],
    "Kennedy (Clad)":        [0.50, 5],
    "Franklin":              [14.50, 45],
    "Walking Liberty":       [15, 60],
    "Barber Half":           [25, 120],
    "Seated Liberty Half":   [60, 350],
    "Morgan":                [35, 160],
    "Peace":                 [32, 100],
    "Eisenhower":            [1.10, 25],
    "Eisenhower (Silver)":   [12, 40],
    "Susan B. Anthony":      [1, 5],
    "Sacagawea":             [1, 5],
    "Presidential Dollar":   [1, 5],
    "Native American Dollar":[1, 5],
    "Innovation Dollar":     [1, 5],
    "Large Cent":            [30, 250],
    "Two Cent Piece":        [25, 120],
    "Three Cent Nickel":     [20, 90],
    "Half Cent":             [60, 300],
    "Gold Eagle":            [2500, 2700],
    "Gold Buffalo":          [2500, 2750],
    "Gold Maple":            [2500, 2650],
    "Silver Eagle":          [36, 120],
    "Maple Leaf":            [34, 90],
    "Canadian Cent":         [0.02, 10],
    "Canadian 5 Cents":      [0.10, 15],
    "Canadian 10 Cents":     [0.15, 20],
    "Canadian 25 Cents":     [0.35, 30],
    "Canadian 50 Cents":     [1.00, 50],
    "Canadian Dollar":       [1.50, 80],
};

const SECTION_ORDER = [
    "US Coinage — Half Cent",
    "US Coinage — Large & Small Cent",
    "US Coinage — Two Cent",
    "US Coinage — Three Cent",
    "US Coinage — Half Dime",
    "US Coinage — Five Cent Nickel",
    "US Coinage — Dime",
    "US Coinage — Twenty Cent",
    "US Coinage — Quarter Dollar",
    "US Coinage — Half Dollar",
    "US Coinage — Dollar",
    "US Coinage — 2026 Semiquincentennial",
    "US Gold — Circulation",
    "US Bullion — Silver",
    "US Bullion — Gold",
    "US Bullion — Platinum & Palladium",
    "US Commemoratives",
    "Canadian Coinage — Cent",
    "Canadian Coinage — Five Cent",
    "Canadian Coinage — Ten Cent",
    "Canadian Coinage — Twenty-Five Cent",
    "Canadian Coinage — Fifty Cent",
    "Canadian Coinage — Dollar",
    "Canadian Coinage — Two Dollar",
];

const SECTION_RANK = {};
SECTION_ORDER.forEach((s, i) => { SECTION_RANK[s] = i; });

function sectionSortKey(section) {
    return SECTION_RANK[section] !== undefined ? SECTION_RANK[section] : 999;
}

const FALLBACK_SPOT_PRICES = {
    gold_oz:      4121.05,
    silver_oz:       59.87,
    copper_lb:        6.25,
    platinum_oz:   1634.00,
    palladium_oz:  1293.00,
};

// ============================================================
// Master Catalog Seeding
// ============================================================

export async function initDb() {
    // Check if database needs seeding
    const refCount = await db.coins_reference.count();
    if (refCount === 0) {
        console.log('IndexedDB empty. Fetching master coins catalogue from JSON...');
        const response = await fetch('data/coins.json');
        if (!response.ok) {
            throw new Error(`Failed to load coins.json: HTTP ${response.status}`);
        }
        const coins = await response.json();
        console.log(`Seeding ${coins.length} coins into IndexedDB...`);
        
        // Seed in chunks to prevent transaction overload
        const chunkSize = 500;
        for (let i = 0; i < coins.length; i += chunkSize) {
            const chunk = coins.slice(i, i + chunkSize);
            await db.coins_reference.bulkAdd(chunk);
        }
        console.log('Seeding completed successfully!');
    }

    const configCount = await db.coin_type_config.count();
    let needsSeed = configCount === 0;
    if (needsSeed) {
        console.log('Fetching type configs from JSON...');
        const response = await fetch('data/type_configs.json');
        if (response.ok) {
            const configs = await response.json();
            console.log(`Seeding ${configs.length} type configs into IndexedDB...`);
            // Use bulkPut to overwrite existing entries (preserves user-added base64 overrides)
            const chunkSize = 200;
            for (let i = 0; i < configs.length; i += chunkSize) {
                const chunk = configs.slice(i, i + chunkSize);
                // Only overwrite entries that don't already have a user-assigned image
                for (const cfg of chunk) {
                        const existing = await db.coin_type_config.get(cfg.coin_type);
                        if (!existing) {
                            await db.coin_type_config.add(cfg);
                        } else {
                            // Never overwrite user-assigned images (base64 or file URLs), but seed master paths if empty
                            const updates = {
                                base_price: cfg.base_price || existing.base_price || 0,
                                key_price: cfg.key_price || existing.key_price || 0,
                            };
                            // Seed master image paths only if field is empty
                            // AND only if the field was not explicitly deleted by the user
                            if (cfg.obv_image !== undefined && !existing.obv_image && !existing._deleted_obv_image) {
                                updates.obv_image = cfg.obv_image;
                            }
                            if (cfg.rev_image !== undefined && !existing.rev_image && !existing._deleted_rev_image) {
                                updates.rev_image = cfg.rev_image;
                            }
                            if (cfg.proof_obv_image !== undefined && !existing.proof_obv_image && !existing._deleted_proof_obv_image) {
                                updates.proof_obv_image = cfg.proof_obv_image;
                            }
                            if (cfg.proof_rev_image !== undefined && !existing.proof_rev_image && !existing._deleted_proof_rev_image) {
                                updates.proof_rev_image = cfg.proof_rev_image;
                            }
                            await db.coin_type_config.update(cfg.coin_type, updates);
                        }
                    }
            }
            console.log('Type configs seeding completed successfully!');
        } else {
            console.error('Failed to load type_configs.json:', response.status);
        }
    }

    // Run data migrations (update existing IndexedDB data when coins.json has changed)
    await runMigrations();
}

// ============================================================
// Data Migrations — patches existing IndexedDB data when the
// coin reference data has been updated in coins.json.
// Runs once per version bump.
// ============================================================

const DB_DATA_VERSION = 6;  // Increment when coins.json has structural updates

export async function runMigrations() {
    const versionKey = '_hermes_db_data_version';
    const storedVersion = parseInt(localStorage.getItem(versionKey) || '0', 10);
    if (storedVersion >= DB_DATA_VERSION) return;

    console.log(`Running data migration v${storedVersion} → v${DB_DATA_VERSION}...`);

    // Migration 1 → 2: Update 2026 Lincoln Shield cents to dual-date "1776 - 2026"
    // and add 2025 Omega Penny entries.
    if (storedVersion < 2) {
        // Update 2026 Lincoln Shield entries
        const coins2026 = await db.coins_reference
            .where('coin_type').equals('Lincoln Shield')
            .and(c => c.section === 'US Coinage — Large & Small Cent' && c.year === 2026)
            .toArray();
        for (const coin of coins2026) {
            await db.coins_reference.update(coin.id, { year: '1776 - 2026 Semiquincentennial' });
            console.log(`  Updated coin id=${coin.id} year 2026 → "1776 - 2026 Semiquincentennial"`);
        }
    }

    // Migration 2 → 3: Rename 2025 Omega Penny entries
    if (storedVersion < 3) {
        const omegaEntries = await db.coins_reference
            .where('coin_type').equals('Lincoln Shield')
            .and(c => c.section === 'US Coinage — Large & Small Cent' && 
                      c.year === '2025 (Omega Privy Mark)' &&
                      c.ref_notes && c.ref_notes.includes('Omega'))
            .toArray();
        // If they exist with old year format, update them
        for (const coin of omegaEntries) {
            console.log(`  Skipping id=${coin.id} — already has correct year "${coin.year}"`);
        }
        // Also check for entries with year=2025 (numeric) that should be renamed
        const oldEntries = await db.coins_reference
            .where('coin_type').equals('Lincoln Shield')
            .and(c => c.section === 'US Coinage — Large & Small Cent' && 
                      c.year === 2025 &&
                      c.ref_notes && c.ref_notes.includes('Omega'))
            .toArray();
        for (const coin of oldEntries) {
            const newYear = coin.mint_mark === '' ? '2025 (24K Gold Omega Privy Mark)' : '2025 (Omega Privy Mark)';
            await db.coins_reference.update(coin.id, { year: newYear });
            console.log(`  Renamed id=${coin.id} year 2025 → "${newYear}"`);
        }
        // Also check gold one by metal field
        const goldEntries = await db.coins_reference
            .where('coin_type').equals('Lincoln Shield')
            .and(c => c.section === 'US Coinage — Large & Small Cent' && 
                      c.year === 2025 &&
                      c.metal && c.metal.includes('Gold'))
            .toArray();
        for (const coin of goldEntries) {
            await db.coins_reference.update(coin.id, { year: '2025 (24K Gold Omega Privy Mark)' });
            console.log(`  Renamed gold id=${coin.id} → "2025 (24K Gold Omega Privy Mark)"`);
        }
        console.log('Omega Penny rename migration complete.');
    }

    // Migration 3 → 4: Clean up duplicate Omega Privy Mark entries and append Semiquincentennial to 2026
    if (storedVersion < 4) {
        // Delete dummy Omega Privy Mark entries
        const toDelete = await db.coins_reference
            .filter(c => typeof c.year === 'string' && (c.year === '2025 (Omega Privy Mark)' || c.year === '2025 (24K Gold Omega Privy Mark)'))
            .primaryKeys();
        if (toDelete.length > 0) {
            await db.coins_reference.bulkDelete(toDelete);
            console.log(`  Deleted ${toDelete.length} dummy Omega Privy Mark entries.`);
        }
        
        // Update 1776 - 2026 to 1776 - 2026 Semiquincentennial
        const coins2026_str = await db.coins_reference
            .filter(c => typeof c.year === 'string' && c.year === '1776 - 2026')
            .toArray();
        for (const coin of coins2026_str) {
            await db.coins_reference.update(coin.id, { year: '1776 - 2026 Semiquincentennial' });
            console.log(`  Updated coin id=${coin.id} year → "1776 - 2026 Semiquincentennial"`);
        }
    }



    // Migration 4 → 5 (Issue 1/2/6): section-scope colliding type configs.
    // Coin types shared by >1 section now live under '<section> — <coin_type>'
    // so images never bleed between series (e.g. Half Cent vs Large & Small Cent
    // "Braided Hair"). Existing plain rows are copied into every qualifying
    // section row; the plain row is cleared to stop fallback bleed.
    if (storedVersion < 5) {
        const collidingTypes = new Set(["Barber", "Braided Hair", "Capped Bust", "Classic Head", "Draped Bust", "Draped Bust - Heraldic Eagle", "Draped Bust - Small Eagle", "Flowing Hair", "Seated Liberty", "Trade Dollar"]);
        const refs = await db.coins_reference.toArray();
        const typeSections = {};
        refs.forEach(r => {
            if (!r.coin_type || !r.section) return;
            if (!typeSections[r.coin_type]) typeSections[r.coin_type] = new Set();
            typeSections[r.coin_type].add(r.section);
        });

        const allConfigs = await db.coin_type_config.toArray();
        let created = 0, cleared = 0;

        for (const cfg of allConfigs) {
            const t = cfg.coin_type || '';
            // --- Colliding plain rows: split into per-section qualified rows ---
            if (collidingTypes.has(t) && !t.includes(' — ')) {
                const secs = [...(typeSections[t] || [])];
                for (const sec of secs) {
                    const key = sec + ' — ' + t;
                    const exists = await db.coin_type_config.get(key);
                    if (!exists) {
                        await db.coin_type_config.add({
                            ...cfg,
                            coin_type: key,
                            section: sec,
                            _section_scoped: true,
                        });
                        created++;
                    }
                }
                // Clear the legacy shared row so no fallback bleeds the wrong section's image
                await db.coin_type_config.update(t, {
                    obv_image: null, rev_image: null,
                    proof_obv_image: null, proof_rev_image: null,
                });
                cleared++;
            }
            // --- Section-slot rows (section-name keys): drop stale master images ---
            else if (typeSections[t] && typeSections[t].size > 0 && allConfigs.some(c => c.coin_type === t)) {
                // This is a section-name key that is NOT a real coin type: it is the
                // section example slot. Remove any inherited master/liberty-cap images.
                const isSectionSlot = refs.some(r => r.section === t) &&
                                      !refs.some(r => r.coin_type === t);
                if (isSectionSlot) {
                    await db.coin_type_config.update(t, {
                        obv_image: null, rev_image: null,
                        proof_obv_image: null, proof_rev_image: null,
                    });
                    cleared++;
                }
            }
        }
        console.log(`  Migration 4→5: created ${created} section-qualified rows, cleared ${cleared} legacy rows.`);
    }

    // Migration 5 → 6: Clean up any stale per-coin black circles (1793, 1840, 1847) from local IndexedDB
    // so client browsers immediately purge corrupted local rows without needing a manual DB wipe.
    if (storedVersion < 6) {
        for (const coinId of [1, 27, 34]) {
            const coin = await db.coins_reference.get(coinId);
            if (coin && (coin.obv_image || coin.rev_image)) {
                await db.coins_reference.update(coinId, { obv_image: null, rev_image: null });
                console.log(`  Migration 5→6: Cleared stale image on coin id=${coinId}`);
            }
        }
    }

    localStorage.setItem(versionKey, String(DB_DATA_VERSION));
    console.log(`Data migration to v${DB_DATA_VERSION} complete.`);
}
// ============================================================

export function fetchStatusLocal() {
    return { status: "ok", version: "2.0.0" };
}

export async function fetchSectionsLocal() {
    const references = await db.coins_reference.toArray();
    const inventory = await db.user_inventory.toArray();
    const typeConfigs = await db.coin_type_config.toArray();

    // Map of type configuration for image picking
    const imageTypes = new Set(
        typeConfigs
            .filter(cfg => cfg.obv_image || cfg.rev_image)
            .map(cfg => cfg.coin_type)
    );

    // Grouping by section
    const sectionTotals = {};
    const sectionOwned = {};
    const sectionSample = {};
    const sectionTypes = {};

    references.forEach(coin => {
        const sec = coin.section || "Unknown";
        sectionTotals[sec] = (sectionTotals[sec] || 0) + 1;
        
        // Pick sample types
        if (!sectionSample[sec]) {
            sectionSample[sec] = coin.coin_type;
        }
        if (imageTypes.has(coin.coin_type)) {
            // prefer one with images (still alpha/order from seed)
            sectionSample[sec] = coin.coin_type;
        }

        // Subtypes list
        const mainType = coin.coin_type.includes('—') 
            ? coin.coin_type.split('—')[0].trim() 
            : (coin.coin_type.includes('-') ? coin.coin_type.split('-')[0].trim() : coin.coin_type);
        if (!sectionTypes[sec]) sectionTypes[sec] = [];
        if (!sectionTypes[sec].includes(mainType)) {
            sectionTypes[sec].push(mainType);
        }
    });

    // Populate owned counts
    const ownedRefs = new Set(inventory.filter(inv => inv.quantity > 0).map(inv => inv.coin_ref_id));
    references.forEach(coin => {
        if (ownedRefs.has(coin.id)) {
            const sec = coin.section || "Unknown";
            sectionOwned[sec] = (sectionOwned[sec] || 0) + 1;
        }
    });

    const result = Object.keys(sectionTotals).map(sec => ({
        section: sec,
        total: sectionTotals[sec],
        owned: sectionOwned[sec] || 0,
        sample_type: sectionSample[sec] || "",
        types: sectionTypes[sec] || []
    }));

    result.sort((a, b) => sectionSortKey(a.section) - sectionSortKey(b.section));
    return result;
}

export async function fetchCoinsForSectionLocal(sectionName) {
    const coins = await db.coins_reference.where('section').equals(sectionName).toArray();
    
    // Sort coins by coin_type, year, mint_mark
    coins.sort((a, b) => {
        if (a.coin_type !== b.coin_type) return (a.coin_type || '').localeCompare(b.coin_type || '');
        const yA = typeof a.year === 'number' ? a.year : (parseInt(String(a.year).match(/\d{4}/)?.[0] || '0', 10) || 9999);
        const yB = typeof b.year === 'number' ? b.year : (parseInt(String(b.year).match(/\d{4}/)?.[0] || '0', 10) || 9999);
        if (yA !== yB) return yA - yB;
        return (a.mint_mark || '').localeCompare(b.mint_mark || '');
    });

    // Server-authoritative per-coin image sync (self-hosted only). Makes uploaded
    // images appear on EVERY device (laptop, phone) instead of only the browser that
    // performed the upload. Public (GitHub Pages) has no backend, so it is skipped and
    // falls back to the seeded IndexedDB data. Guarded + non-fatal on failure.
    try {
        const _host = (window.location && window.location.hostname) || '';
        const _selfHosted = _host.includes('opaleye-bluegill') || _host.includes('ts.net') || _host.includes('192.168.') || _host === 'localhost';
        if (_selfHosted) {
            const _native = window.__nativeFetch || window.fetch;
            if (typeof _native === 'function') {
                const _res = await _native('/api/coins?section=' + encodeURIComponent(sectionName));
                if (_res && _res.ok) {
                    const _server = await _res.json();
                    const _byId = {};
                    (_server || []).forEach(c => { if (c && c.id != null) _byId[c.id] = c; });
                    const toUpdate = [];
                    for (const _c of coins) {
                        const _s = _byId[_c.id];
                        if (_s) {
                            const serverObv = _s.obv_image || null;
                            const serverRev = _s.rev_image || null;
                            const localObv = _c.obv_image || null;
                            const localRev = _c.rev_image || null;

                            const serverDeletedObv = _s._deleted_obv_image || false;
                            const serverDeletedRev = _s._deleted_rev_image || false;
                            const localDeletedObv = _c._deleted_obv_image || false;
                            const localDeletedRev = _c._deleted_rev_image || false;

                            // Only sync from server if server has data OR explicitly deleted
                            // Don't overwrite local per-coin images with server null (which would erase user uploads)
                            const shouldUpdateObv = (serverObv !== null && serverObv !== localObv) || (serverDeletedObv && !localDeletedObv);
                            const shouldUpdateRev = (serverRev !== null && serverRev !== localRev) || (serverDeletedRev && !localDeletedRev);
                            if (shouldUpdateObv || shouldUpdateRev || localDeletedObv !== serverDeletedObv || localDeletedRev !== serverDeletedRev) {
                                const _upd = { 
                                    obv_image: shouldUpdateObv ? serverObv : localObv, 
                                    rev_image: shouldUpdateRev ? serverRev : localRev, 
                                    _deleted_obv_image: serverDeletedObv, 
                                    _deleted_rev_image: serverDeletedRev 
                                };
                                toUpdate.push({ id: _c.id, changes: _upd });
                                Object.assign(_c, _upd);
                            }
                        }
                    }
                    if (toUpdate.length > 0) {
                        await db.transaction('rw', db.coins_reference, async () => {
                            for (const item of toUpdate) {
                                await db.coins_reference.update(item.id, item.changes);
                            }
                        });
                    }
                    // USER-COIN PULL (2026-08-25): also insert server rows this device
                    // has never seen (e.g. a user coin added on another device).
                    const _known = new Set(coins.map(c => c.id));
                    const _incoming = (_server || []).filter(_s => _s && _s.id != null && !_known.has(_s.id));
                    if (_incoming.length > 0) {
                        await db.transaction('rw', db.coins_reference, async () => {
                            for (const _n of _incoming) {
                                await db.coins_reference.put({ ..._n, id: _n.id });
                            }
                        });
                        console.log('[db] pulled ' + _incoming.length + ' new coin(s) from server');
                        const _fresh = await db.coins_reference.where('section').equals(sectionName).toArray();
                        coins.length = 0;
                        coins.push(..._fresh);
                        // re-sort to keep type→year→mint order
                        coins.sort((a, b) => {
                            if (a.coin_type !== b.coin_type) return (a.coin_type || '').localeCompare(b.coin_type || '');
                            const yA = typeof a.year === 'number' ? a.year : (parseInt(String(a.year).match(/\d{4}/)?.[0] || '0', 10) || 9999);
                            const yB = typeof b.year === 'number' ? b.year : (parseInt(String(b.year).match(/\d{4}/)?.[0] || '0', 10) || 9999);
                            if (yA !== yB) return yA - yB;
                            return (a.mint_mark || '').localeCompare(b.mint_mark || '');
                        });
                    }
                    // CLEANUP (2026-08-25): drop LOCAL user_added rows the server no
                    // longer has (coins deleted on another device, or just deleted).
                    // Query IndexedDB directly (not the `coins` array, which was just
                    // overwritten by _fresh) so we catch stale local rows reliably.
                    const _serverIds = new Set((_server || []).map(_s => _s && _s.id));
                    const _localUser = await db.coins_reference
                        .where('section').equals(sectionName)
                        .filter(_r => _r.user_added && !_serverIds.has(_r.id))
                        .toArray();
                    if (_localUser.length > 0) {
                        await db.transaction('rw', db.coins_reference, async () => {
                            for (const _o of _localUser) {
                                await db.coins_reference.delete(_o.id);
                            }
                        });
                        // also drop any inventory tied to removed coins
                        const _removedIds = _localUser.map(_o => _o.id);
                        await db.user_inventory.where('coin_ref_id').anyOf(_removedIds).delete();
                        console.log('[db] removed ' + _localUser.length + ' deleted user coin(s)');
                        // refresh coins from IndexedDB so the returned list is truthful
                        const _fresh2 = await db.coins_reference.where('section').equals(sectionName).toArray();
                        coins.length = 0;
                        coins.push(..._fresh2);
                    }
                }
            }
        }
    } catch (_e) {
        console.warn('[db] per-coin image server sync skipped:', _e && _e.message);
    }

    return coins.map(coin => ({
        ...coin,
        coin_id: coin.id,
        inventory: null // Frontend uses its own inventory state via fetchInventory
    }));
}

export async function fetchCoinLocal(coinId) {
    const coin = await db.coins_reference.get(Number(coinId));
    if (!coin) throw new Error("Coin not found");

    const inv = await db.user_inventory.where('coin_ref_id').equals(Number(coinId)).first();
    return {
        ...coin,
        coin_id: coin.id,
        inventory: inv ? { ...inv, id: inv.id } : null
    };
}

// Tokens that should be treated as "no photo"
const _BAD_PHOTO_TOKENS = new Set(['undefined', 'null', 'none', '[object object]', '']);

/**
 * Scrub invalid/legacy tokens from a semicolon-delimited photo string.
 * @param {string|null} str
 * @returns {string|null} Cleaned string, or null if nothing remains.
 */
function scrubBadPhotoTokens(str) {
    if (!str) return null;
    const cleaned = str.split(';')
        .map(s => s.trim())
        .filter(s => s && !_BAD_PHOTO_TOKENS.has(s.toLowerCase()))
        .join(';');
    return cleaned || null;
}

export async function fetchInventoryLocal() {
    const rows = await db.user_inventory.toArray();
    const result = {};
    rows.forEach(row => {
        const key = String(row.coin_ref_id);
        if (!result[key]) result[key] = [];
        // Scrub bad photo tokens on load so they never reach the renderer
        if (row.personal_photo) row.personal_photo = scrubBadPhotoTokens(row.personal_photo);
        result[key].push({ ...row, id: row.id });
    });
    return result;
}

export async function updateInventoryLocal(coinRefId, data) {
    coinRefId = Number(coinRefId);
    const quantity = parseInt(data.quantity || 0, 10);
    const invId = data.id ? Number(data.id) : null;

    if (invId) {
        const inv = await db.user_inventory.get(invId);
        if (!inv || inv.coin_ref_id !== coinRefId) {
            throw new Error("Inventory entry mismatch or not found");
        }
        if (quantity <= 0) {
            await db.user_inventory.delete(invId);
            return { status: "deleted" };
        }
        const updates = {
            quantity,
            grade: data.grade !== undefined ? data.grade : inv.grade,
            purchase_price: data.purchase_price !== undefined ? Number(data.purchase_price) : inv.purchase_price,
            current_value: data.current_value !== undefined ? Number(data.current_value) : inv.current_value,
            date_acquired: data.date_acquired !== undefined ? data.date_acquired : inv.date_acquired,
            notes: data.notes !== undefined ? data.notes : inv.notes,
        };
        // Handle personal_photo base64 direct save
        if (data.personal_photo !== undefined) {
            updates.personal_photo = scrubBadPhotoTokens(data.personal_photo);
        }
        if (data.personal_photos !== undefined) {
            updates.personal_photo = scrubBadPhotoTokens(data.personal_photos.filter(x => x).join(';'));
        }
        await db.user_inventory.update(invId, updates);
        const updated = await db.user_inventory.get(invId);
        return { status: "updated", entry: { ...updated, id: updated.id } };
    } else {
        if (quantity <= 0) {
            return { status: "deleted" };
        }
        const newEntry = {
            coin_ref_id: coinRefId,
            quantity,
            grade: data.grade || "",
            purchase_price: Number(data.purchase_price || 0),
            current_value: Number(data.current_value || 0),
            date_acquired: data.date_acquired || new Date().toISOString().split('T')[0],
            notes: data.notes || "",
            personal_photo: data.personal_photo || null
        };
        if (data.personal_photos) {
            newEntry.personal_photo = data.personal_photos.filter(x => x).join(';');
        }
        const id = await db.user_inventory.add(newEntry);
        const added = await db.user_inventory.get(id);
        return { status: "updated", entry: { ...added, id: added.id } };
    }
}

export async function deleteInventoryEntryLocal(coinRefId) {
    const inv = await db.user_inventory.where('coin_ref_id').equals(Number(coinRefId)).first();
    if (inv) {
        await db.user_inventory.delete(inv.id);
    }
    return { status: "deleted" };
}

export async function fetchTypeConfigsLocal() {
    const configs = await db.coin_type_config.toArray();
    const result = {};
    configs.forEach(cfg => {
        // Return null for deleted fields so the catalog/fallback chain respects the deletion
        result[cfg.coin_type] = {
            obv_image: cfg._deleted_obv_image ? null : cfg.obv_image,
            rev_image: cfg._deleted_rev_image ? null : cfg.rev_image,
            proof_obv_image: cfg._deleted_proof_obv_image ? null : cfg.proof_obv_image,
            proof_rev_image: cfg._deleted_proof_rev_image ? null : cfg.proof_rev_image,
            _deleted_obv_image: !!cfg._deleted_obv_image,
            _deleted_rev_image: !!cfg._deleted_rev_image,
            _deleted_proof_obv_image: !!cfg._deleted_proof_obv_image,
            _deleted_proof_rev_image: !!cfg._deleted_proof_rev_image,
            base_price: cfg.base_price || 0,
            key_price: cfg.key_price || 0
        };
    });

    // Server-authoritative type config sync (self-hosted only).
    // Fetches latest type configs from server and updates IndexedDB so uploaded
    // type images appear on EVERY device (laptop, phone) instead of only the
    // browser that performed the upload. Public (GitHub Pages) has no backend,
    // so it is skipped and falls back to the seeded IndexedDB data.
    // Guarded + non-fatal on failure.
    try {
        const _host = (window.location && window.location.hostname) || '';
        const _selfHosted = _host.includes('opaleye-bluegill') || _host.includes('ts.net') || _host.includes('192.168.') || _host === 'localhost';
        if (_selfHosted) {
            const _native = window.__nativeFetch || window.fetch;
            if (typeof _native === 'function') {
                const _res2 = await _native('/api/pricing_rules');
                if (_res2 && _res2.ok) {
                    const _server = await _res2.json();
                    if (_server && typeof _server === 'object') {
                        const toUpdate = [];
                        for (const [coinType, serverCfg] of Object.entries(_server)) {
                            const localCfg = await db.coin_type_config.get(coinType);
                            if (!localCfg) {
                                // New type config from server - add it
                                toUpdate.push({
                                    coin_type: coinType,
                                    obv_image: serverCfg.obv_image || null,
                                    rev_image: serverCfg.rev_image || null,
                                    proof_obv_image: serverCfg.proof_obv_image || null,
                                    proof_rev_image: serverCfg.proof_rev_image || null,
                                    _deleted_obv_image: !!serverCfg._deleted_obv_image,
                                    _deleted_rev_image: !!serverCfg._deleted_rev_image,
                                    _deleted_proof_obv_image: !!serverCfg._deleted_proof_obv_image,
                                    _deleted_proof_rev_image: !!serverCfg._deleted_proof_rev_image,
                                    base_price: serverCfg.base_price || 0,
                                    key_price: serverCfg.key_price || 0
                                });
                            } else {
                                // Check for differences
                                const serverObv = serverCfg.obv_image || null;
                                const serverRev = serverCfg.rev_image || null;
                                const serverDelObv = !!serverCfg._deleted_obv_image;
                                const serverDelRev = !!serverCfg._deleted_rev_image;

                                if (localCfg.obv_image !== serverObv ||
                                    localCfg.rev_image !== serverRev ||
                                    localCfg._deleted_obv_image !== serverDelObv ||
                                    localCfg._deleted_rev_image !== serverDelRev) {
                                    toUpdate.push({
                                        coin_type: coinType,
                                        obv_image: serverObv,
                                        rev_image: serverRev,
                                        _deleted_obv_image: serverDelObv,
                                        _deleted_rev_image: serverDelRev
                                    });
                                }
                            }
                        }
                        if (toUpdate.length > 0) {
                            await db.transaction('rw', db.coin_type_config, async () => {
                                for (const item of toUpdate) {
                                    const existing = await db.coin_type_config.get(item.coin_type);
                                    if (existing) {
                                        await db.coin_type_config.update(item.coin_type, item);
                                    } else {
                                        await db.coin_type_config.add(item);
                                    }
                                }
                            });
                            // Update result with fresh server data
                            for (const item of toUpdate) {
                                result[item.coin_type] = {
                                    obv_image: item._deleted_obv_image ? null : item.obv_image,
                                    rev_image: item._deleted_rev_image ? null : item.rev_image,
                                    proof_obv_image: null,
                                    proof_rev_image: null,
                                    _deleted_obv_image: item._deleted_obv_image,
                                    _deleted_rev_image: item._deleted_rev_image,
                                    _deleted_proof_obv_image: false,
                                    _deleted_proof_rev_image: false,
                                    base_price: item.base_price || 0,
                                    key_price: item.key_price || 0
                                };
                            }
                        }
                    }
                }
            }
        }
    } catch (_e) {
        console.warn('[db] type config server sync skipped:', _e && _e.message);
    }

    // Public (GitHub Pages) JSON merge: the published type_configs.json is the
    // source of truth for section/type images. Re-read it so newly published
    // images appear WITHOUT the user having to clear IndexedDB. Never overrides
    // a locally deleted field or a user-assigned base64 image.
    try {
        const _host2 = (window.location && window.location.hostname) || '';
        const _selfHosted2 = _host2.includes('opaleye-bluegill') || _host2.includes('ts.net') || _host2.includes('192.168.') || _host2 === 'localhost';
        if (!_selfHosted2) {
            const _native2 = window.__nativeFetch || window.fetch;
            if (typeof _native2 === 'function') {
                const _jres = await _native2('data/type_configs.json');
                if (_jres && _jres.ok) {
                    const _json = await _jres.json();
                    const _list = Array.isArray(_json) ? _json : Object.values(_json);
                    for (const jc of _list) {
                        const ct = jc.coin_type || jc.id;
                        if (!ct) continue;
                        const cur = result[ct] || {};
                        const merged = { ...cur };
                        for (const fld of ['obv_image','rev_image','proof_obv_image','proof_rev_image']) {
                            const delFlag = '_deleted_' + fld;
                            const jsonVal = jc[fld] || null;
                            const locallyDeleted = cur[delFlag];
                            // Take JSON value if local is empty AND not deleted
                            if (jsonVal && !cur[fld] && !locallyDeleted) {
                                merged[fld] = jsonVal;
                            }
                        }
                        merged.base_price = jc.base_price || cur.base_price || 0;
                        merged.key_price = jc.key_price || cur.key_price || 0;
                        result[ct] = merged;
                    }
                    console.log('[db] merged published type_configs.json into public view');
                }
            }
        }
    } catch (_e2) {
        console.warn('[db] public type_configs.json merge skipped:', _e2 && _e2.message);
    }

    return result;
}

// ============================================================
// Spot Prices (CORS Proxy Yahoo Finance)
// ============================================================

export async function fetchSpotPricesLocal() {
    const symbolMap = {
        gold_oz: "GC=F",
        silver_oz: "SI=F",
        copper_lb: "HG=F",
        platinum_oz: "PL=F",
        palladium_oz: "PA=F"
    };

    // Load from cache first
    let cached = null;
    try {
        const c = localStorage.getItem('cc-spot-cache');
        if (c) cached = JSON.parse(c);
    } catch (e) {}

    const prices = { ...FALLBACK_SPOT_PRICES, _meta: { is_stale: true, updated_at: 'Never' } };
    if (cached && cached.prices && cached.updated_at) {
        Object.assign(prices, cached.prices);
        prices._meta.updated_at = cached.updated_at;
    }

    let successCount = 0;
    const promises = Object.keys(symbolMap).map(async key => {
        const symbol = symbolMap[key];
        const primaryUrl = `/yahoo-finance/v8/finance/chart/${symbol}`;
        const backupUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent('https://query2.finance.yahoo.com/v8/finance/chart/' + symbol)}`;
        // PUBLIC FALLBACK (2026-08-24): on the local-first public build there is
        // no self-hosted /yahoo-finance proxy and allorigins.win is often blocked,
        // so add a second public CORS proxy as a last resort before falling back
        // to cached/fallback prices. This keeps live prices working for strangers.
        const publicProxyUrl = `https://corsproxy.io/?url=${encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/' + symbol)}`;

        let triedUrls = [];
        try {
            let resp;
            let controller = new AbortController();
            let timeoutId = setTimeout(() => controller.abort(), 4000);

            // Only attempt the self-hosted proxy when actually self-hosted.
            if (getIsSelfHosted()) {
                triedUrls.push(primaryUrl);
                try {
                    resp = await fetch(primaryUrl, { signal: controller.signal });
                } catch (e) { resp = null; }
                clearTimeout(timeoutId);
            }

            if (!resp || !resp.ok) {
                // Public builds skip straight to a public CORS proxy.
                controller = new AbortController();
                timeoutId = setTimeout(() => controller.abort(), 4000);
                if (!getIsSelfHosted()) {
                    triedUrls.push(publicProxyUrl);
                    try { resp = await fetch(publicProxyUrl, { signal: controller.signal }); }
                    catch (e) { resp = null; }
                } else {
                    triedUrls.push(backupUrl);
                    try { resp = await fetch(backupUrl, { signal: controller.signal }); }
                    catch (e) { resp = null; }
                }
                clearTimeout(timeoutId);
            }

            if (resp && resp.ok) {
                const data = await resp.json();
                const price = data.chart.result[0].meta.regularMarketPrice;
                prices[key] = parseFloat(parseFloat(price).toFixed(2));
                successCount++;
            } else {
                throw new Error("API completely failed for " + symbol);
            }
        } catch (e) {
            // Non-fatal: fall back to cached/fallback prices. Downgraded from
            // console.warn → console.debug so the public build doesn't spam the
            // console when live prices are unreachable offline.
            console.debug(`[spot] ${symbol} using fallback/cache (tried: ${triedUrls.join(', ') || 'none'}).`);
        }
    });

    await Promise.all(promises);

    // Update cache if completely successful
    if (successCount === Object.keys(symbolMap).length) {
        prices._meta.is_stale = false;
        prices._meta.updated_at = Date.now();
        try {
            localStorage.setItem('cc-spot-cache', JSON.stringify({
                prices: {
                    gold_oz: prices.gold_oz,
                    silver_oz: prices.silver_oz,
                    copper_lb: prices.copper_lb,
                    platinum_oz: prices.platinum_oz,
                    palladium_oz: prices.palladium_oz,
                },
                updated_at: prices._meta.updated_at
            }));
        } catch(e) {}
    }

    return prices;
}

export async function fetchSpotHistoryLocal(period) {
    const symbolMap = {
        gold_oz: "GC=F",
        silver_oz: "SI=F",
        copper_lb: "HG=F",
        platinum_oz: "PL=F",
        palladium_oz: "PA=F"
    };
    
    let range = '1mo';
    let interval = '1d';
    if (period === '1W') { range = '1wk'; interval = '1d'; }
    else if (period === '1M') { range = '1mo'; interval = '1d'; }
    else if (period === '1Y') { range = '1y'; interval = '1d'; }
    else if (period === 'All') { range = 'max'; interval = '1mo'; }

    const cacheKey = 'cc-history-' + period;
    let cached = null;
    try {
        const c = localStorage.getItem(cacheKey);
        if (c) cached = JSON.parse(c);
    } catch(e) {}

    // Return cache if it is less than 12 hours old
    if (cached && cached.updated_at > Date.now() - (12 * 3600 * 1000)) {
        return cached.data;
    }

    const dataObj = {};
    const promises = Object.keys(symbolMap).map(async key => {
        const symbol = symbolMap[key];
        const primaryUrl = `/yahoo-finance/v8/finance/chart/${symbol}?range=${range}&interval=${interval}`;
        const backupUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent('https://query2.finance.yahoo.com/v8/finance/chart/' + symbol + '?range=' + range + '&interval=' + interval)}`;
        // PUBLIC FALLBACK (2026-08-24): mirror fetchSpotPricesLocal — public builds
        // skip the self-hosted proxy and use a public CORS proxy instead.
        const publicProxyUrl = `https://corsproxy.io/?url=${encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/' + symbol + '?range=' + range + '&interval=' + interval)}`;

        try {
            let resp;
            let controller = new AbortController();
            let timeoutId = setTimeout(() => controller.abort(), 6000);

            if (getIsSelfHosted()) {
                try { resp = await fetch(primaryUrl, { signal: controller.signal }); } catch (e) { resp = null; }
                clearTimeout(timeoutId);
            }

            if (!resp || !resp.ok) {
                controller = new AbortController();
                timeoutId = setTimeout(() => controller.abort(), 6000);
                if (!getIsSelfHosted()) {
                    try { resp = await fetch(publicProxyUrl, { signal: controller.signal }); } catch (e) { resp = null; }
                } else {
                    try { resp = await fetch(backupUrl, { signal: controller.signal }); } catch (e) { resp = null; }
                }
                clearTimeout(timeoutId);
            }

            if (resp && resp.ok) {
                const data = await resp.json();
                if (data.chart && data.chart.result && data.chart.result[0]) {
                    const res = data.chart.result[0];
                    const timestamps = res.timestamp || [];
                    const closes = (res.indicators && res.indicators.quote && res.indicators.quote[0] && res.indicators.quote[0].close) ? res.indicators.quote[0].close : [];
                    dataObj[key] = timestamps.map((t, i) => ({ t: t * 1000, v: closes[i] })).filter(d => d.v != null);
                }
            }
        } catch (e) {
            console.warn(`Failed to fetch history for ${symbol}`);
        }
    });

    await Promise.all(promises);

    // If we successfully fetched data, update the cache
    if (Object.keys(dataObj).length > 0) {
        // Only overwrite cache if we got all symbols, otherwise use old cache
        if (Object.keys(dataObj).length === Object.keys(symbolMap).length) {
            try {
                localStorage.setItem(cacheKey, JSON.stringify({ data: dataObj, updated_at: Date.now() }));
            } catch(e) {}
            return dataObj;
        }
    }
    
    // Fallback to cache entirely if fetch failed
    return cached ? cached.data : {};
}

// ============================================================
// Valuation & Portfolio Engine (translated from valuation.py)
// ============================================================

function convertSpotToPerGram(spotPrices) {
    return {
        gold: (spotPrices.gold_oz || 0) / 31.1035,
        silver: (spotPrices.silver_oz || 0) / 31.1035,
        copper: (spotPrices.copper_lb || 0) / 453.592,
        platinum: (spotPrices.platinum_oz || 0) / 31.1035,
        palladium: (spotPrices.palladium_oz || 0) / 31.1035,
    };
}

function parseMetalMelt(metalStr, weightG, spot) {
    if (!metalStr || weightG <= 0) return [0.0, "none"];
    const m = metalStr.toLowerCase();

    if (m.includes("99.9") || m.includes("99.99")) {
        if (m.includes("gold")) return [weightG * (spot.gold || 0), "gold"];
        if (m.includes("silver")) return [weightG * (spot.silver || 0), "silver"];
        if (m.includes("platinum")) return [weightG * (spot.platinum || 0), "platinum"];
        if (m.includes("palladium")) return [weightG * (spot.palladium || 0), "palladium"];
    }

    if (m.includes("gold")) {
        let pct = 0.90;
        if (m.includes("91.67")) pct = 0.9167;
        else if (m.includes("90%") || m.includes("90 ")) pct = 0.90;
        else if (m.includes("75%")) pct = 0.75;
        else if (m.includes("bimetallic")) pct = 0.50;
        return [weightG * pct * (spot.gold || 0), "gold"];
    }

    if (m.includes("silver")) {
        let pct = 0.90;
        if (m.includes("99.93") || m.includes("99%")) pct = 0.999;
        else if (m.includes("90%") || m.includes("90 ")) pct = 0.90;
        else if (m.includes("89.24")) pct = 0.8924;
        else if (m.includes("75%")) pct = 0.75;
        else if (m.includes("40%")) pct = 0.40;
        else if (m.includes("35%")) pct = 0.35;
        else if (m.includes("92.5") || m.includes("sterling")) pct = 0.925;
        return [weightG * pct * (spot.silver || 0), "silver"];
    }

    if (m.includes("steel") || (m.includes("zinc") && !m.includes("copper"))) {
        return [0.0, "none"];
    }

    if (m.includes("copper") || m.includes("bronze") || m.includes("tombac") || m.includes("brass")) {
        let pct = 0.95;
        if (m.includes("100%")) pct = 1.0;
        else if (m.includes("98%") || m.includes("97.5")) pct = 0.975;
        else if (m.includes("95.5")) pct = 0.955;
        else if (m.includes("95%")) pct = 0.95;
        else if (m.includes("90%")) pct = 0.90;
        else if (m.includes("88%") || m.includes("88.5")) pct = 0.885;
        else if (m.includes("75%")) pct = 0.75;
        else if (m.includes("copper-plated")) pct = 0.025;
        else if (m.includes("clad")) pct = 0.0833;
        return [weightG * pct * (spot.copper || 0), "copper"];
    }

    return [0.0, "none"];
}

function lookupDefaultPrice(coinType, isKeyDate) {
    const ctLower = (coinType || "").toLowerCase();

    if (ctLower.includes("commemorative")) {
        if (ctLower.includes("gold")) {
            return isKeyDate ? 1000 : 500;
        } else if (ctLower.includes("half") || ctLower.includes("50c")) {
            return isKeyDate ? 80 : 20;
        } else {
            return isKeyDate ? 100 : 30;
        }
    }

    for (const pattern of Object.keys(DEFAULT_COIN_PRICES)) {
        if (ctLower.includes(pattern.toLowerCase())) {
            const prices = DEFAULT_COIN_PRICES[pattern];
            return isKeyDate ? prices[1] : prices[0];
        }
    }

    return isKeyDate ? 50.0 : 2.0;
}

function calculateCoinValue(coin, inv, typeCfg, spotPerGram, faceValue) {
    const weight = coin.weight_grams || 0;
    const metalStr = coin.metal || "";

    const [meltPerCoin, metalCat] = parseMetalMelt(metalStr, weight, spotPerGram);

    let activeMetalCat = metalCat;
    const coinTypeLower = (coin.coin_type || "").toLowerCase();
    const isCopperPenny = (
        metalCat === "copper" &&
        coinTypeLower.includes("lincoln") &&
        coin.year >= 1959 && coin.year <= 1981
    );
    if (metalCat === "copper" && !isCopperPenny) {
        activeMetalCat = "none";
    }

    const currV = inv ? Number(inv.current_value || 0) : 0;
    const paidV = inv ? Number(inv.purchase_price || 0) : 0;

    let defaultRuleVal = 0;
    if (typeCfg) {
        defaultRuleVal = coin.is_key_date ? (typeCfg.key || 0) : (typeCfg.base || 0);
    } else {
        defaultRuleVal = lookupDefaultPrice(coin.coin_type, coin.is_key_date);
    }

    let nonMeltVal = 0;
    if (currV > 0) nonMeltVal = currV;
    else if (paidV > 0) nonMeltVal = paidV;
    else nonMeltVal = Math.max(faceValue, defaultRuleVal);

    nonMeltVal = Math.max(nonMeltVal, faceValue);

    const finalPerCoin = Math.max(meltPerCoin, nonMeltVal);

    let bucket = "collectable_value";
    if (meltPerCoin > 0 && meltPerCoin >= nonMeltVal) {
        const bucketMap = {
            "gold":      "gold_coin_melt",
            "silver":    "silver_coin_melt",
            "copper":    "copper_coin_melt",
            "platinum":  "platinum_coin_melt",
            "palladium": "palladium_coin_melt",
        };
        bucket = bucketMap[activeMetalCat] || "collectable_value";
    }

    return [finalPerCoin, bucket];
}

export async function fetchPortfolioLocal() {
    const spotPrices = await fetchSpotPricesLocal();
    const spot = convertSpotToPerGram(spotPrices);

    const inventory = await db.user_inventory.toArray();
    const typeConfigs = await db.coin_type_config.toArray();
    const references = await db.coins_reference.toArray();

    // Map references for quick access
    const refMap = {};
    references.forEach(r => { refMap[r.id] = r; });

    // Map type configs
    const configs = {};
    typeConfigs.forEach(cfg => {
        configs[cfg.coin_type] = {
            base: cfg.base_price || 0,
            key: cfg.key_price || 0
        };
    });

    const stats = {
        total_items:          0,
        total_physical_coins: 0,
        face_value:           0.0,
        gold_coin_melt:       0.0,
        silver_coin_melt:     0.0,
        copper_coin_melt:     0.0,
        platinum_coin_melt:   0.0,
        palladium_coin_melt:  0.0,
        collectable_value:    0.0,
        raw_bullion:          0.0,
        bulk_coins_value:     0.0,
        scrap_value:          0.0,
        paper_value:          0.0,
        other_value:          0.0,
    };

    let pureCoinCount = 0;
    inventory.forEach(inv => {
        const coin = refMap[inv.coin_ref_id];
        if (!coin) return;

        const qty = inv.quantity || 1;
        pureCoinCount += qty;

        const denomKey = (coin.denomination || "").toLowerCase().trim();
        const face = FACE_VALUE_MAP[denomKey] || 0.0;
        stats.face_value += face * qty;

        let cfg = configs[coin.coin_type];
        if (!cfg) {
            const mainT = coin.coin_type.includes(" - ") ? coin.coin_type.split(" - ")[0].trim() : "";
            cfg = configs[mainT];
        }

        const [finalPerCoin, bucket] = calculateCoinValue(coin, inv, cfg, spot, face);
        stats[bucket] += finalPerCoin * qty;
    });

    // ---- Raw Bullion ----
    const bullionItems = await db.raw_bullion.toArray();
    bullionItems.forEach(b => {
        const metal = (b.metal_type || "").toLowerCase();
        const weightOz = b.weight || 0;
        const purity = b.purity || 1.0;
        const spotMap = {
            "gold":      spotPrices.gold_oz,
            "silver":    spotPrices.silver_oz,
            "copper":    spotPrices.copper_lb,
            "platinum":  spotPrices.platinum_oz,
            "palladium": spotPrices.palladium_oz,
        };
        const price = spotMap[metal] || 0;
        stats.raw_bullion += weightOz * purity * price;
    });

    // ---- Bulk Coins ----
    const bulkItems = await db.bulk_inventory.toArray();
    bulkItems.forEach(b => {
        const mt = b.metal_type || "";
        const wt = b.total_weight_grams || 0;
        if (mt === "CopperPennies") {
            stats.bulk_coins_value += wt * 0.95 * (spot.copper || 0);
        } else if (mt === "ZincPennies") {
            stats.bulk_coins_value += (wt / 2.5) * 0.01;
        } else if (mt === "Nickels") {
            stats.bulk_coins_value += (wt / 5.0) * 0.05;
        } else if (mt === "SilverCoins90") {
            stats.bulk_coins_value += wt * 0.90 * (spot.silver || 0);
        } else if (mt === "CladDimes") {
            stats.bulk_coins_value += (wt / 2.268) * 0.10;
        } else if (mt === "CladQuarters") {
            stats.bulk_coins_value += (wt / 5.67) * 0.25;
        } else if (mt === "CladHalves") {
            stats.bulk_coins_value += (wt / 11.34) * 0.50;
        } else if (["Gold", "Silver", "Copper", "Platinum", "Palladium"].includes(mt)) {
            const metalKey = mt.toLowerCase();
            if (metalKey === "copper") {
                stats.raw_bullion += wt * (spot.copper || 0);
            } else {
                stats.raw_bullion += wt * (spot[metalKey] || 0);
            }
        }
    });

    // ---- Scrap Metal ----
    const scrapItems = await db.scrap_metal.toArray();
    scrapItems.forEach(s => {
        const metal = (s.metal_type || "").toLowerCase();
        const wt = s.weight_grams || 0;
        const purity = s.purity || 1.0;
        stats.scrap_value += wt * purity * (spot[metal] || 0);
    });

    // ---- Paper Currency ----
    const paperItems = await db.paper_currency.toArray();
    let paperCount = 0;
    paperItems.forEach(p => {
        paperCount += 1;
        const val = Number(p.value || 0);
        if (val > 0) {
            stats.paper_value += val;
        } else {
            const denom = Number(p.denomination || 0);
            stats.paper_value += p.is_star_note ? (denom * 2) : denom;
        }
    });

    // ---- Other Collectables ----
    const otherItems = await db.other_collectable.toArray();
    let otherQty = 0;
    otherItems.forEach(c => {
        const qty = c.quantity || 1;
        stats.other_value += (c.estimated_value || 0) * qty;
        otherQty += qty;
    });

    // ---- Totals ----
    stats.total_physical_coins = pureCoinCount;
    stats.total_items = pureCoinCount + paperCount + otherQty;

    stats.total_melt = (
        stats.gold_coin_melt +
        stats.silver_coin_melt +
        stats.copper_coin_melt +
        stats.platinum_coin_melt +
        stats.palladium_coin_melt
    );

    stats.total_estimated_value = (
        stats.collectable_value +
        stats.total_melt +
        stats.raw_bullion +
        stats.bulk_coins_value +
        stats.scrap_value +
        stats.paper_value +
        stats.other_value
    );

    // Round all floats
    Object.keys(stats).forEach(key => {
        if (typeof stats[key] === 'number') {
            stats[key] = parseFloat(stats[key].toFixed(2));
        }
    });

    return stats;
}

// ============================================================
// Raw Bullion / Scrap / Custom Categories / Other modules
// ============================================================

export async function fetchRawBullionLocal() {
    return db.raw_bullion.toArray();
}

export async function saveRawBullionLocal(data) {
    const entry = {
        metal_type: data.metal_type || "gold",
        weight_unit: data.weight_unit || "oz",
        weight: Number(data.weight || 0),
        purity: Number(data.purity || 1.0),
        label: data.label || "",
        notes: data.notes || ""
    };
    if (data.id) {
        await db.raw_bullion.update(Number(data.id), entry);
        return { ...entry, id: Number(data.id) };
    } else {
        const id = await db.raw_bullion.add(entry);
        return { ...entry, id };
    }
}

export async function deleteRawBullionLocal(id) {
    await db.raw_bullion.delete(Number(id));
    return { status: "deleted" };
}

export async function fetchScrapLocal() {
    return db.scrap_metal.toArray();
}

export async function saveScrapLocal(data) {
    const entry = {
        name: data.name || "",
        metal_type: data.metal_type || "silver",
        purity: Number(data.purity || 1.0),
        weight_grams: Number(data.weight_grams || 0),
        notes: data.notes || ""
    };
    if (data.id) {
        await db.scrap_metal.update(Number(data.id), entry);
        return { ...entry, id: Number(data.id) };
    } else {
        const id = await db.scrap_metal.add(entry);
        return { ...entry, id };
    }
}

export async function deleteScrapLocal(id) {
    await db.scrap_metal.delete(Number(id));
    return { status: "deleted" };
}

export async function fetchPaperCurrencyLocal() {
    return db.paper_currency.toArray();
}

export async function savePaperCurrencyLocal(data) {
    const entry = {
        denomination: Number(data.denomination || 1.0),
        series_year: data.series_year || "",
        serial_number: data.serial_number || "",
        is_star_note: !!data.is_star_note,
        condition: data.condition || "",
        value: Number(data.value || 0.0),
        notes: data.notes || "",
        obv_image: data.obv_image || null,
        rev_image: data.rev_image || null,
        signatures: data.signatures || "",
        friedberg: data.friedberg || ""
    };
    if (data.id) {
        await db.paper_currency.update(Number(data.id), entry);
        return { ...entry, id: Number(data.id) };
    } else {
        const id = await db.paper_currency.add(entry);
        return { ...entry, id };
    }
}

export async function deletePaperCurrencyLocal(id) {
    await db.paper_currency.delete(Number(id));
    return { status: "deleted" };
}

export async function fetchCustomCategoriesLocal() {
    return db.custom_category.toArray();
}

export async function saveCustomCategoryLocal(name) {
    await db.custom_category.put({ name });
    return { name };
}

export async function deleteCustomCategoryLocal(name) {
    await db.custom_category.delete(name);
    // Delete cascade all collectables
    await db.other_collectable.where('category_name').equals(name).delete();
    return { status: "deleted" };
}

export async function fetchOtherCollectablesLocal() {
    return db.other_collectable.toArray();
}

export async function saveOtherCollectablesLocal(data) {
    const entry = {
        category_name: data.category_name || "",
        name: data.name || "",
        quantity: Number(data.quantity || 1),
        estimated_value: Number(data.estimated_value || 0.0),
        notes: data.notes || "",
        personal_photo: data.personal_photo || null
    };
    if (data.id) {
        await db.other_collectable.update(Number(data.id), entry);
        return { ...entry, id: Number(data.id) };
    } else {
        const id = await db.other_collectable.add(entry);
        return { ...entry, id };
    }
}

export async function deleteOtherCollectableLocal(id) {
    await db.other_collectable.delete(Number(id));
    return { status: "deleted" };
}

export async function fetchWishlistLocal() {
    return db.wishlist_item.toArray();
}

export async function saveWishlistLocal(data) {
    const entry = {
        coin_id: data.coin_id ? Number(data.coin_id) : null,
        description: data.description || "",
        category: data.category || "",
        target_grade: data.target_grade || "",
        max_price: Number(data.max_price || 0),
        notes: data.notes || "",
        acquired: !!data.acquired,
        date_added: data.date_added || new Date().toISOString().split('T')[0]
    };
    if (data.id) {
        await db.wishlist_item.update(Number(data.id), entry);
        return { ...entry, id: Number(data.id) };
    } else {
        const id = await db.wishlist_item.add(entry);
        return { ...entry, id };
    }
}

export async function addToWishlistLocal(coinId) {
    coinId = Number(coinId);
    const coin = await db.coins_reference.get(coinId);
    if (!coin) throw new Error("Coin not found");

    const existing = await db.wishlist_item.where('coin_id').equals(coinId).first();
    if (existing) return existing;

    const entry = {
        coin_id: coinId,
        description: `${coin.year} ${coin.mint_mark} ${coin.coin_type}`,
        category: "Coins",
        target_grade: "",
        max_price: 0,
        notes: "",
        acquired: false,
        date_added: new Date().toISOString().split('T')[0]
    };
    const id = await db.wishlist_item.add(entry);
    return { ...entry, id };
}

export async function removeFromWishlistLocal(coinId) {
    await db.wishlist_item.where('coin_id').equals(Number(coinId)).delete();
    return { status: "deleted" };
}

export async function updateWishlistItemLocal(itemId, data) {
    itemId = Number(itemId);
    const updates = {};
    if (data.target_grade !== undefined) updates.target_grade = data.target_grade;
    if (data.max_price !== undefined) updates.max_price = Number(data.max_price);
    if (data.notes !== undefined) updates.notes = data.notes;
    if (data.acquired !== undefined) updates.acquired = !!data.acquired;

    await db.wishlist_item.update(itemId, updates);
    const updated = await db.wishlist_item.get(itemId);
    return updated;
}

// ============================================================
// Bulk Coins Module
// ============================================================

export async function fetchBulkCoinsLocal() {
    return db.bulk_inventory.toArray();
}

export async function saveBulkCoinsLocal(data) {
    const entry = {
        label: data.label || "",
        metal_type: data.metal_type || "copper",
        total_weight_grams: Number(data.total_weight_grams || 0.0),
        weight_unit: data.weight_unit || "",
        notes: data.notes || ""
    };
    if (data.id) {
        await db.bulk_inventory.update(Number(data.id), entry);
        return { ...entry, id: Number(data.id) };
    } else {
        const id = await db.bulk_inventory.add(entry);
        return { ...entry, id };
    }
}

export async function deleteBulkCoinsLocal(id) {
    await db.bulk_inventory.delete(Number(id));
    return { status: "deleted" };
}

// ============================================================
// Image Management (Direct Base64 save in coin_type_config)
// ============================================================


// ============================================================
// Image Group Lookup — determines which coin types share
// obverse/reverse designs (e.g., all 50 State Quarters share
// the George Washington obverse, but each has a unique reverse).
// Used by assignImageLocal() for the three placement scopes.
// ============================================================

// Known parent series where ALL sub-types share the same obverse design.
// Add new series here as needed. The function uses these to
// dynamically find all member coin types from the type_configs table.
const _SERIES_WITH_SHARED_OBVERSE = new Set([
    '50 State Quarters',
    'America the Beautiful',
    'Presidential Dollar',
    'D.C. and U.S. Territories',
    'American Women',
    'Innovation Dollar',
    'Native American Dollar',
]);

// Collect all separate-pattern variants (underscore vs space, etc.)
const _SERIES_TAG_PATTERNS = [
    // State Quarters
    ('50 State Quarters', '50_State_Quarters_-_'),
    ('50 State Quarters', '50 State Quarters - '),
    ('50 State Quarters', '50_State_Quarters___'),
    // America the Beautiful
    ('America the Beautiful', 'America_the_Beautiful_-_'),
    ('America the Beautiful', 'America the Beautiful - '),
    ('America the Beautiful', 'America_the_Beautiful___'),
    // Presidential Dollar
    ('Presidential Dollar', 'Presidential_Dollar_-_'),
    ('Presidential Dollar', 'Presidential Dollar - '),
    // D.C. and U.S. Territories
    ('D.C. and U.S. Territories', 'D.C._and_U.S._Territories_-_'),
    ('D.C. and U.S. Territories', 'D.C. and U.S. Territories - '),
    ('D.C. and U.S. Territories', 'D.C._and_U.S._Territories___'),
    // American Women
    ('American Women', 'American_Women_-_'),
    ('American Women', 'American Women - '),
    // Innovation Dollar
    ('Innovation Dollar', 'Innovation_Dollar_-_'),
    ('Innovation Dollar', 'Innovation Dollar - '),
    // Native American Dollar / Sacagawea
    ('Native American Dollar', 'Native_American_Dollar_-_'),
    ('Native American Dollar', 'Sacagawea_-_'),
];

/**
 * Extract the "base name" from a series sub-type coin_type.
 * E.g. from "50_State_Quarters_-_Michigan" or "50_State_Quarters___Michigan_proof"
 * returns "Michigan". Returns null if no base can be extracted.
 */
function _extractBaseName(coinType) {
    // Try patterns in order
    // Pattern: "___Base_proof" (triple underscore + proof suffix)
    let m = coinType.match(/___([A-Za-z0-9_\s\.\,-]+?)_proof$/);
    if (m) return m[1].trim();
    // Pattern: "_-_Base" 
    m = coinType.match(/_-_([A-Za-z0-9_\s\.\,-]+)$/);
    if (m) return m[1].trim();
    // Pattern: " - Base" (space-dash-space)
    m = coinType.match(/\s-\s([A-Za-z0-9_\s\.\,-]+)$/);
    if (m) return m[1].trim();
    // Pattern: "(Base)" (parenthetical like "(Omega Privy)")
    m = coinType.match(/\(([^)]+)\)$/);
    if (m) return m[0];  // return the whole parenthetical including parens
    return null;
}

/**
 * Find all coin types that share the same image as the given coin_type
 * for a specific side (obv/rev).
 * 
 * For obverse: groups by series (all sub-types of a series share the obverse).
 * For reverse: groups by BASE NAME (e.g., all Michigan variants share the same
 * reverse: P mint, D mint, S proof, silver proof — all under "Michigan").
 * 
 * @param {string} coinType The coin_type to look up.
 * @param {string} side 'obv' or 'rev'
 * @returns {Promise<string[]>} Array of coin_type values to update together.
 */
// Coin-type names shared by MORE THAN ONE section. These are section-scoped:
// a config row for one of these must live under '<section> — <coin_type>' so
// Half Cent images can never bleed into Large & Small Cent (e.g. "Braided Hair").
export const _COLLIDING_TYPES = new Set(["Barber", "Braided Hair", "Capped Bust", "Classic Head", "Draped Bust", "Draped Bust - Heraldic Eagle", "Draped Bust - Small Eagle", "Flowing Hair", "Seated Liberty", "Trade Dollar"]);

export async function _getCoimageGroupMembers(coinType, side) {
    const allConfigs = await db.coin_type_config.toArray();
    const isRev = (side === 'rev' || side === 'proof_rev');

    // === REVERSE: group by base name ===
    if (isRev) {
        const base = _extractBaseName(coinType);
        if (base) {
            // Find all configs that share this base name — no series prefix match needed
        // since base names (state/entity names) are unique within context
            const members = [coinType];
            for (const cfg of allConfigs) {
                if (cfg.coin_type === coinType) continue;
                const otherBase = _extractBaseName(cfg.coin_type);
                if (otherBase && otherBase === base) {
                    members.push(cfg.coin_type);
                }
            }
            if (members.length > 0) return [...new Set(members)];
        }
        // where ALL variants share the same reverse
        // Look for other configs that share the same "root" name
        const rootName = coinType.replace(/\(.*\)$/, '').replace(/_[a-z]+_proof$/i, '').replace(/ - .*$/, '').trim();
        if (rootName && rootName !== coinType) {
            const members = [coinType];
            for (const cfg of allConfigs) {
                if (cfg.coin_type === coinType) continue;
                const cfgRoot = cfg.coin_type.replace(/\(.*\)$/, '').replace(/_[a-z]+_proof$/i, '').trim();
                if (cfgRoot === rootName) {
                    members.push(cfg.coin_type);
                }
            }
            if (members.length > 1) return [...new Set(members)];
        }

        // Default: just this one entry
        return [coinType];
    }

    // === OBVERSE: group by series ===
    // Check if this coin_type IS a known parent series name
    if (_SERIES_WITH_SHARED_OBVERSE.has(coinType)) {
        const members = [coinType];
        for (const cfg of allConfigs) {
            if (cfg.coin_type === coinType) continue;
            for (const [, prefix] of _SERIES_TAG_PATTERNS) {
                if (cfg.coin_type.startsWith(prefix)) {
                    if (!members.includes(cfg.coin_type)) {
                        members.push(cfg.coin_type);
                    }
                    break;
                }
            }
        }
        return members;
    }

    // Check if this coin_type is a sub-type of a known series
    for (const [seriesName, prefix] of _SERIES_TAG_PATTERNS) {
        if (coinType.startsWith(prefix)) {
            const members = [coinType];
            if (_SERIES_WITH_SHARED_OBVERSE.has(seriesName)) {
                const parentCfg = allConfigs.find(c => c.coin_type === seriesName);
                if (parentCfg && parentCfg.coin_type !== coinType) {
                    members.push(seriesName);
                }
            }
            // Normalize series name for substring matching
            const seriesNorm = seriesName.replace(/[^a-z0-9]/gi, '').toLowerCase();
            for (const cfg of allConfigs) {
                if (members.includes(cfg.coin_type)) continue;
                
                // Check 1: starts with a known prefix matching this series
                let matched = false;
                for (const [, pfx] of _SERIES_TAG_PATTERNS) {
                    if (cfg.coin_type.startsWith(pfx)) {
                        const prefixPart = prefix.replace(/[_-]+$/, '');
                        const pfxPart = pfx.replace(/[_-]+$/, '');
                        if (prefixPart === pfxPart || 
                            seriesName.replace(/[_-]+/g, '').toLowerCase() === 
                                cfg.coin_type.replace(/[_-]+/g, '').substring(0, seriesName.replace(/[_-]+/g, '').length).toLowerCase()) {
                            members.push(cfg.coin_type);
                            matched = true;
                        }
                        break;
                    }
                }
                
                // Check 2: section-qualified entry containing the series name
                if (!matched) {
                    const cfgNorm = cfg.coin_type.replace(/[^a-z0-9]/gi, '').toLowerCase();
                    if (cfgNorm.includes(seriesNorm)) {
                        members.push(cfg.coin_type);
                    }
                }
            }
            return [...new Set(members)];
        }
    }

    // Fallback: dash-separated sub-type pattern
    const dashIdx = coinType.indexOf(' - ');
    if (dashIdx > 0) {
        const prefix = coinType.substring(0, dashIdx);
        const members = [coinType];
        for (const cfg of allConfigs) {
            if (cfg.coin_type === coinType) continue;
            if (cfg.coin_type.startsWith(prefix + ' - ') || 
                cfg.coin_type.startsWith(prefix + '_-_') ||
                cfg.coin_type.startsWith(prefix.replace(/ /g, '_') + '_-_')) {
                members.push(cfg.coin_type);
            }
        }
        if (members.length > 1) return members;
    }

    return [coinType];
}

export async function assignImageLocal(data) {
    const { coin_type, side, image, scope, item_id, section } = data;
    // For offline-first, images are saved directly as base64 strings in the DB
    if (scope === "all" || scope === "empty_only") {
        // Determine which coin types should be updated together
        const members = await _getCoimageGroupMembers(coin_type, side);
        const sideMap = {"obv":"obv_image","rev":"rev_image","proof_obv":"proof_obv_image","proof_rev":"proof_rev_image"};
        const sideKey = sideMap[side] || "obv_image";
        const qualify = (t) => (section && _COLLIDING_TYPES.has(t)) ? (section + ' — ' + t) : t;
        
        for (const _m of members) {
            const memberType = qualify(_m);
            let cfg = await db.coin_type_config.get(memberType);
            if (!cfg) {
                cfg = { coin_type: memberType, obv_image: null, rev_image: null, proof_obv_image: null, proof_rev_image: null };
                await db.coin_type_config.add(cfg);
                cfg = await db.coin_type_config.get(memberType);
            }
            
            // scope="all": overwrite everything. scope="empty_only": only if slot is empty/null.
            if (scope === "all" || !cfg[sideKey]) {
                const updates = {};
                // Empty image = user wants this side REMOVED. Mark _deleted so a later
                // merge/seed can never re-inject the old URL (ghost image bug).
                if (image) {
                    updates[sideKey] = image;
                    updates['_deleted_' + sideKey] = false;
                } else {
                    updates[sideKey] = null;
                    updates['_deleted_' + sideKey] = true;
                }
                await db.coin_type_config.update(memberType, updates);
            }
        }
    } else if (scope === "specific_coin") {
        // If no item_id, this is a main type coin — update only this coin_type (no group propagation)
        if (!item_id) {
            const targetKey = (section && _COLLIDING_TYPES.has(coin_type)) ? (section + ' — ' + coin_type) : coin_type;
            let cfg = await db.coin_type_config.get(targetKey);
            if (!cfg) {
                cfg = { coin_type: targetKey, obv_image: null, rev_image: null, proof_obv_image: null, proof_rev_image: null };
                await db.coin_type_config.add(cfg);
            }
            const sideMap = {"obv":"obv_image","rev":"rev_image","proof_obv":"proof_obv_image","proof_rev":"proof_rev_image"};
            const sideKey = sideMap[side] || "obv_image";
            const updates = {};
            if (image) {
                updates[sideKey] = image;
                updates['_deleted_' + sideKey] = false;
            } else {
                updates[sideKey] = null;
                updates['_deleted_' + sideKey] = true;
            }
            await db.coin_type_config.update(targetKey, updates);
        } else {
            // Save to the specific coin reference record (item_id = coin_ref_id) so the
            // album/catalog, which read db.coins_reference.obv_image / rev_image, display it.
            const refId = Number(item_id);
            const sideMap = { "obv":"obv_image", "rev":"rev_image", "proof_obv":"proof_obv_image", "proof_rev":"proof_rev_image" };
            const sideKey = sideMap[side] || "obv_image";
            const ref = await db.coins_reference.get(refId);
            if (ref) {
                const updates = {};
                if (image) {
                    updates[sideKey] = image;
                    updates['_deleted_' + sideKey] = false;
                } else {
                    updates[sideKey] = null;
                    updates['_deleted_' + sideKey] = true;
                }
                await db.coins_reference.update(refId, updates);
            }
            // NOTE: previously this wrongly wrote to user_inventory.personal_photo,
            // creating a fake "owned" row. The per-coin reference image belongs on
            // db.coins_reference so the album shows it. Personal photos are a separate
            // specific_item scope.
            
        }
    } else if (scope === "specific_item") {
        // Save to specific inventory entry by its id — item_id is user_inventory.id
        const invId = Number(item_id);
        if (invId) {
            const inv = await db.user_inventory.get(invId);
            if (inv) {
                await db.user_inventory.update(invId, { personal_photo: image });
            }
        }
    }
    return { status: "success" };
}

export async function resetImageToMasterLocal(coinType, side) {
    // In local mode, resetting is simply deleting the type configuration for that side
    const cfg = await db.coin_type_config.get(coinType);
    if (cfg) {
        const sideMap = {"obv":"obv_image","rev":"rev_image","proof_obv":"proof_obv_image","proof_rev":"proof_rev_image"};
        const sideKey = sideMap[side] || "obv_image";
        await db.coin_type_config.update(coinType, { [sideKey]: null });
    }
    return { status: "success" };
}

export async function checkMasterLocal(coinType, side) {
    // In PWA, we assume standard master images are bundled at `/images/types/master/${coinType}_${side}.png`
    // We check type config overrides first
    const cfg = await db.coin_type_config.get(coinType);
    const sideKey = side === "obv" ? "obv_image" : "rev_image";
    
    if (cfg && cfg[sideKey]) {
        return { has_master: true, master_url: cfg[sideKey] };
    }
    return { has_master: false, master_url: null };
}

export async function promoteToDefaultLocal(coinType, side) {
    return { status: "success" };
}


export async function saveToCoinBankLocal(data) {
    const { coin_type, side, image, is_personal, tags } = data;
    if (!coin_type || !side || !image) {
        return { status: "error", message: "coin_type, side, and image are required" };
    }
    const validSides = ["obv", "rev", "proof_obv", "proof_rev"];
    const sideKey = validSides.includes(side) ? (side + "_image") : 
                    (side === "obv" ? "obv_image" : "rev_image");
    
    // Use group-aware logic: determine which members share this image
    const members = await _getCoimageGroupMembers(coin_type, side);
    for (const memberType of members) {
        let cfg = await db.coin_type_config.get(memberType);
        if (!cfg) {
            cfg = { coin_type: memberType, obv_image: null, rev_image: null, proof_obv_image: null, proof_rev_image: null };
            await db.coin_type_config.add(cfg);
        }
        await db.coin_type_config.update(memberType, { [sideKey]: image, ['_deleted_' + sideKey]: false });
    }
    return { status: "saved", filename: image };
}

export async function fetchCoinBankImagesLocal(params = {}) {
    var coin_type = params.get ? params.get('coin_type') : (params.coin_type || null);
    var side = params.get ? params.get('side') : (params.side || null);
    var q = params.get ? params.get('q') : (params.q || null);

    // On self-hosted: try fetching the server-authoritative Coin Bank list (scans filesystem + DB)
    try {
        const _native = window.__nativeFetch || window.fetch;
        if (typeof _native === 'function') {
            const search = new URLSearchParams();
            if (coin_type) search.set('coin_type', coin_type);
            if (side) search.set('side', side);
            if (q) search.set('q', q);
            const queryStr = search.toString() ? ('?' + search.toString()) : '';
            const res = await _native('/api/coin_bank_images' + queryStr);
            if (res && res.ok) {
                const serverImages = await res.json();
                if (Array.isArray(serverImages) && serverImages.length > 0) {
                    return serverImages.map(img => ({
                        coin_type: img.coin_type || '',
                        side: img.side || '',
                        filename: img.filename || '',
                        image: img.filename || '',
                        source: img.source || 'server'
                    }));
                }
            }
        }
    } catch (e) {
        // Fall back to local DB
    }

    // Local / Offline fallback
    const cfgs = coin_type 
        ? await db.coin_type_config.where('coin_type').equals(coin_type).toArray()
        : await db.coin_type_config.toArray();
    const result = [];
    cfgs.forEach(cfg => {
        // Skip dummy unverified default paths that don't exist on disk
        const isDummy = (url) => typeof url === 'string' && url.includes('_default_');
        if (!side || side === 'obv') {
            if (cfg.obv_image && !cfg._deleted_obv_image && !isDummy(cfg.obv_image)) {
                result.push({ coin_type: cfg.coin_type, side: 'obv', filename: cfg.obv_image, image: cfg.obv_image });
            }
        }
        if (!side || side === 'rev') {
            if (cfg.rev_image && !cfg._deleted_rev_image && !isDummy(cfg.rev_image)) {
                result.push({ coin_type: cfg.coin_type, side: 'rev', filename: cfg.rev_image, image: cfg.rev_image });
            }
        }
        if (!side || side === 'proof_obv') {
            if (cfg.proof_obv_image && !cfg._deleted_proof_obv_image && !isDummy(cfg.proof_obv_image)) {
                result.push({ coin_type: cfg.coin_type, side: 'proof_obv', filename: cfg.proof_obv_image, image: cfg.proof_obv_image });
            }
        }
        if (!side || side === 'proof_rev') {
            if (cfg.proof_rev_image && !cfg._deleted_proof_rev_image && !isDummy(cfg.proof_rev_image)) {
                result.push({ coin_type: cfg.coin_type, side: 'proof_rev', filename: cfg.proof_rev_image, image: cfg.proof_rev_image });
            }
        }
    });

    // Include per-coin uploaded images
    try {
        let coinRows = [];
        if (coin_type) {
            coinRows = await db.coins_reference.where('coin_type').equals(coin_type).toArray();
        } else {
            coinRows = await db.coins_reference.toArray();
        }
        const sideMap = { obv: 'obv_image', rev: 'rev_image' };
        for (const row of coinRows) {
            const want = side === 'obv' ? 'obv' : (side === 'rev' ? 'rev' : null);
            const checks = want ? [want] : ['obv', 'rev'];
            for (const sc of checks) {
                const val = row[sideMap[sc]];
                if (val && !val.includes('_default_')) {
                    result.push({
                        coin_type: row.coin_type,
                        side: sc,
                        filename: val,
                        image: val,
                        perCoin: true,
                    });
                }
            }
        }
    } catch (e) {
        console.warn('[coinBank] per-coin scan skipped:', e.message);
    }

    return result;
}

export async function deleteCoinBankImageLocal(filename) {
    // Find the record and null it.
    // Also set a _deleted_<field> flag so re-seed logic preserves the deletion.
    // The stored value is a FULL path (e.g. /data/images/types/x.webp) while the
    // caller may pass a basename (deleteCoinBankImage strips to basename before
    // calling), so compare on basename to guarantee a match either way.
    const norm = (val) => (val || '').split('/').pop().split(String.fromCharCode(92)).pop();
    const target = norm(filename);
    if (!target) return { status: "deleted" };
    const cfgs = await db.coin_type_config.toArray();
    const fields = ["obv_image","rev_image","proof_obv_image","proof_rev_image"];
    for (const cfg of cfgs) {
        for (const field of fields) {
            if (cfg[field] && norm(cfg[field]) === target) {
                const updates = { [field]: null };
                updates['_deleted_' + field] = true;
                await db.coin_type_config.update(cfg.coin_type, updates);
                console.log('[deleteCoinBankImage] Cleared ' + cfg.coin_type + '.' + field);
            }
        }
    }
    return { status: "deleted" };
}

export async function factoryResetImagesLocal() {
    // IMPORTANT: do NOT db.coin_type_config.clear() -- that empties the table and on the
    // next boot configCount===0 triggers a re-seed from type_configs.json, restoring every
    // image. Instead null every image field and set _deleted_<field> flags so the deletion
    // persists and the seed-merge logic (which honors _deleted_*) never re-adds them.
    const cfgs = await db.coin_type_config.toArray();
    const fields = ["obv_image", "rev_image", "proof_obv_image", "proof_rev_image"];
    for (const cfg of cfgs) {
        const updates = {};
        for (const f of fields) {
            if (cfg[f] !== undefined && cfg[f] !== null) {
                updates[f] = null;
                updates["_deleted_" + f] = true;
            }
        }
        if (Object.keys(updates).length) {
            await db.coin_type_config.update(cfg.coin_type, updates);
        }
    }
    console.log('[factoryReset] Nulled all coin_type_config images and set deletion flags.');
    // Nullify all inventory photos
    const items = await db.user_inventory.toArray();
    for (const item of items) {
        if (item.personal_photo) {
            await db.user_inventory.update(item.id, { personal_photo: null });
        }
    }
    return { status: "success" };
}

// ============================================================
// Portfolio History
// ============================================================

export async function fetchPortfolioHistoryLocal() {
    return db.portfolio_history.toArray();
}

export async function savePortfolioHistoryLocal(data) {
    const entry = {
        date: data.date || new Date().toISOString().split('T')[0],
        total_value: Number(data.total_value || 0.0),
        gold_spot: Number(data.gold_spot || 0.0),
        silver_spot: Number(data.silver_spot || 0.0),
        copper_spot: Number(data.copper_spot || 0.0),
        platinum_spot: Number(data.platinum_spot || 0.0),
        palladium_spot: Number(data.palladium_spot || 0.0),
        coin_count: Number(data.coin_count || 0)
    };
    const existing = await db.portfolio_history.where('date').equals(entry.date).first();
    if (existing) {
        await db.portfolio_history.update(existing.id, entry);
        return { ...entry, id: existing.id };
    } else {
        const id = await db.portfolio_history.add(entry);
        return { ...entry, id };
    }
}

export async function searchCoinsLocal(searchParams) {
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const missing = searchParams.get('missing_only') === '1';
    const noProofs = searchParams.get('hide_proofs') === '1';
    const noErrors = searchParams.get('hide_errors') === '1';
    const keyOnly = searchParams.get('key_dates_only') === '1';
    const sortMode = searchParams.get('sort') || 'default';
    const section = searchParams.get('section');
    const minYear = searchParams.get('min_year');
    const maxYear = searchParams.get('max_year');

    let coins = await db.coins_reference.toArray();
    const inventory = await db.user_inventory.toArray();
    const ownedMap = new Set(inventory.filter(inv => inv.quantity > 0).map(inv => inv.coin_ref_id));

    // Filter section
    if (section) {
        coins = coins.filter(c => c.section === section);
    }

    // Filter year range
    if (minYear) {
        const min = parseInt(minYear, 10);
        coins = coins.filter(c => c.year >= min);
    }
    if (maxYear) {
        const max = parseInt(maxYear, 10);
        coins = coins.filter(c => c.year <= max);
    }

    // Filter missing only
    if (missing) {
        coins = coins.filter(c => !ownedMap.has(c.id));
    }

    // Filter proofs
    if (noProofs) {
        coins = coins.filter(c => !c.is_proof);
    }

    // Filter errors
    if (noErrors) {
        coins = coins.filter(c => !c.is_error);
    }

    // Filter key dates
    if (keyOnly) {
        coins = coins.filter(c => c.is_key_date);
    }

    // Filter text query
    if (q) {
        coins = coins.filter(c => {
            if (c.year.toString() === q) return true;
            if (c.coin_type.toLowerCase().includes(q)) return true;
            if (c.denomination.toLowerCase().includes(q)) return true;
            if (c.mint_mark.toLowerCase().includes(q)) return true;
            if (c.ref_notes && c.ref_notes.toLowerCase().includes(q)) return true;
            return false;
        });
    }

    // Sorting
    if (sortMode === 'az') {
        coins.sort((a, b) => {
            if (a.coin_type !== b.coin_type) return a.coin_type.localeCompare(b.coin_type);
            if (a.year !== b.year) return a.year - b.year;
            return (a.mint_mark || '').localeCompare(b.mint_mark || '');
        });
    } else if (sortMode === 'completion') {
        coins.sort((a, b) => {
            const secDiff = sectionSortKey(a.section) - sectionSortKey(b.section);
            if (secDiff !== 0) return secDiff;
            if (a.coin_type !== b.coin_type) return a.coin_type.localeCompare(b.coin_type);
            if (a.year !== b.year) return a.year - b.year;
            return (a.mint_mark || '').localeCompare(b.mint_mark || '');
        });
    } else if (sortMode === 'value-desc') {
        const invMap = {};
        inventory.forEach(inv => {
            invMap[inv.coin_ref_id] = (inv.current_value || 0) * (inv.quantity || 0);
        });
        coins.sort((a, b) => {
            const valA = invMap[a.id] || 0;
            const valB = invMap[b.id] || 0;
            if (valB !== valA) return valB - valA;
            const secDiff = sectionSortKey(a.section) - sectionSortKey(b.section);
            if (secDiff !== 0) return secDiff;
            if (a.coin_type !== b.coin_type) return a.coin_type.localeCompare(b.coin_type);
            if (a.year !== b.year) return a.year - b.year;
            return (a.mint_mark || '').localeCompare(b.mint_mark || '');
        });
    } else { // default sort
        coins.sort((a, b) => {
            const secDiff = sectionSortKey(a.section) - sectionSortKey(b.section);
            if (secDiff !== 0) return secDiff;
            if (a.coin_type !== b.coin_type) return a.coin_type.localeCompare(b.coin_type);
            if (a.year !== b.year) return a.year - b.year;
            return (a.mint_mark || '').localeCompare(b.mint_mark || '');
        });
    }

    return coins.map(coin => ({
        ...coin,
        coin_id: coin.id,
        inventory: null
    }));
}

export async function fetchAllCoinsLocal() {
    const coins = await db.coins_reference.toArray();
    return coins.map(coin => ({
        ...coin,
        coin_id: coin.id,
        inventory: null
    }));
}

export async function savePricingRulesLocal(data) {
    const coinType = data.coin_type;
    let cfg = await db.coin_type_config.get(coinType);
    if (!cfg) {
        cfg = { coin_type: coinType, obv_image: null, rev_image: null, proof_obv_image: null, proof_rev_image: null };
        await db.coin_type_config.add(cfg);
    }
    const updates = {};
    if (data.base_price !== undefined) updates.base_price = Number(data.base_price);
    if (data.key_price !== undefined) updates.key_price = Number(data.key_price);
    await db.coin_type_config.update(coinType, updates);
    const updated = await db.coin_type_config.get(coinType);
    return { status: "updated", config: updated };
}

export async function getFullBackupLocal() {
    const backup = {};
    const tables = [
        'user_inventory',
        'coin_type_config',
        'bulk_inventory',
        'raw_bullion',
        'scrap_metal',
        'paper_currency',
        'other_collectable',
        'custom_category',
        'wishlist_item',
        'portfolio_history',
        'user_settings'
    ];
    for (const table of tables) {
        backup[table] = await db[table].toArray();
    }
    return backup;
}

export async function restoreBackupLocal(backupObj) {
    const tables = [
        'user_inventory',
        'coin_type_config',
        'bulk_inventory',
        'raw_bullion',
        'scrap_metal',
        'paper_currency',
        'other_collectable',
        'custom_category',
        'wishlist_item',
        'portfolio_history',
        'user_settings'
    ];
    for (const table of tables) {
        if (backupObj[table]) {
            await db[table].clear();
            await db[table].bulkAdd(backupObj[table]);
        }
    }
    return { status: "success" };
}

export async function renameCoinBankImageLocal(data) {
    const { filename, new_side } = data;
    const cfgs = await db.coin_type_config.toArray();
    const sideMap = {"obv":"obv_image","rev":"rev_image","proof_obv":"proof_obv_image","proof_rev":"proof_rev_image"};
    const fieldToSide = {"obv_image":"obv","rev_image":"rev","proof_obv_image":"proof_obv","proof_rev_image":"proof_rev"};
    for (const cfg of cfgs) {
        for (const [oldField, oldSide] of Object.entries(fieldToSide)) {
            if (cfg[oldField] === filename) {
                const newField = sideMap[new_side];
                if (newField && newField !== oldField) {
                    await db.coin_type_config.update(cfg.coin_type, { [oldField]: null, [newField]: filename });
                }
                break;
            }
        }
    }
    return { status: "renamed" };
}

export async function importCSVLocal(csvText) {
    const lines = csvText.split('\n');
    if (lines.length < 2) return { ok: true, imported: 0 };
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
    let imported = 0;
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index];
        });
        
        const coinRefId = Number(row.coin_ref_id || row.id);
        if (!coinRefId || isNaN(coinRefId)) continue;
        
        const qty = parseInt(row.quantity || 0, 10);
        
        const existing = await db.user_inventory.where('coin_ref_id').equals(coinRefId).first();
        if (existing) {
            if (qty <= 0) {
                await db.user_inventory.delete(existing.id);
            } else {
                await db.user_inventory.update(existing.id, {
                    quantity: qty,
                    grade: row.grade || '',
                    purchase_price: Number(row.purchase_price || 0),
                    current_value: Number(row.current_value || 0),
                    notes: row.notes || ''
                });
            }
        } else if (qty > 0) {
            await db.user_inventory.add({
                coin_ref_id: coinRefId,
                quantity: qty,
                grade: row.grade || '',
                purchase_price: Number(row.purchase_price || 0),
                current_value: Number(row.current_value || 0),
                notes: row.notes || '',
                personal_photo: null
            });
        }
        imported++;
    }
    return { ok: true, imported };
}

export async function publishSectionLocal(sectionName) {
    console.log('[db] publishSectionLocal called for:', sectionName);
    // Self-hosted detection: Tailscale MagicDNS hostname or LAN IP.
    const host = window.location.hostname || '';
    const isSelfHosted = host.includes('opaleye-bluegill') || host.includes('ts.net') || host.includes('192.168.');
    if (!isSelfHosted) {
        // Public/indexedDB version: stub — real publishing only works on self-hosted.
        return { status: 'ok', message: 'Publish request recorded locally. Use self-hosted backend for actual publishing.', section: sectionName };
    }
    // Self-hosted: call the real Flask backend. Use XMLHttpRequest so we bypass
    // the global fetch interceptor in api.js (which would otherwise swallow this
    // call and route it back here infinitely).
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/publish_section', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    resolve(JSON.parse(xhr.responseText));
                } catch (e) {
                    reject(new Error('Invalid JSON from publish API: ' + xhr.responseText));
                }
            } else {
                let detail = xhr.responseText || ('HTTP ' + xhr.status);
                try { detail = JSON.parse(xhr.responseText).error || detail; } catch (e) {}
                reject(new Error(detail));
            }
        };
        xhr.onerror = () => reject(new Error('Network error calling /api/publish_section'));
        xhr.send(JSON.stringify({ section: sectionName }));
    });
}

// ============================================================
// Photos & Documents Gallery — local (IndexedDB) persistence
// Used by the public build and as the offline cache on self-hosted.
// ============================================================

export async function fetchUserPhotosLocal() {
    const rows = await db.user_photos.orderBy('id').reverse().toArray();
    return rows;
}

export async function addUserPhotoLocal(photo) {
    // photo: { title, caption, category, image_data, created_at? }
    const row = {
        title: (photo.title || '').toString().slice(0, 200),
        caption: (photo.caption || '').toString(),
        category: (photo.category || 'General').toString().slice(0, 100),
        image_data: photo.image_data || '',
        created_at: photo.created_at || new Date().toISOString(),
    };
    const id = await db.user_photos.add(row);
    return { ...row, id };
}

export async function deleteUserPhotoLocal(id) {
    await db.user_photos.delete(Number(id));
    return { status: 'deleted', id: Number(id) };
}

// ============================================================
// User-added catalogue coins — local (IndexedDB) persistence
// A user coin is a real coins_reference row with user_added=true, so it
// sorts/counts/images exactly like seeded coins everywhere in the app.
// ============================================================

export async function addUserCoinLocal(coin) {
    // Find a sibling of the same section+type to inherit denomination/metal/weight.
    // NOTE: coins_reference has no compound [section+coin_type] index, so query by
    // section and filter in JS (small result set per section).
    const siblings = await db.coins_reference.where('section').equals(coin.section).toArray();
    const sibling = siblings.find(s => s.coin_type === coin.coin_type) || null;
    // coins_reference uses keyPath 'id' (not auto-increment), so we must supply one.
    // Server rows have positive IDs; use a negative ID for local user coins to avoid
    // any collision with synced server rows.
    const localId = -Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 1000);
    const row = {
        id: localId,
        section: coin.section,
        denomination: coin.denomination || (sibling && sibling.denomination) || '',
        coin_type: coin.coin_type,
        year: Number(coin.year) || 0,
        mint_mark: (coin.mint_mark || '').toString().slice(0, 10),
        metal: coin.metal || (sibling && sibling.metal) || '',
        weight_grams: Number(coin.weight_grams || 0) || (sibling && sibling.weight_grams) || 0,
        is_key_date: !!coin.is_key_date,
        is_proof: !!coin.is_proof,
        is_error: !!coin.is_error,
        mintage: null,
        ref_notes: (coin.ref_notes || '').toString(),
        obv_image: null,
        rev_image: null,
        _deleted_obv_image: false,
        _deleted_rev_image: false,
        user_added: true,
    };
    await db.coins_reference.add(row);
    return { ...row, id: localId };
}

export async function deleteUserCoinLocal(id) {
    const coin = await db.coins_reference.get(Number(id));
    if (!coin) return { status: 'not_found', id: Number(id) };
    if (!coin.user_added) {
        throw new Error('This coin is part of the master catalogue and cannot be deleted');
    }
    // Remove inventory rows that point at it so no orphans remain.
    await db.user_inventory.where('coin_ref_id').equals(Number(id)).delete();
    await db.coins_reference.delete(Number(id));
    return { status: 'deleted', id: Number(id) };
}
