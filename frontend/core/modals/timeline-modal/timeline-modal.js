/* === Timeline Modal === */
function _instanceLinkBtn(location, closeJs) {
    if (!location || location.indexOf(':') <= 0 || !location.startsWith('wrld_')) return '';
    return `<button class="vrcn-button-round" onclick="${closeJs ? closeJs + ';' : ''}copyInstanceLink('${jsq(location)}')"><span class="msi" style="font-size:14px;">content_copy</span> ${esc(t('timeline.actions.copy_instance_link', 'Copy Instance Link'))}</button>`;
}

function openTlDetail(id) {
    const ev = timelineEvents.find(e => e.id === id)
             || _tlSearchEvents.find(e => e.id === id)
             || _fdTimelineEvents.find(e => e.id === id);
    if (!ev) return;
    const el = document.getElementById('detailModalContent');
    if (!el) return;

    switch (ev.type) {
        case 'instance_join': renderTlDetailJoin(ev, el);      break;
        case 'photo':         renderTlDetailPhoto(ev, el);     break;
        case 'first_meet':    renderTlDetailMeet(ev, el);      break;
        case 'meet_again':    renderTlDetailMeetAgain(ev, el); break;
        case 'notification':  renderTlDetailNotif(ev, el);     break;
        case 'avatar_switch': renderTlDetailAvatar(ev, el);    break;
        case 'video_url':     renderTlDetailUrl(ev, el);       break;
    }

    document.getElementById('modalDetail').style.display = 'flex';
}

// Navigate to a specific event in the Timeline tab
function navigateToTlEvent(id) {
    if (!id) return;
    // Set the scroll target BEFORE switching tabs. filterTimeline() will consume it
    // once the cards are actually in the DOM (after C# responds to getTimeline).
    _tlScrollTarget = id;
    // Reset filter button state silently (don't call filterTimeline() yet, that
    // would consume _tlScrollTarget before the tab has rendered its cards)
    tlFilter = 'all';
    tlMode = 'personal';
    document.querySelectorAll('#tlPersonalFilters .sub-tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tlModePersonal')?.classList.add('active');
    document.getElementById('tlModeFriends')?.classList.remove('active');
    const pf = document.getElementById('tlPersonalFilters');
    const ff = document.getElementById('tlFriendsFilters');
    if (pf) pf.style.display = '';
    if (ff) ff.style.display = 'none';
    const allBtn = document.getElementById(TL_FILTER_IDS['all']);
    if (allBtn) allBtn.classList.add('active');
    // Switch to Tab 12 -> refreshTimeline() -> C# sends timelineData -> renderTimeline()
    // -> filterTimeline() -> _tlScrollTarget consumed there
    showTab(12);
}

// Detail: instance join

function renderTlDetailJoin(ev, el) {
    const dateStr = tlFormatLongDate(ev.timestamp);
    const timeStr = tlFormatTime(ev.timestamp);
    const banner  = ev.worldThumb
        ? `<div class="fd-banner"><img src="${ev.worldThumb}" onerror="this.parentElement.style.display='none'"><div class="fd-banner-fade"></div></div>`
        : '';
    const players = ev.players || [];

    let playersHtml = '';
    if (players.length > 0) {
        playersHtml = `<div class="tl-detail-sect">${esc(tf('timeline.detail.players_in_instance', { count: players.length }, `Players in instance (${players.length})`))}</div><div class="photo-players-list">`;
        players.forEach(p => {
            const onclick = p.userId ? `document.getElementById('modalDetail').style.display='none';openFriendDetail('${jsq(p.userId)}')` : '';
            playersHtml += renderProfileItemSmall({ id: p.userId, displayName: p.displayName, image: p.image }, onclick);
        });
        playersHtml += '</div>';
    }

    const worldClick = ev.worldId
        ? ` style="cursor:pointer;" onclick="document.getElementById('modalDetail').style.display='none';openWorldSearchDetail('${esc(ev.worldId)}')"` : '';

    el.innerHTML = `${banner}<div class="fd-content${banner ? ' fd-has-banner' : ''}" style="padding:20px 0;">
        <h2 style="margin:0 0 12px;color:var(--tx0);font-size:16px;">${esc(ev.worldName || ev.worldId || t('timeline.unknown_world', 'Unknown World'))}</h2>
        <div class="fd-meta">
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.date', 'Date'))}</span><span>${esc(dateStr)}</span></div>
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.time', 'Time'))}</span><span>${esc(timeStr)}</span></div>
            ${ev.worldId ? `<div class="fd-meta-row"${worldClick}><span class="fd-meta-label">${esc(t('timeline.detail.world', 'World'))}</span><span style="color:var(--accent-lt);">${esc(ev.worldName || ev.worldId)}</span></div>` : ''}
        </div>
        ${playersHtml}
        <div style="margin-top:14px;display:flex;gap:8px;">
            <button class="vrcn-button-round vrcn-btn-join" onclick="document.getElementById('modalDetail').style.display='none';sendToCS({action:'vrcJoinFriend',location:'${jsq(ev.location)}'});">${esc(t('instance.actions.force_join', 'Force-Join'))}</button>
            ${_instanceLinkBtn(ev.location, '')}
            <button class="vrcn-button-round" style="margin-left:auto;" onclick="document.getElementById('modalDetail').style.display='none'">${esc(t('common.close', 'Close'))}</button>
        </div>
    </div>`;
}

// Detail: photo

