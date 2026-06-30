/* === Avatars Tab === */
let _avFavRefreshTimer = null;
let _avEditMode = false;
let _avEditSelected = new Set();
let _avIcuBuffer = [];
let _avIcuBufferCursor = 0;
let _avIcuFetchHasMore = false;
function avatarEmptyMessage(key, fallback) {
    return `<div class="empty-msg">${t(key, fallback)}</div>`;
}

function avatarCountText(count) {
    return tf(count === 1 ? 'avatars.count.one' : 'avatars.count.other', { count }, count === 1 ? '{count} avatar' : '{count} avatars');
}

function avatarResultCountText(count) {
    return tf(count === 1 ? 'avatars.results.one' : 'avatars.results.other', { count }, count === 1 ? '{count} result' : '{count} results');
}

function avatarStatusBadge(isPublic) {
    return isPublic
        ? `<span class="vrcn-badge accent"><span class="msi" style="font-size:10px;">public</span> ${t('avatars.labels.public', 'Public')}</span>`
        : `<span class="vrcn-badge private"><span class="msi" style="font-size:10px;">lock</span> ${t('avatars.labels.private', 'Private')}</span>`;
}

function avatarCurrentBadge(isActive) {
    return isActive ? `<span class="vrcn-badge current">${t('avatars.labels.current', 'Current')}</span>` : '';
}

function avatarFavoriteActionLabel(isFavorite) {
    return t(isFavorite ? 'avatars.actions.unfavorite' : 'avatars.actions.favorite', isFavorite ? 'Unfavorite' : 'Favorite');
}

function avatarDetailFieldLabel(field) {
    const labels = {
        name: t('avatars.detail.fields.name', 'Avatar name'),
        desc: t('avatars.detail.sections.description', 'Description'),
        visibility: t('avatars.detail.sections.visibility', 'Visibility'),
        tags: t('avatars.detail.sections.tags', 'Tags'),
    };
    return labels[field] || t('avatars.detail.fields.avatar', 'Avatar');
}

function rerenderAvatarTranslations() {
    const renameSaveBtn = document.querySelector('#favAvatarGroupRenameRow .vrcn-btn-primary');
    if (renameSaveBtn && !renameSaveBtn.disabled) renameSaveBtn.textContent = t('common.save', 'Save');
    if (avatarFilter === 'favorites') {
        updateFavAvatarGroupHeader();
        filterFavAvatars();
    } else if (avatarFilter === 'search') {
        if (avatarSearchResults.length) renderSearchGrid();
        else {
            const grid = document.getElementById('avatarSearchGrid');
            if (grid) grid.innerHTML = avatarEmptyMessage('avatars.search.empty_prompt', 'Search for public avatars');
        }
    } else if (avatarFilter === 'rose') {
        if (roseDbLoaded) filterRoseDb();
    } else {
        filterOwnAvatars();
    }
    if (_avFavPickerAvatarId) renderAvFavPickerList(_avFavPickerAvatarId);
}

document.documentElement.addEventListener('languagechange', () => {
    rerenderAvatarTranslations();
});

function _scheduleAvFavRefresh() {
    clearTimeout(_avFavRefreshTimer);
    _avFavRefreshTimer = setTimeout(() => sendToCS({ action: 'vrcGetAvatars', filter: 'favorites' }), 2000);
}

function refreshAvatars() {
    if (avatarFilter === 'search') {
        if (avatarSearchQuery) doAvatarSearch();
        return;
    }
    if (avatarFilter === 'favorites') {
        refreshFavAvatars();
        return;
    }
    if (!currentVrcUser) {
        document.getElementById('avatarGrid').innerHTML = avatarEmptyMessage('avatars.empty.login_prompt', 'Login to VRChat to see your avatars');
        return;
    }
    document.getElementById('avatarGrid').innerHTML = sk('avatar', 6);
    sendToCS({ action: 'vrcGetAvatars', filter: 'own' });
}

function refreshFavAvatars() {
    const btn = document.getElementById('favAvatarsRefreshBtn');
    if (btn) { btn.disabled = true; btn.querySelector('.msi').textContent = 'hourglass_empty'; }
    sendToCS({ action: 'vrcGetAvatars', filter: 'favorites' });
}

function setAvatarFilter(filter) {
    if (_avEditMode) exitAvEditMode();
    avatarFilter = filter;
    document.querySelectorAll('#avatarFilterBtns .sub-tab-btn').forEach(b => b.classList.remove('active'));
    const btnMap = { own: 'avatarFilterOwn', favorites: 'avatarFilterFav', recent: 'avatarFilterRecent', rose: 'avatarFilterRose', search: 'avatarFilterSearch' };
    const btn = document.getElementById(btnMap[filter]);
    if (btn) btn.classList.add('active');

    const ownArea    = document.getElementById('avatarOwnArea');
    const favArea    = document.getElementById('avatarFavArea');
    const recentArea = document.getElementById('avatarRecentArea');
    const roseArea   = document.getElementById('avatarRoseArea');
    const searchArea = document.getElementById('avatarSearchArea');

    if (ownArea)    ownArea.style.display    = filter === 'own'       ? '' : 'none';
    if (favArea)    favArea.style.display    = filter === 'favorites' ? '' : 'none';
    if (recentArea) recentArea.style.display = filter === 'recent'    ? '' : 'none';
    if (roseArea)   roseArea.style.display   = filter === 'rose'      ? '' : 'none';
    if (searchArea) searchArea.style.display = filter === 'search'    ? '' : 'none';

    const _dbDrop = document.getElementById('avatarSearchDbDrop');
    if (_dbDrop) {
        const _dbWrap = _dbDrop._vnSelect ? _dbDrop.parentNode : _dbDrop;
        _dbWrap.style.display = filter === 'search' ? '' : 'none';
    }

    document.getElementById('avatarCount').textContent = '';
    const _sc = document.getElementById('avatarSearchCount'); if (_sc) _sc.textContent = '';

    const editBtn = document.getElementById('avatarEditModeBtn');
    if (editBtn) editBtn.style.display = filter === 'favorites' ? '' : 'none';
    if (filter === 'own') {
        const inp = document.getElementById('ownAvatarSearchInput');
        if (inp) inp.value = '';
        refreshAvatars();
    } else if (filter === 'favorites') {
        if (favAvatarsData.length === 0) sendToCS({ action: 'vrcGetAvatars', filter: 'favorites' });
        else { updateFavAvatarGroupHeader(); filterFavAvatars(); }
    } else if (filter === 'recent') {
        const inp = document.getElementById('recentAvatarSearchInput');
        if (inp) inp.value = '';
        sendToCS({ action: 'vrcGetRecentAvatars' });
    } else if (filter === 'rose') {
        loadRoseDatabase();
    } else {
        document.getElementById('avatarSearchGrid').innerHTML = avatarEmptyMessage('avatars.search.empty_prompt', 'Search for public avatars');
        setTimeout(() => document.getElementById('avatarSearchInput')?.focus(), 50);
    }
}

