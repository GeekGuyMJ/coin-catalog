/**
 * gallery.js — Photos & Documents card for Coin Catalog v2
 *
 * A dedicated dashboard card where the user can capture or upload free-form
 * pictures (coin folders, slabs, receipts, documents) and browse them in a
 * thumbnail grid with a full-screen lightbox. No circle-crop — these are raw
 * pictures the user documents their collection with.
 *
 * Persistence:
 *   - Self-hosted  -> /api/user_photos (Flask backend, base64 in DB)
 *   - Public       -> IndexedDB user_photos store (via api.js interceptor)
 */
import { el } from './utils.js';
import { fetchUserPhotos, addUserPhoto, deleteUserPhoto } from './api.js';
import { showToast } from './notifications.js';

// Reusable camera/file -> compressed base64 (mirrors portfolio.js' helper,
// kept local so this module is self-contained).
function fileToCompressedDataUrl(file, maxDim = 1600, quality = 0.82) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error('Could not decode image'));
            img.onload = () => {
                let { width, height } = img;
                if (width > maxDim || height > maxDim) {
                    const scale = maxDim / Math.max(width, height);
                    width = Math.round(width * scale);
                    height = Math.round(height * scale);
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

// Lightweight full-screen lightbox (does not depend on portfolio.js internals).
function openGalleryLightbox(src, caption) {
    let lb = document.getElementById('gallery-lightbox');
    if (!lb) {
        lb = document.createElement('div');
        lb.id = 'gallery-lightbox';
        lb.className = 'lightbox-overlay';
        lb.innerHTML = `
            <div class="lightbox-inner">
                <button class="lightbox-close" aria-label="Close">&times;</button>
                <img alt="Photo">
                <div class="lightbox-caption"></div>
            </div>`;
        document.body.appendChild(lb);
        lb.addEventListener('click', (e) => {
            if (e.target === lb || e.target.classList.contains('lightbox-close')) {
                lb.classList.remove('is-active');
            }
        });
    }
    lb.querySelector('img').src = src;
    lb.querySelector('.lightbox-caption').textContent = caption || '';
    lb.classList.add('is-active');
}

async function loadPhotos(gridEl, emptyEl, countEl) {
    let photos = [];
    try {
        photos = await fetchUserPhotos();
    } catch (e) {
        console.error('[gallery] load failed', e);
        photos = [];
    }
    if (countEl) countEl.textContent = photos.length + ' item' + (photos.length !== 1 ? 's' : '');

    if (!photos.length) {
        if (emptyEl) emptyEl.style.display = '';
        if (gridEl) gridEl.innerHTML = '';
        return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    if (!gridEl) return;
    gridEl.innerHTML = '';
    photos.forEach((p) => {
        const thumb = el('div', { className: 'gallery-thumb', title: p.title || p.caption || 'Photo' });
        const img = el('img', { src: p.image_data, alt: p.title || 'Photo', loading: 'lazy' });
        img.addEventListener('click', () => openGalleryLightbox(p.image_data, [p.title, p.caption].filter(Boolean).join(' — ')));
        thumb.appendChild(img);

        const del = el('button', { className: 'gallery-thumb-del', title: 'Delete', dataset: { photoId: String(p.id) } }, '✕');
        del.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = p.id;
            del.disabled = true;
            try {
                await deleteUserPhoto(id);
                showToast('Photo deleted', 'success', 2000);
                // refresh grid
                loadPhotos(gridEl, emptyEl, countEl);
            } catch (err) {
                console.error('[gallery] delete failed', err);
                showToast('Delete failed: ' + (err.message || 'error'), 'error', 4000);
                del.disabled = false;
            }
        });
        thumb.appendChild(del);

        if (p.title || p.caption) {
            const label = el('div', { className: 'gallery-thumb-label' }, (p.title || p.caption).slice(0, 40));
            thumb.appendChild(label);
        }
        gridEl.appendChild(thumb);
    });
}

export function renderGalleryCard() {
    const card = el('div', {
        className: 'card dashboard-card gallery-card',
        id: 'card-gallery',
        style: 'display:flex;flex-direction:column;',
    });

    // Header
    const hdr = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-right:28px;flex-shrink:0;' });
    hdr.appendChild(el('div', { className: 'card-title', style: 'margin-bottom:0;' }, ' Photos & Documents'));
    const countBadge = el('span', {
        style: 'font-size:0.75em;background:var(--color-accent);color:var(--color-bg-card);padding:2px 8px;border-radius:10px;font-weight:700;',
    }, '0 items');
    hdr.appendChild(countBadge);
    card.appendChild(hdr);

    // Grid
    const grid = el('div', { className: 'gallery-grid', style: 'flex:1;overflow-y:auto;min-height:90px;margin-bottom:10px;' });
    card.appendChild(grid);

    const emptyMsg = el('p', { style: 'font-size:0.82em;color:var(--color-text-muted);margin:0;padding:10px 0;text-align:center;' },
        'No photos yet. Capture or upload pictures of your coin folders, slabs, or anything you want to document.');
    card.appendChild(emptyMsg);

    // Capture / Upload controls
    const controls = el('div', { style: 'display:flex;gap:8px;flex-shrink:0;align-items:center;flex-wrap:wrap;' });

    const fileInput = el('input', { type: 'file', accept: 'image/*', capture: 'environment', multiple: 'multiple', style: 'display:none;' });
    const fileInputPlain = el('input', { type: 'file', accept: 'image/*', multiple: 'multiple', style: 'display:none;' });

    const captureBtn = el('button', { className: 'btn-secondary', style: 'flex:1;padding:6px 8px;font-size:0.82em;margin:0;' }, ' Camera');
    const uploadBtn = el('button', { className: 'btn-secondary', style: 'flex:1;padding:6px 8px;font-size:0.82em;margin:0;' }, ' Upload');

    captureBtn.addEventListener('click', () => fileInput.click());
    uploadBtn.addEventListener('click', () => fileInputPlain.click());

    fileInput.addEventListener('change', () => handleFiles(fileInput.files, grid, emptyMsg, countBadge));
    fileInputPlain.addEventListener('change', () => handleFiles(fileInputPlain.files, grid, emptyMsg, countBadge));

    controls.appendChild(captureBtn);
    controls.appendChild(uploadBtn);
    card.appendChild(controls);
    card.appendChild(fileInput);
    card.appendChild(fileInputPlain);

    // Initial load
    loadPhotos(grid, emptyMsg, countBadge);

    return card;
}

async function handleFiles(fileList, grid, emptyMsg, countBadge) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    for (const file of files) {
        try {
            const dataUrl = await fileToCompressedDataUrl(file);
            const photo = {
                title: file.name ? file.name.replace(/\.[^.]+$/, '').slice(0, 200) : '',
                caption: '',
                category: 'General',
                image_data: dataUrl,
            };
            await addUserPhoto(photo);
        } catch (err) {
            console.error('[gallery] add failed', err);
            showToast('Could not add ' + (file.name || 'photo') + ': ' + (err.message || 'error'), 'error', 4000);
        }
    }
    showToast('Photo' + (files.length > 1 ? 's' : '') + ' added', 'success', 2000);
    loadPhotos(grid, emptyMsg, countBadge);
}
