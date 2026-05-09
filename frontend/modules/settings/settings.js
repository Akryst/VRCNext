function renderFolders(f) {
    const e = document.getElementById('folderList');
    if (!f || !f.length) {
        e.innerHTML = `<div class="folder-empty">${t('settings.watch_folders.empty', 'No folders added')}</div>`;
        return;
    }
    e.innerHTML = f.map((x, i) =>
        `<div class="folder-item" onclick="selectedFolderIdx=${i}" style="${selectedFolderIdx === i ? 'background:var(--bg-hover)' : ''}"><span>${esc(x)}</span><button class="folder-remove" onclick="event.stopPropagation();removeFolderAt(${i})" title="${esc(t('common.remove', 'Remove'))}"><span class="msi" style="font-size:16px;">close</span></button></div>`
    ).join('');
}

function addFolder() {
    sendToCS({ action: 'addFolder' });
}

function removeFolder() {
    if (selectedFolderIdx >= 0 && settings.folders?.[selectedFolderIdx]) {
        settings.folders.splice(selectedFolderIdx, 1);
        selectedFolderIdx = -1;
        renderFolders(settings.folders);
        autoSave();
    }
}

function removeFolderAt(i) {
    if (settings.folders) {
        settings.folders.splice(i, 1);
        selectedFolderIdx = -1;
        renderFolders(settings.folders);
        autoSave();
    }
}

function _renderExeList(listId, list, removeFn) {
    const e = document.getElementById(listId);
    if (!e) return;
    if (!list || !list.length) {
        e.innerHTML = `<div class="folder-empty">${t('common.none', 'None')}</div>`;
        return;
    }
    e.innerHTML = list.map((x, i) =>
        `<div class="exe-item"><span>${esc(x.split(/[\\\\/]/).pop())}</span><button class="exe-remove" onclick="${removeFn}(${i})" title="${esc(t('common.remove', 'Remove'))}"><span class="msi" style="font-size:16px;">close</span></button></div>`
    ).join('');
}

function renderExtraExeDesktop(l) { _renderExeList('extraExeDesktopList', l, 'removeExtraExeDesktop'); }
function renderExtraExeVR(l)      { _renderExeList('extraExeVRList',      l, 'removeExtraExeVR');      }

// legacy — kept so i18n.js re-render calls don't break on old references
function renderExtraExe(l) {}

function browseExe(t) {
    sendToCS({ action: 'browseExe', target: t });
}

function removeExtraExeDesktop(i) {
    if (settings.extraExeDesktop) {
        settings.extraExeDesktop.splice(i, 1);
        renderExtraExeDesktop(settings.extraExeDesktop);
        autoSave();
    }
}

function removeExtraExeVR(i) {
    if (settings.extraExeVR) {
        settings.extraExeVR.splice(i, 1);
        renderExtraExeVR(settings.extraExeVR);
        autoSave();
    }
}

