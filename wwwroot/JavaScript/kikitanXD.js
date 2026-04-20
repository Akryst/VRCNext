// Kikitan XD — Live STT + Translation via Groq, output to VRChat Chatbox OSC

let kxdRunning = false;
let _kxdDevicesPayload = null;
let kxdNoiseGatePct = 10;

const KXD_SOURCE_LANGS = [
    { code: 'auto', name: 'Auto Detect' },
    { code: 'en', name: 'English' },
    { code: 'ja', name: 'Japanese' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ko', name: 'Korean' },
    { code: 'de', name: 'German' },
    { code: 'fr', name: 'French' },
    { code: 'es', name: 'Spanish' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'ar', name: 'Arabic' },
    { code: 'it', name: 'Italian' },
    { code: 'nl', name: 'Dutch' },
    { code: 'pl', name: 'Polish' },
    { code: 'sv', name: 'Swedish' },
    { code: 'tr', name: 'Turkish' },
    { code: 'id', name: 'Indonesian' },
    { code: 'fi', name: 'Finnish' },
    { code: 'no', name: 'Norwegian' },
    { code: 'cs', name: 'Czech' },
    { code: 'hu', name: 'Hungarian' },
    { code: 'ro', name: 'Romanian' },
    { code: 'uk', name: 'Ukrainian' },
];

const KXD_TARGET_LANGS = [
    { code: 'en', name: 'English' },
    { code: 'ja', name: 'Japanese' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ko', name: 'Korean' },
    { code: 'de', name: 'German' },
    { code: 'fr', name: 'French' },
    { code: 'es', name: 'Spanish' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'ar', name: 'Arabic' },
    { code: 'it', name: 'Italian' },
    { code: 'nl', name: 'Dutch' },
    { code: 'pl', name: 'Polish' },
    { code: 'sv', name: 'Swedish' },
    { code: 'tr', name: 'Turkish' },
    { code: 'id', name: 'Indonesian' },
    { code: 'fi', name: 'Finnish' },
    { code: 'no', name: 'Norwegian' },
    { code: 'cs', name: 'Czech' },
    { code: 'hu', name: 'Hungarian' },
    { code: 'ro', name: 'Romanian' },
    { code: 'uk', name: 'Ukrainian' },
    { code: 'th', name: 'Thai' },
    { code: 'vi', name: 'Vietnamese' },
    { code: 'hi', name: 'Hindi' },
];

function kxdOnTabOpen() {
    sendToCS({ action: 'kxdGetDevices' });
}

function kxdBuildConnButtonHtml() {
    return kxdRunning
        ? `<span class="msi" style="font-size:16px;">stop</span> Stop`
        : `<span class="msi" style="font-size:16px;">play_arrow</span> Start`;
}

function kxdSyncStateUi() {
    const dot = document.getElementById('kxdDot');
    const txt = document.getElementById('kxdStatusText');
    const btn = document.getElementById('kxdConnBtn');
    if (dot) dot.className = kxdRunning ? 'sf-dot online' : 'sf-dot offline';
    if (txt) txt.textContent = kxdRunning ? t('kikitan.status.listening', 'Listening...') : t('kikitan.status.not_running', 'Not running');
    if (btn) btn.innerHTML = kxdBuildConnButtonHtml();
}

function handleKxdState(p) {
    kxdRunning = !!p.running;
    kxdSyncStateUi();
    if (!kxdRunning) updateKxdMeter(0);
}

function kxdConnect() {
    if (kxdRunning) {
        sendToCS({ action: 'kxdStop' });
        return;
    }

    const devSel = document.getElementById('kxdDeviceSelect');
    const deviceIndex = devSel ? (parseInt(devSel.value, 10) || 0) : 0;
    const apiKey = (document.getElementById('kxdApiKey')?.value || '').trim();
    const srcSel = document.getElementById('kxdSourceLang');
    const tgtSel = document.getElementById('kxdTargetLang');
    const sourceLang = srcSel ? srcSel.value : 'auto';
    const targetLang = tgtSel ? tgtSel.value : 'en';
    const translateEnabled = !!(document.getElementById('kxdTranslateToggle')?.checked);
    const oscEnabled = !!(document.getElementById('kxdOscToggle')?.checked);

    if (!apiKey) {
        alert('Please enter your Groq API key.');
        return;
    }

    sendToCS({ action: 'kxdStart', deviceIndex, apiKey, sourceLang, targetLang, translateEnabled, oscEnabled, noiseGatePct: kxdNoiseGatePct });
}

function populateKxdDevices(p) {
    _kxdDevicesPayload = p;

    const sel = document.getElementById('kxdDeviceSelect');
    if (sel) {
        sel.innerHTML = '';
        const devices = p.devices || [];
        if (devices.length === 0) {
            sel.innerHTML = `<option value="0">${t('kikitan.devices.no_microphone', 'No microphone found')}</option>`;
        } else {
            const savedIdx = Math.min(p.savedIndex ?? 0, devices.length - 1);
            devices.forEach((name, i) => {
                const opt = document.createElement('option');
                opt.value = String(i);
                opt.textContent = name;
                sel.appendChild(opt);
            });
            sel.selectedIndex = savedIdx;
        }
        if (sel._vnRefresh) sel._vnRefresh();
    }

    const apiKeyEl = document.getElementById('kxdApiKey');
    if (apiKeyEl && p.apiKey) apiKeyEl.value = p.apiKey;

    const srcSel = document.getElementById('kxdSourceLang');
    if (srcSel) {
        if (!srcSel.dataset.built) {
            srcSel.innerHTML = buildKxdLangOptions(KXD_SOURCE_LANGS, p.sourceLang || 'auto');
            srcSel.dataset.built = '1';
        } else if (p.sourceLang) {
            srcSel.value = p.sourceLang;
        }
        if (srcSel._vnRefresh) srcSel._vnRefresh();
    }

    const tgtSel = document.getElementById('kxdTargetLang');
    if (tgtSel) {
        if (!tgtSel.dataset.built) {
            tgtSel.innerHTML = buildKxdLangOptions(KXD_TARGET_LANGS, p.targetLang || 'en');
            tgtSel.dataset.built = '1';
        } else if (p.targetLang) {
            tgtSel.value = p.targetLang;
        }
        if (tgtSel._vnRefresh) tgtSel._vnRefresh();
    }

    const transToggle = document.getElementById('kxdTranslateToggle');
    if (transToggle && p.translateEnabled != null) transToggle.checked = !!p.translateEnabled;

    const oscToggle = document.getElementById('kxdOscToggle');
    if (oscToggle && p.oscEnabled != null) oscToggle.checked = !!p.oscEnabled;

    if (p.noiseGatePct != null) {
        kxdNoiseGatePct = p.noiseGatePct;
        const slider = document.getElementById('kxdGateSlider');
        if (slider) slider.value = kxdNoiseGatePct;
        const label = document.getElementById('kxdGateVal');
        if (label) label.textContent = kxdNoiseGatePct + '%';
    }

    kxdUpdateTranslateVisibility();
}

function updateKxdMeter(level) {
    const bar = document.getElementById('kxdMeterBar');
    if (!bar) return;
    const pct = Math.round(Math.min(1, Math.max(0, level)) * 100);
    bar.style.width = pct + '%';
    bar.style.background = pct < kxdNoiseGatePct
        ? 'var(--tx3)'
        : pct > 80 ? 'var(--err)' : pct > 50 ? 'var(--warn)' : 'var(--ok)';
    const mark = document.getElementById('kxdGateMark');
    if (mark) mark.style.left = kxdNoiseGatePct + '%';
}

function kxdSetNoiseGate(val) {
    kxdNoiseGatePct = parseInt(val, 10) || 0;
    const label = document.getElementById('kxdGateVal');
    if (label) label.textContent = kxdNoiseGatePct + '%';
    updateKxdMeter(0); // refresh gate mark position
    kxdSaveSettings();
}

function handleKxdRecognized(p) {
    const el = document.getElementById('kxdSourceText');
    if (!el) return;
    el.textContent = p.text || '';
}

function handleKxdTranslated(p) {
    const el = document.getElementById('kxdOutputText');
    if (!el) return;
    el.textContent = p.text || '';
}

function kxdUpdateTranslateVisibility() {
    const toggle = document.getElementById('kxdTranslateToggle');
    const outputCard = document.getElementById('kxdOutputCard');
    if (!toggle || !outputCard) return;
    outputCard.style.display = toggle.checked ? '' : 'none';
}

function kxdSaveSettings() {
    const apiKey = (document.getElementById('kxdApiKey')?.value || '').trim();
    const srcSel = document.getElementById('kxdSourceLang');
    const tgtSel = document.getElementById('kxdTargetLang');
    const sourceLang = srcSel ? srcSel.value : 'auto';
    const targetLang = tgtSel ? tgtSel.value : 'en';
    const translateEnabled = !!(document.getElementById('kxdTranslateToggle')?.checked);
    const oscEnabled = !!(document.getElementById('kxdOscToggle')?.checked);
    sendToCS({ action: 'kxdSaveSettings', apiKey, sourceLang, targetLang, translateEnabled, oscEnabled, noiseGatePct: kxdNoiseGatePct });
}

function buildKxdLangOptions(langs, selectedCode) {
    return langs.map(l =>
        `<option value="${esc(l.code)}"${l.code === selectedCode ? ' selected' : ''}>${esc(l.name)}</option>`
    ).join('');
}

function kxdInitLangSelects() {
    const srcSel = document.getElementById('kxdSourceLang');
    if (srcSel && !srcSel.dataset.built) {
        srcSel.innerHTML = buildKxdLangOptions(KXD_SOURCE_LANGS, 'auto');
        srcSel.dataset.built = '1';
        if (srcSel._vnRefresh) srcSel._vnRefresh();
    }
    const tgtSel = document.getElementById('kxdTargetLang');
    if (tgtSel && !tgtSel.dataset.built) {
        tgtSel.innerHTML = buildKxdLangOptions(KXD_TARGET_LANGS, 'en');
        tgtSel.dataset.built = '1';
        if (tgtSel._vnRefresh) tgtSel._vnRefresh();
    }
}
