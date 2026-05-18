(function () {
'use strict';

const BLOCKLY_CDN     = 'https://unpkg.com/blockly@10.4.3/blockly.min.js';
const TICK_INTERVAL_MS = 30 * 1000;
const LOG_MAX_ENTRIES  = 60;
const AUTOSAVE_DEBOUNCE_MS = 600;

const COLOR_LOGIC   = '#7784ed';
const COLOR_TIME    = '#7dd1ff';
const COLOR_PARAM   = '#cb71ff';
const COLOR_ACTION  = '#937dff';
const COLOR_TRIGGER = '#c27dff'; 

const WORLD_CHANGE_DELAY_MS = 15 * 1000;
const EVENT_TICK_MS = 5 * 1000;
const FLOW_ACTION_LIMIT = 10;
const FLOW_LIMIT = 4;
const TRIGGER_LIMIT = 16;
const ACTION_TYPES = new Set([
    'af_set_status',
    'af_set_bio_text',
    'af_invite_friend',
    'af_request_invite',
    'af_answer_invite',
    'af_answer_invite_request',
    'af_send_notification',
]);

const STATUS_DROPDOWN = [
    ['Online',         'active'],
    ['Ask Me',         'ask me'],
    ['Do Not Disturb', 'busy'],
    ['Join Me',        'join me'],
];

const VRC_STATUS_LABELS = { active: 'Online', 'ask me': 'Ask Me', busy: 'Do Not Disturb', 'join me': 'Join Me' };

let afFlows           = [];
let afCurrentFlowId   = null;
let afWorkspace       = null;
let afBlocklyLoading  = false;
let afBlocklyLoaded   = false;
let afTickTimer       = null;
let afLogEntries      = [];
let afTabInitialized  = false;
let afAutoSaveTimer   = null;
let afAutoSaveSuppressed = false;

let afTriggerState = {};
let afWatchState = {
    lastInstanceUserIds: null,
    lastStatus:          null,
};
let afContext = { triggeringUser: null, triggerKind: null };

function afEnsureBlockly() {
    if (afBlocklyLoaded) return Promise.resolve();
    if (afBlocklyLoading) return afBlocklyLoading;
    afBlocklyLoading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src    = BLOCKLY_CDN;
        s.async  = true;
        s.onload = () => { afBlocklyLoaded = true; resolve(); };
        s.onerror = () => reject(new Error('Failed to load Blockly from CDN'));
        document.head.appendChild(s);
    });
    return afBlocklyLoading;
}

