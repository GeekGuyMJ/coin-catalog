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
// 2026-09-28: exported. search.js needs this to decide whether the text
// query can be answered by the backend at all -- on a static host
// (GitHub Pages, Cloudflare Pages) /api/coins does not exist, so the
// search MUST filter client-side. Previously this was module-private, and
// importing it produced a LOAD-TIME SyntaxError that killed the whole
// search module on every host.
// 2026-10-21 (GGMJ-388): the detection RULE now lives in ONE place
// (./env.js) and is imported by api.js, catalog.js and db.js, so the three
// files can no longer disagree about which host the app is running on.
import { isSelfHosted } from './env.js';
export const isSearchIndexReady = () => Promise.resolve(true);
export { isSelfHosted };

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
    savePortfolioHistoryLocal,
    searchCoinsLocal,
    isSearchIndexReady as isSearchIndexReadyLocal,
    fetchAllCoinsLocal,
    getFullBackupLocal,
    publishSectionLocal,
    restoreBackupLocal,
    renameCoinBankImageLocal,
    saveToCoinBankLocal,
    importCSVLocal,
    factoryResetDataLocal,
    deleteBulkCoinsLocal,
    fetchSpotHistoryLocal,
    fetchUserPhotosLocal,
    addUserPhotoLocal,
    deleteUserPhotoLocal,
    addUserCoinLocal,
    deleteUserCoinLocal,
    fetchInvestmentsLocal,
    saveInvestmentLocal,
    deleteInvestmentLocal,
    fetchTypeGroupsLocal,
    fetchTypeYearsLocal,
    setTypeYearsLocal,
    upsertTypeConfigLocal,
    deleteTypeConfigLocal,
    assignTypeImageLocal,
    fetchTypeImagesLocal,
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

/* GGMJ-397: correct the CLIENT wishlist snapshot for one coin after the server
   told us the snapshot was wrong. The heart glyph is rendered from this
   snapshot, so leaving it stale is what strands the heart on the wrong glyph
   and keeps the entry on the Wishlist card.

   Only ever called from the two "already in the desired state" paths, where
   the server has just stated the truth about this one coin. Every other coin
   in the snapshot is left alone, and a failure to write the snapshot is
   swallowed: the next successful refresh from the server fixes it. */
async function reconcileWishlistSnapshot(coinId, present, item) {
    try {
        const state = await import('./state.js');
        const current = state.getWishlist() || [];
        const idx = current.findIndex(w => w.coin_id === coinId);
        let next;
        if (present) {
            if (idx === -1) {
                next = current.concat([item || { coin_id: coinId }]);
            } else {
                next = current.slice();
                next[idx] = Object.assign({}, next[idx], item || {});
            }
        } else {
            if (idx === -1) return;  // already consistent
            next = current.slice();
            next.splice(idx, 1);
        }
        state.setWishlist(next);
    } catch (e) {
        console.warn('[wishlist] could not reconcile the local wishlist snapshot:', e);
    }
}

// ============================================================
// Exported API — delegates based on environment
// ============================================================

// Core catalog APIs
/* 2026-10-01: this was the ONLY coin endpoint with no isSelfHosted
   branch -- every other one (fetchSections, fetchCoin, fetchInventory)
   had it. So on self-hosted the section LIST came from the database while
   the coin ROWS came from IndexedDB, which db.js seeds from
   data/coins.json. The two stores number rows independently:

       positions where the coin matches      633 of 5,970  (10.6%)
       shared ids naming a DIFFERENT coin    591 of 900    (66%)

   That mismatch rendered two Canadian coins (a 1940 fifty-cent and a
   1941 cent) as 2026 Jefferson nickels. Routing the rows to the same
   API the section list uses removes the second source entirely. */
export const fetchCoinsForSection = isSelfHosted
    ? async (section) => serverFetch(
        '/api/coins?section=' + encodeURIComponent(section))
    : wrap(fetchCoinsForSectionLocal);

export const fetchCoin = isSelfHosted
    ? async (coinId) => serverFetch('/api/coins/' + coinId)
    : wrap(fetchCoinLocal);

