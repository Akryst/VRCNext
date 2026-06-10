var _helpPanelOpen = false;
var _helpDismiss = null;

// Updates the App-dropdown user header with the active user's icon and display name.
function updateTbAppUserHeader() {
    var av = document.getElementById('tbAppUserAvatar');
    var nm = document.getElementById('tbAppUserName');
    if (!av || !nm) return;
    var u = (typeof currentVrcUser !== 'undefined') ? currentVrcUser : null;
    if (u) {
        av.style.backgroundImage = u.image ? "url('" + u.image.replace(/'/g, "\\'") + "')" : '';
        nm.textContent = u.displayName || '';
    } else {
        av.style.backgroundImage = '';
        nm.textContent = '';
    }
}

// Opens the Settings tab and switches to the Accounts section.
function openAccountsSection() {
    if (typeof showTab === 'function') showTab(9);
    if (typeof switchSettingsSection === 'function') switchSettingsSection('accounts', null);
}

function toggleHelpPanel() {
    _helpPanelOpen = !_helpPanelOpen;
    var panel = document.getElementById('helpPanel');
    if (_helpPanelOpen) {
        var titleEl = document.getElementById('pageTitle');
        if (titleEl) {
            var r = titleEl.getBoundingClientRect();
            var z = (typeof _guiZoom !== 'undefined' ? _guiZoom : 1) || 1;
            panel.style.left = Math.max(8, r.left / z) + 'px';
        }
        var activeTab = document.querySelector('.tab.active');
        var tabIndex = activeTab ? (parseInt(activeTab.id.replace('tab', '')) || 0) : 0;
        document.getElementById('helpPanelTitle').textContent = titleEl ? titleEl.textContent : '';
        document.getElementById('helpPanelText').textContent = t('page.help.' + tabIndex, '');
        panel.style.display = '';
        requestAnimationFrame(function() { panel.classList.add('panel-open'); });
        setTimeout(function() {
            _helpDismiss = function(ev) {
                var p = document.getElementById('helpPanel');
                var tl = document.getElementById('pageTitle');
                if (!p.contains(ev.target) && ev.target !== tl) toggleHelpPanel();
            };
            document.addEventListener('click', _helpDismiss);
        }, 0);
    } else {
        if (_helpDismiss) { document.removeEventListener('click', _helpDismiss); _helpDismiss = null; }
        panel.classList.remove('panel-open');
        setTimeout(function() { if (!_helpPanelOpen) panel.style.display = 'none'; }, 90);
    }
}

function tbZoomStep(dir) {
    var z = Math.round((_guiZoom + dir * 0.1) * 10) / 10;
    z = Math.min(2, Math.max(0.5, z));
    applyGuiZoom(z);
    try { autoSave(); } catch {}
}

function tbToggleTools() {
    var group  = document.getElementById('tbToolsGroup');
    var menu   = document.getElementById('tbMenuItems');
    var btn    = document.getElementById('tbToolsToggle');
    var open   = group.classList.contains('tb-expanded');
    group.classList.toggle('tb-expanded', !open);
    menu.classList.toggle('tb-collapsed', !open);
    btn.classList.toggle('tb-active', !open);
}

(function () {
    var _open = null;
    var _openSubDrop = null;

    function closeSubDrop() {
        if (_openSubDrop) { _openSubDrop.style.display = 'none'; _openSubDrop = null; }
    }

    function closeMenus() {
        closeSubDrop();
        if (_open) { _open.classList.remove('open'); _open = null; }
    }

    function activateMenu(item) {
        if (_open && _open !== item) _open.classList.remove('open');
        var drop = item.querySelector('.tb-dropdown');
        if (drop) {
            var r = item.getBoundingClientRect();
            var z = (typeof _guiZoom !== 'undefined' ? _guiZoom : 1) || 1;
            drop.style.top  = (r.bottom / z) + 'px';
            drop.style.left = (r.left / z) + 'px';
        }
        item.classList.add('open');
        _open = item;
    }

    document.querySelectorAll('.tb-menu-item').forEach(function (item) {
        item.addEventListener('mousedown', function (e) {
            // Click came from inside the dropdown — let it through untouched
            if (e.target.closest('.tb-dropdown')) return;
            e.stopPropagation();
            if (item.classList.contains('open')) { closeMenus(); } else { activateMenu(item); }
        });
        item.addEventListener('mouseenter', function () {
            if (_open && _open !== item) activateMenu(item);
        });
    });

    document.querySelectorAll('.tb-dd-submenu').forEach(function(sub) {
        var drop = sub.querySelector('.tb-dd-sub-drop');
        if (!drop) return;
        sub.addEventListener('mouseenter', function() {
            closeSubDrop();
            var r = sub.getBoundingClientRect();
            var z = (typeof _guiZoom !== 'undefined' ? _guiZoom : 1) || 1;
            var vw = window.innerWidth / z;
            var vh = window.innerHeight / z;
            drop.style.visibility = 'hidden';
            drop.style.display = 'block';
            var sw = drop.offsetWidth;
            var sh = drop.offsetHeight;
            drop.style.visibility = '';
            var left = r.right / z + 4;
            if (left + sw > vw - 4) left = r.left / z - sw - 4;
            var top = r.top / z;
            if (top + sh > vh - 4) top = Math.max(4, vh - sh - 4);
            drop.style.left = Math.max(4, left) + 'px';
            drop.style.top = top + 'px';
            _openSubDrop = drop;
        });
        sub.addEventListener('mouseleave', function(e) {
            if (e.relatedTarget && drop.contains(e.relatedTarget)) return;
            setTimeout(function() {
                if (_openSubDrop === drop && !drop.matches(':hover')) closeSubDrop();
            }, 80);
        });
        drop.addEventListener('mouseleave', function(e) {
            if (e.relatedTarget && sub.contains(e.relatedTarget)) return;
            closeSubDrop();
        });
    });

    // Close menu after a dropdown item is clicked (fires after onclick)
    document.querySelectorAll('.tb-dd-item').forEach(function (ddItem) {
        ddItem.addEventListener('click', function () {
            closeMenus();
            if (!ddItem.hasAttribute('data-keep-modal')) {
                document.querySelectorAll('.modal-overlay').forEach(function (ov) {
                    if (ov.style.display && ov.style.display !== 'none') ov.style.display = 'none';
                });
                if (typeof navClear === 'function') navClear();
            }
        });
    });

    // Close on click anywhere outside a menu
    document.addEventListener('mousedown', function (e) {
        if (!e.target.closest('.tb-menu-item')) closeMenus();
    });

    // Drag: taskbar background (excluding interactive elements)
    var bar = document.getElementById('taskbar');
    if (bar) {
        bar.addEventListener('mousedown', function (e) {
            if (e.button !== 0 || e.detail !== 1) return;
            if (e.target.closest('.tb-menu-item,.tb-sidebar-btn,.tb-win-btn,.mini-badge,.ss-wrap,.topbar-title,button,input')) return;
            if (e.clientY < 6) return; // top resize zone — let resize handler take over
            sendToCS({ action: 'windowDragStart' });
        });
        bar.addEventListener('dblclick', function (e) {
            if (e.target.closest('.tb-menu-item,.tb-sidebar-btn,.tb-win-btn,.mini-badge,.ss-wrap,.topbar-title,button,input')) return;
            sendToCS({ action: 'windowMaximize' });
        });
    }
}());
