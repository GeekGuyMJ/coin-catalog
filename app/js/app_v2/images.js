/**
 * images.js — Coin Catalog v2
 * Handles all image-related interactions:
 * - Viewing coin images in a dedicated modal
 * - Circular cropping tool using HTML5 Canvas
 * - File uploads and Coin Bank integration
 * - API calls to assign images to types/items
 *
 * @module images
 */

import { openModal, closeModal, closeAllModals, openModalLegacy, closeModalLegacy } from './modals.v2.js';
import { assignImage, fetchCoinBankImages, saveToCoinBank, deleteCoinBankImage, updateCoinBankImageInfo, resetImageToMaster, checkMaster, promoteToDefault } from './api.js';
import { showToast } from './notifications.js';
import { el, placeholderCoinSvg, getMainType } from './utils.js';
import { setTypeConfigs, getSections, getCoinsForSection, getInventoryEntries } from './state.js';
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
    scope: 'all',   // Current scope for assignment
};

// Crop tool state
let cropImg = new Image();
let ctx_crop = null;
let isDraggingCrop = false;
let dragStartX, dragStartY;
let cropOffX = 0, cropOffY = 0, cropScale = 1;
let cropRotation = 0; // in degrees
let initialCropScale = 1;

// ============================================================
// Public Entry Points
// ============================================================

/**
 * Open the main image interaction modal.
 */
export function openImageInteractionModal(imgEl, typeStr, side, isItem = false, itemId = null, coinId = null) {
    activeContext = { 
        el: imgEl, 
        typeStr, 
        side, 
        isItem, 
        itemId, 
        coinId,
        b64: '', 
        scope: isItem ? 'specific_item' : 'all' 
    };

    const preview = document.getElementById('ii-main-image');
    const title   = document.getElementById('ii-title');
    const removeBtn = document.getElementById('ii-btn-remove');
    const saveBtn = document.getElementById('ii-btn-save');
    const resetBtn = document.getElementById('ii-btn-reset-master');
    const promoteBtn = document.getElementById('ii-btn-promote-default');

    const src = imgEl ? imgEl.src : '';
    const isUserTier = src.includes('/types/user/');
    const isMasterTier = src.includes('/types/master/');
    const isGeneric = !src || src.includes('data:image/svg');
    activeContext.isGeneric = isGeneric;

    if (side === 'personal') {
        title.textContent = `Personal Photo: ${typeStr}`;
        if (resetBtn) resetBtn.style.display = 'none';
        if (promoteBtn) promoteBtn.style.display = 'none';
    } else {
        title.textContent = `${side === 'obv' ? 'Obverse' : 'Reverse'}: ${typeStr}`;
        // Master image system removed — no reset, no promote
        if (resetBtn) resetBtn.style.display = 'none';
        if (promoteBtn) promoteBtn.style.display = 'none';
    }

    if (isGeneric) {
        openReplaceWorkflow();
        return;
    }

    preview.src = src;
    if (removeBtn) removeBtn.style.display = 'block';
    saveBtn.style.display = 'none'; // Hide save button initially
    
    openModalLegacy('modal-image-interaction');
}

/**
 * Open the replace/upload workflow modal.
 */
export function openReplaceWorkflow() {
    closeModalLegacy('modal-image-interaction');
    
    const scopeLabel = document.getElementById('scope-lbl-item');
    if (scopeLabel) {
        scopeLabel.style.display = activeContext.isItem ? 'flex' : 'none';
    }
    
    // Reset scope selection to default
    const radios = document.querySelectorAll('input[name="img_scope"]');
    if (radios.length) {
        if (activeContext.isItem) {
            radios[0].checked = true;
        } else {
            radios[1].checked = true; // Default to "all"
        }
    }
    
    document.getElementById('scope-selection-box').style.display = 'none';
    document.getElementById('btn-execute-assign').style.display = 'none';
    
    openModalLegacy('modal-replace-scope');
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
                const MAX_DIM = 2048;
                let w = img.width;
                let h = img.height;
                
                if (w > MAX_DIM || h > MAX_DIM) {
                    const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
                    w = Math.round(w * ratio);
                    h = Math.round(h * ratio);
                }
                
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');

                ctx.drawImage(img, 0, 0, w, h);

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

    // Reset the input so the same file can be re-selected
    e.target.value = '';

    try {
        const resized = await resizeToWebP(file);
        activeContext.b64 = resized;
        activeContext.scope = activeContext.isItem ? 'specific_item' : 'all';
        openCropTool(resized);

        // Background: Save to Coin Bank (already 300x300 WebP — small)
        if (!activeContext.isItem) {
            saveToCoinBank({
                coin_type:   activeContext.typeStr,
                side:        activeContext.side,
                image:       resized,
                is_personal: false,
                tags:        '',
            }).catch(err => console.warn('[images] Failed to save to bank:', err));
        }
    } catch (err) {
        import('./notifications.js').then(m => m.showToast(`Failed to process image: ${err.message}`, 'error'));
    }
}

/**
 * Open the circular crop tool.
 */
