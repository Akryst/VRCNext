// Timeline - Tab 12
// Globals: timelineEvents, tlFilter  (declared in core.js)

// Pending scroll-to target: consumed by filterTimeline() after DOM is built
let _tlScrollTarget = null;

// Personal Timeline pagination state
let tlOffset = 0, tlLoading = false, tlHasMore = false;
// Total count from server (for accurate paginator)
let tlTotal = 0;
// Timeline view: how many events to render (Load More adds 100)
let tlRenderedCount = 100;
// List view: current page (0-indexed, 100 per page)
let tlListPage = 0;
// When set, next renderTimeline call replaces timelineEvents with the fetched page
let _tlPendingListPage = null;

// Friends Timeline pagination state
let ftlOffset = 0, ftlLoading = false, ftlHasMore = false;
// Total count from server (for accurate paginator)
let ftlTotal = 0;
// Timeline view: how many events to render (Load More adds 100)
let ftlRenderedCount = 100;
// List view: current page (0-indexed, 100 per page)
let ftlListPage = 0;
// When set, next renderFriendTimeline call replaces friendTimelineEvents with the fetched page
let _ftlPendingListPage = null;

// Active date filter (ISO string like "2026-03-01", empty = no filter)
let tlDateFilter = '';
let tlTabInited  = false;

// View mode: 'timeline' (card view) or 'list' (table view) — persisted in localStorage
let tlViewMode = localStorage.getItem('tlViewMode') || 'timeline';

// Server-side search state – Personal Timeline
let _tlSearchTimer  = null;
let _tlSearchMode   = false;
let _tlSearchEvents = [];   // current search page's events (max 100)
let _tlSearchQuery  = '';
let _tlSearchDate   = '';
let _tlSearchTotal  = 0;    // real total count from DB (COUNT query)
let _tlSearchPage   = 0;    // current search page (0-indexed)

// Server-side search state – Friends Timeline
let _ftlSearchTimer  = null;
let _ftlSearchMode   = false;
let _ftlSearchEvents = [];
let _ftlSearchQuery  = '';
let _ftlSearchDate   = '';
let _ftlSearchTotal  = 0;
let _ftlSearchPage   = 0;

// Events for the profile mini-timeline (populated per-profile-open, used by openTlDetail)
let _fdTimelineEvents = [];

// Events for the profile "Last Activity" pill (friend_events for this user)
let _fdUserActivityEvents = [];

// Filter button map
const TL_FILTER_IDS = {
    all:           'tlFAll',
    instance_join: 'tlFJoin',
    photo:         'tlFPhoto',
    first_meet:    'tlFMeet',
    meet_again:    'tlFMeetAgain',
    notification:  'tlFNotif',
    avatar_switch: 'tlFAvatar',
    video_url:     'tlFUrl',
};

// Type colours
const TL_TYPE_COLOR = {
    instance_join: 'var(--accent)',
    photo:         'var(--ok)',
    first_meet:    'var(--cyan)',
    meet_again:    '#AB47BC',
    notification:  'var(--warn)',
    avatar_switch: '#FF7043',
    video_url:     '#29B6F6',
};

// Type labels and icons
const TL_TYPE_META = {
    instance_join: { icon: 'travel_explore', key: 'timeline.types.instance_join', fallback: 'Instance Join' },
    photo:         { icon: 'camera',         key: 'timeline.types.photo',         fallback: 'Photo' },
    first_meet:    { icon: 'person_add',     key: 'timeline.types.first_meet',    fallback: 'First Meet' },
    meet_again:    { icon: 'person_check',   key: 'timeline.types.meet_again',    fallback: 'Meet Again' },
    notification:  { icon: 'notifications',  key: 'timeline.types.notification',  fallback: 'Notification' },
    avatar_switch: { icon: 'checkroom',      key: 'timeline.types.avatar_switch', fallback: 'Avatar Switch' },
    video_url:     { icon: 'link',           key: 'timeline.types.video_url',     fallback: 'URL' },
};

const TL_NOTIF_TYPE_META = {
    friendRequest: { key: 'timeline.notif.friend_request', fallback: 'Friend Request' },
    invite: { key: 'timeline.notif.world_invite', fallback: 'World Invite' },
    requestInvite: { key: 'timeline.notif.invite_request', fallback: 'Invite Request' },
    inviteResponse: { key: 'timeline.notif.invite_response', fallback: 'Invite Response' },
    requestInviteResponse: { key: 'timeline.notif.invite_request_response', fallback: 'Invite Req. Response' },
    votetokick: { key: 'timeline.notif.vote_to_kick', fallback: 'Vote to Kick' },
    boop: { key: 'timeline.notif.boop', fallback: 'Boop' },
    message: { key: 'timeline.notif.message', fallback: 'Message' },
    halted: { key: 'timeline.notif.instance_closed', fallback: 'Instance Closed' },
    'group.announcement': { key: 'timeline.notif.group_announcement', fallback: 'Group Announcement' },
    'group.invite': { key: 'timeline.notif.group_invite', fallback: 'Group Invite' },
    'group.joinRequest': { key: 'timeline.notif.group_join_request', fallback: 'Group Join Request' },
    'group.informationRequest': { key: 'timeline.notif.group_info_request', fallback: 'Group Info Request' },
    'group.transfer': { key: 'timeline.notif.group_transfer', fallback: 'Group Transfer' },
    'group.informative': { key: 'timeline.notif.group_info', fallback: 'Group Info' },
    'group.post': { key: 'timeline.notif.group_post', fallback: 'Group Post' },
    'group.event.created': { key: 'timeline.notif.group_event_created', fallback: 'Group Event Created' },
    'group.event.starting': { key: 'timeline.notif.group_event_starting', fallback: 'Group Event Starting' },
    'avatarreview.success': { key: 'timeline.notif.avatar_approved', fallback: 'Avatar Approved' },
    'avatarreview.failure': { key: 'timeline.notif.avatar_rejected', fallback: 'Avatar Rejected' },
    'badge.earned': { key: 'timeline.notif.badge_earned', fallback: 'Badge Earned' },
    'economy.alert': { key: 'timeline.notif.economy_alert', fallback: 'Economy Alert' },
    'economy.received.gift': { key: 'timeline.notif.gift_received', fallback: 'Gift Received' },
    'event.announcement': { key: 'timeline.notif.event_announcement', fallback: 'Event Announcement' },
    'invite.instance.contentGated': { key: 'timeline.notif.content_gated_invite', fallback: 'Content Gated Invite' },
    'moderation.contentrestriction': { key: 'timeline.notif.content_restriction', fallback: 'Content Restriction' },
    'moderation.notice': { key: 'timeline.notif.moderation_notice', fallback: 'Moderation Notice' },
    'moderation.report.closed': { key: 'timeline.notif.report_closed', fallback: 'Report Closed' },
    'moderation.warning.group': { key: 'timeline.notif.group_warning', fallback: 'Group Warning' },
    'promo.redeem': { key: 'timeline.notif.promo_redeemed', fallback: 'Promo Redeemed' },
    'vrcplus.gift': { key: 'timeline.notif.vrcplus_gift', fallback: 'VRC+ Gift' },
};

function tlDateLocale() {
    return getLanguageLocale();
}

function tlFormatLongDate(value) { return fmtLongDate(new Date(value)); }
function tlFormatShortDate(value) { return fmtShortDate(new Date(value)); }
function tlFormatTime(value) { return fmtTime(new Date(value)); }
function tlFormatDateFilterLabel(dateStr) { return fmtShortDate(new Date(dateStr + 'T00:00:00')); }

function tlTypeMeta(type) {
    const meta = TL_TYPE_META[type] ?? { icon: 'circle', key: `timeline.types.${type}`, fallback: type };
    return {
        icon: meta.icon,
        label: t(meta.key, meta.fallback || type),
    };
}

function ftTypeMeta(type) {
    const meta = FT_TYPE_META[type] ?? { icon: 'circle', key: `timeline.friend_types.${type}`, fallback: type };
    return {
        icon: meta.icon,
        label: t(meta.key, meta.fallback || type),
    };
}

function tlNotifTypeLabel(type) {
    const meta = TL_NOTIF_TYPE_META[type];
    if (!meta) return type || t('timeline.types.notification', 'Notification');
    return t(meta.key, meta.fallback);
}

function tlPlayersLabel(count) {
    return count === 1
        ? tf('timeline.players.one', { count }, `${count} player`)
        : tf('timeline.players.other', { count }, `${count} players`);
}

function tlSearchNoResults(search) {
    return tf('timeline.search.no_results', { query: search }, `No results for "${search}".`);
}

function tlSearchSummary(count, search) {
    return tf('timeline.search.results', { count: count.toLocaleString(), query: search }, `${count.toLocaleString()} results for "${search}"`);
}