/* === Own Avatars === */
function filterOwnAvatars() {
    const q = (document.getElementById('ownAvatarSearchInput')?.value || '').toLowerCase();
    const el = document.getElementById('avatarGrid');
    if (!el) return;
    if (!currentVrcUser) {
        el.innerHTML = avatarEmptyMessage('avatars.empty.login_prompt', 'Login to VRChat to see your avatars');
        return;
    }
    const filtered = (q
        ? avatarsData.filter(a => (a.name || '').toLowerCase().includes(q) || (a.authorName || '').toLowerCase().includes(q))
        : avatarsData).filter(_avPassesFilters);
    document.getElementById('avatarCount').textContent = filtered.length ? avatarCountText(filtered.length) : '';
    el.innerHTML = filtered.length
        ? filtered.map(a => renderAvatarCard(a, 'own')).join('')
        : avatarEmptyMessage(q ? 'avatars.empty.no_match' : 'avatars.empty.none', q ? 'No avatars match your filter' : 'No avatars found');
}

function renderAvatarGrid() {
    const el = document.getElementById('avatarGrid');
    if (!el) return;
    if (!currentVrcUser) {
        el.innerHTML = avatarEmptyMessage('avatars.empty.login_prompt', 'Login to VRChat to see your avatars');
        return;
    }
    // Reset search then apply filter
    const inp = document.getElementById('ownAvatarSearchInput');
    if (inp) inp.value = '';
    filterOwnAvatars();
}

function renderSearchGrid() {
    const el = document.getElementById('avatarSearchGrid');
    if (!el) return;
    if (avatarSearchResults.length === 0) {
        el.innerHTML = avatarEmptyMessage('avatars.search.no_results', 'No results found');
        return;
    }
    const results = avatarSearchResults.filter(_avPassesFilters);
    document.getElementById('avatarCount').textContent = avatarResultCountText(results.length);
    if (results.length === 0) {
        el.innerHTML = avatarEmptyMessage('avatars.empty.no_match', 'No avatars match your filter');
        return;
    }
    let html = results.map(a => renderAvatarCard(a, 'search')).join('');
    if (avatarSearchHasMore) {
        html += `<div style="grid-column:1/-1;text-align:center;margin-top:6px;">
            <button class="vrcn-button" onclick="doAvatarSearch(true)">${t('avatars.search.load_more', 'Load More')}</button>
        </div>`;
    }
    el.innerHTML = html;
    // Check if avatars still exist on VRChat
    _checkAvatarsExist(avatarSearchResults.map(a => a.id).filter(Boolean));
}

const _deletedAvatarCache = new Set();

function _checkAvatarsExist(ids) {
    if (!ids.length) return;
    // Mark already-cached deleted avatars immediately
    const cached = ids.filter(id => _deletedAvatarCache.has(id));
    if (cached.length) _markDeletedAvatars(cached);
    // Only check uncached IDs via API
    const unchecked = ids.filter(id => !_deletedAvatarCache.has(id));
    if (unchecked.length) sendToCS({ action: 'vrcCheckAvatars', ids: unchecked });
}

function _markDeletedAvatars(deletedIds) {
    deletedIds.forEach(id => {
        _deletedAvatarCache.add(id);
        document.querySelectorAll(`.av-card[onclick*="'${id}'"]`).forEach(card => {
            if (card.dataset.deleted) return;
            card.dataset.deleted = '1';
            card.style.pointerEvents = 'none';
            card.style.opacity = '0.5';
            const thumb = card.querySelector('.cc-bg');
            if (thumb) {
                thumb.style.filter = 'grayscale(1) brightness(0.4)';
                const badge = document.createElement('span');
                badge.className = 'vrcn-badge';
                badge.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2;background:rgba(0,0,0,.75);color:var(--err);font-size:11px;';
                badge.innerHTML = `<span class="msi" style="font-size:10px;">delete</span> ${t('avatars.labels.deleted', 'Deleted')}`;
                thumb.appendChild(badge);
            }
        });
        document.querySelectorAll(`.vrcn-mini-content[data-avatar-id="${id}"]`).forEach(card => {
            if (card.dataset.deleted) return;
            card.dataset.deleted = '1';
            card.style.pointerEvents = 'none';
            card.style.opacity = '0.5';
            const thumb = card.querySelector('.vrcn-mini-content-thumb');
            if (thumb) thumb.style.filter = 'grayscale(1) brightness(0.4)';
            const badges = card.querySelector('.vrcn-mini-content-badges');
            if (badges) {
                const badge = document.createElement('span');
                badge.className = 'vrcn-badge';
                badge.style.cssText = 'background:rgba(0,0,0,.75);color:var(--err);';
                badge.innerHTML = `<span class="msi" style="font-size:10px;">delete</span> ${t('avatars.labels.deleted', 'Deleted')}`;
                badges.prepend(badge);
            }
        });
    });
}

function _avPlatformBadges(a) {
    let hasPC, hasQuest;
    if (a.compatibility && a.compatibility.length > 0) {
        // avtrdb: ["pc", "android", "ios"] — avtr.icu: ["standalonewindows", "android"]
        hasPC    = a.compatibility.includes('pc') || a.compatibility.includes('standalonewindows');
        hasQuest = a.compatibility.includes('android');
    } else {
        // Own / favorite avatars: use unityPackages, exclude auto-generated impostors
        const real = (a.unityPackages || []).filter(p => p.variant !== 'impostor');
        hasPC    = real.some(p => p.platform === 'standalonewindows');
        hasQuest = real.some(p => p.platform === 'android');
    }
    if (!hasPC && !hasQuest) return '';
    return `<div style="display:flex;gap:3px;">${hasPC ? '<span class="vrcn-badge platform-pc">PC</span>' : ''}${hasQuest ? '<span class="vrcn-badge platform-quest">Quest</span>' : ''}</div>`;
}

/* === Publish / Platform filters (shared across avatar sub-tabs) === */
let avatarPublishFilter  = 'all';
let avatarPlatformFilter = 'all';

