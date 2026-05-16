/* === Instance Modal === */
/* === Instance Info Modal === */

function openInstanceInfoModal() {
    const data = currentInstanceData;
    if (!data || data.empty || data.error || (!data.worldName && !data.worldId)) return;

    const m = document.getElementById('modalInstanceInfo');
    const c = document.getElementById('instanceInfoContent');
    if (!m || !c) return;

    const thumb = data.worldThumb || '';
    const name  = data.worldName || data.worldId || t('instance.unknown_world', 'Unknown World');
    const { cls: instCls, label: instLabel } = getInstanceBadge(data.instanceType);
    const instNum = (data.location || '').match(/:(\d+)/)?.[1] || '';

    const bannerHtml = thumb
        ? `<div class="fd-banner"><img src="${thumb}" onerror="this.parentElement.style.display='none'"><div class="fd-banner-fade"></div></div>`
        : '';

    // Build friend lookup maps
    const byId   = {};
    const byName = {};
    vrcFriendsData.forEach(f => {
        if (f.id)          byId[f.id] = f;
        if (f.displayName) byName[f.displayName.toLowerCase()] = f;
    });

    // User list — fall back to friends in same location
    let users = (data.users || []).slice();
    if (users.length === 0 && data.location) {
        const myLocBase = data.location.split('~')[0];
        users = vrcFriendsData.filter(f => {
            if (!f.location || f.location === 'private' || f.location === 'offline') return false;
            return f.location.split('~')[0] === myLocBase;
        });
    }

    // Enrich with live friend data
    const enriched = users.map(u => {
        const friend = (u.id && byId[u.id]) || (u.displayName && byName[(u.displayName || '').toLowerCase()]);
        return { ...u, _friend: friend || null };
    });

    // Sort oldest join first (longest at top)
    enriched.sort((a, b) => (a.joinedAt && b.joinedAt) ? a.joinedAt - b.joinedAt : 0);

    const now = Date.now();
    const hasTimers = enriched.some(u => u.joinedAt);
    const iStart = enriched.reduce((min, u) => (u.joinedAt && u.joinedAt < min) ? u.joinedAt : min, now);
    const iTotal = now - iStart;

    function fmtTimer(joinedAt) {
        return formatInstanceTimer(joinedAt, now);
    }

    const timerHead = hasTimers ? `<div class="iim-head-cell iim-cell-right">${t('instance.table.timer', 'Timer')}</div>` : '';
    const listHead = `<div class="iim-list-head">
        <div class="iim-head-cell">${t('instance.table.profile', 'Profile')}</div>
        ${timerHead}
        <div class="iim-head-cell iim-cell-right">${t('instance.table.joined', 'Joined')}</div>
        <div class="iim-head-cell">${t('instance.table.display_name', 'Display Name')}</div>
        <div class="iim-head-cell">${t('instance.table.rank', 'Rank')}</div>
        <div class="iim-head-cell">${t('instance.table.status', 'Status')}</div>
        <div class="iim-head-cell iim-cell-center">18+</div>
        <div class="iim-head-cell iim-cell-center">${t('instance.table.platform', 'Platform')}</div>
        <div class="iim-head-cell">${t('instance.table.language', 'Language')}</div>
    </div>`;

    const copyBadge = instNum
        ? `<span class="vrcn-id-clip" onclick="copyInstanceLink('${jsq(data.location || '')}')"><span class="msi" style="font-size:12px;">content_copy</span>#${esc(instNum)}</span>`
        : '';
    const wid = jsq(data.worldId || '');

    // Split enriched list into friends and non-friends
    const friendsEnriched = enriched.filter(u => !!u._friend);
    const othersEnriched  = enriched.filter(u => !u._friend);

    function makeRow(u) {
        const f           = u._friend;
        const isSelf      = currentVrcUser && u.id && u.id === currentVrcUser.id;
        const src         = isSelf ? currentVrcUser : f;
        const id          = u.id || '';
        const displayName = u.displayName || '?';
        const image       = src?.image           || u.image             || '';
        const status      = src?.status          || u.status            || '';
        const statusDesc  = src?.statusDescription ?? u.statusDescription ?? '';
        const tags        = (f?.tags?.length ? f.tags : null) || u.tags || [];
        const platform    = f?.platform          || u.platform          || '';
        const ageVerified = !!(f?.ageVerified || u.ageVerified);
        const avHtml = image
            ? `<div class="iim-av" style="background-image:url('${cssUrl(image)}')"></div>`
            : `<div class="iim-av iim-av-letter">${esc(displayName[0].toUpperCase())}</div>`;
        const timerCell = hasTimers
            ? `<div class="iim-cell iim-cell-right iim-muted-cell">${esc(fmtTimer(u.joinedAt))}</div>`
            : '';
        const trust = getTrustRank(tags);
        const rankCell = `<div class="iim-cell">${trust ? `<span class="vrcn-badge" style="color:${trust.color};border-color:${trust.color}20;background:${trust.color}18;font-size:10px;">${esc(trust.label)}</span>` : ''}</div>`;
        const dotCls = statusDotClass(status);
        const statusCell = `<div class="iim-cell"><div class="iim-status-cell">
            ${status ? `<span class="vrc-status-dot ${dotCls}" style="width:7px;height:7px;flex-shrink:0;"></span>` : ''}
            <span style="font-size:11px;">${esc(statusDesc || statusLabel(status))}</span>
        </div></div>`;
        let platIcon = '';
        if      (platform === 'standalonewindows') platIcon = `<span class="msi" title="${t('instance.platform.pc', 'PC')}" style="font-size:16px;color:var(--tx2);">computer</span>`;
        else if (platform === 'android')           platIcon = `<span class="msi" title="${t('instance.platform.quest', 'Quest')}" style="font-size:16px;color:var(--tx2);">view_in_ar</span>`;
        const platformCell = `<div class="iim-cell iim-cell-center">${platIcon}</div>`;
        const langTags  = tags.filter(t => t.startsWith('language_'));
        const langsHtml = langTags.map(t =>
            `<span class="vrcn-badge">${esc(LANG_MAP[t] || t.replace('language_', '').toUpperCase())}</span>`
        ).join('');
        const langCell  = `<div class="iim-cell"><div class="iim-lang-cell">${langsHtml}</div></div>`;
        const nameCell  = `<div class="iim-cell"><span class="iim-name">${esc(displayName)}</span></div>`;
        const ageCell   = `<div class="iim-cell iim-cell-center">${ageVerified ? `<span class="vrcn-badge" style="font-size:10px;color:#3ba55d;border-color:#3ba55d30;background:#3ba55d18;">18+</span>` : ''}</div>`;
        const fromCell  = `<div class="iim-cell iim-cell-right iim-muted-cell">${u.joinedAt ? esc(fmtTime(new Date(u.joinedAt))) : '&mdash;'}</div>`;
        let barHtml = '';
        if (iTotal > 0 && u.joinedAt) {
            const pStart   = u.joinedAt;
            const pEnd     = u.leftAt || now;
            const leftPct  = Math.max(0, Math.min(100, (pStart - iStart) / iTotal * 100));
            const widthPct = Math.max(0, Math.min(100 - leftPct, (pEnd - pStart) / iTotal * 100));
            const barCls   = (u._friend || (currentVrcUser && u.id === currentVrcUser.id)) ? ' friend' : '';
            barHtml = `<div class="iim-user-bar"><div class="tl-player-bar-wrap"><div class="tl-player-bar${barCls}" style="left:${leftPct.toFixed(1)}%;width:${widthPct.toFixed(1)}%"></div></div></div>`;
        }
        const itemClick = id ? ` onclick="openFriendDetail('${jsq(id)}')"` : '';
        const clickableCls = id ? ' clickable' : '';
        return `<div class="iim-user-item${clickableCls}"${itemClick}>
            <div class="iim-user-row">
                <div class="iim-cell iim-profile-cell">${avHtml}</div>
                ${timerCell}
                ${fromCell}
                ${nameCell}
                ${rankCell}
                ${statusCell}
                ${ageCell}
                ${platformCell}
                ${langCell}
            </div>
            ${barHtml}
        </div>`;
    }

    let bodyRows = '';
    if (friendsEnriched.length > 0)
        bodyRows += `<div class="iim-section-label"><div class="fd-group-rep-label" style="margin:0;">${tf('instance.sections.friends_in_instance', { count: friendsEnriched.length }, 'FRIENDS IN INSTANCE ({count})')}</div></div>` + friendsEnriched.map(makeRow).join('');
    if (othersEnriched.length > 0)
        bodyRows += `<div class="iim-section-label"><div class="fd-group-rep-label" style="margin:0;">${tf('instance.sections.players_in_instance', { count: othersEnriched.length }, 'PLAYERS IN INSTANCE ({count})')}</div></div>` + othersEnriched.map(makeRow).join('');

    const tableHtml = enriched.length > 0
        ? `<div class="iim-scroll"><div class="iim-list${hasTimers ? ' has-timers' : ''}">${listHead}<div class="iim-list-body">${bodyRows}</div></div></div>`
        : `<div style="padding:14px 0;color:var(--tx3);font-size:12px;">${t('instance.no_player_data_available', 'No player data available.')}</div>`;

    const prevIimScroller = c.querySelector('.iim-scroll');
    const prevIimScrollTop = prevIimScroller?.scrollTop || 0;
    const prevIimScrollLeft = prevIimScroller?.scrollLeft || 0;
    c.innerHTML = `${bannerHtml}
    <div class="fd-content${thumb ? ' fd-has-banner' : ''}" style="padding:16px;">
        <h2 style="margin:0 0 4px;color:var(--tx0);font-size:18px;">${esc(name)}</h2>
        <div class="fd-badges-row">
            <span class="vrcn-badge ${instCls}">${instLabel}</span>
            ${data.ageGate ? `<span class="vrcn-badge" style="background:rgba(255,75,85,.15);color:var(--err);">${esc(t('worlds.instances.age_gated', 'Age Gated'))}</span>` : ''}
            ${getOwnerBadgeHtml(data.ownerId || '', data.ownerName || '', data.ownerGroup || '', 'closeInstanceInfoModal()')}
            ${copyBadge}
            <span style="font-size:11px;color:var(--tx3);margin-left:4px;"><span class="msi" style="font-size:12px;vertical-align:-2px;">person</span> ${users.length || data.nUsers || 0}${data.capacity ? '/' + data.capacity : ''}</span>
        </div>
        ${tableHtml}
        <div class="fd-actions">
            <button class="vrcn-button-round" onclick="closeInstanceInfoModal();openInviteModal()"><span class="msi">person_add</span> ${t('instance.actions.invite', 'Invite')}</button>
            <button class="vrcn-button-round" onclick="closeInstanceInfoModal();openWorldSearchDetail('${wid}')">${t('dashboard.instances.open_world', 'Open World')}</button>
            <button class="vrcn-button-round" style="margin-left:auto;" onclick="closeInstanceInfoModal()">${t('common.close', 'Close')}</button>
        </div>
    </div>`;

    m.style.display = 'flex';
    if (prevIimScrollTop > 0 || prevIimScrollLeft > 0) {
        const newIimScroll = c.querySelector('.iim-scroll');
        if (newIimScroll) {
            newIimScroll.scrollTop = prevIimScrollTop;
            newIimScroll.scrollLeft = prevIimScrollLeft;
        }
    }
}

function closeInstanceInfoModal() {
    document.getElementById('modalInstanceInfo').style.display = 'none';
}

//Avatar Lookup avtrdb context logic
function handleInstanceAvatarFound(payload) {
    const { userId, avatarId } = payload;
    if (!userId) return;
    if (avatarId) openAvatarDetail(avatarId);
    else showToast(false, t('context_menu.avatar_not_found', 'No public avatar found'));
}

function ctxCheckAvatar(userId) {
    sendToCS({ action: 'vrcGetInstanceAvatars', userIds: [userId] });
}

let _instanceInfoTimer = null;
function requestInstanceInfo() {
    if (!currentVrcUser) return;
    clearTimeout(_instanceInfoTimer);
    _instanceInfoTimer = setTimeout(() => sendToCS({ action: 'vrcGetCurrentInstance' }), 500);
}
