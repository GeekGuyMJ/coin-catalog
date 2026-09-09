/**
 * images.js — Coin Catalog v2
 *
 * Handles all image-related interactions:
 * - Viewing coin images in a dedicated modal
 * - Circular cropping tool using HTML5 Canvas
 * - File uploads and Coin Bank integration
 * - API calls to assign images to types/items
 *
 * @module images
 */

import { openModal, closeModal, closeAllModals } from './modals.js';
import { assignImage, fetchCoinBankImages, saveToCoinBank } from './api.js';
import { showToast } from './notifications.js';
import { el, placeholderCoinSvg } from './utils.js';
import { setTypeConfigs } from './state.js';
import { fetchTypeConfigs } from './api.js';

// ============================================================
// State
// ============================================================

let activeContext = {
    el: null,       // The img element that was clicked
    typeStr: '',    // Full coin type string
    side: '',       // 'obv' or 'rev'
    isItem: false,  // If clicked from a specific inventory item
    itemId: null,   // inventory item ID
    b64: '',        // Current working image data (base64)
};

// Crop tool state
let cropImg = new Image();
let ctx_crop = null;
let isDraggingCrop = false;
let dragStartX, dragStartY;
let cropOffX = 0, cropOffY = 0, cropScale = 1;

// ============================================================
// Public Entry Points
// ============================================================

/**
 * Open the main image interaction modal.
 */
export function openImageInteractionModal(imgEl, typeStr, side, isItem = false, itemId = null) {
    activeContext = { el: imgEl, typeStr, side, isItem, itemId, b64: '' };

    const preview = document.getElementById('ii-main-image');
    const title   = document.getElementById('ii-title');
    const removeBtn = document.getElementById('ii-btn-remove');

    title.textContent = `${side === 'obv' ? 'Obverse' : 'Reverse'}: ${typeStr}`;
    
    const src = imgEl ? imgEl.src : '';
    const isGeneric = !src || src.includes('data:image/svg');

    if (isGeneric) {
        // Placeholder — open the image-interaction modal briefly so
        // openReplaceWorkflow() can close it cleanly (prevents scroll-lock).
        preview.src = placeholderCoinSvg();
        removeBtn.style.display = 'none';
        openModal('modal-image-interaction');
        openReplaceWorkflow();
        return;
    }

    preview.src = src;
    removeBtn.style.display = 'block';
    
    openModal('modal-image-interaction');
}

/**
 * Open the replace/upload workflow modal.
 */
export function openReplaceWorkflow() {
    closeModal('modal-image-interaction');
    
    const scopeLabel = document.getElementById('scope-lbl-item');
    if (scopeLabel) {
        scopeLabel.style.display = activeContext.isItem ? 'flex' : 'none';
    }
    
    // Reset scope selection to default
    const radios = document.querySelectorAll('input[name="img_scope"]');
    if (radios.length) radios[1].checked = true; // Default to "all"

    document.getElementById('scope-selection-box').style.display = 'none';
    document.getElementById('btn-execute-assign').style.display = 'none';

    openModal('modal-replace-scope');
}

/**
 * Trigger file upload input.
 */
export function triggerFileUpload() {
    document.getElementById('ii-hidden-file-input').click();
}

/**
 * Resize and convert an image file to 300x300 WebP before use.
 * This prevents 413 errors and keeps storage reasonable.
 *
 * @param {File} file - Image file from file input or drop.
 * @returns {Promise<string>} Base64 WebP data URI, 300×300px.
 */