function _avPlatformInfo(a) {
    let hasPC = false, hasQuest = false;
    if (a.compatibility && a.compatibility.length > 0) {
        hasPC    = a.compatibility.includes('pc') || a.compatibility.includes('standalonewindows');
        hasQuest = a.compatibility.includes('android');
    } else if (a.unityPackages && a.unityPackages.length > 0) {
        const real = a.unityPackages.filter(p => p.variant !== 'impostor');
        hasPC    = real.some(p => p.platform === 'standalonewindows');
        hasQuest = real.some(p => p.platform === 'android');
    }
    return { hasPC, hasQuest };
}

// An avatar passes when the data is unknown (lenient) or it matches the active filter.
function _avPassesFilters(a) {
    if (avatarPublishFilter !== 'all' && a.releaseStatus) {
        const isPub = a.releaseStatus === 'public';
        if (avatarPublishFilter === 'public'  && !isPub) return false;
        if (avatarPublishFilter === 'private' &&  isPub) return false;
    }
    if (avatarPlatformFilter !== 'all') {
        const { hasPC, hasQuest } = _avPlatformInfo(a);
        if (hasPC || hasQuest) {
            if (avatarPlatformFilter === 'pc'    && !hasPC)    return false;
            if (avatarPlatformFilter === 'quest' && !hasQuest) return false;
        }
    }
    return true;
}

function setAvPublishFilter(v) {
    avatarPublishFilter = v;
    document.querySelectorAll('select.av-publish-filter').forEach(s => { if (s.value !== v) { s.value = v; s._vnRefresh && s._vnRefresh(); } });
    _rerenderAvatarFilter();
}
function setAvPlatformFilter(v) {
    avatarPlatformFilter = v;
    document.querySelectorAll('select.av-platform-filter').forEach(s => { if (s.value !== v) { s.value = v; s._vnRefresh && s._vnRefresh(); } });
    _rerenderAvatarFilter();
}
function _rerenderAvatarFilter() {
    if      (avatarFilter === 'own')       filterOwnAvatars();
    else if (avatarFilter === 'favorites') filterFavAvatars();
    else if (avatarFilter === 'recent')    filterRecentAvatars();
    else if (avatarFilter === 'search')    renderSearchGrid();
    else if (avatarFilter === 'rose')      filterRoseDb();
}

function _avDbBadge(context, a) {
    if (context !== 'search') return '';
    const srcs = a.sources || [avatarSearchDb];
    const hasDb  = srcs.includes('avtrdb');
    const hasIcu = srcs.includes('avtricu');
    if (!hasDb && !hasIcu) return '';
    const badges = [
        hasDb  ? '<span class="vrcn-badge db-avtrdb">Avtrdb</span>'   : '',
        hasIcu ? '<span class="vrcn-badge db-avtricu">Avtr.icu</span>' : '',
    ].join('');
    return `<div class="cc-badge-db" style="display:flex;gap:3px;">${badges}</div>`;
}

function renderAvatarCard(a, context) {
    const thumb = a.thumbnailImageUrl || a.imageUrl || '';
    const isActive = a.id === currentAvatarId;
    const isPublic = context === 'search' || a.releaseStatus === 'public';
    const statusBadge = avatarStatusBadge(isPublic);
    const activeBadge = avatarCurrentBadge(isActive);
    const aid = jsq(a.id || '');
    const thumbStyle = thumb ? `background-image:url('${cssUrl(thumb)}')` : '';
    return `<div class="vrcn-content-card av-card${isActive ? ' av-active' : ''}" onclick="selectAvatar('${aid}')">
        <div class="cc-bg" style="${thumbStyle}"></div>
        <div class="cc-scrim"></div>
        <div class="cc-badges-top">${activeBadge}${statusBadge}${_avPlatformBadges(a)}</div>
        ${_avDbBadge(context, a)}
        <div class="cc-content">
            <div class="cc-name">${esc(a.name || t('avatars.labels.unnamed', 'Unnamed'))}</div>
            <div class="cc-meta">${esc(a.authorName || '')}</div>
        </div>
    </div>`;
}

/* === Recently Used Avatars === */
let _recentAvatarsData = [];
function renderRecentAvatars(avatars) {
    _recentAvatarsData = Array.isArray(avatars) ? avatars : [];
    filterRecentAvatars();
}

function filterRecentAvatars() {
    const el = document.getElementById('avatarRecentGrid');
    if (!el) return;
    const q = (document.getElementById('recentAvatarSearchInput')?.value || '').toLowerCase();
    const list = (q
        ? _recentAvatarsData.filter(a => (a.name || '').toLowerCase().includes(q) || (a.authorName || '').toLowerCase().includes(q))
        : _recentAvatarsData).filter(_avPassesFilters);
    el.innerHTML = list.length
        ? list.map(a => renderAvatarCard(a, 'recent')).join('')
        : avatarEmptyMessage(q ? 'avatars.empty.no_match' : 'avatars.recent.empty', q ? 'No avatars match your filter' : 'No recently used avatars');
}

function selectAvatar(avatarId) {
    if (!avatarId || avatarId === currentAvatarId) return;
    document.querySelectorAll('.av-card').forEach(c => {
        c.style.pointerEvents = 'none';
        c.style.opacity = '0.6';
    });
    sendToCS({ action: 'vrcSelectAvatar', avatarId: avatarId });
}

/* === Search === */
function setAvatarSearchDb(db) {
    avatarSearchDb = db;
    avatarSearchPage = 0;
    avatarSearchResults = [];
    avatarSearchQuery = '';
    avatarSearchHasMore = false;
    _avIcuBuffer = [];
    _avIcuBufferCursor = 0;
    _avIcuFetchHasMore = false;
    const grid = document.getElementById('avatarSearchGrid');
    if (grid) grid.innerHTML = avatarEmptyMessage('avatars.search.empty_prompt', 'Search for public avatars');
    document.getElementById('avatarCount').textContent = '';
}

function doAvatarSearch(loadMore) {
    const q = document.getElementById('avatarSearchInput').value.trim();
    if (!q) return;
    if (!loadMore) {
        avatarSearchPage = 0;
        avatarSearchResults = [];
        avatarSearchQuery = q;
        avatarSearchHasMore = false;
        _avIcuBuffer = [];
        _avIcuBufferCursor = 0;
        _avIcuFetchHasMore = false;
        document.getElementById('avatarSearchGrid').innerHTML = sk('avatar', 6);
    } else if (avatarSearchDb === 'avtricu' && _avIcuBufferCursor < _avIcuBuffer.length) {
        const slice = _avIcuBuffer.slice(_avIcuBufferCursor, _avIcuBufferCursor + 20);
        _avIcuBufferCursor += slice.length;
        avatarSearchResults = [...avatarSearchResults, ...slice];
        avatarSearchHasMore = _avIcuBufferCursor < _avIcuBuffer.length || _avIcuFetchHasMore;
        renderSearchGrid();
        return;
    } else {
        avatarSearchPage++;
    }
    sendToCS({ action: 'vrcSearchAvatars', query: avatarSearchQuery, page: avatarSearchPage, db: avatarSearchDb });
}