function renderTlDetailPhoto(ev, el) {
    const dateStr = tlFormatLongDate(ev.timestamp);
    const timeStr = tlFormatTime(ev.timestamp);
    const photoJs = ev.photoUrl ? jsq(ev.photoUrl) : '';
    const banner  = ev.photoUrl
        ? `<div class="fd-banner" style="cursor:pointer;" onclick="openLightbox('${photoJs}','image')"><img src="${ev.photoUrl}" onerror="this.parentElement.style.display='none'"><div class="fd-banner-fade"></div></div>`
        : '';
    const fileName = ev.photoPath ? ev.photoPath.split(/[\\/]/).pop() : t('timeline.photo', 'Photo');
    const players  = ev.players || [];

    let playersHtml = '';
    if (players.length > 0) {
        playersHtml = `<div class="tl-detail-sect">${esc(tf('timeline.detail.players_in_instance', { count: players.length }, `Players in instance (${players.length})`))}</div><div class="photo-players-list">`;
        players.forEach(p => {
            const onclick = p.userId ? `document.getElementById('modalDetail').style.display='none';openFriendDetail('${jsq(p.userId)}')` : '';
            playersHtml += renderProfileItemSmall({ id: p.userId, displayName: p.displayName, image: p.image }, onclick);
        });
        playersHtml += '</div>';
    }

    const worldClick = ev.worldId
        ? ` style="cursor:pointer;" onclick="document.getElementById('modalDetail').style.display='none';openWorldSearchDetail('${esc(ev.worldId)}')"` : '';

    el.innerHTML = `${banner}<div class="fd-content${banner ? ' fd-has-banner' : ''}" style="padding:20px 0;">
        <h2 style="margin:0 0 12px;color:var(--tx0);font-size:16px;">${esc(fileName)}</h2>
        <div class="fd-meta">
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.date', 'Date'))}</span><span>${esc(dateStr)}</span></div>
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.time', 'Time'))}</span><span>${esc(timeStr)}</span></div>
            ${ev.worldId ? `<div class="fd-meta-row"${worldClick}><span class="fd-meta-label">${esc(t('timeline.detail.world', 'World'))}</span><span style="color:var(--accent-lt);">${esc(ev.worldName || ev.worldId)}</span></div>` : ''}
        </div>
        ${playersHtml}
        <div style="margin-top:14px;display:flex;gap:8px;">
            ${ev.photoUrl ? `<button class="vrcn-button-round vrcn-btn-join" onclick="openLightbox('${photoJs}','image')"><span class="msi" style="font-size:14px;">open_in_full</span> ${esc(t('timeline.actions.full_size', 'Full Size'))}</button>` : ''}
            <button class="vrcn-button-round" style="margin-left:auto;" onclick="document.getElementById('modalDetail').style.display='none'">${esc(t('common.close', 'Close'))}</button>
        </div>
    </div>`;
}

// Detail: first meet

function renderTlDetailMeet(ev, el) {
    const dateStr = tlFormatLongDate(ev.timestamp);
    const timeStr = tlFormatTime(ev.timestamp);
    const av      = ev.userImage
        ? `<div class="tl-detail-av" style="background-image:url('${cssUrl(ev.userImage)}')"></div>`
        : `<div class="tl-detail-av tl-detail-av-letter">${esc((ev.userName || '?')[0].toUpperCase())}</div>`;

    const worldClickMeet = ev.worldId ? ` style="cursor:pointer;" onclick="document.getElementById('modalDetail').style.display='none';openWorldSearchDetail('${esc(ev.worldId)}')"` : '';
    el.innerHTML = `<div class="fd-content" style="padding:20px 0;">
        <div style="display:flex;gap:16px;align-items:center;margin-bottom:20px;">
            ${av}
            <div>
                <h2 style="margin:0 0 4px;color:var(--tx0);font-size:18px;">${esc(ev.userName || t('timeline.unknown', 'Unknown'))}</h2>
                <div style="font-size:11px;color:var(--cyan);font-weight:700;letter-spacing:.05em;">${esc(t('timeline.detail.first_meet', 'FIRST MEET'))}</div>
            </div>
        </div>
        <div class="fd-meta">
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.date', 'Date'))}</span><span>${esc(dateStr)}</span></div>
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.time', 'Time'))}</span><span>${esc(timeStr)}</span></div>
            ${ev.worldId ? `<div class="fd-meta-row"${worldClickMeet}><span class="fd-meta-label">${esc(t('timeline.detail.world', 'World'))}</span><span style="color:var(--accent-lt);">${esc(ev.worldName || ev.worldId)}</span></div>` : ''}
        </div>
        <div style="margin-top:14px;display:flex;gap:8px;">
            ${ev.userId ? `<button class="vrcn-button-round vrcn-btn-join" onclick="document.getElementById('modalDetail').style.display='none';openFriendDetail('${esc(ev.userId)}')">${esc(t('timeline.actions.view_profile', 'View Profile'))}</button>` : ''}
            <button class="vrcn-button-round" style="margin-left:auto;" onclick="document.getElementById('modalDetail').style.display='none'">${esc(t('common.close', 'Close'))}</button>
        </div>
    </div>`;
}

// Detail: meet again

function renderTlDetailMeetAgain(ev, el) {
    const dateStr = tlFormatLongDate(ev.timestamp);
    const timeStr = tlFormatTime(ev.timestamp);
    const av      = ev.userImage
        ? `<div class="tl-detail-av" style="background-image:url('${cssUrl(ev.userImage)}')"></div>`
        : `<div class="tl-detail-av tl-detail-av-letter">${esc((ev.userName || '?')[0].toUpperCase())}</div>`;

    const worldClickAgain = ev.worldId ? ` style="cursor:pointer;" onclick="document.getElementById('modalDetail').style.display='none';openWorldSearchDetail('${esc(ev.worldId)}')"` : '';
    el.innerHTML = `<div class="fd-content" style="padding:20px 0;">
        <div style="display:flex;gap:16px;align-items:center;margin-bottom:20px;">
            ${av}
            <div>
                <h2 style="margin:0 0 4px;color:var(--tx0);font-size:18px;">${esc(ev.userName || t('timeline.unknown', 'Unknown'))}</h2>
                <div style="font-size:11px;color:#AB47BC;font-weight:700;letter-spacing:.05em;">${esc(t('timeline.detail.met_again', 'MET AGAIN'))}</div>
            </div>
        </div>
        <div class="fd-meta">
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.date', 'Date'))}</span><span>${esc(dateStr)}</span></div>
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.time', 'Time'))}</span><span>${esc(timeStr)}</span></div>
            ${ev.worldId ? `<div class="fd-meta-row"${worldClickAgain}><span class="fd-meta-label">${esc(t('timeline.detail.world', 'World'))}</span><span style="color:var(--accent-lt);">${esc(ev.worldName || ev.worldId)}</span></div>` : ''}
        </div>
        <div style="margin-top:14px;display:flex;gap:8px;">
            ${ev.userId ? `<button class="vrcn-button-round vrcn-btn-join" onclick="document.getElementById('modalDetail').style.display='none';openFriendDetail('${esc(ev.userId)}')">${esc(t('timeline.actions.view_profile', 'View Profile'))}</button>` : ''}
            <button class="vrcn-button-round" style="margin-left:auto;" onclick="document.getElementById('modalDetail').style.display='none'">${esc(t('common.close', 'Close'))}</button>
        </div>
    </div>`;
}

