/**
 * api.js — Coin Catalog v2 — API layer.
 * 
 * Self-hosted (Tailscale/LAN): calls real Flask backend via fetch.
 * Public (GitHub Pages): uses local IndexedDB via the Offline-First interceptor.
 * 
 * Environment detected at module load by hostname.
 */

// ============================================================
// Environment detection
// ============================================================
const isSelfHosted = location.hostname.includes('opaleye-bluegill.ts.net') || 
                     location.hostname.includes('192.168.0.115') ||
                     location.hostname === 'localhost';

// ============================================================
// Imports
// ============================================================
import {
    fetchStatusLocal,
    fetchSectionsLocal,
    fetchCoinsForSectionLocal,
    fetchCoinLocal,
    fetchInventoryLocal,
    updateInventoryLocal,
    deleteInventoryEntryLocal,
    fetchTypeConfigsLocal,
    fetchSpotPricesLocal,
    fetchRawBullionLocal,
    saveRawBullionLocal,
    deleteRawBullionLocal,
    fetchScrapLocal,
    saveScrapLocal,
    deleteScrapLocal,
    fetchPortfolioHistoryLocal,
    fetchPortfolioLocal,
    fetchPaperCurrencyLocal,
    savePaperCurrencyLocal,
    deletePaperCurrencyLocal,
    fetchCustomCategoriesLocal,
    saveCustomCategoryLocal,
    deleteCustomCategoryLocal,
    fetchOtherCollectablesLocal,
    saveOtherCollectablesLocal,
    deleteOtherCollectableLocal,
    fetchWishlistLocal,
    saveWishlistLocal,
    addToWishlistLocal,
    removeFromWishlistLocal,
    updateWishlistItemLocal,
    fetchBulkCoinsLocal,
    saveBulkCoinsLocal,
    assignImageLocal,
    resetImageToMasterLocal,
    checkMasterLocal,
    promoteToDefaultLocal,
    fetchCoinBankImagesLocal,
    deleteCoinBankImageLocal,
    factoryResetImagesLocal,
    savePricingRulesLocal,
    searchCoinsLocal,
    fetchAllCoinsLocal,
    getFullBackupLocal,
    publishSectionLocal,
    restoreBackupLocal,
    renameCoinBankImageLocal,
    saveToCoinBankLocal,
    importCSVLocal,
    deleteBulkCoinsLocal,
    fetchSpotHistoryLocal
} from './db.js';

// ============================================================
// Helpers
// ============================================================
const wrap = (fn) => async (...args) => {
    try {
        return await fn(...args);
    } catch (e) {
        console.error("Local DB API Error:", e);
        throw e;
    }
};

const originalFetch = window.fetch;
window.__nativeFetch = originalFetch;