/* === Favorites: group dropdown + header === */
function _avGroupOptionLabel(g) {
    const count    = favAvatarsData.filter(a => a.favoriteGroup === g.name).length;
    const cap      = g.capacity || 25;
    const marker   = (!isLocalFavGroup(g) && g.name !== 'avatars1') ? ' [VRC+]' : '';
    return `${esc(g.displayName || g.name)} ${count}/${cap}${marker}`;
}

function renderFavAvatars(payload) {
    const refreshBtn = document.getElementById('favAvatarsRefreshBtn');
    if (refreshBtn) { refreshBtn.disabled = false; const ico = refreshBtn.querySelector('.msi'); if (ico) ico.textContent = 'refresh'; }

    const avatars = payload?.avatars || [];
    const groups  = payload?.groups  || [];
    favAvatarsData  = avatars;
    favAvatarGroups = groups;

    const sel = document.getElementById('favAvatarGroupFilter');
    if (sel) {
        const prev = favAvatarGroupFilter;
        sel.innerHTML = `<option value="">${t('avatars.favorites.group.all', 'All Favorites')}</option>` +
            groups.map(g => `<option value="${esc(g.name)}">${_avGroupOptionLabel(g)}</option>`).join('');
        const stillValid = groups.some(g => g.name === prev);
        favAvatarGroupFilter = stillValid ? prev : '';
        sel.value = favAvatarGroupFilter;
        if (sel._vnRefresh) sel._vnRefresh();
    }
    updateFavAvatarGroupHeader();
    filterFavAvatars();
}

function setFavAvatarGroup(val) {
    favAvatarGroupFilter = val;
    cancelEditAvatarGroupName();
    updateFavAvatarGroupHeader();
    filterFavAvatars();
}

function updateFavAvatarGroupHeader() {
    const label   = document.getElementById('favAvatarGroupLabel');
    const editBtn = document.getElementById('favAvatarGroupEditBtn');
    const delBtn  = document.getElementById('favAvatarGroupDeleteBtn');
    const badge   = document.getElementById('favAvatarGroupVrcPlusBadge');
    const localBadge = document.getElementById('favAvatarGroupLocalBadge');
    if (!label) return;
    if (!favAvatarGroupFilter) {
        label.textContent = t('avatars.favorites.group.all', 'All Favorites');
        if (editBtn) editBtn.style.display = 'none';
        if (delBtn) delBtn.style.display = 'none';
        if (badge) badge.style.display = 'none';
        if (localBadge) localBadge.style.display = 'none';
    } else {
        const g = favAvatarGroups.find(x => x.name === favAvatarGroupFilter);
        const isLocal = isLocalFavGroup(g);
        label.textContent = g ? (g.displayName || g.name) : favAvatarGroupFilter;
        if (editBtn) editBtn.style.display = '';
        if (delBtn) delBtn.style.display = isLocal ? '' : 'none';
        if (badge) badge.style.display = (g && !isLocal && g.name !== 'avatars1') ? '' : 'none';
        if (localBadge) localBadge.style.display = isLocal ? '' : 'none';
    }
}

function startEditAvatarGroupName() {
    const g = favAvatarGroups.find(x => x.name === favAvatarGroupFilter);
    if (!g) return;
    const input = document.getElementById('favAvatarGroupNameInput');
    if (input) input.value = g.displayName || g.name;
    document.getElementById('favAvatarGroupHeader').style.display = 'none';
    const row = document.getElementById('favAvatarGroupRenameRow');
    if (row) row.style.display = 'flex';
    if (input) input.focus();
}

function cancelEditAvatarGroupName() {
    document.getElementById('favAvatarGroupHeader').style.display = 'flex';
    const row = document.getElementById('favAvatarGroupRenameRow');
    if (row) row.style.display = 'none';
    const saveBtn = document.querySelector('#favAvatarGroupRenameRow .vrcn-btn-primary');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = t('common.save', 'Save'); }
}

function saveAvatarGroupName() {
    const g = favAvatarGroups.find(x => x.name === favAvatarGroupFilter);
    if (!g) return;
    const input = document.getElementById('favAvatarGroupNameInput');
    const newName = (input?.value || '').trim();
    if (!newName) return;
    const saveBtn = document.querySelector('#favAvatarGroupRenameRow .vrcn-btn-primary');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = t('common.saving', 'Saving...'); }
    sendToCS({ action: 'vrcUpdateFavoriteGroup', groupType: g.type, groupName: g.name, displayName: newName });
}

function _renderFavAvCard(a) {
    const thumb = a.thumbnailImageUrl || a.imageUrl || '';
    const thumbStyle = thumb ? `background-image:url('${cssUrl(thumb)}')` : '';
    const isActive = a.id === currentAvatarId;
    const aid = jsq(a.id || '');
    const activeBadge = avatarCurrentBadge(isActive);
    const isPublic = a.releaseStatus === 'public';
    const statusBadge = avatarStatusBadge(isPublic);
    if (_avEditMode) {
        const isSelected = _avEditSelected.has(a.id);
        const checkIcon = isSelected
            ? `<span class="msi" style="font-size:22px;color:var(--accent);">check_circle</span>`
            : `<span class="msi" style="font-size:22px;color:rgba(255,255,255,0.7);">radio_button_unchecked</span>`;
        return `<div class="vrcn-content-card av-card${isActive ? ' av-active' : ''}" data-avid="${esc(a.id)}" onclick="toggleAvEditSelect('${aid}',this)" style="user-select:none;">
            <div class="cc-bg" style="${thumbStyle}"></div>
            <div class="cc-scrim"></div>
            <div class="cc-badges-top">${activeBadge}${statusBadge}${_avPlatformBadges(a)}</div>
            <div class="wd-edit-check">${checkIcon}</div>
            <div class="cc-content">
                <div class="cc-name">${esc(a.name || t('avatars.labels.unnamed', 'Unnamed'))}</div>
                <div class="cc-meta">${esc(a.authorName || '')}</div>
            </div>
            ${isSelected ? '<div class="wd-edit-sel-border"></div>' : ''}
        </div>`;
    }
    return `<div class="vrcn-content-card av-card${isActive ? ' av-active' : ''}" onclick="selectAvatar('${aid}')">
        <div class="cc-bg" style="${thumbStyle}"></div>
        <div class="cc-scrim"></div>
        <div class="cc-badges-top">${activeBadge}${statusBadge}${_avPlatformBadges(a)}</div>
        <div class="cc-content">
            <div class="cc-name">${esc(a.name || t('avatars.labels.unnamed', 'Unnamed'))}</div>
            <div class="cc-meta">${esc(a.authorName || '')}</div>
        </div>
    </div>`;
}