function saveSettings() {
    const w = [];
    for (let i = 0; i < 4; i++) {
        const nameEl = document.getElementById('whName' + i);
        const urlEl = document.getElementById('whUrl' + i);
        const onEl = document.getElementById('whOn' + i);
        w.push({
            Name: nameEl?.value || '',
            Url: urlEl?.value || '',
            Enabled: onEl?.checked || false
        });
    }
    const payload = {
        action: 'saveSettings',
        data: {
            botName: document.getElementById('setBotName').value,
            botAvatar: document.getElementById('setBotAvatar').value,
            webhooks: w,
            folders: settings.folders || [],
            relayEnabledFolders: settings.relayEnabledFolders,
            vrcPath: document.getElementById('setVrcPath').value,
            extraExeDesktop: settings.extraExeDesktop || [],
            extraExeVR: settings.extraExeVR || [],
            extraExe: [], // clear legacy field so migration doesn't re-fire after user deletes apps
            autoStart: false, // legacy kept for JSON compat
            relayAutoStartVR:        document.getElementById('setAutoStartVR')?.checked       ?? false,
            relayAutoStartDesktop:   document.getElementById('setAutoStartDesktop')?.checked  ?? false,
            startWithWindows: document.getElementById('setStartWithWindows').checked,
            minimizeToTray: document.getElementById('setMinimizeToTray').checked,
            trayNotificationsEnabled: document.getElementById('setTrayNotifications')?.checked ?? false,
            notifySound: false, // legacy kept for JSON compat
            notifySoundEnabled: document.getElementById('setNotifySoundEnabled').checked,
            messageSoundEnabled: document.getElementById('setMessageSoundEnabled').checked,
            mediaRelaySoundEnabled: document.getElementById('setMediaRelaySoundEnabled').checked,
            steamOverlaySoundEnabled: document.getElementById('setSteamOverlaySoundEnabled')?.checked ?? true,
            language: currentLanguage,
            theme: currentTheme,
            specialTheme: currentSpecialTheme,
            autoColorAccuracy: autoColorAccuracy,
            cursorTheme: currentCursorTheme,
            activeCustomThemes: [..._activeCustomThemes],
            guiZoom: Math.round(_guiZoom * 100),
            dashBgPath: dashBgPath,
            randomDashBg: document.getElementById('setRandomBg').checked,
            clockEnabled: document.getElementById('setClockEnabled').checked,
            clockAmPm: document.getElementById('setClockAmPm').checked,
            vrcUsername: document.getElementById('setVrcUser').value,
            vrcPassword: document.getElementById('setVrcPass').value,
            sfMultiplier: parseFloat(document.getElementById('sfMultiplier').value) || 1,
            sfLockX: document.getElementById('sfLockX').checked,
            sfLockY: document.getElementById('sfLockY').checked,
            sfLockZ: document.getElementById('sfLockZ').checked,
            sfLeftHand: document.getElementById('sfLeftHand').checked,
            sfRightHand: document.getElementById('sfRightHand').checked,
            sfUseGrip: document.getElementById('sfUseGrip').checked,
            chatboxAutoStart: false, // legacy
            chatboxAutoStartVR:       document.getElementById('setCbAutoStartVR')?.checked        ?? false,
            chatboxAutoStartDesktop:  document.getElementById('setCbAutoStartDesktop')?.checked   ?? false,
            sfAutoStart: false, // legacy
            sfAutoStartVR:            document.getElementById('setSfAutoStartVR')?.checked        ?? false,
            ytAutoStartVR:            document.getElementById('setYtAutoStartVR')?.checked        ?? false,
            ytAutoStartDesktop:       document.getElementById('setYtAutoStartDesktop')?.checked   ?? false,
            vfAutoStartVR:            document.getElementById('setVfAutoStartVR')?.checked        ?? false,
            vfAutoStartDesktop:       document.getElementById('setVfAutoStartDesktop')?.checked   ?? false,
            discordPresenceAutoStart: false, // legacy
            dpAutoStartVR:            document.getElementById('setDpAutoStartVR')?.checked        ?? false,
            dpAutoStartDesktop:       document.getElementById('setDpAutoStartDesktop')?.checked   ?? false,
            vroAutoStart: false, // legacy
            vroAutoStartVR:           document.getElementById('setVroAutoStartVR')?.checked       ?? false,
            // Avatar Scaling
            asAutoStartVR:      !!document.getElementById('setAsAutoStartVR')?.checked,
            asAutoStartDesktop: !!document.getElementById('setAsAutoStartDesktop')?.checked,
            asUseSafety:        !!document.getElementById('asUseSafety')?.checked,
            asScale:            parseFloat(document.getElementById('asScaleSlider')?.value) || 1.0,
            asScaleMin:         parseFloat(document.getElementById('asScaleMin')?.value) || 0.5,
            asScaleMax:         parseFloat(document.getElementById('asScaleMax')?.value) || 3.0,
            asSaveScale:        !!document.getElementById('asSaveScale')?.checked,
            asKeyUp:            typeof _asKeyUpCode !== 'undefined' ? _asKeyUpCode : 0,
            asKeyDown:          typeof _asKeyDownCode !== 'undefined' ? _asKeyDownCode : 0,
            asSmoothing:        parseInt(document.getElementById('asSmoothSlider')?.value) || 30,
            vroAttachLeft:   document.getElementById('vroAttachLeft')?.value === 'left',
            vroAttachHand:   document.getElementById('vroAttachPart')?.value === 'hand',
            vroPosX:  parseFloat(document.getElementById('vroPosX')?.value) || 0,
            vroPosY:  parseFloat(document.getElementById('vroPosY')?.value) || 0.07,
            vroPosZ:  parseFloat(document.getElementById('vroPosZ')?.value) || -0.05,
            vroRotX:  parseFloat(document.getElementById('vroRotX')?.value) || -80,
            vroRotY:  parseFloat(document.getElementById('vroRotY')?.value) || 0,
            vroRotZ:  parseFloat(document.getElementById('vroRotZ')?.value) || 0,
            vroWidth: parseFloat(document.getElementById('vroWidth')?.value) || 0.22,
            vroKeybind:        vroComboIds    ?? [],
            vroKeybindHand:    vroComboHand   ?? 0,
            vroKeybindDt:      vroDtIds       ?? [],
            vroKeybindDtHand:  vroDtHand      ?? 0,
            vroKeybindMode:    vroKeybindMode ?? 0,
            vroControlRadius:  parseInt(document.getElementById('vroControlRadius')?.value) || 28,
            vroToastEnabled:    !!document.getElementById('vroToastEnabled')?.checked,
            vroToastFavOnly:    !!document.getElementById('vroToastFavOnly')?.checked,
            vroToastSize:       parseInt(document.getElementById('vroToastSize')?.value) || 50,
            vroToastOffsetX:    parseFloat(document.getElementById('vroToastOffsetX')?.value) || 0,
            vroToastOffsetY:    parseFloat(document.getElementById('vroToastOffsetY')?.value) || -0.12,
            vroToastOnline:     !!document.getElementById('vroToastOnline')?.checked,
            vroToastOffline:    !!document.getElementById('vroToastOffline')?.checked,
            vroToastGps:        !!document.getElementById('vroToastGps')?.checked,
            vroToastStatus:     !!document.getElementById('vroToastStatus')?.checked,
            vroToastStatusDesc: !!document.getElementById('vroToastStatusDesc')?.checked,
            vroToastBio:        !!document.getElementById('vroToastBio')?.checked,
            vroToastDuration:   parseInt(document.getElementById('vroToastDuration')?.value) || 8,
            vroToastStack:      parseInt(document.getElementById('vroToastStack')?.value) || 2,
            vroToastFriendReq:  !!document.getElementById('vroToastFriendReq')?.checked,
            vroToastInvite:     !!document.getElementById('vroToastInvite')?.checked,
            vroToastGroupInv:   !!document.getElementById('vroToastGroupInv')?.checked,
            vroWaterEnabled:    !!document.getElementById('vroWaterEnabled')?.checked,
            vroWaterHours:      parseInt(document.getElementById('vroWaterHours')?.value   ?? '1', 10),
            vroWaterMinutes:    parseInt(document.getElementById('vroWaterMinutes')?.value ?? '0', 10),
            vroScaleScrollSensitivity: parseInt(document.getElementById('vroScaleSensitivity')?.value) || 25,
            dpHideJoinBtnJoinMe: document.getElementById('dpHideJoinBtn_joinme')?.checked ?? false,
            dpHideJoinBtnOnline: document.getElementById('dpHideJoinBtn_online')?.checked ?? false,
            dpHideJoinBtnAskMe:  document.getElementById('dpHideJoinBtn_askme')?.checked  ?? false,
            dpHideJoinBtnBusy:   document.getElementById('dpHideJoinBtn_busy')?.checked   ?? false,
            dpHideInstIdJoinMe:  document.getElementById('dpHideInstId_joinme')?.checked ?? false,
            dpHideInstIdOnline:  document.getElementById('dpHideInstId_online')?.checked ?? false,
            dpHideInstIdAskMe:   document.getElementById('dpHideInstId_askme')?.checked  ?? false,
            dpHideInstIdBusy:    document.getElementById('dpHideInstId_busy')?.checked   ?? false,
            dpHideLocJoinMe:     document.getElementById('dpHideLoc_joinme')?.checked    ?? false,
            dpHideLocOnline:     document.getElementById('dpHideLoc_online')?.checked    ?? false,
            dpHideLocAskMe:      document.getElementById('dpHideLoc_askme')?.checked     ?? false,
            dpHideLocBusy:       document.getElementById('dpHideLoc_busy')?.checked      ?? false,
            dpHidePlayersJoinMe: document.getElementById('dpHidePlayers_joinme')?.checked ?? false,
            dpHidePlayersOnline: document.getElementById('dpHidePlayers_online')?.checked ?? false,
            dpHidePlayersAskMe:  document.getElementById('dpHidePlayers_askme')?.checked  ?? false,
            dpHidePlayersBusy:   document.getElementById('dpHidePlayers_busy')?.checked   ?? false,
            imgCacheLimitGb:         parseInt(document.getElementById('setImgCacheLimit').value) || 5,
            imgCacheOptimizeEnabled: document.getElementById('setImgCacheOptimizeEnabled').checked,
            ffcEnabled: document.getElementById('setFfcEnabled').checked,
            memoryTrimEnabled: document.getElementById('setMemoryTrimEnabled').checked,
            dbOptimize: document.getElementById('setDbOptimize').checked,
            dbOptimizeMaxEntries: Math.max(500, Math.min(250000, parseInt(document.getElementById('setDbOptimizeMaxEntries').value) || 500)),
            autoUpdate: document.getElementById('setAutoUpdate').checked,
            sendCrashData: document.getElementById('setSendCrashData').checked,
            restartAfterCrash: document.getElementById('setRestartAfterCrash').checked,
            rememberWindowSize:     document.getElementById('setRememberWindowSize')?.checked     ?? false,
            rememberWindowPosition: document.getElementById('setRememberWindowPosition')?.checked ?? false,
            regBackupEnabled:    document.getElementById('setRegBackupEnabled')?.checked    ?? true,
            regBackupDays:       parseInt(document.getElementById('setRegBackupCycle')?.value    ?? '30'),
            dbAutoBackupEnabled: document.getElementById('setDbAutoBackupEnabled')?.checked  ?? true,
            dbAutoBackupDays:    parseInt(document.getElementById('setDbAutoBackupCycle')?.value ?? '60'),
            textToolsEnabled: document.getElementById('setTextToolsEnabled')?.checked ?? false,
            legacyWindow: document.getElementById('setLegacyWindow')?.checked ?? false,
            gpuAcceleration:    document.getElementById('setPerfGpuAccel')?.checked    ?? false,
            gpuShaderCache:     document.getElementById('setPerfShaderCache')?.checked  ?? false,
            v8Heap128:          document.getElementById('setPerfV8Heap')?.checked       ?? false,
            twoRenderProcesses: document.getElementById('setPerfRenderProc')?.checked   ?? false,
            avtrdbReportDeleted: document.getElementById('setAvtrdbReport').checked,
            avtrdbSubmitAvatars: document.getElementById('setAvtrdbSubmit').checked,
            avtrIcuReportDeleted: document.getElementById('setAvtrIcuReport').checked,
            avtrIcuSubmitAvatars: document.getElementById('setAvtrIcuSubmit').checked,
            dashSectionOrder:  (typeof _dashLayout !== 'undefined') ? _dashLayout.order  : [],
            dashSectionHidden: (typeof _dashLayout !== 'undefined') ? _dashLayout.hidden : []
        }
    };
    // Sync in-memory flags immediately so sound functions see the updated value without waiting for round-trip
    settings.notifySoundEnabled      = payload.data.notifySoundEnabled;
    settings.messageSoundEnabled     = payload.data.messageSoundEnabled;
    settings.mediaRelaySoundEnabled  = payload.data.mediaRelaySoundEnabled;
    settings.steamOverlaySoundEnabled = payload.data.steamOverlaySoundEnabled;
    sendToCS(payload);
}

function updateTrayNotifToggle() {
    const hideInTray = document.getElementById('setMinimizeToTray')?.checked ?? false;
    const row = document.getElementById('trayNotifRow');
    const desc = document.getElementById('trayNotifDesc');
    if (row)  row.classList.toggle('disabled', !hideInTray);
    if (desc) desc.classList.toggle('disabled', !hideInTray);
}

function onDbOptimizeChange() {
    const on = document.getElementById('setDbOptimize').checked;
    document.getElementById('setDbOptimizeMaxEntries').disabled = !on;
    document.getElementById('dbOptimizeOffWarning').style.display = on ? 'none' : '';
}

// Autosave: debounced save on any settings change
let _autoSaveTimer = null;
function autoSave() {
    clearTimeout(_autoSaveTimer);
    _autoSaveTimer = setTimeout(() => saveSettings(), 600);
}
// Attach autosave listeners after DOM ready
function initAutoSave() {
    const ids = ['setBotName','setBotAvatar','setVrcPath','setStartWithWindows','setMinimizeToTray','setTrayNotifications',
        'setNotifySoundEnabled','setMessageSoundEnabled','setMediaRelaySoundEnabled','setSteamOverlaySoundEnabled',
        'setRandomBg','setClockEnabled','setClockAmPm',
        'setVrcUser','setVrcPass',
        'setAutoStartVR','setAutoStartDesktop',
        'setCbAutoStartVR','setCbAutoStartDesktop',
        'setSfAutoStartVR',
        'setYtAutoStartVR','setYtAutoStartDesktop',
        'setVfAutoStartVR','setVfAutoStartDesktop',
        'setDpAutoStartVR','setDpAutoStartDesktop',
        'setImgCacheEnabled','setImgCacheLimit','setImgCacheOptimizeEnabled','setMemoryTrimEnabled','setSendCrashData','setRestartAfterCrash','setLegacyWindow',
        'setPerfGpuAccel','setPerfShaderCache','setPerfV8Heap','setPerfRenderProc'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === 'checkbox') el.addEventListener('change', autoSave);
        else if (el.type === 'range') el.addEventListener('input', autoSave);
        else el.addEventListener('input', autoSave);
    });

}