export function openCropTool(imgSrc) {
    closeModalLegacy('modal-replace-scope');
    closeModalLegacy('modal-image-interaction');
    
    // Must open modal first so container has dimensions
    openModalLegacy('modal-crop');

    const canvas = document.getElementById('crop-canvas');
    ctx_crop = canvas.getContext('2d');

    const container = document.getElementById('crop-container');
    const size = container.clientWidth || 280; // Constrain to container client width
    canvas.width = size;
    canvas.height = size;

    cropRotation = 0;
    const rotateInput = document.getElementById('crop-rotate');
    if (rotateInput) {
        rotateInput.value = 0;
        const valLabel = document.getElementById('rotate-val');
        if (valLabel) valLabel.textContent = '0°';
    }
    
    // Determine crop shape based on coin type
    const isPaperCurrency = activeContext && activeContext.typeStr && (
        activeContext.typeStr.includes('Paper') ||
        activeContext.typeStr.includes('Banknote') ||
        activeContext.typeStr.includes('Currency') ||
        activeContext.typeStr.includes('Note') ||
        activeContext.typeStr.includes('Dollar') ||
        activeContext.typeStr.includes('Bill')
    );
    const isPersonalPhoto = activeContext && activeContext.side === 'personal';
    if (isPersonalPhoto) {
        cropShape = 'original';
    } else if (isPaperCurrency) {
        cropShape = 'rect';
    } else {
        cropShape = 'circle';
    }
    
    // Update crop container class for CSS styling
    if (cropShape === 'original') {
        container.className = 'crop-container crop-shape-circle';
        container.style.borderRadius = '0';
    } else {
        container.className = 'crop-container crop-shape-' + cropShape;
        container.style.borderRadius = cropShape === 'circle' ? '50%' : '0';
    }
    
    // Update shape label
    const shapeLabel = document.getElementById('crop-shape-label');
    if (shapeLabel) {
        if (cropShape === 'original')     shapeLabel.textContent = '■ Original';
        else if (cropShape === 'circle') shapeLabel.textContent = 'Circle';
        else if (cropShape === 'rect')   shapeLabel.textContent = '▭ Dollar Bill';
        else if (cropShape === 'square') shapeLabel.textContent = '■ Square';
    }

    cropImg = new Image();
    cropImg.onload = () => {
        // Fit image within the 80% visible crop circle at 1.0x zoom
        // so the whole image is visible inside the dashed ring
        const visibleR = 0.8;
        const scaleX = (canvas.width * visibleR) / cropImg.width;
        const scaleY = (canvas.height * visibleR) / cropImg.height;
        cropScale = Math.min(scaleX, scaleY);
        initialCropScale = cropScale;

        const zoomInput = document.getElementById('crop-zoom');
        if (zoomInput) {
            zoomInput.min = cropScale * 0.5;
            zoomInput.max = cropScale * 3;  // Tightened range for precise centering
            zoomInput.value = cropScale;
            zoomInput.step = 0.0005;  // Ultra-fine granularity
            
            const valLabel = document.getElementById('zoom-val');
            if (valLabel) valLabel.textContent = '1.0x';
        }

        cropOffX = (canvas.width - cropImg.width * cropScale) / 2;
        cropOffY = (canvas.height - cropImg.height * cropScale) / 2;

        drawCropCanvas();
    };
    
    const preview = document.getElementById('ii-main-image');
    cropImg.src = imgSrc || (preview && preview.src) || (activeContext.el ? activeContext.el.src : '');
}

/**
 * Perform circular crop and save to the appropriate destination.
 * For slot photos: save directly to the slot.
 * For other images: return to scope selection.
 */
