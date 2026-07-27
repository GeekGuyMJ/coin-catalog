/** 
 * sync.js — Coin Catalog v2 — Cloud Sync & Provider Management
 * 
 * Real OAuth-based sync for Google Drive, Dropbox, OneDrive, and WebDAV.
 * ALL providers work entirely client-side — no backend server required.
 * 
 * @module sync
 */

import { showToast } from './notifications.js';
import { getFullBackupLocal, restoreBackupLocal } from './db.js';

// ============================================================
// Provider Configuration
// ============================================================

const CREDENTIALS = {
  googleDrive: {
    clientId: 'YOUR_GOOGLE_DRIVE_CLIENT_ID.apps.googleusercontent.com',
    scope: 'https://www.googleapis.com/auth/drive.appdata'
  },
  dropbox: {
    clientId: 'YOUR_DROPBOX_APP_KEY',
    scope: 'files.content.write files.content.read'
  },
  oneDrive: {
    clientId: 'YOUR_ONEDRIVE_CLIENT_ID',
    authority: 'https://login.microsoftonline.com/common',
    scope: 'Files.ReadWrite.AppFolder offline_access'
  }
};

const PROVIDERS = [
  {
    id: 'webdav',
    name: 'WebDAV',
    icon: '📂',
    description: 'Self-hosted WebDAV-compatible storage (Nextcloud, ownCloud, Synology). Add your server URL and credentials below.',
    requiresAuth: false,
  },
  {
    id: 'googleDrive',
    name: 'Google Drive',
    icon: '🌐',
    description: 'Backup to your Google Drive app folder. Uses Google Identity Services — sign in with your Google account.',
    requiresAuth: true,
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    icon: '📦',
    description: 'Backup to your Dropbox. Uses PKCE OAuth flow — no server needed.',
    requiresAuth: true,
  },
  {
    id: 'oneDrive',
    name: 'OneDrive',
    icon: '☁️',
    description: 'Backup to Microsoft OneDrive. Uses MSAL.js PKCE flow.',
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

export function getAllProviders() { return PROVIDERS; }

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
// PKCE Utilities
// ============================================================

function _generateRandomString(length) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, v => charset[v % charset.length]).join('');
}

async function _sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

function _base64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function _getRedirectUri() {
  return window.location.href.split('?')[0].split('#')[0];
}

// ============================================================
// Authentication — Google Drive (GIS Token Model)
// ============================================================

let _gisLoaded = false;

function _loadGIS() {
  return new Promise((resolve) => {
    if (typeof google !== 'undefined' && google.accounts) {
      resolve(true); return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

export async function authenticateGoogleDrive() {
  const creds = CREDENTIALS.googleDrive;
  if (!creds.clientId || creds.clientId.startsWith('YOUR_')) {
    showToast('Google Drive: Set CREDENTIALS.googleDrive.clientId in sync.js', 'error');
    return false;
  }
  const loaded = await _loadGIS();
  if (!loaded) { showToast('Failed to load Google Identity Services.', 'error'); return false; }
  try {
    const tokenResponse = await new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: creds.clientId,
        scope: creds.scope,
        callback: (resp) => { if (resp.error) reject(new Error(resp.error)); else resolve(resp); },
      });
      client.requestAccessToken();
    });
    const expiresAt = Date.now() + (tokenResponse.expires_in || 3600) * 1000;
    setProviderAuthState('googleDrive', { authenticated: true, accessToken: tokenResponse.access_token, tokenType: tokenResponse.token_type || 'Bearer', expiresAt });
    showToast('Google Drive authenticated!', 'success');
    return true;
  } catch (err) {
    showToast('Google Drive auth failed: ' + err.message, 'error');
    return false;
  }
}

// ============================================================
// Authentication — Dropbox (PKCE OAuth)
// ============================================================

export async function authenticateDropbox() {
  const creds = CREDENTIALS.dropbox;
  if (!creds.clientId || creds.clientId.startsWith('YOUR_')) {
    showToast('Dropbox: Set CREDENTIALS.dropbox.clientId in sync.js', 'error');
    return false;
  }
  const codeVerifier = _generateRandomString(64);
  const challengeHash = await _sha256(codeVerifier);
  const codeChallenge = _base64url(challengeHash);
  sessionStorage.setItem('cc-dropbox-code-verifier', codeVerifier);
  const redirectUri = _getRedirectUri();
  const authUrl = 'https://www.dropbox.com/oauth2/authorize?response_type=code&client_id=' + encodeURIComponent(creds.clientId) + '&redirect_uri=' + encodeURIComponent(redirectUri) + '&code_challenge=' + encodeURIComponent(codeChallenge) + '&code_challenge_method=S256&token_access_type=offline';
  window.location.href = authUrl;
  return true;
}

