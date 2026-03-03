/* === Mutual Network ===
 * Force-directed social graph of your friend circle.
 * Edges = mutual friends. Pure Canvas, no libraries.
 */

let _netGraph        = null;
let _mutualCache     = {};      // userId → { mutualIds[], optedOut }
let _cacheLoadPending = false;  // waiting for JSON load from disk

function initNetwork() {
    const canvas = document.getElementById('netCanvas');
    if (!canvas) return;
    if (_netGraph) { _netGraph.resize(); return; }
    _netGraph = new MutualGraph(canvas);

    // Load cache from disk first, then loadFriends in the callback
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
    if (tab15 && tab15.classList.contains('active')) initNetwork();
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
        this.nodeMap = {};

        this.tx = 0; this.ty = 0; this.scale = 1;

        this.dragging = null;
        this.selected = null;
        this.hovered  = null;

        this.fetchQueue  = [];
        this.fetchDone   = 0;
        this.fetchTotal  = 0;
        this.cancelled   = false;

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
            // Friends data not ready yet — retry shortly
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
            img.onload  = () => { node.imgEl = img; this._render(); };
            img.onerror = () => {};
        }
        return idx;
    }

    /* ── Fetching mutuals (with cache) ── */
    _startFetching() {
        // Apply cached entries immediately, collect uncached for API
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
            this._runLayout(600);
            this._render();
            this._hideProgress();
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
        mutualIds.forEach(bid => {
            const bIdx = this.nodeMap[bid];
            if (bIdx !== undefined && aIdx !== bIdx) {
                const exists = this.edges.some(e =>
                    (e.a === aIdx && e.b === bIdx) || (e.a === bIdx && e.b === aIdx));
                if (!exists) this.edges.push({ a: aIdx, b: bIdx });
            }
        });
    }

    onMutualsReceived(data) {
        // Save to in-memory cache
        _mutualCache[data.userId] = { mutualIds: data.mutualIds || [], optedOut: !!data.optedOut };
        // Persist to disk (non-blocking, fire and forget)
        sendToCS({ action: 'vrcSaveMutualCache', cache: JSON.stringify(_mutualCache) });

        this.fetchDone++;
        this._applyMutuals(data.userId, data.mutualIds, data.optedOut);
        this._updateProgress();
        this._runLayout(60);
        this._render();
        if (this.fetchDone >= this.fetchTotal) this._hideProgress();
    }

    cancelLoading() {
        this.cancelled = true;
        this._hideProgress();
    }

    /* ── Progress ── */
    _updateProgress() {
        const bar  = document.getElementById('netProgress');
        const text = document.getElementById('netProgressText');
        if (!bar) return;
        if (this.fetchTotal === 0) { bar.style.display = 'none'; return; }
        bar.style.display = 'flex';
        if (text) text.textContent = `Loading connections: ${this.fetchDone} / ${this.fetchTotal}`;
    }
    _hideProgress() {
        const bar = document.getElementById('netProgress');
        if (bar) bar.style.display = 'none';
    }

    /* ── Layout (synchronous, no animation) ── */
    _startSim() {
        this._runLayout(600);
        this._render();
    }

    _runLayout(steps) {
        for (let i = 0; i < steps; i++) {
            this._simulate();
            if (this._settled) break;
        }
        this._settled = false;
    }

    _simulate() {
        const nodes = this.nodes;
        const n = nodes.length;
        if (n < 2) return;

        const W = this.canvas.width, H = this.canvas.height;
        const cx = W / 2, cy = H / 2;

        const edgeCounts = new Array(n).fill(0);
        this.edges.forEach(e => { edgeCounts[e.a]++; edgeCounts[e.b]++; });
        nodes.forEach((nd, i) => { nd.r = Math.min(12, 5 + edgeCounts[i] * 0.3); });

        const fx = new Float32Array(n);
        const fy = new Float32Array(n);

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
    _render() {
        const ctx = this.ctx;
        const W = this.canvas.width, H = this.canvas.height;
        ctx.clearRect(0, 0, W, H);

        ctx.save();
        ctx.translate(this.tx, this.ty);
        ctx.scale(this.scale, this.scale);

        const sel = this.selected;

        // Compute active set when something is selected (selected + its neighbors)
        let activeSet = null;
        if (sel !== null) {
            activeSet = new Set([sel]);
            this.edges.forEach(e => {
                if (e.a === sel) activeSet.add(e.b);
                if (e.b === sel) activeSet.add(e.a);
            });
        }

        const ac = this._getAccentRgb();

        // Draw edges
        this.edges.forEach(e => {
            const a = this.nodes[e.a], b = this.nodes[e.b];
            const highlighted = sel !== null && (e.a === sel || e.b === sel);
            const dimmed = activeSet !== null && !highlighted;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = highlighted
                ? `rgba(${ac.r},${ac.g},${ac.b},0.85)`
                : dimmed ? `rgba(${ac.r},${ac.g},${ac.b},0.05)`
                : `rgba(${ac.r},${ac.g},${ac.b},0.18)`;
            ctx.lineWidth = highlighted ? 2 / this.scale : 1 / this.scale;
            ctx.stroke();
        });

        // Draw nodes — dim non-active in focus mode
        this.nodes.forEach((nd, i) => {
            const inActive = activeSet === null || activeSet.has(i);
            ctx.globalAlpha = inActive ? 1 : 0.12;
            this._drawNode(ctx, nd, i);
        });
        ctx.globalAlpha = 1;

        // Draw labels on top
        if (activeSet !== null) {
            // Focus mode: label for every highlighted node
            activeSet.forEach(i => {
                if (this.nodes[i]) this._drawLabel(ctx, this.nodes[i], i === sel);
            });
        } else if (this.hovered !== null && this.nodes[this.hovered]) {
            // Normal mode: label only for hovered node
            this._drawLabel(ctx, this.nodes[this.hovered], false);
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

    _drawNode(ctx, nd, idx) {
        const r   = nd.r || 5;
        const x   = nd.x, y = nd.y;
        const sel = this.selected === idx;
        const hov = this.hovered  === idx;
        const sc  = this._statusColor(nd.status);

        // Selection / hover ring
        if (sel || hov) {
            ctx.beginPath();
            ctx.arc(x, y, r + 4, 0, Math.PI * 2);
            ctx.strokeStyle = sel ? 'rgba(80,180,255,0.9)' : 'rgba(80,180,255,0.45)';
            ctx.lineWidth = 2 / this.scale;
            ctx.stroke();
        }

        // Status-colored ring
        ctx.beginPath();
        ctx.arc(x, y, r + 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = sc;
        ctx.lineWidth = 2 / this.scale;
        ctx.stroke();

        // Avatar circle (clipped)
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.clip();
        if (nd.imgEl) {
            ctx.drawImage(nd.imgEl, x - r, y - r, r * 2, r * 2);
        } else {
            // Fallback: semi-transparent status fill, no text
            ctx.fillStyle = sc + '44';
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
        ctx.restore();
    }

    /* Draw name as a badge pill — accent bg, accent text, no border */
    _drawLabel(ctx, nd, isSelected) {
        const ac     = this._getAccentRgb();
        const fs     = isSelected ? 9 : 8;  // font-size px in world-space
        const px     = 4, py = 2;           // horizontal / vertical padding
        const nodeR  = nd.r || 5;
        const yBadge = nd.y + nodeR + 5;

        ctx.save();
        ctx.font         = `${isSelected ? '700' : '600'} ${fs}px sans-serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';

        const tw = ctx.measureText(nd.displayName).width;
        const bw = tw + px * 2;
        const bh = fs  + py * 2;

        // Badge background — accent at ~22% opacity, rounded, no stroke
        ctx.fillStyle = `rgba(${ac.r},${ac.g},${ac.b},0.22)`;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(nd.x - bw / 2, yBadge, bw, bh, 4);
        else               ctx.rect(nd.x - bw / 2, yBadge, bw, bh);
        ctx.fill();

        // Text in full accent color
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
            mouseleave: () => { this.dragging = null; this.hovered = null; this._render(); },
            click:      e  => this._onClick(e),
        };
        const c = this.canvas;
        c.addEventListener('wheel',      this._handlers.wheel,      { passive: false });
        c.addEventListener('mousedown',  this._handlers.mousedown);
        c.addEventListener('mousemove',  this._handlers.mousemove);
        c.addEventListener('mouseup',   this._handlers.mouseup);
        c.addEventListener('mouseleave', this._handlers.mouseleave);
        c.addEventListener('click',     this._handlers.click);
    }

    destroy() {
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
            this._render();
            return;
        }

        const hit = this._hitTest(wx, wy);
        const newHov = hit >= 0 ? hit : null;
        if (newHov !== this.hovered) {
            this.hovered = newHov;
            this._render();
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
