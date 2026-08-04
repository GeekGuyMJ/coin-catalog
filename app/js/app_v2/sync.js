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

/**
 * ═══════════════════════════════════════════════════════════
 * CLOUD PROVIDER CREDENTIALS
 * ───────────────────────────────────────────────────────────
 * Register the app at each provider's developer console and
 * fill in the client IDs below. These are non-secret values
 * embedded in the client-side app.
 * 
 * Google Drive: https://console.cloud.google.com
 *   → APIs & Services → Credentials → OAuth 2.0 Client ID (Web application)
 *   → Authorized JavaScript origins: your app URL (e.g. https://geekguymj.github.io)
 *   → No redirect URI needed (uses popup/token model)
 * 
 * Dropbox: https://www.dropbox.com/developers/apps
 *   → Create app → Full Dropbox API → Choose 'Web' app type
 *   → Add redirect URIs: your-app-url/ (e.g. https://geekguymj.github.io/coin-catalog/app/)
 *   → Enable PKCE in app settings
 * 
 * OneDrive: https://portal.azure.com
 *   → App registrations → New registration (SPA type)
 *   → Redirect URI type: Single-page application (SPA)
 *   → URI: your-app-url/ (e.g. https://geekguymj.github.io/coin-catalog/app/)
 *   → API permissions: Files.ReadWrite.AppFolder
 * ═══════════════════════════════════════════════════════════
 */

const CREDENTIALS = {
  googleDrive: {
    clientId: '83040502093-ee0g8gfbrnplh1j56ochq4v5p0q6do5f.apps.googleusercontent.com',
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
    id: 'googleDrive',
    name: 'Google Drive',
    icon: '\u{1F310}',
    description: 'Backup to your Google Drive app folder. Uses Google Identity Services — sign in with your Google account.',
    requiresAuth: true,
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    icon: '\u{1F4E6}',
    description: 'Backup to your Dropbox. Uses PKCE OAuth flow — no server needed.',
    requiresAuth: true,
  },
  {
    id: 'oneDrive',
    name: 'OneDrive',
    icon: '\u{2601}',
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
// PKCE Utilities (for Dropbox and OneDrive)
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
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function _getRedirectUri() {
  // Use the current page URL — works on both LXC 115 and GitHub Pages
  return window.location.href.split('?')[0].split('#')[0];
}

// ============================================================
// Authentication — Google Drive (GIS Token Model)
// ============================================================

let _gisLoaded = false;

function _loadGIS() {
  return new Promise((resolve) => {
    if (typeof google !== 'undefined' && google.accounts) {
      resolve(true);
      return;
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
    showToast('Google Drive: app not registered. Set CREDENTIALS.googleDrive.clientId in sync.js', 'error');
    return false;
  }

  const loaded = await _loadGIS();
  if (!loaded) {
    showToast('Failed to load Google Identity Services.', 'error');
    return false;
  }

  try {
    const tokenResponse = await new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: creds.clientId,
        scope: creds.scope,
        callback: (resp) => {
          if (resp.error) reject(new Error(resp.error));
          else resolve(resp);
        },
        error_callback: (err) => reject(new Error(err?.message || 'Google auth failed')),
        prompt: 'consent',
      });
      client.requestAccessToken({ prompt: 'consent' });
    });

    const expiresAt = Date.now() + (tokenResponse.expires_in || 3600) * 1000;
    const accessToken = tokenResponse.access_token;
    setProviderAuthState('googleDrive', {
      authenticated: true,
      accessToken: accessToken,
      tokenType: tokenResponse.token_type || 'Bearer',
      expiresAt,
    });

    // Verify the granted token actually has the drive.appdata scope by hitting
    // the Drive API immediately. If Google didn't grant it (e.g. the scope isn't
    // configured in the OAuth consent screen), fail loudly instead of 403-ing later.
    try {
      const verify = await fetch(
        'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&pageSize=1&fields=files(id)',
        { headers: { Authorization: 'Bearer ' + accessToken } }
      );
      if (!verify.ok) {
        const body = await verify.text();
        showToast('Google Drive authenticated, but Drive API access was denied (HTTP ' + verify.status + '). Add the "drive.appdata" scope in Google Cloud Console → OAuth consent screen → Scopes.', 'error');
        console.error('Google Drive scope verification failed:', verify.status, body);
        return false;
      }
    } catch (vErr) {
      showToast('Google Drive authenticated, but Drive API check failed: ' + vErr.message, 'error');
      return false;
    }

    showToast('Google Drive authenticated!', 'success');
    return true;
  } catch (err) {
    console.error('Google Drive auth failed:', err);
    showToast('Google Drive authentication failed: ' + err.message, 'error');
    return false;
  }
}

