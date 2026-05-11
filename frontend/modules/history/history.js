/* history tabs: world visit, instance, avatar worn, moderation log */

function _histEmpty(msg) {
    return `<div class="empty-msg">${esc(msg)}</div>`;
}

function _histDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return fmtShortDate(d) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderWorldVisitHistory(entries) {
    const el = document.getElementById('worldVisitHistoryList');
    if (!el) return;
    if (!entries.length) { el.innerHTML = _histEmpty('No world visits recorded yet.'); return; }
    el.innerHTML = entries.map(e => {
        const thumb = e.worldThumb ? `<img class="hist-thumb" src="${esc(e.worldThumb)}" onerror="this.style.display='none'">` : `<div class="hist-thumb hist-thumb-empty"><span class="msi">travel_explore</span></div>`;
        const visits = e.visitCount > 0 ? `<span class="hist-badge">${e.visitCount} visit${e.visitCount !== 1 ? 's' : ''}</span>` : '';
        return `<div class="hist-row" onclick="navOpenModal('worldSearch','${jsq(e.worldId || '')}','${jsq(e.worldName || '')}')">
            ${thumb}
            <div class="hist-info">
                <div class="hist-name">${esc(e.worldName || e.worldId || 'Unknown World')}</div>
                <div class="hist-meta">${esc(_histDate(e.lastVisited))}${visits ? ' &middot; ' + visits : ''}</div>
            </div>
        </div>`;
    }).join('');
}

function renderInstanceHistory(entries) {
    const el = document.getElementById('instanceHistoryList');
    if (!el) return;
    if (!entries.length) { el.innerHTML = _histEmpty('No instances recorded yet.'); return; }
    el.innerHTML = entries.map(e => {
        const thumb = e.worldThumb ? `<img class="hist-thumb" src="${esc(e.worldThumb)}" onerror="this.style.display='none'">` : `<div class="hist-thumb hist-thumb-empty"><span class="msi">event</span></div>`;
        const players = e.playerCount > 0 ? `<span class="hist-badge">${e.playerCount} player${e.playerCount !== 1 ? 's' : ''}</span>` : '';
        const duration = e.durationSeconds > 0 ? formatDuration(e.durationSeconds) : '';
        return `<div class="hist-row" onclick="navOpenModal('worldSearch','${jsq(e.worldId || '')}','${jsq(e.worldName || '')}')">
            ${thumb}
            <div class="hist-info">
                <div class="hist-name">${esc(e.worldName || e.worldId || 'Unknown World')}</div>
                <div class="hist-meta">${esc(_histDate(e.joinTime))}${players ? ' &middot; ' + players : ''}${duration ? ' &middot; ' + esc(duration) : ''}</div>
                <div class="hist-sub">${esc(e.instanceId || '')}</div>
            </div>
        </div>`;
    }).join('');
}

function renderAvatarWornHistory(entries) {
    const el = document.getElementById('avatarWornHistoryList');
    if (!el) return;
    if (!entries.length) { el.innerHTML = _histEmpty('No avatar history recorded yet.'); return; }
    el.innerHTML = entries.map(e => {
        return `<div class="hist-row" onclick="e.avatarId&&navOpenModal('avatar','${jsq(e.avatarId || '')}','${jsq(e.avatarName || '')}')">
            <div class="hist-thumb hist-thumb-empty"><span class="msi">checkroom</span></div>
            <div class="hist-info">
                <div class="hist-name">${esc(e.avatarName || e.avatarId || 'Unknown Avatar')}</div>
                <div class="hist-meta">${esc(_histDate(e.wornAt))}${e.worldName ? ' &middot; ' + esc(e.worldName) : ''}</div>
            </div>
        </div>`;
    }).join('');
}

const _modActionColor = { block: 'var(--err)', mute: 'var(--warn)', unblock: 'var(--ok)', unmute: 'var(--ok)' };
const _modActionIcon  = { block: 'block', mute: 'mic_off', unblock: 'check_circle', unmute: 'mic' };

function renderModerationLog(entries) {
    const el = document.getElementById('moderationLogList');
    if (!el) return;
    if (!entries.length) { el.innerHTML = _histEmpty('No moderation actions recorded yet.'); return; }
    el.innerHTML = entries.map(e => {
        const color = _modActionColor[e.action] || 'var(--tx3)';
        const icon  = _modActionIcon[e.action]  || 'gavel';
        return `<div class="hist-row" onclick="navOpenModal('friend','${jsq(e.userId || '')}','${jsq(e.displayName || '')}')">
            <div class="hist-thumb hist-thumb-empty" style="background:${color}22;color:${color};"><span class="msi" style="font-size:18px;">${icon}</span></div>
            <div class="hist-info">
                <div class="hist-name">${esc(e.displayName || e.userId || 'Unknown User')}</div>
                <div class="hist-meta" style="color:${color};">${esc(e.action || '')}${e.note ? ' &middot; ' + esc(e.note) : ''}</div>
                <div class="hist-sub">${esc(_histDate(e.actionTime))}</div>
            </div>
        </div>`;
    }).join('');
}