function loadSettingsToUI(s) {
    settings = s;
    // Debug: log webhook data received from C#
    const wh = s.Webhooks || s.webhooks || [];
    console.log('[LOAD] Settings received. Webhooks:', JSON.stringify(wh));
    currentLanguage = normalizeUiLanguage((s.Language || s.language || currentLanguage || 'en').toLowerCase());
    renderLanguageChips();
    requestTranslation(currentLanguage);
    document.getElementById('setBotName').value = s.BotName || s.botName || '';
    document.getElementById('setBotAvatar').value = s.BotAvatarUrl || s.botAvatarUrl || '';
    document.getElementById('setVrcPath').value = s.VrcPath || s.vrcPath || '';
    document.getElementById('setVrcUser').value = s.VrcUsername || s.vrcUsername || '';
    document.getElementById('setVrcPass').value = s.VrcPassword || s.vrcPassword || '';
    const _asVR  = document.getElementById('setAutoStartVR');  if (_asVR)  _asVR.checked  = s.RelayAutoStartVR  ?? s.relayAutoStartVR  ?? false;
    const _asDT  = document.getElementById('setAutoStartDesktop'); if (_asDT) _asDT.checked = s.RelayAutoStartDesktop ?? s.relayAutoStartDesktop ?? false;
    document.getElementById('setStartWithWindows').checked = s.StartWithWindows || s.startWithWindows || false;
    document.getElementById('setMinimizeToTray').checked = s.MinimizeToTray ?? s.minimizeToTray ?? false;
    const _trayNotifEl = document.getElementById('setTrayNotifications');
    if (_trayNotifEl) _trayNotifEl.checked = s.TrayNotificationsEnabled ?? s.trayNotificationsEnabled ?? false;
    updateTrayNotifToggle();
    document.getElementById('setNotifySoundEnabled').checked = s.NotifySoundEnabled ?? s.notifySoundEnabled ?? false;
    document.getElementById('setMessageSoundEnabled').checked = s.MessageSoundEnabled ?? s.messageSoundEnabled ?? false;
    document.getElementById('setMediaRelaySoundEnabled').checked = s.MediaRelaySoundEnabled ?? s.mediaRelaySoundEnabled ?? false;
    settings.folders = s.WatchFolders || s.watchFolders || s.folders || [];
    settings.relayEnabledFolders = s.RelayEnabledFolders ?? s.relayEnabledFolders ?? null;
    settings.extraExe = s.ExtraExe || s.extraExe || [];
    // Migration: if new lists are empty but legacy extraExe has items, pre-populate both lists from it
    const _legacyExe = settings.extraExe;
    settings.extraExeDesktop = (s.ExtraExeDesktop || s.extraExeDesktop || []).length
        ? (s.ExtraExeDesktop || s.extraExeDesktop)
        : (_legacyExe.length ? [..._legacyExe] : []);
    settings.extraExeVR = (s.ExtraExeVR || s.extraExeVR || []).length
        ? (s.ExtraExeVR || s.extraExeVR)
        : (_legacyExe.length ? [..._legacyExe] : []);
    settings.notifySoundEnabled = s.NotifySoundEnabled ?? s.notifySoundEnabled ?? false;
    settings.messageSoundEnabled = s.MessageSoundEnabled ?? s.messageSoundEnabled ?? false;
    settings.mediaRelaySoundEnabled = s.MediaRelaySoundEnabled ?? s.mediaRelaySoundEnabled ?? false;
    settings.steamOverlaySoundEnabled = s.SteamOverlaySoundEnabled ?? s.steamOverlaySoundEnabled ?? true;
    const _sovEl = document.getElementById('setSteamOverlaySoundEnabled');
    if (_sovEl) _sovEl.checked = settings.steamOverlaySoundEnabled;
    // Restore GUI zoom level
    const savedZoom = s.GuiZoom ?? s.guiZoom ?? 100;
    applyGuiZoom(savedZoom / 100);

    dashBgPath = s.DashBgPath || s.dashBgPath || '';
    if (typeof loadDashLayout === 'function') loadDashLayout({ order: s.DashSectionOrder || s.dashSectionOrder, hidden: s.DashSectionHidden || s.dashSectionHidden });

    const randomBg = s.RandomDashBg || s.randomDashBg || false;
    document.getElementById('setRandomBg').checked = randomBg;
    document.getElementById('setClockEnabled').checked = s.ClockEnabled ?? s.clockEnabled ?? true;
    document.getElementById('setClockAmPm').checked    = s.ClockAmPm    ?? s.clockAmPm    ?? false;
    applyClockSettings();
    if (randomBg) {
        // Request random image from watch folders
        sendToCS({ action: 'vrcRandomDashBg' });
    } else if (dashBgPath) {
        document.getElementById('dashBgName').textContent = dashBgPath.split(/[\\\\/]/).pop();
        sendToCS({ action: 'vrcLoadDashBg', path: dashBgPath });
    }
    renderWebhookCards((s.Webhooks || s.webhooks || []).slice(0, 4));
    renderFolders(settings.folders);
    if (typeof renderRelayFolders === 'function') renderRelayFolders();
    renderExtraExeDesktop(settings.extraExeDesktop);
    renderExtraExeVR(settings.extraExeVR);
    updateFolderFilterOptions(settings.folders);
    currentTheme = s.Theme || s.theme || 'slates';
    currentSpecialTheme = s.SpecialTheme || s.specialTheme || '';
    autoColorAccuracy = s.AutoColorAccuracy ?? s.autoColorAccuracy ?? 50;
    const accSlider = document.getElementById('setAutoAccuracy');
    if (accSlider) { accSlider.value = autoColorAccuracy; document.getElementById('autoAccuracyVal').textContent = autoColorAccuracy + '%'; }
    const accRow = document.getElementById('autoAccuracyRow');
    if (accRow) accRow.style.display = currentSpecialTheme === 'auto' ? 'flex' : 'none';
    if (THEMES[currentTheme]) applyColors(THEMES[currentTheme].c);
    else if (!currentTheme.startsWith('custom_')) { currentTheme = 'slates'; applyColors(THEMES.slates.c); }
    // custom_ themes are applied later when customColors loads
    renderThemeChips();
    renderSpecialThemeChips();
    _localHttpPort = s.LocalHttpPort || s.localHttpPort || 0;
    currentCursorTheme = s.CursorTheme || s.cursorTheme || '';
    sendToCS({ action: 'getCursorFiles' });
    _activeCustomThemes = new Set(s.ActiveCustomThemes || s.activeCustomThemes || []);
    sendToCS({ action: 'getCustomThemes' });

    // Restore chatbox settings
    document.getElementById('cbShowTime').checked = s.CbShowTime ?? s.cbShowTime ?? true;
    document.getElementById('cbShowMedia').checked = s.CbShowMedia ?? s.cbShowMedia ?? true;
    document.getElementById('cbShowPlaytime').checked = s.CbShowPlaytime ?? s.cbShowPlaytime ?? true;
    document.getElementById('cbShowCustom').checked = s.CbShowCustomText ?? s.cbShowCustomText ?? true;
    document.getElementById('cbShowSystemStats').checked = s.CbShowSystemStats ?? s.cbShowSystemStats ?? false;
    document.getElementById('cbShowAfk').checked = s.CbShowAfk ?? s.cbShowAfk ?? false;
    document.getElementById('cbAfkMessage').value = s.CbAfkMessage || s.cbAfkMessage || 'Currently AFK';
    document.getElementById('cbSuppressSound').checked = s.CbSuppressSound ?? s.cbSuppressSound ?? true;
    document.getElementById('cbHideBackground').checked = s.CbHideBackground ?? s.cbHideBackground ?? false;
    const cbAfkOn = s.CbShowAfk ?? s.cbShowAfk ?? false;
    document.getElementById('cbAfkCard').style.display = cbAfkOn ? '' : 'none';
    const cbTf = s.CbTimeFormat || s.cbTimeFormat || 'hh:mm tt';
    const cbTfEl = document.getElementById('cbTimeFormat');
    if (cbTfEl) cbTfEl.value = cbTf;
    const cbSep = s.CbSeparator || s.cbSeparator || ' | ';
    const cbSepEl = document.getElementById('cbSeparator');
    if (cbSepEl) cbSepEl.value = cbSep;
    const cbInt = s.CbIntervalMs || s.cbIntervalMs || 5000;
    const cbIntEl = document.getElementById('cbInterval');
    if (cbIntEl) cbIntEl.value = String(cbInt);
    chatboxCustomLines = s.CbCustomLines || s.cbCustomLines || [];
    renderChatboxLines();

    // Restore Space Flight settings
    document.getElementById('sfMultiplier').value = s.SfMultiplier ?? s.sfMultiplier ?? 1;
    document.getElementById('sfMultVal').textContent = (s.SfMultiplier ?? s.sfMultiplier ?? 1) + 'x';
    document.getElementById('sfLockX').checked = s.SfLockX ?? s.sfLockX ?? false;
    document.getElementById('sfLockY').checked = s.SfLockY ?? s.sfLockY ?? false;
    document.getElementById('sfLockZ').checked = s.SfLockZ ?? s.sfLockZ ?? false;
    document.getElementById('sfLeftHand').checked = s.SfLeftHand ?? s.sfLeftHand ?? false;
    document.getElementById('sfRightHand').checked = s.SfRightHand ?? s.sfRightHand ?? true;
    document.getElementById('sfUseGrip').checked = s.SfUseGrip ?? s.sfUseGrip ?? true;

    // Restore VR/Desktop auto-start flags
    const _set = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
    _set('setCbAutoStartVR',      s.ChatboxAutoStartVR      ?? s.chatboxAutoStartVR      ?? false);
    _set('setCbAutoStartDesktop', s.ChatboxAutoStartDesktop ?? s.chatboxAutoStartDesktop ?? false);
    _set('setSfAutoStartVR',      s.SfAutoStartVR           ?? s.sfAutoStartVR           ?? false);
    _set('setYtAutoStartVR',      s.YtAutoStartVR           ?? s.ytAutoStartVR           ?? false);
    _set('setYtAutoStartDesktop', s.YtAutoStartDesktop      ?? s.ytAutoStartDesktop      ?? false);
    _set('setVfAutoStartVR',      s.VfAutoStartVR           ?? s.vfAutoStartVR           ?? false);
    _set('setVfAutoStartDesktop', s.VfAutoStartDesktop      ?? s.vfAutoStartDesktop      ?? false);
    _set('setDpAutoStartVR',      s.DpAutoStartVR           ?? s.dpAutoStartVR           ?? false);
    _set('setDpAutoStartDesktop', s.DpAutoStartDesktop      ?? s.dpAutoStartDesktop      ?? false);
    // Restore Discord privacy + join button toggles
    const _dpPv = [
        ['dpHideInstId_joinme', 'DpHideInstIdJoinMe'],  ['dpHideInstId_online', 'DpHideInstIdOnline'],
        ['dpHideInstId_askme',  'DpHideInstIdAskMe'],   ['dpHideInstId_busy',   'DpHideInstIdBusy'],
        ['dpHideLoc_joinme',    'DpHideLocJoinMe'],     ['dpHideLoc_online',    'DpHideLocOnline'],
        ['dpHideLoc_askme',     'DpHideLocAskMe'],      ['dpHideLoc_busy',      'DpHideLocBusy'],
        ['dpHidePlayers_joinme','DpHidePlayersJoinMe'], ['dpHidePlayers_online','DpHidePlayersOnline'],
        ['dpHidePlayers_askme', 'DpHidePlayersAskMe'],  ['dpHidePlayers_busy',  'DpHidePlayersBusy'],
        ['dpHideJoinBtn_joinme','DpHideJoinBtnJoinMe'], ['dpHideJoinBtn_online','DpHideJoinBtnOnline'],
        ['dpHideJoinBtn_askme', 'DpHideJoinBtnAskMe'],  ['dpHideJoinBtn_busy',  'DpHideJoinBtnBusy'],
    ];
    for (const [id, key] of _dpPv) {
        const el = document.getElementById(id);
        if (el) el.checked = s[key] ?? s[key.charAt(0).toLowerCase() + key.slice(1)] ?? false;
    }

    // VR Overlay settings
    vroLoadSettings({
        vroAttachLeft: s.VroAttachLeft ?? s.vroAttachLeft ?? true,
        vroAttachHand: s.VroAttachHand ?? s.vroAttachHand ?? true,
        vroPosX: s.VroPosX ?? s.vroPosX ?? -0.10,
        vroPosY: s.VroPosY ?? s.vroPosY ?? -0.03,
        vroPosZ: s.VroPosZ ?? s.vroPosZ ?? 0.11,
        vroRotX: s.VroRotX ?? s.vroRotX ?? -180,
        vroRotY: s.VroRotY ?? s.vroRotY ?? 46,
        vroRotZ: s.VroRotZ ?? s.vroRotZ ?? 85,
        vroWidth: s.VroWidth ?? s.vroWidth ?? 0.16,
        vroAutoStartVR:      s.VroAutoStartVR      ?? s.vroAutoStartVR      ?? false,
        vroKeybind:       s.VroKeybind       ?? s.vroKeybind       ?? [],
        vroKeybindHand:   s.VroKeybindHand   ?? s.vroKeybindHand   ?? 0,
        vroKeybindDt:     s.VroKeybindDt     ?? s.vroKeybindDt     ?? [],
        vroKeybindDtHand: s.VroKeybindDtHand ?? s.vroKeybindDtHand ?? 0,
        vroKeybindMode:    s.VroKeybindMode   ?? s.vroKeybindMode   ?? 0,
        vroControlRadius:  s.VroControlRadius ?? s.vroControlRadius ?? 16,
        vroToastEnabled:    s.VroToastEnabled    ?? s.vroToastEnabled    ?? true,
        vroToastFavOnly:    s.VroToastFavOnly    ?? s.vroToastFavOnly    ?? false,
        vroToastSize:       s.VroToastSize       ?? s.vroToastSize       ?? 50,
        vroToastOffsetX:    s.VroToastOffsetX    ?? s.vroToastOffsetX    ?? 0,
        vroToastOffsetY:    s.VroToastOffsetY    ?? s.vroToastOffsetY    ?? -0.12,
        vroToastOnline:     s.VroToastOnline     ?? s.vroToastOnline     ?? true,
        vroToastOffline:    s.VroToastOffline    ?? s.vroToastOffline    ?? true,
        vroToastGps:        s.VroToastGps        ?? s.vroToastGps        ?? true,
        vroToastStatus:     s.VroToastStatus     ?? s.vroToastStatus     ?? true,
        vroToastStatusDesc: s.VroToastStatusDesc ?? s.vroToastStatusDesc ?? true,
        vroToastBio:        s.VroToastBio        ?? s.vroToastBio        ?? true,
        vroToastDuration:   s.VroToastDuration   ?? s.vroToastDuration   ?? 8,
        vroToastStack:      s.VroToastStack      ?? s.vroToastStack      ?? 2,
        vroToastFriendReq:  s.VroToastFriendReq  ?? s.vroToastFriendReq  ?? true,
        vroToastInvite:     s.VroToastInvite     ?? s.vroToastInvite     ?? true,
        vroToastGroupInv:   s.VroToastGroupInv   ?? s.vroToastGroupInv   ?? true,
        vroWaterEnabled:    s.VroWaterEnabled    ?? s.vroWaterEnabled    ?? false,
        vroWaterHours:      s.VroWaterHours      ?? s.vroWaterHours      ?? 1,
        vroWaterMinutes:    s.VroWaterMinutes    ?? s.vroWaterMinutes    ?? 0,
        vroScaleEnabled:     s.VroScaleEnabled     ?? s.vroScaleEnabled     ?? true,
        vroScaleLeftThumb:   s.VroScaleLeftThumb   ?? s.vroScaleLeftThumb   ?? false,
        vroScaleRightThumb:  s.VroScaleRightThumb  ?? s.vroScaleRightThumb  ?? true,
        vroScaleKeybind:            s.VroScaleKeybind            ?? s.vroScaleKeybind            ?? [],
        vroScaleKeybindHand:        s.VroScaleKeybindHand        ?? s.vroScaleKeybindHand        ?? 0,
        vroScaleScrollSensitivity:  s.VroScaleScrollSensitivity  ?? s.vroScaleScrollSensitivity  ?? 25,
    });
    // Auto-starts are now triggered by vrcLaunched (see messages.js)

    // Avatar Scaling settings
    if (typeof asLoadSettings === 'function') {
        asLoadSettings({
            autoStartVR:      s.AsAutoStartVR            ?? s.asAutoStartVR            ?? false,
            autoStartDesktop: s.AsAutoStartDesktop       ?? s.asAutoStartDesktop       ?? false,
            useSafety:        s.AsUseSafetySettings      ?? s.asUseSafety              ?? false,
            scale:            s.AsScale                  ?? s.asScale                  ?? 1.0,
            scaleMin:         s.AsScaleMin               ?? s.asScaleMin               ?? 0.5,
            scaleMax:         s.AsScaleMax               ?? s.asScaleMax               ?? 3.0,
            saveScale:        s.AsSaveScaleBetweenWorlds ?? s.asSaveScale              ?? false,
            keyUp:            s.AsKeyUp                  ?? s.asKeyUp                  ?? 0,
            keyDown:          s.AsKeyDown                ?? s.asKeyDown                ?? 0,
            smoothing:        s.AsSmoothing              ?? s.asSmoothing              ?? 30,
        });
    }

    // Image cache settings
    const imgCacheLimitGb         = Math.max(5, Math.min(30, s.ImgCacheLimitGb ?? s.imgCacheLimitGb ?? 5));
    const imgCacheOptimizeEnabled = s.ImgCacheOptimizeEnabled ?? s.imgCacheOptimizeEnabled ?? true;
    document.getElementById('setImgCacheLimit').value = imgCacheLimitGb;
    document.getElementById('imgCacheLimitVal').textContent = imgCacheLimitGb + ' GB';
    document.getElementById('setImgCacheOptimizeEnabled').checked = imgCacheOptimizeEnabled;
    sendToCS({ action: 'getImgCacheSize' });

    // Fast Fetch Cache
    document.getElementById('setFfcEnabled').checked = s.FfcEnabled ?? s.ffcEnabled ?? true;

    // Avtrdb Support
    document.getElementById('setAvtrdbReport').checked = s.AvtrdbReportDeleted ?? s.avtrdbReportDeleted ?? true;
    document.getElementById('setAvtrdbSubmit').checked = s.AvtrdbSubmitAvatars ?? s.avtrdbSubmitAvatars ?? false;
    document.getElementById('setAvtrIcuReport').checked = s.AvtrIcuReportDeleted ?? s.avtrIcuReportDeleted ?? true;
    document.getElementById('setAvtrIcuSubmit').checked = s.AvtrIcuSubmitAvatars ?? s.avtrIcuSubmitAvatars ?? false;

    // Memory Trim
    document.getElementById('setMemoryTrimEnabled').checked = s.MemoryTrimEnabled ?? s.memoryTrimEnabled ?? false;

    // Database optimization
    const dbOptimize           = s.DbOptimize ?? s.dbOptimize ?? true;
    const dbOptimizeMaxEntries = Math.max(500, Math.min(250000, s.DbOptimizeMaxEntries ?? s.dbOptimizeMaxEntries ?? 500));
    document.getElementById('setDbOptimize').checked            = dbOptimize;
    document.getElementById('setDbOptimizeMaxEntries').value    = dbOptimizeMaxEntries;
    document.getElementById('setDbOptimizeMaxEntries').disabled = !dbOptimize;
    document.getElementById('dbOptimizeEntriesVal').textContent = dbOptimizeMaxEntries;
    document.getElementById('dbOptimizeOffWarning').style.display = dbOptimize ? 'none' : '';

    // Crash Reporting
    document.getElementById('setAutoUpdate').checked          = s.AutoUpdate          ?? s.autoUpdate          ?? true;
    document.getElementById('setSendCrashData').checked      = s.SendCrashData      ?? s.sendCrashData      ?? false;
    document.getElementById('setRestartAfterCrash').checked  = s.RestartAfterCrash  ?? s.restartAfterCrash  ?? true;

    // Window Behavior
    const rwsEl = document.getElementById('setRememberWindowSize');
    if (rwsEl) rwsEl.checked = s.RememberWindowSize ?? s.rememberWindowSize ?? false;
    const rwpEl = document.getElementById('setRememberWindowPosition');
    if (rwpEl) rwpEl.checked = s.RememberWindowPosition ?? s.rememberWindowPosition ?? false;

    // Auto-Backups
    const rbeEl = document.getElementById('setRegBackupEnabled');
    if (rbeEl) rbeEl.checked = s.RegBackupEnabled ?? s.regBackupEnabled ?? true;
    const rbcEl = document.getElementById('setRegBackupCycle');
    if (rbcEl) rbcEl.value = String(s.RegBackupDays ?? s.regBackupDays ?? 30);
    const dbeEl = document.getElementById('setDbAutoBackupEnabled');
    if (dbeEl) dbeEl.checked = s.DbAutoBackupEnabled ?? s.dbAutoBackupEnabled ?? true;
    const dbcEl = document.getElementById('setDbAutoBackupCycle');
    if (dbcEl) dbcEl.value = String(s.DbAutoBackupDays ?? s.dbAutoBackupDays ?? 60);

    // Text Tools
    const textToolsEnabled = s.TextToolsEnabled ?? s.textToolsEnabled ?? false;
    const ttEl = document.getElementById('setTextToolsEnabled');
    if (ttEl) ttEl.checked = textToolsEnabled;
    toggleTextTools(textToolsEnabled, false);

    // Legacy Window
    const legacyWindow = s.LegacyWindow ?? s.legacyWindow ?? false;
    const lwEl = document.getElementById('setLegacyWindow');
    if (lwEl) lwEl.checked = legacyWindow;
    const winDotsEl = document.querySelector('.win-dots');
    if (winDotsEl) winDotsEl.style.display = legacyWindow ? 'none' : '';
    const legacyHint = document.getElementById('legacyRestartHint');
    if (legacyHint) legacyHint.style.display = 'none';
    window._legacyWindow = legacyWindow;

    // Performance
    const _perfSet = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
    _perfSet('setPerfGpuAccel',    s.GpuAcceleration    ?? s.gpuAcceleration    ?? false);
    _perfSet('setPerfShaderCache', s.GpuShaderCache     ?? s.gpuShaderCache     ?? false);
    _perfSet('setPerfV8Heap',      s.V8Heap128          ?? s.v8Heap128          ?? false);
    _perfSet('setPerfRenderProc',  s.TwoRenderProcesses ?? s.twoRenderProcesses ?? false);
    const perfHint = document.getElementById('perfRestartHint');
    if (perfHint) perfHint.style.display = 'none';

    // Sync custom dropdowns to reflect programmatically set values
    document.querySelectorAll('select').forEach(s => s._vnRefresh && s._vnRefresh());

    // Setup autosave listeners after UI is populated
    setTimeout(initAutoSave, 100);
}

