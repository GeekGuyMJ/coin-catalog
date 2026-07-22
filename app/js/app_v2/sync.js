/**
 * sync.js — Coin Catalog v2 — Cloud Sync & Provider Management
 * Handles provider list, auth state, and sync operations for
 * Google Drive, OneDrive, Dropbox, and WebDAV.
 * @module sync
 */

import { showToast } from './notifications.js?v=4';
import { getFullBackupLocal, restoreBackupLocal } from './db.js?v=4';

// ============================================================
// Provider Configuration
// ============================================================
const PROVIDERS = [
  {
    id: 'webdav',
    name: 'WebDAV (Nextcloud, ownCloud)',
    description: 'Self-hosted WebDAV-compatible storage. Add your server URL and credentials below, then click Backup. This is the only provider that works without a backend server.',
    requiresAuth: false,
  },
  {
    id: 'googleDrive',
    name: 'Google Drive',
    description: 'Requires OAuth 2.0 setup (a backend server with redirect URI). Cannot authenticate from a static web app — stored locally as a placeholder until server-side support is added.',
    requiresAuth: true,
  },
  {
    id: 'oneDrive',
    name: 'OneDrive',
    description: 'Requires Microsoft OAuth 2.0 setup. Cannot authenticate from a static web app — stored locally as a placeholder.',
    requiresAuth: true,
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    description: 'Requires Dropbox OAuth 2.0 setup. Cannot authenticate from a static web app — stored locally as a placeholder.',
    requiresAuth: true,
  },
];

// ============================================================
// State
// ============================================================
let _currentProviderId = localStorage.getItem('cc-cloud-provider') || '';
const _authStates = {};
try {
  const saved = JSON.parse(localStorage.getItem('cc-cloud-auth') || '{}');
  Object.assign(_authStates, saved);
} catch (e) { /* ignore */ }

function _saveAuthState() {
  localStorage.setItem('cc-cloud-auth', JSON.stringify(_authStates));
}

// ============================================================
// Exported API
// ============================================================

export function getAllProviders() {
  return PROVIDERS;
}

export function getCurrentProvider() {
  if (!_currentProviderId) return null;
  return PROVIDERS.find(p => p.id === _currentProviderId) || null;
}

export function setCurrentProvider(providerId) {
  _currentProviderId = providerId;
  if (providerId) {
    localStorage.setItem('cc-cloud-provider', providerId);
  } else {
    localStorage.removeItem('cc-cloud-provider');
  }
}

export function getProviderAuthState(providerId) {
  return _authStates[providerId] || { authenticated: false };
}

export function setProviderAuthState(providerId, state) {
  _authStates[providerId] = { ...(_authStates[providerId] || {}), ...state };
  _saveAuthState();
}

// ============================================================
// Authentication Helpers
// ============================================================

export async function authenticateGoogleDrive() {
  showToast('Google Drive needs a backend server for OAuth. WebDAV works now — try that instead.', 'warning');
  return false;
}

export async function authenticateOneDrive() {
  showToast('OneDrive needs a backend server for OAuth. WebDAV works now — try that instead.', 'warning');
  return false;
}

export async function authenticateDropbox() {
  showToast('Dropbox needs a backend server for OAuth. WebDAV works now — try that instead.', 'warning');
  return false;
}

// ============================================================
// Generic Sync Entry Points
// ============================================================

/**
 * Backup local database to the currently selected cloud provider.
 */
export async function syncToCloud() {
  const provider = getCurrentProvider();
  if (!provider) {
    showToast('No cloud provider selected. Open Settings → Cloud Sync first.', 'warning');
    return;
  }

  const auth = getProviderAuthState(provider.id);
  if (provider.requiresAuth && !auth.authenticated) {
    showToast(`Please authenticate with ${provider.name} first in Cloud Sync settings.`, 'warning');
    return;
  }

  showToast(`Backing up to ${provider.name}...`, 'info');

  try {
    // Gather the backup data from IndexedDB
    const dbBackup = await getFullBackupLocal();
    const jsonStr = JSON.stringify(dbBackup);

    if (provider.id === 'webdav') {
      await _syncToWebDAV(jsonStr, auth);
    } else {
      // OAuth-based providers are stubbed for now
      await _syncToOAuthProvider(provider.id, jsonStr);
    }

    showToast(`Backup to ${provider.name} complete!`, 'success');
  } catch (err) {
    console.error('Cloud sync failed:', err);
    showToast(`Sync failed: ${err.message}`, 'error');
  }
}

/**
 * Restore local database from the currently selected cloud provider.
 */
export async function syncFromCloud() {
  const provider = getCurrentProvider();
  if (!provider) {
    showToast('No cloud provider selected.', 'warning');
    return;
  }

  const auth = getProviderAuthState(provider.id);
  if (provider.requiresAuth && !auth.authenticated) {
    showToast(`Please authenticate with ${provider.name} first.`, 'warning');
    return;
  }

  showToast(`Restoring from ${provider.name}...`, 'info');

  try {
    let jsonStr = null;

    if (provider.id === 'webdav') {
      jsonStr = await _restoreFromWebDAV(auth);
    } else {
      jsonStr = await _restoreFromOAuthProvider(provider.id);
    }

    if (!jsonStr) {
      showToast('No backup file found in cloud storage.', 'info');
      return;
    }

    const data = JSON.parse(jsonStr);
    await restoreBackupLocal(data);
    showToast(`Restore from ${provider.name} complete! Reloading page...`, 'success');
    setTimeout(() => location.reload(), 2000);
  } catch (err) {
    console.error('Cloud restore failed:', err);
    showToast(`Restore failed: ${err.message}`, 'error');
  }
}

// ============================================================
// Provider-specific implementations
// ============================================================

