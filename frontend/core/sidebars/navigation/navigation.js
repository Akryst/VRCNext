let _navIsLinux = false;

function navSetLinux(v) {
    _navIsLinux = v;
    navRender();
}

function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
    localStorage.setItem('vrcnext_sidebar', sidebarCollapsed ? '1' : '0');
    const sidebar = document.getElementById('sidebarEl');
    const sbEl = document.getElementById('sbIcon'); if (sbEl) sbEl.textContent = sidebarCollapsed ? 'chevron_right' : 'chevron_left';
    if (sidebarCollapsed) {
        sidebar.classList.add('collapsing');
        setTimeout(() => {
            sidebar.classList.remove('collapsing');
            sidebar.classList.add('collapsed');
        }, 230);
    } else {
        sidebar.classList.remove('collapsed');
    }
}

function navRender() {
    const navEl = document.getElementById('navEl');
    if (!navEl) return;
    const { layout, hidden } = navLoadLayout();
    const hiddenSet = new Set(hidden);

    navEl.innerHTML = '';

    for (const entry of layout) {
        if (entry.type === 'item') {
            const def = NAV_ITEMS_DEF[entry.key];
            if (!def || hiddenSet.has(entry.key)) continue;
            if (def.windowsOnly && _navIsLinux) continue;
            navEl.appendChild(_navMakeItemBtn(entry.key, entry.icon || def.icon, def.tab, def.i18n, def.label));
        } else if (entry.type === 'folder') {
            const visItems = (entry.items || []).filter(k => {
                const d = NAV_ITEMS_DEF[k];
                return d && !hiddenSet.has(k) && !(d.windowsOnly && _navIsLinux);
            });
            if (!visItems.length) continue;
            navEl.appendChild(_navMakeFolderGroup(entry, visItems));
        }
    }

    if (typeof applyTranslations === 'function') applyTranslations(navEl);

    navEl.querySelectorAll('.nav-group[data-group-id]').forEach(g => {
        if (localStorage.getItem('vrcnext_navgroup_' + g.dataset.groupId) === '1')
            g.classList.add('collapsed');
    });

    const activeTab = (typeof _prevTab !== 'undefined' && _prevTab >= 0) ? _prevTab : 0;
    navEl.querySelectorAll('.nav-btn[onclick]').forEach(b => {
        const match = b.getAttribute('onclick')?.match(/showTab\((\d+)\)/);
        if (match && parseInt(match[1]) === activeTab) {
            b.classList.add('active');
            const parentGroup = b.closest('.nav-group');
            if (parentGroup) { parentGroup.classList.add('has-active'); parentGroup.classList.remove('collapsed'); }
        }
    });

    applyNavFolderMode();
}

function navIsModernFolders() {
    return typeof settings === 'undefined' ? true : settings.modernFolderLayout !== false;
}

function applyNavFolderMode() {
    const navEl = document.getElementById('navEl');
    if (!navEl) return;
    const modern = navIsModernFolders();
    navEl.classList.toggle('modern-folders', modern);
    if (!modern) closeNavFolderPopout();
}

let _navFolderPopoutId = null;

function closeNavFolderPopout() {
    document.getElementById('navFolderPopout')?.remove();
    document.removeEventListener('mousedown', _navPopoutOutside, true);
    document.removeEventListener('keydown', _navPopoutKey, true);
    document.querySelectorAll('.nav-group.popout-open').forEach(g => g.classList.remove('popout-open'));
    _navFolderPopoutId = null;
}

function _navPopoutOutside(e) {
    const pop = document.getElementById('navFolderPopout');
    if (!pop || pop.contains(e.target)) return;
    if (e.target.closest('.nav-group-btn')) return;
    closeNavFolderPopout();
}

function _navPopoutKey(e) {
    if (e.key === 'Escape') closeNavFolderPopout();
}