function filterFavAvatars() {
    const q = (document.getElementById('favAvatarSearchInput')?.value || '').toLowerCase();
    let filtered = favAvatarsData;
    if (favAvatarGroupFilter) filtered = filtered.filter(a => a.favoriteGroup === favAvatarGroupFilter);
    if (q) filtered = filtered.filter(a => (a.name || '').toLowerCase().includes(q) || (a.authorName || '').toLowerCase().includes(q));
    filtered = filtered.filter(_avPassesFilters);
    const el = document.getElementById('favAvatarsGrid');
    if (!el) return;
    if (!filtered.length) {
        el.innerHTML = avatarEmptyMessage(
            q || favAvatarGroupFilter ? 'avatars.favorites.no_match' : 'avatars.favorites.empty',
            q || favAvatarGroupFilter ? 'No favorites match your filter' : 'No favorite avatars found'
        );
        if (_avEditMode) updateAvEditBar();
        return;
    }
    if (!favAvatarGroupFilter && favAvatarGroups.length > 1) {
        let html = '';
        let first = true;
        favAvatarGroups.forEach(g => {
            const groupAvatars = filtered.filter(a => a.favoriteGroup === g.name);
            if (!groupAvatars.length) return;
            const cap = g.capacity || 25;
            html += `<div class="fav-group-header${first ? ' fav-group-header-first' : ''}">
                <span class="topbar-title">${esc(g.displayName || g.name)}</span>
                ${favGroupBadge(g)}
                <span class="fav-group-count">${groupAvatars.length}/${cap}</span>
            </div>`;
            html += groupAvatars.map(a => _renderFavAvCard(a)).join('');
            first = false;
        });
        el.innerHTML = html;
    } else {
        el.innerHTML = filtered.map(a => _renderFavAvCard(a)).join('');
    }
    if (_avEditMode) updateAvEditBar();
}

/* === Avatar Edit Mode === */
function toggleAvEditMode() {
    if (_avEditMode) { exitAvEditMode(); return; }
    _avEditMode = true;
    _avEditSelected = new Set();
    const btn = document.getElementById('avatarEditModeBtn');
    if (btn) { btn.innerHTML = `<span class="msi" style="font-size:16px;">check</span> <span>${t('avatars.edit.done', 'Done')}</span>`; btn.classList.add('active'); }
    const filterBtns = document.getElementById('avatarFilterBtns');
    if (filterBtns) filterBtns.style.display = 'none';
    const bar = document.getElementById('avatarEditBar');
    if (bar) bar.style.display = 'flex';
    filterFavAvatars();
}

function exitAvEditMode() {
    _avEditMode = false;
    _avEditSelected = new Set();
    const btn = document.getElementById('avatarEditModeBtn');
    if (btn) { btn.innerHTML = `<span class="msi" style="font-size:16px;">edit</span> <span>${t('avatars.edit.button', 'Edit')}</span>`; btn.classList.remove('active'); }
    const filterBtns = document.getElementById('avatarFilterBtns');
    if (filterBtns) filterBtns.style.display = '';
    const bar = document.getElementById('avatarEditBar');
    if (bar) bar.style.display = 'none';
    const picker = document.getElementById('avatarEditMovePicker');
    if (picker) { picker.style.display = 'none'; picker.innerHTML = ''; }
    avatarCancelCreateLocalGroup();
    filterFavAvatars();
}

/* === Local Groups (Avatars) === */
function avatarLocalGroupCount() {
    return (typeof favAvatarGroups !== 'undefined' ? favAvatarGroups : []).filter(isLocalFavGroup).length;
}

function avatarShowCreateLocalGroup(btn) {
    const panel = document.getElementById('avatarCreateLocalPanel');
    if (!panel) return;
    if (panel.style.display === 'block') { avatarCancelCreateLocalGroup(); return; }
    if (avatarLocalGroupCount() >= 100) { showToast(false, localFavErrorText('group_limit')); return; }
    panel.style.display = 'block';
    const input = document.getElementById('avatarCreateLocalInput');
    if (input) { input.value = ''; input.focus(); }
    setTimeout(() => {
        const close = (e) => {
            if (!panel.contains(e.target) && !(btn && btn.contains(e.target))) {
                panel.style.display = 'none';
                document.removeEventListener('click', close);
            }
        };
        document.addEventListener('click', close);
    }, 0);
}

function avatarCancelCreateLocalGroup() {
    const panel = document.getElementById('avatarCreateLocalPanel');
    if (panel) panel.style.display = 'none';
}

function avatarSaveLocalGroup() {
    const input = document.getElementById('avatarCreateLocalInput');
    const name = (input?.value || '').trim();
    if (!name) { showToast(false, localFavErrorText('empty_name')); return; }
    sendToCS({ action: 'vrcCreateLocalGroup', kind: 'avatar', displayName: name });
    avatarCancelCreateLocalGroup();
}

function deleteCurrentLocalAvatarGroup(btn) {
    const g = favAvatarGroups.find(x => x.name === favAvatarGroupFilter);
    if (!g || !isLocalFavGroup(g)) return;
    if (btn && btn.dataset.confirm !== '1') {
        btn.dataset.confirm = '1';
        btn.classList.add('myp-edit-btn-danger');
        btn.title = t('favorites.delete_local_group_confirm', 'Click again to delete');
        clearTimeout(btn._confirmTimer);
        btn._confirmTimer = setTimeout(() => {
            btn.dataset.confirm = '0';
            btn.classList.remove('myp-edit-btn-danger');
            btn.title = t('favorites.delete_local_group', 'Delete local group');
        }, 3000);
        return;
    }
    if (btn) { btn.dataset.confirm = '0'; btn.classList.remove('myp-edit-btn-danger'); clearTimeout(btn._confirmTimer); }
    sendToCS({ action: 'vrcDeleteLocalGroup', kind: 'avatar', groupName: g.name });
    favAvatarGroupFilter = '';
}