function afDefineBlocks() {
    const B = window.Blockly;

    const friendDropdown = () => {
        try {
            if (typeof vrcFriendsData !== 'undefined' && Array.isArray(vrcFriendsData) && vrcFriendsData.length) {
                return vrcFriendsData
                    .slice()
                    .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
                    .map(f => [f.displayName || f.id, f.id]);
            }
        } catch {}
        return [['(no friends loaded)', '']];
    };

    function makeTriggerHat(typeName, labelFn) {
        B.Blocks[typeName] = { init() {
            labelFn(this);
            this.appendStatementInput('DO').appendField('do');
            this.setColour(COLOR_TRIGGER);
            this.hat = 'cap';
        } };
    }

    function makeUserPresenceTriggerHat(typeName, headLabel) {
        B.Blocks[typeName] = {
            init() {
                this.appendDummyInput('HEADER')
                    .appendField(headLabel)
                    .appendField(new B.FieldCheckbox('FALSE', this._onFilterChange.bind(this)), 'FILTER')
                    .appendField('only specific user');
                this.appendStatementInput('DO').appendField('do');
                this.setColour(COLOR_TRIGGER);
                this.hat = 'cap';
            },
            _onFilterChange(newVal) {
                const enabled = (newVal === 'TRUE' || newVal === true);
                setTimeout(() => this._setFilterInput(enabled), 0);
                return newVal;
            },
            _setFilterInput(enabled) {
                if (enabled && !this.getInput('USERID_INPUT')) {
                    this.appendDummyInput('USERID_INPUT')
                        .appendField('user id')
                        .appendField(new B.FieldTextInput(''), 'USER_ID');
                    this.moveInputBefore('USERID_INPUT', 'DO');
                } else if (!enabled && this.getInput('USERID_INPUT')) {
                    this.removeInput('USERID_INPUT');
                }
            },
            saveExtraState() {
                return { filterEnabled: this.getFieldValue('FILTER') === 'TRUE' };
            },
            loadExtraState(state) {
                this._setFilterInput(!!(state && state.filterEnabled));
            },
        };
    }

    makeTriggerHat('af_trigger_interval_30s',         b => b.appendDummyInput().appendField('every 30 seconds'));
    makeTriggerHat('af_trigger_interval_minutes',     b => b.appendDummyInput().appendField('every').appendField(new B.FieldNumber(5, 1, 1440, 1), 'MIN').appendField('minutes'));
    makeTriggerHat('af_trigger_world_change',         b => b.appendDummyInput().appendField('when I switch world (15s delay)'));
    makeUserPresenceTriggerHat('af_trigger_user_joins',           'when someone joins my instance');
    makeUserPresenceTriggerHat('af_trigger_user_leaves',          'when someone leaves my instance');
    makeUserPresenceTriggerHat('af_trigger_user_joins_or_leaves', 'when someone joins or leaves my instance');
    makeTriggerHat('af_trigger_own_status_change',    b => b.appendDummyInput().appendField('when my status changes'));
    makeTriggerHat('af_trigger_websocket_any',        b => b.appendDummyInput().appendField('on any websocket event'));
    makeTriggerHat('af_trigger_websocket_friend',     b => b.appendDummyInput().appendField('on websocket event for friend').appendField(new B.FieldDropdown(friendDropdown), 'FRIEND_ID'));
    makeTriggerHat('af_trigger_manual',               b => b.appendDummyInput().appendField('manual only (Run Now)'));
    makeTriggerHat('af_trigger_time',                 b => b.appendDummyInput().appendField('at')
        .appendField(new B.FieldNumber(12, 0, 23, 1), 'HH').appendField(':')
        .appendField(new B.FieldNumber(0, 0, 59, 1), 'MM')
        .appendField(new B.FieldDropdown([['24h','24'],['AM','AM'],['PM','PM']]), 'AMPM'));
    makeTriggerHat('af_trigger_invite_received',         b => b.appendDummyInput().appendField('when someone invites me'));
    makeTriggerHat('af_trigger_invite_request_received', b => b.appendDummyInput().appendField('when someone requests an invite from me'));

    B.Blocks['af_triggering_user'] = { init() {
        this.appendDummyInput().appendField('triggering user');
        this.setOutput(true, 'User');
        this.setColour(COLOR_TRIGGER);
        this.setTooltip('The user that caused the current trigger to fire.');
    } };

    B.Blocks['af_if'] = { init() {
        this.appendValueInput('IF0').setCheck('Boolean').appendField('if');
        this.appendStatementInput('DO0').appendField('do');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COLOR_LOGIC);
        this.setTooltip('If the condition is true, run the do branch.');
    } };

    B.Blocks['af_if_else'] = { init() {
        this.appendValueInput('IF0').setCheck('Boolean').appendField('if');
        this.appendStatementInput('DO0').appendField('do');
        this.appendStatementInput('ELSE').appendField('else');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COLOR_LOGIC);
    } };

    B.Blocks['af_compare'] = { init() {
        this.appendValueInput('A').setCheck(null);
        this.appendDummyInput().appendField(new B.FieldDropdown([['=','EQ'],['>','GT'],['<','LT']]), 'OP');
        this.appendValueInput('B').setCheck(null);
        this.setOutput(true, 'Boolean');
        this.setInputsInline(true);
        this.setColour(COLOR_LOGIC);
    } };

    B.Blocks['af_and'] = { init() {
        this.appendValueInput('A').setCheck('Boolean');
        this.appendDummyInput().appendField('and');
        this.appendValueInput('B').setCheck('Boolean');
        this.setOutput(true, 'Boolean');
        this.setInputsInline(true);
        this.setColour(COLOR_LOGIC);
    } };

    B.Blocks['af_or'] = { init() {
        this.appendValueInput('A').setCheck('Boolean');
        this.appendDummyInput().appendField('or');
        this.appendValueInput('B').setCheck('Boolean');
        this.setOutput(true, 'Boolean');
        this.setInputsInline(true);
        this.setColour(COLOR_LOGIC);
    } };

    B.Blocks['af_bool'] = { init() {
        this.appendDummyInput().appendField(new B.FieldDropdown([['true','TRUE'],['false','FALSE']]), 'BOOL');
        this.setOutput(true, 'Boolean');
        this.setColour(COLOR_LOGIC);
    } };

    B.Blocks['af_is_date'] = { init() {
        this.appendDummyInput()
            .appendField('is date')
            .appendField(new B.FieldNumber(1, 1, 31, 1), 'DD').appendField('/')
            .appendField(new B.FieldNumber(1, 1, 12, 1), 'MM').appendField('/')
            .appendField(new B.FieldNumber(new Date().getFullYear(), 2000, 2100, 1), 'YYYY');
        this.setOutput(true, 'Boolean');
        this.setColour(COLOR_TIME);
    } };

    B.Blocks['af_is_time'] = { init() {
        this.appendDummyInput()
            .appendField('is time')
            .appendField(new B.FieldNumber(12, 0, 23, 1), 'HH').appendField(':')
            .appendField(new B.FieldNumber(0, 0, 59, 1), 'MM')
            .appendField(new B.FieldDropdown([['24h','24'],['AM','AM'],['PM','PM']]), 'AMPM');
        this.setOutput(true, 'Boolean');
        this.setColour(COLOR_TIME);
    } };

    B.Blocks['af_between_time'] = { init() {
        this.appendDummyInput()
            .appendField('between')
            .appendField(new B.FieldNumber(12, 0, 23, 1), 'HH1').appendField(':')
            .appendField(new B.FieldNumber(0, 0, 59, 1), 'MM1')
            .appendField(new B.FieldDropdown([['24h','24'],['AM','AM'],['PM','PM']]), 'AMPM1')
            .appendField('and')
            .appendField(new B.FieldNumber(13, 0, 23, 1), 'HH2').appendField(':')
            .appendField(new B.FieldNumber(0, 0, 59, 1), 'MM2')
            .appendField(new B.FieldDropdown([['24h','24'],['AM','AM'],['PM','PM']]), 'AMPM2');
        this.setOutput(true, 'Boolean');
        this.setColour(COLOR_TIME);
        this.setTooltip('True while the current time is between the two times. Handles ranges that cross midnight.');
    } };

    B.Blocks['af_is_friend'] = { init() {
        this.appendValueInput('USER').setCheck('User').appendField('is friend');
        this.setOutput(true, 'Boolean');
        this.setInputsInline(true);
        this.setColour(COLOR_PARAM);
    } };

    B.Blocks['af_invite_from_friend'] = { init() {
        this.appendDummyInput()
            .appendField('invite from')
            .appendField(new B.FieldDropdown(friendDropdown), 'FRIEND_ID');
        this.setOutput(true, 'Boolean');
        this.setColour(COLOR_PARAM);
        this.setTooltip('True inside a "when someone invites me" trigger if the inviter matches this friend.');
    } };

    B.Blocks['af_invite_request_from_friend'] = { init() {
        this.appendDummyInput()
            .appendField('invite request from')
            .appendField(new B.FieldDropdown(friendDropdown), 'FRIEND_ID');
        this.setOutput(true, 'Boolean');
        this.setColour(COLOR_PARAM);
        this.setTooltip('True inside a "when someone requests an invite from me" trigger if the requester matches this friend.');
    } };

    B.Blocks['af_friend_obj'] = { init() {
        const opts = () => {
            try {
                if (typeof vrcFriendsData !== 'undefined' && Array.isArray(vrcFriendsData) && vrcFriendsData.length) {
                    return vrcFriendsData
                        .slice()
                        .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
                        .map(f => [f.displayName || f.id, f.id]);
                }
            } catch {}
            return [['(no friends loaded)', '']];
        };
        this.appendDummyInput().appendField('friend').appendField(new B.FieldDropdown(opts), 'FRIEND_ID');
        this.setOutput(true, 'User');
        this.setColour(COLOR_PARAM);
    } };

    B.Blocks['af_user_obj'] = { init() {
        this.appendDummyInput().appendField('user').appendField(new B.FieldTextInput('usr_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'), 'USER_ID');
        this.setOutput(true, 'User');
        this.setColour(COLOR_PARAM);
    } };

    B.Blocks['af_own_user'] = { init() {
        this.appendDummyInput().appendField('me');
        this.setOutput(true, 'User');
        this.setColour(COLOR_PARAM);
    } };

    B.Blocks['af_world_obj'] = { init() {
        this.appendDummyInput().appendField('world').appendField(new B.FieldTextInput('wrld_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'), 'WORLD_ID');
        this.setOutput(true, 'World');
        this.setColour(COLOR_PARAM);
    } };

    B.Blocks['af_has_status'] = { init() {
        this.appendValueInput('USER').setCheck('User').appendField('has status');
        this.appendDummyInput().appendField(new B.FieldDropdown(STATUS_DROPDOWN), 'STATUS');
        this.setOutput(true, 'Boolean');
        this.setInputsInline(true);
        this.setColour(COLOR_PARAM);
    } };

    B.Blocks['af_own_status'] = { init() {
        this.appendDummyInput().appendField('own status =').appendField(new B.FieldDropdown(STATUS_DROPDOWN), 'STATUS');
        this.setOutput(true, 'Boolean');
        this.setColour(COLOR_PARAM);
    } };

    B.Blocks['af_has_status_text'] = { init() {
        this.appendValueInput('USER').setCheck('User').appendField('has status text');
        this.appendDummyInput().appendField('"').appendField(new B.FieldTextInput(''), 'TEXT').appendField('"');
        this.setOutput(true, 'Boolean');
        this.setInputsInline(true);
        this.setColour(COLOR_PARAM);
    } };

    B.Blocks['af_own_status_text'] = { init() {
        this.appendDummyInput().appendField('own status text =').appendField('"').appendField(new B.FieldTextInput(''), 'TEXT').appendField('"');
        this.setOutput(true, 'Boolean');
        this.setColour(COLOR_PARAM);
    } };

    B.Blocks['af_has_bio_text'] = { init() {
        this.appendValueInput('USER').setCheck('User').appendField('has bio text');
        this.appendDummyInput().appendField('"').appendField(new B.FieldTextInput(''), 'TEXT').appendField('"');
        this.setOutput(true, 'Boolean');
        this.setInputsInline(true);
        this.setColour(COLOR_PARAM);
    } };

    B.Blocks['af_own_bio_text'] = { init() {
        this.appendDummyInput().appendField('own bio text =').appendField('"').appendField(new B.FieldTextInput(''), 'TEXT').appendField('"');
        this.setOutput(true, 'Boolean');
        this.setColour(COLOR_PARAM);
    } };

    B.Blocks['af_get_current_world'] = { init() {
        this.appendValueInput('USER').setCheck('User').appendField('current world of');
        this.setOutput(true, 'World');
        this.setInputsInline(true);
        this.setColour(COLOR_PARAM);
    } };

    B.Blocks['af_in_same_instance'] = { init() {
        this.appendValueInput('USER').setCheck('User').appendField('is in same instance as me');
        this.setOutput(true, 'Boolean');
        this.setInputsInline(true);
        this.setColour(COLOR_PARAM);
    } };

    B.Blocks['af_set_status'] = { init() {
        this.appendDummyInput()
            .appendField('set status').appendField(new B.FieldDropdown(STATUS_DROPDOWN), 'STATUS')
            .appendField('text').appendField('"').appendField(new B.FieldTextInput(''), 'TEXT').appendField('"');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COLOR_ACTION);
        this.setTooltip('Sets your VRChat status (and status text if non-empty). Empty text keeps the existing status text.');
    } };

    B.Blocks['af_set_bio_text'] = { init() {
        this.appendDummyInput().appendField('set bio text').appendField('"').appendField(new B.FieldTextInput(''), 'TEXT').appendField('"');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COLOR_ACTION);
    } };

    B.Blocks['af_invite_friend'] = { init() {
        this.appendValueInput('USER').setCheck('User').appendField('invite');
        this.appendDummyInput().appendField('to my instance');
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COLOR_ACTION);
    } };

    B.Blocks['af_request_invite'] = { init() {
        this.appendValueInput('USER').setCheck('User').appendField('request invite from');
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COLOR_ACTION);
    } };

    B.Blocks['af_send_notification'] = { init() {
        this.appendDummyInput().appendField('send notification').appendField('"').appendField(new B.FieldTextInput('Hello'), 'TEXT').appendField('"');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COLOR_ACTION);
    } };

    B.Blocks['af_answer_invite'] = { init() {
        this.appendDummyInput().appendField('answer invite').appendField('"').appendField(new B.FieldTextInput('Sorry, can\'t right now!'), 'TEXT').appendField('"');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COLOR_ACTION);
        this.setTooltip('Send a chat message back to the user who invited me. Use inside a "when someone invites me" trigger.');
    } };

    B.Blocks['af_answer_invite_request'] = { init() {
        this.appendDummyInput().appendField('answer invite request').appendField('"').appendField(new B.FieldTextInput('Sorry, no invite right now!'), 'TEXT').appendField('"');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(COLOR_ACTION);
        this.setTooltip('Send a chat message back to the user who requested an invite. Use inside a "when someone requests an invite" trigger.');
    } };
}

