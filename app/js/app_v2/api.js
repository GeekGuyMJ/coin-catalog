/**
 * api.js — Coin Catalog v2 — Local IndexedDB simulated API layer.
 * Intercepts all network fetch requests to /api/* and processes them locally.
 * @module api
 */

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
    restoreBackupLocal,
    renameCoinBankImageLocal,
    importCSVLocal,
    deleteBulkCoinsLocal,
    fetchSpotHistoryLocal
} from './db.js?v=4';

// Helper wrapper for the exported modules
const wrap = (fn) => async (...args) => {
    try {
        return await fn(...args);
    } catch (e) {
        console.error("Local DB API Error:", e);
        throw e;
    }
};

export const fetchStatus          = wrap(fetchStatusLocal);
export const fetchSections        = wrap(fetchSectionsLocal);
export const fetchCoinsForSection = wrap(fetchCoinsForSectionLocal);
export const fetchCoin            = wrap(fetchCoinLocal);
export const fetchInventory       = wrap(fetchInventoryLocal);
export const fetchTypeConfigs     = wrap(fetchTypeConfigsLocal);
export const fetchSpotPrices      = wrap(fetchSpotPricesLocal);
export const updateInventory      = wrap(updateInventoryLocal);
export const deleteInventoryEntry = wrap(deleteInventoryEntryLocal);
export const assignImage          = wrap(assignImageLocal);

export const fetchBullion          = wrap(fetchRawBullionLocal);
export const saveBullion           = wrap(saveRawBullionLocal);
export const fetchRawBullion       = wrap(fetchRawBullionLocal);
export const saveRawBullion        = wrap(saveRawBullionLocal);
export const deleteRawBullion      = wrap(deleteRawBullionLocal);
export const fetchScrap            = wrap(fetchScrapLocal);
export const saveScrap             = wrap(saveScrapLocal);
export const deleteScrap           = wrap(deleteScrapLocal);

export const fetchPortfolioHistory = wrap(fetchPortfolioHistoryLocal);
export const fetchPortfolio        = wrap(fetchPortfolioLocal);

export const fetchPaperCurrency     = wrap(fetchPaperCurrencyLocal);
export const savePaperCurrency      = wrap(savePaperCurrencyLocal);
export const deletePaperCurrency    = wrap(deletePaperCurrencyLocal);

export const fetchCustomCategories  = wrap(fetchCustomCategoriesLocal);
export const saveCustomCategory     = wrap(saveCustomCategoryLocal);
export const deleteCustomCategory   = wrap(deleteCustomCategoryLocal);

export const fetchOtherCollectables = wrap(fetchOtherCollectablesLocal);
export const saveOtherCollectables  = wrap(saveOtherCollectablesLocal);
export const deleteOtherCollectable = wrap(deleteOtherCollectableLocal);

export const fetchWishlist          = wrap(fetchWishlistLocal);
export const saveWishlist           = wrap(saveWishlistLocal);
export const addToWishlist          = wrap(addToWishlistLocal);
export const removeFromWishlist     = wrap(removeFromWishlistLocal);
export const updateWishlistItem     = wrap(updateWishlistItemLocal);

export const fetchBulkCoins         = wrap(fetchBulkCoinsLocal);
export const saveBulkCoins          = wrap(saveBulkCoinsLocal);

export const fetchBulkEntries      = async () => ({ entries: await fetchBulkCoinsLocal() });
export const addBulkEntry          = wrap(saveBulkCoinsLocal);
export const deleteBulkEntry       = wrap(deleteBulkCoinsLocal);
export const fetchCoinWeight        = async () => [];
export const saveCoinWeight         = async () => ({});
export const deleteCoinWeight       = async () => ({});

export const fetchCoinBankImages    = wrap(fetchCoinBankImagesLocal);
export const deleteCoinBankImage    = wrap(deleteCoinBankImageLocal);
export const updateCoinBankImageInfo = async () => ({});
export const saveToCoinBank         = async () => ({});
export const resetImageToMaster     = wrap(resetImageToMasterLocal);
export const factoryResetImages     = wrap(factoryResetImagesLocal);
export const checkMaster            = wrap(checkMasterLocal);
export const promoteToDefault       = wrap(promoteToDefaultLocal);