export function saveCrop() {
    const isRect = cropShape === 'rect';
    const isSquare = cropShape === 'square';
    const isOriginal = cropShape === 'original';
    const outSize = isRect ? 614 : (isOriginal ? (cropImg ? cropImg.naturalWidth || cropImg.width : 800) : 400);
    const outHeight = isRect ? 235 : (isOriginal ? (cropImg ? cropImg.naturalHeight || cropImg.height : 600) : 400);
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = outSize;
    tempCanvas.height = outHeight;
    const ctx = tempCanvas.getContext('2d');

    const canvas = document.getElementById('crop-canvas');
    const cw = canvas.width;
    const ch = canvas.height;
    const cx = cw / 2;
    const cy = ch / 2;
    const radius = (Math.min(cw, ch) * 0.8) / 2; // Matches CSS overlay (80% width)

    // Draw mask based on shape
    if (isRect) {
        // Rectangular mask for paper currency
        const maskW = outSize;
        const maskH = outHeight;
        ctx.beginPath();
        ctx.roundRect(0, 0, maskW, maskH, 8);
        ctx.clip();
    } else if (isSquare) {
        // Square mask
        ctx.beginPath();
        ctx.rect(0, 0, outSize, outSize);
        ctx.clip();
    } else if (isOriginal) {
        // No mask — full image
        ctx.beginPath();
        ctx.rect(0, 0, outSize, outHeight);
        ctx.clip();
    } else {
        // Circular mask (default)
        ctx.beginPath();
        ctx.arc(outSize/2, outHeight/2, Math.min(outSize, outHeight)/2, 0, Math.PI * 2);
        ctx.clip();
    }

    ctx.save();
    ctx.translate(outSize/2, outHeight/2);
    ctx.rotate(cropRotation * Math.PI / 180);
    
    const scaleFactor = isRect ? (outSize / (radius * 2)) : (isOriginal ? 1 : (400 / (radius * 2)));
    const dx = (cropOffX - cx) * scaleFactor;
    const dy = (cropOffY - cy) * scaleFactor;
    const dw = cropImg.width * cropScale * scaleFactor;
    const dh = cropImg.height * cropScale * scaleFactor;
    
    ctx.drawImage(cropImg, dx, dy, dw, dh);
    ctx.restore();

    activeContext.b64 = tempCanvas.toDataURL('image/webp', 0.85);
    
    // Update preview in main modal
    const preview = document.getElementById('ii-main-image');
    if (preview) {
        preview.src = activeContext.b64;
    }

    closeModalLegacy('modal-crop');
    
    if (!activeContext.isItem) {
        // Main type spot: no scope selection needed, execute immediately
        executeImageAssignment();
    } else {
        openModalLegacy('modal-replace-scope');
        showScopeSelection();
    }
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
        removeBtn.textContent = 'Confirm Remove';
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
 * Save current image (apply changes).
 */
export function saveCurrentImage() {
    if (!activeContext.b64 && !activeContext.el.src.includes('data:image/svg')) {
        showToast('No image to save', 'warning');
        return;
    }
    
    activeContext.scope = activeContext.isItem ? 'specific_item' : 'all';
    executeImageAssignment();
}

/**
 * Reset the current coin type/side back to its master image.
 */
export async function resetToMaster() {
    if (!activeContext.typeStr) {
        showToast('No coin type selected', 'warning');
        return;
    }
    
    // First press confirmation
    const resetBtn = document.getElementById('ii-btn-reset-master');
    if (resetBtn && resetBtn.dataset.confirming !== 'true') {
        resetBtn.dataset.confirming = 'true';
        resetBtn.textContent = 'Confirm Reset';
        resetBtn.style.background = '#92400e';
        showToast('Click "Confirm Reset" again to restore the master image.', 'warning', 4000);
        setTimeout(() => {
            resetBtn.dataset.confirming = '';
            resetBtn.textContent = 'Reset to Master';
            resetBtn.style.background = '';
        }, 4000);
        return;
    }
    
    // Reset the button state
    if (resetBtn) {
        resetBtn.dataset.confirming = '';
        resetBtn.textContent = 'Reset to Master';
        resetBtn.style.background = '';
    }
    
    try {
        const result = await resetImageToMaster(activeContext.typeStr, activeContext.side);
        if (result.status === 'success') {
            showToast(result.message || 'Reset to master image', 'success');
            
            // Soft re-render: refetch type configs
            try {
                const updatedConfigs = await fetchTypeConfigs();
                setTypeConfigs(updatedConfigs);
                
                // Update the detail panel image and all view-img elements
                const targetMainType = getMainType(activeContext.typeStr);
                const field = activeContext.side === 'obv' ? 'obv_image' : 'rev_image';
                let newImageUrl = updatedConfigs[activeContext.typeStr]?.[field] ||
                                   updatedConfigs[targetMainType]?.[field];
                if (newImageUrl && !newImageUrl.includes('?')) newImageUrl += '?v=2';
                
                if (newImageUrl) {
                    // 1. Update the detail panel preview
                    const preview = document.getElementById('ii-main-image');
                    if (preview) preview.src = newImageUrl;
                    
                    const imgElements = document.querySelectorAll('img[data-action="view-img"]');
                    imgElements.forEach(img => {
                        const imgType = img.dataset.type;
                        const imgSide = img.dataset.side;
                        const hasSubtype = activeContext.typeStr.includes(' - ');
                        const shouldUpdate = (activeContext.side === 'rev' && hasSubtype)
                            ? (imgType === activeContext.typeStr)
                            : (getMainType(imgType) === targetMainType || imgType === activeContext.typeStr);
                            
                        if (imgSide === activeContext.side && shouldUpdate) {
                            if (newImageUrl) {
                                img.src = newImageUrl;
                                img.classList.remove('placeholder');
                            } else {
                                import('./utils.js').then(m => {
                                    img.src = m.placeholderCoinSvg();
                                    img.classList.add('placeholder');
                                });
                            }
                        }
                    });
                    
                    // 3. Clear local coin state so it falls back to type config
                    getSections().forEach(sec => {
                        const coins = getCoinsForSection(sec.section);
                        if (coins) {
                            coins.forEach(c => {
                                const hasSubtype = activeContext.typeStr.includes(' - ');
                                const shouldUpdate = (activeContext.side === 'rev' && hasSubtype)
                                    ? (c.coin_type === activeContext.typeStr)
                                    : (getMainType(c.coin_type) === targetMainType || c.coin_type === activeContext.typeStr);
                                    
                                if (shouldUpdate) {
                                    c[field] = null;
                                }
                            });
                        }
                    });
                } else {
                    // Update main preview to placeholder if we deleted the image entirely
                    const preview = document.getElementById('ii-main-image');
                    import('./utils.js').then(m => {
                        if (preview) preview.src = m.placeholderCoinSvg();
                    });
                    
                    const imgElements = document.querySelectorAll('img[data-action="view-img"]');
                    imgElements.forEach(img => {
                        const imgType = img.dataset.type;
                        const imgSide = img.dataset.side;
                        const hasSubtype = activeContext.typeStr.includes(' - ');
                        const shouldUpdate = (activeContext.side === 'rev' && hasSubtype)
                            ? (imgType === activeContext.typeStr)
                            : (getMainType(imgType) === targetMainType || imgType === activeContext.typeStr);
                            
                        if (imgSide === activeContext.side && shouldUpdate) {
                            import('./utils.js').then(m => {
                                img.src = m.placeholderCoinSvg();
                                img.classList.add('placeholder');
                            });
                        }
                    });
                    
                    getSections().forEach(sec => {
                        const coins = getCoinsForSection(sec.section);
                        if (coins) {
                            coins.forEach(c => {
                                const hasSubtype = activeContext.typeStr.includes(' - ');
                                const shouldUpdate = (activeContext.side === 'rev' && hasSubtype)
                                    ? (c.coin_type === activeContext.typeStr)
                                    : (getMainType(c.coin_type) === targetMainType || c.coin_type === activeContext.typeStr);
                                if (shouldUpdate) c[field] = null;
                            });
                        }
                    });
                }
            } catch (cfgErr) {
                console.warn('[images] Could not refresh type configs:', cfgErr);
            }
            
            window.dispatchEvent(new CustomEvent('cc-inventory-updated', { detail: { coinId: activeContext.coinId } }));
        } else {
            showToast(result.error || 'No master image available for this type.', 'error');
        }
    } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
    }
}

/**
 * Promote the current user image to serve as the default for this coin type
 * (when no bundled master image exists).
 */
export async function promoteToDefaultHandler() {
    if (!activeContext.typeStr) {
        showToast('No coin type selected', 'warning');
        return;
    }
    
    // First press confirmation
    const promoteBtn = document.getElementById('ii-btn-promote-default');
    if (promoteBtn && promoteBtn.dataset.confirming !== 'true') {
        promoteBtn.dataset.confirming = 'true';
        promoteBtn.textContent = 'Confirm Promote';
        promoteBtn.style.background = '#065f46';
        showToast('Click Confirm Promote again to make this the default image.', 'warning', 4000);
        setTimeout(() => {
            promoteBtn.dataset.confirming = '';
            promoteBtn.textContent = 'Promote to Default';
            promoteBtn.style.background = '';
        }, 4000);
        return;
    }
    
    // Reset button state
    if (promoteBtn) {
        promoteBtn.dataset.confirming = '';
        promoteBtn.textContent = 'Promote to Default';
        promoteBtn.style.background = '';
    }
    
    try {
        const result = await promoteToDefault(activeContext.typeStr, activeContext.side);
        if (result.status === 'success') {
            showToast('Image promoted as the default!', 'success');
            
            // Refresh type configs
            const updatedConfigs = await fetchTypeConfigs();
            setTypeConfigs(updatedConfigs);
            
            const targetMainType = getMainType(activeContext.typeStr);
            const field = activeContext.side === 'obv' ? 'obv_image' : 'rev_image';
            const newImageUrl = result.promoted_url ||
                               updatedConfigs[activeContext.typeStr]?.[field] ||
                               updatedConfigs[targetMainType]?.[field];
            
            if (newImageUrl) {
                const preview = document.getElementById('ii-main-image');
                if (preview) preview.src = newImageUrl;
                
                const imgElements = document.querySelectorAll('img[data-action="view-img"]');
                imgElements.forEach(img => {
                    const imgType = img.dataset.type;
                    const imgSide = img.dataset.side;
                    if (imgSide === activeContext.side &&
                        (getMainType(imgType) === targetMainType || imgType === activeContext.typeStr)) {
                        img.src = newImageUrl;
                        img.classList.remove('placeholder');
                    }
                });
                
                getSections().forEach(sec => {
                    const coins = getCoinsForSection(sec.section);
                    if (coins) {
                        coins.forEach(c => {
                            if (getMainType(c.coin_type) === targetMainType || c.coin_type === activeContext.typeStr) {
                                c[field] = null;
                            }
                        });
                    }
                });
            }
            
            window.dispatchEvent(new CustomEvent('cc-inventory-updated', { detail: { coinId: activeContext.coinId } }));
            
            // After promotion, swap Promote button for Reset button
            if (promoteBtn) promoteBtn.style.display = 'none';
            const resetBtn = document.getElementById('ii-btn-reset-master');
            if (resetBtn) {
                resetBtn.style.display = 'inline-block';
                resetBtn.dataset.confirming = '';
                resetBtn.textContent = 'Reset to Master';
                resetBtn.style.background = '';
            }
        } else if (result.status === 'skipped') {
            showToast(result.message, 'info');
        }
    } catch (err) {
        showToast(`Failed to promote: ${err.message}`, 'error');
    }
}

