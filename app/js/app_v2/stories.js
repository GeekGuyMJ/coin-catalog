/**
 * stories.js - Coin Catalog v2
 * Stories modal content and logic
 */

import { el, escHtml } from './utils.js?v=4';
import { openModal, closeModal, registerModal } from './modals.v2.js?v=4';

// Cache for stories data
let _storiesCache = null;

/**
 * Fetch stories data from the server
 * @returns {Promise<Object>} Promise resolving to the stories data
 */
async function fetchStoriesData() {
    if (_storiesCache) {
        return _storiesCache;
    }
    try {
        const response = await fetch('/data/stories.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        _storiesCache = data;
        return data;
    } catch (error) {
        console.error('Failed to load stories data:', error);
        return { categories: [], stories: [] };
    }
}

/**
 * Render the stories modal content into the container
 * @param {HTMLElement} container - The stories-modal-container element
 */
function renderStoriesContent(container) {
    // Clear the container
    container.innerHTML = '';

    // Create the modal structure
    const modalBox = el('div', { className: 'modal-box' });
    const modalHeader = el('div', { className: 'modal-header' });
    const modalTitle = el('h2', { className: 'modal-title' }, 'Stories and Tips');
    const closeButton = el('button', {
        className: 'modal-close',
        'data-action': 'close-modal',
        'aria-label': 'Close modal'
    }, '✕');
    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(closeButton);
    modalBox.appendChild(modalHeader);

    const modalBody = el('div', { className: 'modal-body' });
    modalBox.appendChild(modalBody);
    container.appendChild(modalBox);

    // We'll populate the body after fetching data
    return { modalBody, closeButton };
}

/**
 * Populate the modal body with stories data
 * @param {HTMLElement} bodyElement - The modal body element
 * @param {Object} storiesData - The stories data from the JSON
 */
function populateStoriesBody(bodyElement, storiesData) {
    const { categories, stories } = storiesData;

    // Create a tabbed interface for categories
    const tabsContainer = el('div', { style: 'margin-bottom: 16px;' });
    const tabList = el('div', { 
        role: 'tablist', 
        style: 'display: flex; border-bottom: 1px solid var(--color-border-light); margin-bottom: 0;' 
    });
    const tabPanels = el('div');

    // Create tabs for each category
    categories.forEach((category, index) => {
        const isFirst = index === 0;
        const tab = el('button', {
            role: 'tab',
            'aria-controls': `tab-panel-${index}`,
            'aria-selected': isFirst ? 'true' : 'false',
            id: `tab-${index}`,
            className: `tab-btn ${isFirst ? 'active' : ''}`,
            style: `
                padding: 8px 16px;
                border: none;
                background: ${isFirst ? 'var(--color-bg-card)' : 'transparent'};
                color: ${isFirst ? 'var(--color-text-main)' : 'var(--color-text-muted)'};
                cursor: pointer;
                font-size: 0.9rem;
            `
        }, category);
        
        tab.addEventListener('click', () => {
            // Deactivate all tabs
            tabList.querySelectorAll('.tab-btn').forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
                t.style.background = 'transparent';
                t.style.color = 'var(--color-text-muted)';
            });
            // Activate clicked tab
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
            tab.style.background = 'var(--color-bg-card)';
            tab.style.color = 'var(--color-text-main)';
            
            // Show corresponding panel
            tabPanels.querySelectorAll('.tab-panel').forEach(p => {
                p.style.display = 'none';
            });
            const panel = tabPanels.querySelector(`#tab-panel-${index}`);
            if (panel) {
                panel.style.display = 'block';
            }
        });
        
        tabList.appendChild(tab);
    });

    tabsContainer.appendChild(tabList);

    // Create tab panels
    categories.forEach((category, index) => {
        const panel = el('div', {
            className: 'tab-panel',
            id: `tab-panel-${index}`,
            role: 'tabpanel',
            'aria-labelledby': `tab-${index}`,
            style: `display: ${index === 0 ? 'block' : 'none'}; padding: 16px 0;`
        });
        
        // Filter stories for this category
        const categoryStories = stories.filter(s => s.category === category);
        
        if (categoryStories.length === 0) {
            panel.appendChild(el('p', { 
                style: 'text-align: center; color: var(--color-text-muted); font-style: italic;'
            }, `No stories in the "${category}" category yet.`));
        } else {
            const storiesList = el('div', { 
                style: 'display: grid; gap: 16px;' 
            });
            
            categoryStories.forEach(story => {
                const storyCard = el('div', {
                    style: `
                        border: 1px solid var(--color-border-light);
                        border-radius: var(--radius-md);
                        padding: 12px;
                        background: var(--color-bg-body);
                    `
                });
                
                const title = el('h3', { 
                    style: 'margin: 0 0 8px 0; color: var(--color-accent); font-size: 1.1rem;'
                }, story.title);
                
                const categoryBadge = el('span', {
                    style: `
                        display: inline-block;
                        background: var(--color-bg-card);
                        color: var(--color-text-main);
                        padding: 2px 8px;
                        border-radius: 12px;
                        font-size: 0.75rem;
                        margin-bottom: 8px;
                    `
                }, story.category);
                
                const summary = el('p', {
                    style: 'margin: 0 0 8px 0; color: var(--color-text-main); font-size: 0.9rem;'
                }, story.summary);
                
                const content = el('div', {
                    style: 'line-height: 1.5; color: var(--color-text-main); font-size: 0.9rem;'
                });
                content.innerHTML = story.content || '';
                
                storyCard.appendChild(categoryBadge);
                storyCard.appendChild(title);
                storyCard.appendChild(summary);
                storyCard.appendChild(content);
                storiesList.appendChild(storyCard);
            });
            
            panel.appendChild(storiesList);
        }
        
        tabPanels.appendChild(panel);
    });

    tabsContainer.appendChild(tabPanels);
    bodyElement.appendChild(tabsContainer);
    
    // Add a footer with a close button (optional, since we have the X in header)
    const footer = el('div', {
        style: 'text-align: right; margin-top: 24px;'
    });
    const closeBtn = el('button', {
        className: 'btn-secondary btn-sm',
        style: 'padding: 6px 12px; font-size: 0.85rem;'
    }, 'Close');
    closeBtn.addEventListener('click', () => closeModal('stories-modal-container'));
    footer.appendChild(closeBtn);
    bodyElement.appendChild(footer);
}

