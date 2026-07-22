/**
 * inventory.js — Coin Catalog v2
 *
 * Handles viewing and editing specific details for owned coins.
 * Uses the modal system to display the form.
 *
 * Design decisions:
 *   - Auto-save on input change (no save button)
 *   - Photo change triggers immediate save
 *   - Remove button deletes this coin's detail entry from the backend
 *   - Uses debounce (400ms) to avoid flooding API on every keystroke
 *
 * @module inventory
 */

import { openModal, closeModal } from './modals.v2.js';
import { updateInventory, deleteInventoryEntry } from './api.js';
import { getInventoryEntries } from './state.js';
import { showToast } from './notifications.js';
import { resizeToWebP } from './images.js';

let currentCoinId = null;
let currentEntries = [];
let currentEntryIndex = -1; // -1 means new unsaved copy
let currentPhotoB64 = null;
let _saveTimer = null;

/**
 * Open the details modal for a specific coin reference ID.
 * @param {number} coinId
 */
export function openInventoryDetails(coinId) {
    currentCoinId = parseInt(coinId, 10);
    currentEntries = getInventoryEntries(currentCoinId) || [];

    currentEntryIndex = currentEntries.length > 0 ? 0 : -1;

    loadFormForCurrentIndex();

    openModal('modal-inventory-details');
}



/**
 * Populate the form fields based on the selected copy.
 */
function loadFormForCurrentIndex() {
    const item = currentEntryIndex >= 0 ? currentEntries[currentEntryIndex] : null;

    document.getElementById('inv-coin-id').value = currentCoinId;
    document.getElementById('inv-entry-id').value = item && item.id ? item.id : '';
    document.getElementById('inv-grade').value = item ? item.grade : '';
    document.getElementById('inv-purchase-price').value = item && item.purchase_price ? item.purchase_price : '';
    document.getElementById('inv-current-value').value = item && item.current_value ? item.current_value : '';
    document.getElementById('inv-date-acquired').value = item ? item.date_acquired : '';
    document.getElementById('inv-notes').value = item ? item.notes : '';

    currentPhotoB64 = null;
    const photoNameEl = document.getElementById('inv-photo-name');
    if (item && item.personal_photo) {
        photoNameEl.textContent = 'Existing photo saved';
    } else {
        photoNameEl.textContent = 'Drop an image here or click upload';
    }
}

/**
* Process a selected or dropped file. Also triggers auto-save.
*/
async function processFile(file) {
    if (!file || !file.type.startsWith('image/')) {
        showToast('Please select a valid image file.', 'error');
        return;
    }
    try {
        const resizedB64 = await resizeToWebP(file);
        currentPhotoB64 = resizedB64;
        document.getElementById('inv-photo-name').textContent = file.name;
        // Photo change triggers immediate save
        debouncedSave();
    } catch (err) {
        showToast('Failed to process image.', 'error');
    }
}

/**
 * Handle user picking a new personal photo via button.
 */
function handlePhotoSelect(e) {
    processFile(e.target.files?.[0]);
}

/**
 * Collect current form data into a payload object.
 */
function collectPayload() {
    const entryId = document.getElementById('inv-entry-id').value;
    const grade = document.getElementById('inv-grade').value.trim();
    const purchasePrice = parseFloat(document.getElementById('inv-purchase-price').value) || 0;
    const currentValue = parseFloat(document.getElementById('inv-current-value').value) || 0;
    const dateAcquired = document.getElementById('inv-date-acquired').value;
    const notes = document.getElementById('inv-notes').value.trim();

    const existing = currentEntryIndex >= 0 ? currentEntries[currentEntryIndex] : null;
    const qty = existing ? existing.quantity : 1;

    const payload = {
        coin_ref_id: currentCoinId,
        quantity: qty,
        grade: grade,
        purchase_price: purchasePrice,
        current_value: currentValue,
        date_acquired: dateAcquired,
        notes: notes
    };

    if (entryId) payload.id = parseInt(entryId, 10);
    if (currentPhotoB64) payload.personal_photo = currentPhotoB64;

    return payload;
}

/**
 * Save details to the backend. Called by debounced auto-save.
 */
async function saveDetails() {
    if (!currentCoinId) return;

    const payload = collectPayload();

    try {
        const result = await updateInventory(currentCoinId, payload);
        if (result.status === 'updated') {
            // Notify other modules to refresh
            window.dispatchEvent(new CustomEvent('cc-inventory-updated', { detail: { coinId: currentCoinId } }));
            // Refresh local entries so re-opened modal shows fresh data
            const { fetchInventory } = await import('./api.js');
            const { setInventory } = await import('./state.js');
            const newInv = await fetchInventory();
            setInventory(newInv);
            currentEntries = getInventoryEntries(currentCoinId) || [];
            showToast('Details saved.', 'success');
        } else {
            showToast('Failed to save details.', 'error');
        }
    } catch (err) {
        showToast(`Error saving: ${err.message}`, 'error');
    }
}

/**
 * Debounced auto-save — waits 400ms after last input change.
 */
function debouncedSave() {
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
        saveDetails();
        _saveTimer = null;
    }, 400);
}

/**
 * Remove this coin's detail entry from the backend.
 */
async function removeDetails() {
    if (!currentCoinId) return;
    const entryId = document.getElementById('inv-entry-id').value;

    if (entryId) {
        // Delete specific entry by ID
        try {
            await deleteInventoryEntry(parseInt(entryId, 10));
            showToast('Entry removed.', 'info');
        } catch (err) {
            showToast(`Error removing: ${err.message}`, 'error');
            return;
        }
    } else {
        // No entry ID means unsaved — just close
        showToast('No saved entry to remove.', 'info');
    }

    // Refresh inventory state
    const { fetchInventory } = await import('./api.js');
    const { setInventory } = await import('./state.js');
    const newInv = await fetchInventory();
    setInventory(newInv);
    window.dispatchEvent(new CustomEvent('cc-inventory-updated', { detail: { coinId: currentCoinId } }));
    closeModal('modal-inventory-details');
}

// ============================================================
// Event Listeners & Drag/Drop
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // Auto-save on input change
    const form = document.getElementById('inv-details-form');
    if (form) {
        form.addEventListener('input', () => {
            debouncedSave();
        });
    }

    // Photo upload
    const photoBtn = document.getElementById('inv-btn-photo');
    const fileInput = document.getElementById('inv-hidden-photo');
    if (photoBtn && fileInput) {
        photoBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handlePhotoSelect);
    }

    // Remove button
    const removeBtn = document.getElementById('ii-btn-remove');
    if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            removeDetails();
        });
    }

    // Drag and Drop for Inventory Modal
    const invModal = document.getElementById('modal-inventory-details');
    if (invModal) {
        invModal.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });
        invModal.addEventListener('drop', (e) => {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                processFile(e.dataTransfer.files[0]);
            }
        });
    }
});

