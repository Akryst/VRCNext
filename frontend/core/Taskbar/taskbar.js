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

    function closeMenus() {
        if (_open) { _open.classList.remove('open'); _open = null; }
    }

    function activateMenu(item) {
        if (_open && _open !== item) _open.classList.remove('open');
        var drop = item.querySelector('.tb-dropdown');
        if (drop) {
            var r = item.getBoundingClientRect();
            drop.style.top  = r.bottom + 'px';
            drop.style.left = r.left + 'px';
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

    // Close menu after a dropdown item is clicked (fires after onclick)
    document.querySelectorAll('.tb-dd-item').forEach(function (ddItem) {
        ddItem.addEventListener('click', closeMenus);
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
            if (e.target.closest('.tb-menu-item,.tb-sidebar-btn,.tb-win-btn,.mini-badge,.ss-wrap,button,input')) return;
            sendToCS({ action: 'windowDragStart' });
        });
        bar.addEventListener('dblclick', function (e) {
            if (e.target.closest('.tb-menu-item,.tb-sidebar-btn,.tb-win-btn,.mini-badge,.ss-wrap,button,input')) return;
            sendToCS({ action: 'windowMaximize' });
        });
    }
}());
