/* === Timeline Modal === */
// Which detail modal the timeline-detail content currently targets. Normally
// '#modalDetail'. When opened while '#modalDetail' is already showing (the World
// modal lives there), detail renders into the stacked '#modalDetail2' so the
// underlying modal stays open — same behaviour as the profile modal.
let _tlMid = 'modalDetail';

function _instanceLinkBtn(location, closeJs) {
    if (!location || location.indexOf(':') <= 0 || !location.startsWith('wrld_')) return '';
    return `<button class="vrcn-button-round" onclick="${closeJs ? closeJs + ';' : ''}copyInstanceLink('${jsq(location)}')"><span class="msi" style="font-size:14px;">content_copy</span> ${esc(t('timeline.actions.copy_instance_link', 'Copy Instance Link'))}</button>`;
}

function openTlDetail(id) {
    const ev = timelineEvents.find(e => e.id === id)
             || _tlSearchEvents.find(e => e.id === id)
             || _fdTimelineEvents.find(e => e.id === id)
             || (typeof _wdInstanceHistory !== 'undefined' ? _wdInstanceHistory.find(e => e.id === id) : null)
             || (typeof _icData !== 'undefined' ? _icData.find(e => e.id === id) : null);
    if (!ev) return;

    if (ev.type === 'photo') {
        const libItem = (typeof libraryFiles !== 'undefined' && ev.photoPath)
            ? libraryFiles.find(f => f.path === ev.photoPath)
            : null;
        openPhotoDetail(libItem || {
            name:     ev.photoPath ? ev.photoPath.split(/[\\/]/).pop() : t('timeline.photo', 'Photo'),
            path:     ev.photoPath || '',
            url:      ev.photoUrl  || '',
            modified: ev.timestamp,
            size:     '',
            worldId:  ev.worldId   || '',
            players:  ev.players   || [],
            imgW: 0, imgH: 0,
        });
        return;
    }

    const mainOpen = document.getElementById('modalDetail')?.style.display === 'flex';
    _tlMid = mainOpen ? 'modalDetail2' : 'modalDetail';
    const el = document.getElementById(mainOpen ? 'detailModalContent2' : 'detailModalContent');
    if (!el) return;

    switch (ev.type) {
        case 'instance_join': renderTlDetailJoin(ev, el);      break;
        case 'first_meet':    renderTlDetailMeet(ev, el);      break;
        case 'meet_again':    renderTlDetailMeetAgain(ev, el); break;
        case 'notification':  renderTlDetailNotif(ev, el);     break;
        case 'avatar_switch': renderTlDetailAvatar(ev, el);    break;
        case 'video_url':     renderTlDetailUrl(ev, el);       break;
    }

    const _mb = document.querySelector(`#${_tlMid} .modal-box`);
    if (_mb) _mb.classList.add('narrow');
    document.getElementById(_tlMid).classList.remove('wd-style-compact', 'gd-style-compact');
    document.getElementById(_tlMid).style.display = 'flex';
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

// Shared helpers for timeline detail modals
function _tlMr(label, val) {
    return `<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;font-size:11px;"><span style="color:var(--tx3);">${label}</span><span style="color:var(--tx1);text-align:right;">${val}</span></div>`;
}
function _tlInfoCard(title, rowsHtml) {
    return `<div class="fd-info-card"><div class="fd-group-rep-label">${title}</div><div style="display:grid;gap:6px;">${rowsHtml}</div></div>`;
}
function _tlClose() {
    return `<button class="vrcn-button-round" style="margin-left:auto;" onclick="document.getElementById('${_tlMid}').style.display='none'">${esc(t('common.close', 'Close'))}</button>`;
}
function _tlBanner(hasThumb) {
    return hasThumb ? `<div class="fd-banner" id="tl-banner-slot"><div class="fd-banner-fade"></div></div>` : '';
}
function _tlInsertBanner(el, key, src) {
    if (!src || !key) return;
    const s = el.querySelector('#tl-banner-slot');
    const bi = _getWorldBannerImg(key, src);
    if (s && bi) s.insertBefore(bi, s.firstChild);
}
function _tlAvRow(image, name, label, labelColor) {
    const av = image
        ? `<div class="tl-detail-av" style="background-image:url('${cssUrl(image)}')"></div>`
        : `<div class="tl-detail-av tl-detail-av-letter">${esc((name || '?')[0].toUpperCase())}</div>`;
    return `<div style="display:flex;gap:16px;align-items:center;margin-bottom:16px;">${av}<div>
        <h2 style="margin:0 0 4px;color:var(--tx0);font-size:18px;">${esc(name || t('timeline.unknown', 'Unknown'))}</h2>
        <div style="font-size:11px;color:${labelColor};font-weight:700;letter-spacing:.05em;">${esc(label)}</div>
    </div></div>`;
}

// Detail: instance join

// Falls back to legacy single-value joinedAt/leftAt when arrays are missing.
function _tlPlayerSessions(p) {
    let joins = Array.isArray(p.joinedAts) ? p.joinedAts.slice() : (p.joinedAt ? [p.joinedAt] : []);
    let lefts = Array.isArray(p.leftAts)   ? p.leftAts.slice()   : (p.leftAt   ? [p.leftAt]   : []);
    return { joins, lefts };
}

function _tlPlayerCard(p, instanceStart, instanceEnd) {
    const name   = p.displayName || '?';
    const live   = p.userId ? vrcFriendsData.find(f => f.id === p.userId) : null;
    const image  = live?.image || p.image || '';
    const av     = image
        ? `<div class="tl-player-card-av" style="background-image:url('${cssUrl(image)}')"></div>`
        : `<div class="tl-player-card-av">${esc(name[0].toUpperCase())}</div>`;
    const badge  = live ? `<span class="vrcn-badge bdg-friend"><span class="msi" style="font-size:10px;">check_circle</span>${t('profiles.badges.friend', 'Friend')}</span>` : '';
    const onclick = p.userId ? `onclick="document.getElementById('${_tlMid}').style.display='none';openFriendDetail('${jsq(p.userId)}')"` : '';
    const clickCls = p.userId ? ' clickable' : '';

    const { joins, lefts } = _tlPlayerSessions(p);
    const nowIso = new Date().toISOString();

    // Open session uses "now" as end.
    let totalSecs = 0;
    for (let i = 0; i < joins.length; i++) {
        const jMs = new Date(joins[i]).getTime();
        const lIso = i < lefts.length ? lefts[i] : nowIso;
        const lMs = new Date(lIso).getTime();
        if (isFinite(jMs) && isFinite(lMs) && lMs > jMs) totalSecs += Math.floor((lMs - jMs) / 1000);
    }

    let timesHtml;
    if (joins.length === 0 && lefts.length === 0) {
        timesHtml = `${esc(t('timeline.detail.none', 'None'))}`;
    } else {
        const ongoing = lefts.length < joins.length
            ? `&nbsp;·&nbsp;<span style="color:var(--ok);">&#9679;&nbsp;${esc(t('timeline.detail.ongoing', 'Ongoing'))}</span>`
            : '';
        const visits = joins.length > 1
            ? `${esc(tf('timeline.detail.visits_count', { count: joins.length }, `${joins.length} visits`))}&nbsp;·&nbsp;`
            : '';
        const spent = totalSecs > 0
            ? `${esc(t('nav.time_spent', 'Time Spent'))} ${esc(formatDuration(totalSecs))}`
            : '';
        timesHtml = `${visits}${spent}${ongoing}`;
    }

    let barHtml = '';
    const iStart = instanceStart ? new Date(instanceStart).getTime() : 0;
    const nowMs  = Date.now();
    let   iEnd   = instanceEnd ? new Date(instanceEnd).getTime() : nowMs;
    // Extend iEnd if a session ends after the recorded instance close (re-join after a stale close).
    for (let i = 0; i < joins.length; i++) {
        const endCandidate = i < lefts.length ? new Date(lefts[i]).getTime() : nowMs;
        if (isFinite(endCandidate) && endCandidate > iEnd) iEnd = endCandidate;
    }
    const total = iEnd - iStart;
    if (total > 0 && joins.length > 0) {
        const barCls = live ? ' friend' : '';
        let segments = '';
        for (let i = 0; i < joins.length; i++) {
            const jIso = joins[i];
            const lIso = i < lefts.length ? lefts[i] : null;
            const pStart = new Date(jIso).getTime();
            const pEnd   = lIso ? new Date(lIso).getTime() : iEnd;
            if (!isFinite(pStart) || !isFinite(pEnd) || pEnd < pStart) continue;
            const leftPct  = Math.max(0, Math.min(100, (pStart - iStart) / total * 100));
            const widthPct = Math.max(0.6, Math.min(100 - leftPct, (pEnd - pStart) / total * 100));
            const fromStr = tlFormatTime(jIso);
            const untilStr = lIso ? tlFormatTime(lIso) : t('timeline.detail.ongoing', 'Ongoing');
            const tip = `${t('timeline.detail.from', 'From')} ${fromStr} · ${t('timeline.detail.until', 'Until')} ${untilStr}`;
            segments += `<div class="tl-player-bar${barCls}" style="left:${leftPct.toFixed(2)}%;width:${widthPct.toFixed(2)}%" title="${esc(tip)}"></div>`;
        }
        if (segments) barHtml = `<div class="tl-player-bar-wrap">${segments}</div>`;
    }

    return `<div class="tl-player-card${clickCls}" ${onclick} style="flex-wrap:wrap;">${av}<div class="tl-player-card-info"><div class="tl-player-card-name"><span>${esc(name)}</span>${badge}</div><div class="tl-player-card-times">${timesHtml}</div></div>${barHtml ? `<div style="flex-basis:100%;padding:0 2px;">${barHtml}</div>` : ''}</div>`;
}

function renderTlDetailJoin(ev, el) {
    const banner  = _tlBanner(!!ev.worldThumb);
    const players = ev.players || [];

    let playersHtml = '';
    if (players.length > 0) {
        const instEnd = ev.leftAt || new Date().toISOString();
        let grid = '';
        players.forEach(p => { grid += _tlPlayerCard(p, ev.timestamp, instEnd); });
        playersHtml = `<div class="fd-info-card tl-players-card">
            <div class="fd-group-rep-label">${esc(tf('timeline.detail.players_in_instance', { count: players.length }, `Players in instance (${players.length})`))}</div>
            <div style="font-size:10.5px;color:var(--tx3);margin-bottom:8px;line-height:1.4;">${esc(t('timeline.detail.players_disclaimer', 'Shows when each player was tracked while you were in the instance. This does not mean they joined or left at those exact times.'))}</div>
            <div class="tl-players-grid">${grid}</div>
        </div>`;
    }

    const dateStr = tlFormatLongDate(ev.timestamp);
    const fromStr = ev.timestamp ? tlFormatTime(ev.timestamp) : null;
    const toStr   = ev.leftAt    ? tlFormatTime(ev.leftAt)    : null;

    const loc = ev.location || '';
    const { instanceType } = parseFriendLocation(loc);
    const { cls: instCls, label: instLabel } = getInstanceBadge(instanceType);
    const instIdMatch = loc.match(/:(\d+)/);
    const instanceId  = instIdMatch ? instIdMatch[1] : '';

    const worldRowClick = ev.worldId ? ` onclick="document.getElementById('${_tlMid}').style.display='none';openWorldSearchDetail('${esc(ev.worldId)}')" style="cursor:pointer;"` : '';
    const infoRows = [
        _tlMr(esc(t('timeline.detail.date', 'Date')), esc(dateStr)),
        fromStr ? _tlMr(esc(t('timeline.detail.from', 'From')), esc(fromStr)) : '',
        (fromStr && ev.tracked) ? _tlMr(esc(t('timeline.detail.to', 'To')), toStr ? esc(toStr) : `<span style="color:var(--ok);">&#9679;&nbsp;${esc(t('timeline.detail.ongoing', 'Ongoing'))}</span>`) : '',
        (ev.tracked && ev.leftAt && ev.timestamp) ? _tlMr(esc(t('nav.time_spent', 'Time Spent')), esc(formatDuration(Math.floor((new Date(ev.leftAt) - new Date(ev.timestamp)) / 1000)))) : '',
        ev.worldId ? `<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;font-size:11px;"${worldRowClick}><span style="color:var(--tx3);">${esc(t('timeline.detail.world', 'World'))}</span><span style="color:var(--accent-lt);text-align:right;">${esc(ev.worldName || ev.worldId)}</span></div>` : '',
        _tlMr(esc(t('timeline.detail.instance_type', 'Instance Type')), `<span class="vrcn-badge ${instCls}">${instLabel}</span>`),
        instanceId ? _tlMr(esc(t('timeline.detail.instance_id', 'Instance ID')), `<span style="font-family:monospace;font-size:12px;color:var(--tx2);">#${esc(instanceId)}</span>`) : '',
    ].filter(Boolean).join('');

    el.innerHTML = `${banner}<div class="fd-content${banner ? ' fd-has-banner' : ''}" style="padding:20px 0;">
        <h2 style="margin:0 0 12px;color:var(--tx0);font-size:18px;">${esc(ev.worldName || ev.worldId || t('timeline.unknown_world', 'Unknown World'))}</h2>
        ${_tlInfoCard(esc(t('timeline.detail.info', 'Info')), infoRows)}
        ${playersHtml}
        <div style="margin-top:14px;display:flex;gap:8px;">
            <button class="vrcn-button-round vrcn-btn-join" onclick="document.getElementById('${_tlMid}').style.display='none';sendToCS({action:'vrcJoinFriend',location:'${jsq(ev.location)}'});">${esc(t('instance.actions.force_join', 'Force-Join'))}</button>
            ${_instanceLinkBtn(ev.location, '')}
            ${_tlClose()}
        </div>
    </div>`;
    _tlInsertBanner(el, ev.worldId || ev.id, ev.worldThumb);
}

// Detail: first meet

function renderTlDetailMeet(ev, el) {
    const dateStr = tlFormatLongDate(ev.timestamp);
    const timeStr = tlFormatTime(ev.timestamp);
    const worldRowClick = ev.worldId ? ` onclick="document.getElementById('${_tlMid}').style.display='none';openWorldSearchDetail('${esc(ev.worldId)}')" style="cursor:pointer;"` : '';
    const infoRows = [
        _tlMr(esc(t('timeline.detail.date', 'Date')), esc(dateStr)),
        _tlMr(esc(t('timeline.detail.time', 'Time')), esc(timeStr)),
        ev.worldId ? `<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;font-size:11px;"${worldRowClick}><span style="color:var(--tx3);">${esc(t('timeline.detail.world', 'World'))}</span><span style="color:var(--accent-lt);text-align:right;">${esc(ev.worldName || ev.worldId)}</span></div>` : '',
    ].filter(Boolean).join('');
    el.innerHTML = `<div class="fd-content" style="padding:20px 0;">
        ${_tlAvRow(ev.userImage, ev.userName, t('timeline.detail.first_meet', 'FIRST MEET'), 'var(--cyan)')}
        ${_tlInfoCard(esc(t('timeline.detail.info', 'Info')), infoRows)}
        <div style="margin-top:14px;display:flex;gap:8px;">
            ${ev.userId ? `<button class="vrcn-button-round vrcn-btn-join" onclick="document.getElementById('${_tlMid}').style.display='none';openFriendDetail('${esc(ev.userId)}')">${esc(t('timeline.actions.view_profile', 'View Profile'))}</button>` : ''}
            ${_tlClose()}
        </div>
    </div>`;
}

// Detail: meet again

function renderTlDetailMeetAgain(ev, el) {
    const dateStr = tlFormatLongDate(ev.timestamp);
    const timeStr = tlFormatTime(ev.timestamp);
    const worldRowClick = ev.worldId ? ` onclick="document.getElementById('${_tlMid}').style.display='none';openWorldSearchDetail('${esc(ev.worldId)}')" style="cursor:pointer;"` : '';
    const infoRows = [
        _tlMr(esc(t('timeline.detail.date', 'Date')), esc(dateStr)),
        _tlMr(esc(t('timeline.detail.time', 'Time')), esc(timeStr)),
        ev.worldId ? `<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;font-size:11px;"${worldRowClick}><span style="color:var(--tx3);">${esc(t('timeline.detail.world', 'World'))}</span><span style="color:var(--accent-lt);text-align:right;">${esc(ev.worldName || ev.worldId)}</span></div>` : '',
    ].filter(Boolean).join('');
    el.innerHTML = `<div class="fd-content" style="padding:20px 0;">
        ${_tlAvRow(ev.userImage, ev.userName, t('timeline.detail.met_again', 'MET AGAIN'), '#AB47BC')}
        ${_tlInfoCard(esc(t('timeline.detail.info', 'Info')), infoRows)}
        <div style="margin-top:14px;display:flex;gap:8px;">
            ${ev.userId ? `<button class="vrcn-button-round vrcn-btn-join" onclick="document.getElementById('${_tlMid}').style.display='none';openFriendDetail('${esc(ev.userId)}')">${esc(t('timeline.actions.view_profile', 'View Profile'))}</button>` : ''}
            ${_tlClose()}
        </div>
    </div>`;
}

// Detail: notification

function renderTlDetailNotif(ev, el) {
    const dateStr   = tlFormatLongDate(ev.timestamp);
    const timeStr   = tlFormatTime(ev.timestamp);
    const typeLabel = tlNotifTypeLabel(ev.notifType);
    const infoRows = [
        _tlMr(esc(t('timeline.detail.date', 'Date')), esc(dateStr)),
        _tlMr(esc(t('timeline.detail.time', 'Time')), esc(timeStr)),
        _tlMr(esc(t('timeline.detail.type', 'Type')), esc(typeLabel)),
        ev.notifTitle ? _tlMr(esc(t('timeline.detail.context', 'Context')), esc(ev.notifTitle)) : '',
        ev.message    ? _tlMr(esc(t('timeline.detail.message', 'Message')), esc(ev.message))    : '',
    ].filter(Boolean).join('');
    el.innerHTML = `<div class="fd-content" style="padding:20px 0;">
        ${_tlAvRow(ev.senderImage, ev.senderName || typeLabel, typeLabel.toUpperCase(), 'var(--warn)')}
        ${_tlInfoCard(esc(t('timeline.detail.info', 'Info')), infoRows)}
        <div style="margin-top:14px;display:flex;gap:8px;">
            ${ev.senderId ? `<button class="vrcn-button-round vrcn-btn-join" onclick="document.getElementById('${_tlMid}').style.display='none';openFriendDetail('${esc(ev.senderId)}')">${esc(t('timeline.actions.view_profile', 'View Profile'))}</button>` : ''}
            ${_tlClose()}
        </div>
    </div>`;
}

// Detail: avatar switch

function renderTlDetailAvatar(ev, el) {
    const dateStr = tlFormatLongDate(ev.timestamp);
    const timeStr = tlFormatTime(ev.timestamp);
    const banner  = _tlBanner(!!ev.userImage);
    const infoRows = [
        _tlMr(esc(t('timeline.detail.date', 'Date')), esc(dateStr)),
        _tlMr(esc(t('timeline.detail.time', 'Time')), esc(timeStr)),
        ev.userId ? _tlMr(esc(t('timeline.detail.avatar_id', 'Avatar ID')), `<span style="font-size:11px;color:var(--tx3);">${esc(ev.userId)}</span>`) : '',
    ].filter(Boolean).join('');
    el.innerHTML = `${banner}<div class="fd-content${banner ? ' fd-has-banner' : ''}" style="padding:20px 0;">
        <h2 style="margin:0 0 12px;color:var(--tx0);font-size:18px;">${esc(ev.userName || t('timeline.unknown_avatar', 'Unknown Avatar'))}</h2>
        ${_tlInfoCard(esc(t('timeline.detail.info', 'Info')), infoRows)}
        <div style="margin-top:14px;display:flex;gap:8px;">
            ${ev.userId ? `<button class="vrcn-button-round vrcn-btn-join" onclick="document.getElementById('${_tlMid}').style.display='none';openAvatarDetail('${jsq(ev.userId)}')">${esc(t('timeline.actions.view_avatar', 'View Avatar'))}</button>` : ''}
            ${_tlClose()}
        </div>
    </div>`;
    _tlInsertBanner(el, ev.userId || ev.id, ev.userImage);
}

// Detail: video URL

function renderTlDetailUrl(ev, el) {
    const dateStr = tlFormatLongDate(ev.timestamp);
    const timeStr = tlFormatTime(ev.timestamp);
    const url     = ev.message || '';
    const plat    = _urlPlatform(url);
    const favicon = `<div style="display:flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:12px;background:var(--bg2);">${_urlFaviconHtml(plat)}</div>`;
    const worldRowClick = ev.worldId ? ` onclick="document.getElementById('${_tlMid}').style.display='none';openWorldSearchDetail('${esc(ev.worldId)}')" style="cursor:pointer;"` : '';
    const infoRows = [
        _tlMr(esc(t('timeline.detail.date', 'Date')), esc(dateStr)),
        _tlMr(esc(t('timeline.detail.time', 'Time')), esc(timeStr)),
        ev.worldName ? `<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;font-size:11px;"${worldRowClick}><span style="color:var(--tx3);">${esc(t('timeline.detail.world', 'World'))}</span><span style="color:var(--accent-lt);text-align:right;">${esc(ev.worldName)}</span></div>` : '',
        _tlMr(esc(t('timeline.detail.url', 'URL')), `<span style="word-break:break-all;font-size:11px;color:var(--tx2);">${esc(url)}</span>`),
    ].filter(Boolean).join('');
    el.innerHTML = `<div class="fd-content" style="padding:20px 0;">
        <div style="display:flex;gap:16px;align-items:center;margin-bottom:16px;">
            ${favicon}
            <div>
                <h2 style="margin:0 0 4px;color:var(--tx0);font-size:18px;">${esc(plat.name)}</h2>
                <div style="font-size:11px;color:${plat.color};font-weight:700;letter-spacing:.05em;">${esc(t('timeline.detail.video_url', 'VIDEO URL'))}</div>
            </div>
        </div>
        ${_tlInfoCard(esc(t('timeline.detail.info', 'Info')), infoRows)}
        <div style="margin-top:14px;display:flex;gap:8px;">
            <button class="vrcn-button-round vrcn-btn-join" onclick="sendToCS({action:'openUrl',url:'${jsq(url)}'})">${esc(t('timeline.actions.open_url', 'Open URL'))}</button>
            <button class="vrcn-button-round" onclick="navigator.clipboard.writeText('${jsq(url)}').then(()=>showToast(true,t('timeline.toast.copied','Copied!')))">${esc(t('timeline.actions.copy', 'Copy'))}</button>
            ${_tlClose()}
        </div>
    </div>`;
}


/* === Friend GPS Instance Log Modal === */
function openFtGpsDetail(evId) {
    const ev = friendTimelineEvents.find(e => e.id === evId)
             || _ftlSearchEvents.find(e => e.id === evId);
    if (!ev) return;
    renderFtGpsDetailModal(ev);
    const _ftMb = document.getElementById('ftGpsDetailContent');
    if (_ftMb) _ftMb.classList.add('narrow');
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

    const worldName = ev.worldName || ev.worldId || t('timeline.unknown_world', 'Unknown World');

    // Was Also Here: populated async from server (covers all pages, not just loaded memory)
    const alsoList = [];

    const fromStr = ev.timestamp ? tlFormatTime(ev.timestamp) : null;
    const toStr   = ev.leftAt    ? tlFormatTime(ev.leftAt)    : null;

    const infoHtml = _tlInfoCard(esc(t('timeline.detail.info', 'Info')), [
        _tlMr(esc(t('timeline.detail.date', 'Date')), esc(dateStr)),
        _tlMr(esc(t('timeline.detail.time', 'Time')), esc(timeStr)),
        fromStr ? _tlMr(esc(t('timeline.detail.from', 'From')), esc(fromStr)) : '',
        (fromStr && ev.tracked) ? _tlMr(esc(t('timeline.detail.to', 'To')), toStr ? esc(toStr) : `<span style="color:var(--ok);">&#9679;&nbsp;${esc(t('timeline.detail.ongoing', 'Ongoing'))}</span>`) : '',
        (ev.tracked && ev.leftAt && ev.timestamp) ? _tlMr(esc(t('nav.time_spent', 'Time Spent')), esc(formatDuration(Math.floor((new Date(ev.leftAt) - new Date(ev.timestamp)) / 1000)))) : '',
        _tlMr(esc(t('timeline.detail.instance_type', 'Instance Type')), `<span class="vrcn-badge ${instCls}">${instLabel}</span>`),
        instanceId ? _tlMr(esc(t('timeline.detail.instance_id', 'Instance ID')), `<span style="font-family:monospace;font-size:12px;color:var(--tx2);">#${esc(instanceId)}</span>`) : '',
        _tlMr(esc(t('timeline.detail.event', 'Event')), `<span style="color:var(--tx2);">${esc(tf('timeline.detail.friend_joined_world', { name: ev.friendName || t('timeline.unknown', 'Unknown') }, `${ev.friendName || 'Unknown'} joined this world`))}</span>`),
    ].filter(Boolean).join(''));

    const banner = _tlBanner(!!ev.worldThumb);
    const el = document.getElementById('ftGpsDetailContent');
    el.innerHTML = `${banner}<div class="fd-content${banner ? ' fd-has-banner' : ''}" style="padding:16px 0;">
        ${ftDetailAvRow(ev)}
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
    _tlInsertBanner(el, ev.worldId || ev.id, ev.worldThumb);
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
    _tlMid = 'modalDetail';
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

    const _mb2 = document.querySelector('#modalDetail .modal-box');
    if (_mb2) _mb2.classList.add('narrow');
    document.getElementById('modalDetail').style.display = 'flex';
}

function openFdActivityDetail(id) {
    const ev = _fdUserActivityEvents.find(e => e.id === id);
    if (!ev) return;
    if (ev.type === 'friend_gps') {
        renderFtGpsDetailModal(ev);
        const _ftMb = document.getElementById('ftGpsDetailContent');
        if (_ftMb) _ftMb.classList.add('narrow');
        document.getElementById('modalFtGpsDetail').style.display = 'flex';
        return;
    }
    _tlMid = 'modalDetail';
    const el = document.getElementById('detailModalContent');
    if (!el) return;
    switch (ev.type) {
        case 'friend_status':     renderFtDetailStatus(ev, el);     break;
        case 'friend_statusdesc': renderFtDetailStatusDesc(ev, el); break;
        case 'friend_online':      renderFtDetailOnline(ev, el);     break;
        case 'friend_offline':     renderFtDetailOffline(ev, el);    break;
        case 'friend_bio':        renderFtDetailBio(ev, el);        break;
        case 'friend_added':      renderFtDetailAdded(ev, el);      break;
        case 'friend_removed':    renderFtDetailRemoved(ev, el);    break;
    }
    const _mb3 = document.querySelector('#modalDetail .modal-box');
    if (_mb3) _mb3.classList.add('narrow');
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
    return `<button class="vrcn-button-round" style="margin-left:auto;" onclick="document.getElementById('${_tlMid}').style.display='none'">${esc(t('common.close', 'Close'))}</button>`;
}

function ftDetailViewProfile(ev) {
    return ev.friendId
        ? `<button class="vrcn-button-round vrcn-btn-join" onclick="document.getElementById('${_tlMid}').style.display='none';openFriendDetail('${esc(ev.friendId)}')">${esc(t('timeline.actions.view_profile', 'View Profile'))}</button>`
        : '';
}

function renderFtDetailGps(ev, el) {
    const { dateStr, timeStr } = ftDetailDatetime(ev);
    const banner = _tlBanner(!!ev.worldThumb);
    const wname  = ev.worldName || ev.worldId || t('timeline.unknown_world', 'Unknown World');
    const worldRowClick = ev.worldId ? ` onclick="document.getElementById('${_tlMid}').style.display='none';openWorldSearchDetail('${esc(ev.worldId)}')" style="cursor:pointer;"` : '';
    const infoRows = [
        _tlMr(esc(t('timeline.detail.date', 'Date')), esc(dateStr)),
        _tlMr(esc(t('timeline.detail.time', 'Time')), esc(timeStr)),
        `<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;font-size:11px;"${worldRowClick}><span style="color:var(--tx3);">${esc(t('timeline.detail.world', 'World'))}</span><span style="color:var(--accent-lt);text-align:right;">${esc(wname)}</span></div>`,
    ].join('');
    el.innerHTML = `${banner}<div class="fd-content${banner ? ' fd-has-banner' : ''}" style="padding:20px 0;">
        ${ftDetailAvRow(ev)}
        ${_tlInfoCard(esc(t('timeline.detail.info', 'Info')), infoRows)}
        <div style="margin-top:14px;display:flex;gap:8px;">
            ${ev.worldId ? `<button class="vrcn-button-round vrcn-btn-join" onclick="document.getElementById('${_tlMid}').style.display='none';openWorldSearchDetail('${esc(ev.worldId)}')"><span class="msi" style="font-size:14px;">travel_explore</span> ${esc(t('timeline.actions.open_world', 'Open World'))}</button>` : ''}
            ${ftDetailViewProfile(ev)}
            ${ftDetailClose()}
        </div>
    </div>`;
    _tlInsertBanner(el, ev.worldId || ev.id, ev.worldThumb);
}