/**
 * Save backup to WebDAV (PUT request).
 */
async function _syncToWebDAV(jsonStr, auth) {
  const url = auth.url;
  const username = auth.username;
  const password = auth.password;

  if (!url) throw new Error('WebDAV URL not configured');

  const filename = 'coin_catalog_backup.json';
  const fullUrl = url.endsWith('/') ? url + filename : url + '/' + filename;

  const headers = { 'Content-Type': 'application/json' };
  if (username && password) {
    headers['Authorization'] = 'Basic ' + btoa(`${username}:${password}`);
  }

  const response = await fetch(fullUrl, {
    method: 'PUT',
    headers,
    body: jsonStr,
  });

  if (!response.ok) {
    throw new Error(`WebDAV upload failed (HTTP ${response.status})`);
  }
}

/**
 * Restore backup from WebDAV (GET request).
 */
async function _restoreFromWebDAV(auth) {
  const url = auth.url;
  const username = auth.username;
  const password = auth.password;

  if (!url) throw new Error('WebDAV URL not configured');

  const filename = 'coin_catalog_backup.json';
  const fullUrl = url.endsWith('/') ? url + filename : url + '/' + filename;

  const headers = {};
  if (username && password) {
    headers['Authorization'] = 'Basic ' + btoa(`${username}:${password}`);
  }

  const response = await fetch(fullUrl, { method: 'GET', headers });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`WebDAV download failed (HTTP ${response.status})`);

  return await response.text();
}

/**
 * Stub for OAuth providers (Google Drive, OneDrive, Dropbox).
 * In a production app, each provider would use its own SDK/API.
 */
async function _syncToOAuthProvider(providerId, jsonStr) {
  // Store locally as a simulated cloud backup
  localStorage.setItem(`cc-cloud-backup-${providerId}`, jsonStr);
  localStorage.setItem(`cc-cloud-backup-${providerId}-ts`, new Date().toISOString());
}

async function _restoreFromOAuthProvider(providerId) {
  return localStorage.getItem(`cc-cloud-backup-${providerId}`);
}

// ============================================================
// Original Google Drive implementation (inlined for
// backward compatibility)
// ============================================================

const CLIENT_ID_GD = 'YOUR_GOOGLE_DRIVE_API_CLIENT_ID.apps.googleusercontent.com';

export async function initGoogleDrive() {
  return new Promise((resolve) => {
    if (window.gapi) {
      window.gapi.load('client:auth2', async () => {
        try {
          await window.gapi.client.init({
            clientId: CLIENT_ID_GD,
            scope: 'https://www.googleapis.com/auth/drive.appdata',
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
          });
          resolve(true);
        } catch { resolve(false); }
      });
    } else {
      resolve(false);
    }
  });
}

export async function syncToGoogleDrive() {
  const isGapiInit = await initGoogleDrive().catch(() => false);
  if (!isGapiInit) { showToast('Google API not loaded.', 'info'); return; }
  const authInstance = window.gapi.auth2.getAuthInstance();
  if (!authInstance.isSignedIn.get()) { showToast('Sign in to Google Drive first.', 'info'); return; }
  try {
    const dbBackup = await getFullBackupLocal();
    const jsonStr = JSON.stringify(dbBackup);
    const listResponse = await window.gapi.client.drive.files.list({
      q: "name = 'coin_catalog_backup.json' and parents in 'appDataFolder'",
      spaces: 'appDataFolder',
      fields: 'files(id, name)',
    });
    const files = listResponse.result.files;
    const fileId = files && files.length > 0 ? files[0].id : null;
    if (fileId) {
      await window.gapi.client.request({
        path: `/upload/drive/v3/files/${fileId}`,
        method: 'PATCH',
        params: { uploadType: 'media' },
        body: jsonStr,
      });
    } else {
      await window.gapi.client.request({
        path: '/upload/drive/v3/files',
        method: 'POST',
        params: { uploadType: 'multipart' },
        headers: { 'Content-Type': 'multipart/related; boundary=foo' },
        body: `--foo
\nContent-Type: application/json; charset=UTF-8
\n
\n${JSON.stringify({ name: 'coin_catalog_backup.json', mimeType: 'application/json', parents: ['appDataFolder'] })}
\n--foo
\nContent-Type: application/json
\n
\n${jsonStr}
\n--foo--`,
      });
    }
    showToast('Google Drive sync complete!', 'success');
  } catch (err) {
    console.error('Google Drive sync failed:', err);
    showToast(`Sync failed: ${err.message}`, 'error');
  }
}

export async function syncFromGoogleDrive() {
  const isGapiInit = await initGoogleDrive().catch(() => false);
  if (!isGapiInit) { showToast('Google API not loaded.', 'info'); return; }
  const authInstance = window.gapi.auth2.getAuthInstance();
  if (!authInstance.isSignedIn.get()) { showToast('Sign in to Google Drive first.', 'info'); return; }
  try {
    const listResponse = await window.gapi.client.drive.files.list({
      q: "name = 'coin_catalog_backup.json' and parents in 'appDataFolder'",
      spaces: 'appDataFolder',
      fields: 'files(id, name)',
    });
    const files = listResponse.result.files;
    if (!files || files.length === 0) { showToast('No backup found.', 'info'); return; }
    const fileId = files[0].id;
    const fileResponse = await window.gapi.client.drive.files.get({ fileId, alt: 'media' });
    const data = fileResponse.result;
    if (data) {
      await restoreBackupLocal(data);
      showToast('Restore complete! Reloading...', 'success');
      setTimeout(() => location.reload(), 2000);
    }
  } catch (err) {
    console.error('Google Drive restore failed:', err);
    showToast(`Restore failed: ${err.message}`, 'error');
  }
}
