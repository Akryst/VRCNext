/* === World Modal === */
const _worldBannerImgs = {};
function _getWorldBannerImg(worldId, src) {
    if (!worldId || !src) return null;
    if (!_worldBannerImgs[worldId]) {
        const img = new Image();
        img.src = src;
        img.onerror = () => { if (img.parentElement) img.parentElement.style.display = 'none'; };
        _worldBannerImgs[worldId] = { img, src };
    } else if (_worldBannerImgs[worldId].src !== src) {
        _worldBannerImgs[worldId].img.src = src;
        _worldBannerImgs[worldId].src = src;
    }
    return _worldBannerImgs[worldId].img;
}
let _wdLiveTimer = null;
let _wdCurrentId = '';
let _wdCurrentTab = 'info';

/* === Detail Modals (shared) === */
function openWorldSearchDetail(id) {
    if (typeof navSetCurrent === 'function') navSetCurrent('worldSearch', id);
    _wdCurrentId = id;
    const el = document.getElementById('detailModalContent');
    el.innerHTML = sk('content-modal');
    document.getElementById('modalDetail').style.display = 'flex';
    sendToCS({ action: 'vrcGetWorldDetail', worldId: id });
}

function refreshWorldInstances() {
    if (!_wdCurrentId) return;
    const btn = document.getElementById('wdInstancesRefreshBtn');
    if (btn) btn.classList.add('spinning');
    sendToCS({ action: 'vrcGetWorldDetail', worldId: _wdCurrentId });
}

