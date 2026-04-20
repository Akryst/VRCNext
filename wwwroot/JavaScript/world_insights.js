/* === World Insights â€” line charts for own-world stats === */

let _wiWorldId = '';
let _wiMode = 'week';       // 'day' | 'week' | 'month' | 'year'
let _wiAnchor = null;        // Date object â€” end of current range
let _wiData = [];            // raw stat points from backend
let _wiLoading = false;
let _wiInitialized = false;  // toolbar already rendered?
let _wiDpYear = 0, _wiDpMonth = 0; // date picker calendar state

function wiLocale() {
    return getLanguageLocale();
}

function wiWeekdayLabels() {
    const base = new Date(Date.UTC(2024, 0, 8)); // Monday
    const fmt = new Intl.DateTimeFormat(wiLocale(), { weekday: 'short' });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(base.getTime() + i * 86400000)));
}

// â”€â”€ Public entry point (called from switchWdTab) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function wiLoadInsights(worldId) {
    _wiWorldId = worldId;
    if (!_wiAnchor) _wiAnchor = new Date();
    // Re-render shell if DOM was destroyed (e.g., modal reopened)
    if (_wiInitialized && !document.getElementById('wiToolbar')) {
        _wiInitialized = false;
        _wiLoading = false;
    }
    if (!_wiInitialized) _wiRenderShell();
    _wiRequestData();
}

// â”€â”€ Date range helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _wiRange() {
    const a = new Date(_wiAnchor);
    let from, to;
    if (_wiMode === 'day') {
        from = new Date(a.getFullYear(), a.getMonth(), a.getDate());
        to = new Date(from);
        to.setHours(23, 59, 59, 999);
    } else if (_wiMode === 'week') {
        // Mondayâ€“Sunday (ISO week)
        const dow = a.getDay(); // 0=Sun
        const diffToMon = dow === 0 ? -6 : 1 - dow;
        from = new Date(a.getFullYear(), a.getMonth(), a.getDate() + diffToMon);
        to = new Date(from);
        to.setDate(to.getDate() + 6);
        to.setHours(23, 59, 59, 999);
    } else if (_wiMode === 'month') {
        from = new Date(a.getFullYear(), a.getMonth(), 1);
        to = new Date(a.getFullYear(), a.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
        from = new Date(a.getFullYear(), 0, 1);
        to = new Date(a.getFullYear(), 11, 31, 23, 59, 59, 999);
    }
    return { from, to };
}

function _wiFmt(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function _wiRangeLabel() {
    const { from, to } = _wiRange();
    if (_wiMode === 'day') return fmtShortDate(to);
    if (_wiMode === 'week') {
        return fmtShortDate(from) + ' – ' + fmtShortDate(to);
    }
    if (_wiMode === 'month') return from.toLocaleDateString(getLanguageLocale(), { month: 'long', year: 'numeric' });
    return String(from.getFullYear());
}

// â”€â”€ Navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function wiSetMode(mode) {
    _wiMode = mode;
    _wiUpdateToolbar();
    _wiRequestData();
}

function wiNav(dir) {
    const d = _wiAnchor;
    if (_wiMode === 'day') d.setDate(d.getDate() + dir);
    else if (_wiMode === 'week') d.setDate(d.getDate() + dir * 7);
    else if (_wiMode === 'month') d.setMonth(d.getMonth() + dir);
    else d.setFullYear(d.getFullYear() + dir);
    _wiUpdateToolbar();
    _wiRequestData();
}

function wiToday() {
    _wiAnchor = new Date();
    _wiUpdateToolbar();
    _wiRequestData();
}

