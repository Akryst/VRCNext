let _navStack        = [];
let _navIdx          = -1;
let _navCurrentEntry = null;
let _navBackdropEl   = null;

function renderModalActions(actions) {
    actions = (actions || []).filter(Boolean);
    setTaskbarModalActions(actions.filter(a => !a.header));
    const btns = actions.filter(a => a.header).map(a =>
        `<button class="btn-notif fd-action-btn${a.danger ? ' fd-action-danger' : ''}" title="${esc(a.title || '')}" onclick="${a.onclick}"><span class="msi" style="font-size:20px;">${esc(a.icon)}</span></button>`
    ).join('');
    return btns ? `<div class="fd-modal-actions">${btns}</div>` : '';
}

function setTaskbarModalActions(actions) {
    const el = document.getElementById('tbModalActions');
    if (!el) return;
    el.innerHTML = (actions || []).filter(Boolean).map(a => {
        if (a.dropdown) {
            const items = a.dropdown.filter(Boolean).map(_tbDropdownItem).join('');
            return `<div class="tb-modal-action-wrap"><button class="tb-modal-action" onclick="_tbToggleDropdown(this)">${esc(a.label || a.title || '')}<span class="msi tb-modal-dd-caret">expand_more</span></button><div class="tb-modal-dropdown">${items}</div></div>`;
        }
        return `<button class="tb-modal-action${a.danger ? ' tb-modal-action-danger' : ''}"${a.disabled ? ' disabled' : ''} onclick="${a.onclick}">${esc(a.label || a.title || '')}</button>`;
    }).join('<div class="tb-sep"></div>');
}

function _tbDropdownItem(o) {
    if (o.submenu) {
        const sub = o.submenu.filter(Boolean).map(_tbDropdownItem).join('');
        return `<div class="tb-modal-dd-sub-wrap"><button class="tb-modal-dd-item" onclick="_tbToggleSubmenu(this,event)">${o.icon ? `<span class="msi">${esc(o.icon)}</span>` : ''}<span>${esc(o.label || '')}</span><span class="msi tb-modal-dd-arrow">chevron_right</span></button><div class="tb-modal-dropdown tb-modal-dd-sub">${sub}</div></div>`;
    }
    return `<button class="tb-modal-dd-item${o.active ? ' active' : ''}"${o.disabled ? ' disabled' : ''} onclick="${o.disabled ? '' : '_tbCloseDropdowns();' + o.onclick}">${o.icon ? `<span class="msi">${esc(o.icon)}</span>` : ''}<span>${esc(o.label || '')}</span></button>`;
}

function _tbToggleSubmenu(btn, e) {
    if (e) e.stopPropagation();
    const wrap = btn.closest('.tb-modal-dd-sub-wrap');
    if (!wrap) return;
    const wasOpen = wrap.classList.contains('open');
    const parent = wrap.parentNode;
    if (parent) parent.querySelectorAll('.tb-modal-dd-sub-wrap.open').forEach(w => w.classList.remove('open'));
    if (!wasOpen) wrap.classList.add('open');
}

function _tbToggleDropdown(btn) {
    const wrap = btn.closest('.tb-modal-action-wrap');
    if (!wrap) return;
    const wasOpen = wrap.classList.contains('open');
    _tbCloseDropdowns();
    if (!wasOpen) {
        wrap.classList.add('open');
        setTimeout(() => document.addEventListener('click', _tbDropdownOutside), 0);
    }
}

function _tbCloseDropdowns() {
    document.querySelectorAll('.tb-modal-action-wrap.open, .tb-modal-dd-sub-wrap.open').forEach(w => w.classList.remove('open'));
    document.removeEventListener('click', _tbDropdownOutside);
}

function _tbDropdownOutside(e) {
    if (!e.target.closest('.tb-modal-action-wrap')) _tbCloseDropdowns();
}

function _tbModalActive() {
    return (_navIdx >= 0 && _navStack.length > 0) || !!(_navCurrentEntry && _navCurrentEntry.id);
}

function _navSyncTaskbar() {
    const tb = document.getElementById('taskbar');
    if (!tb) return;
    if (_tbModalActive()) {
        tb.classList.add('tb-modal-mode');
        renderTaskbarCrumbs();
    } else {
        tb.classList.remove('tb-modal-mode');
        const c = document.getElementById('tbModalCrumbs'); if (c) c.innerHTML = '';
        const a = document.getElementById('tbModalActions'); if (a) a.innerHTML = '';
    }
}