function toggleAvEditSelect(id, el) {
    if (_avEditSelected.has(id)) {
        _avEditSelected.delete(id);
        const chk = el?.querySelector('.wd-edit-check .msi');
        if (chk) { chk.textContent = 'radio_button_unchecked'; chk.style.color = 'rgba(255,255,255,0.7)'; }
        el?.querySelector('.wd-edit-sel-border')?.remove();
    } else {
        _avEditSelected.add(id);
        const chk = el?.querySelector('.wd-edit-check .msi');
        if (chk) { chk.textContent = 'check_circle'; chk.style.color = 'var(--accent)'; }
        if (el && !el.querySelector('.wd-edit-sel-border')) {
            el.insertAdjacentHTML('beforeend', '<div class="wd-edit-sel-border"></div>');
        }
    }
    updateAvEditBar();
}

function avEditSelectAll() {
    const q = (document.getElementById('favAvatarSearchInput')?.value || '').toLowerCase();
    let filtered = favAvatarsData;
    if (favAvatarGroupFilter) filtered = filtered.filter(a => a.favoriteGroup === favAvatarGroupFilter);
    if (q) filtered = filtered.filter(a => (a.name || '').toLowerCase().includes(q) || (a.authorName || '').toLowerCase().includes(q));
    filtered = filtered.filter(_avPassesFilters);
    const allSelected = filtered.length > 0 && filtered.every(a => _avEditSelected.has(a.id));
    if (allSelected) filtered.forEach(a => _avEditSelected.delete(a.id));
    else filtered.forEach(a => _avEditSelected.add(a.id));
    filterFavAvatars();
}

function updateAvEditBar() {
    const count = _avEditSelected.size;
    const countEl = document.getElementById('avatarEditCount');
    if (countEl) countEl.textContent = tf('avatars.edit.selected', { count }, '{count} selected');
    const selectAllBtn = document.getElementById('avatarEditSelectAllBtn');
    if (selectAllBtn) {
        const q = (document.getElementById('favAvatarSearchInput')?.value || '').toLowerCase();
        let filtered = favAvatarsData;
        if (favAvatarGroupFilter) filtered = filtered.filter(a => a.favoriteGroup === favAvatarGroupFilter);
        if (q) filtered = filtered.filter(a => (a.name || '').toLowerCase().includes(q) || (a.authorName || '').toLowerCase().includes(q));
        filtered = filtered.filter(_avPassesFilters);
        const allSel = filtered.length > 0 && filtered.every(a => _avEditSelected.has(a.id));
        selectAllBtn.textContent = allSel ? t('avatars.edit.deselect_all', 'Deselect All') : t('avatars.edit.select_all', 'Select All');
    }
    document.querySelectorAll('.av-edit-action').forEach(b => b.disabled = count === 0);
}