function tlTotalSummary(count) {
    return tf('timeline.paginator.total', { count: count.toLocaleString() }, `${count.toLocaleString()} total`);
}

function tlListNaHtml() {
    return `<span class="tl-list-na">${esc(t('timeline.list.na', '-'))}</span>`;
}

function tlClearedHtml() {
    return `<span class="tl-list-na">${esc(t('timeline.value.cleared', '(cleared)'))}</span>`;
}

function tlDetailClearedHtml() {
    return `<em style="color:var(--tx3)">${esc(t('timeline.value.cleared', '(cleared)'))}</em>`;
}

// Public API

function setTlMode(mode) {
    tlMode = mode;
    document.getElementById('tlModePersonal')?.classList.toggle('active', mode === 'personal');
    document.getElementById('tlModeFriends')?.classList.toggle('active',  mode === 'friends');
    const pf = document.getElementById('tlPersonalFilters');
    const ff = document.getElementById('tlFriendsFilters');
    if (pf) pf.style.display = mode === 'personal' ? '' : 'none';
    if (ff) ff.style.display = mode === 'friends'  ? '' : 'none';
    _tlSearchMode = false; _tlSearchQuery = ''; _tlSearchDate = '';
    _ftlSearchMode = false; _ftlSearchQuery = ''; _ftlSearchDate = '';
    const activeSearch = (document.getElementById('tlSearchInput')?.value ?? '').trim();
    if (activeSearch) {
        if (mode === 'friends') { filterFriendTimeline(); return; }
        else { filterTimeline(); return; }
    }
    refreshTimeline();
}

function setTlViewMode(mode) {
    tlViewMode = mode;
    localStorage.setItem('tlViewMode', mode);
    document.getElementById('tlViewTimeline')?.classList.toggle('active', mode === 'timeline');
    document.getElementById('tlViewList')?.classList.toggle('active', mode === 'list');
    if (tlMode === 'friends') filterFriendTimeline();
    else filterTimeline();
}

function _initTlViewButtons() {
    document.getElementById('tlViewTimeline')?.classList.toggle('active', tlViewMode === 'timeline');
    document.getElementById('tlViewList')?.classList.toggle('active', tlViewMode === 'list');
}

function refreshTimeline() {
    _initTlViewButtons();
    if (tlMode === 'friends') { refreshFriendTimeline(); return; }
    if (!tlTabInited) {
        tlTabInited = true;
        const t = new Date();
        applyTlDateFilter(`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`);
        return;
    }
    // If we're navigating to a specific event and already have data, skip re-fetching
    // and render directly so _tlScrollTarget is consumed synchronously
    if (_tlScrollTarget && timelineEvents.length > 0) {
        filterTimeline();
        return;
    }
    timelineEvents  = [];
    tlOffset        = 0;
    tlHasMore       = false;
    tlLoading       = true;
    tlRenderedCount = 100;
    tlListPage      = 0;
    tlTotal         = 0;
    // If search is active, keep showing existing results during refresh instead of a loading flash
    const activeSearch = (document.getElementById('tlSearchInput')?.value ?? '').trim();
    const c = document.getElementById('tlContainer');
    if (c && !(_tlSearchMode && activeSearch)) {
        c.innerHTML = sk(tlViewMode === 'list' ? 'timeline-list' : 'timeline');
    }
    const typeParam = tlFilter === 'all' ? '' : tlFilter;
    if (tlDateFilter) sendToCS({ action: 'getTimelineByDate', date: tlDateFilter, type: typeParam });
    else              sendToCS({ action: 'getTimeline', type: typeParam });
}

function renderTimeline(payload) {
    const events  = Array.isArray(payload) ? payload : (payload?.events  ?? []);
    const hasMore = Array.isArray(payload) ? false   : (payload?.hasMore ?? false);
    const offset  = Array.isArray(payload) ? 0       : (payload?.offset  ?? 0);
    const total   = Array.isArray(payload) ? 0       : (payload?.total   ?? 0);

    // Discard stale response if filter was switched while this request was in-flight
    if (!Array.isArray(payload) && payload?.type !== undefined) {
        const expectedType = tlFilter === 'all' ? '' : tlFilter;
        if (payload.type !== expectedType) return;
    }
    // Discard stale getTimeline responses when a date filter is active
    if (tlDateFilter && payload?.date !== tlDateFilter) return;

    if (total > 0) tlTotal = total;

    if (_tlPendingListPage !== null) {
        // Direct page navigation: replace current events with this page's data
        timelineEvents     = events;
        tlListPage         = _tlPendingListPage;
        tlRenderedCount    = events.length;
        _tlPendingListPage = null;
    } else if (offset === 0) {
        timelineEvents  = events;
        tlRenderedCount = 100;
        tlListPage      = 0;
    } else {
        // Load More append (timeline/card view)
        timelineEvents  = timelineEvents.concat(events);
        tlRenderedCount += events.length;
    }
    tlOffset  = offset + events.length;
    tlHasMore = hasMore;
    tlLoading = false;
    filterTimeline();
    if (typeof updateFdTlPreview === 'function') updateFdTlPreview();
    if (typeof renderDashMyRecentTimeline === 'function') renderDashMyRecentTimeline();
}

function handleTimelineEvent(ev) {
    if (!ev || !ev.id) return;
    // If a type filter is active, only inject events that match it to avoid polluting the view
    if (tlFilter !== 'all' && ev.type !== tlFilter) return;
    const idx = timelineEvents.findIndex(e => e.id === ev.id);
    if (idx >= 0) timelineEvents[idx] = ev;
    else timelineEvents.unshift(ev);
    // Re-sort by timestamp descending
    timelineEvents.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    filterTimeline();
    // Update friend-detail preview if it's currently open
    if (typeof updateFdTlPreview === 'function') updateFdTlPreview();
}