function renderWorldSearchDetail(w) {
    if (typeof navUpdateLabel === 'function') navUpdateLabel(w.name || '');
    // Stop refresh spinner if running
    const refreshBtn = document.getElementById('wdInstancesRefreshBtn');
    if (refreshBtn) refreshBtn.classList.remove('spinning');
    // Cache full world data so favorites grid can render it immediately after favoriting
    if (w.id) worldInfoCache[w.id] = w;
    const el = document.getElementById('detailModalContent');
    const thumb = w.imageUrl || w.thumbnailImageUrl || '';
    const desc = w.description || '';
    const wid = w.id || '';
    const authorTags = (w.tags || []).filter(t => t.startsWith('author_tag_')).map(t => t.replace('author_tag_', ''));
    const systemTags = (w.tags || []).filter(t => !t.startsWith('author_tag_') && !t.startsWith('system_') && !t.startsWith('admin_'));

    // Tags HTML
    let tagsHtml = '';
    if (authorTags.length || systemTags.length) {
        const allTags = [...authorTags, ...systemTags].slice(0, 12);
        tagsHtml = `<div class="fd-lang-tags">${allTags.map(t => `<span class="vrcn-badge">${esc(t)}</span>`).join('')}</div>`;
    }

    // Build friend-by-location map for this world (for friend badges + inferred instances)
    const worldFriendsByLoc = {};
    if (typeof vrcFriendsData !== 'undefined') {
        vrcFriendsData.forEach(f => {
            const { worldId: fwid } = parseFriendLocation(f.location);
            if (fwid === w.id) {
                if (!worldFriendsByLoc[f.location]) worldFriendsByLoc[f.location] = [];
                worldFriendsByLoc[f.location].push(f);
            }
        });
    }

    // Merge API instances with friend-inferred non-public instances
    // Strip nonce for comparison: API instances don't have ~nonce(...) but friend locations do
    const stripNonce = l => (l || '').replace(/~nonce\([^)]*\)/g, '');
    const allInstances = [...(w.instances || [])];
    Object.keys(worldFriendsByLoc).forEach(loc => {
        const existing = allInstances.find(i => stripNonce(i.location) === stripNonce(loc));
        if (existing) {
            // Update location to friend's key so friend badges + sort work correctly
            existing.location = loc;
        } else {
            const { instanceType: iType } = parseFriendLocation(loc);
            const regionMatch = loc.match(/region\(([^)]+)\)/);
            allInstances.push({
                instanceId: loc.includes(':') ? loc.split(':')[1] : loc,
                users: worldFriendsByLoc[loc].length,
                type: iType,
                region: regionMatch ? regionMatch[1] : 'us',
                location: loc
            });
        }
    });

    // Instances with friends first
    allInstances.sort((a, b) => ((worldFriendsByLoc[b.location] || []).length) - ((worldFriendsByLoc[a.location] || []).length));

    let instancesHtml = '';
    if (allInstances.length > 0) {
        instancesHtml = `<div class="wd-instances-list" style="max-height:370px;overflow-y:auto;">${allInstances.map(inst => renderInstanceItem({
            thumb:        thumb,
            instanceType: inst.type,
            instanceId:   inst.instanceId || '',
            owner:        inst.ownerName  || '',
            ownerGroup:   inst.ownerGroup || '',
            ownerId:      inst.ownerId    || '',
            region:       getWorldRegionLabel(inst.region),
            userCount:    inst.users,
            capacity:     w.capacity || 0,
            friends:      worldFriendsByLoc[inst.location] || [],
            location:     inst.location,
        })).join('')}</div>`;
    } else {
        instancesHtml = `<div style="font-size:11px;color:var(--tx3);padding:14px 0;">${t('worlds.instances.none_active', 'No active instances')}</div>`;
    }

    const isFavWorld = favWorldsData.some(fw => fw.id === w.id);
    const favBtnLabel = isFavWorld
        ? `<span class="msi" style="font-size:16px;">star</span>${t('worlds.favorites.unfavorite', 'Unfavorite')}`
        : `<span class="msi" style="font-size:16px;">star_outline</span>${t('worlds.favorites.favorite', 'Favorite')}`;

    const isOwnWorld = currentVrcUser && w.authorId === currentVrcUser.id;
    _wdCurrentWorldId = wid;
    _ciWorld = { id: w.id, name: w.name, thumb };

    const tabsHtml = `<div class="fd-tabs" style="margin-bottom:14px;">
        <button class="fd-tab active" onclick="switchWdTab('info',this)">${t('worlds.tabs.info', 'Info')}</button>
        <button class="fd-tab" onclick="switchWdTab('instances',this)">${tf('worlds.tabs.instances', { count: allInstances.length }, 'Instances ({count})')}</button>
        ${isOwnWorld ? `<button class="fd-tab" onclick="switchWdTab('insights',this)">${t('worlds.tabs.insights', 'Insights')}</button>` : ''}
    </div>`;

    el.innerHTML = `${thumb ? `<div class="fd-banner" id="wd-banner-slot"><div class="fd-banner-fade"></div><button class="btn-notif" style="position:absolute;top:8px;right:8px;z-index:3;" title="${esc(t('common.share','Share'))}" onclick="navigator.clipboard.writeText('https://vrchat.com/home/world/${esc(wid)}').then(()=>showToast(true,t('common.link_copied','Link copied!')))"><span class="msi" style="font-size:20px;">share</span></button></div>` : ''}
        <div class="fd-content${thumb ? ' fd-has-banner' : ''}" style="padding:20px 0;">
        <h2 style="margin:0 0 4px;color:var(--tx0);font-size:18px;">${esc(w.name)}</h2>
        <div style="font-size:12px;color:var(--tx3);margin-bottom:12px;">${t('worlds.meta.by', 'by')} ${w.authorId ? `<span onclick="navOpenModal('friend','${jsq(w.authorId)}','${jsq(w.authorName || '')}')" style="display:inline-flex;align-items:center;padding:1px 8px;border-radius:20px;background:var(--bg-hover);font-size:11px;font-weight:600;color:var(--tx1);cursor:pointer;line-height:1.8;">${esc(w.authorName)}</span>` : esc(w.authorName)}</div>
        ${tabsHtml}
        <div id="wdTabInfo">
        <div class="fd-badges-row">
            <span class="vrcn-badge"><span class="msi" style="font-size:11px;">person</span> ${w.occupants} ${t('worlds.meta.active', 'Active')}</span>
            <span class="vrcn-badge"><span class="msi" style="font-size:11px;">star</span> ${w.favorites}</span>
            <span class="vrcn-badge"><span class="msi" style="font-size:11px;">visibility</span> ${w.visits}</span>
            ${w.pcSize > 0 ? `<span class="vrcn-badge"><span class="msi" style="font-size:11px;">computer</span> ${formatFileSize(w.pcSize)}</span>` : ''}
            ${w.androidSize > 0 ? `<span class="vrcn-badge"><span class="msi" style="font-size:11px;">android</span> ${formatFileSize(w.androidSize)}</span>` : ''}
            ${idBadge(wid)}
        </div>
        <div style="margin:10px 0 6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <button class="vrcn-button-round" onclick="openCreateInstanceModal()"><span class="msi" style="font-size:14px;">add_circle_outline</span> ${t('worlds.instances.create_title', 'Create Instance')}</button>
            <button class="vrcn-button-round${isFavWorld ? ' active' : ''}" id="wdFavBtn" onclick="toggleWorldFavPicker('${wid}')" style="margin-left:auto;">${favBtnLabel}</button>
        </div>
        <div id="wdFavPicker" style="display:none;margin-bottom:14px;">
            <div class="wd-section-label" style="margin-bottom:6px;">${t('worlds.favorites.add_group_title', 'ADD TO FAVORITE GROUP')}</div>
            <div class="ci-group-list" id="wdFavGroupList"><div style="font-size:11px;color:var(--tx3);padding:8px 0;">${t('worlds.favorites.loading_groups', 'Loading groups...')}</div></div>
        </div>
        ${(w.worldTimeSeconds > 0 || currentInstanceData?.worldId === wid) ? `<div class="wd-your-time"><span class="msi" style="font-size:15px;">schedule</span><div><div style="font-size:12px;font-weight:600;color:var(--tx1);">${t('worlds.time_spent.label', 'Your Time Spent')}</div><div style="font-size:11px;color:var(--tx3);"><span id="wdTimeSpent">${formatDuration(w.worldTimeSeconds || 0)}</span>${w.worldVisitCount > 0 ? ' &middot; ' + getWorldVisitCountLabel(w.worldVisitCount) : ''}</div></div></div>` : ''}
        ${desc ? `<div style="font-size:12px;color:var(--tx2);margin-bottom:14px;max-height:150px;overflow-y:auto;line-height:1.5;white-space:pre-wrap;">${esc(desc)}</div>` : ''}
        ${tagsHtml}
        <div class="myp-section" style="padding-bottom:14px;">
            <div class="myp-section-header"><span class="myp-section-title">${t('worlds.meta.infos_title', 'Infos')}</span></div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px 6px;">
                ${(() => {
                    const _wmc = (label, val) => `<div><div class="myp-section-title" style="margin-bottom:3px;">${label}</div><div style="font-size:12px;color:var(--tx2);">${val}</div></div>`;
                    const instCount = (w.instances || []).length;
                    return [
                        w.recommendedCapacity ? _wmc(t('worlds.meta.recommended', 'Recommended'), esc(getWorldPlayersLabel(w.recommendedCapacity))) : '',
                        _wmc(t('worlds.meta.max_capacity', 'Max Capacity'), esc(getWorldPlayersLabel(w.capacity))),
                        _wmc(t('worlds.meta.instances', 'Instances'), String(instCount)),
                        w.createdAt ? _wmc(t('worlds.meta.published', 'Published'), fmtShortDate(new Date(w.createdAt + 'T00:00:00'))) : '',
                        w.updatedAt ? _wmc(t('worlds.meta.updated', 'Updated'), fmtShortDate(new Date(w.updatedAt + 'T00:00:00'))) : '',
                        w.version != null ? _wmc(t('worlds.meta.version', 'Version'), String(w.version)) : '',
                    ].join('');
                })()}
            </div>
        </div>
        <div class="myp-section" style="padding-bottom:14px;">
            <div class="myp-section-header"><span class="myp-section-title">${t('worlds.meta.community_title', 'Community Info')}</span></div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px 6px;">
                ${(() => {
                    const _wmc = (label, val) => `<div><div class="myp-section-title" style="margin-bottom:3px;">${label}</div><div style="font-size:12px;color:var(--tx2);">${val}</div></div>`;
                    return [
                        _wmc(t('worlds.meta.public_players', 'Public Players'), String(w.publicOccupants ?? 0)),
                        _wmc(t('worlds.meta.private_players', 'Private Players'), String(w.privateOccupants ?? 0)),
                        w.heat != null ? _wmc(t('worlds.meta.heat', 'Heat'), String(w.heat)) : '',
                        w.popularity != null ? _wmc(t('worlds.meta.popularity', 'Popularity'), String(w.popularity)) : '',
                    ].join('');
                })()}
            </div>
        </div>
        </div>
        <div id="wdTabInstances" style="display:none;">
            <div class="wd-section-label wd-instances-label" style="margin-top:4px;"><span>${tf('worlds.instances.active_title', { count: allInstances.length }, 'ACTIVE INSTANCES ({count})')}</span><button class="mi-refresh-btn" id="wdInstancesRefreshBtn" onclick="refreshWorldInstances()" title="Refresh instances">&#8635;</button></div>
            ${instancesHtml}
        </div>
        ${isOwnWorld ? `<div id="wdTabInsights" style="display:none;"><div id="wiContainer"></div></div>` : ''}
        <div style="margin-top:14px;text-align:right;"><button class="vrcn-button-round" onclick="closeWorldSearchDetail()">${t('common.close', 'Close')}</button></div>
        </div>`;

    if (thumb) { const s = document.getElementById('wd-banner-slot'); const bi = _getWorldBannerImg(wid, thumb); if (s && bi) s.insertBefore(bi, s.firstChild); }
    if (_wdCurrentTab !== 'info') {
        const activeTabBtn = el.querySelector(`.fd-tab[onclick*="'${_wdCurrentTab}'"]`);
        switchWdTab(_wdCurrentTab, activeTabBtn);
    }
    // Live timer - only when currently in this world
    if (_wdLiveTimer) { clearInterval(_wdLiveTimer); _wdLiveTimer = null; }
    if (currentInstanceData?.worldId === wid) {
        let liveSecs = w.worldTimeSeconds || 0;
        _wdLiveTimer = setInterval(() => {
            liveSecs++;
            const el = document.getElementById('wdTimeSpent');
            if (el) el.textContent = formatDuration(liveSecs);
            else { clearInterval(_wdLiveTimer); _wdLiveTimer = null; }
        }, 1000);
    }
}