function renderFtDetailStatus(ev, el) {
    const { dateStr, timeStr } = ftDetailDatetime(ev);
    const oldCls = statusCssClass(ev.oldValue);
    const newCls = statusCssClass(ev.newValue);
    const infoRows = [
        _tlMr(esc(t('timeline.detail.date', 'Date')), esc(dateStr)),
        _tlMr(esc(t('timeline.detail.time', 'Time')), esc(timeStr)),
        _tlMr(esc(t('timeline.detail.change', 'Change')), `<span style="display:flex;align-items:center;gap:6px;"><span class="ft-status-chip ${oldCls}">${esc(statusLabel(ev.oldValue) || '?')}</span><span class="msi" style="font-size:12px;color:var(--tx3);">arrow_forward</span><span class="ft-status-chip ${newCls}">${esc(statusLabel(ev.newValue) || '?')}</span></span>`),
    ].join('');
    el.innerHTML = `<div class="fd-content" style="padding:20px 0;">
        ${ftDetailAvRow(ev)}
        ${_tlInfoCard(esc(t('timeline.detail.info', 'Info')), infoRows)}
        <div style="margin-top:14px;display:flex;gap:8px;">${ftDetailViewProfile(ev)}${ftDetailClose()}</div>
    </div>`;
}

function renderFtDetailOnline(ev, el) {
    const { dateStr, timeStr } = ftDetailDatetime(ev);
    const infoRows = [
        _tlMr(esc(t('timeline.detail.date', 'Date')), esc(dateStr)),
        _tlMr(esc(t('timeline.detail.time', 'Time')), esc(timeStr)),
        _tlMr(esc(t('timeline.detail.event', 'Event')), `<span style="color:var(--ok);">${esc(t('timeline.friend.online_game', 'Online (Game)'))}</span>`),
    ].join('');
    el.innerHTML = `<div class="fd-content" style="padding:20px 0;">
        ${ftDetailAvRow(ev)}
        ${_tlInfoCard(esc(t('timeline.detail.info', 'Info')), infoRows)}
        <div style="margin-top:14px;display:flex;gap:8px;">${ftDetailViewProfile(ev)}${ftDetailClose()}</div>
    </div>`;
}

