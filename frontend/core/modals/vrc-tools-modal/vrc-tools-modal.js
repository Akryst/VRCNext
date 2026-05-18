var _vrcCfgRaw = {};

function openVrcConfigModal() {
    document.getElementById('modalVrcConfig').style.display = 'flex';
    document.getElementById('vrcCfgCacheSize').textContent = '...';
    document.getElementById('vrcCfgMaxCacheSize').value = '';
    document.getElementById('vrcCfgCacheExpiry').value = '';
    document.getElementById('vrcCfgSteadycamFov').value = '';
    sendToCS({ action: 'vrcConfigGet' });
}

function openVrcLaunchOptionsModal() {
    document.getElementById('modalVrcLaunchOptions').style.display = 'flex';
    document.getElementById('vrcLaArgs').value = '';
    document.getElementById('vrcLaPath').value = '';
    sendToCS({ action: 'vrcLaunchOptionsGet' });
}

function _vrcCfgFormatBytes(b) {
    var n = Number(b) || 0;
    if (n <= 0) return '0 GB';
    return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

function _vrcCfgApplyData(payload) {
    if (payload.config && typeof payload.config === 'object') {
        _vrcCfgRaw = payload.config || {};
        document.getElementById('vrcCfgMaxCacheSize').value = _vrcCfgRaw.cache_size != null ? _vrcCfgRaw.cache_size : '';
        document.getElementById('vrcCfgCacheExpiry').value = _vrcCfgRaw.cache_expiry_delay != null ? _vrcCfgRaw.cache_expiry_delay : '';
        document.getElementById('vrcCfgSteadycamFov').value = _vrcCfgRaw.fpv_steadycam_fov != null ? _vrcCfgRaw.fpv_steadycam_fov : '';
    }
    if (payload.cacheBytes != null) {
        document.getElementById('vrcCfgCacheSize').textContent = _vrcCfgFormatBytes(payload.cacheBytes);
    }
}

function vrcCfgRefreshCache() {
    document.getElementById('vrcCfgCacheSize').textContent = '...';
    sendToCS({ action: 'vrcCacheRefresh' });
}

function vrcCfgDeleteCache() {
    if (!confirm(t('vrc_config.confirm_delete', 'Delete the entire VRChat asset cache?'))) return;
    document.getElementById('vrcCfgCacheSize').textContent = '...';
    sendToCS({ action: 'vrcCacheDeleteAll' });
}

function vrcCfgSweepCache() {
    document.getElementById('vrcCfgCacheSize').textContent = '...';
    sendToCS({ action: 'vrcCacheSweep' });
}

function _vrcCfgParseNum(v) {
    if (v == null || v === '') return null;
    var n = parseInt(v, 10);
    return isNaN(n) ? null : n;
}

function vrcCfgSave() {
    var merged = Object.assign({}, _vrcCfgRaw);
    var max = _vrcCfgParseNum(document.getElementById('vrcCfgMaxCacheSize').value);
    var exp = _vrcCfgParseNum(document.getElementById('vrcCfgCacheExpiry').value);
    var fov = _vrcCfgParseNum(document.getElementById('vrcCfgSteadycamFov').value);
    if (max != null) merged.cache_size = max; else delete merged.cache_size;
    if (exp != null) merged.cache_expiry_delay = exp; else delete merged.cache_expiry_delay;
    if (fov != null) merged.fpv_steadycam_fov = fov; else delete merged.fpv_steadycam_fov;
    sendToCS({ action: 'vrcConfigSave', config: merged });
    document.getElementById('modalVrcConfig').style.display = 'none';
}

function _vrcLaApplyData(payload) {
    document.getElementById('vrcLaArgs').value = payload.args || '';
    document.getElementById('vrcLaPath').value = payload.path || '';
}

function vrcLaSave() {
    var args = document.getElementById('vrcLaArgs').value || '';
    var path = document.getElementById('vrcLaPath').value || '';
    sendToCS({ action: 'vrcLaunchOptionsSave', args: args, path: path });
    document.getElementById('modalVrcLaunchOptions').style.display = 'none';
}

