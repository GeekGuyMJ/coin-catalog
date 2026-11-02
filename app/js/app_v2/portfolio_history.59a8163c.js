/**
 * portfolio_history.js — Portfolio Value History Chart
 *
 * Renders an interactive Chart.js line chart showing portfolio value over time.
 * Supports 30d/90d/1yr/All time range filters.
 *
 * @module portfolio_history
 */

import { el } from './utils.js';
import { openModalLegacy } from './modals.js';
import { getValueHistoryLog } from './state.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _historyData = null;
let _activeFilter = 'all';
let chartInstance = null;
let dashChartInstance = null;

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

function fetchHistory() {
    if (_historyData) return Promise.resolve(_historyData);
    // Use the state history log if already fetched, or fetch it
    const log = getValueHistoryLog();
    if (log && log.length > 0) {
        _historyData = [...log].sort(function(a, b) {
            return (a.date || '').localeCompare(b.date || '');
        });
        return Promise.resolve(_historyData);
    }
    return fetch('/api/portfolio/history')
        .then(function(r) { return r.ok ? r.json() : []; })
        .then(function(d) {
            _historyData = (d || []).sort(function(a, b) {
                return (a.date || '').localeCompare(b.date || '');
            });
            return _historyData;
        })
        .catch(function() { return []; });
}

function filterByRange(data, range) {
    if (!data || !data.length || range === 'all') return data;
    var now = new Date();
    var cutoff = new Date();
    if (range === '30d') cutoff.setDate(now.getDate() - 30);
    else if (range === '90d') cutoff.setDate(now.getDate() - 90);
    else if (range === '1y') cutoff.setFullYear(now.getFullYear() - 1);
    else return data;
    var cutStr = cutoff.toISOString().slice(0, 10);
    return data.filter(function(d) { return (d.date || '') >= cutStr; });
}

// ---------------------------------------------------------------------------
// Chart.js Chart renderers
// ---------------------------------------------------------------------------

function drawChart(canvas, data) {
    if (!data || data.length < 2) return;

    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }

    var labels = data.map(function(d) { return formatDate(d.date); });
    var vals = data.map(function(d) { return d.total_value || d.value || 0; });

    var styles = getComputedStyle(document.documentElement);
    var colorAccent = styles.getPropertyValue('--color-accent').trim() || '#3b82f6';
    var colorText = styles.getPropertyValue('--color-text-main').trim() || '#fff';
    var colorMuted = styles.getPropertyValue('--color-text-muted').trim() || '#888';
    var colorBorder = styles.getPropertyValue('--color-border-light').trim() || '#333';

    chartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Portfolio Value',
                data: vals,
                borderColor: colorAccent,
                backgroundColor: colorAccent + '1a', // subtle transparent area fill
                borderWidth: 2,
                fill: true,
                tension: 0.2,
                pointRadius: 3,
                pointHoverRadius: 6,
                pointBackgroundColor: colorAccent
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Value: $' + context.raw.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: colorBorder, drawOnChartArea: true },
                    ticks: { color: colorMuted, font: { size: 9 } }
                },
                y: {
                    grid: { color: colorBorder, drawOnChartArea: true },
                    ticks: {
                        color: colorMuted,
                        font: { size: 9 },
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

function drawDashboardHistoryChart(canvas, data) {
    if (dashChartInstance) {
        dashChartInstance.destroy();
        dashChartInstance = null;
    }

    var labels = data.map(function(d) { return formatDate(d.date); });
    var vals = data.map(function(d) { return d.total_value || d.value || 0; });

    var styles = getComputedStyle(document.documentElement);
    var colorAccent = styles.getPropertyValue('--color-accent').trim() || '#3b82f6';

    dashChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                data: vals,
                borderColor: colorAccent,
                backgroundColor: colorAccent + '0a',
                borderWidth: 1.5,
                fill: true,
                tension: 0.2,
                pointRadius: 0,
                pointHoverRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return '$' + context.raw.toLocaleString(undefined, { maximumFractionDigits: 0 });
                        }
                    }
                }
            },
            scales: {
                x: { display: false },
                y: { display: false }
            }
        }
    });
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    var parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return parts[1] + '/' + parts[2];
}

// ---------------------------------------------------------------------------
// Dashboard Card Builder
// ---------------------------------------------------------------------------