function updateImgCacheUi() {
    sendToCS({ action: 'getImgCacheSize' });
}

function updateImgCacheSizeBar(bytes) {
    const el = document.getElementById('imgCacheSizeBar');
    const label = document.getElementById('imgCacheSizeLabel');
    if (!el || !label) return;
    const limitGb = parseInt(document.getElementById('setImgCacheLimit').value) || 5;
    const limitBytes = limitGb * 1024 * 1024 * 1024;
    const pct = Math.min(100, (bytes / limitBytes) * 100);
    el.style.width = pct + '%';
    const mb = bytes / (1024 * 1024);
    label.textContent = mb >= 1024
        ? (mb / 1024).toFixed(2) + ' GB used'
        : mb.toFixed(1) + ' MB used';
}

function startForceOptimize() {
    const btn = document.getElementById('btnForceOptimize');
    if (btn) btn.disabled = true;
    sendToCS({ action: 'optimizeImgCache' });
}

function handleImgCacheOptimizeProgress(data) {
    const wrap  = document.getElementById('imgOptimizeProgress');
    const bar   = document.getElementById('imgOptimizeBar');
    const label = document.getElementById('imgOptimizeLabel');
    const btn   = document.getElementById('btnForceOptimize');
    if (!wrap || !bar || !label) return;

    // done = -1 signals completion
    if (data.done === -1) {
        wrap.style.display = 'none';
        bar.style.width = '0%';
        if (btn) btn.disabled = false;
        return;
    }

    wrap.style.display = '';
    if (data.total > 0) {
        const pct = Math.round((data.done / data.total) * 100);
        bar.style.width = pct + '%';
        label.textContent = `Optimizing… ${data.done} / ${data.total} (${pct}%)`;
    } else {
        bar.style.width = '0%';
        label.textContent = 'Scanning…';
    }
}

