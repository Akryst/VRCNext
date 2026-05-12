/* === Mutual Network ===
 * Force-directed social graph of your friend circle.
 * Edges = mutual friends. Pure Canvas, no libraries.
 */

let _netGraph        = null;
let _mutualCache     = {};
let _cacheLoadPending = false;

function networkProgressText(done, total) {
    return tf('network.progress', { done, total }, `Loading connections: ${done} / ${total}`);
}

function initNetwork() {
    const canvas = document.getElementById('netCanvas');
    if (!canvas) return;
    if (_netGraph) { _netGraph.resize(); return; }
    _netGraph = new MutualGraph(canvas);

    _cacheLoadPending = true;
    sendToCS({ action: 'vrcLoadMutualCache' });
}

function networkCacheLoaded(json) {
    if (!_cacheLoadPending) return;
    _cacheLoadPending = false;
    try { _mutualCache = JSON.parse(json) || {}; } catch { _mutualCache = {}; }
    if (_netGraph) _netGraph.loadFriends();
}

function networkAddMutuals(data) {
    if (_netGraph) _netGraph.onMutualsReceived(data);
}

function networkCancel() {
    if (_netGraph) _netGraph.cancelLoading();
}

function networkRefresh() {
    if (_netGraph) _netGraph.destroy();
    _netGraph = null;
    initNetwork();
}

function networkReFetch() {
    _mutualCache = {};
    sendToCS({ action: 'vrcClearMutualCache' });
    networkRefresh();
}

function networkResetView() {
    if (!_netGraph) return;
    _netGraph.tx = 0;
    _netGraph.ty = 0;
    _netGraph.scale = 1;
    _netGraph._render();
}

/* ── Tab activation ── */
document.documentElement.addEventListener('tabchange', () => {
    const tab15 = document.getElementById('tab15');
    if (tab15 && tab15.classList.contains('active')) {
        initNetwork();
    } else {
        if (_netGraph) _netGraph._stopSim();
    }
});

/* ════════════════════════════════════════════════════════
   MutualGraph class
   ════════════════════════════════════════════════════════ */
class MutualGraph {
    constructor(canvas) {
        this.canvas  = canvas;
        this.ctx     = canvas.getContext('2d');
        this.nodes   = [];
        this.edges   = [];
        this._edgeSet = new Set();  // fast O(1) duplicate detection
        this.nodeMap = {};

        this.tx = 0; this.ty = 0; this.scale = 1;

        this.dragging = null;
        this.selected = null;
        this.hovered  = null;

        this.fetchQueue  = [];
        this.fetchDone   = 0;
        this.fetchTotal  = 0;
        this.cancelled   = false;
        this._saveTimer  = null;

        this._simRaf        = null;
        this._simRunning    = false;
        this._renderPending = false;
        this._edgesChanged  = true;
        this._edgeCounts    = null;  // cached, only rebuilt when edges change

        this._bindEvents();
        this._resizeObserver = new ResizeObserver(() => this.resize());
        this._resizeObserver.observe(canvas);
        this.resize();
    }

    /* ── Resize ── */
    resize() {
        const W = this.canvas.offsetWidth;
        const H = this.canvas.offsetHeight;
        if (!W || !H) return;
        if (this.canvas.width === W && this.canvas.height === H) return;
        this.canvas.width  = W;
        this.canvas.height = H;
        this._render();
    }

    /* ── Load friends as nodes ── */
    loadFriends() {
        if (this._friendsLoaded) return;
        const friends = (typeof vrcFriendsData !== 'undefined') ? vrcFriendsData : [];
        if (friends.length === 0) {
            setTimeout(() => { if (_netGraph === this) this.loadFriends(); }, 800);
            return;
        }
        this._friendsLoaded = true;
        const W = this.canvas.width, H = this.canvas.height;
        const cx = W / 2, cy = H / 2;
        const R = Math.min(W, H) * 0.38;

        friends.forEach((f, i) => {
            const angle  = (i / Math.max(friends.length, 1)) * Math.PI * 2;
            const jitter = (Math.random() - 0.5) * R * 0.35;
            this._addNode({
                id:          f.id,
                displayName: f.displayName || f.id,
                image:       f.image || '',
                status:      f.status || 'offline',
                x: cx + (R + jitter) * Math.cos(angle),
                y: cy + (R + jitter) * Math.sin(angle),
            });
        });

        const online  = friends.filter(f => f.status && f.status !== 'offline');
        const offline = friends.filter(f => !f.status || f.status === 'offline');
        this.fetchQueue = [...online, ...offline].map(f => f.id);
        this.fetchTotal = this.fetchQueue.length;
        this.fetchDone  = 0;
        this.cancelled  = false;

        this._updateProgress();
        this._startSim();
        this._startFetching();
    }

