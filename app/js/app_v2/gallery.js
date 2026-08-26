/**
 * gallery.js — Photos & Documents card for Coin Catalog v2
 *
 * A dedicated dashboard card where the user can capture or upload free-form
 * pictures (coin folders, slabs, receipts, documents) and browse them as
 * thumbnails. Two categories — Pictures and Documents — are kept in separate
 * tabs so the user can scroll thumbnails per type and tap one to open it
 * full-screen in a lightbox. No circle-crop — these are raw pictures the user
 * documents their collection with.
 *
 * Persistence:
 *   - Self-hosted  -> /api/user_photos (Flask backend, base64 in DB)
 *   - Public       -> IndexedDB user_photos store (via api.js interceptor)
 *
 * The user_photos row shape: { id, category: 'Pictures'|'Documents', title,
 * caption, image_data (data URL), created_at }.
 */
import { el } from './utils.js';
import { fetchUserPhotos, addUserPhoto, deleteUserPhoto } from './api.js';
import { showToast } from './notifications.js';

const CATEGORIES = ['Pictures', 'Documents'];

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

    // Category tab bar (Pictures / Documents)
    let activeCategory = 'Pictures';
    const tabBar = el('div', { className: 'gallery-tabs', style: 'display:flex;gap:6px;margin-bottom:10px;flex-shrink:0;' });
    const tabButtons = {};
    CATEGORIES.forEach((cat) => {
        const btn = el('button', {
            className: 'gallery-tab' + (cat === activeCategory ? ' active' : ''),
            onclick: () => {
                activeCategory = cat;
                Object.entries(tabButtons).forEach(([c, b]) => b.classList.toggle('active', c === cat));
                loadPhotos();
            },
        }, cat);
        tabButtons[cat] = btn;
        tabBar.appendChild(btn);
    });
    card.appendChild(tabBar);

    // Grid (only renders the active category's thumbnails).
    // Sizes to content (no forced stretch), scrolls only when it gets tall.
    const grid = el('div', { className: 'gallery-grid', style: 'flex:0 1 auto;max-height:340px;overflow-y:auto;min-height:0;margin-bottom:10px;' });
    card.appendChild(grid);

    const emptyMsg = el('p', { className: 'gallery-empty', style: 'font-size:0.82em;color:var(--color-text-muted);margin:0;padding:6px 0;text-align:center;' },
        'No pictures yet. Capture or upload photos of your coin folders, slabs, or anything you want to document.');
    card.appendChild(emptyMsg);

    // Capture / Upload controls
    const controls = el('div', { style: 'display:flex;gap:8px;flex-shrink:0;align-items:center;flex-wrap:wrap;' });

    const fileInput = el('input', { type: 'file', accept: 'image/*', capture: 'environment', multiple: 'multiple', style: 'display:none;' });
    const fileInputPlain = el('input', { type: 'file', accept: 'image/*', multiple: 'multiple', style: 'display:none;' });

    const captureBtn = el('button', { className: 'btn-secondary', style: 'flex:1;padding:6px 8px;font-size:0.82em;margin:0;' }, ' Camera');
    const uploadBtn = el('button', { className: 'btn-secondary', style: 'flex:1;padding:6px 8px;font-size:0.82em;margin:0;' }, ' Upload');

    captureBtn.addEventListener('click', () => fileInput.click());
    uploadBtn.addEventListener('click', () => fileInputPlain.click());

    fileInput.addEventListener('change', () => handleFiles(fileInput.files, activeCategory));
    fileInputPlain.addEventListener('change', () => handleFiles(fileInputPlain.files, activeCategory));

    controls.appendChild(captureBtn);
    controls.appendChild(uploadBtn);
    card.appendChild(controls);
    card.appendChild(fileInput);
    card.appendChild(fileInputPlain);

    // loadPhotos renders only the active category and toggles the empty state
    async function loadPhotos() {
        let photos = [];
        try {
            photos = await fetchUserPhotos();
        } catch (e) {
            console.error('[gallery] load failed', e);
            photos = [];
        }
        const inCat = photos.filter((p) => (p.category || 'Pictures') === activeCategory);
        const total = photos.length;
        countBadge.textContent = total + ' item' + (total !== 1 ? 's' : '');

        // Compact when empty: hide the grid (no wasted middle space)
        if (!inCat.length) {
            grid.style.display = 'none';
            grid.innerHTML = '';
            emptyMsg.style.display = '';
            emptyMsg.textContent = activeCategory === 'Pictures'
                ? 'No pictures yet. Capture or upload photos of your coin folders, slabs, or anything you want to document.'
                : 'No documents yet. Upload receipts, certificates, or any paperwork you want to keep with your collection.';
            return;
        }
        grid.style.display = '';
        emptyMsg.style.display = 'none';
        grid.innerHTML = '';
        inCat.forEach((p) => {
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
                    loadPhotos();
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
            grid.appendChild(thumb);
        });
    }

    // Initial load
    loadPhotos();

    // Expose reload so the file handler (defined outside this closure) can refresh
    card.__loadPhotos = loadPhotos;

    return card;
}

async function handleFiles(fileList, category) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    for (const file of files) {
        try {
            const dataUrl = await fileToCompressedDataUrl(file);
            const photo = {
                title: file.name ? file.name.replace(/\.[^.]+$/, '').slice(0, 200) : '',
                caption: '',
                category: category || 'Pictures',
                image_data: dataUrl,
            };
            await addUserPhoto(photo);
        } catch (err) {
            console.error('[gallery] add failed: ' + (err && (err.message || String(err))) + ' | stack: ' + (err && err.stack ? String(err.stack).slice(0, 300) : 'n/a'));
            showToast('Could not add ' + (file.name || 'photo') + ': ' + (err.message || 'error'), 'error', 4000);
        }
    }
    showToast('Photo' + (files.length > 1 ? 's' : '') + ' added to ' + (category || 'Pictures'), 'success', 2000);
    // reload the gallery grid via the closure exposed on the card element
    const cardEl = document.getElementById('card-gallery');
    if (cardEl && typeof cardEl.__loadPhotos === 'function') cardEl.__loadPhotos();
}