/**
 * Call the API to save the image assignment.
 * On success: closes all modals, refetches type configs, and re-renders the
 * catalog in-place — no page reload, no lost accordion/scroll state.
 */
export async function executeImageAssignment() {
    const scopeEle = document.querySelector('input[name="img_scope"]:checked');
    const isScopeModalOpen = document.getElementById('modal-replace-scope')?.classList.contains('open');
    let scope = (isScopeModalOpen && scopeEle) ? scopeEle.value : (activeContext.scope || 'all');

    if (scope === 'specific_item' && activeContext.side !== 'personal') {
        scope = 'specific_coin';
    }

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
            if (activeContext.isItem) {
                closeModalLegacy('modal-image-interaction');
                closeModalLegacy('modal-replace-scope');
                closeModalLegacy('modal-crop');
            } else {
                closeAllModals();
            }

            // Soft re-render: refetch type configs (images live there) and
            // rerender sections — preserves all accordion/scroll state.
            try {
                const updatedConfigs = await fetchTypeConfigs();
                setTypeConfigs(updatedConfigs);

                // If type-level change, update local state & DOM immediately so change is visual instantly
                if (scope === 'all' || scope === 'empty_only') {
                    const targetMainType = getMainType(activeContext.typeStr);
                    const field = activeContext.side === 'obv' ? 'obv_image' : 'rev_image';
                    const newImageUrl = updatedConfigs[activeContext.typeStr]?.[field] || 
                                       updatedConfigs[targetMainType]?.[field];
                                       
                    // 1. Clear matching local coins in state
                    getSections().forEach(sec => {
                        const coins = getCoinsForSection(sec.section);
                        if (coins) {
                            coins.forEach(c => {
                                const hasSubtype = activeContext.typeStr.includes(' - ');
                                const shouldUpdate = (activeContext.side === 'rev' && hasSubtype)
                                    ? (c.coin_type === activeContext.typeStr)
                                    : (getMainType(c.coin_type) === targetMainType || c.coin_type === activeContext.typeStr);
                                    
                                if (shouldUpdate) {
                                    const imgVal = c[field];
                                    if (imgVal && (imgVal.includes('/images/types/') || imgVal === newImageUrl)) {
                                        c[field] = null; // Clear so it falls back to type config
                                    }
                                }
                            });
                        }
                    });
                    
                    // 2. Update all matching IMG elements in the DOM immediately
                    const imgElements = document.querySelectorAll('img[data-action="view-img"]');
                    imgElements.forEach(img => {
                        const imgType = img.dataset.type;
                        const imgSide = img.dataset.side;
                        const hasSubtype = activeContext.typeStr.includes(' - ');
                        const shouldUpdate = (activeContext.side === 'rev' && hasSubtype)
                            ? (imgType === activeContext.typeStr)
                            : (getMainType(imgType) === targetMainType || imgType === activeContext.typeStr);
                            
                        if (imgSide === activeContext.side && shouldUpdate) {
                            if (newImageUrl) {
                                img.src = newImageUrl;
                                img.classList.remove('placeholder');
                            } else {
                                import('./utils.js').then(m => {
                                    img.src = m.placeholderCoinSvg();
                                    img.classList.add('placeholder');
                                });
                            }
                        }
                    });
                }
            } catch (cfgErr) {
                console.warn('[images] Could not refresh type configs:', cfgErr);
            }

            // Fire the standard catalog update event so catalog.js re-renders.
            window.dispatchEvent(new CustomEvent('cc-inventory-updated', { detail: { coinId: activeContext.coinId } }));
            
            // Also update the original image element if it exists and is an IMG element
            if (activeContext.el && activeContext.el.tagName === 'IMG' && activeContext.b64) {
                activeContext.el.src = activeContext.b64;
            } else if (activeContext.el && activeContext.el.tagName === 'IMG' && !activeContext.b64) {
                // If removing image, reset to placeholder
                activeContext.el.src = placeholderCoinSvg();
            }
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
    closeModalLegacy('modal-replace-scope');
    openModalLegacy('modal-coin-bank');

    const label = document.getElementById('cb-context-label');
    if (label) label.textContent = `Showing images for ${activeContext.typeStr}`;

    // Update button text to show the actual coin type
    const ctxBtn = document.getElementById('cb-filter-ctx');
    if (ctxBtn && activeContext.typeStr) {
        ctxBtn.textContent = `${activeContext.typeStr}`;
    } else if (ctxBtn) {
        ctxBtn.textContent = 'Current Type';
    }

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
                style: 'border:1px solid var(--color-border-light); border-radius:var(--radius-md); overflow:hidden; background:var(--color-bg-card); cursor:pointer; transition:transform 0.1s; position:relative;',
                onclick: (e) => {
                    if (e.target.tagName !== 'SELECT') {
                        selectBankImage(img);
                    }
                }
            },
                el('img', { src: img.filename, style: 'width:100%; height:100px; object-fit:contain;' }),
                el('div', { 
                    style: 'position:absolute; top:0; left:0; background:rgba(0,0,0,0.7); color:white; padding:2px 4px; font-size:0.7rem;',
                    onclick: (e) => { e.stopPropagation(); editCoinBankImage(img); },
                    title: 'Edit Image Context'
                }, ''),
                el('div', { 
                    style: 'position:absolute; top:0; right:0; background:rgba(255,0,0,0.8); color:white; padding:2px 4px; font-size:0.7rem;',
                    onclick: (e) => { e.stopPropagation(); deleteCoinBankImageConfirm(img); },
                    title: 'Delete from Bank'
                }, ''),
                el('div', { 
                    style: 'padding:var(--space-1); display:flex; flex-direction:column; gap:4px;'
                },
                    el('div', { 
                        style: 'font-size:var(--font-size-xs); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;', 
                        title: img.coin_type 
                    }, img.coin_type),
                    el('select', {
                        style: 'font-size:0.75rem; padding:2px; width:100%; border:1px solid var(--color-border); border-radius:4px; background:var(--color-bg-input); color:var(--color-text-main); cursor:pointer;',
                        onchange: (e) => {
                            e.stopPropagation();
                            renameCoinBankImage(img, e.target.value);
                        }
                    }, 
                        el('option', { value: 'obv', selected: img.side === 'obv' }, 'Obverse'),
                        el('option', { value: 'rev', selected: img.side === 'rev' }, 'Reverse'),
                        el('option', { value: 'err', selected: img.side === 'err' }, 'Error'),
                        el('option', { value: 'proof', selected: img.side === 'proof' }, 'Proof'),
                        el('option', { value: 'unknown', selected: img.side === 'unknown' }, 'Unknown')
                    )
                )
            );
            card.onmouseenter = () => card.style.transform = 'scale(1.03)';
            card.onmouseleave = () => card.style.transform = 'scale(1)';
            // Add tier badge overlay (M=master, U=user)
            if (img.tier) {
                const tier = img.tier === 'master' ? 'M' : 'U';
                const tierColor = img.tier === 'master' ? 'rgba(0,150,50,0.8)' : 'rgba(200,150,0,0.8)';
                const badge = document.createElement('div');
                badge.textContent = tier;
                badge.title = img.tier === 'master' ? 'Master image (default)' : 'User image (custom)';
                Object.assign(badge.style, {
                    position: 'absolute',
                    bottom: '4px',
                    right: '4px',
                    background: tierColor,
                    color: 'white',
                    padding: '1px 5px',
                    fontSize: '0.65rem',
                    fontWeight: '700',
                    borderRadius: '3px',
                    lineHeight: '1.3',
                    zIndex: '2',
                    pointerEvents: 'none',
                });
                card.appendChild(badge);
            }
            grid.appendChild(card);
        });
    } catch (err) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--color-danger);">Error: ${err.message}</div>`;
    }
}