export const fetchInventory = isSelfHosted
    ? async () => serverFetch('/api/inventory')
    : wrap(fetchInventoryLocal);


// 2026-10-20 (Matthew-approved Gemini-4 spec): external investments CRUD.
// 2026-10-21 (GGMJ-378): these were SERVER-ONLY, so the Investments card was
// gated off entirely on the static deployments (GitHub Pages, Cloudflare
// Pages) -- there is no /api/investments backend there. Every other card
// that works on those hosts has a local Dexie fallback (fetchInventory ->
// wrap(fetchInventoryLocal), addToWishlist -> wrap(addToWishlistLocal)); this
// one had none, which is why #card-investments was absent from both public
// apps while the CSS for it was deployed. It now follows the same pattern.
// The self-hosted path is unchanged: these still go to /api/investments.
export const fetchInvestments = isSelfHosted
    ? async () => serverFetch('/api/investments')
    : wrap(fetchInvestmentsLocal);

export const saveInvestment = isSelfHosted
    ? async (data) => serverFetch('/api/investments', {
        method: data.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    : wrap(saveInvestmentLocal);

export const deleteInvestment = isSelfHosted
    ? async (id) => serverFetch('/api/investments/' + id, { method: 'DELETE' })
    : wrap(deleteInvestmentLocal);

export const updateInventory = isSelfHosted
    ? async (coinId, data) => {
        // 2026-08-31: server requires coin_ref_id as an INTEGER; album passes dataset
        // strings. Build the payload explicitly and coerce types (400 fix).
        // 2026-10-21 (GGMJ-335): include purchase_price, current_value, date_acquired,
        // personal_photo/personal_photos so slot-editor fields are NOT silently dropped.
        const payload = { coin_ref_id: parseInt(coinId, 10), quantity: parseInt(data.quantity || 0, 10) };
        if (data.id) payload.id = parseInt(data.id, 10);
        if (data.grade !== undefined) payload.grade = data.grade;
        if (data.notes !== undefined) payload.notes = data.notes;
        if (data.purchase_price !== undefined) payload.purchase_price = parseFloat(data.purchase_price) || 0;
        if (data.current_value !== undefined) payload.current_value = parseFloat(data.current_value) || 0;
        if (data.date_acquired !== undefined) payload.date_acquired = data.date_acquired;
        if (data.personal_photo !== undefined) payload.personal_photo = data.personal_photo;
        if (data.personal_photos !== undefined) payload.personal_photos = data.personal_photos;
        return serverFetch("/api/inventory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
    }
    : wrap(updateInventoryLocal);// Delete exactly one inventory row by its primary key on either platform.
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
export const assignImage = isSelfHosted
    ? async (data) => {
    const res = await originalFetch('/api/assign_image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data || {}),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { status: 'error', error: body.error || ('HTTP ' + res.status) };

    // Return the FULL backend body — images.js gates its immediate re-paint on
    // result.new_url / result.configs_written.
    return { status: body.status || 'success', message: body.message,
             updated: body.updated, configs_written: body.configs_written,
             new_url: body.new_url };
    }
    : async (data) => {
    // Local-first (GitHub Pages has no backend): assignImageLocal writes the
    // image into the IndexedDB coin_type_config / coins_reference directly.
    // Posting to GitHub Pages would fail with HTTP 405 — Pages only serves GET.
    try {
        return await assignImageLocal(data);
    } catch (e) {
        console.error('Local DB API Error:', e);
        return { status: 'error', error: e.message || 'Local assignment failed' };
    }
    };

export const fetchCoinBankImages = isSelfHosted
    ? async (params = {}) => {
        const search = params instanceof URLSearchParams ? params.toString() : new URLSearchParams(params).toString();
        return serverFetch('/api/coin_bank_images?' + search);
    }
    : wrap(fetchCoinBankImagesLocal);


// ---------------------------------------------------------------------------
// GGMJ-340: the two image-upload paths the Coin Image Bank and the per-coin
// upload modal actually use.
//
// BEFORE: both call sites POSTed multipart FormData to '/api/upload', which
// has never existed in backend/routes/. Every upload failed silently with a
// 404 (or, on the static deployments, with the offline interceptor's
// "Route not found").
//
// The two endpoints that DO exist, and the contract each one speaks:
//
//   POST /api/coin_bank_images   JSON  {coin_type, side, image}   image = base64 data URI
//       -> saves a TYPE-level image into IMAGES_DIR/types and returns
//          {status: "saved", filename: "<url>"}
//
//   POST /api/assign_image       JSON  {coin_type, side, image, scope,
//                                       item_id, year, mint_mark}
//       -> with scope='specific_coin' and item_id=<CoinReference.id> this
//          writes the image onto that ONE coin row and returns
//          {status: "success", new_url: "<url>"}
//
// Both take a base64 data URI, so the caller must convert the File to a data
// URI before calling. uploadImageAsDataUri() does that here so both call
// sites share one conversion path.
// ---------------------------------------------------------------------------

/**
 * Convert a File/Blob to a base64 data URI string.
 * @param {File|Blob} file
 * @returns {Promise<string>} e.g. "data:image/webp;base64,..."
 */
export function uploadImageAsDataUri(file) {
    return new Promise((resolve, reject) => {
        if (!file) { reject(new Error('No file selected')); return; }
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read the image file'));
        reader.onload = () => {
            const result = reader.result;
            if (typeof result !== 'string' || !result.startsWith('data:image')) {
                reject(new Error('Not a readable image file'));
                return;
            }
            resolve(result);
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Save an image into the Coin Bank (type level).
 *
 * @param {{coin_type: string, side: string, image: string}} data
 *        `image` is a base64 data URI.
 * @returns {Promise<object>} the backend body, or {status:'error', error}.
 */
export const uploadCoinBankImage = isSelfHosted
    ? async (data) => {
        const res = await originalFetch('/api/coin_bank_images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data || {}),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) return { status: 'error', error: body.error || ('HTTP ' + res.status) };
        return body;
    }
    : async (data) => {
        // Public (GitHub Pages / Cloudflare Pages): no backend. Store the image
        // in the local Coin Bank store so the image is at least usable there.
        try {
            return await saveToCoinBankLocal(data);
        } catch (e) {
            console.error('Local DB API Error:', e);
            return { status: 'error', error: e.message || 'Local coin bank save failed' };
        }
    };

/**
 * Upload an image for ONE specific coin row (the per-coin slot).
 *
 * @param {{coin_id: number, side: string, image: string,
 *          coin_type?: string, year?: number, mint_mark?: string}} data
 *        `image` is a base64 data URI.
 * @returns {Promise<object>} the backend body, or {status:'error', error}.
 */
export const uploadCoinImage = isSelfHosted
    ? async (data) => {
        const payload = {
            coin_type: data.coin_type || '',
            side: data.side,
            image: data.image,
            scope: 'specific_coin',
            item_id: data.coin_id,
        };
        if (data.year != null) payload.year = data.year;
        if (data.mint_mark) payload.mint_mark = data.mint_mark;
        const res = await originalFetch('/api/assign_image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) return { status: 'error', error: body.error || ('HTTP ' + res.status) };
        return body;
    }
    : async (data) => {
        try {
            return await assignImageLocal({
                coin_type: data.coin_type || '',
                side: data.side,
                image: data.image,
                scope: 'specific_coin',
                item_id: data.coin_id,
                year: data.year,
                mint_mark: data.mint_mark,
            });
        } catch (e) {
            console.error('Local DB API Error:', e);
            return { status: 'error', error: e.message || 'Local image upload failed' };
        }
    };


// Photos & Documents Gallery — server on self-hosted, local IndexedDB otherwise.
export const fetchUserPhotos = isSelfHosted
    ? async () => serverFetch('/api/user_photos')
    : wrap(fetchUserPhotosLocal);
export const addUserPhoto = isSelfHosted
    ? async (photo) => serverFetch('/api/user_photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(photo),
    })
    : wrap(addUserPhotoLocal);
export const deleteUserPhoto = isSelfHosted
    ? async (id) => serverFetch('/api/user_photos/' + id, { method: 'DELETE' })
    : wrap(deleteUserPhotoLocal);

// User-added catalog coins — server on self-hosted, local IndexedDB otherwise.
export const addUserCoin = isSelfHosted
    ? async (coin) => serverFetch('/api/user_coins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(coin),
    })
    : wrap(addUserCoinLocal);
export const deleteUserCoin = isSelfHosted
    ? async (id) => {
        // Delete on server first; if it succeeds, also drop the local IndexedDB
        // row immediately so the UI updates without waiting for cross-device sync.
        const result = await serverFetch('/api/user_coins/' + id, { method: 'DELETE' });
        try {
            const { deleteUserCoinLocal } = await import('./db.js');
            await deleteUserCoinLocal(id);
        } catch (_e) { /* local row may not exist — ignore */ }
        return result;
    }
    : wrap(deleteUserCoinLocal);

// Reset / purge all data (mode: 'data_only' | 'full_reset')
export const factoryResetData = isSelfHosted
    ? async (mode) => serverFetch('/api/backup/factory_reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: mode || 'data_only' }),
    })
    : wrap(factoryResetDataLocal);

// Local-only features (no server equivalent) - always use local DB
// Spot prices: server-first on self-hosted (nginx proxies Yahoo + backend has
// a working /api/spot_prices), else fall back to the client-side Yahoo chain.
export const fetchSpotPrices       = isSelfHosted
    ? async () => {
        const data = await serverFetch('/api/spot_prices');
        // Backend returns raw prices; add _meta for stale-warning UI.
        if (!data._meta) {
            data._meta = { is_stale: false, updated_at: Date.now() };
        }
        return data;
    }
    : wrap(fetchSpotPricesLocal);
export const fetchRawBullion       = isSelfHosted
    ? async () => serverFetch('/api/raw_bullion')
    : wrap(fetchRawBullionLocal);
export const saveRawBullion        = isSelfHosted
    ? async (data) => serverFetch('/api/raw_bullion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    : wrap(saveRawBullionLocal);
export const deleteRawBullion      = isSelfHosted
    ? async (id) => serverFetch('/api/raw_bullion/' + id, { method: 'DELETE' })
    : wrap(deleteRawBullionLocal);
export const fetchScrap            = isSelfHosted
    ? async () => serverFetch('/api/scrap')
    : wrap(fetchScrapLocal);
export const saveScrap             = isSelfHosted
    ? async (data) => serverFetch('/api/scrap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    : wrap(saveScrapLocal);
export const deleteScrap           = isSelfHosted
    ? async (id) => serverFetch('/api/scrap/' + id, { method: 'DELETE' })
    : wrap(deleteScrapLocal);
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
/* 2026-10-20 (Matthew bug report: heart click added "1915 Barber" for the 1916-D
   dime): on self-hosted the catalog rows come from the SERVER database, but wishlist
   add/remove still used the LOCAL Dexie path. The two stores number coins
   independently (documented 2026-10-01 in fetchCoinsForSection: 66% of shared ids
   name a DIFFERENT coin), so the local store's coin at the server id became the
   wishlist description. Route wishlist mutations + reads through the same server the
   catalog uses. */
export const fetchWishlist         = isSelfHosted
    ? async () => serverFetch('/api/wishlist')
    : wrap(fetchWishlistLocal);
export const saveWishlist          = isSelfHosted
    ? async (data) => serverFetch('/api/wishlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    : wrap(saveWishlistLocal);
/* GGMJ-397: the mirror case. Server already holds the row while the client
   snapshot does not -> POST /api/wishlist answers 409 {"error":"Already in
   wishlist"} -> serverFetch() throws -> toast "Wishlist error: HTTP 409" and
   the heart never fills. Adding something that is already there HAS reached
   the desired end state, so the 409 is success. The backend returns 409 from
   exactly one place (the duplicate coin_id check in POST /api/wishlist) and it
   carries the existing row in `item`, so the status is unambiguous here. */
async function addToWishlistServer(coinId, extra) {
    const id = parseInt(coinId, 10);
    const res = await originalFetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ coin_id: id }, extra || {}))
    });
    if (res.ok) return res.json();
    if (res.status === 409) {
        // Already present -> the desired end state. Not an error.
        console.warn('[wishlist] coin ' + id + ' was already on the server wishlist; treating the add as done.');
        const body = await res.json().catch(() => ({}));
        reconcileWishlistSnapshot(id, true, body.item || null);
        return body.item || { ok: true, coin_id: id, already_present: true };
    }
    throw new Error('HTTP ' + res.status);
}
export const addToWishlist         = isSelfHosted
    ? addToWishlistServer
    : wrap(addToWishlistLocal);
/* 2026-10-20 (Matthew B9): the filled heart in the catalog list returned 404.
   Every caller passes the COIN id (catalog.js toggleWishlist(coinId),
   wishlist.js item.coin_id), and removeFromWishlistLocal() also keys on
   coin_id -- but this branch sent it to DELETE /api/wishlist/<item_id>,
   which the backend resolves as a WISHLIST ROW id. Row ids and coin ids are
   independent number spaces, so the lookup missed and the entry stayed. Use
   the by-coin route so both platforms accept the same coin id. */
/* GGMJ-397 (Matthew B9, 2026-10-21): a FILLED heart raised an error instead of
   removing the wishlist entry, and the entry STAYED on the wishlist.

   The heart glyph is drawn from the CLIENT snapshot (state.js getWishlist()),
   but the write goes to the SERVER. When the two disagree the click fails:

     server has no row, client snapshot still lists it
       -> DELETE /api/wishlist/coin/<id> -> 404 {"error":"Not in wishlist"}
       -> serverFetch() throws Error("HTTP 404")
       -> toast "Wishlist error: HTTP 404", heart STAYS FILLED, entry STAYS.

   Reproduced live with a real mouse click on the self-hosted site: the click
   was repeated and failed identically the second time, so the heart is stuck
   PERMANENTLY, not transiently. The server access log shows
   "DELETE /api/wishlist/coin/86 HTTP/1.0" 404.

   Removing something that is already gone HAS reached the desired end state,
   so the 404 on THIS route means "already removed", not "failed". serverFetch()
   discards the body and turns every non-2xx into a throw, so the status is
   what we key on. A 404 here can only mean "no row for this coin": the route
   is matched by an INTEGER coin id, so there is no other way to miss it.
   Every other status (401/403, 500, network failure) is still raised.

   The snapshot is reconciled in place as well, so the heart is corrected even
   when the follow-up refresh cannot reach the server. */
async function removeFromWishlistServer(coinId) {
    const id = parseInt(coinId, 10);
    const res = await originalFetch('/api/wishlist/coin/' + id, { method: 'DELETE' });
    if (res.ok) return res.json();
    if (res.status === 404) {
        // Already absent -> the desired end state. Not an error.
        console.warn('[wishlist] coin ' + id + ' was already absent from the server wishlist; treating the remove as done.');
        reconcileWishlistSnapshot(id, false);
        return { ok: true, coin_id: id, already_absent: true };
    }
    throw new Error('HTTP ' + res.status);
}
export const removeFromWishlist    = isSelfHosted
    ? removeFromWishlistServer
    : wrap(removeFromWishlistLocal);
export const updateWishlistItem    = isSelfHosted
    ? async (id, data) => serverFetch('/api/wishlist/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    : wrap(updateWishlistItemLocal);
export const fetchBulkCoins        = isSelfHosted
    ? async () => serverFetch('/api/bulk_coins')
    : wrap(fetchBulkCoinsLocal);
export const saveBulkCoins         = isSelfHosted
    ? async (data) => serverFetch('/api/bulk_coins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    : wrap(saveBulkCoinsLocal);
export const fetchBulkEntries      = isSelfHosted
    ? async () => serverFetch('/api/bulk_coins/entries')
    : async () => ({ entries: await fetchBulkCoinsLocal() });
export const addBulkEntry          = isSelfHosted
    ? async (data) => serverFetch('/api/bulk_coins/entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    : wrap(saveBulkCoinsLocal);
export const deleteBulkEntry       = isSelfHosted
    ? async (id) => serverFetch('/api/bulk_coins/entries/' + id, { method: 'DELETE' })
    : wrap(deleteBulkCoinsLocal);
export const fetchCoinWeight       = async () => [];
export const saveCoinWeight        = async () => ({});
export const deleteCoinWeight      = async () => ({});


// ---------------------------------------------------------------------------
// TYPE & IMAGE MANAGER (GGMJ-227 Phase 1)
// ---------------------------------------------------------------------------
// Self-hosted calls the Flask blueprint in backend/routes/type_manager.py.
// The static deployments (GitHub Pages, Cloudflare Pages) have no backend, so
// the same calls go to IndexedDB via the local helpers in db.js.
//
// Both sides are always exported together: an export with no isSelfHosted
// sibling is the tell that a feature silently does nothing on the public apps.
export const fetchTypeGroups = isSelfHosted
    ? async (params = {}) => {
        const search = params instanceof URLSearchParams
            ? params.toString()
            : new URLSearchParams(params).toString();
        return serverFetch('/api/type-configs/groups' + (search ? '?' + search : ''));
    }
    : wrap(fetchTypeGroupsLocal);

export const fetchTypeYears = isSelfHosted
    ? async (coinType) => serverFetch(
        '/api/type-configs/' + encodeURIComponent(coinType) + '/years')
    : wrap(fetchTypeYearsLocal);

export const setTypeYears = isSelfHosted
    ? async (coinType, years) => serverFetch(
        '/api/type-configs/' + encodeURIComponent(coinType) + '/years', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ years: years })
        })
    : wrap(setTypeYearsLocal);

export const upsertTypeConfig = isSelfHosted
    ? async (data) => serverFetch('/api/type-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data || {})
    })
    : wrap(upsertTypeConfigLocal);

export const deleteTypeConfig = isSelfHosted
    ? async (coinType) => serverFetch(
        '/api/type-configs/' + encodeURIComponent(coinType), { method: 'DELETE' })
    : wrap(deleteTypeConfigLocal);

export const assignTypeImage = isSelfHosted
    ? async (coinType, side, image) => serverFetch('/api/type-configs/assign-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coin_type: coinType, side: side, image: image })
    })
    : wrap(assignTypeImageLocal);

export const fetchTypeImages = isSelfHosted
    ? async () => serverFetch('/api/type-configs/images')
    : wrap(fetchTypeImagesLocal);
export const fetchSpotHistory      = wrap(fetchSpotHistoryLocal);
export const fetchAllCoins         = wrap(fetchAllCoinsLocal);
/* GGMJ-368: the cloud backup must be built from the store that actually
   holds the data. On self-hosted that is the server DB, not the browser's
   Dexie store (which is empty there) -- GET /api/backup/client returns the
   same JSON shape the Dexie store uses, so the file stays portable. */
export const getFullBackup         = isSelfHosted
    ? async () => serverFetch('/api/backup/client')
    : wrap(getFullBackupLocal);
export const publishSection        = wrap(publishSectionLocal);
/* GGMJ-368: restoring on self-hosted must write to the SERVER, not to the
   empty browser store. The endpoint requires the confirmation phrase
   because it replaces user tables. */
export const restoreBackup         = isSelfHosted
    ? async (backupObj) => serverFetch('/api/backup/client_restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'RESTORE BACKUP', backup: backupObj })
    })
    : wrap(restoreBackupLocal);
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
export const savePricingRules = isSelfHosted
    ? async (data) => serverFetch('/api/pricing_rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            coin_type: data.coin_type,
            base_price: data.base_price,
            key_price: data.key_price
        })
    })
    : wrap(savePricingRulesLocal);