function afToolbox() {
    return {
        kind: 'categoryToolbox',
        contents: [
            { kind: 'category', name: 'Triggers', colour: COLOR_TRIGGER, contents: [
                { kind: 'block', type: 'af_trigger_interval_30s' },
                { kind: 'block', type: 'af_trigger_interval_minutes' },
                { kind: 'block', type: 'af_trigger_time' },
                { kind: 'block', type: 'af_trigger_world_change' },
                { kind: 'block', type: 'af_trigger_user_joins' },
                { kind: 'block', type: 'af_trigger_user_leaves' },
                { kind: 'block', type: 'af_trigger_user_joins_or_leaves' },
                { kind: 'block', type: 'af_trigger_own_status_change' },
                { kind: 'block', type: 'af_trigger_websocket_any' },
                { kind: 'block', type: 'af_trigger_websocket_friend' },
                { kind: 'block', type: 'af_trigger_invite_received' },
                { kind: 'block', type: 'af_trigger_invite_request_received' },
                { kind: 'block', type: 'af_trigger_manual' },
                { kind: 'sep' },
                { kind: 'block', type: 'af_triggering_user' },
            ]},
            { kind: 'category', name: 'Logic', colour: COLOR_LOGIC, contents: [
                { kind: 'block', type: 'af_if' },
                { kind: 'block', type: 'af_if_else' },
                { kind: 'block', type: 'af_compare' },
                { kind: 'block', type: 'af_and' },
                { kind: 'block', type: 'af_or' },
                { kind: 'block', type: 'af_bool' },
            ]},
            { kind: 'category', name: 'Time', colour: COLOR_TIME, contents: [
                { kind: 'block', type: 'af_is_date' },
                { kind: 'block', type: 'af_is_time' },
                { kind: 'block', type: 'af_between_time' },
            ]},
            { kind: 'category', name: 'Friends', colour: COLOR_PARAM, contents: [
                { kind: 'block', type: 'af_friend_obj' },
                { kind: 'block', type: 'af_user_obj' },
                { kind: 'block', type: 'af_own_user' },
                { kind: 'block', type: 'af_is_friend' },
                { kind: 'block', type: 'af_invite_from_friend' },
                { kind: 'block', type: 'af_invite_request_from_friend' },
            ]},
            { kind: 'category', name: 'Status & Bio', colour: COLOR_PARAM, contents: [
                { kind: 'block', type: 'af_has_status' },
                { kind: 'block', type: 'af_own_status' },
                { kind: 'block', type: 'af_has_status_text' },
                { kind: 'block', type: 'af_own_status_text' },
                { kind: 'block', type: 'af_has_bio_text' },
                { kind: 'block', type: 'af_own_bio_text' },
            ]},
            { kind: 'category', name: 'World', colour: COLOR_PARAM, contents: [
                { kind: 'block', type: 'af_world_obj' },
                { kind: 'block', type: 'af_get_current_world' },
                { kind: 'block', type: 'af_in_same_instance' },
            ]},
            { kind: 'category', name: 'Actions', colour: COLOR_ACTION, contents: [
                { kind: 'block', type: 'af_set_status' },
                { kind: 'block', type: 'af_set_bio_text' },
                { kind: 'block', type: 'af_invite_friend' },
                { kind: 'block', type: 'af_request_invite' },
                { kind: 'block', type: 'af_answer_invite' },
                { kind: 'block', type: 'af_answer_invite_request' },
                { kind: 'block', type: 'af_send_notification' },
            ]},
        ],
    };
}

async function afInitWorkspace() {
    if (afWorkspace) return;
    await afEnsureBlockly();
    afDefineBlocks();
    const host = document.getElementById('afBlocklyHost');
    if (!host) return;
    const cssVar = (name, fallback) =>
        getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
    afWorkspace = window.Blockly.inject(host, {
        toolbox:   afToolbox(),
        trashcan:  false,
        sounds:    false,
        zoom:      { controls: false, wheel: true, startScale: 0.95, maxScale: 2, minScale: 0.5, scaleSpeed: 1.1 },
        move:      { scrollbars: true, drag: true, wheel: false },
        grid:      { spacing: 24, length: 3, colour: cssVar('--brd', '#3a3f4a'), snap: true },
        renderer:  'zelos',
        theme: window.Blockly.Theme.defineTheme('vrcnext', {
            base: window.Blockly.Themes.Classic,
            componentStyles: {
                workspaceBackgroundColour: cssVar('--bg-input', '#1f2330'),
                toolboxBackgroundColour:   cssVar('--bg-card',  '#2a2e3a'),
                flyoutBackgroundColour:    cssVar('--bg-card',  '#2a2e3a'),
                flyoutForegroundColour:    cssVar('--tx0',      '#ffffff'),
                scrollbarColour:           cssVar('--brd',      '#666'),
                insertionMarkerColour:     cssVar('--accent',   '#ffffff'),
                insertionMarkerOpacity:    0.5,
                cursorColour:              cssVar('--accent',   '#ffffff'),
                selectedGlowColour:        '#7dd1ff',
                selectedGlowSize:          0.8,
                replacementGlowColour:     '#7dd1ff',
                replacementGlowSize:       2,
            },
        }),
    });
    afWorkspace.addChangeListener(afOnWorkspaceChange);
    afWorkspace.configureContextMenu = (menuOptions) => { menuOptions.length = 0; };
    // Blockly's native menu is shown directly by BlockSvg.showContextMenu /
    // WorkspaceSvg.showContextMenu (called from its gesture system, not via the
    // contextmenu event). Override both to a no-op so no Blockly menu ever appears.
    const B = window.Blockly;
    if (B.BlockSvg     && !B.BlockSvg.prototype._afCtxKilled)     { B.BlockSvg.prototype.showContextMenu     = function () {}; B.BlockSvg.prototype._afCtxKilled = true; }
    if (B.WorkspaceSvg && !B.WorkspaceSvg.prototype._afCtxKilled) { B.WorkspaceSvg.prototype.showContextMenu = function () {}; B.WorkspaceSvg.prototype._afCtxKilled = true; }
    if (B.ContextMenu  && !B.ContextMenu._afCtxKilled)            { B.ContextMenu.show = function () {};                       B.ContextMenu._afCtxKilled = true; }
    // Capture-phase contextmenu listener: intercept BEFORE the global VRCNext
    // dispatcher in context-menu.js so we can show our own block-specific menu.
    host.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const items = typeof window.afBuildBlockContextMenu === 'function'
            ? window.afBuildBlockContextMenu(e.target) : null;
        if (typeof window.VrcnHideContextMenu === 'function') window.VrcnHideContextMenu();
        if (items && items.length && typeof window.VrcnShowContextMenu === 'function') {
            window.VrcnShowContextMenu(e.clientX, e.clientY, items);
        }
    }, true);
    const loading = document.getElementById('afLoadingHint');
    if (loading) loading.style.display = 'none';
    document.documentElement.addEventListener('themechange', afOnThemeChange);
}

