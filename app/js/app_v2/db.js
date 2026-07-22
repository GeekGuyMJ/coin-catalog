/**
 * db.js — Coin Catalog v2 — Client-side database using Dexie.js
 * Mirrors the SQLite/PostgreSQL schema and handles offline storage.
 * @module db
 */

import Dexie from './dexie.js?v=4';

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
    // Check if we need to (re)seed — seed if empty, or if configs exist but have no images
    let needsSeed = configCount === 0;
    if (!needsSeed) {
        const sampleWithImg = await db.coin_type_config
            .filter(cfg => !!(cfg.obv_image || cfg.rev_image))
            .first();
        if (!sampleWithImg) {
            console.log('Type configs exist but have no images. Re-seeding from JSON...');
            needsSeed = true;
        }
    }
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
                // Only overwrite entries that don't already have a user-uploaded base64 image
                for (const cfg of chunk) {
                    const existing = await db.coin_type_config.get(cfg.coin_type);
                    if (!existing) {
                        await db.coin_type_config.add(cfg);
                    } else {
                        // Only update image fields if existing entry has no user-uploaded base64 images
                        const hasUserObv = existing.obv_image && existing.obv_image.startsWith('data:image');
                        const hasUserRev = existing.rev_image && existing.rev_image.startsWith('data:image');
                        const updates = {
                            base_price: cfg.base_price || existing.base_price || 0,
                            key_price: cfg.key_price || existing.key_price || 0,
                        };
                        if (!hasUserObv && cfg.obv_image) updates.obv_image = cfg.obv_image;
                        if (!hasUserRev && cfg.rev_image) updates.rev_image = cfg.rev_image;
                        await db.coin_type_config.update(cfg.coin_type, updates);
                    }
                }
            }
            console.log('Type configs seeding completed successfully!');
        } else {
            console.error('Failed to load type_configs.json:', response.status);
        }
    }
}

// ============================================================
// API Simulators
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
        if (a.coin_type !== b.coin_type) return a.coin_type.localeCompare(b.coin_type);
        if (a.year !== b.year) return a.year - b.year;
        return (a.mint_mark || '').localeCompare(b.mint_mark || '');
    });

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

export async function fetchInventoryLocal() {
    const rows = await db.user_inventory.toArray();
    const result = {};
    rows.forEach(row => {
        const key = String(row.coin_ref_id);
        if (!result[key]) result[key] = [];
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
            updates.personal_photo = data.personal_photo;
        }
        if (data.personal_photos !== undefined) {
            updates.personal_photo = data.personal_photos.filter(x => x).join(';');
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
        result[cfg.coin_type] = {
            obv_image: cfg.obv_image,
            rev_image: cfg.rev_image,
            proof_obv_image: cfg.proof_obv_image,
            proof_rev_image: cfg.proof_rev_image,
            base_price: cfg.base_price || 0,
            key_price: cfg.key_price || 0
        };
    });
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
        
        try {
            let resp;
            let controller = new AbortController();
            let timeoutId = setTimeout(() => controller.abort(), 4000);
            
            try {
                resp = await fetch(primaryUrl, { signal: controller.signal });
            } catch (e) {
                resp = null;
            }
            clearTimeout(timeoutId);

            if (!resp || !resp.ok) {
                // Try backup
                controller = new AbortController();
                timeoutId = setTimeout(() => controller.abort(), 4000);
                resp = await fetch(backupUrl, { signal: controller.signal });
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
            console.warn(`Failed to fetch ${symbol} live spot price, using fallback/cache.`);
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
        
        try {
            let resp;
            let controller = new AbortController();
            let timeoutId = setTimeout(() => controller.abort(), 6000);
            
            try { resp = await fetch(primaryUrl, { signal: controller.signal }); } catch (e) { resp = null; }
            clearTimeout(timeoutId);

            if (!resp || !resp.ok) {
                controller = new AbortController();
                timeoutId = setTimeout(() => controller.abort(), 6000);
                resp = await fetch(backupUrl, { signal: controller.signal });
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

export async function assignImageLocal(data) {
    const { coin_type, side, image, scope, item_id } = data;
    // For offline-first, images are saved directly as base64 strings in the DB
    if (scope === "all" || scope === "empty_only") {
        let cfg = await db.coin_type_config.get(coin_type);
        if (!cfg) {
            cfg = { coin_type, obv_image: null, rev_image: null, proof_obv_image: null, proof_rev_image: null };
            await db.coin_type_config.add(cfg);
        }
        
        const sideKey = side === "obv" ? "obv_image" : "rev_image";
        if (scope === "all" || !cfg[sideKey]) {
            await db.coin_type_config.update(coin_type, { [sideKey]: image });
        }
    } else if (scope === "specific_coin") {
        // Save to specific user inventory row
        const refId = Number(item_id);
        const inv = await db.user_inventory.where('coin_ref_id').equals(refId).first();
        if (inv) {
            await db.user_inventory.update(inv.id, { personal_photo: image });
        } else {
            await db.user_inventory.add({
                coin_ref_id: refId,
                quantity: 1,
                grade: "",
                purchase_price: 0,
                current_value: 0,
                notes: "",
                personal_photo: image
            });
        }
    }
    return { status: "success" };
}

export async function resetImageToMasterLocal(coinType, side) {
    // In local mode, resetting is simply deleting the type configuration for that side
    const cfg = await db.coin_type_config.get(coinType);
    if (cfg) {
        const sideKey = side === "obv" ? "obv_image" : "rev_image";
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

export async function fetchCoinBankImagesLocal(params = {}) {
    // Return all type configs that have any image (base64 or URL path).
    // Use 'filename' as the field name so images.js and catalog.js consumers work correctly.
    const cfgs = await db.coin_type_config.toArray();
    const result = [];
    cfgs.forEach(cfg => {
        if (cfg.obv_image) {
            result.push({
                coin_type: cfg.coin_type,
                side: 'obv',
                filename: cfg.obv_image,  // 'filename' is what images.js expects
                image: cfg.obv_image,     // keep 'image' for backward compat
                tier: cfg.obv_image.startsWith('data:image') ? 'user' : 'master'
            });
        }
        if (cfg.rev_image) {
            result.push({
                coin_type: cfg.coin_type,
                side: 'rev',
                filename: cfg.rev_image,
                image: cfg.rev_image,
                tier: cfg.rev_image.startsWith('data:image') ? 'user' : 'master'
            });
        }
    });
    return result;
}

export async function deleteCoinBankImageLocal(filename) {
    // Find the record and null it
    const cfgs = await db.coin_type_config.toArray();
    for (const cfg of cfgs) {
        if (cfg.obv_image === filename) {
            await db.coin_type_config.update(cfg.coin_type, { obv_image: null });
        }
        if (cfg.rev_image === filename) {
            await db.coin_type_config.update(cfg.coin_type, { rev_image: null });
        }
    }
    return { status: "deleted" };
}

export async function factoryResetImagesLocal() {
    await db.coin_type_config.clear();
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
    for (const cfg of cfgs) {
        if (cfg.obv_image === filename && new_side === 'rev') {
            await db.coin_type_config.update(cfg.coin_type, { obv_image: null, rev_image: filename });
            break;
        }
        if (cfg.rev_image === filename && new_side === 'obv') {
            await db.coin_type_config.update(cfg.coin_type, { rev_image: null, obv_image: filename });
            break;
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