// ============================================================
// Authentication — Dropbox (PKCE OAuth)
// ============================================================

export async function authenticateDropbox() {
  const creds = CREDENTIALS.dropbox;
  if (!creds.clientId || creds.clientId.startsWith('YOUR_')) {
    showToast('Dropbox: app not registered. Set CREDENTIALS.dropbox.clientId in sync.js', 'error');
    return false;
  }

  // Generate PKCE challenge
  const codeVerifier = _generateRandomString(64);
  const challengeHash = await _sha256(codeVerifier);
  const codeChallenge = _base64url(challengeHash);

  // Store verifier temporarily
  sessionStorage.setItem('cc-dropbox-code-verifier', codeVerifier);

  // Build auth URL
  const redirectUri = _getRedirectUri();
  const authUrl = 'https://www.dropbox.com/oauth2/authorize'
    + '?response_type=code'
    + '&client_id=' + encodeURIComponent(creds.clientId)
    + '&redirect_uri=' + encodeURIComponent(redirectUri)
    + '&code_challenge=' + encodeURIComponent(codeChallenge)
    + '&code_challenge_method=S256'
    + '&token_access_type=offline';

  // Redirect to Dropbox
  window.location.href = authUrl;
  // Execution stops here — the page navigates away
  // On return, _handleDropboxCallback() will be called
  return true;
}

/**
 * Handle Dropbox OAuth callback — call this from index.html on load
 * if the URL contains 'code=' parameter.
 */