function afOnThemeChange() {
    if (!afWorkspace || !window.Blockly) return;
    const cssVar = (n, f) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f;
    try {
        const newTheme = window.Blockly.Theme.defineTheme('vrcnext-' + Date.now(), {
            base: window.Blockly.Themes.Classic,
            componentStyles: {
                workspaceBackgroundColour: cssVar('--bg-input', '#1f2330'),
                toolboxBackgroundColour:   cssVar('--bg-card',  '#2a2e3a'),
                flyoutBackgroundColour:    cssVar('--bg-card',  '#2a2e3a'),
                flyoutForegroundColour:    cssVar('--tx0',      '#ffffff'),
                scrollbarColour:           cssVar('--brd',      '#666'),
                insertionMarkerColour:     cssVar('--accent',   '#ffffff'),
                insertionMarkerOpacity:    0.5,
                cursorColour:              cssVar('--accent',   '#ffffff'),
                selectedGlowColour:        '#7dd1ff',
                selectedGlowSize:          0.8,
                replacementGlowColour:     '#7dd1ff',
                replacementGlowSize:       2,
            },
        });
        afWorkspace.setTheme(newTheme);
    } catch {}
    const host = document.getElementById('afBlocklyHost');
    if (!host) return;
    const brd = cssVar('--brd', '#3a3f4a');
    host.querySelectorAll('pattern line').forEach(line => line.setAttribute('stroke', brd));
}

function afOnWorkspaceChange(ev) {
    if (!afCurrentFlowId) return;
    if (ev.isUiEvent) return;
    if (ev.type === window.Blockly.Events.FINISHED_LOADING) {
        afUpdateActionCounter();
        return;
    }
    if (afAutoSaveSuppressed) return;

    const flow = afFlows.find(f => f.id === afCurrentFlowId);
    if (flow && afWorkspace) flow.workspace = window.Blockly.serialization.workspaces.save(afWorkspace);
    afUpdateActionCounter();
    afApplyActionLockState();
    afScheduleAutoSave();
}

function afApplyActionLockState() {
    if (!afWorkspace) return;
    const overAction  = afCountActions() > FLOW_ACTION_LIMIT;
    const overTrigger = afCountGlobalTriggers() > TRIGGER_LIMIT;
    for (const b of afWorkspace.getAllBlocks(false)) {
        if (typeof b.getSvgRoot !== 'function') continue;
        const isAction  = ACTION_TYPES.has(b.type);
        const isTrigger = TRIGGER_TYPES.has(b.type);
        if (!isAction && !isTrigger) continue;
        const svg = b.getSvgRoot();
        if (!svg) continue;
        const locked = (isAction && overAction) || (isTrigger && overTrigger);
        svg.classList.toggle('af-action-locked', locked);
        try {
            if (locked) {
                const msg = isAction
                    ? 'Flow is over the ' + FLOW_ACTION_LIMIT + '-action limit — disabled until you delete blocks'
                    : 'Over the global trigger limit (' + TRIGGER_LIMIT + ') — disabled until you delete blocks across flows';
                b.setWarningText(msg);
            } else {
                b.setWarningText(null);
            }
        } catch {}
    }
}

function afCountActions() {
    if (!afWorkspace) return 0;
    let n = 0;
    for (const b of afWorkspace.getAllBlocks(false)) {
        if (ACTION_TYPES.has(b.type)) n++;
    }
    return n;
}

function afCountActionsInWorkspace(ws) {
    if (!ws || !ws.blocks || !ws.blocks.blocks) return 0;
    let n = 0;
    const walk = (b) => {
        if (!b) return;
        if (ACTION_TYPES.has(b.type)) n++;
        if (b.inputs) for (const k in b.inputs) walk(b.inputs[k].block);
        if (b.next)   walk(b.next.block);
    };
    for (const root of ws.blocks.blocks) walk(root);
    return n;
}

function afCountTriggersInWorkspace(ws) {
    if (!ws || !ws.blocks || !ws.blocks.blocks) return 0;
    let n = 0;
    const walk = (b) => {
        if (!b) return;
        if (TRIGGER_TYPES.has(b.type)) n++;
        if (b.inputs) for (const k in b.inputs) walk(b.inputs[k].block);
        if (b.next)   walk(b.next.block);
    };
    for (const root of ws.blocks.blocks) walk(root);
    return n;
}

function afCountGlobalTriggers() {
    let n = 0;
    for (const flow of afFlows) n += afCountTriggersInWorkspace(flow.workspace);
    return n;
}

function afUpdateActionCounter() {
    const el  = document.getElementById('afActionCounterValue');
    const wrap = document.getElementById('afActionCounter');
    if (el && wrap) {
        const n = afCountActions();
        el.textContent = n + '/' + FLOW_ACTION_LIMIT;
        wrap.classList.toggle('at-limit', n >= FLOW_ACTION_LIMIT);
    }
    const tEl  = document.getElementById('afTriggerCounterValue');
    const tWrap = document.getElementById('afTriggerCounter');
    if (tEl && tWrap) {
        const g = afCountGlobalTriggers();
        tEl.textContent = g + '/' + TRIGGER_LIMIT;
        tWrap.classList.toggle('at-limit', g >= TRIGGER_LIMIT);
    }
}

function afScheduleAutoSave() {
    if (afAutoSaveTimer) clearTimeout(afAutoSaveTimer);
    afAutoSaveTimer = setTimeout(() => {
        afAutoSaveTimer = null;
        if (typeof sendToCS === 'function') sendToCS({ action: 'afSaveFlows', flows: afFlows });
    }, AUTOSAVE_DEBOUNCE_MS);
}

function afNewId() { return 'flow_' + Math.random().toString(36).slice(2, 10); }

function afNewFlow() {
    if (afFlows.length >= FLOW_LIMIT) {
        if (typeof showToast === 'function') showToast(false, 'Flow limit reached (' + FLOW_LIMIT + ' max) — delete one to create another');
        return;
    }
    const name = prompt('Flow name:', 'New Flow');
    if (!name) return;
    const id = afNewId();
    const now = Date.now();
    afFlows.push({ id, name, enabled: false, workspace: null, createdAt: now, updatedAt: now });
    afRenderFlowSelect();
    afSelectFlow(id);
    afPersistFlows();
}

function afRenameFlow() {
    const flow = afFlows.find(f => f.id === afCurrentFlowId);
    if (!flow) return;
    const name = prompt('Rename flow:', flow.name);
    if (!name) return;
    flow.name = name;
    flow.updatedAt = Date.now();
    afRenderFlowSelect();
    afPersistFlows();
}

function afDeleteFlow() {
    const flow = afFlows.find(f => f.id === afCurrentFlowId);
    if (!flow) return;
    if (!confirm('Delete flow "' + flow.name + '"?')) return;
    afFlows = afFlows.filter(f => f.id !== flow.id);
    delete afTriggerState[flow.id];
    afCurrentFlowId = afFlows[0]?.id || null;
    afRenderFlowSelect();
    afLoadFlowIntoWorkspace(afCurrentFlowId);
    afPersistFlows();
}