/**
 * Initialize the stories modal (call once)
 */
export function initializeStoriesModal() {
    const container = document.getElementById('stories-modal-container');
    if (!container) {
        console.warn('Stories modal container not found');
        return;
    }
    
    // Register the modal with the new orchestrator
    registerModal('stories-modal-container', container);
    
    // We'll load content on demand when opening
}

/** Alias used by main.js boot sequence */
export const initializeStoriesHub = initializeStoriesModal;


/**
 * Open the stories modal
 * This function is called from the HTML button
 */
export function openStoriesModal() {
    const container = document.getElementById('stories-modal-container');
    if (!container) {
        console.error('Stories modal container not found');
        return;
    }
    
    // Initialize if not already done
    if (!container.dataset.initialized) {
        initializeStoriesModal();
        container.dataset.initialized = 'true';
    }
    
    // Fetch and render the stories data
    fetchStoriesData().then(data => {
        // Clear any existing content
        container.innerHTML = '';
        // Create the modal structure and get references to parts we need to fill
        const { modalBody } = renderStoriesContent(container);
        // Populate the body with the actual stories
        populateStoriesBody(modalBody, data);
        // Move to top of modal layer to appear above info modal
        const layer = document.getElementById('modal-layer');
        if (layer && container.parentElement === layer) {
            layer.appendChild(container);
        }
        
        // Finally, open the modal
        openModal('stories-modal-container');
    }).catch(error => {
        console.error('Error opening stories modal:', error);
        // Show an error message in the modal
        container.innerHTML = '';
        const { modalBody } = renderStoriesContent(container);
        modalBody.innerHTML = `
            <p style="text-align: center; color: var(--color-accent);">
                Failed to load stories. Please try again later.
            </p>
            <div style="text-align: right; margin-top: 24px;">
                <button class="btn-secondary btn-sm" onclick="closeModal('stories-modal-container')">
                    Close
                </button>
            </div>
        `;
        openModal('stories-modal-container');
    });
}