function renderFtDetailOffline(ev, el) {
    const { dateStr, timeStr } = ftDetailDatetime(ev);
    const infoRows = [
        _tlMr(esc(t('timeline.detail.date', 'Date')), esc(dateStr)),
        _tlMr(esc(t('timeline.detail.time', 'Time')), esc(timeStr)),
        _tlMr(esc(t('timeline.detail.event', 'Event')), `<span style="color:var(--tx3);">${esc(t('timeline.friend.went_offline', 'Went Offline'))}</span>`),
    ].join('');
    el.innerHTML = `<div class="fd-content" style="padding:20px 0;">
        ${ftDetailAvRow(ev)}
        ${_tlInfoCard(esc(t('timeline.detail.info', 'Info')), infoRows)}
        <div style="margin-top:14px;display:flex;gap:8px;">${ftDetailViewProfile(ev)}${ftDetailClose()}</div>
    </div>`;
}

function renderFtDetailAdded(ev, el) {
    const { dateStr, timeStr } = ftDetailDatetime(ev);
    const infoRows = [
        _tlMr(esc(t('timeline.detail.date', 'Date')), esc(dateStr)),
        _tlMr(esc(t('timeline.detail.time', 'Time')), esc(timeStr)),
        _tlMr(esc(t('timeline.detail.event', 'Event')), `<span style="color:var(--ok);">${esc(t('timeline.friend.added_full', 'Friend Added'))}</span>`),
    ].join('');
    el.innerHTML = `<div class="fd-content" style="padding:20px 0;">
        ${ftDetailAvRow(ev)}
        ${_tlInfoCard(esc(t('timeline.detail.info', 'Info')), infoRows)}
        <div style="margin-top:14px;display:flex;gap:8px;">${ftDetailViewProfile(ev)}${ftDetailClose()}</div>
    </div>`;
}