let _wdCurrentWorldId = '';

function switchWdTab(tab, btn) {
    _wdCurrentTab = tab;
    const info      = document.getElementById('wdTabInfo');
    const instances = document.getElementById('wdTabInstances');
    const insights  = document.getElementById('wdTabInsights');
    if (info)      info.style.display      = tab === 'info'      ? '' : 'none';
    if (instances) instances.style.display = tab === 'instances' ? '' : 'none';
    if (insights)  insights.style.display  = tab === 'insights'  ? '' : 'none';
    document.querySelectorAll('#detailModalContent .fd-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    if (tab === 'insights' && _wdCurrentWorldId) {
        wiLoadInsights(_wdCurrentWorldId);
    }
}

function closeWorldSearchDetail(fromNav = false) {
    if (_wdLiveTimer) { clearInterval(_wdLiveTimer); _wdLiveTimer = null; }
    _wdCurrentWorldId = '';
    _wdCurrentTab = 'info';
    if (typeof _wiReset === 'function') _wiReset();
    document.getElementById('modalDetail').style.display = 'none';
    if (!fromNav && typeof navClear === 'function') navClear();
}

function toggleWorldFavPicker(worldId) {
    const entry = favWorldsData.find(fw => fw.id === worldId);
    if (entry) {
        removeWorldFavorite(worldId, entry.favoriteId);
        return;
    }
    const picker = document.getElementById('wdFavPicker');
    if (!picker) return;
    const open = picker.style.display !== 'none';
    picker.style.display = open ? 'none' : '';
    if (!open) renderWorldFavPicker(worldId);
}