function openNavFolderPopout(groupId, anchorEl) {
    if (!anchorEl) return;
    if (_navFolderPopoutId === groupId) { closeNavFolderPopout(); return; }
    closeNavFolderPopout();

    const { layout, hidden } = navLoadLayout();
    const hiddenSet = new Set(hidden);
    const entry = layout.find(e => e.type === 'folder' && e.id === groupId);
    if (!entry) return;
    const visItems = (entry.items || []).filter(k => {
        const d = NAV_ITEMS_DEF[k];
        return d && !hiddenSet.has(k) && !(d.windowsOnly && _navIsLinux);
    });
    if (!visItems.length) return;

    const activeTab = (typeof _prevTab !== 'undefined' && _prevTab >= 0) ? _prevTab : -1;

    const pop = document.createElement('div');
    pop.className = 'nav-folder-popout vrcn-scrollbar';
    pop.id = 'navFolderPopout';

    const title = document.createElement('div');
    title.className = 'nav-folder-popout-title';
    title.textContent = entry.name || 'Folder';
    pop.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'nav-folder-popout-grid';
    if (visItems.length > 9) grid.classList.add('has-scroll');
    for (const key of visItems) {
        const def = NAV_ITEMS_DEF[key];
        if (!def) continue;
        const cell = document.createElement('button');
        cell.className = 'nav-folder-cell';
        if (def.tab === activeTab) cell.classList.add('active');
        cell.addEventListener('click', () => { showTab(def.tab); closeNavFolderPopout(); });

        const ic = document.createElement('span');
        ic.className = 'nav-folder-cell-icon msi';
        ic.textContent = def.icon;
        cell.appendChild(ic);

        const lbl = document.createElement('span');
        lbl.className = 'nav-folder-cell-label';
        lbl.dataset.i18n = def.i18n;
        lbl.textContent = def.label || '';
        cell.appendChild(lbl);

        grid.appendChild(cell);
    }
    pop.appendChild(grid);

    document.body.appendChild(pop);
    if (typeof applyTranslations === 'function') applyTranslations(pop);

    const sidebar = document.getElementById('sidebarEl');
    const aRect = anchorEl.getBoundingClientRect();
    const sRect = (sidebar || anchorEl).getBoundingClientRect();
    const gap = 6;
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    let left = sRect.right + gap;
    let top = aRect.top;
    if (left + pw > window.innerWidth - 8) left = aRect.left - pw - gap; 
    if (left < 8) left = 8;
    if (top + ph > window.innerHeight - 8) top = window.innerHeight - ph - 8;
    if (top < 8) top = 8;
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';

    anchorEl.closest('.nav-group')?.classList.add('popout-open');
    _navFolderPopoutId = groupId;

    setTimeout(() => {
        document.addEventListener('mousedown', _navPopoutOutside, true);
        document.addEventListener('keydown', _navPopoutKey, true);
    }, 0);
}

function _navMakeItemBtn(key, icon, tab, i18nKey, labelFallback) {
    const btn = document.createElement('button');
    btn.className = 'nav-btn';
    btn.setAttribute('onclick', `showTab(${tab})`);

    const ni = document.createElement('span');
    ni.className = 'ni msi';
    ni.textContent = icon;
    btn.appendChild(ni);

    const nl = document.createElement('span');
    nl.className = 'nl';
    nl.dataset.i18n = i18nKey;
    nl.textContent = labelFallback || '';
    btn.appendChild(nl);

    if (key === 'dashboard') btn.dataset.nav = 'dashboard';
    if (key === 'vr-overlay') {
        const dot = document.createElement('span');
        dot.className = 'sf-dot offline nl';
        dot.id = 'badgeVro';
        dot.style.cssText = 'margin-left:auto;margin-right:4px;width:7px;height:7px;flex-shrink:0;';
        btn.appendChild(dot);
    }
    if (key === 'event-snipe') {
        const dot = document.createElement('span');
        dot.id = 'snipeNavDot';
        dot.style.cssText = 'display:none;width:7px;height:7px;border-radius:50%;background:var(--ok,#4caf50);margin-left:auto;margin-right:4px;flex-shrink:0;';
        btn.appendChild(dot);
    }
    return btn;
}

function _navMakeFolderGroup(entry, visItems) {
    const group = document.createElement('div');
    group.className = 'nav-group';
    group.id = entry.id;
    group.dataset.groupId = entry.id;

    const hdr = document.createElement('button');
    hdr.className = 'nav-btn nav-group-btn';
    hdr.setAttribute('onclick', `toggleNavGroup('${entry.id}')`);

    const ni = document.createElement('span');
    ni.className = 'ni msi';
    ni.textContent = entry.icon || 'folder';
    hdr.appendChild(ni);

    const nl = document.createElement('span');
    nl.className = 'nl';
    nl.textContent = entry.name || 'Folder';
    hdr.appendChild(nl);

    const arrow = document.createElement('span');
    arrow.className = 'nav-group-arrow msi nl';
    arrow.textContent = 'expand_more';
    hdr.appendChild(arrow);

    group.appendChild(hdr);

    const items = document.createElement('div');
    items.className = 'nav-group-items';
    for (const key of visItems) {
        const def = NAV_ITEMS_DEF[key];
        if (!def) continue;
        const btn = _navMakeItemBtn(key, def.icon, def.tab, def.i18n, def.label);
        btn.classList.add('nav-sub');
        items.appendChild(btn);
    }
    group.appendChild(items);
    return group;
}

navRender();