function renderFtDetailRemoved(ev, el) {
    const { dateStr, timeStr } = ftDetailDatetime(ev);
    const infoRows = [
        _tlMr(esc(t('timeline.detail.date', 'Date')), esc(dateStr)),
        _tlMr(esc(t('timeline.detail.time', 'Time')), esc(timeStr)),
        _tlMr(esc(t('timeline.detail.event', 'Event')), `<span style="color:var(--err);">${esc(t('timeline.friend.unfriended', 'Unfriended'))}</span>`),
        ev.friendId ? _tlMr(esc(t('timeline.detail.user_id', 'User ID')), `<span style="font-size:11px;opacity:.7;">${esc(ev.friendId)}</span>`) : '',
    ].filter(Boolean).join('');
    el.innerHTML = `<div class="fd-content" style="padding:20px 0;">
        ${ftDetailAvRow(ev)}
        ${_tlInfoCard(esc(t('timeline.detail.info', 'Info')), infoRows)}
        <div style="margin-top:14px;display:flex;gap:8px;">${ftDetailViewProfile(ev)}${ftDetailClose()}</div>
    </div>`;
}

function renderFtDetailStatusDesc(ev, el) {
    const { dateStr, timeStr } = ftDetailDatetime(ev);
    const infoRows = [
        _tlMr(esc(t('timeline.detail.date', 'Date')), esc(dateStr)),
        _tlMr(esc(t('timeline.detail.time', 'Time')), esc(timeStr)),
    ].join('');
    el.innerHTML = `<div class="fd-content" style="padding:20px 0;">
        ${ftDetailAvRow(ev)}
        ${_tlInfoCard(esc(t('timeline.detail.info', 'Info')), infoRows)}
        ${ev.oldValue ? `<div class="fd-info-card" style="margin-top:10px;"><div class="fd-group-rep-label">${esc(t('timeline.detail.previous_status_text', 'PREVIOUS STATUS TEXT'))}</div><div style="font-size:12px;color:var(--tx2);white-space:pre-wrap;">${esc(ev.oldValue)}</div></div>` : ''}
        ${ev.newValue !== undefined ? `<div class="fd-info-card" style="margin-top:10px;"><div class="fd-group-rep-label">${esc(t('timeline.detail.new_status_text', 'NEW STATUS TEXT'))}</div><div style="font-size:12px;color:var(--tx1);white-space:pre-wrap;">${ev.newValue ? esc(ev.newValue) : tlDetailClearedHtml()}</div></div>` : ''}
        <div style="margin-top:14px;display:flex;gap:8px;">${ftDetailViewProfile(ev)}${ftDetailClose()}</div>
    </div>`;
}