export async function _handleDropboxCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');
  if (!code) return false;
  if (error) {
    showToast('Dropbox auth cancelled: ' + error, 'warning');
    // Clean URL
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
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: creds.clientId,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResp.ok) {
      const errBody = await tokenResp.text();
      throw new Error('Token exchange failed: ' + errBody);
    }

    const tokenData = await tokenResp.json();

    setProviderAuthState('dropbox', {
      authenticated: true,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || null,
      accountId: tokenData.account_id,
      uid: tokenData.uid,
      expiresAt: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : null,
    });

    sessionStorage.removeItem('cc-dropbox-code-verifier');

    // Clean URL params
    window.history.replaceState({}, '', redirectUri);

    showToast('Dropbox authenticated!', 'success');
    return true;
  } catch (err) {
    console.error('Dropbox token exchange failed:', err);
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
    if (typeof msal !== 'undefined') {
      resolve(true);
      return;
    }
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
    showToast('OneDrive: app not registered. Set CREDENTIALS.oneDrive.clientId in sync.js', 'error');
    return false;
  }

  const loaded = await _loadMSAL();
  if (!loaded) {
    showToast('Failed to load MSAL.js library.', 'error');
    return false;
  }

  try {
    _msalInstance = new msal.PublicClientApplication({
      auth: {
        clientId: creds.clientId,
        authority: creds.authority,
        redirectUri: _getRedirectUri().split('?')[0].split('#')[0],
      },
      cache: { cacheLocation: 'localStorage' },
    });

    // Handle potential redirect callback first
    const resp = await _msalInstance.handleRedirectPromise();
    if (resp && resp.accessToken) {
      // Came back from redirect — already authenticated
      const expiresAt = resp.expiresOn ? resp.expiresOn.getTime() : Date.now() + 3600000;
      setProviderAuthState('oneDrive', {
        authenticated: true,
        accessToken: resp.accessToken,
        account: resp.account,
        homeAccountId: resp.account?.homeAccountId,
        expiresAt,
      });
      showToast('OneDrive authenticated!', 'success');
      return true;
    }

    // Not a redirect — start login
    const loginResp = await _msalInstance.loginPopup({
      scopes: creds.scope.split(' '),
      prompt: 'select_account',
    });

    if (loginResp && loginResp.accessToken) {
      const expiresAt = loginResp.expiresOn ? loginResp.expiresOn.getTime() : Date.now() + 3600000;
      setProviderAuthState('oneDrive', {
        authenticated: true,
        accessToken: loginResp.accessToken,
        account: loginResp.account,
        homeAccountId: loginResp.account?.homeAccountId,
        expiresAt,
      });
      showToast('OneDrive authenticated!', 'success');
      return true;
    }
  } catch (err) {
    // If popup was blocked, fall back to redirect
    if (err.message?.includes('popup') || err.errorCode === 'popup_window_error') {
      try {
        await _msalInstance.loginRedirect({ scopes: creds.scope.split(' ') });
        return true; // won't reach here — navigation happens
      } catch (redirectErr) {
        showToast('OneDrive redirect auth also failed. Check popup blocker.', 'error');
        return false;
      }
    }
    console.error('OneDrive auth failed:', err);
    showToast('OneDrive authentication failed: ' + (err.errorMessage || err.message), 'error');
    return false;
  }

  return false;
}

// ============================================================
// Generic Sync Entry Points
// ============================================================

export async function syncToCloud() {
  const provider = getCurrentProvider();
  if (!provider) {
    showToast('No cloud provider selected. Open Settings → Cloud Sync first.', 'warning');
    return;
  }

  const auth = getProviderAuthState(provider.id);
  if (provider.requiresAuth && !auth.authenticated) {
    showToast('Please authenticate with ' + provider.name + ' first in Cloud Sync settings.', 'warning');
    return;
  }

  showToast('Backing up to ' + provider.name + '...', 'info');

  try {
    const dbBackup = await getFullBackupLocal();
    const jsonStr = JSON.stringify(dbBackup);

    if (provider.id === 'webdav') {
      await _syncToWebDAV(jsonStr, auth);
    } else if (provider.id === 'googleDrive') {
      await _syncToGoogleDrive(jsonStr, auth);
    } else if (provider.id === 'dropbox') {
      await _syncToDropbox(jsonStr, auth);
    } else if (provider.id === 'oneDrive') {
      await _syncToOneDrive(jsonStr, auth);
    }

    // Update last sync timestamp
    setProviderAuthState(provider.id, { lastSync: new Date().toISOString() });
    showToast('Backup to ' + provider.name + ' complete!', 'success');
  } catch (err) {
    console.error('Cloud sync failed:', err);
    showToast('Sync failed: ' + err.message, 'error');
  }
}

export async function syncFromCloud() {
  const provider = getCurrentProvider();
  if (!provider) {
    showToast('No cloud provider selected.', 'warning');
    return;
  }

  const auth = getProviderAuthState(provider.id);
  if (provider.requiresAuth && !auth.authenticated) {
    showToast('Please authenticate with ' + provider.name + ' first.', 'warning');
    return;
  }

  showToast('Restoring from ' + provider.name + '...', 'info');

  try {
    let jsonStr = null;

    if (provider.id === 'webdav') {
      jsonStr = await _restoreFromWebDAV(auth);
    } else if (provider.id === 'googleDrive') {
      jsonStr = await _restoreFromGoogleDrive(auth);
    } else if (provider.id === 'dropbox') {
      jsonStr = await _restoreFromDropbox(auth);
    } else if (provider.id === 'oneDrive') {
      jsonStr = await _restoreFromOneDrive(auth);
    }

    if (!jsonStr) {
      showToast('No backup file found in cloud storage.', 'info');
      return;
    }

    const data = JSON.parse(jsonStr);
    await restoreBackupLocal(data);
    showToast('Restore from ' + provider.name + ' complete! Reloading page...', 'success');
    setTimeout(() => location.reload(), 2000);
  } catch (err) {
    console.error('Cloud restore failed:', err);
    showToast('Restore failed: ' + err.message, 'error');
  }
}

