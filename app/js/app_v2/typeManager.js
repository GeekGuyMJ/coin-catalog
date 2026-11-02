/**
 * typeManager.js — Stub for static deployments (Cloudflare Pages)
 * 
 * The Type Manager feature is only available on self-hosted deployments with a backend.
 * This stub provides no-op exports so imports don't fail with 404/SPA-trap.
 */
export function openTypeManager() {
    console.debug('[typeManager] Type Manager not available on static deployment');
    return Promise.resolve();
}

export function closeTypeManager() {
    console.debug('[typeManager] Type Manager not available on static deployment');
    return Promise.resolve();
}