export async function resizeToWebP(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = (e) => {
            const img = new Image();
            img.onerror = reject;
            img.onload = () => {
                const SIZE = 300;
                const canvas = document.createElement('canvas');
                canvas.width  = SIZE;
                canvas.height = SIZE;
                const ctx = canvas.getContext('2d');

                // Scale to fit within 300x300, centered, with black background
                const scale = Math.max(SIZE / img.width, SIZE / img.height);
                const drawW = img.width  * scale;
                const drawH = img.height * scale;
                const offsetX = (SIZE - drawW) / 2;
                const offsetY = (SIZE - drawH) / 2;

                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, SIZE, SIZE);
                ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

                resolve(canvas.toDataURL('image/webp', 0.85));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

export async function handleNewUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
        const resized = await resizeToWebP(file);
        activeContext.b64 = resized;
        openCropTool(resized);

        // Background: Save to Coin Bank (already 300x300 WebP — small)
        saveToCoinBank({
            coin_type:   activeContext.typeStr,
            side:        activeContext.side,
            image:       resized,
            is_personal: false,
            tags:        '',
        }).catch(err => console.warn('[images] Failed to save to bank:', err));
    } catch (err) {
        import('./utils.js').then(utils => utils.showToast(`Failed to process image: ${err.message}`, 'error'));
    }
}

/**
 * Open the circular crop tool.
 */
export function openCropTool(imgSrc) {
    closeModal('modal-replace-scope');
    closeModal('modal-image-interaction');

    const canvas = document.getElementById('crop-canvas');
    ctx_crop = canvas.getContext('2d');
    
    const container = document.getElementById('crop-container');
    const size = container.clientWidth;
    canvas.width = size;
    canvas.height = size;

    cropImg = new Image();
    cropImg.onload = () => {
        const scaleX = canvas.width / cropImg.width;
        const scaleY = canvas.height / cropImg.height;
        cropScale = Math.min(scaleX, scaleY);
        
        const zoomInput = document.getElementById('crop-zoom');
        zoomInput.min = cropScale * 0.5;
        zoomInput.max = cropScale * 3;  // Tightened range for precise centering
        zoomInput.value = cropScale;
        zoomInput.step = 0.0005;  // Ultra-fine granularity

        cropOffX = (canvas.width - cropImg.width * cropScale) / 2;
        cropOffY = (canvas.height - cropImg.height * cropScale) / 2;
        
        drawCropCanvas();
    };
    cropImg.src = imgSrc || activeContext.el.src;

    openModal('modal-crop');
}

/**
 * Perform circular crop and return to scope selection.
 */
export function saveCrop() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 400;
    tempCanvas.height = 400;
    const ctx = tempCanvas.getContext('2d');

    const canvas = document.getElementById('crop-canvas');
    const cw = canvas.width;
    const ch = canvas.height;
    const cx = cw / 2;
    const cy = ch / 2;
    const radius = (Math.min(cw, ch) * 0.8) / 2; // Matches CSS overlay (80% width)

    // Calculate crop coordinates relative to original image
    const sx = (cx - radius - cropOffX) / cropScale;
    const sy = (cy - radius - cropOffY) / cropScale;
    const sw = (radius * 2) / cropScale;
    const sh = (radius * 2) / cropScale;

    // Draw circular mask
    ctx.beginPath();
    ctx.arc(200, 200, 200, 0, Math.PI * 2);
    ctx.clip();

    // Draw the image section
    ctx.drawImage(cropImg, sx, sy, sw, sh, 0, 0, 400, 400);

    activeContext.b64 = tempCanvas.toDataURL('image/webp', 0.85);
    
    closeModal('modal-crop');
    openModal('modal-replace-scope');
    showScopeSelection();
}

/**
 * Remove current image (set to empty).
 * Shows an inline confirmation toast instead of browser confirm().
 */
export function removeCurrentImage() {
    const removeBtn = document.getElementById('ii-btn-remove');
    if (!removeBtn) return;

    // First press: show a confirmation state on the button itself.
    if (removeBtn.dataset.confirming !== 'true') {
        removeBtn.dataset.confirming = 'true';
        const originalText = removeBtn.textContent;
        removeBtn.textContent = '⚠️ Confirm Remove';
        removeBtn.style.background = '#7f1d1d';
        showToast('Click "Confirm Remove" again to permanently delete this image.', 'warning', 4000);
        // Auto-reset after 4 seconds
        setTimeout(() => {
            removeBtn.dataset.confirming = '';
            removeBtn.textContent = originalText;
            removeBtn.style.background = '';
        }, 4000);
        return;
    }

    // Second press: confirmed
    removeBtn.dataset.confirming = '';
    activeContext.b64 = '';
    activeContext.scope = activeContext.isItem ? 'specific_item' : 'all';
    executeImageAssignment();
}