// ============================================================
// Google Drive — Backup / Restore
// ============================================================

function _getGoogleAccessToken(auth) {
  if (!auth || !auth.accessToken) {
    throw new Error('Not authenticated with Google Drive. Please sign in again.');
  }
  if (auth.expiresAt && Date.now() > auth.expiresAt - 60000) {
    throw new Error('Google Drive session expired. Please sign in with Google Drive again.');
  }
  return auth.accessToken;
}

async function _refreshGoogleToken() {
  try {
    const tokenResponse = await new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CREDENTIALS.googleDrive.clientId,
        scope: CREDENTIALS.googleDrive.scope,
        callback: (resp) => {
          if (resp.error) reject(new Error(resp.error));
          else resolve(resp);
        },
        prompt: 'consent',
      });
      client.requestAccessToken({ prompt: 'consent' });
    });

    const expiresAt = Date.now() + (tokenResponse.expires_in || 3600) * 1000;
    setProviderAuthState('googleDrive', {
      accessToken: tokenResponse.access_token,
      expiresAt,
    });
    return tokenResponse.access_token;
  } catch (err) {
    throw new Error('Google Drive token refresh failed: ' + err.message);
  }
}

/**
 * Find or create a backup file in Google Drive appDataFolder.
 */
async function _findOrCreateGDriveFile(token) {
  // List existing backup files
  const listResp = await fetch(
    'https://www.googleapis.com/drive/v3/files?q=name%3D%27coin_catalog_backup.json%27+and+%27appDataFolder%27+in+parents&spaces=appDataFolder&fields=files(id%2Cname)',
    { headers: { Authorization: 'Bearer ' + token } }
  );
  if (!listResp.ok) throw new Error('Drive API list failed (HTTP ' + listResp.status + ')');
  const listData = await listResp.json();
  if (listData.files && listData.files.length > 0) {
    return listData.files[0].id; // existing file
  }
  // Create a new empty file
  const createResp = await fetch(
    'https://www.googleapis.com/drive/v3/files',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'coin_catalog_backup.json',
        mimeType: 'application/json',
        parents: ['appDataFolder'],
      }),
    }
  );
  if (!createResp.ok) throw new Error('Drive API create failed (HTTP ' + createResp.status + ')');
  const createData = await createResp.json();
  return createData.id;
}

async function _syncToGoogleDrive(jsonStr, auth) {
  const token = _getGoogleAccessToken(auth);
  const fileId = await _findOrCreateGDriveFile(token);

  // Upload content (media simple upload)
  const uploadResp = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=media',
    {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: jsonStr,
    }
  );
  if (!uploadResp.ok) {
    const errText = await uploadResp.text();
    throw new Error('Drive upload failed (HTTP ' + uploadResp.status + '): ' + errText);
  }
}

