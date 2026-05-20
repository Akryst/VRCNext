/**
 * @param {object} user 
 * @param {string} onclick 
 * @param {object} [opts] 
 * @returns {string} 
 */
function renderUserItem(user, onclick, opts) {
    opts = opts || {};
    const id = user.id || user.userId || '';
    const name = user.displayName || '?';

    const live = id ? vrcFriendsData.find(f => f.id === id) : null;
    const image = live?.image || user.image || '';

    const letter = esc((name[0] || '?').toUpperCase());
    const avatar = image
        ? `<img class="vrcn-user-item-avatar" src="${esc(image)}" onerror="this.outerHTML='<div class=\\'vrcn-user-item-avatar vrcn-user-item-avatar-letter\\'>${letter}</div>'">`
        : `<div class="vrcn-user-item-avatar vrcn-user-item-avatar-letter">${letter}</div>`;

    const status = live?.status || user.status || '';
    const statusDesc = live?.statusDescription || user.statusDescription || '';
    const presence = live ? live.presence : (user.presence || '');
    const dotCls = presence === 'web' ? 'vrc-status-ring' : 'vrc-status-dot';
    const dot = `<span class="${dotCls} ${statusDotClass(status)} vrcn-user-item-dot"></span>`;

    const platform = live?.platform || user.platform || '';
    const platBadge = getPlatformBadgeHtml(platform);

    const statusText = statusDesc || (status ? statusLabel(status) : t('status.offline', 'Offline'));

    const location = live?.location || user.location || '';
    const parsed = (location && typeof parseFriendLocation === 'function') ? parseFriendLocation(location) : null;
    let worldInner = '';
    if (parsed && parsed.worldId && parsed.worldId.startsWith('wrld_')) {
        const wc = (typeof dashWorldCache !== 'undefined') ? dashWorldCache[parsed.worldId] : null;
        const wname = wc?.name || t('dashboard.friends.location_world', 'In World');
        worldInner = `<span class="msi">public</span><span class="vrcn-user-item-world-name">${esc(wname)}</span>`;
    }
    const worldLine = opts.noWorld ? '' : `<div class="vrcn-user-item-world">${worldInner}</div>`;

    const attrs = opts.attrs ? ' ' + opts.attrs : '';
    const cls = opts.cls ? ' ' + opts.cls : '';
    const trailing = opts.trailing || '';

    return `<div class="vrcn-user-item${cls}"${attrs} onclick="${onclick}">
        <div class="vrcn-user-item-avatar-wrap">${avatar}${dot}</div>
        <div class="vrcn-user-item-info">
            <div class="vrcn-user-item-name">${esc(name)}${platBadge ? `<span class="vrcn-user-item-plat">${platBadge}</span>` : ''}</div>
            <div class="vrcn-user-item-status">${esc(statusText)}</div>
            ${worldLine}
        </div>
        ${trailing}
    </div>`;
}

function renderProfileItem(user, onclick, opts) {
    return renderUserItem(user, onclick, opts);
}
