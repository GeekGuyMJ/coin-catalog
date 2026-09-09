/**
 * inventory.js — Coin Catalog v2
 *
 * Handles viewing and editing specific details for owned coins.
 * Uses the modal system to display the form.
 *
 * @module inventory
 */

import { openModal, closeModal } from './modals.js';
import { updateInventory } from './api.js';
import { getInventoryEntries } from './state.js';
import { showToast } from './notifications.js';
import { resizeToWebP } from './images.js';

let currentCoinId = null;
let currentEntries = [];
let currentEntryIndex = -1; // -1 means new unsaved copy
let currentPhotoB64 = null;

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
 * Process a selected or dropped file.
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
 * Triggered when the user clicks "Save Details" inside the modal.
 */
async function saveDetails() {
    if (!currentCoinId) return;

    const entryId = document.getElementById('inv-entry-id').value;
    const grade = document.getElementById('inv-grade').value.trim();
    const purchasePrice = parseFloat(document.getElementById('inv-purchase-price').value) || 0;
    const currentValue = parseFloat(document.getElementById('inv-current-value').value) || 0;
    const dateAcquired = document.getElementById('inv-date-acquired').value;
    const notes = document.getElementById('inv-notes').value.trim();

    // If it's an existing copy, preserve quantity, otherwise default to 1
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

    try {
        const result = await updateInventory(currentCoinId, payload);
        if (result.status === 'updated') {
            showToast('Details saved successfully.', 'success');
            
            // We use the custom event to trigger a full refetch in catalog.js
            window.dispatchEvent(new CustomEvent('cc-inventory-updated', { detail: { coinId: currentCoinId } }));
            
            closeModal('modal-inventory-details');
        } else {
            showToast('Failed to save details.', 'error');
        }
    } catch (err) {
        showToast(`Error saving details: ${err.message}`, 'error');
    }
}

// ============================================================
// Event Listeners & Drag/Drop
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('btn-save-inv');
    if (saveBtn) {
        saveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            saveDetails();
        });
    }

    const photoBtn = document.getElementById('inv-btn-photo');
    const fileInput = document.getElementById('inv-hidden-photo');
    
    if (photoBtn && fileInput) {
        photoBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handlePhotoSelect);
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