function afSelectFlow(id) {
    if (afCurrentFlowId && afWorkspace) {
        const cur = afFlows.find(f => f.id === afCurrentFlowId);
        if (cur) cur.workspace = window.Blockly.serialization.workspaces.save(afWorkspace);
    }
    afCurrentFlowId = id;
    afLoadFlowIntoWorkspace(id);
    const sel = document.getElementById('afFlowSelect');
    if (sel) {
        sel.value = id || '';
        if (typeof sel._vnRefresh === 'function') sel._vnRefresh();
    }
    const cur = afFlows.find(f => f.id === id);
    const en = document.getElementById('afFlowEnabled');
    if (en) en.checked = !!(cur && cur.enabled);
}

function afToggleEnabled(checked) {
    const flow = afFlows.find(f => f.id === afCurrentFlowId);
    if (!flow) return;
    flow.enabled = !!checked;
    flow.updatedAt = Date.now();
    delete afTriggerState[flow.id];
    afPersistFlows();
    afUpdateRunIndicator();
    if (flow.enabled) setTimeout(afTick, 0);
}

function afToggleLogPanel() {
    const card = document.getElementById('afLogCard');
    const btn  = document.getElementById('afLogToggleBtn');
    if (!card) return;
    const visible = card.style.display !== 'none';
    card.style.display = visible ? 'none' : '';
    if (btn) btn.classList.toggle('active', !visible);
}

function afRunNow() {
    const flow = afFlows.find(f => f.id === afCurrentFlowId);
    if (!flow) { if (typeof showToast === 'function') showToast(false, 'No flow selected'); return; }
    if (afWorkspace) flow.workspace = window.Blockly.serialization.workspaces.save(afWorkspace);
    delete afTriggerState[flow.id];
    afLog('info', '[' + flow.name + '] manual run — firing all triggers');
    const ws = flow.workspace;
    if (!ws || !ws.blocks || !ws.blocks.blocks) {
        afLog('err', '[' + flow.name + '] nothing to run');
        return;
    }
    let fired = 0;
    try {
        for (const root of ws.blocks.blocks) {
            if (afIsTriggerBlock(root.type)) {
                afFireTrigger(flow, root, 'manual: ' + root.type);
                fired++;
            }
        }
    } catch (e) { afLog('err', '[' + flow.name + '] ' + (e.message || e)); }
    if (fired === 0) afLog('err', '[' + flow.name + '] no Trigger block found at root');
}

function afSaveCurrentFlow() {
    const flow = afFlows.find(f => f.id === afCurrentFlowId);
    if (!flow) {
        if (typeof showToast === 'function') showToast(false, 'No flow selected');
        return;
    }
    if (afWorkspace) flow.workspace = window.Blockly.serialization.workspaces.save(afWorkspace);
    flow.updatedAt = Date.now();
    afPersistFlows();
    if (typeof showToast === 'function') showToast(true, 'Flow saved');
}

function afRenderFlowSelect() {
    const sel = document.getElementById('afFlowSelect');
    if (!sel) return;
    sel.innerHTML = '';
    if (!afFlows.length) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '(no flows)';
        sel.appendChild(opt);
    } else {
        afFlows.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = f.name;
            opt.dataset.vnDot = f.enabled ? 'online' : 'offline';
            sel.appendChild(opt);
        });
        if (afCurrentFlowId) sel.value = afCurrentFlowId;
    }
    if (typeof initVnSelect === 'function') initVnSelect(sel);
    if (typeof sel._vnRefresh === 'function') sel._vnRefresh();
}

function afLoadFlowIntoWorkspace(id) {
    const hint = document.getElementById('afEmptyHint');
    if (!afWorkspace) return;
    afAutoSaveSuppressed = true;
    try {
        afWorkspace.clear();
        const flow = afFlows.find(f => f.id === id);
        if (!flow) {
            if (hint) hint.style.display = '';
            return;
        }
        if (hint) hint.style.display = 'none';
        if (flow.workspace && Object.keys(flow.workspace).length > 0) {
            try { window.Blockly.serialization.workspaces.load(flow.workspace, afWorkspace); }
            catch (e) { console.error('[ActionFlow] load failed', e); afLog('err', 'Workspace load failed: ' + (e.message || e)); }
        }
    } finally {
        setTimeout(() => { afAutoSaveSuppressed = false; afUpdateActionCounter(); afApplyActionLockState(); }, 50);
    }
}

function afPersistFlows() {
    if (afCurrentFlowId && afWorkspace) {
        const cur = afFlows.find(f => f.id === afCurrentFlowId);
        if (cur) cur.workspace = window.Blockly.serialization.workspaces.save(afWorkspace);
    }
    afRenderFlowSelect();
    afUpdateActionCounter();
    afApplyActionLockState();
    if (typeof sendToCS === 'function') sendToCS({ action: 'afSaveFlows', flows: afFlows });
}

function afLog(level, msg) {
    afLogEntries.push({ time: new Date(), level, msg });
    while (afLogEntries.length > LOG_MAX_ENTRIES) afLogEntries.shift();
    afRenderLog();
}

function afClearLog() {
    afLogEntries = [];
    afRenderLog();
}

function afRenderLog() {
    const host = document.getElementById('afLogList');
    if (!host) return;
    if (!afLogEntries.length) {
        host.innerHTML = '<div class="af-log-empty">No events yet. Save and enable a flow to see execution traces.</div>';
        return;
    }
    host.innerHTML = afLogEntries.slice().reverse().map(e => {
        const t = e.time.toTimeString().slice(0, 8);
        return `<div class="af-log-entry ${e.level}"><span class="af-log-time">${t}</span><span class="af-log-msg">${afEsc(e.msg)}</span></div>`;
    }).join('');
    host.scrollTop = 0;
}

function afEsc(s) { const d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }

function afStartTicker() {
    if (afTickTimer) return;
    afTickTimer = setInterval(afTick, EVENT_TICK_MS);
    setTimeout(afTick, 2000);
}

const TRIGGER_TYPES = new Set([
    'af_trigger_interval_30s',
    'af_trigger_interval_minutes',
    'af_trigger_world_change',
    'af_trigger_user_joins',
    'af_trigger_user_leaves',
    'af_trigger_user_joins_or_leaves',
    'af_trigger_own_status_change',
    'af_trigger_websocket_any',
    'af_trigger_websocket_friend',
    'af_trigger_invite_received',
    'af_trigger_invite_request_received',
    'af_trigger_manual',
    'af_trigger_time',
]);

function afIsTriggerBlock(type) { return TRIGGER_TYPES.has(type); }

function afTick() {
    const now      = Date.now();
    const today    = new Date(now);
    const obs = {
        now,
        hh:        today.getHours(),
        mm:        today.getMinutes(),
        dayKey:    today.toISOString().slice(0, 10),
        userIds:   afObservedInstanceUserIds(),
        myStatus:  (typeof currentVrcUser !== 'undefined' && currentVrcUser?.status) || null,
    };

    for (const flow of afFlows) {
        if (!flow.enabled || !flow.workspace) continue;
        try { afEvalFlow(flow, obs); }
        catch (e) { afLog('err', '[' + flow.name + '] ' + (e.message || e)); }
    }

    if (obs.userIds)  afWatchState.lastInstanceUserIds = obs.userIds;
    if (obs.myStatus) afWatchState.lastStatus          = obs.myStatus;

    afUpdateRunIndicator();
}

function afObservedInstanceUserIds() {
    if (typeof currentInstanceData === 'undefined' || !currentInstanceData) return null;
    if (currentInstanceData.empty || currentInstanceData.error) return null;
    const arr = Array.isArray(currentInstanceData.users) ? currentInstanceData.users : [];
    return new Set(arr.map(u => u && u.id).filter(Boolean));
}

function afUpdateRunIndicator() {
    const dot = document.getElementById('afRunDot');
    const txt = document.getElementById('afRunText');
    if (!dot || !txt) return;
    const anyEnabled = afFlows.some(f => f.enabled);
    if (anyEnabled) { dot.className = 'sf-dot online';  txt.textContent = 'Running'; }
    else            { dot.className = 'sf-dot offline'; txt.textContent = 'Idle';    }
}

