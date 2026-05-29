/* global SillyTavern */

import stGetContext from '../../../st-context.js';

const EXTENSION_ID = 'ST-StoryPhone';
const EXTENSION_ALIAS = 'ST-PhoningPhone';
const STORYPHONE_VERSION = '0.4.8';
const EXTENSION_VERSION = STORYPHONE_VERSION;
const STORAGE_PREFIX = 'st_story_phone';
const STORYPHONE_VERSION_KEY = `${STORAGE_PREFIX}:storyPhoneVersion`;

console.info(`${EXTENSION_ID} runtime`, STORYPHONE_VERSION);

const storyPhoneRuntimeDebug = {
    runtimeVersion: STORYPHONE_VERSION,
    storedVersion: null,
    migrationRan: false,
    cleanedKeys: [],
    cleanedOpenStateKeys: [],
    openStateCleared: false,
    lastBootError: null,
    lastBootStep: 'init',
    storageReadable: false,
    profileLoaded: false,
    launcherMounted: false,
    rootMounted: false,
    modalMounted: false,
    duplicateNodesRemoved: 0,
    bootWarnings: [],
    activeUiVersion: 'new',
    activeRenderFunction: 'app.js:PhoneUI.render',
    activeLauncherFunction: 'app.js:PhoneUI.mount',
    lastUiBootError: null,
};

const STORYPHONE_OPEN_STATE_FIELDS = [
    'storyPhoneOpen',
    'phoneOpen',
    'modalOpen',
    'isOpen',
    'launcherOpen',
    'activeModal',
    'activeViewOpen',
    'storyPhoneLastOpen',
    'open',
    'opened',
    'isPhoneOpen',
    'activeModalOpen',
    'layoutOpen',
    'layoutState',
    'launcherState',
    'modalState',
    'minimized',
];

const STORYPHONE_OPEN_STATE_STORAGE_KEYS = [
    'storyPhoneOpen',
    'phoneOpen',
    'modalOpen',
    'isOpen',
    'launcherOpen',
    'activeModal',
    'activeViewOpen',
    'storyPhoneLastOpen',
    'activeModalOpen',
    'storyphoneOpen',
    'StoryPhoneOpen',
    'st_story_phone_open',
    'st_story_phone_modal_open',
    'st_story_phone_launcher_open',
    'st_story_phone_last_open',
    'st_story_phone:open',
    'st_story_phone:modalOpen',
    'st_story_phone:phoneOpen',
    'st_story_phone:isOpen',
    'st_story_phone:launcherOpen',
    'st_story_phone:activeModal',
    'st_story_phone:activeViewOpen',
    'st_story_phone:storyPhoneLastOpen',
    'st_story_phone:layoutOpen',
];

const STORYPHONE_OPEN_STATE_KEY_PATTERNS = [
    /(^|[:_-])(story[-_]?phone[-_]?)?open$/i,
    /(^|[:_-])phone[-_]?open$/i,
    /(^|[:_-])modal[-_]?open$/i,
    /(^|[:_-])is[-_]?open$/i,
    /(^|[:_-])launcher[-_]?open$/i,
    /(^|[:_-])active[-_]?modal$/i,
    /(^|[:_-])active[-_]?view[-_]?open$/i,
    /(^|[:_-])story[-_]?phone[-_]?last[-_]?open$/i,
    /(^|[:_-])active[-_]?modal[-_]?open$/i,
    /(^|[:_-])layout[-_]?open$/i,
    /(^|[:_-])old[-_]?layout[-_]?open[-_]?state$/i,
];

const DEFAULT_PROFILE = {
    id: 'default',
    displayName: 'Default Story Phone',
    targetPhoneOwner: '{{char}}',
    phoneOwnerLabel: '目标角色',
    theme: 'phoning_y2k',
    friends: [
        { id: 'best_friend', name: '好友', role: '普通好友', visibility: 'public', knows: [], doesNotKnow: [], relations: [] },
        { id: 'classmate', name: '同学', role: '同班同学', visibility: 'public', knows: [], doesNotKnow: [], relations: [] },
    ],
    groups: [
        { id: 'default_group', name: '朋友小群', members: ['user', 'char', 'best_friend'], rules: [] },
    ],
    currentChar: {
        id: 'char',
        name: '{{char}}',
        knows: [],
        doesNotKnow: [],
    },
    publicChannels: [
        { id: 'forum', name: '论坛', audience: 'profiled_forum_readers' },
        { id: 'moments', name: '朋友圈', audience: 'configured_visibility' },
    ],
    phoneApps: ['wechat', 'moments', 'forum', 'calendar', 'memo', 'target_phone'],
    forum: {
        name: '论坛',
        tone: '真实克制，不狗血，不全校磕CP',
        defaultBoard: '校园生活',
    },
    calendar: {
        futureThreads: [],
    },
    visibilityDefaults: {
        phoneEvents: 'user_only',
        forumPosts: 'public',
        moments: 'public',
        npcChats: 'visible_to_npc',
        groupChats: 'visible_to_group',
        targetPhone: 'visible_to_char',
        characterSideScreen: 'char_private',
    },
    phoneEntries: [
        {
            id: 'default_phone_style',
            title: '通用手机语气',
            type: 'custom',
            enabled: true,
            priority: 0,
            linkedTargets: { characters: [], npcs: [], groups: [], apps: [], forumBoards: [], relationshipStages: [], tags: [] },
            linkedLorebookEntries: [],
            triggerKeywords: [],
            content: '手机侧内容保持真实克制，遵守可见性边界，不让角色全知全能。',
            notes: '',
        },
    ],
};

const EVENT_SOURCES = {
    MAIN_CHAT: 'main_chat',
    WECHAT: 'phone_wechat',
    PRIVATE_CHAT: 'phone_wechat',
    GROUP_CHAT: 'phone_wechat',
    MOMENTS: 'phone_moments',
    FORUM: 'phone_forum',
    CALENDAR: 'phone_calendar',
    MEMO: 'phone_memo',
    SYSTEM_PUSH: 'phone_wechat',
    TARGET_PHONE: 'target_phone',
    CHARACTER_SIDE_SCREEN: 'target_phone',
};

const TASK_LABELS = {
    moments: '朋友圈',
    forum: '论坛',
    npc_chat: '微信聊天',
    group_chat: '群聊',
    target_phone: '查看目标角色手机',
    character_side_screen: '角色侧屏',
    proactive_event: '主动手机事件',
    delayed_reply: '延迟回复',
};

function nowIso() {
    return new Date().toISOString();
}

function cloneValue(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
}

function safeJsonParse(text, fallback) {
    try {
        return JSON.parse(text);
    } catch {
        return fallback;
    }
}

function safeStorageGet(key, fallback = '') {
    try {
        storyPhoneRuntimeDebug.storageReadable = true;
        const value = localStorage.getItem(key);
        return value === null || value === undefined ? fallback : value;
    } catch (error) {
        storyPhoneRuntimeDebug.storageReadable = false;
        console.warn(`${EXTENSION_ID}: localStorage get failed`, key, error);
        return fallback;
    }
}

function safeStorageSet(key, value) {
    try {
        localStorage.setItem(key, value);
        storyPhoneRuntimeDebug.storageReadable = true;
        return true;
    } catch (error) {
        storyPhoneRuntimeDebug.storageReadable = false;
        console.warn(`${EXTENSION_ID}: localStorage set failed`, key, error);
        return false;
    }
}

function safeStorageRemove(key) {
    try {
        localStorage.removeItem(key);
        storyPhoneRuntimeDebug.cleanedKeys.push(key);
        return true;
    } catch (error) {
        console.warn(`${EXTENSION_ID}: localStorage remove failed`, key, error);
        return false;
    }
}

function safeStorageJson(key, fallback) {
    return safeJsonParse(safeStorageGet(key, ''), fallback);
}

function removeStoryPhoneOpenStateFields(target, prefix = '') {
    if (!target || typeof target !== 'object') return [];
    const cleaned = [];
    STORYPHONE_OPEN_STATE_FIELDS.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(target, field)) {
            delete target[field];
            cleaned.push(prefix ? `${prefix}.${field}` : field);
        }
    });
    ['settings', 'ui', 'modal', 'launcher', 'layout', 'phoneState'].forEach((field) => {
        if (target[field] && typeof target[field] === 'object') {
            cleaned.push(...removeStoryPhoneOpenStateFields(target[field], prefix ? `${prefix}.${field}` : field));
        }
    });
    return cleaned;
}

function stripStoryPhoneOpenStateForSave(value) {
    const persisted = cloneValue(value);
    removeStoryPhoneOpenStateFields(persisted);
    return persisted;
}

function markStoryPhoneNewUi(activeLauncherFunction = 'app.js:PhoneUI.mount') {
    storyPhoneRuntimeDebug.activeUiVersion = 'new';
    storyPhoneRuntimeDebug.activeRenderFunction = 'app.js:PhoneUI.render';
    storyPhoneRuntimeDebug.activeLauncherFunction = activeLauncherFunction;
    storyPhoneRuntimeDebug.lastUiBootError = null;
    globalThis.STStoryPhoneLauncherDebug = {
        ...(globalThis.STStoryPhoneLauncherDebug || {}),
        activeUiVersion: 'new',
        activeRenderFunction: 'app.js:PhoneUI.render',
        activeLauncherFunction,
        lastUiBootError: null,
    };
}

function getStoryPhoneLauncherDebug() {
    return globalThis.STStoryPhoneLauncherDebug || {};
}

function mergeStoryPhoneLauncherDebug(patch = {}) {
    globalThis.STStoryPhoneLauncherDebug = {
        ...getStoryPhoneLauncherDebug(),
        ...patch,
    };
    return globalThis.STStoryPhoneLauncherDebug;
}

function requestStoryPhoneOpen(source, fallbackOpen) {
    mergeStoryPhoneLauncherDebug({ openSource: source || 'app_unknown' });
    if (typeof globalThis.STStoryPhoneOpenNewUI === 'function') {
        return globalThis.STStoryPhoneOpenNewUI(source || 'app_unknown');
    }
    if (typeof fallbackOpen === 'function') return fallbackOpen();
    return null;
}

function getLauncherPositionKey() {
    return `${STORAGE_PREFIX}:launcher_position`;
}

function readLauncherPosition() {
    return safeStorageJson(getLauncherPositionKey(), {});
}

function rememberLauncherPosition(left, top) {
    safeStorageSet(getLauncherPositionKey(), JSON.stringify({ left, top }));
}

function clearLauncherPosition() {
    safeStorageRemove(getLauncherPositionKey());
}

function getPhoneWindowPositionKey() {
    return `${STORAGE_PREFIX}:phone_window_position`;
}

function readPhoneWindowPosition() {
    return safeStorageJson(getPhoneWindowPositionKey(), {});
}

function rememberPhoneWindowPosition(left, top) {
    safeStorageSet(getPhoneWindowPositionKey(), JSON.stringify({ left, top }));
}

function clearPhoneWindowPosition() {
    safeStorageRemove(getPhoneWindowPositionKey());
}

function clampLauncherPosition(left, top, width = 48, height = 48) {
    return {
        left: Math.max(4, Math.min(window.innerWidth - width - 4, left)),
        top: Math.max(48, Math.min(window.innerHeight - height - 4, top)),
    };
}

function clampPhoneWindowPosition(left, top, width = 420, height = 760, visiblePixels = 40) {
    return {
        left: Math.max(visiblePixels - width, Math.min(window.innerWidth - visiblePixels, left)),
        top: Math.max(visiblePixels - height, Math.min(window.innerHeight - visiblePixels, top)),
    };
}

function applyLauncherPosition(shell, preferred) {
    if (!shell) return;
    const width = shell.offsetWidth || 48;
    const height = shell.offsetHeight || 48;
    const saved = preferred && typeof preferred === 'object' ? preferred : readLauncherPosition();
    const initialLeft = typeof saved.left === 'number' ? saved.left : Math.max(12, window.innerWidth - width - 24);
    const initialTop = typeof saved.top === 'number' ? saved.top : Math.max(56, Math.min(window.innerHeight - height - 120, 104));
    const clamped = clampLauncherPosition(initialLeft, initialTop, width, height);
    shell.style.left = `${clamped.left}px`;
    shell.style.top = `${clamped.top}px`;
    shell.style.right = 'auto';
    shell.style.bottom = 'auto';
    shell.style.transform = 'none';
}

function clampText(text, max = 1200) {
    if (!text) return '';
    const value = String(text);
    return value.length > max ? `${value.slice(0, max)}...` : value;
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function uniqueArray(values) {
    return [...new Set(asArray(values).filter(Boolean))];
}

function normalizeSpeakerId(id) {
    if (typeof id === 'object' && id !== null) return normalizeSpeakerId(id.speakerId);
    if (!id) return '';
    const value = String(id).trim();
    if (value === 'character') return 'char';
    return value;
}

function plainText(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
}

function normalizeVisibility(input, fallback = {}) {
    if (typeof input === 'object' && input !== null && 'system' in input) {
        return {
            system: true,
            user: Boolean(input.user),
            char: Boolean(input.char),
            npcs: uniqueArray(input.npcs),
            groups: uniqueArray(input.groups),
            public: Boolean(input.public),
            player: Boolean(input.player),
        };
    }

    const visibility = typeof input === 'string' ? input : fallback.visibility || 'user_only';
    const actorId = fallback.actorId || fallback.actor || null;
    const targetId = fallback.targetId || fallback.target || null;
    const npcs = uniqueArray([fallback.npcId, actorId, targetId].filter((id) => id && id !== 'user' && id !== 'char' && id !== 'system'));
    const isChar = actorId === 'char' || targetId === 'char' || fallback.isChar;

    const groups = uniqueArray(fallback.groups || (fallback.groupId ? [fallback.groupId] : []));

    if (visibility === 'public') return { system: true, user: true, char: true, npcs, groups, public: true, player: true };
    if (visibility === 'system_only') return { system: true, user: false, char: false, npcs: [], groups: [], public: false, player: false };
    if (visibility === 'player_visible') return { system: true, user: false, char: false, npcs: [], groups: [], public: false, player: true };
    if (visibility === 'char_private') return { system: true, user: false, char: true, npcs: [], groups: [], public: false, player: true };
    if (visibility === 'user_only') return { system: true, user: Boolean(fallback.user ?? true), char: false, npcs: [], groups: [], public: false, player: Boolean(fallback.player ?? true) };
    if (visibility === 'visible_to_char') return { system: true, user: Boolean(fallback.user ?? true), char: true, npcs: [], groups: [], public: false, player: Boolean(fallback.player ?? true) };
    if (visibility === 'visible_to_group') return { system: true, user: Boolean(fallback.user ?? true), char: Boolean(isChar), npcs, groups, public: false, player: Boolean(fallback.player ?? true) };
    if (visibility === 'visible_to_npc') return { system: true, user: Boolean(fallback.user ?? true), char: Boolean(isChar), npcs, groups: [], public: false, player: Boolean(fallback.player ?? true) };
    return { system: true, user: Boolean(fallback.user ?? true), char: false, npcs: [], groups: [], public: false, player: Boolean(fallback.player ?? true) };
}

function visibilityToLegacyLabel(visibility) {
    if (!visibility) return 'user_only';
    if (visibility.public) return 'public';
    if (visibility.player && !visibility.user && visibility.char) return 'char_private';
    if (visibility.player && !visibility.user) return 'player_visible';
    if (visibility.groups?.length) return 'visible_to_group';
    if (visibility.char && !visibility.npcs?.length) return 'visible_to_char';
    if (visibility.npcs?.length && !visibility.public) return 'visible_to_npc';
    if (visibility.user) return 'user_only';
    return 'system_only';
}

function isVisibleToSpeaker(event, speakerId) {
    const id = normalizeSpeakerId(speakerId);
    const visibility = normalizeVisibility(event?.visibility);
    if (id === 'system') return true;
    if (id === 'player') return visibility.player || visibility.user || visibility.public;
    if (id === 'user') return visibility.user;
    if (id === 'char') return visibility.char || visibility.public;
    const profileGroups = asArray(event?.meta?.groupMembersBySpeaker?.[id]);
    return visibility.public || visibility.npcs.includes(id) || visibility.groups.some((groupId) => profileGroups.includes(groupId));
}

function contentNeedles(text) {
    return plainText(text)
        .replace(/\s+/g, ' ')
        .split(/[。！？!?；;，,\n]/)
        .map((part) => part.trim())
        .filter((part) => part.length >= 8)
        .slice(0, 20);
}

function getContext() {
    if (typeof stGetContext === 'function') return stGetContext() || {};
    if (!globalThis.SillyTavern?.getContext) return {};
    return globalThis.SillyTavern.getContext() || {};
}

function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[char]);
}

function avatarText(value) {
    const text = String(value || '?').trim();
    return text ? text.slice(0, 2).toUpperCase() : '?';
}

function actorDisplayName(profile, idOrName) {
    const value = String(idOrName || '');
    if (!value || value === 'user') return '我';
    if (value === 'char' || value === profile?.currentChar?.id) return profile?.currentChar?.name || profile?.targetPhoneOwner || '角色';
    return asArray(profile?.friends).find((friend) => friend.id === value || friend.name === value)?.name || value;
}

function profileSelectableTargets(profile) {
    const current = profile?.currentChar || {};
    const charTarget = {
        id: current.id || 'char',
        name: current.name || profile?.targetPhoneOwner || '当前角色',
        type: 'char',
    };
    const friends = asArray(profile?.friends).map((friend) => ({
        id: friend.id || friend.name,
        name: friend.name || friend.id,
        type: 'npc',
    }));
    const groups = asArray(profile?.groups).map((group) => ({
        id: group.id,
        name: group.name || group.id,
        type: 'group',
    }));
    return [charTarget, ...friends, ...groups].filter((item) => item.id && item.name);
}

function normalizeMomentVisibility(mode, selected = [], excluded = []) {
    return {
        mode: mode || 'public',
        selected: uniqueArray(selected),
        excluded: uniqueArray(excluded),
    };
}

function buildMomentVisibility(profile, scope = {}) {
    const normalized = normalizeMomentVisibility(scope.mode, scope.selected, scope.excluded);
    const allNpcIds = asArray(profile?.friends).map((friend) => friend.id).filter(Boolean);
    const selected = normalized.mode === 'selected' ? normalized.selected : allNpcIds;
    const excluded = normalized.mode === 'exclude' ? normalized.excluded : [];
    const npcs = selected.filter((id) => !excluded.includes(id) && id !== 'char' && id !== 'user');
    const charVisible = normalized.mode !== 'private'
        && (normalized.mode !== 'selected' || selected.includes('char') || selected.includes(profile?.currentChar?.id))
        && !excluded.includes('char')
        && !excluded.includes(profile?.currentChar?.id);
    return {
        system: true,
        user: true,
        char: Boolean(charVisible),
        npcs,
        groups: normalized.selected.filter((id) => asArray(profile?.groups).some((group) => group.id === id)),
        public: normalized.mode === 'public',
        player: true,
    };
}

function speakerIsChar(profile, speakerId) {
    const id = normalizeSpeakerId(speakerId);
    const current = profile?.currentChar || {};
    return id === 'char' || id === current.id || id === current.name || id === profile?.targetPhoneOwner;
}

function getSpeakerProfile(profile, speakerId) {
    const id = normalizeSpeakerId(speakerId);
    if (speakerIsChar(profile, id)) return profile?.currentChar || {};
    return asArray(profile?.friends).find((friend) => friend.id === id || friend.name === id) || {};
}

function speakerHasChannel(profile, speakerId, channelId) {
    const id = normalizeSpeakerId(speakerId);
    if (id === 'system' || id === 'user' || id === 'player') return true;
    if (id === 'public_channel' || id === `channel:${channelId}`) return true;
    const speaker = getSpeakerProfile(profile, id);
    const explicit = asArray(speaker.channels);
    if (explicit.length) return explicit.includes(channelId);
    const channel = asArray(profile?.publicChannels).find((item) => item.id === channelId);
    return ['all', 'public', 'everyone'].includes(String(channel?.audience || '').toLowerCase());
}

function eventPublicChannel(event) {
    if (event?.source === EVENT_SOURCES.FORUM) return 'forum';
    if (event?.source === EVENT_SOURCES.MOMENTS) return 'moments';
    return null;
}

function publicEventVisibleToSpeaker(profile, event, speakerId) {
    const id = normalizeSpeakerId(speakerId);
    const visibility = normalizeVisibility(event?.visibility);
    if (!visibility.public) return false;
    if (id === 'system' || id === 'user' || id === 'player') return true;
    const channelId = eventPublicChannel(event);
    if (!channelId) return true;
    return speakerHasChannel(profile, id, channelId);
}

function channelFromSource(source, type = '') {
    if (source === EVENT_SOURCES.WECHAT) return type === 'group_message' || type === 'group_chat' ? 'wechat_group' : 'wechat_private';
    if (source === EVENT_SOURCES.MOMENTS) return 'moments';
    if (source === EVENT_SOURCES.FORUM) return 'forum';
    if (source === EVENT_SOURCES.MEMO) return 'memo';
    if (source === EVENT_SOURCES.CALENDAR) return 'calendar';
    if (source === EVENT_SOURCES.TARGET_PHONE) return 'target_phone';
    if (source === EVENT_SOURCES.MAIN_CHAT) return 'main_chat';
    return source || '';
}

function resolveProfileActorId(profile, value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw === 'user' || raw === 'player' || raw === 'system') return raw;
    if (speakerIsChar(profile, raw)) return 'char';
    const npc = asArray(profile?.friends).find((friend) => friend.id === raw || friend.name === raw);
    return npc?.id || raw;
}

function momentVisibilityLabel(profile, scope = {}) {
    const normalized = normalizeMomentVisibility(scope.mode, scope.selected, scope.excluded);
    const nameOf = (id) => profileSelectableTargets(profile).find((item) => item.id === id)?.name || id;
    if (normalized.mode === 'private') return '仅自己可见';
    if (normalized.mode === 'selected') return `仅 ${normalized.selected.map(nameOf).join('、') || '指定对象'} 可见`;
    if (normalized.mode === 'exclude') return `${normalized.excluded.map(nameOf).join('、') || '指定对象'} 不可见`;
    if (normalized.mode === 'friends') return '好友可见';
    return '公开';
}

function shieldStoryPhonePointer(element, onActivate) {
    if (!element || element.__stpShielded) return;
    element.__stpShielded = true;
    ['pointerdown', 'mousedown', 'touchstart'].forEach((type) => {
        element.addEventListener(type, (event) => {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
        }, true);
    });
    element.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        if (typeof onActivate === 'function') onActivate(event);
    }, true);
}

function fileToDataUrl(file, maxBytes = 2 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
        if (!file) return resolve(null);
        if (!file.type?.startsWith('image/')) return reject(new Error('只能选择图片文件'));
        if (file.size > maxBytes) return reject(new Error('图片太大，请选择 2MB 以内的图片'));
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('图片读取失败'));
        reader.readAsDataURL(file);
    });
}

function mountBootBubble() {
    if (document.getElementById('st-story-phone') || document.getElementById('st-story-phone-boot-bubble')) return;
    const bubble = createElement('button', 'stp-bubble stp-boot-bubble', 'Phone');
    bubble.id = 'st-story-phone-boot-bubble';
    bubble.type = 'button';
    bubble.title = 'ST-StoryPhone 正在启动';
    shieldStoryPhonePointer(bubble, () => requestStoryPhoneOpen('boot_bubble', () => bootStoryPhone()));
    bubble.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        requestStoryPhoneOpen('boot_bubble_pointerdown', () => bootStoryPhone());
    }, true);
    document.body.appendChild(bubble);
    storyPhoneRuntimeDebug.launcherMounted = true;
}

function removeStoryPhoneDomDuplicates() {
    const selectors = [
        '#st-storyphone-launcher',
        '#st-storyphone-root',
        '#st-storyphone-modal',
        '.storyphone-launcher',
        '.storyphone-root',
        '.storyphone-modal',
        '#st-story-phone-launcher',
        '#st-story-phone-fallback',
        '#st-story-phone-diagnostics',
        '#st-story-phone-toast',
        '.stp-boot-bubble',
    ];
    let removed = 0;
    selectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((node) => {
            if (node.id === 'st-story-phone' && node.classList.contains('stp-phone-shell')) return;
            node.remove();
            removed += 1;
        });
    });
    const roots = Array.from(document.querySelectorAll('#st-story-phone, .stp-phone-shell'));
    roots.slice(1).forEach((node) => {
        node.remove();
        removed += 1;
    });
    storyPhoneRuntimeDebug.duplicateNodesRemoved += removed;
    return removed;
}

function cleanStoryPhoneUiState(reason = 'manual') {
    const cleaned = [];
    const cleanedOpenState = [];
    const keys = [];
    try {
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (key) keys.push(key);
        }
    } catch (error) {
        storyPhoneRuntimeDebug.storageReadable = false;
        console.warn(`${EXTENSION_ID}: cannot enumerate storage`, error);
    }
    const uiPatterns = [
        /^st_story_phone_launcher_pos$/,
        /^st_story_phone:(phone_position|launcher|layout|modal|icon|render|debug|ui)/,
        /^st-story-phone/i,
        /^storyphone[-_:]?(launcher|layout|modal|ui|open|lastopen|active)/i,
    ];
    const isOpenStateStorageKey = (key) => (
        STORYPHONE_OPEN_STATE_STORAGE_KEYS.includes(key)
        || STORYPHONE_OPEN_STATE_KEY_PATTERNS.some((pattern) => pattern.test(key))
        || /^st_story_phone:(old[-_]?layout|layout|modal|launcher).*open/i.test(key)
    );
    keys.forEach((key) => {
        if (key === STORYPHONE_VERSION_KEY) return;
        if (isOpenStateStorageKey(key)) {
            if (safeStorageRemove(key)) {
                cleaned.push(key);
                cleanedOpenState.push(key);
            }
        }
    });
    keys.forEach((key) => {
        if (key === STORYPHONE_VERSION_KEY || cleaned.includes(key)) return;
        if (uiPatterns.some((pattern) => pattern.test(key))) {
            if (safeStorageRemove(key)) cleaned.push(key);
        }
    });
    keys.filter((key) => key.startsWith(`${STORAGE_PREFIX}:`) && !cleaned.includes(key)).forEach((key) => {
        const state = safeStorageJson(key, null);
        if (!state || typeof state !== 'object') return;
        const removedFields = removeStoryPhoneOpenStateFields(state);
        ['selectedTab', 'renderCache', 'iconState'].forEach((field) => {
            if (field in state) {
                delete state[field];
                removedFields.push(field);
            }
        });
        if (removedFields.length && safeStorageSet(key, JSON.stringify(state))) {
            cleaned.push(`${key}:ui-fields`);
            cleanedOpenState.push(...removedFields.map((field) => `${key}.${field}`));
        }
    });
    storyPhoneRuntimeDebug.cleanedKeys = uniqueArray([...storyPhoneRuntimeDebug.cleanedKeys, ...cleaned]);
    storyPhoneRuntimeDebug.cleanedOpenStateKeys = uniqueArray([...storyPhoneRuntimeDebug.cleanedOpenStateKeys, ...cleanedOpenState]);
    storyPhoneRuntimeDebug.openStateCleared = true;
    console.info(`${EXTENSION_ID}: UI state cleaned`, { reason, cleaned, cleanedOpenState });
    return cleaned;
}