export function buildPortfolioHistoryCard(allData) {
    var card = el('div', { className: 'card dashboard-card history-card', id: 'card-history' });
    card.appendChild(el('div', { className: 'card-title' }, '📊 Portfolio History'));

    var container = el('div', { style: 'position:relative; width:100%; height:120px; margin-top:8px;' });
    var canvas = el('canvas', { id: 'dash-history-canvas', style: 'width:100%; height:100%;' });
    container.appendChild(canvas);
    card.appendChild(container);

    if (!allData || allData.length < 2) {
        container.style.display = 'none';
        var noData = el('div', { style: 'text-align:center; padding:16px; color:var(--color-text-muted); font-size:0.85em;' }, 'Collecting portfolio value history...');
        card.appendChild(noData);
    } else {
        requestAnimationFrame(function() {
            var dashCanvas = document.getElementById('dash-history-canvas');
            if (dashCanvas) {
                // Show last 30 snapshots for dashboard sparkline
                drawDashboardHistoryChart(dashCanvas, allData.slice(-30));
            }
        });
    }

    card.style.cursor = 'pointer';
    card.addEventListener('click', function(e) {
        e.stopPropagation();
        openPortfolioHistoryModal();
    });

    return card;
}

// ---------------------------------------------------------------------------
// Modal UI
// ---------------------------------------------------------------------------

export function openPortfolioHistoryModal() {
    var existing = document.getElementById('modal-portfolio-history');
    if (existing) existing.remove();

    var modal = el('div', { className: 'modal-overlay', id: 'modal-portfolio-history' });
    var wrapper = el('div', { className: 'modal-window-wrapper' });

    var header = el('div', { className: 'modal-card-header' });
    header.innerHTML = '<h3>📈 Portfolio Value History</h3><button class="modal-close-btn" data-action="close-modal" data-modal-id="modal-portfolio-history">✕</button>';
    wrapper.appendChild(header);

    var body = el('div', { className: 'modal-card-body' });

    var filterRow = el('div', { style: 'display:flex;gap:6px;justify-content:center;margin-bottom:16px;flex-wrap:wrap;' });
    var filters = [
        { key: '30d', label: '30 Days' },
        { key: '90d', label: '90 Days' },
        { key: '1y', label: '1 Year' },
        { key: 'all', label: 'All Time' },
    ];
    filters.forEach(function(f) {
        var btn = el('button', {
            className: 'btn-filter-pill' + (f.key === _activeFilter ? ' active' : ''),
            dataset: { filter: f.key },
            style: 'padding:4px 14px;border-radius:20px;border:1px solid var(--color-border-light);background:' + (f.key === _activeFilter ? 'var(--color-accent)' : 'transparent') + ';color:' + (f.key === _activeFilter ? '#fff' : 'var(--color-text-muted)') + ';cursor:pointer;font-size:0.8em;font-weight:600;transition:all 0.15s;',
        }, f.label);
        btn.onclick = function() {
            _activeFilter = f.key;
            updateChart();
        };
        filterRow.appendChild(btn);
    });
    body.appendChild(filterRow);

    var loading = el('div', { id: 'ph-loading', style: 'text-align:center;padding:40px;color:var(--color-text-muted);' }, 'Loading history…');
    body.appendChild(loading);

    // Canvas container
    var canvasContainer = el('div', { id: 'ph-canvas-container', style: 'position:relative; width:100%; height:260px; display:none; max-width:600px; margin:0 auto;' });
    var canvas = el('canvas', { id: 'ph-chart-canvas', style: 'width:100%; height:100%; border-radius:8px;' });
    canvasContainer.appendChild(canvas);
    body.appendChild(canvasContainer);

    var emptyMsg = el('div', { id: 'ph-empty-msg', style: 'text-align:center;padding:40px;color:var(--color-text-muted);display:none;' });
    emptyMsg.innerHTML = '<div style="font-size:2rem;margin-bottom:8px;">📊</div>No portfolio history yet.<br><span style="font-size:0.85em;opacity:0.7;">Value snapshots are recorded automatically each day.</span>';
    body.appendChild(emptyMsg);

    var stats = el('div', { id: 'ph-stats', style: 'display:none;gap:12px;justify-content:center;margin-top:16px;flex-wrap:wrap;' });
    body.appendChild(stats);

    var metalSection = el('div', { id: 'ph-metals', style: 'display:none;margin-top:20px;padding-top:16px;border-top:1px solid var(--color-border-light);' });
    body.appendChild(metalSection);

    wrapper.appendChild(body);
    modal.appendChild(wrapper);
    document.body.appendChild(modal);

    openModalLegacy('modal-portfolio-history');

    updateChart();
}

