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

import { openModal, closeModal, closeAllModals, openModalLegacy, closeModalLegacy } from './modals.js';
import { assignImage, fetchCoinBankImages, deleteCoinBankImage, updateCoinBankImageInfo, resetImageToMaster, promoteToDefault, renameCoinBankImage as renameCoinBankImageApi } from './api.js';
import { showToast } from './notifications.js';
import { resolveImageUrl, el, placeholderCoinSvg, getMainType, getSubType, isCompositionSub } from './utils.js';
import { setTypeConfigs, getSections, getCoinsForSection, getInventoryEntries, setInventory, getTypeConfig } from './state.js';
import { fetchTypeConfigs, fetchInventory, fetchCoinsForSection } from './api.js';
import { setCoinsForSection } from './state.js';

// Coin metadata for proper image naming (year, mint mark)
let _coinMeta = { year: null, mintMark: null };

export function setCoinMeta(year, mintMark) {
    _coinMeta.year = year;
    _coinMeta.mintMark = mintMark;
}

export function getCoinMeta() {
    return { ..._coinMeta };
}

// ============================================================
// State
// ============================================================

let activeContext = {
    el: null,       // The img element that was clicked
    typeStr: '',    // Full coin type string
    section: '',    // Section name (e.g. "US Coinage — Half Cent") for qualified isolation
    side: '',       // 'obv' or 'rev'
    isItem: false,  // If clicked from a specific inventory item
    itemId: null,   // inventory item ID
    b64: '',        // Current working image data (base64)
    scope: 'all',   // Current scope for assignment
};

/**
 * Determine if a given coin type / section combination should receive an image update.
 * Uses strict coin_type equality when sections are available to prevent cross-denomination
 * bleed (e.g. Half Cent "Draped Bust" updating Large Cent "Draped Bust").
 *
 * @param {string} coinType   - The coin's coin_type field
 * @param {string} coinSection - The coin's section field
 * @param {string} targetType  - The image target coin_type (activeContext.typeStr)
 * @param {string} targetSection - The image target section (activeContext.section)
 * @param {string} targetMainType - getMainType(targetType)
 * @param {string} side - The image side
 * @returns {boolean}
 */
function shouldUpdateCoinType(coinType, coinSection, targetType, targetSection, targetMainType, side) {
    if (coinSection && targetSection && coinSection !== targetSection) return false;
    if (coinType === targetType) return true;

    // Must belong to the same main type family.
    if (getMainType(coinType) !== targetMainType) return false;

    const targetSub = getSubType(targetType);
    const coinSub = getSubType(coinType);
    const targetHasSub = targetSub !== '';
    const coinHasSub = coinSub !== '';

    // EXACT-MATCH RULE (2026-08-24 cleanup): an assignment reaches only coins
    // with the EXACT same coin_type + subtype. We no longer fan a base-type
    // target out to the whole main-type family, nor bleed across composition
    // subtypes (Clad/Silver/Copper/Zinc) or across design varieties
    // (e.g. Liberty Cap Head-Facing-Left vs Head-Facing-Right). This is what
    // prevented images from landing on the wrong coins. The legacy
    // "fill whole main type" behaviour is intentionally removed — correctness
    // (no wrong-coin bleed) is preferred over silent convenience here.
    if (targetSub === coinSub) return true; // exact subtype (or both base) matches
    return false;
}

// Crop tool state
let cropImg = new Image();
let ctx_crop = null;
let isDraggingCrop = false;
let dragStartX, dragStartY;
let cropOffX = 0, cropOffY = 0, cropScale = 1;
let cropRotation = 0; // in degrees
let cropShape = 'circle'; // current crop shape (circle/rect/square/original)
let initialCropScale = 1;

// ============================================================
// Public Entry Points
// ============================================================

/**
 * Open the main image interaction modal.
 */