// ============================================================
// Global Network Fetch Interceptor
// ============================================================

async function handleInterceptedRequest(urlStr, init) {
    const url = new URL(urlStr, window.location.origin);
    const path = url.pathname;
    const method = (init && init.method || 'GET').toUpperCase();
    
    let body = {};
    let rawBody = '';
    if (init && init.body) {
        if (typeof init.body === 'string') {
            rawBody = init.body;
            try {
                body = JSON.parse(init.body);
            } catch (e) {
                // Not JSON (e.g. CSV text)
            }
        }
    }

    let data = null;
    let status = 200;

    try {
        if (path === '/api/status') {
            data = fetchStatusLocal();
        } 
        
        else if (path === '/api/coins/sections') {
            data = await fetchSectionsLocal();
        } 
        
        else if (path === '/api/coins') {
            if (url.searchParams.get('q') || url.searchParams.get('missing_only') === '1' || url.searchParams.get('hide_proofs') === '1' || url.searchParams.get('hide_errors') === '1' || url.searchParams.get('key_dates_only') === '1') {
                data = await searchCoinsLocal(url.searchParams);
            } else if (url.searchParams.get('section')) {
                data = await fetchCoinsForSectionLocal(url.searchParams.get('section'));
            } else {
                data = await fetchAllCoinsLocal();
            }
        } 
        
        else if (path.startsWith('/api/coins/')) {
            const id = path.substring('/api/coins/'.length);
            data = await fetchCoinLocal(id);
        } 
        
        else if (path === '/api/inventory') {
            if (method === 'POST') {
                data = await updateInventoryLocal(body.coin_ref_id, body);
            } else {
                data = await fetchInventoryLocal();
            }
        } 
        
        else if (path.startsWith('/api/inventory/')) {
            const id = path.substring('/api/inventory/'.length);
            data = await deleteInventoryEntryLocal(id);
        } 
        
        else if (path === '/api/pricing_rules') {
            if (method === 'POST') {
                data = await savePricingRulesLocal(body);
            } else {
                data = await fetchTypeConfigsLocal();
            }
        } 
        
        else if (path === '/api/spot_prices') {
            data = await fetchSpotPricesLocal();
        } 
        
        else if (path === '/api/bullion' || path === '/api/raw_bullion') {
            if (method === 'POST') {
                data = await saveRawBullionLocal(body);
            } else {
                data = await fetchRawBullionLocal();
            }
        } 
        
        else if (path.startsWith('/api/raw_bullion/')) {
            const id = path.substring('/api/raw_bullion/'.length);
            data = await deleteRawBullionLocal(id);
        } 
        
        else if (path === '/api/scrap') {
            if (method === 'POST') {
                data = await saveScrapLocal(body);
            } else {
                data = await fetchScrapLocal();
            }
        } 
        
        else if (path.startsWith('/api/scrap/')) {
            const id = path.substring('/api/scrap/'.length);
            data = await deleteScrapLocal(id);
        } 
        
        else if (path === '/api/spot_history') {
            const period = url.searchParams.get('period');
            data = await fetchSpotHistoryLocal(period);
        } 
        
        else if (path === '/api/portfolio/history') {
            data = await fetchPortfolioHistoryLocal();
        } 
        
        else if (path === '/api/portfolio') {
            data = await fetchPortfolioLocal();
        } 
        
        else if (path === '/api/paper_currency') {
            if (method === 'POST') {
                data = await savePaperCurrencyLocal(body);
            } else {
                data = await fetchPaperCurrencyLocal();
            }
        } 
        
        else if (path.startsWith('/api/paper_currency/')) {
            const id = path.substring('/api/paper_currency/'.length);
            data = await deletePaperCurrencyLocal(id);
        } 
        
        else if (path === '/api/custom_categories') {
            data = await fetchCustomCategoriesLocal();
        } 
        
        else if (path === '/api/other_collectables') {
            if (method === 'POST') {
                data = await saveOtherCollectablesLocal(body);
            } else {
                data = await fetchOtherCollectablesLocal();
            }
        } 
        
        else if (path.startsWith('/api/other_collectables/')) {
            const id = path.substring('/api/other_collectables/'.length);
            data = await deleteOtherCollectableLocal(id);
        } 
        
        else if (path === '/api/wishlist') {
            if (method === 'POST') {
                if (body.coin_id) {
                    data = await addToWishlistLocal(body.coin_id);
                } else {
                    data = await saveWishlistLocal(body);
                }
            } else {
                data = await fetchWishlistLocal();
            }
        } 
        
        else if (path.startsWith('/api/wishlist/coin/')) {
            const coinId = path.substring('/api/wishlist/coin/'.length);
            data = await removeFromWishlistLocal(coinId);
        } 
        
        else if (path.startsWith('/api/wishlist/')) {
            const itemId = path.substring('/api/wishlist/'.length);
            data = await updateWishlistItemLocal(itemId, body);
        } 
        
        else if (path === '/api/bulk_coins') {
            if (method === 'POST') {
                data = await saveBulkCoinsLocal(body);
            } else {
                data = await fetchBulkCoinsLocal();
            }
        } 
        
        else if (path === '/api/bulk_coins/entries') {
            if (method === 'POST') {
                data = await saveBulkCoinsLocal(body);
            } else {
                data = { entries: await fetchBulkCoinsLocal() };
            }
        }
        
        else if (path.startsWith('/api/bulk_coins/entries/')) {
            const entryId = path.substring('/api/bulk_coins/entries/'.length);
            data = await deleteBulkCoinsLocal(entryId);
        } 
        
        else if (path === '/api/assign_image') {
            data = await assignImageLocal(body);
        } 
        
        else if (path === '/api/reset_image_to_master') {
            data = await resetImageToMasterLocal(body.coin_type, body.side);
        } 
        
        else if (path === '/api/factory_reset_images') {
            data = await factoryResetImagesLocal();
        } 
        
        else if (path === '/api/has_master') {
            data = await checkMasterLocal(url.searchParams.get('coin_type'), url.searchParams.get('side'));
        } 
        
        else if (path === '/api/promote_to_default') {
            data = await promoteToDefaultLocal(body.coin_type, body.side);
        } 
        
        else if (path === '/api/coin_bank_images') {
            data = await fetchCoinBankImagesLocal(url.searchParams);
        } 
        
        else if (path.startsWith('/api/coin_bank_images/')) {
            const name = path.substring('/api/coin_bank_images/'.length);
            data = await deleteCoinBankImageLocal(name);
        } 
        
        else if (path === '/api/coin_bank_images/rename') {
            data = await renameCoinBankImageLocal(body);
        }
        
        else if (path === '/api/backup/full') {
            data = await getFullBackupLocal();
        } 
        
        else if (path === '/api/backup/restore') {
            data = await restoreBackupLocal(body);
        } 
        
        else if (path === '/api/backup/import_csv') {
            data = await importCSVLocal(rawBody);
        }
        
        else if (path === '/api/backup/zip_restore') {
            status = 400;
            data = { error: "ZIP restore is legacy backend only. Please use JSON restore." };
        } 
        
        else {
            console.warn(`Local API Interceptor: Route not matched: [${method}] ${path}`);
            status = 404;
            data = { error: "Route not found" };
        }

        return new Response(JSON.stringify(data), {
            status: status,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error(`Local API Interceptor Exception at ${path}:`, err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Override fetch globally
const originalFetch = window.fetch;
window.fetch = async function(input, init) {
    let urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    
    // Direct matches for API routes
    if (urlStr.startsWith('/api/') || urlStr.includes('/api/')) {
        let apiPart = urlStr.substring(urlStr.indexOf('/api/'));
        return handleInterceptedRequest(apiPart, init);
    }
    
    return originalFetch.apply(this, arguments);
};

console.log('Offline-First API Interceptor loaded successfully and overriding window.fetch.');