function renderTaskbarCrumbs() {
    const el = document.getElementById('tbModalCrumbs');
    if (!el) return;
    let entries, curIdx;
    if (_navIdx >= 0 && _navStack.length > 0) { entries = _navStack.slice(0, _navIdx + 1); curIdx = entries.length - 1; }
    else if (_navCurrentEntry && _navCurrentEntry.id) { entries = [_navCurrentEntry]; curIdx = 0; }
    else { el.innerHTML = ''; return; }
    const start = Math.max(0, entries.length - 5);
    let html = '';
    if (start > 0) html += `<button class="tb-crumb" onclick="navGoTo(0)">···</button><span class="tb-crumb-sep">›</span>`;
    html += entries.slice(start).map((e, j) => {
        const idx = start + j;
        const name = e.label || _navTypeLabel(e.type);
        const short = _trunc(name, 14);
        if (idx === curIdx) return `<span class="tb-crumb-current" title="${_esc(name)}">${_esc(short)}</span>`;
        return `<button class="tb-crumb" title="${_esc(name)}" onclick="navGoTo(${idx})">${_esc(short)}</button>`;
    }).join('<span class="tb-crumb-sep">›</span>');
    el.innerHTML = html;
}

function navSetCurrent(type, id, id2) {
    _navCurrentEntry = { type, id: id || '', id2: id2 || '', label: '' };
    _navSyncTaskbar();
}

function navOpenModal(type, id, label, id2) {
    if (!id) return;

    if (_navIdx === -1 && _navCurrentEntry && _navCurrentEntry.id) {
        _navStack.push({ ..._navCurrentEntry });
        _navIdx = 0;
    }

    const cur = _navIdx >= 0 ? _navStack[_navIdx] : null;
    if (cur && cur.type === type && cur.id === id && cur.id2 === (id2 || '')) return;

    const leavingEntry = cur ? { ...cur } : null;

    _navStack = _navStack.slice(0, _navIdx + 1);
    _navStack.push({ type, id, label: label || '', id2: id2 || '' });
    _navIdx = _navStack.length - 1;

    if (_navStack.length >= 2) {
        _navShowBackdrop();
        document.documentElement.classList.add('modal-nav-active');
    }

    if (leavingEntry && _navSameOverlay(leavingEntry.type, type)) {
        // Same overlay (e.g. friend→friend): animate box out first, then reopen
        _navAnimateLeaveThen(leavingEntry, () => {
            _navDoOpen(type, id, id2);
            _navRender();
        });
    } else {
        // Different overlays: animate leave async, open new immediately
        if (leavingEntry) _navAnimateLeave(leavingEntry);
        _navDoOpen(type, id, id2);
        _navRender();
    }
}

function navGoTo(idx) {
    if (idx < 0 || idx >= _navStack.length || idx === _navIdx) return;

    const leavingEntry = _navStack[_navIdx] ? { ..._navStack[_navIdx] } : null;
    const targetEntry  = { ..._navStack[idx] };

    _navIdx = idx;
    _navCurrentEntry = { ...targetEntry };
    _navRender();

    if (leavingEntry && _navSameOverlay(leavingEntry.type, targetEntry.type)) {
        _navAnimateLeaveThen(leavingEntry, () => {
            _navDoOpen(targetEntry.type, targetEntry.id, targetEntry.id2);
        });
    } else {
        if (leavingEntry) _navAnimateLeave(leavingEntry);
        _navDoOpen(targetEntry.type, targetEntry.id, targetEntry.id2);
    }
}

function navClear() {
    _navStack        = [];
    _navIdx          = -1;
    _navCurrentEntry = null;
    document.documentElement.classList.remove('modal-nav-instant');
    document.documentElement.classList.remove('modal-nav-active');
    _navHideBackdrop();
    _navRender();
}

function navUpdateLabel(label) {
    if (_navCurrentEntry) _navCurrentEntry.label = label;
    if (_navIdx >= 0 && _navStack[_navIdx]) _navStack[_navIdx].label = label;
    _navSyncTaskbar();
}

function _navDoOpen(type, id, id2) {
    switch (type) {
        case 'friend':      openFriendDetail(id);           break;
        case 'world':       openWorldDetail(id);            break;
        case 'worldSearch': openWorldSearchDetail(id);      break;
        case 'avatar':      openAvatarDetail(id);           break;
        case 'group':       openGroupDetail(id);            break;
        case 'event':       openEventDetail(id, id2);       break;
        case 'instance':    if (typeof _reopenCachedInstance === 'function') _reopenCachedInstance(id); break;
        case 'myprofile':   if (typeof openMyProfileModal === 'function') openMyProfileModal(); break;
    }
}

function _navOverlayIdForType(type) {
    switch (type) {
        case 'friend':      return 'modalFriendDetail';
        case 'world':       return 'modalWorldDetail';
        case 'worldSearch': return 'modalDetail';
        case 'avatar':      return 'modalAvatarDetail';
        case 'group':       return 'modalDetail';
        case 'event':       return 'modalDetail';
        case 'instance':    return 'modalMyInstance';
        case 'myprofile':   return 'modalMyProfile';
        default:            return null;
    }
}

function _navSameOverlay(typeA, typeB) {
    return _navOverlayIdForType(typeA) === _navOverlayIdForType(typeB);
}

function _navBoxForEntry(entry) {
    if (!entry) return null;
    const ovId = _navOverlayIdForType(entry.type);
    if (!ovId) return null;
    const ov = document.getElementById(ovId);
    return ov ? ov.querySelector('.modal-box') : null;
}