export function openImageInteractionModal(imgEl, typeStr, side, isItem = false, itemId = null, coinId = null, section = '') {
    const targetItemId = isItem ? itemId : (itemId || coinId);
    const targetCoinId = coinId || (isItem ? null : itemId);
    activeContext = { 
        el: imgEl, 
        typeStr, 
        section,
        side, 
        isItem, 
        itemId: targetItemId, 
        coinId: targetCoinId,
        b64: '', 
        scope: isItem ? 'specific_item' : (targetCoinId ? 'specific_coin' : 'all') 
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
    
    // Check if there's a master/default image for this type/side to show reset/promote
    const field = activeContext.side === 'obv' ? 'obv_image' : 'rev_image';
    const typeConfig = getTypeConfig(activeContext.typeStr, activeContext.section);
    const hasMaster = typeConfig && typeConfig[field];
    
    if (resetBtn) {
        resetBtn.style.display = hasMaster && isUserTier ? 'inline-flex' : 'none';
    }
    if (promoteBtn) {
        promoteBtn.style.display = hasMaster && isUserTier ? 'inline-flex' : 'none';
    }
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
        scopeLabel.style.display = 'flex'; // Always show all three options
    }
    
    // Reset scope selection: default to 'specific_item' ("This specific coin") if opened for a specific coin
    const hasCoinAnchor = !!(activeContext.coinId || (activeContext.isItem && activeContext.itemId));
    const radios = document.querySelectorAll('input[name="img_scope"]');
    if (radios.length) {
        radios[0].checked = hasCoinAnchor;
        radios[1].checked = !hasCoinAnchor;
        radios[2].checked = false;
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

                // Try WebP, fall back to PNG if unsupported
                try {
                    const webpData = canvas.toDataURL('image/webp', 0.85);
                    resolve(webpData && webpData.startsWith('data:image/webp') ? webpData : canvas.toDataURL('image/png', 0.95));
                } catch(_) {
                    resolve(canvas.toDataURL('image/png', 0.95));
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function handleNewUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be re-selected
    e.target.value = '';

    try {
        const resized = await resizeToWebP(file);
        activeContext.b64 = resized;
        // DON'T overwrite scope here - preserve the scope set when modal opened
        // (specific_coin for coin references, specific_item for inventory, all for type-level)
        openCropTool(resized);

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
    cropImg.onerror = () => {
        // Show error on canvas
        const canvas = document.getElementById('crop-canvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#333';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#e8b04a';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Image failed to load', canvas.width/2, canvas.height/2 - 10);
        ctx.fillText('Try uploading a new photo', canvas.width/2, canvas.height/2 + 20);
        const shapeLabel = document.getElementById('crop-shape-label');
        if (shapeLabel) shapeLabel.textContent = 'Failed to load image';
    };
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
    // Remove CSS clip-path on canvas — we now clip in drawCropCanvas via JS for browser compat
    const canvasEl = document.getElementById('crop-canvas');
    if (canvasEl) {
        canvasEl.style.clipPath = 'none';
        canvasEl.style.borderRadius = '0';
    }
    
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

    // Try WebP, fall back to PNG if unsupported
    try {
        const webpData = tempCanvas.toDataURL('image/webp', 0.85);
        activeContext.b64 = webpData && webpData.startsWith('data:image/webp') ? webpData : tempCanvas.toDataURL('image/png', 0.95);
    } catch(_) {
        activeContext.b64 = tempCanvas.toDataURL('image/png', 0.95);
    }
    
    // Update preview in main modal
    const preview = document.getElementById('ii-main-image');
    if (preview) {
        preview.src = activeContext.b64;
    }

    closeModalLegacy('modal-crop');
    
    // Always show scope selection — user chooses between
    // "Fill all of this type", "Fill empty slots only", or "This specific coin only"
    openModalLegacy('modal-replace-scope');
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

    // Second press: confirmed - delete immediately, no scope modal
    removeBtn.dataset.confirming = '';
    activeContext.b64 = '';
    
    // Determine scope from activeContext (use 'specific_coin' if coinId is present)
    const targetItemId = activeContext.itemId || activeContext.coinId;
    const scope = (targetItemId && activeContext.side !== 'personal') ? 'specific_coin' : (activeContext.scope || 'all');
    
    // Call assignImage with empty image to delete
    executeImageAssignment({
        coin_type: activeContext.typeStr,
        side: activeContext.side,
        image: '',  // Empty string for removal
        scope: scope,
        item_id: targetItemId,
        section: activeContext.section || ''
    });
}

/**
 * Save current image (apply changes).
 */
export function saveCurrentImage() {
    if (!activeContext.b64 && !activeContext.el.src.includes('data:image/svg')) {
        showToast('No image to save', 'warning');
        return;
    }
    
        // Show scope selection so user can choose how to apply
    openModalLegacy('modal-replace-scope');
    // Set modal title for save/update action
    const titleEl = document.querySelector('#modal-replace-scope .modal-title');
    if (titleEl) titleEl.textContent = 'Update Image';
    document.getElementById('btn-execute-assign').textContent = 'Save & Apply';
    showScopeSelection();
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
                // For personal photos, also refresh inventory state so re-render picks up changes
                if (scope === 'specific_item' || scope === 'specific_coin') {
                    const newInv = await fetchInventory();
                    setInventory(newInv);
                }
                
                // Update the detail panel image and all view-img elements
                const targetMainType = getMainType(activeContext.typeStr);
                const field = activeContext.side === 'obv' ? 'obv_image' : 'rev_image';
                let newImageUrl = updatedConfigs[activeContext.typeStr]?.[field];
                if (newImageUrl && !newImageUrl.includes('?')) newImageUrl += '?v=2';
                
                if (newImageUrl) {
                    // 1. Update the detail panel preview
                    const preview = document.getElementById('ii-main-image');
                    if (preview) preview.src = newImageUrl;
                    
                    const imgElements = document.querySelectorAll('img[data-action="view-img"]');
                    imgElements.forEach(img => {
                        const imgType = img.dataset.type;
                        const imgSide = img.dataset.side;
                        const imgSection = img.dataset.section || '';
                        const shouldUpdate = shouldUpdateCoinType(imgType, imgSection, activeContext.typeStr, activeContext.section, targetMainType, activeContext.side);
                            
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
                                const shouldUpdate = shouldUpdateCoinType(c.coin_type, c.section, activeContext.typeStr, activeContext.section, targetMainType, activeContext.side);
                                    
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
                        const imgSection = img.dataset.section || '';
                        const shouldUpdate = shouldUpdateCoinType(imgType, imgSection, activeContext.typeStr, activeContext.section, targetMainType, activeContext.side);
                            
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
                                const shouldUpdate = shouldUpdateCoinType(c.coin_type, c.section, activeContext.typeStr, activeContext.section, targetMainType, activeContext.side);
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
                // For personal photos, also refresh inventory state so re-render picks up changes
                if (scope === 'specific_item' || scope === 'specific_coin') {
                    const newInv = await fetchInventory();
                    setInventory(newInv);
                }
            
            const targetMainType = getMainType(activeContext.typeStr);
            const field = activeContext.side === 'obv' ? 'obv_image' : 'rev_image';
            const newImageUrl = result.promoted_url ||
                               updatedConfigs[activeContext.typeStr]?.[field];
            
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
export async function executeImageAssignment(overrideParams = null) {
    // Always read the currently checked radio — it reflects the user's choice
    const scopeEle = document.querySelector('input[name="img_scope"]:checked');
    // Check if scope modal box is visible (display:block means user chose a scope)
    const scopeBox = document.getElementById('scope-selection-box');
    const isScopeModalOpen = scopeBox && scopeBox.style.display === 'block';
    let scope = (overrideParams && overrideParams.scope) 
        || ((isScopeModalOpen && scopeEle) ? scopeEle.value : (activeContext.scope || 'all'));
    
    // Resolve section BEFORE the debug log to avoid TDZ error
    const section = (overrideParams && overrideParams.section !== undefined)
        ? overrideParams.section
        : (activeContext.section || activeContext.el?.dataset?.section || '');

    // Debug logging
    console.log('[images] executeImageAssignment:', {
        overrideScope: overrideParams?.scope,
        isScopeModalOpen,
        scopeEleValue: scopeEle?.value,
        activeContextScope: activeContext.scope,
        activeContextSection: activeContext.section,
        elDatasetSection: activeContext.el?.dataset?.section,
        resolvedScope: scope,
        resolvedSection: section
    });

    if (scope === 'specific_item' && activeContext.side !== 'personal') {
        scope = 'specific_coin';
    }

    const targetItemId = (overrideParams && overrideParams.item_id) || activeContext.itemId || activeContext.coinId;

    // Guard: a 'specific_coin' assignment REQUIRES a coin_ref_id (item_id). If the
    // context somehow lacks one (e.g. image picked from the bank without an item
    // anchor), fall back to a type-level ('all') assignment.
    if (scope === 'specific_coin' && !targetItemId) {
        console.warn('[images] specific_coin scope without targetItemId; falling back to type-level (all) assignment.');
        scope = 'all';
    }

    const imageB64 = (overrideParams && overrideParams.image !== undefined) ? overrideParams.image : (activeContext.b64 || '');
    const coinType = (overrideParams && overrideParams.coin_type) || activeContext.typeStr;
    const side = (overrideParams && overrideParams.side) || activeContext.side;

    try {
        const result = await assignImage({
            coin_type: coinType,
            side:      side,
            image:     imageB64,
            scope:     scope,
            item_id:   targetItemId,
            section:   section
        });

        if (result.status === 'success' || result.status === 'skipped') {
            showToast(result.message || 'Image updated successfully', 'success');
            // Guarantee EVERY modal layer is dismissed, regardless of which
            // modal system or branch opened it (legacy .modal-overlay, new
            // orchestrator .modal-window-wrapper, or the coin-bank modal that
            // may still be on the stack). This prevents a stuck, click-through
            // modal after Save & Apply.
            closeModalLegacy('modal-image-interaction');
            closeModalLegacy('modal-replace-scope');
            closeModalLegacy('modal-crop');
            closeModalLegacy('modal-coin-bank');
            closeAllModals();
            window.dispatchEvent(new CustomEvent('cc-modals-force-close'));
            document.body.classList.remove('modal-open');

            // Soft re-render: refetch type configs and update memory state & DOM
            try {
                const updatedConfigs = await fetchTypeConfigs();
                setTypeConfigs(updatedConfigs);
                
                const field = activeContext.side === 'obv' ? 'obv_image' : 'rev_image';

                if (scope === 'specific_coin' && targetItemId) {
                    // Use the URL returned by the server (new per-coin file) instead of the bank URL
                    const newUrl = result.new_url || imageB64 || null;
                    // Update specific coin in in-memory section cache
                    getSections().forEach(sec => {
                        const coins = getCoinsForSection(sec.section);
                        if (coins) {
                            const c = coins.find(coin => String(coin.id) === String(targetItemId));
                            if (c) {
                                c[field] = newUrl;
                                const deletedField = "_deleted_" + field;
                                c[deletedField] = !newUrl;
                            }
                        }
                    });

                    // Update DOM elements for this specific coin
                    const coinImgs = document.querySelectorAll(`img[data-action="view-img"][data-coin-id="${targetItemId}"]`);
                    coinImgs.forEach(img => {
                        if (img.dataset.side === activeContext.side) {
                            if (newUrl) {
                                img.src = newUrl;
                                img.classList.remove('placeholder');
                            } else {
                                import('./utils.js').then(m => {
                                    img.src = m.placeholderCoinSvg();
                                    img.classList.add('placeholder');
                                });
                            }
                        }
                    });
                } else if (scope === 'specific_item' && targetItemId) {
                    const newInv = await fetchInventory();
                    setInventory(newInv);
                } else if (scope === 'all' || scope === 'empty_only') {
                    // Batch assign writes per-coin images on server.
                    // Fetch fresh data DIRECTLY from server to avoid stale IndexedDB race.
                    try {
                        const _host = (window.location && window.location.hostname) || '';
                        const _selfHosted = _host.includes('opaleye-bluegill') || _host.includes('ts.net') || _host.includes('192.168.') || _host === 'localhost';
                        // Resolve target section: context -> state scan (same as self-hosted)
                        let secName = activeContext.section || '';
                        if (!secName && activeContext.typeStr) {
                            const t = activeContext.typeStr;
                            const main = t.includes(' - ') ? t.split(' - ')[0].trim()
                                       : (t.includes(' (') ? t.split(' (')[0].trim() : t);
                            for (const s of getSections()) {
                                const cs = getCoinsForSection(s.section);
                                if (cs && cs.some(c => c.coin_type === t ||
                                        c.coin_type && c.coin_type.split(' - ')[0].trim() === main)) {
                                    secName = s.section;
                                    break;
                                }
                            }
                        }
                        let coins;
                        if (_selfHosted) {
                            // Direct server fetch - bypass IndexedDB-first logic for immediate fresh data
                            const _native = window.__nativeFetch || window.fetch;
                            const _res = await _native('/api/coins?section=' + encodeURIComponent(activeContext.section));
                            if (_res && _res.ok) {
                                coins = await _res.json();
                            } else {
                                throw new Error('Server fetch failed');
                            }
                        } else {
                            // Public: use local (IndexedDB) path
                            coins = await fetchCoinsForSection(secName);
                        }
                        // Update in-memory state
                        setCoinsForSection(secName, coins);
                        // Re-render immediately
                        const sectionId = 'section-' + secName.replace(/[^a-zA-Z0-9]/g, '');
                        const content = document.getElementById(sectionId + '-content');
                        if (content) {
                            // 2026-08-31: circular-import-safe access (catalog<->images cycle)
                            const _wcc = window.__ccCatalog || {};
                            const _rta = _wcc.renderTypeAccordions;
                            if (typeof _rta === 'function') _rta(content, coins); else console.warn('[images] RTA unavailable, skipping re-render');
                        } else {
                            console.warn('[images] Section content not found for', sectionId);
                        }
                    } catch (e) {
                        console.warn('[images] Could not refresh section after batch assign:', e);
                        // Fallback to standard fetch
                        try {
                            const coins = await fetchCoinsForSection(activeContext.section);
                            setCoinsForSection(activeContext.section, coins);
                            const sectionId = 'section-' + activeContext.section.replace(/[^a-zA-Z0-9]/g, '');
                            const content = document.getElementById(sectionId + '-content');
                            if (content) {
                                // 2026-08-31: circular-import-safe access (catalog<->images cycle)
                                const _wcc = window.__ccCatalog || {};
                                const _rta = _wcc.renderTypeAccordions;
                                if (typeof _rta === 'function') _rta(content, coins); else console.warn('[images] RTA unavailable, skipping re-render');
                            }
                        } catch (fbErr) {
                            console.warn('[images] Fallback fetch also failed:', fbErr);
                        }
                    }
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

export function openBankForPersonalSlot(coinTypeStr, onSelectCallback) {
    activeContext = {
        typeStr: coinTypeStr,
        side: 'obv', // Generic side for searching
        isPersonalSlot: true,
        onSelect: onSelectCallback
    };
    openCoinBankModal();
}

// Exposed globally for HTML oninput handlers
window._cbLoadImages = loadCoinBankImages;
let _currentBankMode = 'context';
// Refine the current bank grid by the search box without re-fetching when possible
function _applyBankSearchFilter() {
  const grid = document.getElementById('coin-bank-grid');
  if (!grid) return;
  const q = (document.getElementById('cb-search-input')?.value || '').toLowerCase().trim();
  const cards = Array.from(grid.querySelectorAll('[data-bank-card]'));
  let shown = 0;
  cards.forEach(c => {
    const hay = ((c.dataset.coinType || '') + ' ' + (c.dataset.side || '')).toLowerCase();
    const match = !q || hay.includes(q);
    c.style.display = match ? '' : 'none';
    if (match) shown++;
  });
  let note = document.getElementById('cb-search-note');
  if (!note) {
    note = document.createElement('div');
    note.id = 'cb-search-note';
    note.style.cssText = 'grid-column:1/-1;text-align:center;padding:1rem;color:var(--color-text-muted);font-size:0.85em;';
    grid.appendChild(note);
  }
  note.textContent = (q && shown === 0) ? 'No images match your search.' : '';
}
// Optional searchQ lets the search box re-query the ENTIRE bank (not just the
// current coin type). Fixes the "auto search came back empty" bug where context
// mode only loaded the active type's images and the inline filter could not reach
// across types.
async function loadCoinBankImages(mode, searchQ) {
    if (mode) _currentBankMode = mode;
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
        const q = (typeof searchQ === 'string')
            ? searchQ
            : (document.getElementById('cb-search-input')?.value || '').toLowerCase().trim();
        const params = (mode === 'context' && !q)
            ? { coin_type: activeContext.typeStr, side: activeContext.side, section: activeContext.section }
            : (q ? { q: q } : {});
        const images = await fetchCoinBankImages(params);

        if (!images.length) {
            grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--color-text-muted);">No images found in bank.</div>';
            return;
        }

        grid.innerHTML = '';
        // Apply inline search filter. NOTE: must NOT redeclare `searchQ` here —
        // `searchQ` is a function PARAMETER, and a same-scope `const searchQ`
        // redeclaration triggers a TDZ ReferenceError
        // ("Cannot access 'searchQ' before initialization"). Use a distinct name.
        const inlineQ = (document.getElementById('cb-search-input')?.value || '').toLowerCase().trim();
        const filtered = inlineQ
            ? images.filter(img =>
                (img.coin_type || '').toLowerCase().includes(inlineQ) ||
                (img.side || '').toLowerCase().includes(inlineQ)
              )
            : images;
        if (filtered.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--color-text-muted);">No images match your search.</div>';
            return;
        }
        // Render in chunks so 'show all' (6000+ images) paints fast instead of freezing.
        const CHUNK = 120;
        let _renderIdx = 0;
        function _renderChunk() {
            const slice = filtered.slice(_renderIdx, _renderIdx + CHUNK);
            _renderIdx += slice.length;
            slice.forEach(img => {
            const card = el('div', {
                'data-bank-card': '',
                'data-coin-type': img.coin_type || '',
                'data-side': img.side || '',
                style: 'border:1px solid var(--color-border-light); border-radius:var(--radius-md); overflow:hidden; background:var(--color-bg-card); cursor:pointer; transition:transform 0.1s; position:relative;',
                onclick: (e) => {
                    if (e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON') {
                        selectBankImage(img);
                    }
                }
            },
                el('img', {
                    src: resolveImageUrl(img.filename),
                    style: 'width:100%; height:100px; object-fit:contain;',
                    onerror: function() {
                        // Hide broken type-default images that were never published
                        // (e.g. /data/images/types/*.webp that 404). Keeps the bank usable.
                        this.style.visibility = 'hidden';
                    }
                }),
                el('div', { 
                    style: 'position:absolute; top:0; left:0; background:rgba(0,0,0,0.7); color:white; padding:2px 4px; font-size:0.7rem;',
                    onclick: (e) => { e.stopPropagation(); editCoinBankImage(img); },
                    title: 'Edit Image Context'
                }, ''),

                el('div', { 
                    style: 'padding:var(--space-1); display:flex; flex-direction:column; gap:4px;'
                },
                    el('div', { 
                        style: 'font-size:var(--font-size-xs); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;', 
                        title: img.coin_type 
                    }, img.coin_type),
                    el('select', {
                        style: 'font-size:0.75rem; padding:2px; width:100%; border:1px solid var(--color-border); border-radius:4px; background:var(--color-bg-body); color:var(--color-text-main); cursor:pointer;',
                        onchange: (e) => {
                            e.stopPropagation();
                            renameCoinBankImage(img, e.target.value);
                        }
                    }, 
                        el('option', { value: 'obv', selected: img.side === 'obv' }, 'Obverse'),
                        el('option', { value: 'rev', selected: img.side === 'rev' }, 'Reverse'),
                        el('option', { value: 'err', selected: img.side === 'err' }, 'Error'),
                        el('option', { value: 'proof_obv', selected: img.side === 'proof_obv' }, 'Proof Obverse'),
                        el('option', { value: 'proof_rev', selected: img.side === 'proof_rev' }, 'Proof Reverse'),
                        el('option', { value: 'unknown', selected: img.side === 'unknown' }, 'Unknown')
                    ),
                    el('button', {
                        class: 'cb-delete-btn',
                        style: 'margin-top:4px; padding:3px 6px; font-size:0.7rem; background:#dc2626; color:white; border:none; border-radius:4px; cursor:pointer; width:100%;',
                        onclick: (e) => { e.stopPropagation(); deleteCoinBankImageConfirm(img, e.currentTarget); },
                        title: 'Delete this image from coin bank'
                    }, 'Delete')
                )
            );
            grid.appendChild(card);
            });
            if (_renderIdx < filtered.length) {
                const moreBtn = el('button', {
                    className: 'btn-secondary',
                    style: 'grid-column:1/-1; margin:0.5rem auto; display:block; padding:6px 18px; cursor:pointer;',
                    onclick: () => { moreBtn.remove(); _renderChunk(); }
                }, 'Show more (' + (filtered.length - _renderIdx) + ' remaining)');
                grid.appendChild(moreBtn);
            }
        }
        _renderChunk();
    } catch (err) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--color-danger);">Error: ${err.message}</div>`;
    }
}

function selectBankImage(img) {
    if (activeContext.isPersonalSlot) {
        if (typeof activeContext.onSelect === 'function') {
            activeContext.onSelect(img.filename);
        }
        closeModalLegacy('modal-coin-bank');
        return;
    }
    
    activeContext.b64 = img.filename;
    // Update preview in main modal
    const preview = document.getElementById('ii-main-image');
    if (preview) {
        preview.src = activeContext.b64;
    }
    closeModalLegacy('modal-coin-bank');
    
    // Always show scope selection
    openModalLegacy('modal-replace-scope');
    showScopeSelection();
}

async function deleteCoinBankImageConfirm(img, btn) {
    // First click: turn the BUTTON ITSELF into a confirm prompt (no toast needed)
    if (img._confirming !== true) {
        img._confirming = true;
        if (btn) {
            btn.textContent = 'Click to confirm';
            btn.style.background = '#f59e0b';   // amber warning
            btn.dataset.confirming = '1';
        }
        // Auto-revert if the user doesn't confirm in time
        clearTimeout(img._confirmTimer);
        img._confirmTimer = setTimeout(() => {
            img._confirming = false;
            if (btn && btn.dataset.confirming === '1') {
                btn.textContent = 'Delete';
                btn.style.background = '#dc2626';
                btn.dataset.confirming = '';
            }
        }, 5000);
        return;
    }
    // Second click: confirmed -- reset the button then delete
    img._confirming = false;
    clearTimeout(img._confirmTimer);
    if (btn) { btn.textContent = 'Delete'; btn.style.background = '#dc2626'; btn.dataset.confirming = ''; }
    try {
        const grid = document.getElementById('coin-bank-grid');
        const scrollPos = grid ? grid.parentElement.scrollTop : 0;
        const result = await deleteCoinBankImage(img.filename);
        if (!result || result.status === 'error') {
            throw new Error((result && result.error) || 'Delete rejected by server');
        }
        // Honestly report when the file was already missing on disk
        if (result.message && result.message.indexOf('already missing') !== -1) {
            showToast('Removed broken image reference', 'success');
        } else {
            showToast('Image deleted from coin bank', 'success');
        }
        // Notify catalog to refresh
        window.dispatchEvent(new CustomEvent('cc-image-updated'));
        window.dispatchEvent(new CustomEvent('cc-inventory-updated'));
        // Refresh the bank view, then restore scroll so the user keeps their place
        const ctxBtn = document.getElementById('cb-filter-ctx');
        await loadCoinBankImages(ctxBtn && ctxBtn.className.includes('btn-primary') ? 'context' : 'all');
        if (grid) requestAnimationFrame(() => { grid.parentElement.scrollTop = scrollPos; });
    } catch (err) {
        showToast(`Failed to delete image: ${err.message}`, 'error');
    }
}

async function renameCoinBankImage(img, newSide) {
    const grid = document.getElementById('coin-bank-grid');
    const scrollPos = grid ? grid.parentElement.scrollTop : 0;
    try {
        // LOCAL-FIRST FIX (2026-08-24): Previously called
        // `fetch('/api/coin_bank_images/rename', ...)`, which 404s on the
        // local-first build. renameCoinBankImageApi() routes through db.js
        // (IndexedDB) and takes { filename, new_side }. (Aliased import to avoid
        // colliding with this module's own renameCoinBankImage() wrapper.)
        const res = await renameCoinBankImageApi({ filename: img.filename, new_side: newSide });
        if (!res || res.status !== 'renamed') throw new Error('Failed to rename image');
        
        showToast('Image side updated', 'success');
        
        // Refresh the bank view, then restore scroll
        const ctxBtn = document.getElementById('cb-filter-ctx');
        await loadCoinBankImages(ctxBtn && ctxBtn.className.includes('btn-primary') ? 'context' : 'all');
        if (grid) requestAnimationFrame(() => { grid.parentElement.scrollTop = scrollPos; });
        
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
    const scopeBox = document.getElementById('scope-selection-box');
    const applyBtn = document.getElementById('btn-execute-assign');
    if (scopeBox) scopeBox.style.display = 'block';
    if (applyBtn) applyBtn.style.display = 'block';
    
    // Ensure the modal is actually open — showScopeSelection may be called
    // from saveCrop() which already opened it, but if it was called from
    // an unexpected context, make sure the user can see and interact with the
    // scope options before Save & Apply.
    openModalLegacy('modal-replace-scope');
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
        
    } catch (err) {
        showToast(`Failed to process dropped image: ${err.message}`, 'error');
    }
}

// 2026-08-31 CRITICAL FIX: this block was wrapped in DOMContentLoaded, but ES modules
    // execute AFTER that event has fired — the callback never ran, so NONE of the modal
    // button/file-input/bank listeners were ever attached (modal buttons did nothing on
    // every device; From Device file selection went nowhere). Execute immediately —
    // module scripts are DOM-ready by definition.
    (() => {
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

    // Modal action buttons.
    // 2026-08-28 MOBILE FIX: resolve the clickable through closest() so taps that land on a
    // child node (svg, span, label text) inside a modal button still register. Previously a
    // tap on a child made target.dataset.action/target.id undefined -> button 'did nothing'
    // (reported on the public site's image modal: From Device / Browse Coin Bank dead).
    document.addEventListener('click', e => {
        const target = e.target instanceof Element
            ? (e.target.closest('[data-action], button[id]') || e.target)
            : e.target;
        if (!target || !target.dataset) return;

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
        if (target.id === 'cb-filter-ctx') { document.getElementById('cb-search-input') && (document.getElementById('cb-search-input').value = ''); loadCoinBankImages('context'); }
        if (target.id === 'cb-filter-all') { document.getElementById('cb-search-input') && (document.getElementById('cb-search-input').value = ''); loadCoinBankImages('all'); }
    });

    const fileInput = document.getElementById('ii-hidden-file-input');
    if (fileInput) fileInput.addEventListener('change', handleNewUpload);

    // Coin Bank search box: re-query the WHOLE bank by query (fixes empty auto-search).
    // Debounced so typing is smooth; falls back to the inline filter if the load fails.
    const cbSearch = document.getElementById('cb-search-input');
    if (cbSearch && !window.__ccCoinBankSearchBound) {
      window.__ccCoinBankSearchBound = true;
      let _t;
      cbSearch.addEventListener('input', () => {
        clearTimeout(_t);
        const v = cbSearch.value;
        _t = setTimeout(() => {
          if (_currentBankMode === 'context') {
            // Current-type view: filter ONLY what is already loaded (instant).
            _applyBankSearchFilter();
          } else {
            // Show-all view: re-query the whole bank server-side.
            loadCoinBankImages(_currentBankMode, v).catch(() => _applyBankSearchFilter());
          }
        }, 200);
      });
    }
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
})();

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

    // Clear with transparent — background is handled by container CSS
    ctx_crop.clearRect(0, 0, cw, ch);
    
    const visibleR = 0.8;
    // Clip to shape before drawing (replaces CSS clip-path which breaks on some mobile browsers)
    ctx_crop.save();
    ctx_crop.beginPath();
    if (cropShape === 'rect') {
        // Rectangular clip for paper currency — match guide proportions
        const guideW = cw * visibleR;
        const guideH = ch * visibleR * (235/614); // bill aspect ratio
        ctx_crop.rect(cx - guideW/2, cy - guideH/2, guideW, guideH);
    } else if (cropShape === 'square') {
        const guideS = Math.min(cw, ch) * visibleR;
        ctx_crop.rect(cx - guideS/2, cy - guideS/2, guideS, guideS);
    } else if (cropShape === 'original') {
        // No clip — full image
        ctx_crop.rect(0, 0, cw, ch);
    } else {
        // Circular clip (default for coins)
        ctx_crop.arc(cx, cy, Math.min(cw, ch) * visibleR / 2, 0, Math.PI * 2);
    }
    ctx_crop.clip();
    
    // Draw image inside the clip region
    ctx_crop.translate(cx, cy);
    ctx_crop.rotate(cropRotation * Math.PI / 180);
    ctx_crop.drawImage(cropImg, cropOffX - cx, cropOffY - cy, cropImg.width * cropScale, cropImg.height * cropScale);
    ctx_crop.restore();

    // Draw crop guide overlay (circle, rectangle, or square) — outside clip so always visible as dashed line
    // NOTE: restore() above undid the translate(cx, cy), so re-translate to canvas
    // center — all guide coords below are 0-centered. Without this, the guide is
    // drawn at the top-left corner (stray black dashed arc).
    ctx_crop.save();
    ctx_crop.translate(cx, cy);
    const guideSize = Math.min(cw, ch) * visibleR;
    
    // Canvas 2D does NOT resolve CSS var() in strokeStyle — get the computed
    // accent color so the guide isn't silently drawn in black.
    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#60a5fa';
    ctx_crop.strokeStyle = accentColor;
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
        ctx_crop.restore();
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
    ctx_crop.restore();
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
// 2026-08-31 v142: direct onclick bindings for the core image-modal buttons. These are the
// primitive, non-delegated mechanism — immune to any delegation/interception issue. The
// delegated document handler below remains as backup (idempotent: both call the same fns).
function _ccBindDirectModalButtons() {
    const map = {
        'btn-upload-file': () => triggerFileUpload(),
        'btn-open-bank': () => openCoinBankModal(),
        'btn-take-photo': () => { const el = document.getElementById('ii-camera-input'); if (el) el.click(); },
        'btn-execute-assign': () => executeImageAssignment(),
        'ii-btn-remove': () => removeCurrentImage(),
        'ii-btn-save': () => saveCurrentImage(),
        'ii-btn-reset-master': () => resetToMaster(),
        'ii-btn-promote-default': () => promoteToDefaultHandler(),
    };
    for (const [id, fn] of Object.entries(map)) {
        const bind = () => {
            const el = document.getElementById(id);
            if (el && !el.dataset.ccDirect) {
                el.dataset.ccDirect = '1';
                el.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    console.log('[tap-diag] direct handler:', id);
                    fn();
                });
            }
        };
        bind();
        // Re-bind when the element appears later (modals are static in index.html, but be safe)
        setTimeout(bind, 1500);
    }
    // data-action buttons are created dynamically — delegate directly on document with
    // pointerup+click pair but WITHOUT preventDefault/stopPropagation:
    document.addEventListener('click', (ev) => {
        const el = ev.target instanceof Element
            ? ev.target.closest('[data-action="ii-crop"], [data-action="ii-replace"], [data-action="close-bank"], [data-action="close-crop"], [data-action="close-replace"]')
            : null;
        if (!el) return;
        console.log('[tap-diag] direct delegated:', el.dataset.action);
        if (el.dataset.action === 'ii-crop') openCropTool();
        if (el.dataset.action === 'ii-replace') openReplaceWorkflow();
        if (el.dataset.action === 'close-bank') { closeModalLegacy('modal-coin-bank'); openModalLegacy('modal-replace-scope'); }
        if (el.dataset.action === 'close-crop') { closeModalLegacy('modal-crop'); openModalLegacy('modal-replace-scope'); }
        if (el.dataset.action === 'close-replace') {
            closeModalLegacy('modal-replace-scope');
            if (!activeContext.isGeneric) openModalLegacy('modal-image-interaction');
        }
    });
}
try { _ccBindDirectModalButtons(); } catch (e) { console.warn('[modals] direct bind failed:', e); }