function cleanStoryPhoneOpenState(reason = 'boot') {
    const cleanedOpenState = [];
    const keys = [];
    try {
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (key) keys.push(key);
        }
    } catch (error) {
        storyPhoneRuntimeDebug.storageReadable = false;
        console.warn(`${EXTENSION_ID}: cannot enumerate storage`, error);
    }
    const isOpenStateStorageKey = (key) => (
        STORYPHONE_OPEN_STATE_STORAGE_KEYS.includes(key)
        || STORYPHONE_OPEN_STATE_KEY_PATTERNS.some((pattern) => pattern.test(key))
        || /^st_story_phone:(old[-_]?layout|layout|modal|launcher).*open/i.test(key)
    );
    keys.forEach((key) => {
        if (key === STORYPHONE_VERSION_KEY) return;
        if (isOpenStateStorageKey(key) && safeStorageRemove(key)) cleanedOpenState.push(key);
    });
    keys.filter((key) => key.startsWith(`${STORAGE_PREFIX}:`)).forEach((key) => {
        if (cleanedOpenState.includes(key)) return;
        const state = safeStorageJson(key, null);
        if (!state || typeof state !== 'object') return;
        const removedFields = removeStoryPhoneOpenStateFields(state);
        if (removedFields.length && safeStorageSet(key, JSON.stringify(state))) {
            cleanedOpenState.push(...removedFields.map((field) => `${key}.${field}`));
        }
    });
    storyPhoneRuntimeDebug.cleanedOpenStateKeys = uniqueArray([...storyPhoneRuntimeDebug.cleanedOpenStateKeys, ...cleanedOpenState]);
    storyPhoneRuntimeDebug.cleanedKeys = uniqueArray([...storyPhoneRuntimeDebug.cleanedKeys, ...cleanedOpenState]);
    storyPhoneRuntimeDebug.openStateCleared = true;
    console.info(`${EXTENSION_ID}: open UI state cleaned`, { reason, cleanedOpenState });
    return cleanedOpenState;
}

function migrateStoryPhoneStateIfNeeded() {
    try {
        storyPhoneRuntimeDebug.lastBootStep = 'migration';
        const storedVersion = safeStorageGet(STORYPHONE_VERSION_KEY, '');
        storyPhoneRuntimeDebug.storedVersion = storedVersion || null;
        cleanStoryPhoneOpenState('boot default closed');
        if (storedVersion !== STORYPHONE_VERSION) {
            storyPhoneRuntimeDebug.migrationRan = true;
            cleanStoryPhoneUiState(storedVersion ? `version ${storedVersion} -> ${STORYPHONE_VERSION}` : 'legacy version');
            safeStorageSet(STORYPHONE_VERSION_KEY, STORYPHONE_VERSION);
        }
    } catch (error) {
        storyPhoneRuntimeDebug.lastBootError = {
            message: error.message,
            stack: error.stack,
        };
        console.warn(`${EXTENSION_ID}: migration failed but boot will continue`, error);
    }
    return storyPhoneRuntimeDebug;
}

class StorageManager {
    constructor() {
        this.memory = {};
    }

    getKey(scope) {
        return `${STORAGE_PREFIX}:${scope || 'global'}`;
    }

    load(scope, fallback) {
        const key = this.getKey(scope);
        try {
            const raw = safeStorageGet(key, '');
            if (!raw) return cloneValue(fallback);
            return { ...cloneValue(fallback), ...safeJsonParse(raw, fallback) };
        } catch {
            return this.memory[key] || cloneValue(fallback);
        }
    }

    save(scope, value) {
        const key = this.getKey(scope);
        this.memory[key] = value;
        try {
            const persisted = stripStoryPhoneOpenStateForSave(value);
            if (persisted?.settings) persisted.settings.apiKey = '';
            safeStorageSet(key, JSON.stringify(persisted));
        } catch {
            // localStorage may be unavailable in hardened WebViews; in-memory storage keeps the session usable.
        }
    }
}

class ContextCollector {
    collect() {
        const context = getContext();
        const character = this.getCurrentCharacter(context);
        const chat = asArray(context.chat);
        return {
            character,
            characterSummary: this.summarizeCharacter(character, context),
            worldInfoSummary: this.summarizeWorldInfo(context),
            recentHistory: this.summarizeHistory(chat),
            persona: this.summarizePersona(context),
            status: this.summarizeStatus(context),
            chatId: this.getChatId(context, character),
        };
    }

    getCurrentCharacter(context) {
        const id = context.characterId ?? context.character_id ?? context.chid;
        const characters = context.characters || {};
        if (Array.isArray(characters)) return characters[id] || {};
        return characters[id] || context.character || {};
    }

    getChatId(context, character) {
        return [
            context.chatId || context.chat_id || context.chatMetadata?.file_name || 'chat',
            character?.avatar || character?.name || context.name2 || 'character',
        ].join('::');
    }

    summarizeCharacter(character, context) {
        return {
            id: String(context.characterId ?? context.character_id ?? context.chid ?? character?.id ?? 'char'),
            name: character?.name || context.name2 || '当前角色',
            description: clampText(character?.description || character?.data?.description || ''),
            personality: clampText(character?.personality || character?.data?.personality || ''),
            scenario: clampText(character?.scenario || character?.data?.scenario || ''),
            extensions: character?.extensions || character?.data?.extensions || {},
        };
    }

    summarizeWorldInfo(context) {
        const names = context.world_names || context.worldInfo?.selectedWorlds || context.worldInfoSettings?.world_info || [];
        const entries = context.worldInfo?.entries || context.world_info?.entries || [];
        return {
            worlds: asArray(names).slice(0, 12),
            activeEntries: asArray(entries).slice(0, 20).map((entry) => ({
                key: clampText(entry.key || entry.keys || entry.comment || '', 160),
                content: clampText(entry.content || entry.entry || '', 400),
            })),
        };
    }

    summarizeHistory(chat) {
        return chat.slice(-18).map((message) => ({
            name: message.name || (message.is_user ? 'User' : 'Character'),
            role: message.is_system ? 'system' : message.is_user ? 'user' : 'assistant',
            text: clampText(message.mes || message.text || '', 500),
        }));
    }

    summarizePersona(context) {
        const persona = context.power_user?.persona || context.persona || {};
        return {
            name: context.name1 || persona.name || '用户',
            description: clampText(persona.description || context.persona_description || context.power_user?.persona_description || ''),
        };
    }

    summarizeStatus(context) {
        return {
            chatName: context.chat?.name || context.chatMetadata?.name || '',
            mainApi: context.main_api || context.extensionSettings?.main_api || '',
            model: context.chatCompletionSettings?.model || context.textgenerationwebui_settings?.model || '',
        };
    }
}

class KnowledgeTimelineAuditor {
    constructor(state) {
        this.state = state;
    }

    get profile() {
        return this.state.profile || DEFAULT_PROFILE;
    }

    get storyClock() {
        return this.state.storyClock || { storyDay: this.state.time || '未设定', timeText: '', orderIndex: 0 };
    }

    getNpcProfile(speakerId) {
        return getSpeakerProfile(this.profile, speakerId);
    }

    canSee(event, speakerId) {
        const id = normalizeSpeakerId(speakerId);
        const visibility = normalizeVisibility(event?.visibility);
        if (id === 'system') return true;
        const knownBy = asArray(event?.knownBy);
        if (knownBy.includes(id)) return true;
        if (speakerIsChar(this.profile, id) && knownBy.includes(this.profile?.currentChar?.id)) return true;
        if (id === 'player') return visibility.player || visibility.user || visibility.public;
        if (id === 'user') return visibility.user;
        if (visibility.public && eventPublicChannel(event)) return publicEventVisibleToSpeaker(this.profile, event, id);
        if (speakerIsChar(this.profile, id)) return visibility.char || publicEventVisibleToSpeaker(this.profile, event, id);
        if (publicEventVisibleToSpeaker(this.profile, event, id)) return true;
        if (visibility.npcs.includes(id)) return true;
        if (!visibility.groups.length) return false;
        return asArray(this.profile.groups).some((group) => (
            visibility.groups.includes(group.id) && asArray(group.members).includes(id)
        ));
    }

    eventToFact(event) {
        return {
            id: event.id,
            source: event.source,
            type: event.type,
            actor: event.actor,
            target: event.target,
            content: event.content,
            timestamp: event.timestamp,
            consequences: event.consequences || [],
            status: event.status,
            injectToMain: event.injectToMain,
        };
    }

    buildContextForSpeaker(speakerId) {
        const id = normalizeSpeakerId(speakerId);
        const allEvents = asArray(this.state.eventLog);
        const visible = allEvents.filter((event) => this.canSee(event, id));
        const hidden = allEvents.filter((event) => !this.canSee(event, id));
        const facts = asArray(this.state.knowledgeGraph);
        const visibleFacts = facts.filter((fact) => this.canSee(fact, id));
        const hiddenFacts = facts.filter((fact) => !this.canSee(fact, id));
        const speakerProfile = this.getNpcProfile(id);

        return {
            speakerId: id,
            speakerProfile,
            storyClock: this.storyClock,
            visibleMainEvents: visible.filter((event) => event.source === EVENT_SOURCES.MAIN_CHAT).map((event) => this.eventToFact(event)),
            visiblePhoneEvents: visible.filter((event) => event.source !== EVENT_SOURCES.MAIN_CHAT).map((event) => this.eventToFact(event)),
            knownFacts: [
                ...visibleFacts,
                ...asArray(speakerProfile.knows).map((fact) => ({ source: 'profile.knows', content: fact, visibility: normalizeVisibility('public') })),
            ],
            unknownFacts: asArray(speakerProfile.doesNotKnow).map((fact) => ({ source: 'profile.doesNotKnow', content: fact })),
            forbiddenFacts: [
                ...hidden.map((event) => ({
                    id: event.id,
                    source: event.source,
                    type: event.type,
                    content: event.content,
                    reason: 'speaker_visibility_boundary',
                })),
                ...hiddenFacts.map((fact) => ({
                    id: fact.id,
                    source: 'knowledgeGraph',
                    type: fact.type || 'fact',
                    content: fact.content || fact.summary || plainText(fact),
                    reason: 'fact_visibility_boundary',
                })),
                ...asArray(speakerProfile.doesNotKnow).map((fact) => ({
                    source: 'profile.doesNotKnow',
                    type: 'npc_scope_error',
                    content: fact,
                    reason: 'profile_explicit_unknown',
                })),
            ],
        };
    }

    resolveVisibleContext(speakerId) {
        return this.buildContextForSpeaker(speakerId);
    }

    buildPromptWithVisibilityBoundary(speakerId, taskType, payload = {}) {
        const context = this.resolveVisibleContext(speakerId);
        return [
            '【Knowledge & Timeline Consistency Boundary】',
            `speakerId: ${context.speakerId}`,
            `taskType: ${taskType}`,
            'Generated items must name their acting speaker with actorId or speakerId when they represent an NPC, forum poster, or moments author.',
            `当前剧情时间: ${JSON.stringify(context.storyClock)}`,
            `当前事件顺序 orderIndex: ${context.storyClock.orderIndex}`,
            `当前请求: ${JSON.stringify(payload)}`,
            '规则：模型只能使用【该角色可见信息】。禁止把【禁止提及的信息】当成角色知道的内容。',
            '规则：system 可以知道全部，但 speaker 不能引用没有合法传播链的信息。',
            '规则：不得提前泄露未来事件，不得让 NPC 在事件发生前知道结果。',
            '规则：system_only/user_only/其他NPC私聊不能被 speaker 直接提及，除非可见信息中已有明确传播链。',
            `【该角色可见主对话事件】${JSON.stringify(context.visibleMainEvents.slice(-20))}`,
            `【该角色可见手机事件】${JSON.stringify(context.visiblePhoneEvents.slice(-20))}`,
            `【该角色知道的信息】${JSON.stringify(context.knownFacts.slice(-30))}`,
            `【该角色不知道的信息】${JSON.stringify(context.unknownFacts.slice(-30))}`,
            `【禁止提及的信息】${JSON.stringify(context.forbiddenFacts.slice(-30))}`,
        ].join('\n');
    }

    auditKnowledgeConsistency(generatedContent, speakerId, context = this.buildContextForSpeaker(speakerId)) {
        const text = plainText(generatedContent);
        const issues = [];
        const clock = this.storyClock;

        context.forbiddenFacts.forEach((fact) => {
            contentNeedles(fact.content).forEach((needle) => {
                if (needle && text.includes(needle)) {
                    issues.push({
                        type: fact.type === 'npc_scope_error' ? 'npc_scope_error' : 'forbidden_knowledge',
                        detail: `speaker ${context.speakerId} 提到了不可见信息：${clampText(needle, 120)}`,
                        suggestedFix: '删除该信息，或改写为角色只基于自己可见事实做出的模糊反应。',
                    });
                }
            });
        });

        const visibleSourceIds = new Set([
            ...context.visibleMainEvents.map((event) => event.id),
            ...context.visiblePhoneEvents.map((event) => event.id),
        ]);
        asArray(this.state.eventLog).forEach((event) => {
            if (visibleSourceIds.has(event.id)) return;
            const visibility = normalizeVisibility(event.visibility);
            const privateSource = !visibility.public || ['phone_wechat', 'phone_memo', 'target_phone'].includes(event.source);
            const actorOrTarget = [event.actor, event.target].filter(Boolean).map((value) => actorDisplayName(this.profile, value));
            const mentionsParticipant = actorOrTarget.some((name) => name && name.length >= 2 && text.includes(name));
            const mentionsContent = contentNeedles(event.content).some((needle) => text.includes(needle));
            if (privateSource && mentionsParticipant && mentionsContent) {
                issues.push({
                    type: 'visibility_error',
                    detail: `speaker ${context.speakerId} appears to use a private event without a visible propagation chain: ${event.id}`,
                    suggestedFix: 'Remove the private detail, or first add an explicit tell/share/publicize event that makes it visible to this speaker.',
                });
            }
        });

        const futureEvents = asArray(this.state.eventLog).filter((event) => {
            const order = Number(event.timestamp?.orderIndex ?? 0);
            return order > Number(clock.orderIndex ?? 0) && text.includes(clampText(event.content, 80));
        });
        futureEvents.forEach((event) => {
            issues.push({
                type: 'timeline_error',
                detail: `生成内容引用了未来事件：${event.id}`,
                suggestedFix: '移除未来结果，只保留当前时间点已经发生或合理预期的信息。',
            });
        });

        if (/system_only|系统全局信息|禁止提及的信息/.test(text)) {
            issues.push({
                type: 'visibility_error',
                detail: '生成内容泄露了边界提示或 system_only 标记。',
                suggestedFix: '用角色自然语言重写，不暴露系统标签、审计字段或隐藏摘要。',
            });
        }

        if (context.speakerId === 'user' && /player_visible|char_private|角色侧屏|未发送草稿/.test(text)) {
            issues.push({
                type: 'visibility_error',
                detail: '生成内容可能把 player_visible / char_private 信息自动转成了 user 已知。',
                suggestedFix: '除非存在明确可见性转换事件，否则 {{user}} 不能基于角色侧屏私有信息行动。',
            });
        }

        return {
            ok: issues.length === 0,
            issues,
            safeContentSuggestion: issues.length
                ? '请只根据可见信息重写，避开禁止事实、未来事件和系统边界标签。'
                : null,
        };
    }

    summarizeForMainChat(speakerId = 'char') {
        const context = this.buildContextForSpeaker(speakerId);
        const visibleEvents = context.visiblePhoneEvents
            .filter((event) => event.status !== 'expired' && event.injectToMain !== false)
            .slice(-12)
            .map((event) => `- [${event.source}/${event.type}] ${event.content}`);
        const forbidden = context.forbiddenFacts.slice(-12).map((fact) => `- ${clampText(fact.content, 140)}`);

        if (!visibleEvents.length && !forbidden.length) return '';
        return [
            '[StoryPhone hidden speaker-filtered context]',
            `当前主对话 speaker=${speakerId}。只能使用该 speaker 合理可见的信息。`,
            '【speaker 可见手机事件】',
            ...visibleEvents,
            '【speaker 禁止知道/禁止提及】',
            ...forbidden,
            '不要让 speaker 提及 forbiddenFacts；不要把其他NPC私聊、user_only、system_only 当成已知事实。',
        ].join('\n');
    }
}

class VisibilityManager extends KnowledgeTimelineAuditor {}

class SharedStoryState {
    constructor(storage, scope) {
        this.storage = storage;
        this.scope = scope;
        this.data = storage.load(scope, this.createDefault());
        this.migrate();
    }

    createDefault() {
        return {
            version: 1,
            time: '',
            location: '',
            phase: '',
            storyClock: {
                storyDay: '未设定',
                timeText: '未设定',
                orderIndex: 0,
            },
            relationship: {},
            mainEvents: [],
            phoneEvents: [],
            eventLog: [],
            pendingEvents: [],
            knowledgeGraph: [],
            phoneEntries: [],
            phoneProfiles: [],
            currentProfileId: null,
            linkedLorebookEntries: [],
            mediaDescriptions: [],
            proactiveQueue: [],
            debug: {
                identityWarnings: [],
                lastIdentityContext: null,
                lastCreatedEvent: null,
                lastKnownBy: [],
                speakerFallbackOccurred: false,
                currentCharMisuseDetected: false,
            },
            phone: {
                chats: {},
                groupChats: {},
                moments: [],
                forumPosts: [],
                calendar: [],
                memos: [],
                targetPhone: {
                    messages: [],
                    memos: [],
                    calendar: [],
                },
                characterSideScreen: {
                    fragments: [],
                    drafts: [],
                    privateMessages: [],
                    memos: [],
                    calendar: [],
                    notifications: [],
                },
            },
            settings: {
                fallbackEnabled: false,
                injectIntoMainContext: true,
                apiEndpoint: safeStorageGet('st_story_phone_api_endpoint', ''),
                apiKey: '',
                apiModel: safeStorageGet('st_story_phone_api_model', ''),
            },
            profile: DEFAULT_PROFILE,
        };
    }

    get value() {
        return this.data;
    }

    save() {
        this.storage.save(this.scope, this.data);
    }

    migrate() {
        const defaults = this.createDefault();
        this.data.storyClock = this.data.storyClock || defaults.storyClock;
        this.data.eventLog = asArray(this.data.eventLog);
        this.data.pendingEvents = asArray(this.data.pendingEvents);
        this.data.phoneEvents = asArray(this.data.phoneEvents);
        this.data.mainEvents = asArray(this.data.mainEvents);
        this.data.knowledgeGraph = asArray(this.data.knowledgeGraph);
        this.data.phoneEntries = asArray(asArray(this.data.phoneEntries).length ? this.data.phoneEntries : this.data.profile?.phoneEntries || defaults.profile.phoneEntries);
        this.data.phoneProfiles = asArray(this.data.phoneProfiles);
        this.data.currentProfileId = this.data.currentProfileId || null;
        this.data.linkedLorebookEntries = asArray(this.data.linkedLorebookEntries);
        this.data.mediaDescriptions = asArray(this.data.mediaDescriptions);
        this.data.proactiveQueue = asArray(this.data.proactiveQueue);
        this.data.debug = { ...defaults.debug, ...(this.data.debug || {}) };
        this.data.debug.identityWarnings = asArray(this.data.debug.identityWarnings);
        this.data.settings = { ...defaults.settings, ...(this.data.settings || {}) };
        this.data.phone = { ...defaults.phone, ...(this.data.phone || {}) };
        this.data.phone.groupChats = this.data.phone.groupChats || {};
        this.data.phone.characterSideScreen = { ...defaults.phone.characterSideScreen, ...(this.data.phone.characterSideScreen || {}) };
        this.data.profile = { ...DEFAULT_PROFILE, ...(this.data.profile || {}) };
        this.data.profile.groups = asArray(this.data.profile.groups);
        this.data.profile.phoneEntries = asArray(this.data.profile.phoneEntries);
        if (!this.data.storyClock.storyDay && this.data.time) this.data.storyClock.storyDay = this.data.time;
        this.save();
    }

    setProfile(profile) {
        const merged = { ...DEFAULT_PROFILE, ...(profile || {}) };
        merged.friends = asArray(merged.friends).map((friend) => ({
            knows: [],
            doesNotKnow: [],
            relations: [],
            ...friend,
        }));
        merged.groups = asArray(merged.groups);
        merged.phoneEntries = asArray(merged.phoneEntries);
        this.data.profile = merged;
        if (!asArray(this.data.phoneEntries).length) this.data.phoneEntries = merged.phoneEntries;
        this.save();
    }

    getCurrentPhoneProfile() {
        return asArray(this.data.phoneProfiles).find((profile) => profile.profileId === this.data.currentProfileId) || null;
    }

    findProfileIdentity(identityId) {
        const profile = this.getCurrentPhoneProfile();
        if (!identityId || !profile?.identities) return null;
        if (profile.identities.user?.id === identityId) return profile.identities.user;
        if (profile.identities.hostChar?.id === identityId) return profile.identities.hostChar;
        return asArray(profile.identities.npcs).find((identity) => identity.id === identityId) || null;
    }

    findProfileContact(identityId) {
        const profile = this.getCurrentPhoneProfile();
        return asArray(profile?.contacts).find((contact) => contact.identityId === identityId) || null;
    }

    findProfileGroup(groupId) {
        const profile = this.getCurrentPhoneProfile();
        return asArray(profile?.groups).find((group) => group.groupId === groupId || group.id === groupId) || null;
    }

    getProfileGroupMembers(groupId) {
        const group = this.findProfileGroup(groupId);
        if (group) return asArray(group.memberIds);
        const legacy = asArray(this.data.profile?.groups).find((item) => item.id === groupId);
        return legacy ? asArray(legacy.members) : [];
    }

    getProfileForumBoard(boardId) {
        const profile = this.getCurrentPhoneProfile();
        return asArray(profile?.forumBoards).find((board) => board.boardId === boardId || board.boardName === boardId) || null;
    }

    getProfileMomentsViewers(config = {}) {
        const profile = this.getCurrentPhoneProfile();
        const moments = { ...(profile?.momentsConfig || {}), ...(config || {}) };
        const mode = moments.visibility || moments.defaultVisibility || 'friends';
        let viewers = [];
        if (mode === 'selected') viewers = asArray(moments.selectedViewers || moments.viewerIds || moments.friendIds);
        else if (mode === 'friends') viewers = asArray(moments.friendIds);
        else if (mode === 'private') viewers = [];
        else viewers = asArray(moments.friendIds);
        const blocked = asArray(moments.blockedViewerIds);
        return uniqueArray(viewers).filter((id) => !blocked.includes(id));
    }

    nextTimestamp() {
        const next = {
            storyDay: this.data.storyClock?.storyDay || this.data.time || '未设定',
            timeText: this.data.storyClock?.timeText || this.data.time || '未设定',
            orderIndex: Number(this.data.storyClock?.orderIndex || 0) + 1,
        };
        this.data.storyClock = next;
        this.data.time = [next.storyDay, next.timeText].filter(Boolean).join(' ');
        return { ...next };
    }

    noteIdentityWarning(message, detail = {}) {
        const warning = { at: nowIso(), message, detail };
        this.data.debug = this.data.debug || {};
        this.data.debug.identityWarnings = asArray(this.data.debug.identityWarnings);
        this.data.debug.identityWarnings.push(warning);
        this.data.debug.identityWarnings = this.data.debug.identityWarnings.slice(-20);
        console.warn(`${EXTENSION_ID} identity warning: ${message}`, detail);
        return warning;
    }

    getHostCharId() {
        return this.data.profile?.currentChar?.id || 'char';
    }

    normalizeSpeakerId(input, options = {}) {
        const explicit = typeof input === 'object' && input !== null ? input.speakerId : input;
        const speakerId = normalizeSpeakerId(explicit);
        if (speakerId) return speakerId;
        if (options.allowHostFallback) {
            const hostCharId = this.getHostCharId();
            this.data.debug.speakerFallbackOccurred = true;
            this.noteIdentityWarning('speakerId missing; falling back to hostCharId only because the caller explicitly allowed host fallback.', {
                hostCharId,
                reason: options.reason || '',
            });
            return hostCharId;
        }
        return '';
    }

    buildIdentityContext(event = {}) {
        const hostCharId = this.getHostCharId();
        const actorId = event.actorId || event.actor || 'system';
        const targetId = event.targetId ?? event.target ?? null;
        const groupId = event.groupId || event.meta?.groupId || null;
        const channel = event.channel || channelFromSource(event.source, event.type);
        const speakerId = this.normalizeSpeakerId(event, {
            allowHostFallback: Boolean(event.allowHostSpeakerFallback),
            reason: event.fallbackReason || 'host character event',
        }) || event.speakerId || actorId;
        const identity = { hostCharId, speakerId, actorId, targetId, groupId, channel };
        this.data.debug.lastIdentityContext = identity;
        if (hostCharId && event.actorId === undefined && event.actor === hostCharId) {
            this.data.debug.currentCharMisuseDetected = true;
            this.noteIdentityWarning('actor defaults look like hostCharId; verify this is not an NPC speaker identity leak.', identity);
        }
        return identity;
    }

    resolveBasicKnownBy(event) {
        const channel = event.channel || channelFromSource(event.source, event.type);
        const actorId = event.actorId || event.actor || 'system';
        const targetId = event.targetId ?? event.target ?? null;
        const groupId = event.groupId || event.meta?.groupId || null;
        const knownBy = ['system'];
        if (channel === 'wechat_private') {
            knownBy.push(actorId, targetId);
        } else if (channel === 'wechat_group') {
            const members = this.getProfileGroupMembers(groupId);
            if (members.length) knownBy.push(...members);
            else {
                knownBy.push(actorId);
                this.noteIdentityWarning('group not found; cannot expand memberIds for wechat_group event.', { groupId, eventId: event.id });
            }
        } else if (channel === 'moments') {
            knownBy.push(actorId, ...this.getProfileMomentsViewers({
                visibility: event.visibilityMode,
                selectedViewers: event.selectedViewers || event.visibilityHint,
            }));
        } else if (channel === 'forum') {
            knownBy.push(actorId);
            const board = this.getProfileForumBoard(event.forumBoardId || event.targetId || event.target);
            if (board?.visibility === 'members_only' || board?.visibility === 'selected') knownBy.push(...asArray(board.memberIds));
        } else if (channel === 'memo' || channel === 'calendar') {
            knownBy.push(actorId);
        } else {
            const visibility = normalizeVisibility(event.visibility);
            knownBy.push(actorId, targetId, ...visibility.npcs, ...visibility.groups);
            if (visibility.char) knownBy.push(this.getHostCharId());
        }
        return uniqueArray(knownBy);
    }

    classifyEvent(event) {
        const knownBy = this.resolveBasicKnownBy(event);
        return {
            ...event,
            knownBy,
            public: event.channel === 'forum' && (event.publicLevel === 'public' || normalizeVisibility(event.visibility).public),
        };
    }