function updateChart() {
    fetchHistory().then(function(allData) {
        var data = filterByRange(allData, _activeFilter);

        var loading = document.getElementById('ph-loading');
        var container = document.getElementById('ph-canvas-container');
        var canvas = document.getElementById('ph-chart-canvas');
        var emptyMsg = document.getElementById('ph-empty-msg');
        var stats = document.getElementById('ph-stats');
        var metalSection = document.getElementById('ph-metals');

        if (!canvas) return;

        if (loading) loading.style.display = 'none';

        document.querySelectorAll('[data-filter]').forEach(function(btn) {
            var isActive = btn.dataset.filter === _activeFilter;
            btn.style.background = isActive ? 'var(--color-accent)' : 'transparent';
            btn.style.color = isActive ? '#fff' : 'var(--color-text-muted)';
        });

        if (!data || data.length < 2) {
            if (container) container.style.display = 'none';
            if (stats) stats.style.display = 'none';
            if (emptyMsg) {
                emptyMsg.style.display = 'block';
                if (data && data.length === 1) {
                    emptyMsg.innerHTML = '<div style="font-size:2rem;margin-bottom:8px;">📊</div>1 data point recorded.<br><span style="font-size:0.85em;opacity:0.7;">Check back tomorrow for the trend chart.</span>';
                }
            }
            if (metalSection) metalSection.style.display = 'none';
            return;
        }

        if (emptyMsg) emptyMsg.style.display = 'none';
        if (container) container.style.display = 'block';
        if (stats) stats.style.display = 'flex';

        requestAnimationFrame(function() { drawChart(canvas, data); });

        if (stats) {
            stats.innerHTML = '';
            var vals = data.map(function(d) { return d.total_value || d.value || 0; });
            var first = vals[0];
            var last = vals[vals.length - 1];
            var change = last - first;
            var changePct = first > 0 ? (change / first * 100) : 0;
            var changeColor = change >= 0 ? '#22c55e' : '#ef4444';
            var changeSign = change >= 0 ? '+' : '';
            var minVal = Math.min.apply(null, vals);
            var maxVal = Math.max.apply(null, vals);

            var statItems = [
                { label: 'Current Value', value: '$' + last.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
                { label: 'Period Change', value: changeSign + '$' + Math.abs(change).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), color: changeColor },
                { label: 'Period %', value: changeSign + changePct.toFixed(1) + '%', color: changeColor },
                { label: 'High', value: '$' + maxVal.toLocaleString('en-US', { maximumFractionDigits: 0 }) },
                { label: 'Low', value: '$' + minVal.toLocaleString('en-US', { maximumFractionDigits: 0 }) },
                { label: 'Snapshots', value: data.length.toString() },
            ];
            statItems.forEach(function(s) {
                var box = el('div', { style: 'text-align:center;padding:8px 14px;background:var(--color-bg-card);border:1px solid var(--color-border-light);border-radius:8px;min-width:90px;' });
                box.appendChild(el('div', { style: 'font-size:0.7em;color:var(--color-text-muted);margin-bottom:3px;text-transform:uppercase;letter-spacing:0.5px;' }, s.label));
                box.appendChild(el('div', { style: 'font-size:1.05em;font-weight:700;' + (s.color ? 'color:' + s.color + ';' : '') }, s.value));
                stats.appendChild(box);
            });
        }

        if (metalSection && data.length > 0) {
            var latest = data[data.length - 1];
            if (latest.gold_spot || latest.silver_spot) {
                metalSection.style.display = 'block';
                metalSection.innerHTML = '';
                metalSection.appendChild(el('div', { style: 'font-size:0.8em;color:var(--color-text-muted);margin-bottom:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;' }, 'Spot Prices at Last Snapshot'));
                var metalGrid = el('div', { style: 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap;' });
                var metals = [
                    { name: '🥇 Gold', val: latest.gold_spot },
                    { name: '🥈 Silver', val: latest.silver_spot },
                    { name: '🔷 Platinum', val: latest.platinum_spot },
                    { name: '💠 Palladium', val: latest.palladium_spot },
                ];
                metals.forEach(function(m) {
                    if (!m.val) return;
                    var chip = el('div', { style: 'padding:6px 12px;background:var(--color-bg-card);border:1px solid var(--color-border-light);border-radius:6px;font-size:0.85em;' });
                    chip.innerHTML = m.name + ' <strong>$' + m.val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</strong>';
                    metalGrid.appendChild(chip);
                });
                metalSection.appendChild(metalGrid);
            } else {
                metalSection.style.display = 'none';
            }
        }
    });
}

// ---------------------------------------------------------------------------
// Init — auto-refresh cache every 5 minutes
// ---------------------------------------------------------------------------

export function initPortfolioHistory() {
    setInterval(function() { _historyData = null; }, 300000);
}
