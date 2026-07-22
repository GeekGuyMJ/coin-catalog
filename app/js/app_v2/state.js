/**
 * state.js — Coin Catalog v2
 *
 * Single source of truth for all application state.
 *
 * Rules:
 *  - No module reads state directly from another module's local variables.
 *  - All reads go through State.get*() getters.
 *  - All writes go through State.set*() / State.update*() setters.
 *  - Subscribers are notified via the onChange() mechanism.
 *
 * @module state
 */

// ============================================================
// Internal state store (private to this module)
// ============================================================

import { deleteInventoryEntry } from "./api.js";

const _state = {
    /** @type {Array<{section:string, total:number, owned:number}>} */
    sections: [],

    /**
     * Coins by section — loaded lazily on accordion expand.
     * @type {Object.<string, Array>}
     */
    coinsBySection: {},

    /**
     * User inventory keyed by coin_ref_id (as a string).
     * @type {Object.<string, Array<{id:number, quantity:number, grade:string, purchase_price:number, current_value:number, date_acquired:string, notes:string, personal_photo:string|null}>>}
     */
    inventory: {},

    /**
     * Coin type configs (images + pricing) keyed by coin_type.
     * @type {Object.<string, {obv_image:string|null, rev_image:string|null, base_price:number, key_price:number}>}
     */
    typeConfigs: {},

    /**
     * Live metal spot prices.
     * @type {{gold_oz:number, silver_oz:number, copper_lb:number, platinum_oz:number, palladium_oz:number}}
     */
    spotPrices: {
        gold_oz: 0, silver_oz: 0, copper_lb: 0, platinum_oz: 0, palladium_oz: 0,
    },

    /** @type {string} Current search query. */
    searchQuery: '',

    /** @type {boolean} If true, only show coins the user does NOT own. */
    filterMissingOnly: localStorage.getItem('cc-filter-missing-only') === 'true',

    /** @type {boolean} If true, hide proof coins. */
    filterHideProofs: localStorage.getItem('cc-hide-proofs') === 'true',

    /** @type {boolean} If true, hide error/variety coins. */
    filterHideErrors: localStorage.getItem('cc-hide-errors') === 'true',

    /** @type {boolean} If true, show only key date coins. */
    filterKeyDatesOnly: localStorage.getItem('cc-key-dates-only') === 'true',

    /** @type {string} Catalogue sort mode: 'default'|'az'|'value-desc'|'completion' */
    sortMode: localStorage.getItem('cc-sort') || 'default',

    /** @type {number|null} Minimum year filter (inclusive). */
    minYear: null,

    /** @type {number|null} Maximum year filter (inclusive). */
    maxYear: null,

    /** @type {boolean} True while the initial data load is in progress. */
    loading: true,
};

// ============================================================
// Subscriber system (simple pub/sub)
// ============================================================

/** @type {Map<string, Set<Function>>} */
const _subscribers = new Map();

/**
 * Subscribe to state changes on a specific key.
 *
 * @param {string}   key - State key to watch (e.g. 'inventory').
 * @param {Function} fn  - Callback invoked with the new value.
 * @returns {Function} Unsubscribe function.
 */
export function onChange(key, fn) {
    if (!_subscribers.has(key)) _subscribers.set(key, new Set());
    _subscribers.get(key).add(fn);
    return () => _subscribers.get(key)?.delete(fn);
}

function _notify(key, value) {
    _subscribers.get(key)?.forEach(fn => fn(value));
}

// ============================================================
// Sections
// ============================================================

/** @returns {Array} All section summary objects. */
export function getSections()                  { return _state.sections; }

/** @param {Array} sections */
export function setSections(sections) {
    _state.sections = sections;
    _notify('sections', sections);
}

/**
 * Update the owned count for a single section (after an inventory change).
 *
 * @param {string} sectionName
 * @param {number} delta - Amount to add (can be negative).
 */
export function adjustSectionOwnedCount(sectionName, delta) {
    const sec = _state.sections.find(s => s.section === sectionName);
    if (sec) {
        sec.owned = Math.max(0, (sec.owned || 0) + delta);
        _notify('sections', _state.sections);
    }
}

// ============================================================
// Coins (per section, lazy)
// ============================================================

/**
 * Get loaded coins for a section, or null if not yet loaded.
 *
 * @param {string} section
 * @returns {Array|null}
 */
export function getCoinsForSection(section) {
    return _state.coinsBySection[section] ?? null;
}

/**
 * Store loaded coins for a section.
 *
 * @param {string} section
 * @param {Array}  coins
 */
export function setCoinsForSection(section, coins) {
    _state.coinsBySection[section] = coins;
    _notify('coins:' + section, coins);
}

// ============================================================
// Inventory
// ============================================================

/** @returns {Object} Full inventory map. */
export function getInventory()               { return _state.inventory; }

/**
 * Get inventory entries for one coin.
 *
 * @param {number|string} coinRefId
 * @returns {Array|null} Array of entry objects or null.
 */
export function getInventoryEntries(coinRefId) {
    const list = _state.inventory[String(coinRefId)];
    return list && list.length > 0 ? list : null;
}

/**
 * Get total owned quantity for one coin across all its entries.
 *
 * @param {number|string} coinRefId
 * @returns {number}
 */
export function getInventoryTotalQty(coinRefId) {
    const list = _state.inventory[String(coinRefId)];
    if (!list) return 0;
    return list.reduce((sum, item) => sum + (item.quantity || 0), 0);
}

/** @param {Object} inventory - Full inventory map from the API. */
export function setInventory(inventory) {
    _state.inventory = inventory;
    _notify('inventory', inventory);
}