function setTlFilter(f) {
    tlFilter        = f;
    tlListPage      = 0;
    tlRenderedCount = 100;
    tlTotal         = 0;
    document.querySelectorAll('#tlPersonalFilters .sub-tab-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(TL_FILTER_IDS[f]);
    if (btn) btn.classList.add('active');
    // Reset and re-fetch from server with type filter (server-side filtering)
    timelineEvents = [];
    tlOffset   = 0;
    tlHasMore  = false;
    tlLoading  = true;
    _tlSearchMode = false; _tlSearchQuery = ''; _tlSearchDate = '';
    const activeSearch = (document.getElementById('tlSearchInput')?.value ?? '').trim();
    if (activeSearch) { filterTimeline(); return; }
    const c = document.getElementById('tlContainer');
    if (c) c.innerHTML = sk(tlViewMode === 'list' ? 'timeline-list' : 'timeline');
    const typeParam = f === 'all' ? '' : f;
    if (tlDateFilter) sendToCS({ action: 'getTimelineByDate', date: tlDateFilter, type: typeParam });
    else              sendToCS({ action: 'getTimeline', type: typeParam });
}

function filterTimeline() {
    if (tlMode !== 'personal') return;
    const search = (document.getElementById('tlSearchInput')?.value ?? '').toLowerCase().trim();

    // When a search query is active: use server-side search for complete results
    if (search) {
        if (_tlSearchMode && search === _tlSearchQuery && tlDateFilter === _tlSearchDate) {
            // We have fresh results for exactly this query+date – render (handles filter-only changes)
            _renderTlSearchResults(search);
            return;
        }
        // Query or date changed → clear stale state, show loading, debounce
        _tlSearchMode   = false;
        _tlSearchQuery  = '';
        _tlSearchDate   = '';
        tlListPage      = 0;
        tlRenderedCount = 100;
        const c = document.getElementById('tlContainer');
        if (c) c.innerHTML = sk(tlViewMode === 'list' ? 'timeline-list' : 'timeline');
        _setTlPaginator('');
        clearTimeout(_tlSearchTimer);
        _tlSearchTimer = setTimeout(() => {
            const typeParam = tlFilter === 'all' ? '' : tlFilter;
            sendToCS({ action: 'searchTimeline', query: search, date: tlDateFilter, offset: 0, type: typeParam });
        }, 300);
        return;
    }

    // No search – clear search mode and show paginated events
    _tlSearchMode   = false;
    _tlSearchEvents = [];

    const c = document.getElementById('tlContainer');
    if (!c) return;

    if (!timelineEvents.length && !tlLoading) {
        if (tlDateFilter) {
            c.innerHTML = `<div class="empty-msg">${esc(t('timeline.empty.initial', 'No events for this day.'))}</div>`;
            _setTlPaginator('');
            return;
        }
        // Events cleared (e.g. filter switched while searching) — reload from server
        refreshTimeline();
        return;
    }

    const prevScrollTop = c.scrollTop;

    // Date filter: all events loaded at once → paginate client-side
    // Normal mode: server-side pagination (timelineEvents = current page only)
    const eventsToRender = tlDateFilter
        ? timelineEvents.slice(tlListPage * 100, (tlListPage + 1) * 100)
        : timelineEvents;
    const totalCount = tlDateFilter ? timelineEvents.length : tlTotal;
    const totalPages = totalCount > 0
        ? Math.ceil(totalCount / 100)
        : Math.max(tlListPage + 1, 1) + (tlHasMore ? 1 : 0);

    const contentHtml = tlViewMode === 'list'
        ? buildPersonalListHtml(eventsToRender)
        : buildTimelineHtml(eventsToRender);
    c.innerHTML = contentHtml;
    _setTlPaginator(buildTlPagination(tlListPage, totalPages, tlDateFilter ? false : tlHasMore));

    if (prevScrollTop > 0) c.scrollTop = prevScrollTop;

    // Scroll to and highlight a specific card if requested (e.g. from friend detail preview).
    // Only consume _tlScrollTarget if the card is actually in the newly-built DOM.
    if (_tlScrollTarget) {
        const probe = c.querySelector('[data-tlid="' + _tlScrollTarget + '"]');
        if (probe) {
            const target = _tlScrollTarget;
            _tlScrollTarget = null;
            setTimeout(() => {
                const card = c.querySelector('[data-tlid="' + target + '"]');
                if (card) {
                    card.scrollIntoView({ behavior: 'instant', block: 'center' });
                    card.classList.add('tl-card-highlight');
                    setTimeout(() => card.classList.remove('tl-card-highlight'), 2000);
                }
            }, 50);
        }
    }
}

function _renderTlSearchResults(search) {
    const c = document.getElementById('tlContainer');
    if (!c) return;

    const events = _tlSearchEvents; // already type-filtered by server (type sent in request)

    if (!events.length) {
        c.innerHTML = `<div class="empty-msg">${esc(tlSearchNoResults(search))}</div>`;
        _setTlPaginator('');
        return;
    }

    const total      = _tlSearchTotal;
    const totalPages = total > 0 ? Math.ceil(total / 100) : 1;
    const banner = `<div style="padding:6px 12px;font-size:11px;color:var(--tx3);border-bottom:1px solid var(--brd);">`
        + `${esc(tlSearchSummary(total, search))}</div>`;
    let html = banner + (tlViewMode === 'list' ? buildPersonalListHtml(events) : buildTimelineHtml(events));
    c.innerHTML = html;
    _setTlPaginator(buildSearchPagination(_tlSearchPage, totalPages, 'tlGoSearchPage', _tlSearchTotal));
}

// Called when backend delivers search results
function handleTlSearchResults(payload) {
    const q = (payload.query || '').toLowerCase().trim();
    // Ignore stale responses: user has already typed something different or changed the date
    const currentSearch = (document.getElementById('tlSearchInput')?.value ?? '').toLowerCase().trim();
    if (q !== currentSearch) return;
    if ((payload.date || '') !== tlDateFilter) return;
    const offset = payload.offset ?? 0;
    // Always replace — each page nav fetches the exact page, no appending
    _tlSearchEvents = payload.events || [];
    _tlSearchTotal  = payload.total ?? 0;
    _tlSearchPage   = Math.floor(offset / 100);
    _tlSearchMode   = true;
    _tlSearchQuery  = q;
    _tlSearchDate   = payload.date || '';
    filterTimeline();
}

function tlGoSearchPage(page) {
    if (page < 0) return;
    const typeParam = tlFilter === 'all' ? '' : tlFilter;
    sendToCS({ action: 'searchTimeline', query: _tlSearchQuery, date: _tlSearchDate, offset: page * 100, type: typeParam });
}

// Shared: builds fixed-slot page buttons so navigating never adds/removes buttons.
// ≤7 pages → show all. >7 pages → always [first][left-ell][m-1][m][m+1][right-ell][last]
// Ellipsis uses visibility:hidden (not display:none) when no gap → slot preserved, no layout shift.
function _buildPaginatorBtns(page, totalPages, onPageFn) {
    const btn = (i) => {
        const a = i === page ? ' style="background:var(--accent);color:#fff;"' : '';
        return `<button class="vrcn-button"${a} onclick="${onPageFn}(${i})">${i + 1}</button>`;
    };
    if (totalPages <= 7) {
        let h = '';
        for (let i = 0; i < totalPages; i++) h += btn(i);
        return h;
    }
    const last = totalPages - 1;
    // Clamp middle center to [2, last-2] so the window never overlaps first or last slot
    const mid = Math.max(2, Math.min(page, last - 2));
    const m0 = mid - 1, m2 = mid + 1;
    const ell = (show) =>
        `<span style="padding:0 4px;color:var(--tx3);${show ? '' : 'visibility:hidden;'}">…</span>`;
    return btn(0) + ell(m0 > 1) + btn(m0) + btn(mid) + btn(m2) + ell(m2 < last - 1) + btn(last);
}

function buildSearchPagination(page, totalPages, onPageFn, total = 0) {
    const countInfo = total > 0 ? `<span style="font-size:11px;color:var(--tx3);padding:0 8px;">${esc(tlTotalSummary(total))}</span>` : '';
    if (totalPages <= 1) return countInfo;
    const prevDis = page === 0 ? 'disabled' : '';
    const nextDis = page >= totalPages - 1 ? 'disabled' : '';
    return `<button class="vrcn-button" ${prevDis} onclick="${onPageFn}(${page - 1})"><span class="msi" style="font-size:16px;">chevron_left</span></button>
        ${_buildPaginatorBtns(page, totalPages, onPageFn)}
        <button class="vrcn-button" ${nextDis} onclick="${onPageFn}(${page + 1})"><span class="msi" style="font-size:16px;">chevron_right</span></button>
        ${countInfo}`;
}

// Personal Timeline pagination helpers

function loadMoreTimeline() {
    if (tlLoading) return;
    // Drain already-loaded pool first (timeline/card view)
    if (timelineEvents.length > tlRenderedCount) {
        tlRenderedCount += 100;
        filterTimeline();
        return;
    }
    if (!tlHasMore) return;
    tlLoading = true;
    const btn = document.getElementById('tlLoadMoreBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="msi" style="font-size:16px;">hourglass_empty</span> ${esc(t('timeline.load_more.loading', 'Loading...'))}`; }
    sendToCS({ action: 'getTimelinePage', offset: tlOffset, type: tlFilter === 'all' ? '' : tlFilter });
}

function _setTlPaginator(html) {
    const bar = document.getElementById('tlPaginatorBar');
    if (bar) bar.innerHTML = html;
}

function buildTlPagination(page, totalPages, hasMore) {
    const countInfo = tlTotal > 0 ? `<span style="font-size:11px;color:var(--tx3);padding:0 8px;">${esc(tlTotalSummary(tlTotal))}</span>` : '';
    if (totalPages <= 1 && !hasMore) return countInfo;
    const prevDis = page === 0 ? 'disabled' : '';
    const nextDis = (page >= totalPages - 1 && !hasMore) ? 'disabled' : '';
    return `<button class="vrcn-button" ${prevDis} onclick="tlGoPage(${page - 1})"><span class="msi" style="font-size:16px;">chevron_left</span></button>
        ${_buildPaginatorBtns(page, totalPages, 'tlGoPage')}
        <button class="vrcn-button" ${nextDis} onclick="tlGoPage(${page + 1})"><span class="msi" style="font-size:16px;">chevron_right</span></button>
        ${countInfo}`;
}

function tlGoPage(page) {
    if (page < 0) return;
    // Date filter active: all events in memory, paginate client-side
    if (tlDateFilter) {
        const totalPages = Math.ceil(timelineEvents.length / 100) || 1;
        if (page >= totalPages) return;
        if (page === tlListPage) { const c = document.getElementById('tlContainer'); if (c) c.scrollTop = 0; return; }
        tlListPage = page;
        filterTimeline();
        const c = document.getElementById('tlContainer');
        if (c) c.scrollTop = 0;
        return;
    }
    const totalPages = tlTotal > 0 ? Math.ceil(tlTotal / 100) : null;
    if (totalPages !== null && page >= totalPages) return;
    if (page === tlListPage && _tlPendingListPage === null && !tlLoading) {
        // Already on this page — just scroll top
        const c = document.getElementById('tlContainer');
        if (c) c.scrollTop = 0;
        return;
    }
    // Fetch this page directly from DB at absolute offset
    _tlPendingListPage = page;
    tlLoading = true;
    sendToCS({ action: 'getTimelinePage', offset: page * 100, type: tlFilter === 'all' ? '' : tlFilter });
    const c = document.getElementById('tlContainer');
    if (c) c.scrollTop = 0;
}

// Date filter

let _dpYear = 0, _dpMonth = 0; // currently rendered calendar month
let _dpMonthActivity = {};     // key: "YYYY-MM-DD" → { personal, friends }
let _dpActivityKey   = '';     // "YYYY-M" of loaded data

function handleTimelineMonthActivity(payload) {
    if (!payload?.days) return;
    _dpMonthActivity = {};
    _dpActivityKey   = payload.year + '-' + payload.month;
    for (const d of payload.days) _dpMonthActivity[d.date] = d;
    const picker = document.getElementById('tlDatePicker');
    if (picker && picker.style.display !== 'none') renderDatePickerCalendar();
}

function _dpDotHtml(hasP, hasF) {
    if (!hasP && !hasF) return '';
    const p = hasP ? '<span class="dp-dot dp-dot-p"></span>' : '';
    const f = hasF  ? '<span class="dp-dot dp-dot-f"></span>' : '';
    return `<span class="dp-dots">${p}${f}</span>`;
}

function toggleTlDatePicker() {
    const picker = document.getElementById('tlDatePicker');
    if (!picker) return;
    if (picker.style.display !== 'none') { picker.style.display = 'none'; return; }

    const btn = document.getElementById('tlDateBtn');
    const rect = btn.getBoundingClientRect();

    // Init calendar to selected date or today
    const base = tlDateFilter ? new Date(tlDateFilter + 'T00:00:00') : new Date();
    _dpYear  = base.getFullYear();
    _dpMonth = base.getMonth();
    // Debug: request month activity to verify payload delivery
    sendToCS({ action: 'getTimelineMonthActivity', year: _dpYear, month: _dpMonth + 1 });
    renderDatePickerCalendar();

    picker.style.display = '';
    // Position below (or above if not enough room)
    const ph = picker.offsetHeight || 290;
    const top = rect.bottom + 6 + ph > window.innerHeight ? rect.top - ph - 6 : rect.bottom + 6;
    picker.style.top  = Math.max(6, top) + 'px';
    picker.style.left = Math.min(rect.left, window.innerWidth - 268) + 'px';

    // Close on outside click
    setTimeout(() => document.addEventListener('click', _closeDpOutside), 0);
}

function _closeDpOutside(e) {
    const picker = document.getElementById('tlDatePicker');
    const btn    = document.getElementById('tlDateBtn');
    if (!picker) return;
    if (btn && (picker.contains(e.target) || e.target === btn || btn.contains(e.target))) return;
    picker.style.display = 'none';
    document.removeEventListener('click', _closeDpOutside);
}

function renderDatePickerCalendar() {
    const label = document.getElementById('tlDpMonthLabel');
    const grid  = document.getElementById('tlDpDaysGrid');
    if (!label || !grid) return;

    label.textContent = new Date(_dpYear, _dpMonth, 1).toLocaleDateString(tlDateLocale(), { month: 'long', year: 'numeric' });

    const today    = new Date();
    const todayStr = _dpFmt(today.getFullYear(), today.getMonth(), today.getDate());
    const selStr   = tlDateFilter || '';

    const firstDow      = new Date(_dpYear, _dpMonth, 1).getDay();     // 0=Sun
    const firstDowMon   = (firstDow + 6) % 7;                          // 0=Mon
    const daysInMonth   = new Date(_dpYear, _dpMonth + 1, 0).getDate();
    const daysInPrevMo  = new Date(_dpYear, _dpMonth, 0).getDate();

    let html = '';
    // Leading prev-month days
    for (let i = firstDowMon - 1; i >= 0; i--) {
        const d   = daysInPrevMo - i;
        const ds  = _dpFmt(_dpYear, _dpMonth - 1, d);
        html += `<button class="tl-dp-day other-month${ds === selStr ? ' selected' : ''}" onclick="selectDpDate('${ds}')">${d}</button>`;
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
        const ds  = _dpFmt(_dpYear, _dpMonth, d);
        const cls = (ds === todayStr ? ' today' : '') + (ds === selStr ? ' selected' : '');
        const act = _dpMonthActivity[ds];
        const dot = act ? _dpDotHtml(act.personal > 0, act.friends > 0) : '';
        html += `<button class="tl-dp-day${cls}" onclick="selectDpDate('${ds}')">${d}${dot}</button>`;
    }
    // Trailing next-month days
    const used      = firstDowMon + daysInMonth;
    const remaining = used % 7 === 0 ? 0 : 7 - (used % 7);
    for (let d = 1; d <= remaining; d++) {
        const ds  = _dpFmt(_dpYear, _dpMonth + 1, d);
        html += `<button class="tl-dp-day other-month${ds === selStr ? ' selected' : ''}" onclick="selectDpDate('${ds}')">${d}</button>`;
    }
    grid.innerHTML = html;
}

function _dpFmt(year, month, day) {
    const d = new Date(year, month, day);
    return d.getFullYear() + '-'
        + String(d.getMonth() + 1).padStart(2, '0') + '-'
        + String(d.getDate()).padStart(2, '0');
}

function dpNavMonth(dir) {
    _dpMonth += dir;
    if (_dpMonth < 0)  { _dpMonth = 11; _dpYear--; }
    if (_dpMonth > 11) { _dpMonth = 0;  _dpYear++; }
    const newKey = _dpYear + '-' + (_dpMonth + 1);
    if (_dpActivityKey !== newKey) {
        _dpMonthActivity = {};
        sendToCS({ action: 'getTimelineMonthActivity', year: _dpYear, month: _dpMonth + 1 });
    }
    renderDatePickerCalendar();
}

function selectDpDate(dateStr) {
    document.getElementById('tlDatePicker').style.display = 'none';
    document.removeEventListener('click', _closeDpOutside);
    applyTlDateFilter(dateStr);
}

function dpSelectToday() {
    const t = new Date();
    selectDpDate(_dpFmt(t.getFullYear(), t.getMonth(), t.getDate()));
}

function dpClear() {
    document.getElementById('tlDatePicker').style.display = 'none';
    document.removeEventListener('click', _closeDpOutside);
    clearTlDateFilter();
}

function applyTlDateFilter(dateStr) {
    if (!dateStr) { clearTlDateFilter(); return; }
    tlDateFilter = dateStr;

    const label = document.getElementById('tlDateLabel');
    const clear = document.getElementById('tlDateClear');
    const btn   = document.getElementById('tlDateBtn');
    if (label) {
        label.textContent = tlFormatDateFilterLabel(dateStr);
        label.style.display = '';
    }
    if (clear) clear.style.display = '';
    if (btn)   btn.classList.add('dp-active');

    // Reset state and reload for current mode
    const activeSearch = (document.getElementById('tlSearchInput')?.value ?? '').trim();
    if (tlMode === 'friends') {
        friendTimelineEvents = [];
        ftlOffset = 0; ftlHasMore = false; ftlLoading = true;
        ftlListPage = 0; ftlRenderedCount = 100; ftlTotal = 0;
        _ftlSearchMode = false; _ftlSearchQuery = ''; _ftlSearchDate = '';
        if (activeSearch) { filterFriendTimeline(); return; }
        const c = document.getElementById('tlContainer');
        if (c) c.innerHTML = sk(tlViewMode === 'list' ? 'timeline-list' : 'timeline');
        sendToCS({ action: 'getFriendTimelineByDate', date: dateStr, type: ftFilter === 'all' ? '' : ftFilter });
    } else {
        timelineEvents  = [];
        tlOffset        = 0;
        tlHasMore       = false;
        tlLoading       = true;
        tlRenderedCount = 100;
        tlListPage      = 0;
        tlTotal         = 0;
        _tlSearchMode = false; _tlSearchQuery = ''; _tlSearchDate = '';
        if (activeSearch) { filterTimeline(); return; }
        const c = document.getElementById('tlContainer');
        if (c) c.innerHTML = sk(tlViewMode === 'list' ? 'timeline-list' : 'timeline');
        sendToCS({ action: 'getTimelineByDate', date: dateStr, type: tlFilter === 'all' ? '' : tlFilter });
    }
}

function clearTlDateFilter() {
    tlDateFilter = '';
    const label = document.getElementById('tlDateLabel');
    const clear = document.getElementById('tlDateClear');
    const btn   = document.getElementById('tlDateBtn');
    if (label) { label.textContent = ''; label.style.display = 'none'; }
    if (clear) clear.style.display = 'none';
    if (btn)   btn.classList.remove('dp-active');
    refreshTimeline();
}

// Rendering helpers

function tlSearchable(e) {
    return [
        e.worldName, e.userName, e.senderName, e.notifType,
        tlNotifTypeLabel(e.notifType),
        e.message,
        e.photoPath ? e.photoPath.split(/[\\/]/).pop() : '',
        ...(e.players || []).map(p => p.displayName),
    ].filter(Boolean).join(' ').toLowerCase();
}

function buildTimelineHtml(events) {
    // Group by local date
    const byDate = {};
    events.forEach(e => {
        const key = tlFormatLongDate(e.timestamp);
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(e);
    });

    let html = '<div class="tl-wrap">';
    let cardIdx = 0;

    Object.entries(byDate).forEach(([date, evs]) => {
        html += `<div class="tl-date-sep"><span class="tl-date-label">${esc(date)}</span></div>`;
        evs.forEach(e => {
            const side = cardIdx % 2 === 0 ? 'left' : 'right';
            html += renderTlRow(e, side);
            cardIdx++;
        });
    });

    html += '</div>';
    return html;
}

function renderTlRow(ev, side) {
    const color   = TL_TYPE_COLOR[ev.type]  ?? 'var(--tx3)';
    const cardHtml = renderTlCard(ev);
    const dotHtml  = `<div class="tl-dot" style="background:${color}"></div>`;

    if (side === 'left') {
        return `<div class="tl-row">
            <div class="tl-card-side tl-side-left">${cardHtml}</div>
            <div class="tl-center-col">${dotHtml}</div>
            <div class="tl-card-side tl-side-right"></div>
        </div>`;
    }
    return `<div class="tl-row">
        <div class="tl-card-side tl-side-left"></div>
        <div class="tl-center-col">${dotHtml}</div>
        <div class="tl-card-side tl-side-right">${cardHtml}</div>
    </div>`;
}

function renderTlCard(ev) {
    const d     = new Date(ev.timestamp);
    const time  = tlFormatTime(d);
    const date  = tlFormatShortDate(d);
    const meta  = tlTypeMeta(ev.type);
    const color = TL_TYPE_COLOR[ev.type] ?? 'var(--tx3)';
    const ei    = jsq(ev.id);

    const meetCount = ev.type === 'meet_again' ? (ev.meetCount || 0) : 0;
    const typeLabel = meetCount > 0 ? `${meta.label} (${meetCount})` : meta.label;
    const header = `<div class="tl-card-header">
        <span class="msi tl-type-icon" style="color:${color}">${meta.icon}</span>
        <span class="tl-type-label">${esc(typeLabel)}</span>
        <div class="tl-time-col"><span class="tl-time">${esc(time)}</span><span class="tl-date">${esc(date)}</span></div>
    </div>`;

    let body = '';
    switch (ev.type) {
        case 'instance_join': body = renderTlJoinBody(ev);      break;
        case 'photo':         body = renderTlPhotoBody(ev);     break;
        case 'first_meet':    body = renderTlMeetBody(ev);      break;
        case 'meet_again':    body = renderTlMeetAgainBody(ev); break;
        case 'notification':  body = renderTlNotifBody(ev);     break;
        case 'avatar_switch': body = renderTlAvatarBody(ev);    break;
        case 'video_url':     body = renderTlUrlBody(ev);       break;
    }

    return `<div class="tl-card" data-tlid="${esc(ev.id)}" onclick="openTlDetail('${ei}')">${header}${body}</div>`;
}

// Card bodies

function renderTlJoinBody(ev) {
    const thumb = ev.worldThumb
        ? `<div class="tl-thumb" style="background-image:url('${cssUrl(ev.worldThumb)}')"></div>`
        : `<div class="tl-thumb tl-thumb-empty"><span class="msi" style="font-size:18px;color:var(--tx3);">travel_explore</span></div>`;
    const name  = ev.worldName || ev.worldId || t('timeline.unknown_world', 'Unknown World');
    const cnt   = (ev.players || []).length;
    const avs   = tlPlayerAvatars(ev.players, 3);
    const more  = cnt > 3 ? `<span class="tl-player-more">+${cnt - 3}</span>` : '';
    const bottom = cnt > 0
        ? `<div class="tl-player-row">${avs}${more}<span class="tl-player-label">${esc(tlPlayersLabel(cnt))}</span></div>`
        : `<div class="tl-no-players">${esc(t('timeline.no_player_data', 'No player data yet'))}</div>`;
    return `<div class="tl-card-body">${thumb}<div class="tl-card-info"><div class="tl-main-label">${esc(name)}</div>${bottom}</div></div>`;
}

function renderTlPhotoBody(ev) {
    const thumb = ev.photoUrl
        ? `<div class="tl-thumb tl-thumb-photo" style="background-image:url('${cssUrl(ev.photoUrl)}')"></div>`
        : `<div class="tl-thumb tl-thumb-empty"><span class="msi" style="font-size:18px;color:var(--tx3);">camera</span></div>`;
    const name   = ev.photoPath ? ev.photoPath.split(/[\\/]/).pop() : t('timeline.photo', 'Photo');
    const sub    = ev.worldName ? `<div class="tl-sub-label">${esc(ev.worldName)}</div>` : '';
    const cnt    = (ev.players || []).length;
    const avs    = tlPlayerAvatars(ev.players, 3);
    const more   = cnt > 3 ? `<span class="tl-player-more">+${cnt - 3}</span>` : '';
    const bottom = cnt > 0
        ? `<div class="tl-player-row">${avs}${more}<span class="tl-player-label">${esc(tlPlayersLabel(cnt))}</span></div>`
        : `<div class="tl-no-players">${esc(t('timeline.no_player_data', 'No player data yet'))}</div>`;
    return `<div class="tl-card-body">${thumb}<div class="tl-card-info"><div class="tl-main-label">${esc(name)}</div>${sub}${bottom}</div></div>`;
}

function renderTlMeetBody(ev) {
    const av   = ev.userImage
        ? `<div class="tl-av" style="background-image:url('${cssUrl(ev.userImage)}')"></div>`
        : `<div class="tl-av tl-av-letter">${esc((ev.userName || '?')[0].toUpperCase())}</div>`;
    const sub  = ev.worldName ? `<div class="tl-sub-label">${esc(ev.worldName)}</div>` : '';
    return `<div class="tl-card-body">${av}<div class="tl-card-info"><div class="tl-main-label">${esc(ev.userName || t('timeline.unknown', 'Unknown'))}</div>${sub}</div></div>`;
}

function renderTlMeetAgainBody(ev) {
    const av  = ev.userImage
        ? `<div class="tl-av" style="background-image:url('${cssUrl(ev.userImage)}')"></div>`
        : `<div class="tl-av tl-av-letter">${esc((ev.userName || '?')[0].toUpperCase())}</div>`;
    const sub = ev.worldName ? `<div class="tl-sub-label">${esc(ev.worldName)}</div>` : '';
    return `<div class="tl-card-body">${av}<div class="tl-card-info"><div class="tl-main-label">${esc(ev.userName || t('timeline.unknown', 'Unknown'))}</div>${sub}</div></div>`;
}

function renderTlNotifBody(ev) {
    const typeLabel = tlNotifTypeLabel(ev.notifType);
    const av  = ev.senderImage
        ? `<div class="tl-av" style="background-image:url('${cssUrl(ev.senderImage)}')"></div>`
        : `<div class="tl-av tl-av-letter">${esc((ev.senderName || '?')[0].toUpperCase())}</div>`;
    const titleCtx = ev.notifTitle ? `<div class="tl-sub-label" style="color:var(--tx2);">${esc(ev.notifTitle.slice(0, 60))}${ev.notifTitle.length > 60 ? '…' : ''}</div>` : '';
    const sub = ev.message ? `<div class="tl-sub-label">${esc(ev.message.slice(0, 60))}${ev.message.length > 60 ? '…' : ''}</div>` : '';
    return `<div class="tl-card-body">${av}<div class="tl-card-info"><div class="tl-main-label">${esc(ev.senderName || typeLabel)}</div><div class="tl-type-chip">${esc(typeLabel)}</div>${titleCtx}${sub}</div></div>`;
}

// Platform detection for URLs
function _urlPlatform(url) {
    try {
        const h = new URL(url).hostname.replace(/^www\./, '');
        if (h.includes('youtube.com') || h.includes('youtu.be'))  return { name: 'YouTube',    color: '#FF0000', favicon: 'youtube.com'    };
        if (h.includes('soundcloud.com'))                          return { name: 'SoundCloud', color: '#FF5500', favicon: 'soundcloud.com' };
        if (h.includes('twitch.tv'))                               return { name: 'Twitch',     color: '#9146FF', favicon: 'twitch.tv'      };
        if (h.includes('spotify.com'))                             return { name: 'Spotify',    color: '#1DB954', favicon: 'open.spotify.com' };
        if (h.includes('nicovideo.jp'))                            return { name: 'NicoNico',   color: '#E6001F', favicon: 'nicovideo.jp'   };
        if (h.includes('bilibili.com'))                            return { name: 'Bilibili',   color: '#00A1D6', favicon: 'bilibili.com'   };
        if (h.includes('vimeo.com'))                               return { name: 'Vimeo',      color: '#1AB7EA', favicon: 'vimeo.com'      };
        return { name: h, color: '#29B6F6', favicon: h };
    } catch { return { name: 'URL', color: '#29B6F6', favicon: null }; }
}

function _urlFaviconHtml(plat) {
    if (!plat.favicon) return `<span class="msi" style="font-size:22px;color:${plat.color};">link</span>`;
    return `<img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(plat.favicon)}&sz=64"
        style="width:32px;height:32px;border-radius:6px;object-fit:contain;"
        onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'msi',textContent:'link',style:'font-size:22px;color:${plat.color}'}))">`;
}

function renderTlUrlBody(ev) {
    const url  = ev.message || '';
    const plat = _urlPlatform(url);
    const icon = `<div class="tl-av" style="display:flex;align-items:center;justify-content:center;background:var(--bg2);">${_urlFaviconHtml(plat)}</div>`;
    const label = plat.name !== new URL(url).hostname.replace(/^www\./,'') ? plat.name : '';
    const sub  = ev.worldName ? `<div class="tl-sub-label">${esc(ev.worldName)}</div>` : '';
    const disp = url.length > 60 ? url.slice(0, 60) + '…' : url;
    return `<div class="tl-card-body">${icon}<div class="tl-card-info"><div class="tl-main-label">${label ? esc(label) : esc(disp)}</div>${label ? `<div class="tl-sub-label" style="word-break:break-all;">${esc(disp)}</div>` : ''}${sub}</div></div>`;
}

function renderTlAvatarBody(ev) {
    const thumb = ev.userImage
        ? `<div class="tl-av" style="background-image:url('${cssUrl(ev.userImage)}')"></div>`
        : `<div class="tl-av tl-av-letter"><span class="msi" style="font-size:18px;">checkroom</span></div>`;
    return `<div class="tl-card-body">${thumb}<div class="tl-card-info"><div class="tl-main-label">${esc(ev.userName || t('timeline.unknown_avatar', 'Unknown Avatar'))}</div></div></div>`;
}

function tlPlayerAvatars(players, max) {
    return (players || []).slice(0, max).map(p => {
        return p.image
            ? `<div class="tl-player-av" style="background-image:url('${cssUrl(p.image)}')" title="${esc(p.displayName)}"></div>`
            : `<div class="tl-player-av tl-player-av-letter" title="${esc(p.displayName)}">${esc((p.displayName || '?')[0].toUpperCase())}</div>`;
    }).join('');
}

// Detail modals (reuses #modalDetail / #detailModalContent)

function copyInstanceLink(location) {
    if (!location) return;
    const colon = location.indexOf(':');
    if (colon <= 0) return;
    const worldId    = location.slice(0, colon);
    const instanceId = location.slice(colon + 1);
    if (!worldId.startsWith('wrld_')) return;
    const url = `https://vrchat.com/home/launch?worldId=${encodeURIComponent(worldId)}&instanceId=${encodeURIComponent(instanceId)}`;
    navigator.clipboard.writeText(url)
        .then(() => showToast(true, t('timeline.toast.instance_link_copied', 'Instance link copied!')))
        .catch(() => showToast(false, t('timeline.toast.copy_failed', 'Failed to copy')));
}

// === Friends Timeline ===

const FT_FILTER_IDS = {
    all:               'ftFAll',
    friend_gps:        'ftFGps',
    friend_status:     'ftFStatus',
    friend_statusdesc: 'ftFStatusDesc',
    friend_online:      'ftFOnline',
    friend_offline:     'ftFOffline',
    friend_bio:        'ftFBio',
    friend_avatar:     'ftFAvatar',
    friend_added:      'ftFAdded',
    friend_removed:    'ftFRemoved',
};

const FT_TYPE_COLOR = {
    friend_gps:        'var(--accent)',
    friend_status:     'var(--cyan)',
    friend_statusdesc: 'var(--cyan)',
    friend_online:      'var(--ok)',
    friend_offline:     'var(--tx3)',
    friend_bio:        '#AB47BC',
    friend_avatar:     '#FF7043',
    friend_added:      'var(--ok)',
    friend_removed:    'var(--err)',
};

const FT_TYPE_META = {
    friend_gps:        { icon: 'location_on',         key: 'timeline.friend_types.friend_gps',        fallback: 'Location' },
    friend_status:     { icon: 'circle',              key: 'timeline.friend_types.friend_status',     fallback: 'Status' },
    friend_statusdesc: { icon: 'chat_bubble_outline', key: 'timeline.friend_types.friend_statusdesc', fallback: 'Status Text' },
    friend_online:     { icon: 'login',               key: 'timeline.friend_types.friend_online',     fallback: 'Online' },
    friend_offline:    { icon: 'power_settings_new',  key: 'timeline.friend_types.friend_offline',    fallback: 'Offline' },
    friend_added:      { icon: 'person_add',          key: 'timeline.friend_types.friend_added',      fallback: 'Friended' },
    friend_removed:    { icon: 'person_remove',       key: 'timeline.friend_types.friend_removed',    fallback: 'Unfriended' },
    friend_bio:        { icon: 'edit_note',           key: 'timeline.friend_types.friend_bio',        fallback: 'Bio Change' },
    friend_avatar:     { icon: 'checkroom',           key: 'timeline.friend_types.friend_avatar',     fallback: 'Avatar' },
};

const STATUS_COLORS = {
    'join me': 'var(--accent)',
    'active':  'var(--ok)',
    'ask me':  'var(--warn)',
    'busy':    'var(--err)',
    'offline': 'var(--tx3)',
};

function statusCssClass(s) {
    return (s || '').toLowerCase().replace(/\s+/g, '-');
}

// Public API

function refreshFriendTimeline() {
    friendTimelineEvents = [];
    ftlOffset        = 0;
    ftlHasMore       = false;
    ftlLoading       = true;
    ftlRenderedCount = 100;
    ftlListPage      = 0;
    ftlTotal         = 0;
    const activeSearch = (document.getElementById('tlSearchInput')?.value ?? '').trim();
    const c = document.getElementById('tlContainer');
    if (c && !(_ftlSearchMode && activeSearch)) {
        c.innerHTML = sk(tlViewMode === 'list' ? 'timeline-list' : 'timeline');
    }
    if (tlDateFilter) sendToCS({ action: 'getFriendTimelineByDate', date: tlDateFilter, type: ftFilter === 'all' ? '' : ftFilter });
    else              sendToCS({ action: 'getFriendTimeline', type: ftFilter === 'all' ? '' : ftFilter });
}

function renderFriendTimeline(payload) {
    const events  = Array.isArray(payload) ? payload : (payload?.events  ?? []);
    const hasMore = Array.isArray(payload) ? false   : (payload?.hasMore ?? false);
    const offset  = Array.isArray(payload) ? 0       : (payload?.offset  ?? 0);
    const total   = Array.isArray(payload) ? 0       : (payload?.total   ?? 0);

    // Discard stale response if filter was switched while this request was in-flight
    if (!Array.isArray(payload) && payload?.type !== undefined) {
        const expectedType = ftFilter === 'all' ? '' : ftFilter;
        if (payload.type !== expectedType) return;
    }
    // Discard stale getFriendTimeline responses when a date filter is active
    if (tlDateFilter && payload?.date !== tlDateFilter) return;

    if (total > 0) ftlTotal = total;

    if (_ftlPendingListPage !== null) {
        // Direct page navigation: replace current events with this page's data
        friendTimelineEvents  = events;
        ftlListPage           = _ftlPendingListPage;
        ftlRenderedCount      = events.length;
        _ftlPendingListPage   = null;
    } else if (offset === 0) {
        friendTimelineEvents = events;
        ftlRenderedCount = 100;
        ftlListPage      = 0;
    } else {
        // Load More append (timeline/card view)
        friendTimelineEvents = friendTimelineEvents.concat(events);
        ftlRenderedCount    += events.length;
    }
    ftlOffset  = offset + events.length;
    ftlHasMore = hasMore;
    ftlLoading = false;
    filterFriendTimeline();
    if (typeof renderDashFriendsRecentTimeline === 'function') renderDashFriendsRecentTimeline();
}

function handleFriendTimelineEvent(ev) {
    if (!ev || !ev.id) return;
    // If a type filter is active, only inject events that match it to avoid polluting the view
    if (typeof ftFilter !== 'undefined' && ftFilter !== 'all' && ev.type !== ftFilter) return;
    const idx = friendTimelineEvents.findIndex(e => e.id === ev.id);
    if (idx >= 0) friendTimelineEvents[idx] = ev;
    else friendTimelineEvents.unshift(ev);
    friendTimelineEvents.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    if (tlMode === 'friends') filterFriendTimeline();
}

function setFtFilter(f) {
    ftFilter = f;
    document.querySelectorAll('#tlFriendsFilters .sub-tab-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(FT_FILTER_IDS[f]);
    if (btn) btn.classList.add('active');
    // Reset pagination and reload from server with new type filter
    friendTimelineEvents = [];
    ftlOffset        = 0;
    ftlHasMore       = false;
    ftlLoading       = true;
    ftlRenderedCount = 100;
    ftlListPage      = 0;
    ftlTotal         = 0;
    _ftlSearchMode = false; _ftlSearchQuery = ''; _ftlSearchDate = '';
    const activeSearch = (document.getElementById('tlSearchInput')?.value ?? '').trim();
    if (activeSearch) { filterFriendTimeline(); return; }
    const c = document.getElementById('tlContainer');
    if (c) c.innerHTML = sk(tlViewMode === 'list' ? 'timeline-list' : 'timeline');
    if (tlDateFilter) sendToCS({ action: 'getFriendTimelineByDate', date: tlDateFilter, type: f === 'all' ? '' : f });
    else              sendToCS({ action: 'getFriendTimeline', type: f === 'all' ? '' : f });
}

function filterFriendTimeline() {
    const search = (document.getElementById('tlSearchInput')?.value ?? '').toLowerCase().trim();
    const c = document.getElementById('tlContainer');
    if (!c) return;

    if (search) {
        if (_ftlSearchMode && search === _ftlSearchQuery && tlDateFilter === _ftlSearchDate) {
            _renderFtlSearchResults(search);
            return;
        }
        _ftlSearchMode  = false;
        _ftlSearchQuery = '';
        _ftlSearchDate  = '';
        ftlListPage = 0; ftlRenderedCount = 100;
        c.innerHTML = sk(tlViewMode === 'list' ? 'timeline-list' : 'timeline');
        _setTlPaginator('');
        clearTimeout(_ftlSearchTimer);
        _ftlSearchTimer = setTimeout(() => {
            sendToCS({ action: 'searchFriendTimeline', query: search, date: tlDateFilter, offset: 0, type: ftFilter === 'all' ? '' : ftFilter });
        }, 300);
        return;
    }

    // No search – clear search mode and show paginated events
    _ftlSearchMode   = false;
    _ftlSearchEvents = [];

    if (!friendTimelineEvents.length && !ftlLoading) {
        if (tlDateFilter) {
            c.innerHTML = `<div class="empty-msg">${esc(t('timeline.empty.initial', 'No events for this day.'))}</div>`;
            _setTlPaginator('');
            return;
        }
        // Events cleared (e.g. filter switched while searching) — reload from server
        refreshFriendTimeline();
        return;
    }

    const prevScrollTop = c.scrollTop;

    // Date filter: all events loaded at once → paginate client-side
    // Normal mode: server-side pagination (friendTimelineEvents = current page only)
    const ftlEventsToRender = tlDateFilter
        ? friendTimelineEvents.slice(ftlListPage * 100, (ftlListPage + 1) * 100)
        : friendTimelineEvents;
    const ftlTotalCount = tlDateFilter ? friendTimelineEvents.length : ftlTotal;
    const totalPages = ftlTotalCount > 0
        ? Math.ceil(ftlTotalCount / 100)
        : Math.max(ftlListPage + 1, 1) + (ftlHasMore ? 1 : 0);

    const contentHtml = tlViewMode === 'list'
        ? buildFriendListHtml(ftlEventsToRender)
        : buildFriendTimelineHtml(ftlEventsToRender);
    c.innerHTML = contentHtml;
    _setTlPaginator(buildFtlPagination(ftlListPage, totalPages, tlDateFilter ? false : ftlHasMore));

    if (prevScrollTop > 0) c.scrollTop = prevScrollTop;
}

function buildFtlPagination(page, totalPages, hasMore) {
    const countInfo = ftlTotal > 0 ? `<span style="font-size:11px;color:var(--tx3);padding:0 8px;">${esc(tlTotalSummary(ftlTotal))}</span>` : '';
    if (totalPages <= 1 && !hasMore) return countInfo;
    const prevDis = page === 0 ? 'disabled' : '';
    const nextDis = (page >= totalPages - 1 && !hasMore) ? 'disabled' : '';
    return `<button class="vrcn-button" ${prevDis} onclick="ftlGoPage(${page - 1})"><span class="msi" style="font-size:16px;">chevron_left</span></button>
        ${_buildPaginatorBtns(page, totalPages, 'ftlGoPage')}
        <button class="vrcn-button" ${nextDis} onclick="ftlGoPage(${page + 1})"><span class="msi" style="font-size:16px;">chevron_right</span></button>
        ${countInfo}`;
}

function _renderFtlSearchResults(search) {
    const c = document.getElementById('tlContainer');
    if (!c) return;

    const events = _ftlSearchEvents;

    if (!events.length) {
        c.innerHTML = `<div class="empty-msg">${esc(tlSearchNoResults(search))}</div>`;
        _setTlPaginator('');
        return;
    }

    const total      = _ftlSearchTotal;
    const totalPages = total > 0 ? Math.ceil(total / 100) : 1;
    const banner = `<div style="padding:6px 12px;font-size:11px;color:var(--tx3);border-bottom:1px solid var(--brd);">`
        + `${esc(tlSearchSummary(total, search))}</div>`;
    let html = banner + (tlViewMode === 'list' ? buildFriendListHtml(events) : buildFriendTimelineHtml(events));
    c.innerHTML = html;
    _setTlPaginator(buildSearchPagination(_ftlSearchPage, totalPages, 'ftlGoSearchPage', _ftlSearchTotal));
}

function handleFtlSearchResults(payload) {
    const q = (payload.query || '').toLowerCase().trim();
    const currentSearch = (document.getElementById('tlSearchInput')?.value ?? '').toLowerCase().trim();
    if (q !== currentSearch) return;
    if ((payload.date || '') !== tlDateFilter) return;
    const offset = payload.offset ?? 0;
    // Always replace — each page nav fetches the exact page, no appending
    _ftlSearchEvents = payload.events || [];
    _ftlSearchTotal  = payload.total ?? 0;
    _ftlSearchPage   = Math.floor(offset / 100);
    _ftlSearchMode   = true;
    _ftlSearchQuery  = q;
    _ftlSearchDate   = payload.date || '';
    filterFriendTimeline();
}

function ftlGoSearchPage(page) {
    if (page < 0) return;
    sendToCS({ action: 'searchFriendTimeline', query: _ftlSearchQuery, date: _ftlSearchDate, offset: page * 100, type: ftFilter === 'all' ? '' : ftFilter });
}

function ftSearchable(e) {
    return [e.friendName, e.worldName, e.newValue, e.oldValue, e.location]
        .filter(Boolean).join(' ').toLowerCase();
}

// Friends Timeline pagination helpers

function loadMoreFriendTimeline() {
    if (ftlLoading) return;
    // Drain already-loaded pool first (timeline/card view)
    if (friendTimelineEvents.length > ftlRenderedCount) {
        ftlRenderedCount += 100;
        filterFriendTimeline();
        return;
    }
    if (!ftlHasMore) return;
    ftlLoading = true;
    const btn = document.getElementById('ftlLoadMoreBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="msi" style="font-size:16px;">hourglass_empty</span> ${esc(t('timeline.load_more.loading', 'Loading...'))}`; }
    sendToCS({ action: 'getFriendTimelinePage', offset: ftlOffset, type: ftFilter === 'all' ? '' : ftFilter });
}

function ftlGoPage(page) {
    if (page < 0) return;
    // Date filter active: all events in memory, paginate client-side
    if (tlDateFilter) {
        const totalPages = Math.ceil(friendTimelineEvents.length / 100) || 1;
        if (page >= totalPages) return;
        if (page === ftlListPage) { const c = document.getElementById('tlContainer'); if (c) c.scrollTop = 0; return; }
        ftlListPage = page;
        filterFriendTimeline();
        const c = document.getElementById('tlContainer');
        if (c) c.scrollTop = 0;
        return;
    }
    const totalPages = ftlTotal > 0 ? Math.ceil(ftlTotal / 100) : null;
    if (totalPages !== null && page >= totalPages) return;
    if (page === ftlListPage && _ftlPendingListPage === null && !ftlLoading) {
        // Already on this page — just scroll top
        const c = document.getElementById('tlContainer');
        if (c) c.scrollTop = 0;
        return;
    }
    // Fetch this page directly from DB at absolute offset
    _ftlPendingListPage = page;
    ftlLoading = true;
    sendToCS({ action: 'getFriendTimelinePage', offset: page * 100, type: ftFilter === 'all' ? '' : ftFilter });
    const c = document.getElementById('tlContainer');
    if (c) c.scrollTop = 0;
}

// Rendering

function buildFriendTimelineHtml(events) {
    const byDate = {};
    events.forEach(e => {
        const key = tlFormatLongDate(e.timestamp);
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(e);
    });

    let html = '<div class="tl-wrap">';
    let cardIdx = 0;
    Object.entries(byDate).forEach(([date, evs]) => {
        html += `<div class="tl-date-sep"><span class="tl-date-label">${esc(date)}</span></div>`;
        evs.forEach(e => {
            const side = cardIdx % 2 === 0 ? 'left' : 'right';
            html += renderFtRow(e, side);
            cardIdx++;
        });
    });
    html += '</div>';
    return html;
}

function renderFtRow(ev, side) {
    const color   = FT_TYPE_COLOR[ev.type] ?? 'var(--tx3)';
    const cardHtml = renderFtCard(ev);
    const dotHtml  = `<div class="tl-dot" style="background:${color}"></div>`;

    if (side === 'left') {
        return `<div class="tl-row">
            <div class="tl-card-side tl-side-left">${cardHtml}</div>
            <div class="tl-center-col">${dotHtml}</div>
            <div class="tl-card-side tl-side-right"></div>
        </div>`;
    }
    return `<div class="tl-row">
        <div class="tl-card-side tl-side-left"></div>
        <div class="tl-center-col">${dotHtml}</div>
        <div class="tl-card-side tl-side-right">${cardHtml}</div>
    </div>`;
}

function renderFtCard(ev) {
    const d     = new Date(ev.timestamp);
    const time  = tlFormatTime(d);
    const date  = tlFormatShortDate(d);
    const meta  = ftTypeMeta(ev.type);
    const color = FT_TYPE_COLOR[ev.type] ?? 'var(--tx3)';
    const ei    = jsq(ev.id);

    const header = `<div class="tl-card-header">
        <span class="msi tl-type-icon" style="color:${color}">${meta.icon}</span>
        <span class="tl-type-label">${esc(meta.label)}</span>
        <div class="tl-time-col"><span class="tl-time">${esc(time)}</span><span class="tl-date">${esc(date)}</span></div>
    </div>`;

    let body = '';
    switch (ev.type) {
        case 'friend_gps':        body = renderFtGpsBody(ev);        break;
        case 'friend_status':     body = renderFtStatusBody(ev);     break;
        case 'friend_statusdesc': body = renderFtStatusDescBody(ev); break;
        case 'friend_online':      body = renderFtOnlineBody(ev);     break;
        case 'friend_offline':     body = renderFtOfflineBody(ev);    break;
        case 'friend_bio':        body = renderFtBioBody(ev);        break;
        case 'friend_added':      body = renderFtAddedBody(ev);      break;
        case 'friend_removed':    body = renderFtRemovedBody(ev);    break;
        case 'friend_avatar':     body = renderFtAvatarBody(ev);     break;
    }

    const clickAction = ev.type === 'friend_gps'
        ? `openFtGpsDetail('${ei}')`
        : `openFtDetail('${ei}')`;

    return `<div class="tl-card" data-ftid="${esc(ev.id)}" onclick="${clickAction}">${header}${body}</div>`;
}

// Card bodies

function ftFriendAv(ev, cssClass) {
    return ev.friendImage
        ? `<div class="${cssClass}" style="background-image:url('${cssUrl(ev.friendImage)}')"></div>`
        : `<div class="${cssClass} tl-av-letter">${esc((ev.friendName || '?')[0].toUpperCase())}</div>`;
}

function renderFtGpsBody(ev) {
    const thumb = ev.worldThumb
        ? `<div class="tl-thumb" style="background-image:url('${cssUrl(ev.worldThumb)}')"></div>`
        : `<div class="tl-thumb tl-thumb-empty"><span class="msi" style="font-size:18px;color:var(--tx3);">travel_explore</span></div>`;
    const wname = ev.worldName || ev.worldId || t('timeline.unknown_world', 'Unknown World');
    const av    = ftFriendAv(ev, 'tl-player-av');
    return `<div class="tl-card-body">${thumb}<div class="tl-card-info">
        <div class="tl-main-label">${esc(wname)}</div>
        <div class="tl-player-row">${av}<span class="tl-player-label">${esc(ev.friendName || t('timeline.unknown', 'Unknown'))}</span></div>
    </div></div>`;
}

function renderFtStatusBody(ev) {
    const av      = ftFriendAv(ev, 'tl-av');
    const oldCls  = statusCssClass(ev.oldValue);
    const newCls  = statusCssClass(ev.newValue);
    const chips   = `<div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
        <span class="ft-status-chip ${oldCls}">${esc(statusLabel(ev.oldValue) || '?')}</span>
        <span class="msi" style="font-size:12px;color:var(--tx3);">arrow_forward</span>
        <span class="ft-status-chip ${newCls}">${esc(statusLabel(ev.newValue) || '?')}</span>
    </div>`;
    return `<div class="tl-card-body">${av}<div class="tl-card-info">
        <div class="tl-main-label">${esc(ev.friendName || t('timeline.unknown', 'Unknown'))}</div>${chips}
    </div></div>`;
}

function renderFtOnlineBody(ev) {
    const av = ftFriendAv(ev, 'tl-av');
    return `<div class="tl-card-body">${av}<div class="tl-card-info">
        <div class="tl-main-label">${esc(ev.friendName || t('timeline.unknown', 'Unknown'))}</div>
        <div class="tl-sub-label" style="color:var(--ok);">${esc(t('timeline.friend.online_game', 'Online (Game)'))}</div>
    </div></div>`;
}

function renderFtOfflineBody(ev) {
    const av = ftFriendAv(ev, 'tl-av');
    return `<div class="tl-card-body">${av}<div class="tl-card-info">
        <div class="tl-main-label">${esc(ev.friendName || t('timeline.unknown', 'Unknown'))}</div>
        <div class="tl-sub-label" style="color:var(--tx3);">${esc(t('timeline.friend.went_offline', 'Went Offline'))}</div>
    </div></div>`;
}

function renderFtAddedBody(ev) {
    const av = ftFriendAv(ev, 'tl-av');
    return `<div class="tl-card-body">${av}<div class="tl-card-info">
        <div class="tl-main-label">${esc(ev.friendName || ev.friendId || t('timeline.unknown', 'Unknown'))}</div>
        <div class="tl-sub-label" style="color:var(--ok);">${esc(t('timeline.friend.added', 'Friend added'))}</div>
    </div></div>`;
}

function renderFtRemovedBody(ev) {
    const av = ftFriendAv(ev, 'tl-av');
    return `<div class="tl-card-body">${av}<div class="tl-card-info">
        <div class="tl-main-label">${esc(ev.friendName || ev.friendId || t('timeline.unknown', 'Unknown'))}</div>
        <div class="tl-sub-label" style="color:var(--err);">${esc(t('timeline.friend.unfriended_you', 'Unfriended you'))}</div>
    </div></div>`;
}

function renderFtStatusDescBody(ev) {
    const av      = ftFriendAv(ev, 'tl-av');
    const preview = (ev.newValue || '').slice(0, 60);
    const ellipsis = (ev.newValue || '').length > 60 ? '...' : '';
    return `<div class="tl-card-body">${av}<div class="tl-card-info">
        <div class="tl-main-label">${esc(ev.friendName || t('timeline.unknown', 'Unknown'))}</div>
        <div class="tl-sub-label">${esc(preview)}${ellipsis}</div>
    </div></div>`;
}

function renderFtBioBody(ev) {
    const av      = ftFriendAv(ev, 'tl-av');
    const preview = (ev.newValue || '').slice(0, 60);
    const ellipsis = (ev.newValue || '').length > 60 ? '...' : '';
    return `<div class="tl-card-body">${av}<div class="tl-card-info">
        <div class="tl-main-label">${esc(ev.friendName || t('timeline.unknown', 'Unknown'))}</div>
        <div class="tl-sub-label">${esc(preview)}${ellipsis}</div>
    </div></div>`;
}

function renderFtAvatarBody(ev) {
    const av      = ftFriendAv(ev, 'tl-av');
    const avThumb = ev.worldThumb
        ? `<div class="tl-av" style="background-image:url('${cssUrl(ev.worldThumb)}');border-radius:8px;flex-shrink:0;"></div>`
        : '';
    return `<div class="tl-card-body">${av}<div class="tl-card-info">
        <div class="tl-main-label">${esc(ev.friendName || t('timeline.unknown', 'Unknown'))}</div>
        <div class="tl-sub-label" style="display:flex;align-items:center;gap:6px;">${avThumb}<span>${esc(ev.worldName || ev.newValue || t('timeline.unknown', 'Unknown'))}</span></div>
    </div></div>`;
}

// Detail modals

