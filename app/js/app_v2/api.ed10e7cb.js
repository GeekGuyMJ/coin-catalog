/**
 * api.js — Coin Catalog v2 — All HTTP calls to the Flask backend.
 * No other module calls fetch() directly.
 * @module api
 */

const BASE = window.__API_BASE_URL__ || '';

async function request(path, options = {}) {
    const url = BASE + path;
    let response;
    try {
        response = await fetch(url, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options,
        });
    } catch (networkError) {
        throw new Error(`Network error: ${networkError.message}`);
    }
    if (!response.ok) {
        let detail = '';
        try { const b = await response.json(); detail = b.error || b.detail || ''; }
        catch { detail = response.statusText; }
        throw new Error(`API ${response.status}: ${detail}`);
    }
    return response.json();
}

export const fetchStatus          = ()         => request('/api/status');
export const fetchSections        = ()         => request('/api/coins/sections');
export const fetchCoinsForSection = (section)  => request(`/api/coins?section=${encodeURIComponent(section)}`);
export const fetchCoin            = (id)       => request(`/api/coins/${id}`);
export const fetchInventory       = ()         => request('/api/inventory');
export const fetchTypeConfigs     = ()         => request('/api/pricing_rules');
export const fetchSpotPrices      = ()         => request('/api/spot_prices');

export function updateInventory(coinRefId, data) {
    return request('/api/inventory', {
        method: 'POST',
        body: JSON.stringify({ coin_ref_id: coinRefId, ...data }),
    });
}

export function deleteInventoryEntry(coinRefId) {
    return request(`/api/inventory/${coinRefId}`, { method: 'DELETE' });
}

/**
 * Assign an image to a coin type or specific item.
 * @param {Object} data - { coin_type, side, image, scope, item_id }
 */
export function assignImage(data) {
    return request('/api/assign_image', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

/** Portfolio & bullion API calls */
export const fetchBullion          = ()         => request('/api/bullion');
export const saveBullion           = (data)     => request('/api/bullion', { method: 'POST', body: JSON.stringify(data) });
export const fetchScrap            = ()         => request('/api/scrap');
export const saveScrap             = (data)     => request('/api/scrap', { method: 'POST', body: JSON.stringify(data) });
export const deleteScrap           = (id)       => request(`/api/scrap/${id}`, { method: 'DELETE' });
export const fetchPortfolioHistory = ()         => request('/api/portfolio/history');
export const fetchPortfolio        = ()         => request('/api/portfolio');

/** Custom categories & other collectables */
export const fetchOtherCollectables = ()       => request('/api/other_collectables');
export const fetchWishlist          = ()        => request('/api/wishlist');
export const saveWishlist           = (data)    => request('/api/wishlist', { method: 'POST', body: JSON.stringify(data) });
export const addToWishlist          = (coinId)   => request('/api/wishlist', { method: 'POST', body: JSON.stringify({ coin_id: coinId }) });
export const removeFromWishlist     = (coinId)   => request('/api/wishlist/coin/' + coinId, { method: 'DELETE' });

/** Other Investments CRUD */
export const fetchInvestments   = ()   => request('/api/investments');
export const saveInvestment     = (d)  => request('/api/investments', { method: d.id ? 'PUT' : 'POST', body: JSON.stringify(d) });
export const deleteInvestment   = (id) => request('/api/investments/' + id, { method: 'DELETE' });

/**
 * Fetch images from the Coin Bank.
 * @param {Object} params - { coin_type, side }
 */
export function fetchCoinBankImages(params = {}) {
    let url = '/api/coin_bank_images';
    const query = new URLSearchParams(params).toString();
    if (query) url += `?${query}`;
    return request(url);
}

/**
 * Delete an image from the Coin Bank.
 * @param {string} filename - The image filename (as returned by fetchCoinBankImages).
 */
export function deleteCoinBankImage(filename) {
    const base = filename.substring(filename.lastIndexOf('/') + 1);
    return request(`/api/coin_bank_images/${encodeURIComponent(base)}`, {
        method: 'DELETE',
    });
}

/**
 * Update metadata for a Coin Bank image (placeholder — not yet implemented).
 */
export function updateCoinBankImageInfo(filename, data) {
    return request(`/api/coin_bank_images/${encodeURIComponent(filename)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

/**
 * Save an image to the Coin Bank.
 */
export function saveToCoinBank(data) {
    return request('/api/coin_bank_images', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

/**
 * Reset a coin type/side's image back to its master (default).
 * @param {string} coinType - Full coin type string
 * @param {string} side - 'obv' or 'rev'
 */
export function resetImageToMaster(coinType, side) {
    return request('/api/reset_image_to_master', {
        method: 'POST',
        body: JSON.stringify({ coin_type: coinType, side }),
    });
}

/**
 * Factory reset ALL coin type images — deletes all user-tier images.
 */
export function factoryResetImages() {
    return request('/api/factory_reset_images', {
        method: 'POST',
    });
}

/**
 * User-editable historical notes for a coin reference.
 * GET    /api/coins/<id>/notes   -> { user_notes, ref_notes }
 * POST   /api/coins/<id>/notes   -> body: { user_notes }
 */
export function fetchCoinNotes(coinId) {
    return request(`/api/coins/${coinId}/notes`);
}

export function saveCoinNotes(coinId, userNotes) {
    return request(`/api/coins/${coinId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ user_notes: userNotes }),
    });
}