function removeWorldFavorite(worldId, fvrtId) {
    const btn = document.getElementById('wdFavBtn');
    if (btn) btn.disabled = true;
    sendToCS({ action: 'vrcRemoveWorldFavorite', worldId, fvrtId });
}

function onWorldUnfavoriteResult(data) {
    const btn = document.getElementById('wdFavBtn');
    if (data.ok) {
        const removed = favWorldsData.find(fw => fw.id === data.worldId);
        const worldName = removed?.name || worldInfoCache[data.worldId]?.name || '';
        showToast(true, worldName
            ? tf('worlds.favorites.toast.removed.named', { world: worldName }, '"{world}" removed from favorites')
            : t('worlds.favorites.toast.removed', 'Removed from favorites'));
        favWorldsData = favWorldsData.filter(fw => fw.id !== data.worldId);
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('active');
            btn.innerHTML = `<span class="msi" style="font-size:16px;">star_outline</span>${t('worlds.favorites.favorite', 'Favorite')}`;
        }
        filterFavWorlds();
        _scheduleBgFavRefresh();
    } else {
        if (btn) btn.disabled = false;
    }
}

function renderWorldFavPicker(worldId) {
    const list = document.getElementById('wdFavGroupList');
    if (!list) return;
    // If groups not loaded yet, request them
    if (favWorldGroups.length === 0) {
        list.innerHTML = `<div style="font-size:11px;color:var(--tx3);padding:8px 0;">${t('worlds.favorites.loading_groups', 'Loading groups...')}</div>`;
        sendToCS({ action: 'vrcGetWorldFavGroups' });
        // Store pending worldId so we can render when groups arrive
        list.dataset.pendingWorldId = worldId;
        return;
    }
    const currentEntry = favWorldsData.find(fw => fw.id === worldId);
    const currentGroup = currentEntry?.favoriteGroup || '';
    list.innerHTML = favWorldGroups.map(g => {
        const count = favWorldsData.filter(fw => fw.favoriteGroup === g.name).length;
        const isVrcPlus = g.type === 'vrcPlusWorld';
        const isCurrent = g.name === currentGroup;
        const vrcBadge = isVrcPlus
            ? `<span class="vrcn-supporter-badge">VRC+</span>`
            : '';
        const check = isCurrent
            ? `<span class="msi" style="color:var(--accent);font-size:18px;flex-shrink:0;">check_circle</span>`
            : '';
        const gn = jsq(g.name), gt = jsq(g.type), wid = jsq(worldId);
        const oldFvrt = isCurrent ? jsq(currentEntry?.favoriteId || '') : '';
        return `<div class="fd-group-card ci-group-card${isCurrent ? ' ci-group-selected' : ''}"
            onclick="addWorldToFavGroup('${wid}','${gn}','${gt}','${oldFvrt}',this)" style="cursor:pointer;">
            <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
                    <span style="font-size:12px;font-weight:600;color:var(--tx1);">${esc(g.displayName || g.name)}</span>
                    ${vrcBadge}
                </div>
                <div style="font-size:10px;color:var(--tx3);margin-top:1px;">${tf('worlds.favorites.group_count', { count }, '{count}/100 worlds')}</div>
            </div>
            ${check}
        </div>`;
    }).join('');
}

