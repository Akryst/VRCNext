/* === Avatar Modal === */
/* === Avatar Detail Modal === */
let _avDetailData = null;
let _avEditTags   = [];

const _avatarDetailCache = {};

function openAvatarDetail(avatarId) {
    if (typeof navSetCurrent === 'function') navSetCurrent('avatar', avatarId);
    document.getElementById('modalAvatarDetail').style.display = 'flex';
    const cached = _avatarDetailCache[avatarId];
    if (cached) {
        renderAvatarDetail(cached);
    } else {
        const c = document.getElementById('avatarDetailContent');
        if (c) c.innerHTML = sk('detail');
    }
    sendToCS({ action: 'vrcGetAvatarDetail', avatarId });
}

function closeAvatarDetail(fromNav = false) {
    document.getElementById('modalAvatarDetail').style.display = 'none';
    _avDetailData = null;
    if (!fromNav && typeof navClear === 'function') navClear();
}

const _avFieldIds = {
    name:       { view: 'avfNameView',       edit: 'avfNameEdit'       },
    desc:       { view: 'avfDescView',       edit: 'avfDescEdit'       },
    visibility: { view: 'avfVisView',        edit: 'avfVisEdit'        },
    tags:       { view: 'avfTagsView',       edit: 'avfTagsEdit'       },
};
let _avSavingField = '';


/* === Avatar inline edit === */
let _avVisState = 'public';

function editAvField(field) {
    Object.keys(_avFieldIds).forEach(f => {
        if (f === field) return;
        const ids = _avFieldIds[f];
        const v = document.getElementById(ids.view); if (v) v.style.display = '';
        const e = document.getElementById(ids.edit); if (e) e.style.display = 'none';
    });
    const ids = _avFieldIds[field];
    if (!ids) return;
    const v = document.getElementById(ids.view); if (v) v.style.display = 'none';
    const e = document.getElementById(ids.edit); if (e) e.style.display = '';

    if (field === 'name') {
        document.getElementById('avNameInput')?.focus();
    } else if (field === 'desc') {
        document.getElementById('avDescInput')?.focus();
    } else if (field === 'visibility') {
        _avVisState = (_avDetailData?.releaseStatus === 'public') ? 'public' : 'private';
    } else if (field === 'tags') {
        _avEditTags = [...(_avDetailData?.tags || [])];
        avRenderTagChips();
        document.getElementById('avTagInput')?.focus();
    }
}

function cancelAvField(field) {
    const ids = _avFieldIds[field];
    if (!ids) return;
    const v = document.getElementById(ids.view); if (v) v.style.display = '';
    const e = document.getElementById(ids.edit); if (e) e.style.display = 'none';
}


