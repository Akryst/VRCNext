/* === SmartSearch — local cache-only search across friends, worlds, groups, avatars, events === */

const SmartSearch = (() => {
    let _myWorlds = [];
    let _calEventsCache = [];

    function _patchRenderMyWorlds() {
        if (typeof renderMyWorlds !== 'function') return;
        const _orig = renderMyWorlds;
        window.renderMyWorlds = function(worlds) {
            _myWorlds = Array.isArray(worlds) ? worlds : [];
            return _orig.call(this, worlds);
        };
    }

    function _patchCalEvents() {
        if (typeof renderCalendarEvents !== 'function') return;
        const _orig = renderCalendarEvents;
        window.renderCalendarEvents = function(payload) {
            // Mirror the normalization calendar.js does
            let raw = payload;
            if (raw?.events) raw = raw.events;
            else if (raw?.results) raw = raw.results;
            else if (raw?.data) raw = raw.data;
            const all = Array.isArray(raw) ? raw : [];
            if (all.length > 0) _calEventsCache = all;
            return _orig.call(this, payload);
        };
    }

    // ---- Search sections ----

    const SECTIONS = [
        {
            key: 'friends',
            labelKey: 'search.section.friends',
            label: 'Friends',
            getData: () => typeof vrcFriendsData !== 'undefined' ? vrcFriendsData : [],
            match: (item, q) =>
                (item.displayName || '').toLowerCase().includes(q) ||
                (item.username || item.userName || '').toLowerCase().includes(q) ||
                (item.id || '').toLowerCase().includes(q),
            getImg: (item) => ({ src: item.image || '', circle: false }),
            getName: (item) => item.displayName || '?',
            getSub: (item) => (typeof statusLabel === 'function')
                ? (item.statusDescription || statusLabel(item.status))
                : (item.statusDescription || item.status || ''),
            renderAvatar: (item) => {
                const presenceType = item.presence === 'web' ? 'web'
                    : (!item.presence || item.presence === 'offline' ? 'offline' : 'online');
                const statusCls = presenceType === 'offline' ? 's-offline'
                    : (typeof statusDotClass === 'function' ? statusDotClass(item.status) : 's-offline');
                const badgeDotCls = presenceType === 'web' ? 'vrc-status-ring' : 'vrc-status-dot';

                const wrap = document.createElement('div');
                wrap.className = 'vrc-friend-avatar-wrap';

                if (item.image) {
                    const img = document.createElement('img');
                    img.className = 'vrc-friend-avatar';
                    img.src = item.image;
                    img.onerror = function() {
                        const ph = document.createElement('div');
                        ph.className = 'vrc-friend-avatar';
                        ph.style.cssText = 'display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--tx3)';
                        ph.textContent = (item.displayName || '?')[0].toUpperCase();
                        this.parentNode.replaceChild(ph, this);
                    };
                    wrap.appendChild(img);
                } else {
                    const ph = document.createElement('div');
                    ph.className = 'vrc-friend-avatar';
                    ph.style.cssText = 'display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--tx3)';
                    ph.textContent = (item.displayName || '?')[0].toUpperCase();
                    wrap.appendChild(ph);
                }

                const badge = document.createElement('span');
                badge.className = `vrc-friend-status-badge ${badgeDotCls} ${statusCls}`;
                wrap.appendChild(badge);
                return wrap;
            },
            onOpen: (item) => { if (typeof openFriendDetail === 'function') openFriendDetail(item.id); },
        },
        {
            key: 'favWorlds',
            labelKey: 'search.section.fav_worlds',
            label: 'Favorite Worlds',
            getData: () => typeof favWorldsData !== 'undefined' ? favWorldsData : [],
            match: (item, q) => (item.name || '').toLowerCase().includes(q),
            getImg: (item) => ({ src: item.thumbnailImageUrl || item.imageUrl || '', circle: false }),
            getName: (item) => item.name || '?',
            getSub: () => '',
            onOpen: (item) => { if (typeof openWorldSearchDetail === 'function') openWorldSearchDetail(item.id); },
        },
        {
            key: 'myWorlds',
            labelKey: 'search.section.my_worlds',
            label: 'My Worlds',
            getData: () => _myWorlds,
            match: (item, q) => (item.name || '').toLowerCase().includes(q),
            getImg: (item) => ({ src: item.thumbnailImageUrl || item.imageUrl || '', circle: false }),
            getName: (item) => item.name || '?',
            getSub: () => '',
            onOpen: (item) => { if (typeof openWorldSearchDetail === 'function') openWorldSearchDetail(item.id); },
        },
        {
            key: 'myGroups',
            labelKey: 'search.section.my_groups',
            label: 'My Groups',
            getData: () => typeof myGroups !== 'undefined' ? myGroups : [],
            match: (item, q) => (item.name || '').toLowerCase().includes(q) || (item.shortCode || '').toLowerCase().includes(q),
            getImg: (item) => ({ src: item.iconUrl || '', circle: false }),
            getName: (item) => item.name || '?',
            getSub: (item) => item.shortCode || '',
            onOpen: (item) => { if (typeof openGroupDetail === 'function') openGroupDetail(item.id); },
        },
        {
            key: 'events',
            labelKey: 'search.section.events',
            label: 'Events',
            getData: () => _calEventsCache,
            match: (item, q) => (item.title || '').toLowerCase().includes(q),
            getImg: (item) => ({ src: item.imageUrl || '', circle: false }),
            getName: (item) => item.title || 'Untitled Event',
            getSub: () => '',
            onOpen: (item) => { if (typeof openEventDetail === 'function') openEventDetail(item.ownerId || '', item.id || ''); },
        },
        {
            key: 'myAvatars',
            labelKey: 'search.section.my_avatars',
            label: 'My Avatars',
            getData: () => typeof avatarsData !== 'undefined' ? avatarsData : [],
            match: (item, q) => (item.name || '').toLowerCase().includes(q),
            getImg: (item) => ({ src: item.thumbnailImageUrl || item.imageUrl || '', circle: false }),
            getName: (item) => item.name || '?',
            getSub: () => '',
            onOpen: (item) => { if (typeof openAvatarDetail === 'function') openAvatarDetail(item.id); },
        },
        {
            key: 'favAvatars',
            labelKey: 'search.section.fav_avatars',
            label: 'Favorited Avatars',
            getData: () => typeof favAvatarsData !== 'undefined' ? favAvatarsData : [],
            match: (item, q) => (item.name || '').toLowerCase().includes(q),
            getImg: (item) => ({ src: item.thumbnailImageUrl || item.imageUrl || '', circle: false }),
            getName: (item) => item.name || '?',
            getSub: (item) => item.favoriteGroup || '',
            onOpen: (item) => { if (typeof openAvatarDetail === 'function') openAvatarDetail(item.id); },
        },
    ];

    const MAX_PER_SECTION = 5;

    function _query(raw) {
        const q = raw.trim().toLowerCase();
        if (!q) return [];
        const out = [];
        for (const section of SECTIONS) {
            const hits = section.getData().filter(item => section.match(item, q)).slice(0, MAX_PER_SECTION);
            if (hits.length) out.push({ section, hits });
        }
        return out;
    }

    // ---- DOM ----
    let _wrap, _badge, _inputWrap, _input, _dropdown;
    let _open = false;
    let _debouncedRender = null;

    // Build a result row entirely via DOM — avoids any innerHTML/onerror injection issues
    function _renderItem(section, item) {
        const name = section.getName(item);
        const sub = section.getSub(item);
        const imgInfo = section.getImg(item);
        const circleClass = imgInfo.circle ? ' ss-img-circle' : '';

        const row = document.createElement('div');
        row.className = 'ss-item';

        // Image / placeholder — use custom renderer for friends (status badge)
        if (section.renderAvatar) {
            row.appendChild(section.renderAvatar(item));
        } else if (imgInfo.src) {
            const img = document.createElement('img');
            img.className = 'ss-item-img' + circleClass;
            img.src = imgInfo.src;
            img.onerror = function() {
                const ph = document.createElement('div');
                ph.className = 'ss-item-img-placeholder' + circleClass;
                ph.textContent = (name[0] || '?').toUpperCase();
                this.parentNode.replaceChild(ph, this);
            };
            row.appendChild(img);
        } else {
            const ph = document.createElement('div');
            ph.className = 'ss-item-img-placeholder' + circleClass;
            ph.textContent = (name[0] || '?').toUpperCase();
            row.appendChild(ph);
        }


        // Text
        const info = document.createElement('div');
        info.style.cssText = 'min-width:0;flex:1;';
        const nameEl = document.createElement('div');
        nameEl.className = 'ss-item-name';
        nameEl.textContent = name;
        info.appendChild(nameEl);
        if (sub) {
            const subEl = document.createElement('div');
            subEl.className = 'ss-item-sub';
            subEl.textContent = sub;
            info.appendChild(subEl);
        }
        row.appendChild(info);

        row.addEventListener('mousedown', (e) => {
            e.preventDefault();
            section.onOpen(item);
            _close();
        });

        return row;
    }

    function _renderResults(results) {
        _dropdown.innerHTML = '';
        if (results.length === 0) {
            const el = document.createElement('div');
            el.className = 'ss-empty';
            el.textContent = (typeof t === 'function') ? t('search.no_results', 'No results') : 'No results';
            _dropdown.appendChild(el);
        } else {
            for (const { section, hits } of results) {
                const hdr = document.createElement('div');
                hdr.className = 'ss-section-hdr';
                hdr.textContent = (typeof t === 'function') ? t(section.labelKey, section.label) : section.label;
                _dropdown.appendChild(hdr);
                for (const item of hits) _dropdown.appendChild(_renderItem(section, item));
            }
        }
        _showDropdown();
    }

    function _showDropdown() {
        _dropdown.classList.add('ss-visible');
    }

    function _hideDropdown() {
        _dropdown.classList.remove('ss-visible');
        _dropdown.innerHTML = '';
    }

    function _showHint() {
        const hint = document.createElement('div');
        hint.className = 'ss-hint';
        hint.innerHTML = '<span class="msi">search</span>';
        hint.appendChild(document.createTextNode((typeof t === 'function') ? t('search.hint', 'Search friends, worlds, groups, avatars…') : 'Search friends, worlds, groups, avatars…'));
        _dropdown.innerHTML = '';
        _dropdown.appendChild(hint);
        _showDropdown();
    }

    function _open_ui() {
        if (_open) return;
        _open = true;
        _badge.classList.add('ss-badge-hidden');
        _inputWrap.classList.add('ss-visible');
        // Focus after the expand transition starts
        setTimeout(() => _input.focus(), 60);
        _input.value = '';
    }

    function _close() {
        if (!_open) return;
        _open = false;
        _inputWrap.classList.remove('ss-visible');
        _badge.classList.remove('ss-badge-hidden');
        _hideDropdown();
        _input.value = '';
        _hideDebAnim('ssInput');
    }

    function _onInput() {
        const q = _input.value.trim();
        if (!q) { _hideDebAnim('ssInput'); _hideDropdown(); _showHint(); return; }
        _debouncedRender();
    }

    function init() {
        _wrap     = document.getElementById('ssWrap');
        _badge    = document.getElementById('ssBadge');
        _inputWrap = document.getElementById('ssInputWrap');
        _input    = document.getElementById('ssInput');
        _dropdown = document.getElementById('ssDropdown');

        if (!_wrap || !_badge || !_inputWrap || !_input || !_dropdown) return;

        _debouncedRender = debounceAnim(
            () => _renderResults(_query(_input.value.trim())),
            typeof DEBOUNCE_SEARCH_MS !== 'undefined' ? DEBOUNCE_SEARCH_MS : 200, // Short Debounce instead of 500ms
            'ssInput'
        );

        _patchRenderMyWorlds();
        _patchCalEvents();

        _badge.addEventListener('click', _open_ui);

        _input.addEventListener('input', _onInput);
        _input.addEventListener('focus', () => {
            if (!_input.value.trim()) _showHint();
            else _showDropdown();
        });
        _input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { e.preventDefault(); _close(); }
        });

        document.getElementById('ssCloseBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            _close();
        });

        document.addEventListener('mousedown', (e) => {
            if (_open && !_wrap.contains(e.target)) _close();
        });
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', () => SmartSearch.init());