/**
 * Call the API to save the image assignment.
 * On success: closes all modals, refetches type configs, and re-renders the
 * catalog in-place — no page reload, no lost accordion/scroll state.
 */
export async function executeImageAssignment() {
    const scopeEle = document.querySelector('input[name="img_scope"]:checked');
    const scope = activeContext.scope || (scopeEle ? scopeEle.value : 'all');

    try {
        const result = await assignImage({
            coin_type: activeContext.typeStr,
            side:      activeContext.side,
            image:     activeContext.b64,
            scope:     scope,
            item_id:   activeContext.itemId
        });

        if (result.status === 'success' || result.status === 'skipped') {
            showToast(result.message || 'Image updated successfully', 'success');
            closeAllModals();

            // Soft re-render: refetch type configs (images live there) and
            // rerender sections — preserves all accordion/scroll state.
            try {
                const updatedConfigs = await fetchTypeConfigs();
                setTypeConfigs(updatedConfigs);
            } catch (cfgErr) {
                console.warn('[images] Could not refresh type configs:', cfgErr);
            }

            // Fire the standard catalog update event so catalog.js re-renders.
            window.dispatchEvent(new CustomEvent('cc-inventory-updated', { detail: { coinId: null } }));
        } else {
            showToast(result.error || 'Failed to update image', 'error');
        }
    } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
    }
}

// ============================================================
// Coin Bank
// ============================================================

export async function openCoinBankModal() {
    closeModal('modal-replace-scope');
    openModal('modal-coin-bank');
    
    const label = document.getElementById('cb-context-label');
    if (label) label.textContent = `Showing images for ${activeContext.typeStr}`;
    
    loadCoinBankImages('context');
}

async function loadCoinBankImages(mode) {
    const grid = document.getElementById('coin-bank-grid');
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--color-text-muted);">Loading bank...</div>';

    // Toggle button styles
    const btnCtx = document.getElementById('cb-filter-ctx');
    const btnAll = document.getElementById('cb-filter-all');
    if (mode === 'context') {
        btnCtx.className = 'btn-primary';
        btnAll.className = 'btn-secondary';
    } else {
        btnCtx.className = 'btn-secondary';
        btnAll.className = 'btn-primary';
    }

    try {
        const params = mode === 'context' ? { coin_type: activeContext.typeStr, side: activeContext.side } : {};
        const images = await fetchCoinBankImages(params);

        if (!images.length) {
            grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--color-text-muted);">No images found in bank.</div>';
            return;
        }

        grid.innerHTML = '';
        images.forEach(img => {
            const card = el('div', {
                style: 'border:1px solid var(--color-border-light); border-radius:var(--radius-md); overflow:hidden; background:var(--color-bg-card); cursor:pointer; transition:transform 0.1s;',
                onclick: () => selectBankImage(img.filename)
            },
                el('img', { src: img.filename, style: 'width:100%; height:100px; object-fit:contain;' }),
                el('div', { style: 'padding:var(--space-1) var(--space-2); font-size:var(--font-size-xs); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;', title: img.coin_type }, img.coin_type)
            );
            card.onmouseenter = () => card.style.transform = 'scale(1.03)';
            card.onmouseleave = () => card.style.transform = 'scale(1)';
            grid.appendChild(card);
        });
    } catch (err) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--color-danger);">Error: ${err.message}</div>`;
    }
}

function selectBankImage(b64) {
    activeContext.b64 = b64;
    closeModal('modal-coin-bank');
    openModal('modal-replace-scope');
    showScopeSelection();
}

