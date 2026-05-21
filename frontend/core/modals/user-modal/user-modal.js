/* === User Modal (Friend / Profile Detail) === */
const _fdRawJsonCache = {};

function fdEditNote() {
    document.getElementById('fdVrcNoteView')?.style.setProperty('display', 'none');
    const edit = document.getElementById('fdVrcNoteEdit');
    if (edit) edit.style.display = '';
    const inp = document.getElementById('fdVrcNoteInput');
    if (inp) { inp.value = currentFriendDetail?.note || ''; inp.focus(); }
}

function fdCancelNote() {
    const view = document.getElementById('fdVrcNoteView');
    if (view) view.style.display = '';
    const edit = document.getElementById('fdVrcNoteEdit');
    if (edit) edit.style.display = 'none';
    const btn = document.getElementById('fdVrcNoteSaveBtn');
    if (btn) btn.disabled = false;
}

function fdSaveNote() {
    const inp = document.getElementById('fdVrcNoteInput');
    if (!inp || !currentFriendDetail) return;
    const btn = document.getElementById('fdVrcNoteSaveBtn');
    if (btn) btn.disabled = true;
    sendToCS({ action: 'vrcUpdateNote', userId: currentFriendDetail.id, note: inp.value });
}

function openFriendDetail(userId) {
    if (typeof navSetCurrent === 'function') navSetCurrent('friend', userId);
    const m = document.getElementById('modalFriendDetail');
    const c = document.getElementById('friendDetailContent');
    c.innerHTML = sk('content-modal');
    m.style.display = 'flex';
    sendToCS({ action: 'vrcGetFriendDetail', userId: userId });
}

let _fdLoadedAvatarKey = '';
let _fdLastAvatarPayload = null;

function closeFriendDetail(fromNav = false) {
    if (_fdLiveTimer) { clearInterval(_fdLiveTimer); _fdLiveTimer = null; }
    document.getElementById('modalFriendDetail').style.display = 'none';
    currentFriendDetail = null;
    window._fdAllMutuals = null;
    _fdLoadedAvatarKey = '';
    _fdLastAvatarPayload = null;
    if (!fromNav && typeof navClear === 'function') navClear();
}


function lookupAndOpenAvatar(fileId, iconEl) {
    if (iconEl) iconEl.style.opacity = '0.4';
    sendToCS({ action: 'vrcLookupAvatarByFileId', fileId, openModal: true });
}

function _applyAvatarSection(payload) {
    const section = document.getElementById('fdAvatarSection');
    if (!section || !payload?.avatarId) return;
    const avImg = currentFriendDetail?.currentAvatarImageUrl || '';
    const avIcon = avImg
        ? `<img class="fd-group-icon" src="${esc(avImg)}" onerror="this.style.display='none'">`
        : `<div class="fd-group-icon fd-group-icon-empty"><span class="msi" style="font-size:18px;">checkroom</span></div>`;
    const authorHtml = payload.avatarAuthor
        ? `<div class="fd-group-card-meta">${esc(payload.avatarAuthor)}</div>` : '';
    section.style.display = '';
    section.innerHTML = `<div class="fd-group-rep-label">${t('profiles.badges.current_avatar', 'Current Avatar')}</div>
        <div class="fd-group-card fd-group-rep" onclick="navOpenModal('avatar','${jsq(payload.avatarId)}','${jsq(payload.avatarName || '')}')">
            ${avIcon}<div class="fd-group-card-info"><div class="fd-group-card-name">${esc(payload.avatarName || payload.avatarId)}</div>${authorHtml}</div>
        </div>`;
}

function handleAvatarByFileId(payload) {
    if (!payload.avatarId) {
        if (payload.openModal) showToast(false, t('context_menu.avatar_not_found', 'No public avatar found'));
        return;
    }
    _fdLastAvatarPayload = payload;
    _applyAvatarSection(payload);
    if (payload.openModal) navOpenModal('avatar', payload.avatarId, payload.avatarName || '');
}

function filterFdGroups() {
    const q = document.getElementById('fdGroupsSearch')?.value.trim().toLowerCase() || '';
    const grid = document.getElementById('fdGroupsGrid');
    if (!grid) return;
    const all = window._fdAllGroupsAll || window._fdAllGroups || [];
    const filtered = q ? all.filter(g => (g.name || '').toLowerCase().includes(q)) : all;
    const otherGroups = filtered;
    const totalPages = Math.ceil(otherGroups.length / MINI_PG_SIZE) || 1;
    if ((window._fdGroupsPage || 0) >= totalPages) window._fdGroupsPage = totalPages - 1;
    const page = window._fdGroupsPage || 0;
    const slice = otherGroups.slice(page * MINI_PG_SIZE, (page + 1) * MINI_PG_SIZE);
    if (slice.length > 0) {
        grid.innerHTML = slice.map(g => {
            const gIcon = g.iconUrl ? `<img class="fd-group-icon" src="${g.iconUrl}" onerror="this.style.display='none'">` : `<div class="fd-group-icon fd-group-icon-empty"><span class="msi" style="font-size:18px;">group</span></div>`;
            return `<div class="fd-group-card" onclick="navOpenModal('group','${jsq(g.id)}','${jsq(g.name || '')}')">
                ${gIcon}<div class="fd-group-card-info"><div class="fd-group-card-name">${esc(g.name)}</div><div class="fd-group-card-meta">${g.memberCount ? esc(getGroupMemberText(g.memberCount, false)) : ''}</div></div>
            </div>`;
        }).join('');
    } else {
        grid.innerHTML = `<div style="padding:12px;grid-column:1/-1;text-align:center;font-size:12px;color:var(--tx3);">${t('profiles.groups.no_results', 'No results')}</div>`;
    }
    setMiniPaginator('fdGroupsPaginatorBar', buildMiniPaginator(page, totalPages, 'fdGroupsGoPage'));
}

function fdGroupsGoPage(page) {
    if (page < 0) return;
    const q = (document.getElementById('fdGroupsSearch')?.value || '').toLowerCase();
    const all = window._fdAllGroupsAll || window._fdAllGroups || [];
    const filtered = q ? all.filter(g => (g.name||'').toLowerCase().includes(q)) : all;
    const totalPages = Math.ceil(filtered.length / MINI_PG_SIZE) || 1;
    if (page >= totalPages) return;
    window._fdGroupsPage = page;
    filterFdGroups();
}

function filterFdOwnGroups() {
    const grid = document.getElementById('fdOwnGroupsGrid');
    if (!grid) return;
    const all = window._fdAllOwnGroups || [];
    const totalPages = Math.ceil(all.length / MINI_PG_SIZE) || 1;
    if ((window._fdOwnGroupsPage || 0) >= totalPages) window._fdOwnGroupsPage = totalPages - 1;
    const page = window._fdOwnGroupsPage || 0;
    const slice = all.slice(page * MINI_PG_SIZE, (page + 1) * MINI_PG_SIZE);
    if (slice.length > 0) {
        grid.innerHTML = slice.map(g => {
            const gIcon = g.iconUrl ? `<img class="fd-group-icon" src="${g.iconUrl}" onerror="this.style.display='none'">` : `<div class="fd-group-icon fd-group-icon-empty"><span class="msi" style="font-size:18px;">group</span></div>`;
            return `<div class="fd-group-card" onclick="navOpenModal('group','${jsq(g.id)}','${jsq(g.name || '')}')">
                ${gIcon}<div class="fd-group-card-info"><div class="fd-group-card-name">${esc(g.name)}</div><div class="fd-group-card-meta">${g.memberCount ? esc(getGroupMemberText(g.memberCount, false)) : ''}</div></div>
            </div>`;
        }).join('');
    } else {
        grid.innerHTML = `<div style="padding:12px;grid-column:1/-1;text-align:center;font-size:12px;color:var(--tx3);">${t('profiles.groups.no_results', 'No results')}</div>`;
    }
    setMiniPaginator('fdOwnGroupsPaginatorBar', buildMiniPaginator(page, totalPages, 'fdOwnGroupsGoPage'));
}

function fdOwnGroupsGoPage(page) {
    if (page < 0) return;
    const totalPages = Math.ceil((window._fdAllOwnGroups || []).length / MINI_PG_SIZE) || 1;
    if (page >= totalPages) return;
    window._fdOwnGroupsPage = page;
    filterFdOwnGroups();
}

function filterFdMutualsGroups() {
    const q = document.getElementById('fdMutualsGroupsSearch')?.value.trim().toLowerCase() || '';
    const grid = document.getElementById('fdMutualsGroupsGrid');
    if (!grid) return;
    const all = window._fdAllMutualGroups || [];
    const filtered = q ? all.filter(g => (g.name || '').toLowerCase().includes(q)) : all;
    const totalPages = Math.ceil(filtered.length / MINI_PG_SIZE) || 1;
    if ((window._fdMutualsGroupsPage || 0) >= totalPages) window._fdMutualsGroupsPage = totalPages - 1;
    const page = window._fdMutualsGroupsPage || 0;
    const slice = filtered.slice(page * MINI_PG_SIZE, (page + 1) * MINI_PG_SIZE);
    if (slice.length > 0) {
        grid.innerHTML = slice.map(g => {
            const icon = g.iconUrl
                ? `<img class="fd-group-icon" src="${esc(g.iconUrl)}" onerror="this.style.display='none'">`
                : `<div class="fd-group-icon fd-group-icon-empty"><span class="msi" style="font-size:18px;">group</span></div>`;
            return `<div class="fd-group-card" style="margin-bottom:0;" onclick="navOpenModal('group','${jsq(g.id)}','${jsq(g.name || '')}')">
                ${icon}<div class="fd-group-card-info">
                    <div class="fd-group-card-name">${esc(g.name)}</div>
                    <div class="fd-group-card-meta">${esc(g.shortCode || '')}${g.discriminator ? '.' + esc(g.discriminator) : ''} &middot; ${esc(getGroupMemberText(g.memberCount))}</div>
                </div>
            </div>`;
        }).join('');
    } else {
        grid.innerHTML = `<div style="padding:12px;grid-column:1/-1;text-align:center;font-size:12px;color:var(--tx3);">${t('profiles.mutuals.groups_no_results', 'No results')}</div>`;
    }
    setMiniPaginator('fdMutualsGroupsPageBar', buildMiniPaginator(page, totalPages, 'fdMutualsGroupsGoPage'));
}

function fdMutualsGroupsGoPage(page) {
    if (page < 0) return;
    const q = (document.getElementById('fdMutualsGroupsSearch')?.value || '').toLowerCase();
    const all = window._fdAllMutualGroups || [];
    const filtered = q ? all.filter(g => (g.name||'').toLowerCase().includes(q)) : all;
    const totalPages = Math.ceil(filtered.length / MINI_PG_SIZE) || 1;
    if (page >= totalPages) return;
    window._fdMutualsGroupsPage = page;
    filterFdMutualsGroups();
}