function addWorldToFavGroup(worldId, groupName, groupType, oldFvrtId, rowEl) {
    // Optimistic UI: mark as selected
    document.querySelectorAll('#wdFavGroupList .ci-group-card').forEach(c => {
        c.classList.remove('ci-group-selected');
        const chk = c.querySelector('.msi');
        if (chk && chk.textContent === 'check_circle') chk.remove();
    });
    rowEl.classList.add('ci-group-selected');
    rowEl.insertAdjacentHTML('beforeend', '<span class="msi" style="color:var(--accent);font-size:18px;flex-shrink:0;">check_circle</span>');
    sendToCS({ action: 'vrcAddWorldFavorite', worldId, groupName, groupType, oldFvrtId });
}

function onWorldFavoriteResult(data) {
    if (data.ok) {
        const cached = worldInfoCache[data.worldId] || {};
        const worldName  = cached.name || favWorldsData.find(w => w.id === data.worldId)?.name || '';
        const group      = (typeof favWorldGroups !== 'undefined') && favWorldGroups.find(g => g.name === data.groupName);
        const groupLabel = group?.displayName || data.groupName;
        showToast(
            true,
            worldName
                ? tf('worlds.favorites.saved_to_group.named', { world: worldName, group: groupLabel }, '"{world}" saved to {group}')
                : tf('worlds.favorites.saved_to_group.unnamed', { group: groupLabel }, 'Saved to {group}')
        );

        const existing = favWorldsData.find(w => w.id === data.worldId);
        if (existing) {
            existing.favoriteGroup = data.groupName;
            existing.favoriteId   = data.newFvrtId;
        } else {
            favWorldsData.push({
                id: data.worldId,
                favoriteGroup:     data.groupName,
                favoriteId:        data.newFvrtId,
                name:              cached.name              || '',
                thumbnailImageUrl: cached.thumbnailImageUrl || cached.imageUrl || '',
                imageUrl:          cached.imageUrl          || '',
                authorName:        cached.authorName        || '',
                authorId:          cached.authorId          || '',
                occupants:         cached.occupants         || 0,
                favorites:         cached.favorites         || 0,
                visits:            cached.visits            || 0,
                capacity:          cached.capacity          || 0,
                tags:              cached.tags              || [],
                worldTimeSeconds:  cached.worldTimeSeconds  || 0,
                worldVisitCount:   cached.worldVisitCount   || 0,
            });
        }
        const btn = document.getElementById('wdFavBtn');
        if (btn) {
            btn.classList.add('active');
            btn.innerHTML = `<span class="msi" style="font-size:16px;">star</span>${t('worlds.favorites.unfavorite', 'Unfavorite')}`;
        }
        const list = document.getElementById('wdFavGroupList');
        if (list) renderWorldFavPicker(data.worldId);
        filterFavWorlds();
        _scheduleBgFavRefresh();
    } else {
        const list = document.getElementById('wdFavGroupList');
        if (list) {
            list.innerHTML = `<div style="font-size:11px;color:var(--err,#e55);padding:6px 0;">${t('worlds.favorites.failed_add', 'Failed to add to favorites. Try again.')}</div>`;
            setTimeout(() => { if (document.getElementById('wdFavGroupList')) renderWorldFavPicker(data.worldId); }, 1800);
        }
    }
}

