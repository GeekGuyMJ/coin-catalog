/**
 * api.js — Coin Catalog v2 — All HTTP calls to the Flask backend.
 * No other module calls fetch() directly.
 * @module api
 */

const BASE = '';

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
 * Save an image to the Coin Bank.
 */
export function saveToCoinBank(data) {
    return request('/api/coin_bank_images', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}
