/* FrameShot */

let _fsLastState = null;

function fsConnectBtnHtml() {
    return `<span class="msi" style="font-size:16px;">link</span> ${esc(t('common.connect', 'Connect'))}`;
}

function fsDisconnectBtnHtml() {
    return `<span class="msi" style="font-size:16px;">link_off</span> ${esc(t('common.disconnect', 'Disconnect'))}`;
}

function fsStatusText(state) {
    if (!state?.connected) return state?.error || t('frameshot.status.not_connected', 'Not Connected');
    return state.framing
        ? t('frameshot.status.framing', 'Framing...')
        : t('frameshot.status.connected', 'Connected');
}

function fsConnect() {
    if (fsConnected) {
        sendToCS({ action: 'fsDisconnect' });
    } else {
        sendToCS({ action: 'fsConnect' });
        fsSendConfig();
    }
}

function fsSendConfig() {
    sendToCS({
        action: 'fsConfig',
        leftButton:        parseInt(document.getElementById('fsLeftButton')?.value        ?? '2',  10),
        rightButton:       parseInt(document.getElementById('fsRightButton')?.value       ?? '2',  10),
        leftRecordButton:  parseInt(document.getElementById('fsLeftRecord')?.value        ?? '0',  10),
        rightRecordButton: parseInt(document.getElementById('fsRightRecord')?.value       ?? '0',  10),
        activationRadius:  parseInt(document.getElementById('fsActivationRadius')?.value  ?? '15', 10),
        gifMaxResolution:  parseInt(document.getElementById('fsGifMaxResolution')?.value  ?? '512', 10),
        gifMaxFps:         parseInt(document.getElementById('fsGifMaxFps')?.value         ?? '10', 10),
        useHmdRotations:   !!document.getElementById('fsUseHmdRotations')?.checked,
        leftVideoButton:   parseInt(document.getElementById('fsLeftVideo')?.value         ?? '0', 10),
        rightVideoButton:  parseInt(document.getElementById('fsRightVideo')?.value        ?? '0', 10),
        videoDeviceA:      fsCurrentVideoDeviceA(),
        videoDeviceB:      fsCurrentVideoDeviceB(),
        videoQuality:      document.getElementById('fsVideoQuality')?.value               ?? '1080p',
        videoBitrateQuality: document.getElementById('fsVideoBitrateQuality')?.value      ?? 'medium',
        audioKbps:         parseInt(document.getElementById('fsAudioKbps')?.value         ?? '256', 10),
    });
}

let _fsSavedAudioA = '';
let _fsSavedAudioB = '';
let _fsAudioDevicesReady = false;
function fsRequestAudioDevices() { sendToCS({ action: 'fsGetAudioDevices' }); }
function fsCurrentVideoDeviceA() {
    return _fsAudioDevicesReady ? (document.getElementById('fsVideoDeviceA')?.value ?? '') : _fsSavedAudioA;
}
function fsCurrentVideoDeviceB() {
    return _fsAudioDevicesReady ? (document.getElementById('fsVideoDeviceB')?.value ?? '') : _fsSavedAudioB;
}

function handleFsAudioDevices(payload) {
    const list = Array.isArray(payload?.devices) ? payload.devices : [];
    if (typeof payload?.savedA === 'string' && !_fsSavedAudioA) _fsSavedAudioA = payload.savedA;
    if (typeof payload?.savedB === 'string' && !_fsSavedAudioB) _fsSavedAudioB = payload.savedB;
    const selA = document.getElementById('fsVideoDeviceA');
    const selB = document.getElementById('fsVideoDeviceB');
    const wantA = (selA?.value) || _fsSavedAudioA || '';
    const wantB = (selB?.value) || _fsSavedAudioB || '';
    for (const sel of [selA, selB]) {
        if (!sel) continue;
        sel.innerHTML = '';
        const def = document.createElement('option');
        def.value = '';
        def.textContent = t('frameshot.video.no_input', 'No input');
        sel.appendChild(def);
        for (const d of list) {
            const o = document.createElement('option');
            o.value = d.id;
            o.textContent = d.label;
            sel.appendChild(o);
        }
    }
    if (selA) { selA.value = wantA; if (selA._vnRefresh) selA._vnRefresh(); }
    if (selB) { selB.value = wantB; if (selB._vnRefresh) selB._vnRefresh(); }
    _fsSavedAudioA = wantA;
    _fsSavedAudioB = wantB;
    _fsAudioDevicesReady = true;
}