// Legacy Window (Debugging).
function onLegacyWindowChange() {
    autoSave();
    const hint = document.getElementById('legacyRestartHint');
    if (hint) hint.style.display = '';
}

function onPerfSettingChange() {
    autoSave();
    const hint = document.getElementById('perfRestartHint');
    if (hint) hint.style.display = '';
}

// Text Tools (Debugging).
let _textToolsEnabled = false;

function toggleTextTools(enabled, save = true) {
    _textToolsEnabled = enabled;
    document.documentElement.classList.toggle('text-tools-active', enabled);
    if (save) autoSave();
}

// VRCX Import

let _vrcxPreviewData = null;
let _vrcxLastProgress = null;
let _vrcxLastDone = null;
let _vrcxLastError = null;

function settingsUiLocale() {
    return getLanguageLocale();
}

function formatSettingsNumber(value) {
    return Number(value ?? 0).toLocaleString(settingsUiLocale());
}

function vrcxSelectBtnHtml(selecting = false) {
    return selecting
        ? `<span class="msi" style="font-size:16px;">hourglass_empty</span> ${t('settings.vrcx.selecting', 'Selecting...')}`
        : `<span class="msi" style="font-size:16px;">storage</span> ${t('settings.vrcx.select_db', 'Select VRCX Database')}`;
}

function vrcxStartBtnHtml(retry = false) {
    return retry
        ? `<span class="msi" style="font-size:16px;">upload</span> ${t('settings.vrcx.retry_import', 'Retry Import')}`
        : `<span class="msi" style="font-size:16px;">upload</span> ${t('settings.vrcx.start_import', 'Start Import')}`;
}

function translateVrcxStatus(status) {
    switch (status) {
        case 'Reading database...':
            return t('settings.vrcx.progress.reading_database', 'Reading database...');
        case 'Reading friend data...':
            return t('settings.vrcx.progress.reading_friend_data', 'Reading friend data...');
        case 'Reading timeline events...':
            return t('settings.vrcx.progress.reading_timeline_events', 'Reading timeline events...');
        case 'Reading friend events...':
            return t('settings.vrcx.progress.reading_friend_events', 'Reading friend events...');
        case 'Generating meet events...':
            return t('settings.vrcx.progress.generating_meet_events', 'Generating meet events...');
        case 'Merging into VRCNext...':
            return t('settings.vrcx.progress.merging', 'Merging into VRCNext...');
        case 'Saving timeline...':
            return t('settings.vrcx.progress.saving_timeline', 'Saving timeline...');
        case 'Done':
            return t('common.done', 'Done');
        default:
            return status || '';
    }
}

