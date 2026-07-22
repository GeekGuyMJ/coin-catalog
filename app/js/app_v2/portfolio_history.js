import { createModal } from './modals.v2.js';
import { el } from './utils.js';

export function openPortfolioHistoryModal() {
    var historyStr = localStorage.getItem('cc-portfolio-history');
    var history = [];
    try {
        history = JSON.parse(historyStr || '[]');
    } catch(e) {}

    var body = el('div', { style: 'text-align:center;' });
    
    if (history.length < 2) {
        body.appendChild(el('p', { style: 'color:var(--color-text-muted);' }, 'Not enough portfolio history to display a chart. Check back later!'));
    } else {
        var cvs = el('canvas', { width: 600, height: 300, style: 'width:100%; max-width:600px; height:auto; background:var(--color-bg-light); border-radius:8px;' });
        body.appendChild(cvs);
        
        setTimeout(function() {
            _drawBigSparkline(cvs, history, '#10b981', cvs.width || 600, cvs.height || 300);
        }, 50);
    }

    createModal('modal-portfolio-history', 'Portfolio History', body, null);
}

export function initPortfolioHistory() {}

function _drawBigSparkline(canvas, data, color, width, height) {
    if (!data || data.length < 2) return;
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d');
    var vals = data.map(function(d){return d.v;});
    var min = Math.min.apply(null, vals);
    var max = Math.max.apply(null, vals);
    var range = max - min || 1;
    var pad = 20; // more padding for bigger chart
    var w = width - pad * 2;
    var h = height - pad * 2;

    // Draw grid lines
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (var i = 0; i <= 4; i++) {
        var yLine = pad + (i/4) * h;
        ctx.moveTo(pad, yLine);
        ctx.lineTo(pad + w, yLine);
    }
    ctx.stroke();

    // Draw line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    vals.forEach(function(v, i) {
        var x = pad + (i / (vals.length - 1)) * w;
        var y = pad + h - ((v - min) / range) * h;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw fill under line
    ctx.lineTo(pad + w, pad + h);
    ctx.lineTo(pad, pad + h);
    ctx.closePath();
    var grad = ctx.createLinearGradient(0, pad, 0, pad + h);
    grad.addColorStop(0, color + '60');
    grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw current value dot
    var lastX = pad + w;
    var lastY = pad + h - ((vals[vals.length-1] - min) / range) * h;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Draw text values (min and max)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('$' + max.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}), pad - 5, pad + 4);
    ctx.fillText('$' + min.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}), pad - 5, pad + h + 4);
}