function afEvalFlow(flow, obs) {
    const ws = flow.workspace;
    if (!ws || !ws.blocks || !ws.blocks.blocks) return;
    for (const root of ws.blocks.blocks) {
        afExecRootBlock(flow, root, obs);
    }
}

function afExecRootBlock(flow, block, obs) {
    if (!block) return;
    if (afIsTriggerBlock(block.type)) afEvalTrigger(flow, block, obs);
    if (block.next && block.next.block) afExecRootBlock(flow, block.next.block, obs);
}

function afEvalTrigger(flow, block, obs) {
    const state = afTriggerState[flow.id] = afTriggerState[flow.id] || {};
    const ts    = state[block.id] = state[block.id] || {};
    const f     = block.fields || {};

    switch (block.type) {
        case 'af_trigger_interval_30s': {
            if (!ts.lastFiredMs || (obs.now - ts.lastFiredMs) >= 30 * 1000) {
                ts.lastFiredMs = obs.now;
                afFireTrigger(flow, block, 'every 30s');
            }
            return;
        }
        case 'af_trigger_interval_minutes': {
            const min = Math.max(1, Number(f.MIN || 1));
            const ms  = min * 60 * 1000;
            if (!ts.lastFiredMs || (obs.now - ts.lastFiredMs) >= ms) {
                ts.lastFiredMs = obs.now;
                afFireTrigger(flow, block, 'every ' + min + ' min');
            }
            return;
        }
        case 'af_trigger_time': {
            let hh = Number(f.HH);
            if (f.AMPM === 'PM' && hh < 12) hh += 12;
            if (f.AMPM === 'AM' && hh === 12) hh = 0;
            const mm = Number(f.MM);
            if (obs.hh === hh && obs.mm === mm && ts.lastFiredDay !== obs.dayKey) {
                ts.lastFiredDay = obs.dayKey;
                afFireTrigger(flow, block, 'at ' + hh + ':' + String(mm).padStart(2, '0'));
            }
            return;
        }
        case 'af_trigger_world_change':
            return;
        case 'af_trigger_user_joins':
        case 'af_trigger_user_leaves':
        case 'af_trigger_user_joins_or_leaves': {
            if (!obs.userIds || !afWatchState.lastInstanceUserIds) return;
            const fireJoins  = block.type !== 'af_trigger_user_leaves';
            const fireLeaves = block.type !== 'af_trigger_user_joins';
            const filterOn = (f.FILTER === 'TRUE' || f.FILTER === true);
            const filterId = filterOn ? String(f.USER_ID || '').trim() : '';
            const matches = (id) => !filterId || id === filterId;
            if (fireJoins) {
                for (const id of obs.userIds) {
                    if (!afWatchState.lastInstanceUserIds.has(id) && matches(id)) {
                        afFireTrigger(flow, block, 'user joined: ' + id, afLookupUser(id));
                    }
                }
            }
            if (fireLeaves) {
                for (const id of afWatchState.lastInstanceUserIds) {
                    if (!obs.userIds.has(id) && matches(id)) {
                        afFireTrigger(flow, block, 'user left: ' + id, afLookupUser(id));
                    }
                }
            }
            return;
        }
        case 'af_trigger_own_status_change': {
            if (!obs.myStatus || !afWatchState.lastStatus) return;
            if (obs.myStatus !== afWatchState.lastStatus) {
                afFireTrigger(flow, block, 'own status: ' + afWatchState.lastStatus + ' → ' + obs.myStatus);
            }
            return;
        }
        case 'af_trigger_websocket_any':
        case 'af_trigger_websocket_friend':
        case 'af_trigger_invite_received':
        case 'af_trigger_invite_request_received':
        case 'af_trigger_manual':
            return;
    }
}

function afFireTrigger(flow, block, reason, triggeringUser) {
    const actionCount = afCountActionsInWorkspace(flow.workspace);
    if (actionCount > FLOW_ACTION_LIMIT) {
        afLog('err', '[' + flow.name + '] over action limit (' + actionCount + '/' + FLOW_ACTION_LIMIT + ') — flow disabled until trimmed');
        return;
    }
    const triggerCount = afCountGlobalTriggers();
    if (triggerCount > TRIGGER_LIMIT) {
        afLog('err', '[' + flow.name + '] over global trigger limit (' + triggerCount + '/' + TRIGGER_LIMIT + ') — all triggers disabled until trimmed');
        return;
    }
    const prevCtx = afContext;
    const triggerKind =
        block.type === 'af_trigger_invite_received'         ? 'invite' :
        block.type === 'af_trigger_invite_request_received' ? 'requestInvite' : null;
    afContext = { triggeringUser: triggeringUser || null, triggerKind };
    try {
        afLog('info', '[' + flow.name + '] trigger fired (' + reason + ')');
        afExecStatements(flow, afInputStatement(block, 'DO'));
    } finally {
        afContext = prevCtx;
    }
}

function afLookupUser(id) {
    if (!id) return null;
    const live = typeof vrcFriendsData !== 'undefined' && vrcFriendsData.find(x => x.id === id);
    return live || { id };
}

window.__afOnWebsocketEvent = function (type, payload) {
    if (!type || !type.startsWith('vrc')) return;
    if (type === 'vrcFriends' || type === 'vrcCredits') return;

    if (type === 'vrcWorldJoined') {
        const worldId = payload?.worldId || '';
        setTimeout(() => {
            for (const flow of afFlows) {
                if (!flow.enabled || !flow.workspace?.blocks?.blocks) continue;
                for (const root of flow.workspace.blocks.blocks) {
                    if (root.type === 'af_trigger_world_change') {
                        afFireTrigger(flow, root, 'world joined: ' + worldId);
                    }
                }
            }
        }, WORLD_CHANGE_DELAY_MS);
    }

    if (type === 'vrcNotificationPrepend' && payload && typeof payload === 'object') {
        const notifType = payload.type;
        const senderId  = payload.senderUserId || null;
        const sender    = senderId ? afLookupUser(senderId) : null;
        const targetTrigger =
            notifType === 'invite'        ? 'af_trigger_invite_received' :
            notifType === 'requestInvite' ? 'af_trigger_invite_request_received' : null;
        if (targetTrigger) {
            for (const flow of afFlows) {
                if (!flow.enabled || !flow.workspace?.blocks?.blocks) continue;
                for (const root of flow.workspace.blocks.blocks) {
                    if (root.type === targetTrigger) {
                        afFireTrigger(flow, root, notifType + ' from ' + (senderId || 'unknown'), sender);
                    }
                }
            }
        }
    }

    const userId = afExtractUserId(payload);

    for (const flow of afFlows) {
        if (!flow.enabled || !flow.workspace?.blocks?.blocks) continue;
        for (const root of flow.workspace.blocks.blocks) {
            if (!afIsTriggerBlock(root.type)) continue;
            if (root.type === 'af_trigger_websocket_any') {
                afFireTrigger(flow, root, 'ws: ' + type, userId ? afLookupUser(userId) : null);
            } else if (root.type === 'af_trigger_websocket_friend') {
                const want = root.fields?.FRIEND_ID;
                if (want && userId && want === userId) {
                    afFireTrigger(flow, root, 'ws for ' + want + ': ' + type, afLookupUser(userId));
                }
            }
        }
    }
};

function afExtractUserId(payload) {
    if (!payload || typeof payload !== 'object') return null;
    return payload.userId || payload.id || payload.senderUserId || (payload.user && payload.user.id) || null;
}

function afExecStatements(flow, block) {
    let cur = block;
    while (cur) {
        afExecAction(flow, cur);
        cur = cur.next?.block;
    }
}