function renderVrcxPreviewRows(p) {
    const rows = [
        [t('settings.vrcx.preview.worlds_tracked', 'Worlds tracked'), p.worlds],
        [t('settings.vrcx.preview.location_visits', 'Location visits'), p.locations],
        [t('settings.vrcx.preview.friends_time', 'Friends (time)'), p.friendTimes],
        [t('settings.vrcx.preview.gps_events', 'GPS events'), p.gps],
        [t('settings.vrcx.preview.online_offline', 'Online / Offline'), p.onlineOffline],
        [t('settings.vrcx.preview.status_changes', 'Status changes'), p.statuses],
        [t('settings.vrcx.preview.bio_changes', 'Bio changes'), p.bios],
    ];
    document.getElementById('vrcxPreviewRows').innerHTML = rows.map(([label, val]) =>
        `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;background:var(--bg-input);border-radius:6px;">
            <span style="font-size:12px;opacity:.7;">${esc(label)}</span>
            <span style="font-size:12px;font-weight:600;">${formatSettingsNumber(val)}</span>
        </div>`
    ).join('');
}

function renderVrcxSuccessDetail(p) {
    const el = document.getElementById('vrcxSuccessDetail');
    if (!el) return;
    el.textContent = tf('settings.vrcx.success.summary', {
        worlds: formatSettingsNumber(p.worlds),
        friends: formatSettingsNumber(p.friends),
        joins: formatSettingsNumber(p.timelineJoins),
        friend_events: formatSettingsNumber(p.friendEvents),
        meets: formatSettingsNumber(p.meetEvents),
    }, `${formatSettingsNumber(p.worlds)} worlds, ${formatSettingsNumber(p.friends)} friends, ${formatSettingsNumber(p.timelineJoins)} joins, ${formatSettingsNumber(p.friendEvents)} friend events, ${formatSettingsNumber(p.meetEvents)} meets`);
}

function renderVrcxError(err) {
    const el = document.getElementById('vrcxImportError');
    if (!el) return;
    el.textContent = tf('settings.vrcx.error.message', {
        error: err || t('settings.vrcx.error.unknown', 'Unknown error'),
    }, `Error: ${err || 'Unknown error'}`);
}

function vrcxSelectFile() {
    const btn = document.getElementById('vrcxSelectBtn');
    btn.disabled = true;
    btn.innerHTML = vrcxSelectBtnHtml(true);
    sendToCS({ action: 'importVrcxSelect' });
}

function vrcxReset() {
    _vrcxPreviewData = null;
    _vrcxLastProgress = null;
    _vrcxLastDone = null;
    _vrcxLastError = null;
    document.getElementById('vrcxPreviewBox').style.display = 'none';
    document.getElementById('vrcxProgressWrap').style.display = 'none';
    document.getElementById('vrcxSuccessCard').style.display = 'none';
    document.getElementById('vrcxImportError').style.display = 'none';
    document.getElementById('vrcxActionBtns').style.display = 'flex';
    document.getElementById('vrcxDoneBtn').style.display = 'none';
    const btn = document.getElementById('vrcxSelectBtn');
    btn.style.display = '';
    btn.disabled = false;
    btn.innerHTML = vrcxSelectBtnHtml(false);
    const start = document.getElementById('vrcxStartBtn');
    start.disabled = false;
    start.innerHTML = vrcxStartBtnHtml(false);
}

function vrcxShowPreview(p) {
    _vrcxPreviewData = p;
    _vrcxLastProgress = null;
    _vrcxLastDone = null;
    _vrcxLastError = null;
    document.getElementById('vrcxSelectBtn').style.display = 'none';
    document.getElementById('vrcxFileName').textContent = p.path || 'VRCX.sqlite3';
    renderVrcxPreviewRows(p);
    document.getElementById('vrcxProgressWrap').style.display = 'none';
    document.getElementById('vrcxSuccessCard').style.display = 'none';
    document.getElementById('vrcxImportError').style.display = 'none';
    document.getElementById('vrcxActionBtns').style.display = 'flex';
    document.getElementById('vrcxDoneBtn').style.display = 'none';
    const start = document.getElementById('vrcxStartBtn');
    start.disabled = false;
    start.innerHTML = vrcxStartBtnHtml(false);
    document.getElementById('vrcxPreviewBox').style.display = '';
}

function vrcxStartImport() {
    _vrcxLastDone = null;
    _vrcxLastError = null;
    _vrcxLastProgress = { percent: 5, status: 'Reading database...' };
    document.getElementById('vrcxActionBtns').style.display = 'none';
    document.getElementById('vrcxImportError').style.display = 'none';
    _vrcxSetProgress(5, 'Reading database...');
    document.getElementById('vrcxProgressWrap').style.display = '';
    sendToCS({ action: 'importVrcxStart' });
}

function _vrcxSetProgress(pct, label) {
    document.getElementById('vrcxProgressBar').style.width = pct + '%';
    const progressLabel = document.getElementById('vrcxProgressLabel');
    progressLabel.dataset.rawLabel = label || '';
    progressLabel.textContent = translateVrcxStatus(label || '');
}

function vrcxShowProgress(p) {
    _vrcxLastProgress = p;
    _vrcxSetProgress(p.percent ?? 0, p.status ?? '');
}

function vrcxShowDone(p) {
    _vrcxLastDone = p;
    _vrcxLastError = null;
    _vrcxLastProgress = { percent: 100, status: 'Done' };
    _vrcxSetProgress(100, 'Done');
    setTimeout(() => {
        document.getElementById('vrcxProgressWrap').style.display = 'none';
        document.getElementById('vrcxSuccessDetail').innerHTML =
            `${(p.worlds ?? 0).toLocaleString()} worlds &nbsp;Â·&nbsp; ` +
            `${(p.friends ?? 0).toLocaleString()} friends &nbsp;Â·&nbsp; ` +
            `${(p.timelineJoins ?? 0).toLocaleString()} joins &nbsp;Â·&nbsp; ` +
            `${(p.friendEvents ?? 0).toLocaleString()} friend events &nbsp;Â·&nbsp; ` +
            `${(p.meetEvents ?? 0).toLocaleString()} meets`;
        renderVrcxSuccessDetail(p);
        document.getElementById('vrcxSuccessCard').style.display = '';
        document.getElementById('vrcxDoneBtn').style.display = '';
    }, 400);
}

function vrcxShowError(err) {
    _vrcxLastDone = null;
    _vrcxLastError = err || '';
    _vrcxLastProgress = null;
    document.getElementById('vrcxProgressWrap').style.display = 'none';
    renderVrcxError(err);
    document.getElementById('vrcxImportError').style.display = '';
    document.getElementById('vrcxActionBtns').style.display = 'flex';
    const start = document.getElementById('vrcxStartBtn');
    start.disabled = false;
    start.innerHTML = vrcxStartBtnHtml(true);
}

// === Design Tabs ===