function showScopeSelection() {
    document.getElementById('scope-selection-box').style.display = 'block';
    document.getElementById('btn-execute-assign').style.display = 'block';
}

// ============================================================
// Internal Helpers
// ============================================================

function drawCropCanvas() {
    if (!ctx_crop) return;
    const cw = ctx_crop.canvas.width;
    const ch = ctx_crop.canvas.height;
    
    ctx_crop.clearRect(0, 0, cw, ch);
    ctx_crop.drawImage(cropImg, cropOffX, cropOffY, cropImg.width * cropScale, cropImg.height * cropScale);
}

function handleZoom(val) {
    const oldW = cropImg.width * cropScale;
    const oldH = cropImg.height * cropScale;
    cropScale = parseFloat(val);
    const newW = cropImg.width * cropScale;
    const newH = cropImg.height * cropScale;
    
    const cx = ctx_crop.canvas.width / 2;
    const cy = ctx_crop.canvas.height / 2;
    cropOffX = cx - (cx - cropOffX) * (newW / oldW);
    cropOffY = cy - (cy - cropOffY) * (newH / oldH);
    drawCropCanvas();
}

// ============================================================
// Initialization & Event Delegation
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // Zoom slider
    const zoomInput = document.getElementById('crop-zoom');
    if (zoomInput) zoomInput.addEventListener('input', e => handleZoom(e.target.value));

    // Crop panning
    const cropContainer = document.getElementById('crop-container');
    if (cropContainer) {
        cropContainer.addEventListener('pointerdown', e => {
            isDraggingCrop = true;
            dragStartX = e.clientX - cropOffX;
            dragStartY = e.clientY - cropOffY;
            cropContainer.setPointerCapture(e.pointerId);
        });
        cropContainer.addEventListener('pointermove', e => {
            if (!isDraggingCrop) return;
            cropOffX = e.clientX - dragStartX;
            cropOffY = e.clientY - dragStartY;
            drawCropCanvas();
        });
        cropContainer.addEventListener('pointerup', e => {
            isDraggingCrop = false;
            cropContainer.releasePointerCapture(e.pointerId);
        });
    }

    // Modal action buttons
    document.addEventListener('click', e => {
        const target = e.target;
        
        if (target.dataset.action === 'ii-crop') openCropTool();
        if (target.dataset.action === 'ii-replace') openReplaceWorkflow();
        if (target.id === 'btn-save-crop') saveCrop();
        if (target.id === 'btn-upload-file') triggerFileUpload();
        if (target.id === 'btn-open-bank') openCoinBankModal();
        if (target.id === 'btn-execute-assign') executeImageAssignment();
        if (target.id === 'ii-btn-remove') removeCurrentImage();
        
        // Navigation back buttons
        if (target.dataset.action === 'close-crop') { closeModal('modal-crop'); openModal('modal-image-interaction'); }
        if (target.dataset.action === 'close-replace') { closeModal('modal-replace-scope'); openModal('modal-image-interaction'); }
        if (target.dataset.action === 'close-bank') { closeModal('modal-coin-bank'); openModal('modal-replace-scope'); }

        // Filter buttons in bank
        if (target.id === 'cb-filter-ctx') loadCoinBankImages('context');
        if (target.id === 'cb-filter-all') loadCoinBankImages('all');
    });

    const fileInput = document.getElementById('ii-hidden-file-input');
    if (fileInput) fileInput.addEventListener('change', handleNewUpload);

    // Drag and Drop for Replace Scope Modal
    const replaceModal = document.getElementById('modal-replace-scope');
    if (replaceModal) {
        replaceModal.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });
        replaceModal.addEventListener('drop', (e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file && file.type.startsWith('image/')) {
                // Mock an event object to reuse handleNewUpload
                handleNewUpload({ target: { files: [file] } });
            } else {
                import('./notifications.js').then(m => m.showToast('Please drop a valid image file.', 'error'));
            }
        });
    }
});