function avEditShowMoveMenu(btn) {
    if (_avEditSelected.size === 0) return;
    const picker = document.getElementById('avatarEditMovePicker');
    if (!picker) return;
    if (picker.style.display === 'block') { picker.style.display = 'none'; picker.innerHTML = ''; return; }
    const groups = (typeof favAvatarGroups !== 'undefined') ? favAvatarGroups : [];
    picker.innerHTML = groups.map(g => {
        const count = favAvatarsData.filter(fw => fw.favoriteGroup === g.name).length;
        const gn = jsq(g.name), gt = jsq(g.type);
        return `<div class="vn-select-option" onclick="avEditMoveSelected('${gn}','${gt}')">
            <span class="msi" style="font-size:14px;flex-shrink:0;">folder</span>
            <span style="flex:1;">${esc(g.displayName || g.name)}</span>
            ${favGroupBadge(g)}
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

function avEditMoveSelected(groupName, groupType) {
    if (_avEditSelected.size === 0) return;
    const picker = document.getElementById('avatarEditMovePicker');
    if (picker) { picker.style.display = 'none'; picker.innerHTML = ''; }
    const toMove = [..._avEditSelected];
    toMove.forEach(avatarId => {
        const entry = favAvatarsData.find(a => a.id === avatarId);
        if (entry && entry.favoriteGroup !== groupName) {
            sendToCS({ action: 'vrcAddAvatarFavorite', avatarId, groupName, groupType, oldFvrtId: entry.favoriteId || '' });
        }
    });
    exitAvEditMode();
}

function avEditRemoveSelected() {
    if (_avEditSelected.size === 0) return;
    const toRemove = [..._avEditSelected];
    toRemove.forEach(avatarId => {
        const entry = favAvatarsData.find(a => a.id === avatarId);
        if (entry) sendToCS({ action: 'vrcRemoveAvatarFavorite', avatarId, fvrtId: entry.favoriteId });
    });
    exitAvEditMode();
}

/* === Favorite Picker Popup === */
let _avFavPickerAvatarId = null;

function openAvFavPicker(avatarId, btnEl) {
    const entry = favAvatarsData.find(f => f.id === avatarId);
    if (entry) {
        removeAvatarFavorite(avatarId, entry.favoriteId);
        return;
    }

    _avFavPickerAvatarId = avatarId;
    const panel = document.getElementById('avFavPickerPanel');
    if (!panel) return;

    renderAvFavPickerList(avatarId);
    panel.style.display = '';

    // Position near button
    const rect = btnEl.getBoundingClientRect();
    let top = rect.bottom + 4;
    let left = rect.left;
    if (left + 280 > window.innerWidth) left = window.innerWidth - 290;
    if (top + 300 > window.innerHeight) top = rect.top - 300;
    panel.style.top  = top  + 'px';
    panel.style.left = left + 'px';

    // If groups not yet loaded, request them
    if (favAvatarGroups.length === 0) {
        document.getElementById('avFavPickerList').innerHTML = `<div style="font-size:11px;color:var(--tx3);padding:8px 0;">${t('avatars.favorites.loading_groups', 'Loading groups...')}</div>`;
        sendToCS({ action: 'vrcGetAvatarFavGroups' });
    }

    setTimeout(() => document.addEventListener('click', _avPickerOutside, { once: true }), 0);
}

function _avPickerOutside(e) {
    const panel = document.getElementById('avFavPickerPanel');
    if (panel && panel.contains(e.target)) {
        document.addEventListener('click', _avPickerOutside, { once: true });
    } else {
        closeAvFavPicker();
    }
}

function closeAvFavPicker() {
    const panel = document.getElementById('avFavPickerPanel');
    if (panel) panel.style.display = 'none';
    _avFavPickerAvatarId = null;
}

function renderAvFavPickerList(avatarId) {
    const list = document.getElementById('avFavPickerList');
    if (!list) return;
    if (favAvatarGroups.length === 0) return;

    const currentEntry = favAvatarsData.find(f => f.id === avatarId);
    const currentGroup = currentEntry?.favoriteGroup || '';

    list.innerHTML = favAvatarGroups.map(g => {
        const count = favAvatarsData.filter(f => f.favoriteGroup === g.name).length;
        const isCurrent = g.name === currentGroup;
        const vrcBadge = favGroupBadge(g);
        const check = isCurrent
            ? `<span class="msi" style="color:var(--accent);font-size:18px;flex-shrink:0;">check_circle</span>`
            : '';
        const gn = jsq(g.name), gt = jsq(g.type), aid = jsq(avatarId);
        const oldFvrt = isCurrent ? jsq(currentEntry?.favoriteId || '') : '';
        return `<div class="fd-group-card ci-group-card${isCurrent ? ' ci-group-selected' : ''}"
            onclick="addAvatarToFavGroup('${aid}','${gn}','${gt}','${oldFvrt}',this)" style="cursor:pointer;">
            <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
                    <span style="font-size:12px;font-weight:600;color:var(--tx1);">${esc(g.displayName || g.name)}</span>
                    ${vrcBadge}
                </div>
                <div style="font-size:10px;color:var(--tx3);margin-top:1px;">${tf('avatars.favorites.group_count', { count, capacity: g.capacity || 25 }, '{count}/{capacity} slots')}</div>
            </div>
            ${check}
        </div>`;
    }).join('');
}

function addAvatarToFavGroup(avatarId, groupName, groupType, oldFvrtId, rowEl) {
    document.querySelectorAll('#avFavPickerList .ci-group-card').forEach(c => {
        c.classList.remove('ci-group-selected');
        const chk = c.querySelector('.msi');
        if (chk && chk.textContent === 'check_circle') chk.remove();
    });
    rowEl.classList.add('ci-group-selected');
    rowEl.insertAdjacentHTML('beforeend', '<span class="msi" style="color:var(--accent);font-size:18px;flex-shrink:0;">check_circle</span>');
    sendToCS({ action: 'vrcAddAvatarFavorite', avatarId, groupName, groupType, oldFvrtId });
}

function removeAvatarFavorite(avatarId, fvrtId) {
    closeAvFavPicker();
    sendToCS({ action: 'vrcRemoveAvatarFavorite', avatarId, fvrtId });
}

function onAvatarFavoriteResult(data) {
    if (data.ok) {
        const existing = favAvatarsData.find(f => f.id === data.avatarId);
        if (existing) {
            existing.favoriteGroup = data.groupName;
            existing.favoriteId   = data.newFvrtId;
        } else {
            // Find avatar info from own or search data
            const src = avatarsData.find(a => a.id === data.avatarId) || avatarSearchResults.find(a => a.id === data.avatarId) || {};
            favAvatarsData.push({
                id:                data.avatarId,
                favoriteGroup:     data.groupName,
                favoriteId:        data.newFvrtId,
                name:              src.name              || '',
                thumbnailImageUrl: src.thumbnailImageUrl || src.imageUrl || '',
                imageUrl:          src.imageUrl          || '',
                authorName:        src.authorName        || '',
                releaseStatus:     src.releaseStatus     || 'public',
            });
        }
        const group = favAvatarGroups.find(g => g.name === data.groupName);
        const groupLabel = group?.displayName || data.groupName;
        const entry = favAvatarsData.find(f => f.id === data.avatarId);
        const avatarName = entry?.name || '';
        showToast(true, avatarName
            ? tf('avatars.favorites.toast.saved_to_group.named', { avatar: avatarName, group: groupLabel }, '"{avatar}" saved to {group}')
            : tf('avatars.favorites.toast.saved_to_group.unnamed', { group: groupLabel }, 'Saved to {group}'));
        closeAvFavPicker();
        // Re-render star on current card
        if (avatarFilter === 'own') renderAvatarGrid();
        else if (avatarFilter === 'search') renderSearchGrid();
        else if (avatarFilter === 'favorites') filterFavAvatars();
        else if (avatarFilter === 'rose') filterRoseDb();
        _scheduleAvFavRefresh();
    } else {
        if (data.error) showToast(false, localFavErrorText(data.error));
        const list = document.getElementById('avFavPickerList');
        if (list) {
            list.innerHTML = `<div style="font-size:11px;color:var(--err,#e55);padding:6px 0;">${t('avatars.favorites.failed_prefix', 'Failed:')} ${esc(data.error || t('avatars.favorites.try_again', 'Try again'))}</div>`;
            setTimeout(() => { if (_avFavPickerAvatarId) renderAvFavPickerList(_avFavPickerAvatarId); }, 1800);
        }
    }
}

function onAvatarUnfavoriteResult(data) {
    if (data.ok) {
        const removed = favAvatarsData.find(f => f.id === data.avatarId);
        const avatarName = removed?.name || '';
        showToast(true, avatarName
            ? tf('avatars.favorites.toast.removed.named', { avatar: avatarName }, '"{avatar}" removed from favorites')
            : t('avatars.favorites.toast.removed', 'Removed from favorites'));
        favAvatarsData = favAvatarsData.filter(f => f.id !== data.avatarId);
        if (avatarFilter === 'favorites') filterFavAvatars();
        else if (avatarFilter === 'own') renderAvatarGrid();
        else if (avatarFilter === 'search') renderSearchGrid();
        else if (avatarFilter === 'rose') filterRoseDb();
        _scheduleAvFavRefresh();
    }
}

function onAvatarFavGroupsLoaded(groups) {
    favAvatarGroups = groups;
    // Update group dropdown if favorites tab is open
    const sel = document.getElementById('favAvatarGroupFilter');
    if (sel) {
        sel.innerHTML = `<option value="">${t('avatars.favorites.group.all', 'All Favorites')}</option>` +
            groups.map(g => `<option value="${esc(g.name)}">${_avGroupOptionLabel(g)}</option>`).join('');
        sel.value = favAvatarGroupFilter;
        if (sel._vnRefresh) sel._vnRefresh();
    }
    // Re-render picker if open
    if (_avFavPickerAvatarId) renderAvFavPickerList(_avFavPickerAvatarId);
}

// Handles rename result (shared with worlds via vrcFavoriteGroupUpdated)
function onAvatarFavoriteGroupUpdated(data) {
    if (!data.ok) { cancelEditAvatarGroupName(); return; }
    const g = favAvatarGroups.find(x => x.name === data.groupName);
    if (g) g.displayName = data.displayName;
    const sel = document.getElementById('favAvatarGroupFilter');
    if (sel) {
        const opt = [...sel.options].find(o => o.value === data.groupName);
        if (opt && g) opt.textContent = _avGroupOptionLabel(g);
        if (sel._vnRefresh) sel._vnRefresh();
    }
    cancelEditAvatarGroupName();
    updateFavAvatarGroupHeader();
}

/* === Rose Database === */
let roseDbData   = [];
let roseDbLoaded = false;

function loadRoseDatabase(forceRefresh) {
    if (roseDbLoaded && !forceRefresh) { filterRoseDb(); return; }
    const grid = document.getElementById('roseDbGrid');
    const btn  = document.getElementById('roseRefreshBtn');
    if (grid) grid.innerHTML = sk('avatar', 6);
    if (btn)  { btn.disabled = true; btn.querySelector('.msi').textContent = 'hourglass_empty'; }

    fetch('https://gist.githubusercontent.com/TheZiver/bb99f9facb8d14fd607dbb79e9a99d83/raw')
        .then(r => r.json())
        .then(data => {
            roseDbData   = data.community_avatars || [];
            roseDbLoaded = true;
            sendToCS({ action: 'vrcCacheAvatarBatch', avatars: roseDbData.map(a => ({ id: a.avatar_id, imageUrl: a.avatar_image_url })) });
            filterRoseDb();
        })
        .catch(() => {
            if (grid) grid.innerHTML = avatarEmptyMessage('avatars.rose.failed', 'Failed to load Rose Database. Check your connection.');
        })
        .finally(() => {
            if (btn) { btn.disabled = false; btn.querySelector('.msi').textContent = 'refresh'; }
        });
}

function filterRoseDb() {
    const q    = (document.getElementById('roseSearchInput')?.value || '').toLowerCase();
    const list = q
        ? roseDbData.filter(a =>
            (a.avatar_name || '').toLowerCase().includes(q) ||
            (a.author      || '').toLowerCase().includes(q) ||
            (a.tags        || []).some(t => t.toLowerCase().includes(q)))
        : roseDbData;
    renderRoseGrid(list);
    document.getElementById('avatarCount').textContent = list.length ? avatarCountText(list.length) : '';
}

function renderRoseGrid(list) {
    const grid = document.getElementById('roseDbGrid');
    if (!grid) return;
    if (!list || list.length === 0) {
        grid.innerHTML = avatarEmptyMessage('avatars.empty.none', 'No avatars found');
        return;
    }
    grid.innerHTML = list.map(a => renderRoseAvatarCard(a)).join('');
}

const ROSE_TAG_ORDER = ['FISH', 'ROSE_FISH', 'ARCADE_FISH', 'VAPOR_FISH', 'CHEESE_FISH', 'COSMIC_FISH'];

const ROSE_TAG_STYLES = {
    FISH:        { label: 'Fish',   bg: 'rgba(255,255,255,0.15)', color: '#ffffff',              border: '1px solid rgba(255,255,255,0.45)' },
    ROSE_FISH:   { label: 'Rose',   bg: 'rgba(220,38,38,0.20)',   color: '#f87171',              border: '1px solid rgba(220,38,38,0.50)'   },
    ARCADE_FISH: { label: 'Arcade', bg: 'linear-gradient(90deg,rgba(236,72,153,0.25),rgba(6,182,212,0.25))', color: '#e879f9', border: '1px solid rgba(167,139,250,0.45)' },
    VAPOR_FISH:  { label: 'Vapor',  bg: 'rgba(6,182,212,0.20)',   color: '#22d3ee',              border: '1px solid rgba(6,182,212,0.50)'   },
    CHEESE_FISH: { label: 'Cheese', bg: 'rgba(234,179,8,0.20)',   color: '#facc15',              border: '1px solid rgba(234,179,8,0.50)'   },
    COSMIC_FISH: { label: 'Cosmic', bg: 'rgba(59,130,246,0.20)',  color: '#60a5fa',              border: '1px solid rgba(59,130,246,0.50)'  },
};

function _roseTagBadge(rawTag) {
    const key = rawTag.toUpperCase().replace(/\s+/g, '_');
    const s   = ROSE_TAG_STYLES[key];
    if (!s) return `<span class="vrcn-badge" style="background:var(--bg2);color:var(--tx2);border:1px solid var(--brd-lt);">${esc(rawTag)}</span>`;
    const bg = s.bg.startsWith('linear') ? s.bg : s.bg;
    return `<span class="vrcn-badge" style="background:${bg};color:${s.color};border:${s.border};">${esc(s.label)}</span>`;
}

function onRoseDbBatchCached(mapping) {
    roseDbData.forEach(a => {
        const url = mapping[a.avatar_id];
        if (url) a._cachedThumb = url;
    });
    if (avatarFilter === 'rose') filterRoseDb();
}

function renderRoseAvatarCard(a) {
    const thumb  = a._cachedThumb || a.avatar_image_url || '';
    const aid    = jsq(a.avatar_id || '');
    const isFav  = favAvatarsData.some(f => f.id === a.avatar_id);
    const thumbStyle = thumb ? `background-image:url('${cssUrl(thumb)}')` : '';

    // Sort tags in defined order, unknown tags appended at end
    const rawTags  = (a.tags || []);
    const sorted   = [
        ...ROSE_TAG_ORDER.filter(k => rawTags.some(t => t.toUpperCase().replace(/\s+/g,'_') === k)),
        ...rawTags.filter(t => !ROSE_TAG_ORDER.includes(t.toUpperCase().replace(/\s+/g,'_'))),
    ];
    const tags = sorted.map(t => _roseTagBadge(t)).join('');

    return `<div class="vrcn-content-card av-card" onclick="selectAvatar('${aid}')">
        <div class="cc-bg" style="${thumbStyle}"></div>
        <div class="cc-scrim"></div>
        <div class="cc-badges-top">${avatarStatusBadge(true)}</div>
        <div class="cc-content">
            <div class="cc-name">${esc(a.avatar_name || t('avatars.labels.unnamed', 'Unnamed'))}</div>
            <div class="cc-bottom-row">
                <div class="cc-meta">${esc(a.author || '')}</div>
                ${tags ? `<div class="cc-tags">${tags}</div>` : ''}
            </div>
        </div>
    </div>`;
}