function filterFdMutuals() {
    const q = document.getElementById('fdMutualsSearch')?.value.trim().toLowerCase() || '';
    const grid = document.getElementById('fdMutualsGrid');
    if (!grid) return;
    const all = window._fdAllMutuals || [];
    const filtered = q ? all.filter(m => (m.displayName || '').toLowerCase().includes(q)) : all;
    const totalPages = Math.ceil(filtered.length / MINI_PG_SIZE) || 1;
    if ((window._fdMutualsPage || 0) >= totalPages) window._fdMutualsPage = totalPages - 1;
    const page = window._fdMutualsPage || 0;
    const slice = filtered.slice(page * MINI_PG_SIZE, (page + 1) * MINI_PG_SIZE);
    grid.innerHTML = slice.length
        ? slice.map(mu => {
            const thumbUrl = mu.currentAvatarThumbnailImageUrl || '';
            const opts = thumbUrl ? { attrs: `data-avatar-thumb="${esc(thumbUrl)}"` } : undefined;
            return renderProfileItem(mu, `navOpenModal('friend','${jsq(mu.id)}','${jsq(mu.displayName || '')}')`, opts);
        }).join('')
        : `<div style="padding:12px;grid-column:1/-1;text-align:center;font-size:12px;color:var(--tx3);">${t('profiles.mutuals.no_results', 'No results')}</div>`;
    setMiniPaginator('fdMutualsPageBar', buildMiniPaginator(page, totalPages, 'fdMutualsGoPage'));
}

function fdMutualsGoPage(page) {
    if (page < 0) return;
    const q = (document.getElementById('fdMutualsSearch')?.value || '').toLowerCase();
    const all = window._fdAllMutuals || [];
    const filtered = q ? all.filter(m => (m.displayName||'').toLowerCase().includes(q)) : all;
    const totalPages = Math.ceil(filtered.length / MINI_PG_SIZE) || 1;
    if (page >= totalPages) return;
    window._fdMutualsPage = page;
    filterFdMutuals();
}

function switchFdTab(tab, btn) {
    const box = document.querySelector('#modalFriendDetail .modal-box');
    const favsEl = document.getElementById('fdTabFavs');
    animateModalBox(box, () => {
        document.getElementById('fdTabInfo').style.display = tab === 'info' ? '' : 'none';
        document.getElementById('fdTabGroups').style.display = tab === 'groups' ? '' : 'none';
        const mutualsEl = document.getElementById('fdTabMutuals');
        if (mutualsEl) mutualsEl.style.display = tab === 'mutuals' ? '' : 'none';
        const contentEl = document.getElementById('fdTabContent');
        if (contentEl) contentEl.style.display = tab === 'content' ? '' : 'none';
        if (favsEl) favsEl.style.display = tab === 'favs' ? '' : 'none';
        const jsonEl = document.getElementById('fdTabJson');
        if (jsonEl) jsonEl.style.display = tab === 'json' ? '' : 'none';
        document.querySelectorAll('.fd-tab').forEach(t => t.classList.remove('active'));
        if (btn) btn.classList.add('active');
    });
    if (tab === 'favs') {
        const uid = favsEl?.dataset.userId;
        if (uid && !favsEl.dataset.loaded) {
            favsEl.dataset.loaded = '1';
            if (!favsEl.querySelector('.fd-content-pills'))
                favsEl.innerHTML = `<div class="empty-msg">${t('profiles.favs.loading', 'Loading favorites...')}</div>`;
            sendToCS({ action: 'vrcGetUserFavWorlds', userId: uid });
        }
    }
}

function renderUserFavWorlds(payload) {
    const el = document.getElementById('fdTabFavs');
    if (!el || el.dataset.userId !== payload.userId) return;
    const groups = payload.groups || [];
    if (!groups.length) {
        el.innerHTML = `<div class="empty-msg">${t('profiles.favs.none', 'No public favorite worlds.')}</div>`;
        return;
    }

    let activePill = 0;
    const existingPill = el.querySelector('.fd-content-pill.active');
    if (existingPill) {
        const idx = [...el.querySelectorAll('.fd-content-pill')].indexOf(existingPill);
        if (idx >= 0) activePill = idx;
    }

    let pillsHtml = `<div class="fd-content-pills">`;
    groups.forEach((g, i) => {
        const label = esc(g.displayName || g.name);
        const count = g.worlds ? g.worlds.length : 0;
        pillsHtml += `<button class="fd-tab fd-content-pill${i === activePill ? ' active' : ''}" onclick="switchFavPill(${i},this)">${label} (${count})</button>`;
    });
    pillsHtml += `</div>`;

    let panelsHtml = '';
    groups.forEach((g, i) => {
        panelsHtml += `<div id="fdFavPanel_${i}" style="${i !== activePill ? 'display:none;' : ''}">`;
        if (g.visibility === 'private') {
            panelsHtml += `<div class="empty-msg">${t('profiles.favs.private', 'This list is private.')}</div>`;
        } else if (!g.worlds || !g.worlds.length) {
            panelsHtml += `<div class="empty-msg">${t('profiles.favs.empty_group', 'Empty.')}</div>`;
        } else {
            panelsHtml += `<div class="vrcn-world-grid-small">`;
            for (const w of g.worlds) {
                const thumb = w.thumbnailImageUrl || '';
                panelsHtml += `<div class="vrcn-world-card-small" onclick="navOpenModal('worldSearch','${jsq(w.id)}','${jsq(w.name || '')}')">
                    <div class="vwcs-bg"${thumb ? ` style="background-image:url('${cssUrl(thumb)}')"` : ''}></div>
                    <div class="vwcs-scrim"></div>
                    <div class="vwcs-info">
                        <div class="vwcs-name">${esc(w.name)}</div>
                        <div class="vwcs-meta"><span class="msi" style="font-size:11px;">person</span>${w.occupants} <span class="msi" style="font-size:11px;">star</span>${w.favorites}</div>
                    </div>
                </div>`;
            }
            panelsHtml += `</div>`;
        }
        panelsHtml += `</div>`;
    });

    el.innerHTML = pillsHtml + panelsHtml;
}

function switchFavPill(idx, btn) {
    const el = document.getElementById('fdTabFavs');
    if (!el) return;
    el.querySelectorAll('[id^="fdFavPanel_"]').forEach((p, i) => p.style.display = i === idx ? '' : 'none');
    el.querySelectorAll('.fd-content-pill').forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');
}

function switchFdContentPill(pill, btn) {
    const worldsEl = document.getElementById('fdContentWorlds');
    const avatarsEl = document.getElementById('fdContentAvatars');
    if (worldsEl) worldsEl.style.display = pill === 'worlds' ? '' : 'none';
    if (avatarsEl) avatarsEl.style.display = pill === 'avatars' ? '' : 'none';
    document.querySelectorAll('.fd-content-pill').forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');
}

function switchFdMutualsPill(pill, btn) {
    const friendsEl = document.getElementById('fdMutualsFriends');
    const groupsEl  = document.getElementById('fdMutualsGroups');
    if (friendsEl) friendsEl.style.display = pill === 'friends' ? '' : 'none';
    if (groupsEl)  groupsEl.style.display  = pill === 'groups'  ? '' : 'none';
    document.querySelectorAll('.fd-mutual-pill').forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');
}

function renderFdUserAvatars(payload) {
    const avatars = payload.avatars || [];

    const avatarsPill = document.getElementById('fdAvatarsPill');
    if (avatarsPill) avatarsPill.textContent = tf('profiles.content.avatars_pill', { count: avatars.length }, 'Avatars ({count})');

    const worldsCount = Array.isArray(currentFriendDetail?.userWorlds) ? currentFriendDetail.userWorlds.length : 0;
    const contentTab = document.getElementById('fdTabContentBtn');
    if (contentTab) contentTab.textContent = tf('profiles.tabs.content', { count: worldsCount + avatars.length }, 'Content ({count})');

    window._fdAllAvatars = avatars;
    window._fdAvatarsPage = 0;
    renderFdAvatarsPage(0);
}

function renderFdAvatarsPage(page) {
    const grid = document.getElementById('fdAvatarsGrid');
    if (!grid) return;
    const avatars = window._fdAllAvatars || [];
    const totalPages = Math.ceil(avatars.length / MINI_CONTENT_PG_SIZE) || 1;
    if (page >= totalPages) page = totalPages - 1;
    if (page < 0) page = 0;
    window._fdAvatarsPage = page;
    const slice = avatars.slice(page * MINI_CONTENT_PG_SIZE, (page + 1) * MINI_CONTENT_PG_SIZE);
    if (!slice.length) {
        grid.innerHTML = `<div class="empty-msg">${t('profiles.content.no_public_avatars', 'No public avatars found.')}</div>`;
        setMiniPaginator('fdAvatarsPageBar', '');
        return;
    }
    grid.innerHTML = '<div class="vrcn-mini-content-grid">' + slice.map(a => {
        const thumb = a.thumbnailImageUrl || a.imageUrl || '';
        const aid = jsq(a.id || '');
        const aname = jsq(a.name || '');
        const isPublic = a.releaseStatus === 'public';
        const platBadges = _avPlatformBadges(a);
        const pubBadge = `<span class="vrcn-badge" style="${isPublic ? '' : 'background:rgba(255,100,100,.15);color:var(--err);'}">${isPublic ? t('avatars.labels.public','Public') : t('avatars.labels.private','Private')}</span>`;
        return `<div class="vrcn-mini-content" data-avatar-id="${esc(a.id || '')}" onclick="navOpenModal('avatar','${aid}','${aname}')">
            <div class="vrcn-mini-content-thumb" style="background-image:url('${cssUrl(thumb)}')"></div>
            <div class="vrcn-mini-content-info">
                <div class="vrcn-mini-content-name">${esc(a.name || t('avatars.labels.unnamed','Unnamed'))}</div>
                <div class="vrcn-mini-content-meta">${esc(a.authorName || '')}</div>
                <div class="vrcn-mini-content-badges">${platBadges}${pubBadge}</div>
            </div>
        </div>`;
    }).join('') + '</div>';
    setMiniPaginator('fdAvatarsPageBar', buildMiniPaginator(page, totalPages, 'fdAvatarsGoPage'));
    _checkAvatarsExist(slice.map(a => a.id).filter(Boolean));
}

function fdAvatarsGoPage(page) {
    if (page < 0) return;
    const totalPages = Math.ceil((window._fdAllAvatars || []).length / MINI_CONTENT_PG_SIZE) || 1;
    if (page >= totalPages) return;
    window._fdAvatarsPage = page;
    renderFdAvatarsPage(page);
}