function selectBankImage(img) {
    activeContext.b64 = img.filename;
    // Update preview in main modal
    const preview = document.getElementById('ii-main-image');
    if (preview) {
        preview.src = activeContext.b64;
    }
    closeModalLegacy('modal-coin-bank');
    
    if (!activeContext.isItem) {
        // Main type spot: no scope selection needed, execute immediately
        executeImageAssignment();
    } else {
        openModalLegacy('modal-replace-scope');
        showScopeSelection();
    }
}

async function deleteCoinBankImageConfirm(img) {
    if (confirm(`Delete this image for ${img.coin_type} ${img.side}? This cannot be undone.`)) {
        try {
            await deleteCoinBankImage(img.filename);
            showToast('Image deleted from coin bank', 'success');
            // Refresh the bank view
            const ctxBtn = document.getElementById('cb-filter-ctx');
            loadCoinBankImages(ctxBtn && ctxBtn.className.includes('btn-primary') ? 'context' : 'all');
        } catch (err) {
            showToast(`Failed to delete image: ${err.message}`, 'error');
        }
    }
}

async function renameCoinBankImage(img, newSide) {
    try {
        const response = await fetch('/api/coin_bank_images/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: img.filename, new_side: newSide })
        });
        const res = await response.json();
        if (!response.ok) throw new Error(res.error || 'Failed to rename image');
        
        showToast('Image side updated', 'success');
        
        // Refresh the bank view
        const ctxBtn = document.getElementById('cb-filter-ctx');
        loadCoinBankImages(ctxBtn && ctxBtn.className.includes('btn-primary') ? 'context' : 'all');
        
        // If it's used in the catalog immediately, trigger an update?
        // Let's just emit the image updated event just in case
        window.dispatchEvent(new CustomEvent('cc-image-updated'));
    } catch (err) {
        showToast(`Failed to update image side: ${err.message}`, 'error');
    }
}

async function editCoinBankImage(img) {
    // Store current context
    const originalTypeStr = activeContext.typeStr;
    const originalSide = activeContext.side;
    
    // Set context to this image
    activeContext.typeStr = img.coin_type;
    activeContext.side = img.side;
    activeContext.b64 = img.filename;
    
    // Open replace workflow to allow changing type/side or uploading new image
    closeModalLegacy('modal-coin-bank');
    openReplaceWorkflow();
    
    // Update scope label to show we're editing a bank image
    const scopeLabel = document.getElementById('scope-lbl-item');
    if (scopeLabel) {
        scopeLabel.textContent = 'Editing bank image';
        scopeLabel.style.display = 'flex';
    }
}

// ============================================================
// Internal Helpers
// ============================================================

function showScopeSelection() {
    document.getElementById('scope-selection-box').style.display = 'block';
    document.getElementById('btn-execute-assign').style.display = 'block';
}

// Inject premium drag-and-drop stylesheet
const dragDropStyle = document.createElement('style');
dragDropStyle.textContent = `
    .drag-target-highlight {
        outline: 2px dashed var(--color-accent, #60a5fa) !important;
        outline-offset: 2px !important;
        transform: scale(1.03) !important;
        transition: transform 0.2s ease, outline 0.2s ease, box-shadow 0.2s ease !important;
        box-shadow: 0 0 10px rgba(96, 165, 250, 0.5) !important;
        position: relative;
    }
    .drag-target-hover {
        outline: 2px solid #10b981 !important;
        box-shadow: 0 0 15px rgba(16, 185, 129, 0.7) !important;
        transform: scale(1.08) !important;
    }
`;
document.head.appendChild(dragDropStyle);