function renderFtDetailBio(ev, el) {
    const { dateStr, timeStr } = ftDetailDatetime(ev);
    const infoRows = [
        _tlMr(esc(t('timeline.detail.date', 'Date')), esc(dateStr)),
        _tlMr(esc(t('timeline.detail.time', 'Time')), esc(timeStr)),
    ].join('');
    el.innerHTML = `<div class="fd-content" style="padding:20px 0;">
        ${ftDetailAvRow(ev)}
        ${_tlInfoCard(esc(t('timeline.detail.info', 'Info')), infoRows)}
        ${ev.oldValue ? `<div class="fd-info-card" style="margin-top:10px;"><div class="fd-group-rep-label">${esc(t('timeline.detail.previous_bio', 'PREVIOUS BIO'))}</div><div style="font-size:12px;color:var(--tx2);white-space:pre-wrap;">${esc(ev.oldValue)}</div></div>` : ''}
        ${ev.newValue ? `<div class="fd-info-card" style="margin-top:10px;"><div class="fd-group-rep-label">${esc(t('timeline.detail.new_bio', 'NEW BIO'))}</div><div style="font-size:12px;color:var(--tx1);white-space:pre-wrap;">${esc(ev.newValue)}</div></div>` : ''}
        <div style="margin-top:14px;display:flex;gap:8px;">${ftDetailViewProfile(ev)}${ftDetailClose()}</div>
    </div>`;
}