async function _restoreFromGoogleDrive(auth) {
  const token = _getGoogleAccessToken(auth);

  // List backup files
  const listResp = await fetch(
    'https://www.googleapis.com/drive/v3/files?q=name%3D%27coin_catalog_backup.json%27+and+%27appDataFolder%27+in+parents&spaces=appDataFolder&fields=files(id%2Cname)',
    { headers: { Authorization: 'Bearer ' + token } }
  );
  if (!listResp.ok) throw new Error('Drive API list failed (HTTP ' + listResp.status + ')');
  const listData = await listResp.json();
  if (!listData.files || listData.files.length === 0) return null;

  const fileId = listData.files[0].id;

  // Download file content
  const dlResp = await fetch(
    'https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media',
    { headers: { Authorization: 'Bearer ' + token } }
  );
  if (!dlResp.ok) throw new Error('Drive download failed (HTTP ' + dlResp.status + ')');
  return await dlResp.text();
}

// ============================================================
// Dropbox — Backup / Restore
// ============================================================

async function _syncToDropbox(jsonStr, auth) {
  const token = auth.accessToken;
  if (!token) throw new Error('No Dropbox access token');

  // Upload file via Dropbox API v2
  const uploadResp = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Dropbox-API-Arg': JSON.stringify({
        path: '/coin_catalog_backup.json',
        mode: 'overwrite',
        autorename: false,
        mute: true,
      }),
      'Content-Type': 'application/octet-stream',
    },
    body: new Blob([jsonStr], { type: 'application/json' }),
  });

  if (!uploadResp.ok) {
    const errBody = await uploadResp.text();
    throw new Error('Dropbox upload failed (HTTP ' + uploadResp.status + '): ' + errBody);
  }
}

async function _restoreFromDropbox(auth) {
  const token = auth.accessToken;
  if (!token) throw new Error('No Dropbox access token');

  // Download file
  const dlResp = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Dropbox-API-Arg': JSON.stringify({ path: '/coin_catalog_backup.json' }),
    },
  });

  if (dlResp.status === 409) return null; // File not found
  if (!dlResp.ok) throw new Error('Dropbox download failed (HTTP ' + dlResp.status + ')');
  return await dlResp.text();
}

// ============================================================
// OneDrive — Backup / Restore
// ============================================================

async function _getOneDriveToken(auth) {
  if (!_msalInstance) throw new Error('MSAL not initialized. Re-authenticate.');

  try {
    const resp = await _msalInstance.acquireTokenSilent({
      scopes: CREDENTIALS.oneDrive.scope.split(' '),
      account: auth.account || { homeAccountId: auth.homeAccountId },
    });
    // Update stored token
    const expiresAt = resp.expiresOn ? resp.expiresOn.getTime() : Date.now() + 3600000;
    setProviderAuthState('oneDrive', { accessToken: resp.accessToken, expiresAt });
    return resp.accessToken;
  } catch (err) {
    // Silent failover — try popup
    try {
      const resp = await _msalInstance.acquireTokenPopup({
        scopes: CREDENTIALS.oneDrive.scope.split(' '),
      });
      const expiresAt = resp.expiresOn ? resp.expiresOn.getTime() : Date.now() + 3600000;
      setProviderAuthState('oneDrive', { accessToken: resp.accessToken, expiresAt });
      return resp.accessToken;
    } catch (popupErr) {
      throw new Error('OneDrive token refresh failed: ' + (popupErr.errorMessage || popupErr.message));
    }
  }
}

async function _syncToOneDrive(jsonStr, auth) {
  const token = await _getOneDriveToken(auth);

  // Upload to OneDrive app folder — Graph API
  const uploadResp = await fetch(
    'https://graph.microsoft.com/v1.0/me/drive/special/approot:/coin_catalog_backup.json:/content',
    {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: jsonStr,
    }
  );
  if (!uploadResp.ok) {
    const errBody = await uploadResp.text();
    throw new Error('OneDrive upload failed (HTTP ' + uploadResp.status + '): ' + errBody);
  }
}

async function _restoreFromOneDrive(auth) {
  const token = await _getOneDriveToken(auth);

  // Download from OneDrive app folder
  const dlResp = await fetch(
    'https://graph.microsoft.com/v1.0/me/drive/special/approot:/coin_catalog_backup.json:/content',
    {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token },
    }
  );

  if (dlResp.status === 404) return null; // File doesn't exist yet
  if (!dlResp.ok) throw new Error('OneDrive download failed (HTTP ' + dlResp.status + ')');
  return await dlResp.text();
}