export async function _handleDropboxCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');
  if (!code) return false;
  if (error) {
    showToast('Dropbox auth cancelled', 'warning');
    window.history.replaceState({}, '', _getRedirectUri().split('?')[0]);
    return false;
  }
  const creds = CREDENTIALS.dropbox;
  const codeVerifier = sessionStorage.getItem('cc-dropbox-code-verifier');
  const redirectUri = _getRedirectUri().split('?')[0];
  try {
    const tokenResp = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, grant_type: 'authorization_code', client_id: creds.clientId, redirect_uri: redirectUri, code_verifier: codeVerifier }),
    });
    if (!tokenResp.ok) throw new Error('Token exchange failed');
    const tokenData = await tokenResp.json();
    setProviderAuthState('dropbox', { authenticated: true, accessToken: tokenData.access_token, refreshToken: tokenData.refresh_token || null, accountId: tokenData.account_id, uid: tokenData.uid });
    sessionStorage.removeItem('cc-dropbox-code-verifier');
    window.history.replaceState({}, '', redirectUri);
    showToast('Dropbox authenticated!', 'success');
    return true;
  } catch (err) {
    showToast('Dropbox auth failed: ' + err.message, 'error');
    window.history.replaceState({}, '', redirectUri);
    return false;
  }
}

// ============================================================
// Authentication — OneDrive (MSAL.js PKCE)
// ============================================================

let _msalLoaded = false;
let _msalInstance = null;