    _addNode(opts) {
        const idx  = this.nodes.length;
        const node = {
            id:          opts.id,
            displayName: opts.displayName,
            image:       opts.image || '',
            imgEl:       null,
            status:      opts.status || 'offline',
            x: opts.x || 0,
            y: opts.y || 0,
            vx: 0, vy: 0,
            pinned: false,
            r: 0,
        };
        this.nodes.push(node);
        this.nodeMap[node.id] = idx;

        if (node.image) {
            const img = new Image();
            img.src = node.image;
            img.onload  = () => { node.imgEl = img; this._scheduleRender(); };
            img.onerror = () => {};
        }
        return idx;
    }

    /* ── Fetching mutuals (with cache) ── */
    _startFetching() {
        const toFetch = [];
        this.fetchQueue.forEach(uid => {
            if (_mutualCache[uid] !== undefined) {
                this._applyMutuals(uid, _mutualCache[uid].mutualIds, _mutualCache[uid].optedOut);
                this.fetchDone++;
            } else {
                toFetch.push(uid);
            }
        });
        this.fetchQueue = toFetch;

        this._updateProgress();
        if (this.fetchQueue.length === 0) {
            this._hideProgress();
            this._startSim();
            return;
        }
        this._startSim();
        this._fetchBatch();
    }

    _fetchBatch() {
        if (this.cancelled || this.fetchQueue.length === 0) {
            this._hideProgress();
            return;
        }
        const batch = this.fetchQueue.splice(0, 3);
        batch.forEach(uid => {
            if (typeof sendToCS === 'function')
                sendToCS({ action: 'vrcGetMutualsForNetwork', userId: uid });
        });
        setTimeout(() => this._fetchBatch(), 350);
    }

    _applyMutuals(userId, mutualIds, optedOut) {
        const aIdx = this.nodeMap[userId];
        if (aIdx === undefined || optedOut || !Array.isArray(mutualIds)) return;
        let changed = false;
        mutualIds.forEach(bid => {
            const bIdx = this.nodeMap[bid];
            if (bIdx !== undefined && aIdx !== bIdx) {
                // Canonical key — smaller index first
                const key = aIdx < bIdx ? `${aIdx},${bIdx}` : `${bIdx},${aIdx}`;
                if (!this._edgeSet.has(key)) {
                    this._edgeSet.add(key);
                    this.edges.push({ a: aIdx, b: bIdx });
                    changed = true;
                }
            }
        });
        if (changed) this._edgesChanged = true;
    }

