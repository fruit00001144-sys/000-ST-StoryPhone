/* global SillyTavern */

import stGetContext from '../../../st-context.js';

const EXTENSION_ID = 'ST-StoryPhone';
const EXTENSION_ALIAS = 'ST-PhoningPhone';
const STORAGE_PREFIX = 'st_story_phone';

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
    PRIVATE_CHAT: 'phone_private_chat',
    GROUP_CHAT: 'phone_group_chat',
    MOMENTS: 'phone_moments',
    FORUM: 'phone_forum',
    CALENDAR: 'phone_calendar',
    MEMO: 'phone_memo',
    SYSTEM_PUSH: 'phone_system_push',
    TARGET_PHONE: 'target_phone',
    CHARACTER_SIDE_SCREEN: 'character_side_screen',
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
    if (!id) return 'user';
    const value = String(id);
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
    shieldStoryPhonePointer(bubble, () => bootStoryPhone());
    document.body.appendChild(bubble);
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
            const raw = localStorage.getItem(key);
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
            localStorage.setItem(key, JSON.stringify(value));
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
        const id = normalizeSpeakerId(speakerId);
        if (id === 'char') return this.profile.currentChar || {};
        return asArray(this.profile.friends).find((friend) => friend.id === id || friend.name === id) || {};
    }

    canSee(event, speakerId) {
        if (isVisibleToSpeaker(event, speakerId)) return true;
        const id = normalizeSpeakerId(speakerId);
        const visibility = normalizeVisibility(event?.visibility);
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
            linkedLorebookEntries: [],
            mediaDescriptions: [],
            proactiveQueue: [],
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
                minimized: false,
                apiEndpoint: localStorage.getItem('st_story_phone_api_endpoint') || '',
                apiKey: localStorage.getItem('st_story_phone_api_key') || '',
                apiModel: localStorage.getItem('st_story_phone_api_model') || '',
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
        this.data.linkedLorebookEntries = asArray(this.data.linkedLorebookEntries);
        this.data.mediaDescriptions = asArray(this.data.mediaDescriptions);
        this.data.proactiveQueue = asArray(this.data.proactiveQueue);
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

    createEvent(event) {
        const timestamp = event.timestamp || this.nextTimestamp();
        const visibility = normalizeVisibility(event.visibility, event);
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
        const actor = event.actor || event.actorId || 'user';
        const target = event.target ?? event.targetId ?? null;
        const isChar = this.isCharId(actor) || this.isCharId(target);
        const normalizedVisibility = normalizeVisibility(event.visibility, {
            ...event,
            actorId: actor,
            targetId: isChar ? 'char' : target,
            isChar,
        });
        const logged = this.addEvent({
            ...event,
            source,
            actor,
            target: isChar ? 'char' : target,
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

    upsertCalendar(item) {
        const entry = { id: item.id || `cal_${Date.now()}`, ...item };
        const index = this.data.phone.calendar.findIndex((existing) => existing.id === entry.id);
        if (index >= 0) this.data.phone.calendar[index] = entry;
        else this.data.phone.calendar.push(entry);
        this.addPhoneEvent({ source: EVENT_SOURCES.CALENDAR, type: 'calendar_edit', actor: 'user', summary: `日历更新：${entry.title}`, visibility: 'user_only' });
        this.save();
    }

    addMemo(text) {
        const memo = { id: `memo_${Date.now()}`, text, at: nowIso(), visibility: 'user_only' };
        this.data.phone.memos.unshift(memo);
        this.addPhoneEvent({ source: EVENT_SOURCES.MEMO, type: 'memo_add', actor: 'user', summary: `新增备忘录：${clampText(text, 80)}`, visibility: 'user_only' });
        this.save();
        return memo;
    }

    deleteMemo(id) {
        this.data.phone.memos = this.data.phone.memos.filter((memo) => memo.id !== id);
        this.addPhoneEvent({ source: EVENT_SOURCES.MEMO, type: 'memo_delete', actor: 'user', summary: '删除了一条备忘录', visibility: 'user_only' });
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
            type: 'group_message',
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
            type: 'character_side_item',
            actor: 'char',
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
            type: 'side_screen_visibility_conversion',
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
            const audit = new KnowledgeTimelineAuditor(this.state.value)
                .auditKnowledgeConsistency(JSON.stringify(parsed.items), speakerId, speakerContext);
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
                const audit = this.auditParsedResult(parsed, speakerId, speakerContext);
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
        if (taskType === 'forum' || taskType === 'moments') return 'system';
        return 'user';
    }

    auditParsedResult(parsed, defaultSpeakerId, defaultContext) {
        const auditor = new KnowledgeTimelineAuditor(this.state.value);
        const issues = [];
        asArray(parsed.items).forEach((item) => {
            const itemSpeaker = normalizeSpeakerId(item.speakerId || item.actorId || item.npcId || defaultSpeakerId);
            const context = itemSpeaker === defaultContext?.speakerId
                ? defaultContext
                : auditor.resolveVisibleContext(itemSpeaker);
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
        const audit = this.auditParsedResult(parsed, speakerId, speakerContext);
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

    attach() {
        globalThis.STStoryPhoneGenerationInterceptor = async (chat, contextSize, abort, type) => {
            if (type === 'quiet') return;
            if (!this.state?.value?.settings?.injectIntoMainContext) return;
            const summary = new KnowledgeTimelineAuditor(this.state.value).summarizeForMainChat('char');
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
        this.screen = null;
    }

    mount() {
        if (document.getElementById('st-story-phone')) return;
        this.root = createElement('section', 'stp-phone-shell', '');
        this.root.id = 'st-story-phone';
        this.root.innerHTML = `
            <div class="stp-phone">
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
        this.screen = this.root.querySelector('.stp-screen');
        shieldStoryPhonePointer(this.root.querySelector('.stp-mini'), () => this.toggleMinimized(true));
        this.root.querySelector('.stp-bubble').addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
            if (this.root.querySelector('.stp-bubble')?.dataset.stpSuppressOpen) return;
            this.toggleMinimized(false);
        }, true);
        this.bindDrag();
        this.bindEvents();
        this.toggleMinimized(Boolean(this.state.value.settings.minimized));
        this.render();
    }

    bindDrag() {
        const shell = this.root;
        const handle = this.root.querySelector('.stp-phone-top');
        const bubble = this.root.querySelector('.stp-bubble');
        const restore = safeJsonParse(localStorage.getItem(`${STORAGE_PREFIX}:phone_position`) || '{}', {});
        if (typeof restore.left === 'number' && typeof restore.top === 'number') {
            shell.style.left = `${restore.left}px`;
            shell.style.top = `${restore.top}px`;
            shell.style.right = 'auto';
            shell.style.bottom = 'auto';
        }
        const bind = (dragHandle) => {
            let startX = 0;
            let startY = 0;
            let startLeft = 0;
            let startTop = 0;
            let pointerId = null;
            let moved = false;
            dragHandle.style.touchAction = 'none';
            dragHandle.addEventListener('pointerdown', (event) => {
                if (event.target?.closest?.('button,input,textarea,label')) return;
                pointerId = event.pointerId;
                moved = false;
                const rect = shell.getBoundingClientRect();
                shell.style.left = `${rect.left}px`;
                shell.style.top = `${rect.top}px`;
                shell.style.right = 'auto';
                shell.style.bottom = 'auto';
                startX = event.clientX;
                startY = event.clientY;
                startLeft = rect.left;
                startTop = rect.top;
                dragHandle.setPointerCapture?.(pointerId);
                event.preventDefault();
                event.stopPropagation();
            });
            dragHandle.addEventListener('pointermove', (event) => {
                if (pointerId !== event.pointerId) return;
                const dx = event.clientX - startX;
                const dy = event.clientY - startY;
                if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
                const width = shell.offsetWidth || 52;
                const height = shell.offsetHeight || 52;
                const left = Math.max(4, Math.min(window.innerWidth - width - 4, startLeft + dx));
                const top = Math.max(48, Math.min(window.innerHeight - height - 4, startTop + dy));
                shell.style.left = `${left}px`;
                shell.style.top = `${top}px`;
                event.preventDefault();
                event.stopPropagation();
            });
            dragHandle.addEventListener('pointerup', (event) => {
                if (pointerId !== event.pointerId) return;
                dragHandle.releasePointerCapture?.(pointerId);
                pointerId = null;
                localStorage.setItem(`${STORAGE_PREFIX}:phone_position`, JSON.stringify({
                    left: parseInt(shell.style.left, 10) || 22,
                    top: parseInt(shell.style.top, 10) || 86,
                }));
                if (dragHandle === bubble && moved) bubble.dataset.stpSuppressOpen = '1';
                setTimeout(() => { delete bubble.dataset.stpSuppressOpen; }, 0);
                event.preventDefault();
                event.stopPropagation();
            });
        };
        bind(handle);
        bind(bubble);
        bubble.addEventListener('click', (event) => {
            if (bubble.dataset.stpSuppressOpen) {
                event.preventDefault();
                event.stopPropagation();
            }
        }, true);
    }

    bindEvents() {
        const context = getContext();
        const events = context.eventSource;
        const types = context.event_types || {};
        if (!events?.on) return;
        const refresh = () => {
            const collected = this.collector.collect();
            this.profileManager.resolve(collected);
            this.render();
        };
        [types.CHAT_CHANGED, types.MESSAGE_RECEIVED, types.MESSAGE_SENT, types.PERSONA_CHANGED, types.CHARACTER_EDITED]
            .filter(Boolean)
            .forEach((type) => events.on(type, refresh));
    }

    toggleMinimized(minimized) {
        this.state.value.settings.minimized = minimized;
        this.state.save();
        this.root.classList.toggle('stp-is-minimized', minimized);
    }

    render() {
        if (!this.screen) return;
        const collected = this.collector.collect();
        const profile = this.profileManager.resolve(collected);
        this.root.style.setProperty('--stp-owner', `"${profile.displayName || 'StoryPhone'}"`);

        if (this.activeApp === 'home') this.renderHome(profile);
        if (this.activeApp === 'wechat') this.renderWechat(profile);
        if (this.activeApp === 'groups') this.renderGroups(profile);
        if (this.activeApp === 'moments') this.renderMoments();
        if (this.activeApp === 'forum') this.renderForum(profile);
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

    renderHome(profile) {
        this.screen.innerHTML = '';
        const hero = createElement('div', 'stp-home-hero');
        hero.innerHTML = `
            <div class="stp-logo">Phoning<br>Phone</div>
            <div class="stp-subtitle">${profile.displayName || EXTENSION_ID}</div>
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
            asArray(profile.friends).forEach((friend) => {
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

        const layout = createElement('div', 'stp-chat-layout');
        const list = createElement('div', 'stp-friend-list');
        const friends = asArray(profile.friends);
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
        const visibility = normalizeVisibility('visible_to_npc', {
            user: true,
            actorId: isUserSender ? 'user' : id,
            targetId: isChar ? 'char' : id,
            isChar,
        });
        this.state.addPhoneEvent({
            source: EVENT_SOURCES.PRIVATE_CHAT,
            type: 'npc_chat',
            actor: isUserSender ? 'user' : id,
            target: isUserSender ? (isChar ? 'char' : id) : 'user',
            actorId: id,
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
                type: isForum ? 'forum_user_post' : 'moment_user_post',
                actor: 'user',
                target: isForum ? post.board : null,
                content: `${title} ${content} ${imageData ? '[图片]' : ''}`.trim(),
                visibility,
                summary: `${isForum ? '论坛发帖' : `朋友圈发布（${momentVisibilityLabel(profile, visibilityScope)}）`}：${clampText(title || content || '[图片]', 100)}`,
                meta: isForum ? {} : { visibilityScope },
            });
            this.state.save();
            if (isForum) this.renderForum(this.state.value.profile);
            else this.renderMoments();
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
                type: isForum ? 'forum_user_post' : 'moment_user_post',
                actor: 'user',
                target: isForum ? post.board : null,
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
        this.state.addPhoneEvent({ source: EVENT_SOURCES.MOMENTS, type: 'moments_refresh', actor: 'system', visibility: 'public', summary: result.summary || `生成 ${items.length} 条朋友圈` });
        items.forEach((item) => {
            this.state.addPhoneEvent({
                source: EVENT_SOURCES.MOMENTS,
                type: 'moment_post',
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
        this.state.addPhoneEvent({ source: EVENT_SOURCES.FORUM, type: 'forum_refresh', actor: 'system', visibility: 'public', summary: result.summary || `生成 ${items.length} 条论坛帖` });
        items.forEach((item) => {
            this.state.addPhoneEvent({
                source: EVENT_SOURCES.FORUM,
                type: 'forum_post',
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
                type: wasLiked ? `${source}_unlike` : `${source}_like`,
                actor: 'user',
                target: authorId,
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
                type: `${source}_comment`,
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
                source: EVENT_SOURCES.CHARACTER_SIDE_SCREEN,
                type: 'target_phone_item',
                actor: 'char',
                target: null,
                content: `${item.title || ''} ${item.content || item.text || ''}`.trim(),
                visibility: 'char_private',
                summary: `角色侧屏内容：${clampText(item.title || item.content || item.text, 120)}`,
                injectToMain: false,
            });
        });
        this.state.addPhoneEvent({ source: EVENT_SOURCES.CHARACTER_SIDE_SCREEN, type: 'side_screen_view', actor: 'player', target: 'char', visibility: 'player_visible', summary: result.summary || `玩家查看了 ${profile.targetPhoneOwner} 的角色侧屏`, injectToMain: false });
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
        const charContext = auditor.buildContextForSpeaker('char');
        const playerContext = auditor.buildContextForSpeaker('player');
        const entryMatch = new PhoneEntryManager(this.state).getRelevantPhoneEntries({ taskType: 'debug', speakerId: 'char', appType: 'debug' });
        const loreMatch = new MainLorebookLinker(this.state, this.collector).getRelevantMainLore({ taskType: 'debug', speakerId: 'char', matchedPhoneEntries: entryMatch.entries });
        const summary = createElement('pre', 'stp-debug-pre', JSON.stringify({
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

    renderSettings() {
        this.screen.innerHTML = '';
        const wrap = createElement('div', 'stp-app');
        wrap.append(this.nav('设置'));
        const settings = this.state.value.settings;
        const panel = createElement('div', 'stp-settings');
        panel.innerHTML = `
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
            localStorage.setItem('st_story_phone_api_endpoint', settings.apiEndpoint);
            localStorage.setItem('st_story_phone_api_key', settings.apiKey);
            localStorage.setItem('st_story_phone_api_model', settings.apiModel);
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
        const actor = speaker === 'user' ? 'user' : 'char';
        this.state.addEvent({
            source: EVENT_SOURCES.MAIN_CHAT,
            type: speaker === 'user' ? 'main_user_message' : 'main_char_message',
            actor,
            target: actor === 'user' ? 'char' : 'user',
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
        this.profileManager = new ProfileManager(this.state);
        this.generator = new BackgroundGenerator(this.state, this.collector);
        this.injector = new ContextInjector(this.state);
        this.scheduler = new ProactivePhoneEventScheduler(this.state);
        this.mainChatObserver = new MainChatObserver(this.state, this.collector);
        this.ui = new PhoneUI(this.state, this.collector, this.profileManager, this.generator);
    }

    start() {
        this.profileManager.resolve(this.collector.collect());
        this.injector.attach();
        this.mainChatObserver.attach();
        this.ui.mount();
        globalThis.STStoryPhoneKnowledge = {
            buildContextForSpeaker: (speakerId) => new KnowledgeTimelineAuditor(this.state.value).buildContextForSpeaker(speakerId),
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

function bootStoryPhone() {
    if (globalThis.__STStoryPhoneApp) return;
    try {
        mountBootBubble();
        globalThis.__STStoryPhoneApp = new StoryPhoneApp();
        globalThis.__STStoryPhoneApp.start();
        document.getElementById('st-story-phone-boot-bubble')?.remove();
    } catch (error) {
        globalThis.__STStoryPhoneApp = null;
        console.error('ST-StoryPhone boot failed', error);
        const bubble = document.getElementById('st-story-phone-boot-bubble');
        if (bubble) {
            bubble.textContent = 'Phone!';
            bubble.title = `ST-StoryPhone 启动失败：${error.message}`;
        }
        throw error;
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
    resetUi: () => {
        document.getElementById('st-story-phone')?.remove();
        globalThis.__STStoryPhoneApp = null;
        bootStoryPhone();
    },
    state: () => globalThis.__STStoryPhoneApp?.state?.value || null,
};

scheduleStoryPhoneBoot();

globalThis.STStoryPhoneOnClean = async function STStoryPhoneOnClean() {
    Object.keys(localStorage)
        .filter((key) => key.startsWith(`${STORAGE_PREFIX}:`))
        .forEach((key) => localStorage.removeItem(key));
};