export const searchCoins           = wrap(searchCoinsLocal);
// GGMJ-206: on the public builds the search index is built in the
// browser's IndexedDB; the self-hosted build answers the query from the
// backend and has no local index to wait for.
export const isSearchIndexReady   = isSelfHosted ? () => true : isSearchIndexReadyLocal;
export const savePortfolioHistory = isSelfHosted
    ? async (data) => serverFetch('/api/portfolio/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            date: data.date,
            total_value: data.total_value,
            gold_spot: data.gold_spot,
            silver_spot: data.silver_spot,
            copper_spot: data.copper_spot,
            platinum_spot: data.platinum_spot,
            palladium_spot: data.palladium_spot,
            coin_count: data.coin_count
        })
    })
    : wrap(savePortfolioHistoryLocal);
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
        saveToCoinBankLocal, importCSVLocal,
    factoryResetDataLocal, deleteBulkCoinsLocal, fetchSpotHistoryLocal,
    fetchTypeGroupsLocal,
    fetchTypeYearsLocal,
    setTypeYearsLocal,
    upsertTypeConfigLocal,
    deleteTypeConfigLocal,
    assignTypeImageLocal,
    fetchTypeImagesLocal,
    } = await import('./db.js');

    async function handleInterceptedRequest(apiPart, init) {
        let urlStr = apiPart;
        const method = (init && init.method) || 'GET';
        let body = init && init.body ? JSON.parse(init.body) : null;
        let rawBody = init && init.body ? init.body : null;
        let status = 200;
        let data;

        try {
            const url = new URL(urlStr, 'http://localhost');
            const path = url.pathname;

            if (path === '/api/status') { data = await fetchStatusLocal(); }
            else if (path === '/api/coins/sections') { data = await fetchSectionsLocal(); }
            else if (path === '/api/coins') {
                const q = url.searchParams.get('q');
                if (q !== null && q !== '') {
                    // Search request from search.js — fetchCoinsForSectionLocal
                    // only filters by section and IGNORES q, which made every
                    // public-app search return nothing. Route to the real search.
                    data = await searchCoinsLocal(url.searchParams);
                } else {
                    data = await fetchCoinsForSectionLocal(url.searchParams.get('section') || '');
                }
            }
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
            else if (path === '/api/type-configs/groups') { data = await fetchTypeGroupsLocal(url.searchParams); }
            else if (path === '/api/type-configs/images') { data = await fetchTypeImagesLocal(); }
            else if (path === '/api/type-configs/assign-image') { data = await assignTypeImageLocal(body.coin_type, body.side, body.image); }
            else if (path === '/api/type-configs') {
                if (method === 'POST') { data = await upsertTypeConfigLocal(body); }
                else { data = await fetchTypeConfigsLocal(); }
            }
            else if (path.indexOf('/api/type-configs/') === 0) {
                const rest = path.substring('/api/type-configs/'.length);
                if (rest.endsWith('/years')) {
                    const ct = decodeURIComponent(rest.substring(0, rest.length - '/years'.length));
                    if (method === 'PUT') { data = await setTypeYearsLocal(ct, body.years); }
                    else { data = await fetchTypeYearsLocal(ct); }
                } else if (method === 'DELETE') {
                    data = await deleteTypeConfigLocal(decodeURIComponent(rest));
                } else {
                    data = await fetchTypeConfigsLocal();
                }
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
            else if (path === '/api/user_photos') {
                if (method === 'POST') { status = 201; data = await addUserPhotoLocal(body); }
                else { data = await fetchUserPhotosLocal(); }
            }
            else if (path.startsWith('/api/user_photos/')) { data = await deleteUserPhotoLocal(path.substring('/api/user_photos/'.length)); }
            else if (path === '/api/backup/full') { data = await getFullBackupLocal(); }
            else if (path === '/api/backup/restore') { data = await restoreBackupLocal(body); }
            else if (path === '/api/backup/import_csv') { data = await importCSVLocal(rawBody); }
            else if (path === '/api/backup/zip_restore') { status = 400; data = { error: "ZIP restore is legacy backend only. Please use JSON restore." }; }
            else {
                try { return await originalFetch(urlStr, init); }
                catch (netErr) {
                    console.warn(`Local API Interceptor: Route not matched and backend unreachable: [${method}] ${path}`);
                    status = 404; data = { error: "Route not found" };
                }
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