    createPhoneEvent(event = {}) {
        return this.createEvent({
            ...event,
            source: event.source || ({
                wechat_private: EVENT_SOURCES.WECHAT,
                wechat_group: EVENT_SOURCES.WECHAT,
                moments: EVENT_SOURCES.MOMENTS,
                forum: EVENT_SOURCES.FORUM,
                memo: EVENT_SOURCES.MEMO,
                calendar: EVENT_SOURCES.CALENDAR,
                target_phone: EVENT_SOURCES.TARGET_PHONE,
            }[event.channel] || EVENT_SOURCES.WECHAT),
        });
    }

    createEvent(event) {
        const timestamp = event.timestamp || this.nextTimestamp();
        const identity = this.buildIdentityContext(event);
        const visibility = normalizeVisibility(event.visibility, event);
        const classified = this.classifyEvent({ ...event, ...identity, visibility });
        const source = event.source || EVENT_SOURCES.MAIN_CHAT;
        if (identity.actorId && !this.findProfileIdentity(identity.actorId) && !['system', 'anonymous', 'player'].includes(identity.actorId)) {
            this.noteIdentityWarning('actorId not found in current Phone Profile identities.', { actorId: identity.actorId });
        }
        if (identity.targetId && !this.findProfileIdentity(identity.targetId) && !this.findProfileGroup(identity.targetId) && identity.targetId !== 'user') {
            this.noteIdentityWarning('targetId not found in current Phone Profile identities/groups.', { targetId: identity.targetId });
        }
        if (identity.groupId && !this.findProfileGroup(identity.groupId)) {
            this.noteIdentityWarning('groupId not found in current Phone Profile groups.', { groupId: identity.groupId });
        }
        const next = {
            id: event.id || `event_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            source,
            type: event.type || 'event',
            hostCharId: identity.hostCharId,
            speakerId: identity.speakerId,
            actorId: identity.actorId,
            targetId: identity.targetId,
            groupId: identity.groupId,
            channel: identity.channel || channelFromSource(source, event.type),
            actor: identity.actorId || 'system',
            target: identity.targetId ?? null,
            content: clampText(event.content || event.summary || event.title || '', 1800),
            media: asArray(event.media),
            publicLevel: event.publicLevel || (visibility.public ? 'public' : 'private'),
            knownBy: classified.knownBy,
            public: Boolean(classified.public || visibility.public),
            timestamp,
            visibility,
            consequences: asArray(event.consequences),
            status: event.status || 'active',
            injectToMain: event.injectToMain,
            meta: event.meta || {},
        };
        this.data.debug.lastCreatedEvent = next;
        this.data.debug.lastKnownBy = next.knownBy;
        return next;
        /*
        return {
            id: event.id || `event_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            source: event.source || EVENT_SOURCES.MAIN_CHAT,
            type: event.type || 'event',
            actor: event.actor || 'system',
            target: event.target ?? null,
            content: clampText(event.content || event.summary || event.title || '', 1800),
            media: asArray(event.media),
            timestamp,
            visibility,
            consequences: asArray(event.consequences),
            status: event.status || 'active',
            injectToMain: event.injectToMain,
            meta: event.meta || {},
        };
        */
    }

    addEvent(event) {
        const next = this.createEvent(event);
        this.data.eventLog.push(next);
        if (next.source === EVENT_SOURCES.MAIN_CHAT) this.data.mainEvents.push(next);
        else {
            this.data.phoneEvents.push({
                ...next,
                at: nowIso(),
                eventId: next.id,
                summary: event.summary || next.content,
                legacyVisibility: visibilityToLegacyLabel(next.visibility),
            });
        }
        this.save();
        return next;
    }

    addPendingEvent(event, trigger = {}) {
        const pending = this.createEvent({ ...event, status: 'pending' });
        this.data.pendingEvents.push({
            ...pending,
            trigger: {
                afterTurns: Number(trigger.afterTurns || 0),
                afterTime: trigger.afterTime || null,
                triggerWhen: trigger.triggerWhen || null,
            },
        });
        this.save();
        return pending;
    }

    resolvePendingEvents(reason = '') {
        const currentOrder = Number(this.data.storyClock?.orderIndex || 0);
        const activated = [];
        this.data.pendingEvents = this.data.pendingEvents.filter((event) => {
            const trigger = event.trigger || {};
            const baseOrder = Number(event.timestamp?.orderIndex || 0);
            const afterTurnsMet = trigger.afterTurns ? currentOrder - baseOrder >= Number(trigger.afterTurns) : false;
            const triggerTextMet = trigger.triggerWhen ? reason.includes(trigger.triggerWhen) : false;
            // TODO: SillyTavern does not expose a canonical story-time parser here; afterTime is kept as testable metadata.
            const afterTimeMet = false;
            if (!afterTurnsMet && !triggerTextMet && !afterTimeMet) return true;
            activated.push({ ...event, status: 'active', timestamp: this.nextTimestamp() });
            return false;
        });
        activated.forEach((event) => {
            this.data.eventLog.push(event);
            if (event.source !== EVENT_SOURCES.MAIN_CHAT) {
                this.data.phoneEvents.push({
                    ...event,
                    at: nowIso(),
                    eventId: event.id,
                    summary: event.summary || event.content,
                    legacyVisibility: visibilityToLegacyLabel(event.visibility),
                });
            }
        });
        this.save();
        return activated;
    }

    getCharId() {
        return this.data.profile?.currentChar?.id || 'char';
    }

    isCharId(idOrName) {
        const value = String(idOrName || '');
        const currentChar = this.data.profile?.currentChar || {};
        return value === 'char' || value === currentChar.id || value === currentChar.name || value === this.data.profile?.targetPhoneOwner;
    }

    addPhoneEvent(event) {
        const source = event.source || EVENT_SOURCES.WECHAT;
        const actorId = event.actorId || event.actor || 'user';
        const targetId = event.targetId ?? event.target ?? null;
        const isCharTarget = this.isCharId(targetId);
        const isCharActor = this.isCharId(actorId);
        const channel = event.channel || channelFromSource(source, event.type);
        const normalizedVisibility = normalizeVisibility(event.visibility, {
            ...event,
            actorId: isCharActor ? this.getHostCharId() : actorId,
            targetId: isCharTarget ? this.getHostCharId() : targetId,
            isChar: isCharActor || isCharTarget,
        });
        const logged = this.addEvent({
            ...event,
            source,
            channel,
            actorId: isCharActor ? this.getHostCharId() : actorId,
            targetId: isCharTarget ? this.getHostCharId() : targetId,
            speakerId: event.speakerId || event.actorId || event.actor || actorId,
            actor: isCharActor ? this.getHostCharId() : actorId,
            target: isCharTarget ? this.getHostCharId() : targetId,
            content: event.content || event.summary || event.title || '',
            visibility: normalizedVisibility,
        });
        const next = this.data.phoneEvents.find((item) => item.eventId === logged.id || item.id === logged.id);
        if (next) {
            Object.assign(next, {
                at: nowIso(),
                ...event,
                id: logged.id,
                eventId: logged.id,
                timestamp: logged.timestamp,
                visibility: logged.visibility,
                legacyVisibility: visibilityToLegacyLabel(logged.visibility),
                summary: event.summary || logged.content,
                content: logged.content,
                status: logged.status,
            });
        }
        this.save();
        return next || logged;
    }

    addKnowledge(fact) {
        this.data.knowledgeGraph.push({
            id: `fact_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            at: nowIso(),
            visibility: 'user_only',
            ...fact,
        });
        this.save();
    }

    buildMainChatHiddenContext(hostCharId = this.getHostCharId()) {
        const visibleEvents = asArray(this.data.eventLog)
            .filter((event) => asArray(event.knownBy).includes(hostCharId))
            .slice(-12)
            .map((event) => ({
                id: event.id,
                channel: event.channel,
                type: event.type,
                actorId: event.actorId,
                targetId: event.targetId,
                content: event.content,
                timestamp: event.timestamp,
            }));
        const unknownEventCount = asArray(this.data.eventLog)
            .filter((event) => !asArray(event.knownBy).includes(hostCharId))
            .length;
        return {
            hostCharId,
            visibleEvents,
            unknownEventCount,
            forbiddenSummary: unknownEventCount ? `${unknownEventCount} phone events are not visible to hostCharId.` : '',
        };
    }

    buildContextForSpeaker(speakerId, options = {}) {
        const id = this.normalizeSpeakerId({ speakerId }, {
            allowHostFallback: Boolean(options.allowHostFallback),
            reason: options.reason || 'buildContextForSpeaker',
        });
        if (!id) {
            this.noteIdentityWarning('buildContextForSpeaker called without speakerId; returning empty context.', { options });
            return { speakerId: '', visibleEvents: [], channelHistory: [], forbiddenFacts: [] };
        }
        const identity = this.findProfileIdentity(id);
        const contact = this.findProfileContact(id);
        if (!identity) this.noteIdentityWarning('buildContextForSpeaker speakerId missing from current Phone Profile.', { speakerId: id });
        const channel = options.channel || null;
        const visibleEvents = asArray(this.data.eventLog).filter((event) => asArray(event.knownBy).includes(id));
        const channelHistory = channel ? visibleEvents.filter((event) => event.channel === channel) : [];
        const forbiddenFacts = asArray(this.data.eventLog)
            .filter((event) => !asArray(event.knownBy).includes(id))
            .slice(-30)
            .map((event) => ({
                id: event.id,
                channel: event.channel,
                type: event.type,
                reason: 'not_in_knownBy',
            }));
        return {
            speakerId: id,
            identity: identity || null,
            displayName: identity?.displayName || id,
            phoneName: contact?.alias || identity?.phoneName || identity?.displayName || id,
            relationshipStage: identity?.relationshipStage || '',
            tags: asArray(identity?.tags),
            contact: contact || null,
            visibleEvents,
            channelHistory,
            forbiddenFacts,
            warning: identity ? '' : 'speakerId not found in current Phone Profile',
        };
    }

    upsertCalendar(item) {
        const entry = { id: item.id || `cal_${Date.now()}`, ...item };
        const index = this.data.phone.calendar.findIndex((existing) => existing.id === entry.id);
        if (index >= 0) this.data.phone.calendar[index] = entry;
        else this.data.phone.calendar.push(entry);
        this.addPhoneEvent({ source: EVENT_SOURCES.CALENDAR, channel: 'calendar', type: 'calendar_edit', speakerId: 'user', actorId: 'user', actor: 'user', summary: `日历更新：${entry.title}`, visibility: 'user_only' });
        this.save();
    }

    addMemo(text) {
        const memo = { id: `memo_${Date.now()}`, text, at: nowIso(), visibility: 'user_only' };
        this.data.phone.memos.unshift(memo);
        this.addPhoneEvent({ source: EVENT_SOURCES.MEMO, channel: 'memo', type: 'memo_add', speakerId: 'user', actorId: 'user', actor: 'user', summary: `新增备忘录：${clampText(text, 80)}`, visibility: 'user_only' });
        this.save();
        return memo;
    }

    deleteMemo(id) {
        this.data.phone.memos = this.data.phone.memos.filter((memo) => memo.id !== id);
        this.addPhoneEvent({ source: EVENT_SOURCES.MEMO, channel: 'memo', type: 'memo_delete', speakerId: 'user', actorId: 'user', actor: 'user', summary: '删除了一条备忘录', visibility: 'user_only' });
        this.save();
    }

    upsertPhoneEntry(entry) {
        const next = {
            id: entry.id || `phone_entry_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            title: entry.title || 'Untitled Phone Entry',
            type: entry.type || 'custom',
            enabled: entry.enabled !== false,
            priority: Number(entry.priority || 0),
            linkedTargets: {
                characters: [],
                npcs: [],
                groups: [],
                apps: [],
                forumBoards: [],
                relationshipStages: [],
                tags: [],
                ...(entry.linkedTargets || {}),
            },
            linkedLorebookEntries: asArray(entry.linkedLorebookEntries),
            triggerKeywords: asArray(entry.triggerKeywords),
            content: entry.content || '',
            notes: entry.notes || '',
        };
        const index = this.data.phoneEntries.findIndex((item) => item.id === next.id);
        if (index >= 0) this.data.phoneEntries[index] = next;
        else this.data.phoneEntries.push(next);
        this.save();
        return next;
    }

    deletePhoneEntry(id) {
        this.data.phoneEntries = this.data.phoneEntries.filter((entry) => entry.id !== id);
        this.save();
    }

    addGroupMessage(group, message) {
        if (!this.data.phone.groupChats[group.id]) this.data.phone.groupChats[group.id] = [];
        this.data.phone.groupChats[group.id].push(message);
        this.addPhoneEvent({
            source: EVENT_SOURCES.GROUP_CHAT,
            channel: 'wechat_group',
            type: 'group_message',
            speakerId: message.speakerId || message.actorId || message.actor || 'user',
            actorId: message.actorId || message.actor || 'user',
            targetId: group.id,
            groupId: group.id,
            actor: message.actorId || message.actor || 'user',
            target: group.id,
            content: message.content || message.text || '',
            visibility: normalizeVisibility('visible_to_group', {
                user: true,
                groupId: group.id,
                groups: [group.id],
                npcs: asArray(group.members).filter((id) => !['user', 'char'].includes(id)),
                isChar: asArray(group.members).includes('char'),
            }),
            meta: { groupId: group.id, groupMembers: asArray(group.members) },
        });
        this.save();
    }

    addCharacterSideItem(item) {
        const next = {
            id: item.id || `side_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            title: item.title || '角色侧屏碎片',
            content: item.content || item.text || '',
            category: item.category || 'fragments',
            visibility: item.visibility || 'char_private',
            at: nowIso(),
            ...item,
        };
        const bucket = this.data.phone.characterSideScreen[next.category] || this.data.phone.characterSideScreen.fragments;
        bucket.unshift(next);
        this.addPhoneEvent({
            source: EVENT_SOURCES.CHARACTER_SIDE_SCREEN,
            channel: 'target_phone',
            type: 'character_side_item',
            speakerId: this.getHostCharId(),
            actorId: this.getHostCharId(),
            targetId: null,
            actor: this.getHostCharId(),
            target: null,
            content: `${next.title} ${next.content}`.trim(),
            visibility: next.visibility,
            summary: `角色侧屏：${clampText(next.title || next.content, 100)}`,
            injectToMain: false,
        });
        this.save();
        return next;
    }

    promoteCharacterSideItemToUserKnown(id, reason) {
        const all = Object.values(this.data.phone.characterSideScreen).flat();
        const item = all.find((entry) => entry.id === id);
        if (!item || !reason) return null;
        item.userVisibleReason = reason;
        item.visibility = 'visible_to_char';
        const event = this.addPhoneEvent({
            source: EVENT_SOURCES.CHARACTER_SIDE_SCREEN,
            channel: 'target_phone',
            type: 'side_screen_visibility_conversion',
            speakerId: 'system',
            actorId: 'system',
            targetId: 'user',
            actor: 'system',
            target: 'user',
            content: `${item.title || ''} ${item.content || ''}`.trim(),
            visibility: { system: true, user: true, char: true, npcs: [], groups: [], public: false, player: true },
            summary: `角色侧屏信息转为 user 已知：${reason}`,
        });
        this.save();
        return event;
    }
}

class ProfileManager {
    constructor(state) {
        this.state = state;
    }

    resolve(collected) {
        const extensions = collected.characterSummary?.extensions || {};
        const profile = extensions[EXTENSION_ID] || extensions[EXTENSION_ALIAS] || this.state.value.profile || DEFAULT_PROFILE;
        const charName = collected.characterSummary?.name || '当前角色';
        const resolved = JSON.parse(JSON.stringify({ ...DEFAULT_PROFILE, ...profile }));
        resolved.targetPhoneOwner = String(resolved.targetPhoneOwner || '{{char}}').split('{{char}}').join(charName);
        resolved.currentChar = {
            ...DEFAULT_PROFILE.currentChar,
            ...(resolved.currentChar || {}),
            id: resolved.currentChar?.id || 'char',
            name: String(resolved.currentChar?.name || '{{char}}').split('{{char}}').join(charName),
        };
        this.state.setProfile(resolved);
        return resolved;
    }

    importJson(text) {
        const profile = safeJsonParse(text, null);
        if (!profile || typeof profile !== 'object') throw new Error('Profile JSON 格式无效');
        this.state.setProfile({ ...DEFAULT_PROFILE, ...profile });
        return this.state.value.profile;
    }
}

class PhoneProfileManager extends ProfileManager {
    constructor(state) {
        super(state);
        this.lastCollected = null;
    }

    resolve(collected) {
        return this.ensureProfileForCurrentCard(collected);
    }

    now() { return nowIso(); }
    cardId(collected = this.lastCollected) { return String(collected?.characterSummary?.id || collected?.character?.avatar || collected?.characterSummary?.name || this.state.getHostCharId() || 'card'); }
    cardName(collected = this.lastCollected) { return String(collected?.characterSummary?.name || this.state.value.profile?.currentChar?.name || this.cardId(collected)); }
    stableProfileId(cardId) { return `profile_${String(cardId || 'card').replace(/[^a-zA-Z0-9_-]+/g, '_')}`; }

    makeIdentity(input) {
        const at = this.now();
        return {
            id: input.id,
            type: input.type || 'npc',
            displayName: input.displayName || input.name || input.id,
            phoneName: input.phoneName || input.displayName || input.name || input.id,
            avatarId: input.avatarId || input.avatar || '',
            linkedCardId: input.linkedCardId || '',
            linkedLorebookEntryIds: asArray(input.linkedLorebookEntryIds),
            relationshipStage: input.relationshipStage || 'unknown',
            tags: asArray(input.tags),
            notes: input.notes || '',
            enabled: input.enabled !== false,
            createdAt: input.createdAt || at,
            updatedAt: input.updatedAt || at,
        };
    }

    makeContact(input) {
        const at = this.now();
        return {
            contactId: input.contactId || `contact_${input.identityId || Date.now()}`,
            identityId: input.identityId,
            displayName: input.displayName || input.alias || input.identityId,
            alias: input.alias || input.displayName || input.identityId,
            appVisibility: { wechat: true, moments: true, forum: false, calendar: false, memo: false, ...(input.appVisibility || {}) },
            pinned: Boolean(input.pinned),
            muted: Boolean(input.muted),
            blocked: Boolean(input.blocked),
            tags: asArray(input.tags),
            notes: input.notes || '',
            createdAt: input.createdAt || at,
            updatedAt: input.updatedAt || at,
        };
    }

    normalizeProfile(profile = {}, collected = this.lastCollected) {
        const at = this.now();
        const cardId = this.cardId(collected);
        const hostCharId = profile.hostCharId || profile.currentChar?.id || cardId || this.state.getHostCharId() || 'char';
        const hostCharName = profile.hostCharName || profile.currentChar?.name || this.cardName(collected) || hostCharId;
        const user = this.makeIdentity({ id: 'user', type: 'user', displayName: 'User', phoneName: '我', ...(profile.identities?.user || {}) });
        const hostChar = this.makeIdentity({ id: hostCharId, type: 'host_char', displayName: hostCharName, phoneName: hostCharName, relationshipStage: 'unknown', ...(profile.identities?.hostChar || {}) });
        const legacyNpcs = asArray(profile.friends).filter((friend) => friend.id && friend.id !== hostCharId).map((friend) => ({ id: friend.id, type: 'npc', displayName: friend.name || friend.id, phoneName: friend.name || friend.id, avatarId: friend.avatar || '', relationshipStage: friend.relationshipStage || 'unknown', notes: friend.role || friend.notes || '', enabled: friend.enabled !== false }));
        const npcs = [...asArray(profile.identities?.npcs), ...legacyNpcs].filter((identity) => identity?.id).reduce((list, identity) => {
            if (!list.some((item) => item.id === identity.id)) list.push(this.makeIdentity(identity));
            return list;
        }, []);
        const contacts = asArray(profile.contacts).map((contact) => this.makeContact(contact));
        if (!contacts.some((contact) => contact.identityId === hostCharId)) contacts.push(this.makeContact({ identityId: hostCharId, displayName: hostCharName, alias: hostCharName }));
        const groups = asArray(profile.groups).map((group) => ({ groupId: group.groupId || group.id, groupName: group.groupName || group.name || group.id, appType: group.appType || 'wechat_group', memberIds: uniqueArray(group.memberIds || group.members), ownerId: group.ownerId || '', adminIds: asArray(group.adminIds), avatarId: group.avatarId || '', muted: Boolean(group.muted), tags: asArray(group.tags), notes: group.notes || '', createdAt: group.createdAt || at, updatedAt: group.updatedAt || at })).filter((group) => group.groupId);
        return {
            profileId: profile.profileId || this.stableProfileId(cardId),
            profileName: profile.profileName || profile.displayName || `${hostCharName} Phone Profile`,
            enabled: profile.enabled !== false,
            linkedCardIds: uniqueArray([cardId, ...asArray(profile.linkedCardIds)]),
            linkedWorldBookIds: asArray(profile.linkedWorldBookIds),
            hostCharId,
            hostCharName,
            createdAt: profile.createdAt || at,
            updatedAt: profile.updatedAt || at,
            settings: { autoSwitchOnCardChange: true, allowUnlinkedProfiles: false, defaultApp: 'wechat', enableWechat: true, enableMoments: true, enableForum: true, enableCalendar: true, enableMemo: true, enableDebug: true, ...(profile.settings || {}) },
            identities: { user, hostChar, npcs },
            contacts,
            groups,
            forumBoards: asArray(profile.forumBoards).map((board) => ({ boardId: board.boardId || board.id || `board_${Date.now()}`, boardName: board.boardName || board.name || board.boardId || 'Board', visibility: board.visibility || 'public', memberIds: asArray(board.memberIds), anonymousAllowed: board.anonymousAllowed !== false, anonymousMap: board.anonymousMap || {}, tags: asArray(board.tags), notes: board.notes || '', createdAt: board.createdAt || at, updatedAt: board.updatedAt || at })),
            momentsConfig: { defaultVisibility: 'friends', friendIds: [hostCharId], blockedViewerIds: [], selectedGroups: [], ...(profile.momentsConfig || {}) },
            linkedLorebookEntries: asArray(profile.linkedLorebookEntries),
            linkedPhoneEntries: asArray(profile.linkedPhoneEntries),
            metadata: profile.metadata || {},
        };
    }

    findContactByIdentityId(identityId, profile = this.getCurrentProfile()) { return asArray(profile?.contacts).find((contact) => contact.identityId === identityId) || null; }

    getContactRows(profile = this.getCurrentProfile()) {
        return asArray(profile?.contacts).map((contact) => {
            const identity = this.findIdentityById(contact.identityId);
            const appVisibility = { wechat: true, moments: true, forum: false, calendar: false, memo: false, ...(contact.appVisibility || {}) };
            const reasons = [];
            if (contact.blocked) reasons.push('blocked');
            if (appVisibility.wechat === false) reasons.push('appVisibility.wechat=false');
            if (!identity) reasons.push('missing identity');
            if (identity && identity.enabled === false) reasons.push('disabled identity');
            const displayName = contact.alias || contact.displayName || identity?.phoneName || identity?.displayName || identity?.id || contact.identityId;
            return {
                contact,
                identity,
                appVisibility,
                visible: reasons.length === 0,
                filterReasons: reasons,
                friend: identity ? {
                    id: identity.id,
                    identityId: identity.id,
                    name: displayName,
                    displayName,
                    phoneName: identity.phoneName,
                    avatar: identity.avatarId || avatarText(displayName),
                    avatarId: identity.avatarId || '',
                    role: identity.notes || identity.relationshipStage || 'NPC',
                    relationshipStage: identity.relationshipStage || '',
                    channels: Object.entries(appVisibility).filter(([, enabled]) => enabled).map(([key]) => key),
                    knows: [],
                    doesNotKnow: [],
                    relations: [],
                } : null,
            };
        });
    }

    getWechatContacts(profile = this.getCurrentProfile()) {
        return this.getContactRows(profile).filter((row) => row.visible).map((row) => row.friend);
    }

    legacyFromPhoneProfile(profile) {
        return { ...DEFAULT_PROFILE, id: profile.profileId, displayName: profile.profileName, targetPhoneOwner: profile.hostCharName, currentChar: { id: profile.hostCharId, name: profile.hostCharName, knows: [], doesNotKnow: [] }, friends: this.getWechatContacts(profile), groups: asArray(profile.groups).map((group) => ({ id: group.groupId, name: group.groupName, members: group.memberIds, rules: [] })), forum: { ...DEFAULT_PROFILE.forum }, phoneEntries: this.state.value.phoneEntries };
    }

    saveProfiles(profiles, currentProfileId = this.state.value.currentProfileId) {
        this.state.value.phoneProfiles = profiles;
        this.state.value.currentProfileId = currentProfileId;
        const current = this.getCurrentProfile();
        if (current) this.state.setProfile(this.legacyFromPhoneProfile(current));
        else this.state.save();
    }

    getCurrentProfile() { return asArray(this.state.value.phoneProfiles).find((profile) => profile.profileId === this.state.value.currentProfileId) || null; }
    listProfiles() { return asArray(this.state.value.phoneProfiles); }

    createProfileForCurrentCard(collected = this.lastCollected) {
        this.lastCollected = collected || this.lastCollected;
        const profile = this.normalizeProfile({}, this.lastCollected);
        this.saveProfiles([...this.listProfiles().filter((item) => item.profileId !== profile.profileId), profile], profile.profileId);
        return profile;
    }

    ensureProfileForCurrentCard(collected = this.lastCollected) {
        this.lastCollected = collected || this.lastCollected;
        const cardId = this.cardId(this.lastCollected);
        const matches = this.listProfiles().filter((profile) => asArray(profile.linkedCardIds).includes(cardId) && profile.enabled !== false).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
        if (matches.length > 1) this.state.noteIdentityWarning('Multiple Phone Profiles match current card; using most recently updated.', { cardId, profileIds: matches.map((item) => item.profileId) });
        if (matches[0]) { this.switchProfile(matches[0].profileId); return matches[0]; }
        return this.createProfileForCurrentCard(this.lastCollected);
    }

    switchProfile(profileId) {
        const profile = this.listProfiles().find((item) => item.profileId === profileId);
        if (!profile) throw new Error(`Profile not found: ${profileId}`);
        this.saveProfiles(this.listProfiles(), profile.profileId);
        return profile;
    }

    updateProfile(profileId, patch) {
        let updated = null;
        const profiles = this.listProfiles().map((profile) => {
            if (profile.profileId !== profileId) return profile;
            updated = this.normalizeProfile({ ...profile, ...patch, updatedAt: this.now() }, this.lastCollected);
            return updated;
        });
        if (!updated) throw new Error(`Profile not found: ${profileId}`);
        this.saveProfiles(profiles, this.state.value.currentProfileId);
        return updated;
    }

    deleteProfile(profileId) {
        const profiles = this.listProfiles().filter((profile) => profile.profileId !== profileId);
        const nextId = this.state.value.currentProfileId === profileId ? profiles[0]?.profileId || null : this.state.value.currentProfileId;
        this.saveProfiles(profiles, nextId);
        return true;
    }

    exportProfile(profileId = this.state.value.currentProfileId) { return JSON.stringify(this.listProfiles().find((profile) => profile.profileId === profileId) || this.getCurrentProfile(), null, 2); }

    importProfile(data) {
        const raw = typeof data === 'string' ? safeJsonParse(data, null) : data;
        if (!raw || typeof raw !== 'object') throw new Error('Profile JSON invalid');
        const profile = this.normalizeProfile(raw, this.lastCollected);
        this.saveProfiles([...this.listProfiles().filter((item) => item.profileId !== profile.profileId), profile], profile.profileId);
        return profile;
    }

    findIdentityById(identityId) { return this.state.findProfileIdentity(identityId); }
    findGroupById(groupId) { return this.state.findProfileGroup(groupId); }
    getGroupMembers(groupId) { return this.state.getProfileGroupMembers(groupId); }
    getForumBoard(boardId) { return this.state.getProfileForumBoard(boardId); }
    getMomentsViewers(config) { return this.state.getProfileMomentsViewers(config); }
}

class PhoneEntryManager {
    constructor(state) {
        this.state = state;
    }

    getRelevantPhoneEntries(context = {}) {
        const entries = asArray(this.state.value.phoneEntries)
            .filter((entry) => entry.enabled !== false)
            .map((entry) => ({ entry, score: this.scoreEntry(entry, context) }))
            .filter((item) => item.score > 0 || item.entry.type === 'custom')
            .sort((a, b) => b.score - a.score || Number(b.entry.priority || 0) - Number(a.entry.priority || 0))
            .slice(0, 12)
            .map((item) => item.entry);
        return {
            entries,
            phoneInstructionBlock: entries.map((entry) => [
                `### Phone Entry: ${entry.title}`,
                `type=${entry.type}; priority=${entry.priority}`,
                entry.content,
            ].join('\n')).join('\n\n'),
        };
    }

    scoreEntry(entry, context) {
        const targets = entry.linkedTargets || {};
        let score = Number(entry.priority || 0);
        const hasTargets = ['characters', 'npcs', 'groups', 'apps', 'forumBoards', 'relationshipStages', 'tags']
            .some((key) => asArray(targets[key]).length);
        if (!hasTargets) score += 1;
        if (asArray(targets.characters).includes(context.speakerId) || asArray(targets.npcs).includes(context.speakerId)) score += 50;
        if (context.groupId && asArray(targets.groups).includes(context.groupId)) score += 45;
        if (context.appType && asArray(targets.apps).includes(context.appType)) score += 35;
        if (context.forumBoardId && asArray(targets.forumBoards).includes(context.forumBoardId)) score += 30;
        if (context.relationshipStage && asArray(targets.relationshipStages).includes(context.relationshipStage)) score += 25;
        asArray(context.tags).forEach((tag) => {
            if (asArray(targets.tags).includes(tag)) score += 10;
        });
        const haystack = plainText([context.currentMessage, context.taskType, context.appType].filter(Boolean).join(' '));
        asArray(entry.triggerKeywords).forEach((keyword) => {
            if (keyword && haystack.includes(keyword)) score += 15;
        });
        return score;
    }
}