function renderFtDetailFriendAvatar(ev, el) {
    const { dateStr, timeStr } = ftDetailDatetime(ev);
    const banner = _tlBanner(!!ev.worldThumb);
    const infoRows = [
        _tlMr(esc(t('timeline.detail.date', 'Date')), esc(dateStr)),
        _tlMr(esc(t('timeline.detail.time', 'Time')), esc(timeStr)),
        ev.worldName ? _tlMr(esc(t('timeline.detail.avatar', 'Avatar')), `<span style="color:var(--accent-lt);">${esc(ev.worldName)}</span>`) : '',
        ev.worldId   ? _tlMr(esc(t('timeline.detail.avatar_id', 'Avatar ID')), `<span style="font-size:11px;color:var(--tx3);">${esc(ev.worldId)}</span>`) : '',
    ].filter(Boolean).join('');
    el.innerHTML = `${banner}<div class="fd-content${banner ? ' fd-has-banner' : ''}" style="padding:20px 0;">
        ${ftDetailAvRow(ev)}
        ${_tlInfoCard(esc(t('timeline.detail.info', 'Info')), infoRows)}
        <div style="margin-top:14px;display:flex;gap:8px;">
            ${ev.worldId ? `<button class="vrcn-button-round vrcn-btn-join" onclick="document.getElementById('${_tlMid}').style.display='none';openAvatarDetail('${jsq(ev.worldId)}')">${esc(t('timeline.actions.view_avatar', 'View Avatar'))}</button>` : ''}
            ${ftDetailViewProfile(ev)}${ftDetailClose()}
        </div>
    </div>`;
    _tlInsertBanner(el, ev.worldId || ev.id, ev.worldThumb);
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
    if (ev.type === 'instance_join') {
        const players = ev.players || [];
        if (players.length > 0) return _tlListPlayerAvatars(players, 3);
        return _tlListProfHtml(currentVrcUser?.image, currentVrcUser?.displayName);
    }
    if (ev.type === 'photo') return _tlListProfHtml(currentVrcUser?.image, currentVrcUser?.displayName);
    return _tlListProfHtml(ev.userImage, ev.userName);
}