// Server-backed fetch for self-hosted
async function serverFetch(path, init) {
    const res = await originalFetch(path, init);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// ============================================================
// Exported API — delegates based on environment
// ============================================================

// Core catalog APIs
export const fetchCoinsForSection = wrap(fetchCoinsForSectionLocal);

export const fetchCoin = isSelfHosted
    ? async (coinId) => serverFetch('/api/coins/' + coinId)
    : wrap(fetchCoinLocal);

export const fetchInventory = isSelfHosted
    ? async () => serverFetch('/api/inventory')
    : wrap(fetchInventoryLocal);

export const updateInventory = isSelfHosted
    ? async (coinId, data) => serverFetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    : wrap(updateInventoryLocal);

export const deleteInventoryEntry = isSelfHosted
    ? async (entryId) => serverFetch('/api/inventory/' + entryId, { method: 'DELETE' })
    : wrap(deleteInventoryEntryLocal);

export const fetchTypeConfigs = isSelfHosted
    ? async () => {
        const data = await serverFetch('/api/pricing_rules');
        return data;
    }
    : wrap(fetchTypeConfigsLocal);

export const fetchBullion = isSelfHosted
    ? async () => serverFetch('/api/bullion')
    : wrap(fetchRawBullionLocal);

export const fetchSections = isSelfHosted
    ? async () => serverFetch('/api/coins/sections')
    : wrap(fetchSectionsLocal);

export const fetchStatus = isSelfHosted
    ? async () => serverFetch('/api/status')
    : wrap(fetchStatusLocal);

// Image APIs — assignImage already uses originalFetch (server-backed)
export const assignImage = async (data) => {
    const res = await originalFetch('/api/assign_image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data || {}),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { status: 'error', error: body.error || ('HTTP ' + res.status) };
    try { await assignImageLocal(data); } catch (_) { /* non-fatal */ }
    return { status: body.status || 'success', message: body.message, updated: body.updated };
};

export const fetchCoinBankImages = isSelfHosted
    ? async (params = {}) => {
        const search = params instanceof URLSearchParams ? params.toString() : new URLSearchParams(params).toString();
        return serverFetch('/api/coin_bank_images?' + search);
    }
    : wrap(fetchCoinBankImagesLocal);

// Local-only features (no server equivalent) - always use local DB
export const fetchSpotPrices       = wrap(fetchSpotPricesLocal);
export const fetchRawBullion       = isSelfHosted
    ? async () => serverFetch('/api/raw_bullion')
    : wrap(fetchRawBullionLocal);
export const saveRawBullion        = isSelfHosted
    ? async (data) => serverFetch('/api/raw_bullion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    : wrap(saveRawBullionLocal);
export const deleteRawBullion      = isSelfHosted
    ? async (id) => serverFetch('/api/raw_bullion/' + id, { method: 'DELETE' })
    : wrap(deleteRawBullionLocal);
export const fetchScrap            = wrap(fetchScrapLocal);
export const saveScrap             = wrap(saveScrapLocal);
export const deleteScrap           = wrap(deleteScrapLocal);
export const fetchPortfolioHistory = wrap(fetchPortfolioHistoryLocal);
export const fetchPortfolio        = wrap(fetchPortfolioLocal);
export const fetchPaperCurrency    = isSelfHosted
    ? async () => serverFetch('/api/paper_currency')
    : wrap(fetchPaperCurrencyLocal);
export const savePaperCurrency     = isSelfHosted
    ? async (data) => serverFetch('/api/paper_currency', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    : wrap(savePaperCurrencyLocal);
export const deletePaperCurrency   = isSelfHosted
    ? async (id) => serverFetch('/api/paper_currency/' + id, { method: 'DELETE' })
    : wrap(deletePaperCurrencyLocal);
export const fetchCustomCategories = isSelfHosted
    ? async () => serverFetch('/api/custom_categories')
    : wrap(fetchCustomCategoriesLocal);
export const saveCustomCategory    = isSelfHosted
    ? async (data) => serverFetch('/api/custom_categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    : wrap(saveCustomCategoryLocal);
export const deleteCustomCategory  = isSelfHosted
    ? async (name) => serverFetch('/api/custom_categories/' + encodeURIComponent(name), { method: 'DELETE' })
    : wrap(deleteCustomCategoryLocal);
export const fetchOtherCollectables= isSelfHosted
    ? async () => serverFetch('/api/other_collectables')
    : wrap(fetchOtherCollectablesLocal);
export const saveOtherCollectables = isSelfHosted
    ? async (data) => serverFetch('/api/other_collectables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    : wrap(saveOtherCollectablesLocal);
export const deleteOtherCollectable= isSelfHosted
    ? async (id) => serverFetch('/api/other_collectables/' + id, { method: 'DELETE' })
    : wrap(deleteOtherCollectableLocal);
export const fetchWishlist         = wrap(fetchWishlistLocal);
export const saveWishlist          = wrap(saveWishlistLocal);
export const addToWishlist         = wrap(addToWishlistLocal);
export const removeFromWishlist    = wrap(removeFromWishlistLocal);
export const updateWishlistItem    = wrap(updateWishlistItemLocal);
export const fetchBulkCoins        = wrap(fetchBulkCoinsLocal);
export const saveBulkCoins         = wrap(saveBulkCoinsLocal);
export const fetchBulkEntries      = async () => ({ entries: await fetchBulkCoinsLocal() });
export const addBulkEntry          = wrap(saveBulkCoinsLocal);
export const deleteBulkEntry       = wrap(deleteBulkCoinsLocal);
export const fetchCoinWeight       = async () => [];
export const saveCoinWeight        = async () => ({});
export const deleteCoinWeight      = async () => ({});

export const fetchSpotHistory      = wrap(fetchSpotHistoryLocal);
export const fetchAllCoins         = wrap(fetchAllCoinsLocal);
export const getFullBackup         = wrap(getFullBackupLocal);
export const publishSection        = wrap(publishSectionLocal);
export const restoreBackup         = wrap(restoreBackupLocal);
export const saveToCoinBank        = wrap(saveToCoinBankLocal);
export const importCSV             = wrap(importCSVLocal);
export const deleteBulkCoins       = wrap(deleteBulkCoinsLocal);
export const resetImageToMaster    = wrap(resetImageToMasterLocal);
export const checkMaster           = wrap(checkMasterLocal);
export const promoteToDefault      = wrap(promoteToDefaultLocal);
export const deleteCoinBankImage = isSelfHosted
    ? async (filename) => serverFetch('/api/coin_bank_images/' + filename.replace(/^\//, ''), {
        method: 'DELETE'
    })
    : wrap(deleteCoinBankImageLocal);
export const factoryResetImages    = wrap(factoryResetImagesLocal);
export const savePricingRules      = wrap(savePricingRulesLocal);
export const searchCoins           = wrap(searchCoinsLocal);
export const updateCoinBankImageInfo = isSelfHosted
    ? async (data) => serverFetch('/api/coin_bank_images/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    : wrap(renameCoinBankImageLocal);
export const renameCoinBankImage = isSelfHosted
    ? async (data) => serverFetch('/api/coin_bank_images/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    : wrap(renameCoinBankImageLocal);

// ============================================================
// Offline-First Interceptor (PUBLIC BUILD ONLY)
// ============================================================
if (!isSelfHosted) {
    // Import all local handlers for the interceptor
    const {
        fetchStatusLocal, fetchSectionsLocal, fetchCoinsForSectionLocal, fetchCoinLocal,
        fetchInventoryLocal, updateInventoryLocal, deleteInventoryEntryLocal,
        fetchTypeConfigsLocal, fetchSpotPricesLocal, fetchRawBullionLocal, saveRawBullionLocal,
        deleteRawBullionLocal, fetchScrapLocal, saveScrapLocal, deleteScrapLocal,
        fetchPortfolioHistoryLocal, fetchPortfolioLocal, fetchPaperCurrencyLocal,
        savePaperCurrencyLocal, deletePaperCurrencyLocal, fetchCustomCategoriesLocal,
        saveCustomCategoryLocal, deleteCustomCategoryLocal, fetchOtherCollectablesLocal,
        saveOtherCollectablesLocal, deleteOtherCollectableLocal, fetchWishlistLocal,
        saveWishlistLocal, addToWishlistLocal, removeFromWishlistLocal, updateWishlistItemLocal,
        fetchBulkCoinsLocal, saveBulkCoinsLocal, assignImageLocal, resetImageToMasterLocal,
        checkMasterLocal, promoteToDefaultLocal, fetchCoinBankImagesLocal, deleteCoinBankImageLocal,
        factoryResetImagesLocal, savePricingRulesLocal, searchCoinsLocal, fetchAllCoinsLocal,
        getFullBackupLocal, publishSectionLocal, restoreBackupLocal, renameCoinBankImageLocal,
        saveToCoinBankLocal, importCSVLocal, deleteBulkCoinsLocal, fetchSpotHistoryLocal
    } = await import('./db.js');

    async function handleInterceptedRequest(apiPart, init) {
        let urlStr = apiPart;
        const method = (init && init.method) || 'GET';
        let body = init && init.body ? JSON.parse(init.body) : null;
        let rawBody = init && init.body ? init.body : null;
        let status = 200;
        let data;

        try {
            const url = new URL('/' + urlStr, 'http://localhost');
            const path = url.pathname;

            if (path === '/api/status') { data = await fetchStatusLocal(); }
            else if (path === '/api/coins/sections') { data = await fetchSectionsLocal(); }
            else if (path === '/api/coins') { data = await fetchCoinsForSectionLocal(url.searchParams.get('section') || ''); }
            else if (path.startsWith('/api/coins/')) { data = await fetchCoinLocal(path.substring('/api/coins/'.length)); }
            else if (path === '/api/inventory') {
                if (method === 'POST') { data = await updateInventoryLocal(body); }
                else { data = await fetchInventoryLocal(); }
            }
            else if (path.startsWith('/api/inventory/')) {
                const id = path.substring('/api/inventory/'.length);
                if (method === 'DELETE') { data = await deleteInventoryEntryLocal(id); }
                else { data = await updateInventoryLocal(id, body); }
            }
            else if (path === '/api/type_configs') { data = await fetchTypeConfigsLocal(); }
            else if (path === '/api/spot_prices') { data = await fetchSpotPricesLocal(); }
            else if (path === '/api/bullion' || path === '/api/raw_bullion') {
                if (method === 'POST') { data = await saveRawBullionLocal(body); }
                else { data = await fetchRawBullionLocal(); }
            }
            else if (path.startsWith('/api/raw_bullion/')) { data = await deleteRawBullionLocal(path.substring('/api/raw_bullion/'.length)); }
            else if (path === '/api/scrap') {
                if (method === 'POST') { data = await saveScrapLocal(body); }
                else { data = await fetchScrapLocal(); }
            }
            else if (path.startsWith('/api/scrap/')) { data = await deleteScrapLocal(path.substring('/api/scrap/'.length)); }
            else if (path === '/api/spot_history') { data = await fetchSpotHistoryLocal(url.searchParams.get('period')); }
            else if (path === '/api/portfolio/history') { data = await fetchPortfolioHistoryLocal(); }
            else if (path === '/api/portfolio') { data = await fetchPortfolioLocal(); }
            else if (path === '/api/paper_currency') {
                if (method === 'POST') { data = await savePaperCurrencyLocal(body); }
                else { data = await fetchPaperCurrencyLocal(); }
            }
            else if (path.startsWith('/api/paper_currency/')) { data = await deletePaperCurrencyLocal(path.substring('/api/paper_currency/'.length)); }
            else if (path === '/api/custom_categories') { data = await fetchCustomCategoriesLocal(); }
            else if (path === '/api/other_collectables') {
                if (method === 'POST') { data = await saveOtherCollectablesLocal(body); }
                else { data = await fetchOtherCollectablesLocal(); }
            }
            else if (path.startsWith('/api/other_collectables/')) { data = await deleteOtherCollectableLocal(path.substring('/api/other_collectables/'.length)); }
            else if (path === '/api/wishlist') {
                if (method === 'POST') {
                    if (body.coin_id) { data = await addToWishlistLocal(body.coin_id); }
                    else { data = await saveWishlistLocal(body); }
                } else { data = await fetchWishlistLocal(); }
            }
            else if (path.startsWith('/api/wishlist/coin/')) { data = await removeFromWishlistLocal(path.substring('/api/wishlist/coin/'.length)); }
            else if (path.startsWith('/api/wishlist/')) { data = await updateWishlistItemLocal(path.substring('/api/wishlist/'.length), body); }
            else if (path === '/api/bulk_coins') {
                if (method === 'POST') { data = await saveBulkCoinsLocal(body); }
                else { data = await fetchBulkCoinsLocal(); }
            }
            else if (path === '/api/bulk_coins/entries') {
                if (method === 'POST') { data = await saveBulkCoinsLocal(body); }
                else { data = { entries: await fetchBulkCoinsLocal() }; }
            }
            else if (path.startsWith('/api/bulk_coins/entries/')) { data = await deleteBulkCoinsLocal(path.substring('/api/bulk_coins/entries/'.length)); }
            else if (path === '/api/assign_image') { data = await assignImageLocal(body); }
            else if (path === '/api/reset_image_to_master') { data = await resetImageToMasterLocal(body.coin_type, body.side); }
            else if (path === '/api/factory_reset_images') { data = await factoryResetImagesLocal(); }
            else if (path === '/api/has_master') { data = await checkMasterLocal(url.searchParams.get('coin_type'), url.searchParams.get('side')); }
            else if (path === '/api/promote_to_default') { data = await promoteToDefaultLocal(body.coin_type, body.side); }
            else if (path === '/api/publish_section') { data = await publishSectionLocal(body.section); }
            else if (path === '/api/coin_bank_images') { data = await fetchCoinBankImagesLocal(url.searchParams); }
            else if (path === '/api/coin_bank_images/rename') { data = await renameCoinBankImageLocal(body); }
            else if (path.startsWith('/api/coin_bank_images/')) { data = await deleteCoinBankImageLocal(path.substring('/api/coin_bank_images/'.length)); }
            else if (path === '/api/backup/full') { data = await getFullBackupLocal(); }
            else if (path === '/api/backup/restore') { data = await restoreBackupLocal(body); }
            else if (path === '/api/backup/import_csv') { data = await importCSVLocal(rawBody); }
            else if (path === '/api/backup/zip_restore') { status = 400; data = { error: "ZIP restore is legacy backend only. Please use JSON restore." }; }
            else {
                // LOCAL-FIRST FIX (2026-08-24): on the public (local-first) build there is
                // no backend, so any unmatched /api/* route resolves to a clean local 404
                // JSON instead of hitting the real network. This removes the spurious 404
                // console errors for self-hosted-only features such as /api/upload and
                // /api/pricing_rules while keeping every caller's .then(r => r.json())
                // error-handling intact.
                console.debug(`Local API Interceptor: unmatched route on local build: [${method}] ${path}`);
                status = 404; data = { error: "Route not available in local mode" };
            }
        } catch (err) {
            console.error(`Local API Interceptor Exception at ${path}:`, err);
            status = 500; data = { error: err.message };
        }
        return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    }

    window.fetch = async function(input, init) {
        let urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
        if (urlStr.startsWith('/api/') || urlStr.includes('/api/')) {
            let apiPart = urlStr.substring(urlStr.indexOf('/api/'));
            return handleInterceptedRequest(apiPart, init);
        }
        return originalFetch.apply(this, arguments);
    };
    console.log('Offline-First API Interceptor loaded (public build) — overriding window.fetch.');
} else {
    console.log('Self-hosted instance detected — API calls go directly to server (interceptor disabled).');
}