function fsUpdateActivationRadius() {
    const input = document.getElementById('fsActivationRadius');
    const label = document.getElementById('fsActivationRadiusVal');
    if (input && label) label.textContent = `${input.value} cm`;
    fsAutoSave();
}

let _fsSavedDevice = '';
function fsRequestDevices() { sendToCS({ action: 'fsGetDevices' }); }

function handleFsDevices(payload) {
    const sel = document.getElementById('fsOutputDevice');
    if (!sel) return;
    const list = Array.isArray(payload?.devices) ? payload.devices : [];
    if (typeof payload?.savedDevice === 'string' && !_fsSavedDevice) _fsSavedDevice = payload.savedDevice;
    // Keep current selection if it exists in new list, else fall back to saved
    const want = sel.value || _fsSavedDevice || '';
    sel.innerHTML = '';
    const def = document.createElement('option');
    def.value = '';
    def.textContent = t('frameshot.audio.default', 'System Default');
    sel.appendChild(def);
    for (const name of list) {
        const o = document.createElement('option');
        o.value = name; o.textContent = name;
        sel.appendChild(o);
    }
    // Restore selection (match by startsWith — winmm truncates long names to 31 chars)
    let matched = '';
    for (const o of sel.options) {
        if (!o.value) continue;
        if (o.value === want || (want && want.startsWith(o.value))) { matched = o.value; break; }
    }
    sel.value = matched;
    if (sel._vnRefresh) sel._vnRefresh();
}

function fsOutputDeviceChange() {
    const sel = document.getElementById('fsOutputDevice');
    const dev = sel?.value || '';
    _fsSavedDevice = dev;
    sendToCS({ action: 'fsSetOutput', deviceName: dev });
    clearTimeout(_fsAutoTimer);
    _fsAutoTimer = setTimeout(() => saveSettings(), 600);
}

let _fsAutoTimer = null;
function fsAutoSave() {
    fsSendConfig();
    clearTimeout(_fsAutoTimer);
    _fsAutoTimer = setTimeout(() => saveSettings(), 600);
}

function handleFsUpdate(data) {
    _fsLastState = { ...data };
    fsConnected = !!data.connected;
    if (typeof updateDashQuickControls === 'function') updateDashQuickControls();

    const badge = document.getElementById('badgeFrameShot');
    if (badge) badge.classList.toggle('tb-active', !!data.connected);

    const dot = document.getElementById('fsDot');
    const txt = document.getElementById('fsStatusText');
    const btn = document.getElementById('fsConnBtn');

    if (!dot || !txt || !btn) return;

    if (data.connected) {
        dot.classList.remove('offline');
        dot.classList.add('online');
        txt.textContent = fsStatusText(data);
        txt.style.color = data.framing ? 'var(--warn)' : 'var(--ok)';
        btn.innerHTML = fsDisconnectBtnHtml();
    } else {
        dot.classList.remove('online');
        dot.classList.add('offline');
        txt.textContent = fsStatusText(data);
        txt.style.color = data.error ? 'var(--err)' : 'var(--tx3)';
        btn.innerHTML = fsConnectBtnHtml();
    }

    const lc = document.getElementById('fsCtrlL');
    const rc = document.getElementById('fsCtrlR');
    if (lc) lc.classList.toggle('detected', !!data.leftController);
    if (rc) rc.classList.toggle('detected', !!data.rightController);
}

function rerenderFrameShotTranslations() {
    if (_fsLastState) handleFsUpdate(_fsLastState);
}

document.documentElement.addEventListener('languagechange', rerenderFrameShotTranslations);