function avVisToggle(state, btn) {
    _avVisState = state;
    document.querySelectorAll('#avVisPublicBtn,#avVisPrivateBtn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}


function avAddTag() {
    const inp = document.getElementById('avTagInput');
    if (!inp) return;
    const val = inp.value.trim();
    if (val && !_avEditTags.includes(val)) {
        _avEditTags.push(val);
        avRenderTagChips();
    }
    inp.value = '';
    inp.focus();
}

function avRemoveTag(idx) {
    _avEditTags.splice(idx, 1);
    avRenderTagChips();
}


function renderAvatarDetail(a) {
    if (a.id) _avatarDetailCache[a.id] = a;
    _avDetailData = a;
    if (typeof navUpdateLabel === 'function') navUpdateLabel(a.name || '');
    const c = document.getElementById('avatarDetailContent');
    if (!c) return;

    const thumb = a.thumbnailImageUrl || a.imageUrl || '';
    const isOwn = currentVrcUser && a.authorId === currentVrcUser.id;
    const aid = jsq(a.id || '');

    function platBadge(label, cssClass, icon, perf) {
        const perfHtml = perf ? `<span style="opacity:.8;font-weight:400;"> - ${esc(perf)}</span>` : '';
        return `<span class="vrcn-badge ${cssClass}"><span class="msi" style="font-size:10px;">${icon}</span>${label}${perfHtml}</span>`;
    }

    const isPublic = a.releaseStatus === 'public';
    const statusBadge = avatarStatusBadge(isPublic);
    const pcBadge = a.hasPC ? platBadge('PC', 'platform-pc', 'computer', a.pcPerf) : '';
    const questBadge = a.hasQuest ? platBadge('Quest', 'platform-quest', 'android', a.questPerf) : '';
    const impostorBadge = a.hasImpostor
        ? `<span class="vrcn-badge" style="background:rgba(138,43,226,.18);color:#b47aff;"><span class="msi" style="font-size:10px;">smart_toy</span> ${t('avatars.labels.impostor', 'Impostor')}</span>`
        : '';

    function fmtDate(iso) {
        if (!iso) return '-';
        const d = new Date(iso);
        if (isNaN(d)) return iso;
        return fmtShortDate(d) + ', ' + fmtTimeSeconds(d);
    }

    const authorHtml = a.authorId
        ? `<span onclick="navOpenModal('friend','${jsq(a.authorId)}','${jsq(a.authorName || '')}')" style="display:inline-flex;align-items:center;padding:1px 8px;border-radius:20px;background:var(--bg-hover);font-size:11px;font-weight:600;color:var(--tx1);cursor:pointer;line-height:1.8;">${esc(a.authorName || a.authorId)}</span>`
        : esc(a.authorName || '');

    const metaRows = [
        `<div class="fd-meta-row"><span class="fd-meta-label">${t('avatars.detail.meta.created_at', 'Created At')}</span><span>${fmtDate(a.created_at)}</span></div>`,
        `<div class="fd-meta-row"><span class="fd-meta-label">${t('avatars.detail.meta.updated_at', 'Last Updated')}</span><span>${fmtDate(a.updated_at)}</span></div>`,
        a.version ? `<div class="fd-meta-row"><span class="fd-meta-label">${t('avatars.detail.meta.version', 'Version')}</span><span>v${a.version}</span></div>` : '',
    ].join('');

    const tagsViewHtml = (a.tags && a.tags.length)
        ? `<div class="fd-lang-tags">${a.tags.map(tag => `<span class="vrcn-badge">${esc(tag)}</span>`).join('')}</div>`
        : `<div class="myp-empty">${t('avatars.detail.empty_tags', 'No tags')}</div>`;

    const _descCard = `<div class="fd-info-card">
        <div class="myp-section-header">
            <span class="myp-section-title">${t('avatars.detail.sections.description', 'Description')}</span>
            ${isOwn ? `<button class="myp-edit-btn" onclick="editAvField('desc')"><span class="msi" style="font-size:14px;">edit</span></button>` : ''}
        </div>
        <div id="avfDescView">${a.description ? `<div class="fd-bio">${esc(a.description)}</div>` : `<div class="myp-empty">${t('avatars.detail.empty_description', 'No description')}</div>`}</div>
        ${isOwn ? `<div id="avfDescEdit" style="display:none;">
            <textarea id="avDescInput" class="myp-textarea" rows="4" maxlength="2000" placeholder="${esc(t('avatars.detail.description_placeholder', 'Avatar description...'))}">${esc(a.description || '')}</textarea>
            <div class="myp-edit-actions">
                <button class="vrcn-button" onclick="cancelAvField('desc')">${t('common.cancel', 'Cancel')}</button>
                <button class="vrcn-button vrcn-btn-primary" onclick="saveAvField('desc','${aid}')">${t('common.save', 'Save')}</button>
            </div>
        </div>` : ''}
    </div>`;

    const _tagsCard = `<div class="fd-info-card">
        <div class="myp-section-header">
            <span class="myp-section-title">${t('avatars.detail.sections.tags', 'Tags')}</span>
            ${isOwn ? `<button class="myp-edit-btn" onclick="editAvField('tags')"><span class="msi" style="font-size:14px;">edit</span></button>` : ''}
        </div>
        <div id="avfTagsView">${tagsViewHtml}</div>
        ${isOwn ? `<div id="avfTagsEdit" style="display:none;">
            <div id="avTagsChips" class="myp-lang-chips" style="margin-bottom:6px;"></div>
            <div style="display:flex;gap:6px;margin-bottom:8px;">
                <input id="avTagInput" class="vrcn-edit-field" placeholder="${esc(t('avatars.detail.add_tag_placeholder', 'Add tag...'))}" style="flex:1;" onkeydown="if(event.key==='Enter'){event.preventDefault();avAddTag();}">
                <button class="myp-add-lang-btn" onclick="avAddTag()"><span class="msi" style="font-size:15px;">add</span></button>
            </div>
            <div class="myp-edit-actions">
                <button class="vrcn-button" onclick="cancelAvField('tags')">${t('common.cancel', 'Cancel')}</button>
                <button class="vrcn-button vrcn-btn-primary" onclick="saveAvField('tags','${aid}')">${t('common.save', 'Save')}</button>
            </div>
        </div>` : ''}
    </div>`;

    const _mr = (label, valueHtml) =>
        `<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;font-size:11px;"><span style="color:var(--tx3);">${label}</span><span style="color:var(--tx1);text-align:right;">${valueHtml}</span></div>`;

    const _infosCard = `<div class="fd-info-card">
        <div class="fd-group-rep-label">${t('avatars.detail.sections.infos', 'Infos')}</div>
        <div style="display:grid;gap:6px;margin-bottom:10px;">
            ${_mr(t('avatars.detail.meta.created_at', 'Created'), fmtDate(a.created_at))}
            ${_mr(t('avatars.detail.meta.updated_at', 'Updated'), fmtDate(a.updated_at))}
            ${a.version ? _mr(t('avatars.detail.meta.version', 'Version'), `v${a.version}`) : ''}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;">${pcBadge}${questBadge}${impostorBadge}</div>
        <div class="myp-section-header">
            <span class="myp-section-title">${t('avatars.detail.sections.visibility', 'Visibility')}</span>
            ${isOwn ? `<button class="myp-edit-btn" onclick="editAvField('visibility')"><span class="msi" style="font-size:14px;">edit</span></button>` : ''}
        </div>
        <div id="avfVisView">${statusBadge}</div>
        ${isOwn ? `<div id="avfVisEdit" style="display:none;">
            <div style="display:flex;gap:6px;margin-bottom:8px;">
                <button id="avVisPublicBtn" class="vrcn-button-round${isPublic ? ' active' : ''}" onclick="avVisToggle('public',this)">
                    <span class="msi" style="font-size:14px;">public</span> ${t('avatars.labels.public', 'Public')}
                </button>
                <button id="avVisPrivateBtn" class="vrcn-button-round${!isPublic ? ' active' : ''}" onclick="avVisToggle('private',this)">
                    <span class="msi" style="font-size:14px;">lock</span> ${t('avatars.labels.private', 'Private')}
                </button>
            </div>
            <div class="myp-edit-actions">
                <button class="vrcn-button" onclick="cancelAvField('visibility')">${t('common.cancel', 'Cancel')}</button>
                <button class="vrcn-button vrcn-btn-primary" onclick="saveAvField('visibility','${aid}')">${t('common.save', 'Save')}</button>
            </div>
        </div>` : ''}
    </div>`;

    c.innerHTML = `
        ${thumb ? `<div class="fd-banner"><img src="${thumb}" onerror="this.parentElement.style.display='none'"><div class="fd-banner-fade"></div><button class="btn-notif" style="position:absolute;top:8px;right:8px;z-index:3;" title="${esc(t('common.share','Share'))}" onclick="navigator.clipboard.writeText('https://vrchat.com/home/avatar/${esc(a.id)}').then(()=>showToast(true,t('common.link_copied','Link copied!')))"><span class="msi" style="font-size:20px;">share</span></button></div>` : ''}
        <div class="fd-content${thumb ? ' fd-has-banner' : ''}">
            <div class="fd-header">
                <div style="flex:1;min-width:0;">
                    <div id="avfNameView" style="display:flex;align-items:center;gap:6px;">
                        <div class="fd-name">${esc(a.name || t('avatars.detail.unnamed', 'Unnamed Avatar'))}</div>
                        ${isOwn ? `<button class="myp-edit-btn" onclick="editAvField('name')"><span class="msi" style="font-size:14px;">edit</span></button>` : ''}
                    </div>
                    ${isOwn ? `<div id="avfNameEdit" style="display:none;margin-top:6px;">
                        <input id="avNameInput" class="vrcn-edit-field" value="${esc(a.name || '')}" maxlength="64" style="width:100%;">
                        <div class="myp-edit-actions">
                            <button class="vrcn-button" onclick="cancelAvField('name')">${t('common.cancel', 'Cancel')}</button>
                            <button class="vrcn-button vrcn-btn-primary" onclick="saveAvField('name','${aid}')">${t('common.save', 'Save')}</button>
                        </div>
                    </div>` : ''}
                    <div style="font-size:12px;color:var(--tx3);margin-top:4px;">${t('avatars.detail.by', 'by')} ${authorHtml}</div>
                </div>
            </div>
            <div class="fd-badges-row" style="margin-bottom:10px;">${statusBadge}${idBadge(a.id)}</div>
            <div class="fd-tabs" style="margin-bottom:14px;">
                <button class="fd-tab active" onclick="switchAvTab('info',this)">${t('profiles.tabs.info', 'Info')}</button>
                <button class="fd-tab" onclick="switchAvTab('json',this)">Json</button>
            </div>
            <div id="avTabInfo">
                <div class="fd-info-wrap">
                    <div class="fd-info-cols">
                        <div class="fd-info-left">${_descCard}${_tagsCard}</div>
                        <div class="fd-info-right">${_infosCard}</div>
                    </div>
                </div>
            </div>
            <div id="avTabJson" style="display:none;"><div class="json-viewer">${jsonHighlight(a?.rawJson || a || {})}</div></div>
            <div style="margin-top:10px;display:flex;justify-content:flex-end;gap:6px;">
                <button class="vrcn-button-round vrcn-btn-join" onclick="selectAvatar('${aid}');closeAvatarDetail()">
                    <span class="msi" style="font-size:14px;">checkroom</span> ${t('avatars.detail.actions.use_avatar', 'Use Avatar')}
                </button>
                <button class="vrcn-button-round" onclick="closeAvatarDetail()">${t('common.close', 'Close')}</button>
            </div>
        </div>`;
}

function saveAvField(field, avatarId) {
    const a = _avDetailData;
    if (!a) return;
    _avSavingField = field;
    const ids = _avFieldIds[field];
    const saveBtn = document.querySelector(`#${ids.edit} .vrcn-btn-primary`);
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = t('common.saving', 'Saving...');
    }

    const name = field === 'name' ? (document.getElementById('avNameInput')?.value.trim() || '') : (a.name || '');
    const description = field === 'desc' ? (document.getElementById('avDescInput')?.value ?? '') : (a.description || '');
    const releaseStatus = field === 'visibility' ? _avVisState : (a.releaseStatus || 'private');
    const tags = field === 'tags' ? [..._avEditTags] : (a.tags || []);

    sendToCS({ action: 'vrcUpdateAvatar', avatarId, name, description, releaseStatus, tags });
}


function onAvatarUpdateResult(data) {
    const fieldLabels = {
        name: avatarDetailFieldLabel('name'),
        desc: avatarDetailFieldLabel('desc'),
        visibility: avatarDetailFieldLabel('visibility'),
        tags: avatarDetailFieldLabel('tags'),
    };
    if (data.ok) {
        if (_avDetailData) {
            if (data.name != null) _avDetailData.name = data.name;
            if (data.description != null) _avDetailData.description = data.description;
            if (data.releaseStatus != null) _avDetailData.releaseStatus = data.releaseStatus;
            if (data.tags != null) _avDetailData.tags = data.tags;
        }
        const label = fieldLabels[_avSavingField] || avatarDetailFieldLabel('');
        showToast(true, tf('avatars.detail.toast.saved', { field: label }, '{field} saved'));
        renderAvatarDetail(_avDetailData);
        if (avatarFilter === 'own') filterOwnAvatars();
    } else {
        showToast(false, data.error || t('avatars.detail.toast.update_failed', 'Update failed'));
        const ids = _avSavingField ? _avFieldIds[_avSavingField] : null;
        const saveBtn = ids ? document.querySelector(`#${ids.edit} .vrcn-btn-primary`) : null;
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = t('common.save', 'Save');
        }
    }
}

function switchAvTab(tab, btn) {
    const infoEl = document.getElementById('avTabInfo');
    const jsonEl = document.getElementById('avTabJson');
    if (infoEl) infoEl.style.display = tab === 'info' ? '' : 'none';
    if (jsonEl) jsonEl.style.display = tab === 'json' ? '' : 'none';
    document.querySelectorAll('#avatarDetailContent .fd-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
}

function avRenderTagChips() {
    const container = document.getElementById('avTagsChips');
    if (!container) return;
    container.innerHTML = _avEditTags.length
        ? _avEditTags.map((tag, i) =>
            `<span class="myp-lang-chip" data-idx="${i}">${esc(tag)}<span class="myp-lang-remove" onclick="avRemoveTag(${i})">&times;</span></span>`
        ).join('')
        : `<div class="myp-empty">${t('avatars.detail.empty_tags', 'No tags')}</div>`;
}