    onMutualsReceived(data) {
        _mutualCache[data.userId] = { mutualIds: data.mutualIds || [], optedOut: !!data.optedOut };
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
            sendToCS({ action: 'vrcSaveMutualCache', cache: JSON.stringify(_mutualCache) });
        }, 1500);

        this.fetchDone++;
        this._applyMutuals(data.userId, data.mutualIds, data.optedOut);
        this._updateProgress();
        this._startSim();  // no-op if already running; restarts if settled
        if (this.fetchDone >= this.fetchTotal) this._hideProgress();
    }

    cancelLoading() {
        this.cancelled = true;
        clearTimeout(this._saveTimer);
        this._hideProgress();
        // Keep sim running so the partial graph settles naturally
    }

    /* ── Progress ── */
    _updateProgress() {
        const bar  = document.getElementById('netProgress');
        const text = document.getElementById('netProgressText');
        if (!bar) return;
        if (this.fetchTotal === 0) { bar.style.display = 'none'; return; }
        bar.style.display = 'flex';
        if (text) text.textContent = networkProgressText(this.fetchDone, this.fetchTotal);
    }
    _hideProgress() {
        const bar = document.getElementById('netProgress');
        if (bar) bar.style.display = 'none';
    }

    /* ── Async simulation loop — runs via rAF, never blocks the main thread ── */
    _startSim() {
        if (this._simRunning) return;
        this._settled = false;
        this._simRunning = true;
        this._simRaf = requestAnimationFrame(() => this._simTick());
    }

    _stopSim() {
        this._simRunning = false;
        if (this._simRaf) { cancelAnimationFrame(this._simRaf); this._simRaf = null; }
    }

    _simTick() {
        if (!this._simRunning) return;

        // Stop simulation when tab is not visible or window is hidden (saves CPU in VR)
        const tab15 = document.getElementById('tab15');
        if (!tab15 || !tab15.classList.contains('active') || document.hidden) {
            this._stopSim();
            return;
        }

        // Run a small batch per frame — keeps frame budget under control
        this._settled = false;
        for (let i = 0; i < 8; i++) {
            this._simulate();
            if (this._settled) break;
        }

        this._render();

        if (this._settled) {
            this._simRunning = false;
            this._simRaf = null;
        } else {
            this._simRaf = requestAnimationFrame(() => this._simTick());
        }
    }

    _simulate() {
        const nodes = this.nodes;
        const n = nodes.length;
        if (n < 2) return;

        const W = this.canvas.width, H = this.canvas.height;
        const cx = W / 2, cy = H / 2;

        // Recompute edge counts only when edges have changed
        if (this._edgesChanged || !this._edgeCounts || this._edgeCounts.length !== n) {
            const counts = new Array(n).fill(0);
            this.edges.forEach(e => { counts[e.a]++; counts[e.b]++; });
            nodes.forEach((nd, i) => { nd.r = Math.min(12, 5 + counts[i] * 0.3); });
            this._edgeCounts = counts;
            this._edgesChanged = false;
        }

        // Reuse force arrays to reduce GC pressure
        if (!this._fx || this._fx.length !== n) {
            this._fx = new Float32Array(n);
            this._fy = new Float32Array(n);
        }
        const fx = this._fx; fx.fill(0);
        const fy = this._fy; fy.fill(0);

        const K_REP = 1900, MIN_D = 25;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const dx = nodes[i].x - nodes[j].x;
                const dy = nodes[i].y - nodes[j].y;
                const d  = Math.max(Math.sqrt(dx * dx + dy * dy), MIN_D);
                const f  = K_REP / (d * d);
                const nx = dx / d, ny = dy / d;
                fx[i] += f * nx;  fy[i] += f * ny;
                fx[j] -= f * nx;  fy[j] -= f * ny;
            }
        }

        const K_SPRING = 0.018, REST = 240;
        this.edges.forEach(e => {
            const a = nodes[e.a], b = nodes[e.b];
            const dx = b.x - a.x, dy = b.y - a.y;
            const d  = Math.sqrt(dx * dx + dy * dy) || 1;
            const s  = (d - REST) * K_SPRING;
            const nx = dx / d, ny = dy / d;
            fx[e.a] += s * nx;  fy[e.a] += s * ny;
            fx[e.b] -= s * nx;  fy[e.b] -= s * ny;
        });

        const K_GRAV = 0.004;
        for (let i = 0; i < n; i++) {
            fx[i] += (cx - nodes[i].x) * K_GRAV;
            fy[i] += (cy - nodes[i].y) * K_GRAV;
        }

        const DAMP = 0.75, MAX_V = 6;
        let maxV = 0;
        for (let i = 0; i < n; i++) {
            const nd = nodes[i];
            if (nd.pinned) continue;
            nd.vx = Math.max(-MAX_V, Math.min(MAX_V, nd.vx * DAMP + fx[i]));
            nd.vy = Math.max(-MAX_V, Math.min(MAX_V, nd.vy * DAMP + fy[i]));
            nd.x += nd.vx;
            nd.y += nd.vy;
            maxV = Math.max(maxV, Math.abs(nd.vx), Math.abs(nd.vy));
        }
        if (maxV < 0.12) this._settled = true;
    }

    /* ── Render ── */

    // Deferred render — coalesces multiple calls within the same frame into one
    _scheduleRender() {
        if (this._renderPending) return;
        this._renderPending = true;
        requestAnimationFrame(() => { this._renderPending = false; this._render(); });
    }

    _render() {
        const ctx = this.ctx;
        const W = this.canvas.width, H = this.canvas.height;
        if (!W || !H) return;
        ctx.clearRect(0, 0, W, H);

        ctx.save();
        ctx.translate(this.tx, this.ty);
        ctx.scale(this.scale, this.scale);

        // Visible viewport in world-space for culling (with margin for rings/labels)
        const margin = 30;
        const vx0 = -this.tx / this.scale - margin;
        const vy0 = -this.ty / this.scale - margin;
        const vx1 = vx0 + W / this.scale + margin * 2;
        const vy1 = vy0 + H / this.scale + margin * 2;

        const sel = this.selected;
        const scaleInv = 1 / this.scale;

        let activeSet = null;
        if (sel !== null) {
            activeSet = new Set([sel]);
            this.edges.forEach(e => {
                if (e.a === sel) activeSet.add(e.b);
                if (e.b === sel) activeSet.add(e.a);
            });
        }

        const ac = this._getAccentRgb();

        // Batch edges into style groups — one path per group instead of one per edge
        const edgesHighlighted = [];
        const edgesDimmed      = [];
        const edgesNormal      = [];

        this.edges.forEach(e => {
            const a = this.nodes[e.a], b = this.nodes[e.b];
            // Skip edges where both endpoints are off-screen
            if (a.x < vx0 && b.x < vx0) return;
            if (a.x > vx1 && b.x > vx1) return;
            if (a.y < vy0 && b.y < vy0) return;
            if (a.y > vy1 && b.y > vy1) return;

            if (sel !== null && (e.a === sel || e.b === sel)) edgesHighlighted.push(e);
            else if (activeSet !== null)                       edgesDimmed.push(e);
            else                                               edgesNormal.push(e);
        });

        if (edgesNormal.length) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${ac.r},${ac.g},${ac.b},0.42)`;
            ctx.lineWidth   = 1.2 * scaleInv;
            edgesNormal.forEach(e => {
                const a = this.nodes[e.a], b = this.nodes[e.b];
                ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            });
            ctx.stroke();
        }

        if (edgesDimmed.length) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${ac.r},${ac.g},${ac.b},0.08)`;
            ctx.lineWidth   = scaleInv;
            edgesDimmed.forEach(e => {
                const a = this.nodes[e.a], b = this.nodes[e.b];
                ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            });
            ctx.stroke();
        }

        if (edgesHighlighted.length) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${ac.r},${ac.g},${ac.b},0.95)`;
            ctx.lineWidth   = 2.5 * scaleInv;
            edgesHighlighted.forEach(e => {
                const a = this.nodes[e.a], b = this.nodes[e.b];
                ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            });
            ctx.stroke();
        }

        // level of detail based on zoom. less detail when zoomed out:
        // lod 0: tiny dot only (< 0.35) (no images or detauk)
        // lod 1: status ring + color fill, no image (< 0.65) 
        // lod 2: full rendering with avatar image (>= 0.65)
        const lod = this.scale < 0.35 ? 0 : this.scale < 0.65 ? 1 : 2;

        if (lod === 0) {
            const byColor = new Map();
            this.nodes.forEach((nd, i) => {
                const r = nd.r || 5;
                if (nd.x + r < vx0 || nd.x - r > vx1 || nd.y + r < vy0 || nd.y - r > vy1) return;
                const inActive = activeSet === null || activeSet.has(i);
                const sc = this._statusColor(nd.status);
                const key = inActive ? sc : sc + '_dim';
                if (!byColor.has(key)) byColor.set(key, { color: sc, alpha: inActive ? 1 : 0.12, nds: [] });
                byColor.get(key).nds.push(nd);
            });
            byColor.forEach(({ color, alpha, nds }) => {
                ctx.globalAlpha = alpha;
                ctx.fillStyle = color;
                ctx.beginPath();
                nds.forEach(nd => { ctx.moveTo(nd.x, nd.y); ctx.arc(nd.x, nd.y, Math.max((nd.r || 5) * 0.65, 2), 0, Math.PI * 2); });
                ctx.fill();
            });
            ctx.globalAlpha = 1;
        } else {
            this.nodes.forEach((nd, i) => {
                const r = nd.r || 5;
                if (nd.x + r < vx0 || nd.x - r > vx1 || nd.y + r < vy0 || nd.y - r > vy1) return;
                const inActive = activeSet === null || activeSet.has(i);
                ctx.globalAlpha = inActive ? 1 : 0.12;
                this._drawNode(ctx, nd, i, lod);
            });
            ctx.globalAlpha = 1;
        }

        // labels. skip at lowest LOD where nodes are single pixels
        if (lod > 0) {
            if (activeSet !== null) {
                activeSet.forEach(i => {
                    if (this.nodes[i]) this._drawLabel(ctx, this.nodes[i], i === sel);
                });
            } else if (this.hovered !== null && this.nodes[this.hovered]) {
                this._drawLabel(ctx, this.nodes[this.hovered], false);
            }
        }

        ctx.restore();
    }

    _getAccentRgb() {
        if (this._accentCache) return this._accentCache;
        const raw = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#5682f4';
        const m = raw.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
        this._accentCache = m
            ? { raw, r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
            : { raw: '#5682f4', r: 86, g: 130, b: 244 };
        return this._accentCache;
    }

    _statusColor(status) {
        if (typeof STATUS_LIST !== 'undefined') {
            const s = STATUS_LIST.find(x => x.key === status);
            if (s) return s.color;
        }
        const map = { active: '#2DD48C', 'join me': '#2196F3', 'ask me': '#FF9800', busy: '#F44336' };
        return map[status] || '#555';
    }

    _drawNode(ctx, nd, idx, lod = 2) {
        const r        = nd.r || 5;
        const x        = nd.x, y = nd.y;
        const sel      = this.selected === idx;
        const hov      = this.hovered  === idx;
        const sc       = this._statusColor(nd.status);
        const scaleInv = 1 / this.scale;

        if (sel || hov) {
            ctx.beginPath();
            ctx.arc(x, y, r + 4, 0, Math.PI * 2);
            ctx.strokeStyle = sel ? 'rgba(80,180,255,0.9)' : 'rgba(80,180,255,0.45)';
            ctx.lineWidth = 2 * scaleInv;
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(x, y, r + 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = sc;
        ctx.lineWidth = 2 * scaleInv;
        ctx.stroke();

        if (lod < 2 || !nd.imgEl) {
            // color fill.  no expensive save/clip/drawImage
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = sc + '44';
            ctx.fill();
            return;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(nd.imgEl, x - r, y - r, r * 2, r * 2);
        ctx.restore();
    }

    _drawLabel(ctx, nd, isSelected) {
        const ac     = this._getAccentRgb();
        const fs     = isSelected ? 9 : 8;
        const px     = 4, py = 2;
        const nodeR  = nd.r || 5;
        const yBadge = nd.y + nodeR + 5;

        ctx.save();
        ctx.font         = `${isSelected ? '700' : '600'} ${fs}px sans-serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';

        const tw = ctx.measureText(nd.displayName).width;
        const bw = tw + px * 2;
        const bh = fs  + py * 2;

        ctx.fillStyle = `rgba(${ac.r},${ac.g},${ac.b},0.22)`;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(nd.x - bw / 2, yBadge, bw, bh, 4);
        else               ctx.rect(nd.x - bw / 2, yBadge, bw, bh);
        ctx.fill();

        ctx.fillStyle = ac.raw;
        ctx.fillText(nd.displayName, nd.x, yBadge + py);

        ctx.restore();
    }

    /* ── Events ── */
    _bindEvents() {
        this._handlers = {
            wheel:      e  => this._onWheel(e),
            mousedown:  e  => this._onMouseDown(e),
            mousemove:  e  => this._onMouseMove(e),
            mouseup:    () => { this.dragging = null; this.canvas.classList.remove('dragging'); },
            mouseleave: () => { this.dragging = null; this.hovered = null; this._scheduleRender(); },
            click:      e  => this._onClick(e),
        };
        const c = this.canvas;
        c.addEventListener('wheel',      this._handlers.wheel,      { passive: false });
        c.addEventListener('mousedown',  this._handlers.mousedown);
        c.addEventListener('mousemove',  this._handlers.mousemove);
        c.addEventListener('mouseup',    this._handlers.mouseup);
        c.addEventListener('mouseleave', this._handlers.mouseleave);
        c.addEventListener('click',      this._handlers.click);
    }

    destroy() {
        this._stopSim();
        this.cancelLoading();
        this._resizeObserver?.disconnect();
        if (this._handlers) {
            const c = this.canvas;
            c.removeEventListener('wheel',      this._handlers.wheel);
            c.removeEventListener('mousedown',  this._handlers.mousedown);
            c.removeEventListener('mousemove',  this._handlers.mousemove);
            c.removeEventListener('mouseup',    this._handlers.mouseup);
            c.removeEventListener('mouseleave', this._handlers.mouseleave);
            c.removeEventListener('click',      this._handlers.click);
        }
    }

    _canvasToWorld(cx, cy) {
        return { x: (cx - this.tx) / this.scale, y: (cy - this.ty) / this.scale };
    }

    _hitTest(wx, wy) {
        for (let i = this.nodes.length - 1; i >= 0; i--) {
            const nd = this.nodes[i];
            const r  = (nd.r || 5) + 5;
            const dx = nd.x - wx, dy = nd.y - wy;
            if (dx * dx + dy * dy <= r * r) return i;
        }
        return -1;
    }

    _onWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const factor   = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const newScale = Math.min(4, Math.max(0.2, this.scale * factor));
        this.tx = mx - (mx - this.tx) * (newScale / this.scale);
        this.ty = my - (my - this.ty) * (newScale / this.scale);
        this.scale = newScale;
        this._render();
    }

    _onMouseDown(e) {
        if (e.button !== 0) return;
        const rect = this.canvas.getBoundingClientRect();
        const { x: wx, y: wy } = this._canvasToWorld(e.clientX - rect.left, e.clientY - rect.top);
        const hit = this._hitTest(wx, wy);
        if (hit >= 0) {
            this.dragging = { type: 'node', idx: hit, ox: wx - this.nodes[hit].x, oy: wy - this.nodes[hit].y };
            this.nodes[hit].pinned = true;
        } else {
            this.dragging = { type: 'pan', ox: (e.clientX - rect.left) - this.tx, oy: (e.clientY - rect.top) - this.ty };
            this.canvas.classList.add('dragging');
        }
    }

    _onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const { x: wx, y: wy } = this._canvasToWorld(mx, my);

        if (this.dragging) {
            if (this.dragging.type === 'node') {
                const nd = this.nodes[this.dragging.idx];
                nd.x = wx - this.dragging.ox;
                nd.y = wy - this.dragging.oy;
                nd.vx = nd.vy = 0;
            } else {
                this.tx = mx - this.dragging.ox;
                this.ty = my - this.dragging.oy;
            }
            this._scheduleRender();
            return;
        }

        // skip hittest when zoomed out. far nodes are too small to reliably hover
        const hit = this.scale >= 0.35 ? this._hitTest(wx, wy) : -1;
        const newHov = hit >= 0 ? hit : null;
        if (newHov !== this.hovered) {
            this.hovered = newHov;
            this._scheduleRender();
        }
    }

    _onClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const { x: wx, y: wy } = this._canvasToWorld(e.clientX - rect.left, e.clientY - rect.top);
        const hit = this._hitTest(wx, wy);
        this.selected = (hit >= 0 && hit !== this.selected) ? hit : null;
        this._render();
    }
}

function rerenderNetworkTranslations() {
    if (_netGraph) _netGraph._updateProgress();
}

document.documentElement.addEventListener('languagechange', rerenderNetworkTranslations);
