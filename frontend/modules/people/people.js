/* === VRChat API === */
function vrcQuickLogin() {
    const u = document.getElementById('vrcQuickUser').value, p = document.getElementById('vrcQuickPass').value;
    if (!u || !p) return;
    document.getElementById('vrcQuickError').textContent = t('profiles.login.connecting', 'Connecting...');
    sendToCS({ action: 'vrcLogin', username: u, password: p });
}

function vrcLogout() {
    sendToCS({ action: 'vrcLogout' });
    currentVrcUser = null;
}

function vrcRefresh() {
    sendToCS({ action: 'vrcRefreshFriends' });
    requestInstanceInfo();
    refreshNotifications();
}

function closeDetailModal(fromNav = false) {
    document.getElementById('modalDetail').style.display = 'none';
    if (!fromNav && typeof navClear === 'function') navClear();
}

function statusDotClass(s) {
    if (!s) return 's-offline';
    const sl = s.toLowerCase();
    if (sl === 'active' || sl === 'online') return 's-active';
    if (sl === 'join me') return 's-join';
    if (sl === 'ask me' || sl === 'look me') return 's-ask';
    if (sl === 'busy' || sl === 'do not disturb') return 's-busy';
    return 's-offline';
}

function statusLabel(s) {
    if (!s) return t('status.offline', 'Offline');
    const sl = s.toLowerCase();
    const m = {
        'active': t('status.online', 'Online'),
        'online': t('status.online', 'Online'),
        'join me': t('status.join_me', 'Join Me'),
        'ask me': t('status.ask_me', 'Ask Me'),
        'look me': t('status.ask_me', 'Ask Me'),
        'busy': t('status.do_not_disturb', 'Do Not Disturb'),
        'do not disturb': t('status.do_not_disturb', 'Do Not Disturb'),
        'offline': t('status.offline', 'Offline')
    };
    return m[sl] || s;
}

function getFriendLocationLabel(presenceType, location) {
    const isPrivate = !location || location === 'private';
    const isOffline = location === 'offline' || presenceType === 'offline';
    if (isOffline) return t('status.offline', 'Offline');
    if (presenceType === 'web') return t('profiles.friends.location.web', 'Web / Mobile');
    if (isPrivate) return t('profiles.friends.location.private', 'Private Instance');
    const { worldId } = parseFriendLocation(location);
    const cached = worldId && (typeof dashWorldCache !== 'undefined') ? dashWorldCache[worldId] : null;
    return cached?.name || t('profiles.friends.location.world', 'In World');
}

function getFriendSectionLabel(section, count) {
    const map = {
        favorites: ['profiles.friends.sections.favorites', 'FAVORITES - {count}'],
        ingame: ['profiles.friends.sections.in_game', 'IN-GAME - {count}'],
        web: ['profiles.friends.sections.web', 'WEB / ACTIVE - {count}'],
        offline: ['profiles.friends.sections.offline', 'OFFLINE - {count}'],
        onlineZero: ['profiles.friends.sections.online_zero', 'ONLINE - {count}']
    };
    const entry = map[section];
    if (!entry) return `${count}`;
    return tf(entry[0], { count }, entry[1]);
}

function getFriendSectionShortLabel(section) {
    const map = {
        favorites: ['profiles.friends.sections_short.favorites', 'FAV'],
        ingame: ['profiles.friends.sections_short.in_game', 'GME'],
        web: ['profiles.friends.sections_short.web', 'WEB'],
        offline: ['profiles.friends.sections_short.offline', 'OFF']
    };
    const entry = map[section];
    return entry ? t(entry[0], entry[1]) : '';
}

function getProfileMutualBadgeLabel(count) {
    return count === 1
        ? tf('profiles.badges.mutual.one', { count }, '{count} Mutual')
        : tf('profiles.badges.mutual.other', { count }, '{count} Mutuals');
}

function getStatusText(status, description) {
    return `${statusLabel(status)}${description ? ' - ' + esc(description) : ''}`;
}

function getFriendStatusLine(friend) {
    if (!friend) {
        return `<span class="vrc-status-dot s-offline" style="width:6px;height:6px;flex-shrink:0;"></span><span class="fav-friend-status-text">${t('status.offline', 'Offline')}</span>`;
    }
    const dotCls = friend.presence === 'web' ? 'vrc-status-ring' : 'vrc-status-dot';
    return `<span class="${dotCls} ${statusDotClass(friend.status)}" style="width:6px;height:6px;flex-shrink:0;"></span><span class="fav-friend-status-text">${getStatusText(friend.status, friend.statusDescription)}</span>`;
}