class MainLorebookLinker {
    constructor(state, collector) {
        this.state = state;
        this.collector = collector;
    }

    getRelevantMainLore(context = {}) {
        const collected = this.collector.collect();
        const activeEntries = asArray(collected.worldInfoSummary?.activeEntries);
        const linked = asArray(context.matchedPhoneEntries)
            .flatMap((entry) => asArray(entry.linkedLorebookEntries))
            .filter(Boolean);
        const keywords = uniqueArray([
            context.taskType,
            context.speakerId,
            context.appType,
            context.groupId,
            context.forumBoardId,
            context.relationshipStage,
            context.currentMessage,
            ...asArray(context.tags),
        ].flatMap((value) => plainText(value).split(/\s+/)).filter((value) => value && value.length >= 2));

        const relevantLoreEntries = activeEntries
            .map((entry, index) => ({
                id: entry.id || `active_${index}`,
                title: entry.title || entry.key || entry.comment || `Lore ${index + 1}`,
                content: entry.content || entry.entry || '',
                reason: linked.some((link) => link.entryTitle && plainText(entry.key || entry.title).includes(link.entryTitle))
                    ? 'linked_phone_entry'
                    : 'active_or_keyword_match',
            }))
            .filter((entry) => {
                if (linked.some((link) => link.entryTitle && entry.title.includes(link.entryTitle))) return true;
                const text = `${entry.title} ${entry.content}`;
                return keywords.some((keyword) => text.includes(keyword));
            })
            .slice(0, 8);

        return {
            relevantLoreEntries,
            loreInstructionBlock: relevantLoreEntries.map((entry) => `- [${entry.reason}] ${entry.title}: ${clampText(entry.content, 500)}`).join('\n'),
            todo: activeEntries.length
                ? ''
                : 'TODO: SillyTavern 当前上下文未暴露完整已激活世界书条目；这里使用可读取到的 worldInfo 摘要和 Phone Entry 显式关联作为 mock/降级实现。',
        };
    }
}

class MediaSystem {
    async analyzeImage(imageFile, context = {}) {
        if (!imageFile) return null;
        return {
            ok: true,
            description: context.description || '图片已保存为本地数据，当前环境未接入多模态识图；仅使用用户/模型提供的文字描述。',
            visibleClues: [],
            todo: 'TODO: 接入 SillyTavern 可用的多模态识图接口后，在这里生成 imageDescription 与 visibleClues。',
        };
    }

    async generateImage(prompt, context = {}) {
        return {
            ok: false,
            prompt,
            placeholder: `[AI配图占位：${clampText(prompt || context.taskType || 'image', 80)}]`,
            todo: 'TODO: 当前未接入生图接口；不会向外部服务发送请求。',
        };
    }
}

class ProactivePhoneEventScheduler {
    constructor(state) {
        this.state = state;
    }

    enqueue(event, trigger = {}) {
        return this.state.addPendingEvent({
            source: event.source || EVENT_SOURCES.SYSTEM_PUSH,
            type: event.type || 'proactive_event',
            actor: event.actor || 'system',
            target: event.target || 'user',
            content: event.content || event.summary || '',
            visibility: event.visibility || 'user_only',
            meta: { proactive: true, ...(event.meta || {}) },
        }, trigger);
    }

    tick(reason = '') {
        return this.state.resolvePendingEvents(reason).slice(0, 3);
    }
}

class BackgroundGenerator {
    constructor(state, collector) {
        this.state = state;
        this.collector = collector;
        this.phoneEntryManager = new PhoneEntryManager(state);
        this.lorebookLinker = new MainLorebookLinker(state, collector);
    }

    async generateWithContext(taskType, payload = {}) {
        const context = getContext();
        const collected = this.collector.collect();
        const speakerId = this.resolveSpeakerId(taskType, payload);
        const auditor = new KnowledgeTimelineAuditor(this.state.value);
        const speakerContext = auditor.resolveVisibleContext(speakerId);
        const quietPrompt = this.buildPrompt(taskType, payload, collected, speakerContext);

        if (this.state.value.settings.apiEndpoint) {
            const apiResult = await this.generateViaConfiguredApiAudited(quietPrompt, taskType, speakerId, speakerContext);
            if (apiResult.ok) return apiResult;
            return {
                ok: false,
                message: apiResult.message || '自定义 API 调用失败',
                items: [],
                audit: apiResult.audit,
            };
        }

        if (typeof context.generateQuietPrompt === 'function') {
            const first = await this.generateAndAudit(context, quietPrompt, taskType, speakerId, speakerContext);
            if (first.ok) return first;
            const retryPrompt = [
                quietPrompt,
                '【上一次生成被审计器拦截】',
                JSON.stringify(first.audit.issues),
                '请重新生成，严格避开 forbiddenFacts、未来事件、system_only/user_only 越界信息。只输出 JSON。',
            ].join('\n\n');
            const second = await this.generateAndAudit(context, retryPrompt, taskType, speakerId, speakerContext);
            if (second.ok) return second;
            return {
                ok: false,
                message: '本次生成疑似越界，已拦截。请刷新或重试。',
                items: [],
                audit: second.audit,
            };
        }

        if (!this.state.value.settings.fallbackEnabled) {
            return {
                ok: false,
                message: '后台生成接口未接入',
                items: [],
            };
        }

        const fallback = this.templateFallback(taskType, payload);
        fallback.visibilityContext = speakerContext;
        return fallback;
    }

    getApiHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (this.state.value.settings.apiKey) headers.Authorization = `Bearer ${this.state.value.settings.apiKey}`;
        return headers;
    }

    getChatCompletionsUrl() {
        const endpoint = String(this.state.value.settings.apiEndpoint || '').trim().replace(/\/+$/, '');
        if (!endpoint) return '';
        if (endpoint.endsWith('/chat/completions')) return endpoint;
        if (endpoint.endsWith('/v1')) return `${endpoint}/chat/completions`;
        if (endpoint.includes('/v1/')) return `${endpoint}/chat/completions`;
        return `${endpoint}/v1/chat/completions`;
    }

    async generateViaConfiguredApi(quietPrompt, taskType, speakerId, speakerContext) {
        try {
            let raw;
            if (this.state.value.settings.apiModel) {
                const response = await fetch(this.getChatCompletionsUrl(), {
                    method: 'POST',
                    headers: this.getApiHeaders(),
                    body: JSON.stringify({
                        model: this.state.value.settings.apiModel,
                        messages: [
                            { role: 'system', content: '你是 ST-StoryPhone 手机后台生成器。只输出 JSON，不要 Markdown。' },
                            { role: 'user', content: quietPrompt },
                        ],
                        temperature: 0.7,
                    }),
                });
                raw = await response.text();
                const data = safeJsonParse(raw, { text: raw });
                if (!response.ok) throw new Error(data.error?.message || `${response.status} ${response.statusText}`);
                raw = data.choices?.[0]?.message?.content || data.text || raw;
            } else {
                const response = await fetch(this.state.value.settings.apiEndpoint, {
                    method: 'POST',
                    headers: this.getApiHeaders(),
                    body: JSON.stringify({ taskType, prompt: quietPrompt, visibleContext: speakerContext }),
                });
                raw = await response.text();
                const data = safeJsonParse(raw, { text: raw });
                if (!response.ok) throw new Error(data.error?.message || `${response.status} ${response.statusText}`);
                raw = data.choices?.[0]?.message?.content || data.text || raw;
            }

            const parsed = this.parseGeneratedResult(taskType, raw);
            const audit = this.auditParsedResult(parsed, speakerId, speakerContext, taskType);
            return { ...parsed, ok: parsed.ok && audit.ok, audit, visibilityContext: speakerContext };
        } catch (error) {
            return { ok: false, message: `自定义 API 调用失败：${error.message}`, items: [] };
        }
    }

    async generateViaConfiguredApiAudited(quietPrompt, taskType, speakerId, speakerContext) {
        let prompt = quietPrompt;
        let lastAudit = null;
        try {
            for (let attempt = 0; attempt < 2; attempt += 1) {
                const raw = await this.callConfiguredApiRaw(prompt, taskType, speakerContext);
                const parsed = this.parseGeneratedResult(taskType, raw);
                const audit = this.auditParsedResult(parsed, speakerId, speakerContext, taskType);
                if (parsed.ok && audit.ok) return { ...parsed, ok: true, audit, visibilityContext: speakerContext };
                lastAudit = audit;
                prompt = [
                    quietPrompt,
                    '[Knowledge & Timeline Auditor blocked the previous result]',
                    JSON.stringify(audit.issues),
                    'Regenerate once. Use only visible facts. Do not mention forbiddenFacts, user_only/system_only/private chats, or future events. Return JSON only.',
                ].join('\n\n');
            }
            return {
                ok: false,
                message: '本次生成疑似越界，已拦截。请刷新或重试。',
                items: [],
                audit: lastAudit,
            };
        } catch (error) {
            return { ok: false, message: `自定义 API 调用失败：${error.message}`, items: [] };
        }
    }

    async callConfiguredApiRaw(prompt, taskType, speakerContext) {
        if (this.state.value.settings.apiModel) {
            const response = await fetch(this.getChatCompletionsUrl(), {
                method: 'POST',
                headers: this.getApiHeaders(),
                body: JSON.stringify({
                    model: this.state.value.settings.apiModel,
                    messages: [
                        { role: 'system', content: '你是 ST-StoryPhone 手机后台生成器。只输出 JSON，不要 Markdown。' },
                        { role: 'user', content: prompt },
                    ],
                    temperature: 0.7,
                }),
            });
            const raw = await response.text();
            const data = safeJsonParse(raw, { text: raw });
            if (!response.ok) throw new Error(data.error?.message || `${response.status} ${response.statusText}`);
            return data.choices?.[0]?.message?.content || data.text || raw;
        }

        const response = await fetch(this.state.value.settings.apiEndpoint, {
            method: 'POST',
            headers: this.getApiHeaders(),
            body: JSON.stringify({ taskType, prompt, visibleContext: speakerContext }),
        });
        const raw = await response.text();
        const data = safeJsonParse(raw, { text: raw });
        if (!response.ok) throw new Error(data.error?.message || `${response.status} ${response.statusText}`);
        return data.choices?.[0]?.message?.content || data.text || raw;
    }

    async testApiConnection() {
        if (!this.state.value.settings.apiEndpoint) return { ok: false, message: '请先填写 API URL' };
        try {
            if (this.state.value.settings.apiModel) {
                const response = await fetch(this.getChatCompletionsUrl(), {
                    method: 'POST',
                    headers: this.getApiHeaders(),
                    body: JSON.stringify({
                        model: this.state.value.settings.apiModel,
                        messages: [{ role: 'user', content: '只输出 {"ok":true,"message":"pong"}' }],
                        temperature: 0,
                    }),
                });
                if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
                return { ok: true, message: 'API 测试成功' };
            }

            const response = await fetch(this.state.value.settings.apiEndpoint, {
                method: 'POST',
                headers: this.getApiHeaders(),
                body: JSON.stringify({ taskType: 'connection_test', prompt: 'ping' }),
            });
            if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
            return { ok: true, message: 'API 测试成功' };
        } catch (error) {
            return { ok: false, message: `API 测试失败：${error.message}` };
        }
    }

    resolveSpeakerId(taskType, payload) {
        if (payload.speakerId) return normalizeSpeakerId(payload.speakerId);
        if (payload.npcId || payload.actorId) return normalizeSpeakerId(payload.npcId || payload.actorId);
        if (taskType === 'target_phone') return 'char';
        if (taskType === 'character_side_screen') return 'char';
        if (taskType === 'npc_chat') return normalizeSpeakerId(payload.npcId || payload.target || 'user');
        if (taskType === 'group_chat') return normalizeSpeakerId(payload.speakerId || payload.actorId || 'system');
        if (taskType === 'forum') return 'channel:forum';
        if (taskType === 'moments') return 'channel:moments';
        return 'user';
    }

    resolveItemSpeaker(item, defaultSpeakerId, taskType) {
        const explicit = item.speakerId || item.actorId || item.npcId;
        if (explicit) return normalizeSpeakerId(resolveProfileActorId(this.state.value.profile, explicit));
        const named = resolveProfileActorId(this.state.value.profile, item.actor || item.author || '');
        if (named && named !== item.actor && named !== item.author) return normalizeSpeakerId(named);
        if (taskType === 'forum') return 'channel:forum';
        if (taskType === 'moments') return 'channel:moments';
        return normalizeSpeakerId(defaultSpeakerId);
    }

    auditParsedResult(parsed, defaultSpeakerId, defaultContext, taskType = '') {
        const auditor = new KnowledgeTimelineAuditor(this.state.value);
        const issues = [];
        asArray(parsed.items).forEach((item) => {
            const itemSpeaker = this.resolveItemSpeaker(item, defaultSpeakerId, taskType);
            const context = itemSpeaker === defaultContext?.speakerId
                ? defaultContext
                : auditor.resolveVisibleContext(itemSpeaker);
            if ((taskType === 'forum' || taskType === 'moments') && !item.actorId && !item.speakerId && !item.npcId) {
                issues.push({
                    type: 'npc_scope_error',
                    detail: `[${itemSpeaker}] generated ${taskType} item is missing actorId/speakerId, so its knowledge boundary cannot be proven.`,
                    suggestedFix: 'Return actorId or speakerId matching the phone profile, or keep the item strictly public-channel only.',
                });
            }
            if ((taskType === 'forum' || taskType === 'moments') && !itemSpeaker.startsWith('channel:')) {
                const channelId = taskType === 'forum' ? 'forum' : 'moments';
                if (!speakerHasChannel(this.state.value.profile, itemSpeaker, channelId)) {
                    issues.push({
                        type: 'npc_scope_error',
                        detail: `[${itemSpeaker}] is not configured as a ${channelId} reader/poster in the active phone profile.`,
                        suggestedFix: `Choose an actor whose profile channels include "${channelId}", or add that channel in the profile.`,
                    });
                }
            }
            const audit = auditor.auditKnowledgeConsistency(JSON.stringify(item), itemSpeaker, context);
            if (!audit.ok) issues.push(...audit.issues.map((issue) => ({
                ...issue,
                detail: `[${itemSpeaker}] ${issue.detail}`,
            })));
        });
        return {
            ok: issues.length === 0,
            issues,
            safeContentSuggestion: issues.length
                ? 'Rewrite generated items using only each item actor/speaker visible context.'
                : null,
        };
    }

    async generateAndAudit(context, quietPrompt, taskType, speakerId, speakerContext) {
        const result = await context.generateQuietPrompt({ quietPrompt });
        const parsed = this.parseGeneratedResult(taskType, result);
        const audit = this.auditParsedResult(parsed, speakerId, speakerContext, taskType);
        return { ...parsed, ok: parsed.ok && audit.ok, audit, visibilityContext: speakerContext };
    }

    buildPrompt(taskType, payload, collected, speakerContext) {
        const state = this.state.value;
        const phoneEventsSummary = state.phoneEvents.slice(-20).map((event) => ({
            type: event.type,
            at: event.at,
            visibility: event.visibility,
            summary: event.summary || event.content || event.title,
        }));
        const boundary = new KnowledgeTimelineAuditor(state)
            .buildPromptWithVisibilityBoundary(speakerContext.speakerId, taskType, payload);
        const entryContext = {
            taskType,
            speakerId: speakerContext.speakerId,
            appType: payload.appType || taskType,
            groupId: payload.groupId,
            forumBoardId: payload.board || payload.forumBoardId,
            relationshipStage: state.phase,
            currentMessage: payload.message || payload.currentMessage || payload.content || '',
            storyState: state,
            tags: payload.tags || [],
        };
        const phoneEntryMatch = this.phoneEntryManager.getRelevantPhoneEntries(entryContext);
        const loreMatch = this.lorebookLinker.getRelevantMainLore({
            ...entryContext,
            matchedPhoneEntries: phoneEntryMatch.entries,
        });
        const isSystemSpeaker = speakerContext.speakerId === 'system';
        const safeSharedState = {
            time: state.time,
            location: state.location,
            phase: state.phase,
            relationship: state.relationship,
            storyClock: state.storyClock,
            eventLogSize: state.eventLog.length,
            mainEvents: isSystemSpeaker
                ? state.mainEvents.slice(-12).map((event) => ({ id: event.id, source: event.source, content: event.content, visibility: event.visibility }))
                : speakerContext.visibleMainEvents.slice(-12),
            phoneEvents: isSystemSpeaker ? phoneEventsSummary : speakerContext.visiblePhoneEvents.slice(-12),
            pendingEvents: isSystemSpeaker ? state.pendingEvents.slice(-12) : [],
            knowledgeGraph: isSystemSpeaker ? state.knowledgeGraph.slice(-20) : speakerContext.knownFacts.slice(-20),
        };

        return [
            '你正在为 SillyTavern 扩展 ST-StoryPhone 生成手机内内容。',
            '结果只返回给手机界面，不写入主聊天。必须克制真实，避免狗血、全员磕CP、NPC全知全能。',
            '请严格输出 JSON，不要 Markdown。格式：{"items":[...],"summary":"..."}。',
            boundary,
            `任务类型：${taskType} / ${TASK_LABELS[taskType] || taskType}`,
            `当前请求：${JSON.stringify(payload)}`,
            `当前角色卡摘要：${JSON.stringify(collected.characterSummary)}`,
            `世界书摘要：${JSON.stringify(collected.worldInfoSummary)}`,
            `最近主对话历史：${JSON.stringify(collected.recentHistory)}`,
            `用户 persona：${JSON.stringify(collected.persona)}`,
            `sharedStoryState（已按 speaker 分区/过滤）：${JSON.stringify(safeSharedState)}`,
            `phoneEvents摘要（speaker=${speakerContext.speakerId} 时仅可使用可见项）：${JSON.stringify(safeSharedState.phoneEvents)}`,
            `speaker 可见上下文：${JSON.stringify({
                speakerId: speakerContext.speakerId,
                visibleMainEvents: speakerContext.visibleMainEvents.slice(-12),
                visiblePhoneEvents: speakerContext.visiblePhoneEvents.slice(-12),
                knownFacts: speakerContext.knownFacts.slice(-12),
            })}`,
            `speaker 禁止知道的信息：${JSON.stringify(speakerContext.forbiddenFacts.slice(-12))}`,
            `命中的 Phone Entries：${JSON.stringify(phoneEntryMatch.entries.map((entry) => ({ id: entry.id, title: entry.title, type: entry.type, priority: entry.priority })))}`,
            `Phone Entries 指令块：\n${phoneEntryMatch.phoneInstructionBlock || '(none)'}`,
            `命中的主世界书条目：${JSON.stringify(loreMatch.relevantLoreEntries)}`,
            `主世界书指令块：\n${loreMatch.loreInstructionBlock || loreMatch.todo || '(none)'}`,
            '可见性规则：system 永远知道全部；speaker 只能知道其可见信息。system_only/user_only/其他NPC私聊不得被角色直接引用。',
            '生成要求：内容应像真实手机信息流。每个 item 至少包含 title/content/actor/visibility，可按任务增加 comments/likes/time/board。',
        ].join('\n\n');
    }

    parseGeneratedResult(taskType, raw) {
        const text = typeof raw === 'string' ? raw.trim() : JSON.stringify(raw || {});
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}');
        const parsed = jsonStart >= 0 && jsonEnd >= jsonStart
            ? safeJsonParse(text.slice(jsonStart, jsonEnd + 1), null)
            : null;

        if (parsed && Array.isArray(parsed.items)) {
            return { ok: true, taskType, items: parsed.items, summary: parsed.summary || '' };
        }

        return {
            ok: true,
            taskType,
            items: [{ title: TASK_LABELS[taskType] || taskType, content: text, actor: '系统生成', visibility: 'user_only' }],
            summary: clampText(text, 160),
        };
    }

    templateFallback(taskType, payload) {
        const label = TASK_LABELS[taskType] || taskType;
        return {
            ok: true,
            taskType,
            summary: `${label} 使用本地占位生成`,
            items: [
                {
                    title: `${label}占位内容`,
                    actor: payload.npcName || '系统',
                    content: '已开启 fallback，因此这里显示本地模板内容。接入 generateQuietPrompt 后会由当前模型生成。',
                    visibility: payload.visibility || 'user_only',
                    time: '刚刚',
                },
            ],
        };
    }
}

class ContextInjector {
    constructor(state) {
        this.state = state;
    }

    currentMainSpeakerId() {
        return this.state?.value?.profile?.currentChar?.id || 'char';
    }

    attach() {
        globalThis.STStoryPhoneGenerationInterceptor = async (chat, contextSize, abort, type) => {
            if (type === 'quiet') return;
            if (!this.state?.value?.settings?.injectIntoMainContext) return;
            const summary = new KnowledgeTimelineAuditor(this.state.value).summarizeForMainChat(this.currentMainSpeakerId());
            if (!summary) return;

            const note = {
                is_user: false,
                is_system: true,
                name: EXTENSION_ID,
                send_date: Date.now(),
                mes: summary,
            };
            const insertAt = Math.max(0, chat.length - 1);
            chat.splice(insertAt, 0, cloneValue(note));
        };
    }
}

class PhoneUI {
    constructor(state, collector, profileManager, generator) {
        this.state = state;
        this.collector = collector;
        this.profileManager = profileManager;
        this.generator = generator;
        this.activeApp = 'home';
        this.selectedNpc = null;
        this.root = null;
        this.modal = null;
        this.screen = null;
        this.dragHandle = null;
        this.isPhoneOpen = false;
        this.hasUserOpenedPhone = false;
        this.launcherOpenLockUntil = 0;
        this.phoneDragPointerId = null;
        this.phoneDragMoved = false;
    }

    getWechatContacts(profile = this.state.value.profile) {
        const profileContacts = this.profileManager.getWechatContacts?.();
        if (asArray(profileContacts).length) return profileContacts;
        return asArray(profile?.friends);
    }

    getProfileContactDiagnostics() {
        const currentProfile = this.profileManager.getCurrentProfile?.();
        const rows = this.profileManager.getContactRows?.(currentProfile) || [];
        return {
            currentProfileId: currentProfile?.profileId || null,
            contacts: asArray(currentProfile?.contacts),
            renderedWechatContacts: rows.filter((row) => row.visible).map((row) => row.friend),
            rows: rows.map((row) => ({
                identityId: row.contact.identityId,
                displayName: row.friend?.displayName || row.contact.displayName || row.contact.alias || row.contact.identityId,
                visible: row.visible,
                filterReasons: row.filterReasons,
            })),
        };
    }