function afExecAction(flow, block) {
    const f = block.fields || {};
    switch (block.type) {
        case 'af_if': {
            if (afEvalValue(afInput(block, 'IF0'))) afExecStatements(flow, afInputStatement(block, 'DO0'));
            return;
        }
        case 'af_if_else': {
            const branch = afEvalValue(afInput(block, 'IF0')) ? 'DO0' : 'ELSE';
            afExecStatements(flow, afInputStatement(block, branch));
            return;
        }
        case 'af_set_status': {
            const status = f.STATUS || 'active';
            const text   = String(f.TEXT || '');
            const desc = text || ((typeof currentVrcUser !== 'undefined' && currentVrcUser?.statusDescription) || '');
            if (typeof sendToCS === 'function') sendToCS({ action: 'vrcUpdateStatus', status, statusDescription: desc });
            afLog('ok', '[' + flow.name + '] set status → ' + (VRC_STATUS_LABELS[status] || status) + (text ? ' / "' + text + '"' : ''));
            break;
        }
        case 'af_set_bio_text': {
            const text = f.TEXT || '';
            if (typeof sendToCS === 'function') sendToCS({ action: 'vrcUpdateProfile', bio: text });
            afLog('ok', '[' + flow.name + '] set bio → "' + text + '"');
            break;
        }
        case 'af_invite_friend': {
            const user = afEvalUser(afInput(block, 'USER'));
            if (!user || !user.id) { afLog('err', '[' + flow.name + '] invite skipped: missing user'); break; }
            if (typeof sendToCS === 'function') sendToCS({ action: 'vrcInviteFriend', userId: user.id });
            afLog('ok', '[' + flow.name + '] invite sent → ' + (user.displayName || user.id));
            break;
        }
        case 'af_request_invite': {
            const user = afEvalUser(afInput(block, 'USER'));
            if (!user || !user.id) { afLog('err', '[' + flow.name + '] request invite skipped: missing user'); break; }
            if (typeof sendToCS === 'function') sendToCS({ action: 'vrcRequestInvite', userId: user.id });
            afLog('ok', '[' + flow.name + '] request invite → ' + (user.displayName || user.id));
            break;
        }
        case 'af_send_notification': {
            const text = f.TEXT || '';
            afShowFlowNotificationCard(flow.name, text);
            if (typeof sendToCS === 'function') sendToCS({ action: 'afTrayNotify', title: 'Action Flow', subtitle: text, accent: 'info' });
            afLog('ok', '[' + flow.name + '] notify → "' + text + '"');
            break;
        }
        case 'af_answer_invite':
        case 'af_answer_invite_request': {
            const text = f.TEXT || '';
            const target = afContext.triggeringUser;
            if (!target || !target.id) {
                afLog('err', '[' + flow.name + '] ' + block.type + ' skipped: no triggering user (use inside a "when someone invites me" / "requests invite" trigger)');
                break;
            }
            if (typeof sendToCS === 'function') sendToCS({ action: 'vrcSendChatMessage', userId: target.id, text });
            afLog('ok', '[' + flow.name + '] reply → ' + (target.displayName || target.id) + ': "' + text + '"');
            break;
        }
        default:
            afLog('err', '[' + flow.name + '] unknown action ' + block.type);
    }
}

function afInput(block, name) {
    return block.inputs && block.inputs[name] && block.inputs[name].block;
}
function afInputStatement(block, name) {
    return block.inputs && block.inputs[name] && block.inputs[name].block;
}

function afEvalValue(block) {
    if (!block) return null;
    const f = block.fields || {};
    switch (block.type) {
        case 'af_bool':   return f.BOOL === 'TRUE';
        case 'af_and':    return !!afEvalValue(afInput(block, 'A')) && !!afEvalValue(afInput(block, 'B'));
        case 'af_or':     return !!afEvalValue(afInput(block, 'A')) || !!afEvalValue(afInput(block, 'B'));
        case 'af_compare': {
            const a = afEvalValue(afInput(block, 'A'));
            const b = afEvalValue(afInput(block, 'B'));
            switch (f.OP) {
                case 'EQ': return afCmpEq(a, b);
                case 'GT': return Number(a) > Number(b);
                case 'LT': return Number(a) < Number(b);
            }
            return false;
        }
        case 'af_is_date': {
            const now = new Date();
            return now.getDate() === Number(f.DD) && (now.getMonth() + 1) === Number(f.MM) && now.getFullYear() === Number(f.YYYY);
        }
        case 'af_is_time': {
            const now = new Date();
            let hh = Number(f.HH);
            if (f.AMPM === 'PM' && hh < 12) hh += 12;
            if (f.AMPM === 'AM' && hh === 12) hh = 0;
            return now.getHours() === hh && now.getMinutes() === Number(f.MM);
        }
        case 'af_between_time': {
            const now = new Date();
            const toMins = (h, m, ampm) => {
                let hh = Number(h);
                if (ampm === 'PM' && hh < 12) hh += 12;
                if (ampm === 'AM' && hh === 12) hh = 0;
                return hh * 60 + Number(m);
            };
            const start = toMins(f.HH1, f.MM1, f.AMPM1);
            const end   = toMins(f.HH2, f.MM2, f.AMPM2);
            const cur   = now.getHours() * 60 + now.getMinutes();
            return start <= end ? (cur >= start && cur <= end) : (cur >= start || cur <= end);
        }
        case 'af_is_friend': {
            const u = afEvalUser(afInput(block, 'USER'));
            if (!u || !u.id) return false;
            if (typeof vrcFriendsData === 'undefined') return false;
            return vrcFriendsData.some(fr => fr.id === u.id);
        }
        case 'af_invite_from_friend':
            return afContext.triggerKind === 'invite'
                && !!afContext.triggeringUser
                && afContext.triggeringUser.id === f.FRIEND_ID;
        case 'af_invite_request_from_friend':
            return afContext.triggerKind === 'requestInvite'
                && !!afContext.triggeringUser
                && afContext.triggeringUser.id === f.FRIEND_ID;
        case 'af_has_status': {
            const u = afEvalUser(afInput(block, 'USER'));
            if (!u) return false;
            return (u.status || '') === f.STATUS;
        }
        case 'af_own_status': {
            const me = typeof currentVrcUser !== 'undefined' ? currentVrcUser : null;
            return !!me && (me.status || '') === f.STATUS;
        }
        case 'af_has_status_text': {
            const u = afEvalUser(afInput(block, 'USER'));
            return !!u && (u.statusDescription || '') === (f.TEXT || '');
        }
        case 'af_own_status_text': {
            const me = typeof currentVrcUser !== 'undefined' ? currentVrcUser : null;
            return !!me && (me.statusDescription || '') === (f.TEXT || '');
        }
        case 'af_has_bio_text': {
            const u = afEvalUser(afInput(block, 'USER'));
            return !!u && (u.bio || '') === (f.TEXT || '');
        }
        case 'af_own_bio_text': {
            const me = typeof currentVrcUser !== 'undefined' ? currentVrcUser : null;
            return !!me && (me.bio || '') === (f.TEXT || '');
        }
        case 'af_get_current_world': {
            const u = afEvalUser(afInput(block, 'USER'));
            if (!u || !u.location) return null;
            return { id: String(u.location).split(':')[0], kind: 'world' };
        }
        case 'af_in_same_instance': {
            const u = afEvalUser(afInput(block, 'USER'));
            if (!u || !u.id) return false;
            if (typeof currentInstanceData !== 'undefined'
                && currentInstanceData
                && !currentInstanceData.empty
                && !currentInstanceData.error
                && Array.isArray(currentInstanceData.users)
                && currentInstanceData.users.some(x => x && x.id === u.id)) {
                return true;
            }
            if (!u.location || !String(u.location).startsWith('wrld_')) return false;
            const myLocRaw =
                (typeof currentInstanceData !== 'undefined' && currentInstanceData?.location) ||
                (typeof currentVrcUser       !== 'undefined' && currentVrcUser?.location) ||
                '';
            if (!myLocRaw || !myLocRaw.startsWith('wrld_')) return false;
            const myBase    = String(myLocRaw).split('~')[0];
            const theirBase = String(u.location).split('~')[0];
            return myBase === theirBase;
        }
        case 'af_friend_obj':
        case 'af_user_obj':
        case 'af_own_user':
        case 'af_triggering_user':
        case 'af_world_obj':
            return afEvalUser(block);
    }
    return null;
}