function eventHasFiles(e) {
    if (!e.dataTransfer) return false;
    const types = e.dataTransfer.types;
    if (!types) return false;
    for (let i = 0; i < types.length; i++) {
        if (types[i] === 'Files') return true;
    }
    return false;
}

function getDropZone(element) {
    if (!element) return null;
    
    if (element.id === 'ii-main-image' || element.closest('#ii-main-image')) {
        return { type: 'main-img', el: document.getElementById('ii-main-image') };
    }

    const photoCircle = element.closest('.coin-entry-photo-circle');
    if (photoCircle) {
        return { type: 'personal-slot', el: photoCircle };
    }

    const photoPreview = element.closest('.slot-photo-preview');
    if (photoPreview) {
        return { type: 'personal-slot', el: photoPreview };
    }

    const detailImg = element.closest('.modal-detail-img-container');
    if (detailImg) {
        return { type: 'detail-img', el: detailImg };
    }

    const viewImg = element.closest('[data-action="view-img"]');
    if (viewImg) {
        return { type: 'view-img', el: viewImg };
    }

    const albumHole = element.closest('.album-hole');
    if (albumHole && !albumHole.classList.contains('example-hole')) {
        return { type: 'album-hole', el: albumHole };
    }

    return null;
}

function resolveCoinDetailsFromElement(el) {
    const wrapper = el.closest('.coin-row-wrapper');
    let coinId = null;
    let coinType = null;
    
    if (wrapper) {
        const coinRow = wrapper.querySelector('.coin-row');
        if (coinRow) {
            coinId = parseInt(coinRow.dataset.coinId, 10);
            coinType = coinRow.dataset.coinType;
        }
    }
    
    if (!coinId) {
        const modal = el.closest('[id^="modal-coin-detail-"]');
        if (modal) {
            const idMatch = modal.id.match(/modal-coin-detail-(\d+)/);
            if (idMatch) {
                coinId = parseInt(idMatch[1], 10);
            }
        }
    }
    
    if (!coinId) {
        const stepper = el.closest('.modal-coin-detail-wrap')?.querySelector('[data-coin-id]');
        if (stepper) {
            coinId = parseInt(stepper.dataset.coinId, 10);
        }
    }
    
    return { coinId, coinType };
}

function getCoinFromState(coinId) {
    for (const s of getSections()) {
        const coins = getCoinsForSection(s.section);
        if (coins) {
            const coin = coins.find(c => c.id === coinId);
            if (coin) return coin;
        }
    }
    return null;
}

function highlightDropTargets(show) {
    const selectors = [
        '[data-action="view-img"]',
        '.coin-entry-photo-circle',
        '.slot-photo-preview',
        '.modal-detail-img-container',
        '#ii-main-image',
        '.album-hole:not(.example-hole)'
    ];
    const targets = document.querySelectorAll(selectors.join(', '));
    targets.forEach(el => {
        if (show) {
            el.classList.add('drag-target-highlight');
        } else {
            el.classList.remove('drag-target-highlight');
            el.classList.remove('drag-target-hover');
        }
    });
}

async function handleDroppedImage(file, dropZone) {
    try {
        const resized = await resizeToWebP(file);
        
        if (dropZone.type === 'main-img') {
            activeContext.b64 = resized;
        } else if (dropZone.type === 'personal-slot') {
            const { coinId } = resolveCoinDetailsFromElement(dropZone.el);
            if (!coinId) throw new Error('Could not determine coin ID');
            
            const coin = getCoinFromState(coinId);
            const typeStr = coin ? coin.coin_type : '';
            
            const instanceCard = dropZone.el.closest('.coin-entry-card');
            const instanceIdx = instanceCard ? parseInt(instanceCard.dataset.instanceIdx, 10) : 0;
            const entries = getInventoryEntries(coinId) || [];
            const entry = entries[instanceIdx] || {};
            
            activeContext = {
                el: dropZone.el,
                typeStr: typeStr,
                side: 'personal',
                isItem: true,
                itemId: entry.id,
                coinId: coinId,
                b64: resized,
                scope: 'specific_item'
            };
        } else if (dropZone.type === 'detail-img') {
            const { coinId } = resolveCoinDetailsFromElement(dropZone.el);
            if (!coinId) throw new Error('Could not determine coin ID');
            
            const coin = getCoinFromState(coinId);
            const typeStr = coin ? coin.coin_type : '';
            const side = localStorage.getItem(`cc-flipped-${coinId}`) || 'obv';
            const imgEl = dropZone.el.tagName === 'IMG' ? dropZone.el : dropZone.el.querySelector('img');
            
            activeContext = {
                el: imgEl || dropZone.el,
                typeStr: typeStr,
                side: side,
                isItem: true,
                itemId: coinId,
                coinId: coinId,
                b64: resized,
                scope: 'all'
            };
        } else if (dropZone.type === 'view-img') {
            const imgBtn = dropZone.el;
            const type = imgBtn.dataset.type || '';
            const side = imgBtn.dataset.side || 'obv';
            const coinId = imgBtn.dataset.coinId ? parseInt(imgBtn.dataset.coinId, 10) : null;
            const isCoinRef = !!coinId;
            
            activeContext = {
                el: imgBtn,
                typeStr: type,
                side: side,
                isItem: isCoinRef,
                itemId: coinId,
                coinId: coinId,
                b64: resized,
                scope: isCoinRef ? 'specific_item' : 'all'
            };
        } else if (dropZone.type === 'album-hole') {
            const hole = dropZone.el;
            const coinId = parseInt(hole.dataset.coinId, 10);
            const type = hole.dataset.coinType || '';
            const side = localStorage.getItem(`cc-flipped-${coinId}`) || 'obv';
            const isCoinRef = !!coinId;
            const imgEl = hole.querySelector('.album-hole-img');
            
            activeContext = {
                el: imgEl || hole,
                typeStr: type,
                side: side,
                isItem: isCoinRef,
                itemId: coinId,
                coinId: coinId,
                b64: resized,
                scope: isCoinRef ? 'specific_item' : 'all'
            };
        }
        
        openCropTool(resized);
        
        if (!activeContext.isItem && activeContext.side !== 'personal') {
            saveToCoinBank({
                coin_type:   activeContext.typeStr,
                side:        activeContext.side,
                image:       resized,
                is_personal: false,
                tags:        '',
            }).catch(err => console.warn('[images] Failed to save to bank:', err));
        }
    } catch (err) {
        showToast(`Failed to process dropped image: ${err.message}`, 'error');
    }
}