    mount() {
        removeStoryPhoneDomDuplicates();
        document.getElementById('st-story-phone')?.remove();
        markStoryPhoneNewUi('app.js:PhoneUI.mount');
        this.root = createElement('section', 'stp-phone-shell stp-is-minimized', '');
        this.root.id = 'st-story-phone';
        this.root.innerHTML = `
            <div class="stp-phone st-storyphone-modal is-closed" id="st-storyphone-modal" aria-hidden="true">
                <div class="stp-phone-top">
                    <span class="stp-signal">STORY 5G</span>
                    <span class="stp-camera"></span>
                    <button class="stp-mini" type="button" title="最小化">_</button>
                </div>
                <div class="stp-screen" role="region" aria-label="StoryPhone"></div>
            </div>
            <button class="stp-bubble" type="button" title="打开 StoryPhone">Phone</button>
        `;
        document.body.appendChild(this.root);
        applyLauncherPosition(this.root);
        storyPhoneRuntimeDebug.rootMounted = true;
        storyPhoneRuntimeDebug.modalMounted = true;
        this.screen = this.root.querySelector('.stp-screen');
        this.modal = this.root.querySelector('.st-storyphone-modal');
        this.dragHandle = this.root.querySelector('.stp-phone-top');
        shieldStoryPhonePointer(this.root.querySelector('.stp-mini'), () => this.closePhone());
        this.root.querySelector('.stp-bubble').addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
            if (this.root.querySelector('.stp-bubble')?.dataset.stpSuppressOpen) return;
            this.openFromLauncher('new_launcher_click');
        }, true);
        this.bindDrag();
        this.bindEvents();
        this.closePhone({ skipSave: true });
    }

    bindDrag() {
        const shell = this.root;
        const bubble = this.root.querySelector('.stp-bubble');
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;
        let pointerId = null;
        let moved = false;
        let touchStartX = 0;
        let touchStartY = 0;
        let touchMoved = false;
        const dragThreshold = 6;
        bubble.style.touchAction = 'none';
        bubble.addEventListener('pointerdown', (event) => {
            pointerId = event.pointerId;
            moved = false;
            const rect = shell.getBoundingClientRect();
            applyLauncherPosition(shell, { left: rect.left, top: rect.top });
            startX = event.clientX;
            startY = event.clientY;
            startLeft = parseInt(shell.style.left, 10) || rect.left;
            startTop = parseInt(shell.style.top, 10) || rect.top;
            bubble.setPointerCapture?.(pointerId);
        });
        bubble.addEventListener('pointermove', (event) => {
            if (pointerId !== event.pointerId) return;
            const dx = event.clientX - startX;
            const dy = event.clientY - startY;
            if (Math.abs(dx) + Math.abs(dy) > dragThreshold) moved = true;
            if (!moved) return;
            const position = clampLauncherPosition(startLeft + dx, startTop + dy, shell.offsetWidth || 48, shell.offsetHeight || 48);
            applyLauncherPosition(shell, position);
            event.preventDefault();
            event.stopPropagation();
        });
        const finishDrag = (event) => {
            if (pointerId !== event.pointerId) return;
            bubble.releasePointerCapture?.(pointerId);
            pointerId = null;
            rememberLauncherPosition(parseInt(shell.style.left, 10) || 22, parseInt(shell.style.top, 10) || 86);
            if (moved) {
                bubble.dataset.stpSuppressOpen = '1';
                setTimeout(() => { delete bubble.dataset.stpSuppressOpen; }, 120);
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            bubble.dataset.stpSuppressOpen = '1';
            this.openFromLauncher('new_launcher_pointerup');
            setTimeout(() => { delete bubble.dataset.stpSuppressOpen; }, 360);
        };
        bubble.addEventListener('pointerup', finishDrag);
        bubble.addEventListener('pointercancel', finishDrag);
        bubble.addEventListener('touchstart', (event) => {
            const point = event.touches?.[0];
            if (!point) return;
            touchStartX = point.clientX;
            touchStartY = point.clientY;
            touchMoved = false;
        }, { passive: true });
        bubble.addEventListener('touchmove', (event) => {
            const point = event.touches?.[0];
            if (!point) return;
            if (Math.abs(point.clientX - touchStartX) + Math.abs(point.clientY - touchStartY) > dragThreshold) {
                touchMoved = true;
            }
        }, { passive: true });
        bubble.addEventListener('touchend', () => {
            if (touchMoved) return;
            bubble.dataset.stpSuppressOpen = '1';
            this.openFromLauncher('new_launcher_touchend');
            setTimeout(() => { delete bubble.dataset.stpSuppressOpen; }, 360);
        }, true);
        bubble.addEventListener('click', (event) => {
            if (bubble.dataset.stpSuppressOpen) {
                event.preventDefault();
                event.stopPropagation();
            }
        }, true);
        this.bindPhoneWindowDrag();
    }

    isMobileViewport() {
        return window.innerWidth <= 768 || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    }

    bindPhoneWindowDrag() {
        const shell = this.root;
        const handle = this.root.querySelector('.stp-phone-top');
        if (!shell || !handle) return;
        if (handle.__stpPhoneDragBound) return;
        handle.__stpPhoneDragBound = true;
        this.dragHandle = handle;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;
        const dragThreshold = 6;
        handle.addEventListener('pointerdown', (event) => {
            if (this.isMobileViewport()) return;
            if (event.target?.closest?.('.stp-mini,button,input,textarea,select,label,a')) return;
            this.phoneDragPointerId = event.pointerId;
            this.phoneDragMoved = false;
            const rect = shell.getBoundingClientRect();
            startX = event.clientX;
            startY = event.clientY;
            startLeft = rect.left;
            startTop = rect.top;
            handle.setPointerCapture?.(event.pointerId);
        });
        handle.addEventListener('pointermove', (event) => {
            if (this.phoneDragPointerId !== event.pointerId) return;
            if (this.isMobileViewport()) return;
            const dx = event.clientX - startX;
            const dy = event.clientY - startY;
            if (Math.abs(dx) + Math.abs(dy) > dragThreshold) this.phoneDragMoved = true;
            if (!this.phoneDragMoved) return;
            const width = shell.offsetWidth || 420;
            const height = shell.offsetHeight || 760;
            const position = clampPhoneWindowPosition(startLeft + dx, startTop + dy, width, height, 40);
            shell.classList.add('stp-is-dragged');
            shell.style.transform = 'none';
            shell.style.left = `${position.left}px`;
            shell.style.top = `${position.top}px`;
            shell.style.right = 'auto';
            shell.style.bottom = 'auto';
            event.preventDefault();
            event.stopPropagation();
        });
        const endDrag = (event) => {
            if (this.phoneDragPointerId !== event.pointerId) return;
            handle.releasePointerCapture?.(event.pointerId);
            this.phoneDragPointerId = null;
            if (!this.phoneDragMoved) return;
            const width = shell.offsetWidth || 420;
            const height = shell.offsetHeight || 760;
            const currentLeft = parseInt(shell.style.left, 10) || shell.getBoundingClientRect().left;
            const currentTop = parseInt(shell.style.top, 10) || shell.getBoundingClientRect().top;
            const position = clampPhoneWindowPosition(currentLeft, currentTop, width, height, 40);
            shell.style.left = `${position.left}px`;
            shell.style.top = `${position.top}px`;
            rememberPhoneWindowPosition(position.left, position.top);
            mergeStoryPhoneLauncherDebug({
                phoneDragEnabled: true,
                phoneDragPosition: position,
            });
            event.preventDefault();
            event.stopPropagation();
        };
        handle.addEventListener('pointerup', endDrag);
        handle.addEventListener('pointercancel', endDrag);
    }

    applyOpenLayout() {
        const root = this.root;
        if (!root) return;
        if (this.isMobileViewport()) {
            root.classList.remove('stp-is-dragged');
            root.style.transform = 'none';
            root.style.left = '6px';
            root.style.top = '6px';
            root.style.right = 'auto';
            root.style.bottom = 'auto';
            return;
        }
        const saved = readPhoneWindowPosition();
        if (typeof saved.left === 'number' && typeof saved.top === 'number') {
            const width = root.offsetWidth || 420;
            const height = root.offsetHeight || 760;
            const clamped = clampPhoneWindowPosition(saved.left, saved.top, width, height, 40);
            root.classList.add('stp-is-dragged');
            root.style.transform = 'none';
            root.style.left = `${clamped.left}px`;
            root.style.top = `${clamped.top}px`;
            root.style.right = 'auto';
            root.style.bottom = 'auto';
            mergeStoryPhoneLauncherDebug({ phoneDragPosition: clamped });
            return;
        }
        root.classList.remove('stp-is-dragged');
        root.style.transform = 'translate(-50%, -50%)';
        root.style.left = '50%';
        root.style.top = '50%';
        root.style.right = 'auto';
        root.style.bottom = 'auto';
    }

    bindEvents() {
        const context = getContext();
        const events = context.eventSource;
        const types = context.event_types || {};
        if (!events?.on) return;
        const refresh = () => {
            const collected = this.collector.collect();
            this.profileManager.resolve(collected);
            if (this.isPhoneOpen) this.render();
        };
        [types.CHAT_CHANGED, types.MESSAGE_RECEIVED, types.MESSAGE_SENT, types.PERSONA_CHANGED, types.CHARACTER_EDITED]
            .filter(Boolean)
            .forEach((type) => events.on(type, refresh));
    }

    openFromLauncher(source = 'new_launcher') {
        const now = Date.now();
        if (now < this.launcherOpenLockUntil) return false;
        this.launcherOpenLockUntil = now + 320;
        requestStoryPhoneOpen(source, () => this.openPhone());
        return true;
    }

    rebuildPhoneDomIfNeeded() {
        if (!this.root || !this.root.isConnected) return false;
        let modal = this.root.querySelector('.st-storyphone-modal');
        const bubble = this.root.querySelector('.stp-bubble');
        if (!modal && bubble) {
            modal = createElement('div', 'stp-phone st-storyphone-modal is-closed', '');
            modal.id = 'st-storyphone-modal';
            modal.setAttribute('aria-hidden', 'true');
            modal.innerHTML = `
                <div class="stp-phone-top">
                    <span class="stp-signal">STORY 5G</span>
                    <span class="stp-camera"></span>
                    <button class="stp-mini" type="button" title="最小化">_</button>
                </div>
                <div class="stp-screen" role="region" aria-label="StoryPhone"></div>
            `;
            this.root.insertBefore(modal, bubble);
        }
        const screen = modal?.querySelector('.stp-screen') || this.root.querySelector('.stp-screen');
        this.modal = modal || this.modal;
        this.screen = screen || this.screen;
        if (this.modal?.querySelector('.stp-mini')) {
            shieldStoryPhonePointer(this.modal.querySelector('.stp-mini'), () => this.closePhone());
        }
        this.bindPhoneWindowDrag();
        return Boolean(this.modal && this.modal.isConnected && this.screen && this.screen.isConnected);
    }

    failOpenValidation(reason, details = {}) {
        const message = `[ST-StoryPhone] openPhone validation failed: ${reason}`;
        storyPhoneRuntimeDebug.lastUiBootError = reason;
        mergeStoryPhoneLauncherDebug({
            openValidationPassed: false,
            openValidationError: reason,
            lastUiBootError: reason,
            openPhoneAfter: {
                rootClassName: this.root?.className || null,
                modalDisplay: this.modal && this.modal.isConnected ? window.getComputedStyle(this.modal).display : null,
                screenIsConnected: Boolean(this.screen?.isConnected),
                ...details,
            },
        });
        console.error(message, details);
        this.closePhone();
    }

    openPhone() {
        const root = this.root;
        this.modal = root?.querySelector('.st-storyphone-modal') || this.modal;
        this.screen = root?.querySelector('.stp-screen') || this.screen;
        const openPhoneBefore = {
            rootExists: Boolean(root),
            rootConnected: Boolean(root?.isConnected),
            modalExists: Boolean(this.modal),
            modalConnected: Boolean(this.modal?.isConnected),
            screenExists: Boolean(this.screen),
            screenConnected: Boolean(this.screen?.isConnected),
        };
        mergeStoryPhoneLauncherDebug({ openPhoneBefore });
        console.debug('ST-StoryPhone openPhoneBefore', openPhoneBefore);
        if (!root || !root.isConnected) {
            this.failOpenValidation('root missing or disconnected', openPhoneBefore);
            return;
        }
        if (!this.modal?.isConnected || !this.screen?.isConnected) {
            const rebuilt = this.rebuildPhoneDomIfNeeded();
            if (!rebuilt) {
                this.failOpenValidation('modal or screen missing and rebuild failed', openPhoneBefore);
                return;
            }
        }
        const modal = this.modal;
        const screen = this.screen;
        if (!modal || !modal.isConnected || !screen || !screen.isConnected) {
            this.failOpenValidation('modal or screen unavailable before open', openPhoneBefore);
            return;
        }
        markStoryPhoneNewUi('app.js:PhoneUI.openPhone');
        this.isPhoneOpen = true;
        this.hasUserOpenedPhone = true;
        root.classList.remove('stp-is-minimized');
        root.classList.add('stp-is-open');
        this.applyOpenLayout();
        modal?.classList.add('is-open');
        modal?.classList.remove('is-closed');
        modal?.setAttribute('aria-hidden', 'false');
        this.render();
        const modalStyle = modal?.isConnected ? window.getComputedStyle(modal) : null;
        const modalRect = modal?.getBoundingClientRect?.();
        const modalVisible = Boolean(
            modalStyle
            && modalStyle.display !== 'none'
            && modalStyle.visibility !== 'hidden'
            && (modalRect?.width || 0) > 0
            && (modalRect?.height || 0) > 0
        );
        const openPhoneAfter = {
            rootClassName: root.className,
            modalDisplay: modalStyle?.display || null,
            screenIsConnected: Boolean(screen?.isConnected),
            modalConnected: Boolean(modal?.isConnected),
            modalVisible,
            phoneDragEnabled: !this.isMobileViewport(),
            phoneDragPosition: readPhoneWindowPosition(),
            launcherDragPosition: readLauncherPosition(),
        };
        mergeStoryPhoneLauncherDebug({ openPhoneAfter });
        console.debug('ST-StoryPhone openPhoneAfter', openPhoneAfter);
        const openValidationError = (
            !modal ? 'modal missing after render'
                : !modal.isConnected ? 'modal disconnected after render'
                    : !screen ? 'screen missing after render'
                        : !screen.isConnected ? 'screen disconnected after render'
                            : modalStyle?.display === 'none' ? 'modal display none after render'
                                : (root.classList.contains('stp-is-open') && !modalVisible) ? 'root open but modal not visible'
                                    : null
        );
        if (openValidationError) {
            this.failOpenValidation(openValidationError, openPhoneAfter);
            return;
        }
        mergeStoryPhoneLauncherDebug({
            openValidationPassed: true,
            openValidationError: null,
            lastUiBootError: null,
        });
    }

    closePhone() {
        if (!this.root) return;
        const modal = this.root.querySelector('.st-storyphone-modal');
        this.isPhoneOpen = false;
        this.root.classList.add('stp-is-minimized');
        this.root.classList.remove('stp-is-open');
        this.root.classList.remove('stp-is-dragged');
        applyLauncherPosition(this.root);
        modal?.classList.add('is-closed');
        modal?.classList.remove('is-open');
        modal?.setAttribute('aria-hidden', 'true');
    }

    toggleMinimized(minimized) {
        if (minimized) this.closePhone();
        else this.openPhone();
    }

    render() {
        if (!this.screen || !this.isPhoneOpen) return;
        const collected = this.collector.collect();
        const profile = this.profileManager.resolve(collected);
        this.root.style.setProperty('--stp-owner', `"${profile.displayName || 'StoryPhone'}"`);

        if (this.activeApp === 'home') this.renderHome(profile);
        if (this.activeApp === 'wechat') this.renderWechat(profile);
        if (this.activeApp === 'groups') this.renderGroups(profile);
        if (this.activeApp === 'moments') this.renderMoments();
        if (this.activeApp === 'momentCompose') this.renderMomentComposer();
        if (this.activeApp === 'forum') this.renderForum(profile);
        if (this.activeApp === 'forumCompose') this.renderForumComposer(profile);
        if (this.activeApp === 'forumDetail') this.renderForumDetail(profile);
        if (this.activeApp === 'calendar') this.renderCalendar();
        if (this.activeApp === 'memos') this.renderMemos();
        if (this.activeApp === 'target') this.renderTargetPhone(profile);
        if (this.activeApp === 'entries') this.renderPhoneEntries();
        if (this.activeApp === 'debug') this.renderDebugPanel();
        if (this.activeApp === 'settings') this.renderSettings();
    }

    setApp(app) {
        this.activeApp = app;
        this.render();
    }

    nav(title) {
        const bar = createElement('div', 'stp-nav');
        const back = createElement('button', 'stp-app-close', '×');
        back.type = 'button';
        back.setAttribute('aria-label', '关闭应用，回到手机桌面');
        back.addEventListener('click', () => this.setApp('home'));
        const heading = createElement('strong', '', title);
        bar.append(back, heading);
        return bar;
    }

    navWithAction(title, actionLabel, onAction, backAction) {
        const bar = this.nav(title);
        const back = bar.querySelector('.stp-app-close');
        if (backAction && back) {
            back.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                backAction();
            }, { capture: true });
        }
        if (actionLabel) {
            const action = createElement('button', 'stp-nav-action', actionLabel);
            action.type = 'button';
            action.addEventListener('click', onAction);
            bar.append(action);
        }
        return bar;
    }

    renderHome(profile) {
        this.screen.innerHTML = '';
        const hero = createElement('div', 'stp-home-hero');
        hero.innerHTML = `
            <div class="stp-logo">Phoning<br>Phone</div>
            <div class="stp-subtitle">${profile.displayName || EXTENSION_ID} · v${EXTENSION_VERSION}</div>
            <div class="stp-time">${this.state.value.time || '剧情时间未设定'}</div>
        `;
        const grid = createElement('div', 'stp-app-grid');
        [
            ['wechat', '微信', '💬'],
            ['groups', '群聊', '#'],
            ['moments', '朋友圈', '🫧'],
            ['forum', profile.forum?.name || '论坛', '📌'],
            ['calendar', '日历', '📅'],
            ['memos', '备忘录', '📝'],
            ['target', '角色侧屏', 'SIDE'],
            ['entries', 'Phone Entries', 'PE'],
            ['debug', '调试', 'DBG'],
            ['settings', '设置', '⚙️'],
        ].forEach(([app, label, icon]) => {
            const button = createElement('button', 'stp-app-icon', '');
            button.type = 'button';
            button.innerHTML = `<span>${icon}</span><b>${label}</b>`;
            button.addEventListener('click', () => this.setApp(app));
            grid.append(button);
        });
        this.screen.append(hero, grid);
    }

    renderWechat(profile) {
        this.screen.innerHTML = '';
        const wrap = createElement('div', 'stp-app stp-wechat-app');
        wrap.append(this.nav('微信'));
        const body = createElement('div', 'stp-wechat-body');
        const activeTab = this.wechatTab || 'chats';

        if (activeTab === 'discover') {
            const discover = createElement('div', 'stp-wechat-discover');
            const momentsButton = createElement('button', 'stp-wechat-discover-row', '');
            momentsButton.type = 'button';
            momentsButton.innerHTML = '<span>🫧</span><b>朋友圈</b><small>查看剧情世界里的动态</small><i>›</i>';
            momentsButton.addEventListener('click', () => {
                this.wechatTab = 'moments';
                this.renderWechat(profile);
            });
            discover.append(momentsButton);
            body.append(discover);
            wrap.append(body, this.wechatTabs(profile));
            this.screen.append(wrap);
            return;
        }

        if (activeTab === 'moments') {
            const feedTools = createElement('div', 'stp-feed-toolbar');
            const refreshBtn = createElement('button', 'stp-icon-action', '刷新');
            const composeBtn = createElement('button', 'stp-icon-action primary', '+');
            refreshBtn.type = 'button';
            composeBtn.type = 'button';
            refreshBtn.addEventListener('click', () => this.generateMoments());
            composeBtn.addEventListener('click', () => this.setApp('momentCompose'));
            feedTools.append(refreshBtn, composeBtn);
            const feedList = createElement('div', 'stp-card-list stp-moments-list stp-feed-list');
            this.state.value.phone.moments.forEach((post) => feedList.append(this.renderSocialCard(post, 'moment')));
            if (!this.state.value.phone.moments.length) feedList.append(createElement('p', 'stp-empty', '还没有动态。点右上角 + 发一条，或刷新生成手机侧动态。'));
            body.append(feedTools, feedList);
            wrap.append(body, this.wechatTabs(profile));
            this.screen.append(wrap);
            return;
            const action = createElement('button', 'stp-wide-action wechat-refresh stp-moment-camera', '生成/刷新 · 📷');
            action.type = 'button';
            action.addEventListener('click', () => this.generateMoments());
            const composer = this.createSocialComposerV2('moment');
            const list = createElement('div', 'stp-card-list stp-moments-list');
            this.state.value.phone.moments.forEach((post) => list.append(this.renderSocialCard(post, 'moment')));
            if (!this.state.value.phone.moments.length) list.append(createElement('p', 'stp-empty', '还没有动态。点击刷新会基于主剧情状态后台生成。'));
            body.append(action, composer, list);
            wrap.append(body, this.wechatTabs(profile));
            this.screen.append(wrap);
            return;
        }

        if (activeTab === 'contacts') {
            const contacts = createElement('div', 'stp-wechat-list');
            this.getWechatContacts(profile).forEach((friend) => {
                const item = createElement('button', 'stp-wechat-row', '');
                item.type = 'button';
                item.innerHTML = `<span class="stp-avatar">${friend.avatar || '👤'}</span><b>${friend.name}</b><small>${friend.role || 'NPC'}</small>`;
                item.addEventListener('click', () => {
                    this.selectedNpc = friend.id;
                    this.wechatTab = 'chats';
                    this.renderWechat(profile);
                });
                contacts.append(item);
            });
            body.append(contacts);
            wrap.append(body, this.wechatTabs(profile));
            this.screen.append(wrap);
            return;
        }

        const friends = this.getWechatContacts(profile);
        const current = friends.find((friend) => friend.id === this.selectedNpc);
        if (!current) {
            const listScreen = createElement('div', 'stp-wechat-list-screen');
            listScreen.append(createElement('div', 'stp-wechat-section-title', 'Chats'));
            friends.forEach((friend, index) => {
                const history = asArray(this.state.value.phone.chats[friend.id]);
                const last = history[history.length - 1] || {};
                const item = createElement('button', 'stp-wechat-thread-row', '');
                item.type = 'button';
                item.innerHTML = `
                    <span class="stp-avatar">${escapeHtml(friend.avatar || avatarText(friend.name))}</span>
                    <span class="stp-thread-main">
                        <b>${escapeHtml(friend.name || friend.id)}</b>
                        <small>${escapeHtml(last.content || friend.role || '点开开始聊天')}</small>
                    </span>
                    <time>${index === 0 ? 'now' : ''}</time>
                `;
                item.addEventListener('click', () => {
                    this.selectedNpc = friend.id;
                    this.renderWechat(profile);
                });
                listScreen.append(item);
            });
            if (!friends.length) listScreen.append(createElement('p', 'stp-empty', '暂无好友。可在 Phone Profile 的 friends 里配置。'));
            body.append(listScreen);
            wrap.append(body, this.wechatTabs(profile));
            this.screen.append(wrap);
            return;
        }

        const chatPaneFull = createElement('div', 'stp-chat-detail');
        const historyFull = asArray(this.state.value.phone.chats[current.id]).map((message) => {
            if (typeof message === 'string') return { sender: 'user', content: message, at: nowIso() };
            return { ...message, sender: message.sender === 'user' ? 'user' : 'npc', content: message.content || message.text || '' };
        });
        this.state.value.phone.chats[current.id] = historyFull;
        this.state.save();
        const headerFull = createElement('div', 'stp-chat-header');
        const backFull = createElement('button', 'stp-chat-back', '‹');
        backFull.type = 'button';
        backFull.addEventListener('click', () => {
            this.selectedNpc = null;
            this.renderWechat(profile);
        });
        headerFull.innerHTML = `<span class="stp-avatar">${escapeHtml(current.avatar || avatarText(current.name))}</span><b>${escapeHtml(current.name || current.id)}</b>`;
        headerFull.prepend(backFull);
        const messagesFull = createElement('div', 'stp-messages');
        historyFull.forEach((message) => {
            const bubble = createElement('div', `stp-message ${message.sender === 'user' ? 'me' : 'npc'}`);
            if (message.imageData || message.imageUrl) {
                const img = createElement('img', 'stp-chat-image');
                img.src = message.imageData || message.imageUrl;
                img.alt = message.content || '聊天图片';
                bubble.append(img);
            }
            if (message.sticker) bubble.append(createElement('div', 'stp-sticker', message.sticker));
            if (message.content) bubble.append(createElement('span', '', message.content));
            messagesFull.append(bubble);
        });
        const formFull = createElement('form', 'stp-reply-box stp-chat-input-bar');
        formFull.innerHTML = `
            <input name="message" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="只在手机内发送..." />
            <label class="stp-file-button">图片<input name="image" type="file" accept="image/*" /></label>
            <button class="stp-pixel-button" type="submit">发送</button>
            <button class="stp-pixel-button ghost" type="button" data-generate>生成回复</button>
        `;
        formFull.setAttribute('autocomplete', 'off');
        formFull.addEventListener('submit', async (event) => {
            event.preventDefault();
            const input = formFull.querySelector('input[name="message"]');
            const fileInput = formFull.querySelector('input[name="image"]');
            const text = input.value.trim();
            let imageData = null;
            try {
                imageData = await fileToDataUrl(fileInput.files?.[0]);
            } catch (error) {
                this.showNotice(error.message);
                return;
            }
            if (!text && !imageData) return;
            this.pushChat(current, { sender: 'user', content: text, imageData, at: nowIso() });
            input.value = '';
            fileInput.value = '';
            this.renderWechat(profile);
        });
        formFull.querySelector('[data-generate]').addEventListener('click', () => this.generateNpcReply(current));
        chatPaneFull.append(headerFull, messagesFull, formFull);
        body.append(chatPaneFull);
        wrap.append(body, this.wechatTabs(profile));
        this.screen.append(wrap);
        return;

        {
        const layout = createElement('div', 'stp-chat-layout');
        const list = createElement('div', 'stp-friend-list');
        const friends = this.getWechatContacts(profile);
        if (!this.selectedNpc && friends[0]) this.selectedNpc = friends[0].id;

        friends.forEach((friend) => {
            const item = createElement('button', `stp-friend ${friend.id === this.selectedNpc ? 'active' : ''}`, '');
            item.type = 'button';
            item.innerHTML = `<span class="stp-avatar">${friend.avatar || '👤'}</span><b>${friend.name}</b><span>${friend.role || 'NPC'}</span>`;
            item.addEventListener('click', () => {
                this.selectedNpc = friend.id;
                this.renderWechat(profile);
            });
            list.append(item);
        });

        const current = friends.find((friend) => friend.id === this.selectedNpc) || friends[0];
        const chatPane = createElement('div', 'stp-chat-pane');
        if (!current) {
            chatPane.append(createElement('p', 'stp-empty', '暂无好友。可在角色卡 phone profile 中配置 friends。'));
        } else {
            const history = asArray(this.state.value.phone.chats[current.id]).map((message) => {
                if (typeof message === 'string') return { sender: 'user', content: message, at: nowIso() };
                return { ...message, sender: message.sender === 'user' ? 'user' : 'npc', content: message.content || message.text || '' };
            });
            this.state.value.phone.chats[current.id] = history;
            this.state.save();
            const messages = createElement('div', 'stp-messages');
            history.forEach((message) => {
                const bubble = createElement('div', `stp-message ${message.sender === 'user' ? 'me' : 'npc'}`);
                if (message.imageData || message.imageUrl) {
                    const img = createElement('img', 'stp-chat-image');
                    img.src = message.imageData || message.imageUrl;
                    img.alt = message.content || '聊天图片';
                    bubble.append(img);
                }
                if (message.sticker) bubble.append(createElement('div', 'stp-sticker', message.sticker));
                if (message.content) bubble.append(createElement('span', '', message.content));
                messages.append(bubble);
            });
            const form = createElement('form', 'stp-reply-box');
            form.innerHTML = `
                <input name="message" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="只在手机内发送..." />
                <label class="stp-file-button">图片<input name="image" type="file" accept="image/*" /></label>
                <button class="stp-pixel-button" type="submit">发送</button>
                <button class="stp-pixel-button ghost" type="button" data-generate>生成回复</button>
            `;
            form.setAttribute('autocomplete', 'off');
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                const input = form.querySelector('input[name="message"]');
                const fileInput = form.querySelector('input[name="image"]');
                const text = input.value.trim();
                let imageData = null;
                try {
                    imageData = await fileToDataUrl(fileInput.files?.[0]);
                } catch (error) {
                    this.showNotice(error.message);
                    return;
                }
                if (!text && !imageData) return;
                this.pushChat(current, { sender: 'user', content: text, imageData, at: nowIso() });
                input.value = '';
                fileInput.value = '';
                this.renderWechat(profile);
            });
            form.querySelector('[data-generate]').addEventListener('click', () => this.generateNpcReply(current));
            chatPane.append(createElement('h3', '', current.name), messages, form);
        }
        layout.append(list, chatPane);
        body.append(layout);
        wrap.append(body, this.wechatTabs(profile));
        this.screen.append(wrap);
        }
    }

    wechatTabs(profile) {
        const tabs = createElement('div', 'stp-wechat-tabs');
        [
            ['chats', '💬', '微信'],
            ['contacts', '👥', '通讯录'],
            ['discover', '🧭', '发现'],
            ['me', '🙂', '我'],
        ].forEach(([id, icon, label]) => {
            const button = createElement('button', `${this.wechatTab === id || (!this.wechatTab && id === 'chats') ? 'active' : ''}`, '');
            button.type = 'button';
            button.innerHTML = `<span>${icon}</span><b>${label}</b>`;
            button.addEventListener('click', () => {
                if (id === 'me') {
                    this.showNotice('个人页后续会接入 persona 与手机设置');
                    return;
                }
                this.wechatTab = id;
                this.renderWechat(profile);
            });
            tabs.append(button);
        });
        return tabs;
    }

    pushChat(friend, message) {
        const id = friend.id;
        if (!this.state.value.phone.chats[id]) this.state.value.phone.chats[id] = [];
        this.state.value.phone.chats[id].push(message);
        const isChar = this.state.isCharId(friend.id) || this.state.isCharId(friend.name) || Boolean(friend.isChar);
        const isUserSender = message.sender === 'user';
        const actorId = isUserSender ? 'user' : id;
        const targetId = isUserSender ? (isChar ? this.state.getHostCharId() : id) : 'user';
        const visibility = normalizeVisibility('visible_to_npc', {
            user: true,
            actorId,
            targetId,
            isChar,
        });
        this.state.addPhoneEvent({
            source: EVENT_SOURCES.PRIVATE_CHAT,
            channel: 'wechat_private',
            type: 'npc_chat',
            speakerId: actorId,
            actor: actorId,
            target: targetId,
            actorId,
            targetId,
            visibility,
            content: message.content || (message.imageData || message.imageUrl ? '[图片]' : message.sticker ? `[表情包] ${message.sticker}` : ''),
            summary: `${friend.name} 微信：${clampText(message.content || (message.imageData || message.imageUrl ? '[图片]' : message.sticker || ''), 100)}`,
        });
        this.state.save();
    }

    async generateNpcReply(friend) {
        this.setLoading(`正在生成 ${friend.name} 的微信回复...`);
        const result = await this.generator.generateWithContext('npc_chat', {
            npcId: friend.id,
            npcName: friend.name,
            history: this.state.value.phone.chats[friend.id] || [],
        });
        if (!result.ok) return this.showNotice(result.message);
        const item = result.items[0] || {};
        const content = item.content || result.summary || '（对方暂时没有新消息）';
        // TODO: If SillyTavern exposes a stable image generation extension API, wire generated image/sticker assets here.
        this.pushChat(friend, { sender: friend.id, content, imageUrl: item.imageUrl, imageData: item.imageData, sticker: item.sticker, at: nowIso() });
        this.renderWechat(this.state.value.profile);
    }

    renderGroups(profile) {
        this.screen.innerHTML = '';
        const wrap = createElement('div', 'stp-app');
        wrap.append(this.nav('群聊'));
        const groups = asArray(profile.groups);
        const list = createElement('div', 'stp-card-list compact');
        if (!this.selectedGroup && groups[0]) this.selectedGroup = groups[0].id;
        groups.forEach((group) => {
            const card = createElement('button', `stp-list-card ${this.selectedGroup === group.id ? 'active' : ''}`, '');
            card.type = 'button';
            card.innerHTML = `<b>${escapeHtml(group.name || group.id)}</b><small>${asArray(group.members).join(', ')}</small>`;
            card.addEventListener('click', () => {
                this.selectedGroup = group.id;
                this.renderGroups(profile);
            });
            list.append(card);
        });

        const current = groups.find((group) => group.id === this.selectedGroup) || groups[0];
        const pane = createElement('div', 'stp-chat-pane');
        if (!current) {
            pane.append(createElement('p', 'stp-empty', '暂无群聊。可在 Phone Profile 的 groups 中配置。'));
        } else {
            const history = asArray(this.state.value.phone.groupChats[current.id]);
            const messages = createElement('div', 'stp-messages');
            history.forEach((message) => {
                const bubble = createElement('div', `stp-message ${message.actorId === 'user' ? 'me' : 'npc'}`);
                bubble.append(createElement('small', '', message.actorName || message.actorId || 'member'));
                if (message.sticker) bubble.append(createElement('div', 'stp-sticker', message.sticker));
                bubble.append(createElement('span', '', message.content || message.text || ''));
                messages.append(bubble);
            });
            const form = createElement('form', 'stp-reply-box');
            form.innerHTML = `
                <input name="message" autocomplete="off" placeholder="群聊消息，只对群成员可见" />
                <button class="stp-pixel-button" type="submit">发送</button>
                <button class="stp-pixel-button ghost" type="button" data-generate>生成群聊</button>
            `;
            form.addEventListener('submit', (event) => {
                event.preventDefault();
                const text = String(new FormData(form).get('message') || '').trim();
                if (!text) return;
                this.state.addGroupMessage(current, { actorId: 'user', actorName: '我', content: text, at: nowIso() });
                this.renderGroups(profile);
            });
            form.querySelector('[data-generate]').addEventListener('click', () => this.generateGroupReply(current));
            pane.append(createElement('h3', '', current.name || current.id), messages, form);
        }
        wrap.append(list, pane);
        this.screen.append(wrap);
    }

    async generateGroupReply(group) {
        this.setLoading(`正在生成 ${group.name || group.id} 的群聊消息...`);
        const result = await this.generator.generateWithContext('group_chat', {
            groupId: group.id,
            groupName: group.name,
            members: group.members,
            history: this.state.value.phone.groupChats[group.id] || [],
        });
        if (!result.ok) return this.showNotice(result.message);
        result.items.slice(0, 4).forEach((item) => {
            this.state.addGroupMessage(group, {
                actorId: item.actorId || item.actor || 'group_member',
                actorName: item.actor || item.author || item.actorId || '群成员',
                content: item.content || item.text || result.summary || '',
                sticker: item.sticker,
                at: nowIso(),
            });
        });
        this.renderGroups(this.state.value.profile);
    }

    createSocialComposerV2(source) {
        const form = createElement('form', `stp-social-composer stp-social-composer-v2 ${source === 'forum' ? 'forum' : 'moment'}`);
        const isForum = source === 'forum';
        const profile = this.state.value.profile || DEFAULT_PROFILE;
        const targets = profileSelectableTargets(profile);
        const visibilityControls = isForum ? '' : `
            <div class="stp-visibility-panel">
                <label>可见范围
                    <select name="visibilityMode">
                        <option value="public">公开</option>
                        <option value="friends">好友可见</option>
                        <option value="selected">仅选中可见</option>
                        <option value="exclude">选中不可见</option>
                        <option value="private">仅自己可见</option>
                    </select>
                </label>
                <div class="stp-target-picker">
                    ${targets.map((target) => `
                        <label>
                            <input type="checkbox" name="visibilityTargets" value="${escapeHtml(target.id)}">
                            <span>${escapeHtml(target.name)}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
        form.innerHTML = `
            <input name="title" autocomplete="off" placeholder="${isForum ? '标题' : '这一刻的心情'}" />
            <textarea name="content" rows="3" placeholder="${isForum ? '发布一条生活化、克制的论坛帖' : '写点什么...'}"></textarea>
            ${visibilityControls}
            <div class="stp-composer-row">
                <label class="stp-file-button">图片<input name="image" type="file" accept="image/*" /></label>
                <button class="stp-pixel-button" type="submit">${isForum ? '发帖' : '发送'}</button>
            </div>
        `;
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const data = new FormData(form);
            const title = String(data.get('title') || '').trim();
            const content = String(data.get('content') || '').trim();
            let imageData = null;
            try {
                imageData = await fileToDataUrl(form.querySelector('input[name="image"]').files?.[0]);
            } catch (error) {
                this.showNotice(error.message);
                return;
            }
            if (!title && !content && !imageData) return;

            const visibilityMode = String(data.get('visibilityMode') || 'public');
            const selectedTargets = Array.from(form.querySelectorAll('input[name="visibilityTargets"]:checked')).map((input) => input.value);
            const visibilityScope = isForum
                ? normalizeMomentVisibility('public')
                : normalizeMomentVisibility(
                    visibilityMode,
                    visibilityMode === 'selected' ? selectedTargets : [],
                    visibilityMode === 'exclude' ? selectedTargets : [],
                );
            const visibility = isForum ? 'public' : buildMomentVisibility(profile, visibilityScope);
            const post = {
                id: `${source}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
                actor: '我',
                actorId: 'user',
                author: '我',
                title,
                content,
                imageData,
                time: '刚刚',
                board: isForum ? this.state.value.profile?.forum?.defaultBoard || '论坛' : undefined,
                visibility: isForum ? 'public' : visibilityToLegacyLabel(visibility),
                visibilityScope,
                likes: [],
                comments: [],
            };
            if (isForum) this.state.value.phone.forumPosts.unshift(post);
            else this.state.value.phone.moments.unshift(post);
            this.state.addPhoneEvent({
                source: isForum ? EVENT_SOURCES.FORUM : EVENT_SOURCES.MOMENTS,
                channel: isForum ? 'forum' : 'moments',
                type: isForum ? 'forum_user_post' : 'moment_user_post',
                speakerId: 'user',
                actorId: 'user',
                targetId: isForum ? post.board : null,
                actor: 'user',
                target: isForum ? post.board : null,
                publicLevel: isForum ? 'public' : visibilityToLegacyLabel(visibility),
                selectedViewers: visibilityScope.selected,
                visibilityHint: visibilityScope.selected,
                content: `${title} ${content} ${imageData ? '[图片]' : ''}`.trim(),
                visibility,
                summary: `${isForum ? '论坛发帖' : `朋友圈发布（${momentVisibilityLabel(profile, visibilityScope)}）`}：${clampText(title || content || '[图片]', 100)}`,
                meta: isForum ? {} : { visibilityScope },
            });
            this.state.save();
            if (isForum) {
                this.activeApp = 'forum';
                this.renderForum(this.state.value.profile);
            } else {
                this.activeApp = 'moments';
                this.renderMoments();
            }
        });
        return form;
    }

    createSocialComposer(source) {
        const form = createElement('form', 'stp-social-composer');
        const isForum = source === 'forum';
        form.innerHTML = `
            <input name="title" autocomplete="off" placeholder="${isForum ? '标题：像论坛帖子一样发一条' : '标题/心情（可选）'}" />
            <textarea name="content" rows="3" placeholder="${isForum ? '帖子内容，公开可见，会写入论坛事件' : '这一刻的想法，支持图文'}"></textarea>
            <div class="stp-composer-row">
                <label class="stp-file-button">配图<input name="image" type="file" accept="image/*" /></label>
                <button class="stp-pixel-button" type="submit">${isForum ? '发布帖子' : '发布动态'}</button>
            </div>
        `;
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const data = new FormData(form);
            const title = String(data.get('title') || '').trim();
            const content = String(data.get('content') || '').trim();
            let imageData = null;
            try {
                imageData = await fileToDataUrl(form.querySelector('input[name="image"]').files?.[0]);
            } catch (error) {
                this.showNotice(error.message);
                return;
            }
            if (!title && !content && !imageData) return;
            const post = {
                id: `${source}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
                actor: '我',
                actorId: 'user',
                author: '我',
                title,
                content,
                imageData,
                time: '刚刚',
                board: isForum ? this.state.value.profile?.forum?.defaultBoard || '论坛' : undefined,
                visibility: 'public',
                likes: [],
                comments: [],
            };
            if (isForum) this.state.value.phone.forumPosts.unshift(post);
            else this.state.value.phone.moments.unshift(post);
            this.state.addPhoneEvent({
                source: isForum ? EVENT_SOURCES.FORUM : EVENT_SOURCES.MOMENTS,
                channel: isForum ? 'forum' : 'moments',
                type: isForum ? 'forum_user_post' : 'moment_user_post',
                speakerId: 'user',
                actorId: 'user',
                targetId: isForum ? post.board : null,
                actor: 'user',
                target: isForum ? post.board : null,
                publicLevel: isForum ? 'public' : 'public',
                content: `${title} ${content} ${imageData ? '[图片]' : ''}`.trim(),
                visibility: 'public',
                summary: `${isForum ? '论坛发帖' : '朋友圈发图文'}：${clampText(title || content || '[图片]', 100)}`,
            });
            this.state.save();
            if (isForum) this.renderForum(this.state.value.profile);
            else this.renderMoments();
        });
        return form;
    }

    renderMoments() {
        this.screen.innerHTML = '';
        const wrap = createElement('div', 'stp-app');
        wrap.append(this.navWithAction('朋友圈', '+', () => this.setApp('momentCompose')));
        const tools = createElement('div', 'stp-feed-toolbar');
        const refresh = createElement('button', 'stp-icon-action', '刷新');
        refresh.type = 'button';
        refresh.addEventListener('click', () => this.generateMoments());
        tools.append(refresh);
        const feed = createElement('div', 'stp-card-list stp-moments-list stp-feed-list');
        this.state.value.phone.moments.forEach((post) => feed.append(this.renderSocialCard(post, 'moment')));
        if (!this.state.value.phone.moments.length) feed.append(createElement('p', 'stp-empty', '还没有朋友圈动态。右上角 + 发布，刷新可生成 NPC 动态。'));
        wrap.append(tools, feed);
        this.screen.append(wrap);
        return;
        wrap.append(this.nav('朋友圈'));
        const action = createElement('button', 'stp-wide-action stp-moment-camera', '生成/刷新 · 📷');
        action.type = 'button';
        action.addEventListener('click', () => this.generateMoments());
        const composer = this.createSocialComposerV2('moment');
        const list = createElement('div', 'stp-card-list');
        this.state.value.phone.moments.forEach((post) => list.append(this.renderSocialCard(post, 'moment')));
        if (!this.state.value.phone.moments.length) list.append(createElement('p', 'stp-empty', '还没有动态。点击刷新会基于主剧情状态后台生成。'));
        wrap.append(action, composer, list);
        this.screen.append(wrap);
    }

    renderMomentComposer() {
        this.screen.innerHTML = '';
        const wrap = createElement('div', 'stp-app stp-compose-page');
        wrap.append(this.navWithAction('发朋友圈', '取消', () => this.setApp('moments')));
        const header = createElement('div', 'stp-compose-hero');
        header.innerHTML = '<b>这一刻的心情</b><small>可设置公开、仅谁可见、仅谁不可见；这里发布的内容只进入手机事件记忆。</small>';
        const composer = this.createSocialComposerV2('moment');
        wrap.append(header, composer);
        this.screen.append(wrap);
    }

    async generateMoments() {
        this.setLoading('正在生成朋友圈...');
        const result = await this.generator.generateWithContext('moments', { visibility: 'public' });
        if (!result.ok) return this.showNotice(result.message);
        const items = result.items.map((item) => ({
            id: `moment_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            ...item,
            likes: asArray(item.likes),
            comments: asArray(item.comments),
            visibility: item.visibility || 'public',
        }));
        this.state.value.phone.moments.unshift(...items);
        this.state.addPhoneEvent({ source: EVENT_SOURCES.MOMENTS, channel: 'moments', type: 'moments_refresh', speakerId: 'system', actorId: 'system', actor: 'system', visibility: 'public', summary: result.summary || `生成 ${items.length} 条朋友圈` });
        items.forEach((item) => {
            this.state.addPhoneEvent({
                source: EVENT_SOURCES.MOMENTS,
                channel: 'moments',
                type: 'moment_post',
                speakerId: item.actorId || item.actor || item.author || 'unknown',
                actorId: item.actorId || item.actor || item.author || 'unknown',
                actor: item.actorId || item.actor || item.author || 'unknown',
                target: null,
                content: `${item.title || ''} ${item.content || ''}`.trim(),
                visibility: item.visibility || 'public',
                summary: `朋友圈动态：${clampText(item.title || item.content, 120)}`,
            });
        });
        this.state.save();
        this.renderMoments();
    }

    renderForum(profile) {
        this.screen.innerHTML = '';
        const wrap = createElement('div', 'stp-app');
        wrap.append(this.navWithAction(profile.forum?.name || '论坛', '+', () => this.setApp('forumCompose')));
        const tools = createElement('div', 'stp-feed-toolbar');
        const refresh = createElement('button', 'stp-icon-action', '刷新');
        refresh.type = 'button';
        refresh.addEventListener('click', () => this.generateForum());
        tools.append(refresh);
        const feed = createElement('div', 'stp-card-list stp-thread-feed stp-feed-list');
        this.state.value.phone.forumPosts.forEach((post) => feed.append(this.renderSocialCard(post, 'forum')));
        if (!this.state.value.phone.forumPosts.length) feed.append(createElement('p', 'stp-empty', '论坛还没有帖子。右上角 + 发帖，刷新可生成公开帖子。'));
        wrap.append(tools, feed);
        this.screen.append(wrap);
        return;
        wrap.append(this.nav(profile.forum?.name || '论坛'));
        const action = createElement('button', 'stp-wide-action', '刷新论坛帖子');
        action.type = 'button';
        action.addEventListener('click', () => this.generateForum());
        const composer = this.createSocialComposerV2('forum');
        const list = createElement('div', 'stp-card-list');
        this.state.value.phone.forumPosts.forEach((post) => list.append(this.renderSocialCard(post, 'forum')));
        if (!this.state.value.phone.forumPosts.length) list.append(createElement('p', 'stp-empty', '论坛空空的。刷新后会生成克制真实的校园帖子。'));
        wrap.append(action, composer, list);
        this.screen.append(wrap);
    }

    renderForumComposer(profile) {
        this.screen.innerHTML = '';
        const wrap = createElement('div', 'stp-app stp-compose-page');
        wrap.append(this.navWithAction('发布帖子', '取消', () => this.setApp('forum')));
        const header = createElement('div', 'stp-compose-hero');
        header.innerHTML = `<b>${escapeHtml(profile.forum?.name || '论坛')}</b><small>发帖会作为 public 手机事件写入统一 eventLog；具体 NPC 是否知道仍由可见性和习惯判断。</small>`;
        const composer = this.createSocialComposerV2('forum');
        wrap.append(header, composer);
        this.screen.append(wrap);
    }

    renderForumDetail(profile) {
        this.screen.innerHTML = '';
        const post = asArray(this.state.value.phone.forumPosts).find((item) => item.id === this.selectedForumPost);
        const wrap = createElement('div', 'stp-app stp-thread-detail-page');
        wrap.append(this.navWithAction('帖子', '', () => {}, () => this.setApp('forum')));
        if (!post) {
            wrap.append(createElement('p', 'stp-empty', '帖子不存在或已删除。'));
            this.screen.append(wrap);
            return;
        }
        const detail = this.renderSocialCard(post, 'forum');
        detail.classList.add('stp-thread-detail-card');
        const replies = createElement('div', 'stp-thread-replies');
        asArray(post.comments).forEach((reply) => {
            const row = createElement('div', 'stp-thread-reply', '');
            row.innerHTML = `<span class="stp-social-avatar">${escapeHtml(avatarText(reply.actor || 'U'))}</span><p><b>${escapeHtml(reply.actor || '匿名')}</b><br>${escapeHtml(reply.content || reply)}</p>`;
            replies.append(row);
        });
        if (!asArray(post.comments).length) replies.append(createElement('p', 'stp-empty', '还没有回复。'));
        wrap.append(detail, replies);
        this.screen.append(wrap);
    }

    async generateForum() {
        this.setLoading('正在刷新论坛...');
        const result = await this.generator.generateWithContext('forum', {
            board: this.state.value.profile?.forum?.defaultBoard || '校园生活',
            tone: this.state.value.profile?.forum?.tone,
        });
        if (!result.ok) return this.showNotice(result.message);
        const items = result.items.map((item) => ({
            id: `forum_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            ...item,
            likes: asArray(item.likes),
            comments: asArray(item.comments),
            visibility: item.visibility || 'public',
        }));
        this.state.value.phone.forumPosts.unshift(...items);
        this.state.addPhoneEvent({ source: EVENT_SOURCES.FORUM, channel: 'forum', type: 'forum_refresh', speakerId: 'system', actorId: 'system', actor: 'system', visibility: 'public', publicLevel: 'public', summary: result.summary || `生成 ${items.length} 条论坛帖` });
        items.forEach((item) => {
            this.state.addPhoneEvent({
                source: EVENT_SOURCES.FORUM,
                channel: 'forum',
                type: 'forum_post',
                speakerId: item.actorId || item.actor || item.author || 'anonymous',
                actorId: item.actorId || item.actor || item.author || 'anonymous',
                targetId: item.board || this.state.value.profile?.forum?.defaultBoard || null,
                actor: item.actorId || item.actor || item.author || 'anonymous',
                target: item.board || this.state.value.profile?.forum?.defaultBoard || null,
                content: `${item.title || ''} ${item.content || ''}`.trim(),
                visibility: 'public',
                summary: `论坛帖子：${clampText(item.title || item.content, 120)}`,
            });
        });
        this.state.save();
        this.renderForum(this.state.value.profile);
    }

    renderSocialCard(post, source) {
        const card = createElement('article', 'stp-social-card');
        card.classList.add(source === 'forum' ? 'stp-thread-card' : 'stp-moment-card');
        if (source === 'forum') {
            card.setAttribute('role', 'button');
            card.tabIndex = 0;
            card.addEventListener('click', (event) => {
                if (event.target.closest('button, input, label, textarea, select')) return;
                this.selectedForumPost = post.id;
                this.setApp('forumDetail');
            });
            card.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter') return;
                this.selectedForumPost = post.id;
                this.setApp('forumDetail');
            });
        }
        const comments = asArray(post.comments);
        const likes = asArray(post.likes);
        const likedByUser = likes.includes('user');
        const profile = this.state.value.profile || DEFAULT_PROFILE;
        const authorName = actorDisplayName(profile, post.actorId || post.actor || post.author);
        const visibilityLabel = source === 'moment'
            ? momentVisibilityLabel(profile, post.visibilityScope || { mode: post.visibility || 'public' })
            : (post.board || '论坛');
        card.innerHTML = `
            <div class="stp-card-meta"><b>${escapeHtml(post.actor || post.author || '匿名')}</b><span>${escapeHtml(post.time || '刚刚')}</span></div>
            ${post.title ? `<h3>${escapeHtml(post.title)}</h3>` : ''}
            ${post.content ? `<p>${escapeHtml(post.content)}</p>` : ''}
            <div class="stp-chip-row">
                <span>${escapeHtml(post.board || post.visibility || 'public')}</span>
                <span>${likes.length} likes</span>
                <span>${comments.length} comments</span>
            </div>
        `;
        const meta = card.querySelector('.stp-card-meta');
        if (meta) {
            meta.innerHTML = `<span class="stp-social-avatar">${escapeHtml(avatarText(authorName))}</span><b>${escapeHtml(authorName || '匿名')}</b><span>${escapeHtml(post.time || '刚刚')}</span>`;
        }
        const firstChip = card.querySelector('.stp-chip-row span');
        if (firstChip) firstChip.textContent = visibilityLabel;
        if (post.imageData || post.imageUrl) {
            const image = createElement('img', 'stp-social-image');
            image.src = post.imageData || post.imageUrl;
            image.alt = '动态配图';
            card.insertBefore(image, card.querySelector('.stp-chip-row'));
        }
        const actions = createElement('div', 'stp-inline-actions');
        const like = createElement('button', `stp-pixel-button ghost ${likedByUser ? 'active' : ''}`, likedByUser ? '已赞' : '点赞');
        const comment = createElement('button', 'stp-pixel-button ghost', '评论');
        like.type = 'button';
        comment.type = 'button';
        like.addEventListener('click', () => {
            post.likes = asArray(post.likes);
            const wasLiked = post.likes.includes('user');
            post.likes = wasLiked ? post.likes.filter((id) => id !== 'user') : [...post.likes, 'user'];
            const sourceName = source === 'forum' ? EVENT_SOURCES.FORUM : EVENT_SOURCES.MOMENTS;
            const authorId = post.actorId || post.actor || post.author || null;
            const actionVisibility = source === 'moment'
                ? buildMomentVisibility(profile, post.visibilityScope || { mode: post.visibility || 'public' })
                : 'public';
            this.state.addPhoneEvent({
                source: sourceName,
                channel: source === 'forum' ? 'forum' : 'moments',
                type: wasLiked ? `${source}_unlike` : `${source}_like`,
                speakerId: 'user',
                actorId: 'user',
                targetId: authorId,
                actor: 'user',
                target: authorId,
                selectedViewers: post.visibilityScope?.selected,
                visibilityHint: post.visibilityScope?.selected,
                visibility: actionVisibility,
                summary: `${wasLiked ? '取消点赞' : '点赞'}：${post.title || post.content || '[图片]'}`,
            });
            this.state.save();
            this.render();
        });
        comment.addEventListener('click', () => {
            const text = prompt('输入评论（只保存在手机内）：');
            if (!text?.trim()) return;
            post.comments = asArray(post.comments);
            post.comments.push({ actor: 'user', content: text.trim(), at: nowIso() });
            const sourceName = source === 'forum' ? EVENT_SOURCES.FORUM : EVENT_SOURCES.MOMENTS;
            const authorId = post.actorId || post.actor || post.author || null;
            const actionVisibility = source === 'moment'
                ? buildMomentVisibility(profile, post.visibilityScope || { mode: post.visibility || 'public' })
                : 'public';
            this.state.addPhoneEvent({
                source: sourceName,
                channel: source === 'forum' ? 'forum' : 'moments',
                type: `${source}_comment`,
                speakerId: 'user',
                actorId: 'user',
                targetId: authorId,
                actor: 'user',
                target: authorId,
                content: text.trim(),
                visibility: actionVisibility,
                summary: `评论：${clampText(text, 80)}`,
            });
            this.state.save();
            this.render();
        });
        actions.append(like, comment);
        const commentList = createElement('div', 'stp-comment-list');
        comments.slice(-4).forEach((item) => commentList.append(createElement('p', '', `${item.actor || '匿名'}：${item.content || item}`)));
        card.append(actions, commentList);
        return card;
    }

    renderCalendar() {
        this.screen.innerHTML = '';
        const wrap = createElement('div', 'stp-app');
        wrap.append(this.nav('日历'));
        const form = createElement('form', 'stp-editor');
        form.innerHTML = `
            <input name="time" placeholder="时间，例如 今天 18:00" />
            <input name="title" placeholder="安排 / 暗线" />
            <button class="stp-pixel-button" type="submit">添加</button>
        `;
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const data = new FormData(form);
            const title = String(data.get('title') || '').trim();
            if (!title) return;
            this.state.upsertCalendar({
                time: String(data.get('time') || '未定').trim(),
                title,
                visibility: 'user_only',
            });
            this.renderCalendar();
        });
        const list = createElement('div', 'stp-card-list compact');
        const currentTime = createElement('div', 'stp-note', `剧情时间：${this.state.value.time || '未设定'} / 地点：${this.state.value.location || '未设定'}`);
        this.state.value.phone.calendar.forEach((item) => list.append(createElement('div', 'stp-list-card', `${item.time || '未定'}｜${item.title}`)));
        if (!this.state.value.phone.calendar.length) list.append(createElement('p', 'stp-empty', '暂无日程。可记录今日安排和未来暗线。'));
        wrap.append(currentTime, form, list);
        this.screen.append(wrap);
    }

    renderMemos() {
        this.screen.innerHTML = '';
        const wrap = createElement('div', 'stp-app');
        wrap.append(this.nav('备忘录'));
        const form = createElement('form', 'stp-editor');
        form.innerHTML = `
            <textarea name="memo" rows="3" placeholder="新增线索、备忘、用户知道的信息..."></textarea>
            <button class="stp-pixel-button" type="submit">保存线索</button>
        `;
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const text = String(new FormData(form).get('memo') || '').trim();
            if (!text) return;
            this.state.addMemo(text);
            this.renderMemos();
        });
        const list = createElement('div', 'stp-card-list compact');
        this.state.value.phone.memos.forEach((memo) => {
            const card = createElement('div', 'stp-list-card memo');
            card.innerHTML = `<p>${memo.text}</p><button class="stp-pixel-button ghost" type="button">删除</button>`;
            card.querySelector('button').addEventListener('click', () => {
                this.state.deleteMemo(memo.id);
                this.renderMemos();
            });
            list.append(card);
        });
        if (!this.state.value.phone.memos.length) list.append(createElement('p', 'stp-empty', '暂无备忘录。'));
        wrap.append(form, list);
        this.screen.append(wrap);
    }

    renderTargetPhone(profile) {
        this.screen.innerHTML = '';
        const wrap = createElement('div', 'stp-app');
        wrap.append(this.nav('角色侧屏'));
        const notice = createElement('div', 'stp-note', '玩家可见的信息面板，不等于 {{user}} 已知。默认内容是 player_visible / char_private；同步给 {{user}} 必须填写剧情原因。');
        const action = createElement('button', 'stp-wide-action', '生成角色侧屏碎片');
        action.type = 'button';
        action.addEventListener('click', () => this.generateTargetPhone(profile));
        const list = createElement('div', 'stp-card-list');
        const data = this.state.value.phone.targetPhone;
        const sideData = this.state.value.phone.characterSideScreen;
        [...asArray(data.messages), ...Object.values(sideData).flat()].forEach((item) => {
            const card = createElement('div', 'stp-list-card', '');
            card.innerHTML = `<b>${escapeHtml(item.title || item.actor || '项目')}</b><p>${escapeHtml(item.content || item.text || item.time || '')}</p><small>${escapeHtml(item.visibility || 'char_private')}</small>`;
            if (!item.userVisibleReason) {
                const promote = createElement('button', 'stp-pixel-button ghost', '同步为 user 已知');
                promote.type = 'button';
                promote.addEventListener('click', () => {
                    const reason = prompt('填写剧情原因，例如：对方主动展示手机 / 误发截图 / 锁屏通知被看到');
                    if (!reason?.trim()) return;
                    this.state.promoteCharacterSideItemToUserKnown(item.id, reason.trim());
                    this.renderTargetPhone(profile);
                });
                card.append(promote);
            }
            list.append(card);
        });
        if (!list.children.length) list.append(createElement('p', 'stp-empty', '尚未生成目标角色手机内容。'));
        wrap.append(notice, action, list);
        this.screen.append(wrap);
    }

    async generateTargetPhone(profile) {
        this.setLoading(`正在生成 ${profile.targetPhoneOwner || '目标角色'} 手机...`);
        const result = await this.generator.generateWithContext('target_phone', {
            owner: profile.targetPhoneOwner,
            visibility: 'char_private',
            readonly: true,
        });
        if (!result.ok) return this.showNotice(result.message);
        const normalized = result.items.map((item) => ({
            id: item.id || `side_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            ...item,
            visibility: item.visibility || 'char_private',
        }));
        this.state.value.phone.targetPhone.messages.unshift(...normalized);
        normalized.forEach((item) => {
            this.state.addCharacterSideItem({
                id: item.id,
                title: item.title || item.actor || '角色侧屏碎片',
                content: item.content || item.text || '',
                category: item.category || 'fragments',
                visibility: item.visibility || 'char_private',
            });
            this.state.addPhoneEvent({
                source: EVENT_SOURCES.TARGET_PHONE,
                channel: 'target_phone',
                type: 'target_phone_item',
                speakerId: this.state.getHostCharId(),
                actorId: this.state.getHostCharId(),
                targetId: null,
                actor: this.state.getHostCharId(),
                target: null,
                content: `${item.title || ''} ${item.content || item.text || ''}`.trim(),
                visibility: 'char_private',
                summary: `角色侧屏内容：${clampText(item.title || item.content || item.text, 120)}`,
                injectToMain: false,
            });
        });
        this.state.addPhoneEvent({ source: EVENT_SOURCES.TARGET_PHONE, channel: 'target_phone', type: 'side_screen_view', speakerId: 'player', actorId: 'player', targetId: this.state.getHostCharId(), actor: 'player', target: this.state.getHostCharId(), visibility: 'player_visible', summary: result.summary || `玩家查看了 ${profile.targetPhoneOwner} 的角色侧屏`, injectToMain: false });
        this.state.save();
        this.renderTargetPhone(profile);
    }

    renderPhoneEntries() {
        this.screen.innerHTML = '';
        const wrap = createElement('div', 'stp-app');
        wrap.append(this.nav('Phone Entries'));
        const form = createElement('form', 'stp-editor');
        form.innerHTML = `
            <input name="title" placeholder="条目标题" />
            <input name="type" placeholder="类型，例如 private_chat_style / group_chat_rule / forum_board_rule" />
            <input name="targets" placeholder="目标，用逗号分隔：角色/NPC/群/App/tag" />
            <input name="priority" type="number" placeholder="优先级" />
            <textarea name="content" rows="4" placeholder="线上语气、社交习惯、表情包规则、主动消息规则等"></textarea>
            <button class="stp-pixel-button" type="submit">保存条目</button>
        `;
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const data = new FormData(form);
            const targets = String(data.get('targets') || '').split(',').map((item) => item.trim()).filter(Boolean);
            this.state.upsertPhoneEntry({
                title: String(data.get('title') || '').trim(),
                type: String(data.get('type') || 'custom').trim(),
                priority: Number(data.get('priority') || 0),
                linkedTargets: {
                    characters: targets,
                    npcs: targets,
                    groups: targets,
                    apps: targets,
                    forumBoards: targets,
                    relationshipStages: [],
                    tags: targets,
                },
                content: String(data.get('content') || '').trim(),
            });
            this.renderPhoneEntries();
        });
        const tools = createElement('div', 'stp-inline-actions');
        const importButton = createElement('button', 'stp-pixel-button ghost', '导入单条 JSON');
        const exportButton = createElement('button', 'stp-pixel-button ghost', '导出全部');
        importButton.type = 'button';
        exportButton.type = 'button';
        importButton.addEventListener('click', () => {
            const raw = prompt('粘贴 Phone Entry JSON');
            if (!raw) return;
            const entry = safeJsonParse(raw, null);
            if (!entry) return this.showNotice('JSON 格式无效');
            this.state.upsertPhoneEntry(entry);
            this.renderPhoneEntries();
        });
        exportButton.addEventListener('click', () => {
            console.info(`${EXTENSION_ID} phoneEntries`, cloneValue(this.state.value.phoneEntries));
            this.showNotice('Phone Entries 已输出到控制台');
        });
        tools.append(importButton, exportButton);
        const list = createElement('div', 'stp-card-list compact');
        asArray(this.state.value.phoneEntries).forEach((entry) => {
            const card = createElement('div', 'stp-list-card', '');
            card.innerHTML = `<b>${escapeHtml(entry.title)}</b><small>${escapeHtml(entry.type)} | priority ${entry.priority || 0} | ${entry.enabled === false ? 'disabled' : 'enabled'}</small><p>${escapeHtml(clampText(entry.content, 160))}</p>`;
            const toggle = createElement('button', 'stp-pixel-button ghost', entry.enabled === false ? '启用' : '禁用');
            const copy = createElement('button', 'stp-pixel-button ghost', '复制');
            const del = createElement('button', 'stp-pixel-button ghost', '删除');
            [toggle, copy, del].forEach((button) => { button.type = 'button'; });
            toggle.addEventListener('click', () => {
                this.state.upsertPhoneEntry({ ...entry, enabled: entry.enabled === false });
                this.renderPhoneEntries();
            });
            copy.addEventListener('click', () => {
                this.state.upsertPhoneEntry({ ...entry, id: '', title: `${entry.title} copy` });
                this.renderPhoneEntries();
            });
            del.addEventListener('click', () => {
                this.state.deletePhoneEntry(entry.id);
                this.renderPhoneEntries();
            });
            card.append(toggle, copy, del);
            list.append(card);
        });
        if (!list.children.length) list.append(createElement('p', 'stp-empty', '暂无 Phone Entry。'));
        wrap.append(form, tools, list);
        this.screen.append(wrap);
    }

    renderDebugPanel() {
        this.screen.innerHTML = '';
        const wrap = createElement('div', 'stp-app');
        wrap.append(this.nav('调试面板'));
        const auditor = new KnowledgeTimelineAuditor(this.state.value);
        const hostCharId = this.state.getHostCharId();
        const lastEvent = this.state.value.eventLog.at(-1) || null;
        const currentProfile = this.profileManager.getCurrentProfile?.() || null;
        const charContext = auditor.buildContextForSpeaker(hostCharId);
        const playerContext = auditor.buildContextForSpeaker('player');
        const entryMatch = new PhoneEntryManager(this.state).getRelevantPhoneEntries({ taskType: 'debug', speakerId: hostCharId, appType: 'debug' });
        const loreMatch = new MainLorebookLinker(this.state, this.collector).getRelevantMainLore({ taskType: 'debug', speakerId: hostCharId, matchedPhoneEntries: entryMatch.entries });
        const summary = createElement('pre', 'stp-debug-pre', JSON.stringify({
            boot: {
                ...bootSelfCheck(),
                runtimeVersion: STORYPHONE_VERSION,
                storedVersion: storyPhoneRuntimeDebug.storedVersion,
                lastBootStep: storyPhoneRuntimeDebug.lastBootStep,
            },
            identity: {
                hostCharId,
                currentSpeakerId: this.state.value.debug?.lastIdentityContext?.speakerId || '',
                actorId: this.state.value.debug?.lastIdentityContext?.actorId || '',
                targetId: this.state.value.debug?.lastIdentityContext?.targetId || '',
                groupId: this.state.value.debug?.lastIdentityContext?.groupId || '',
                channel: this.state.value.debug?.lastIdentityContext?.channel || '',
                lastCreatedEvent: this.state.value.debug?.lastCreatedEvent || lastEvent,
                resolveBasicKnownBy: lastEvent ? this.state.resolveBasicKnownBy(lastEvent) : [],
                speakerFallbackOccurred: Boolean(this.state.value.debug?.speakerFallbackOccurred),
                currentCharMisuseDetected: Boolean(this.state.value.debug?.currentCharMisuseDetected),
                identityWarnings: asArray(this.state.value.debug?.identityWarnings).slice(-5),
            },
            profileDebug: {
                currentProfileId: currentProfile?.profileId || null,
                profileName: currentProfile?.profileName || '',
                linkedCardIds: currentProfile?.linkedCardIds || [],
                hostCharId: currentProfile?.hostCharId || '',
                hostCharName: currentProfile?.hostCharName || '',
                npcCount: currentProfile?.identities?.npcs?.length || 0,
                contactCount: currentProfile?.contacts?.length || 0,
                groupCount: currentProfile?.groups?.length || 0,
                forumBoardCount: currentProfile?.forumBoards?.length || 0,
                currentEventActorIdentityFound: lastEvent ? Boolean(this.profileManager.findIdentityById(lastEvent.actorId)) : null,
                currentEventTargetIdentityFound: lastEvent ? Boolean(this.profileManager.findIdentityById(lastEvent.targetId)) : null,
                currentEventGroupFound: lastEvent?.groupId ? Boolean(this.profileManager.findGroupById(lastEvent.groupId)) : null,
                groupMembersResolved: lastEvent?.groupId ? this.profileManager.getGroupMembers(lastEvent.groupId) : [],
                momentsViewersResolved: this.profileManager.getMomentsViewers(currentProfile?.momentsConfig || {}),
                profileCardMismatchWarning: currentProfile?.hostCharId && currentProfile.hostCharId !== hostCharId,
                missingIdentityWarnings: asArray(this.state.value.debug?.identityWarnings).filter((warning) => String(warning.message).includes('not found')).slice(-5),
                contactDiagnostics: this.getProfileContactDiagnostics(),
                currentTestNpcId: this.getFirstEnabledNpcId(),
            },
            storyClock: this.state.value.storyClock,
            recentPhoneEvents: this.state.value.phoneEvents.slice(-5),
            recentMainEvents: this.state.value.mainEvents.slice(-5),
            charVisible: {
                visiblePhoneEvents: charContext.visiblePhoneEvents.slice(-5),
                forbiddenFacts: charContext.forbiddenFacts.slice(-5),
            },
            playerVisibleOnly: playerContext.visiblePhoneEvents.slice(-5),
            matchedPhoneEntries: entryMatch.entries.map((entry) => entry.title),
            matchedLoreEntries: loreMatch.relevantLoreEntries.map((entry) => entry.title),
            pendingEvents: this.state.value.pendingEvents.slice(-10),
            backend: this.state.value.settings.apiEndpoint ? 'custom_api' : 'sillytavern_or_mock',
            injectIntoMainContext: this.state.value.settings.injectIntoMainContext,
        }, null, 2));
        const tests = createElement('div', 'stp-card-list compact');
        [
            ['私聊 A，B 是否知道', () => this.runVisibilityTestPrivateNpc()],
            ['给 char 发消息', () => this.runVisibilityTestChar()],
            ['点赞朋友圈', () => this.runVisibilityTestMomentLike()],
            ['只查看论坛', () => this.runVisibilityTestForumView()],
            ['群聊成员可见', () => this.runVisibilityTestGroup()],
            ['player_visible 不转 user_visible', () => this.runVisibilityTestPlayerVisible()],
            ['Identity: user -> NPC private', () => this.runIdentityTestPrivateNpc()],
            ['Identity: user -> host private', () => this.runIdentityTestPrivateHost()],
            ['Identity: NPC -> user reply', () => this.runIdentityTestNpcReply()],
            ['Profile: group no host', () => this.runProfileGroupTest(false)],
            ['Profile: group with host', () => this.runProfileGroupTest(true)],
            ['Profile: selected moments', () => this.runProfileMomentSelectedTest()],
            ['Profile: contact self-check', () => this.getProfileContactDiagnostics()],
        ].forEach(([label, fn]) => {
            const button = createElement('button', 'stp-pixel-button ghost', label);
            button.type = 'button';
            button.addEventListener('click', () => {
                console.info(`${EXTENSION_ID} debug test`, label, fn());
                this.showNotice('测试结果已输出到控制台');
            });
            tests.append(button);
        });
        wrap.append(summary, tests);
        this.screen.append(wrap);
    }

    runVisibilityTestPrivateNpc() {
        const event = this.state.addPhoneEvent({ source: EVENT_SOURCES.PRIVATE_CHAT, type: 'debug_private_a', actor: 'user', target: 'debug_a', content: 'debug secret to A', visibility: normalizeVisibility('visible_to_npc', { actorId: 'user', targetId: 'debug_a' }) });
        const auditor = new KnowledgeTimelineAuditor(this.state.value);
        return { event, a: auditor.canSee(event, 'debug_a'), char: auditor.canSee(event, 'char') };
    }

    runVisibilityTestChar() {
        const event = this.state.addPhoneEvent({ source: EVENT_SOURCES.PRIVATE_CHAT, type: 'debug_private_char', actor: 'user', target: 'char', content: 'debug secret to char', visibility: 'visible_to_char' });
        const auditor = new KnowledgeTimelineAuditor(this.state.value);
        return { event, char: auditor.canSee(event, 'char'), npc: auditor.canSee(event, 'debug_a') };
    }

    runVisibilityTestMomentLike() {
        const event = this.state.addPhoneEvent({ source: EVENT_SOURCES.MOMENTS, type: 'debug_moment_like', actor: 'user', target: 'debug_author', content: 'debug liked a moment', visibility: 'public' });
        return { event, charVisible: new KnowledgeTimelineAuditor(this.state.value).canSee(event, 'char') };
    }

    runVisibilityTestForumView() {
        const event = this.state.addPhoneEvent({ source: EVENT_SOURCES.FORUM, type: 'debug_forum_view', actor: 'user', target: 'debug_post', content: 'debug viewed forum only', visibility: 'user_only' });
        const auditor = new KnowledgeTimelineAuditor(this.state.value);
        return { event, user: auditor.canSee(event, 'user'), author: auditor.canSee(event, 'debug_author') };
    }

    runVisibilityTestGroup() {
        const group = { id: 'debug_group', name: 'debug group', members: ['user', 'debug_a'] };
        this.state.value.profile.groups = [...asArray(this.state.value.profile.groups).filter((item) => item.id !== group.id), group];
        this.state.addGroupMessage(group, { actorId: 'debug_a', content: 'debug group message', at: nowIso() });
        const event = this.state.value.eventLog.at(-1);
        const auditor = new KnowledgeTimelineAuditor(this.state.value);
        return { event, member: auditor.canSee(event, 'debug_a'), nonMember: auditor.canSee(event, 'char') };
    }

    runVisibilityTestPlayerVisible() {
        const event = this.state.addPhoneEvent({ source: EVENT_SOURCES.CHARACTER_SIDE_SCREEN, type: 'debug_player_visible', actor: 'char', content: 'debug player only draft', visibility: 'player_visible', injectToMain: false });
        const auditor = new KnowledgeTimelineAuditor(this.state.value);
        return { event, player: auditor.canSee(event, 'player'), user: auditor.canSee(event, 'user') };
    }

    getFirstEnabledNpcId() {
        const npc = asArray(this.profileManager.getCurrentProfile?.()?.identities?.npcs).find((identity) => identity.enabled !== false);
        if (npc?.id) return npc.id;
        this.state.noteIdentityWarning('未找到 NPC，使用 fallback test_npc。', { source: 'debug_test' });
        return 'test_npc';
    }

    runIdentityTestPrivateNpc() {
        const hostCharId = this.state.getHostCharId();
        const npcId = this.getFirstEnabledNpcId();
        const event = this.state.addPhoneEvent({
            source: EVENT_SOURCES.WECHAT,
            channel: 'wechat_private',
            type: 'identity_test_private_npc',
            speakerId: 'user',
            actorId: 'user',
            targetId: npcId,
            actor: 'user',
            target: npcId,
            content: 'identity test: user to npc',
            visibility: normalizeVisibility('visible_to_npc', { actorId: 'user', targetId: npcId }),
        });
        return { hostCharId, npcId, event, knownBy: event.knownBy, hostIncluded: event.knownBy.includes(hostCharId) };
    }

    runIdentityTestPrivateHost() {
        const hostCharId = this.state.getHostCharId();
        const event = this.state.addPhoneEvent({
            source: EVENT_SOURCES.WECHAT,
            channel: 'wechat_private',
            type: 'identity_test_private_host',
            speakerId: 'user',
            actorId: 'user',
            targetId: hostCharId,
            actor: 'user',
            target: hostCharId,
            content: 'identity test: user to host',
            visibility: normalizeVisibility('visible_to_char', { actorId: 'user', targetId: hostCharId, isChar: true }),
        });
        return { hostCharId, event, knownBy: event.knownBy, hostIncluded: event.knownBy.includes(hostCharId) };
    }

    runIdentityTestNpcReply() {
        const hostCharId = this.state.getHostCharId();
        const npcId = this.getFirstEnabledNpcId();
        const event = this.state.addPhoneEvent({
            source: EVENT_SOURCES.WECHAT,
            channel: 'wechat_private',
            type: 'identity_test_npc_reply',
            speakerId: npcId,
            actorId: npcId,
            targetId: 'user',
            actor: npcId,
            target: 'user',
            content: 'identity test: npc reply',
            visibility: normalizeVisibility('visible_to_npc', { actorId: npcId, targetId: 'user' }),
        });
        return { hostCharId, npcId, event, speakerId: event.speakerId, actorId: event.actorId, hostUsedAsSpeaker: event.speakerId === hostCharId };
    }

    ensureTestNpcContact() {
        const current = this.profileManager.getCurrentProfile() || this.profileManager.ensureProfileForCurrentCard(this.collector.collect());
        if (!asArray(current.identities.npcs).some((npc) => npc.id === 'test_npc')) {
            this.profileManager.updateProfile(current.profileId, {
                ...current,
                identities: { ...current.identities, npcs: [...asArray(current.identities.npcs), this.profileManager.makeIdentity({ id: 'test_npc', type: 'npc', displayName: 'test_npc', phoneName: 'test_npc' })] },
                contacts: [...asArray(current.contacts), this.profileManager.makeContact({ identityId: 'test_npc', displayName: 'test_npc', alias: 'test_npc' })],
            });
        }
    }

    runProfileGroupTest(includeHost) {
        this.ensureTestNpcContact();
        const hostCharId = this.state.getHostCharId();
        const current = this.profileManager.getCurrentProfile();
        const members = includeHost ? ['user', 'test_npc', hostCharId] : ['user', 'test_npc'];
        this.profileManager.updateProfile(current.profileId, {
            ...current,
            groups: [...asArray(current.groups).filter((group) => group.groupId !== 'group_a'), { groupId: 'group_a', groupName: 'group_a', appType: 'wechat_group', memberIds: members, ownerId: 'user', adminIds: [], avatarId: '', muted: false, tags: [], notes: '', createdAt: nowIso(), updatedAt: nowIso() }],
        });
        const event = this.state.addPhoneEvent({ source: EVENT_SOURCES.WECHAT, channel: 'wechat_group', type: 'profile_group_test', speakerId: 'test_npc', actorId: 'test_npc', targetId: 'group_a', groupId: 'group_a', content: 'profile group test', visibility: 'visible_to_group' });
        return { includeHost, hostCharId, knownBy: event.knownBy, hostIncluded: event.knownBy.includes(hostCharId), event };
    }

    runProfileMomentSelectedTest() {
        this.ensureTestNpcContact();
        const hostCharId = this.state.getHostCharId();
        const event = this.state.addPhoneEvent({ source: EVENT_SOURCES.MOMENTS, channel: 'moments', type: 'profile_moment_selected_test', speakerId: 'user', actorId: 'user', content: 'profile selected moment test', selectedViewers: ['test_npc'], visibilityMode: 'selected', visibility: 'user_only' });
        return { hostCharId, knownBy: event.knownBy, hostIncluded: event.knownBy.includes(hostCharId), event };
    }

    handleProfileAction(action) {
        try {
            const current = this.profileManager.getCurrentProfile();
            if (action === 'create') this.profileManager.createProfileForCurrentCard(this.collector.collect());
            if (action === 'rebuild') {
                if (current) this.profileManager.deleteProfile(current.profileId);
                this.profileManager.createProfileForCurrentCard(this.collector.collect());
            }
            if (action === 'switch') {
                const id = prompt(`Profile ID:\n${this.profileManager.listProfiles().map((profile) => `${profile.profileId} - ${profile.profileName}`).join('\n')}`);
                if (id) this.profileManager.switchProfile(id.trim());
            }
            if (action === 'export') {
                console.info(`${EXTENSION_ID} phone profile`, this.profileManager.exportProfile());
                this.showNotice('Profile 已输出到控制台');
                return;
            }
            if (action === 'import') {
                const raw = prompt('粘贴 Phone Profile JSON');
                if (raw) this.profileManager.importProfile(raw);
            }
            if (action === 'add-npc') this.profileAddNpc();
            if (action === 'edit-npc') this.profileEditNpc();
            if (action === 'delete-npc') this.profileDeleteNpc();
            if (action === 'edit-contact') this.profileEditContact();
            if (action === 'add-group') this.profileAddGroup();
            if (action === 'edit-group') this.profileEditGroup();
            if (action === 'add-board') this.profileAddBoard();
            if (action === 'moments') this.profileEditMoments();
            this.renderSettings();
        } catch (error) {
            this.showNotice(error.message);
        }
    }

    updateCurrentProfile(mutator) {
        const profile = cloneValue(this.profileManager.getCurrentProfile());
        if (!profile) throw new Error('No current Phone Profile');
        mutator(profile);
        return this.profileManager.updateProfile(profile.profileId, profile);
    }

    profileAddNpc() {
        const id = prompt('NPC id');
        if (!id) return;
        const displayName = prompt('displayName', id) || id;
        const phoneName = prompt('phoneName', displayName) || displayName;
        const createContact = confirm('同时创建联系人？');
        this.updateCurrentProfile((profile) => {
            profile.identities.npcs = asArray(profile.identities.npcs).filter((item) => item.id !== id);
            profile.identities.npcs.push(this.profileManager.makeIdentity({ id, type: 'npc', displayName, phoneName, relationshipStage: 'stranger' }));
            if (createContact && !asArray(profile.contacts).some((contact) => contact.identityId === id)) {
                profile.contacts.push(this.profileManager.makeContact({ identityId: id, displayName, alias: phoneName }));
            }
        });
        this.selectedNpc = id;
    }

    profileEditNpc() {
        const id = prompt('NPC id to edit');
        if (!id) return;
        this.updateCurrentProfile((profile) => {
            const npc = asArray(profile.identities.npcs).find((item) => item.id === id);
            if (!npc) throw new Error('NPC not found');
            npc.displayName = prompt('displayName', npc.displayName) || npc.displayName;
            npc.phoneName = prompt('phoneName', npc.phoneName) || npc.phoneName;
            npc.relationshipStage = prompt('relationshipStage', npc.relationshipStage) || npc.relationshipStage;
            npc.notes = prompt('notes', npc.notes) || npc.notes;
            npc.enabled = confirm('启用该 NPC？');
            npc.updatedAt = nowIso();
        });
    }

    profileDeleteNpc() {
        const id = prompt('NPC id to delete');
        if (!id) return;
        this.updateCurrentProfile((profile) => {
            profile.identities.npcs = asArray(profile.identities.npcs).filter((item) => item.id !== id);
        });
    }

    profileEditContact() {
        const id = prompt('identityId');
        if (!id) return;
        this.updateCurrentProfile((profile) => {
            let contact = asArray(profile.contacts).find((item) => item.identityId === id);
            if (!contact) {
                contact = this.profileManager.makeContact({ identityId: id, displayName: id, alias: id });
                profile.contacts.push(contact);
            }
            contact.alias = prompt('alias', contact.alias) || contact.alias;
            contact.pinned = confirm('pinned?');
            contact.muted = confirm('muted?');
            contact.blocked = confirm('blocked?');
            contact.updatedAt = nowIso();
        });
    }

    profileAddGroup() {
        const groupId = prompt('groupId');
        if (!groupId) return;
        const groupName = prompt('groupName', groupId) || groupId;
        const memberIds = String(prompt('memberIds comma separated', 'user') || 'user').split(',').map((item) => item.trim()).filter(Boolean);
        this.updateCurrentProfile((profile) => {
            profile.groups = asArray(profile.groups).filter((group) => group.groupId !== groupId);
            profile.groups.push({ groupId, groupName, appType: 'wechat_group', memberIds, ownerId: 'user', adminIds: [], avatarId: '', muted: false, tags: [], notes: '', createdAt: nowIso(), updatedAt: nowIso() });
        });
    }

    profileEditGroup() {
        const groupId = prompt('groupId to edit');
        if (!groupId) return;
        this.updateCurrentProfile((profile) => {
            const group = asArray(profile.groups).find((item) => item.groupId === groupId);
            if (!group) throw new Error('Group not found');
            group.groupName = prompt('groupName', group.groupName) || group.groupName;
            group.memberIds = String(prompt('memberIds comma separated', asArray(group.memberIds).join(',')) || '').split(',').map((item) => item.trim()).filter(Boolean);
            group.muted = confirm('muted?');
            group.updatedAt = nowIso();
        });
    }

    profileAddBoard() {
        const boardId = prompt('boardId');
        if (!boardId) return;
        this.updateCurrentProfile((profile) => {
            profile.forumBoards = asArray(profile.forumBoards).filter((board) => board.boardId !== boardId);
            profile.forumBoards.push({ boardId, boardName: prompt('boardName', boardId) || boardId, visibility: prompt('visibility public/members_only/selected/private', 'public') || 'public', memberIds: String(prompt('memberIds comma separated', '') || '').split(',').map((item) => item.trim()).filter(Boolean), anonymousAllowed: confirm('anonymousAllowed?'), anonymousMap: {}, tags: [], notes: '', createdAt: nowIso(), updatedAt: nowIso() });
        });
    }

    profileEditMoments() {
        this.updateCurrentProfile((profile) => {
            profile.momentsConfig = profile.momentsConfig || {};
            profile.momentsConfig.defaultVisibility = prompt('defaultVisibility friends/selected/public/private', profile.momentsConfig.defaultVisibility || 'friends') || 'friends';
            profile.momentsConfig.friendIds = String(prompt('friendIds comma separated', asArray(profile.momentsConfig.friendIds).join(',')) || '').split(',').map((item) => item.trim()).filter(Boolean);
            profile.momentsConfig.blockedViewerIds = String(prompt('blockedViewerIds comma separated', asArray(profile.momentsConfig.blockedViewerIds).join(',')) || '').split(',').map((item) => item.trim()).filter(Boolean);
        });
    }

    renderSettings() {
        this.screen.innerHTML = '';
        const wrap = createElement('div', 'stp-app');
        wrap.append(this.nav('设置'));
        const settings = this.state.value.settings;
        const currentProfile = this.profileManager.getCurrentProfile?.() || null;
        const panel = createElement('div', 'stp-settings');
        panel.innerHTML = `
            <div class="stp-note"><b>Phone Profile</b><pre>${escapeHtml(JSON.stringify({
                profileId: currentProfile?.profileId,
                profileName: currentProfile?.profileName,
                linkedCardIds: currentProfile?.linkedCardIds,
                hostCharId: currentProfile?.hostCharId,
                hostCharName: currentProfile?.hostCharName,
                enabled: currentProfile?.enabled,
                updatedAt: currentProfile?.updatedAt,
                npcCount: currentProfile?.identities?.npcs?.length || 0,
                contactCount: currentProfile?.contacts?.length || 0,
                groupCount: currentProfile?.groups?.length || 0,
                forumBoardCount: currentProfile?.forumBoards?.length || 0,
            }, null, 2))}</pre></div>
            <div class="stp-inline-actions">
                <button class="stp-pixel-button ghost" type="button" data-profile-action="create">创建当前卡 Profile</button>
                <button class="stp-pixel-button ghost" type="button" data-profile-action="switch">切换 Profile</button>
                <button class="stp-pixel-button ghost" type="button" data-profile-action="export">导出 Profile</button>
                <button class="stp-pixel-button ghost" type="button" data-profile-action="import">导入 Profile</button>
                <button class="stp-pixel-button ghost" type="button" data-profile-action="add-npc">新增 NPC</button>
                <button class="stp-pixel-button ghost" type="button" data-profile-action="edit-npc">编辑 NPC</button>
                <button class="stp-pixel-button ghost" type="button" data-profile-action="delete-npc">删除 NPC</button>
                <button class="stp-pixel-button ghost" type="button" data-profile-action="edit-contact">编辑联系人</button>
                <button class="stp-pixel-button ghost" type="button" data-profile-action="add-group">新增群</button>
                <button class="stp-pixel-button ghost" type="button" data-profile-action="edit-group">编辑群</button>
                <button class="stp-pixel-button ghost" type="button" data-profile-action="add-board">新增论坛板块</button>
                <button class="stp-pixel-button ghost" type="button" data-profile-action="moments">朋友圈设置</button>
                <button class="stp-pixel-button ghost" type="button" data-profile-action="rebuild">重建当前卡 Profile</button>
                <button class="stp-pixel-button ghost" type="button" data-force-ui-reset>强制重置 StoryPhone UI 状态</button>
            </div>
            <label><input type="checkbox" data-setting="injectIntoMainContext" ${settings.injectIntoMainContext ? 'checked' : ''}> 手机事件隐藏摘要同步到主对话</label>
            <label><input type="checkbox" data-setting="fallbackEnabled" ${settings.fallbackEnabled ? 'checked' : ''}> 开启本地 fallback（默认关闭）</label>
            <label>API URL<input data-api="endpoint" autocomplete="off" value="${settings.apiEndpoint || ''}" placeholder="http://127.0.0.1:5100/v1 或 /chat/completions"></label>
            <label>API Key<input data-api="key" type="password" autocomplete="off" value="${settings.apiKey || ''}" placeholder="可选，只保存在本地"></label>
            <label>模型名<input data-api="model" autocomplete="off" value="${settings.apiModel || ''}" placeholder="OpenAI 兼容接口需要"></label>
            <button class="stp-pixel-button" type="button" data-save-api>保存 API</button>
            <button class="stp-pixel-button ghost" type="button" data-test-api>测试连接</button>
            <p class="stp-empty" data-api-status>默认不外发；填写 URL 后才会发送可见上下文到该接口。</p>
            <textarea rows="7" placeholder="粘贴角色 phone profile JSON"></textarea>
            <button class="stp-pixel-button" type="button" data-import>导入 Profile</button>
            <button class="stp-pixel-button ghost" type="button" data-export>导出当前状态到控制台</button>
        `;
        panel.querySelectorAll('[data-profile-action]').forEach((button) => {
            button.addEventListener('click', () => this.handleProfileAction(button.dataset.profileAction));
        });
        panel.querySelector('[data-force-ui-reset]')?.addEventListener('click', () => {
            forceResetStoryPhoneUiState();
        });
        panel.querySelectorAll('[data-setting]').forEach((input) => {
            input.addEventListener('change', () => {
                this.state.value.settings[input.dataset.setting] = input.checked;
                this.state.save();
            });
        });
        panel.querySelector('[data-save-api]').addEventListener('click', () => {
            settings.apiEndpoint = panel.querySelector('[data-api="endpoint"]').value.trim();
            settings.apiKey = panel.querySelector('[data-api="key"]').value.trim();
            settings.apiModel = panel.querySelector('[data-api="model"]').value.trim();
            safeStorageSet('st_story_phone_api_endpoint', settings.apiEndpoint);
            safeStorageSet('st_story_phone_api_model', settings.apiModel);
            this.state.save();
            this.showNotice(settings.apiEndpoint ? 'API 设置已保存' : 'API 已关闭');
        });
        panel.querySelector('[data-test-api]').addEventListener('click', async () => {
            panel.querySelector('[data-save-api]').click();
            const status = panel.querySelector('[data-api-status]');
            status.textContent = '正在测试 API...';
            const result = await this.generator.testApiConnection();
            status.textContent = result.message;
            this.showNotice(result.message);
        });
        panel.querySelector('[data-import]').addEventListener('click', () => {
            try {
                this.profileManager.importJson(panel.querySelector('textarea').value);
                this.showNotice('Profile 已导入');
            } catch (error) {
                this.showNotice(error.message);
            }
        });
        panel.querySelector('[data-export]').addEventListener('click', () => {
            console.info(`${EXTENSION_ID} state`, cloneValue(this.state.value));
            this.showNotice('当前状态已输出到浏览器控制台');
        });
        wrap.append(panel);
        this.screen.append(wrap);
    }

    setLoading(text) {
        this.screen.innerHTML = '';
        const loading = createElement('div', 'stp-loading', text);
        this.screen.append(loading);
    }

    showNotice(text) {
        const notice = createElement('div', 'stp-toast', text);
        this.root.append(notice);
        setTimeout(() => notice.remove(), 2400);
        this.render();
    }
}

class MainChatObserver {
    constructor(state, collector) {
        this.state = state;
        this.collector = collector;
        this.seen = new Set(asArray(state.value.eventLog).map((event) => event.meta?.chatMessageKey).filter(Boolean));
    }

    attach() {
        const context = getContext();
        const events = context.eventSource;
        const types = context.event_types || {};
        if (!events?.on) return;
        if (types.MESSAGE_SENT) events.on(types.MESSAGE_SENT, (data) => this.recordMainMessage(data, 'user'));
        if (types.MESSAGE_RECEIVED) events.on(types.MESSAGE_RECEIVED, (data) => this.recordMainMessage(data, 'char'));
    }

    recordMainMessage(data, speaker) {
        const context = getContext();
        const chat = asArray(context.chat);
        const message = typeof data === 'number' ? chat[data] : data?.message || data || chat[chat.length - 1];
        const text = message?.mes || message?.text || message?.content || '';
        if (!text) return;

        const key = [
            speaker,
            message?.send_date || message?.swipe_id || chat.length,
            clampText(text, 80),
        ].join('::');
        if (this.seen.has(key)) return;
        this.seen.add(key);

        const collected = this.collector.collect();
        const actor = speaker === 'user' ? 'user' : this.state.getHostCharId();
        const targetId = actor === 'user' ? this.state.getHostCharId() : 'user';
        this.state.addEvent({
            source: EVENT_SOURCES.MAIN_CHAT,
            channel: 'main_chat',
            type: speaker === 'user' ? 'main_user_message' : 'main_char_message',
            speakerId: actor,
            actorId: actor,
            targetId,
            actor,
            target: targetId,
            content: text,
            visibility: {
                system: true,
                user: true,
                char: true,
                npcs: [],
                public: false,
            },
            consequences: [],
            status: 'active',
            meta: {
                chatMessageKey: key,
                characterName: collected.characterSummary?.name,
            },
        });
        this.state.resolvePendingEvents(text);
    }
}

class StoryPhoneApp {
    constructor() {
        this.storage = new StorageManager();
        this.collector = new ContextCollector();
        const collected = this.collector.collect();
        this.state = new SharedStoryState(this.storage, collected.chatId);
        this.profileManager = new PhoneProfileManager(this.state);
        this.generator = new BackgroundGenerator(this.state, this.collector);
        this.injector = new ContextInjector(this.state);
        this.scheduler = new ProactivePhoneEventScheduler(this.state);
        this.mainChatObserver = new MainChatObserver(this.state, this.collector);
        this.ui = new PhoneUI(this.state, this.collector, this.profileManager, this.generator);
    }

    start() {
        storyPhoneRuntimeDebug.lastBootStep = 'profile';
        this.profileManager.resolve(this.collector.collect());
        storyPhoneRuntimeDebug.profileLoaded = Boolean(this.profileManager.getCurrentProfile?.());
        storyPhoneRuntimeDebug.lastBootStep = 'injector';
        this.injector.attach();
        storyPhoneRuntimeDebug.lastBootStep = 'observer';
        this.mainChatObserver.attach();
        storyPhoneRuntimeDebug.lastBootStep = 'ui_mount';
        this.ui.mount();
        storyPhoneRuntimeDebug.lastBootStep = 'debug_api';
        globalThis.STStoryPhoneKnowledge = {
            buildContextForSpeaker: (speakerId) => new KnowledgeTimelineAuditor(this.state.value).buildContextForSpeaker(speakerId),
            buildBasicContextForSpeaker: (speakerId, options) => this.state.buildContextForSpeaker(speakerId, options),
            buildMainChatHiddenContext: (hostCharId) => this.state.buildMainChatHiddenContext(hostCharId),
            getHostCharId: () => this.state.getHostCharId(),
            normalizeSpeakerId: (input, options) => this.state.normalizeSpeakerId(input, options),
            createPhoneEvent: (event) => this.state.createPhoneEvent(event),
            resolveBasicKnownBy: (event) => this.state.resolveBasicKnownBy(event),
            classifyEvent: (event) => this.state.classifyEvent(event),
            getCurrentProfile: () => this.profileManager.getCurrentProfile(),
            createProfileForCurrentCard: () => this.profileManager.createProfileForCurrentCard(this.collector.collect()),
            switchProfile: (profileId) => this.profileManager.switchProfile(profileId),
            listProfiles: () => this.profileManager.listProfiles(),
            updateProfile: (profileId, patch) => this.profileManager.updateProfile(profileId, patch),
            deleteProfile: (profileId) => this.profileManager.deleteProfile(profileId),
            exportProfile: (profileId) => this.profileManager.exportProfile(profileId),
            importProfile: (data) => this.profileManager.importProfile(data),
            ensureProfileForCurrentCard: () => this.profileManager.ensureProfileForCurrentCard(this.collector.collect()),
            findIdentityById: (identityId) => this.profileManager.findIdentityById(identityId),
            findContactByIdentityId: (identityId) => this.profileManager.findContactByIdentityId(identityId),
            findGroupById: (groupId) => this.profileManager.findGroupById(groupId),
            getGroupMembers: (groupId) => this.profileManager.getGroupMembers(groupId),
            getForumBoard: (boardId) => this.profileManager.getForumBoard(boardId),
            getMomentsViewers: (config) => this.profileManager.getMomentsViewers(config),
            auditKnowledgeConsistency: (generatedContent, speakerId, context) => new KnowledgeTimelineAuditor(this.state.value).auditKnowledgeConsistency(generatedContent, speakerId, context),
            resolveVisibleContext: (speakerId) => new KnowledgeTimelineAuditor(this.state.value).resolveVisibleContext(speakerId),
            buildPromptWithVisibilityBoundary: (speakerId, taskType, payload) => new KnowledgeTimelineAuditor(this.state.value).buildPromptWithVisibilityBoundary(speakerId, taskType, payload),
            getRelevantPhoneEntries: (context) => new PhoneEntryManager(this.state).getRelevantPhoneEntries(context),
            getRelevantMainLore: (context) => new MainLorebookLinker(this.state, this.collector).getRelevantMainLore(context),
            mockAddEvent: (event) => this.state.addEvent(event),
            mockAddPendingEvent: (event, trigger) => this.state.addPendingEvent(event, trigger),
            schedulerTick: (reason) => this.scheduler.tick(reason),
            schedulerEnqueue: (event, trigger) => this.scheduler.enqueue(event, trigger),
            mockAnalyzeImage: (imageFile, context) => new MediaSystem().analyzeImage(imageFile, context),
            mockGenerateImage: (prompt, context) => new MediaSystem().generateImage(prompt, context),
        };
    }
}

function bootSelfCheck() {
    const appUi = globalThis.__STStoryPhoneApp?.ui;
    const launcherDebug = globalThis.STStoryPhoneLauncherDebug || {};
    const storyPhoneStyleNodeCount = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).filter((node) => {
        const marker = [
            node.id || '',
            node.getAttribute('data-storyphone') || '',
            node.getAttribute('href') || '',
        ].join(' ').toLowerCase();
        return marker.includes('story') || marker.includes('stp') || marker.includes('style.css');
    }).length;
    if (storyPhoneStyleNodeCount > 1) {
        const warning = `Multiple StoryPhone style nodes detected: ${storyPhoneStyleNodeCount}`;
        if (!storyPhoneRuntimeDebug.bootWarnings.includes(warning)) storyPhoneRuntimeDebug.bootWarnings.push(warning);
    }
    const modal = document.querySelector('#st-story-phone .st-storyphone-modal, #st-story-phone .stp-phone');
    const phone = document.querySelector('#st-story-phone .stp-phone');
    const root = document.getElementById('st-story-phone');
    const launcher = document.querySelector('#st-story-phone .stp-bubble, #st-story-phone-boot-bubble');
    const modalStyles = modal ? window.getComputedStyle(modal) : null;
    const phoneStyles = phone ? window.getComputedStyle(phone) : null;
    const rootStyles = root ? window.getComputedStyle(root) : null;
    const modalRect = modal?.getBoundingClientRect?.();
    const phoneRect = phone?.getBoundingClientRect?.();
    const rootRect = root?.getBoundingClientRect?.();
    let modalVisibleOnBoot = Boolean(modal && modalStyles?.display !== 'none' && modalStyles?.visibility !== 'hidden' && modalRect?.width && modalRect?.height);
    if (modalVisibleOnBoot && appUi && !appUi.hasUserOpenedPhone) {
        appUi.closePhone();
        const warning = 'StoryPhone modal was visible on boot and has been force-closed.';
        storyPhoneRuntimeDebug.bootWarnings.push(warning);
        console.warn(warning);
        const closedStyles = window.getComputedStyle(modal);
        const closedRect = modal.getBoundingClientRect();
        modalVisibleOnBoot = Boolean(closedStyles.display !== 'none' && closedStyles.visibility !== 'hidden' && closedRect.width && closedRect.height);
    }
    const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
        visualWidth: window.visualViewport?.width || null,
        visualHeight: window.visualViewport?.height || null,
    };
    const phoneDragPosition = readPhoneWindowPosition();
    const launcherDragPosition = readLauncherPosition();
    const isMobileViewport = window.innerWidth <= 768 || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    const rectToPlain = (rect) => (rect ? ({
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
    }) : null);
    const modalFitsViewport = Boolean(
        !modalRect
        || (
            modalRect.left >= 0
            && modalRect.top >= 0
            && modalRect.right <= window.innerWidth
            && modalRect.bottom <= window.innerHeight
        )
    );
    return {
        runtimeVersion: STORYPHONE_VERSION,
        storedVersion: storyPhoneRuntimeDebug.storedVersion,
        migrationRan: storyPhoneRuntimeDebug.migrationRan,
        cleanedKeys: storyPhoneRuntimeDebug.cleanedKeys,
        cleanedOpenStateKeys: storyPhoneRuntimeDebug.cleanedOpenStateKeys,
        openStateCleared: storyPhoneRuntimeDebug.openStateCleared,
        storageReadable: storyPhoneRuntimeDebug.storageReadable,
        profileLoaded: storyPhoneRuntimeDebug.profileLoaded,
        activeUiVersion: launcherDebug.activeUiVersion || storyPhoneRuntimeDebug.activeUiVersion || (appUi ? 'new' : 'boot_error'),
        activeRenderFunction: launcherDebug.activeRenderFunction || storyPhoneRuntimeDebug.activeRenderFunction,
        activeLauncherFunction: launcherDebug.activeLauncherFunction || storyPhoneRuntimeDebug.activeLauncherFunction,
        legacyNodesRemoved: launcherDebug.legacyNodesRemoved || 0,
        storyPhoneStyleNodeCount,
        lastUiBootError: launcherDebug.lastUiBootError || storyPhoneRuntimeDebug.lastUiBootError,
        isPhoneOpenOnBoot: Boolean(appUi?.isPhoneOpen),
        modalVisibleOnBoot,
        modalDisplay: modal ? window.getComputedStyle(modal).display : null,
        modalClassName: modal?.className || null,
        launcherMounted: Boolean(launcher),
        rootMounted: Boolean(root),
        modalMounted: Boolean(modal),
        activeView: appUi?.activeApp || null,
        duplicateNodesRemoved: storyPhoneRuntimeDebug.duplicateNodesRemoved + (launcherDebug.duplicateNodesRemoved || 0),
        openSource: launcherDebug.openSource || null,
        openAttemptCount: launcherDebug.openAttemptCount || 0,
        lastOpenPath: launcherDebug.lastOpenPath || null,
        calledLoadFullApp: Boolean(launcherDebug.calledLoadFullApp),
        fullAppLoaded: Boolean(launcherDebug.fullAppLoaded),
        newUiMounted: Boolean(launcherDebug.newUiMounted || appUi?.root),
        calledNewOpenPhone: Boolean(launcherDebug.calledNewOpenPhone),
        calledLegacyFallback: Boolean(launcherDebug.calledLegacyFallback),
        legacyFallbackReason: launcherDebug.legacyFallbackReason || null,
        legacyFallbackVisible: Boolean(launcherDebug.legacyFallbackVisible),
        newLauncherVisible: Boolean(launcherDebug.newLauncherVisible),
        duplicateNodes: Array.isArray(launcherDebug.duplicateNodes) ? launcherDebug.duplicateNodes : [],
        lastPointerTarget: launcherDebug.lastPointerTarget || null,
        lastPointerTargetId: launcherDebug.lastPointerTargetId || null,
        lastPointerTargetClass: launcherDebug.lastPointerTargetClass || null,
        isMobileViewport,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        phoneRect: rectToPlain(phoneRect),
        modalRect: rectToPlain(modalRect),
        rootRect: rectToPlain(rootRect),
        computedPhoneWidth: phoneStyles?.width || null,
        computedPhoneHeight: phoneStyles?.height || null,
        phoneDragEnabled: Boolean(appUi?.isPhoneOpen) && !isMobileViewport,
        phoneDragPosition,
        launcherDragPosition,
        modalFitsViewport,
        rootPointerEvents: rootStyles?.pointerEvents || null,
        viewport,
        bootWarnings: storyPhoneRuntimeDebug.bootWarnings,
        lastBootError: storyPhoneRuntimeDebug.lastBootError,
    };
}

function forceResetStoryPhoneUiState() {
    globalThis.__STStoryPhoneApp?.ui?.closePhone?.();
    cleanStoryPhoneUiState('force reset');
    removeStoryPhoneDomDuplicates();
    document.getElementById('st-storyphone-modal')?.remove();
    document.getElementById('st-story-phone')?.remove();
    document.getElementById('st-story-phone-boot-error')?.remove();
    clearLauncherPosition();
    clearPhoneWindowPosition();
    globalThis.__STStoryPhoneApp = null;
    mountBootBubble();
    bootStoryPhone();
    const app = globalThis.__STStoryPhoneApp;
    app?.ui?.showNotice?.('已重置 UI 状态，业务数据已保留。');
    return bootSelfCheck();
}

function showStoryPhoneBootErrorPanel(error) {
    document.getElementById('st-story-phone-boot-error')?.remove();
    const currentProfileId = globalThis.__STStoryPhoneApp?.state?.value?.currentProfileId || null;
    const diagnostics = {
        ...bootSelfCheck(),
        STORYPHONE_VERSION,
        currentProfileId,
        lastBootStep: storyPhoneRuntimeDebug.lastBootStep,
        userAgent: navigator.userAgent,
        errorMessage: error?.message || '',
        errorStack: error?.stack || '',
    };
    const panel = createElement('section', 'stp-boot-error', '');
    panel.id = 'st-story-phone-boot-error';
    panel.innerHTML = `
        <h2>ST-StoryPhone boot failed</h2>
        <pre>${escapeHtml(JSON.stringify(diagnostics, null, 2))}</pre>
        <div class="stp-inline-actions">
            <button type="button" data-copy>复制诊断信息</button>
            <button type="button" data-reset>强制重置 UI 状态</button>
        </div>
    `;
    panel.querySelector('[data-copy]').addEventListener('click', async () => {
        try {
            await navigator.clipboard?.writeText(JSON.stringify(diagnostics, null, 2));
        } catch {
            console.info(`${EXTENSION_ID} diagnostics`, diagnostics);
        }
    });
    panel.querySelector('[data-reset]').addEventListener('click', () => forceResetStoryPhoneUiState());
    document.body.appendChild(panel);
}

function bootStoryPhone() {
    if (globalThis.__STStoryPhoneApp) return;
    try {
        storyPhoneRuntimeDebug.lastBootStep = 'boot';
        migrateStoryPhoneStateIfNeeded();
        removeStoryPhoneDomDuplicates();
        mountBootBubble();
        globalThis.__STStoryPhoneApp = new StoryPhoneApp();
        globalThis.__STStoryPhoneApp.start();
        document.getElementById('st-story-phone-boot-bubble')?.remove();
        bootSelfCheck();
        storyPhoneRuntimeDebug.lastBootStep = 'ready';
    } catch (error) {
        globalThis.__STStoryPhoneApp = null;
        storyPhoneRuntimeDebug.lastBootError = { message: error.message, stack: error.stack };
        storyPhoneRuntimeDebug.activeUiVersion = 'boot_error';
        storyPhoneRuntimeDebug.lastUiBootError = error.message;
        console.error('ST-StoryPhone boot failed', error);
        const bubble = document.getElementById('st-story-phone-boot-bubble');
        if (bubble) {
            bubble.textContent = 'Phone!';
            bubble.title = `ST-StoryPhone 启动失败：${error.message}`;
        }
        showStoryPhoneBootErrorPanel(error);
    }
}

function scheduleStoryPhoneBoot() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            mountBootBubble();
            bootStoryPhone();
        }, { once: true });
    } else {
        mountBootBubble();
        setTimeout(bootStoryPhone, 0);
    }

    const context = getContext();
    const events = context.eventSource;
    const types = context.event_types || {};
    [types.APP_INITIALIZED, types.APP_READY]
        .filter(Boolean)
        .forEach((type) => events?.on?.(type, bootStoryPhone));

    setTimeout(bootStoryPhone, 2000);
}

globalThis.STStoryPhoneDebug = {
    boot: bootStoryPhone,
    resetUi: forceResetStoryPhoneUiState,
    bootSelfCheck,
    open: (source = 'debug_api') => requestStoryPhoneOpen(source, () => globalThis.__STStoryPhoneApp?.ui?.openPhone?.()),
    runtimeDebug: storyPhoneRuntimeDebug,
    state: () => globalThis.__STStoryPhoneApp?.state?.value || null,
};

migrateStoryPhoneStateIfNeeded();
scheduleStoryPhoneBoot();

globalThis.STStoryPhoneOnClean = async function STStoryPhoneOnClean() {
    let keys = [];
    try {
        keys = Object.keys(localStorage);
    } catch (error) {
        console.warn(`${EXTENSION_ID}: cleanup storage enumeration failed`, error);
    }
    keys
        .filter((key) => key.startsWith(`${STORAGE_PREFIX}:`))
        .forEach((key) => safeStorageRemove(key));
};