function renderFdWorldsPage(page) {
    const grid = document.getElementById('fdWorldsGrid');
    if (!grid) return;
    const worlds = window._fdAllWorlds || [];
    const totalPages = Math.ceil(worlds.length / MINI_CONTENT_PG_SIZE) || 1;
    if (page >= totalPages) page = totalPages - 1;
    if (page < 0) page = 0;
    window._fdWorldsPage = page;
    const slice = worlds.slice(page * MINI_CONTENT_PG_SIZE, (page + 1) * MINI_CONTENT_PG_SIZE);
    if (!slice.length) {
        grid.innerHTML = `<div class="empty-msg">${t('profiles.content.no_public_worlds', 'No public worlds found.')}</div>`;
        setMiniPaginator('fdWorldsPageBar', '');
        return;
    }
    let h = `<div class="vrcn-mini-content-grid">`;
    slice.forEach(w => {
        const thumb = w.thumbnailImageUrl || w.imageUrl || '';
        const wid = jsq(w.id);
        const tags = (w.tags || []).filter(tag => tag.startsWith('author_tag_')).map(tag => tag.replace('author_tag_', '')).slice(0, 2);
        const tagsHtml = tags.map(tag => `<span class="vrcn-badge">${esc(tag)}</span>`).join('');
        h += `<div class="vrcn-mini-content" data-world-id="${esc(w.id || '')}" onclick="navOpenModal('worldSearch','${wid}','${jsq(w.name || '')}')">
            <div class="vrcn-mini-content-thumb" style="background-image:url('${cssUrl(thumb)}')"></div>
            <div class="vrcn-mini-content-info">
                <div class="vrcn-mini-content-name">${esc(w.name || '')}</div>
                <div class="vrcn-mini-content-meta">${esc(w.authorName || '')}<span class="msi">person</span>${w.occupants ?? ''}<span class="msi">star</span>${w.favorites ?? ''}</div>
                ${tagsHtml ? `<div class="vrcn-mini-content-badges">${tagsHtml}</div>` : ''}
            </div>
        </div>`;
    });
    h += `</div>`;
    grid.innerHTML = h;
    setMiniPaginator('fdWorldsPageBar', buildMiniPaginator(page, totalPages, 'fdWorldsGoPage'));
}

function fdWorldsGoPage(page) {
    if (page < 0) return;
    const totalPages = Math.ceil((window._fdAllWorlds || []).length / MINI_CONTENT_PG_SIZE) || 1;
    if (page >= totalPages) return;
    window._fdWorldsPage = page;
    renderFdWorldsPage(page);
}

function getLanguages(tags) {
    if (!tags) return [];
    return tags.filter(t => t.startsWith('language_')).map(t => LANG_MAP[t] || t.replace('language_','').toUpperCase());
}

function fdToggleBio(btn) {
    const bio = btn.closest('.fd-group-rep-label').nextElementSibling;
    const expanded = bio.classList.toggle('expanded');
    btn.querySelector('.msi').textContent = expanded ? 'expand_less' : 'chevron_right';
}

const _fdBannerImgs = {};
function _getFdBannerImg(userId, src) {
    if (!userId || !src) return null;
    if (!_fdBannerImgs[userId]) {
        const img = new Image();
        img.src = src;
        img.onerror = () => { if (img.parentElement) img.parentElement.style.display = 'none'; };
        _fdBannerImgs[userId] = { img, src };
    } else if (_fdBannerImgs[userId].src !== src) {
        _fdBannerImgs[userId].img.src = src;
        _fdBannerImgs[userId].src = src;
    }
    return _fdBannerImgs[userId].img;
}