function buildPersonalListHtml(events) {
    if (!events.length) {
        return `<div class="empty-msg">${esc(t('timeline.list.empty.personal', 'No timeline events match your filter.'))}</div>`;
    }

    let rows = '';
    events.forEach(ev => {
        const meta  = tlTypeMeta(ev.type);
        const color = getTlEventColor(ev);
        const ei    = jsq(ev.id);
        const { userHtml, detail } = _tlListData(ev);
        const listMeetCount = ev.type === 'meet_again' ? (ev.meetCount || 0) : 0;
        const listTypeLabel = listMeetCount > 0 ? `${meta.label} (${listMeetCount})` : meta.label;

        rows += `<tr class="tl-list-row" data-tlid="${esc(ev.id)}" onclick="openTlDetail('${ei}')">
            <td class="tl-list-dt">${esc(`${tlFormatShortDate(ev.timestamp)} | ${tlFormatTime(ev.timestamp)}`)}</td>
            <td class="tl-list-type"><span class="msi tl-list-icon" style="color:${color}">${meta.icon}</span><span>${esc(listTypeLabel)}</span></td>
            <td style="width:34px;padding:4px 8px;">${_tlPersonalProfHtml(ev)}</td>
            <td class="tl-list-user">${userHtml || tlListNaHtml()}</td>
            <td class="tl-list-detail">${detail || tlListNaHtml()}</td>
        </tr>`;
    });

    return `<div class="tl-list-wrap">
        <table class="tl-list-table">
            <colgroup><col style="width:155px"><col style="width:135px"><col style="width:80px"><col style="width:130px"><col></colgroup>
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
            return { userHtml: esc(currentVrcUser?.displayName || t('timeline.unknown', 'Unknown')), detail: esc(ev.worldName || ev.worldId || t('timeline.unknown_world', 'Unknown World')) };
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
        const color = ev.type === 'friend_gps' ? getFtGpsColor(ev) : (FT_TYPE_COLOR[ev.type] ?? 'var(--tx3)');
        const ei    = jsq(ev.id);
        const detail = _ftListDetail(ev);
        const clickAction = ev.type === 'friend_gps'
            ? `openFtGpsDetail('${ei}')`
            : `openFtDetail('${ei}')`;

        rows += `<tr class="tl-list-row" data-ftid="${esc(ev.id)}" onclick="${clickAction}">
            <td class="tl-list-dt">${esc(`${tlFormatShortDate(ev.timestamp)} | ${tlFormatTime(ev.timestamp)}`)}</td>
            <td class="tl-list-type"><span class="msi tl-list-icon" style="color:${color}">${meta.icon}</span><span>${esc(meta.label)}</span></td>
            <td style="width:34px;padding:4px 8px;">${_tlListProfHtml(ev.friendImage, ev.friendName)}</td>
            <td class="tl-list-user">${esc(ev.friendName || t('timeline.unknown', 'Unknown'))}</td>
            <td class="tl-list-detail">${detail || tlListNaHtml()}</td>
        </tr>`;
    });

    return `<div class="tl-list-wrap">
        <table class="tl-list-table">
            <colgroup><col style="width:155px"><col style="width:135px"><col style="width:80px"><col style="width:130px"><col></colgroup>
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
