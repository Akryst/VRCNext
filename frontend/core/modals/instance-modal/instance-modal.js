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

    function fmtTimer(joinedAt) {
        return formatInstanceTimer(joinedAt, now);
    }


    const timerTh = hasTimers ? `<th style="text-align:right;padding-right:10px;">${t('instance.table.timer', 'Timer')}</th>` : '';
    const thead = `<thead><tr>
        <th style="width:40px;">${t('instance.table.profile', 'Profile')}</th>
        ${timerTh}
        <th>${t('instance.table.display_name', 'Display Name')}</th>
        <th style="width:110px;">${t('instance.table.rank', 'Rank')}</th>
        <th>${t('instance.table.status', 'Status')}</th>
        <th style="width:46px;text-align:center;">18+</th>
        <th style="width:60px;text-align:center;">${t('instance.table.platform', 'Platform')}</th>
        <th style="min-width:70px;">${t('instance.table.language', 'Language')}</th>
    </tr></thead>`;

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
        const timerTd = hasTimers
            ? `<td style="text-align:right;font-size:11px;color:var(--tx3);padding-right:10px;">${esc(fmtTimer(u.joinedAt))}</td>`
            : '';
        const trust = getTrustRank(tags);
        const rankTd = `<td>${trust ? `<span class="vrcn-badge" style="color:${trust.color};border-color:${trust.color}20;background:${trust.color}18;font-size:10px;">${esc(trust.label)}</span>` : ''}</td>`;
        const dotCls = statusDotClass(status);
        const statusTd = `<td><div class="iim-status-cell">
            ${status ? `<span class="vrc-status-dot ${dotCls}" style="width:7px;height:7px;flex-shrink:0;"></span>` : ''}
            <span style="font-size:11px;">${esc(statusDesc || statusLabel(status))}</span>
        </div></td>`;
        let platIcon = '';
        if      (platform === 'standalonewindows') platIcon = `<span class="msi" title="${t('instance.platform.pc', 'PC')}" style="font-size:16px;color:var(--tx2);">computer</span>`;
        else if (platform === 'android')           platIcon = `<span class="msi" title="${t('instance.platform.quest', 'Quest')}" style="font-size:16px;color:var(--tx2);">view_in_ar</span>`;
        const platformTd = `<td style="text-align:center;">${platIcon}</td>`;
        const langTags  = tags.filter(t => t.startsWith('language_'));
        const langsHtml = langTags.map(t =>
            `<span class="vrcn-badge">${esc(LANG_MAP[t] || t.replace('language_', '').toUpperCase())}</span>`
        ).join('');
        const langTd  = `<td><div class="iim-lang-cell">${langsHtml}</div></td>`;
        const nameTd  = `<td><span class="iim-name">${esc(displayName)}</span></td>`;
        const ageTd   = `<td style="text-align:center;">${ageVerified ? `<span class="vrcn-badge" style="font-size:10px;color:#3ba55d;border-color:#3ba55d30;background:#3ba55d18;">18+</span>` : ''}</td>`;
        const rowClick = id ? ` style="cursor:pointer;" onclick="openFriendDetail('${jsq(id)}')"` : '';
        return `<tr class="iim-user-tr"${rowClick}><td style="width:40px;padding:5px 6px 5px 10px;">${avHtml}</td>${timerTd}${nameTd}${rankTd}${statusTd}${ageTd}${platformTd}${langTd}</tr>`;
    }

    const colSpan = hasTimers ? 8 : 7;
    let bodyRows = '';
    if (friendsEnriched.length > 0)
        bodyRows += `<tr><td colspan="${colSpan}" style="padding:10px 14px 4px;"><div class="fd-group-rep-label" style="margin:0;">${tf('instance.sections.friends_in_instance', { count: friendsEnriched.length }, 'FRIENDS IN INSTANCE ({count})')}</div></td></tr>` + friendsEnriched.map(makeRow).join('');
    if (othersEnriched.length > 0)
        bodyRows += `<tr><td colspan="${colSpan}" style="padding:10px 14px 4px;"><div class="fd-group-rep-label" style="margin:0;">${tf('instance.sections.players_in_instance', { count: othersEnriched.length }, 'PLAYERS IN INSTANCE ({count})')}</div></td></tr>` + othersEnriched.map(makeRow).join('');

    const tableHtml = enriched.length > 0
        ? `<div class="iim-scroll"><table class="iim-table">${thead}<tbody>${bodyRows}</tbody></table></div>`
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