// â”€â”€ Date Picker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function wiToggleDatePicker() {
    const picker = document.getElementById('wiDatePicker');
    if (!picker) return;
    if (picker.style.display !== 'none') {
        picker.style.display = 'none';
        document.removeEventListener('click', _wiCloseDpOutside);
        return;
    }
    _wiDpYear = _wiAnchor.getFullYear();
    _wiDpMonth = _wiAnchor.getMonth();
    picker.style.display = '';
    _wiRenderDpCalendar();
    setTimeout(() => document.addEventListener('click', _wiCloseDpOutside), 0);
}

function _wiCloseDpOutside(e) {
    const picker = document.getElementById('wiDatePicker');
    const btn = document.getElementById('wiDateBtn');
    if (picker && !picker.contains(e.target) && btn && !btn.contains(e.target)) {
        picker.style.display = 'none';
        document.removeEventListener('click', _wiCloseDpOutside);
    }
}

function _wiRenderDpCalendar() {
    const grid = document.getElementById('wiDpGrid');
    const label = document.getElementById('wiDpMonthLabel');
    if (!grid || !label) return;

    label.textContent = new Date(_wiDpYear, _wiDpMonth, 1).toLocaleDateString(wiLocale(), { month: 'long', year: 'numeric' });

    const todayStr = _wiFmt(new Date());
    const selStr = _wiFmt(_wiAnchor);
    const firstDow = new Date(_wiDpYear, _wiDpMonth, 1).getDay();
    const firstDowMon = (firstDow + 6) % 7;
    const daysInMonth = new Date(_wiDpYear, _wiDpMonth + 1, 0).getDate();
    const daysInPrevMo = new Date(_wiDpYear, _wiDpMonth, 0).getDate();

    let html = '';
    for (let i = firstDowMon - 1; i >= 0; i--) {
        const d = daysInPrevMo - i;
        const ds = _wiFmt(new Date(_wiDpYear, _wiDpMonth - 1, d));
        html += `<button class="tl-dp-day other-month${ds === selStr ? ' selected' : ''}" onclick="wiSelectDate('${ds}')">${d}</button>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const ds = _wiFmt(new Date(_wiDpYear, _wiDpMonth, d));
        const cls = (ds === todayStr ? ' today' : '') + (ds === selStr ? ' selected' : '');
        html += `<button class="tl-dp-day${cls}" onclick="wiSelectDate('${ds}')">${d}</button>`;
    }
    const used = firstDowMon + daysInMonth;
    const remaining = used % 7 === 0 ? 0 : 7 - (used % 7);
    for (let d = 1; d <= remaining; d++) {
        const ds = _wiFmt(new Date(_wiDpYear, _wiDpMonth + 1, d));
        html += `<button class="tl-dp-day other-month${ds === selStr ? ' selected' : ''}" onclick="wiSelectDate('${ds}')">${d}</button>`;
    }
    grid.innerHTML = html;
}

function wiDpNav(dir) {
    _wiDpMonth += dir;
    if (_wiDpMonth < 0) { _wiDpMonth = 11; _wiDpYear--; }
    if (_wiDpMonth > 11) { _wiDpMonth = 0; _wiDpYear++; }
    _wiRenderDpCalendar();
}

function wiSelectDate(dateStr) {
    _wiAnchor = new Date(dateStr + 'T12:00:00');
    document.getElementById('wiDatePicker').style.display = 'none';
    document.removeEventListener('click', _wiCloseDpOutside);
    _wiUpdateToolbar();
    _wiRequestData();
}

// â”€â”€ Data fetching â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _wiRequestData() {
    _wiLoading = true;
    const { from, to } = _wiRange();
    sendToCS({ action: 'getWorldInsights', worldId: _wiWorldId, from: from.toISOString(), to: to.toISOString() });
}

function wiRefresh() {
    _wiLoading = true;
    const { from, to } = _wiRange();
    const btn = document.getElementById('wiRefreshBtn');
    if (btn) btn.classList.add('wi-spin');
    sendToCS({ action: 'refreshWorldInsights', worldId: _wiWorldId, from: from.toISOString(), to: to.toISOString() });
}

function wiHandleData(payload) {
    if (payload.worldId !== _wiWorldId) return;
    _wiData = payload.stats || [];
    _wiLoading = false;
    const btn = document.getElementById('wiRefreshBtn');
    if (btn) btn.classList.remove('wi-spin');
    _wiRenderCharts();
}

// â”€â”€ Bucket data into chart points â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _wiBucket() {
    const { from, to } = _wiRange();
    const points = [];

    if (_wiMode === 'day') {
        for (let h = 0; h < 24; h++) {
            points.push({ label: String(h).padStart(2, '0') + ':00', active: 0, favorites: 0, visits: 0, count: 0 });
        }
        _wiData.forEach(p => {
            const d = new Date(p.Timestamp || p.timestamp);
            const h = d.getHours();
            if (h >= 0 && h < 24) {
                points[h].active = Math.max(points[h].active, p.Active ?? p.active ?? 0);
                points[h].favorites = Math.max(points[h].favorites, p.Favorites ?? p.favorites ?? 0);
                points[h].visits = Math.max(points[h].visits, p.Visits ?? p.visits ?? 0);
                points[h].count++;
            }
        });
    } else if (_wiMode === 'year') {
        // 12 monthly buckets â€” always Janâ€“Dec of the anchor year
        const year = from.getFullYear();
        for (let i = 0; i < 12; i++) {
            const key = year + '-' + String(i + 1).padStart(2, '0');
            const label = new Date(year, i, 1).toLocaleDateString(wiLocale(), { month: 'short' });
            points.push({ label, monthKey: key, active: 0, favorites: 0, visits: 0, count: 0 });
        }
        _wiData.forEach(p => {
            const d = new Date(p.Timestamp || p.timestamp);
            const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            const pt = points.find(x => x.monthKey === key);
            if (pt) {
                pt.active = Math.max(pt.active, p.Active ?? p.active ?? 0);
                pt.favorites = Math.max(pt.favorites, p.Favorites ?? p.favorites ?? 0);
                pt.visits = Math.max(pt.visits, p.Visits ?? p.visits ?? 0);
                pt.count++;
            }
        });
    } else {
        // week (7 days Monâ€“Sun) or month (actual days in month)
        const start = new Date(from);
        const days = Math.floor((to - from) / (1000 * 60 * 60 * 24)) + 1;
        for (let i = 0; i < days; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            const dayStr = _wiFmt(d);
            const shortLabel = _wiMode === 'week'
                ? d.toLocaleDateString(wiLocale(), { weekday: 'short' })
                : String(d.getDate());
            points.push({ label: shortLabel, dateStr: dayStr, active: 0, favorites: 0, visits: 0, count: 0 });
        }
        _wiData.forEach(p => {
            const d = new Date(p.Timestamp || p.timestamp);
            const dayStr = _wiFmt(d);
            const pt = points.find(x => x.dateStr === dayStr);
            if (pt) {
                pt.active = Math.max(pt.active, p.Active ?? p.active ?? 0);
                pt.favorites = Math.max(pt.favorites, p.Favorites ?? p.favorites ?? 0);
                pt.visits = Math.max(pt.visits, p.Visits ?? p.visits ?? 0);
                pt.count++;
            }
        });
    }
    return points;
}

// â”€â”€ Render: Shell (toolbar â€” rendered once) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _wiRenderShell() {
    const container = document.getElementById('wiContainer');
    if (!container) return;
    _wiInitialized = true;
    const weekdayHtml = wiWeekdayLabels().map(label => `<div class="tl-dp-wd">${esc(label)}</div>`).join('');

    container.innerHTML = `
        <div class="wi-toolbar" id="wiToolbar">
            <div class="wi-modes" id="wiModes"></div>
            <div class="wi-nav">
                <button class="vrcn-button" onclick="wiNav(-1)"><span class="msi" style="font-size:16px;">chevron_left</span></button>
                <button class="vrcn-button wi-today-btn" id="wiDateBtn" onclick="wiToggleDatePicker()"><span class="msi" style="font-size:14px;">today</span></button>
                <span class="wi-range-label" id="wiRangeLabel"></span>
                <button class="vrcn-button" onclick="wiNav(1)"><span class="msi" style="font-size:16px;">chevron_right</span></button>
                <button class="vrcn-button" id="wiRefreshBtn" onclick="wiRefresh()" title="${esc(t('world_insights.refresh_title', 'Refresh current data'))}"><span class="msi" style="font-size:14px;">refresh</span></button>
            </div>
        </div>
        <div class="wi-dp-wrap" style="position:relative;">
            <div id="wiDatePicker" class="tl-date-picker wi-date-picker" style="display:none;">
                <div class="tl-dp-header">
                    <button class="tl-dp-nav" onclick="wiDpNav(-1)"><span class="msi" style="font-size:16px;">chevron_left</span></button>
                    <span id="wiDpMonthLabel" class="tl-dp-month-label"></span>
                    <button class="tl-dp-nav" onclick="wiDpNav(1)"><span class="msi" style="font-size:16px;">chevron_right</span></button>
                </div>
                <div class="tl-dp-weekdays">${weekdayHtml}</div>
                <div id="wiDpGrid" class="tl-dp-days"></div>
                <div class="tl-dp-footer">
                    <button class="vrcn-button" style="flex:1;justify-content:center;font-size:11px;" onclick="wiSelectDate('${_wiFmt(new Date())}')">${t('world_insights.today', 'Today')}</button>
                </div>
            </div>
        </div>
        <div id="wiCharts"><div class="empty-msg" style="margin-top:20px;">${t('world_insights.loading', 'Loading insights...')}</div></div>`;

    const area = document.getElementById('wiCharts');
    if (area) {
        area.innerHTML = `<div class="empty-msg" style="margin-top:20px;">${t('world_insights.loading', 'Loading insights...')}</div>`;
    }
    _wiUpdateToolbar();
}

// â”€â”€ Render: Toolbar update (no DOM rebuild) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _wiUpdateToolbar() {
    const modeBtn = (m, label) =>
        `<button class="vrcn-button wi-mode-btn${_wiMode === m ? ' wi-active' : ''}" onclick="wiSetMode('${m}')">${label}</button>`;

    const modes = document.getElementById('wiModes');
    if (modes) {
        modes.innerHTML =
            modeBtn('day', t('world_insights.mode.day', 'Day')) +
            modeBtn('week', t('world_insights.mode.week', 'Week')) +
            modeBtn('month', t('world_insights.mode.month', 'Month')) +
            modeBtn('year', t('world_insights.mode.year', 'Year'));
    }

    const rangeLabel = document.getElementById('wiRangeLabel');
    if (rangeLabel) rangeLabel.textContent = _wiRangeLabel();
}

// â”€â”€ Render: Charts only â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _wiRenderCharts() {
    const area = document.getElementById('wiCharts');
    if (!area) return;

    if (!_wiData.length) {
        area.innerHTML = `<div class="empty-msg" style="margin-top:20px;">${t('world_insights.empty', 'No data collected yet for this period.')}</div>`;
        return;
    }

    area.innerHTML = `
        <div class="wi-chart-card">
            <div class="wi-chart-title"><span class="msi" style="font-size:14px;color:var(--accent);">person</span> ${t('world_insights.chart.active_players', 'Active Players')}</div>
            <canvas id="wiChartActive" height="160"></canvas>
        </div>
        <div class="wi-chart-card">
            <div class="wi-chart-title"><span class="msi" style="font-size:14px;color:var(--ok);">star</span> ${t('world_insights.chart.favorites', 'Favorites')}</div>
            <canvas id="wiChartFavorites" height="160"></canvas>
        </div>
        <div class="wi-chart-card">
            <div class="wi-chart-title"><span class="msi" style="font-size:14px;color:var(--cyan);">visibility</span> ${t('world_insights.chart.visits', 'Visits')}</div>
            <canvas id="wiChartVisits" height="160"></canvas>
        </div>`;

    const pts = _wiBucket();
    _wiDrawChart('wiChartActive',    pts, 'active',    'var(--accent)');
    _wiDrawChart('wiChartFavorites', pts, 'favorites', 'var(--ok)');
    _wiDrawChart('wiChartVisits',    pts, 'visits',    'var(--cyan)');
}

// â”€â”€ Canvas line chart â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _wiDrawChart(canvasId, points, key, cssColor) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !points.length) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const pad = { top: 20, right: 16, bottom: 28, left: 42 };
    const cw = W - pad.left - pad.right;
    const ch = H - pad.top - pad.bottom;

    const color = _wiResolveColor(cssColor);
    const values = points.map(p => p[key]);
    const maxVal = Math.max(1, ...values);

    // Grid lines
    ctx.strokeStyle = _wiResolveColor('var(--bg-hover)');
    ctx.lineWidth = 1;
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
        const y = pad.top + (ch / gridLines) * i;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(W - pad.right, y);
        ctx.stroke();
    }

    // Y-axis labels
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = _wiResolveColor('var(--tx3)');
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= gridLines; i++) {
        const y = pad.top + (ch / gridLines) * i;
        const v = Math.round(maxVal * (1 - i / gridLines));
        ctx.fillText(_wiShortNum(v), pad.left - 6, y);
    }

    // X-axis labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const step = points.length > 14 ? Math.ceil(points.length / 10) : 1;
    points.forEach((p, i) => {
        if (i % step !== 0 && i !== points.length - 1) return;
        const x = pad.left + (i / (points.length - 1 || 1)) * cw;
        ctx.fillText(p.label, x, H - pad.bottom + 8);
    });

    // Fill gradient
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
    grad.addColorStop(0, _wiAlpha(color, 0.25));
    grad.addColorStop(1, _wiAlpha(color, 0.02));

    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top + ch);
    points.forEach((p, i) => {
        const x = pad.left + (i / (points.length - 1 || 1)) * cw;
        const y = pad.top + ch - (values[i] / maxVal) * ch;
        ctx.lineTo(x, y);
    });
    ctx.lineTo(pad.left + cw, pad.top + ch);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    points.forEach((p, i) => {
        const x = pad.left + (i / (points.length - 1 || 1)) * cw;
        const y = pad.top + ch - (values[i] / maxVal) * ch;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Data points
    if (points.length <= 31) {
        points.forEach((p, i) => {
            const x = pad.left + (i / (points.length - 1 || 1)) * cw;
            const y = pad.top + ch - (values[i] / maxVal) * ch;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = _wiResolveColor('var(--bg-card)');
            ctx.lineWidth = 1.5;
            ctx.stroke();
        });
    }
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _wiResolveColor(css) {
    if (!css.startsWith('var(')) return css;
    const prop = css.slice(4, -1);
    return getComputedStyle(document.documentElement).getPropertyValue(prop).trim() || '#888';
}

function _wiAlpha(hex, a) {
    if (hex.startsWith('#')) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${a})`;
    }
    if (hex.startsWith('rgb(')) return hex.replace('rgb(', 'rgba(').replace(')', `,${a})`);
    return hex;
}

function _wiShortNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
}

// Reset state when modal closes
function _wiReset() {
    _wiInitialized = false;
    _wiData = [];
    _wiLoading = false;
}

function rerenderWorldInsightsTranslations() {
    if (!_wiInitialized || !document.getElementById('wiContainer')) return;
    _wiRenderShell();
    if (!_wiLoading) _wiRenderCharts();
}

document.documentElement.addEventListener('languagechange', rerenderWorldInsightsTranslations);