/**
 * Update or remove the entire list of inventory entries for a coin.
 *
 * @param {number|string} coinRefId
 * @param {Array|null}    entries - Array of new entries, or null to remove.
 */
export function setInventoryEntries(coinRefId, entries) {
    const key = String(coinRefId);
    if (entries && entries.length > 0) {
        _state.inventory[key] = entries;
    } else {
        delete _state.inventory[key];
    }
    _notify('inventory', _state.inventory);
    _notify('inventory:' + key, entries);
}

// ============================================================
// Type configs
// ============================================================

/** @returns {Object} Full typeConfigs map. */
export function getTypeConfigs()             { return _state.typeConfigs; }

/**
 * Get config for a specific coin type.
 *
 * @param {string} coinType
 * @returns {Object|null}
 */
export function getTypeConfig(coinType)      { return _state.typeConfigs[coinType] ?? null; }

/** @param {Object} configs */
export function setTypeConfigs(configs) {
    _state.typeConfigs = configs;
    _notify('typeConfigs', configs);
}

// ============================================================
// Spot prices
// ============================================================

/** @returns {Object} Current spot prices. */
export function getSpotPrices()              { return _state.spotPrices; }

/** @param {Object} prices */
export function setSpotPrices(prices) {
    _state.spotPrices = prices;
    _notify('spotPrices', prices);
}

// ============================================================
// Search & filters
// ============================================================

/** @returns {string} */
export function getSearchQuery()             { return _state.searchQuery; }

/** @param {string} q */
export function setSearchQuery(q) {
    _state.searchQuery = q;
    _notify('filter', null);
}

/** @returns {boolean} */
export function getFilterMissingOnly()       { return _state.filterMissingOnly; }
export function toggleFilterMissingOnly() {
    _state.filterMissingOnly = !_state.filterMissingOnly;
    _notify('filter', null);
}

/** @returns {boolean} */
export function getFilterHideProofs()        { return _state.filterHideProofs; }
export function toggleFilterHideProofs() {
    _state.filterHideProofs = !_state.filterHideProofs;
    _notify('filter', null);
}

/** @returns {boolean} */
export function getFilterHideErrors()        { return _state.filterHideErrors; }
export function toggleFilterHideErrors() {
    _state.filterHideErrors = !_state.filterHideErrors;
    _notify('filter', null);
}

/** @returns {boolean} */
export function getFilterKeyDatesOnly()      { return _state.filterKeyDatesOnly; }
export function toggleFilterKeyDatesOnly() {
    _state.filterKeyDatesOnly = !_state.filterKeyDatesOnly;
    _notify('filter', null);
}

/** @returns {string} */
export function getSortMode()                { return _state.sortMode; }

/** @param {string} mode */
export function setSortMode(mode) {
    _state.sortMode = mode;
    localStorage.setItem('cc-sort', mode);
    _notify('sortMode', mode);
}

/** @returns {number|null} */
export function getMinYear() { return _state.minYear; }

/** @param {number|null} year */
export function setMinYear(year) {
    _state.minYear = year;
    _notify('filter', null);
}

/** @returns {number|null} */
export function getMaxYear() { return _state.maxYear; }

/** @param {number|null} year */
export function setMaxYear(year) {
    _state.maxYear = year;
    _notify('filter', null);
}

// ============================================================
// Loading state
// ============================================================

/** @returns {boolean} */
export function isLoading()                  { return _state.loading; }

/** @param {boolean} val */
export function setLoading(val) {
    _state.loading = val;
    _notify('loading', val);
}

// ---- Wishlist State ----
let _wishlist = [];
export const getWishlist = () => _wishlist;
export const setWishlist = (v) => { _wishlist = v; _notify('wishlist', v); };

// ---- Bullion State ----
let _bullion = {};
export const getBullion = () => _bullion;
export const setBullion = (v) => { _bullion = v; };

// ---- Raw Bullion State ----
let _rawBullion = [];
export const getRawBullion = () => _rawBullion;
export const setRawBullion = (v) => { _rawBullion = v; };

// ---- Coin Weight State ----
let _coinWeight = [];
export const getCoinWeight = () => _coinWeight;
export const setCoinWeight = (v) => { _coinWeight = v; };

// ---- Scrap Metal State ----
let _scrapMetal = {};
export const getScrapMetal = () => _scrapMetal;
export const setScrapMetal = (v) => { _scrapMetal = v; };



// ---- Paper Currency State ----
let _paperCurrency = [];
export const getPaperCurrency = () => _paperCurrency;
export const setPaperCurrency = (v) => { _paperCurrency = v; };

// ---- Custom Categories State ----
let _customCategories = [];
export const getCustomCategories = () => _customCategories;
export const setCustomCategories = (v) => { _customCategories = v; };

// ---- Other Collectables State ----
let _otherCollectables = [];
export const getOtherCollectables = () => _otherCollectables;
export const setOtherCollectables = (v) => { _otherCollectables = v; };


// ---- Purge All Inventory ----
/**
 * Purge ALL inventory entries from the database and reset local state.
 * Walks every coin key in the inventory map and deletes each entry.
 */
export async function purgeUserInventoryTables() {
    const inv = getInventory();
    const ids = [];
    for (const key of Object.keys(inv)) {
        const entries = inv[key];
        if (entries && Array.isArray(entries)) {
            for (const entry of entries) {
                if (entry && entry.id) ids.push(entry.id);
            }
        }
    }
    await Promise.all(ids.map(id => deleteInventoryEntry(id)));
    setInventory({});
}