function renderFriendDetail(d) {
    if (d.id && d.rawJson) _fdRawJsonCache[d.id] = d.rawJson;
    currentFriendDetail = d;
    if (typeof navUpdateLabel === 'function') navUpdateLabel(d.displayName || '');
    window._fdGroupsPage = 0;
    window._fdMutualsPage = 0;
    window._fdMutualsGroupsPage = 0;
    window._fdWorldsPage = 0;
    window._fdAvatarsPage = 0;
    window._fdOwnGroupsPage = 0;
    window._fdAllAvatars = [];
    const c = document.getElementById('friendDetailContent');
    const img = d.image || '';
    const imgTag = img
        ? `<img class="fd-avatar" src="${img}" onerror="this.style.display='none'">`
        : `<div class="fd-avatar" style="display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:var(--tx3)">${esc((d.displayName || '?')[0])}</div>`;

    let _worldPartHtml = '';
    let _ownerPartHtml = '';
    if (d.worldName) {
        const { worldId: fdWorldId, ownerId: _fdOwnerId } = parseFriendLocation(d.location);
        const onclick = fdWorldId ? `navOpenModal('worldSearch','${jsq(fdWorldId)}','${jsq(d.worldName || '')}')` : '';
        const _loc = d.location || '';
        const _instId     = _loc.includes(':') ? (_loc.split(':')[1] || '').split('~')[0] : '';
        const _regionRaw  = (_loc.match(/~region\(([^)]+)\)/) || [])[1] || '';
        const _region     = _regionRaw ? getWorldRegionLabel(_regionRaw) : '';
        const _instanceItemHtml = renderInstanceItem({
            thumb:        d.worldThumb || '',
            worldName:    d.worldName,
            instanceType: d.instanceType,
            instanceId:   _instId,
            region:       _region,
            userCount:    d.userCount || 0,
            capacity:     d.worldCapacity || 0,
            ageGate:      d.ageGate || false,
            onclick,
        });
        _worldPartHtml = _instanceItemHtml;
        if (_fdOwnerId && _fdOwnerId.startsWith('usr_')) {
            const _ownerUser = vrcFriendsData.find(f => f.id === _fdOwnerId);
            if (_ownerUser) {
                const _ownerOnclick = `navOpenModal('friend','${jsq(_ownerUser.id)}','${jsq(_ownerUser.displayName || '')}')`;
                _ownerPartHtml = renderProfileItem(_ownerUser, _ownerOnclick, { noWorld: true });
            } else {
                _ownerPartHtml = `<div id="fdOwnerSlot" data-owner-id="${esc(_fdOwnerId)}"><div class="sk-block" style="height:44px;border-radius:8px;"></div></div>`;
                sendToCS({ action: 'vrcGetUserBasic', userId: _fdOwnerId, contextId: d.id });
            }
        }
    } else if (d.location === 'private') {
        _worldPartHtml = `<div style="font-size:12px;color:var(--tx3);text-align:center;padding:8px 0;">${t('profiles.meta.private_instance', 'Private Instance')}</div>`;
    } else if (d.location === 'traveling') {
        _worldPartHtml = `<div style="font-size:12px;color:var(--tx3);text-align:center;padding:8px 0;">${t('profiles.meta.traveling', 'Traveling...')}</div>`;
    }

    const bioHtml = d.bio ? `<div class="fd-bio">${esc(d.bio)}</div>` : '';

    let bioLinksHtml = '';
    if (d.bioLinks && d.bioLinks.length) {
        bioLinksHtml = `<div class="fd-bio-links">${d.bioLinks.map(u => renderBioLink(u)).join('')}</div>`;
    }

    const avatarId = d.currentAvatarId || '';
    const avatarFileId = d.avatarFileId || '';
    const avatarRowHtml = (avatarId.startsWith('avtr_') || avatarFileId)
        ? `<div id="fdAvatarSection" class="fd-info-card" style="display:none;"></div>`
        : '';

    const lastSeenStr   = d.inSameInstance
        ? t('profiles.last_seen.just_now', 'Just now')
        : (d.lastSeenTracked ? formatLastSeen(null, d.lastSeenTracked) : '');
    const lastActiveStr = d.lastActivity ? formatLastSeen(d.lastActivity, null) : '';
    const isSelf    = currentVrcUser && d.id === currentVrcUser.id;
    const fdMeetCnt      = d.meets || 0;
    const fdFirstMeet    = d.firstMeetDate || '';

    const _mr = (label, valueHtml) =>
        `<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;font-size:11px;">
            <span style="color:var(--tx3);">${label}</span>
            <span style="color:var(--tx1);text-align:right;">${valueHtml}</span>
        </div>`;

    const _aboutRows = [
        _mr(t('profiles.meta.platform',       'Platform'),       esc(d.lastPlatform || '—')),
        _mr(t('profiles.meta.joined',         'Joined'),         d.dateJoined ? fmtShortDate(new Date(d.dateJoined + 'T00:00:00')) : '—'),
        _mr(t('profiles.meta.last_seen',      'Last Seen'),      esc(lastSeenStr   || '—')),
        _mr(t('profiles.meta.last_active',    'Last Active'),    esc(lastActiveStr || '—')),
        _mr(t('profiles.meta.age_verified',   'Age Verified'),   d.ageVerified        ? t('common.yes','Yes') : t('common.no','No')),
        _mr(t('profiles.meta.avatar_cloning', 'Avatar Cloning'), d.allowAvatarCopying ? t('common.on','On')   : t('common.off','Off')),
    ];
    if (!isSelf) {
        _aboutRows.push(_mr(t('profiles.meta.meets', 'Meets'),
            fdMeetCnt > 0 ? String(fdMeetCnt) : '—'));
        _aboutRows.push(_mr(t('profiles.meta.time_together', 'Time Together'),
            (d.totalTimeSeconds > 0 || d.inSameInstance)
                ? `<span id="fdTimeTogether">${formatDuration(d.totalTimeSeconds)}</span>`
                : `<span style="color:var(--tx3);">${t('profiles.meta.not_tracked', 'Not tracked yet')}</span>`));
    }

    const _aboutRowsHtml = `<div class="fd-group-rep-label">${t('profiles.meta.infos_title', 'Infos')}</div>
        <div style="display:grid;gap:6px;">${_aboutRows.join('')}</div>`;

    const vrcNoteHtml = `<div class="myp-section-header">
            <span class="myp-section-title">${t('profiles.notes.vrc_note', 'VRC Note')}</span>
            <button class="myp-edit-btn" onclick="fdEditNote()"><span class="msi" style="font-size:14px;">edit</span></button>
        </div>
        <div id="fdVrcNoteView">
            ${d.note ? `<div style="font-size:12px;color:var(--tx2);line-height:1.5;">${esc(d.note)}</div>`
                     : `<div class="myp-empty">${t('profiles.notes.no_note', 'No notes added yet')}</div>`}
        </div>
        <div id="fdVrcNoteEdit" style="display:none;">
            <textarea id="fdVrcNoteInput" class="myp-textarea" rows="3" placeholder="${esc(t('profiles.notes.placeholder', 'Write a note about this user...'))}"></textarea>
            <div class="myp-edit-actions">
                <button class="vrcn-button" onclick="fdCancelNote()">${t('common.cancel', 'Cancel')}</button>
                <button id="fdVrcNoteSaveBtn" class="vrcn-button vrcn-btn-primary" onclick="fdSaveNote()">${t('common.save', 'Save')}</button>
            </div>
        </div>`;

    let actionsHtml = '<div class="fd-actions">';
    const loc = (d.location || '').replace(/'/g, "\\'");
    const uid = (d.id || '').replace(/'/g, "\\'");
    const isBlocked = Array.isArray(blockedData) && blockedData.some(e => e.targetUserId === d.id);
    const isMuted   = Array.isArray(mutedData)   && mutedData.some(e => e.targetUserId === d.id);
    if (d.isFriend) {
        if (d.canJoin) actionsHtml += `<button class="vrcn-button-round vrcn-btn-join" onclick="friendAction('join','${loc}','${uid}')">${t('common.join', 'Join')}</button>`;
        if (d.canRequestInvite) actionsHtml += `<button class="vrcn-button-round" onclick="friendAction('requestInvite','${loc}','${uid}')">${t('profiles.actions.request_invite', 'Request Invite')}</button>`;
        const myInInstance = currentInstanceData && currentInstanceData.location && !currentInstanceData.empty && !currentInstanceData.error;
        if (myInInstance) actionsHtml += `<button class="vrcn-button-round" onclick="openFriendInviteModal('${uid}','${esc(d.displayName).replace(/'/g, "\\'")}')">${t('instance.actions.invite', 'Invite')}</button>`;
        const favFid = (d.favFriendId || '').replace(/'/g, "\\'");
        actionsHtml += `<button class="vrcn-button-round${d.isFavorited ? ' active' : ''}" id="fdFavBtn" onclick="toggleFriendFavPicker('${uid}')" title="${d.isFavorited ? t('profiles.actions.unfavorite', 'Unfavorite') : t('profiles.actions.favorite', 'Favorite')}" style="margin-left:auto;"><span class="msi" style="font-size:16px;">${d.isFavorited ? 'star' : 'star_outline'}</span></button>`;
    } else {
        actionsHtml += `<button class="vrcn-button-round vrcn-btn-primary" id="fdAddFriend" onclick="sendToCS({action:'vrcSendFriendRequest',userId:'${uid}'});this.disabled=true;this.textContent='${esc(t('profiles.actions.request_sent', 'Request Sent'))}';">${t('profiles.actions.add_friend', 'Add Friend')}</button>`;
    }
    actionsHtml += `<button class="vrcn-button-round vrcn-btn-danger${isMuted ? ' active' : ''}" id="fdMuteBtn" onclick="toggleMod('${uid}','mute',this)" title="${isMuted ? t('profiles.actions.unmute', 'Unmute') : t('profiles.actions.mute', 'Mute')}"><span class="msi" style="font-size:16px;">mic${isMuted ? '_off' : ''}</span></button>`;
    actionsHtml += `<button class="vrcn-button-round vrcn-btn-danger${isBlocked ? ' active' : ''}" id="fdBlockBtn" onclick="toggleMod('${uid}','block',this)" title="${isBlocked ? t('profiles.actions.unblock', 'Unblock') : t('profiles.actions.block', 'Block')}"><span class="msi" style="font-size:16px;">${isBlocked ? 'block' : 'shield'}</span></button>`;
    if (d.isFriend) actionsHtml += `<button class="vrcn-button-round vrcn-btn-danger" id="fdUnfriend" onclick="confirmUnfriend('${uid}','${esc(d.displayName).replace(/'/g, "\\'")}') " title="${t('profiles.actions.unfriend', 'Unfriend')}"><span class="msi" style="font-size:16px;">person_remove</span></button>`;
    actionsHtml += '</div>';
    const favPickerHtml = d.isFriend
        ? `<div id="fdFavPicker" style="display:none;margin-bottom:14px;">
            <div class="wd-section-label" style="margin-bottom:6px;">ADD TO FAVORITE GROUP</div>
            <div class="ci-group-list" id="fdFavGroupList"><div style="font-size:11px;color:var(--tx3);padding:8px 0;">Loading groups...</div></div>
           </div>` : '';

    let badgesHtml = '<div class="fd-badges-row">';
    const platBadge = getPlatformBadgeHtml(d.platform || d.lastPlatform || '');
    if (platBadge) badgesHtml += platBadge;
    if (d.isFriend) badgesHtml += `<span class="vrcn-badge ok"><span class="msi" style="font-size:11px;">check_circle</span>${t('profiles.badges.friend', 'Friend')}</span>`;
    if (d.ageVerified) badgesHtml += `<span class="vrcn-badge ok"><span class="msi" style="font-size:11px;">verified</span>18+</span>`;
    const rank = getTrustRank(d.tags || []);
    if (rank) badgesHtml += `<span class="vrcn-badge" style="background:${rank.color}22;color:${rank.color}">${esc(rank.label)}</span>`;
    if (d.id) badgesHtml += idBadge(d.id);
    badgesHtml += '</div>';

    const vrcPlusBadge = (d.tags || []).includes('system_supporter') ? `<span class="vrcn-supporter-badge">VRC+</span>` : '';
    const pronounsHtml = d.pronouns ? `<div class="fd-pronouns">${esc(d.pronouns)}</div>` : '';
    const langs = getLanguages(d.tags || []);
    const langsHtml = langs.length ? `<div class="fd-lang-tags">${langs.map(l => `<span class="vrcn-badge">${esc(l)}</span>`).join('')}</div>` : '';

    const allGroups = d.userGroups || [];
    let repG = d.representedGroup;
    if (!repG && allGroups.length > 0) {
        const repFromList = allGroups.find(g => g.isRepresenting);
        if (repFromList) repG = repFromList;
    }

    let repGroupBadgeHtml = '';
    if (repG && repG.id) {
        const badgeIcon = repG.iconUrl
            ? `<img class="fd-rep-group-badge-icon" src="${esc(repG.iconUrl)}" onerror="this.style.display='none'">`
            : `<span class="msi" style="font-size:13px;flex-shrink:0;">group</span>`;
        repGroupBadgeHtml = `<div class="fd-rep-group-badge" onclick="navOpenModal('group','${jsq(repG.id)}','${jsq(repG.name || '')}')">${badgeIcon}<span class="fd-rep-group-badge-name">${esc(repG.name || '')}</span></div>`;
    }

    const vrcBadges = d.badges || [];
    let vrcBadgesRowHtml = '';
    if (vrcBadges.length > 0) {
        vrcBadgesRowHtml = `<div class="fd-vrc-badges-row">${vrcBadges.map(b =>
            `<div class="fd-vrc-badge-wrap"` +
                ` data-badge-img="${esc(b.imageUrl)}"` +
                ` data-badge-name="${encodeURIComponent(b.name)}"` +
                ` data-badge-desc="${encodeURIComponent(b.description || '')}">` +
                `<img class="fd-vrc-badge-icon" src="${esc(b.imageUrl)}" alt="${esc(b.name)}" onerror="this.closest('.fd-vrc-badge-wrap').style.display='none'">` +
            `</div>`
        ).join('')}</div>`;
    }

    let repGroupInfoHtml = '';
    if (repG && repG.id) {
        const repIcon = repG.iconUrl ? `<img class="fd-group-icon" src="${repG.iconUrl}" onerror="this.style.display='none'">` : `<div class="fd-group-icon fd-group-icon-empty"><span class="msi" style="font-size:18px;">group</span></div>`;
        repGroupInfoHtml = `<div class="fd-group-rep-label">${t('profiles.badges.representing', 'Representing')}</div><div class="fd-group-card fd-group-rep" onclick="navOpenModal('group','${jsq(repG.id)}','${jsq(repG.name || '')}')">
            ${repIcon}<div class="fd-group-card-info"><div class="fd-group-card-name">${esc(repG.name)}</div><div class="fd-group-card-meta">${esc(repG.shortCode || '')}${repG.discriminator ? '.' + esc(repG.discriminator) : ''} &middot; ${esc(getGroupMemberText(repG.memberCount))}</div></div>
        </div>`;
    }

    window._fdRepGroup = (repG && repG.id) ? repG : null;
    window._fdAllGroups = allGroups;
    // Include repG if it's not already in allGroups (VRC API sometimes returns it separately)
    const _repInGroups = repG && allGroups.some(g => g.id === repG.id);
    window._fdAllGroupsAll = (!repG || _repInGroups) ? allGroups : [repG, ...allGroups];
    window._fdAllOwnGroups = allGroups.filter(g => g.ownerId === d.id);

    let groupsContent = '';
    if (window._fdAllGroupsAll.length > 0) {
        groupsContent += `<div class="search-bar-row" style="margin-bottom:6px;">
            <span class="msi search-ico">search</span>
            <input id="fdGroupsSearch" type="text" class="vrcn-input" placeholder="${esc(t('profiles.groups.search_placeholder', 'Search groups by name...'))}" style="background:var(--bg-input);" oninput="_dbFdGroups()">
        </div>`;
        const ownGroups = window._fdAllOwnGroups || [];
        if (ownGroups.length > 0) {
            groupsContent += `<div class="fd-group-rep-label">${t('profiles.groups.own_groups', 'Own Groups')}</div>`;
            groupsContent += `<div id="fdOwnGroupsGrid" style="display:grid;grid-template-columns:1fr 1fr 1fr;column-gap:6px;"></div>`;
            groupsContent += `<div id="fdOwnGroupsPaginatorBar" class="mini-paginator"></div>`;
        }
        groupsContent += `<div class="fd-group-rep-label" style="margin-top:${ownGroups.length > 0 ? '14' : '0'}px;">${t('profiles.badges.groups', 'Groups')}</div>`;
        groupsContent += `<div id="fdGroupsGrid" style="display:grid;grid-template-columns:1fr 1fr 1fr;column-gap:6px;"></div>`;
        groupsContent += `<div id="fdGroupsPaginatorBar" class="mini-paginator"></div>`;
    }

    if (!groupsContent) groupsContent = `<div style="padding:20px;text-align:center;font-size:12px;color:var(--tx3);">${t('profiles.badges.no_groups', 'No groups')}</div>`;

    const allMutuals = d.mutuals || [];
    const allMutualGroups = d.mutualGroups || [];
    const mutualTotal = allMutuals.length + allMutualGroups.length;
    window._fdAllMutuals = allMutuals;
    window._fdAllMutualGroups = allMutualGroups;

    let mutualsFriendsHtml = '';
    if (d.mutualsOptedOut) {
        mutualsFriendsHtml = `<div style="padding:24px 16px;text-align:center;font-size:12px;color:var(--tx3);">
            <span class="msi" style="font-size:28px;display:block;margin-bottom:8px;opacity:.5;">visibility_off</span>
            ${t('profiles.mutuals.opted_out', 'This user has disabled Shared Connections.')}
        </div>`;
    } else if (allMutuals.length === 0) {
        mutualsFriendsHtml = `<div style="padding:24px 16px;text-align:center;font-size:12px;color:var(--tx3);">
            <span class="msi" style="font-size:28px;display:block;margin-bottom:8px;opacity:.5;">group_off</span>
            ${t('profiles.mutuals.empty', 'No mutual friends found.')}<br>
            <span style="font-size:10px;margin-top:6px;display:block;line-height:1.5;">
                ${t('profiles.mutuals.empty_hint', 'Requires VRChat\'s "Shared Connections" feature to be active on both accounts.')}
            </span>
        </div>`;
    } else {
        mutualsFriendsHtml = `<div class="search-bar-row" style="margin-bottom:6px;">
            <span class="msi search-ico">search</span>
            <input id="fdMutualsSearch" type="text" class="vrcn-input" placeholder="${esc(t('profiles.mutuals.search_placeholder', 'Search users by name...'))}" style="background:var(--bg-input);" oninput="_dbFdMutuals()">
        </div>`;
        mutualsFriendsHtml += '<div id="fdMutualsGrid" style="display:grid;grid-template-columns:1fr 1fr 1fr;column-gap:6px;"></div>';
        mutualsFriendsHtml += '<div id="fdMutualsPageBar" class="mini-paginator"></div>';
    }

    let mutualsGroupsHtml = '';
    if (allMutualGroups.length === 0) {
        mutualsGroupsHtml = `<div style="padding:24px 16px;text-align:center;font-size:12px;color:var(--tx3);">
            <span class="msi" style="font-size:28px;display:block;margin-bottom:8px;opacity:.5;">group_off</span>
            ${t('profiles.mutuals.no_groups', 'No mutual groups found.')}
        </div>`;
    } else {
        mutualsGroupsHtml = `<div class="search-bar-row" style="margin-bottom:6px;">
            <span class="msi search-ico">search</span>
            <input id="fdMutualsGroupsSearch" type="text" class="vrcn-input" placeholder="${esc(t('profiles.mutuals.groups_search_placeholder', 'Search groups by name...'))}" style="background:var(--bg-input);" oninput="_dbFdMutualsGroups()">
        </div>`;
        mutualsGroupsHtml += '<div id="fdMutualsGroupsGrid" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;"></div>';
        mutualsGroupsHtml += '<div id="fdMutualsGroupsPageBar" class="mini-paginator"></div>';
    }

    const mutualsContent = `
        <div class="fd-content-pills">
            <button class="fd-tab fd-mutual-pill active" onclick="switchFdMutualsPill('friends',this)">${tf('profiles.mutuals.pill_friends', { count: allMutuals.length }, 'Friends ({count})')}</button>
            <button class="fd-tab fd-mutual-pill" onclick="switchFdMutualsPill('groups',this)">${tf('profiles.mutuals.pill_groups', { count: allMutualGroups.length }, 'Groups ({count})')}</button>
        </div>
        <div id="fdMutualsFriends">${mutualsFriendsHtml}</div>
        <div id="fdMutualsGroups" style="display:none;">${mutualsGroupsHtml}</div>`;

    const miniTlHtml = `<div class="fd-content-pills" style="margin-bottom:10px;">
            <button class="fd-tab fd-mini-tl-pill active" onclick="switchFdMiniTlPill('timeline',this)">${t('nav.timeline', 'Timeline')}</button>
            <button class="fd-tab fd-mini-tl-pill" onclick="switchFdMiniTlPill('activity',this)">${t('profiles.user_activity.title', 'Last Activity')}</button>
        </div>
        <div id="fdMiniTl" style="max-height:160px;overflow-y:auto;"></div>
        <div id="fdUserActivity" style="max-height:160px;overflow-y:auto;display:none;"></div>`;

    const bannerSrc = d.profilePicOverride || d.currentAvatarImageUrl || d.image || '';
    const bannerHtml = bannerSrc ? `<div class="fd-banner" id="fd-banner-slot"><div class="fd-banner-fade"></div></div>` : '';
    const fdHeaderActions = renderModalActions(_fdBuildTaskbarActions(d));

    const fdLocation = d.location || '';
    const fdIsOffline = (d.status || 'offline') === 'offline';
    const fdIsInGame = !fdIsOffline && !!fdLocation && fdLocation !== 'offline';
    const fdIsWeb = !fdIsOffline && !fdIsInGame && d.state === 'active';
    const fdDotClass = fdIsWeb ? 'vrc-status-ring' : 'vrc-status-dot';
    const fdStatusDotCls = fdIsOffline ? 's-offline' : statusDotClass(d.status);

    const trustSideHtml = rank ? `<div class="fd-group-rep-label">${t('profiles.trust.title', 'Trust &amp; Safety')}</div>
        <span class="vrcn-badge" style="background:${rank.color}22;color:${rank.color}">${esc(rank.label)}</span>
        <p style="margin:10px 0 0;font-size:12px;color:var(--tx3);line-height:1.45;">${t('profiles.trust.description', 'This user has a trusted user standing within the community.')}</p>` : '';

    const _fdInstFriends = (_worldPartHtml && d.location && d.location !== 'private' && d.location !== 'traveling')
        ? (typeof getInstanceMembers === 'function' ? getInstanceMembers(d.location) : []).filter(m => m.id !== d.id)
        : [];
    const _instFriendsHtml = _fdInstFriends.length > 0
        ? `<div class="fd-group-rep-label" style="margin-top:10px;">${tf('instance.sections.friends_in_instance', { count: _fdInstFriends.length }, 'FRIENDS IN INSTANCE ({count})')}</div>
           <div class="wd-friends-list" style="display:grid;grid-template-columns:1fr 1fr;max-height:none;">${_fdInstFriends.map(f => renderProfileItem(f, `navOpenModal('friend','${jsq(f.id || '')}','${jsq(f.displayName || '')}')`)).join('')}</div>`
        : '';

    const _currentWorldCard = _worldPartHtml ? `<div class="fd-info-card fd-world-card">
        <div class="fd-group-rep-label">${t('profiles.meta.current_world', 'Current World')}</div>
        ${_worldPartHtml}
        ${_instFriendsHtml}
    </div>` : '';
    const _ownerCard = _ownerPartHtml ? `<div class="fd-info-card fd-owner-card">
        <div class="fd-group-rep-label">${t('instance.owner', 'Instance Owner')}</div>
        ${_ownerPartHtml}
    </div>` : '';
    const _badgesCard = vrcBadgesRowHtml ? `<div class="fd-info-card">
        <div class="fd-group-rep-label">${t('profiles.badges.badges', 'Badges')}</div>
        ${vrcBadgesRowHtml}
    </div>` : '';
    const _bioCard = (d.bio || bioLinksHtml || langsHtml) ? `<div class="fd-info-card">
        <div class="fd-group-rep-label">${t('profiles.bio.title', 'Biography')}${d.bio ? `<button class="fd-bio-expand" onclick="fdToggleBio(this)" style="display:none"><span class="msi">chevron_right</span></button>` : ''}</div>
        ${bioHtml}${bioLinksHtml}${langsHtml}
    </div>` : '';
    const _noteCard = `<div class="fd-info-card">${vrcNoteHtml}</div>`;
    const _tlCard = `<div class="fd-info-card">${miniTlHtml}</div>`;
    const _infosCard = `<div class="fd-info-card">${_aboutRowsHtml}</div>`;
    const _trustCard = trustSideHtml ? `<div class="fd-info-card">${trustSideHtml}</div>` : '';
    const _modCard = `<div class="fd-info-card" id="fdModerationCard">${_buildModCardInner(d.id)}</div>`;
    const infoContent = `<div class="fd-info-wrap">
        <div class="fd-info-cols">
            <div class="fd-info-left">
                ${_currentWorldCard}${_badgesCard}${avatarRowHtml}${_bioCard}${_noteCard}
            </div>
            <div class="fd-info-right">
                ${_ownerCard}${_infosCard}${_trustCard}${_modCard}
            </div>
        </div>
        ${_tlCard}
    </div>`;

    const hasGroups = allGroups.length > 0 || repG;
    const hasMutuals = d.mutuals !== undefined;
    const allUserWorlds = d.userWorlds || [];
    const hasContent = true;
    const hasTabs = hasGroups || hasMutuals || hasContent;
    const groupsTabCount = (window._fdAllGroupsAll || allGroups).length;

    let tabsHtml = '';
    if (hasTabs) {
        tabsHtml = `<div class="fd-tabs"><button class="fd-tab active" onclick="switchFdTab('info',this)">${t('profiles.tabs.info', 'Info')}</button>`;
        if (hasGroups) tabsHtml += `<button class="fd-tab" onclick="switchFdTab('groups',this)">${tf('profiles.tabs.groups', { count: groupsTabCount }, 'Groups ({count})')}</button>`;
        if (hasMutuals) tabsHtml += `<button class="fd-tab" onclick="switchFdTab('mutuals',this)">${tf('profiles.tabs.mutuals', { count: mutualTotal }, 'Mutuals ({count})')}</button>`;
        tabsHtml += `<button class="fd-tab" id="fdTabContentBtn" onclick="switchFdTab('content',this)">${tf('profiles.tabs.content', { count: allUserWorlds.length }, 'Content ({count})')}</button>`;
        tabsHtml += `<button class="fd-tab" onclick="switchFdTab('favs',this)">${t('profiles.tabs.favs', 'Favs.')}</button>`;
        tabsHtml += `<button class="fd-tab" onclick="switchFdTab('json',this)">Json</button>`;
        tabsHtml += `</div>`;
    }

    window._fdAllWorlds = allUserWorlds;
    window._fdWorldsPage = 0;

    const userId = d.id || '';
    const contentHtml = `
        <div class="fd-content-pills">
            <button class="fd-tab fd-content-pill active" id="fdWorldsPill" onclick="switchFdContentPill('worlds',this)">${tf('profiles.content.worlds_pill', { count: allUserWorlds.length }, 'Worlds ({count})')}</button>
            <button class="fd-tab fd-content-pill" id="fdAvatarsPill" onclick="switchFdContentPill('avatars',this)">${tf('profiles.content.avatars_pill', { count: 0 }, 'Avatars (0)')}</button>
        </div>
        <div id="fdContentWorlds">
            <div id="fdWorldsGrid"></div>
            <div id="fdWorldsPageBar" class="mini-paginator"></div>
        </div>
        <div id="fdContentAvatars" style="display:none;" data-user-id="${esc(userId)}">
            <div id="fdAvatarsGrid"><div class="empty-msg">${t('profiles.content.loading_avatars', 'Loading avatars...')}</div></div>
            <div id="fdAvatarsPageBar" class="mini-paginator"></div>
        </div>`;

    c.innerHTML = `${fdHeaderActions}${bannerHtml}<div class="fd-content${bannerSrc ? ' fd-has-banner' : ''}"><div class="fd-header">${imgTag}<div><div class="fd-name" style="display:flex;align-items:center;gap:6px;">${esc(d.displayName)}${vrcPlusBadge}</div>${pronounsHtml}<div class="fd-status-row"><div class="fd-status" id="fd-live-status"><span class="${fdDotClass} ${fdStatusDotCls}" style="width:8px;height:8px;"></span>${fdIsOffline ? t('status.offline', 'Offline') : statusLabel(d.status)}${(!fdIsOffline && fdIsWeb) ? ' ' + t('profiles.friends.web_suffix', '(Web)') : ''}${(!fdIsOffline && d.statusDescription) ? ' - ' + esc(d.statusDescription) : ''}</div>${repGroupBadgeHtml}</div></div></div>${badgesHtml}${actionsHtml}${favPickerHtml}${tabsHtml}<div id="fdTabInfo">${infoContent}</div><div id="fdTabGroups" style="display:none;">${groupsContent}</div><div id="fdTabMutuals" style="display:none;">${mutualsContent}</div><div id="fdTabContent" style="display:none;">${contentHtml}</div><div id="fdTabFavs" style="display:none;" data-user-id="${esc(userId)}"></div><div id="fdTabJson" style="display:none;"><div class="json-viewer">${jsonHighlight((d.id && _fdRawJsonCache[d.id]) || {})}</div></div></div>`;

    if (bannerSrc) {
        const bannerSlot = document.getElementById('fd-banner-slot');
        const bannerImg = _getFdBannerImg(d.id, bannerSrc);
        if (bannerSlot && bannerImg) bannerSlot.insertBefore(bannerImg, bannerSlot.firstChild);
    }

    // Populate paginated grids
    filterFdGroups();
    filterFdOwnGroups();
    filterFdMutuals();
    filterFdMutualsGroups();
    renderFdWorldsPage(0);

    const _avatarKey = avatarFileId || avatarId;
    const ca = d.cachedAvatar;
    if (ca?.avatarId && ca.fileId === avatarFileId) {
        _fdLastAvatarPayload = { avatarId: ca.avatarId, avatarName: ca.name, avatarAuthor: ca.authorName };
        _applyAvatarSection(_fdLastAvatarPayload);
        _fdLoadedAvatarKey = _avatarKey;
    } else if (_fdLastAvatarPayload) {
        _applyAvatarSection(_fdLastAvatarPayload);
    }
    if (_avatarKey && _avatarKey !== _fdLoadedAvatarKey) {
        _fdLoadedAvatarKey = _avatarKey;
        if (avatarFileId) sendToCS({ action: 'vrcLookupAvatarByFileId', fileId: avatarFileId, openModal: false, userId: d.id });
        else if (avatarId && avatarId.startsWith('avtr_')) sendToCS({ action: 'vrcGetAvatarInfo', avatarId });
    }

    requestAnimationFrame(() => {
        const bio = c.querySelector('.fd-bio');
        const btn = c.querySelector('.fd-bio-expand');
        if (bio && btn && bio.scrollHeight > bio.clientHeight + 2) btn.style.display = '';
    });

    c.querySelectorAll('.fd-group-card-meta').forEach(el => {
        let text = (el.textContent || '').replace(/\s*(?:Â·|·)\s*/g, ' · ').trim();
        text = text.replace(/(\d+)\s+members/gi, (_, count) => tf('worlds.groups.members', { count }, '{count} members'));
        text = text.replace(/\bGroup\b/g, t('groups.common.group', 'Group'));
        el.textContent = text;
    });
    c.querySelectorAll('.s-card-sub').forEach(el => {
        el.innerHTML = el.innerHTML.replace(/Â·/g, '&middot;').replace(/·/g, '&middot;');
    });

    if (userId) sendToCS({ action: 'vrcGetUserAvatars', userId: userId });
    if (userId) { _fdTimelineEvents = []; sendToCS({ action: 'getTimelineForUser', userId }); }
    if (userId) sendToCS({ action: 'getFriendActivityForUser', userId });

    if (_fdLiveTimer) { clearInterval(_fdLiveTimer); _fdLiveTimer = null; }
    if (d.inSameInstance && !(currentVrcUser && d.id === currentVrcUser.id)) {
        let liveSecs = d.totalTimeSeconds;
        _fdLiveTimer = setInterval(() => {
            liveSecs++;
            const el = document.getElementById('fdTimeTogether');
            if (el) el.textContent = formatDuration(liveSecs);
            else { clearInterval(_fdLiveTimer); _fdLiveTimer = null; }
        }, 1000);
    }
}

function patchFriendDetailLive(f) {
    if (!currentFriendDetail || currentFriendDetail.id !== f.id) return;
    const c = document.getElementById('friendDetailContent');
    if (!c) return;

    // displayName
    if (f.displayName) {
        const nameEl = c.querySelector('.fd-name');
        if (nameEl) {
            const plusBadge = nameEl.querySelector('.vrcn-supporter-badge');
            nameEl.textContent = f.displayName;
            if (plusBadge) nameEl.appendChild(plusBadge);
            currentFriendDetail.displayName = f.displayName;
        }
    }

    // avatar image
    if (f.image) {
        const avatarEl = c.querySelector('.fd-avatar');
        if (avatarEl?.tagName === 'IMG') avatarEl.src = f.image;
        currentFriendDetail.image = f.image;
    }

    // bio
    if (f.bio !== undefined) {
        const bioEl = c.querySelector('.fd-bio');
        if (bioEl) bioEl.textContent = f.bio;
        currentFriendDetail.bio = f.bio;
    }

    // pronouns
    if (f.pronouns !== undefined) {
        const prEl = c.querySelector('.fd-pronouns');
        if (prEl) prEl.textContent = f.pronouns;
        currentFriendDetail.pronouns = f.pronouns;
    }

    // bio links
    if (f.bioLinks) {
        const linksEl = c.querySelector('.fd-bio-links');
        if (linksEl) linksEl.innerHTML = f.bioLinks.map(u => renderBioLink(u)).join('');
        currentFriendDetail.bioLinks = f.bioLinks;
    }

    // tags → trust rank badge + language tags
    if (f.tags) {
        const langEl = c.querySelector('.fd-lang-tags');
        if (langEl) {
            const langs = getLanguages(f.tags);
            langEl.innerHTML = langs.map(l => `<span class="vrcn-badge">${esc(l)}</span>`).join('');
        }
        const badgesRow = c.querySelector('.fd-badges-row');
        if (badgesRow) {
            const rank = getTrustRank(f.tags);
            const platBadge = getPlatformBadgeHtml(f.platform || f.lastPlatform || currentFriendDetail.lastPlatform || '');
            const ageVerified = f.ageVerified ?? currentFriendDetail.ageVerified;
            let html = '';
            if (platBadge) html += platBadge;
            if (currentFriendDetail.isFriend) html += `<span class="vrcn-badge ok"><span class="msi" style="font-size:11px;">check_circle</span>${t('profiles.badges.friend', 'Friend')}</span>`;
            if (ageVerified) html += `<span class="vrcn-badge ok"><span class="msi" style="font-size:11px;">verified</span>18+</span>`;
            if (rank) html += `<span class="vrcn-badge" style="background:${rank.color}22;color:${rank.color}">${esc(rank.label)}</span>`;
            if (f.id) html += idBadge(f.id);
            badgesRow.innerHTML = html;
        }
        currentFriendDetail.tags = f.tags;
    }

    // banner (profilePicOverride / currentAvatarImageUrl)
    if (f.profilePicOverride !== undefined || f.currentAvatarImageUrl !== undefined) {
        const newSrc = f.profilePicOverride || f.currentAvatarImageUrl || currentFriendDetail.profilePicOverride || currentFriendDetail.currentAvatarImageUrl || '';
        if (newSrc) _getFdBannerImg(f.id, newSrc);
        if (f.profilePicOverride !== undefined) currentFriendDetail.profilePicOverride = f.profilePicOverride;
        if (f.currentAvatarImageUrl !== undefined) currentFriendDetail.currentAvatarImageUrl = f.currentAvatarImageUrl;
    }

    // VRC badges
    if (f.badges && Array.isArray(f.badges) && f.badges.length > 0) {
        const vrcBadgesRow = c.querySelector('.fd-vrc-badges-row');
        if (vrcBadgesRow) {
            vrcBadgesRow.innerHTML = f.badges.map(b => {
                const imgUrl = b.imageUrl || b.badgeImageUrl || '';
                const name   = b.name || b.badgeName || '';
                const desc   = b.description || b.badgeDescription || '';
                return `<div class="fd-vrc-badge-wrap" data-badge-img="${esc(imgUrl)}" data-badge-name="${encodeURIComponent(name)}" data-badge-desc="${encodeURIComponent(desc)}">
                    <img class="fd-vrc-badge-icon" src="${esc(imgUrl)}" alt="${esc(name)}" onerror="this.closest('.fd-vrc-badge-wrap').style.display='none'">
                </div>`;
            }).join('');
        }
        currentFriendDetail.badges = f.badges;
    }

    // current world + instance owner
    if (f.location !== undefined) {
        const loc          = f.location || '';
        const worldName    = f.worldName || '';
        const worldThumb   = f.worldThumb || '';
        const instanceType = f.instanceType || '';
        const isOfflineOrPrivate = loc === 'offline' || loc === 'private' || loc === '';
        const isTraveling        = loc === 'traveling';

        if (isTraveling) {
            // user is switching — wait for the follow-up push with the new world name
        } else if (isOfflineOrPrivate) {
            c.querySelector('.fd-world-card')?.remove();
            c.querySelector('.fd-owner-card')?.remove();
            currentFriendDetail.location = loc;
            currentFriendDetail.worldName = '';
        } else if (worldName) {
            // world name is known — update both cards
            const { worldId: wid, ownerId: newOwnerId } = parseFriendLocation(loc);
            const instId     = loc.includes(':') ? (loc.split(':')[1] || '').split('~')[0] : '';
            const regionRaw  = (loc.match(/~region\(([^)]+)\)/) || [])[1] || '';
            const region     = regionRaw ? getWorldRegionLabel(regionRaw) : '';
            const onclick    = wid ? `navOpenModal('worldSearch','${jsq(wid)}','${jsq(worldName)}')` : '';

            const instanceItemHtml = renderInstanceItem({
                thumb: worldThumb, worldName, instanceType,
                instanceId: instId, region, userCount: 0, capacity: 0,
                ageGate: loc.includes('~ageGate'), onclick,
            });
            const worldInner = `<div class="fd-group-rep-label">${t('profiles.meta.current_world', 'Current World')}</div>${instanceItemHtml}`;

            const existingWorldCard = c.querySelector('.fd-world-card');
            if (existingWorldCard) {
                existingWorldCard.innerHTML = worldInner;
            } else {
                const newCard = document.createElement('div');
                newCard.className = 'fd-info-card fd-world-card';
                newCard.innerHTML = worldInner;
                const topRow  = c.querySelector('.fd-info-top-row');
                const infoWrap = c.querySelector('.fd-info-wrap');
                if (topRow) topRow.insertBefore(newCard, topRow.firstChild);
                else if (infoWrap) infoWrap.insertBefore(newCard, infoWrap.firstChild);
            }

            // owner card
            const existingOwnerCard = c.querySelector('.fd-owner-card');
            if (newOwnerId && newOwnerId.startsWith('usr_')) {
                const ownerUser = vrcFriendsData.find(fu => fu.id === newOwnerId);
                const ownerBody = ownerUser
                    ? renderProfileItem(ownerUser, `navOpenModal('friend','${jsq(ownerUser.id)}','${jsq(ownerUser.displayName || '')}')`, { noWorld: true })
                    : `<div id="fdOwnerSlot" data-owner-id="${esc(newOwnerId)}"><div class="sk-block" style="height:44px;border-radius:8px;"></div></div>`;
                const ownerInner = `<div class="fd-group-rep-label">${t('instance.owner', 'Instance Owner')}</div>${ownerBody}`;
                if (existingOwnerCard) {
                    existingOwnerCard.innerHTML = ownerInner;
                } else {
                    const newOwnerCard = document.createElement('div');
                    newOwnerCard.className = 'fd-info-card fd-owner-card';
                    newOwnerCard.innerHTML = ownerInner;
                    const worldCard = c.querySelector('.fd-world-card');
                    const existingTopRow = c.querySelector('.fd-info-top-row');
                    if (existingTopRow) {
                        existingTopRow.appendChild(newOwnerCard);
                    } else if (worldCard) {
                        // world card is standalone — wrap both into fd-info-top-row
                        const row = document.createElement('div');
                        row.className = 'fd-info-top-row';
                        worldCard.parentNode.insertBefore(row, worldCard);
                        row.appendChild(worldCard);
                        row.appendChild(newOwnerCard);
                    }
                }
                if (!ownerUser) sendToCS({ action: 'vrcGetUserBasic', userId: newOwnerId, contextId: f.id });
            } else if (existingOwnerCard) {
                const ownerParent = existingOwnerCard.parentNode;
                existingOwnerCard.remove();
                // if world card was in a fd-info-top-row, unwrap it so it goes full width
                const topRow = c.querySelector('.fd-info-top-row');
                if (topRow) {
                    const worldCard = topRow.querySelector('.fd-world-card');
                    if (worldCard) topRow.parentNode.insertBefore(worldCard, topRow);
                    topRow.remove();
                }
            }

            currentFriendDetail.location     = loc;
            currentFriendDetail.worldName    = worldName;
            currentFriendDetail.worldThumb   = worldThumb;
            currentFriendDetail.instanceType = instanceType;
        }
        // if worldName is still empty (cache miss on first push) — no-op, wait for second push
    }
}

function renderFdTimeline(userId, events) {
    if (!currentFriendDetail || currentFriendDetail.id !== userId) return;
    const el = document.getElementById('fdMiniTl');
    if (!el) return;

    _fdTimelineEvents = events || [];

    if (!_fdTimelineEvents.length) {
        el.innerHTML = `<div style="padding:4px 0;font-size:12px;color:var(--tx3);">${t('timeline.empty.initial', 'No events yet')}</div>`;
        return;
    }

    el.innerHTML = _fdTimelineEvents.map(ev => {
        const meta   = typeof tlTypeMeta === 'function' ? tlTypeMeta(ev.type) : { icon: 'event', label: ev.type };
        const color  = { instance_join:'var(--accent)', photo:'var(--ok)', first_meet:'var(--cyan)', meet_again:'#AB47BC', notification:'var(--warn)', avatar_switch:'#FF7043', video_url:'#29B6F6' }[ev.type] || 'var(--tx3)';
        const d      = new Date(ev.timestamp);
        const dt     = `${fmtShortDate(d)} | ${fmtTime(d)}`;
        const ei     = ev.id.replace(/'/g, "\\'");
        const detail = typeof _tlListData === 'function' ? (_tlListData(ev).detail || '') : '';
        return `<div style="display:flex;align-items:center;gap:8px;padding:5px 2px;border-bottom:1px solid var(--brd);cursor:pointer;" onclick="openTlDetail('${ei}')">
            <span style="font-size:11px;color:var(--tx3);white-space:nowrap;">${esc(dt)}</span>
            <span class="msi" style="font-size:14px;color:${color};flex-shrink:0;">${meta.icon}</span>
            <span style="font-size:12px;">${esc(meta.label)}</span>
            ${detail ? `<span style="font-size:11px;color:var(--tx2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;">${detail}</span>` : ''}
        </div>`;
    }).join('');
}

function renderFdUserActivity(userId, events) {
    if (!currentFriendDetail || currentFriendDetail.id !== userId) return;
    const el = document.getElementById('fdUserActivity');
    if (!el) return;

    if (!events || !events.length) {
        el.innerHTML = `<div style="padding:4px 0;font-size:12px;color:var(--tx3);">${t('profiles.user_activity.empty', 'No activity recorded yet')}</div>`;
        return;
    }

    _fdUserActivityEvents = events;

    const FT_COLOR = { friend_gps:'var(--accent)', friend_status:'var(--cyan)', friend_statusdesc:'var(--cyan)', friend_online:'var(--ok)', friend_offline:'var(--tx3)', friend_bio:'#AB47BC', friend_added:'var(--ok)', friend_removed:'var(--err)' };

    el.innerHTML = events.map(ev => {
        const meta   = typeof ftTypeMeta === 'function' ? ftTypeMeta(ev.type) : { icon: 'circle', label: ev.type };
        const color  = FT_COLOR[ev.type] || 'var(--tx3)';
        const d      = new Date(ev.timestamp);
        const dt     = `${fmtShortDate(d)} | ${fmtTime(d)}`;
        const ei     = jsq(ev.id);
        const detail = typeof _ftListDetail === 'function' ? (_ftListDetail(ev) || '') : '';
        return `<div style="display:flex;align-items:center;gap:8px;padding:5px 2px;border-bottom:1px solid var(--brd);cursor:pointer;" onclick="openFdActivityDetail('${ei}')">
            <span style="font-size:11px;color:var(--tx3);white-space:nowrap;">${esc(dt)}</span>
            <span class="msi" style="font-size:14px;color:${color};flex-shrink:0;">${meta.icon}</span>
            <span style="font-size:12px;">${esc(meta.label)}</span>
            ${detail ? `<span style="font-size:11px;color:var(--tx2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;">${detail}</span>` : ''}
        </div>`;
    }).join('');
}

function switchFdMiniTlPill(pill, btn) {
    const tl = document.getElementById('fdMiniTl');
    const ua = document.getElementById('fdUserActivity');
    if (tl) tl.style.display = pill === 'timeline'  ? '' : 'none';
    if (ua) ua.style.display = pill === 'activity' ? '' : 'none';
    document.querySelectorAll('.fd-mini-tl-pill').forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');
}

function friendAction(action, location, userId) {
    const btnContainer = document.querySelector('.fd-actions');
    if (btnContainer) btnContainer.querySelectorAll('button').forEach(b => b.disabled = true);
    if (action === 'join') sendToCS({ action: 'vrcJoinFriend', location: location });
    else if (action === 'invite') sendToCS({ action: 'vrcInviteFriend', userId: userId });
    else if (action === 'requestInvite') sendToCS({ action: 'vrcRequestInvite', userId: userId });
}

function confirmUnfriend(userId, displayName) {
    const btn = document.getElementById('fdUnfriend');
    if (!btn) return;
    if (btn.dataset.confirm) {
        btn.disabled = true;
        btn.innerHTML = '<span class="msi" style="font-size:14px;">hourglass_empty</span>';
        sendToCS({ action: 'vrcUnfriend', userId: userId });
    } else {
        btn.dataset.confirm = '1';
        btn.innerHTML = `<span style="font-size:11px;font-weight:600;">${t('profiles.actions.confirm', 'Confirm?')}</span>`;
        setTimeout(() => {
            if (btn && !btn.disabled) {
                delete btn.dataset.confirm;
                btn.innerHTML = '<span class="msi" style="font-size:16px;">person_remove</span>';
            }
        }, 4000);
    }
}

function toggleFriendFavPicker(userId) {
    const entry = favFriendsData.find(f => f.favoriteId === userId);
    if (entry) {
        const btn = document.getElementById('fdFavBtn');
        if (btn) btn.disabled = true;
        sendToCS({ action: 'vrcRemoveFavoriteFriend', userId, fvrtId: entry.fvrtId });
        return;
    }
    const picker = document.getElementById('fdFavPicker');
    if (!picker) return;
    const open = picker.style.display !== 'none';
    picker.style.display = open ? 'none' : '';
    if (!open) renderFriendFavPicker(userId);
}

function renderFriendFavPicker(userId) {
    const list = document.getElementById('fdFavGroupList');
    if (!list) return;
    if (favFriendGroups.length === 0) {
        list.innerHTML = `<div style="font-size:11px;color:var(--tx3);padding:8px 0;">Loading groups...</div>`;
        sendToCS({ action: 'vrcGetFriendFavGroups' });
        list.dataset.pendingUserId = userId;
        return;
    }
    const currentEntry = favFriendsData.find(f => f.favoriteId === userId);
    const currentGroup = currentEntry?.groupName || '';
    list.innerHTML = favFriendGroups.map(g => {
        const count = favFriendsData.filter(f => f.groupName === g.name).length;
        const cap = g.capacity || 150;
        const isCurrent = g.name === currentGroup;
        const check = isCurrent
            ? `<span class="msi" style="color:var(--accent);font-size:18px;flex-shrink:0;">check_circle</span>`
            : '';
        const gn = jsq(g.name), uid = jsq(userId);
        const oldFvrt = isCurrent ? jsq(currentEntry?.fvrtId || '') : '';
        return `<div class="fd-group-card ci-group-card${isCurrent ? ' ci-group-selected' : ''}"
            onclick="addFriendToFavGroup('${uid}','${gn}','${oldFvrt}',this)" style="cursor:pointer;">
            <div style="flex:1;min-width:0;">
                <div style="font-size:12px;font-weight:600;color:var(--tx1);">${esc(g.displayName || g.name)}</div>
                <div style="font-size:10px;color:var(--tx3);margin-top:1px;">${count}/${cap} friends</div>
            </div>
            ${check}
        </div>`;
    }).join('');
}

function addFriendToFavGroup(userId, groupName, oldFvrtId, rowEl) {
    document.querySelectorAll('#fdFavGroupList .ci-group-card').forEach(c => {
        c.classList.remove('ci-group-selected');
        const chk = c.querySelector('.msi');
        if (chk && chk.textContent === 'check_circle') chk.remove();
    });
    rowEl.classList.add('ci-group-selected');
    rowEl.insertAdjacentHTML('beforeend', '<span class="msi" style="color:var(--accent);font-size:18px;flex-shrink:0;">check_circle</span>');
    if (oldFvrtId) {
        sendToCS({ action: 'vrcAddFavoriteFriendToGroup', userId, groupName, oldFvrtId });
    } else {
        sendToCS({ action: 'vrcAddFavoriteFriend', userId, groupName });
    }
}

function handleFavFriendToggled(payload) {
    const { userId, fvrtId, isFavorited, groupName } = payload;
    favFriendsData = favFriendsData.filter(f => f.favoriteId !== userId);
    if (isFavorited) favFriendsData.push({ fvrtId, favoriteId: userId, groupName: groupName || 'group_0' });
    const btn = document.getElementById('fdFavBtn');
    if (btn) {
        btn.disabled = false;
        btn.classList.toggle('active', isFavorited);
        btn.title = isFavorited ? t('profiles.actions.unfavorite', 'Unfavorite') : t('profiles.actions.favorite', 'Favorite');
        btn.innerHTML = `<span class="msi" style="font-size:16px;">${isFavorited ? 'star' : 'star_outline'}</span>`;
    }
    const picker = document.getElementById('fdFavPicker');
    if (isFavorited) {
        if (picker && picker.style.display !== 'none') renderFriendFavPicker(userId);
    } else {
        if (picker) picker.style.display = 'none';
    }
    filterFavFriends();
    renderVrcFriends(vrcFriendsData);
    _scheduleBgFavFriendRefresh();
}

function handleFriendFavoriteResult(data) {
    if (data.ok) {
        const entry = favFriendsData.find(f => f.favoriteId === data.userId);
        if (entry) {
            entry.groupName = data.groupName;
            entry.fvrtId   = data.newFvrtId;
        }
        const group = (typeof favFriendGroups !== 'undefined') && favFriendGroups.find(g => g.name === data.groupName);
        const groupLabel = group?.displayName || data.groupName;
        showToast(true, `Moved to ${groupLabel}`);
        const list = document.getElementById('fdFavGroupList');
        if (list && document.getElementById('fdFavPicker')?.style.display !== 'none') renderFriendFavPicker(data.userId);
        filterFavFriends();
        _scheduleBgFavFriendRefresh();
    } else {
        const list = document.getElementById('fdFavGroupList');
        if (list) {
            list.innerHTML = `<div style="font-size:11px;color:var(--err,#e55);padding:6px 0;">Failed to move. Try again.</div>`;
            setTimeout(() => { if (document.getElementById('fdFavGroupList')) renderFriendFavPicker(data.userId); }, 1800);
        }
    }
}

function onFriendFavGroupsLoaded(groups) {
    favFriendGroups = groups;
    const list = document.getElementById('fdFavGroupList');
    if (list?.dataset.pendingUserId) {
        const uid = list.dataset.pendingUserId;
        delete list.dataset.pendingUserId;
        renderFriendFavPicker(uid);
    }
}

function toggleMod(userId, type, btn) {
    const isActive = btn.classList.contains('active');
    sendToCS({ action: isActive
        ? (type === 'block' ? 'vrcUnblock' : 'vrcUnmute')
        : (type === 'block' ? 'vrcBlock'   : 'vrcMute'),
        userId });
}

function _buildModCardInner(userId) {
    const isBlocked     = Array.isArray(blockedData)      && blockedData.some(x => x.targetUserId === userId);
    const isMuted       = Array.isArray(mutedData)        && mutedData.some(x => x.targetUserId === userId);
    const isChatMuted   = Array.isArray(muteChatData)     && muteChatData.some(x => x.targetUserId === userId);
    const isAvatarHid   = Array.isArray(hiddenAvatarData) && hiddenAvatarData.some(x => x.targetUserId === userId);
    const isInteractOff = Array.isArray(interactOffData)  && interactOffData.some(x => x.targetUserId === userId);
    const _row = (label, active, activeKey, activeFb, inactiveKey, inactiveFb) =>
        `<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;font-size:11px;">
            <span style="color:var(--tx3);">${label}</span>
            <span style="color:${active ? 'var(--err)' : 'var(--tx1)'};text-align:right;">${active ? t(activeKey, activeFb) : t(inactiveKey, inactiveFb)}</span>
        </div>`;
    return `<div class="fd-group-rep-label">${t('profiles.moderation.title', 'Moderation')}</div>
        <div style="display:grid;gap:6px;">
            ${_row(t('profiles.moderation.status','Status'),       isBlocked,     'profiles.moderation.blocked',     'Blocked',   'profiles.moderation.not_blocked','Not Blocked')}
            ${_row(t('profiles.moderation.voice','Voice'),         isMuted,       'profiles.moderation.muted',       'Muted',     'profiles.moderation.not_muted',  'Not Muted')}
            ${_row(t('profiles.moderation.chat','Chat'),           isChatMuted,   'profiles.moderation.muted',       'Muted',     'profiles.moderation.not_muted',  'Not Muted')}
            ${_row(t('profiles.moderation.avatar','Avatar'),       isAvatarHid,   'profiles.moderation.hidden',      'Hidden',    'profiles.moderation.shown',      'Shown')}
            ${_row(t('profiles.moderation.interactions','Interactions'), isInteractOff, 'profiles.moderation.off', 'Off',       'profiles.moderation.on',         'On')}
        </div>`;
}

function renderFdModerationCard(userId) {
    const card = document.getElementById('fdModerationCard');
    if (card) card.innerHTML = _buildModCardInner(userId);
}

function _fdBuildTaskbarActions(d) {
    const _fid  = jsq(d.id || '');
    const _mBlk = Array.isArray(blockedData)      && blockedData.some(x => x.targetUserId === d.id);
    const _mMut = Array.isArray(mutedData)        && mutedData.some(x => x.targetUserId === d.id);
    const _mCht = Array.isArray(muteChatData)     && muteChatData.some(x => x.targetUserId === d.id);
    const _mAvt = Array.isArray(hiddenAvatarData) && hiddenAvatarData.some(x => x.targetUserId === d.id);
    const _mInt = Array.isArray(interactOffData)  && interactOffData.some(x => x.targetUserId === d.id);
    const _invG = (typeof myGroups !== 'undefined') ? myGroups.filter(g => g.canInvite === true) : [];
    const _moreItems = [
        d.isFriend ? { icon: 'waving_hand', label: t('context_menu.friend.boop', 'Boop!'), onclick: `(typeof msgrRegisterBoopSent==='function'&&msgrRegisterBoopSent('${_fid}'));sendToCS({action:'vrcBoop',userId:'${_fid}'})` } : null,
        (d.isFriend && _invG.length) ? { icon: 'group_add', label: t('context_menu.friend.invite_group', 'Invite to Group'), submenu: _invG.map(g => ({ icon: 'group', label: g.name || g.id, onclick: `sendToCS({action:'vrcInviteToGroup',groupId:'${jsq(g.id)}',userIds:['${_fid}']});showToast(true,t('context_menu.friend.invite_group_sent','Invite sent!'))` })) } : null,
        { icon: 'shield_person', label: t('context_menu.friend.moderate', 'Moderate'), submenu: [
            { icon: _mBlk ? 'lock_open' : 'block',           label: _mBlk ? t('context_menu.friend.unblock', 'Unblock')                  : t('context_menu.friend.block', 'Block'),                       onclick: `sendToCS({action:'${_mBlk ? 'vrcUnblock' : 'vrcBlock'}',userId:'${_fid}'})` },
            { icon: _mMut ? 'mic' : 'mic_off',               label: _mMut ? t('context_menu.friend.unmute', 'Unmute')                    : t('context_menu.friend.mute', 'Mute'),                         onclick: `sendToCS({action:'${_mMut ? 'vrcUnmute' : 'vrcMute'}',userId:'${_fid}'})` },
            { icon: _mCht ? 'chat' : 'comments_disabled',    label: _mCht ? t('context_menu.friend.unmute_chat', 'Unmute Chat')           : t('context_menu.friend.mute_chat', 'Mute Chat'),               onclick: `sendToCS({action:'${_mCht ? 'vrcUnmuteChat' : 'vrcMuteChat'}',userId:'${_fid}'})` },
            { icon: _mAvt ? 'visibility' : 'visibility_off', label: _mAvt ? t('context_menu.friend.show_avatar', 'Show Avatar')           : t('context_menu.friend.hide_avatar', 'Hide Avatar'),           onclick: `sendToCS({action:'${_mAvt ? 'vrcShowAvatar' : 'vrcHideAvatar'}',userId:'${_fid}'})` },
            { icon: _mInt ? 'touch_app' : 'do_not_touch',    label: _mInt ? t('context_menu.friend.interact_on', 'Turn On Interactions') : t('context_menu.friend.interact_off', 'Turn Off Interactions'), onclick: `sendToCS({action:'${_mInt ? 'vrcInteractOn' : 'vrcInteractOff'}',userId:'${_fid}'})` },
        ] },
    ].filter(Boolean);
    const out = [
        { icon: 'share', title: t('common.share', 'Share'), label: t('common.share_profile', 'Share Profile'), onclick: `navigator.clipboard.writeText('https://vrchat.com/home/user/${esc(d.id)}').then(()=>showToast(true,t('common.link_copied','Link copied!')))` },
    ];
    if (_moreItems.length) out.push({ label: t('common.more', 'More'), dropdown: _moreItems });
    out.push({ icon: 'close', title: t('common.close', 'Close'), onclick: `closeFriendDetail()`, header: true });
    return out;
}

function refreshFdTaskbarActions() {
    if (!currentFriendDetail || typeof refreshModalActions !== 'function') return;
    const md = document.getElementById('modalFriendDetail');
    if (!md || md.style.display === 'none') return;
    refreshModalActions(_fdBuildTaskbarActions(currentFriendDetail));
}

function handleUserBasic(payload) {
    const slot = document.getElementById('fdOwnerSlot');
    if (!slot || slot.dataset.ownerId !== payload.id) return;
    if (!currentFriendDetail || currentFriendDetail.id !== payload.contextId) return;
    const onclick = `navOpenModal('friend','${jsq(payload.id)}','${jsq(payload.displayName || '')}')`;
    slot.outerHTML = renderProfileItem(payload, onclick, { noWorld: true });
}

// Global VRC badge tooltip (position: fixed, escapes modal overflow)
(function () {
    let tip = null;

    function getTip() {
        if (!tip) {
            tip = document.createElement('div');
            tip.className = 'fd-vrc-badge-tooltip-global';
            document.body.appendChild(tip);
        }
        return tip;
    }

    document.addEventListener('mouseover', function (e) {
        const wrap = e.target.closest('.fd-vrc-badge-wrap');
        if (!wrap) return;
        const t = getTip();
        const img  = wrap.dataset.badgeImg  || '';
        const name = decodeURIComponent(wrap.dataset.badgeName || '');
        const desc = decodeURIComponent(wrap.dataset.badgeDesc || '');
        t.innerHTML =
            `<img class="fd-vrc-badge-tip-img" src="${esc(img)}" alt="">` +
            `<div class="fd-vrc-badge-tip-text">` +
                `<div class="fd-vrc-badge-tip-name">${esc(name)}</div>` +
                (desc ? `<div class="fd-vrc-badge-tip-desc">${esc(desc)}</div>` : '') +
            `</div>`;

        t.style.opacity = '0';
        t.style.display = 'flex';
        const tw = t.offsetWidth;
        const th = t.offsetHeight;

        const rect = wrap.getBoundingClientRect();
        let x = rect.left + rect.width / 2 - tw / 2;
        let y = rect.top - th - 8;

        x = Math.max(8, Math.min(window.innerWidth - tw - 8, x));
        if (y < 8) y = rect.bottom + 8;

        t.style.left = x + 'px';
        t.style.top  = y + 'px';
        t.style.opacity = '1';
    });

    document.addEventListener('mouseout', function (e) {
        const wrap = e.target.closest('.fd-vrc-badge-wrap');
        if (!wrap) return;
        if (wrap.contains(e.relatedTarget)) return;
        if (tip) tip.style.opacity = '0';
    });
}());