// ============================================================
// Initialization & Event Delegation
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    if (window.__cc_images_events_bound) return;
    window.__cc_images_events_bound = true;

    // Zoom slider
    const zoomInput = document.getElementById('crop-zoom');
    if (zoomInput) {
        zoomInput.addEventListener('input', e => {
            handleZoom(e.target.value);
            const valLabel = document.getElementById('zoom-val');
            if (valLabel) valLabel.textContent = (parseFloat(e.target.value) / initialCropScale).toFixed(1) + 'x';
        });
    }

    // Rotation slider
    const rotateInput = document.getElementById('crop-rotate');
    if (rotateInput) {
        rotateInput.addEventListener('input', e => {
            cropRotation = parseInt(e.target.value, 10);
            const valLabel = document.getElementById('rotate-val');
            if (valLabel) valLabel.textContent = cropRotation + '°';
            drawCropCanvas();
        });
    }

    // Crop panning & gestures
    const cropContainer = document.getElementById('crop-container');
    if (cropContainer) {
        cropContainer.addEventListener('pointerdown', e => {
            if (e.pointerType === 'touch' && !e.isPrimary) {
                isDraggingCrop = false;
                try { cropContainer.releasePointerCapture(e.pointerId); } catch(ex) {}
                return;
            }
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
            try { cropContainer.releasePointerCapture(e.pointerId); } catch(ex) {}
        });

        // Pinch to Zoom gesture support
        let initialPinchDistance = 0;
        let initialPinchScale = 1;

        cropContainer.addEventListener('touchstart', e => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                initialPinchDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                initialPinchScale = cropScale;
            }
        }, { passive: false });

        cropContainer.addEventListener('touchmove', e => {
            if (e.touches.length === 2 && initialPinchDistance > 0) {
                e.preventDefault();
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                if (dist > 0) {
                    const zInput = document.getElementById('crop-zoom');
                    const minVal = parseFloat(zInput?.min || 0.1);
                    const maxVal = parseFloat(zInput?.max || 4);
                    const newScale = initialPinchScale * (dist / initialPinchDistance);
                    const clamped = Math.max(minVal, Math.min(maxVal, newScale));
                    
                    handleZoom(clamped);
                    if (zInput) zInput.value = clamped;
                    const valLabel = document.getElementById('zoom-val');
                    if (valLabel) valLabel.textContent = (clamped / initialCropScale).toFixed(1) + 'x';
                }
            }
        }, { passive: false });

        cropContainer.addEventListener('touchend', e => {
            if (e.touches.length < 2) {
                initialPinchDistance = 0;
            }
        });
    }

    // Modal action buttons
    document.addEventListener('click', e => {
        const target = e.target;
        
        if (target.dataset.action === 'ii-crop') openCropTool();
        if (target.dataset.action === 'ii-replace') openReplaceWorkflow();
        if (target.id === 'btn-save-crop') saveCrop();
        if (target.id === 'btn-upload-file') triggerFileUpload();
        if (target.id === 'btn-take-photo') document.getElementById('ii-camera-input')?.click();
        if (target.id === 'btn-open-bank') openCoinBankModal();
        if (target.id === 'btn-execute-assign') executeImageAssignment();
        if (target.id === 'ii-btn-remove') removeCurrentImage();
        if (target.id === 'ii-btn-save') saveCurrentImage();
        if (target.id === 'ii-btn-reset-master') resetToMaster();
        if (target.id === 'ii-btn-promote-default') promoteToDefaultHandler();
        
        // Navigation back buttons
        if (target.dataset.action === 'close-crop') { closeModalLegacy('modal-crop'); openModalLegacy('modal-replace-scope'); }
        if (target.dataset.action === 'close-replace') { 
            closeModalLegacy('modal-replace-scope'); 
            if (!activeContext.isGeneric) {
                openModalLegacy('modal-image-interaction'); 
            }
        }
        if (target.dataset.action === 'close-bank') { closeModalLegacy('modal-coin-bank'); openModalLegacy('modal-replace-scope'); }

        // Filter buttons in bank
        if (target.id === 'cb-filter-ctx') loadCoinBankImages('context');
        if (target.id === 'cb-filter-all') loadCoinBankImages('all');
    });

    const fileInput = document.getElementById('ii-hidden-file-input');
    if (fileInput) fileInput.addEventListener('change', handleNewUpload);
    const cameraInput = document.getElementById('ii-camera-input');
    if (cameraInput) cameraInput.addEventListener('change', handleNewUpload);

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
    // Global Drag and Drop for all coin images and placeholders
    let dragCounter = 0;
    let activeHoverTarget = null;

    document.addEventListener('dragenter', (e) => {
        if (!eventHasFiles(e)) return;
        e.preventDefault();
        dragCounter++;
        if (dragCounter === 1) {
            highlightDropTargets(true);
        }
    });

    document.addEventListener('dragleave', (e) => {
        if (!eventHasFiles(e)) return;
        e.preventDefault();
        dragCounter--;
        if (dragCounter === 0) {
            highlightDropTargets(false);
        }
    });

    document.addEventListener('dragover', (e) => {
        if (!eventHasFiles(e)) return;
        e.preventDefault();
        const zone = getDropZone(e.target);
        if (zone) {
            e.dataTransfer.dropEffect = 'copy';
            if (activeHoverTarget !== zone.el) {
                if (activeHoverTarget) {
                    activeHoverTarget.classList.remove('drag-target-hover');
                }
                activeHoverTarget = zone.el;
                zone.el.classList.add('drag-target-hover');
            }
        } else {
            if (activeHoverTarget) {
                activeHoverTarget.classList.remove('drag-target-hover');
                activeHoverTarget = null;
            }
        }
    });

    document.addEventListener('drop', (e) => {
        if (!eventHasFiles(e)) return;
        e.preventDefault();
        dragCounter = 0;
        highlightDropTargets(false);
        if (activeHoverTarget) {
            activeHoverTarget.classList.remove('drag-target-hover');
            activeHoverTarget = null;
        }

        const dropZone = getDropZone(e.target);
        if (!dropZone) return;

        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            handleDroppedImage(file, dropZone);
        } else {
            import('./notifications.js').then(m => m.showToast('Please drop a valid image file.', 'error'));
        }
    });
});