function switchDesignTab(tab, btn) {
    document.getElementById('designTabBackground').style.display = tab === 'background' ? '' : 'none';
    document.getElementById('designTabColors').style.display    = tab === 'colors'     ? '' : 'none';
    document.getElementById('designTabOther').style.display     = tab === 'other'      ? '' : 'none';
    document.getElementById('designTabThemes').style.display    = tab === 'themes'     ? '' : 'none';
    btn.closest('.fd-tabs').querySelectorAll('.fd-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
}

// === Avtrdb Community Support ===

function switchAvtrdbTab(tab, btn) {
    document.getElementById('avtrdbTabSupport').style.display = tab === 'support' ? '' : 'none';
    document.getElementById('avtrdbTabReports').style.display = tab === 'reports' ? '' : 'none';
    btn.closest('.fd-tabs').querySelectorAll('.fd-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
}

const _avtrdbReports = [];
let _avtrdbCollecting = 0;
let _avtrdbCollectTimer = null;
let _avtrdbCollectEnd = 0;

function avtrdbCollecting(count) {
    _avtrdbCollecting += count;
    // Reset 60s countdown on each new batch
    _avtrdbCollectEnd = Date.now() + 60000;
    if (!_avtrdbCollectTimer) {
        _avtrdbCollectTimer = setInterval(() => {
            renderAvtrdbReports();
            if (Date.now() >= _avtrdbCollectEnd) {
                clearInterval(_avtrdbCollectTimer);
                _avtrdbCollectTimer = null;
            }
        }, 1000);
    }
    renderAvtrdbReports();
}

function addAvtrdbReport(count, enqueued, invalid, ticket, type, db) {
    _avtrdbReports.push({ ts: Date.now(), count, enqueued, invalid, ticket, type: type || 'deletion', db: db || 'avtrdb' });
    // Clear collecting state
    _avtrdbCollecting = 0;
    _avtrdbCollectEnd = 0;
    if (_avtrdbCollectTimer) { clearInterval(_avtrdbCollectTimer); _avtrdbCollectTimer = null; }
    renderAvtrdbReports();
}

function renderAvtrdbReports() {
    const el = document.getElementById('avtrdbReportsList');
    if (!el) return;

    let html = '';

    // Show collecting banner if active
    if (_avtrdbCollecting > 0 && _avtrdbCollectEnd > Date.now()) {
        const secsLeft = Math.max(0, Math.ceil((_avtrdbCollectEnd - Date.now()) / 1000));
        html += `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(var(--accent-rgb,100,140,255),.12);border:1px solid rgba(var(--accent-rgb,100,140,255),.25);border-radius:8px;margin-bottom:10px;">
            <span class="msi" style="font-size:18px;color:var(--accent);">hourglass_top</span>
            <div style="flex:1;">
                <div style="font-size:12px;font-weight:600;color:var(--tx1);">${t('settings.avtrdb.reports.collecting_title', 'Collecting Data')}</div>
                <div style="font-size:11px;color:var(--tx3);margin-top:2px;">${tf('settings.avtrdb.reports.collecting_desc', { count: _avtrdbCollecting, seconds: secsLeft }, `${_avtrdbCollecting} deleted avatar(s) queued, sending in ${secsLeft}s`)}</div>
            </div>
        </div>`;
    }

    if (!_avtrdbReports.length && !html) {
        el.innerHTML = `<div class="empty-msg">${t('settings.avtrdb.reports.empty', 'No reports sent yet this session.')}</div>`;
        return;
    }

    html += _avtrdbReports.slice().reverse().map(r => {
        const isDeletion = r.type === 'deletion';
        const typeLabel = isDeletion
            ? t('settings.avtrdb.reports.type.deletion', 'Mark for deletion')
            : t('settings.avtrdb.reports.type.submitted', 'Submitted Avatar');
        const typeColor = isDeletion ? 'var(--err)' : 'var(--ok)';
        const typeIcon = isDeletion ? 'delete' : 'upload';
        const time = fmtTimeSeconds(new Date(r.ts || Date.now()));
        const summaryParts = [tf('settings.avtrdb.reports.enqueued', { count: r.enqueued }, `${r.enqueued} enqueued`)];
        if (r.invalid > 0) {
            summaryParts.push(tf('settings.avtrdb.reports.invalid', { count: r.invalid }, `${r.invalid} invalid`));
        }
        const isIcu = r.db === 'avtricu';
        const dbBadge = isIcu
            ? `<span class="vrcn-badge db-avtricu" style="font-size:10px;flex-shrink:0;">Avtr.icu</span>`
            : `<span class="vrcn-badge db-avtrdb" style="font-size:10px;flex-shrink:0;">Avtrdb</span>`;
        const ticketBtn = (!isIcu && r.ticket)
            ? `<button class="vrcn-button-round" style="font-size:11px;padding:4px 10px;" onclick="sendToCS({action:'openUrl',url:'https://avtrdb.com/check_ticket_status/${esc(r.ticket)}'})">
            <span class="msi" style="font-size:13px;">open_in_new</span> ${t('settings.avtrdb.reports.ticket', 'Ticket')}
        </button>`
            : '';
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg-input);border-radius:8px;margin-bottom:6px;">
        <span style="font-size:11px;color:var(--tx3);white-space:nowrap;">${esc(time)}</span>
        ${dbBadge}
        <span class="vrcn-badge" style="font-size:10px;color:${typeColor};flex-shrink:0;"><span class="msi" style="font-size:10px;">${typeIcon}</span> ${esc(typeLabel)}</span>
        <span style="font-size:12px;color:var(--tx1);flex:1;">${esc(summaryParts.join(', '))}</span>
        ${ticketBtn}
    </div>`;
    }).join('');

    el.innerHTML = html;
}

function rerenderSettingsTranslations() {
    renderFileList();
    renderAvtrdbReports();

    const selectBtn = document.getElementById('vrcxSelectBtn');
    if (selectBtn && selectBtn.style.display !== 'none') {
        selectBtn.innerHTML = vrcxSelectBtnHtml(selectBtn.disabled);
    }

    const startBtn = document.getElementById('vrcxStartBtn');
    const actionBtns = document.getElementById('vrcxActionBtns');
    if (startBtn && actionBtns && actionBtns.style.display !== 'none') {
        startBtn.innerHTML = vrcxStartBtnHtml(!!_vrcxLastError);
    }

    if (_vrcxPreviewData && document.getElementById('vrcxPreviewBox')?.style.display !== 'none') {
        renderVrcxPreviewRows(_vrcxPreviewData);
    }

    if (_vrcxLastProgress && document.getElementById('vrcxProgressWrap')?.style.display !== 'none') {
        _vrcxSetProgress(_vrcxLastProgress.percent ?? 0, _vrcxLastProgress.status ?? '');
    }

    if (_vrcxLastDone && document.getElementById('vrcxSuccessCard')?.style.display !== 'none') {
        renderVrcxSuccessDetail(_vrcxLastDone);
    }

    if (document.getElementById('vrcxImportError')?.style.display !== 'none') {
        renderVrcxError(_vrcxLastError);
    }
}

document.documentElement.addEventListener('languagechange', rerenderSettingsTranslations);

// === Database Optimization ===

function dbRunAnalysis() {
    const btn = document.getElementById('btnDbAnalyze');
    const optBtn = document.getElementById('btnDbOptimize');
    if (btn) btn.disabled = true;
    if (optBtn) { optBtn.style.display = 'none'; optBtn.disabled = false; }
    document.getElementById('dbAnalysisResults').style.display = 'none';
    const wrap = document.getElementById('dbOptProgressWrap');
    const bar  = document.getElementById('dbOptProgressBar');
    const lbl  = document.getElementById('dbOptProgressLabel');
    if (wrap) wrap.style.display = '';
    if (bar)  bar.style.width = '30%';
    if (lbl)  lbl.textContent = 'Analyzing…';
    sendToCS({ action: 'dbAnalyze' });
}

function dbRunOptimize() {
    const btn = document.getElementById('btnDbOptimize');
    if (btn) btn.disabled = true;
    document.getElementById('btnDbAnalyze').disabled = true;
    document.getElementById('dbAnalysisResults').style.display = 'none';
    const wrap = document.getElementById('dbOptProgressWrap');
    const bar  = document.getElementById('dbOptProgressBar');
    const lbl  = document.getElementById('dbOptProgressLabel');
    if (wrap) wrap.style.display = '';
    if (bar)  bar.style.width = '10%';
    if (lbl)  lbl.textContent = 'Clearing cache data…';
    sendToCS({ action: 'dbOptimize' });
}

function handleDbAnalyzeProgress() {
    const bar = document.getElementById('dbOptProgressBar');
    const lbl = document.getElementById('dbOptProgressLabel');
    if (bar) bar.style.width = '60%';
    if (lbl) lbl.textContent = 'Analyzing…';
}

function handleDbAnalyzeResult(data) {
    const wrap = document.getElementById('dbOptProgressWrap');
    const bar  = document.getElementById('dbOptProgressBar');
    const lbl  = document.getElementById('dbOptProgressLabel');
    const btn  = document.getElementById('btnDbAnalyze');
    const res  = document.getElementById('dbAnalysisResults');

    if (bar) bar.style.width = '100%';

    if (data.error) {
        if (lbl) lbl.textContent = 'Error: ' + data.error;
        if (btn) btn.disabled = false;
        return;
    }

    setTimeout(() => {
        if (wrap) wrap.style.display = 'none';
        if (bar)  bar.style.width = '0%';
        if (btn)  btn.disabled = false;

        // Summary row
        const total    = (data.totalRows     || 0).toLocaleString(settingsUiLocale());
        const friends  = (data.friendRows    || 0).toLocaleString(settingsUiLocale());
        const clean    = (data.cleanableRows || 0).toLocaleString(settingsUiLocale());

        const counts = data.counts || [];
        const gridItems = counts.map(c =>
            `<div style="background:var(--bg-input);border-radius:8px;padding:8px 10px;min-width:0;">
                <div style="font-size:10px;color:var(--tx3);margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(c.label)}</div>
                <div style="font-size:14px;font-weight:700;color:var(--tx0);">${(c.count||0).toLocaleString(settingsUiLocale())}</div>
            </div>`
        ).join('');

        const fOnline   = (data.friendOnlineCount    || 0).toLocaleString(settingsUiLocale());
        const fOffline  = (data.friendOfflineCount   || 0).toLocaleString(settingsUiLocale());
        const fStatus   = (data.friendStatusCount    || 0).toLocaleString(settingsUiLocale());
        const fTotal    = ((data.friendOnlineCount || 0) + (data.friendOfflineCount || 0) + (data.friendStatusCount || 0)).toLocaleString(settingsUiLocale());
        const eNotif    = (data.notificationCount    || 0).toLocaleString(settingsUiLocale());
        const eVideo    = (data.videoUrlCount        || 0).toLocaleString(settingsUiLocale());
        const epPlayers = (data.instancePlayersCount || 0).toLocaleString(settingsUiLocale());

        res.innerHTML =
            `<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
                <div style="background:var(--bg-input);border-radius:8px;padding:8px 12px;flex:1;min-width:120px;">
                    <div style="font-size:10px;color:var(--tx3);margin-bottom:2px;">Total Users</div>
                    <div style="font-size:15px;font-weight:700;color:var(--tx0);">${total}</div>
                </div>
                <div style="background:var(--bg-input);border-radius:8px;padding:8px 12px;flex:1;min-width:120px;">
                    <div style="font-size:10px;color:var(--tx3);margin-bottom:2px;">Friends (skipped)</div>
                    <div style="font-size:15px;font-weight:700;color:var(--tx0);">${friends}</div>
                </div>
                <div style="background:var(--bg-input);border-radius:8px;padding:8px 12px;flex:1;min-width:120px;">
                    <div style="font-size:10px;color:var(--tx3);margin-bottom:2px;">Cleanable Rows</div>
                    <div style="font-size:15px;font-weight:700;color:var(--accent);">${clean}</div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:12px;">
                ${gridItems}
            </div>
            <div style="font-size:11px;font-weight:600;color:var(--tx3);margin-bottom:6px;margin-top:4px;text-transform:uppercase;letter-spacing:.05em;">events</div>
            <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:12px;">
                <div style="background:var(--bg-input);border-radius:8px;padding:8px 10px;min-width:0;">
                    <div style="font-size:10px;color:var(--tx3);margin-bottom:2px;">Notifications</div>
                    <div style="font-size:14px;font-weight:700;color:var(--tx0);">${eNotif}</div>
                </div>
                <div style="background:var(--bg-input);border-radius:8px;padding:8px 10px;min-width:0;">
                    <div style="font-size:10px;color:var(--tx3);margin-bottom:2px;">Video URL</div>
                    <div style="font-size:14px;font-weight:700;color:var(--tx0);">${eVideo}</div>
                </div>
            </div>
            <div style="font-size:11px;font-weight:600;color:var(--tx3);margin-bottom:6px;margin-top:4px;text-transform:uppercase;letter-spacing:.05em;">friend_events</div>
            <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:12px;">
                <div style="background:var(--bg-input);border-radius:8px;padding:8px 10px;min-width:0;">
                    <div style="font-size:10px;color:var(--tx3);margin-bottom:2px;">Friend Online</div>
                    <div style="font-size:14px;font-weight:700;color:var(--tx0);">${fOnline}</div>
                </div>
                <div style="background:var(--bg-input);border-radius:8px;padding:8px 10px;min-width:0;">
                    <div style="font-size:10px;color:var(--tx3);margin-bottom:2px;">Friend Offline</div>
                    <div style="font-size:14px;font-weight:700;color:var(--tx0);">${fOffline}</div>
                </div>
                <div style="background:var(--bg-input);border-radius:8px;padding:8px 10px;min-width:0;">
                    <div style="font-size:10px;color:var(--tx3);margin-bottom:2px;">Friend Status</div>
                    <div style="font-size:14px;font-weight:700;color:var(--tx0);">${fStatus}</div>
                </div>
                <div style="background:var(--bg-input);border-radius:8px;padding:8px 10px;min-width:0;grid-column:span 3;">
                    <div style="font-size:10px;color:var(--tx3);margin-bottom:2px;">Total Deletable Rows</div>
                    <div style="font-size:14px;font-weight:700;color:var(--accent);">${fTotal}</div>
                </div>
            </div>
            <div style="font-size:11px;font-weight:600;color:var(--tx3);margin-bottom:6px;margin-top:4px;text-transform:uppercase;letter-spacing:.05em;">event_players</div>
            <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:12px;">
                <div style="background:var(--bg-input);border-radius:8px;padding:8px 10px;min-width:0;">
                    <div style="font-size:10px;color:var(--tx3);margin-bottom:2px;">Instance Players</div>
                    <div style="font-size:14px;font-weight:700;color:var(--tx0);">${epPlayers}</div>
                </div>
                <div style="background:var(--bg-input);border-radius:8px;padding:8px 10px;min-width:0;grid-column:span 5;">
                    <div style="font-size:10px;color:var(--tx3);margin-bottom:2px;">Total Deletable Rows</div>
                    <div style="font-size:14px;font-weight:700;color:var(--accent);">${epPlayers}</div>
                </div>
            </div>`;

        res.style.display = '';

        const optBtn = document.getElementById('btnDbOptimize');
        if (optBtn) optBtn.style.display = '';
    }, 300);
}

function handleDbOptimizeProgress(data) {
    const bar = document.getElementById('dbOptProgressBar');
    const lbl = document.getElementById('dbOptProgressLabel');
    if (data.phase === 'optimize') {
        if (bar) bar.style.width = '40%';
        if (lbl) lbl.textContent = 'Clearing cache data…';
    } else if (data.phase === 'vacuum') {
        if (bar) bar.style.width = '75%';
        if (lbl) lbl.textContent = 'Running VACUUM…';
    }
}

function handleDbOptimizeDone(data) {
    const wrap = document.getElementById('dbOptProgressWrap');
    const bar  = document.getElementById('dbOptProgressBar');
    const lbl  = document.getElementById('dbOptProgressLabel');
    const btn  = document.getElementById('btnDbAnalyze');
    const optBtn = document.getElementById('btnDbOptimize');
    const res  = document.getElementById('dbAnalysisResults');

    if (bar) bar.style.width = '100%';

    setTimeout(() => {
        if (wrap)   wrap.style.display = 'none';
        if (bar)    bar.style.width = '0%';
        if (btn)    btn.disabled = false;
        if (optBtn) { optBtn.style.display = 'none'; optBtn.disabled = false; }

        if (data.error) {
            if (res) { res.innerHTML = `<div style="color:var(--err);font-size:12px;">Error: ${esc(data.error)}</div>`; res.style.display = ''; }
            return;
        }

        const userCleaned  = (data.userCleaned  || 0).toLocaleString(settingsUiLocale());
        const feCleaned    = (data.feCleaned    || 0).toLocaleString(settingsUiLocale());
        const notifCleaned = (data.notifCleaned || 0).toLocaleString(settingsUiLocale());
        const epCleaned    = (data.epCleaned    || 0).toLocaleString(settingsUiLocale());
        if (res) {
            res.innerHTML =
                `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(var(--ok-rgb,80,200,120),.12);border:1px solid rgba(var(--ok-rgb,80,200,120),.30);border-radius:8px;">
                    <span class="msi" style="font-size:20px;color:var(--ok);">check_circle</span>
                    <div>
                        <div style="font-size:13px;font-weight:600;color:var(--tx1);">Optimization complete</div>
                        <div style="font-size:11px;color:var(--tx3);margin-top:2px;">${userCleaned} user cache rows cleared &nbsp;·&nbsp; ${feCleaned} friend events deleted &nbsp;·&nbsp; ${notifCleaned} notifications deleted &nbsp;·&nbsp; ${epCleaned} instance player rows deleted &nbsp;·&nbsp; VACUUM done</div>
                    </div>
                </div>`;
            res.style.display = '';
        }
    }, 300);
}

function dbCreateBackup() {
    const btn = document.getElementById('btnDbBackup');
    if (btn) { btn.disabled = true; btn.textContent = 'Creating backup…'; }
    sendToCS({ action: 'dbBackup' });
}

function manualDbBackup() {
    const btn = document.getElementById('btnManualDbBackup');
    if (btn) btn.disabled = true;
    sendToCS({ action: 'dbBackup' });
}

function manualRegBackup() {
    const btn = document.getElementById('btnManualRegBackup');
    if (btn) btn.disabled = true;
    sendToCS({ action: 'regBackup' });
}

function _showBackupResult(containerId, label, data) {
    const res = document.getElementById(containerId);
    if (!res) return;
    if (data.error) {
        res.innerHTML = `<div style="color:var(--err);font-size:12px;">${esc(label)} failed: ${esc(data.error)}</div>`;
    } else {
        res.innerHTML =
            `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(var(--ok-rgb,80,200,120),.12);border:1px solid rgba(var(--ok-rgb,80,200,120),.30);border-radius:8px;">
                <span class="msi" style="font-size:20px;color:var(--ok);">check_circle</span>
                <div>
                    <div style="font-size:13px;font-weight:600;color:var(--tx1);">${esc(label)}</div>
                    <div style="font-size:11px;color:var(--tx3);margin-top:2px;font-family:monospace;">${esc(data.path ?? '')}</div>
                </div>
            </div>`;
    }
    res.style.display = '';
}

function handleRegBackupDone(data) {
    const btn = document.getElementById('btnManualRegBackup');
    if (btn) btn.disabled = false;
    _showBackupResult('manualBackupResult', 'Registry backup created', data);
}

function handleDbBackupDone(data) {
    const btn = document.getElementById('btnDbBackup');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span class="msi" style="font-size:16px;">backup</span> Create Backup';
    }
    const btn2 = document.getElementById('btnManualDbBackup');
    if (btn2) btn2.disabled = false;

    // DB Optimization card result — replace any existing backup result (max 1)
    const res = document.getElementById('dbAnalysisResults');
    if (res) {
        res.querySelectorAll('[data-backup-result]').forEach(el => el.remove());
        const el = document.createElement('div');
        el.dataset.backupResult = '1';
        if (data.error) {
            el.style.cssText = 'color:var(--err);font-size:12px;margin-top:8px;';
            el.textContent = 'Backup failed: ' + data.error;
        } else {
            el.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(var(--ok-rgb,80,200,120),.12);border:1px solid rgba(var(--ok-rgb,80,200,120),.30);border-radius:8px;margin-top:8px;';
            el.innerHTML =
                `<span class="msi" style="font-size:20px;color:var(--ok);">check_circle</span>
                <div>
                    <div style="font-size:13px;font-weight:600;color:var(--tx1);">Backup created</div>
                    <div style="font-size:11px;color:var(--tx3);margin-top:2px;font-family:monospace;">${esc(data.path)}</div>
                </div>`;
        }
        res.prepend(el);
        res.style.display = '';
    }

    // Auto-Backups card result
    _showBackupResult('manualBackupResult', 'Database backup created', data);
}
