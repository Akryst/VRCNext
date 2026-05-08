/**
 * Universal instance item card.
 * Used by: World Modal → Active Instances, Friend Profile → Current World.
 *
 * Layout A — world modal:
 *   row 1: owner name (group or player) — only if available
 *   row 2: [badge] [region] [count]  →→→  [friend avatars] [Join]
 *
 * Layout B — profile:
 *   [thumb] | name
 *           | [badge] [count]
 *
 * @param {object}  opts
 * @param {string}  opts.thumb        - World thumbnail URL (Layout B only)
 * @param {string}  [opts.worldName]  - World name → triggers Layout B
 * @param {string}  opts.instanceType - e.g. 'public', 'friends+', 'group'
 * @param {string}  [opts.owner]      - Instance owner display name (group or player)
 * @param {string}  [opts.region]     - Region label (e.g. 'EU', 'US East')
 * @param {number}  [opts.userCount]  - Current player count
 * @param {number}  [opts.capacity]   - Max player count
 * @param {Array}   [opts.friends]    - [{image, displayName}] for friend strip
 * @param {string}  [opts.location]   - Instance location string (enables Join button)
 * @param {string}  [opts.onclick]    - Inline JS onclick string (makes card clickable)
 * @returns {string} HTML string
 */
function renderInstanceItem(opts) {
    const { thumb, worldName, worldTitle, instanceType, instanceId, owner, ownerGroup, ownerId, region, userCount, capacity, friends, location, onclick, ageGate, languageRatio } = opts;

    const { cls, label } = getInstanceBadge(instanceType);
    const joinLabel = t('common.join', 'Join');
    const joiningLabel = t('common.joining', 'Joining...');
    const thumbStyle = thumb ? `background-image:url('${cssUrl(thumb)}')` : '';

    const regionHtml = region
        ? `<span class="vrcn-badge"><span class="msi" style="font-size:10px;">language</span>${esc(region)}</span>`
        : '';

    const countHtml = userCount > 0
        ? `<span class="vrcn-badge"><span class="msi" style="font-size:10px;">person</span>${userCount}${capacity > 0 ? '/' + capacity : ''}</span>`
        : '';

    // Top 2 languages from languageRatio, shown as compact badges
    let langHtml = '';
    if (languageRatio && typeof languageRatio === 'object') {
        const sorted = Object.entries(languageRatio).sort((a, b) => b[1] - a[1]).slice(0, 2);
        langHtml = sorted.map(([lang, pct]) =>
            `<span class="vrcn-badge" style="font-size:10px;">${esc(lang.toUpperCase())} ${Math.round(pct * 100)}%</span>`
        ).join('');
    }

    const ageGateLabel = t('worlds.instances.age_gated', 'Age Gated');
    const badgeHtml = `<span class="vrcn-badge ${cls}">${esc(label)}</span>${ageGate ? `<span class="vrcn-badge" style="background:rgba(255,75,85,.15);color:var(--err);">${esc(ageGateLabel)}</span>` : ''}`;
    const thumbEl   = `<div class="inst-item-thumb" style="${thumbStyle}"></div>`;
    const clickAttr = onclick ? ` onclick="${onclick}" style="cursor:pointer;"` : '';

    if (worldName) {
        // Layout B — profile: stacked name + meta
        const instNum    = instanceId ? `<span class="inst-item-owner-num" style="margin-left:5px;">#${esc(instanceId.split('~')[0])}</span>` : '';
        const regionMeta = regionHtml ? regionHtml : '';
        return `<div class="inst-item"${clickAttr}>${thumbEl}<div class="inst-item-body"><div class="inst-item-name" style="display:flex;align-items:center;gap:2px;">${esc(worldName)}${instNum}</div><div class="inst-item-meta">${badgeHtml}${countHtml}${regionMeta}</div></div></div>`;
    }

    // Layout A — world modal: instance modal card style
    const instNum = instanceId ? instanceId.split('~')[0] : '';

    let ownerBadge = '';
    if (owner && ownerGroup && ownerId) {
        const safeId    = ownerId.replace(/'/g, "\\'");
        const safeOwner = owner.replace(/'/g, "\\'");
        ownerBadge = `<span class="inst-owner-group-badge" onclick="event.stopPropagation();navOpenModal('group','${safeId}','${safeOwner}')">${esc(owner)}<span class="inst-owner-group-sep">·</span>${esc(ownerGroup)}</span>`;
    } else if (owner && ownerGroup) {
        ownerBadge = `<span class="vrcn-badge">${esc(owner)}<span style="opacity:.5;margin:0 3px;">·</span>${esc(ownerGroup)}</span>`;
    } else if (owner) {
        ownerBadge = `<span class="vrcn-badge">${esc(owner)}</span>`;
    }

    let friendsHtml = '';
    if (friends && friends.length > 0) {
        const items = friends.map(f =>
            renderProfileItem(f, `navOpenModal('friend','${jsq(f.id || '')}','${jsq(f.displayName || '')}')`)
        ).join('');
        friendsHtml = `<div class="mi-friends-list">${items}</div>`;
    }

    let joinHtml = '';
    if (location && instanceType !== 'private') {
        const loc = location.replace(/'/g, "\\'");
        joinHtml = `<button class="vrcn-button-round vrcn-btn-join" title="${esc(joinLabel)}" onclick="sendToCS({action:'vrcJoinFriend',location:'${loc}'});this.disabled=true;"><span class="msi" style="font-size:14px;">login</span></button>`;
    }

    const hasSep = friendsHtml ? ' inst-item-card-hdr-sep' : '';
    const thumbHtml = thumbStyle ? `<div class="inst-item-thumb" style="${thumbStyle}"></div>` : '';

    // Title row: "23/80 · World Name · Instance Type · #ID (GroupShortCode)"
    const titleParts = [];
    if (userCount > 0) titleParts.push(`<span class="vrcn-badge"><span class="msi" style="font-size:10px;">person</span>${userCount}${capacity > 0 ? '/' + capacity : ''}</span>`);
    if (worldTitle) titleParts.push(`<span style="color:var(--tx1);font-weight:700;">${esc(worldTitle)}</span>`);
    titleParts.push(`<span style="color:var(--tx3);">·</span><span>${esc(label)}</span>`);
    if (instNum) titleParts.push(`<span style="color:var(--tx3);">·</span><span style="color:var(--tx2);">#${esc(instNum)}</span>`);
    if (ownerGroup) titleParts.push(`<span style="color:var(--tx3);">(${esc(ownerGroup)})</span>`);
    const titleHtml = `<div class="inst-item-card-title">${titleParts.join(' ')}</div>`;

    return `<div class="inst-item-card" data-iid="${esc(instanceId || '')}"${clickAttr}>
        <div class="inst-item-card-hdr${hasSep}">
            ${thumbHtml}
            <div class="inst-item-card-body">
                ${titleHtml}
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    ${badgeHtml}${ownerBadge}${regionHtml}${langHtml}
                    <div class="inst-item-right">${joinHtml}</div>
                </div>
            </div>
        </div>
        ${friendsHtml}
    </div>`;
}