// Detail: notification

function renderTlDetailNotif(ev, el) {
    const dateStr   = tlFormatLongDate(ev.timestamp);
    const timeStr   = tlFormatTime(ev.timestamp);
    const typeLabel = tlNotifTypeLabel(ev.notifType);
    const av        = ev.senderImage
        ? `<div class="tl-detail-av" style="background-image:url('${cssUrl(ev.senderImage)}')"></div>`
        : `<div class="tl-detail-av tl-detail-av-letter">${esc((ev.senderName || '?')[0].toUpperCase())}</div>`;

    el.innerHTML = `<div class="fd-content" style="padding:20px 0;">
        <div style="display:flex;gap:16px;align-items:center;margin-bottom:20px;">
            ${av}
            <div>
                <h2 style="margin:0 0 4px;color:var(--tx0);font-size:18px;">${esc(ev.senderName || typeLabel)}</h2>
                <div style="font-size:11px;color:var(--warn);font-weight:700;letter-spacing:.05em;">${esc(typeLabel.toUpperCase())}</div>
            </div>
        </div>
        <div class="fd-meta">
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.date', 'Date'))}</span><span>${esc(dateStr)}</span></div>
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.time', 'Time'))}</span><span>${esc(timeStr)}</span></div>
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.type', 'Type'))}</span><span>${esc(typeLabel)}</span></div>
            ${ev.notifTitle ? `<div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.context', 'Context'))}</span><span>${esc(ev.notifTitle)}</span></div>` : ''}
            ${ev.message ? `<div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.message', 'Message'))}</span><span>${esc(ev.message)}</span></div>` : ''}
        </div>
        <div style="margin-top:14px;display:flex;gap:8px;">
            ${ev.senderId ? `<button class="vrcn-button-round vrcn-btn-join" onclick="document.getElementById('modalDetail').style.display='none';openFriendDetail('${esc(ev.senderId)}')">${esc(t('timeline.actions.view_profile', 'View Profile'))}</button>` : ''}
            <button class="vrcn-button-round" style="margin-left:auto;" onclick="document.getElementById('modalDetail').style.display='none'">${esc(t('common.close', 'Close'))}</button>
        </div>
    </div>`;
}

// Detail: avatar switch

function renderTlDetailAvatar(ev, el) {
    const dateStr = tlFormatLongDate(ev.timestamp);
    const timeStr = tlFormatTime(ev.timestamp);
    const banner  = ev.userImage
        ? `<div class="fd-banner"><img src="${ev.userImage}" onerror="this.parentElement.style.display='none'"><div class="fd-banner-fade"></div></div>`
        : '';
    const openBtn = ev.userId
        ? `<button class="vrcn-button-round vrcn-btn-join" onclick="document.getElementById('modalDetail').style.display='none';openAvatarDetail('${jsq(ev.userId)}')">${esc(t('timeline.actions.view_avatar', 'View Avatar'))}</button>`
        : '';
    el.innerHTML = `${banner}<div class="fd-content${banner ? ' fd-has-banner' : ''}" style="padding:20px 0;">
        <h2 style="margin:0 0 12px;color:var(--tx0);font-size:16px;">${esc(ev.userName || t('timeline.unknown_avatar', 'Unknown Avatar'))}</h2>
        <div class="fd-meta">
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.avatar', 'Avatar'))}</span><span>${esc(ev.userName || t('timeline.unknown', 'Unknown'))}</span></div>
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.date', 'Date'))}</span><span>${esc(dateStr)}</span></div>
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.time', 'Time'))}</span><span>${esc(timeStr)}</span></div>
            ${ev.userId ? `<div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.avatar_id', 'Avatar ID'))}</span><span style="font-size:11px;color:var(--tx3);">${esc(ev.userId)}</span></div>` : ''}
        </div>
        <div style="margin-top:14px;display:flex;gap:8px;">
            ${openBtn}
            <button class="vrcn-button-round" style="margin-left:auto;" onclick="document.getElementById('modalDetail').style.display='none'">${esc(t('common.close', 'Close'))}</button>
        </div>
    </div>`;
}

// Detail: video URL

function renderTlDetailUrl(ev, el) {
    const dateStr = tlFormatLongDate(ev.timestamp);
    const timeStr = tlFormatTime(ev.timestamp);
    const url     = ev.message || '';
    const plat    = _urlPlatform(url);
    const favicon = `<div style="display:flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:12px;background:var(--bg2);">${_urlFaviconHtml(plat)}</div>`;
    const worldClick = ev.worldId
        ? ` style="cursor:pointer;" onclick="document.getElementById('modalDetail').style.display='none';openWorldSearchDetail('${esc(ev.worldId)}')"` : '';

    el.innerHTML = `<div class="fd-content" style="padding:20px 0;">
        <div style="display:flex;gap:16px;align-items:center;margin-bottom:20px;">
            ${favicon}
            <div>
                <h2 style="margin:0 0 4px;color:var(--tx0);font-size:18px;">${esc(plat.name)}</h2>
                <div style="font-size:11px;color:${plat.color};font-weight:700;letter-spacing:.05em;">${esc(t('timeline.detail.video_url', 'VIDEO URL'))}</div>
            </div>
        </div>
        <div class="fd-meta">
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.date', 'Date'))}</span><span>${esc(dateStr)}</span></div>
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.time', 'Time'))}</span><span>${esc(timeStr)}</span></div>
            ${ev.worldName ? `<div class="fd-meta-row"${worldClick}><span class="fd-meta-label">${esc(t('timeline.detail.world', 'World'))}</span><span style="color:var(--accent-lt);">${esc(ev.worldName)}</span></div>` : ''}
            <div class="fd-meta-row" style="align-items:flex-start;"><span class="fd-meta-label">${esc(t('timeline.detail.url', 'URL'))}</span><span style="word-break:break-all;font-size:11px;color:var(--tx2);">${esc(url)}</span></div>
        </div>
        <div style="margin-top:14px;display:flex;gap:8px;">
            <button class="vrcn-button-round vrcn-btn-join" onclick="sendToCS({action:'openUrl',url:'${jsq(url)}'})">${esc(t('timeline.actions.open_url', 'Open URL'))}</button>
            <button class="vrcn-button-round" onclick="navigator.clipboard.writeText('${jsq(url)}').then(()=>showToast(true,t('timeline.toast.copied','Copied!')))">${esc(t('timeline.actions.copy', 'Copy'))}</button>
            <button class="vrcn-button-round" style="margin-left:auto;" onclick="document.getElementById('modalDetail').style.display='none'">${esc(t('common.close', 'Close'))}</button>
        </div>
    </div>`;
}


/* === Friend GPS Instance Log Modal === */
function openFtGpsDetail(evId) {
    const ev = friendTimelineEvents.find(e => e.id === evId)
             || _ftlSearchEvents.find(e => e.id === evId);
    if (!ev) return;
    renderFtGpsDetailModal(ev);
    document.getElementById('modalFtGpsDetail').style.display = 'flex';
}

function closeFtGpsDetail() {
    document.getElementById('modalFtGpsDetail').style.display = 'none';
}

function switchFtGpsTab(tab) {
    document.getElementById('ftGpsTabInfo').style.display = tab === 'info' ? '' : 'none';
    document.getElementById('ftGpsTabAlso').style.display = tab === 'also' ? '' : 'none';
    document.querySelectorAll('#ftGpsDetailContent .ftgps-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
}

function renderFtGpsDetailModal(ev) {
    const loc = ev.location || '';
    const { instanceType } = parseFriendLocation(loc);
    const { cls: instCls, label: instLabel } = getInstanceBadge(instanceType);

    const instIdMatch = loc.match(/:(\d+)/);
    const instanceId = instIdMatch ? instIdMatch[1] : '';

    const { dateStr, timeStr } = ftDetailDatetime(ev);

    const banner = ev.worldThumb
        ? `<div class="fd-banner"><img src="${ev.worldThumb}" onerror="this.parentElement.style.display='none'"><div class="fd-banner-fade"></div></div>`
        : '';
    const worldName = ev.worldName || ev.worldId || t('timeline.unknown_world', 'Unknown World');

    // Was Also Here: populated async from server (covers all pages, not just loaded memory)
    const alsoList = [];

    const infoHtml = `<div class="fd-meta">
        <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.date', 'Date'))}</span><span>${esc(dateStr)}</span></div>
        <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.time', 'Time'))}</span><span>${esc(timeStr)}</span></div>
        <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.instance_type', 'Instance Type'))}</span><span class="vrcn-badge ${instCls}">${instLabel}</span></div>
        ${instanceId ? `<div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.instance_id', 'Instance ID'))}</span><span style="font-family:monospace;font-size:12px;color:var(--tx2);">#${esc(instanceId)}</span></div>` : ''}
        <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.event', 'Event'))}</span><span style="color:var(--tx2);">${esc(tf('timeline.detail.friend_joined_world', { name: ev.friendName || t('timeline.unknown', 'Unknown') }, `${ev.friendName || 'Unknown'} joined this world`))}</span></div>
    </div>`;

    const el = document.getElementById('ftGpsDetailContent');
    el.innerHTML = `${banner}<div class="fd-content${banner ? ' fd-has-banner' : ''}" style="padding:16px 0;">
        <h2 style="margin:0 0 4px;color:var(--tx0);font-size:18px;">${esc(worldName)}</h2>
        <div style="margin-bottom:12px;">${idBadge(ev.worldId || '')}</div>
        <div class="fd-tabs" style="margin-bottom:14px;">
            <button class="fd-tab active ftgps-tab-btn" data-tab="info" onclick="switchFtGpsTab('info')">${esc(t('timeline.detail.info', 'Info'))}</button>
            <button class="fd-tab ftgps-tab-btn" data-tab="also" id="ftGpsAlsoTab" onclick="switchFtGpsTab('also')">${esc(t('timeline.detail.was_also_here', 'Was also here'))}</button>
        </div>
        <div id="ftGpsTabInfo">${infoHtml}</div>
        <div id="ftGpsTabAlso" style="display:none;"><div style="font-size:12px;color:var(--tx3);padding:12px 0;">${esc(t('common.loading', 'Loading...'))}</div></div>
        <div style="margin-top:14px;display:flex;gap:8px;">
            ${loc ? `<button class="vrcn-button-round vrcn-btn-join" onclick="closeFtGpsDetail();sendToCS({action:'vrcJoinFriend',location:'${jsq(loc)}'});">${esc(t('instance.actions.force_join', 'Force-Join'))}</button>` : ''}
            ${_instanceLinkBtn(loc, '')}
            <span style="flex:1;"></span>
            ${ev.worldId ? `<button class="vrcn-button-round" onclick="closeFtGpsDetail();openWorldSearchDetail('${esc(ev.worldId)}')"><span class="msi" style="font-size:14px;">travel_explore</span> ${esc(t('timeline.actions.open_world', 'Open World'))}</button>` : ''}
            <button class="vrcn-button-round" onclick="closeFtGpsDetail()">${esc(t('common.close', 'Close'))}</button>
        </div>
    </div>`;

    // Async: ask server for all friends at this location (searches full DB, not just loaded page)
    sendToCS({ action: 'getFtAlsoWasHere', location: loc, excludeId: ev.id });
}

function renderFtAlsoWasHereResult(payload) {
    const tab = document.getElementById('ftGpsTabAlso');
    const tabBtn = document.getElementById('ftGpsAlsoTab');
    if (!tab) return;
    const friends = payload?.friends ?? [];
    if (friends.length === 0) {
        tab.innerHTML = `<div style="font-size:12px;color:var(--tx3);padding:12px 0;">${esc(t('timeline.detail.no_other_friends', 'No other friends tracked in this instance.'))}</div>`;
    } else {
        tab.innerHTML = friends.map(f =>
            renderProfileItemSmall(
                { id: f.friendId, displayName: f.friendName || t('timeline.unknown', 'Unknown'), image: f.friendImage },
                `closeFtGpsDetail();openFriendDetail('${jsq(f.friendId)}')`
            )
        ).join('');
    }
    if (tabBtn && friends.length > 0) tabBtn.textContent = tf('timeline.detail.was_also_here_count', { count: friends.length }, `Was also here (${friends.length})`);
}

function openFtDetail(id) {
    const ev = friendTimelineEvents.find(e => e.id === id)
             || _ftlSearchEvents.find(e => e.id === id);
    if (!ev) return;
    const el = document.getElementById('detailModalContent');
    if (!el) return;

    switch (ev.type) {
        case 'friend_gps':        renderFtDetailGps(ev, el);        break;
        case 'friend_status':     renderFtDetailStatus(ev, el);     break;
        case 'friend_statusdesc': renderFtDetailStatusDesc(ev, el); break;
        case 'friend_online':      renderFtDetailOnline(ev, el);     break;
        case 'friend_offline':     renderFtDetailOffline(ev, el);    break;
        case 'friend_bio':        renderFtDetailBio(ev, el);        break;
        case 'friend_added':      renderFtDetailAdded(ev, el);      break;
        case 'friend_removed':    renderFtDetailRemoved(ev, el);    break;
        case 'friend_avatar':     renderFtDetailFriendAvatar(ev, el); break;
    }

    document.getElementById('modalDetail').style.display = 'flex';
}

function openFdActivityDetail(id) {
    const ev = _fdUserActivityEvents.find(e => e.id === id);
    if (!ev) return;
    const el = document.getElementById('detailModalContent');
    if (!el) return;
    switch (ev.type) {
        case 'friend_gps':        renderFtDetailGps(ev, el);        break;
        case 'friend_status':     renderFtDetailStatus(ev, el);     break;
        case 'friend_statusdesc': renderFtDetailStatusDesc(ev, el); break;
        case 'friend_online':      renderFtDetailOnline(ev, el);     break;
        case 'friend_offline':     renderFtDetailOffline(ev, el);    break;
        case 'friend_bio':        renderFtDetailBio(ev, el);        break;
        case 'friend_added':      renderFtDetailAdded(ev, el);      break;
        case 'friend_removed':    renderFtDetailRemoved(ev, el);    break;
    }
    document.getElementById('modalDetail').style.display = 'flex';
}

function ftDetailDatetime(ev) {
    return {
        dateStr: tlFormatLongDate(ev.timestamp),
        timeStr: tlFormatTime(ev.timestamp),
    };
}

function ftDetailAvRow(ev) {
    const av = ev.friendImage
        ? `<div class="tl-detail-av" style="background-image:url('${cssUrl(ev.friendImage)}')"></div>`
        : `<div class="tl-detail-av tl-detail-av-letter">${esc((ev.friendName || '?')[0].toUpperCase())}</div>`;
    return `<div style="display:flex;gap:16px;align-items:center;margin-bottom:20px;">${av}
        <div><h2 style="margin:0 0 4px;color:var(--tx0);font-size:18px;">${esc(ev.friendName || t('timeline.unknown', 'Unknown'))}</h2>
        ${ev.friendId ? `<div style="font-size:10px;color:var(--tx3);">${esc(ev.friendId)}</div>` : ''}
        </div></div>`;
}

function ftDetailClose() {
    return `<button class="vrcn-button-round" style="margin-left:auto;" onclick="document.getElementById('modalDetail').style.display='none'">${esc(t('common.close', 'Close'))}</button>`;
}

function ftDetailViewProfile(ev) {
    return ev.friendId
        ? `<button class="vrcn-button-round vrcn-btn-join" onclick="document.getElementById('modalDetail').style.display='none';openFriendDetail('${esc(ev.friendId)}')">${esc(t('timeline.actions.view_profile', 'View Profile'))}</button>`
        : '';
}

function renderFtDetailGps(ev, el) {
    const { dateStr, timeStr } = ftDetailDatetime(ev);
    const banner = ev.worldThumb
        ? `<div class="fd-banner"><img src="${ev.worldThumb}" onerror="this.parentElement.style.display='none'"><div class="fd-banner-fade"></div></div>`
        : '';
    const wname = ev.worldName || ev.worldId || t('timeline.unknown_world', 'Unknown World');
    const worldClick = ev.worldId
        ? ` style="cursor:pointer;" onclick="document.getElementById('modalDetail').style.display='none';openWorldDetail('${esc(ev.worldId)}')"` : '';

    el.innerHTML = `${banner}<div class="fd-content${banner ? ' fd-has-banner' : ''}" style="padding:20px 0;">
        ${ftDetailAvRow(ev)}
        <div class="fd-meta">
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.date', 'Date'))}</span><span>${esc(dateStr)}</span></div>
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.time', 'Time'))}</span><span>${esc(timeStr)}</span></div>
            <div class="fd-meta-row"${worldClick}><span class="fd-meta-label">${esc(t('timeline.detail.world', 'World'))}</span><span style="color:var(--accent-lt);">${esc(wname)}</span></div>
        </div>
        <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end;">
            ${ev.worldId ? `<button class="vrcn-button-round vrcn-btn-join" onclick="document.getElementById('modalDetail').style.display='none';openWorldDetail('${esc(ev.worldId)}')"><span class="msi" style="font-size:14px;">travel_explore</span> ${esc(t('timeline.actions.open_world', 'Open World'))}</button>` : ''}
            ${ftDetailViewProfile(ev)}
            ${ftDetailClose()}
        </div>
    </div>`;
}

function renderFtDetailStatus(ev, el) {
    const { dateStr, timeStr } = ftDetailDatetime(ev);
    const oldCls = statusCssClass(ev.oldValue);
    const newCls = statusCssClass(ev.newValue);

    el.innerHTML = `<div class="fd-content" style="padding:20px 0;">
        ${ftDetailAvRow(ev)}
        <div class="fd-meta">
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.date', 'Date'))}</span><span>${esc(dateStr)}</span></div>
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.time', 'Time'))}</span><span>${esc(timeStr)}</span></div>
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.change', 'Change'))}</span>
                <span style="display:flex;align-items:center;gap:6px;">
                    <span class="ft-status-chip ${oldCls}">${esc(statusLabel(ev.oldValue) || '?')}</span>
                    <span class="msi" style="font-size:12px;color:var(--tx3);">arrow_forward</span>
                    <span class="ft-status-chip ${newCls}">${esc(statusLabel(ev.newValue) || '?')}</span>
                </span>
            </div>
        </div>
        <div style="margin-top:14px;display:flex;gap:8px;">
            ${ftDetailViewProfile(ev)}${ftDetailClose()}
        </div>
    </div>`;
}

function renderFtDetailOnline(ev, el) {
    const { dateStr, timeStr } = ftDetailDatetime(ev);
    el.innerHTML = `<div class="fd-content" style="padding:20px 0;">
        ${ftDetailAvRow(ev)}
        <div class="fd-meta">
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.date', 'Date'))}</span><span>${esc(dateStr)}</span></div>
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.time', 'Time'))}</span><span>${esc(timeStr)}</span></div>
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.event', 'Event'))}</span><span style="color:var(--ok);">${esc(t('timeline.friend.online_game', 'Online (Game)'))}</span></div>
        </div>
        <div style="margin-top:14px;display:flex;gap:8px;">
            ${ftDetailViewProfile(ev)}${ftDetailClose()}
        </div>
    </div>`;
}

function renderFtDetailOffline(ev, el) {
    const { dateStr, timeStr } = ftDetailDatetime(ev);
    el.innerHTML = `<div class="fd-content" style="padding:20px 0;">
        ${ftDetailAvRow(ev)}
        <div class="fd-meta">
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.date', 'Date'))}</span><span>${esc(dateStr)}</span></div>
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.time', 'Time'))}</span><span>${esc(timeStr)}</span></div>
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.event', 'Event'))}</span><span style="color:var(--tx3);">${esc(t('timeline.friend.went_offline', 'Went Offline'))}</span></div>
        </div>
        <div style="margin-top:14px;display:flex;gap:8px;">
            ${ftDetailViewProfile(ev)}${ftDetailClose()}
        </div>
    </div>`;
}

function renderFtDetailAdded(ev, el) {
    const { dateStr, timeStr } = ftDetailDatetime(ev);
    el.innerHTML = `<div class="fd-content" style="padding:20px 0;">
        ${ftDetailAvRow(ev)}
        <div class="fd-meta">
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.date', 'Date'))}</span><span>${esc(dateStr)}</span></div>
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.time', 'Time'))}</span><span>${esc(timeStr)}</span></div>
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.event', 'Event'))}</span><span style="color:var(--ok);">${esc(t('timeline.friend.added_full', 'Friend Added'))}</span></div>
        </div>
        <div style="margin-top:14px;display:flex;gap:8px;">
            ${ftDetailViewProfile(ev)}${ftDetailClose()}
        </div>
    </div>`;
}

function renderFtDetailRemoved(ev, el) {
    const { dateStr, timeStr } = ftDetailDatetime(ev);
    el.innerHTML = `<div class="fd-content" style="padding:20px 0;">
        ${ftDetailAvRow(ev)}
        <div class="fd-meta">
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.date', 'Date'))}</span><span>${esc(dateStr)}</span></div>
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.time', 'Time'))}</span><span>${esc(timeStr)}</span></div>
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.event', 'Event'))}</span><span style="color:var(--err);">${esc(t('timeline.friend.unfriended', 'Unfriended'))}</span></div>
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.user_id', 'User ID'))}</span><span style="font-size:11px;opacity:.7;">${esc(ev.friendId || '')}</span></div>
        </div>
        <div style="margin-top:14px;display:flex;gap:8px;">
            ${ftDetailViewProfile(ev)}
            ${ftDetailClose()}
        </div>
    </div>`;
}

function renderFtDetailStatusDesc(ev, el) {
    const { dateStr, timeStr } = ftDetailDatetime(ev);
    el.innerHTML = `<div class="fd-content" style="padding:20px 0;">
        ${ftDetailAvRow(ev)}
        <div class="fd-meta">
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.date', 'Date'))}</span><span>${esc(dateStr)}</span></div>
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.time', 'Time'))}</span><span>${esc(timeStr)}</span></div>
        </div>
        ${ev.oldValue ? `<div style="margin-top:12px;"><div style="font-size:10px;color:var(--tx3);margin-bottom:4px;">${esc(t('timeline.detail.previous_status_text', 'PREVIOUS STATUS TEXT'))}</div>
            <div style="font-size:12px;color:var(--tx2);background:var(--bg2);padding:8px 10px;border-radius:6px;">${esc(ev.oldValue)}</div></div>` : ''}
        ${ev.newValue !== undefined ? `<div style="margin-top:10px;"><div style="font-size:10px;color:var(--tx3);margin-bottom:4px;">${esc(t('timeline.detail.new_status_text', 'NEW STATUS TEXT'))}</div>
            <div style="font-size:12px;color:var(--tx1);background:var(--bg2);padding:8px 10px;border-radius:6px;">${ev.newValue ? esc(ev.newValue) : tlDetailClearedHtml()}</div></div>` : ''}
        <div style="margin-top:14px;display:flex;gap:8px;">
            ${ftDetailViewProfile(ev)}${ftDetailClose()}
        </div>
    </div>`;
}

function renderFtDetailBio(ev, el) {
    const { dateStr, timeStr } = ftDetailDatetime(ev);
    el.innerHTML = `<div class="fd-content" style="padding:20px 0;">
        ${ftDetailAvRow(ev)}
        <div class="fd-meta">
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.date', 'Date'))}</span><span>${esc(dateStr)}</span></div>
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.time', 'Time'))}</span><span>${esc(timeStr)}</span></div>
        </div>
        ${ev.oldValue ? `<div style="margin-top:12px;"><div style="font-size:10px;color:var(--tx3);margin-bottom:4px;">${esc(t('timeline.detail.previous_bio', 'PREVIOUS BIO'))}</div>
            <div style="font-size:12px;color:var(--tx2);background:var(--bg2);padding:8px 10px;border-radius:6px;white-space:pre-wrap;">${esc(ev.oldValue)}</div></div>` : ''}
        ${ev.newValue ? `<div style="margin-top:10px;"><div style="font-size:10px;color:var(--tx3);margin-bottom:4px;">${esc(t('timeline.detail.new_bio', 'NEW BIO'))}</div>
            <div style="font-size:12px;color:var(--tx1);background:var(--bg2);padding:8px 10px;border-radius:6px;white-space:pre-wrap;">${esc(ev.newValue)}</div></div>` : ''}
        <div style="margin-top:14px;display:flex;gap:8px;">
            ${ftDetailViewProfile(ev)}${ftDetailClose()}
        </div>
    </div>`;
}

function renderFtDetailFriendAvatar(ev, el) {
    const { dateStr, timeStr } = ftDetailDatetime(ev);
    const banner = ev.worldThumb
        ? `<div class="fd-banner"><img src="${ev.worldThumb}" onerror="this.parentElement.style.display='none'"><div class="fd-banner-fade"></div></div>`
        : '';
    el.innerHTML = `${banner}<div class="fd-content${banner ? ' fd-has-banner' : ''}" style="padding:20px 0;">
        ${ftDetailAvRow(ev)}
        <div class="fd-meta">
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.date', 'Date'))}</span><span>${esc(dateStr)}</span></div>
            <div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.time', 'Time'))}</span><span>${esc(timeStr)}</span></div>
            ${ev.worldName ? `<div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.avatar', 'Avatar'))}</span><span style="color:var(--accent-lt);">${esc(ev.worldName)}</span></div>` : ''}
            ${ev.worldId ? `<div class="fd-meta-row"><span class="fd-meta-label">${esc(t('timeline.detail.avatar_id', 'Avatar ID'))}</span><span style="font-size:11px;color:var(--tx3);">${esc(ev.worldId)}</span></div>` : ''}
        </div>
        <div style="margin-top:14px;display:flex;gap:8px;">
            ${ev.worldId ? `<button class="vrcn-button-round vrcn-btn-join" onclick="document.getElementById('modalDetail').style.display='none';openAvatarDetail('${jsq(ev.worldId)}')">${esc(t('timeline.actions.view_avatar', 'View Avatar'))}</button>` : ''}
            ${ftDetailViewProfile(ev)}
            ${ftDetailClose()}
        </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════
// List View — Personal Timeline
// ═══════════════════════════════════════════════════════════════════

function _tlListProfHtml(img, name) {
    if (img) return `<div class="tl-av" style="width:26px;height:26px;background-image:url('${cssUrl(img)}')"></div>`;
    if (name) return `<div class="tl-av tl-av-letter" style="width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:10px;">${esc(name[0].toUpperCase())}</div>`;
    return '';
}

function _tlPersonalProfHtml(ev) {
    if (ev.type === 'notification') return _tlListProfHtml(ev.senderImage, ev.senderName);
    return _tlListProfHtml(ev.userImage, ev.userName);
}

function buildPersonalListHtml(events) {
    if (!events.length) {
        return `<div class="empty-msg">${esc(t('timeline.list.empty.personal', 'No timeline events match your filter.'))}</div>`;
    }

    let rows = '';
    events.forEach(ev => {
        const meta  = tlTypeMeta(ev.type);
        const color = TL_TYPE_COLOR[ev.type] ?? 'var(--tx3)';
        const ei    = jsq(ev.id);
        const { userHtml, detail } = _tlListData(ev);
        const listMeetCount = ev.type === 'meet_again' ? (ev.meetCount || 0) : 0;
        const listTypeLabel = listMeetCount > 0 ? `${meta.label} (${listMeetCount})` : meta.label;

        rows += `<tr class="tl-list-row" onclick="openTlDetail('${ei}')">
            <td class="tl-list-dt">${esc(`${tlFormatShortDate(ev.timestamp)} | ${tlFormatTime(ev.timestamp)}`)}</td>
            <td class="tl-list-type"><span class="msi tl-list-icon" style="color:${color}">${meta.icon}</span><span>${esc(listTypeLabel)}</span></td>
            <td style="width:34px;padding:4px 8px;">${_tlPersonalProfHtml(ev)}</td>
            <td class="tl-list-user">${userHtml || tlListNaHtml()}</td>
            <td class="tl-list-detail">${detail || tlListNaHtml()}</td>
        </tr>`;
    });

    return `<div class="tl-list-wrap">
        <table class="tl-list-table">
            <colgroup><col style="width:155px"><col style="width:135px"><col style="width:42px"><col style="width:130px"><col></colgroup>
            <thead><tr>
                <th>${esc(t('timeline.list.header.date_time', 'Date / Time'))}</th><th>${esc(t('timeline.list.header.type', 'Type'))}</th><th>${esc(t('timeline.list.header.profile', 'Profile'))}</th><th>${esc(t('timeline.list.header.user', 'User'))}</th><th>${esc(t('timeline.list.header.detail', 'Detail'))}</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>
    </div>`;
}

function _tlListPlayerAvatars(players, max) {
    if (!players || !players.length) return '';
    const shown = players.slice(0, max);
    const rest  = players.length - max;
    let html = '<span class="tl-list-avs">';
    shown.forEach(p => {
        html += p.image
            ? `<span class="tl-list-av" style="background-image:url('${cssUrl(p.image)}')" title="${esc(p.displayName || '')}"></span>`
            : `<span class="tl-list-av tl-list-av-letter" title="${esc(p.displayName || '')}">${esc((p.displayName || '?')[0].toUpperCase())}</span>`;
    });
    if (rest > 0) html += `<span class="tl-list-av tl-list-av-more">+${rest}</span>`;
    html += '</span>';
    return html;
}

function _tlListData(ev) {
    switch (ev.type) {
        case 'instance_join':
            return { userHtml: _tlListPlayerAvatars(ev.players, 3), detail: esc(ev.worldName || ev.worldId || t('timeline.unknown_world', 'Unknown World')) };
        case 'photo':
            return { userHtml: _tlListPlayerAvatars(ev.players, 3), detail: esc(ev.photoPath ? ev.photoPath.split(/[\\/]/).pop() : t('timeline.photo', 'Photo')) };
        case 'first_meet':
            return { userHtml: esc(ev.userName || t('timeline.unknown', 'Unknown')), detail: ev.worldName ? esc(ev.worldName) : '' };
        case 'meet_again':
            return { userHtml: esc(ev.userName || t('timeline.unknown', 'Unknown')), detail: ev.worldName ? esc(ev.worldName) : '' };
        case 'notification': {
            const typeLabel = tlNotifTypeLabel(ev.notifType);
            const sender    = ev.senderName ? ` | ${esc(tf('timeline.list.from', { name: ev.senderName }, `from ${ev.senderName}`))}` : '';
            const msg       = ev.message
                ? `${ev.senderName ? ' | ' : ''}${esc(ev.message.slice(0, 80))}${ev.message.length > 80 ? '...' : ''}`
                : '';
            return { userHtml: ev.senderName ? esc(ev.senderName) : '', detail: esc(typeLabel) + sender + msg };
        }
        case 'avatar_switch':
            return { userHtml: '', detail: esc(ev.userName || '') };
        case 'video_url': {
            const url = ev.message || '';
            const short = url.length > 60 ? url.slice(0, 60) + '...' : url;
            return { userHtml: '', detail: esc(short) };
        }
        default:
            return { userHtml: '', detail: '' };
    }
}

// ═══════════════════════════════════════════════════════════════════
// List View — Friends Timeline
// ═══════════════════════════════════════════════════════════════════

function buildFriendListHtml(events) {
    if (!events.length) {
        return `<div class="empty-msg">${esc(t('timeline.list.empty.friends', 'No friend activity logged yet.'))}</div>`;
    }

    let rows = '';
    events.forEach(ev => {
        const meta  = ftTypeMeta(ev.type);
        const color = FT_TYPE_COLOR[ev.type] ?? 'var(--tx3)';
        const ei    = jsq(ev.id);
        const detail = _ftListDetail(ev);
        const clickAction = ev.type === 'friend_gps'
            ? `openFtGpsDetail('${ei}')`
            : `openFtDetail('${ei}')`;

        rows += `<tr class="tl-list-row" onclick="${clickAction}">
            <td class="tl-list-dt">${esc(`${tlFormatShortDate(ev.timestamp)} | ${tlFormatTime(ev.timestamp)}`)}</td>
            <td class="tl-list-type"><span class="msi tl-list-icon" style="color:${color}">${meta.icon}</span><span>${esc(meta.label)}</span></td>
            <td style="width:34px;padding:4px 8px;">${_tlListProfHtml(ev.friendImage, ev.friendName)}</td>
            <td class="tl-list-user">${esc(ev.friendName || t('timeline.unknown', 'Unknown'))}</td>
            <td class="tl-list-detail">${detail || tlListNaHtml()}</td>
        </tr>`;
    });

    return `<div class="tl-list-wrap">
        <table class="tl-list-table">
            <colgroup><col style="width:155px"><col style="width:135px"><col style="width:42px"><col style="width:130px"><col></colgroup>
            <thead><tr>
                <th>${esc(t('timeline.list.header.date_time', 'Date / Time'))}</th><th>${esc(t('timeline.list.header.type', 'Type'))}</th><th>${esc(t('timeline.list.header.profile', 'Profile'))}</th><th>${esc(t('timeline.list.header.user', 'User'))}</th><th>${esc(t('timeline.list.header.detail', 'Detail'))}</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>
    </div>`;
}

function _ftListDetail(ev) {
    switch (ev.type) {
        case 'friend_online':      return `<span style="color:var(--ok)">${esc(t('timeline.friend.came_online', 'Came Online'))}</span>`;
        case 'friend_offline':     return `<span style="color:var(--tx3)">${esc(t('timeline.friend.went_offline', 'Went Offline'))}</span>`;
        case 'friend_gps':        return esc(ev.worldName || ev.worldId || t('timeline.unknown_world', 'Unknown World'));
        case 'friend_status': {
            const oldCls = statusCssClass(ev.oldValue);
            const newCls = statusCssClass(ev.newValue);
            return `<span class="ft-status-chip ${oldCls}">${esc(statusLabel(ev.oldValue) || '?')}</span>`
                 + `<span class="msi" style="font-size:12px;color:var(--tx3);vertical-align:middle;margin:0 4px;">arrow_forward</span>`
                 + `<span class="ft-status-chip ${newCls}">${esc(statusLabel(ev.newValue) || '?')}</span>`;
        }
        case 'friend_statusdesc': {
            const v = (ev.newValue || '').slice(0, 80);
            return v ? esc(v) + ((ev.newValue || '').length > 80 ? '...' : '') : tlClearedHtml();
        }
        case 'friend_bio': {
            const v = (ev.newValue || '').slice(0, 80);
            return v ? esc(v) + ((ev.newValue || '').length > 80 ? '...' : '') : tlClearedHtml();
        }
        case 'friend_added':      return `<span style="color:var(--ok)">${esc(t('timeline.friend.added_full', 'Friend Added'))}</span>`;
        case 'friend_removed':    return `<span style="color:var(--err)">${esc(t('timeline.friend.unfriended', 'Unfriended'))}</span>`;
        case 'friend_avatar':     return esc(ev.worldName || ev.newValue || t('timeline.unknown', 'Unknown'));
        default: return '';
    }
}

function rerenderTimelineTranslations() {
    const label = document.getElementById('tlDateLabel');
    if (label && tlDateFilter) {
        label.textContent = tlFormatDateFilterLabel(tlDateFilter);
        label.style.display = '';
    }
    if (document.getElementById('tlDatePicker')?.style.display !== 'none') {
        renderDatePickerCalendar();
    }
    if (tlViewMode !== 'timeline') return;
    const search = (document.getElementById('tlSearchInput')?.value ?? '').toLowerCase().trim();
    if (tlMode === 'friends') {
        if (_ftlSearchMode && search) _renderFtlSearchResults(search);
        else if (friendTimelineEvents.length) filterFriendTimeline();
    } else {
        if (_tlSearchMode && search) _renderTlSearchResults(search);
        else if (timelineEvents.length) filterTimeline();
    }
}

document.documentElement.addEventListener('languagechange', rerenderTimelineTranslations);