// Animate box out, then call onDone (used when same overlay is reused).
// Cuts in at 80ms — box is mostly faded by then — so enter starts almost in parallel.
function _navAnimateLeaveThen(entry, onDone) {
    const box = _navBoxForEntry(entry);
    if (!box) {
        _navCloseForEntry(entry);
        onDone();
        return;
    }
    box.classList.remove('nav-leaving');
    void box.offsetWidth;
    box.classList.add('nav-leaving');
    setTimeout(() => {
        box.classList.remove('nav-leaving');
        _navCloseForEntry(entry);
        onDone();
    }, 80);
}

// Animate box out, close overlay after animation (used when switching overlays)
function _navAnimateLeave(entry) {
    const box = _navBoxForEntry(entry);
    if (!box) {
        _navCloseForEntry(entry);
        return;
    }
    box.classList.remove('nav-leaving');
    void box.offsetWidth;
    box.classList.add('nav-leaving');
    setTimeout(() => {
        box.classList.remove('nav-leaving');
        _navCloseForEntry(entry);
    }, 110);
}

function _navShowBackdrop() {
    if (!_navBackdropEl) {
        _navBackdropEl = document.createElement('div');
        _navBackdropEl.id = 'modalNavBackdrop';
        document.body.appendChild(_navBackdropEl);
    }
    _navBackdropEl.style.display = 'block';
}

function _navHideBackdrop() {
    if (_navBackdropEl) _navBackdropEl.style.display = 'none';
}

function _navCloseCurrentSilent() {
    const entry = (_navIdx >= 0 && _navStack[_navIdx]) ? _navStack[_navIdx] : _navCurrentEntry;
    _navCloseForEntry(entry);
}

function _navCloseForEntry(entry) {
    if (!entry) return;
    switch (entry.type) {
        case 'friend':
            if (typeof closeFriendDetail === 'function') closeFriendDetail(true);
            break;
        case 'world':
            if (typeof closeWorldDetail === 'function') closeWorldDetail(true);
            break;
        case 'worldSearch':
            if (typeof closeWorldSearchDetail === 'function') closeWorldSearchDetail(true);
            break;
        case 'avatar':
            if (typeof closeAvatarDetail === 'function') closeAvatarDetail(true);
            break;
        case 'group':
        case 'event': {
            const md = document.getElementById('modalDetail');
            if (md) md.style.display = 'none';
            break;
        }
        case 'instance': {
            const mi = document.getElementById('modalMyInstance');
            if (mi) mi.style.display = 'none';
            break;
        }
        case 'myprofile': {
            const mp = document.getElementById('modalMyProfile');
            if (mp) mp.style.display = 'none';
            break;
        }
    }
}

const _NAV_SHELLS = [
    { overlay: 'modalFriendDetail', bar: 'fd_navBar', p: 'fd' },
    { overlay: 'modalWorldDetail',  bar: 'wd_navBar', p: 'wd' },
    { overlay: 'modalDetail',       bar: 'dt_navBar', p: 'dt' },
    { overlay: 'modalAvatarDetail', bar: 'av_navBar', p: 'av' },
    { overlay: 'modalMyInstance',   bar: 'mi_navBar', p: 'mi' },
];

const _NAV_SLOTS = 5;

function _navRender() {
    for (const s of _NAV_SHELLS) {
        const bar = document.getElementById(s.bar);
        if (bar) bar.style.display = 'none';
    }
    _navSyncTaskbar();
}

function _trunc(s, max = 12) {
    s = String(s || '');
    return s.length > max ? s.slice(0, max) + '…' : s;
}

function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _navTypeLabel(type) {
    const labels = {
        friend:      typeof t === 'function' ? t('nav.modal.friend',      'Profile') : 'Profile',
        world:       typeof t === 'function' ? t('nav.modal.world',       'World')   : 'World',
        worldSearch: typeof t === 'function' ? t('nav.modal.world',       'World')   : 'World',
        avatar:      typeof t === 'function' ? t('nav.modal.avatar',      'Avatar')  : 'Avatar',
        group:       typeof t === 'function' ? t('nav.modal.group',       'Group')   : 'Group',
        event:       typeof t === 'function' ? t('nav.modal.event',       'Event')   : 'Event',
        instance:    typeof t === 'function' ? t('nav.modal.instance',    'Instance'): 'Instance',
        myprofile:   typeof t === 'function' ? t('nav.modal.friend',      'Profile') : 'Profile',
    };
    return labels[type] || type;
}

function jsonHighlight(obj) {
    const json = JSON.stringify(obj, null, 2);
    const re = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g;
    let result = '';
    let last = 0;
    let m;
    while ((m = re.exec(json)) !== null) {
        const pre = json.slice(last, m.index).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        result += pre;
        const match = m[0];
        const safe = match.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        let cls = 'json-num';
        if (/^"/.test(match))       cls = /:$/.test(match) ? 'json-key' : 'json-str';
        else if (/true|false/.test(match)) cls = 'json-bool';
        else if (/null/.test(match))       cls = 'json-null';
        result += `<span class="${cls}">${safe}</span>`;
        last = m.index + match.length;
    }
    result += json.slice(last).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return result;
}