function getGroupMemberText(memberCount, fallbackToGroup = true) {
    if (memberCount) return tf('worlds.groups.members', { count: memberCount }, '{count} members');
    return fallbackToGroup ? t('groups.common.group', 'Group') : '';
}

// Profile helpers
function formatDuration(totalSec) {
    if (totalSec < 1) return '0s';
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (d > 0) return `${d}d ${h}h ${m}m ${s}s`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function formatLastSeen(apiLastLogin, localLastSeen) {
    let best = null;
    if (apiLastLogin) {
        const d = new Date(apiLastLogin);
        if (!isNaN(d)) best = d;
    }
    if (localLastSeen) {
        const d = new Date(localLastSeen);
        if (!isNaN(d) && (!best || d > best)) best = d;
    }
    if (!best) return '';
    const now = new Date();
    const diff = now - best;
    if (diff < 60000) return t('profiles.last_seen.just_now', 'Just now');
    if (diff < 3600000) return tf('profiles.last_seen.minutes_ago', { count: Math.floor(diff / 60000) }, '{count}m ago');
    if (diff < 86400000) return tf('profiles.last_seen.hours_ago', { count: Math.floor(diff / 3600000) }, '{count}h ago');
    if (diff < 604800000) return tf('profiles.last_seen.days_ago', { count: Math.floor(diff / 86400000) }, '{count}d ago');
    return fmtShortDate(best);
}


// Trust rank from tags (offset by 1 in API naming)
function getTrustRank(tags) {
    if (!tags || !Array.isArray(tags)) return null;
    // Order matters: check highest first
    if (tags.includes('system_trust_legend')) return { label: t('profiles.trust.trusted', 'Trusted User'), color: '#8143E6' };
    if (tags.includes('system_trust_veteran')) return { label: t('profiles.trust.trusted', 'Trusted User'), color: '#8143E6' };
    if (tags.includes('system_trust_trusted')) return { label: t('profiles.trust.known', 'Known User'), color: '#FF7B42' };
    if (tags.includes('system_trust_known'))   return { label: t('profiles.trust.user', 'User'), color: '#2BCF5C' };
    if (tags.includes('system_trust_basic'))   return { label: t('profiles.trust.new', 'New User'), color: '#1778FF' };
    return { label: t('profiles.trust.visitor', 'Visitor'), color: '#CCCCCC' };
}


function getPlatformInfo(hostname) {
    const h = hostname.replace('www.', '');
    if (h.includes('twitter.com') || h.includes('x.com'))          return { key: 'twitter',   label: 'Twitter/X' };
    if (h.includes('instagram.com'))                                 return { key: 'instagram', label: 'Instagram' };
    if (h.includes('tiktok.com'))                                    return { key: 'tiktok',    label: 'TikTok' };
    if (h.includes('youtube.com') || h.includes('youtu.be'))        return { key: 'youtube',   label: 'YouTube' };
    if (h.includes('discord.gg') || h.includes('discord.com'))      return { key: 'discord',   label: 'Discord' };
    if (h.includes('github.com'))                                    return { key: 'github',    label: 'GitHub' };
    if (h.includes('facebook.com') || h.includes('fb.com'))         return { key: 'facebook',  label: 'Facebook' };
    if (h.includes('twitch.tv'))                                     return { key: 'twitch',    label: 'Twitch' };
    if (h.includes('bsky.app'))                                      return { key: 'bluesky',   label: 'Bluesky' };
    if (h.includes('pixiv.net'))                                     return { key: 'pixiv',     label: 'Pixiv' };
    if (h.includes('ko-fi.com'))                                     return { key: 'kofi',      label: 'Ko-fi' };
    if (h.includes('patreon.com'))                                   return { key: 'patreon',   label: 'Patreon' };
    if (h.includes('booth.pm'))                                      return { key: 'booth',     label: 'Booth' };
    if (h.includes('vrchat.com') || h.includes('vrc.group'))        return { key: 'vrchat',    label: 'VRChat' };
    return { key: null, label: h };
}

// Bio link to SVG brand icon and label
function renderBioLink(url) {
    let platformSvg = '';
    let label = t('profiles.common.link', 'Link');
    try {
        const h = new URL(url).hostname;
        const info = getPlatformInfo(h);
        label = info.label;
        if (info.key && PLATFORM_ICONS[info.key]) {
            platformSvg = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="flex-shrink:0"><path d="${PLATFORM_ICONS[info.key].svg}"/></svg>`;
        } else {
            platformSvg = `<span class="msi" style="font-size:14px;">link</span>`;
        }
    } catch {
        label = t('profiles.common.link', 'Link');
        platformSvg = `<span class="msi" style="font-size:14px;">link</span>`;
    }
    const safeUrl = esc(url);
    const safeUrlJs = jsq(url);
    return `<button class="fd-bio-link" onclick="sendToCS({action:'openUrl',url:'${safeUrlJs}'})" title="${safeUrl}">${platformSvg}<span>${esc(label)}</span></button>`;
}



// People Tab: Favorites / Search / Blocked / Muted


function setPeopleFilter(filter) {
    if (_favFriendEditMode) exitFriendEditMode();
    _peopleAllPage = 0; _peopleBlockedPage = 0; _peopleMutedPage = 0;
    peopleFilter = filter;
    document.getElementById('peopleFilterFav').classList.toggle('active', filter === 'favorites');
    document.getElementById('peopleFilterAll').classList.toggle('active', filter === 'all');
    document.getElementById('peopleFilterSearch').classList.toggle('active', filter === 'search');
    document.getElementById('peopleFilterBlocked').classList.toggle('active', filter === 'blocked');
    document.getElementById('peopleFilterMuted').classList.toggle('active', filter === 'muted');
    document.getElementById('peopleFavArea').style.display     = filter === 'favorites' ? '' : 'none';
    document.getElementById('peopleAllArea').style.display     = filter === 'all'       ? '' : 'none';
    document.getElementById('peopleSearchArea').style.display  = filter === 'search'    ? '' : 'none';
    document.getElementById('peopleBlockedArea').style.display = filter === 'blocked'   ? '' : 'none';
    document.getElementById('peopleMutedArea').style.display   = filter === 'muted'     ? '' : 'none';
    ['peopleAllPaginatorBar', 'peopleBlockedPaginatorBar', 'peopleMutedPaginatorBar'].forEach(id => {
        const bar = document.getElementById(id);
        if (bar) bar.innerHTML = '';
    });
    const editBtn = document.getElementById('favFriendEditModeBtn');
    if (editBtn) editBtn.style.display = filter === 'favorites' ? '' : 'none';
    refreshPeopleTab();
}

function refreshPeopleTab() {
    if (peopleFilter === 'favorites') sendToCS({ action: 'vrcGetFavoriteFriends' });
    if (peopleFilter === 'all')       filterAllFriends();
    if (peopleFilter === 'blocked')   sendToCS({ action: 'vrcGetBlocked' });
    if (peopleFilter === 'muted')     sendToCS({ action: 'vrcGetMuted' });
}

function _allFriendCategory(f) {
    const pres = f.presence || '';
    if (!pres || pres === 'offline') return 'offline';
    if (pres === 'web') return 'active';
    return 'ingame';
}

function setAllFriendsStatusFilter(filter) {
    _allFriendsStatusFilter = filter;
    _peopleAllPage = 0;
    ['all', 'ingame', 'active', 'offline'].forEach(k => {
        const btn = document.getElementById('allFriendFilter' + k.charAt(0).toUpperCase() + k.slice(1));
        if (btn) btn.classList.toggle('active', k === filter);
    });
    filterAllFriends();
}

function filterAllFriends() {
    const el = document.getElementById('allFriendsGrid');
    if (!el) return;
    const q = (document.getElementById('allFriendSearchInput')?.value || '').toLowerCase();
    let all = q
        ? vrcFriendsData.filter(f =>
            (f.displayName || '').toLowerCase().includes(q) ||
            (f.username || f.userName || '').toLowerCase().includes(q) ||
            (f.id || '').toLowerCase().includes(q))
        : [...vrcFriendsData];
    if (_allFriendsStatusFilter !== 'all') all = all.filter(f => _allFriendCategory(f) === _allFriendsStatusFilter);
    all = all.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
    const totalPages = Math.ceil(all.length / PEOPLE_PAGE_SIZE) || 1;
    if (_peopleAllPage >= totalPages) _peopleAllPage = totalPages - 1;
    if (_peopleAllPage < 0) _peopleAllPage = 0;
    const page = _peopleAllPage;
    const slice = all.slice(page * PEOPLE_PAGE_SIZE, (page + 1) * PEOPLE_PAGE_SIZE);
    if (!all.length) {
        el.innerHTML = `<div class="empty-msg">${q ? t('profiles.people.no_results', 'No results') : t('profiles.people.no_friends', 'No friends yet')}</div>`;
        setPaginator('peopleAllPaginatorBar', '');
        return;
    }
    el.innerHTML = slice.map(f => {
        const img = f.image ? `<div class="fav-friend-av" style="background-image:url('${cssUrl(f.image)}')"></div>`
                            : `<div class="fav-friend-av fav-friend-av-letter">${esc((f.displayName || '?')[0].toUpperCase())}</div>`;
        const uid = jsq(f.id);
        return `<div class="fav-friend-card" onclick="openFriendDetail('${uid}')">
            ${img}
            <div class="fav-friend-info">
                <div class="fav-friend-name">${esc(f.displayName)}</div>
                <div class="fav-friend-status">${getFriendStatusLine(f)}</div>
            </div>
        </div>`;
    }).join('');
    setPaginator('peopleAllPaginatorBar', buildPaginator(page, totalPages, 'peopleAllGoPage',
        `<span style="font-size:11px;color:var(--tx3);padding:0 8px;">${all.length.toLocaleString()} total</span>`));
}

function peopleAllGoPage(page) {
    if (page < 0) return;
    const q = (document.getElementById('allFriendSearchInput')?.value || '').toLowerCase();
    const all = q
        ? vrcFriendsData.filter(f =>
            (f.displayName || '').toLowerCase().includes(q) ||
            (f.username || f.userName || '').toLowerCase().includes(q) ||
            (f.id || '').toLowerCase().includes(q))
        : [...vrcFriendsData];
    const totalPages = Math.ceil(all.length / PEOPLE_PAGE_SIZE) || 1;
    if (page >= totalPages) return;
    _peopleAllPage = page;
    filterAllFriends();
    document.getElementById('allFriendsGrid')?.scrollTo(0, 0);
}

function filterModList(type) {
    const isBlock = type === 'block';
    renderModList(isBlock ? 'blockedList' : 'mutedList', isBlock ? (blockedData || []) : (mutedData || []), type);
}

function renderModList(containerId, list, actionType) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const isBlock = actionType === 'block';
    const searchId = isBlock ? 'blockedSearch' : 'mutedSearch';
    const paginatorBarId = isBlock ? 'peopleBlockedPaginatorBar' : 'peopleMutedPaginatorBar';
    const goPageFn = isBlock ? 'peopleBlockedGoPage' : 'peopleMutedGoPage';
    const query = (document.getElementById(searchId)?.value || '').toLowerCase().trim();
    const all = (query
        ? (list || []).filter(e =>
            (e.targetDisplayName || '').toLowerCase().includes(query) ||
            (e.targetUserId || '').toLowerCase().includes(query))
        : (list || []));
    const totalPages = Math.ceil(all.length / PEOPLE_PAGE_SIZE) || 1;
    if (isBlock) {
        if (_peopleBlockedPage >= totalPages) _peopleBlockedPage = totalPages - 1;
        if (_peopleBlockedPage < 0) _peopleBlockedPage = 0;
    } else {
        if (_peopleMutedPage >= totalPages) _peopleMutedPage = totalPages - 1;
        if (_peopleMutedPage < 0) _peopleMutedPage = 0;
    }
    const page = isBlock ? _peopleBlockedPage : _peopleMutedPage;
    if (!all.length) {
        el.innerHTML = `<div class="empty-msg">${query ? t('profiles.people.no_results', 'No results') : (isBlock ? t('profiles.people.no_blocked', 'No blocked users') : t('profiles.people.no_muted', 'No muted users'))}</div>`;
        setPaginator(paginatorBarId, '');
        return;
    }
    const slice = all.slice(page * PEOPLE_PAGE_SIZE, (page + 1) * PEOPLE_PAGE_SIZE);
    const btnLabel = isBlock ? t('profiles.people.unblock', 'Unblock') : t('profiles.people.unmute', 'Unmute');
    const btnClass = 'vrcn-button-round vrcn-btn-danger';
    el.innerHTML = slice.map(entry => {
        const uid = jsq(entry.targetUserId || '');
        const displayName = entry.targetDisplayName || entry.targetUserId || '?';
        const friend = vrcFriendsData.find(f => f.id === entry.targetUserId);
        const imageUrl = entry.image || (friend && friend.image) || '';
        const img = imageUrl
            ? `<div class="fav-friend-av" style="background-image:url('${cssUrl(imageUrl)}')"></div>`
            : `<div class="fav-friend-av fav-friend-av-letter">${esc(displayName[0].toUpperCase())}</div>`;
        const statusLine = getFriendStatusLine(friend);
        return `<div class="fav-friend-card" onclick="openFriendDetail('${uid}')">
            ${img}
            <div class="fav-friend-info">
                <div class="fav-friend-name">${esc(displayName)}</div>
                <div class="fav-friend-status">${statusLine}</div>
            </div>
            <button class="${btnClass}" style="margin-left:auto;flex-shrink:0;" onclick="event.stopPropagation();doUnmod('${uid}','${actionType}')">${btnLabel}</button>
        </div>`;
    }).join('');
    setPaginator(paginatorBarId, buildPaginator(page, totalPages, goPageFn,
        `<span style="font-size:11px;color:var(--tx3);padding:0 8px;">${all.length.toLocaleString()} total</span>`));
}

function peopleBlockedGoPage(page) {
    if (page < 0) return;
    const q = (document.getElementById('blockedSearch')?.value || '').toLowerCase().trim();
    const all = q ? (blockedData || []).filter(e =>
        (e.targetDisplayName || '').toLowerCase().includes(q) ||
        (e.targetUserId || '').toLowerCase().includes(q))
        : (blockedData || []);
    const totalPages = Math.ceil(all.length / PEOPLE_PAGE_SIZE) || 1;
    if (page >= totalPages) return;
    _peopleBlockedPage = page;
    renderModList('blockedList', blockedData || [], 'block');
    document.getElementById('blockedList')?.scrollTo(0, 0);
}

function peopleMutedGoPage(page) {
    if (page < 0) return;
    const q = (document.getElementById('mutedSearch')?.value || '').toLowerCase().trim();
    const all = q ? (mutedData || []).filter(e =>
        (e.targetDisplayName || '').toLowerCase().includes(q) ||
        (e.targetUserId || '').toLowerCase().includes(q))
        : (mutedData || []);
    const totalPages = Math.ceil(all.length / PEOPLE_PAGE_SIZE) || 1;
    if (page >= totalPages) return;
    _peopleMutedPage = page;
    renderModList('mutedList', mutedData || [], 'mute');
    document.getElementById('mutedList')?.scrollTo(0, 0);
}

function doUnmod(userId, type) {
    sendToCS({ action: type === 'block' ? 'vrcUnblock' : 'vrcUnmute', userId });
}


// === Favorite Friends (Group-Aware) ===
let favFriendGroups = [];
let favFriendGroupFilter = '';
let _favFriendEditMode = false;
let _favFriendEditSelected = new Set();
let _favFriendRefreshTimer = null;

function _scheduleBgFavFriendRefresh() {
    clearTimeout(_favFriendRefreshTimer);
    _favFriendRefreshTimer = setTimeout(() => sendToCS({ action: 'vrcGetFavoriteFriends' }), 2000);
}

function refreshFavFriends() {
    const btn = document.getElementById('peopleRefreshBtn');
    if (btn) { btn.disabled = true; btn.querySelector('.msi').textContent = 'hourglass_empty'; }
    sendToCS({ action: 'vrcGetFavoriteFriends' });
}

function _ffGroupOptionLabel(g) {
    const count = favFriendsData.filter(f => f.groupName === g.name).length;
    const cap = g.capacity || 150;
    return `${esc(g.displayName || g.name)} ${count}/${cap}`;
}

function renderFavFriends(payload) {
    const refreshBtn = document.getElementById('peopleRefreshBtn');
    if (refreshBtn) { refreshBtn.disabled = false; const ico = refreshBtn.querySelector('.msi'); if (ico) ico.textContent = 'refresh'; }
    const friends = payload?.friends || (Array.isArray(payload) ? payload : []);
    const groups  = payload?.groups  || [];
    favFriendsData  = friends;
    favFriendGroups = groups;
    const sel = document.getElementById('favFriendGroupFilter');
    if (sel) {
        const prev = favFriendGroupFilter;
        sel.innerHTML = `<option value="">${t('friends.favorites.group.all', 'All Favorites')}</option>` +
            groups.map(g => `<option value="${esc(g.name)}">${_ffGroupOptionLabel(g)}</option>`).join('');
        favFriendGroupFilter = groups.some(g => g.name === prev) ? prev : '';
        sel.value = favFriendGroupFilter;
    }
    updateFavFriendGroupHeader();
    filterFavFriends();
    const list = document.getElementById('fdFavGroupList');
    if (list?.dataset.pendingUserId) {
        const uid = list.dataset.pendingUserId;
        delete list.dataset.pendingUserId;
        if (typeof renderFriendFavPicker === 'function') renderFriendFavPicker(uid);
    }
}

function setFavFriendGroup(val) {
    favFriendGroupFilter = val;
    cancelEditFriendGroupName();
    updateFavFriendGroupHeader();
    filterFavFriends();
}

function updateFavFriendGroupHeader() {
    const label = document.getElementById('favFriendGroupLabel');
    const editBtn = document.getElementById('favFriendGroupEditBtn');
    const visEl = document.getElementById('favFriendGroupVisLabel');
    const visDropWrap = document.getElementById('favFriendGroupVisDropWrap');
    const visDrop = document.getElementById('favFriendGroupVisDrop');
    if (!label) return;
    if (!favFriendGroupFilter) {
        label.textContent = t('friends.favorites.group.all', 'All Favorites');
        if (editBtn) editBtn.style.display = 'none';
        if (visEl) visEl.style.display = 'none';
        if (visDropWrap) visDropWrap.style.display = 'none';
    } else {
        const g = favFriendGroups.find(x => x.name === favFriendGroupFilter);
        label.textContent = g ? (g.displayName || g.name) : favFriendGroupFilter;
        if (editBtn) editBtn.style.display = '';
        if (visEl) {
            visEl.textContent = g ? _favGroupVisLabel(g.visibility) : '';
            visEl.style.display = (_favFriendEditMode || !g) ? 'none' : '';
        }
        if (visDropWrap) {
            const showDrop = _favFriendEditMode && !!g;
            visDropWrap.style.display = showDrop ? '' : 'none';
            if (showDrop && visDrop) visDrop.value = g.visibility || 'private';
        }
    }
}

function saveFavFriendGroupVisibility(visibility) {
    const g = favFriendGroups.find(x => x.name === favFriendGroupFilter);
    if (!g) return;
    sendToCS({ action: 'vrcUpdateFavoriteFriendGroup', groupName: g.name, displayName: g.displayName || g.name, visibility });
}

function startEditFriendGroupName() {
    const g = favFriendGroups.find(x => x.name === favFriendGroupFilter);
    if (!g) return;
    const input = document.getElementById('favFriendGroupNameInput');
    if (input) input.value = g.displayName || g.name;
    document.getElementById('favFriendGroupHeader').style.display = 'none';
    const row = document.getElementById('favFriendGroupRenameRow');
    if (row) row.style.display = 'flex';
    if (input) input.focus();
}

function cancelEditFriendGroupName() {
    document.getElementById('favFriendGroupHeader').style.display = 'flex';
    const row = document.getElementById('favFriendGroupRenameRow');
    if (row) row.style.display = 'none';
    const saveBtn = document.querySelector('#favFriendGroupRenameRow .vrcn-btn-primary');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
}

function saveFriendGroupName() {
    const g = favFriendGroups.find(x => x.name === favFriendGroupFilter);
    if (!g) return;
    const input = document.getElementById('favFriendGroupNameInput');
    const newName = (input?.value || '').trim();
    if (!newName) return;
    const saveBtn = document.querySelector('#favFriendGroupRenameRow .vrcn-btn-primary');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
    sendToCS({ action: 'vrcUpdateFavoriteFriendGroup', groupName: g.name, displayName: newName });
}

function onFriendFavoriteGroupUpdated(data) {
    if (!data.ok) { cancelEditFriendGroupName(); return; }
    const g = favFriendGroups.find(x => x.name === data.groupName);
    if (g) {
        if (data.displayName) g.displayName = data.displayName;
        if (data.visibility)  g.visibility  = data.visibility;
    }
    const sel = document.getElementById('favFriendGroupFilter');
    if (sel) {
        const opt = [...sel.options].find(o => o.value === data.groupName);
        if (opt && g) opt.textContent = _ffGroupOptionLabel(g);
    }
    cancelEditFriendGroupName();
    updateFavFriendGroupHeader();
    filterFavFriends();
}

function renderFavFriendCard(f) {
    const uid = jsq(f.id);
    const img = f.image ? `<div class="fav-friend-av" style="background-image:url('${cssUrl(f.image)}')"></div>`
                        : `<div class="fav-friend-av fav-friend-av-letter">${esc((f.displayName || '?')[0].toUpperCase())}</div>`;
    const statusLine = getFriendStatusLine(f);
    if (_favFriendEditMode) {
        const isSel = _favFriendEditSelected.has(f.id);
        const checkIcon = isSel
            ? `<span class="msi" style="font-size:22px;color:var(--accent);">check_circle</span>`
            : `<span class="msi" style="font-size:22px;color:rgba(255,255,255,0.7);">radio_button_unchecked</span>`;
        return `<div class="fav-friend-card" data-uid="${esc(f.id)}" onclick="toggleFriendEditSelect('${uid}',this)" style="user-select:none;">
            ${img}
            <div class="fav-friend-info">
                <div class="fav-friend-name">${esc(f.displayName)}</div>
                <div class="fav-friend-status">${statusLine}</div>
            </div>
            <div style="margin-left:auto;flex-shrink:0;">${checkIcon}</div>
        </div>`;
    }
    return `<div class="fav-friend-card" onclick="openFriendDetail('${uid}')">
        ${img}
        <div class="fav-friend-info">
            <div class="fav-friend-name">${esc(f.displayName)}</div>
            <div class="fav-friend-status">${statusLine}</div>
        </div>
    </div>`;
}

function filterFavFriends() {
    const el = document.getElementById('favFriendsGrid');
    if (!el) return;
    const q = (document.getElementById('favFriendSearchInput')?.value || '').toLowerCase();
    const favMap = new Map(favFriendsData.map(f => [f.favoriteId, f]));
    let friends = vrcFriendsData.filter(f => favMap.has(f.id));
    if (favFriendGroupFilter) friends = friends.filter(f => favMap.get(f.id)?.groupName === favFriendGroupFilter);
    if (q) friends = friends.filter(f => (f.displayName || '').toLowerCase().includes(q));
    if (!friends.length) {
        el.innerHTML = `<div class="empty-msg">${q || favFriendGroupFilter ? t('friends.favorites.no_match', 'No favorites match your filter') : t('friends.favorites.empty', 'No favorite friends yet')}</div>`;
        if (_favFriendEditMode) updateFriendEditBar();
        return;
    }
    if (!favFriendGroupFilter && favFriendGroups.length > 1) {
        let html = '', first = true;
        favFriendGroups.forEach(g => {
            const gFriends = friends.filter(f => favMap.get(f.id)?.groupName === g.name);
            if (!gFriends.length) return;
            const cap = g.capacity || 150;
            const visLabel = _favGroupVisLabel(g.visibility);
            const visHtml = g.visibility && !_favFriendEditMode
                ? `<span style="font-size:11px;color:var(--tx3);margin-left:4px;">${esc(visLabel)}</span>` : '';
            html += `<div class="fav-group-header${first ? ' fav-group-header-first' : ''}">
                <span class="topbar-title">${esc(g.displayName || g.name)}</span>
                <span class="fav-group-count">${gFriends.length}/${cap}</span>
                ${visHtml}
            </div>`;
            html += gFriends.map(f => renderFavFriendCard(f)).join('');
            first = false;
        });
        el.innerHTML = html || `<div class="empty-msg">${t('friends.favorites.empty', 'No favorite friends yet')}</div>`;
    } else {
        el.innerHTML = friends.map(f => renderFavFriendCard(f)).join('');
    }
    if (_favFriendEditMode) updateFriendEditBar();
}

// === Friend Edit Mode ===

function toggleFriendEditMode() {
    if (_favFriendEditMode) { exitFriendEditMode(); return; }
    _favFriendEditMode = true;
    _favFriendEditSelected = new Set();
    const btn = document.getElementById('favFriendEditModeBtn');
    if (btn) { btn.innerHTML = `<span class="msi" style="font-size:16px;">check</span> <span>${t('friends.edit.done', 'Done')}</span>`; btn.classList.add('active'); }
    const filterBtns = document.getElementById('peopleFilterBtns');
    if (filterBtns) filterBtns.style.display = 'none';
    const bar = document.getElementById('favFriendEditBar');
    if (bar) bar.style.display = 'flex';
    filterFavFriends();
    updateFavFriendGroupHeader();
}

function exitFriendEditMode() {
    _favFriendEditMode = false;
    _favFriendEditSelected = new Set();
    const btn = document.getElementById('favFriendEditModeBtn');
    if (btn) { btn.innerHTML = `<span class="msi" style="font-size:16px;">edit</span> <span>${t('friends.edit.button', 'Edit')}</span>`; btn.classList.remove('active'); }
    const filterBtns = document.getElementById('peopleFilterBtns');
    if (filterBtns) filterBtns.style.display = '';
    const bar = document.getElementById('favFriendEditBar');
    if (bar) bar.style.display = 'none';
    const picker = document.getElementById('favFriendEditMovePicker');
    if (picker) { picker.style.display = 'none'; picker.innerHTML = ''; }
    filterFavFriends();
    updateFavFriendGroupHeader();
}

function toggleFriendEditSelect(id, el) {
    if (_favFriendEditSelected.has(id)) {
        _favFriendEditSelected.delete(id);
        const msi = el?.querySelector('[style*="margin-left:auto"] .msi');
        if (msi) { msi.textContent = 'radio_button_unchecked'; msi.style.color = 'rgba(255,255,255,0.7)'; }
    } else {
        _favFriendEditSelected.add(id);
        const msi = el?.querySelector('[style*="margin-left:auto"] .msi');
        if (msi) { msi.textContent = 'check_circle'; msi.style.color = 'var(--accent)'; }
    }
    updateFriendEditBar();
}

function friendEditSelectAll() {
    const q = (document.getElementById('favFriendSearchInput')?.value || '').toLowerCase();
    const favMap = new Map(favFriendsData.map(f => [f.favoriteId, f]));
    let friends = vrcFriendsData.filter(f => favMap.has(f.id));
    if (favFriendGroupFilter) friends = friends.filter(f => favMap.get(f.id)?.groupName === favFriendGroupFilter);
    if (q) friends = friends.filter(f => (f.displayName || '').toLowerCase().includes(q));
    const allSel = friends.length > 0 && friends.every(f => _favFriendEditSelected.has(f.id));
    if (allSel) {
        friends.forEach(f => _favFriendEditSelected.delete(f.id));
    } else {
        friends.forEach(f => _favFriendEditSelected.add(f.id));
    }
    filterFavFriends();
}

function updateFriendEditBar() {
    const count = _favFriendEditSelected.size;
    const countEl = document.getElementById('favFriendEditCount');
    if (countEl) countEl.textContent = t('friends.edit.selected', '{count} selected').replace('{count}', count);
    const selectAllBtn = document.getElementById('favFriendEditSelectAllBtn');
    if (selectAllBtn) {
        const q = (document.getElementById('favFriendSearchInput')?.value || '').toLowerCase();
        const favMap = new Map(favFriendsData.map(f => [f.favoriteId, f]));
        let friends = vrcFriendsData.filter(f => favMap.has(f.id));
        if (favFriendGroupFilter) friends = friends.filter(f => favMap.get(f.id)?.groupName === favFriendGroupFilter);
        if (q) friends = friends.filter(f => (f.displayName || '').toLowerCase().includes(q));
        const allSel = friends.length > 0 && friends.every(f => _favFriendEditSelected.has(f.id));
        selectAllBtn.textContent = allSel ? t('friends.edit.deselect_all', 'Deselect All') : t('friends.edit.select_all', 'Select All');
    }
    document.querySelectorAll('#favFriendEditBar .wd-edit-action').forEach(b => b.disabled = count === 0);
}

function friendEditShowMoveMenu(btn) {
    if (_favFriendEditSelected.size === 0) return;
    const picker = document.getElementById('favFriendEditMovePicker');
    if (!picker) return;
    if (picker.style.display === 'block') { picker.style.display = 'none'; picker.innerHTML = ''; return; }
    picker.innerHTML = favFriendGroups.map(g => {
        const count = favFriendsData.filter(f => f.groupName === g.name).length;
        const gn = jsq(g.name);
        return `<div class="vn-select-option" onclick="friendEditMoveSelected('${gn}')">
            <span class="msi" style="font-size:14px;flex-shrink:0;">folder</span>
            <span style="flex:1;">${esc(g.displayName || g.name)}</span>
            <span style="font-size:10px;color:var(--tx3);flex-shrink:0;">${count}</span>
        </div>`;
    }).join('');
    picker.style.display = 'block';
    setTimeout(() => {
        const close = (e) => {
            if (!picker.contains(e.target) && e.target !== btn) {
                picker.style.display = 'none';
                picker.innerHTML = '';
                document.removeEventListener('click', close);
            }
        };
        document.addEventListener('click', close);
    }, 0);
}

function friendEditMoveSelected(groupName) {
    if (_favFriendEditSelected.size === 0) return;
    const picker = document.getElementById('favFriendEditMovePicker');
    if (picker) { picker.style.display = 'none'; picker.innerHTML = ''; }
    const toMove = [..._favFriendEditSelected];
    toMove.forEach(userId => {
        const entry = favFriendsData.find(f => f.favoriteId === userId);
        if (entry && entry.groupName !== groupName) {
            sendToCS({ action: 'vrcAddFavoriteFriendToGroup', userId, groupName, oldFvrtId: entry.fvrtId });
        }
    });
    exitFriendEditMode();
}

function friendEditRemoveSelected() {
    if (_favFriendEditSelected.size === 0) return;
    const toRemove = [..._favFriendEditSelected];
    toRemove.forEach(userId => {
        const entry = favFriendsData.find(f => f.favoriteId === userId);
        if (entry) sendToCS({ action: 'vrcRemoveFavoriteFriend', userId, fvrtId: entry.fvrtId });
    });
    exitFriendEditMode();
}