function onWorldFavGroupsLoaded(groups) {
    favWorldGroups = groups;
    // Check if picker is open and waiting
    const list = document.getElementById('wdFavGroupList');
    if (list && list.dataset.pendingWorldId) {
        const wid = list.dataset.pendingWorldId;
        delete list.dataset.pendingWorldId;
        renderWorldFavPicker(wid);
    }
}


/* === World Detail Modal === */
function openWorldDetail(worldId) {
    if (!worldId) return;
    if (typeof navSetCurrent === 'function') navSetCurrent('world', worldId);
    const m = document.getElementById('modalWorldDetail');
    const c = document.getElementById('worldDetailContent');

    // Enrich friends whose location is hidden but are known to be in our current instance
    const _instLoc = currentInstanceData?.worldId === worldId ? currentInstanceData.location : null;
    const _instUserIds = _instLoc ? new Set((currentInstanceData.users || []).map(u => u.id).filter(Boolean)) : new Set();
    const friendsRaw = vrcFriendsData.map(f =>
        (_instUserIds.has(f.id) && (!f.location || f.location === 'private')) ? { ...f, location: _instLoc } : f
    );

    // Find all friends in this world
    const friends = friendsRaw.filter(f => {
        const { worldId: wid } = parseFriendLocation(f.location);
        return wid === worldId;
    });

    const cached = dashWorldCache[worldId];
    const worldName = cached?.name || worldId;
    // Prefer full-res imageUrl for the large modal banner; thumbnailImageUrl is only a small preview
    const thumb = cached?.imageUrl || cached?.thumbnailImageUrl || '';

    // Group friends by instance (full location string)
    const instanceMap = {};
    friends.forEach(f => {
        const loc = f.location;
        if (!instanceMap[loc]) {
            const { instanceType: iType, ownerId: iOwner } = parseFriendLocation(loc);
            const numMatch = loc.match(/:(\d+)/);
            instanceMap[loc] = { location: loc, instanceType: iType, ownerId: iOwner || '', instanceNum: numMatch ? numMatch[1] : '', friends: [] };
        }
        instanceMap[loc].friends.push(f);
    });
    const instanceList = Object.values(instanceMap);
    const multiInstance = instanceList.length > 1;

    // Resolve myInst early - needed for instance separation below
    const myInst = (typeof _myInstancesData !== 'undefined')
        ? _myInstancesData.find(i => i.worldId === worldId)
        : null;

    // Build header with banner fade (matching profiles/groups)
    const bannerHtml = thumb ? `<div class="fd-banner" id="wi-banner-slot"><div class="fd-banner-fade"></div></div>` : '';

    // Separate friends in MY instance from friends in other instances
    const myInstNum = myInst ? (myInst.location?.match(/:(\d+)/)?.[1] || '') : '';
    let myInstFriends = [];
    const otherInstMap = {};
    instanceList.forEach(inst => {
        if (myInstNum && inst.instanceNum === myInstNum) {
            myInstFriends = inst.friends;
        } else {
            otherInstMap[inst.location] = inst;
        }
    });
    const otherInstList = Object.values(otherInstMap);
    const totalSections = (myInst ? 1 : 0) + otherInstList.length;

    let friendsHtml = `<div class="wd-friends-label">${totalSections > 1
        ? tf('instance.sections.friends_in_world', { count: totalSections }, 'FRIENDS IN THIS WORLD ({count} instances)')
        : t('instance.sections.friends_here', 'FRIENDS IN THIS INSTANCE')}</div>`;

    // Render MY instance first (always, if it exists)
    if (myInst) {
        const { cls: iCls, label: iLabel } = getInstanceBadge(myInst.instanceType);
        const mnum = myInstNum;
        const mCopyBadge = mnum
            ? `<span class="vrcn-id-clip" style="font-size:10px;" onclick="copyInstanceLink('${jsq(myInst.location)}')"><span class="msi" style="font-size:10px;">content_copy</span>#${esc(mnum)}</span>`
            : '';
        const myInstOwnerId = myInst.ownerId || parseFriendLocation(myInst.location).ownerId || '';
        const myInstOwnerBadge = getOwnerBadgeHtml(myInstOwnerId, myInst.ownerName || '', myInst.ownerGroup || '', 'closeWorldDetail()');
        if (totalSections > 1) {
            const _myRegion = getWorldRegionLabel((myInst.location?.match(/~region\(([^)]+)\)/) || [])[1] || '');
            const myRegionBadge = _myRegion ? `<span class="vrcn-badge accent">${esc(_myRegion)}</span>` : '';
            friendsHtml += `<div class="wd-instance-header">
                <span class="vrcn-badge ${iCls}">${iLabel}</span>
                ${myRegionBadge}
                ${myInstOwnerBadge}
                ${mCopyBadge}
            </div>`;
        }
        friendsHtml += '<div class="wd-friends-list">';
        if (myInstFriends.length > 0) {
            myInstFriends.forEach(f => {
                friendsHtml += renderProfileItem(f, `navOpenModal('friend','${jsq(f.id || '')}','${jsq(f.displayName || '')}')`);
            });
        } else {
            friendsHtml += `<div class="vrcn-profile-item" style="pointer-events:none;opacity:0.55;">
                <div class="fd-profile-item-avatar" style="display:flex;align-items:center;justify-content:center;"><span class="msi" style="font-size:20px;color:var(--tx3);">person</span></div>
                <div class="fd-profile-item-info">
                    <div class="fd-profile-item-name">${t('dashboard.instances.no_friends_title', 'No friends here yet!')}</div>
                    <div class="fd-profile-item-status">${t('dashboard.instances.no_friends_desc', 'Invite friends to this instance!')}</div>
                </div>
            </div>`;
        }
        friendsHtml += '</div>';
    }

    // Render other instances
    otherInstList.forEach(inst => {
        let iResolvedType = inst.instanceType;
        const { cls: iCls, label: iLabel } = getInstanceBadge(iResolvedType);
        const canJoinInst = iResolvedType !== 'private' && iResolvedType !== 'invite_plus';
        const instLoc = inst.location.replace(/'/g, "\\'");
        const instCopyBadge = inst.instanceNum
            ? `<span class="vrcn-id-clip" style="font-size:10px;" onclick="copyInstanceLink('${jsq(inst.location)}')"><span class="msi" style="font-size:10px;">content_copy</span>#${esc(inst.instanceNum)}</span>`
            : '';
        const instOwnerBadge = getOwnerBadgeHtml(inst.ownerId || '', '', '', 'closeWorldDetail()');
        if (totalSections > 1) {
            const _instRegion = getWorldRegionLabel((inst.location.match(/~region\(([^)]+)\)/) || [])[1] || '');
            const instRegionBadge = _instRegion ? `<span class="vrcn-badge accent">${esc(_instRegion)}</span>` : '';
            friendsHtml += `<div class="wd-instance-header">
                <span class="vrcn-badge ${iCls}">${iLabel}</span>
                ${instRegionBadge}
                ${instOwnerBadge}
                ${instCopyBadge}
                ${canJoinInst ? `<button class="vrcn-button-round vrcn-btn-join" style="margin-left:auto;" onclick="worldJoinAction('${instLoc}')">${t('common.join', 'Join')}</button>` : ''}
            </div>`;
        }
        friendsHtml += '<div class="wd-friends-list">';
        inst.friends.forEach(f => {
            friendsHtml += renderProfileItem(f, `navOpenModal('friend','${jsq(f.id || '')}','${jsq(f.displayName || '')}')`);
        });
        friendsHtml += '</div>';
    });

    // Actions - single instance: show Join World button; multi-instance: join buttons are per-instance above
    const anyLoc = otherInstList.length > 0 ? otherInstList[0].location : '';
    const anyInstType = otherInstList.length > 0 ? otherInstList[0].instanceType : 'public';
    const wid = worldId.replace(/'/g, "\\'");
    // Use myInst.instanceType (API-verified) when available - parseFriendLocation cannot detect Invite+
    const displayInstType = myInst?.instanceType || anyInstType;
    const { cls: instClass, label: instLabel } = getInstanceBadge(displayInstType);
    const loc = anyLoc.replace(/'/g, "\\'");
    const canJoin = !myInst && !multiInstance && anyLoc && anyInstType !== 'private' && anyInstType !== 'invite_plus';

    // Single-instance copy badge + owner badge - shown in fd-badges-row
    const instanceLoc = myInst?.location || anyLoc;
    const singleInstNum = instanceLoc.match(/:(\d+)/)?.[1] || '';
    const singleInstCopy = singleInstNum
        ? `<span class="vrcn-id-clip" onclick="copyInstanceLink('${jsq(instanceLoc)}')"><span class="msi" style="font-size:12px;">content_copy</span>#${esc(singleInstNum)}</span>`
        : '';
    const singleOwnerId = instanceList.length === 1 ? (instanceList[0].ownerId || '') : '';
    const singleOwnerBadge = singleOwnerId ? getOwnerBadgeHtml(singleOwnerId, '', '', 'closeWorldDetail()') : '';
    const _singleRegion = getWorldRegionLabel((instanceLoc.match(/~region\(([^)]+)\)/) || [])[1] || '');
    const singleRegionBadge = _singleRegion ? `<span class="vrcn-badge accent">${esc(_singleRegion)}</span>` : '';

    let actionsHtml = '<div class="fd-actions">';
    if (canJoin) actionsHtml += `<button class="vrcn-button-round vrcn-btn-join" onclick="worldJoinAction('${loc}')">${t('dashboard.instances.join_world', 'Join World')}</button>`;
    actionsHtml += `<button class="vrcn-button-round" onclick="navOpenModal('worldSearch','${wid}','${esc(cached?.name || '')}')">${t('dashboard.instances.open_world', 'Open World')}</button>`;
    actionsHtml += `<button class="vrcn-button-round" style="margin-left:auto;" onclick="closeWorldDetail()">${t('common.close', 'Close')}</button>`;
    actionsHtml += '</div>';

    c.innerHTML = `${bannerHtml}<div class="fd-content${thumb ? ' fd-has-banner' : ''}" style="padding:16px 0;">
        <h2 style="margin:0 0 4px;color:var(--tx0);font-size:18px;">${esc(worldName)}</h2>
        <div class="fd-badges-row">${multiInstance ? '' : (() => {
            const _oid = myInst ? (myInst.ownerId || parseFriendLocation(myInst.location).ownerId || '') : singleOwnerId;
            const _ob = getOwnerBadgeHtml(_oid, myInst?.ownerName || '', myInst?.ownerGroup || '', 'closeWorldDetail()');
            return `<span class="vrcn-badge ${instClass}">${instLabel}</span>${singleRegionBadge}${_ob}${singleInstCopy}`;
        })()}</div>
        ${friendsHtml}${actionsHtml}</div>`;
    if (thumb) { const s = document.getElementById('wi-banner-slot'); const bi = _getWorldBannerImg(worldId, thumb); if (s && bi) s.insertBefore(bi, s.firstChild); }
    m.style.display = 'flex';
}