function _loadMSAL() {
  return new Promise((resolve) => {
    if (typeof msal !== 'undefined') { resolve(true); return; }
    const s = document.createElement('script');
    s.src = 'https://alcdn.msauth.net/browser/msal-browser.min.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

export async function authenticateOneDrive() {
  const creds = CREDENTIALS.oneDrive;
  if (!creds.clientId || creds.clientId.startsWith('YOUR_')) {
    showToast('OneDrive: Set CREDENTIALS.oneDrive.clientId in sync.js', 'error');
    return false;
  }
  const loaded = await _loadMSAL();
  if (!loaded) { showToast('Failed to load MSAL.js library.', 'error'); return false; }
  try {
    _msalInstance = new msal.PublicClientApplication({
      auth: { clientId: creds.clientId, authority: creds.authority, redirectUri: _getRedirectUri().split('?')[0].split('#')[0] },
      cache: { cacheLocation: 'localStorage' },
    });
    const resp = await _msalInstance.handleRedirectPromise();
    if (resp && resp.accessToken) {
      setProviderAuthState('oneDrive', { authenticated: true, accessToken: resp.accessToken, account: resp.account, homeAccountId: resp.account?.homeAccountId });
      showToast('OneDrive authenticated!', 'success');
      return true;
    }
    const loginResp = await _msalInstance.loginPopup({ scopes: creds.scope.split(' '), prompt: 'select_account' });
    if (loginResp && loginResp.accessToken) {
      setProviderAuthState('oneDrive', { authenticated: true, accessToken: loginResp.accessToken, account: loginResp.account, homeAccountId: loginResp.account?.homeAccountId });
      showToast('OneDrive authenticated!', 'success');
      return true;
    }
  } catch (err) {
    if (err.message?.includes('popup') || err.errorCode === 'popup_window_error') {
      try {
        await _msalInstance.loginRedirect({ scopes: creds.scope.split(' ') });
        return true;
      } catch { showToast('OneDrive redirect auth failed. Check popup blocker.', 'error'); return false; }
    }
    showToast('OneDrive auth failed: ' + (err.errorMessage || err.message), 'error');
    return false;
  }
  return false;
}

// ============================================================
// Sync Operations
// ============================================================

export async function syncToCloud() {
  const provider = getCurrentProvider();
  if (!provider) { showToast('No cloud provider selected.', 'warning'); return; }
  const auth = getProviderAuthState(provider.id);
  if (provider.requiresAuth && !auth.authenticated) {
    showToast('Please authenticate with ' + provider.name + ' first.', 'warning');
    return;
  }
  showToast('Backing up to ' + provider.name + '...', 'info');
  try {
    const dbBackup = await getFullBackupLocal();
    const jsonStr = JSON.stringify(dbBackup);
    if (provider.id === 'webdav') await _syncToWebDAV(jsonStr, auth);
    else if (provider.id === 'googleDrive') await _syncToGoogleDrive(jsonStr, auth);
    else if (provider.id === 'dropbox') await _syncToDropbox(jsonStr, auth);
    else if (provider.id === 'oneDrive') await _syncToOneDrive(jsonStr, auth);
    setProviderAuthState(provider.id, { lastSync: new Date().toISOString() });
    showToast('Backup to ' + provider.name + ' complete!', 'success');
  } catch (err) {
    console.error('Cloud sync failed:', err);
    showToast('Sync failed: ' + err.message, 'error');
  }
}

export async function syncFromCloud() {
  const provider = getCurrentProvider();
  if (!provider) { showToast('No cloud provider selected.', 'warning'); return; }
  const auth = getProviderAuthState(provider.id);
  if (provider.requiresAuth && !auth.authenticated) {
    showToast('Please authenticate with ' + provider.name + ' first.', 'warning');
    return;
  }
  showToast('Restoring from ' + provider.name + '...', 'info');
  try {
    let jsonStr = null;
    if (provider.id === 'webdav') jsonStr = await _restoreFromWebDAV(auth);
    else if (provider.id === 'googleDrive') jsonStr = await _restoreFromGoogleDrive(auth);
    else if (provider.id === 'dropbox') jsonStr = await _restoreFromDropbox(auth);
    else if (provider.id === 'oneDrive') jsonStr = await _restoreFromOneDrive(auth);
    if (!jsonStr) { showToast('No backup file found.', 'info'); return; }
    const data = JSON.parse(jsonStr);
    await restoreBackupLocal(data);
    showToast('Restore complete! Reloading...', 'success');
    setTimeout(() => location.reload(), 2000);
  } catch (err) {
    console.error('Cloud restore failed:', err);
    showToast('Restore failed: ' + err.message, 'error');
  }
}

// ============================================================
// Provider-specific implementations
// ============================================================

async function _syncToWebDAV(jsonStr, auth) {
  const url = auth.url; const username = auth.username; const password = auth.password;
  if (!url) throw new Error('WebDAV URL not configured');
  const fullUrl = url.endsWith('/') ? url + 'coin_catalog_backup.json' : url + '/coin_catalog_backup.json';
  const headers = { 'Content-Type': 'application/json' };
  if (username && password) headers['Authorization'] = 'Basic ' + btoa(username + ':' + password);
  const response = await fetch(fullUrl, { method: 'PUT', headers, body: jsonStr });
  if (!response.ok) throw new Error('WebDAV upload failed (HTTP ' + response.status + ')');
}

async function _restoreFromWebDAV(auth) {
  const url = auth.url; const username = auth.username; const password = auth.password;
  if (!url) throw new Error('WebDAV URL not configured');
  const fullUrl = url.endsWith('/') ? url + 'coin_catalog_backup.json' : url + '/coin_catalog_backup.json';
  const headers = {};
  if (username && password) headers['Authorization'] = 'Basic ' + btoa(username + ':' + password);
  const response = await fetch(fullUrl, { method: 'GET', headers });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('WebDAV download failed (HTTP ' + response.status + ')');
  return await response.text();
}

// Google Drive
function _getGoogleAccessToken(auth) {
  if (auth.expiresAt && Date.now() > auth.expiresAt - 60000) return _refreshGoogleToken();
  return auth.accessToken;
}

async function _refreshGoogleToken() {
  try {
    const tokenResponse = await new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CREDENTIALS.googleDrive.clientId,
        scope: CREDENTIALS.googleDrive.scope,
        callback: (resp) => { if (resp.error) reject(new Error(resp.error)); else resolve(resp); },
        prompt: '',
      });
      client.requestAccessToken({ prompt: '' });
    });
    setProviderAuthState('googleDrive', { accessToken: tokenResponse.access_token, expiresAt: Date.now() + (tokenResponse.expires_in || 3600) * 1000 });
    return tokenResponse.access_token;
  } catch (err) { throw new Error('Google Drive token refresh failed: ' + err.message); }
}