function afCmpEq(a, b) {
    if (a && typeof a === 'object' && b && typeof b === 'object') {
        if (a.id && b.id) return a.id === b.id;
    }
    if (a && typeof a === 'object' && a.id) return String(a.id) === String(b);
    if (b && typeof b === 'object' && b.id) return String(b.id) === String(a);
    return String(a) === String(b);
}

function afEvalUser(block) {
    if (!block) return null;
    const f = block.fields || {};
    switch (block.type) {
        case 'af_friend_obj': {
            const id = f.FRIEND_ID;
            if (!id) return null;
            const live = typeof vrcFriendsData !== 'undefined' && vrcFriendsData.find(x => x.id === id);
            return live || { id };
        }
        case 'af_user_obj': {
            const id = f.USER_ID;
            const live = typeof vrcFriendsData !== 'undefined' && vrcFriendsData.find(x => x.id === id);
            return live || { id };
        }
        case 'af_own_user': {
            return (typeof currentVrcUser !== 'undefined' && currentVrcUser) || null;
        }
        case 'af_triggering_user': {
            return afContext.triggeringUser;
        }
        case 'af_world_obj': {
            return { id: f.WORLD_ID, kind: 'world' };
        }
        case 'af_get_current_world': {
            return afEvalValue(block);
        }
    }
    return null;
}

window.afOnTabOpen = async function afOnTabOpen() {
    if (afTabInitialized) return;
    afTabInitialized = true;
    try { await afInitWorkspace(); }
    catch (e) {
        const hint = document.getElementById('afLoadingHint');
        if (hint) hint.innerHTML = '<span class="msi" style="font-size:32px;color:var(--err);">error</span><div style="font-size:13px;color:var(--err);margin-top:8px;">Failed to load Blockly: ' + afEsc(e.message || e) + '</div>';
        return;
    }
    if (typeof sendToCS === 'function') sendToCS({ action: 'afLoadFlows' });
};

window.afNewFlow            = afNewFlow;
window.afRenameFlow         = afRenameFlow;
window.afDeleteFlow         = afDeleteFlow;
window.afSelectFlow         = afSelectFlow;
window.afToggleEnabled      = afToggleEnabled;
window.afSaveCurrentFlow    = afSaveCurrentFlow;
window.afRunNow             = afRunNow;
window.afClearLog           = afClearLog;
window.afToggleLogPanel     = afToggleLogPanel;

window.afZoom = function (dir) {
    if (!afWorkspace) return;
    afWorkspace.zoomCenter(dir);
};
window.afZoomReset = function () {
    if (!afWorkspace) return;
    afWorkspace.setScale(0.95);
    afWorkspace.scrollCenter();
};
window.afDeleteSelected = function () {
    if (!afWorkspace) return;
    const sel = window.Blockly.getSelected && window.Blockly.getSelected();
    if (sel && typeof sel.dispose === 'function') sel.dispose(true);
};

function afShowFlowNotificationCard(flowName, text) {
    const area = document.getElementById('notifCardArea');
    if (!area) return;
    const card = document.createElement('div');
    card.className = 'nc-card';
    card.innerHTML =
        '<div class="nc-inner">' +
            '<span class="msi nc-icon" style="color:var(--accent);">account_tree</span>' +
            '<div class="nc-body">' +
                '<div class="nc-title"><strong>' + afEsc(flowName) + '</strong></div>' +
                (text ? '<div class="nc-sub">' + afEsc(text) + '</div>' : '') +
            '</div>' +
            '<button class="nc-close-btn" title="Close"><span class="msi" style="font-size:15px;">close</span></button>' +
        '</div>' +
        '<div class="nc-timer"><div class="nc-timer-bar" style="background:var(--accent);"></div></div>';
    area.appendChild(card);
    const close = () => { if (card.parentNode) { card.classList.remove('nc-visible'); setTimeout(() => card.remove(), 350); } };
    card.querySelector('.nc-close-btn').addEventListener('click', close);
    requestAnimationFrame(() => {
        card.classList.add('nc-visible');
        const bar = card.querySelector('.nc-timer-bar');
        if (bar) {
            bar.style.transition = 'transform 8s linear';
            requestAnimationFrame(() => { bar.style.transform = 'scaleX(0)'; });
        }
    });
    setTimeout(close, 8200);
}

window.afBuildBlockContextMenu = function (target) {
    if (!afWorkspace || !window.Blockly || !target) return null;
    const blockEl = target.closest('.blocklyDraggable');
    if (!blockEl) return null;
    const id = blockEl.getAttribute('data-id');
    if (!id) return null;
    const block = afWorkspace.getBlockById(id);
    if (!block) return null;

    const items = [];
    if (typeof block.isDeletable === 'function' && block.isDeletable()) {
        items.push({ icon: 'content_copy', label: 'Duplicate', action: () => {
            try {
                const json = window.Blockly.serialization.blocks.save(block);
                const dup = window.Blockly.serialization.blocks.append(json, afWorkspace);
                const xy = block.getRelativeToSurfaceXY();
                if (dup && dup.moveBy) dup.moveBy(20, 20);
                if (dup && dup.select) dup.select();
            } catch (e) { afLog('err', 'Duplicate failed: ' + (e.message || e)); }
        }});
    }
    if (typeof block.setCommentText === 'function') {
        const hasComment = !!block.getCommentText?.();
        items.push({
            icon: hasComment ? 'speaker_notes_off' : 'add_comment',
            label: hasComment ? 'Remove Comment' : 'Add Comment',
            action: () => block.setCommentText(hasComment ? null : ''),
        });
    }
    if (typeof block.setCollapsed === 'function') {
        const collapsed = block.isCollapsed();
        items.push({
            icon: collapsed ? 'unfold_more' : 'unfold_less',
            label: collapsed ? 'Expand Block' : 'Collapse Block',
            action: () => block.setCollapsed(!collapsed),
        });
    }
    if (typeof block.setEnabled === 'function') {
        const enabled = block.isEnabled();
        items.push({
            icon: enabled ? 'block' : 'check_circle',
            label: enabled ? 'Disable Block' : 'Enable Block',
            action: () => block.setEnabled(!enabled),
        });
    }
    if (typeof block.isDeletable === 'function' && block.isDeletable()) {
        const count = block.getDescendants ? block.getDescendants(true).length : 1;
        items.push('sep');
        items.push({
            icon: 'delete',
            label: count > 1 ? ('Delete ' + count + ' Blocks') : 'Delete Block',
            action: () => block.dispose(true),
        });
    }
    return items.length ? items : null;
};

window.__afHandleMessage = function (action, payload) {
    switch (action) {
        case 'afFlows':
            afFlows = Array.isArray(payload?.flows) ? payload.flows : [];
            for (const f of afFlows) {
                if (!f.id) f.id = afNewId();
                if (typeof f.enabled !== 'boolean') f.enabled = false;
            }
            afRenderFlowSelect();
            if (afFlows.length && !afCurrentFlowId) afCurrentFlowId = afFlows[0].id;
            if (afWorkspace) afLoadFlowIntoWorkspace(afCurrentFlowId);
            const en = document.getElementById('afFlowEnabled');
            const cur = afFlows.find(f => f.id === afCurrentFlowId);
            if (en) en.checked = !!(cur && cur.enabled);
            afUpdateRunIndicator();
            break;
        case 'afSaveResult':
            if (payload && payload.ok === false) {
                afLog('err', 'Save failed: ' + (payload.error || 'unknown'));
                if (typeof showToast === 'function') showToast(false, 'Flow save failed: ' + (payload.error || 'unknown'));
            }
            break;
    }
};

function afBoot() {
    if (typeof sendToCS === 'function') sendToCS({ action: 'afLoadFlows' });
    afStartTicker();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', afBoot);
} else {
    afBoot();
}

})();
