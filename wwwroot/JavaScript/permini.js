// Permini.n// Permanent mini-invite list: selected friends can auto-receive an invite when
// they send a requestInvite and the local user's status matches their settings.

let perminiList = []; // [{ userId, allowActive, allowAskMe, allowDnD }]
let _pmPickerFilter = '';

// Data.

function onPerminiData(list) {
    perminiList = Array.isArray(list) ? list : [];
    renderPerminiList();
}

function savePermini() {
    sendToCS({ action: 'perminiSave', list: perminiList });
}

// Render main list.

function renderPerminiList() {
    const el = document.getElementById('pmList');
    if (!el) return;

    if (!perminiList.length) {
        el.innerHTML = `<div class="empty-msg">${t('permini.empty')}</div>`;
        return;
    }

    el.innerHTML = perminiList.map(e => {
        const friend = (vrcFriendsData || []).find(f => f.id === e.userId) || {};
        const img    = friend.image || '';
        const name   = friend.displayName || e.userId;
        const uid    = jsq(e.userId);

        const av = img
            ? `<img class="pm-avatar" src="${esc(img)}" onerror="this.outerHTML='<div class=\\'pm-avatar pm-avatar-fallback\\'>${esc((name||'?')[0].toUpperCase())}</div>'">`
            : `<div class="pm-avatar pm-avatar-fallback">${esc((name || '?')[0].toUpperCase())}</div>`;

        return `<div class="pm-entry" id="pm-entry-${uid}">
            ${av}
            <div class="pm-info">
                <div class="pm-name">${esc(name)}</div>
                <div class="pm-toggles">
                    <label class="pm-toggle-label" title="${esc(t('permini.toggle.active_title'))}">
                        <label class="toggle"><input type="checkbox" ${e.allowActive ? 'checked' : ''} onchange="perminiToggle('${uid}','allowActive',this.checked)"><div class="toggle-track"><div class="toggle-knob"></div></div></label>
                        <span class="pm-status-dot" style="background:var(--status-online);"></span>
                        <span>${t('permini.toggle.active')}</span>
                    </label>
                    <label class="pm-toggle-label" title="${esc(t('permini.toggle.askme_title'))}">
                        <label class="toggle"><input type="checkbox" ${e.allowAskMe ? 'checked' : ''} onchange="perminiToggle('${uid}','allowAskMe',this.checked)"><div class="toggle-track"><div class="toggle-knob"></div></div></label>
                        <span class="pm-status-dot" style="background:var(--status-ask);"></span>
                        <span>${t('permini.toggle.askme')}</span>
                    </label>
                    <label class="pm-toggle-label" title="${esc(t('permini.toggle.dnd_title'))}">
                        <label class="toggle"><input type="checkbox" ${e.allowDnD ? 'checked' : ''} onchange="perminiToggle('${uid}','allowDnD',this.checked)"><div class="toggle-track"><div class="toggle-knob"></div></div></label>
                        <span class="pm-status-dot" style="background:var(--status-busy);"></span>
                        <span>${t('permini.toggle.dnd')}</span>
                    </label>
                </div>
            </div>
            <button class="pm-remove" onclick="removePerminiEntry('${uid}')" title="${esc(t('common.remove'))}">
                <span class="msi">close</span>
            </button>
        </div>`;
    }).join('');
}

// Toggle a setting for a single entry.

function perminiToggle(userId, field, val) {
    const entry = perminiList.find(e => e.userId === userId);
    if (!entry) return;
    entry[field] = val;
    savePermini();
}

// Remove an entry.

function removePerminiEntry(userId) {
    perminiList = perminiList.filter(e => e.userId !== userId);
    savePermini();
    renderPerminiList();
}

// Friend picker modal.

function openPerminiPicker() {
    _pmPickerFilter = '';
    const inp = document.getElementById('pmSearchInput');
    if (inp) inp.value = '';
    renderPerminiPicker('');
    document.getElementById('modalPerminiPicker').style.display = 'flex';
    if (inp) setTimeout(() => inp.focus(), 80);
}

function closePerminiPicker() {
    document.getElementById('modalPerminiPicker').style.display = 'none';
}

function filterPerminiPicker(val) {
    _pmPickerFilter = val;
    renderPerminiPicker(val);
}

function renderPerminiPicker(filter) {
    const el = document.getElementById('pmPickerList');
    if (!el) return;

    const already = new Set(perminiList.map(e => e.userId));
    const friends = (vrcFriendsData || []).filter(f => {
        if (f.presence === 'offline') return false;
        if (already.has(f.id)) return false;
        if (filter) return (f.displayName || '').toLowerCase().includes(filter.toLowerCase());
        return true;
    });

    if (!friends.length) {
        el.innerHTML = `<div class="inv-empty">${t('permini.picker.empty')}</div>`;
        return;
    }

    el.innerHTML = friends.map(f => {
        const hasImg = f.image && f.image.length > 5;
        const av = hasImg
            ? `<img class="fd-profile-item-avatar" src="${esc(f.image)}" onerror="this.outerHTML='<div class=\\'fd-profile-item-avatar\\' style=\\'display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;\\'>${esc((f.displayName||'?')[0])}</div>'">`
            : `<div class="fd-profile-item-avatar" style="display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;">${esc((f.displayName||'?')[0])}</div>`;
        const statusCls = statusDotClass(f.status || 'offline');
        const fid = jsq(f.id);
        return `<div class="vrcn-profile-item" onclick="addPerminiEntry('${fid}')" style="cursor:pointer;">
            ${av}
            <div class="fd-profile-item-info">
                <div class="fd-profile-item-name">${esc(f.displayName || f.id)}</div>
                <div class="fd-profile-item-status">
                    <span class="vrc-status-dot ${esc(statusCls)}" style="width:7px;height:7px;display:inline-block;border-radius:50%;margin-right:4px;"></span>
                    ${esc(f.statusDescription || statusLabel(f.status || 'offline'))}
                </div>
            </div>
            <span class="msi" style="font-size:18px;color:var(--accent);margin-left:auto;flex-shrink:0;">add</span>
        </div>`;
    }).join('');
}

// Add entry from picker.

function addPerminiEntry(userId) {
    if (perminiList.find(e => e.userId === userId)) {
        closePerminiPicker();
        return;
    }
    perminiList.push({ userId, allowActive: false, allowAskMe: true, allowDnD: false });
    savePermini();
    renderPerminiList();
    closePerminiPicker();
}

// Called when tab is opened.

function onPerminiTabOpen() {
    sendToCS({ action: 'perminiGet' });
}