// ============================================================
// WebDAV — Backup / Restore (unchanged, already works)
// ============================================================

async function _syncToWebDAV(jsonStr, auth) {
  let url = auth.url;
  const username = auth.username;
  const password = auth.password;

  // Self-hosted: route through the same-origin /dav/ proxy if a Nextcloud
  // URL was entered (avoids cross-origin Basic-auth browser prompt)
  if (/nextcloud\.opaleye-bluegill\.ts\.net/i.test(url)) url = '/dav/';

  if (!url) throw new Error('WebDAV URL not configured');

  const filename = 'coin_catalog_backup.json';
  const fullUrl = url.endsWith('/') ? url + filename : url + '/' + filename;

  const headers = { 'Content-Type': 'application/json' };
  if (username && password) {
    headers['Authorization'] = 'Basic ' + btoa(username + ':' + password);
  }

  const response = await fetch(fullUrl, {
    method: 'PUT',
    headers,
    body: jsonStr,
  });

  if (!response.ok) {
    throw new Error('WebDAV upload failed (HTTP ' + response.status + ')');
  }
}

async function _restoreFromWebDAV(auth) {
  let url = auth.url;
  const username = auth.username;
  const password = auth.password;

  // Self-hosted: route through the same-origin /dav/ proxy if a Nextcloud
  // URL was entered (avoids cross-origin Basic-auth browser prompt)
  if (/nextcloud\.opaleye-bluegill\.ts\.net/i.test(url)) url = '/dav/';

  if (!url) throw new Error('WebDAV URL not configured');

  const filename = 'coin_catalog_backup.json';
  const fullUrl = url.endsWith('/') ? url + filename : url + '/' + filename;

  const headers = {};
  if (username && password) {
    headers['Authorization'] = 'Basic ' + btoa(username + ':' + password);
  }

  const response = await fetch(fullUrl, { method: 'GET', headers });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('WebDAV download failed (HTTP ' + response.status + ')');

  return await response.text();
}

// ============================================================
// OAuth Callback Handler — called from main.js on page load
// ============================================================

/**
 * Check if the current URL contains an OAuth callback and handle it.
 * Call this once on app startup.
 */
export async function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));

  // Dropbox: ?code=xxx
  if (params.has('code')) {
    const handled = await _handleDropboxCallback();
    if (handled) return true;
  }

  // OneDrive: uses #code=xxx or #access_token=xxx (MSAL handles this via handleRedirectPromise)
  if (hashParams.has('code') || hashParams.has('access_token') || hashParams.has('id_token')) {
    // OneDrive redirect is handled by MSAL's handleRedirectPromise called during authenticateOneDrive
    // But we need to trigger it on page load too
    if (typeof msal !== 'undefined' && _currentProviderId === 'oneDrive') {
      try {
        const msalInstance = new msal.PublicClientApplication({
          auth: {
            clientId: CREDENTIALS.oneDrive.clientId,
            authority: CREDENTIALS.oneDrive.authority,
            redirectUri: _getRedirectUri().split('?')[0].split('#')[0],
          },
          cache: { cacheLocation: 'localStorage' },
        });
        const resp = await msalInstance.handleRedirectPromise();
        if (resp && resp.accessToken) {
          const expiresAt = resp.expiresOn ? resp.expiresOn.getTime() : Date.now() + 3600000;
          setProviderAuthState('oneDrive', {
            authenticated: true,
            accessToken: resp.accessToken,
            account: resp.account,
            homeAccountId: resp.account?.homeAccountId,
            expiresAt,
          });
          showToast('OneDrive authenticated!', 'success');
          return true;
        }
      } catch (e) { /* ignore */ }
    }
  }

  return false;
}