async function _findOrCreateGDriveFile(token) {
  const listResp = await fetch('https://www.googleapis.com/drive/v3/files?q=name%3D%27coin_catalog_backup.json%27+and+%27appDataFolder%27+in+parents&spaces=appDataFolder&fields=files(id%2Cname)', { headers: { Authorization: 'Bearer ' + token } });
  if (!listResp.ok) throw new Error('Drive API list failed');
  const listData = await listResp.json();
  if (listData.files?.length > 0) return listData.files[0].id;
  const createResp = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'coin_catalog_backup.json', mimeType: 'application/json', parents: ['appDataFolder'] }),
  });
  if (!createResp.ok) throw new Error('Drive API create failed');
  const createData = await createResp.json();
  return createData.id;
}

async function _syncToGoogleDrive(jsonStr, auth) {
  const token = _getGoogleAccessToken(auth);
  const fileId = await _findOrCreateGDriveFile(token);
  const uploadResp = await fetch('https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=media', {
    method: 'PATCH', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: jsonStr,
  });
  if (!uploadResp.ok) { const errText = await uploadResp.text(); throw new Error('Drive upload failed: ' + errText); }
}

async function _restoreFromGoogleDrive(auth) {
  const token = _getGoogleAccessToken(auth);
  const listResp = await fetch('https://www.googleapis.com/drive/v3/files?q=name%3D%27coin_catalog_backup.json%27+and+%27appDataFolder%27+in+parents&spaces=appDataFolder&fields=files(id%2Cname)', { headers: { Authorization: 'Bearer ' + token } });
  if (!listResp.ok) throw new Error('Drive API list failed');
  const listData = await listResp.json();
  if (!listData.files?.length) return null;
  const dlResp = await fetch('https://www.googleapis.com/drive/v3/files/' + listData.files[0].id + '?alt=media', { headers: { Authorization: 'Bearer ' + token } });
  if (!dlResp.ok) throw new Error('Drive download failed');
  return await dlResp.text();
}

// Dropbox
async function _syncToDropbox(jsonStr, auth) {
  const token = auth.accessToken;
  if (!token) throw new Error('No Dropbox access token');
  const uploadResp = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Dropbox-API-Arg': JSON.stringify({ path: '/coin_catalog_backup.json', mode: 'overwrite', autorename: false, mute: true }), 'Content-Type': 'application/octet-stream' },
    body: new Blob([jsonStr], { type: 'application/json' }),
  });
  if (!uploadResp.ok) { const errBody = await uploadResp.text(); throw new Error('Dropbox upload failed: ' + errBody); }
}

async function _restoreFromDropbox(auth) {
  const token = auth.accessToken;
  if (!token) throw new Error('No Dropbox access token');
  const dlResp = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Dropbox-API-Arg': JSON.stringify({ path: '/coin_catalog_backup.json' }) },
  });
  if (dlResp.status === 409) return null;
  if (!dlResp.ok) throw new Error('Dropbox download failed');
  return await dlResp.text();
}

// OneDrive
async function _getOneDriveToken(auth) {
  if (!_msalInstance) throw new Error('MSAL not initialized');
  try {
    const resp = await _msalInstance.acquireTokenSilent({ scopes: CREDENTIALS.oneDrive.scope.split(' '), account: auth.account || { homeAccountId: auth.homeAccountId } });
    setProviderAuthState('oneDrive', { accessToken: resp.accessToken });
    return resp.accessToken;
  } catch {
    const resp = await _msalInstance.acquireTokenPopup({ scopes: CREDENTIALS.oneDrive.scope.split(' ') });
    setProviderAuthState('oneDrive', { accessToken: resp.accessToken });
    return resp.accessToken;
  }
}

async function _syncToOneDrive(jsonStr, auth) {
  const token = await _getOneDriveToken(auth);
  const uploadResp = await fetch('https://graph.microsoft.com/v1.0/me/drive/special/approot:/coin_catalog_backup.json:/content', {
    method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: jsonStr,
  });
  if (!uploadResp.ok) { const errBody = await uploadResp.text(); throw new Error('OneDrive upload failed: ' + errBody); }
}

async function _restoreFromOneDrive(auth) {
  const token = await _getOneDriveToken(auth);
  const dlResp = await fetch('https://graph.microsoft.com/v1.0/me/drive/special/approot:/coin_catalog_backup.json:/content', {
    method: 'GET', headers: { Authorization: 'Bearer ' + token },
  });
  if (dlResp.status === 404) return null;
  if (!dlResp.ok) throw new Error('OneDrive download failed');
  return await dlResp.text();
}

// ============================================================
// OAuth Callback Handler
// ============================================================

export async function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
  const code = params.get('code') || hashParams.get('code');
  if (code) await _handleDropboxCallback();
}