function closeWorldDetail(fromNav = false) {
    document.getElementById('modalWorldDetail').style.display = 'none';
    if (!fromNav && typeof navClear === 'function') navClear();
}

function worldJoinAction(location) {
    const btns = document.querySelectorAll('#worldDetailContent button');
    btns.forEach(b => b.disabled = true);
    sendToCS({ action: 'vrcJoinFriend', location: location });
}

let _wiWorldId = '';
let _wiMode = 'week';      
let _wiAnchor = null;        
let _wiData = [];          
let _wiLoading = false;
let _wiInitialized = false; 
let _wiDpYear = 0, _wiDpMonth = 0; 

function wiLocale() {
    return getLanguageLocale();
}

function wiWeekdayLabels() {
    const base = new Date(Date.UTC(2024, 0, 8)); // Monday
    const fmt = new Intl.DateTimeFormat(wiLocale(), { weekday: 'short' });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(base.getTime() + i * 86400000)));
}

// public entry points
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

// date range helpers
function _wiRange() {
    const a = new Date(_wiAnchor);
    let from, to;
    if (_wiMode === 'day') {
        from = new Date(a.getFullYear(), a.getMonth(), a.getDate());
        to = new Date(from);
        to.setHours(23, 59, 59, 999);
    } else if (_wiMode === 'week') {
        // Mondayâ€"Sunday (ISO week)
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
        return fmtShortDate(from) + ' - ' + fmtShortDate(to);
    }
    if (_wiMode === 'month') return from.toLocaleDateString(getLanguageLocale(), { month: 'long', year: 'numeric' });
    return String(from.getFullYear());
}

// navigation
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

// date picker
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

// fetching
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

// Bucket data for chart points

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
        // 12 monthly buckets
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
        // week (7 days Monâ€"Sun) or month (actual days in month)
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

// Toolbar Updates

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

// Charts

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

// Canvas Line Chart
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

// â"€â"€ Helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

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
