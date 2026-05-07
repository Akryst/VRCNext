/* === My Instance Modal === */
const _instanceDetailCache = {};

function closeMyInstanceDetail(silent) {
    document.getElementById('modalMyInstance').style.display = 'none';
    if (!silent) navClear();
}

function _reopenCachedInstance(location) {
    const fn = _instanceDetailCache[location];
    if (typeof fn === 'function') fn();
}

function openInstanceDetailFromData(inst) {
    if (!inst || inst.error) { showToast(false, t('instance.load_error', 'Could not load instance.')); return; }
    if (inst.location) {
        _instanceDetailCache[inst.location] = () => _renderInstanceDetailContent(inst);
        navOpenModal('instance', inst.location, inst.worldName || '');
    } else {
        _renderInstanceDetailContent(inst);
    }
}

function _renderInstanceDetailContent(inst) {
    const m = document.getElementById('modalMyInstance');
    const c = document.getElementById('myInstanceContent');
    if (!m || !c) return;

    const thumb    = inst.worldThumb || '';
    const worldId  = inst.worldId || inst.location?.split(':')[0] || '';
    const { cls, label: typeLabel } = getInstanceBadge(inst.instanceType);
    // Alle Freunde dieser Welt finden, nach Instance gruppieren
    const allWorldFriends = (typeof vrcFriendsData !== 'undefined')
        ? vrcFriendsData.filter(f => f.location && f.location.split(':')[0] === worldId)
        : [];

    const instanceGroups = {};
    allWorldFriends.forEach(f => {
        const key = f.location.split('~')[0];
        if (!instanceGroups[key]) instanceGroups[key] = [];
        instanceGroups[key].push(f);
    });

    const bannerHtml = thumb
        ? `<div class="fd-banner"><img src="${thumb}" onerror="this.parentElement.style.display='none'"><div class="fd-banner-fade"></div></div>`
        : '';

    let friendsHtml = '';
    const groupKeys = Object.keys(instanceGroups);
    if (groupKeys.length > 0) {
        groupKeys.forEach(key => {
            const instId = key.includes(':') ? key.split(':')[1] : key;
            const { instanceType: iType } = (typeof parseFriendLocation === 'function') ? parseFriendLocation(instanceGroups[key][0].location) : { instanceType: 'public' };
            const { cls: iCls, label: iLabel } = getInstanceBadge(iType);
            const iLoc = (instanceGroups[key][0].location || '').replace(/'/g, "\\'");
            const copyBadgeI = instId
                ? `<span class="vrcn-id-clip" onclick="copyInstanceLink('${jsq(instanceGroups[key][0].location || '')}')"><span class="msi" style="font-size:12px;">content_copy</span>#${esc(instId)}</span>`
                : '';
            friendsHtml += `<div class="wd-friends-label" style="display:flex;align-items:center;gap:6px;"><span class="vrcn-badge ${iCls}">${iLabel}</span>${copyBadgeI}<button class="vrcn-button-round vrcn-btn-join" style="font-size:11px;padding:3px 10px;margin-left:auto;" onclick="closeMyInstanceDetail();sendToCS({action:'vrcJoinFriend',location:'${iLoc}'})">${t('dashboard.instances.join_world', 'Join World')}</button></div><div class="wd-friends-list">`;
            instanceGroups[key].forEach(f => {
                friendsHtml += renderProfileItem(f, `navOpenModal('friend','${jsq(f.id || '')}','${jsq(f.displayName || '')}')`);
            });
            friendsHtml += '</div>';
        });
    } else {
        friendsHtml = `<div class="wd-friends-label">${t('dashboard.instances.friends_title', 'FRIENDS IN THIS WORLD')}</div><div class="wd-friends-list"><div class="vrcn-profile-item" style="pointer-events:none;opacity:0.55;">
            <div class="fd-profile-item-avatar" style="display:flex;align-items:center;justify-content:center;"><span class="msi" style="font-size:20px;color:var(--tx3);">person</span></div>
            <div class="fd-profile-item-info">
                <div class="fd-profile-item-name">${t('dashboard.instances.no_friends_title', 'No friends here yet!')}</div>
                <div class="fd-profile-item-status">${t('dashboard.instances.no_friends_desc', 'Invite friends to this instance!')}</div>
            </div>
        </div></div>`;
    }

    c.innerHTML = `${bannerHtml}<div class="fd-content${thumb ? ' fd-has-banner' : ''}" style="padding:16px 32px;">
        <h2 style="margin:0 0 4px;color:var(--tx0);font-size:18px;">${esc(inst.worldName || worldId || t('dashboard.instances.unknown_world', 'Unknown World'))}</h2>
        ${friendsHtml}
        <div class="fd-actions">
            <button class="vrcn-button-round" onclick="navOpenModal('worldSearch','${jsq(worldId)}','')">${t('dashboard.instances.open_world', 'Open World')}</button>
            <button class="vrcn-button-round" style="margin-left:auto;" onclick="closeMyInstanceDetail()">${t('common.close', 'Close')}</button>
        </div>
    </div>`;
    m.style.display = 'flex';
}

function openMyInstanceDetail(worldId, location) {
    const inst = _myInstancesData.find(i => i.location === location) || _myInstancesData.find(i => i.worldId === worldId);
    if (!inst) return;
    _instanceDetailCache[inst.location] = () => _renderMyInstanceContent(inst);
    navOpenModal('instance', inst.location, inst.worldName || '');
}

function _renderMyInstanceContent(inst) {
    const m  = document.getElementById('modalMyInstance');
    const c  = document.getElementById('myInstanceContent');
    if (!m || !c) return;
    const thumb = inst.worldThumb || '';
    const worldId = inst.worldId || '';
    const { cls, label: typeLabel } = getInstanceBadge(inst.instanceType);
    const locBase2 = (inst.location || '').split('~')[0];
    const instNum = locBase2.includes(':') ? locBase2.split(':')[1] : '';

    const locFriends2 = (typeof vrcFriendsData !== 'undefined')
        ? vrcFriendsData.filter(f => f.location && f.location.split('~')[0] === locBase2)
        : [];
    const curBase2 = (currentInstanceData?.location || '').split('~')[0];
    const logUsers2 = (locBase2 && curBase2 === locBase2 && currentInstanceData?.users) ? currentInstanceData.users : [];
    const friendById2 = {};
    if (typeof vrcFriendsData !== 'undefined') vrcFriendsData.forEach(f => { if (f.id) friendById2[f.id] = f; });
    const seenIds2 = new Set(locFriends2.map(f => f.id));
    logUsers2.forEach(u => {
        if (u.id && !seenIds2.has(u.id) && friendById2[u.id]) {
            locFriends2.push(friendById2[u.id]);
            seenIds2.add(u.id);
        }
    });
    const instFriends = locFriends2;

    const bannerHtml = thumb
        ? `<div class="fd-banner"><img src="${thumb}" onerror="this.parentElement.style.display='none'"><div class="fd-banner-fade"></div></div>`
        : '';
    const copyBadge = instNum
        ? `<span class="vrcn-id-clip" onclick="copyInstanceLink('${jsq(inst.location)}')"><span class="msi" style="font-size:12px;">content_copy</span>#${esc(instNum)}</span>`
        : '';

    let friendsHtml = `<div class="wd-friends-label">${tf('dashboard.instances.friends_title', { count: instFriends.length }, 'FRIENDS IN THIS INSTANCE ({count})')}</div><div class="wd-friends-list">`;
    if (instFriends.length > 0) {
        instFriends.forEach(f => {
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

    const mloc = jsq(inst.location || '');
    const mwn  = jsq(inst.worldName || '');
    const mwt  = jsq(inst.worldThumb || '');
    const mit  = jsq(inst.instanceType || '');
    const loc  = (inst.location || '').replace(/'/g, "\\'");

    c.innerHTML = `${bannerHtml}<div class="fd-content${thumb ? ' fd-has-banner' : ''}" style="padding:16px 32px;">
        <h2 style="margin:0 0 4px;color:var(--tx0);font-size:18px;">${esc(inst.worldName || inst.worldId || t('dashboard.instances.unknown_world', 'Unknown World'))}</h2>
        <div style="display:flex;justify-content:flex-end;gap:6px;margin-bottom:4px;">
            <button class="vrcn-button-round" title="${esc(t('dashboard.instances.invite_friends', 'Invite Friends'))}" onclick="closeMyInstanceDetail();openInviteModalForLocation('${mloc}','${mwn}','${mwt}','${mit}')"><span class="msi" style="font-size:16px;">person_add</span></button>
            <button class="vrcn-button-round vrcn-btn-danger" title="${esc(t('dashboard.instances.remove_instance', 'Remove Instance'))}" onclick="removeMyInstance('${loc}')"><span class="msi" style="font-size:16px;">delete</span></button>
        </div>
        <div class="fd-badges-row"><span class="vrcn-badge ${cls}">${typeLabel}</span>${(inst.location || '').includes('~ageGate') ? `<span class="vrcn-badge" style="background:rgba(255,75,85,.15);color:var(--err);">${esc(t('worlds.instances.age_gated', 'Age Gated'))}</span>` : ''}${getOwnerBadgeHtml(inst.ownerId, inst.ownerName, inst.ownerGroup, 'closeMyInstanceDetail()')}${copyBadge}</div>
        ${friendsHtml}
        <div class="fd-actions">
            <button class="vrcn-button-round vrcn-btn-join" onclick="closeMyInstanceDetail();sendToCS({action:'vrcJoinFriend',location:'${loc}'})">${t('dashboard.instances.join_world', 'Join World')}</button>
            <button class="vrcn-button-round" onclick="navOpenModal('worldSearch','${jsq(worldId)}','')">${t('dashboard.instances.open_world', 'Open World')}</button>
            <button class="vrcn-button-round" style="margin-left:auto;" onclick="closeMyInstanceDetail()">${t('common.close', 'Close')}</button>
        </div>
    </div>`;
    m.style.display = 'flex';
}