// ============================================================
// Helper Functions
// ============================================================

/**
 * Draw the crop canvas with the image, rotation, scale, and overlay guides.
 * Supports circular, rectangular, and square crop shapes.
 * For paper currency, shows a US dollar bill outline overlay.
 */
function drawCropCanvas() {
    if (!ctx_crop) return;
    const cw = ctx_crop.canvas.width;
    const ch = ctx_crop.canvas.height;
    const cx = cw / 2;
    const cy = ch / 2;

    ctx_crop.clearRect(0, 0, cw, ch);
    
    ctx_crop.save();
    ctx_crop.translate(cx, cy);
    ctx_crop.rotate(cropRotation * Math.PI / 180);
    ctx_crop.drawImage(cropImg, cropOffX - cx, cropOffY - cy, cropImg.width * cropScale, cropImg.height * cropScale);
    ctx_crop.restore();

    // Draw crop guide overlay (circle, rectangle, or square)
    const visibleR = 0.8;
    const guideSize = Math.min(cw, ch) * visibleR;
    
    ctx_crop.strokeStyle = 'var(--color-accent, #e8b04a)';
    ctx_crop.lineWidth = 2;
    ctx_crop.setLineDash([8, 4]);
    
    // Check if we're cropping paper currency (paper currency types have rectangular images)
    const isPaperCurrency = activeContext && activeContext.typeStr && (
        activeContext.typeStr.includes('Paper') ||
        activeContext.typeStr.includes('Banknote') ||
        activeContext.typeStr.includes('Currency') ||
        activeContext.typeStr.includes('Note') ||
        activeContext.typeStr.includes('Dollar') ||
        activeContext.typeStr.includes('Bill')
    );
    
    if (isPaperCurrency) {
        // Draw rectangular guide for paper currency (approximate dollar bill aspect ratio ~2.61:1)
        const rectWidth = guideSize * 1.3;
        const rectHeight = guideSize * 0.5;
        ctx_crop.beginPath();
        ctx_crop.rect(-rectWidth/2, -rectHeight/2, rectWidth, rectHeight);
        ctx_crop.stroke();
        
        // Draw dollar bill outline details
        ctx_crop.setLineDash([4, 3]);
        ctx_crop.lineWidth = 1;
        // Inner border
        ctx_crop.strokeStyle = 'rgba(232, 176, 74, 0.6)';
        ctx_crop.beginPath();
        ctx_crop.rect(-rectWidth/2 + 8, -rectHeight/2 + 6, rectWidth - 16, rectHeight - 12);
        ctx_crop.stroke();
        
        // Portrait oval area (left side)
        ctx_crop.beginPath();
        ctx_crop.ellipse(-rectWidth/2 * 0.25, 0, rectWidth * 0.18, rectHeight * 0.4, 0, 0, Math.PI * 2);
        ctx_crop.stroke();
        
        // Seal area (right side)
        ctx_crop.beginPath();
        ctx_crop.ellipse(rectWidth/2 * 0.25, 0, rectHeight * 0.2, rectHeight * 0.2, 0, 0, Math.PI * 2);
        ctx_crop.stroke();
        
        // Serial number lines (top right)
        ctx_crop.beginPath();
        ctx_crop.moveTo(rectWidth/2 * 0.1, -rectHeight/2 * 0.6);
        ctx_crop.lineTo(rectWidth/2 * 0.4, -rectHeight/2 * 0.6);
        ctx_crop.moveTo(rectWidth/2 * 0.1, -rectHeight/2 * 0.3);
        ctx_crop.lineTo(rectWidth/2 * 0.4, -rectHeight/2 * 0.3);
        ctx_crop.stroke();
        
        // "ONE" text area (bottom)
        ctx_crop.beginPath();
        ctx_crop.moveTo(-rectWidth/2 * 0.1, rectHeight/2 * 0.5);
        ctx_crop.lineTo(rectWidth/2 * 0.1, rectHeight/2 * 0.5);
        ctx_crop.stroke();
    } else if (cropShape === 'square') {
        // Square guide
        ctx_crop.beginPath();
        ctx_crop.rect(-guideSize/2, -guideSize/2, guideSize, guideSize);
        ctx_crop.stroke();
    } else if (cropShape === 'original') {
        // No guide — show full image as-is
        ctx_crop.beginPath();
        ctx_crop.rect(-guideSize/2, -guideSize/2, guideSize, guideSize);
        ctx_crop.strokeStyle = 'rgba(232, 176, 74, 0.4)';
        ctx_crop.lineWidth = 1;
        ctx_crop.stroke();
        ctx_crop.setLineDash([]);
        return; // skip the default circle
    } else if (cropShape === 'rect') {
        // Rectangle guide
        const rectWidth = guideSize * 1.3;
        const rectHeight = guideSize * 0.75;
        ctx_crop.beginPath();
        ctx_crop.rect(-rectWidth/2, -rectHeight/2, rectWidth, rectHeight);
        ctx_crop.stroke();
    } else {
        // Default: circle guide
        ctx_crop.beginPath();
        ctx_crop.arc(0, 0, guideSize/2, 0, Math.PI * 2);
        ctx_crop.stroke();
    }
    
    ctx_crop.setLineDash([]);
}

// Set crop shape and update UI
export function setCropShape(shape) {
    cropShape = shape;
    
    // Update container class for CSS styling
    const container = document.getElementById('crop-container');
    if (container) {
        container.className = 'crop-container crop-shape-' + shape;
    }
    
    // Update button active states
    ['circle', 'rect', 'square'].forEach(s => {
        const btn = document.getElementById('crop-shape-' + s);
        if (btn) {
            btn.classList.toggle('active', s === shape);
            if (s === shape) {
                btn.style.background = 'var(--color-accent)';
                btn.style.color = 'white';
            } else {
                btn.style.background = '';
                btn.style.color = '';
            }
        }
    });
    
    // Redraw canvas with new guide
    drawCropCanvas();
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